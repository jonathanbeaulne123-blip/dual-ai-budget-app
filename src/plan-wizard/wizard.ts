import {
  currentPlanVersion, formatCad, isValidDateKey, monthKeyFromDateKey, savePlanDraft, shapePlanDrafts,
  type DateKey, type Household, type LedgerView, type MonthKey, type PlanDraft, type PlanLens, type PlanLine, type PlanLineKind,
} from "../core/index.ts";
import { FUND_LABELS, FUND_MEANINGS_V2, proposedDefaultFund, umbrellaForName, type FundId, type UmbrellaId } from "../core/fundRules.ts";

/**
 * The Kitchen wizard — "One pull raises it" (K1's chosen prototype), as the
 * Plan Studio's front door.
 *
 * A plan is a recipe card and a card is always the same five lines:
 * **What · How much · By when · From which pot · Who**. Hercules asks one
 * question at a time across the table; each answer lays exactly one line on
 * the card and fits exactly one cut-paper rank to the linkage. At the end one
 * pull raises all five ranks together — and the pull is a *view*, not a write.
 *
 * Nothing in this file writes. It shapes the answers into the input the app's
 * own `savePlanDraft` takes, and says which of the app's own second commands
 * (`lockPersonalPlan` or `proposeHouseholdPlan`) pins the card to the wall.
 * There is no second plan schema and no new persisted id here.
 */

export const WIZARD_LINE_KEYS = ["what", "much", "when", "pot", "who"] as const;
export type WizardLineKey = (typeof WIZARD_LINE_KEYS)[number];

export type WhoChoice = "mine" | "both";

export type WizardAnswers = {
  what?: { text: string };
  /** The jar's fill *is* this number. `cents` is the money; `text` is the card's words. */
  much?: { text: string; cents: number };
  /** `date: null` is the uncut calendar leaf — "not fixed yet", said out loud. */
  when?: { text: string; date: DateKey | null };
  pot?: { text: string; fund: FundId; suggested: boolean };
  who?: { text: string; choice: WhoChoice };
};

export type WizardState = {
  /** Which question is on the table: 0–4, or 5 once all five ranks are fitted. */
  index: number;
  answers: WizardAnswers;
};

export type WizardStep = {
  key: WizardLineKey;
  /** The card's own word for this line. Never renamed. */
  label: string;
  ask: string;
  why: string;
  /** What Hercules does with his paw when the slip comes across the table. */
  slip: string;
};

export const WIZARD_STEPS: readonly WizardStep[] = [
  { key: "what", label: "What", ask: "What are we making room for?",
    why: "Give it the name you’d actually say out loud at the table.", slip: "He slides three across" },
  { key: "much", label: "How much", ask: "How much do you think it takes?",
    why: "The jar is the rank that carries the money. Every coin is $50 and it holds $2,000 — past that they sit on the lid.", slip: "Fill the jar" },
  { key: "when", label: "By when", ask: "By when?",
    why: "A date makes it a plan. If there isn’t one, the leaf stays uncut and the card says so.", slip: "Tear off a day" },
  { key: "pot", label: "From which pot", ask: "Which pot does this come out of?",
    why: "Money that has to leave is Prepare. Money we want to leave is Build. Protect is the buffer, and nothing lands there by default.", slip: "Pick one up" },
  { key: "who", label: "Who", ask: "Who is sitting at this one?",
    why: "A shared card waits on the table until the other of you sits. “Not now” is a real answer.", slip: "Pull out a chair" },
];

export const WIZARD_LINE_LABELS: Readonly<Record<WizardLineKey, string>> =
  Object.fromEntries(WIZARD_STEPS.map((step) => [step.key, step.label])) as Record<WizardLineKey, string>;

// ---------------------------------------------------------------------------
// The state machine. One answer lays one line; nothing else moves.

export function emptyWizardState(): WizardState {
  return { index: 0, answers: {} };
}

export function currentStep(state: WizardState): WizardStep | null {
  return WIZARD_STEPS[state.index] ?? null;
}

/** How many lines are written on the card right now. */
export function laidLines(state: WizardState): WizardLineKey[] {
  return WIZARD_LINE_KEYS.filter((key) => state.answers[key] !== undefined);
}

export function wizardComplete(state: WizardState): boolean {
  return laidLines(state).length === WIZARD_LINE_KEYS.length;
}

/**
 * Lay one line. The key must be the question on the table, so a stale slip can
 * never write a second line or overwrite one behind it.
 */
export function layLine<K extends WizardLineKey>(state: WizardState, key: K, value: NonNullable<WizardAnswers[K]>): WizardState {
  const step = currentStep(state);
  if (!step || step.key !== key) return state;
  return { index: Math.min(state.index + 1, WIZARD_STEPS.length), answers: { ...state.answers, [key]: value } };
}

