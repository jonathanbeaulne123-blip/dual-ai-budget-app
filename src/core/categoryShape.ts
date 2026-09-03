// The shape — each category against its own trailing range. Never against
// another category, never against the other person, never against a total.
//
// Every figure here is read straight off household.transactions with the
// same projection rules budget.ts's own monthSummary uses (reversals net
// out, duplicates never count) — nothing here computes spend a second way.
// A shared surface never draws a personal-visibility posting, so this
// module's own aggregation filters that out first; monthSummary doesn't,
// which is why this reads the ledger directly instead of calling it.

import {
  inInclusiveRange,
  monthEndKey,
  monthStartKey,
  shiftMonthKey,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import { projectedExpenseEffect } from "./budget.ts";
import type { Household, Transaction } from "./types.ts";

export const SHAPE_MIN_MONTHS = 3;

export type ShapeVerdict = "above" | "in-shape" | "quiet" | "one-off" | "unknown";

export type CategoryShape = {
  subcategoryId: string;
  label: string;
  monthToDateCents: number;
  bandLowCents: number;
  bandHighCents: number;
  deltaCents: number;
  verdict: ShapeVerdict;
  monthsSeen: number;
};

function shared(tx: Transaction): boolean {
  return tx.visibility !== "personal";
}

// No `tx.type === "expense"` filter here — a refund against a category's own
// purchase must still land in that category's total, exactly as monthSummary
// already treats it. projectedExpenseEffect does that netting itself (an
// expense adds, a refund subtracts, anything else is zero); filtering on
// type first would silently drop every refund from the shape.
function windowTotalCents(
  household: Household,
  subcategoryId: string,
  start: DateKey,
  end: DateKey,
  transactionById: ReadonlyMap<string, Transaction>,
): number {
  return household.transactions.reduce((sum, tx) => {
    if (tx.subcategoryId !== subcategoryId || !shared(tx)) return sum;
    if (!inInclusiveRange(tx.date, start, end)) return sum;
    return sum + projectedExpenseEffect(tx, transactionById);
  }, 0);
}

/** Real postings only — a reversal and the row it corrects are one event, not two. */
function windowPostingCount(
  household: Household,
  subcategoryId: string,
  start: DateKey,
  end: DateKey,
): number {
  return household.transactions.filter((tx) => (
    tx.subcategoryId === subcategoryId
    && tx.type === "expense"
    && !tx.reversalOfId
    && !tx.isDuplicate
    && shared(tx)
    && inInclusiveRange(tx.date, start, end)
  )).length;
}

/** Any countable shared category activity, even when purchases and refunds net to zero. */
function windowHasActivity(
  household: Household,
  subcategoryId: string,
  start: DateKey,
  end: DateKey,
  transactionById: ReadonlyMap<string, Transaction>,
): boolean {
  return household.transactions.some((tx) => (
    tx.subcategoryId === subcategoryId
    && shared(tx)
    && inInclusiveRange(tx.date, start, end)
    && projectedExpenseEffect(tx, transactionById) !== 0
  ));
}

/**
 * Each expense category against the range it has actually held over the
 * three months before this one — never against a sibling category, a
 * household total, or anything expressed as a share of one.
 */
export function categoryShape(household: Household, monthKey: MonthKey, today: DateKey): CategoryShape[] {
  const transactionById = new Map(household.transactions.map((tx) => [tx.id, tx]));
  const monthStart = monthStartKey(monthKey);
  const trailingKeys = [1, 2, 3].map((back) => shiftMonthKey(monthKey, -back));

  // Only a category with something to show this quarter earns a row — a
  // household's full catalog runs to dozens of subcategories, and most of
  // them have nothing to say about a given month.
  const candidateIds = new Set(
    household.categories
      .filter((category) => category.recordType === "category" && category.active && category.transactionType === "expense")
      .map((category) => category.id)
      .filter((subcategoryId) => (
        windowTotalCents(household, subcategoryId, monthStart, today, transactionById) !== 0
        || trailingKeys.some((key) => windowTotalCents(household, subcategoryId, monthStartKey(key), monthEndKey(key), transactionById) !== 0)
      )),
  );

  const rows: CategoryShape[] = [...candidateIds].map((subcategoryId) => {
    const label = household.categories.find((category) => category.id === subcategoryId)?.name ?? subcategoryId;
    const monthToDateCents = windowTotalCents(household, subcategoryId, monthStart, today, transactionById);
    const trailingTotals = trailingKeys.map((key) => windowTotalCents(household, subcategoryId, monthStartKey(key), monthEndKey(key), transactionById));
    // A fully refunded month still contains real category history even though
    // its net total is zero, so count activity rather than non-zero totals.
    const monthsSeen = trailingKeys.filter((key) => windowHasActivity(
      household,
      subcategoryId,
      monthStartKey(key),
      monthEndKey(key),
      transactionById,
    )).length;
    const bandLowCents = Math.min(...trailingTotals);
    const bandHighCents = Math.max(...trailingTotals);

    let verdict: ShapeVerdict;
    if (monthsSeen < SHAPE_MIN_MONTHS) {
      // Never extrapolated: a band built from fewer than three real months
      // is a guess, not a shape, so the verdict says so instead of drawing one.
      const posted = windowPostingCount(household, subcategoryId, monthStart, today);
      verdict = monthsSeen === 0 && posted === 1 ? "one-off" : "unknown";
    } else if (monthToDateCents > bandHighCents) {
      verdict = "above";
    } else if (monthToDateCents < bandLowCents) {
      verdict = "quiet";
    } else {
      verdict = "in-shape";
    }
    const deltaCents = verdict === "above" ? monthToDateCents - bandHighCents : 0;

    return { subcategoryId, label, monthToDateCents, bandLowCents, bandHighCents, deltaCents, verdict, monthsSeen };
  });

  return rows.sort((left, right) => right.deltaCents - left.deltaCents || left.subcategoryId.localeCompare(right.subcategoryId));
}
