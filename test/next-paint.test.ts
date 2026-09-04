import { afterEach, describe, expect, it, vi } from "vitest";
import { afterNextPaint } from "../src/nextPaint.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("next-paint command yield", () => {
  it("resolves through the timeout when a hidden tab suspends requestAnimationFrame", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    let resolved = false;
    const pending = afterNextPaint().then((painted) => { resolved = true; return painted; });
    await vi.advanceTimersByTimeAsync(49);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ painted: false, status: "hidden-fallback" });
    expect(resolved).toBe(true);
  });

  it("requires two animation callbacks before reporting a paint opportunity", async () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    let resolved = false;
    const pending = afterNextPaint().then((painted) => { resolved = true; return painted; });

    expect(callbacks).toHaveLength(1);
    callbacks.shift()!(0);
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(callbacks).toHaveLength(1);

    callbacks.shift()!(16);
    await expect(pending).resolves.toEqual({ painted: true, status: "painted" });
  });

  it("does not censor a visible phone whose second animation frame arrives after 50 ms", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { visibilityState: "visible" });
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    let resolved = false;
    const pending = afterNextPaint({ evidence: true }).then((witness) => { resolved = true; return witness; });

    await vi.advanceTimersByTimeAsync(75);
    expect(resolved).toBe(false);
    callbacks.shift()!(75);
    callbacks.shift()!(92);
    await expect(pending).resolves.toEqual({ painted: true, status: "painted" });
  });
});
