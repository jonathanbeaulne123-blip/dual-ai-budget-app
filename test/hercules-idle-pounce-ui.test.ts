// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HerculesPresence } from "../src/Hercules.tsx";
import { catalogHousehold } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let household: ReturnType<typeof catalogHousehold>;

function renderHercules(options: { tab?: "home" | "ledger"; activityBlocked?: boolean } = {}) {
  act(() => root.render(createElement(HerculesPresence, {
    household,
    today: "2026-08-30",
    tab: options.tab ?? "home",
    adding: false,
    activityBlocked: options.activityBlocked,
    memberId: household.members[0]!.id,
    view: "household",
    onOpenAdd: vi.fn(),
    onGo: vi.fn(),
    onLedger: vi.fn(),
    onOpenSource: vi.fn(),
  })));
}

function litterLabel(): string | null {
  return container.querySelector(".herc-litter")?.getAttribute("aria-label") ?? null;
}

async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-30T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1366 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  household = catalogHousehold();
  renderHercules();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Hercules human-idle fly pounce", () => {
  it("travels quickly, captures after ten idle seconds, and fires once per idle period", async () => {
    expect(litterLabel()).toContain("0 dead flies");
    await advance(9_999);
    expect(container.querySelector(".hercules-live")?.classList.contains("is-fly-pouncing")).toBe(false);
    await advance(1);
    expect(container.querySelector(".hercules-live")?.classList.contains("is-fly-pouncing")).toBe(true);
    expect(litterLabel()).toContain("0 dead flies");
    await advance(360);
    expect(litterLabel()).toContain("1 dead fly");
    await advance(20_000);
    expect(litterLabel()).toContain("1 dead fly");
  });

  it("cancels an in-flight capture when human activity resumes", async () => {
    await advance(10_100);
    expect(container.querySelector(".hercules-live")?.classList.contains("is-fly-pouncing")).toBe(true);
    act(() => window.dispatchEvent(new Event("pointermove")));
    await advance(500);
    expect(container.querySelector(".hercules-live")?.classList.contains("is-fly-pouncing")).toBe(false);
    expect(litterLabel()).toContain("0 dead flies");
  });

  it("keeps secondary rooms quiet and restarts the Home idle chase when Home returns", async () => {
    renderHercules({ tab: "ledger" });
    expect(litterLabel()).toBeNull();
    await advance(12_000);
    expect(container.querySelector(".hercules-live")?.classList.contains("is-fly-pouncing")).toBe(false);

    renderHercules({ tab: "home" });
    expect(litterLabel()).toContain("0 dead flies");
    await advance(10_000);
    expect(container.querySelector(".hercules-live")?.classList.contains("is-fly-pouncing")).toBe(true);
  });

  it("pauses autonomous Home activity behind a consequential sheet", async () => {
    renderHercules({ activityBlocked: true });
    expect(litterLabel()).toBeNull();
    await advance(12_000);
    expect(container.querySelector(".hercules-live")?.classList.contains("is-fly-pouncing")).toBe(false);

    renderHercules({ activityBlocked: false });
    expect(litterLabel()).toContain("0 dead flies");
    await advance(10_000);
    expect(container.querySelector(".hercules-live")?.classList.contains("is-fly-pouncing")).toBe(true);
  });

  it("does not schedule idle-pounce retries on phone or under reduced motion", () => {
    act(() => root.unmount());
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    root = createRoot(container);
    const timerSpy = vi.spyOn(window, "setTimeout");
    renderHercules();
    expect(timerSpy.mock.calls.some(([, delay]) => delay === 10_000 || delay === 1_000)).toBe(false);

    act(() => root.unmount());
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1366 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    root = createRoot(container);
    timerSpy.mockClear();
    renderHercules();
    expect(timerSpy.mock.calls.some(([, delay]) => delay === 10_000 || delay === 1_000)).toBe(false);
  });
});
