export type ContinuitySnapshotSignal = {
  table: "household_snapshots" | "continuity_personal_snapshots";
  revision: number | null;
};

export type RealtimeCommandOutcome = "covered" | "recover";

export type ContinuityRealtimeRecoveryGate = {
  noteSnapshot: (signal: ContinuitySnapshotSignal) => void;
  beginCommand: () => void;
  finishCommand: (outcome: RealtimeCommandOutcome) => void;
  dispose: () => void;
};

export type ContinuityRealtimeRecoveryScheduler = {
  request: (targetRevision: number | null, source?: "realtime" | "poll") => void;
  pendingRevision: () => number | null | undefined;
  running: () => boolean;
  dispose: () => void;
};

type DeferredWork = { clear: () => void };

export const REALTIME_COMMAND_GRACE_MS = 300;

export type RealtimeCommandApplyOutcome = "applied" | "duplicate" | "ignored" | "fallback";

/**
 * Keep at most one recovery ticket in the continuity mutex. Snapshot echoes,
 * command fallbacks, and reconnect checks can otherwise capture stale targets
 * and form a FIFO backlog while PGlite is accepting an earlier revision.
 *
 * A numbered request coalesces to the highest known cloud revision. A null
 * request means the exact tip is unknown and therefore dominates until one
 * recovery has checked the cloud authoritatively.
 */
export function createContinuityRealtimeRecoveryScheduler(input: {
  run: (
    source: "realtime" | "poll",
    work: () => Promise<void>,
  ) => Promise<unknown>;
  recover: (targetRevision: number | null, source: "realtime" | "poll") => Promise<void>;
  onError?: (error: unknown) => void;
}): ContinuityRealtimeRecoveryScheduler {
  let pendingRevision: number | null | undefined;
  let pendingSource: "realtime" | "poll" = "realtime";
  let running = false;
  let disposed = false;

  const mergeTarget = (targetRevision: number | null, source: "realtime" | "poll") => {
    if (targetRevision === null) {
      pendingRevision = null;
      pendingSource = source;
      return;
    }
    if (pendingRevision === null) return;
    if (pendingRevision === undefined || targetRevision > pendingRevision) {
      pendingRevision = targetRevision;
      pendingSource = source;
    }
  };

  const start = (source: "realtime" | "poll") => {
    if (disposed || running || pendingRevision === undefined) return;
    running = true;
    void input.run(source, async () => {
      while (!disposed && pendingRevision !== undefined) {
        const targetRevision = pendingRevision;
        const recoverySource = pendingSource;
        pendingRevision = undefined;
        try {
          await input.recover(targetRevision, recoverySource);
        } catch (error) {
          input.onError?.(error);
        }
      }
    }).catch((error) => {
      input.onError?.(error);
    }).finally(() => {
      running = false;
      if (!disposed && pendingRevision !== undefined) start(pendingSource);
    });
  };

  return {
    request(targetRevision, source = "realtime") {
      if (disposed) return;
      mergeTarget(targetRevision, source);
      start(source);
    },
    pendingRevision: () => pendingRevision,
    running: () => running,
    dispose() {
      disposed = true;
      pendingRevision = undefined;
    },
  };
}

export function shouldRecoverPollCommandsFirst(input: {
  realtimeEnabled: boolean;
  status: ContinuityRealtimeStatus | null;
}): boolean {
  if (!input.realtimeEnabled) return false;
  return input.status === null
    || input.status === "CLOSED"
    || input.status === "CHANNEL_ERROR"
    || input.status === "TIMED_OUT";
}

/**
 * A snapshot notification proves the atomic cloud transaction committed, so a
 * matching command row is readable even when its websocket notification is
 * delayed. Catch up from that small row before allowing a full snapshot replay
 * to occupy PGlite.
 */
