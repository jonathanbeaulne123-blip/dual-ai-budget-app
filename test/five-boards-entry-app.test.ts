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
vi.mock("../src/prepareQuickSample.ts", async () => {
  const { addQuickSampleScenario } = await import("../src/core/quickSampleData.ts");
  return { prepareQuickSample: async (h: Household, input: Parameters<typeof addQuickSampleScenario>[1]) => addQuickSampleScenario(h, input) };
});

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
  it.each([false, true])("retains a two-category slider draft and confirms both amounts together (expanded=%s)", async expanded => {
    mobile=true; writes.sync=true; writes.stored={...writes.stored!,linked:true};
    writes.stored.booksAcceptedHash=await financialAuditHash(writes.stored);
    vi.stubEnv("VITE_LEDGER_SYNC_V2","1");vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH","1");
    await mount();
    const nav=container.querySelector('[data-ledger-nav="shared"]')!;
    expect([...nav.children].map(el=>el.classList.contains('fab-dial')?'Add':el.textContent)).toEqual(['Home','The Fund','Add','Our Path','Together']);
    await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="What can we do?"]')!.click());
    await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Add expense"]')!.click());
    await waitFor(()=>expect(button('More').disabled).toBe(false));
    if(expanded)act(()=>button('More').click());
    input('[data-entry-section="amount"] input','130.01');
    if(expanded)input('#add-note','Category slider fixture');
    else act(()=>container.querySelector<HTMLButtonElement>('.cad-pad-enter')!.click());
    act(()=>button('Split between two categories').click());
    const select=(label:string,value:string)=>act(()=>{const el=container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));});
    select('First category','SUB-FOOD-GROCERIES');select('Second category','SUB-FOOD-COFFEE');
    const slider=container.querySelector<HTMLElement>('.category-split-editor [role="slider"]')!;
    act(()=>slider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
    expect(slider.getAttribute('aria-valuenow')).toBe('51');
    const reviewed=container.querySelector(expanded?'[aria-label="Category amounts"]':'.category-split-editor')!;
    expect(reviewed.textContent).toContain('$66.31');expect(reviewed.textContent).toContain('$63.70');
    expect(writes.confirmations).toHaveLength(0);
    act(()=>[...container.querySelectorAll<HTMLButtonElement>('[data-add-slideshow] button')].find(b=>b.textContent==='Close')!.click());
    await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="What can we do?"]')!.click());
    await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Add expense"]')!.click());
    expect(container.querySelector('.category-split-editor [role="slider"]')?.getAttribute('aria-valuenow')).toBe('51');
    if(!expanded){
      expect(button('Continue to account').disabled).toBe(false);
      act(()=>button('Continue to account').click());
      expect(container.querySelector('[data-add-slide="account"]')).not.toBeNull();
    }
    act(()=>[...container.querySelectorAll<HTMLButtonElement>('[data-entry-section="account"] button')].find(tile=>tile.textContent?.includes('Visa'))!.click());
    if(!expanded){input('#add-note','Category slider fixture');act(()=>container.querySelector<HTMLButtonElement>('[data-entry-section="note"] .primary')!.click());}
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-add-confirm]')!.click());
    await waitFor(()=>expect(writes.confirmations).toHaveLength(1));
    const rows=writes.confirmations[0]!.household.transactions.filter(t=>t.note.startsWith('Category slider fixture'));
    expect(rows.map(t=>t.amountCents)).toEqual([6631,6370]);expect(rows.map(t=>t.subcategoryId)).toEqual(['SUB-FOOD-GROCERIES','SUB-FOOD-COFFEE']);
  },30000);

  it("reviews, cancels and confirms quick samples in the current household", async () => {
    mobile = false;
    writes.stored!.kitchen.books.closedMonths = [];
    const originalId = writes.stored!.householdId;
    const originalCount = writes.stored!.transactions.length;
    await mount();
    expect(button("The Fund")).toBeDefined();
    expect(button("Our Path")).toBeDefined();
    act(() => button("Together").click());
    await waitFor(() => expect(container.querySelector('.household-together')).not.toBeNull());
    expect(container.textContent).toContain("Small actions behind our agreed Plan");
    act(() => button("Status Centre").click());
    await waitFor(() => expect(container.textContent).toContain("Investor preview"));
    act(() => button("Quick sample data").click());
    await waitFor(() => expect(document.body.textContent).toContain("future Calendar expenses"));
    expect(document.body.textContent).toContain("Steady twice-monthly take-home pay");
    expect(writes.candidates.every(h => h.transactions.length === originalCount)).toBe(true);
    act(() => button("Cancel").click());
    expect(writes.candidates.every(h => h.transactions.length === originalCount)).toBe(true);
    act(() => button("Quick sample data").click());
    act(() => button("Confirm sample data").click());
    await waitFor(() => expect(writes.candidates.some(h => h.transactions.length > originalCount)).toBe(true), 15000);
    const added = writes.candidates.find(h => h.transactions.length > originalCount)!;
    expect(added.householdId).toBe(originalId);
    expect(added.transactions.filter(t => t.note.startsWith("Fictional sample")).length).toBeLessThanOrEqual(48);
    expect(added.potentialExpenses?.filter(p => p.title.startsWith("Fictional sample plan")).length).toBeGreaterThanOrEqual(40);
  });
  it.each(["expense", "income", "transfer", "shift"])("returns real App %s FAB entry focus to the + across Close and resume", async mode => {
    mobile = true; await mount();
    const fab = container.querySelector<HTMLButtonElement>('[aria-label="What can we do?"]')!;
    const writesBefore = writes.candidates.length;
    for (const dismissal of ["Close", "Escape"]) {
      await act(async () => { fab.focus(); fab.click(); });
      const action = container.querySelector<HTMLButtonElement>(`[data-fab-action="${mode}"]`)!;
      await act(async () => { action.focus(); action.click(); });
      await waitFor(() => expect(document.activeElement?.id).toBe("add-sheet-title"));
      const sheet = container.querySelector<HTMLElement>(`[data-add-slideshow="${mode}"]`)!;
      expect(action.closest("[hidden]")).not.toBeNull();
      await act(async () => {
        if (dismissal === "Escape") sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        else [...sheet.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === "Close")!.click();
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      });
      expect(sheet.hidden).toBe(true);
      expect(document.activeElement).toBe(fab);
      expect(fab.getAttribute("aria-label")).toBe("What can we do?");
    }
    expect(writes.candidates.length).toBe(writesBefore);
  }, 30000);

  it("keeps a connected account launcher as the actual Add return target", async () => {
    mobile = true; await mount();
    await act(async () => button("Open books").click());
    const ordinary = [...container.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === "Open ordinary Books");
    if (ordinary) await act(async () => ordinary.click());
    await waitFor(() => expect(container.textContent).toContain("Open Visa entry"));
    const opener = button("Open Visa entry");
    await act(async () => { opener.focus(); opener.click(); });
    await waitFor(() => expect(document.activeElement?.id).toBe("add-sheet-title"));
    await act(async () => {
      const sheet = container.querySelector('[data-add-slideshow]')!;
      [...sheet.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === "Close")!.click();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    });
    expect(document.activeElement).toBe(opener);
  }, 30000);

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
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="What can we do?"]')!.click());
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
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="What can we do?"]')!.click());
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

  it("Ask opens Together on the Shift Ask board without a ledger save", async () => {
    mobile = true; await mount();
    const writesBefore = writes.candidates.length;
    await act(async () => button("Open Ask").click());
    expect(container.querySelector('[data-ledger-tab="together"]')).not.toBeNull();
    expect(container.querySelector("[data-add-slideshow]")).toBeNull();
    expect(container.querySelector<HTMLDivElement>('.shared-board-page--ask')?.hidden).toBe(false);
    expect(container.querySelector('.shared-boards [role="tab"][aria-selected="true"]')?.textContent).toBe("Shift Ask");
    expect(writes.candidates.length).toBe(writesBefore);
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
    expect(plan.children[3]!.querySelector('h2')?.textContent).toBe('Kitty Banks');
    expect(plan.children[3]!.querySelector('button')?.textContent).toBe('Enter Kitty Banks');
  }, 30000);
});
