import { parsePadDecimal } from "./core/cadPad.ts";
import { ceremonyFields, ceremonyCopy, type ShiftGate } from "./core/shiftClock.ts";
import type { Account, Category, Household, LedgerView, Transaction, Visibility } from "./core/types.ts";
import { formatCad } from "./core/money.ts";
import { parseAmount } from "./core/catalog.ts";
import { categoryDefaultFund } from "./core/fundRules.ts";
import { dueOccurrenceReview, type DueOccurrenceRequest, type DueOccurrenceReview } from "./core/dueOccurrenceReview.ts";

export const ADD_MODES = ["expense", "income", "shift", "transfer"] as const;
/** The four entry flows the App's Add state holds. */
export type AddMode = (typeof ADD_MODES)[number];
/**
 * Every flow the slideshow can show: the four entries plus Bill paid (Tool
 * Atlas §3.3). "bill" lists the next due bills as slips; picking one leads to
 * its named Confirm, which posts through the existing `postOneRecurrence`.
 */
export type AddFlowMode = AddMode | "bill";

export type AddFormFields = {
  date: string;
  amount: string;
  accountId: string;
  subcategoryId: string;
  categorySplitEnabled?: boolean;
  secondSubcategoryId?: string;
  categoryFirstPercent?: string;
  note: string;
  place: string;
  who: string;
  fromAccountId: string;
  toAccountId: string;
  memberId: string;
  sales: string;
  cashTips: string;
  ccTips: string;
  hours: string;
  customersServed: string;
  staffingCount: string;
  eventTag: string;
  visibility: Visibility;
  occurredAt: string;
  useHouseholdFund: boolean;
  fundedAmount: string;
  fundDestinationAccountId: string;
};

export type AddSlideId =
  | "amount"
  | "category"
  | "account"
  | "from"
  | "to"
  | "note"
  | "confirm"
  | "shift-choose"
  | "shift-clocked"
  | "shift-jobs"
  | "shift-hours"
  | "shift-sales"
  | "shift-cashTips"
  | "shift-ccTips"
  | "bill-pick"
  | "bill-confirm";

export type AddSlideCopy = {
  title: string;
  hint: string;
  enterLabel: string;
};

const SHIFT_FIELD_SLIDES = ["shift-hours", "shift-sales", "shift-cashTips", "shift-ccTips"] as const;
type ShiftFieldSlide = (typeof SHIFT_FIELD_SLIDES)[number];

export function addSlidesFor(input: {
  mode: AddFlowMode;
  shiftGate?: ShiftGate;
  hasWorkJobs?: boolean;
}): AddSlideId[] {
  if (input.mode === "expense" || input.mode === "income") {
    return ["amount", "category", "account", "note", "confirm"];
  }
  if (input.mode === "transfer") {
    return ["amount", "from", "to", "note", "confirm"];
  }
  if (input.mode === "bill") return ["bill-pick", "bill-confirm"];
  const gate = input.shiftGate ?? "choose";
  if (gate === "choose") return ["shift-choose"];
  if (gate === "clocked") return ["shift-clocked"];
  if (input.hasWorkJobs) return ["shift-jobs"];
  const fields = ceremonyFields(gate);
  const ceremony: AddSlideId[] = fields.map((field) => `shift-${field}` as ShiftFieldSlide);
  return [...ceremony, "account", "note", "confirm"];
}

