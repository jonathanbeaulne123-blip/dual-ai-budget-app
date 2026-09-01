import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createContinuityRealtimeReconnectGate,
  REALTIME_RECONNECT_DELAYS_MS,
  REALTIME_SUBSCRIBE_ACK_TIMEOUT_MS,
  shouldDeferResumeForRealtimeReconnect,
} from "../src/continuityRealtimeReconnect.ts";

afterEach(() => {
  vi.useRealTimers();
});

function harness() {
  vi.useFakeTimers();
  const reconnect = vi.fn(async () => undefined);
  const onSubscribed = vi.fn();
  const onReconnectScheduled = vi.fn();
  const gate = createContinuityRealtimeReconnectGate({
    reconnect,
    onSubscribed,
    onReconnectScheduled,
    defer: (fn, waitMs) => {
      const id = setTimeout(fn, waitMs);
      return { clear: () => clearTimeout(id) };
    },
  });
  return { gate, reconnect, onSubscribed, onReconnectScheduled };
}

describe("continuity Realtime reconnect gate", () => {
  it("defers full resume only while an enabled Realtime path is unhealthy", () => {
    expect(shouldDeferResumeForRealtimeReconnect({ realtimeEnabled: true, status: "CLOSED" })).toBe(true);
    expect(shouldDeferResumeForRealtimeReconnect({ realtimeEnabled: true, status: "JOINING" })).toBe(true);
    expect(shouldDeferResumeForRealtimeReconnect({ realtimeEnabled: true, status: "SUBSCRIBED" })).toBe(false);
    expect(shouldDeferResumeForRealtimeReconnect({ realtimeEnabled: false, status: null })).toBe(false);
  });

  it("recreates a terminal channel once after the bounded first delay", async () => {
    const { gate, reconnect, onReconnectScheduled } = harness();
    gate.noteStatus("CLOSED");
    gate.noteStatus("CHANNEL_ERROR");

    vi.advanceTimersByTime(REALTIME_RECONNECT_DELAYS_MS[0] - 1);
    expect(reconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(reconnect).toHaveBeenCalledOnce();
    expect(reconnect).toHaveBeenCalledWith("channel");
    expect(onReconnectScheduled).toHaveBeenCalledTimes(2);
  });

  it("reconnects immediately on focus while unhealthy and coalesces the old timer", async () => {
    const { gate, reconnect } = harness();
    gate.noteStatus("CLOSED");
    gate.requestReconnect("focus");

    await vi.advanceTimersByTimeAsync(0);
    expect(reconnect).toHaveBeenCalledOnce();
    expect(reconnect).toHaveBeenCalledWith("focus");
    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[0]);
    expect(reconnect).toHaveBeenCalledOnce();
  });

  it("treats heartbeat timeout as a reconnect signal", async () => {
    const { gate, reconnect } = harness();
    gate.noteStatus("SUBSCRIBED");
    gate.noteHeartbeat("timeout");

    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[0]);
    expect(reconnect).toHaveBeenCalledWith("heartbeat");
  });

  it("resets reconnect state and requests catch-up after resubscription", async () => {
    const { gate, reconnect, onSubscribed } = harness();
    gate.noteStatus("CLOSED");
    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[0]);
    expect(reconnect).toHaveBeenCalledOnce();

    gate.noteStatus("SUBSCRIBED");
    expect(onSubscribed).toHaveBeenCalledWith(true);

    gate.requestReconnect("online");
    await vi.runAllTimersAsync();
    expect(reconnect).toHaveBeenCalledOnce();
  });

  it("backs off and retries when recreating the authenticated channel fails", async () => {
    vi.useFakeTimers();
    const reconnect = vi.fn()
      .mockRejectedValueOnce(new Error("temporary auth refresh failure"))
      .mockResolvedValueOnce(undefined);
    const gate = createContinuityRealtimeReconnectGate({
      reconnect,
      defer: (fn, waitMs) => {
        const id = setTimeout(fn, waitMs);
        return { clear: () => clearTimeout(id) };
      },
    });
    gate.noteStatus("CLOSED");

    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[0]);
    expect(reconnect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[1]);
    expect(reconnect).toHaveBeenCalledTimes(2);
  });

  it("retries when attach returns but no matching SUBSCRIBED acknowledgement arrives", async () => {
    const { gate, reconnect } = harness();
    gate.noteStatus("CLOSED");

    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[0]);
    expect(reconnect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(REALTIME_SUBSCRIBE_ACK_TIMEOUT_MS);
    expect(reconnect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[1]);
    expect(reconnect).toHaveBeenCalledTimes(2);
  });

  it("stops automatic retries when refreshed Auth or membership makes reattach ineligible", async () => {
    vi.useFakeTimers();
    const reconnect = vi.fn(async () => false);
    const gate = createContinuityRealtimeReconnectGate({
      reconnect,
      defer: (fn, waitMs) => {
        const id = setTimeout(fn, waitMs);
        return { clear: () => clearTimeout(id) };
      },
    });
    gate.noteStatus("CLOSED");

    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[0]);
    await vi.runAllTimersAsync();
    expect(reconnect).toHaveBeenCalledOnce();
  });

  it("does not call reconnect or subscribed hooks after disposal", async () => {
    const { gate, reconnect, onSubscribed } = harness();
    gate.noteStatus("CLOSED");
    gate.dispose();

    await vi.runAllTimersAsync();
    gate.noteStatus("SUBSCRIBED");
    gate.requestReconnect("online");
    expect(reconnect).not.toHaveBeenCalled();
    expect(onSubscribed).not.toHaveBeenCalled();
  });

  it("cancels a pending subscription acknowledgement deadline on disposal", async () => {
    const { gate, reconnect } = harness();
    gate.noteStatus("CLOSED");
    await vi.advanceTimersByTimeAsync(REALTIME_RECONNECT_DELAYS_MS[0]);
    expect(reconnect).toHaveBeenCalledOnce();
    gate.dispose();

    await vi.runAllTimersAsync();
    expect(reconnect).toHaveBeenCalledOnce();
  });
});
