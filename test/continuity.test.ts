import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  awaitContinuityOutboxDurable,
  cancelContinuityConflictGeneration,
  createMemoryContinuityStore,
  clearContinuityOutboxForHousehold,
  discoverContinuityMemberships,
  enqueueContinuitySnapshot,
  flushContinuityOutbox,
  humanizeContinuityError,
  isStorageQuotaError,
  listContinuityOutbox,
  resolveOutboxHousehold,
  setContinuityStore,
  stagedHouseholdMatchesContinuityGeneration,
  transportHouseholdWithOutbox,
} from "../src/continuity.ts";
import { catalogHousehold, createWriteQueue, financialAuditHash, linkGoogleIdentity, personalReplicaForMember, postEntry, postWorkShift, upsertWorkJob, shapeWorkJob, type WorkJob } from "../src/core/index.ts";
import { householdCloudProjection } from "../src/ledger/supabase.ts";
import type { Household } from "../src/core/types.ts";
import { pushSupabaseHousehold } from "../src/ledger/supabase.ts";
import { decodeJsonPayload } from "../src/ledger/snapshotPayload.ts";
import { closeStagedBooksHandlesForTests, loadStagedHouseholdBooks, setStagedBooksDataDirForTests, validateHouseholdBooksStaged } from "../src/ledger/engine.ts";

const config = { url: "https://continuity.example.supabase.co", key: "sb_publishable_test" };
const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };

function googleHousehold(subject = identity.subject, email = identity.email): Household {
  return linkGoogleIdentity(catalogHousehold(), {
    memberId: "MEM-001",
    email,
    subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
}

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function casOk(revision = 1): Response {
  return response({ ok: true, conflict: false, duplicate: false, revision });
}

/** D-147: continuity identity must use CAS — never legacy GET-compare-POST. */
function continuityCasFetch(options?: { remote?: Household; track?: Array<{ url: string; body: unknown }> }) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (options?.track) {
      options.track.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    }
    if (url.includes("households?select=id")) return response([]);
    if (url.includes("rpc/publish_household_snapshot") || url.includes("rpc/publish_continuity_snapshot")) {
      if (options?.remote) {
        return response({
          ok: false,
          conflict: true,
          reason: "stale-revision",
          remote_revision: options.remote.revision,
          remote_payload: JSON.stringify(options.remote),
        });
      }
      const body = init?.body ? JSON.parse(String(init.body)) as { p_revision?: number } : {};
      return casOk(Number(body.p_revision) || 1);
    }
    if (url.includes("continuity_memberships?select=household_id")) return response([]);
    if (
      url.includes("continuity_memberships?on_conflict")
      || url.includes("continuity_personal_snapshots?on_conflict")
    ) {
      return response(null, 201);
    }
    if (url.includes("household_snapshots?")) return response([]);
    return response(null, 201);
  });
}