export function addSlideCopy(mode: AddFlowMode, slide: AddSlideId, shiftGate: ShiftGate = "choose"): AddSlideCopy {
  if (slide === "bill-pick") {
    return { title: "Which bill was paid?", hint: "Pick one. Nothing is recorded until its named Confirm.", enterLabel: "Continue" };
  }
  if (slide === "bill-confirm") {
    return { title: "Record this bill as paid?", hint: "Read it once. Its named Confirm records it and moves the reminder to the next date.", enterLabel: "Record" };
  }
  if (slide === "amount") {
    if (mode === "income") {
      return { title: "How much came in?", hint: "Type the CAD, then Enter. Confirm still posts.", enterLabel: "Enter" };
    }
    if (mode === "transfer") {
      return { title: "How much are you moving?", hint: "Not income. Not spend. Enter, then pick the two rooms.", enterLabel: "Enter" };
    }
    return { title: "How much did you spend?", hint: "Enter an amount. Enter opens the next prompt. Confirm still posts.", enterLabel: "Enter" };
  }
  if (slide === "category") {
    if (mode === "income") {
      return { title: "What kind of income?", hint: "Wages, tips, or a new income category. Tap one to continue.", enterLabel: "Continue" };
    }
    return { title: "In which category?", hint: "Tap a category to continue. More shows all categories and lets you add one.", enterLabel: "Continue" };
  }
  if (slide === "account") {
    if (mode === "income") {
      return { title: "Which account received it?", hint: "Paper rooms, same as Books. Tap the tile that took the money.", enterLabel: "Continue" };
    }
    if (mode === "shift") {
      return { title: "Which account should hold this?", hint: "Tips and wages land here when Confirm posts.", enterLabel: "Continue" };
    }
    return { title: "Which account paid?", hint: "Paper rooms, same as Books. Tap the card or cash that paid.", enterLabel: "Continue" };
  }
  if (slide === "from") {
    return { title: "From which account?", hint: "The room money leaves. Not income. Not spend.", enterLabel: "Continue" };
  }
  if (slide === "to") {
    return { title: "To which account?", hint: "The room money arrives. Pick a different room than From.", enterLabel: "Continue" };
  }
  if (slide === "note") {
    if (mode === "transfer") {
      return { title: "Want a note?", hint: "Optional. Skip is fine. Pictures stay on this phone.", enterLabel: "Continue" };
    }
    if (mode === "shift") {
      return { title: "Add a picture or a note?", hint: "Optional. A tip-sheet photo still drafts — it never posts.", enterLabel: "Continue" };
    }
    return { title: "Add a picture or a note?", hint: "Optional. Pictures stay on this phone. Confirm posts the CAD and note.", enterLabel: "Continue" };
  }
  if (slide === "confirm") {
    if (mode === "income") {
      return { title: "Post this income?", hint: "Read it once. Confirm writes. Back changes a prompt.", enterLabel: "Post income" };
    }
    if (mode === "transfer") {
      return { title: "Move this money?", hint: "Not income. Not spend. Confirm writes the paired movement.", enterLabel: "Move money" };
    }
    if (mode === "shift") {
      return { title: "Post this shift?", hint: "Same math that posts. Confirm writes wages and tips.", enterLabel: "Post shift" };
    }
    return { title: "Post this expense?", hint: "Who, date, and Fund stay here. Confirm writes.", enterLabel: "Post" };
  }
  if (slide === "shift-choose") {
    const copy = ceremonyCopy("choose");
    return { title: "Who is working?", hint: copy.hint, enterLabel: "Clock in" };
  }
  if (slide === "shift-clocked") {
    const copy = ceremonyCopy("clocked");
    return { title: copy.title, hint: copy.hint, enterLabel: "Sign out" };
  }
  if (slide === "shift-jobs") {
    return { title: "Finish this shift", hint: "Jobs Confirm still posts. The slideshow never writes money.", enterLabel: "Next" };
  }
  const field = slide.replace("shift-", "") as "hours" | "sales" | "cashTips" | "ccTips";
  const copy = ceremonyCopy(shiftGate, field);
  if (field === "hours") {
    return { title: "How many hours?", hint: copy.hint, enterLabel: "Enter" };
  }
  if (field === "sales") {
    return { title: "How much in sales?", hint: copy.hint, enterLabel: "Enter" };
  }
  if (field === "cashTips") {
    return { title: "How much cash tips?", hint: copy.hint, enterLabel: "Enter" };
  }
  return { title: "How much card tips?", hint: copy.hint, enterLabel: "Enter" };
}

