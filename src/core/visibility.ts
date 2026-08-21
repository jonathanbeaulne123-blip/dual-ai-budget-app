import type { Goal, Household, LedgerView, Shift, Transaction, Visibility } from "./types.ts";

export const VISIBILITIES: Visibility[] = ["household", "personal", "both"];

export function parseVisibility(value: unknown): Visibility {
  if (value === "household" || value === "personal" || value === "both") return value;
  return "household";
}

export function visibilityLabel(visibility: Visibility): string {
  if (visibility === "personal") return "Personal";
  if (visibility === "both") return "Both";
  return "Shared";
}

export function isVisibleInView(
  item: { visibility?: Visibility; createdBy?: string },
  memberId: string,
  view: LedgerView,
): boolean {
  const visibility = parseVisibility(item.visibility);
  if (view === "household") return visibility === "household" || visibility === "both";
  return item.createdBy === memberId && (visibility === "personal" || visibility === "both");
}

export function visibleForDuplicateScan(
  item: { visibility?: Visibility; createdBy?: string },
  memberId: string,
): boolean {
  return parseVisibility(item.visibility) !== "personal" || item.createdBy === memberId;
}

export function goalVisibleInView(goal: Goal, memberId: string, view: LedgerView): boolean {
  if (view === "household") return goal.shared;
  return !goal.shared && goal.ownerMemberId === memberId;
}

export function householdForView(household: Household, memberId: string, view: LedgerView): Household {
  return {
    ...household,
    transactions: household.transactions.filter((tx) => isVisibleInView(tx, memberId, view)),
    shifts: household.shifts.filter((shift) => isVisibleInView(shift, memberId, view)),
    goals: household.goals.filter((goal) => goalVisibleInView(goal, memberId, view)),
  };
}

export function defaultVisibilityForView(view: LedgerView): Visibility {
  return view === "personal" ? "personal" : "household";
}

export function stampActor<T extends { createdBy?: string; visibility?: Visibility; createdAt: string; updatedAt?: string }>(
  item: T,
  createdBy: string,
  visibility: Visibility,
): T & { createdBy: string; visibility: Visibility; updatedAt: string } {
  return {
    ...item,
    createdBy,
    visibility,
    updatedAt: item.updatedAt ?? item.createdAt,
  };
}

export function isPersonalOnly(item: { visibility?: Visibility }): boolean {
  return parseVisibility(item.visibility) === "personal";
}

export function belongsToSharedLedger(item: Transaction | Shift): boolean {
  return !isPersonalOnly(item);
}
