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
    const pending = afterNextPaint().then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(49);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toBe(true);
  });
});
