/**
 * In-memory Migration 012 continuity CAS for deterministic tests (D-149 G6).
 * Mirrors shared CAS from snapshotCas.ts and atomically upserts personal envelopes.
 */

import {
  applyPublishHouseholdSnapshotCas,
  type SnapshotCasConflict,
  type SnapshotCasOk,
  type SnapshotCasRequest,
  type SnapshotCasResult,
  type SnapshotCasStore,
} from "./snapshotCas.ts";

export type ContinuityPersonalRow = {
  environment: string;
  householdId: string;
  memberId: string;
  revision: number;
  payload: string;
  updatedAt: string;
};

export type ContinuityCasStore = {
  shared: SnapshotCasStore;
  personalByMember: Map<string, ContinuityPersonalRow>;
};

export type ContinuityCasRequest = SnapshotCasRequest & {
  memberId: string;
  personalPayload: string;
  confirmationId?: string;
  identityHash?: string;
};

export type ContinuityCasResult = SnapshotCasOk | SnapshotCasConflict;

function emptyStore(): ContinuityCasStore {
  return { shared: { household: null, snapshot: null }, personalByMember: new Map() };
}

function payloadIsMemberPersonal(payload: string, memberId: string): boolean {
  try {
    const parsed = JSON.parse(payload) as { kind?: string; memberId?: string };
    return parsed.kind === "personal" && parsed.memberId === memberId;
  } catch {
    return false;
  }
}

/**
 * Pure 012 publish step: shared CAS must succeed before personal upsert commits.
 */
export function applyPublishContinuitySnapshotCas(
  store: ContinuityCasStore,
  request: ContinuityCasRequest,
  nowIso: string,
): { store: ContinuityCasStore; result: ContinuityCasResult } {
  if (!payloadIsMemberPersonal(request.personalPayload, request.memberId)) {
    return {
      store,
      result: {
        ok: false,
        conflict: true,
        remoteRevision: store.shared.household?.revision ?? null,
        remotePayload: store.shared.snapshot?.payload ?? null,
        reason: "invalid-personal-payload",
      },
    };
  }

  const sharedApplied = applyPublishHouseholdSnapshotCas(store.shared, request, nowIso);
  if (!sharedApplied.result.ok) {
    return { store: { ...store, shared: sharedApplied.store }, result: sharedApplied.result };
  }

  const personalByMember = new Map(store.personalByMember);
  const currentPersonal = personalByMember.get(request.memberId) ?? null;
  const nextPersonal: ContinuityPersonalRow = {
    environment: request.environment,
    householdId: request.householdId,
    memberId: request.memberId,
    revision: request.revision,
    payload: request.personalPayload,
    updatedAt: nowIso,
  };

  if (sharedApplied.result.duplicate) {
    if (currentPersonal && currentPersonal.payload !== request.personalPayload) {
      return {
        store,
        result: {
          ok: false,
          conflict: true,
          remoteRevision: sharedApplied.store.household?.revision ?? null,
          remotePayload: sharedApplied.store.snapshot?.payload ?? null,
          reason: "personal-payload-mismatch",
        },
      };
    }
    if (!currentPersonal) personalByMember.set(request.memberId, nextPersonal);
    return {
      store: { shared: sharedApplied.store, personalByMember },
      result: sharedApplied.result,
    };
  }

  personalByMember.set(request.memberId, nextPersonal);
  return {
    store: { shared: sharedApplied.store, personalByMember },
    result: sharedApplied.result,
  };
}

