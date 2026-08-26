/**
 * T1-S4 push/pull race coordinator (D-149).
 *
 * Serializes outbox flush, Realtime signals, poll fallback, and focus/online replay.
 * Enforces revision monotonicity and dedupes concurrent pulls for the same snapshot.
 */

export type ContinuitySyncSource =
  | "realtime"
  | "poll"
  | "focus"
  | "online"
  | "visibility"
  | "manual";

export const PULL_DEDUPE_WINDOW_MS = 100;

export function pullDedupeKey(householdId: string, remoteRevision: number): string {
  return `${householdId}:${remoteRevision}`;
}

/** Ignore stale Realtime/poll signals when local books are already at or ahead. */
export function shouldIgnoreInboundSnapshot(input: {
  remoteRevision: number;
  localTipRevision: number;
  hasOpenConflict: boolean;
}): boolean {
  if (input.hasOpenConflict) return false;
  return input.remoteRevision <= input.localTipRevision;
}

export type ContinuityCoordinator = {
  /** Queue work so flush, pull, and Realtime never run concurrently. */
  run: <T>(source: ContinuitySyncSource, work: () => Promise<T>) => Promise<T>;
  /** True when the same household+revision pull was claimed inside the dedupe window. */
  shouldDedupePull: (householdId: string, remoteRevision: number, atMs?: number) => boolean;
  recordPull: (householdId: string, remoteRevision: number, atMs?: number) => void;
  /** Prevent duplicate PGlite accepts for the same hosted revision within the window. */
  shouldSkipAccept: (householdId: string, remoteRevision: number, atMs?: number) => boolean;
  recordAccept: (householdId: string, remoteRevision: number, atMs?: number) => void;
  activeCount: () => number;
  queuedCount: () => number;
};

export function createContinuityCoordinator(
  clock: () => number = () => Date.now(),
): ContinuityCoordinator {
  let tail: Promise<unknown> = Promise.resolve();
  let active = 0;
  let queued = 0;
  const recentPulls = new Map<string, number>();
  const recentAccepts = new Map<string, number>();

  function withinWindow(map: Map<string, number>, key: string, at: number): boolean {
    const seen = map.get(key);
    return seen !== undefined && at - seen < PULL_DEDUPE_WINDOW_MS;
  }

  return {
    run<T>(source: ContinuitySyncSource, work: () => Promise<T>): Promise<T> {
      void source;
      queued += 1;
      const ticket = tail.then(async () => {
        queued -= 1;
        active += 1;
        try {
          return await work();
        } finally {
          active -= 1;
        }
      });
      tail = ticket.then(() => undefined, () => undefined);
      return ticket as Promise<T>;
    },

    shouldDedupePull(householdId, remoteRevision, atMs = clock()) {
      return withinWindow(recentPulls, pullDedupeKey(householdId, remoteRevision), atMs);
    },

    recordPull(householdId, remoteRevision, atMs = clock()) {
      recentPulls.set(pullDedupeKey(householdId, remoteRevision), atMs);
    },

    shouldSkipAccept(householdId, remoteRevision, atMs = clock()) {
      return withinWindow(recentAccepts, pullDedupeKey(householdId, remoteRevision), atMs);
    },

    recordAccept(householdId, remoteRevision, atMs = clock()) {
      recentAccepts.set(pullDedupeKey(householdId, remoteRevision), atMs);
    },

    activeCount: () => active,
    queuedCount: () => queued,
  };
}
