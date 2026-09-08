// @vitest-environment jsdom
import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddSlideshow, type AddFormFields, type AddMode } from "../src/AddSlideshow.tsx";
import { catalogHousehold, todayKey, JOINT, NeedsConfirmationError, type Visibility } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const household = catalogHousehold("development");
const today = todayKey(new Date("2026-08-31T16:00:00.000Z"));

function emptyForm(): AddFormFields {
  return {
    date: today,
    amount: "",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "",
    place: "",
    who: JOINT,
    fromAccountId: "ACC-CHEQUING",
    toAccountId: "ACC-VISA",
    memberId: "MEM-002",
    sales: "0",
    cashTips: "0",
    ccTips: "0",
    hours: "",
    customersServed: "40",
    staffingCount: "4",
    eventTag: "regular",
    visibility: "household" as Visibility,
    occurredAt: "",
    useHouseholdFund: false,
    fundedAmount: "",
    fundDestinationAccountId: "ACC-VISA",
  };
}

const placePrefs = {
  displayTimeZone: "America/Toronto",
  locationAllowed: false,
  addPromptSeen: true,
  stampTime: true,
  stampCoords: true,
  shareCoordsWithModel: false,
  updatedAt: "2026-08-31T00:00:00.000Z",
};

function Harness({
  mode,
  onPost,
  splitProbe = false,
  roster = household,
  shares = { "MEM-001": 50, "MEM-002": 50 },
  scopeValid = true,
  duplicateReview = false,
  initial = {},
  gate = "choose",
  jobs = false,
  open = true,
  close = () => {},
  observe = () => {},
  scoped = household,
  busy = false,
  initialAccountId,
}: {
  mode: AddMode;
  onPost: () => void;
  splitProbe?: boolean;
  roster?: typeof household;
  shares?: Record<string, number>;
  scopeValid?: boolean;
  duplicateReview?: boolean;
  initial?: Partial<AddFormFields>;
  gate?: import("../src/core/shiftClock.ts").ShiftGate;
  jobs?: boolean;
  open?: boolean;
  close?: () => void;
  observe?: (form: AddFormFields) => void;
  scoped?: typeof household;
  busy?: boolean;
  initialAccountId?: string;
}) {
  const [form, setForm] = useState<AddFormFields>(() => splitProbe ? { ...emptyForm(), amount: "0.01", who: "split" } : { ...emptyForm(), ...initial });
  const [slideIndex, setSlideIndex] = useState(splitProbe ? 4 : 0);
  const categories = household.categories.filter((category) => (
    category.recordType === "category"
    && category.active
    && category.transactionType === (mode === "income" ? "income" : "expense")
  ));
  observe(form);
  return createElement(AddSlideshow, {
    open,
    initialAccountId,
    recommendationHousehold: scoped,
    sheetRef: { current: null },
    mode,
    onSwitchMode: () => undefined,
    form,
    setForm,
    household: roster,
    booksHousehold: roster,
    pickerAccounts: scoped.accounts.filter((account) => account.active),
    categories,
    today,
    slideIndex,
    onSlideIndex: setSlideIndex,
    shiftGate: gate,
    hasWorkJobs: jobs,
    shiftJobsPanel: createElement("input", { "aria-label": "Existing job draft", defaultValue: "original jobs sequence" }),
    shiftPreview: { netTipsCents: 4200, wagesCents: 9000 },
    onHoursDirty: () => undefined,
    hoursDirty: false,
    onClockIn: () => undefined,
    onAlreadyOff: () => undefined,
    onSignOut: () => undefined,
    onNeverMind: () => undefined,
    busy,
    error: "",
    onDismissError: () => undefined,
    onGoMore: () => undefined,
    confirm: duplicateReview ? new NeedsConfirmationError("duplicate", "Review duplicate") : null,
    confirmPanelRef: { current: null },
    onConfirmAnyway: onPost,
    postLabel: "Post $12.50",
    onPost,
    onClose: close,
    persistCategory: () => undefined,
    presetId: null,
    onPresetId: () => undefined,
    onSavePreset: () => undefined,
    onForgetPreset: () => undefined,
    categoryTouched: false,
    onCategoryTouched: () => undefined,
    codingHint: "",
    onCodingHint: () => undefined,
    splitPercents: shares,
    splitScopeValid: scopeValid,
    onMemberPercent: () => undefined,
    addDetails: false,
    onAddDetails: () => undefined,
    placePrefs,
    onPlacePrefs: () => undefined,
    environment: "development",
    showLocationPrompt: false,
    onShowLocationPrompt: () => undefined,
    locationBusy: false,
    applyConfiguredStamps: () => undefined,
    clearLocationStamp: () => undefined,
    displayZone: "America/Toronto",
    experienceLine: "",
  });
}


