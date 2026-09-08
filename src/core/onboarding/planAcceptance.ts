import { ValidationError } from "../types.ts";
import type { BudgetPlan, Household } from "../types.ts";
import { approvalsFor } from "./approvals.ts";
import { onboardingCategoryState } from "./categories.ts";

/** A compact domain receipt survives v2's separate transport-receipt storage. */
export type AcceptedStarterPlan = {
  id: string;
  proposalDigest: string;
  monthKey: string;
  memberIds: string[];
  plans: BudgetPlan[];
  acceptedAt: string;
};
export function shapeAcceptedStarterPlans(value: unknown): AcceptedStarterPlan[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, AcceptedStarterPlan>();
  for (const r of value) {
    if (!r || typeof r !== "object"
      || Object.keys(r).sort().join() !== "acceptedAt,id,memberIds,monthKey,plans,proposalDigest"
      || typeof r.id !== "string" || !r.id.startsWith("ONB-ADOPT-")
      || typeof r.proposalDigest !== "string" || !/^proposal-v\d+-[a-f0-9]{64}$/.test(r.proposalDigest)
      || typeof r.monthKey !== "string" || !/^\d{4}-\d{2}$/.test(r.monthKey)
      || !Array.isArray(r.memberIds) || r.memberIds.length !== 2 || new Set(r.memberIds).size !== 2
      || !r.memberIds.every((id: unknown) => typeof id === "string" && id.length > 0)
      || !Array.isArray(r.plans) || !r.plans.length
      || !r.plans.every((plan: BudgetPlan) => plan && typeof plan.id === "string" && plan.active === true
        && plan.monthKey === r.monthKey && Number.isSafeInteger(plan.amountCents) && plan.amountCents >= 0)
      || typeof r.acceptedAt !== "string" || !Number.isFinite(Date.parse(r.acceptedAt))) continue;
    const row: AcceptedStarterPlan = { id: r.id, proposalDigest: r.proposalDigest, monthKey: r.monthKey,
      memberIds: [...r.memberIds].sort(), plans: [...r.plans].sort((a, b) => a.id.localeCompare(b.id)), acceptedAt: r.acceptedAt };
    const prior = byId.get(row.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw new ValidationError("Conflicting accepted starter plans.");
    byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function mergeAcceptedStarterPlans(left: unknown, right: unknown): AcceptedStarterPlan[] {
  return shapeAcceptedStarterPlans([...shapeAcceptedStarterPlans(left), ...shapeAcceptedStarterPlans(right)]);
}
export function currentAcceptedStarterPlan(household: Household): AcceptedStarterPlan | null {
  const memberIds = household.members.filter(m => m.active).map(m => m.id).sort();
  const categoryState = onboardingCategoryState(household);
  return shapeAcceptedStarterPlans(household.acceptedStarterPlans).filter(acceptance =>
    JSON.stringify([...acceptance.memberIds].sort()) === JSON.stringify(memberIds)
    && categoryState.kind === "complete"
    && JSON.stringify([...categoryState.unionIds].sort()) === JSON.stringify(acceptance.plans.map(p => p.subcategoryId).sort())
    && memberIds.every(id => approvalsFor(household, "proposal", acceptance.proposalDigest).some(a => a.memberId === id))
    && acceptance.plans.every(p => household.budgetPlans.some(current =>
      current.id === p.id && current.active && current.monthKey === acceptance.monthKey
      && current.amountCents === p.amountCents && current.subcategoryId === p.subcategoryId))
    && household.budgetPlans.filter(p => p.active && p.monthKey === acceptance.monthKey).length === acceptance.plans.length)
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0] ?? null;
}
