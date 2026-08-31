// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, type Household } from "../src/core/index.ts";

type Inspection = {
  ok: boolean;
  issue?: "missing-schema" | "incomplete-migration" | "interrupted-transaction" | "invalid-stored-data" | "projection-mismatch";
  message: string;
  entryCount: number;
};

const startup = vi.hoisted(() => ({
  cached: null as Household | null,
  inspections: [] as Array<Promise<Inspection>>,
  inspectCalls: 0,
  ingestCalls: 0,
  saveCalls: 0,
  reconcileCalls: 0,
  remote: new Promise<Household>(() => {}),
}));

vi.mock("../src/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/storage.ts")>();
  return {
    ...actual,
    peekHousehold: vi.fn(() => startup.cached),
    loadHousehold: vi.fn(async () => startup.cached),
    listHouseholdReplicas: vi.fn(async () => []),
    loadPersonalReplica: vi.fn(async () => null),
    saveHousehold: vi.fn(async () => { startup.saveCalls += 1; }),
  };
});

vi.mock("../src/ledger/engine.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledger/engine.ts")>();
  return {
    ...actual,
    inspectBrowserBooks: vi.fn((household: Household) => {
      startup.inspectCalls += 1;
      const next = startup.inspections.shift();
      return next ?? Promise.resolve({
        ok: true,
        message: "PGlite agrees.",
        entryCount: household.transactions.length,
      });
    }),
    ingestHouseholdBooks: vi.fn(async (household: Household) => {
      startup.ingestCalls += 1;
      return {
        compiled: {} as never,
        status: {
          ok: true,
          engine: "pglite" as const,
          entryCount: household.transactions.length,
          inBalance: true,
          equationHolds: true,
        },
      };
    }),
  };
});

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return {
    ...actual,
    pullSharedHousehold: vi.fn(() => {
      startup.reconcileCalls += 1;
      return startup.remote;
    }),
  };
});

vi.mock("../src/deferredSurfaces.tsx", () => ({
  DeferredSurface: ({ children }: { children: ReactNode }) => children,
  DeferredOffice: () => createElement("div", { "data-testid": "cached-office-shell" }, "Cached office shell"),
  DeferredBooksPage: () => null,
  DeferredCalendarPage: () => null,
  DeferredWorkShiftPage: () => null,
  DeferredPairingCard: () => null,
  DeferredWelcomeJoin: () => null,
  DeferredWelcomeQrScanner: () => null,
  DeferredShiftReportScanBar: () => null,
  DeferredWorkShiftWithSevenShifts: () => null,
  loadOfficeSurface: vi.fn(async () => ({})),
  loadBooksSurface: vi.fn(async () => ({})),
  loadCalendarSurface: vi.fn(async () => ({})),
  loadWorkShiftSurface: vi.fn(async () => ({})),
}));

import { App } from "../src/App.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll("button")].find((item) => item.getAttribute("aria-label") === label || item.textContent?.trim() === label);
  if (!match) throw new Error(`Missing button ${label}`);
  return match as HTMLButtonElement;
}

function tapPad(container: HTMLElement, label: string): void {
  const key = [...container.querySelectorAll(".cad-pad-keys button")].find((item) => item.getAttribute("aria-label") === label) as HTMLButtonElement | undefined;
  if (!key) throw new Error(`Missing pad key ${label}`);
  act(() => { key.click(); });
}

function openExpenseSlideshow(): void {
  act(() => button("Add money").click());
  act(() => button("Add expense").click());
}

