import { openShiftConflicts } from "./core/shiftClock.ts";
import type { Household } from "./core/types.ts";

/** Compare the member's complete active timeline set, not an advancing display clock. */
export function openShiftReview(household: Household, memberId: string): string {
  return JSON.stringify([household.environment, household.householdId, memberId,
    openShiftConflicts(household.kitchen, memberId).sort((a,b)=>a.id.localeCompare(b.id))]);
}
export function runReviewedOpenShift<T>(household: Household, memberId: string, reviewed: string, action: (current: Household) => T): T {
  const rows = openShiftConflicts(household.kitchen, memberId);
  if (openShiftReview(household, memberId) !== reviewed || rows.length !== 1 || rows[0]!.status !== "open") {
    throw new Error("This shift timeline changed. Review its current clock and breaks before trying again.");
  }
  return action(household);
}

/** Discard may clear a reviewed open or confirming timeline, never an unseen replacement. */
export function runReviewedShiftDiscard<T>(household: Household, memberId: string, reviewed: string, action: (current: Household) => T): T {
  if (openShiftReview(household, memberId) !== reviewed || openShiftConflicts(household.kitchen, memberId).length !== 1) {
    throw new Error("This shift timeline changed. Review it before discarding it.");
  }
  return action(household);
}

/** A conflict choice cannot silently discard an unseen third device timeline. */
export function runReviewedShiftChoice<T>(household: Household, memberId: string, reviewed: string, keepId: string, action: (current: Household) => T): T {
  const rows = openShiftConflicts(household.kitchen, memberId);
  if (openShiftReview(household, memberId) !== reviewed || rows.length < 2 || !rows.some(row => row.id === keepId)) {
    throw new Error("These device timelines changed. Review the current choices before keeping one.");
  }
  return action(household);
}
