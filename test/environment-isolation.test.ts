// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyHearthPass,
  catalogHousehold,
  financialAuditHash,
  linkGoogleIdentity,
  makeHearthPass,
  overlayGoogleLinkFromMembership,
  personalReplicaForMember,
  postEntry,
  seedDemoHousehold,
} from "../src/core/index.ts";
import {
  assertHouseholdBinding,
  assertOutboxItemBinding,
  assertPassInviteConsistency,
} from "../src/core/environmentIsolation.ts";
import { inviteFromText } from "../src/core/invite.ts";
import {
  createMemoryContinuityStore,
  enqueueContinuitySnapshot,
  flushContinuityOutbox,
  setContinuityStore,
} from "../src/continuity.ts";
import {
  householdCloudProjection,
  pullHouseholdSnapshotById,
  pullConsistentMemberReplicaById,
  pullOrBootstrapConsistentMemberReplicaById,
  pullPersonalSnapshotById,
  pullSupabaseHousehold,
} from "../src/ledger/supabase.ts";
import { saveHousehold } from "../src/storage.ts";
import { reconcileHouseholdSnapshots } from "../src/api.ts";

const config = { url: "https://example.supabase.co", key: "sb_publishable_test" };

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  setContinuityStore(null);
});

describe("environment isolation adversarial boundaries", () => {
  it("rejects a Hearth Pass whose shared invite disagrees with its top-level invite", () => {
    const household = catalogHousehold();
    const pass = makeHearthPass(household);
    pass.shared.inviteCode = "maple-hearth-linen";
    expect(() => assertPassInviteConsistency(pass)).toThrow(/conflicting invite/);
    expect(() => applyHearthPass(null, pass, "MEM-001", "development")).toThrow(/conflicting invite/);
  });

  it("rejects a pulled snapshot whose invite does not match the typed phrase", async () => {
    const household = catalogHousehold();
    household.inviteCode = "cedar-lantern-maple";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify([{ payload: JSON.stringify(household) }]),
      { status: 200 },
    )));
    await expect(pullSupabaseHousehold("maple-hearth-linen", config, "development")).rejects.toThrow(
      /does not match the invite/,
    );
  });

  it("rejects a pulled snapshot whose environment disagrees with the selected pill", async () => {
    const household = { ...catalogHousehold(), inviteCode: "cedar-lantern-maple", environment: "production" as const };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify([{ payload: JSON.stringify(household) }]),
      { status: 200 },
    )));
    await expect(pullSupabaseHousehold("cedar-lantern-maple", config, "development")).rejects.toThrow(
      /Development\/Production pill/,
    );
  });

  it("rejects a household-id pull when the payload id does not match", async () => {
    const household = { ...catalogHousehold(), householdId: "HH-OTHER", inviteCode: "cedar-lantern-maple" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify([{ payload: JSON.stringify(household) }]),
      { status: 200 },
    )));
    await expect(pullHouseholdSnapshotById("HH-EXPECTED", "development", config)).rejects.toThrow(
      /different household/,
    );
  });

  it("returns null for a personal pull when the envelope member does not match", async () => {
    const personal = {
      kind: "personal" as const,
      memberId: "MEM-002",
      transactions: [],
      shifts: [],
      goals: [],
      goalContributions: [],
      goalPurchases: [],
      tombstones: [],
      lastCommittedAt: "2026-08-25T12:00:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify([{ payload: JSON.stringify(personal) }]),
      { status: 200 },
    )));
    await expect(pullPersonalSnapshotById("HH-001", "MEM-001", "development", config)).resolves.toBeNull();
  });

  it("retries until Shared and same-member Personal come from a stable cloud generation", async () => {
    const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };
    const linked = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      ...identity,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const sharedEight = { ...linked, linked: true, revision: 8, baseRevision: 8 };
    const latest = postEntry(sharedEight, {
      date: "2026-09-03",
      type: "expense",
      amount: "7.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Second-device Personal",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const sharedNine = {
      ...latest,
      linked: true,
      revision: 9,
      baseRevision: 9,
      transactions: latest.transactions.filter((row) => row.visibility !== "personal"),
    };
    const personalNine = personalReplicaForMember(latest, "MEM-001");
    let sharedReads = 0;
    let personalReads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("household_snapshots?")) {
        sharedReads += 1;
        return new Response(JSON.stringify([{ payload: JSON.stringify(sharedReads === 1 ? sharedEight : sharedNine) }]), { status: 200 });
      }
      if (url.includes("continuity_personal_snapshots?")) {
        personalReads += 1;
        return new Response(JSON.stringify([{ revision: 9, payload: JSON.stringify(personalNine) }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));

    const replica = await pullConsistentMemberReplicaById({
      householdId: linked.householdId,
      memberId: "MEM-001",
      environment: "development",
      config,
      identity,
    });

    expect(replica?.revision).toBe(9);
    expect(replica?.personal.transactions.some((row) => row.note === "Second-device Personal")).toBe(true);
    expect(sharedReads).toBe(3);
    expect(personalReads).toBe(2);
  });

  it("rejects a stable replica read when the requested member is not the signed-in Google member", async () => {
    const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };
    const linked = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      ...identity,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    let fetches = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      fetches += 1;
      return new Response(JSON.stringify([{ payload: JSON.stringify(linked) }]), { status: 200 });
    }));

    await expect(pullConsistentMemberReplicaById({
      householdId: linked.householdId,
      memberId: "MEM-002",
      environment: "development",
      config,
      identity,
    })).rejects.toThrow(/does not belong to the signed-in Google member/);
    expect(fetches).toBe(1);
  });

  it("bootstraps a newly redeemed member's missing Personal envelope at the unchanged shared revision", async () => {
    const identity = { email: "bianca@example.com", subject: "google-sub-bianca" };
    const authConfig = {
      ...config,
      accessToken: "signed-in-bianca",
      authUserId: "auth-user-bianca",
    };
    const shared = {
      ...catalogHousehold(),
      linked: true,
      revision: 4,
      baseRevision: 4,
    };
    const local = overlayGoogleLinkFromMembership(shared, {
      memberId: "MEM-002",
      ...identity,
      displayName: "Bianca",
    });
    const personal = personalReplicaForMember(local, "MEM-002");
    const expectedSharedHash = await financialAuditHash(householdCloudProjection(shared, "MEM-002"));
    let personalSeeded = false;
    let atomicPublishes = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("continuity_memberships?")) {
        return new Response(JSON.stringify([{
          household_id: shared.householdId,
          member_id: "MEM-002",
          google_subject: identity.subject,
          google_email: identity.email,
          auth_user_id: authConfig.authUserId,
          role: "member",
        }]), { status: 200 });
      }
      if (url.includes("continuity_personal_snapshots?")) {
        return new Response(JSON.stringify(personalSeeded
          ? [{ revision: 4, payload: JSON.stringify(personal) }]
          : []), { status: 200 });
      }
      if (url.includes("household_snapshots?")) {
        return new Response(JSON.stringify([{ payload: JSON.stringify(shared) }]), { status: 200 });
      }
      if (url.includes("households?select=id&limit=1")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("rpc/publish_continuity_snapshot")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        expect(body.p_expected_revision).toBe(4);
        expect(body.p_revision).toBe(4);
        expect(body.p_member_id).toBe("MEM-002");
        expect(body.p_snapshot_hash).toBe(expectedSharedHash);
        personalSeeded = true;
        atomicPublishes += 1;
        return new Response(JSON.stringify({ ok: true, conflict: false, duplicate: true, revision: 4 }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    const replica = await pullOrBootstrapConsistentMemberReplicaById({
      householdId: shared.householdId,
      memberId: "MEM-002",
      environment: "development",
      config: authConfig,
      identity,
      localHousehold: local,
    });

    expect(atomicPublishes).toBe(1);
    expect(replica?.revision).toBe(4);
    expect(replica?.personal.memberId).toBe("MEM-002");
    expect(replica?.shared.google.links.some((row) => (
      row.memberId === "MEM-002" && row.subject === identity.subject
    ))).toBe(true);
  });

  it("rejects persist when operatingEnvironment disagrees with the snapshot", async () => {
    const household = catalogHousehold("production");
    await expect(saveHousehold(household, { operatingEnvironment: "development", memberId: "MEM-001" })).rejects.toThrow(
      /different environment and was not saved/,
    );
    expect(localStorage.getItem("hearth:household:v2:production:" + encodeURIComponent(household.householdId))).toBeNull();
  });

  it("rejects reconcile when remote household or invite does not match", async () => {
    const local = seedDemoHousehold({ today: "2026-08-24", environment: "development" });
    const remoteEnv = { ...local, environment: "production" as const };
    await expect(reconcileHouseholdSnapshots(local, remoteEnv, "MEM-001")).rejects.toThrow(/Development\/Production pill/);

    const remoteHousehold = { ...local, householdId: "HH-OTHER" };
    await expect(reconcileHouseholdSnapshots(local, remoteHousehold, "MEM-001")).rejects.toThrow(/different household/);

    const remoteInvite = { ...local, inviteCode: "maple-hearth-linen" };
    await expect(reconcileHouseholdSnapshots(local, remoteInvite, "MEM-001")).rejects.toThrow(/does not match this household invite/);
  });

  it("refuses to enqueue or flush an outbox item whose snapshot tuple was tampered", async () => {
    const store = createMemoryContinuityStore();
    setContinuityStore(store);
    let household = seedDemoHousehold({ today: "2026-08-24", environment: "development" });
    household = {
      ...household,
      linked: true,
      google: {
        ...household.google,
        links: [{
          memberId: "MEM-001",
          subject: "sub-1",
          email: "jon@example.com",
          displayName: "Jonathan",
          active: true,
          linkedAt: "2026-08-25T12:00:00.000Z",
          lastConfirmedAt: "2026-08-25T12:00:00.000Z",
          grantedScopes: [],
          updatedAt: "2026-08-25T12:00:00.000Z",
        }],
      },
    };

    expect(() => assertOutboxItemBinding({
      environment: "development",
      householdId: household.householdId,
      memberId: "MEM-001",
      snapshot: { ...household, environment: "production" },
    })).toThrow(/outbox entry belongs to a different environment/);

    expect(() => assertOutboxItemBinding({
      environment: "development",
      householdId: household.householdId,
      memberId: "MEM-001",
      snapshot: { ...household, householdId: "HH-TAMPERED" },
    })).toThrow(/different household and was not replayed/);

    enqueueContinuitySnapshot({
      household,
      identity: { subject: "sub-1", email: "jon@example.com" },
      expectedRevision: 0,
      confirmationId: "CONF-1",
    });
    const raw = store.getItem("hearth:continuity-outbox:v1:development");
    expect(raw).toBeTruthy();
    expect(raw).not.toMatch(/"transactions"/);
    const items = JSON.parse(raw!) as Array<{
      householdId: string;
      tipRevision: number;
      snapshot?: typeof household;
    }>;
    expect(items[0]?.snapshot).toBeUndefined();
    expect(items[0]?.tipRevision).toBe(household.revision);
    // Tamper the durable tip pointer — flush must not publish under the wrong id.
    items[0]!.householdId = "HH-TAMPERED";
    store.setItem("hearth:continuity-outbox:v1:development", JSON.stringify(items));

    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity: { subject: "sub-1", email: "jon@example.com" },
      config,
      force: true,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(flushed.pending).toBeGreaterThan(0);
  });

  it("accepts a matching pulled snapshot binding", () => {
    const household = catalogHousehold();
    household.inviteCode = "cedar-lantern-maple";
    expect(() => assertHouseholdBinding(household, {
      environment: "development",
      inviteCode: inviteFromText("Cedar Lantern Maple"),
    }, "pull")).not.toThrow();
  });

  it("rejects a pulled or persisted snapshot that omits environment", () => {
    const household = catalogHousehold();
    expect(() => assertHouseholdBinding(
      { ...household, environment: undefined as unknown as "development" },
      { environment: "development" },
      "pull",
    )).toThrow(/missing its Development\/Production environment/);
    expect(() => assertOutboxItemBinding({
      environment: "development",
      householdId: household.householdId,
      memberId: "MEM-001",
      snapshot: { ...household, environment: undefined as unknown as "development" },
    })).toThrow(/missing its environment and was not replayed/);
  });

  it("rejects pull/persist/outbox when Google subject does not match household membership", async () => {
    let household = seedDemoHousehold({ today: "2026-08-24", environment: "development" });
    household = {
      ...household,
      google: {
        ...household.google,
        links: [{
          memberId: "MEM-001",
          subject: "sub-owner",
          email: "jon@example.com",
          displayName: "Jonathan",
          active: true,
          linkedAt: "2026-08-25T12:00:00.000Z",
          lastConfirmedAt: "2026-08-25T12:00:00.000Z",
          grantedScopes: [],
          updatedAt: "2026-08-25T12:00:00.000Z",
        }],
      },
    };

    expect(() => assertHouseholdBinding(household, {
      environment: "development",
      householdId: household.householdId,
      memberId: "MEM-001",
      googleSubject: "sub-other",
      googleEmail: "other@example.com",
    }, "pull")).toThrow(/not linked to this Google account/);

    await expect(saveHousehold(household, {
      operatingEnvironment: "development",
      memberId: "MEM-001",
      continuityIdentity: { subject: "sub-other", email: "other@example.com" },
    })).rejects.toThrow(/not linked to the signed-in Google account/);

    expect(() => assertOutboxItemBinding({
      environment: "development",
      householdId: household.householdId,
      memberId: "MEM-001",
      identity: { subject: "sub-other", email: "other@example.com" },
      snapshot: household,
    })).toThrow(/not linked to the signed-in Google account/);
  });

  it("rejects a live pull when the signed-in Google identity is not on the payload", async () => {
    const household = {
      ...catalogHousehold(),
      householdId: "HH-EXPECTED",
      inviteCode: "cedar-lantern-maple",
      google: {
        ...catalogHousehold().google,
        links: [{
          memberId: "MEM-001",
          subject: "sub-owner",
          email: "jon@example.com",
          displayName: "Jonathan",
          active: true,
          linkedAt: "2026-08-25T12:00:00.000Z",
          lastConfirmedAt: "2026-08-25T12:00:00.000Z",
          grantedScopes: [],
          updatedAt: "2026-08-25T12:00:00.000Z",
        }],
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify([{ payload: JSON.stringify(household) }]),
      { status: 200 },
    )));
    await expect(pullHouseholdSnapshotById(
      "HH-EXPECTED",
      "development",
      config,
      { subject: "sub-intruder", email: "intruder@example.com" },
    )).rejects.toThrow(/not linked to this Google account/);
  });

  it("refuses to flush an outbox item when the flush identity differs from the queued identity", async () => {
    const store = createMemoryContinuityStore();
    setContinuityStore(store);
    let household = seedDemoHousehold({ today: "2026-08-24", environment: "development" });
    household = {
      ...household,
      linked: true,
      google: {
        ...household.google,
        links: [{
          memberId: "MEM-001",
          subject: "sub-1",
          email: "jon@example.com",
          displayName: "Jonathan",
          active: true,
          linkedAt: "2026-08-25T12:00:00.000Z",
          lastConfirmedAt: "2026-08-25T12:00:00.000Z",
          grantedScopes: [],
          updatedAt: "2026-08-25T12:00:00.000Z",
        }],
      },
    };
    enqueueContinuitySnapshot({
      household,
      identity: { subject: "sub-1", email: "jon@example.com" },
      expectedRevision: 0,
      confirmationId: "CONF-IDENTITY",
    });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity: { subject: "sub-other", email: "other@example.com" },
      config,
      force: true,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(flushed.synchronized).toBe(0);
    expect(flushed.pending).toBe(0);
    // Queued item remains for the original Google identity.
    expect(JSON.parse(store.getItem("hearth:continuity-outbox:v1:development")!).length).toBe(1);
  });
});
