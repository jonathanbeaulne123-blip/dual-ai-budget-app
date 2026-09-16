import { addDays, monthKeyFromDateKey, monthStartKey, parseDateKey, type DateKey } from "./calendar.ts";
import { allocateHouseholdFundSurplus, declinePlanBridge, proposePlanBridge, withdrawPlanBridge } from "./commands.ts";
import { activeHouseholdFundEvents, shapeHouseholdFundConfig, shapeHouseholdFundKittyAllocations } from "./householdFund.ts";
import { advanceCadence } from "./recurrence.ts";
import type { PlanBridgeDecision } from "./planSystem.ts";
import { ValidationError, type CommitResult, type Household, type Recurrence } from "./types.ts";

/**
 * Missing and smaller subscriptions in the cellar (2026-09-16, D-279).
 *
 * Jonathan: a subscription that is charged less than usual, or is not charged
 * within the grace period after its day, stays in the cellar one more cycle
 * with a "missing" mark. Tapping it celebrates and offers to roll the
 * difference (or the whole amount, when nothing was charged) into a goal kitty
 * bank: the Fund's custodian proposes, the partner confirms.
 *
 * Pure selectors plus thin wrappers around commands that already exist — no
 * new money writer:
 *
 * - The offer and the partner's yes are **Plan Bridge** rows
 *   (`proposePlanBridge`, kind `shared-goal`): the household's existing
 *   shared "one offers, the other answers" record, with its own hold,
 *   decline and withdraw. The partner's yes is their own identical offer
 *   (the Our Path rule: proposing the same thing is agreeing).
 * - The money is the Fund's existing month-end rollover
 *   (`allocateHouseholdFundSurplus`), which only the custodian may post, only
 *   inside the safe surplus, behind the app's Confirm. Its note carries the
 *   occurrence's key, and `rollMissingSubscription` refuses a second roll for
 *   the same occurrence, so a confirmed roll-over is never counted twice.
 *
 * Only household-visible subscriptions are read (an account that is not
 * Personal — the same test `planSourceVisible` uses). A Personal subscription
 * never appears in the shared cellar and never feeds a shared goal.
 */

/** A subscription counts as missing this many days after its day (Q-7, defaulted, confirm). */
export const MISSING_GRACE_DAYS = 3;
const BRIDGE_SUFFIX = " — from the cellar";
const BRIDGE_PATTERN = /^Roll (.+) into (.+) — from the cellar$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (date: DateKey) => `${MONTHS[Number(date.slice(5, 7)) - 1] ?? ""} ${Number(date.slice(8, 10))}`;

export type MissingKind = "missing" | "smaller";
/**
 * - `open`: nothing offered yet (or an offer was set aside) — the custodian may offer.
 * - `offered`: the custodian offered; waiting on the partner.
 * - `agreed`: both said yes; the custodian may roll it, behind Confirm.
 * - `rolled`: the Fund's rollover for this occurrence is posted. Never offered again.
 */
export type MissingStage = "open" | "offered" | "agreed" | "rolled";

export type MissingOffer = {
  /** The custodian's Bridge row. */
  rowId: string;
  rowUpdatedAt: string;
  state: "proposed" | "held" | "declined";
  goalId: string | null;
  goalName: string;
  amountCents: number;
  /** The partner's identical row, when they said yes. */
  agreedRowId: string | null;
  heldByMemberId: string | null;
  declineReason: string | null;
};

export type MissingSubscription = {
  id: string;
  /** Stable per occurrence; carried in the rollover's note. */
  key: string;
  recurrenceId: string;
  label: string;
  /** The occurrence's own day. */
  date: DateKey;
  /** Where the jar stands on this month's rail: its own day, or the 1st when it was carried over. */
  railDate: DateKey;
  carried: boolean;
  kind: MissingKind;
  usualCents: number;
  /** What was charged for the occurrence; null when nothing was. */
  chargedCents: number | null;
  /** What could be rolled: the difference, or the whole usual amount. */
  differenceCents: number;
  /** The mark leaves the cellar on this day (exclusive): one more cycle after the next one comes due. */
  visibleUntil: DateKey;
  stage: MissingStage;
  offer: MissingOffer | null;
  rolledCents: number;
  rolledGoalIds: string[];
};

