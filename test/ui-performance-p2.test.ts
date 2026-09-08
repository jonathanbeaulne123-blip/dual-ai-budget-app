// @vitest-environment jsdom
// React is rendered through createElement so this proof remains in the repo's .test.ts gate.
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShiftElapsedHint, nextQuarterPreviewDelay } from "../src/ShiftElapsedHint.tsx";
import { catalogHousehold, clockInShift, shiftPostingStreak } from "../src/core/index.ts";
import { listFurniture, resetFurnitureForTests } from "../src/core/officeLayout.ts";
import { TimesheetGlance } from "../src/widgets/Timesheet.tsx";
import { useFurniture } from "../src/widgets/useFurniture.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetFurnitureForTests();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("UI P2 scheduling budgets", () => {
  it("keeps the one-second elapsed tick inside the child instead of rerendering its parent", async () => {
    let parentRenders = 0;
    function Parent() {
      parentRenders += 1;
      return createElement(ShiftElapsedHint, { startedAt: "2026-08-30T11:00:00.000Z" });
    }
    act(() => root.render(createElement(Parent)));
    expect(parentRenders).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(parentRenders).toBe(1);
    expect(container.textContent).toContain("h since");
  });

  it("schedules pad changes at the next quarter-hour rounding boundary", () => {
    const start = Date.parse("2026-08-30T11:52:31.000Z");
    const now = Date.parse("2026-08-30T12:00:00.000Z");
    expect(nextQuarterPreviewDelay(new Date(start).toISOString(), now)).toBe(1_001);
  });

  it("leaves the closed Timesheet glance timer-free until a shift is live", () => {
    const interval = vi.spyOn(window, "setInterval");
    const household = catalogHousehold();
    const memberId = household.members[0]!.id;
    act(() => root.render(createElement(TimesheetGlance, {
      household,
      memberId,
      streak: shiftPostingStreak(household, "2026-08-30"),
    })));
    expect(interval).not.toHaveBeenCalled();

    const live = clockInShift(household, { memberId }).household;
    act(() => root.render(createElement(TimesheetGlance, {
      household: live,
      memberId,
      streak: shiftPostingStreak(live, "2026-08-30"),
    })));
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 1_000);
  });

  it("coalesces scroll and resize geometry reads to one publication per frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    class Observer {
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 10, y: 20, left: 10, top: 20, right: 110, bottom: 70, width: 100, height: 50,
      toJSON: () => ({}),
    } as DOMRect);
    function FurnitureHarness() {
      const furnitureRef = useFurniture("test-desk", "card", true, false);
      const stable = useRef(furnitureRef);
      return createElement("div", { ref: stable.current });
    }
    act(() => root.render(createElement(FurnitureHarness)));
    expect(rect).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 8; index += 1) window.dispatchEvent(new Event("resize"));
    for (let index = 0; index < 8; index += 1) window.dispatchEvent(new Event("scroll"));
    expect(rect).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);

    act(() => frames.shift()?.(performance.now()));
    expect(rect).toHaveBeenCalledTimes(2);
    expect(listFurniture().find((item) => item.id === "test-desk")?.rect).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });
});
