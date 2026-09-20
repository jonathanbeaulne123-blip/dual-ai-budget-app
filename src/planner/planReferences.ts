import type { Household } from "../core/index.ts";
import type { Task } from "../core/tasks.ts";

export type PlannerPlanChoice = {
  reference: NonNullable<Task["planReference"]>;
  value: string;
  label: string;
};

export function plannerPlanReferenceValue(reference: NonNullable<Task["planReference"]>): string {
  return JSON.stringify([reference.planVersionId, reference.planLineId]);
}

export function plannerPlanChoices(household: Pick<Household, "planVersions">, memberId: string, visibility: Task["visibility"]): PlannerPlanChoice[] {
  return [...(household.planVersions ?? [])]
    .filter((plan) => plan.state === "active" && plan.scope === visibility && (visibility === "household" || plan.ownerMemberId === memberId))
    .sort((left, right) => right.monthKey.localeCompare(left.monthKey) || right.sequence - left.sequence || right.createdAt.localeCompare(left.createdAt))
    .flatMap((plan) => plan.lines.map((line) => {
      const reference = { planVersionId: plan.id, planLineId: line.id };
      return { reference, value: plannerPlanReferenceValue(reference), label: `${line.labelSnapshot} · ${plan.monthKey}` };
    }));
}