/** An occurrence whose mark cleared after a roll-over was posted: the roll stands, nothing is offered again. */
export type MissingSettled = { key: string; recurrenceId: string; date: DateKey; rolledCents: number; chargedCents: number | null; why: "charged" | "price-changed" | "cancelled" | "expired" };

export type MissingReading = {
  open: MissingSubscription[];
  settled: MissingSettled[];
  /** The viewer's own open cellar offers that no longer have a mark to answer (charged, changed, cancelled, expired, or rolled): withdraw them. */
  voidRowIds: string[];
  custodianMemberId: string | null;
};

export const missingKey = (recurrenceId: string, date: DateKey) => `cellar-roll:${recurrenceId}:${date}`;

/** A cadence step backwards, the mirror of `advanceCadence` (a month back keeps the day, as posting does). */
export function retreatCadence(date: DateKey, cadence: Recurrence["cadence"]): DateKey {
  if (cadence === "daily") return addDays(date, -1);
  if (cadence === "weekly") return addDays(date, -7);
  if (cadence === "biweekly") return addDays(date, -14);
  const { year, month, day } = parseDateKey(date);
  return new Date(Date.UTC(year, month - 2, day)).toISOString().slice(0, 10);
}

/** What was charged for each occurrence day, from the recorded payments and the recurrence's own posts. Reversed and duplicate rows do not count. */
export function subscriptionCharges(household: Pick<Household, "transactions">, recurrence: Recurrence): Map<DateKey, number> {
  const reversed = new Set(household.transactions.filter((tx) => tx.reversalOfId).map((tx) => tx.reversalOfId!));
  const live = (id: string) => { const tx = household.transactions.find((row) => row.id === id); return Boolean(tx && !tx.isDuplicate && !reversed.has(tx.id)); };
  const charges = new Map<DateKey, number>();
  const counted = new Set<string>();
  for (const payment of recurrence.payments ?? []) {
    if (!live(payment.transactionId)) continue;
    counted.add(payment.transactionId);
    charges.set(payment.occurrenceDate, (charges.get(payment.occurrenceDate) ?? 0) + payment.amountCents);
  }
  for (const tx of household.transactions) {
    if (tx.source !== "recurring" || tx.sourceId !== recurrence.id || tx.type !== "expense" || counted.has(tx.id) || tx.isDuplicate || reversed.has(tx.id)) continue;
    charges.set(tx.date, (charges.get(tx.date) ?? 0) + tx.amountCents);
  }
  return charges;
}

const householdVisible = (household: Pick<Household, "accounts">, recurrence: Recurrence) => {
  const account = household.accounts.find((row) => row.id === recurrence.accountId);
  return Boolean(account && account.scope !== "personal");
};

type Candidate = { recurrence: Recurrence; date: DateKey; kind: MissingKind; usualCents: number; chargedCents: number | null };

/**
 * The occurrences that are missing or came in smaller, before any offer is
 * read. `ended` collects occurrences that were once marked but no longer are,
 * so a posted roll-over for them can be reported as settled.
 */
