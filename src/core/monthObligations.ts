import { monthEndKey, monthKeyFromDateKey, monthStartKey, type DateKey } from "./calendar.ts";
import {
  activeHouseholdFundEvents,
  assertHouseholdFundIntegrity,
  projectHouseholdFund,
  projectHouseholdFundRecurrenceDates,
  projectHouseholdFundRecurrenceOccurrences,
  shapeHouseholdFundConfig,
} from "./householdFund.ts";
import type { Goal, Household, Recurrence, Transaction } from "./types.ts";

export type ObligationSource = "recurrence" | "goal-claim" | "posted";

export type MonthObligation = {
  id: string;
  label: string;
  date: DateKey;
  amountCents: number;
  source: ObligationSource;
  recurrenceId: string | null;
  goalId: string | null;
  transactionId: string | null;
};

export type MonthObligations = {
  monthKey: string;
  rows: MonthObligation[];
  owedCents: number;
  tiesToProjection: boolean;
};

function labelForRecurrence(household: Household, recurrence: Recurrence): string {
  const category = household.categories.find((row) => row.id === recurrence.subcategoryId);
  return recurrence.note.trim() || category?.name || "Household obligation";
}

function labelForTransaction(household: Household, transaction: Transaction): string {
  const category = household.categories.find((row) => row.id === transaction.subcategoryId);
  return transaction.note.trim() || category?.name || "Household purchase";
}

function plannedGoalClaims(
  household: Household,
  from: DateKey,
  to: DateKey,
): { rows: MonthObligation[]; suppressedPostedDuplicate: boolean } {
  const goals = new Map(household.goals
    .filter((goal) => goal.shared && goal.status !== "retired")
    .map((goal) => [goal.id, goal]));
  const postedClaims = new Set((household.goalContributions ?? [])
    .filter((row) => row.transferId && row.date >= from && row.date <= to)
    .map((row) => `${row.goalId}:${row.date}`));
  const candidates: Array<{ goal: Goal; recurrence: Recurrence; date: DateKey }> = [];

  for (const recurrence of household.recurrences) {
    if (!recurrence.active || recurrence.type !== "transfer" || !recurrence.goalId) continue;
    const goal = goals.get(recurrence.goalId);
    if (!goal) continue;
    const date = projectHouseholdFundRecurrenceDates(recurrence, from, to)[0];
    if (date) candidates.push({ goal, recurrence, date });
  }

  const claimed = new Set<string>();
  let suppressedPostedDuplicate = false;
  const rows = candidates
    .sort((left, right) => left.date.localeCompare(right.date) || left.recurrence.id.localeCompare(right.recurrence.id))
    .flatMap(({ goal, recurrence, date }) => {
      if (claimed.has(goal.id)) return [];
      claimed.add(goal.id);
      if (postedClaims.has(`${goal.id}:${date}`)) {
        suppressedPostedDuplicate = true;
        return [];
      }
      const amountCents = Math.min(recurrence.amountCents, Math.max(0, goal.targetCents - goal.savedCents));
      if (amountCents <= 0) return [];
      return [{
        id: `goal-claim:${goal.id}:${date}`,
        label: `${goal.name} · goal claim`,
        date,
        amountCents,
        source: "goal-claim" as const,
        recurrenceId: recurrence.id,
        goalId: goal.id,
        transactionId: null,
      }];
    });
  return { rows, suppressedPostedDuplicate };
}

function postedPositionSource(
  household: Household,
  fundId: string,
  positionId: string,
): { date: DateKey; transaction: Transaction | undefined } | undefined {
  const transaction = household.transactions
    .filter((transaction) => (
      transaction.type === "expense"
      && (transaction.funding?.positionId ?? transaction.id) === positionId
    ))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))[0];
  const purchaseEvent = activeHouseholdFundEvents(household, fundId)
    .filter((event) => event.kind === "purchase-funded" && event.relatedTransactionIds.includes(positionId))
    .sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))[0];
  if (!transaction && !purchaseEvent) return undefined;
  return { date: transaction?.date ?? purchaseEvent!.date, transaction };
}

/** One date-ordered, cents-exact list of what the Household Fund owes in a month. */
export function monthObligations(household: Household, monthKey: string, today: DateKey): MonthObligations {
  const start = monthStartKey(monthKey);
  const end = monthEndKey(monthKey);
  const from = monthKeyFromDateKey(today) === monthKey ? today : start;
  const fund = shapeHouseholdFundConfig(household.householdFund);
  if (!fund) return { monthKey, rows: [], owedCents: 0, tiesToProjection: false };

  const projection = projectHouseholdFund(household, from);
  const recurrenceById = new Map(household.recurrences.map((row) => [row.id, row]));
  const postedRecurrenceOccurrences = new Set(household.transactions
    .filter((row) => row.source === "recurring" && row.sourceId && row.date >= start && row.date <= end)
    .map((row) => `${row.sourceId}:${row.date}`));

  const projectedRecurrences = projectHouseholdFundRecurrenceOccurrences(household, fund.id, from, end);
  const recurrenceRows: MonthObligation[] = projectedRecurrences.flatMap((occurrence) => {
    if (postedRecurrenceOccurrences.has(`${occurrence.recurrenceId}:${occurrence.date}`)) return [];
    const recurrence = recurrenceById.get(occurrence.recurrenceId);
    if (!recurrence) return [];
    return [{
      id: `recurrence:${recurrence.id}:${occurrence.date}`,
      label: labelForRecurrence(household, recurrence),
      date: occurrence.date,
      amountCents: occurrence.amountCents,
      source: "recurrence",
      recurrenceId: recurrence.id,
      goalId: null,
      transactionId: null,
    }];
  });

  const postedRows: MonthObligation[] = projection.transactionPositions.flatMap((position) => {
    const source = postedPositionSource(household, fund.id, position.transactionId);
    const amountCents = position.fundedCents - position.refundedCents;
    if (!source || source.date < start || source.date > end || amountCents <= 0) return [];
    const visibleTransaction = source.transaction?.visibility === "personal" ? undefined : source.transaction;
    return [{
      id: `posted:${position.transactionId}`,
      label: visibleTransaction ? labelForTransaction(household, visibleTransaction) : "Household purchase",
      date: source.date,
      amountCents,
      source: "posted",
      recurrenceId: visibleTransaction?.source === "recurring" ? visibleTransaction.sourceId ?? null : null,
      goalId: null,
      transactionId: position.transactionId,
    }];
  });

  const goalClaims = plannedGoalClaims(household, from, end);
  const rows = [...recurrenceRows, ...goalClaims.rows, ...postedRows]
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  const owedCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const recurrenceCents = recurrenceRows.reduce((sum, row) => sum + row.amountCents, 0);
  const postedCents = postedRows.reduce((sum, row) => sum + row.amountCents, 0);
  const projectedPostedCents = projection.transactionPositions.reduce((sum, position) => {
    const source = postedPositionSource(household, fund.id, position.transactionId);
    return source && source.date >= start && source.date <= end
      ? sum + Math.max(0, position.fundedCents - position.refundedCents)
      : sum;
  }, 0);
  let integrityTied = true;
  try {
    assertHouseholdFundIntegrity(household);
  } catch {
    integrityTied = false;
  }

  return {
    monthKey,
    rows,
    owedCents,
    tiesToProjection: integrityTied
      && projection.configured
      && !goalClaims.suppressedPostedDuplicate
      && recurrenceCents === projection.upcomingReserveCents
      && postedCents === projectedPostedCents,
  };
}
