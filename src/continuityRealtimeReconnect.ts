import type { ContinuityRealtimeStatus } from "./continuityRealtimePolicy.ts";

export type ContinuityHeartbeatStatus = "sent" | "ok" | "error" | "timeout" | "disconnected" | (string & {});

export type RealtimeReconnectReason =
  | "channel"
  | "heartbeat"
  | "focus"
  | "visibility"
  | "online";

type DeferredWork = { clear: () => void };

export const REALTIME_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;
export const REALTIME_SUBSCRIBE_ACK_TIMEOUT_MS = 5_000;

export type ContinuityRealtimeReconnectGate = {
  noteStatus: (status: ContinuityRealtimeStatus) => void;
  noteHeartbeat: (status: ContinuityHeartbeatStatus) => void;
  requestReconnect: (reason: RealtimeReconnectReason) => void;
  dispose: () => void;
};

function isTerminalStatus(status: ContinuityRealtimeStatus): boolean {
  return status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT";
}

export function shouldDeferResumeForRealtimeReconnect(input: {
  realtimeEnabled: boolean;
  status: ContinuityRealtimeStatus | null;
}): boolean {
  return input.realtimeEnabled && input.status !== "SUBSCRIBED";
}

function reconnectDelay(attempt: number): number {
  return REALTIME_RECONNECT_DELAYS_MS[Math.min(attempt, REALTIME_RECONNECT_DELAYS_MS.length - 1)]!;
}

/**
 * Owns one bounded reconnect timer for the active continuity subscription.
 * It never fetches or adopts money; the caller recreates the authenticated
 * subscription and keeps all catch-up inside the existing coordinator/PGlite lane.
 */
export function createContinuityRealtimeReconnectGate(input: {
  reconnect: (reason: RealtimeReconnectReason) => Promise<boolean | void>;
  onSubscribed?: (afterReconnect: boolean) => void;
  onReconnectScheduled?: (reason: RealtimeReconnectReason) => void;
  defer: (fn: () => void, waitMs: number) => DeferredWork;
}): ContinuityRealtimeReconnectGate {
  let disposed = false;
  let status: ContinuityRealtimeStatus | null = null;
  let attempt = 0;
  let reconnectAttempted = false;
  let recoveryNeeded = false;
  let reconnecting = false;
  let deferred: DeferredWork | null = null;

  const clearDeferred = () => {
    deferred?.clear();
    deferred = null;
  };

  const schedule = (reason: RealtimeReconnectReason, immediate = false) => {
    if (disposed || status === "SUBSCRIBED" || reconnecting) return;
    if (deferred) {
      if (!immediate) return;
      clearDeferred();
    }
    const waitMs = immediate ? 0 : reconnectDelay(attempt);
    input.onReconnectScheduled?.(reason);
    deferred = input.defer(() => {
      deferred = null;
      if (disposed || status === "SUBSCRIBED" || reconnecting) return;
      reconnecting = true;
      reconnectAttempted = true;
      attempt += 1;
      let failed = false;
      let eligible = true;
      void input.reconnect(reason).then((result) => {
        eligible = result !== false;
      }).catch(() => {
        failed = true;
      }).finally(() => {
        reconnecting = false;
        if (disposed || status === "SUBSCRIBED" || !eligible) return;
        if (failed) {
          schedule(reason);
          return;
        }
        input.onReconnectScheduled?.(reason);
        deferred = input.defer(() => {
          deferred = null;
          if (!disposed && status !== "SUBSCRIBED") schedule(reason);
        }, REALTIME_SUBSCRIBE_ACK_TIMEOUT_MS);
      });
    }, waitMs);
  };

  return {
    noteStatus(next) {
      if (disposed) return;
      status = next;
      if (next === "SUBSCRIBED") {
        const afterReconnect = reconnectAttempted || recoveryNeeded;
        clearDeferred();
        attempt = 0;
        reconnectAttempted = false;
        recoveryNeeded = false;
        input.onSubscribed?.(afterReconnect);
        return;
      }
      if (isTerminalStatus(next)) {
        recoveryNeeded = true;
        schedule("channel");
      }
    },

    noteHeartbeat(next) {
      if (disposed) return;
      if (next === "error" || next === "timeout" || next === "disconnected") {
        status = "CHANNEL_ERROR";
        recoveryNeeded = true;
        schedule("heartbeat");
      }
    },

    requestReconnect(reason) {
      if (disposed || status === "SUBSCRIBED") return;
      recoveryNeeded = true;
      schedule(reason, true);
    },

    dispose() {
      disposed = true;
      clearDeferred();
    },
  };
}
