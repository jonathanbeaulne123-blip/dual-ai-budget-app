// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HerculesPresence } from "../src/Hercules.tsx";
import { catalogHousehold } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

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
  const household = catalogHousehold();
  act(() => root.render(createElement(HerculesPresence, {
    household,
    today: "2026-08-30",
    tab: "ledger",
    adding: false,
    memberId: household.members[0]!.id,
    view: "household",
    onOpenAdd: vi.fn(),
    onGo: vi.fn(),
    onLedger: vi.fn(),
    onOpenSource: vi.fn(),
  })));
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
});
