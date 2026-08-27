/**
 * T3-S3 background sync polish — focus/visibility resume coalesce,
 * reconnect poll backoff when Realtime is unhealthy, no heartbeat spam.
 *
 * Outbox item backoff stays in continuity.ts (`continuityBackoffMs`).
 * This module only gates App-level resume + poll scheduling.
 */

import { continuityBackoffMs } from "./continuity.ts";
import type { ContinuitySyncSource } from "./continuityCoordinator.ts";
import type { ContinuityRealtimeStatus } from "./continuityRealtime.ts";

/** Collapse focus + visibility into one resume within this window. */
export const RESUME_COALESCE_MS = 400;

/** Skip another focus/visibility resume this soon after the last one ran. */
export const RESUME_MIN_GAP_MS = 1_500;

const IMMEDIATE_SOURCES = new Set<ContinuitySyncSource>(["online", "manual", "realtime"]);

const RESUME_SOURCES = new Set<ContinuitySyncSource>(["focus", "visibility"]);

export function isImmediateResumeSource(source: ContinuitySyncSource): boolean {
  return IMMEDIATE_SOURCES.has(source);
}

export function isCoalescedResumeSource(source: ContinuitySyncSource): boolean {
  return RESUME_SOURCES.has(source);
}

/** Prefer visibility over focus when both arrive in the coalesce window. */
export function preferResumeSource(
  current: ContinuitySyncSource | null,
  next: ContinuitySyncSource,
): ContinuitySyncSource {
  if (!current) return next;
  if (current === "visibility" || next === "visibility") return "visibility";
  if (current === "focus" || next === "focus") return "focus";
  return next;
}

export function shouldSkipResumeForMinGap(input: {
  source: ContinuitySyncSource;
  nowMs: number;
  lastResumeAtMs: number | null;
  minGapMs?: number;
}): boolean {
  if (!isCoalescedResumeSource(input.source)) return false;
  if (input.lastResumeAtMs == null) return false;
  const gap = input.minGapMs ?? RESUME_MIN_GAP_MS;
  return input.nowMs - input.lastResumeAtMs < gap;
}

/**
 * Poll delay when Realtime is the primary path but not SUBSCRIBED.
 * Healthy fallback stays at baseIntervalMs; CHANNEL_ERROR / TIMED_OUT /
 * CLOSED grow exponentially so a flapping channel cannot heartbeat-spam.
 */
export function reconnectPollDelayMs(input: {
  baseIntervalMs: number;
  realtimeStatus: ContinuityRealtimeStatus | null;
  consecutiveUnhealthyPolls: number;
  realtimeEnabled: boolean;
}): number {
  const base = Math.max(1_000, input.baseIntervalMs);
  if (!input.realtimeEnabled) return base;
  if (input.realtimeStatus === "SUBSCRIBED" || input.realtimeStatus === "JOINING") {
    return base;
  }
  const unhealthy = input.realtimeStatus === "CHANNEL_ERROR"
    || input.realtimeStatus === "TIMED_OUT"
    || input.realtimeStatus === "CLOSED"
    || input.realtimeStatus == null;
  if (!unhealthy) return base;
  const failures = Math.max(0, input.consecutiveUnhealthyPolls);
  if (failures <= 0) return base;
  return Math.max(base, continuityBackoffMs(failures));
}

export function isUnhealthyRealtimeStatus(
  status: ContinuityRealtimeStatus | null,
  realtimeEnabled: boolean,
): boolean {
  if (!realtimeEnabled) return false;
  return status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" || status == null;
}

export type ContinuityResumeGate = {
  /**
   * Ask to schedule a resume. Immediate sources run now; focus/visibility
   * coalesce. Caller supplies `schedule` and a `defer` timer (e.g. setTimeout).
   */
  request: (input: {
    source: ContinuitySyncSource;
    nowMs: number;
    schedule: (source: ContinuitySyncSource) => void;
    defer: (fn: () => void, waitMs: number) => { clear: () => void };
  }) => "scheduled" | "coalesced" | "skipped";
  /** Call after a coalesced or focus/visibility resume actually starts work. */
  markResumed: (nowMs: number) => void;
  dispose: () => void;
};

export function createContinuityResumeGate(
  options: { coalesceMs?: number; minGapMs?: number; clock?: () => number } = {},
): ContinuityResumeGate {
  const coalesceMs = options.coalesceMs ?? RESUME_COALESCE_MS;
  const minGapMs = options.minGapMs ?? RESUME_MIN_GAP_MS;
  const clock = options.clock ?? (() => Date.now());
  let pendingSource: ContinuitySyncSource | null = null;
  let pendingTimer: { clear: () => void } | null = null;
  let lastResumeAtMs: number | null = null;

  function clearPending() {
    pendingTimer?.clear();
    pendingTimer = null;
    pendingSource = null;
  }

  function flushPending(schedule: (source: ContinuitySyncSource) => void, nowMs: number) {
    const source = pendingSource;
    clearPending();
    if (!source) return;
    if (shouldSkipResumeForMinGap({ source, nowMs, lastResumeAtMs, minGapMs })) return;
    lastResumeAtMs = nowMs;
    schedule(source);
  }

  return {
    request({ source, nowMs, schedule, defer }) {
      if (isImmediateResumeSource(source)) {
        clearPending();
        schedule(source);
        return "scheduled";
      }

      if (source === "poll") {
        schedule(source);
        return "scheduled";
      }

      if (!isCoalescedResumeSource(source)) {
        schedule(source);
        return "scheduled";
      }

      if (shouldSkipResumeForMinGap({ source, nowMs, lastResumeAtMs, minGapMs }) && !pendingTimer) {
        return "skipped";
      }

      pendingSource = preferResumeSource(pendingSource, source);
      if (pendingTimer) return "coalesced";

      pendingTimer = defer(() => {
        flushPending(schedule, clock());
      }, coalesceMs);
      return "coalesced";
    },

    markResumed(nowMs) {
      lastResumeAtMs = nowMs;
    },

    dispose() {
      clearPending();
    },
  };
}
