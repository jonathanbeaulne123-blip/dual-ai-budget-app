import type { DateKey, MonthKey } from "../calendar.ts";
import type { CommandReceipt, Household, RecurrenceCadence } from "../types.ts";
import { approvalsFor, shapeOnboardingApprovals, type OnboardingApproval } from "./approvals.ts";
import {
  ONBOARDING_ADOPTION_COMMAND_KIND,
  onboardingAdoptionIdentity,
  onboardingPlanApprovalPrefix,
} from "./adoption.ts";
import {
  buildProposal,
  recurrenceFloorBreakdown,
  type BudgetProposal,
  type ProposalRow,
} from "./proposal.ts";
import { onboardingRecurrenceProbe } from "./recurrences.ts";

export type FirstPlanAnchor = {
  id: string;
  label: string;
  amountCents: number;
  cadence: RecurrenceCadence;
  nextDate: DateKey;
  occurrenceDates: DateKey[];
  monthTotalCents: number;
};

export type FirstPlanRow = ProposalRow & {
  anchors: FirstPlanAnchor[];
};

export type FirstPlanMember = {
  id: string;
  name: string;
  approved: boolean;
};

export type FirstPlanPresentation = {
  proposal: BudgetProposal;
  rows: FirstPlanRow[];
  members: FirstPlanMember[];
  approvals: OnboardingApproval[];
  viewerApproved: boolean;
  bothApproved: boolean;
  pendingMemberName: string | null;
  editedAfterApproval: boolean;
  adoptionReceipt: CommandReceipt | null;
};

/**
 * A Chapter 11 receipt is current only when it binds the exact current
 * proposal and every posted id still names its active plan row for this month.
 */
export function currentPlanAdoptionReceipt(
  household: Household,
  monthKey: MonthKey,
  proposal: BudgetProposal,
): CommandReceipt | null {
  const confirmationId = onboardingAdoptionIdentity(monthKey, proposal.sourceDigest);
  const receipt = household.commandReceipts.find((candidate) => (
    candidate.commandKind === ONBOARDING_ADOPTION_COMMAND_KIND
    && candidate.confirmationId === confirmationId
  ));
  if (!receipt || receipt.postedIds.length !== proposal.rows.length) return null;
  const posted = new Set(receipt.postedIds);
  if (posted.size !== receipt.postedIds.length) return null;
  const plans = household.budgetPlans.filter((plan) => posted.has(plan.id));
  if (plans.length !== proposal.rows.length) return null;
  const categoryIds = new Set(proposal.rows.map((row) => row.subcategoryId));
  if (plans.some((plan) => (
    !plan.active
    || plan.monthKey !== monthKey
    || !categoryIds.has(plan.subcategoryId)
    || plan.amountCents !== proposal.rows.find((row) => row.subcategoryId === plan.subcategoryId)?.proposedCents
  ))) return null;
  return new Set(plans.map((plan) => plan.subcategoryId)).size === categoryIds.size ? receipt : null;
}

/** Pure presentation projection. It never recomputes or edits proposal cents. */
export function firstPlanPresentation(
  household: Household,
  viewerMemberId: string,
  monthKey: MonthKey,
  today: DateKey,
): FirstPlanPresentation {
  const activeMembers = household.members
    .filter((member) => member.active)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (activeMembers.length !== 2 || !activeMembers.some((member) => member.id === viewerMemberId)) {
    throw new Error("The first plan needs both active household members.");
  }
  const proposal = buildProposal(household, monthKey, today);
  const targetHasPlans = household.budgetPlans.some((plan) => plan.active && plan.monthKey === monthKey);
  const requiredApprovalPrefix = targetHasPlans ? onboardingPlanApprovalPrefix(household) : null;
  const approvals = approvalsFor(household, "proposal", proposal.sourceDigest)
    .filter((approval) => !requiredApprovalPrefix || approval.id.startsWith(requiredApprovalPrefix));
  const approvedIds = new Set(approvals.map((approval) => approval.memberId));
  const allProposalApprovals = shapeOnboardingApprovals(household.onboardingApprovals, household.householdId)
    .filter((approval) => approval.scope === "proposal");
  const recurrenceRows = onboardingRecurrenceProbe(household).rows;
  const recurrenceById = new Map(recurrenceRows.map((recurrence) => [recurrence.id, recurrence]));
  const rows = proposal.rows.map((row) => {
    const parts = recurrenceFloorBreakdown(recurrenceRows, row.subcategoryId, monthKey)
      .filter((part) => part.occurrenceDates.length > 0);
    return {
      ...row,
      anchors: parts.map((part) => {
        const recurrence = recurrenceById.get(part.recurrenceId)!;
        return {
          id: recurrence.id,
          label: recurrence.note || row.label,
          amountCents: part.amountCents,
          cadence: recurrence.cadence,
          nextDate: recurrence.nextDate,
          occurrenceDates: part.occurrenceDates,
          monthTotalCents: part.totalCents,
        };
      }),
    };
  });
  const members = activeMembers.map((member) => ({
    id: member.id,
    name: member.name,
    approved: approvedIds.has(member.id),
  }));
  const pending = members.find((member) => !member.approved && member.id !== viewerMemberId)
    ?? members.find((member) => !member.approved)
    ?? null;
  return {
    proposal,
    rows,
    members,
    approvals,
    viewerApproved: approvedIds.has(viewerMemberId),
    bothApproved: members.every((member) => member.approved),
    pendingMemberName: pending?.name ?? null,
    editedAfterApproval: allProposalApprovals.some((approval) => (
      approval.digest !== proposal.sourceDigest
      || (approval.digest === proposal.sourceDigest && !approvals.some((current) => current.id === approval.id))
    )),
    adoptionReceipt: currentPlanAdoptionReceipt(household, monthKey, proposal),
  };
}
