import type { Household } from "../types.ts";
import { ValidationError } from "../types.ts";
import { onboardingCategoryState } from "./categories.ts";
import { currentSubmission, shapeOnboardingSubmissions, type OnboardingSubmission } from "./submissions.ts";

export type OnboardingEstimateAnswer = {
  categoryId: string;
  label: string;
  kind: "missing" | "zero" | "amount";
  amountCents: number | null;
};

export type OnboardingEstimateState = {
  kind: "categories-pending" | "collecting" | "waiting-member" | "complete" | "invalid";
  reason: "categories" | "malformed" | "stale" | "untied" | null;
  currentMemberIds: string[];
  categoryIds: string[];
  categorySubmissionIds: string[];
  categoryMergeId: string | null;
  categoryReadyAt: string | null;
  submissionIds: string[];
  submittedMemberIds: string[];
  needsSubmissionMemberIds: string[];
  staleMemberIds: string[];
  bySubmitter: Record<string, OnboardingEstimateAnswer[]>;
};

const CATEGORY_SCOPE_ERROR = "Use only the accepted household categories for these guesses.";
const CATEGORY_NOT_READY_ERROR = "Finish the household category set before adding guesses.";

function activeMemberIds(household: Household): string[] {
  return household.members.filter((member) => member.active).map((member) => member.id).sort();
}

function latestIso(values: readonly string[]): string | null {
  if (values.length === 0 || values.some((value) => !value || Number.isNaN(Date.parse(value)))) return null;
  return values.map((value) => new Date(value).toISOString()).sort().at(-1) ?? null;
}

function answersFor(
  categoryIds: readonly string[],
  labels: ReadonlyMap<string, string>,
  submission: OnboardingSubmission,
): OnboardingEstimateAnswer[] {
  const amountByCategory = new Map(submission.estimates.map((row) => [row.subcategoryId, row.amountCents]));
  return categoryIds.map((categoryId) => {
    const amountCents = amountByCategory.get(categoryId);
    return {
      categoryId,
      label: labels.get(categoryId) ?? categoryId,
      kind: amountCents === undefined ? "missing" : amountCents === 0 ? "zero" : "amount",
      amountCents: amountCents ?? null,
    };
  });
}

/**
 * An explicit estimate submission means the member reviewed the whole accepted
 * category set. Included zero is an answer; an omitted row is deliberately
 * missing. The submission carries the exact accepted category set it reviewed;
 * device timestamps are display metadata, never scope authority.
 */
export function onboardingEstimateState(household: Household): OnboardingEstimateState {
  const currentMemberIds = activeMemberIds(household);
  const base = {
    currentMemberIds,
    categoryIds: [] as string[],
    categorySubmissionIds: [] as string[],
    categoryMergeId: null as string | null,
    categoryReadyAt: null as string | null,
    submissionIds: [] as string[],
    submittedMemberIds: [] as string[],
    needsSubmissionMemberIds: [...currentMemberIds],
    staleMemberIds: [] as string[],
    bySubmitter: {} as Record<string, OnboardingEstimateAnswer[]>,
  };
  const categoryState = onboardingCategoryState(household);
  if (currentMemberIds.length !== 2 || categoryState.kind === "invalid") {
    return { ...base, kind: "invalid", reason: "malformed" };
  }
  if (categoryState.kind !== "complete") {
    return { ...base, kind: "categories-pending", reason: "categories" };
  }

  const categoryIds = [...categoryState.unionIds].sort((left, right) => left.localeCompare(right));
  const categoryRows = categoryIds.map((id) => household.categories.find((row) => (
    row.id === id && row.active && row.recordType === "category" && row.transactionType === "expense"
  )));
  const categorySubmissions = currentMemberIds
    .map((memberId) => currentSubmission(household, memberId, "categories"));
  const categoryReadyAt = latestIso([
    ...categorySubmissions.map((row) => row?.submittedAt ?? ""),
    ...(categoryState.merge ? [categoryState.merge.mergedAt] : []),
  ]);
  const scopedBase = {
    ...base,
    categoryIds,
    categorySubmissionIds: [...categoryState.submissionIds],
    categoryMergeId: categoryState.merge?.id ?? null,
    categoryReadyAt,
  };
  if (!categoryReadyAt || categoryIds.length === 0 || categoryRows.some((row) => !row)) {
    return { ...scopedBase, kind: "invalid", reason: "malformed" };
  }

  const labels = new Map(categoryRows.map((row) => [row!.id, row!.name]));
  const acceptedIds = new Set(categoryIds);
  const valid: OnboardingSubmission[] = [];
  const staleMemberIds: string[] = [];
  let reason: OnboardingEstimateState["reason"] = null;

  for (const memberId of currentMemberIds) {
    const submission = currentSubmission(household, memberId, "estimates");
    if (!submission) continue;
    if (JSON.stringify(submission.categoryIds) !== JSON.stringify(categoryIds)) {
      staleMemberIds.push(memberId);
      reason = reason ?? "stale";
      continue;
    }
    if (submission.estimates.some((row) => !acceptedIds.has(row.subcategoryId))) {
      staleMemberIds.push(memberId);
      reason = "untied";
      continue;
    }
    valid.push(submission);
  }

  const submittedMemberIds = valid.map((row) => row.memberId).sort();
  const needsSubmissionMemberIds = currentMemberIds.filter((id) => !submittedMemberIds.includes(id));
  const bySubmitter = Object.fromEntries(valid.map((submission) => [
    submission.memberId,
    answersFor(categoryIds, labels, submission),
  ]));
  return {
    ...scopedBase,
    kind: valid.length === currentMemberIds.length
      ? "complete"
      : valid.length === 1
        ? "waiting-member"
        : "collecting",
    reason,
    submissionIds: valid.map((row) => row.id).sort(),
    submittedMemberIds,
    needsSubmissionMemberIds,
    staleMemberIds: staleMemberIds.sort(),
    bySubmitter,
  };
}

/** Keep a malicious or stale UI from attaching guesses to another category. */
export function assertOnboardingEstimateScope(
  household: Household,
  estimates: ReadonlyArray<{ subcategoryId: string; amountCents: number }>,
): string[] {
  const categoryState = onboardingCategoryState(household);
  if (categoryState.kind !== "complete") {
    // Slice 18's low-level storage contract predates Chapter 9 and remains
    // independently testable on a pristine household. Once category work has
    // begun, however, a pending/invalid set must fail closed during races.
    const categoryWorkStarted = shapeOnboardingSubmissions(
      household.onboardingSubmissions,
      household.householdId,
    ).some((row) => row.kind === "categories");
    if (!categoryWorkStarted) return [];
    throw new ValidationError(CATEGORY_NOT_READY_ERROR);
  }
  const categoryIds = [...categoryState.unionIds].sort((left, right) => left.localeCompare(right));
  const acceptedIds = new Set(categoryIds);
  if (estimates.some((row) => !acceptedIds.has(row.subcategoryId))) {
    throw new ValidationError(CATEGORY_SCOPE_ERROR);
  }
  return categoryIds;
}

/** Validate a shaped estimate record at replay/accepted-write boundaries. */
export function assertOnboardingEstimateSubmissionScope(
  household: Household,
  submission: Pick<OnboardingSubmission, "categoryIds" | "estimates">,
): void {
  const expected = assertOnboardingEstimateScope(household, submission.estimates);
  if (JSON.stringify(submission.categoryIds) !== JSON.stringify(expected)) {
    throw new ValidationError(CATEGORY_SCOPE_ERROR);
  }
}
