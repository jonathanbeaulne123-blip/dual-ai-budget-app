// @vitest-environment jsdom
import { createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AddSlideshow, type AddFlowMode, type AddFormFields, type AddSubmitPayload } from "../src/AddSlideshow.tsx";
import {
  addConfirmName,
  addPostedStatus,
  addSlideCopy,
  addSlidesFor,
  billConfirmLabel,
  billSlipName,
  billSlipsFor,
  civilDateWords,
  defaultAddLedger,
  duplicateMatchWords,
  duplicatePromptName,
  potWord,
} from "../src/addSlideshow.ts";
import { addRecurrence, catalogHousehold, JOINT, NeedsConfirmationError, type Household, type LedgerView, type Visibility } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Fictional household, fictional bills.
const base = catalogHousehold("development");
const withHydro = addRecurrence(base, { cadence: "monthly", nextDate: "2026-09-01", type: "expense", amount: "142.00", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Hydro" }).household;
const withPhone = addRecurrence(withHydro, { cadence: "monthly", nextDate: "2026-09-27", type: "expense", amount: "65.00", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-PHONE", note: "Phone" }).household;
const household: Household = addRecurrence(withPhone, { cadence: "monthly", nextDate: "2026-09-02", type: "income", amount: "900.00", accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", note: "Pay" }).household;
const today = "2026-09-08";

function form(overrides: Partial<AddFormFields> = {}): AddFormFields {
  return {
    date: today, amount: "12.40", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", note: "", place: "", who: JOINT,
    fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-VISA", memberId: "MEM-001", sales: "0", cashTips: "0", ccTips: "0", hours: "",
    customersServed: "40", staffingCount: "4", eventTag: "regular", visibility: "household" as Visibility, occurredAt: "",
    useHouseholdFund: false, fundedAmount: "", fundDestinationAccountId: "ACC-VISA", ...overrides,
  };
}

describe("the Add flow's Tool Atlas words (pure)", () => {
  it("defaults the ledger per D1: Shift is always Mine, the rest follow the space", () => {
    expect(defaultAddLedger("shift", "household")).toBe("personal");
    expect(defaultAddLedger("shift", "personal")).toBe("personal");
    for (const mode of ["expense", "income", "bill", "transfer"] as const) {
      expect(defaultAddLedger(mode, "household")).toBe("household");
      expect(defaultAddLedger(mode, "personal")).toBe("personal");
    }
  });

  it("gives Bill paid two slides and its own words, and leaves the four entry flows unchanged", () => {
    expect(addSlidesFor({ mode: "bill" })).toEqual(["bill-pick", "bill-confirm"]);
    expect(addSlidesFor({ mode: "expense" })).toEqual(["amount", "category", "account", "note", "confirm"]);
    expect(addSlideCopy("bill", "bill-pick").title).toBe("Which bill was paid?");
    expect(addSlideCopy("bill", "bill-confirm").hint).toContain("named Confirm");
  });

  it("says dates, pots and the named Confirm in words", () => {
    expect(civilDateWords("2026-01-01")).toBe("Thu 1 Jan");
    expect(civilDateWords("2026-09-27")).toBe("Sun 27 Sep");
    expect(potWord("prepare")).toBe("Prepare");
    expect(potWord("everyday")).toBe("Everyday");
    expect(potWord(null)).toBeNull();
    const slip = { name: "Hydro", amountCents: 14200, pot: "Prepare" as const, accountName: "Chequing", date: "2026-09-01", due: true };
    expect(billConfirmLabel(slip)).toBe("Record Hydro, $142.00, paid from Prepare");
    expect(billConfirmLabel({ ...slip, pot: null })).toBe("Record Hydro, $142.00, paid from Chequing");
    expect(billConfirmLabel({ ...slip, pot: "Everyday" })).toBe("Record Hydro, $142.00, paid from Chequing");
    expect(billSlipName(slip)).toBe("Hydro, $142.00, due Tue 1 Sep, from Prepare");
  });

  it("names the confirm button with its visible label first, then amount and destination", () => {
    const accounts = household.accounts;
    const visa = accounts.find((account) => account.id === "ACC-VISA")!.name;
    const chequing = accounts.find((account) => account.id === "ACC-CHEQUING")!.name;
    const purchase = addConfirmName({ mode: "expense", postLabel: "Post $12.40", form: form(), household, accounts });
    expect(purchase).toBe("Post $12.40 purchase to Everyday");
    expect(addConfirmName({ mode: "expense", postLabel: "Post", form: form(), household, accounts, ledger: "household" })).toBe("Post $12.40 purchase to Everyday, in Ours");
    expect(addConfirmName({ mode: "income", postLabel: "Post $900.00", form: form({ amount: "900", accountId: "ACC-CHEQUING" }), household, accounts })).toBe(`Post $900.00 income to ${chequing}`);
    expect(addConfirmName({ mode: "transfer", postLabel: "Move $20.00", form: form({ amount: "20" }), household, accounts })).toBe(`Move $20.00 from ${chequing} to ${visa}`);
    expect(addConfirmName({ mode: "shift", postLabel: "Post shift", form: form({ accountId: "ACC-CHEQUING" }), household, accounts, ledger: "personal" })).toBe(`Post shift to ${chequing}, in Mine`);
    expect(addPostedStatus({ mode: "expense", form: form(), household, accounts })).toBe("Posted $12.40 purchase to Everyday");
    expect(addPostedStatus({ mode: "transfer", form: form({ amount: "20" }), household, accounts })).toBe(`Moved $20.00 from ${chequing} to ${visa}`);
  });

  it("names the duplicate prompt and lists the matched fields in words", () => {
    expect(duplicatePromptName("expense")).toBe("This looks like a purchase you already recorded");
    expect(duplicatePromptName("income")).toBe("This looks like income you already recorded");
    expect(duplicatePromptName("shift", "sameShiftDay")).toBe("This looks like a shift you already recorded");
    const words = duplicateMatchWords(form({ note: "Groceries" }), { amountCents: 1240, date: today, accountId: "ACC-VISA", note: "Groceries", place: "" }, household.accounts);
    expect(words).toContain("same amount, $12.40");
    expect(words).toContain("same account,");
    expect(words).toContain("same day, Tue 8 Sep");
    expect(words).toContain("same words, “Groceries”");
    expect(duplicateMatchWords(form(), { amountCents: 999, date: "2026-09-07", accountId: "ACC-CHEQUING", note: "", place: "" }, household.accounts)).toMatch(/^amount \$9\.99 · account .* · recorded, Mon 7 Sep$/);
  });

  it("offers due bills (not income), soonest first, with their pot and exact review", () => {
    const slips = billSlipsFor(household, { today, memberId: "MEM-001", view: "household" });
    expect(slips.due.map((slip) => slip.name)).toEqual(["Hydro"]);
    expect(slips.due[0]).toMatchObject({ amountCents: 14200, date: "2026-09-01", pot: "Prepare", due: true });
    expect(slips.due[0]!.review.kind).toBe("ready");
    expect(slips.upcoming.map((slip) => slip.name)).toEqual(["Phone"]);
    expect(slips.upcoming[0]!.due).toBe(false);
  });
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

function Harness(props: {
  mode: AddFlowMode;
  view?: LedgerView;
  slide?: number;
  posts: (AddSubmitPayload | undefined)[];
  ledgers?: LedgerView[];
  duplicate?: boolean;
  edits?: string[];
  billRecurrenceId?: string | null;
  error?: string;
  amount?: string;
}) {
  const [draft, setDraft] = useState<AddFormFields>(() => form(props.amount !== undefined ? { amount: props.amount } : {}));
  const [slideIndex, setSlideIndex] = useState(props.slide ?? 0);
  const categories = household.categories.filter((category) => category.recordType === "category" && category.active && category.transactionType === (props.mode === "income" ? "income" : "expense"));
  return createElement(AddSlideshow, {
    sheetRef: { current: null }, mode: props.mode, view: props.view, memberId: "MEM-001", billRecurrenceId: props.billRecurrenceId,
    onLedgerChange: (ledger) => props.ledgers?.push(ledger),
    recommendationHousehold: household, initialAccountId: "ACC-VISA", onSwitchMode: () => undefined,
    form: draft, setForm: setDraft, household, booksHousehold: household,
    pickerAccounts: household.accounts.filter((account) => account.active), categories, today,
    slideIndex, onSlideIndex: setSlideIndex, shiftGate: "choose", hasWorkJobs: false,
    shiftPreview: { netTipsCents: 0, wagesCents: 0 }, onHoursDirty: () => undefined, hoursDirty: false,
    onClockIn: () => undefined, onAlreadyOff: () => undefined, onSignOut: () => undefined, onNeverMind: () => undefined,
    busy: false, error: props.error ?? "", onDismissError: () => undefined, onGoMore: () => undefined,
    confirm: props.duplicate ? new NeedsConfirmationError("duplicate", "Similar to Groceries on Sep 8.", [{ ...household.transactions[0]!, id: "TX-DUP", amountCents: 1240, accountId: "ACC-VISA", date: today, note: "Groceries", place: "" }]) : null,
    confirmPanelRef: { current: null },
    onConfirmAnyway: () => props.edits?.push("anyway"),
    onEditDuplicate: () => props.edits?.push("dont"),
    postLabel: "Post $12.40", onPost: (payload) => props.posts.push(payload), onClose: () => undefined,
    persistCategory: () => undefined, presetId: null, onPresetId: () => undefined, onSavePreset: () => undefined, onForgetPreset: () => undefined,
    categoryTouched: false, onCategoryTouched: () => undefined, codingHint: "", onCodingHint: () => undefined,
    splitPercents: { "MEM-001": 50, "MEM-002": 50 }, onMemberPercent: () => undefined, addDetails: false, onAddDetails: () => undefined,
    placePrefs: { displayTimeZone: "America/Toronto", locationAllowed: false, addPromptSeen: true, stampTime: true, stampCoords: true, shareCoordsWithModel: false, updatedAt: "2026-09-01T00:00:00.000Z" },
    onPlacePrefs: () => undefined, environment: "development", showLocationPrompt: false, onShowLocationPrompt: () => undefined,
    locationBusy: false, applyConfiguredStamps: () => undefined, clearLocationStamp: () => undefined, displayZone: "America/Toronto", experienceLine: "",
  });
}

const buttonNamed = (name: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => (button.getAttribute("aria-label") ?? button.textContent?.trim()) === name);

describe("the Add flow's Tool Atlas parts (UI)", () => {
  it("names the ledger on the first slide and lets it be changed", () => {
    const posts: (AddSubmitPayload | undefined)[] = [];
    const ledgers: LedgerView[] = [];
    act(() => root.render(createElement(Harness, { mode: "expense", view: "household", posts, ledgers })));
    const line = host.querySelector("[data-add-ledger]")!;
    expect(line.querySelector("legend")?.textContent).toBe("Whose money");
    expect(line.querySelector(".add-ledger__into")?.textContent).toBe("Into: Ours");
    const radios = [...line.querySelectorAll<HTMLInputElement>("input[type=radio]")];
    expect(radios.map((radio) => radio.closest("label")!.textContent)).toEqual(["Ours", "Mine"]);
    expect(radios[0]!.checked).toBe(true);
    act(() => radios[1]!.click());
    expect(ledgers).toEqual(["personal"]);
    expect(host.querySelector("[data-add-ledger]")?.getAttribute("data-add-ledger")).toBe("personal");
  });

  it("defaults Shift to Mine even in Ours, and shows no ledger line without a view", () => {
    act(() => root.render(createElement(Harness, { mode: "shift", view: "household", posts: [] })));
    expect(host.querySelector(".add-ledger__into")?.textContent).toBe("Into: Mine");
    act(() => root.render(createElement(Harness, { mode: "expense", posts: [] })));
    expect(host.querySelector("[data-add-ledger]")).toBeNull();
  });

  it("reads the confirm slide back as text and names the button with amount and destination", () => {
    const posts: (AddSubmitPayload | undefined)[] = [];
    act(() => root.render(createElement(Harness, { mode: "expense", view: "household", slide: 4, posts })));
    const summary = host.querySelector("[aria-label='Confirm summary']")!;
    const rows = [...summary.querySelectorAll(".row")].map((row) => row.textContent);
    expect(rows).toEqual(expect.arrayContaining(["Amount$12.40", "Date" + civilDateWords(today), "IntoOurs"]));
    expect(rows.some((row) => row?.startsWith("Category"))).toBe(true);
    expect(rows.some((row) => row?.startsWith("Account"))).toBe(true);
    const post = host.querySelector<HTMLButtonElement>("[data-add-confirm]")!;
    expect(post.textContent).toBe("Post $12.40");
    expect(post.getAttribute("aria-label")).toBe("Post $12.40 purchase to Everyday, in Ours");
    act(() => post.click());
    expect(posts).toEqual([{ kind: "entry", mode: "expense", ledger: "household" }]);
  });

  it("puts the duplicate prompt in an alertdialog, focuses Don't record it, and Escape does not record", () => {
    const edits: string[] = [];
    act(() => root.render(createElement(Harness, { mode: "expense", view: "household", slide: 4, posts: [], duplicate: true, edits })));
    const dialog = host.querySelector<HTMLElement>("[role=alertdialog]")!;
    expect(dialog).toBeTruthy();
    const name = document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent;
    expect(name).toBe("This looks like a purchase you already recorded");
    expect(dialog.textContent).toContain("same amount, $12.40");
    expect(document.activeElement?.textContent).toBe("Don’t record it");
    // The App focuses the panel itself; the panel hands focus to the safe choice.
    act(() => dialog.focus());
    expect(document.activeElement?.textContent).toBe("Don’t record it");
    act(() => { document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(edits).toEqual(["dont"]);
    act(() => buttonNamed("Record it anyway")!.click());
    expect(edits).toEqual(["dont", "anyway"]);
  });

  it("Bill paid: slips, one pick, then its named Confirm hands the reviewed occurrence to the App", () => {
    const posts: (AddSubmitPayload | undefined)[] = [];
    act(() => root.render(createElement(Harness, { mode: "bill", view: "household", posts })));
    expect(host.querySelector(".add-slideshow-mode")?.textContent).toBe("Bill paid");
    expect(host.querySelector("[data-add-confirm]")).toBeNull();
    expect(host.querySelector(".add-slideshow-switch")).toBeNull();
    const slip = host.querySelector<HTMLButtonElement>("[data-bill-slip]")!;
    expect(slip.getAttribute("aria-label")).toBe("Hydro, $142.00, due Tue 1 Sep, from Prepare");
    expect(host.textContent).toContain("Not due yet");
    expect(host.querySelectorAll("[data-bill-slip]").length).toBe(1);
    act(() => slip.click());
    const confirm = host.querySelector("[data-bill-confirm]")!;
    expect(confirm.textContent).toContain("Hydro");
    expect(confirm.textContent).toContain("$142.00");
    expect(confirm.textContent).toContain("Tue 1 Sep");
    const named = host.querySelector<HTMLButtonElement>("[data-add-confirm-bill]")!;
    expect(named.textContent).toBe("Record Hydro, $142.00, paid from Prepare");
    expect(posts).toEqual([]);
    act(() => named.click());
    expect(posts).toHaveLength(1);
    const payload = posts[0]!;
    expect(payload.kind).toBe("bill");
    if (payload.kind !== "bill") return;
    expect(payload.ledger).toBe("household");
    expect(payload.recurrenceId).toBe(payload.review.request.recurrenceId);
    expect(payload.occurrenceDate).toBe("2026-09-01");
    expect(payload.review.request).toMatchObject({ memberId: "MEM-001", view: "household", today });
  });

  it("Mark paid: a named due bill opens straight at its named Confirm; a bill not due yet stays on the slips", () => {
    const posts: (AddSubmitPayload | undefined)[] = [];
    const due = billSlipsFor(household, { today, memberId: "MEM-001", view: "household" });
    act(() => root.render(createElement(Harness, { mode: "bill", view: "household", posts, billRecurrenceId: due.due[0]!.recurrenceId })));
    expect(host.querySelector("[data-bill-slip]")).toBeNull();
    const named = host.querySelector<HTMLButtonElement>("[data-add-confirm-bill]")!;
    expect(named.textContent).toBe("Record Hydro, $142.00, paid from Prepare");
    expect(posts).toEqual([]);
    act(() => { root.unmount(); root = createRoot(host); });
    act(() => root.render(createElement(Harness, { mode: "bill", view: "household", posts, billRecurrenceId: due.upcoming[0]!.recurrenceId })));
    expect(host.querySelector("[data-add-confirm-bill]")).toBeNull();
    expect(host.querySelectorAll("[data-bill-slip]").length).toBe(1);
  });

  it("A30: a failed post raises an alert, keeps the draft, and Retry runs the same named Confirm", () => {
    const posts: (AddSubmitPayload | undefined)[] = [];
    act(() => root.render(createElement(Harness, { mode: "expense", view: "household", slide: 4, posts })));
    act(() => host.querySelector<HTMLButtonElement>("[data-add-confirm]")!.click());
    expect(posts).toHaveLength(1);
    act(() => root.render(createElement(Harness, { mode: "expense", view: "household", slide: 4, posts, error: "The network did not answer." })));
    const alert = host.querySelector<HTMLElement>("[role=alert]")!;
    expect(alert).toBeTruthy();
    expect(alert.getAttribute("aria-live")).toBeNull();
    const retry = [...alert.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Retry")!;
    expect(host.querySelector<HTMLButtonElement>("[data-add-confirm]")!.getAttribute("aria-label")).toBe("Post $12.40 purchase to Everyday, in Ours");
    act(() => retry.click());
    expect(posts).toEqual([{ kind: "entry", mode: "expense", ledger: "household" }, { kind: "entry", mode: "expense", ledger: "household" }]);
  });

  it("A30: an error before any post stays a polite status with no Retry", () => {
    act(() => root.render(createElement(Harness, { mode: "expense", view: "household", slide: 4, posts: [], error: "Choose a household first." })));
    expect(host.querySelector("[role=alert]")).toBeNull();
    expect(host.querySelector("[data-notice-retry-button]")).toBeNull();
  });

  it("A30: an amount that is not above zero is marked invalid, linked to its message, and takes focus", async () => {
    act(() => root.render(createElement(Harness, { mode: "expense", view: "household", slide: 0, posts: [], amount: "" })));
    const enter = host.querySelector<HTMLButtonElement>(".cad-pad-enter")!;
    expect(enter.getAttribute("aria-disabled")).toBe("true");
    expect(enter.disabled).toBe(false);
    act(() => enter.click());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
    const typing = host.querySelector(".cad-pad")!.classList.contains("is-typing");
    const field = typing ? host.querySelector<HTMLElement>(".cad-pad-input")! : host.querySelector<HTMLElement>(".cad-pad-display")!;
    if (typing) expect(field.getAttribute("aria-invalid")).toBe("true");
    const message = document.getElementById(field.getAttribute("aria-describedby")!.split(" ").pop()!)!;
    expect(message.textContent).toBe("Enter an amount above $0.00.");
    expect(document.activeElement).toBe(field);
  });
});
