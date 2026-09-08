// @vitest-environment jsdom
// Mounted App entry lifecycle: navigation, draft dismissal, and acceptance.
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../src/core/index.ts";

const writes = vi.hoisted(() => ({ candidates: [] as Household[], stored: null as Household | null,
  sync: false, queue: false, confirmations: [] as Array<{ id: string; household: Household }>,
  release: null as null | (() => void),
}));

vi.mock("../src/ledgerSync/presence.ts", () => ({ attachLedgerPresence: () => () => {} }));
vi.mock("../src/ledgerSync/client.ts", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/ledgerSync/client.ts")>();
  return { ...actual, LedgerSyncClient: class {
    options: import("../src/ledgerSync/client.ts").ClientOptions;
    constructor(options: import("../src/ledgerSync/client.ts").ClientOptions) {
      this.options = options;
      if (!writes.sync) return new actual.LedgerSyncClient(options);
    }
    async start() { await this.options.adopt(writes.stored!); this.options.status("ready"); }
    async confirm(household: Household, id: string, onQueued?: () => void): Promise<import("../src/core/types.ts").CommitResult> {
      const previous = writes.stored!;
      writes.confirmations.push({ id, household });
      if (writes.queue) {
        const barrier = new Promise<void>(resolve => { writes.release = resolve; });
        onQueued?.();
        await barrier;
      }
      const postedIds = household.transactions.filter(tx => !previous.transactions.some(old => old.id === tx.id)).map(tx => tx.id);
      const result = { household, warnings: [], postedIds,
        undo: { id, label: "Post entry", snapshot: previous, postedIds, commandKind: "postEntry", actorMemberId: "MEM-002" } };
      writes.stored = household;
      await this.options.adopt(household);
      return result;
    }
    result(_id: string): import("../src/core/types.ts").CommitResult | undefined { return undefined; }
    async destroy() {}
  } };
});

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
    createElement("button", { onClick: () => onGo("ledger") }, "Open books"),
    createElement("button", { onClick: () => onOpenFundDestination("ask") }, "Open Ask")),
  DeferredBooksPage: ({ onAddToAccount, onFocusAccount }: { onAddToAccount: (account: Household["accounts"][number] | null) => void; onFocusAccount: (id: string) => void }) => createElement("div", null,
    createElement("button", { onClick: () => onAddToAccount(null) }, "Open entry"),
    createElement("button", { onClick: () => onFocusAccount("ACC-VISA") }, "Focus Visa"),
    createElement("button", { onClick: () => onAddToAccount(writes.stored!.accounts.find(account => account.id === "ACC-VISA")!) }, "Open Visa entry")),
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
import { financialAuditHash } from "../src/core/index.ts";
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
  writes.sync = false; writes.queue = false; writes.confirmations = []; writes.release = null;
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
  await waitFor(() => expect(container.querySelector('[data-books-readiness="ready"]')).not.toBeNull());
}
function input(selector: string, value: string) {
  const field = container.querySelector<HTMLInputElement>(selector)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("five boards entry App integration", () => {
  it.each(["Close", "Escape"])("mobile %s and same-kind Add reopen preserve the actual draft without acceptance or hosted writes", async dismissal => {
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
    act(() => {
      if (dismissal === "Escape") sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      else [...sheet.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Close')!.click();
    });
    expect(sheet.hidden).toBe(true);
    await act(async () => button("Open entry").click());
    expect(container.querySelector('[data-add-slideshow]')).toBe(sheet);
    expect(sheet.hidden).toBe(false);
    expect(container.querySelector<HTMLInputElement>('#add-note')!.value).toBe('Keep the entire grocery draft');
    expect(container.querySelector<HTMLInputElement>('[data-entry-section="amount"] input')!.value).toBe('18.75');
    expect(container.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe(originalDate);
    expect(writes.candidates.length).toBe(writesBefore);
  }, 30000);

  it.each([false, true])("accepted ordinary Add is cleared before same-kind reopen (queued=%s)", async queued => {
    mobile = true; writes.sync = true; writes.queue = queued;
    writes.stored = { ...writes.stored!, linked: true };
    writes.stored.booksAcceptedHash = await financialAuditHash(writes.stored);
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1"); vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "1");
    await mount();
    const openFullForm = async () => {
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add money"]')!.click());
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add expense"]')!.click());
      const more = () => [...container.querySelectorAll<HTMLButtonElement>('[data-add-slideshow] button')].find(button => button.textContent === "More")!;
      await waitFor(() => expect(more().disabled).toBe(false));
      act(() => more().click());
    };
    for (let entry = 0; entry < 2; entry++) {
      await openFullForm();
      expect(container.querySelector<HTMLInputElement>('#add-note')!.value).toBe("");
      expect(container.querySelector<HTMLInputElement>('[data-entry-section="amount"] input')!.value).toBe("");
      const amount = entry === 0 ? '18.75' : '29.36';
      const note = `Acceptance lifecycle ${entry}`;
      input('#add-note', note); input('[data-entry-section="amount"] input', amount);
      expect(container.querySelector<HTMLButtonElement>('[data-add-confirm]')!.disabled).toBe(true);
      act(() => [...container.querySelectorAll<HTMLButtonElement>('[data-entry-section="account"] .wallet-tile')].find(tile => tile.textContent?.includes("Visa"))!.click());
      await act(async () => container.querySelector<HTMLButtonElement>('[data-add-confirm]')!.click());
      await waitFor(() => expect(writes.confirmations).toHaveLength(entry + 1));
      if (queued) {
        expect(container.querySelector('[data-add-slideshow]')).toBeNull();
        expect(container.querySelector('[data-ledger-tab="ledger"]')).not.toBeNull();
        await act(async () => { writes.release!(); await Promise.resolve(); });
      }
      await waitFor(() => expect(container.querySelector('[data-add-slideshow]')).toBeNull());
      expect(writes.confirmations[entry]!.household.transactions.filter(tx => tx.note === note)).toHaveLength(1);
    }
    expect(writes.confirmations[0]!.id).not.toBe(writes.confirmations[1]!.id);
    await openFullForm();
    expect(container.querySelector<HTMLInputElement>('#add-note')!.value).toBe("");
    expect(container.querySelector<HTMLInputElement>('[data-entry-section="amount"] input')!.value).toBe("");
    expect(writes.confirmations).toHaveLength(2);
  }, 30000);

  it("distinguishes an account-scoped launch from an inherited focused account", async () => {
    mobile = true; await mount();
    await act(async () => button("Open books").click());
    const ordinary = [...container.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === "Open ordinary Books");
    if (ordinary) await act(async () => ordinary.click());
    await waitFor(() => expect(container.textContent).toContain("Focus Visa"));
    await act(async () => button("Focus Visa").click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add money"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add expense"]')!.click());
    const more = () => [...container.querySelectorAll<HTMLButtonElement>('[data-add-slideshow] button')].find(item => item.textContent === "More")!;
    act(() => more().click());
    input('[data-entry-section="amount"] input', '12.50');
    expect(container.querySelector<HTMLButtonElement>('[data-add-confirm]')!.disabled).toBe(true);
    const sheet = container.querySelector<HTMLElement>('[data-add-slideshow]')!;
    act(() => [...sheet.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === "Close")!.click());
    await act(async () => button("Open Visa entry").click());
    expect(container.querySelector('[data-add-slideshow]')).toBe(sheet);
    expect(container.querySelector<HTMLButtonElement>('[data-add-confirm]')!.disabled).toBe(false);
    expect(container.querySelector('[data-entry-section="account"] [aria-pressed="true"]')?.textContent).toContain("Visa");
  }, 30000);

  it("Ask opens Home and requests the existing chalkboard without a ledger save", async () => {
    mobile = true; await mount();
    const intents: unknown[] = [];
    const unsubscribe = subscribeOfficeIntent(intent => intents.push(intent));
    const writesBefore = writes.candidates.length;
    try {
      await act(async () => button("Open Ask").click());
      expect(container.querySelector('[data-ledger-tab="home"]')).not.toBeNull();
      expect(container.querySelector("[data-add-slideshow]")).toBeNull();
      expect(intents).toContainEqual({ type: "expand", id: "chalkboard" });
      expect(writes.candidates.length).toBe(writesBefore);
    } finally { unsubscribe(); }
  }, 30000);

  it.each([true, false])("Plan uses hero, Categories, sit-down and Kitty Banks DOM order (mobile=%s)", async phone => {
    mobile = phone; await mount();
    await act(async () => button("Open plan").click());
    expect(container.querySelector("[data-add-slideshow]")).toBeNull();
    const plan = container.querySelector('.five-boards-plan')!;
    expect(plan).not.toBeNull();
    expect(plan.children).toHaveLength(4);
    expect(plan.children[0]!.classList.contains('hero')).toBe(true);
    expect(plan.children[1]!.querySelector('h2')!.textContent).toBe('Categories');
    expect(plan.children[2]!.classList.contains('sit-guide')).toBe(true);
    expect(plan.children[3]!.classList.contains('kitty-banks')).toBe(true);
  }, 30000);
});
