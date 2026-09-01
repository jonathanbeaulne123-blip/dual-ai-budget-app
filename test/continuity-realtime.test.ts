import { describe, expect, it, vi, afterEach } from "vitest";
import {
  attachContinuityRealtime,
  canAttachContinuityRealtime,
  continuityRealtimeAllowed,
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
  it("requires auth session, membership, hosted allowance, household, and Development environment", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "");
    const base = {
      enabled: true,
      authSessionPresent: true,
      membershipResolved: true,
      hostedAllowed: true,
      hasHousehold: true,
      environment: "development" as const,
    };
    expect(canAttachContinuityRealtime(base)).toBe(true);
    expect(canAttachContinuityRealtime({
      ...base,
      authSessionPresent: false,
    })).toBe(false);
    expect(canAttachContinuityRealtime({
      ...base,
      membershipResolved: false,
    })).toBe(false);
    expect(canAttachContinuityRealtime({
      ...base,
      enabled: false,
    })).toBe(false);
    expect(canAttachContinuityRealtime({
      ...base,
      environment: "production",
    })).toBe(false);
  });
});

describe("continuityRealtimeAllowed", () => {
  it("matches Migration 012 — Development only until October cutover", () => {
    expect(continuityRealtimeAllowed("development")).toBe(true);
    expect(continuityRealtimeAllowed("production")).toBe(false);
  });

  it("allows attach when only command log Realtime is enabled on Development", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "");
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    expect(canAttachContinuityRealtime({
      authSessionPresent: true,
      membershipResolved: true,
      hostedAllowed: true,
      hasHousehold: true,
      environment: "development",
    })).toBe(true);
    expect(canAttachContinuityRealtime({
      authSessionPresent: true,
      membershipResolved: true,
      hostedAllowed: true,
      hasHousehold: true,
      environment: "production",
    })).toBe(false);
  });
});

describe("attachContinuityRealtime lifecycle", () => {
  it("subscribes to shared and personal snapshot channels and cleans up", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "");
    const onSnapshotSignal = vi.fn();
    const onStatusChange = vi.fn();
    const postgresHandlers: Array<(payload?: { new?: unknown }) => void> = [];
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

    postgresHandlers[0]?.({ new: { revision: 7, payload: "ignored" } });
    expect(onSnapshotSignal).toHaveBeenCalledWith({
      table: "household_snapshots",
      revision: 7,
    });

    detach();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
    expect(client.realtime.setAuth).toHaveBeenCalledWith(null);

    postgresHandlers[0]?.({ new: { revision: 8 } });
    expect(onSnapshotSignal).toHaveBeenCalledOnce();
  });

  it("does not merge websocket payload — only signals pull/reconcile", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    const onSnapshotSignal = vi.fn();
    const postgresHandlers: Array<(payload?: { new?: unknown }) => void> = [];
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
    expect(onSnapshotSignal).toHaveBeenCalledWith({
      table: "household_snapshots",
      revision: null,
    });
  });

  it("subscribes to continuity_command_events INSERT when command log is on", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "");
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    const onCommandEvent = vi.fn();
    const commandHandlers: Array<(payload?: { new?: unknown }) => void> = [];
    const channel = {
      on: vi.fn((_type: string, filter: Record<string, string>, handler: (payload?: { new?: unknown }) => void) => {
        if (filter.table === "continuity_command_events") commandHandlers.push(handler);
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
      onSnapshotSignal: vi.fn(),
      onCommandEvent,
    }, { createClient: vi.fn(() => client) as ContinuityRealtimeDeps["createClient"] });

    expect(channel.on).toHaveBeenCalledTimes(1);
    expect(channel.on.mock.calls[0]?.[1]?.table).toBe("continuity_command_events");
    expect(channel.on.mock.calls[0]?.[1]?.event).toBe("INSERT");

    commandHandlers[0]?.({
      new: {
        id: "evt-cmd",
        environment: "development",
        household_id: "HH-DEMO",
        member_id: "MEM-001",
        idempotency_key: "cmd-1",
        confirmation_id: "cmd-1",
        identity_hash: "hash",
        base_revision: 0,
        result_revision: 1,
        ledger_scope: "shared",
        command_type: "postEntry",
        payload_json: {
          confirmationId: "cmd-1",
          identityHash: "hash",
          commandKind: "postEntry",
          postedIds: ["TXN-1"],
          auditHash: "audit",
          revision: 1,
          acceptedAt: "2026-08-26T12:00:00.000Z",
          materializationFacts: { transactions: [] },
        },
        created_at: "2026-08-26T12:00:00.000Z",
      },
    });
    expect(onCommandEvent).toHaveBeenCalledOnce();
    expect(onCommandEvent.mock.calls[0]?.[0]?.idempotency_key).toBe("cmd-1");
  });
});