export function addSlideNeedsAmount(slide: AddSlideId): boolean {
  return slide === "amount" || slide === "shift-hours" || slide === "shift-sales" || slide === "shift-cashTips" || slide === "shift-ccTips";
}

export function canAdvanceAddSlide(slide: AddSlideId, form: {
  amount: string;
  subcategoryId: string;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
  hours: string;
  sales: string;
  cashTips: string;
  ccTips: string;
}): boolean {
  if (slide === "amount") return !parsePadDecimal(form.amount).error && Number(parsePadDecimal(form.amount).digits) > 0;
  if (slide === "category") return Boolean(form.subcategoryId);
  if (slide === "account") return Boolean(form.accountId);
  if (slide === "from") return Boolean(form.fromAccountId);
  if (slide === "to") return Boolean(form.toAccountId) && form.toAccountId !== form.fromAccountId;
  if (slide === "shift-hours") return !parsePadDecimal(form.hours, 2400).error && Number(parsePadDecimal(form.hours, 2400).digits) > 0;
  if (slide === "shift-sales") return !!form.sales.trim() && !parsePadDecimal(form.sales).error;
  if (slide === "shift-cashTips" || slide === "shift-ccTips") { const value = slide === "shift-cashTips" ? form.cashTips : form.ccTips; return !!value.trim() && !parsePadDecimal(value).error; }
  return true;
}

export function clampAddSlide(index: number, slides: readonly AddSlideId[]): number {
  if (slides.length === 0) return 0;
  return Math.max(0, Math.min(index, slides.length - 1));
}

export function defaultSubcategoryForMode(mode: AddFlowMode): string {
  if (mode === "income") return "SUB-INCOME-WAGES";
  return "SUB-FOOD-GROCERIES";
}

// ---------------------------------------------------------------------------
// The ledger line (Tool Atlas §3.3, decision D1).

/** On screen the spaces are Ours and Mine (§9, the orchestrator's call; the house stays "Our home"). */
export const ADD_LEDGER_WORDS: Readonly<Record<LedgerView, "Ours" | "Mine">> = { household: "Ours", personal: "Mine" };

/**
 * D1 (Jonathan, 2026-09-25): Purchase, Income, Bill paid and Move money
 * default to the space the card shows; Shift always defaults to Mine. The
 * first slide names the ledger and lets it be changed, so the space pill never
 * decides where money goes on its own.
 */
export function defaultAddLedger(mode: AddFlowMode, view: LedgerView): LedgerView {
  return mode === "shift" ? "personal" : view;
}

/**
 * What the slideshow hands the App when its named Confirm is pressed. The App
 * posts through the commands it already calls; nothing here writes.
 * - `entry`: the ordinary Final Confirm (`submit()` → postEntry / postTransfer / postShift).
 * - `bill`: one due bill (`postOneRecurrence` with the reviewed request).
 * `ledger` is the ledger the person chose on the first slide. If it differs
 * from the App's current view, the App must not post into the current view.
 */
export type AddSubmitPayload =
  | { kind: "entry"; mode: AddMode; ledger: LedgerView }
  | {
      kind: "bill";
      mode: "bill";
      ledger: LedgerView;
      recurrenceId: string;
      occurrenceDate: string;
      /** The exact review the person read; pass `review.request` as `postOneRecurrence`'s `dueReview`. */
      review: Extract<DueOccurrenceReview, { kind: "ready" }>;
    };

