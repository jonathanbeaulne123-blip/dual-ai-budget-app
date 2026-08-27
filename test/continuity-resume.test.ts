import { afterEach, describe, expect, it, vi } from "vitest";
import { continuityBackoffMs } from "../src/continuity.ts";
import {
  createContinuityResumeGate,
  isImmediateResumeSource,
  isUnhealthyRealtimeStatus,
  preferResumeSource,
  reconnectPollDelayMs,
  RESUME_COALESCE_MS,
  RESUME_MIN_GAP_MS,
  shouldSkipResumeForMinGap,
} from "../src/continuityResume.ts";

describe("continuity resume coalesce (T3-S3)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefers visibility over focus in one window", () => {
    expect(preferResumeSource("focus", "visibility")).toBe("visibility");
    expect(preferResumeSource(null, "focus")).toBe("focus");
  });

  it("marks online/manual/realtime as immediate", () => {
    expect(isImmediateResumeSource("online")).toBe(true);
    expect(isImmediateResumeSource("manual")).toBe(true);
    expect(isImmediateResumeSource("realtime")).toBe(true);
    expect(isImmediateResumeSource("focus")).toBe(false);
    expect(isImmediateResumeSource("visibility")).toBe(false);
  });

  it("skips focus/visibility inside the min-gap after a resume", () => {
    expect(shouldSkipResumeForMinGap({
      source: "visibility",
      nowMs: 2_000,
      lastResumeAtMs: 1_000,
      minGapMs: RESUME_MIN_GAP_MS,
    })).toBe(true);
    expect(shouldSkipResumeForMinGap({
      source: "visibility",
      nowMs: 1_000 + RESUME_MIN_GAP_MS,
      lastResumeAtMs: 1_000,
      minGapMs: RESUME_MIN_GAP_MS,
    })).toBe(false);
    expect(shouldSkipResumeForMinGap({
      source: "online",
      nowMs: 1_100,
      lastResumeAtMs: 1_000,
    })).toBe(false);
  });

  it("coalesces focus then visibility into one visibility resume", () => {
    vi.useFakeTimers();
    let now = 10_000;
    const scheduled: string[] = [];
    const gate = createContinuityResumeGate({
      coalesceMs: RESUME_COALESCE_MS,
      minGapMs: RESUME_MIN_GAP_MS,
      clock: () => now,
    });

    const defer = (fn: () => void, waitMs: number) => {
      const id = setTimeout(fn, waitMs);
      return { clear: () => clearTimeout(id) };
    };
    const schedule = (source: string) => {
      scheduled.push(source);
    };

    expect(gate.request({
      source: "focus",
      nowMs: now,
      schedule,
      defer,
    })).toBe("coalesced");
    expect(scheduled).toEqual([]);

    now += 50;
    expect(gate.request({
      source: "visibility",
      nowMs: now,
      schedule,
      defer,
    })).toBe("coalesced");

    now += RESUME_COALESCE_MS;
    vi.advanceTimersByTime(RESUME_COALESCE_MS);
    expect(scheduled).toEqual(["visibility"]);
  });

  it("skips a second visibility resume inside the min-gap", () => {
    vi.useFakeTimers();
    let now = 20_000;
    const scheduled: string[] = [];
    const gate = createContinuityResumeGate({
      coalesceMs: 10,
      minGapMs: 1_000,
      clock: () => now,
    });
    const defer = (fn: () => void, waitMs: number) => {
      const id = setTimeout(fn, waitMs);
      return { clear: () => clearTimeout(id) };
    };
    const schedule = (source: string) => {
      scheduled.push(source);
    };

    gate.request({ source: "visibility", nowMs: now, schedule, defer });
    now += 10;
    vi.advanceTimersByTime(10);
    expect(scheduled).toEqual(["visibility"]);

    now += 100;
    expect(gate.request({
      source: "focus",
      nowMs: now,
      schedule,
      defer,
    })).toBe("skipped");
    expect(scheduled).toEqual(["visibility"]);
  });

  it("runs online immediately and cancels a pending coalesce", () => {
    vi.useFakeTimers();
    let now = 30_000;
    const scheduled: string[] = [];
    const gate = createContinuityResumeGate({
      coalesceMs: 500,
      clock: () => now,
    });
    const defer = (fn: () => void, waitMs: number) => {
      const id = setTimeout(fn, waitMs);
      return { clear: () => clearTimeout(id) };
    };
    const schedule = (source: string) => {
      scheduled.push(source);
    };

    gate.request({ source: "focus", nowMs: now, schedule, defer });
    expect(gate.request({
      source: "online",
      nowMs: now + 10,
      schedule,
      defer,
    })).toBe("scheduled");
    expect(scheduled).toEqual(["online"]);

    now += 500;
    vi.advanceTimersByTime(500);
    expect(scheduled).toEqual(["online"]);
  });
});

describe("reconnect poll backoff (T3-S3)", () => {
  it("keeps the base interval while Realtime is subscribed or joining", () => {
    expect(reconnectPollDelayMs({
      baseIntervalMs: 4_000,
      realtimeStatus: "SUBSCRIBED",
      consecutiveUnhealthyPolls: 5,
      realtimeEnabled: true,
    })).toBe(4_000);
    expect(reconnectPollDelayMs({
      baseIntervalMs: 4_000,
      realtimeStatus: "JOINING",
      consecutiveUnhealthyPolls: 3,
      realtimeEnabled: true,
    })).toBe(4_000);
  });

  it("grows exponentially when Realtime is unhealthy", () => {
    expect(reconnectPollDelayMs({
      baseIntervalMs: 4_000,
      realtimeStatus: "CHANNEL_ERROR",
      consecutiveUnhealthyPolls: 0,
      realtimeEnabled: true,
    })).toBe(4_000);
    expect(reconnectPollDelayMs({
      baseIntervalMs: 4_000,
      realtimeStatus: "CHANNEL_ERROR",
      consecutiveUnhealthyPolls: 1,
      realtimeEnabled: true,
    })).toBe(Math.max(4_000, continuityBackoffMs(1)));
    expect(reconnectPollDelayMs({
      baseIntervalMs: 4_000,
      realtimeStatus: "TIMED_OUT",
      consecutiveUnhealthyPolls: 3,
      realtimeEnabled: true,
    })).toBe(Math.max(4_000, continuityBackoffMs(3)));
    expect(reconnectPollDelayMs({
      baseIntervalMs: 4_000,
      realtimeStatus: "CLOSED",
      consecutiveUnhealthyPolls: 6,
      realtimeEnabled: true,
    })).toBe(Math.max(4_000, continuityBackoffMs(6)));
  });

  it("does not backoff when Realtime feature is off (steady poll)", () => {
    expect(reconnectPollDelayMs({
      baseIntervalMs: 4_000,
      realtimeStatus: null,
      consecutiveUnhealthyPolls: 4,
      realtimeEnabled: false,
    })).toBe(4_000);
  });

  it("classifies unhealthy Realtime statuses", () => {
    expect(isUnhealthyRealtimeStatus("CHANNEL_ERROR", true)).toBe(true);
    expect(isUnhealthyRealtimeStatus("SUBSCRIBED", true)).toBe(false);
    expect(isUnhealthyRealtimeStatus("CLOSED", false)).toBe(false);
  });
});
