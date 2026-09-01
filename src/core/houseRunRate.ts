import { addDays, calendarDaysBetween, type DateKey } from "./calendar.ts";
import {
  activeHouseholdFundEvents,
  assertHouseholdFundIntegrity,
  shapeHouseholdFundConfig,
  shapeHouseholdFundEvents,
} from "./householdFund.ts";
import { formatCad } from "./money.ts";
import type { Household, HouseholdFundEvent, Transaction } from "./types.ts";

export const RUN_RATE_MIN_WEEKS = 3;

export type RunRateConfidence = "watching" | "provisional" | "settled";

export type HouseRunRate = {
  weeksWatched: number;
  confidence: RunRateConfidence;
  observedMonthlyCents: number;
  lowMonthlyCents: number;
  highMonthlyCents: number;
  byCategory: Array<{ subcategoryId: string; label: string; monthlyCents: number; weeksSeen: number }>;
  suggestion: RunRateSuggestion | null;
  copy: string;
};

export type RunRateSuggestion = {
  monthlyNeedCents: number;
  note: string;
};

type ObservedPosition = {
  purchase: HouseholdFundEvent;
  amountCents: number;
};

const PRIVATE_CATEGORY_ID = "HOUSEHOLD-PURCHASE";
const PRIVATE_CATEGORY_LABEL = "Household purchase";
const WEEKS_PER_MONTH = 52 / 12;

function annualiseWeeklyCents(totalCents: number, weeks: number): number {
  if (weeks <= 0) return 0;
  return Math.round((totalCents / weeks) * WEEKS_PER_MONTH);
}

function watching(weeksWatched: number): HouseRunRate {
  return {
    weeksWatched,
    confidence: "watching",
    observedMonthlyCents: 0,
    lowMonthlyCents: 0,
    highMonthlyCents: 0,
    byCategory: [],
    suggestion: null,
    copy: `Three weeks in, I'll have a first read on what the house costs. Right now I've watched ${weeksWatched}.`,
  };
}

function rootPurchase(
  event: HouseholdFundEvent,
  byId: Map<string, HouseholdFundEvent>,
  seen = new Set<string>(),
): HouseholdFundEvent | null {
  if (seen.has(event.id)) return null;
  if (!event.relatedEventId) return event.kind === "purchase-funded" ? event : null;
  const related = byId.get(event.relatedEventId);
  if (!related) return event.kind === "purchase-funded" ? event : null;
  return rootPurchase(related, byId, new Set(seen).add(event.id));
}

function observedPositions(events: HouseholdFundEvent[]): ObservedPosition[] {
  const fundingEvents = events.filter((event) => event.kind === "purchase-funded" || event.kind === "refund-funded");
  const byId = new Map(fundingEvents.map((event) => [event.id, event]));
  const positions = new Map<string, ObservedPosition>();

  for (const event of fundingEvents) {
    const purchase = rootPurchase(event, byId);
    if (!purchase) continue;
    const current = positions.get(purchase.id) ?? { purchase, amountCents: 0 };
    current.amountCents += event.kind === "purchase-funded" ? event.amountCents : -event.amountCents;
    positions.set(purchase.id, current);
  }

  return [...positions.values()].filter((position) => position.amountCents > 0);
}

function transactionForPosition(household: Household, purchase: HouseholdFundEvent): Transaction | undefined {
  const positionIds = new Set(purchase.relatedTransactionIds);
  return household.transactions
    .filter((transaction) => transaction.type === "expense"
      && (positionIds.has(transaction.id) || Boolean(transaction.funding?.positionId && positionIds.has(transaction.funding.positionId))))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))[0];
}

/** Actual net Fund-backed purchases across complete seven-day observation windows. */
export function houseRunRate(household: Household, today: DateKey): HouseRunRate {
  assertHouseholdFundIntegrity(household);
  const fund = shapeHouseholdFundConfig(household.householdFund);
  if (!fund || today < fund.openedOn) return watching(0);

  const daysAvailable = calendarDaysBetween(fund.openedOn, today) + 1;
  const weeksWatched = Math.max(0, Math.floor(daysAvailable / 7));
  if (weeksWatched < RUN_RATE_MIN_WEEKS) return watching(weeksWatched);

  const observationEnd = addDays(fund.openedOn, weeksWatched * 7 - 1);
  const eventsThroughObservation = shapeHouseholdFundEvents(household.fundEvents)
    .filter((event) => event.date >= fund.openedOn && event.date <= observationEnd);
  const activeEvents = activeHouseholdFundEvents({ fundEvents: eventsThroughObservation }, fund.id);
  const weeklyTotals = Array.from({ length: weeksWatched }, () => 0);
  const categories = new Map<string, { label: string; totalCents: number; weekIndexes: Set<number> }>();

  for (const position of observedPositions(activeEvents)) {
    const weekIndex = Math.floor(calendarDaysBetween(fund.openedOn, position.purchase.date) / 7);
    if (weekIndex < 0 || weekIndex >= weeksWatched) continue;
    weeklyTotals[weekIndex] = (weeklyTotals[weekIndex] ?? 0) + position.amountCents;

    const transaction = transactionForPosition(household, position.purchase);
    const canNameCategory = transaction?.visibility !== "personal" && Boolean(transaction?.subcategoryId);
    const subcategoryId = canNameCategory ? transaction!.subcategoryId! : PRIVATE_CATEGORY_ID;
    const label = canNameCategory
      ? household.categories.find((category) => category.id === subcategoryId)?.name ?? "Household purchase"
      : PRIVATE_CATEGORY_LABEL;
    const row = categories.get(subcategoryId) ?? { label, totalCents: 0, weekIndexes: new Set<number>() };
    row.totalCents += position.amountCents;
    row.weekIndexes.add(weekIndex);
    categories.set(subcategoryId, row);
  }

  const totalCents = weeklyTotals.reduce((sum, cents) => sum + cents, 0);
  const observedMonthlyCents = annualiseWeeklyCents(totalCents, weeksWatched);
  const lowMonthlyCents = annualiseWeeklyCents(Math.min(...weeklyTotals), 1);
  const highMonthlyCents = annualiseWeeklyCents(Math.max(...weeklyTotals), 1);
  const confidence: RunRateConfidence = weeksWatched >= 8 ? "settled" : "provisional";
  const byCategory = [...categories.entries()]
    .map(([subcategoryId, row]) => ({
      subcategoryId,
      label: row.label,
      monthlyCents: annualiseWeeklyCents(row.totalCents, weeksWatched),
      weeksSeen: row.weekIndexes.size,
    }))
    .sort((left, right) => right.monthlyCents - left.monthlyCents || left.subcategoryId.localeCompare(right.subcategoryId));
  const suggestion: RunRateSuggestion = {
    monthlyNeedCents: observedMonthlyCents,
    note: `Observed Fund spending annualised from ${weeksWatched} complete weeks; this is a household need, not a split.`,
  };
  const copy = confidence === "settled"
    ? `The house has run about ${formatCad(observedMonthlyCents)} a month across ${weeksWatched} weeks.`
    : `On ${weeksWatched} weeks, the house looks like about ${formatCad(observedMonthlyCents)} a month — somewhere between ${formatCad(lowMonthlyCents)} and ${formatCad(highMonthlyCents)}. Ask me again at the end of the month.`;

  return {
    weeksWatched,
    confidence,
    observedMonthlyCents,
    lowMonthlyCents,
    highMonthlyCents,
    byCategory,
    suggestion,
    copy,
  };
}
