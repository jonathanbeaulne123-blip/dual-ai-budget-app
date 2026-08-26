import { describe, expect, it, vi, afterEach } from "vitest";
import {
  attachContinuityRealtime,
  canAttachContinuityRealtime,
  continuityRealtimeEnabled,
  shouldUsePollFallback,
  type ContinuityRealtimeDeps,
} from "../src/continuityRealtime.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("continuityRealtimeEnabled", () => {
  it("is off unless VITE_CONTINUITY_REALTIME=1", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "");
    expect(continuityRealtimeEnabled()).toBe(false);
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    expect(continuityRealtimeEnabled()).toBe(true);
  });
});

describe("shouldUsePollFallback", () => {
  it("always polls when Realtime feature is disabled", () => {
    expect(shouldUsePollFallback("SUBSCRIBED", false)).toBe(true);
    expect(shouldUsePollFallback(null, false)).toBe(true);
  });

  it("skips poll when Realtime is SUBSCRIBED", () => {
    expect(shouldUsePollFallback("SUBSCRIBED", true)).toBe(false);
  });

  it("falls back to poll when Realtime is disconnected", () => {
    expect(shouldUsePollFallback("CLOSED", true)).toBe(true);
    expect(shouldUsePollFallback("CHANNEL_ERROR", true)).toBe(true);
    expect(shouldUsePollFallback("TIMED_OUT", true)).toBe(true);
    expect(shouldUsePollFallback(null, true)).toBe(true);
  });
});

describe("canAttachContinuityRealtime", () => {
  it("requires auth session, membership, hosted allowance, and household", () => {
    expect(canAttachContinuityRealtime({
      enabled: true,
      authSessionPresent: true,
      membershipResolved: true,
      hostedAllowed: true,
      hasHousehold: true,
    })).toBe(true);
    expect(canAttachContinuityRealtime({
      enabled: true,
      authSessionPresent: false,
      membershipResolved: true,
      hostedAllowed: true,
      hasHousehold: true,
    })).toBe(false);
    expect(canAttachContinuityRealtime({
      enabled: true,
      authSessionPresent: true,
      membershipResolved: false,
      hostedAllowed: true,
      hasHousehold: true,
    })).toBe(false);
    expect(canAttachContinuityRealtime({
      enabled: false,
      authSessionPresent: true,
      membershipResolved: true,
      hostedAllowed: true,
      hasHousehold: true,
    })).toBe(false);
  });
});

describe("attachContinuityRealtime lifecycle", () => {
  it("subscribes to shared and personal snapshot channels and cleans up", () => {
    const onSnapshotSignal = vi.fn();
    const onStatusChange = vi.fn();
    const postgresHandlers: Array<() => void> = [];
    const subscribeCallback: Array<(status: string) => void> = [];

    const channel = {
      on: vi.fn((_type: string, filter: Record<string, string>, handler: () => void) => {
        postgresHandlers.push(handler);
        expect(filter.schema).toBe("public");
        expect(filter.filter).toMatch(/^household_id=eq\./);
        return channel;
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        subscribeCallback.push(callback);
        return channel;
      }),
    };

    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      realtime: { setAuth: vi.fn() },
    };
    const createClient = vi.fn(() => client) as ContinuityRealtimeDeps["createClient"];

    const detach = attachContinuityRealtime({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      accessToken: "access-token",
      householdId: "HH-DEMO",
      memberId: "MEM-001",
      environment: "development",
      onSnapshotSignal,
      onStatusChange,
    }, { createClient });

    expect(createClient).toHaveBeenCalledOnce();
    expect(client.realtime.setAuth).toHaveBeenCalledWith("access-token");
    expect(channel.on).toHaveBeenCalledTimes(2);
    expect(channel.on.mock.calls[0]?.[1]?.table).toBe("household_snapshots");
    expect(channel.on.mock.calls[1]?.[1]?.table).toBe("continuity_personal_snapshots");
    expect(channel.subscribe).toHaveBeenCalledOnce();

    subscribeCallback[0]?.("SUBSCRIBED");
    expect(onStatusChange).toHaveBeenCalledWith("SUBSCRIBED");

    postgresHandlers[0]?.();
    expect(onSnapshotSignal).toHaveBeenCalledOnce();

    detach();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
    expect(client.realtime.setAuth).toHaveBeenCalledWith(null);

    postgresHandlers[0]?.();
    expect(onSnapshotSignal).toHaveBeenCalledOnce();
  });

  it("does not merge websocket payload — only signals pull/reconcile", () => {
    const onSnapshotSignal = vi.fn();
    const postgresHandlers: Array<() => void> = [];
    const channel = {
      on: vi.fn((_type: string, _filter: Record<string, string>, handler: () => void) => {
        postgresHandlers.push(handler);
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      realtime: { setAuth: vi.fn() },
    };

    attachContinuityRealtime({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      accessToken: "access-token",
      householdId: "HH-DEMO",
      memberId: "MEM-001",
      environment: "development",
      onSnapshotSignal,
    }, { createClient: vi.fn(() => client) as ContinuityRealtimeDeps["createClient"] });

    postgresHandlers[0]?.();
    expect(onSnapshotSignal).toHaveBeenCalledWith();
  });
});
