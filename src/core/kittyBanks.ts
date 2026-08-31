import { formatCad } from "./money.ts";
import { openGoals } from "./goalVault.ts";
import { goalVisibleInView } from "./visibility.ts";
import type { PaperBarRow } from "./officeWide.ts";
import { activeHouseholdFundEvents, shapeHouseholdFundKittyAllocations } from "./householdFund.ts";
import type { Goal, Household, LedgerView } from "./types.ts";

/** Existing goals shown as Kitty Banks. Shared Fund surplus (D-161) uses shared goals only. */
export function kittyBanksInView(
  household: Pick<Household, "goals">,
  view: LedgerView,
  memberId?: string,
): Goal[] {
  return openGoals(household).filter((goal) => (
    memberId ? goalVisibleInView(goal, memberId, view) : (view === "household" ? goal.shared : !goal.shared)
  ));
}

export function kittyBankGlance(goals: Goal[]): { cents: number; count: number; label: string } {
  const cents = goals.reduce((sum, goal) => sum + Math.max(0, goal.savedCents), 0);
  const count = goals.length;
  return {
    cents,
    count,
    label: count ? `${count} bank${count === 1 ? "" : "s"} · ${formatCad(cents)}` : "No banks yet",
  };
}

export function kittyBankFill(goal: Pick<Goal, "savedCents" | "targetCents">): number {
  if (goal.targetCents <= 0) return 0;
  return Math.max(0, Math.min(1, goal.savedCents / goal.targetCents));
}

/** 0 = skinny empty outline. 1–10 = each 10% of target from savedCents. */
export function kittyBankStep(goal: Pick<Goal, "savedCents" | "targetCents">): number {
  const fill = kittyBankFill(goal);
  if (fill <= 0) return 0;
  if (fill >= 1) return 10;
  return Math.min(9, Math.floor(fill * 10));
}

export function kittyBankBars(goals: Goal[], limit = 4): PaperBarRow[] {
  return goals.slice(0, limit).map((goal) => ({
    label: goal.name,
    cents: Math.max(0, goal.savedCents),
    tone: "ink",
  }));
}

/**
 * What the Household Fund has rolled into each shared bank.
 *
 * D-161: a Kitty rollover is a claim recorded against a named shared goal, not
 * a transfer into it — `goal.savedCents` is untouched by design, which is why a
 * rollover was previously invisible on the shelf. This reads the allocation
 * records so the shelf can SAY what the Fund rolled without pretending the
 * money moved. A release is a lump against the Kitty as a whole and is never
 * attributed to one bank, so it is reported separately rather than guessed at.
 */
export function fundRolloverByGoal(
  household: Pick<Household, "fundEvents" | "fundKittyAllocations">,
): { byGoalId: Record<string, number>; allocatedCents: number; releasedCents: number } {
  const events = activeHouseholdFundEvents(household as Pick<Household, "fundEvents">);
  const activeAllocationEventIds = new Set(
    events.filter((event) => event.kind === "kitty-allocated").map((event) => event.id),
  );
  const byGoalId: Record<string, number> = {};
  let allocatedCents = 0;
  for (const allocation of shapeHouseholdFundKittyAllocations(household.fundKittyAllocations)) {
    if (!activeAllocationEventIds.has(allocation.eventId)) continue;
    byGoalId[allocation.goalId] = (byGoalId[allocation.goalId] ?? 0) + allocation.amountCents;
    allocatedCents += allocation.amountCents;
  }
  const releasedCents = events
    .filter((event) => event.kind === "kitty-released")
    .reduce((sum, event) => sum + event.amountCents, 0);
  return { byGoalId, allocatedCents, releasedCents };
}
