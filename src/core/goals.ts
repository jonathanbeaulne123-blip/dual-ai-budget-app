import { formatCad } from "./money.ts";
import type { Goal, GoalContribution, GoalPurchase, GoalPurchaseLine, GoalStatus, Household } from "./types.ts";

const LEGACY_PREFIX = "GCON-LEGACY-";

export function isLegacyGoalContribution(id: string): boolean {
  return id.startsWith(LEGACY_PREFIX);
}

export function legacyGoalContributionId(goalId: string): string {
  return `${LEGACY_PREFIX}${goalId}`;
}

export function savedCentsFromContributions(contributions: GoalContribution[], goalId: string): number {
  let sum = 0;
  for (const row of contributions) {
    if (row.goalId === goalId) sum += row.amountCents;
  }
  return sum;
}

export function applyGoalSavings(goals: Goal[], contributions: GoalContribution[]): Goal[] {
  return goals.map((goal) => ({
    ...goal,
    savedCents: savedCentsFromContributions(contributions, goal.id),
  }));
}

export function goalStatus(goal: Pick<Goal, "status" | "retiredAt">): GoalStatus {
  if (goal.status === "retired" || goal.retiredAt) return "retired";
  return "open";
}

export function goalIsFull(goal: Pick<Goal, "savedCents" | "targetCents">): boolean {
  return goal.targetCents > 0 && goal.savedCents >= goal.targetCents;
}

function stampIso(value: string | undefined, fallbackIso: string): string {
  return value || fallbackIso;
}

export function shapeGoalProgress(
  goals: Goal[] | undefined,
  contributions: GoalContribution[] | undefined,
  fallbackIso: string,
  fallbackMemberId: string,
): { goals: Goal[]; goalContributions: GoalContribution[] } {
  const nextGoals: Goal[] = (goals ?? []).map((goal) => {
    const createdAt = stampIso(goal.createdAt, fallbackIso);
    const status = goalStatus(goal);
    return {
      ...goal,
      savedCents: goal.savedCents ?? 0,
      status,
      retiredAt: status === "retired" ? stampIso(goal.retiredAt ?? undefined, createdAt) : null,
      purchaseId: typeof goal.purchaseId === "string" && goal.purchaseId ? goal.purchaseId : null,
      createdAt,
      updatedAt: stampIso(goal.updatedAt, createdAt),
    };
  });
  const nextContribs: GoalContribution[] = (contributions ?? []).map((row) => {
    const createdAt = stampIso(row.createdAt, fallbackIso);
    return {
      ...row,
      createdAt,
      updatedAt: stampIso(row.updatedAt, createdAt),
    };
  });
  const known = new Set(nextContribs.map((row) => row.id));
  for (const goal of nextGoals) {
    const summed = savedCentsFromContributions(nextContribs, goal.id);
    const leftover = goal.savedCents - summed;
    if (leftover <= 0) continue;
    const id = legacyGoalContributionId(goal.id);
    if (known.has(id)) continue;
    const createdAt = stampIso(goal.createdAt, fallbackIso);
    nextContribs.push({
      id,
      goalId: goal.id,
      memberId: goal.ownerMemberId || fallbackMemberId,
      amountCents: leftover,
      date: createdAt.slice(0, 10),
      createdAt,
      updatedAt: stampIso(goal.updatedAt, createdAt),
    });
    known.add(id);
  }
  return {
    goals: applyGoalSavings(nextGoals, nextContribs),
    goalContributions: nextContribs,
  };
}

export function describeGoalContributors(household: Pick<Household, "members" | "goalContributions">, goalId: string): string {
  const names = new Map(household.members.map((member) => [member.id, member.name]));
  const byMember = new Map<string, number>();
  for (const row of household.goalContributions ?? []) {
    if (row.goalId !== goalId) continue;
    if (isLegacyGoalContribution(row.id)) continue;
    byMember.set(row.memberId, (byMember.get(row.memberId) ?? 0) + row.amountCents);
  }
  const parts = [...byMember.entries()]
    .sort((left, right) => names.get(left[0])?.localeCompare(names.get(right[0]) ?? left[0]) || left[0].localeCompare(right[0]))
    .map(([memberId, cents]) => `${names.get(memberId) || "Someone"} ${formatCad(cents)}`);
  return parts.join(", ");
}

function shapePurchaseLine(row: Partial<GoalPurchaseLine>): GoalPurchaseLine | null {
  const amountCents = Math.round(Number(row.amountCents ?? 0));
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;
  const note = typeof row.note === "string" ? row.note.trim().slice(0, 80) : "";
  return { note, amountCents };
}

export function shapeGoalPurchases(
  rows: GoalPurchase[] | undefined,
  fallbackIso: string,
  fallbackMemberId: string,
): GoalPurchase[] {
  return (rows ?? []).filter((row) => row && typeof row.id === "string" && row.id).map((row) => {
    const createdAt = stampIso(row.createdAt, fallbackIso);
    const lines = Array.isArray(row.lines)
      ? row.lines.map(shapePurchaseLine).filter((line): line is GoalPurchaseLine => Boolean(line)).slice(0, 24)
      : [];
    const spentCents = Math.max(0, Math.round(Number(row.spentCents ?? 0)));
    return {
      id: row.id,
      goalId: row.goalId,
      spentCents,
      vaultAccountId: row.vaultAccountId,
      transactionIds: Array.isArray(row.transactionIds) ? row.transactionIds.filter((id) => typeof id === "string") : [],
      lines: lines.length ? lines : spentCents > 0 ? [{ note: "", amountCents: spentCents }] : [],
      memberId: row.memberId || fallbackMemberId,
      date: row.date || createdAt.slice(0, 10),
      createdAt,
      updatedAt: stampIso(row.updatedAt, createdAt),
    };
  });
}