function walkExpenseToConfirm(container: HTMLElement): HTMLButtonElement {
  tapPad(container, "1");
  const enter = [...container.querySelectorAll("button")].find((item) => item.textContent === "Enter") as HTMLButtonElement | undefined;
  if (!enter) throw new Error("Missing Enter");
  act(() => { enter.click(); });
  const groceries = [...container.querySelectorAll("button.chip")].find((item) => item.textContent === "Groceries") as HTMLButtonElement | undefined;
  if (!groceries) throw new Error("Missing Groceries");
  act(() => { groceries.click(); });
  const visa = [...container.querySelectorAll(".wallet-tile")].find((item) => item.textContent?.includes("Visa")) as HTMLButtonElement | undefined;
  if (!visa) throw new Error("Missing Visa tile");
  act(() => { visa.click(); });
  const skip = [...container.querySelectorAll("button")].find((item) => item.textContent === "Skip") as HTMLButtonElement | undefined;
  if (!skip) throw new Error("Missing Skip");
  act(() => { skip.click(); });
  const confirm = container.querySelector("[data-add-confirm]") as HTMLButtonElement | null;
  if (!confirm) throw new Error("Missing Confirm");
  return confirm;
}

async function startValidation(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

async function settleUi(ms = 100): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe("cached-shell startup books gate", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    startup.cached = { ...catalogHousehold(), linked: true };
    startup.inspections = [];
    startup.inspectCalls = 0;
    startup.ingestCalls = 0;
    startup.saveCalls = 0;
    startup.reconcileCalls = 0;
    startup.remote = new Promise<Household>(() => {});
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: "MEM-002",
      view: "household",
      householdId: startup.cached.householdId,
    }));
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: (id: number) => window.clearTimeout(id),
    });
    class TestResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("paints the cached kitchen immediately, locks Post, then unlocks before remote reconcile finishes", async () => {
    let resolveInspection: ((inspection: Inspection) => void) | null = null;
    startup.inspections.push(new Promise<Inspection>((resolve) => { resolveInspection = resolve; }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });

    expect(container.querySelector("nav")).not.toBeNull();
    expect(container.querySelector("[data-testid='cached-office-shell']")).not.toBeNull();
    expect(container.querySelector("[data-books-readiness='validating']")).not.toBeNull();
    expect(startup.inspectCalls).toBe(0);
    expect(startup.reconcileCalls).toBe(0);

    openExpenseSlideshow();
    const confirmWhileValidating = walkExpenseToConfirm(container);
    expect(confirmWhileValidating.disabled).toBe(true);

    await startValidation();
    expect(startup.inspectCalls).toBe(1);
    expect(startup.reconcileCalls).toBe(0);

    await act(async () => {
      resolveInspection?.({ ok: true, message: "PGlite agrees.", entryCount: 0 });
      await Promise.resolve();
    });

    expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull();
    const confirmReady = container.querySelector("[data-add-confirm]") as HTMLButtonElement;
    expect(confirmReady.disabled).toBe(false);
    expect(startup.reconcileCalls).toBe(1);

    const savesBeforePost = startup.saveCalls;
    act(() => { confirmReady.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
    expect(startup.saveCalls).toBeGreaterThan(savesBeforePost);
    expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).toBeNull();
  });

  it("fails closed on a projection mismatch and offers retry without rebuilding", async () => {
    startup.inspections.push(Promise.resolve({
      ok: false,
      issue: "projection-mismatch",
      message: "The cached snapshot and accepted journal do not agree.",
      entryCount: 2,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await settleUi();

    expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull();
    expect(container.textContent).toContain("Books need attention");
    expect(button("Retry validation")).not.toBeNull();
    expect(startup.ingestCalls).toBe(0);
    expect(startup.reconcileCalls).toBe(0);
    openExpenseSlideshow();
    expect(walkExpenseToConfirm(container).disabled).toBe(true);
  });

  it("repairs only a missing schema and opens after the repaired projection validates", async () => {
    startup.inspections.push(
      Promise.resolve({ ok: false, issue: "missing-schema", message: "Schema missing.", entryCount: 0 }),
      Promise.resolve({ ok: true, message: "PGlite agrees.", entryCount: 0 }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await act(async () => { await Promise.resolve(); });

    expect(startup.ingestCalls).toBe(1);
    expect(startup.inspectCalls).toBe(2);
    expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull();
  });
});