let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let width = 390;
const resizeListeners = new Set<() => void>();
function resize(next: number) {
  width = next;
  act(() => resizeListeners.forEach(listener => listener()));
}
function button(label: string, selector = "button") {
  const found = [...host.querySelectorAll<HTMLButtonElement>(selector)].find(button => button.textContent?.trim() === label);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}
function click(label: string, selector?: string) { act(() => button(label, selector).click()); }
function enterAmount() {
  for (const digit of ["1", "2", "5", "0"]) {
    act(() => host.querySelector<HTMLButtonElement>(`.cad-pad-keys button[aria-label="${digit}"]`)!.click());
  }
  click("Enter");
}
function edit(selector: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function slide() { return host.querySelector("[data-add-slide]")?.getAttribute("data-add-slide"); }

beforeEach(() => {
  width = 390;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({
    get matches() { return width < 720; },
    addEventListener: (_: string, listener: () => void) => resizeListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => resizeListeners.delete(listener),
  })) });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); document.documentElement.removeAttribute("data-theme"); vi.restoreAllMocks(); });

describe("mobile entry sheet", () => {
  it.each(["classic", "taylor", "newfoundland"])("%s: amount and permission-filtered choices never post before review", theme => {
    document.documentElement.dataset.theme = theme;
    const posts = vi.fn();
    const scoped = { ...household, accounts: household.accounts.filter(account => account.id === "ACC-VISA"),
      categories: household.categories.filter(category => category.id === "SUB-FOOD-GROCERIES") };
    act(() => root.render(createElement(Harness, { mode: "expense", onPost: posts, scoped })));
    enterAmount();
    expect(slide()).toBe("category");
    expect([...host.querySelectorAll(".swipe-cat")].map(button => button.textContent)).toEqual(["Groceries", "More"]);
    click("Groceries", ".swipe-cat");
    expect(slide()).toBe("account");
    expect([...host.querySelectorAll(".swipe-cat")].map(button => button.textContent)).toEqual(["Visa", "More"]);
    click("Visa", ".swipe-cat"); click("Skip");
    expect(slide()).toBe("confirm"); expect(posts).not.toHaveBeenCalled();
    expect(host.querySelector(".add-confirm-summary")?.textContent).toContain("$12.50");
    act(() => host.querySelector<HTMLButtonElement>("[data-add-confirm]")!.click());
    expect(posts).toHaveBeenCalledTimes(1);
  });

  it.each(["expense", "income"] as const)("More requires deliberate %s account intent with eight eligible accounts", mode => {
    const posts = vi.fn();
    const accounts = household.accounts.filter(account => account.active).slice(0, 8);
    while (accounts.length < 8) accounts.push({ ...accounts[0]!, id: `EXTRA-${accounts.length}`, name: `Extra account ${accounts.length}` });
    const roster = { ...household, accounts };
    act(() => root.render(createElement(Harness, { mode, onPost: posts, scoped: roster, roster,
      initial: { amount: "12.50", subcategoryId: mode === "income" ? "SUB-INCOME-WAGES" : "SUB-FOOD-GROCERIES" }, duplicateReview: true })));
    click("More");
    expect(host.querySelector<HTMLButtonElement>('[data-add-confirm]')!.disabled).toBe(true);
    expect(button("Add anyway").disabled).toBe(true);
    expect(host.querySelector('[data-entry-section="account"] [aria-pressed="true"]')).toBeNull();
    // A desktop resize cannot turn a phone draft's inherited default into intent.
    resize(1440);
    for (let index = 0; index < 4; index++) {
      const next = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => ["Enter", "Continue", "Skip"].includes(item.textContent?.trim() ?? ""));
      act(() => next!.click());
    }
    expect(host.querySelector<HTMLButtonElement>('[data-add-confirm]')!.disabled).toBe(true);
    resize(390); click("Back"); click("More");
    const visa = host.querySelector<HTMLButtonElement>('[data-entry-section="account"] .wallet-tile[aria-label="Credit card Visa"]')
      ?? [...host.querySelectorAll<HTMLButtonElement>('[data-entry-section="account"] .wallet-tile')].find(item => item.textContent?.includes("Visa"))!;
    act(() => visa.click());
    expect(host.querySelector<HTMLButtonElement>('[data-add-confirm]')!.disabled).toBe(false);
    expect(button("Add anyway").disabled).toBe(false);
    expect(posts).not.toHaveBeenCalled();
    act(() => host.querySelector<HTMLButtonElement>('[data-add-confirm]')!.click());
    expect(posts).toHaveBeenCalledOnce();
  });

  it("honours an explicitly scoped account through More, Back, close and resize", () => {
    const posts = vi.fn();
    const render = (open = true) => act(() => root.render(createElement(Harness, { mode: "expense", onPost: posts,
      initialAccountId: "ACC-VISA", initial: { amount: "12.50" }, open })));
    render(); click("More");
    expect(host.querySelector<HTMLButtonElement>('[data-add-confirm]')!.disabled).toBe(false);
    click("Back"); click("More"); render(false); render(true); resize(1440); resize(390);
    expect(host.querySelector<HTMLButtonElement>('[data-add-confirm]')!.disabled).toBe(false);
    expect(posts).not.toHaveBeenCalled();
  });

  it("income recommends only income categories and transfers require an explicit distinct destination", () => {
    const posts = vi.fn(); let draft!: AddFormFields;
    act(() => root.render(createElement(Harness, { mode: "income", onPost: posts, observe: form => { draft = form; } })));
    enterAmount();
    expect(host.querySelector('[aria-label="Suggested categories"]')?.textContent).not.toContain("Groceries");
    const category = host.querySelector<HTMLButtonElement>(".swipe-cat:not(.more)")!;
    act(() => category.click());
    expect(household.categories.find(c => c.id === draft.subcategoryId)?.transactionType).toBe("income");
    expect(posts).not.toHaveBeenCalled();
    act(() => root.render(createElement(Harness, { key: "transfer", mode: "transfer", onPost: posts, observe: form => { draft = form; } })));
    enterAmount(); expect(slide()).toBe("from");
    click(household.accounts.find(account => account.id === "ACC-CHEQUING")!.name, ".swipe-cat"); expect(slide()).toBe("to");
    expect(button(household.accounts.find(account => account.id === "ACC-CHEQUING")!.name, ".swipe-cat").disabled).toBe(true);
    click(household.accounts.find(account => account.id === "ACC-CHEQUING")!.name, ".swipe-cat"); expect(slide()).toBe("to");
    click("Visa", ".swipe-cat"); click("Skip");
    expect(draft.fromAccountId).toBe("ACC-CHEQUING"); expect(draft.toAccountId).toBe("ACC-VISA");
    expect(host.querySelector(".add-confirm-summary")?.textContent).toContain(household.accounts.find(account => account.id === "ACC-CHEQUING")!.name);
    expect(posts).not.toHaveBeenCalled();
  });

  it("More, Back, close/reopen, theme and resize retain the entire draft and photo", async () => {
    const posts = vi.fn(); let draft!: AddFormFields;
    const initial: Partial<AddFormFields> = { amount: "12.50", note: "Original note", place: "Local shop", date: "2026-08-30", who: "split",
      visibility: "personal", occurredAt: "2026-08-30T12:00:00Z", useHouseholdFund: true, fundedAmount: "7.25", fundDestinationAccountId: "ACC-CHEQUING",
      hours: "7.25", sales: "1900", cashTips: "40", ccTips: "150", customersServed: "30", staffingCount: "3", eventTag: "sports" };
    const render = (open = true) => act(() => root.render(createElement(Harness, { mode: "expense", onPost: posts, initial, open, observe: form => { draft = form; } })));
    render(); click("More"); expect(slide()).toBe("full-form");
    edit("#add-note", "Edited note");
    const file = new File(["image"], "receipt.png", { type: "image/png" });
    const upload = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(upload, "files", { value: [file] });
    await act(async () => { upload.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(host.querySelector(".add-picture-preview")?.getAttribute("alt")).toBe("receipt.png");
    const snapshot = structuredClone(draft);
    click("Back"); expect(slide()).toBe("amount"); click("More");
    render(false); expect(host.querySelector<HTMLElement>("[data-add-slideshow]")!.hidden).toBe(true);
    render(true); document.documentElement.dataset.theme = "newfoundland"; resize(1440);
    expect(slide()).toBe("amount"); expect(host.querySelector(".mobile-entry-sheet")).toBeNull();
    resize(320); expect(slide()).toBe("full-form");
    expect(draft).toEqual(snapshot);
    expect(host.querySelector<HTMLInputElement>("#add-note")!.value).toBe("Edited note");
    expect(host.querySelector(".add-picture-preview")?.getAttribute("alt")).toBe("receipt.png");
    expect(posts).not.toHaveBeenCalled();
  });

  it.each(["finished", "signOut"] as const)("preserves the %s shift order, preview and full form fields", gate => {
    const posts = vi.fn();
    act(() => root.render(createElement(Harness, { mode: "shift", onPost: posts, gate, initial: { hours: "6" } })));
    // Finished shifts enter sales first; signing out starts with the elapsed hours.
    const expected = gate === "finished" ? ["shift-sales", "shift-cashTips", "shift-ccTips", "shift-hours"] : ["shift-hours", "shift-sales", "shift-cashTips", "shift-ccTips"];
    for (const field of expected) {
      expect(slide()).toBe(field);
      if (field !== "shift-hours") { expect(host.textContent).toContain("$42.00"); expect(host.textContent).toContain("$90.00"); }
      click("Enter");
    }
    expect(slide()).toBe("account"); click("More");
    expect([...host.querySelectorAll("[data-entry-section]")].map(el => el.getAttribute("data-entry-section"))).toEqual([...expected, "account", "note", "confirm"]);
    expect(host.querySelector('input[type="number"]')).toBeTruthy();
    expect(posts).not.toHaveBeenCalled();
  });

  it("keeps the specialized jobs sequence mounted and blocks invalid full-form and duplicate posting", () => {
    const posts = vi.fn();
    act(() => root.render(createElement(Harness, { mode: "shift", onPost: posts, gate: "finished", jobs: true })));
    expect(slide()).toBe("shift-jobs"); expect(host.querySelector('[aria-label="Existing job draft"]')).toBeTruthy();
    expect(host.querySelector("[data-add-confirm]")).toBeNull();
    act(() => root.render(createElement(Harness, { key: "transfer", mode: "transfer", onPost: posts, initial: { amount: "12", fromAccountId: "ACC-VISA", toAccountId: "ACC-VISA" }, duplicateReview: true })));
    click("More");
    expect(host.querySelector<HTMLButtonElement>("[data-add-confirm]")!.disabled).toBe(true);
    expect(button("Add anyway").disabled).toBe(true);
    expect(posts).not.toHaveBeenCalled();
  });
});