function candidates(household: Household, today: DateKey): { live: Candidate[]; ended: Array<Omit<MissingSettled, "rolledCents" | "key">> } {
  const live: Candidate[] = [];
  const ended: Array<Omit<MissingSettled, "rolledCents" | "key">> = [];
  for (const recurrence of household.recurrences) {
    if (recurrence.type !== "expense" || recurrence.kind !== "subscription") continue;
    if (!householdVisible(household, recurrence)) continue;
    const charges = subscriptionCharges(household, recurrence);
    const chargedDates = [...charges.keys()].sort();
    const firstCharge = chargedDates[0] ?? null;
    // Occurrence days worth reading: the open day and up to three before it (still inside "one more cycle"), and every charged day.
    const days = new Set<DateKey>(chargedDates);
    let back = recurrence.nextDate;
    days.add(back);
    for (let step = 0; step < 3; step += 1) { back = retreatCadence(back, recurrence.cadence); days.add(back); }
    for (const date of [...days].sort()) {
      const visibleUntil = advanceCadence(advanceCadence(date, recurrence.cadence), recurrence.cadence);
      if (today >= visibleUntil) continue;
      const charged = charges.get(date) ?? null;
      if (!recurrence.active) {
        if (charged === null || charged < recurrence.amountCents) ended.push({ recurrenceId: recurrence.id, date, chargedCents: charged, why: "cancelled" });
        continue;
      }
      if (charged === null) {
        if (today < addDays(date, MISSING_GRACE_DAYS)) continue; // still inside the grace period
        // A day before the open one counts only when the subscription had already been charging before it (it was skipped past, not new).
        if (date < recurrence.nextDate && !(firstCharge !== null && firstCharge < date)) continue;
        if (date > recurrence.nextDate) continue;
        live.push({ recurrence, date, kind: "missing", usualCents: recurrence.amountCents, chargedCents: null });
        continue;
      }
      if (charged >= recurrence.amountCents) continue;
      // The next cycle charged the same lower amount: the price changed, it is not a windfall.
      const following = charges.get(advanceCadence(date, recurrence.cadence));
      const previous = charges.get(retreatCadence(date, recurrence.cadence));
      if (following === charged || (previous === charged && previous < recurrence.amountCents)) {
        ended.push({ recurrenceId: recurrence.id, date, chargedCents: charged, why: "price-changed" });
        continue;
      }
      live.push({ recurrence, date, kind: "smaller", usualCents: recurrence.amountCents, chargedCents: charged });
    }
    // Days that were missing and have since been charged in full.
    for (const date of chargedDates) {
      if ((charges.get(date) ?? 0) >= recurrence.amountCents && today < advanceCadence(advanceCadence(date, recurrence.cadence), recurrence.cadence)) {
        ended.push({ recurrenceId: recurrence.id, date, chargedCents: charges.get(date)!, why: "charged" });
      }
    }
  }
  return { live, ended };
}

/** What the roll is about, in the Bridge row's words: the same for both people, so identical rows mean agreement. */
export function missingWhat(entry: Pick<MissingSubscription, "label" | "date" | "kind">): string {
  return entry.kind === "missing" ? `${entry.label}'s uncharged ${shortDay(entry.date)} payment` : `${entry.label}'s ${shortDay(entry.date)} difference`;
}
export const missingBridgeLabel = (entry: Pick<MissingSubscription, "label" | "date" | "kind">, goalName: string) => `Roll ${missingWhat(entry)} into ${goalName}${BRIDGE_SUFFIX}`;

/** Every Bridge row the cellar wrote, with what it is about and the goal it names. */
export function cellarBridgeRows(household: Pick<Household, "planBridgeDecisions">): Array<{ row: PlanBridgeDecision; what: string; goalName: string }> {
  return (household.planBridgeDecisions ?? []).flatMap((row) => {
    if (row.kind !== "shared-goal" || !row.expectedDate) return [];
    const match = BRIDGE_PATTERN.exec(row.label);
    return match ? [{ row, what: match[1]!, goalName: match[2]! }] : [];
  });
}

function rolledFor(household: Household, key: string): { cents: number; goalIds: string[] } {
  const fund = shapeHouseholdFundConfig(household.householdFund);
  if (!fund) return { cents: 0, goalIds: [] };
  const events = activeHouseholdFundEvents(household, fund.id).filter((event) => event.kind === "kitty-allocated" && event.note.includes(key));
  const ids = new Set(events.map((event) => event.id));
  const goalIds = [...new Set(shapeHouseholdFundKittyAllocations(household.fundKittyAllocations).filter((row) => ids.has(row.eventId)).map((row) => row.goalId))];
  return { cents: events.reduce((sum, event) => sum + event.amountCents, 0), goalIds };
}

/**
 * The cellar's missing and smaller subscriptions for this viewer, today.
 * Nothing here writes; the UI withdraws `voidRowIds` through the existing command.
 */