/** Back one question. The answer behind stays written until it is answered again. */
export function stepBack(state: WizardState): WizardState {
  if (state.index === 0) return state;
  return { index: state.index - 1, answers: state.answers };
}

/** Start the card again: a fresh card laid flat, the linkage empty. */
export function freshCard(): WizardState {
  return emptyWizardState();
}

// ---------------------------------------------------------------------------
// The jar. Height carries the magnitude, and the capacity is drawn.

export const COIN_CENTS = 5_000;
export const JAR_CAPACITY_CENTS = 200_000;

export type JarReading = { coins: number; inJarCents: number; spilledCents: number; lidCoins: number; over: boolean };

/** The coins the jar holds, and the ones that will not fit and sit on the lid. */
export function jarReading(cents: number): JarReading {
  const amount = Math.max(0, Math.round(cents));
  const inJarCents = Math.min(amount, JAR_CAPACITY_CENTS);
  const spilledCents = Math.max(0, amount - JAR_CAPACITY_CENTS);
  return {
    coins: Math.round(inJarCents / COIN_CENTS),
    inJarCents,
    spilledCents,
    lidCoins: Math.min(Math.round(spilledCents / COIN_CENTS), 8),
    over: spilledCents > 0,
  };
}

export function jarWords(cents: number): string {
  const jar = jarReading(cents);
  return jar.over ? `${formatCad(jar.spilledCents)} will not fit. It sits on the lid.` : "";
}

// ---------------------------------------------------------------------------
// Line 4 speaks the live money model.

export type PotChoice = { fund: FundId; name: string; meaning: string; note: string };

/**
 * The four pots in the order the house says them: Everyday, Prepare, Protect,
 * Build. Protect is offered and can be chosen — it is simply never *proposed*.
 */
export const POT_CHOICES: readonly PotChoice[] = [
  { fund: "everyday", name: FUND_LABELS.everyday, meaning: FUND_MEANINGS_V2.everyday, note: "day to day" },
  { fund: "prepare", name: FUND_LABELS.prepare, meaning: FUND_MEANINGS_V2.prepare, note: "has to leave" },
  { fund: "protect", name: FUND_LABELS.protect, meaning: FUND_MEANINGS_V2.protect, note: "chosen, never assumed" },
  { fund: "build", name: FUND_LABELS.build, meaning: FUND_MEANINGS_V2.build, note: "we want it to leave" },
];

export type PotSuggestion = { fund: FundId; umbrella: UmbrellaId; why: string };

/**
 * The pot this card's words suggest, read through the app's own rules:
 * `umbrellaForName` finds the umbrella, `proposedDefaultFund` proposes the
 * fund. Nothing defaults to Protect (Jonathan, 2026-09-16) — and if a rule
 * ever returned it, this refuses the suggestion rather than pre-selecting it.
 * Income and moving money have no pot, so they get no suggestion either.
 */
export function suggestPot(what: string): PotSuggestion | null {
  const name = what.trim();
  if (!name) return null;
  const umbrella = umbrellaForName(name, "expense");
  if (!umbrella) return null;
  const fund = proposedDefaultFund(name, umbrella);
  if (!fund || fund === "protect") return null;
  return { fund, umbrella, why: `${name} reads as ${umbrella.replace(/-/g, " ")}, so the house suggests ${FUND_LABELS[fund]}.` };
}

/**
 * The one place Protect is ever named first: words that describe the cushion
 * itself. `fundRules` files "Emergency fund" under Everyday on purpose and says
 * the UI should point at Protect instead — so this points, and never picks.
 */
const BUFFER_WORDS = /emergency|buffer|cushion|rainy day|safety net|back ?up fund/i;
export function protectHint(what: string): string | null {
  return BUFFER_WORDS.test(what.trim())
    ? "Those words sound like the cushion itself. If that is what this is, Protect is its pot \u2014 but the house never puts anything there for you. Choose it yourself."
    : null;
}

// ---------------------------------------------------------------------------
// The card, as one of the app's own Plan lines.

const KIND_FOR_LENS: Readonly<Record<PlanLens, PlanLineKind>> = {
  protect: "obligation",
  prepare: "true-expense",
  build: "goal-contribution",
  everyday: "everyday-pool",
};

export type WizardIdentity = { memberId: string; view: LedgerView; today: DateKey };

export function wizardMonth(today: DateKey): MonthKey {
  return monthKeyFromDateKey(today);
}

/** A card with a fixed day is one-time; an open one repeats each month. */
export function wizardCadence(answers: WizardAnswers): PlanLine["cadence"] {
  return answers.when?.date ? "one-time" : "monthly";
}