afterEach(() => {
  setContinuityStore(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google-account continuity", () => {
  it("discovers every exact Development membership and ignores malformed or unrelated rows", async () => {
    const first = googleHousehold();
    const second = { ...googleHousehold(), householdId: "HH-SECOND", name: "Second household" };
    const unrelated = googleHousehold("someone-else", "someone@example.com");
    const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes("continuity_memberships?")) {
        return response({ code: "PGRST205", message: "continuity_memberships is not in the schema cache" }, 404);
      }
      return response([
        { payload: JSON.stringify(first), updated_at: "2026-08-24T14:00:00.000Z" },
        { payload: "{", updated_at: "2026-08-24T13:00:00.000Z" },
        { payload: JSON.stringify(unrelated), updated_at: "2026-08-24T12:00:00.000Z" },
        { payload: JSON.stringify(second), updated_at: "2026-08-24T11:00:00.000Z" },
      ]);
    });
    vi.stubGlobal("fetch", fetch);

    const found = await discoverContinuityMemberships(identity, "development", config);
    expect(found.map((item) => item.household.householdId)).toEqual([first.householdId, "HH-SECOND"]);
    expect(found.every((item) => item.memberId === "MEM-001")).toBe(true);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("environment=eq.development");
  });

  it("does not let a matching email override a different populated Google subject", async () => {
    const wrongSubject = googleHousehold("different-google-subject", identity.email);
    const fetch = vi.fn(async (input: RequestInfo | URL) => String(input).includes("continuity_memberships?")
      ? response({ code: "PGRST205", message: "continuity_memberships is not in the schema cache" }, 404)
      : response([{ payload: JSON.stringify(wrongSubject) }]));
    vi.stubGlobal("fetch", fetch);
    await expect(discoverContinuityMemberships(identity, "development", config)).resolves.toEqual([]);
  });

  it("does not bulk-scan Production snapshots; membership miss returns empty", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("continuity_memberships?")) {
        return response({ code: "PGRST205", message: "continuity_memberships is not in the schema cache" }, 404);
      }
      return response([]);
    });
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("VITE_PRODUCTION_CONTINUITY", "1");
    await expect(discoverContinuityMemberships(identity, "production", config)).resolves.toEqual([]);
    expect(fetch.mock.calls.some(([input]) => String(input).includes("household_snapshots?"))).toBe(false);
  });

  it("keeps Production discovery off when the continuity flag is unset", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("VITE_PRODUCTION_CONTINUITY", "");
    await expect(discoverContinuityMemberships(identity, "production", config)).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("compacts offline writes into one durable snapshot while preserving the earliest cloud base", () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = googleHousehold();
    const first = enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 3,
      confirmationId: "confirm-first",
    });
    const posted = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Offline milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const second = enqueueContinuitySnapshot({
      household: { ...posted.household, revision: 5 },
      identity,
      expectedRevision: 4,
      confirmationId: "confirm-second",
    });

    expect(first.id).toBe(second.id);
    expect(listContinuityOutbox("development")).toHaveLength(1);
    expect(second.expectedRevision).toBe(3);
    expect(second.confirmationIds).toEqual(["confirm-first", "confirm-second"]);
    expect(second.snapshot?.transactions.some((row) => row.note === "Offline milk")).toBe(true);
    expect(JSON.stringify(second)).not.toMatch(/accessToken|Bearer /i);
  });

  it("stores only a slim tip pointer in durable localStorage (no journal)", () => {
    const store = createMemoryContinuityStore();
    setContinuityStore(store);
    const household = googleHousehold();
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 0,
      confirmationId: "slim-1",
    });
    const raw = store.getItem("hearth:continuity-outbox:v1:development");
    expect(raw).toBeTruthy();
    expect(raw!.length).toBeLessThan(4_000);
    expect(raw).not.toMatch(/"transactions"/);
    expect(raw).not.toMatch(/"shifts"/);
    const durable = JSON.parse(raw!) as Array<{ tipRevision: number; snapshot?: unknown }>;
    expect(durable[0]?.snapshot).toBeUndefined();
    expect(durable[0]?.tipRevision).toBe(household.revision);
    // Memory still holds the tip for same-session flush.
    expect(listContinuityOutbox("development")[0]?.snapshot?.householdId).toBe(household.householdId);
  });

  it("prefers the memory tip over an older Retry liveHousehold", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const tip = { ...googleHousehold(), revision: 5, baseRevision: 0 };
    enqueueContinuitySnapshot({
      household: tip,
      identity,
      expectedRevision: 4,
      confirmationId: "tip-guard",
    });
    const older = { ...tip, revision: 3 };
    const item = listContinuityOutbox("development")[0]!;
    const resolved = await resolveOutboxHousehold(item, older);
    expect(resolved.revision).toBe(5);
  });

  it("fails closed when only an older live tip is available after memory clear", async () => {
    const store = createMemoryContinuityStore();
    setContinuityStore(store);
    const tip = { ...googleHousehold(), revision: 5, baseRevision: 0 };
    enqueueContinuitySnapshot({
      household: tip,
      identity,
      expectedRevision: 4,
      confirmationId: "tip-stale",
    });
    const raw = store.getItem("hearth:continuity-outbox:v1:development");
    setContinuityStore(store);
    store.setItem("hearth:continuity-outbox:v1:development", raw!);
    const older = { ...tip, revision: 3 };
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity,
      config,
      force: true,
      liveHousehold: older,
    });
    expect(flushed.synchronized).toBe(0);
    expect(flushed.pending).toBe(1);
    expect(listContinuityOutbox("development")[0]?.lastError).toMatch(/behind the share queue tip/i);
  });

  it("flushes a slim durable tip by resolving the live household", async () => {
    const store = createMemoryContinuityStore();
    setContinuityStore(store);
    const household = { ...googleHousehold(), revision: 4, baseRevision: 0 };
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 0,
      confirmationId: "slim-flush",
    });
    // Simulate reload: durable tip remains, memory tip is gone.
    const raw = store.getItem("hearth:continuity-outbox:v1:development");
    setContinuityStore(store);
    store.setItem("hearth:continuity-outbox:v1:development", raw!);
    expect(listContinuityOutbox("development")[0]?.snapshot).toBeUndefined();

    vi.stubGlobal("fetch", continuityCasFetch());

    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity,
      config,
      force: true,
      liveHousehold: household,
    });
    expect(flushed.synchronized).toBe(1);
    expect(listContinuityOutbox("development")).toHaveLength(0);
  });

  it("keeps an offline write queued, then replays it exactly once after reconnection", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const pending = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-offline",
      config,
    });
    expect(pending.ok).toBe(false);
    expect(listContinuityOutbox("development")).toHaveLength(1);

    const methods: string[] = [];
    const fetch = continuityCasFetch();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      return fetch(input, init);
    }));
    const replayed = await flushContinuityOutbox({ environment: "development", identity, config, force: true });
    expect(replayed).toEqual({ synchronized: 1, pending: 0, deferred: 0, conflicts: [] });
    expect(listContinuityOutbox("development")).toEqual([]);
    expect(methods.filter((method) => method === "POST").length).toBeGreaterThanOrEqual(1);

    const again = await flushContinuityOutbox({ environment: "development", identity, config, force: true });
    expect(again).toEqual({ synchronized: 0, pending: 0, deferred: 0, conflicts: [] });
    expect(methods.filter((method) => method === "POST").length).toBeGreaterThanOrEqual(1);
  });

  it("retains a failed in-flight marker until its cloud outcome is reconciled", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    const refused = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-online-required",
      config,
    });

    expect(refused).toMatchObject({ ok: false, errorClass: "pending-transport" });
    expect(listContinuityOutbox("development")).toHaveLength(1);
  });

  it("settles a lost hosted response from the same confirmation receipt", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    setContinuityStore(createMemoryContinuityStore());
    const base = googleHousehold();
    const household = {
      ...base,
      revision: 2,
      baseRevision: 1,
      commandReceipts: [{
        confirmationId: "confirm-lost-response",
        identityHash: "identity-lost-response",
        auditHash: "accepted",
        commandKind: "commit",
        postedIds: [],
        revision: 2,
        acceptedAt: "2026-09-03T12:00:00.000Z",
      }],
    };
    let postAttempted = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/")) {
        postAttempted = true;
        throw new Error("response lost after commit");
      }
      if (url.includes("household_snapshots?") && url.includes("select=payload")) {
        return response([{ payload: JSON.stringify(household) }]);
      }
      return response([]);
    }));

    const reconciled = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-lost-response",
      config,
      reconcileAmbiguous: true,
    });

    expect(postAttempted).toBe(true);
    expect(reconciled).toMatchObject({ ok: true, remoteRevision: 2 });
    expect(listContinuityOutbox("development")).toEqual([]);
  });

  it("does not acknowledge a reused confirmation id with different command facts", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    setContinuityStore(createMemoryContinuityStore());
    const base = googleHousehold();
    const household = {
      ...base,
      revision: 2,
      baseRevision: 1,
      commandReceipts: [{
        confirmationId: "confirm-reused",
        identityHash: "expected-identity",
        auditHash: "expected-audit",
        commandKind: "commit",
        postedIds: [],
        revision: 2,
        acceptedAt: "2026-09-03T12:00:00.000Z",
      }],
    };
    const differentRemote = {
      ...household,
      commandReceipts: [{ ...household.commandReceipts[0]!, identityHash: "different-identity" }],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/")) throw new Error("response lost");
      if (url.includes("household_snapshots?") && url.includes("select=payload")) {
        return response([{ payload: JSON.stringify(differentRemote) }]);
      }
      return response([]);
    }));

    const result = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-reused",
      config,
      reconcileAmbiguous: true,
    });

    expect(result).toMatchObject({ ok: false, errorClass: "pending-transport" });
    expect(listContinuityOutbox("development")).toHaveLength(1);
  });

  it("pairs a newer ambiguous Shared acknowledgement with canonical same-member Personal", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    setContinuityStore(createMemoryContinuityStore());
    const base = googleHousehold();
    const candidate = {
      ...base,
      revision: 2,
      baseRevision: 1,
      commandReceipts: [{
        confirmationId: "confirm-newer-personal",
        identityHash: "identity-newer-personal",
        auditHash: "accepted",
        commandKind: "commit",
        postedIds: [],
        revision: 2,
        acceptedAt: "2026-09-03T12:00:00.000Z",
      }],
    };
    const latest = postEntry(candidate, {
      date: "2026-09-03",
      type: "expense",
      amount: "6.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Personal from device B",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const remote = {
      ...latest,
      revision: 3,
      baseRevision: 3,
      transactions: latest.transactions.filter((row) => row.visibility !== "personal"),
    };
    const remotePersonal = personalReplicaForMember(latest, "MEM-001");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/")) throw new Error("response lost after commit");
      if (url.includes("household_snapshots?")) {
        return response([{ payload: JSON.stringify(remote) }]);
      }
      if (url.includes("continuity_personal_snapshots?")) {
        return response([{ revision: 3, payload: JSON.stringify(remotePersonal) }]);
      }
      return response([]);
    }));

    const result = await transportHouseholdWithOutbox({
      household: candidate,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-newer-personal",
      config,
      reconcileAmbiguous: true,
    });

    if (!result.ok) throw new Error(result.message);
    expect(result).toMatchObject({ ok: true, remoteRevision: 3 });
    expect(result.remotePersonal?.transactions.some((row) => row.note === "Personal from device B")).toBe(true);
    expect(listContinuityOutbox("development")).toEqual([]);
  });

  it("replays a never-sent staged candidate after durable outbox reload", async () => {
    const stageRoot = await mkdtemp(join(tmpdir(), "hearth-stage-reload-"));
    setStagedBooksDataDirForTests((environment, householdId) => join(stageRoot, `${environment}-${householdId}`));
    const durable = createMemoryContinuityStore();
    try {
      setContinuityStore(durable);
      const base = googleHousehold();
      const posted = postEntry(base, {
        date: "2026-09-03",
        type: "expense",
        amount: "4.00",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "Staged retry milk",
        createdBy: "MEM-001",
        confirmDuplicate: true,
      });
      const candidate = { ...posted.household, revision: 2, baseRevision: 1 };
      candidate.booksAcceptedHash = await financialAuditHash(candidate);
      await validateHouseholdBooksStaged(candidate, { auditHash: candidate.booksAcceptedHash });
      enqueueContinuitySnapshot({
        household: candidate,
        identity,
        expectedRevision: 1,
        confirmationId: "confirm-never-sent",
      });
      await closeStagedBooksHandlesForTests();
      setContinuityStore(durable);
      expect((await loadStagedHouseholdBooks(candidate.environment, candidate.householdId))?.revision).toBe(candidate.revision);
      await closeStagedBooksHandlesForTests();
      vi.stubGlobal("fetch", continuityCasFetch());

      const replayed = await flushContinuityOutbox({ environment: "development", identity, config, force: true });

      expect(replayed).toEqual({ synchronized: 1, pending: 0, deferred: 0, conflicts: [] });
      expect(listContinuityOutbox("development")).toEqual([]);
    } finally {
      await closeStagedBooksHandlesForTests();
      setStagedBooksDataDirForTests(null);
      await rm(stageRoot, { recursive: true, force: true });
    }
  });

  it("durably cancels a definitive online-required conflict instead of publishing it later", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    const remote = {
      ...googleHousehold(),
      householdId: household.householdId,
      inviteCode: household.inviteCode,
      revision: 3,
      baseRevision: 3,
    };
    const personal = personalReplicaForMember(remote, "MEM-001");
    const conflictFetch = continuityCasFetch({ remote });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("household_snapshots?")) return response([{ payload: JSON.stringify(remote) }]);
      if (url.includes("continuity_personal_snapshots?")) {
        return response([{ revision: 3, payload: JSON.stringify(personal) }]);
      }
      return conflictFetch(input, init);
    }));

    const conflict = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-definitive-conflict",
      config,
      reconcileAmbiguous: true,
    });

    expect(conflict).toMatchObject({
      ok: false,
      errorClass: "conflict-detected",
      remote: {
        householdId: remote.householdId,
        revision: remote.revision,
      },
      remotePersonal: {
        memberId: personal.memberId,
      },
    });
    expect(listContinuityOutbox("development")).toHaveLength(1);
    if (conflict.ok || !conflict.finalizeConflict) throw new Error("Expected a deferred exact conflict finalizer.");
    await expect(conflict.finalizeConflict()).resolves.toBe(true);
    expect(listContinuityOutbox("development")).toEqual([]);
    expect(await flushContinuityOutbox({ environment: "development", identity, config, force: true }))
      .toEqual({ synchronized: 0, pending: 0, deferred: 0, conflicts: [] });
  });

  it("retains a definitive conflict when the complete cloud pair is unavailable", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    const remote = { ...googleHousehold(), revision: 3, baseRevision: 3 };
    vi.stubGlobal("fetch", continuityCasFetch({ remote }));

    const conflict = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-conflict-no-personal",
      config,
      reconcileAmbiguous: true,
    });

    expect(conflict).toMatchObject({ ok: false, errorClass: "pending-transport" });
    expect(listContinuityOutbox("development")).toHaveLength(1);
    expect(listContinuityOutbox("development")[0]?.blockedByConflict).toBe(true);
  });

  it("cancels only an exact conflicted outbox and staged-books generation", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const candidate = {
      ...googleHousehold(),
      revision: 2,
      baseRevision: 1,
      commandReceipts: [{
        confirmationId: "confirm-cancel-exact",
        identityHash: "identity-hash",
        auditHash: "audit-hash",
        commandKind: "commit",
        postedIds: [],
        revision: 2,
        acceptedAt: "2026-09-03T12:00:00.000Z",
      }],
    };
    const item = enqueueContinuitySnapshot({
      household: candidate,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-cancel-exact",
    });

    expect(stagedHouseholdMatchesContinuityGeneration(candidate, item)).toBe(true);
    expect(stagedHouseholdMatchesContinuityGeneration({ ...candidate, revision: 3 }, item)).toBe(false);
    await expect(cancelContinuityConflictGeneration(item)).resolves.toBe(true);
    expect(listContinuityOutbox("development")).toEqual([]);
  });

  it("does not let an older conflict cancel a replacement queue generation", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const first = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    const oldItem = enqueueContinuitySnapshot({
      household: first,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-old-conflict",
    });
    const replacement = { ...first, revision: 3 };
    const newItem = enqueueContinuitySnapshot({
      household: replacement,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-new-generation",
    });

    await expect(cancelContinuityConflictGeneration(oldItem)).resolves.toBe(false);
    expect(listContinuityOutbox("development")).toEqual([newItem]);
  });

  it("durably enqueues a local Confirm without waiting for cloud transport", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetcher);

    const pending = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-local-first",
      config,
      flush: false,
    });

    expect(pending).toMatchObject({ ok: false, errorClass: "pending-transport" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(listContinuityOutbox("development")).toHaveLength(1);
    expect(listContinuityOutbox("development")[0]?.confirmationIds).toContain("confirm-local-first");
  });

  it("does not let an older in-flight acknowledgement erase a newer confirmation", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const first = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    await transportHouseholdWithOutbox({
      household: first,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-a",
      config,
      flush: false,
    });

    let releaseFirst!: () => void;
    const baseFetch = continuityCasFetch();
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("rpc/publish_household_snapshot")) {
        return new Promise<Response>((resolve) => {
          releaseFirst = () => resolve(casOk(2));
        });
      }
      return baseFetch(input, init);
    });
    vi.stubGlobal("fetch", fetcher);
    const flushingFirst = flushContinuityOutbox({ environment: "development", identity, config, force: true });
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf("function"));

    const second = { ...first, revision: 3, baseRevision: 1, name: "Newer local tip" };
    await transportHouseholdWithOutbox({
      household: second,
      identity,
      expectedRevision: 2,
      confirmationId: "confirm-b",
      config,
      flush: false,
    });
    releaseFirst();
    await flushingFirst;

    const queued = listContinuityOutbox("development");
    expect(queued).toHaveLength(1);
    expect(queued[0]?.tipRevision).toBe(3);
    expect(queued[0]?.confirmationIds).toContain("confirm-b");

    vi.stubGlobal("fetch", continuityCasFetch());
    const replayed = await flushContinuityOutbox({ environment: "development", identity, config, force: true });
    expect(replayed.synchronized).toBe(1);
    expect(listContinuityOutbox("development")).toHaveLength(0);
  });

  it("makes no transport request without a refreshed matching Auth identity", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-auth-guard",
      config,
      flush: false,
    });
    const fetcher = continuityCasFetch();
    vi.stubGlobal("fetch", fetcher);

    const missing = await flushContinuityOutbox({
      environment: "development",
      identity,
      config,
      requireAuthenticatedSession: true,
      authenticatedIdentity: null,
      force: true,
    });
    expect(missing).toMatchObject({ synchronized: 0, pending: 1 });
    expect(fetcher).not.toHaveBeenCalled();

    const secureConfig = { ...config, accessToken: "user-jwt", authUserId: "auth-user-1" };
    const mismatch = await flushContinuityOutbox({
      environment: "development",
      identity,
      config: secureConfig,
      requireAuthenticatedSession: true,
      authenticatedIdentity: { subject: "different-subject", email: identity.email },
      force: true,
    });
    expect(mismatch).toMatchObject({ synchronized: 0, pending: 1 });
    expect(fetcher).not.toHaveBeenCalled();

    const matched = await flushContinuityOutbox({
      environment: "development",
      identity,
      config: secureConfig,
      requireAuthenticatedSession: true,
      authenticatedIdentity: identity,
      force: true,
    });
    expect(matched.synchronized).toBe(1);
    expect(fetcher).toHaveBeenCalled();
  });

  it("blocks automatic replay on a stale revision and keeps both sides available", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 4, baseRevision: 3 };
    const remote = {
      ...googleHousehold(),
      revision: 5,
      baseRevision: 5,
      householdId: household.householdId,
      inviteCode: household.inviteCode,
    };
    const fetch = continuityCasFetch({ remote });
    vi.stubGlobal("fetch", fetch);

    const result = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 3,
      confirmationId: "confirm-stale",
      config,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a conflict.");
    expect(result.errorClass).toBe("conflict-detected");
    expect(result.remote?.revision).toBe(5);
    expect(listContinuityOutbox("development")[0]?.blockedByConflict).toBe(true);
    const snapshotPosts = fetch.mock.calls.filter(([input, init]) => (
      init?.method === "POST" && String(input).includes("household_snapshots?on_conflict")
    ));
    expect(snapshotPosts).toHaveLength(0);
  });

  it("uses server-side membership discovery and overlays the member's hosted personal replica", async () => {
    const shared = googleHousehold();
    const posted = postEntry(shared, {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Personal cloud milk",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const personal = personalReplicaForMember(posted, "MEM-001");
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("continuity_memberships?")) {
        return response([{
          household_id: posted.householdId,
          member_id: "MEM-001",
          google_subject: identity.subject,
          google_email: identity.email,
        }]);
      }
      if (url.includes("continuity_personal_snapshots?")) {
        return response([{ payload: JSON.stringify(personal) }]);
      }
      if (url.includes("household_snapshots?")) return response([{ payload: JSON.stringify(shared) }]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    const found = await discoverContinuityMemberships(identity, "development", config);
    expect(found).toHaveLength(1);
    expect(found[0]?.memberId).toBe("MEM-001");
    expect(found[0]?.household.transactions.some((item) => item.note === "Personal cloud milk")).toBe(true);
    expect(fetch.mock.calls.some(([input]) => String(input).includes("select=payload,updated_at"))).toBe(false);
  });

  it("publishes membership and only the signed-in member's personal scope before the household snapshot", async () => {
    let household = googleHousehold();
    household = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Jonathan private",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-08-25",
      type: "expense",
      amount: "5.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Partner private",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const calls: Array<{ url: string; body: unknown }> = [];
    household = { ...household, revision: 1, baseRevision: 1, linked: true };
    vi.stubGlobal("fetch", continuityCasFetch({ track: calls }));

    const pushed = await pushSupabaseHousehold(household, config, {
      expectedRevision: 1,
      continuityIdentity: identity,
    });
    expect(pushed.schema).toBe(true);
    expect(pushed.skipped).toBe(false);
    expect(pushed.usedCasRpc).toBe(true);
    const membership = calls.find((item) => item.url.includes("continuity_memberships?on_conflict"));
    const personalCall = calls.find((item) => item.url.includes("continuity_personal_snapshots?on_conflict"));
    const casIndex = calls.findIndex((item) => item.url.includes("rpc/publish_household_snapshot"));
    const personalIndex = calls.findIndex((item) => item.url.includes("continuity_personal_snapshots?on_conflict"));
    expect(membership?.body).toMatchObject({ member_id: "MEM-001", google_subject: identity.subject });
    const payload = await decodeJsonPayload(String((personalCall?.body as { payload?: string })?.payload)) as { transactions: Array<{ note: string }> };
    expect(payload.transactions.map((item) => item.note)).toContain("Jonathan private");
    expect(payload.transactions.map((item) => item.note)).not.toContain("Partner private");
    expect(personalIndex).toBeGreaterThan(-1);
    expect(casIndex).toBeGreaterThan(personalIndex);
  });

  it("publishes posted work shifts into the signed-in member's personal cloud envelope", async () => {
    let household = googleHousehold();
    const job = shapeWorkJob({
      id: "",
      memberId: "MEM-001",
      name: "Harbour Dining Room",
      color: "#a85a3d",
      active: true,
      timezone: "America/Toronto",
      locationName: "Toronto",
      gpsEnabled: false,
      roles: [{
        id: "ROLE-SERVER",
        name: "Server",
        tipped: true,
        active: true,
        rates: [{
          id: "RATE-1",
          effectiveDate: "2026-01-01",
          grossHourlyRateCents: 1800,
          takeHomeMode: "direct",
          takeHomeHourlyRateCents: 1500,
          deductions: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }],
      paidBreakRate: "role",
      paidBreakHourlyRateCents: 0,
      overtimeEnabled: true,
      overtimeWeeklyThresholdHours: 44,
      overtimeMultiplier: 1.5,
      tipOutRules: [],
      salesFields: [{ id: "FOOD", label: "Food", requirement: "required", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
      paySchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
      tipSchedule: { cadence: "weekly", anchorDate: "2026-01-05", weekday: 1, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
      tipWeekStartsOn: 1,
      defaults: {
        wagesVisibility: "personal",
        cashTipsVisibility: "personal",
        cardTipsVisibility: "personal",
        tipOutVisibility: "personal",
        wagesDepositAccountId: "ACC-CHEQUING",
        cashTipsAccountId: "ACC-CASH",
        cardTipsDepositAccountId: "ACC-CHEQUING",
      },
      wagesReceivableAccountId: "ACC-CLAIMS",
      cardTipsReceivableAccountId: "ACC-CLAIMS",
      note: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies WorkJob);
    household = upsertWorkJob(household, { job }).household;
    const savedJob = household.workJobs[0]!;
    household = postWorkShift(household, {
      date: "2026-08-25",
      memberId: "MEM-001",
      jobId: savedJob.id,
      roleId: "ROLE-SERVER",
      workedHours: 5,
      paidBreakHours: 0,
      salesByField: { FOOD: 1200 },
      cashTips: 40,
      cardTips: 80,
      cashTipsAccountId: "ACC-CASH",
      confirmDuplicate: true,
      createdBy: "MEM-001",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    }).household;
    const personal = personalReplicaForMember(household, "MEM-001");
    expect(personal.shifts).toHaveLength(1);
    const shared = householdCloudProjection(household, "MEM-001");
    expect(shared.shifts).toHaveLength(0);

    const calls: Array<{ url: string; body: unknown }> = [];
    household = { ...household, revision: 1, baseRevision: 0, linked: true };
    vi.stubGlobal("fetch", continuityCasFetch({ track: calls }));

    const pushed = await pushSupabaseHousehold(household, config, {
      expectedRevision: 0,
      continuityIdentity: identity,
    });
    expect(pushed.schema).toBe(true);
    expect(pushed.skipped).toBe(false);
    const personalCall = calls.find((item) => item.url.includes("continuity_personal_snapshots?on_conflict"));
    const payload = await decodeJsonPayload(String((personalCall?.body as { payload?: string })?.payload)) as { shifts: Array<{ id: string }> };
    expect(payload.shifts).toHaveLength(1);
  });
});

describe("Sign out continuity wipe", () => {
  it("drops only the cleared household from the outbox", () => {
    setContinuityStore(createMemoryContinuityStore());
    const keep = googleHousehold();
    const drop = { ...googleHousehold(), householdId: "HH-DROP", name: "Drop me" };
    enqueueContinuitySnapshot({
      identity,
      household: keep,
      expectedRevision: 0,
      confirmationId: "keep-1",
    });
    enqueueContinuitySnapshot({
      identity,
      household: drop,
      expectedRevision: 0,
      confirmationId: "drop-1",
    });
    expect(listContinuityOutbox("development")).toHaveLength(2);
    expect(clearContinuityOutboxForHousehold("development", "HH-DROP")).toBe(1);
    const left = listContinuityOutbox("development");
    expect(left).toHaveLength(1);
    expect(left[0]?.householdId).toBe(keep.householdId);
  });

  it("removes a marker created by a Confirm that was already running when clear began", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const enqueue = createWriteQueue();
    const household = { ...googleHousehold(), householdId: "HH-CLEAR-RACE" };
    let releaseConfirm!: () => void;
    const confirmPaused = new Promise<void>((resolve) => {
      releaseConfirm = resolve;
    });

    const confirm = enqueue(async () => {
      await confirmPaused;
      enqueueContinuitySnapshot({
        identity,
        household,
        expectedRevision: 0,
        confirmationId: "clear-race-confirm",
      });
      await awaitContinuityOutboxDurable("development");
    });
    const clear = enqueue(async () => {
      clearContinuityOutboxForHousehold("development", household.householdId);
      await awaitContinuityOutboxDurable("development");
    });

    releaseConfirm();
    await Promise.all([confirm, clear]);
    expect(listContinuityOutbox("development")).toEqual([]);
  });
});

describe("continuity outbox quota resilience", () => {
  it("humanizes browser Storage quota errors for the share banner", () => {
    const raw = "Failed to execute 'setItem' on 'Storage': Setting the value of 'hearth:continuity-outbox:v1:development' exceeded the quota.";
    expect(isStorageQuotaError(new DOMException(raw, "QuotaExceededError"))).toBe(true);
    expect(humanizeContinuityError(raw)).toMatch(/browser storage is full/i);
    expect(humanizeContinuityError(raw)).not.toMatch(/setItem/i);
  });

  it("keeps the outbox in memory when localStorage quota is exceeded so Retry can flush", async () => {
    const store = createMemoryContinuityStore();
    const originalSet = store.setItem.bind(store);
    store.setItem = (itemKey, value) => {
      if (itemKey.includes("continuity-outbox")) {
        throw new DOMException(
          "Failed to execute 'setItem' on 'Storage': Setting the value of 'hearth:continuity-outbox:v1:development' exceeded the quota.",
          "QuotaExceededError",
        );
      }
      return originalSet(itemKey, value);
    };
    setContinuityStore(store);
    const household = googleHousehold();
    const item = enqueueContinuitySnapshot({
      identity,
      household,
      expectedRevision: 0,
      confirmationId: "quota-1",
    });
    expect(item.householdId).toBe(household.householdId);
    expect(listContinuityOutbox("development")).toHaveLength(1);
    expect(store.snapshot()[`hearth:continuity-outbox:v1:development`]).toBeUndefined();

    vi.stubGlobal("fetch", continuityCasFetch());

    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity,
      config,
      force: true,
    });
    expect(flushed.synchronized).toBe(1);
    expect(listContinuityOutbox("development")).toHaveLength(0);
  });

  it("awaits localStorage fallback when IndexedDB is unavailable", async () => {
    const store = createMemoryContinuityStore();
    setContinuityStore(null);
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("indexedDB", undefined);
    const household = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    const result = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "durable-ls-fallback",
      config,
      flush: false,
    });
    expect(result).toMatchObject({ ok: false, errorClass: "pending-transport" });
    expect(store.getItem("hearth:continuity-outbox:v1:development")).toContain("durable-ls-fallback");
  });

  it("refuses to report a durable enqueue when both browser stores fail", async () => {
    const store = createMemoryContinuityStore();
    store.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    setContinuityStore(null);
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("indexedDB", undefined);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const result = await transportHouseholdWithOutbox({
      household: { ...googleHousehold(), revision: 2, baseRevision: 1 },
      identity,
      expectedRevision: 1,
      confirmationId: "durable-none",
      config,
    });
    expect(result).toMatchObject({ ok: false, errorClass: "disconnected" });
    expect(result.ok ? "" : result.message).toMatch(/nothing was posted/i);
    expect(fetcher).not.toHaveBeenCalled();
    expect(listContinuityOutbox("development")).toEqual([]);
  });

  it("seeds a live household into the outbox when Retry finds an empty queue", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = googleHousehold();
    expect(listContinuityOutbox("development")).toHaveLength(0);
    vi.stubGlobal("fetch", continuityCasFetch());
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity,
      config,
      force: true,
      liveHousehold: household,
      expectedRevision: 0,
      confirmationId: "retry-empty",
    });
    expect(flushed.synchronized).toBe(1);
  });
});
