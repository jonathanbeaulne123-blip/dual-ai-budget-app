import { afterEach, describe, expect, it, vi } from "vitest";
import {
  continuityBackoffMs,
  createMemoryContinuityStore,
  flushContinuityOutbox,
  listContinuityOutbox,
  setContinuityNow,
  setContinuityStore,
  transportHouseholdWithOutbox,
} from "../src/continuity.ts";
import { financialAuditHash } from "../src/core/commandIdentity.ts";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "../src/core/index.ts";
import type { Household, HouseholdCharter } from "../src/core/types.ts";
import {
  applyPublishHouseholdSnapshotCas,
  createMemoryHostedCas,
  type SnapshotCasRequest,
  type SnapshotCasStore,
} from "../src/ledger/snapshotCas.ts";
import { householdCloudProjection, pushSupabaseHousehold } from "../src/ledger/supabase.ts";
import { decodeJsonPayload } from "../src/ledger/snapshotPayload.ts";

const config = { url: "https://cas.example.supabase.co", key: "sb_publishable_cas_test" };
const identityA = { email: "jonathan@example.com", subject: "google-sub-jonathan" };
const identityB = { email: "bianca@example.com", subject: "google-sub-bianca" };

function googleHousehold(member: "A" | "B" = "A"): Household {
  const base = catalogHousehold();
  if (member === "A") {
    return linkGoogleIdentity(base, {
      memberId: "MEM-001",
      email: identityA.email,
      subject: identityA.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
  }
  return linkGoogleIdentity(base, {
    memberId: "MEM-002",
    email: identityB.email,
    subject: identityB.subject,
    displayName: "Bianca",
    grantedScopes: ["openid", "email"],
  }).household;
}

function expense(household: Household, note: string, amount: string, createdBy = "MEM-001"): Household {
  return postEntry(household, {
    date: "2026-08-24",
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy,
    confirmDuplicate: true,
  }).household;
}

function charter(purpose: string): HouseholdCharter {
  const at = "2026-08-24T12:00:00.000Z";
  return {
    id: "CHARTER-001",
    purpose,
    custodianMemberId: "MEM-001",
    splitRule: "remainder",
    splitNote: "One income covers what it covers and the other closes the rest.",
    ceilingKind: "none",
    ceilingValue: 0,
    cadence: "none",
    cadenceWeekday: 0,
    clauses: [],
    permissions: [],
    signatures: [
      { memberId: "MEM-001", signedAt: null },
      { memberId: "MEM-002", signedAt: null },
    ],
    amendments: [],
    foundedOn: "2026-08-24",
    createdAt: at,
    termsUpdatedAt: at,
    updatedAt: at,
  };
}

async function casRequest(household: Household, expectedRevision: number): Promise<SnapshotCasRequest> {
  return {
    householdId: household.householdId,
    expectedRevision,
    revision: household.revision,
    environment: household.environment,
    name: household.name,
    timezone: household.timezone,
    currency: household.currency,
    invitePhrase: household.inviteCode,
    linked: true,
    lastCommittedAt: household.lastCommittedAt ?? "",
    payload: JSON.stringify(household),
    snapshotHash: await financialAuditHash(household),
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function missingRpc(): Response {
  return response({
    code: "PGRST202",
    message: "Could not find the function public.publish_household_snapshot without parameters in the schema cache",
  }, 404);
}

/** Wire fetch to an in-memory hosted CAS that mirrors migration 002. */
function stubFetchAgainstHostedCas(host: ReturnType<typeof createMemoryHostedCas>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("households?select=id")) return response([]);
    if (url.includes("rpc/publish_household_snapshot")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const result = await host.publish({
        householdId: String(body.p_household_id),
        expectedRevision: Number(body.p_expected_revision),
        revision: Number(body.p_revision),
        environment: String(body.p_environment),
        name: String(body.p_name),
        timezone: String(body.p_timezone),
        currency: String(body.p_currency),
        invitePhrase: String(body.p_invite_phrase),
        linked: Boolean(body.p_linked),
        lastCommittedAt: String(body.p_last_committed_at ?? ""),
        payload: String(body.p_payload),
        snapshotHash: String(body.p_snapshot_hash),
      });
      if (result.ok) {
        return response({
          ok: true,
          conflict: false,
          duplicate: result.duplicate === true,
          revision: result.revision,
        });
      }
      return response({
        ok: false,
        conflict: true,
        reason: result.reason,
        remote_revision: result.remoteRevision,
        remote_payload: result.remotePayload,
      });
    }
    if (url.includes("continuity_memberships?") || url.includes("continuity_personal_snapshots?")) {
      return response({ code: "PGRST205", message: "missing" }, 404);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

afterEach(() => {
  setContinuityStore(null);
  setContinuityNow(null);
  vi.unstubAllGlobals();
});

describe("publish_household_snapshot CAS contract", () => {
  it("projects Personal rows out of the household payload while keeping command receipts", () => {
    const base = googleHousehold();
    const personal = postEntry(base, {
      date: "2026-08-24",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Private pharmacy",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const withReceipt = {
      ...personal,
      commandReceipts: [{
        confirmationId: "confirm-private",
        identityHash: "identity",
        auditHash: "audit",
        commandKind: "postEntry",
        postedIds: [personal.transactions.at(-1)?.id ?? ""],
        revision: 1,
        acceptedAt: "2026-08-24T12:00:00.000Z",
      }],
    };
    const cloud = householdCloudProjection(withReceipt, "MEM-001");
    expect(cloud.transactions.some((row) => row.visibility === "personal")).toBe(false);
    expect(cloud.commandReceipts).toHaveLength(1);
  });

  it("accepts the first write, rejects a simultaneous stale writer, and acks duplicates", async () => {
    let store: SnapshotCasStore = { household: null, snapshot: null };
    const a = { ...expense(googleHousehold("A"), "Milk A", "4.00"), revision: 1, baseRevision: 0, linked: true };
    const b = { ...expense(googleHousehold("B"), "Milk B", "5.00"), revision: 1, baseRevision: 0, linked: true };
    const reqA = await casRequest(a, 0);
    const reqB = await casRequest(b, 0);

    const first = applyPublishHouseholdSnapshotCas(store, reqA, "2026-08-24T12:00:00.000Z");
    store = first.store;
    expect(first.result).toMatchObject({ ok: true, conflict: false, duplicate: false, revision: 1 });

    const loser = applyPublishHouseholdSnapshotCas(store, reqB, "2026-08-24T12:00:01.000Z");
    expect(loser.result.ok).toBe(false);
    if (loser.result.ok) throw new Error("expected conflict");
    // Same target revision + different books → hash mismatch; otherwise stale base.
    expect(["stale-revision", "revision-hash-mismatch"]).toContain(loser.result.reason);
    expect(((await decodeJsonPayload(String(loser.result.remotePayload))) as Household).transactions.some((row) => row.note === "Milk A")).toBe(true);
    expect(store.snapshot?.payload).toBe(first.store.snapshot?.payload);

    const dup = applyPublishHouseholdSnapshotCas(store, reqA, "2026-08-24T12:00:02.000Z");
    expect(dup.result).toMatchObject({ ok: true, conflict: false, duplicate: true, revision: 1 });
    expect(dup.store.snapshot?.payload).toBe(store.snapshot?.payload);
  });

  it("rejects a same-revision charter-only edit instead of acknowledging it as a duplicate", async () => {
    let store: SnapshotCasStore = { household: null, snapshot: null };
    const base = googleHousehold();
    const firstCharter = { ...base, revision: 1, baseRevision: 0, charter: charter("Keep the household steady.") };
    const otherCharter = { ...base, revision: 1, baseRevision: 0, charter: charter("Keep a shared home without overwork.") };
    const firstRequest = await casRequest(firstCharter, 0);
    const otherRequest = await casRequest(otherCharter, 0);

    expect(otherRequest.snapshotHash).not.toBe(firstRequest.snapshotHash);
    const first = applyPublishHouseholdSnapshotCas(store, firstRequest, "2026-08-24T12:00:00.000Z");
    store = first.store;
    const loser = applyPublishHouseholdSnapshotCas(store, otherRequest, "2026-08-24T12:00:01.000Z");

    expect(loser.result).toMatchObject({ ok: false, conflict: true, reason: "revision-hash-mismatch" });
    expect((JSON.parse(String(store.snapshot?.payload)) as Household).charter?.purpose).toBe("Keep the household steady.");
  });

  it("accepts compacted offline revision jumps but never accepts a non-advancing revision", async () => {
    const host = createMemoryHostedCas();
    // The outbox may compact several local confirmations into one upload while
    // retaining the earliest hosted base revision.
    const first = { ...expense(googleHousehold(), "Coffee", "6.00"), revision: 3, linked: true };
    await host.publish(await casRequest(first, 0));
    expect(host.get(first.householdId).household?.revision).toBe(3);

    const nonAdvancing = { ...first, revision: 2 };
    const result = await host.publish(await casRequest(nonAdvancing, 3));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected non-advancing conflict");
    expect(result.reason).toBe("non-advancing-revision");
    expect(host.get(first.householdId).household?.revision).toBe(3);
  });

  it("rejects an initial revision zero instead of creating an unadvanced cloud base", async () => {
    const host = createMemoryHostedCas();
    const initial = { ...googleHousehold(), revision: 0, baseRevision: 0, linked: true };
    const result = await host.publish(await casRequest(initial, 0));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected non-advancing conflict");
    expect(result.reason).toBe("non-advancing-revision");
    expect(host.get(initial.householdId).household).toBeNull();
  });
});

describe("two-client hosted CAS + outbox", () => {
  it("lets only one of two simultaneous writers land; loser keeps local books and surfaces conflict", async () => {
    const host = createMemoryHostedCas();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(host));

    const base = { ...googleHousehold("A"), revision: 0, baseRevision: 0, linked: true };
    const localA = { ...expense(base, "Device A milk", "4.00"), revision: 1, baseRevision: 0, linked: true };
    const localBSeed = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identityA.email,
      subject: identityA.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const localB = {
      ...expense(localBSeed, "Device B bread", "3.50"),
      revision: 1,
      baseRevision: 0,
      linked: true,
      householdId: localA.householdId,
      inviteCode: localA.inviteCode,
    };

    const [resultA, resultB] = await Promise.all([
      pushSupabaseHousehold(localA, config, { expectedRevision: 0, continuityIdentity: identityA }),
      pushSupabaseHousehold(localB, config, { expectedRevision: 0, continuityIdentity: identityA }),
    ]);

    const wins = [resultA, resultB].filter((row) => !row.conflict && row.schema);
    const losses = [resultA, resultB].filter((row) => row.conflict);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);

    const winnerNote = resultA.conflict ? "Device B bread" : "Device A milk";
    const loserNote = resultA.conflict ? "Device A milk" : "Device B bread";
    const loserLocal = resultA.conflict ? localA : localB;
    const remote = await decodeJsonPayload(String(host.get(localA.householdId).snapshot?.payload)) as Household;
    expect(remote.revision).toBe(1);
    expect(remote.transactions.some((row) => row.note === winnerNote)).toBe(true);
    expect(remote.transactions.some((row) => row.note === loserNote)).toBe(false);

    setContinuityStore(createMemoryContinuityStore());
    const conflicted = await transportHouseholdWithOutbox({
      household: loserLocal,
      identity: identityA,
      expectedRevision: 0,
      confirmationId: "confirm-loser",
      config,
    });
    expect(conflicted.ok).toBe(false);
    if (conflicted.ok) throw new Error("expected conflict");
    expect(conflicted.errorClass).toBe("conflict-detected");
    const queued = listContinuityOutbox("development");
    expect(queued).toHaveLength(1);
    expect(queued[0]?.blockedByConflict).toBe(true);
    expect(queued[0]?.snapshot?.transactions.some((row) => row.note === loserNote)).toBe(true);
  });

  it("acknowledges duplicate delivery without rewriting a different payload", async () => {
    const host = createMemoryHostedCas();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(host));
    const household = { ...expense(googleHousehold(), "Dup milk", "4.00"), revision: 1, baseRevision: 0, linked: true };

    const first = await pushSupabaseHousehold(household, config, { expectedRevision: 0, continuityIdentity: identityA });
    expect(first.conflict).toBeFalsy();
    expect(first.usedCasRpc).toBe(true);
    expect(first.duplicate).toBeFalsy();

    const again = await pushSupabaseHousehold(household, config, { expectedRevision: 0, continuityIdentity: identityA });
    expect(again.conflict).toBeFalsy();
    expect(again.duplicate).toBe(true);
    const remote = await decodeJsonPayload(String(host.get(household.householdId).snapshot?.payload)) as Household;
    expect(remote.transactions.some((row) => row.note === "Dup milk")).toBe(true);
    expect(remote.revision).toBe(1);
    expect(host.get(household.householdId).household?.revision).toBe(1);
  });

  it("rejects a stale revision and leaves the local outbox snapshot intact", async () => {
    const host = createMemoryHostedCas();
    setContinuityStore(createMemoryContinuityStore());
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(host));

    const first = { ...expense(googleHousehold(), "Cloud milk", "4.00"), revision: 2, baseRevision: 0, linked: true };
    await pushSupabaseHousehold(first, config, { expectedRevision: 0, continuityIdentity: identityA });

    const staleLocal = { ...expense(googleHousehold(), "Stale toast", "2.00"), revision: 2, baseRevision: 1, linked: true, householdId: first.householdId, inviteCode: first.inviteCode };
    const result = await transportHouseholdWithOutbox({
      household: staleLocal,
      identity: identityA,
      expectedRevision: 1,
      confirmationId: "confirm-stale",
      config,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected conflict");
    expect(result.errorClass).toBe("conflict-detected");
    expect(listContinuityOutbox("development")[0]?.snapshot?.transactions.some((row) => row.note === "Stale toast")).toBe(true);
    expect(((await decodeJsonPayload(String(host.get(first.householdId).snapshot?.payload))) as Household).transactions.some((row) => row.note === "Cloud milk")).toBe(true);
  });

  it("replays an offline client's outbox after reconnect without erasing local acceptance", async () => {
    const host = createMemoryHostedCas();
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...expense(googleHousehold(), "Offline milk", "4.00"), revision: 1, baseRevision: 0, linked: true };

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const pending = await transportHouseholdWithOutbox({
      household,
      identity: identityA,
      expectedRevision: 0,
      confirmationId: "confirm-offline",
      config,
    });
    expect(pending.ok).toBe(false);
    expect(listContinuityOutbox("development")[0]?.snapshot?.transactions.some((row) => row.note === "Offline milk")).toBe(true);

    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(host));
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity: identityA,
      config,
      force: true,
    });
    expect(flushed).toEqual({ synchronized: 1, pending: 0, deferred: 0, conflicts: [] });
    expect(listContinuityOutbox("development")).toEqual([]);
    expect(((await decodeJsonPayload(String(host.get(household.householdId).snapshot?.payload))) as Household).transactions.some((row) => row.note === "Offline milk")).toBe(true);
  });

  it("keeps one completely offline client queued while the online peer publishes", async () => {
    const host = createMemoryHostedCas();
    const onlineStore = createMemoryContinuityStore();
    const offlineStore = createMemoryContinuityStore();

    const onlineLocal = { ...expense(googleHousehold(), "Online milk", "4.00"), revision: 1, baseRevision: 0, linked: true };
    const offlineLocal = {
      ...expense(googleHousehold(), "Still offline milk", "5.00"),
      revision: 1,
      baseRevision: 0,
      linked: true,
      householdId: onlineLocal.householdId,
      inviteCode: onlineLocal.inviteCode,
    };

    setContinuityStore(onlineStore);
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(host));
    const online = await transportHouseholdWithOutbox({
      household: onlineLocal,
      identity: identityA,
      expectedRevision: 0,
      confirmationId: "confirm-online",
      config,
    });
    expect(online.ok).toBe(true);

    setContinuityStore(offlineStore);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("device offline");
    }));
    const offline = await transportHouseholdWithOutbox({
      household: offlineLocal,
      identity: identityA,
      expectedRevision: 0,
      confirmationId: "confirm-still-offline",
      config,
    });
    expect(offline.ok).toBe(false);
    expect(listContinuityOutbox("development")).toHaveLength(1);
    const onlineRemote = await decodeJsonPayload(String(host.get(onlineLocal.householdId).snapshot?.payload)) as Household;
    expect(onlineRemote.transactions.some((row) => row.note === "Online milk")).toBe(true);
    expect(onlineRemote.transactions.some((row) => row.note === "Still offline milk")).toBe(false);
  });

  it("defers automatic flush until backoff elapses", async () => {
    let now = 1_000_000;
    setContinuityNow(() => now);
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...expense(googleHousehold(), "Backoff milk", "4.00"), revision: 1, baseRevision: 0, linked: true };

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("temporary outage");
    }));
    await transportHouseholdWithOutbox({
      household,
      identity: identityA,
      expectedRevision: 0,
      confirmationId: "confirm-backoff",
      config,
    });
    const queued = listContinuityOutbox("development")[0];
    expect(queued?.attempts).toBe(1);
    expect(queued?.nextAttemptAt).toBe(new Date(now + continuityBackoffMs(1)).toISOString());

    const deferred = await flushContinuityOutbox({ environment: "development", identity: identityA, config });
    expect(deferred).toEqual({ synchronized: 0, pending: 1, deferred: 1, conflicts: [] });

    now += continuityBackoffMs(1) + 1;
    const host = createMemoryHostedCas();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(host));
    const flushed = await flushContinuityOutbox({ environment: "development", identity: identityA, config });
    expect(flushed.synchronized).toBe(1);
    expect(listContinuityOutbox("development")).toEqual([]);
  });

  it("falls back to legacy GET-compare when the CAS RPC is missing", async () => {
    const local = { ...expense(googleHousehold(), "Legacy", "1.00"), revision: 5, baseRevision: 3, linked: true };
    const remote = {
      ...googleHousehold(),
      revision: 4,
      linked: true,
      householdId: local.householdId,
      inviteCode: local.inviteCode,
    };
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot")) return missingRpc();
      if (url.includes("household_snapshots?")) {
        expect(url).toContain("environment=eq.development");
        expect(url).toContain(`household_id=eq.${encodeURIComponent(local.householdId)}`);
        return response([{ payload: JSON.stringify(remote) }]);
      }
      return response(null, 201);
    }));
    const result = await pushSupabaseHousehold(local, config, { expectedRevision: 3, legacyLinkedPublish: true });
    expect(result.conflict).toBe(true);
    expect(result.usedCasRpc).toBe(false);
    expect(calls.some((call) => call.includes("rpc/publish_household_snapshot"))).toBe(true);
    expect(calls.some((call) => /POST/i.test(call) && call.includes("household_snapshots"))).toBe(false);
  });

  it("converges after clock skew when revisions remain monotonic", async () => {
    const host = createMemoryHostedCas();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(host));

    const skewedEarly = {
      ...expense(googleHousehold(), "Skew early milk", "4.00"),
      revision: 1,
      baseRevision: 0,
      linked: true,
      lastCommittedAt: "2026-08-24T09:00:00.000Z",
    };
    const skewedLate = {
      ...expense(googleHousehold(), "Skew late bread", "3.50"),
      revision: 2,
      baseRevision: 1,
      linked: true,
      householdId: skewedEarly.householdId,
      inviteCode: skewedEarly.inviteCode,
      lastCommittedAt: "2026-08-24T08:00:00.000Z",
    };

    const first = await pushSupabaseHousehold(skewedEarly, config, {
      expectedRevision: 0,
      continuityIdentity: identityA,
    });
    expect(first.conflict).toBeFalsy();

    const second = await pushSupabaseHousehold(skewedLate, config, {
      expectedRevision: 1,
      continuityIdentity: identityA,
    });
    expect(second.conflict).toBeFalsy();
    const remote = await decodeJsonPayload(String(host.get(skewedEarly.householdId).snapshot?.payload)) as Household;
    expect(remote.revision).toBe(2);
    expect(remote.lastCommittedAt).toBe("2026-08-24T08:00:00.000Z");
    expect(remote.transactions.some((row) => row.note === "Skew late bread")).toBe(true);
  });

  it("keeps local outbox intact when publish fails after the probe succeeds (partial failure)", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = {
      ...expense(googleHousehold(), "Partial milk", "4.00"),
      revision: 1,
      baseRevision: 0,
      linked: true,
    };
    let casCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot")) {
        casCalls += 1;
        throw new Error("socket reset mid-publish");
      }
      if (url.includes("continuity_memberships?") || url.includes("continuity_personal_snapshots?")) {
        return response({ code: "PGRST205", message: "missing" }, 404);
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    const pending = await transportHouseholdWithOutbox({
      household,
      identity: identityA,
      expectedRevision: 0,
      confirmationId: "confirm-partial",
      config,
    });
    expect(pending.ok).toBe(false);
    if (pending.ok) throw new Error("expected pending");
    expect(pending.errorClass).toBe("pending-transport");
    expect(casCalls).toBe(1);
    const queued = listContinuityOutbox("development");
    expect(queued).toHaveLength(1);
    expect(queued[0]?.snapshot?.transactions.some((row) => row.note === "Partial milk")).toBe(true);
    expect(queued[0]?.blockedByConflict).toBe(false);
    expect(queued[0]?.attempts).toBe(1);

    const host = createMemoryHostedCas();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(host));
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity: identityA,
      config,
      force: true,
    });
    expect(flushed.synchronized).toBe(1);
    expect(listContinuityOutbox("development")).toEqual([]);
    expect(((await decodeJsonPayload(String(host.get(household.householdId).snapshot?.payload))) as Household).transactions.some(
      (row) => row.note === "Partial milk",
    )).toBe(true);
  });
});
