import type { Environment, PostWorkShiftInput, ShiftAttendanceReviewDraft } from "./core/index.ts";

export const WORK_SHIFT_SCOPE_ERROR = "That Timesheet draft belongs to another ledger or member. Pull it again.";

export type WorkShiftCommandScope = {
  environment: Environment;
  householdId: string;
  memberId: string;
};

export type ScopedWorkShiftInput = WorkShiftCommandScope & {
  input: PostWorkShiftInput;
  attendanceReview?: ShiftAttendanceReviewDraft | null;
};

export function workShiftScopeMatches(
  current: Pick<WorkShiftCommandScope, "environment" | "householdId"> | null,
  currentMemberId: string | null | undefined,
  pending: ScopedWorkShiftInput | null,
): pending is ScopedWorkShiftInput {
  return Boolean(
    pending
    && current
    && current.environment === pending.environment
    && current.householdId === pending.householdId
    && currentMemberId === pending.memberId
    && pending.input.memberId === pending.memberId,
  );
}

export function runScopedWorkShift<T>(
  current: Pick<WorkShiftCommandScope, "environment" | "householdId">,
  currentMemberId: string | null | undefined,
  pending: ScopedWorkShiftInput,
  confirmDuplicate: boolean,
  post: (input: PostWorkShiftInput, attendanceReview?: ShiftAttendanceReviewDraft | null) => T,
): T {
  if (!workShiftScopeMatches(current, currentMemberId, pending)) throw new Error(WORK_SHIFT_SCOPE_ERROR);
  return post({ ...pending.input, confirmDuplicate }, pending.attendanceReview);
}