/**
 * The five answers as one Plan line — the app's own shape, nothing added.
 * `lineId` is passed in so the caller owns identity (the app uses
 * `crypto.randomUUID()` for a new Plan line, as `PlanLensWorkbench` does).
 */
export function wizardCardLine(answers: WizardAnswers, identity: WizardIdentity, lineId: string): PlanLine {
  const what = answers.what?.text.trim() ?? "";
  const cents = answers.much?.cents ?? 0;
  const date = answers.when?.date ?? null;
  const lens: PlanLens = answers.pot?.fund ?? "everyday";
  const who = answers.who?.choice ?? "mine";
  return {
    id: lineId,
    lens,
    kind: KIND_FOR_LENS[lens],
    labelSnapshot: what,
    amountCents: cents,
    cadence: wizardCadence(answers),
    ...(date && isValidDateKey(date) ? { dueDate: date } : {}),
    responsibility: who === "both" ? { kind: "joint" } : { kind: "member", memberId: identity.memberId },
    assumptionIds: [],
    createdBy: identity.memberId,
    decision: { targetCents: cents, ...(date && isValidDateKey(date) ? { deadline: date } : {}) },
  };
}

export type WizardBase = {
  /** The private draft this card joins, when one is already open for the month. */
  draft: PlanDraft | null;
  /** The lines already on the month's card, before this one. */
  lines: PlanLine[];
  /** The version the draft answers to, when the draft is being started from one. */
  baseVersionId: string | null;
  /** How the base was found, for copy that never overstates it. */
  from: "draft" | "version" | "nothing";
};

/**
 * What this card joins. A private draft already open for the month is the
 * base; otherwise the month's visible version is taken over exactly as the
 * studio's own "Prepare a counterproposal privately" does, re-stamping
 * `createdBy` because `savePlanDraft` only accepts lines the actor wrote.
 */
export function wizardBase(household: Household, identity: WizardIdentity): WizardBase {
  const month = wizardMonth(identity.today);
  const draft = shapePlanDrafts(household.planDrafts, identity.memberId)
    .find((row) => row.scope === identity.view && row.targetMonth === month) ?? null;
  if (draft) return { draft, lines: draft.lines, baseVersionId: draft.baseVersionId ?? null, from: "draft" };
  const version = currentPlanVersion(household, identity.view, month, identity.memberId);
  if (version) return { draft: null, lines: version.lines.map((line) => ({ ...line, createdBy: identity.memberId })), baseVersionId: version.id, from: "version" };
  return { draft: null, lines: [], baseVersionId: null, from: "nothing" };
}

export type WizardDraftInput = Parameters<typeof savePlanDraft>[1];

/**
 * The one write the pull leads to: the app's own `savePlanDraft`, with this
 * card appended to whatever the month already holds. Private to the actor —
 * it shares nothing and moves no money.
 */
export function wizardDraftInput(household: Household, identity: WizardIdentity, answers: WizardAnswers, lineId: string): WizardDraftInput {
  const base = wizardBase(household, identity);
  const line = wizardCardLine(answers, identity, lineId);
  return {
    ...(base.draft ? { id: base.draft.id, expectedUpdatedAt: base.draft.updatedAt } : {}),
    ...(base.baseVersionId ? { baseVersionId: base.baseVersionId } : {}),
    memberId: identity.memberId,
    createdBy: identity.memberId,
    scope: identity.view,
    targetMonth: wizardMonth(identity.today),
    lines: [...base.lines, line],
    assumptions: base.draft?.assumptions ?? [],
    note: base.draft?.note ?? "",
  };
}

/** Which of the app's own second commands pins the card to the wall. */
export type PinKind = "propose" | "lock";
export function pinKindFor(view: LedgerView): PinKind {
  return view === "household" ? "propose" : "lock";
}

/** The reason line the pin command records. Never a claim about money. */
export function pinReason(answers: WizardAnswers, view: LedgerView): string {
  const what = answers.what?.text.trim() || "A card from the kitchen table";
  return view === "household" ? `${what} — written at the kitchen table` : `${what} — my card from the kitchen table`;
}

/** The card's five lines as words, for the reading copy and the wall. */
export function cardReading(answers: WizardAnswers): { key: WizardLineKey; label: string; value: string }[] {
  return WIZARD_STEPS.map((step) => ({ key: step.key, label: step.label, value: answers[step.key]?.text ?? "" }));
}

/** Leaving the card unfinished. It goes in the drawer, never the bin. */
export type Abandoned = { to: "drawer"; kept: WizardAnswers; words: string };
export function abandonCard(state: WizardState): Abandoned {
  return {
    to: "drawer",
    kept: state.answers,
    words: "The drawer, not the bin. Every rank stays fitted, and it stands straight back up when the tab is pulled again.",
  };
}
