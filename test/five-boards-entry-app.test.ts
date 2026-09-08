// @vitest-environment jsdom
// Real mounted entry-path regression: welcome -> create -> invitation.
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../src/core/index.ts";

const writes = vi.hoisted(() => ({ candidates: [] as Household[], stored: null as Household | null }));

vi.mock("../src/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/storage.ts")>();
  return {
    ...actual,
    peekHousehold: vi.fn(() => writes.stored),
    loadHousehold: vi.fn(async () => writes.stored),
    listHouseholdReplicas: vi.fn(async () => []),
    loadPersonalReplica: vi.fn(async () => null),
    saveHousehold: vi.fn(async (household: Household) => {
      writes.candidates.push(household);
    }),
  };
});

vi.mock("../src/ledger/engine.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledger/engine.ts")>();
  return {
    ...actual,
    inspectBrowserBooks: vi.fn(async (household: Household) => ({
      ok: true,
      message: "PGlite agrees.",
      entryCount: household.transactions.length,
    })),
    ingestHouseholdBooks: vi.fn(async (household: Household) => ({
      compiled: {} as never,
      status: {
        ok: true,
        engine: "pglite" as const,
        entryCount: household.transactions.length,
        inBalance: true,
        equationHolds: true,
      },
    })),
    validateHouseholdBooksStaged: vi.fn(async (household: Household) => ({
      ok: true,
      engine: "pglite" as const,
      entryCount: household.transactions.length,
      inBalance: true,
      equationHolds: true,
    })),
  };
});

vi.mock("../src/continuity.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/continuity.ts")>();
  return {
    ...actual,
    discoverContinuityMemberships: vi.fn(async () => []),
    hostedContinuityAllowed: vi.fn(() => false),
  };
});

vi.mock("../src/deferredSurfaces.tsx", () => ({
  DeferredSurface: ({ children }: { children: ReactNode }) => children,
  DeferredOffice: ({ onGo, onOpenFundDestination }: { onGo: (tab: string) => void; onOpenFundDestination: (destination: string) => void }) => createElement("div", null,
    createElement("button", { onClick: () => onGo("add") }, "Open entry"),
    createElement("button", { onClick: () => onGo("plan") }, "Open plan"),
    createElement("button", { onClick: () => onOpenFundDestination("ask") }, "Open Ask")),
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

vi.mock("../src/HerculesPro.tsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/HerculesPro.tsx")>();
  return {
    ...actual,
    HerculesProApproval: () => null,
    HerculesProPermissionsCard: () => null,
  };
});

import { App } from "../src/App.tsx";
import { subscribeOfficeIntent } from "../src/core/officeLayout.ts";
import { completedExistingBooksHousehold } from "./fixtures/existing-books-onboarding.ts";


(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function waitFor(assertion: () => void, timeout = 5_000): Promise<void> {
  const deadline = Date.now() + timeout;
  let lastError: unknown = new Error("UI condition was not met.");
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (caught) {
      lastError = caught;
    }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); });
  }
  throw lastError;
}

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!match) throw new Error(`Missing button ${label}`);
  return match as HTMLButtonElement;
}


let root: Root;
let container: HTMLDivElement;
let mobile = true;
beforeEach(() => {
  writes.stored = completedExistingBooksHousehold(); writes.candidates = [];
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("hearth:session:v1:development", JSON.stringify({ memberId: "MEM-002", view: "household", householdId: writes.stored.householdId }));
  vi.stubEnv("VITE_LEDGER_SYNC_V2", "0");
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({
    matches: mobile && query.includes("max-width"), addEventListener() {}, removeEventListener() {},
  }) });
  class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function mount() {
  await act(async () => root.render(createElement(App)));
  await waitFor(() => expect(container.textContent).toContain("Open entry"), 15000);
}
function input(selector: string, value: string) {
  const field = container.querySelector<HTMLInputElement>(selector)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("five boards entry App integration", () => {
  it("mobile close and same-kind Add reopen preserve the actual draft without acceptance or hosted writes", async () => {
    mobile = true; await mount();
    await act(async () => button("Open entry").click());
    const more = () => [...container.querySelectorAll<HTMLButtonElement>('[data-add-slideshow] button')].find(button => button.textContent === "More")!;
    await waitFor(() => expect(more().disabled).toBe(false));
    act(() => more().click());
    expect(container.querySelector("[data-add-slide]")?.getAttribute("data-add-slide")).toBe("full-form");
    input('#add-note', 'Keep the entire grocery draft');
    input('[data-entry-section="amount"] input', '18.75');
    const date = container.querySelector<HTMLInputElement>('[data-entry-section="confirm"] input[type="date"]')!;
    const originalDate = date.value;
    const sheet = container.querySelector<HTMLElement>('[data-add-slideshow]')!;
    const writesBefore = writes.candidates.length;
    act(() => [...sheet.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Close')!.click());
    expect(sheet.hidden).toBe(true);
    await act(async () => button("Open entry").click());
    expect(container.querySelector('[data-add-slideshow]')).toBe(sheet);
    expect(sheet.hidden).toBe(false);
    expect(container.querySelector<HTMLInputElement>('#add-note')!.value).toBe('Keep the entire grocery draft');
    expect(container.querySelector<HTMLInputElement>('[data-entry-section="amount"] input')!.value).toBe('18.75');
    expect(container.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe(originalDate);
    expect(writes.candidates.length).toBe(writesBefore);
  }, 30000);

  it("Ask opens Home and requests the existing chalkboard without a ledger save", async () => {
    mobile = true; await mount();
    const intents: unknown[] = [];
    const unsubscribe = subscribeOfficeIntent(intent => intents.push(intent));
    const writesBefore = writes.candidates.length;
    try {
      await act(async () => button("Open Ask").click());
      expect(container.querySelector('[data-ledger-tab="home"]')).not.toBeNull();
      expect(intents).toContainEqual({ type: "expand", id: "chalkboard" });
      expect(writes.candidates.length).toBe(writesBefore);
    } finally { unsubscribe(); }
  }, 30000);

  it.each([true, false])("Plan uses hero, Categories, sit-down and Kitty Banks DOM order (mobile=%s)", async phone => {
    mobile = phone; await mount();
    await act(async () => button("Open plan").click());
    const plan = container.querySelector('.five-boards-plan')!;
    expect(plan).not.toBeNull();
    expect(plan.children).toHaveLength(4);
    expect(plan.children[0]!.classList.contains('hero')).toBe(true);
    expect(plan.children[1]!.querySelector('h2')!.textContent).toBe('Categories');
    expect(plan.children[2]!.classList.contains('sit-guide')).toBe(true);
    expect(plan.children[3]!.classList.contains('kitty-banks')).toBe(true);
  }, 30000);
});
