import { afterEach, describe, expect, it, vi } from "vitest";
import { attachSoftPresenceRealtime } from "../src/softPresenceRealtime.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("attachSoftPresenceRealtime", () => {
  it("tracks memberId/deviceId/seenAt only and syncs presence state", async () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    const onPresence = vi.fn();
    const presenceState = vi.fn(() => ({
      "DEV-B": [{ memberId: "MEM-002", deviceId: "DEV-B", seenAt: "2026-08-27T12:00:00.000Z" }],
    }));
    const track = vi.fn(async () => "ok" as const);
    const untrack = vi.fn(async () => "ok" as const);
    const removeChannel = vi.fn(async () => "ok" as const);
    const subscribeCallbacks: Array<(status: string) => void> = [];
    const channel = {
      on: vi.fn(function on(this: typeof channel) { return this; }),
      subscribe: vi.fn((cb: (status: string) => void) => {
        subscribeCallbacks.push(cb);
        return channel;
      }),
      track,
      untrack,
      presenceState,
    };
    const client = {
      channel: vi.fn(() => channel),
      removeChannel,
      realtime: { setAuth: vi.fn() },
    };

    const detach = attachSoftPresenceRealtime({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      accessToken: "jwt",
      householdId: "HH-1",
      environment: "development",
      track: { memberId: "MEM-001", deviceId: "DEV-A", seenAt: "2026-08-27T12:00:00.000Z" },
      onPresence,
    }, { createClient: () => client });

    expect(client.channel).toHaveBeenCalledWith(
      "hearth-presence:development:HH-1",
      expect.objectContaining({ config: { presence: { key: "DEV-A" } } }),
    );
    subscribeCallbacks[0]?.("SUBSCRIBED");
    await Promise.resolve();
    expect(track).toHaveBeenCalledWith({
      memberId: "MEM-001",
      deviceId: "DEV-A",
      seenAt: "2026-08-27T12:00:00.000Z",
    });
    expect(JSON.stringify(track.mock.calls.at(0)?.at(0) ?? {})).not.toMatch(/transaction|amount|payload/i);

    detach();
    expect(untrack).toHaveBeenCalled();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });

  it("does not track when opt-out passes track: null", async () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    const track = vi.fn(async () => "ok" as const);
    const subscribeCallbacks: Array<(status: string) => void> = [];
    const channel = {
      on: vi.fn(function on(this: typeof channel) { return this; }),
      subscribe: vi.fn((cb: (status: string) => void) => {
        subscribeCallbacks.push(cb);
        return channel;
      }),
      track,
      untrack: vi.fn(async () => "ok" as const),
      presenceState: vi.fn(() => ({})),
    };
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => "ok" as const),
      realtime: { setAuth: vi.fn() },
    };
    attachSoftPresenceRealtime({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      accessToken: "jwt",
      householdId: "HH-1",
      environment: "development",
      track: null,
      onPresence: vi.fn(),
    }, { createClient: () => client });
    subscribeCallbacks[0]?.("SUBSCRIBED");
    await Promise.resolve();
    expect(track).not.toHaveBeenCalled();
  });

  it("is a no-op on Production even when the Realtime flag is on", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    const createClient = vi.fn();
    const detach = attachSoftPresenceRealtime({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      accessToken: "jwt",
      householdId: "HH-1",
      environment: "production",
      track: { memberId: "MEM-001", deviceId: "DEV-A", seenAt: "2026-08-27T12:00:00.000Z" },
      onPresence: vi.fn(),
    }, { createClient });
    expect(createClient).not.toHaveBeenCalled();
    detach();
  });
});
