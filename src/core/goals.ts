import { formatCad } from "./money.ts";
import type { Goal, GoalContribution, Household } from "./types.ts";

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
    return {
      ...goal,
      savedCents: goal.savedCents ?? 0,
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
