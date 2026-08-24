/**
 * Hosted snapshot compare-and-swap contract (D-122).
 * Mirrors `supabase/migrations/002_snapshot_cas.sql` so tests can exercise
 * atomic publish semantics without applying SQL or contacting the project.
 */

export type SnapshotCasRequest = {
  householdId: string;
  expectedRevision: number;
  revision: number;
  environment: string;
  name: string;
  timezone: string;
  currency: string;
  invitePhrase: string;
  linked: boolean;
  lastCommittedAt: string;
  payload: string;
  snapshotHash: string;
};

export type SnapshotCasHouseholdRow = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  environment: string;
  invitePhrase: string;
  linked: boolean;
  revision: number;
  lastCommittedAt: string;
};

export type SnapshotCasSnapshotRow = {
  householdId: string;
  invitePhrase: string;
  environment: string;
  payload: string;
  updatedAt: string;
  revision: number;
  snapshotHash: string;
};

export type SnapshotCasOk = {
  ok: true;
  conflict: false;
  revision: number;
  duplicate?: boolean;
};

export type SnapshotCasConflict = {
  ok: false;
  conflict: true;
  remoteRevision: number | null;
  remotePayload: string | null;
  reason: "stale-revision" | "environment-mismatch" | "revision-hash-mismatch" | "missing-base";
};

export type SnapshotCasResult = SnapshotCasOk | SnapshotCasConflict;

export type SnapshotCasStore = {
  household: SnapshotCasHouseholdRow | null;
  snapshot: SnapshotCasSnapshotRow | null;
};

/**
 * Pure CAS step. Callers that hold a mutex / row lock around one household
 * get the same outcome as the hosted RPC under serializable execution.
 */
export function applyPublishHouseholdSnapshotCas(
  store: SnapshotCasStore,
  request: SnapshotCasRequest,
  nowIso: string,
): { store: SnapshotCasStore; result: SnapshotCasResult } {
  const current = store.household;

  if (current) {
    if (current.environment !== request.environment) {
      return {
        store,
        result: {
          ok: false,
          conflict: true,
          remoteRevision: current.revision,
          remotePayload: store.snapshot?.payload ?? null,
          reason: "environment-mismatch",
        },
      };
    }

    // Idempotent acknowledgement: same revision + matching hash already landed.
    if (current.revision === request.revision) {
      const remoteHash = store.snapshot?.snapshotHash ?? null;
      if (remoteHash === request.snapshotHash) {
        return {
          store,
          result: { ok: true, conflict: false, revision: request.revision, duplicate: true },
        };
      }
      return {
        store,
        result: {
          ok: false,
          conflict: true,
          remoteRevision: current.revision,
          remotePayload: store.snapshot?.payload ?? null,
          reason: "revision-hash-mismatch",
        },
      };
    }

    if (current.revision !== request.expectedRevision) {
      return {
        store,
        result: {
          ok: false,
          conflict: true,
          remoteRevision: current.revision,
          remotePayload: store.snapshot?.payload ?? null,
          reason: "stale-revision",
        },
      };
    }
  } else if (request.expectedRevision !== 0) {
    return {
      store,
      result: {
        ok: false,
        conflict: true,
        remoteRevision: null,
        remotePayload: null,
        reason: "missing-base",
      },
    };
  }

  if (request.revision < request.expectedRevision) {
    return {
      store,
      result: {
        ok: false,
        conflict: true,
        remoteRevision: current?.revision ?? null,
        remotePayload: store.snapshot?.payload ?? null,
        reason: "stale-revision",
      },
    };
  }

  const household: SnapshotCasHouseholdRow = {
    id: request.householdId,
    name: request.name,
    timezone: request.timezone,
    currency: request.currency,
    environment: request.environment,
    invitePhrase: request.invitePhrase,
    linked: request.linked,
    revision: request.revision,
    lastCommittedAt: request.lastCommittedAt,
  };
  const snapshot: SnapshotCasSnapshotRow = {
    householdId: request.householdId,
    invitePhrase: request.invitePhrase,
    environment: request.environment,
    payload: request.payload,
    updatedAt: nowIso,
    revision: request.revision,
    snapshotHash: request.snapshotHash,
  };
  return {
    store: { household, snapshot },
    result: { ok: true, conflict: false, revision: request.revision, duplicate: false },
  };
}

/** In-memory hosted ledger for deterministic multi-client tests. */
export function createMemoryHostedCas() {
  const rows = new Map<string, SnapshotCasStore>();
  const locks = new Map<string, Promise<void>>();

  async function withLock<T>(householdId: string, run: () => T | Promise<T>): Promise<T> {
    const previous = locks.get(householdId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    locks.set(
      householdId,
      previous.then(() => gate),
    );
    await previous;
    try {
      return await run();
    } finally {
      release();
      if (locks.get(householdId) === gate) locks.delete(householdId);
    }
  }

  return {
    async publish(request: SnapshotCasRequest, nowIso = new Date().toISOString()): Promise<SnapshotCasResult> {
      return withLock(request.householdId, () => {
        const current = rows.get(request.householdId) ?? { household: null, snapshot: null };
        const applied = applyPublishHouseholdSnapshotCas(current, request, nowIso);
        rows.set(request.householdId, applied.store);
        return applied.result;
      });
    },
    get(householdId: string): SnapshotCasStore {
      return rows.get(householdId) ?? { household: null, snapshot: null };
    },
    clear() {
      rows.clear();
    },
  };
}

export type MemoryHostedCas = ReturnType<typeof createMemoryHostedCas>;