// ---------------------------------------------------------------------------
// Words for the confirm step, the status line and the duplicate prompt (§3.3, A7, A24, A30).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "2026-09-27" → "Sat 27 Sep". A civil date: no time zone arithmetic. */
export function civilDateWords(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [, y, m, d] = match;
  const day = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
  return `${WEEKDAYS[day]} ${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** Prepare · Protect · Build are "pots"; Everyday is the everyday money. */
export function potWord(fund: string | null | undefined): "Prepare" | "Protect" | "Build" | "Everyday" | null {
  if (fund === "prepare") return "Prepare";
  if (fund === "protect") return "Protect";
  if (fund === "build") return "Build";
  if (fund === "everyday") return "Everyday";
  return null;
}

const MODE_NOUN: Record<AddFlowMode, string> = { expense: "purchase", income: "income", shift: "shift", transfer: "move", bill: "bill" };

type ConfirmInput = {
  mode: AddMode;
  postLabel: string;
  form: Pick<AddFormFields, "amount" | "accountId" | "fromAccountId" | "toAccountId" | "subcategoryId">;
  household: Pick<Household, "categories">;
  accounts: readonly Pick<Account, "id" | "name">[];
  ledger?: LedgerView;
};

function confirmParts({ mode, form, household, accounts, ledger }: ConfirmInput): { money: string; tail: string } {
  const name = (id: string) => accounts.find((account) => account.id === id)?.name || "an account";
  let money = "";
  if (mode !== "shift") { try { money = formatCad(parseAmount(form.amount)); } catch { money = ""; } }
  const where = ledger ? `, in ${ADD_LEDGER_WORDS[ledger]}` : "";
  if (mode === "transfer") return { money, tail: `from ${name(form.fromAccountId)} to ${name(form.toAccountId)}${where}` };
  if (mode === "expense") return { money, tail: `${MODE_NOUN.expense} to ${potWord(categoryDefaultFund(household, form.subcategoryId)) ?? name(form.accountId)}${where}` };
  if (mode === "income") return { money, tail: `${MODE_NOUN.income} to ${name(form.accountId)}${where}` };
  return { money, tail: `to ${name(form.accountId)}${where}` };
}

/**
 * The confirm button's accessible name: its visible label first (WCAG 2.5.3),
 * then the amount and where the money goes ("Post $12.40 purchase to
 * Everyday"), and the ledger when the first slide named one.
 */
export function addConfirmName(input: ConfirmInput): string {
  const { money, tail } = confirmParts(input);
  const label = money && !input.postLabel.includes(money) ? `${input.postLabel} ${money}` : input.postLabel;
  return `${label} ${tail}`;
}

/** The status line after an accepted Final Confirm ("Posted $12.40 purchase to Everyday"), for the App's `role="status"`. */
export function addPostedStatus(input: Omit<ConfirmInput, "postLabel">): string {
  const { money, tail } = confirmParts({ ...input, postLabel: "" });
  if (input.mode === "transfer") return `Moved ${money || "money"} ${tail}`;
  if (input.mode === "shift") return `Posted shift ${tail}`;
  return `Posted ${money ? `${money} ` : ""}${tail}`;
}

/** The duplicate prompt's name, per flow (§3.3: "This looks like a purchase you already recorded"). */
export function duplicatePromptName(mode: AddMode, code: string = "duplicate"): string {
  if (code === "sameShiftDay") return "This looks like a shift you already recorded";
  if (code === "settingsChanged") return "The rules changed since you read this";
  if (code === "closedMonth") return "This date is in a closed month";
  return `This looks like ${mode === "income" ? "income" : `a ${MODE_NOUN[mode]}`} you already recorded`;
}

/** The fields a possible duplicate matches, in words ("same amount, $12.40 · same account, Visa · same day, Thu 25 Sep"). */
export function duplicateMatchWords(
  form: Pick<AddFormFields, "amount" | "date" | "accountId" | "fromAccountId" | "note" | "place">,
  match: Pick<Transaction, "amountCents" | "date" | "accountId" | "note" | "place">,
  accounts: readonly Pick<Account, "id" | "name">[],
): string {
  const words: string[] = [];
  let cents: number | null = null;
  try { cents = parseAmount(form.amount); } catch { cents = null; }
  if (cents !== null && cents === match.amountCents) words.push(`same amount, ${formatCad(match.amountCents)}`);
  else words.push(`amount ${formatCad(match.amountCents)}`);
  const accountId = form.accountId || form.fromAccountId;
  const accountName = accounts.find((account) => account.id === match.accountId)?.name ?? match.accountId;
  if (accountId && accountId === match.accountId) words.push(`same account, ${accountName}`);
  else words.push(`account ${accountName}`);
  words.push(`${form.date === match.date ? "same day" : "recorded"}, ${civilDateWords(match.date)}`);
  const text = (match.place || match.note).trim();
  if (text) {
    const same = [form.place, form.note].some((value) => value.trim() && value.trim().toLowerCase() === text.toLowerCase());
    words.push(`${same ? "same words" : "words"}, “${text}”`);
  }
  return words.join(" · ");
}

// ---------------------------------------------------------------------------
// Bill paid: the next due bills as slips (§3.3).

export type AddBillSlip = {
  recurrenceId: string;
  name: string;
  amountCents: number;
  /** The occurrence date (the recurrence's next date). */
  date: string;
  /** Prepare · Protect · Build (or Everyday) — the pot the bill is paid from, when the category names one. */
  pot: ReturnType<typeof potWord>;
  accountName: string;
  categoryName: string;
  type: "expense" | "transfer";
  /** Due on or before today: only these can be recorded here. Later ones are shown, not offered. */
  due: boolean;
  request: DueOccurrenceRequest;
  review: DueOccurrenceReview;
};

/**
 * Pure: the bills to offer on the Bill paid slide. Expense and transfer
 * reminders only (income is not a bill), soonest first; every due one, then
 * up to `upcoming` that are not due yet. Each carries the same exact review
 * the Cellar's reminder sheet uses, so the named Confirm posts only what the
 * person read.
 */
export function billSlipsFor(
  household: Household,
  input: { today: string; memberId: string; view: LedgerView; upcoming?: number },
): { due: AddBillSlip[]; upcoming: AddBillSlip[] } {
  const rows = household.recurrences
    .filter((item) => item.active && (item.type === "expense" || item.type === "transfer"))
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.id.localeCompare(b.id));
  const slips = rows.map((item): AddBillSlip => {
    const category = household.categories.find((row) => row.id === item.subcategoryId);
    const account = household.accounts.find((row) => row.id === item.accountId);
    const request: DueOccurrenceRequest = {
      environment: household.environment,
      householdId: household.householdId,
      memberId: input.memberId,
      view: input.view,
      today: input.today,
      recurrenceId: item.id,
      occurrenceDate: item.nextDate,
    };
    return {
      recurrenceId: item.id,
      name: item.note.trim() || category?.name || "Repeating bill",
      amountCents: item.amountCents,
      date: item.nextDate,
      pot: item.type === "expense" ? potWord(categoryDefaultFund(household, item.subcategoryId)) : null,
      accountName: account?.name ?? "",
      categoryName: category?.name ?? (item.type === "transfer" ? "Transfer" : ""),
      type: item.type as "expense" | "transfer",
      due: item.nextDate <= input.today,
      request,
      review: dueOccurrenceReview(household, request),
    };
  });
  return { due: slips.filter((slip) => slip.due), upcoming: slips.filter((slip) => !slip.due).slice(0, input.upcoming ?? 3) };
}

/** A slip's accessible name: "Hydro, $142.00, due Sat 27 Sep, from Prepare". */
export function billSlipName(slip: Pick<AddBillSlip, "name" | "amountCents" | "date" | "pot" | "accountName" | "due">): string {
  const from = slip.pot ?? slip.accountName;
  return `${slip.name}, ${formatCad(slip.amountCents)}, ${slip.due ? "due" : "not due until"} ${civilDateWords(slip.date)}${from ? `, from ${from}` : ""}`;
}

/** The bill's named Confirm: "Record Hydro, $142.00, paid from Prepare". */
export function billConfirmLabel(slip: Pick<AddBillSlip, "name" | "amountCents" | "pot" | "accountName">): string {
  const from = slip.pot && slip.pot !== "Everyday" ? slip.pot : slip.accountName || slip.pot || "";
  return `Record ${slip.name}, ${formatCad(slip.amountCents)}${from ? `, paid from ${from}` : ""}`;
}

/** Categories are passed through for callers that already hold a filtered list. */
export type AddCategoryList = readonly Pick<Category, "id" | "name">[];