export function missingSubscriptions(household: Household, input: { today: DateKey; memberId: string }): MissingReading {
  const { today, memberId } = input;
  const fund = shapeHouseholdFundConfig(household.householdFund);
  const custodian = fund?.custodianMemberId ?? null;
  const monthStart = monthStartKey(monthKeyFromDateKey(today));
  const bridge = cellarBridgeRows(household);
  const { live, ended } = candidates(household, today);
  const open: MissingSubscription[] = [];
  const answered = new Set<string>();
  for (const candidate of live) {
    const { recurrence, date } = candidate;
    const key = missingKey(recurrence.id, date);
    const differenceCents = candidate.chargedCents === null ? candidate.usualCents : candidate.usualCents - candidate.chargedCents;
    const base = { label: recurrence.note || "A subscription", date, kind: candidate.kind };
    const what = missingWhat(base);
    const rows = bridge.filter((item) => item.what === what && item.row.expectedDate === date && item.row.amountCents === differenceCents);
    for (const item of rows) answered.add(item.row.id);
    const rolled = rolledFor(household, key);
    const mine = rows.filter((item) => item.row.offeredByMemberId === custodian).sort((a, b) => b.row.updatedAt.localeCompare(a.row.updatedAt) || b.row.id.localeCompare(a.row.id));
    const current = mine.find((item) => item.row.state === "proposed" || item.row.state === "held") ?? mine.find((item) => item.row.state === "declined") ?? null;
    let offer: MissingOffer | null = null;
    if (current) {
      const agreed = current.row.state === "declined" ? null : rows.find((item) => item.row.offeredByMemberId !== custodian && item.goalName === current.goalName && (item.row.state === "proposed" || item.row.state === "held")) ?? null;
      const goal = household.goals.find((row) => row.shared && row.name === current.goalName && row.status !== "retired" && !row.envelope?.archivedAt) ?? null;
      offer = {
        rowId: current.row.id, rowUpdatedAt: current.row.updatedAt, state: current.row.state as MissingOffer["state"],
        goalId: goal?.id ?? null, goalName: current.goalName, amountCents: differenceCents,
        agreedRowId: agreed?.row.id ?? null, heldByMemberId: current.row.heldByMemberId ?? null, declineReason: current.row.declineReason ?? null,
      };
    }
    const stage: MissingStage = rolled.cents > 0 ? "rolled" : !offer || offer.state === "declined" ? "open" : offer.agreedRowId && offer.goalId ? "agreed" : "offered";
    open.push({
      id: `missing:${recurrence.id}:${date}`, key, recurrenceId: recurrence.id, ...base,
      railDate: date < monthStart ? monthStart : date, carried: date < monthStart,
      usualCents: candidate.usualCents, chargedCents: candidate.chargedCents, differenceCents,
      visibleUntil: advanceCadence(advanceCadence(date, recurrence.cadence), recurrence.cadence),
      stage, offer, rolledCents: rolled.cents, rolledGoalIds: rolled.goalIds,
    });
  }
  const settled: MissingSettled[] = [];
  const seen = new Set<string>();
  for (const row of ended) {
    const key = missingKey(row.recurrenceId, row.date);
    if (seen.has(key)) continue;
    seen.add(key);
    const rolled = rolledFor(household, key);
    if (rolled.cents > 0) settled.push({ key, ...row, rolledCents: rolled.cents });
  }
  const rolledOpen = new Set(open.filter((entry) => entry.stage === "rolled").flatMap((entry) => bridge.filter((item) => item.what === missingWhat(entry) && item.row.expectedDate === entry.date).map((item) => item.row.id)));
  const voidRowIds = bridge
    .filter(({ row }) => row.offeredByMemberId === memberId && (row.state === "proposed" || row.state === "held") && (!answered.has(row.id) || rolledOpen.has(row.id)))
    .map(({ row }) => row.id)
    .sort();
  return { open: open.sort((a, b) => a.railDate.localeCompare(b.railDate) || a.label.localeCompare(b.label) || a.date.localeCompare(b.date)), settled, voidRowIds, custodianMemberId: custodian };
}

/** Which goals a roll can land in: the shared, open goal kitty banks (the rollover's own rule). */
export function missingRollGoals(household: Pick<Household, "goals">): Array<{ id: string; name: string }> {
  return household.goals.filter((goal) => goal.shared && goal.status !== "retired" && !goal.envelope?.archivedAt).map((goal) => ({ id: goal.id, name: goal.name }));
}

function requireEntry(household: Household, input: { today: DateKey; memberId: string; entryId: string }): { reading: MissingReading; entry: MissingSubscription } {
  const reading = missingSubscriptions(household, input);
  const entry = reading.open.find((row) => row.id === input.entryId);
  if (!entry) throw new ValidationError("That subscription is no longer missing. Nothing was offered.");
  return { reading, entry };
}