/** In-memory hosted continuity ledger (Migration 012 semantics). */
export function createMemoryContinuityCas() {
  const rows = new Map<string, ContinuityCasStore>();
  const locks = new Map<string, Promise<void>>();

  async function withLock<T>(householdId: string, run: () => T | Promise<T>): Promise<T> {
    const previous = locks.get(householdId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    locks.set(householdId, previous.then(() => gate));
    await previous;
    try {
      return await run();
    } finally {
      release();
      if (locks.get(householdId) === gate) locks.delete(householdId);
    }
  }

  return {
    get(householdId: string): ContinuityCasStore {
      return rows.get(householdId) ?? emptyStore();
    },

    /** Shared snapshot view for harness pull paths. */
    shared: {
      get(householdId: string): SnapshotCasStore {
        return (rows.get(householdId) ?? emptyStore()).shared;
      },
    },

    getPersonal(environment: string, householdId: string, memberId: string): ContinuityPersonalRow | null {
      const store = rows.get(householdId);
      const row = store?.personalByMember.get(memberId) ?? null;
      if (!row || row.environment !== environment) return null;
      return row;
    },

    async createHousehold(request: SnapshotCasRequest, nowIso = new Date().toISOString()): Promise<SnapshotCasResult> {
      return withLock(request.householdId, () => {
        const current = rows.get(request.householdId) ?? emptyStore();
        const applied = applyPublishHouseholdSnapshotCas(
          current.shared,
          { ...request, expectedRevision: 0 },
          nowIso,
        );
        rows.set(request.householdId, { ...current, shared: applied.store });
        return applied.result;
      });
    },

    async publishContinuity(
      request: ContinuityCasRequest,
      nowIso = new Date().toISOString(),
    ): Promise<ContinuityCasResult> {
      return withLock(request.householdId, () => {
        const current = rows.get(request.householdId) ?? emptyStore();
        const applied = applyPublishContinuitySnapshotCas(current, request, nowIso);
        rows.set(request.householdId, applied.store);
        return applied.result;
      });
    },

    clear() {
      rows.clear();
    },
  };
}

export type MemoryContinuityCas = ReturnType<typeof createMemoryContinuityCas>;

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function casBody(result: SnapshotCasResult | ContinuityCasResult) {
  if (result.ok) {
    return {
      ok: true,
      conflict: false,
      duplicate: result.duplicate === true,
      revision: result.revision,
    };
  }
  return {
    ok: false,
    conflict: true,
    reason: result.reason,
    remote_revision: result.remoteRevision,
    remote_payload: result.remotePayload,
  };
}

function continuityCasRequestFromRpc(body: Record<string, unknown>): ContinuityCasRequest {
  return {
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
    memberId: String(body.p_member_id),
    personalPayload: String(body.p_personal_payload),
    confirmationId: typeof body.p_confirmation_id === "string" ? body.p_confirmation_id : "",
    identityHash: typeof body.p_identity_hash === "string" ? body.p_identity_hash : "",
  };
}

function createRequestFromRpc(body: Record<string, unknown>): SnapshotCasRequest {
  return {
    householdId: String(body.p_household_id),
    expectedRevision: 0,
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
  };
}

export type ContinuityCasFetchTracker = {
  calls: string[];
};

/**
 * Wire fetch to in-memory Migration 012 continuity CAS (not legacy 002 RPC).
 */
export function stubFetchAgainstContinuityCas(
  host: MemoryContinuityCas,
  tracker?: ContinuityCasFetchTracker,
) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    tracker?.calls.push(url);

    if (url.includes("households?select=id")) {
      return response([]);
    }

    if (url.includes("rpc/hearth_create_household")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const result = await host.createHousehold(createRequestFromRpc(body));
      return response(casBody(result));
    }

    if (url.includes("rpc/publish_continuity_snapshot")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const result = await host.publishContinuity(continuityCasRequestFromRpc(body));
      return response(casBody(result));
    }

    if (url.includes("rpc/publish_household_snapshot")) {
      throw new Error("Harness must use publish_continuity_snapshot (Migration 012), not legacy publish_household_snapshot");
    }

    if (url.includes("continuity_memberships?") || url.includes("continuity_personal_snapshots?")) {
      return response([], 200);
    }

    throw new Error(`Unexpected continuity harness request: ${url}`);
  };
}
