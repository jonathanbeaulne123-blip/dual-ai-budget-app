import type { Household } from "./core/types.ts";
/** Facts reviewed by Confirm, checked again inside the queued command. */
export function goalFundingBasis(household: Household, goalId: string, sourceId: string): string {
  return JSON.stringify([household.householdId, household.goals, household.goalContributions, household.goalPurchases,
    household.accounts, household.transactions, household.members, goalId, sourceId]);
}
