import { formatCad } from "./money.ts";
import { openGoals } from "./goalVault.ts";
import { goalVisibleInView } from "./visibility.ts";
import type { PaperBarRow } from "./officeWide.ts";
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

export function kittyBankBars(goals: Goal[], limit = 4): PaperBarRow[] {
  return goals.slice(0, limit).map((goal) => ({
    label: goal.name,
    cents: Math.max(0, goal.savedCents),
    tone: "ink",
  }));
}
