// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyHearthPass,
  catalogHousehold,
  makeHearthPass,
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
  pullHouseholdSnapshotById,
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

  it("rejects persist when operatingEnvironment disagrees with the snapshot", async () => {
    const household = seedDemoHousehold({ today: "2026-08-24", environment: "production" });
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
    const items = JSON.parse(raw!) as Array<{ snapshot: typeof household; householdId: string }>;
    items[0]!.snapshot = { ...items[0]!.snapshot, householdId: "HH-TAMPERED" };
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
});