export async function recoverRealtimeSnapshot<TEvent>(input: {
  targetRevision: number | null;
  getLocalState: () => { revision: number; hasOpenConflict: boolean } | null;
  fetchCommandEvents: (afterRevision: number) => Promise<TEvent[]>;
  applyCommandEvent: (event: TEvent) => Promise<RealtimeCommandApplyOutcome>;
  recoverSnapshot: () => Promise<void>;
}): Promise<"command-log" | "snapshot"> {
  const starting = input.getLocalState();
  if (starting && !starting.hasOpenConflict) {
    if (input.targetRevision !== null && starting.revision >= input.targetRevision) return "command-log";
    try {
      const events = await input.fetchCommandEvents(starting.revision);
      for (const event of events) {
        const outcome = await input.applyCommandEvent(event);
        const current = input.getLocalState();
        if (
          input.targetRevision !== null
          && current
          && !current.hasOpenConflict
          && current.revision >= input.targetRevision
        ) {
          return "command-log";
        }
        if (outcome !== "applied" && outcome !== "duplicate") break;
      }
      const current = input.getLocalState();
      if (
        input.targetRevision !== null
        && current
        && !current.hasOpenConflict
        && current.revision >= input.targetRevision
      ) {
        return "command-log";
      }
    } catch {
      // The ordinary snapshot path remains the fail-safe for unavailable or
      // malformed command-log catch-up.
    }
  }
  await input.recoverSnapshot();
  return "snapshot";
}

/**
 * Command rows and their snapshot rows are committed together, but Realtime may
 * deliver the snapshot notification first. Give the smaller command row one
 * brief chance to arrive before starting a full pull, then retain the snapshot
 * as recovery whenever the command is missing, hidden, invalid, or has a gap.
 */
export function createContinuityRealtimeRecoveryGate(input: {
  getLocalState: () => { revision: number; hasOpenConflict: boolean } | null;
  scheduleRecovery: (targetRevision: number | null) => void;
  defer: (fn: () => void, waitMs: number) => DeferredWork;
  graceMs?: number;
}): ContinuityRealtimeRecoveryGate {
  let activeCommands = 0;
  let pendingRevision: number | null | undefined;
  let deferred: DeferredWork | null = null;
  let disposed = false;
  const graceMs = input.graceMs ?? REALTIME_COMMAND_GRACE_MS;

  const clearDeferred = () => {
    deferred?.clear();
    deferred = null;
  };

  const signalIsCovered = () => {
    if (pendingRevision === undefined || pendingRevision === null) return false;
    const local = input.getLocalState();
    return Boolean(local && !local.hasOpenConflict && local.revision >= pendingRevision);
  };

  const schedule = (waitMs: number) => {
    if (disposed || activeCommands > 0 || deferred) return;
    deferred = input.defer(() => {
      deferred = null;
      if (disposed || activeCommands > 0) return;
      if (signalIsCovered()) {
        pendingRevision = undefined;
        return;
      }
      const targetRevision = pendingRevision ?? null;
      pendingRevision = undefined;
      input.scheduleRecovery(targetRevision);
    }, waitMs);
  };

  return {
    noteSnapshot(signal) {
      if (disposed) return;
      if (signal.revision === null || pendingRevision === null) {
        pendingRevision = null;
      } else {
        pendingRevision = Math.max(pendingRevision ?? -1, signal.revision);
      }
      schedule(graceMs);
    },

    beginCommand() {
      if (disposed) return;
      activeCommands += 1;
      clearDeferred();
    },

    finishCommand(outcome) {
      if (disposed) return;
      activeCommands = Math.max(0, activeCommands - 1);
      if (outcome === "recover") pendingRevision = null;
      if (activeCommands > 0) return;
      if (outcome === "covered" && signalIsCovered()) {
        pendingRevision = undefined;
        return;
      }
      if (pendingRevision !== undefined) schedule(outcome === "recover" ? 0 : graceMs);
    },

    dispose() {
      disposed = true;
      clearDeferred();
      pendingRevision = undefined;
      activeCommands = 0;
    },
  };
}
import type { ContinuityRealtimeStatus } from "./continuityRealtimePolicy.ts";
