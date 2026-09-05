import { describe, expect, it, vi, afterEach } from "vitest";
import {
  attachContinuityRealtime,
  canAttachContinuityRealtime,
  continuityRealtimeAllowed,
  continuityRealtimeEnabled,
  continuityRealtimeSelfHealEnabled,
  continuityRealtimeWorkerSupported,
  shouldUsePollFallback,
  type ContinuityRealtimeDeps,
} from "../src/continuityRealtime.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("continuityRealtimeWorkerSupported", () => {
  it("enables background heartbeats only when the browser supports workers", () => {
    vi.stubGlobal("window", {});
    expect(continuityRealtimeWorkerSupported()).toBe(false);
    vi.stubGlobal("window", { Worker: class Worker {} });
    expect(continuityRealtimeWorkerSupported()).toBe(true);
  });
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

describe("continuityRealtimeSelfHealEnabled", () => {
  const base = {
    environment: "development" as const,
    transportEnabled: true,
    authEnabled: true,
    hostedAllowed: true,
  };

  it("starts only for an authenticated, hosted Development transport", () => {
    expect(continuityRealtimeSelfHealEnabled(base)).toBe(true);
    expect(continuityRealtimeSelfHealEnabled({ ...base, environment: "production" })).toBe(false);
    expect(continuityRealtimeSelfHealEnabled({ ...base, authEnabled: false })).toBe(false);
    expect(continuityRealtimeSelfHealEnabled({ ...base, hostedAllowed: false })).toBe(false);
    expect(continuityRealtimeSelfHealEnabled({ ...base, transportEnabled: false })).toBe(false);
  });
});

describe("attachContinuityRealtime lifecycle", () => {
  it("renews the authenticated socket token, catches up, and reports renewal failure", async () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    const channel = {
      on: vi.fn(() => channel),
      subscribe: vi.fn(() => channel),
    };
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      realtime: { setAuth: vi.fn() },
    };
    const createClientMock = vi.fn((..._args: Parameters<NonNullable<ContinuityRealtimeDeps["createClient"]>>) => client);
    const accessTokenProvider = vi.fn(async () => "access-token");
    const onAccessTokenChange = vi.fn();
    const onAccessTokenError = vi.fn();

    const detach = attachContinuityRealtime({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      accessToken: "access-token",
      accessTokenProvider,
      onAccessTokenChange,
      onAccessTokenError,
      householdId: "HH-DEMO",
      memberId: "MEM-001",
      environment: "development",
      onSnapshotSignal: vi.fn(),
    }, { createClient: createClientMock as ContinuityRealtimeDeps["createClient"] });

    const socketTokenProvider = createClientMock.mock.calls[0]?.[2]?.accessToken;
    expect(socketTokenProvider).toBeTypeOf("function");
    if (typeof socketTokenProvider !== "function") throw new Error("Missing socket token provider.");

    await expect(socketTokenProvider()).resolves.toBe("access-token");
    expect(onAccessTokenChange).not.toHaveBeenCalled();

    accessTokenProvider.mockResolvedValue("renewed-access-token");
    await expect(socketTokenProvider()).resolves.toBe("renewed-access-token");
    expect(onAccessTokenChange).toHaveBeenCalledOnce();

    const renewalError = new Error("renewal failed");
    accessTokenProvider.mockRejectedValueOnce(renewalError);
    await expect(socketTokenProvider()).rejects.toThrow("renewal failed");
    expect(onAccessTokenError).toHaveBeenCalledWith(renewalError);

    const providerCallsBeforeDetach = accessTokenProvider.mock.calls.length;
    detach();
    await expect(socketTokenProvider()).resolves.toBeNull();
    expect(accessTokenProvider).toHaveBeenCalledTimes(providerCallsBeforeDetach);
  });

  it("subscribes to shared and personal snapshot channels and cleans up", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "");
    const onSnapshotSignal = vi.fn();
    const onStatusChange = vi.fn();
    const onHeartbeatStatus = vi.fn();
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
    const createClientMock = vi.fn((..._args: Parameters<NonNullable<ContinuityRealtimeDeps["createClient"]>>) => client);
    const createClient = createClientMock as ContinuityRealtimeDeps["createClient"];

    const detach = attachContinuityRealtime({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      accessToken: "access-token",
      householdId: "HH-DEMO",
      memberId: "MEM-001",
      environment: "development",
      onSnapshotSignal,
      onStatusChange,
      onHeartbeatStatus,
    }, { createClient });

    expect(createClient).toHaveBeenCalledOnce();
    expect(client.realtime.setAuth).toHaveBeenCalledWith("access-token");
    expect(channel.on).toHaveBeenCalledTimes(2);
    expect(channel.on.mock.calls[0]?.[1]?.table).toBe("household_snapshots");
    expect(channel.on.mock.calls[1]?.[1]?.table).toBe("continuity_personal_snapshots");
    expect(channel.subscribe).toHaveBeenCalledOnce();
    const realtimeOptions = createClientMock.mock.calls[0]?.[2]?.realtime;
    expect(typeof realtimeOptions?.worker).toBe("boolean");
    expect(realtimeOptions?.heartbeatCallback).toBeTypeOf("function");

    realtimeOptions?.heartbeatCallback?.("timeout", 321);
    expect(onHeartbeatStatus).toHaveBeenCalledWith("timeout", 321);

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
    realtimeOptions?.heartbeatCallback?.("timeout", 654);
    expect(onHeartbeatStatus).toHaveBeenCalledOnce();
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