/** The custodian offers to roll the difference into a goal: a shared Bridge proposal. No money moves. */
export function offerMissingRoll(household: Household, input: { today: DateKey; memberId: string; entryId: string; goalId: string }): CommitResult {
  const { reading, entry } = requireEntry(household, input);
  if (reading.custodianMemberId !== input.memberId) throw new ValidationError("Only the Fund's custodian can offer a roll-over.");
  if (entry.stage !== "open") throw new ValidationError(entry.stage === "rolled" ? "That difference was already rolled into a goal." : "An offer for this is already waiting.");
  const goal = missingRollGoals(household).find((row) => row.id === input.goalId);
  if (!goal) throw new ValidationError("Choose an open shared goal kitty bank.");
  return proposePlanBridge(household, {
    monthKey: monthKeyFromDateKey(input.today), kind: "shared-goal", label: missingBridgeLabel(entry, goal.name),
    amountCents: entry.differenceCents, expectedDate: entry.date, memberId: input.memberId, createdBy: input.memberId,
  });
}

/** The partner says yes: their own identical Bridge row. No money moves. */
export function agreeMissingRoll(household: Household, input: { today: DateKey; memberId: string; entryId: string }): CommitResult {
  const { reading, entry } = requireEntry(household, input);
  if (reading.custodianMemberId === input.memberId) throw new ValidationError("Your partner confirms the offer you made.");
  if (entry.stage !== "offered" || !entry.offer) throw new ValidationError(entry.stage === "agreed" ? "You already said yes." : "There is no offer waiting for this.");
  const row = (household.planBridgeDecisions ?? []).find((item) => item.id === entry.offer!.rowId)!;
  return proposePlanBridge(household, {
    monthKey: row.monthKey, kind: "shared-goal", label: row.label, amountCents: entry.differenceCents, expectedDate: entry.date,
    memberId: input.memberId, createdBy: input.memberId,
  });
}

/** The partner sets the offer aside, with the reason the Bridge asks for. */
export function declineMissingRoll(household: Household, input: { today: DateKey; memberId: string; entryId: string; reason?: string }): CommitResult {
  const { reading, entry } = requireEntry(household, input);
  if (reading.custodianMemberId === input.memberId || !entry.offer || entry.stage !== "offered") throw new ValidationError("There is no offer waiting on you for this.");
  return declinePlanBridge(household, { decisionId: entry.offer.rowId, reason: input.reason?.trim() || "Keep it in the Fund's water for now.", expectedUpdatedAt: entry.offer.rowUpdatedAt, memberId: input.memberId, createdBy: input.memberId });
}

/** Take back one's own open cellar offer (also how a void offer is cleared). */
export function withdrawMissingRoll(household: Household, input: { memberId: string; rowId: string }): CommitResult {
  const row = cellarBridgeRows(household).find((item) => item.row.id === input.rowId);
  if (!row) throw new ValidationError("That offer is gone.");
  return withdrawPlanBridge(household, { decisionId: input.rowId, memberId: input.memberId, createdBy: input.memberId });
}

/**
 * Both said yes: the custodian posts the roll through the Fund's rollover.
 * Re-read against the books the command runs on, so a stale screen, a
 * double tap or a late charge can never post a second roll for one occurrence.
 */
export function rollMissingSubscription(household: Household, input: { today: DateKey; memberId: string; entryId: string }): CommitResult {
  const { reading, entry } = requireEntry(household, input);
  if (reading.custodianMemberId !== input.memberId) throw new ValidationError("Only the Fund's custodian can roll money into a goal.");
  if (entry.stage === "rolled" || rolledFor(household, entry.key).cents > 0) throw new ValidationError("That difference was already rolled into a goal.");
  if (entry.stage !== "agreed" || !entry.offer?.goalId) throw new ValidationError("Both of you say yes before it rolls.");
  return allocateHouseholdFundSurplus(household, {
    memberId: input.memberId, date: input.today,
    allocations: [{ goalId: entry.offer.goalId, amount: entry.differenceCents / 100 }],
    note: `Cellar roll-over: ${missingWhat(entry)} [${entry.key}]`,
  });
}

/** The mark's words, for the jar and its card. Amounts are confirmation. */
export function missingWords(entry: MissingSubscription, format: (cents: number) => string): string {
  if (entry.kind === "missing") return `${entry.label} wasn't charged for ${shortDay(entry.date)}${entry.carried ? " (carried over)" : ""} — ${format(entry.usualCents)} stayed in the water.`;
  return `${entry.label} came in ${format(entry.differenceCents)} lower on ${shortDay(entry.date)} — ${format(entry.chargedCents ?? 0)} instead of ${format(entry.usualCents)}.`;
}
