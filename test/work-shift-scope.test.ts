import { describe, expect, it, vi } from "vitest";
import {
  runScopedWorkShift,
  workShiftScopeMatches,
  WORK_SHIFT_SCOPE_ERROR,
  type ScopedWorkShiftInput,
} from "../src/workShiftScope.ts";
import type { PostWorkShiftInput } from "../src/core/index.ts";

function pending(): ScopedWorkShiftInput {
  return {
    environment: "development",
    householdId: "HH-ONE",
    memberId: "MEM-001",
    input: { memberId: "MEM-001" } as PostWorkShiftInput,
  };
}

describe("Timesheet command scope", () => {
  it("invokes the posting command only while environment, household, and member still match", () => {
    const post = vi.fn((input: PostWorkShiftInput, review = null) => ({ input, review }));
    const scoped = pending();
    scoped.attendanceReview = {
      locationName: "Capra's Kitchen",
      rows: [{ coworkerId: "COW-001", status: "user-confirmed-absent" }],
      surpriseHelpers: ["Surprise Helper"],
    };
    expect(workShiftScopeMatches({ environment: "development", householdId: "HH-ONE" }, "MEM-001", scoped)).toBe(true);
    expect(runScopedWorkShift(
      { environment: "development", householdId: "HH-ONE" },
      "MEM-001",
      scoped,
      true,
      post,
    )).toEqual({
      input: expect.objectContaining({ memberId: "MEM-001", confirmDuplicate: true }),
      review: scoped.attendanceReview,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ confirmDuplicate: true }), scoped.attendanceReview);
  });

  it("does not invoke posting after a ledger, member, or environment change", () => {
    for (const [current, memberId] of [
      [{ environment: "development" as const, householdId: "HH-TWO" }, "MEM-001"],
      [{ environment: "development" as const, householdId: "HH-ONE" }, "MEM-002"],
      [{ environment: "production" as const, householdId: "HH-ONE" }, "MEM-001"],
    ] as const) {
      const post = vi.fn();
      expect(() => runScopedWorkShift(current, memberId, pending(), true, post)).toThrow(WORK_SHIFT_SCOPE_ERROR);
      expect(post).not.toHaveBeenCalled();
    }
  });
});
