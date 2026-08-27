import { describe, expect, it } from "vitest";
import { NeedsConfirmationError, postWorkShift, seedDemoHousehold, type PostWorkShiftInput } from "../src/core/index.ts";
import { resolveDuplicateRetry } from "../src/shiftDuplicateRetry.ts";

const today = "2026-08-27";

function biancaShiftInput(household: ReturnType<typeof seedDemoHousehold>): PostWorkShiftInput {
  const job = household.workJobs.find((row) => row.memberId === "MEM-001" && row.active)!;
  const role = job.roles.find((row) => row.active)!;
  return {
    date: today,
    memberId: "MEM-001",
    jobId: job.id,
    roleId: role.id,
    workedHours: "6.25",
    paidBreakHours: "0",
    sales: "250",
    salesByField: { [job.salesFields[0]!.id]: "250" },
    cashTips: "40",
    cardTips: "55",
    customersServed: 28,
    staffingCount: 4,
    eventTag: "regular",
    cashTipsAccountId: job.defaults.cashTipsAccountId,
    wagesDepositAccountId: job.defaults.wagesDepositAccountId,
    cardTipsDepositAccountId: job.defaults.cardTipsDepositAccountId,
    createdBy: "MEM-001",
  };
}

describe("Shift Confirm duplicate retry", () => {
  it("retries postWorkShift when Add is still on the expense pad", () => {
    expect(resolveDuplicateRetry({
      pendingWorkShift: biancaShiftInput(seedDemoHousehold({ today, environment: "development" })),
      confirmCode: "sameShiftDay",
      tab: "home",
    })).toEqual({ kind: "work-shift", openAdd: true, setShiftMode: true });

    expect(resolveDuplicateRetry({
      pendingWorkShift: biancaShiftInput(seedDemoHousehold({ today, environment: "development" })),
      confirmCode: "sameShiftDay",
      tab: "shift",
    })).toEqual({ kind: "work-shift", openAdd: false, setShiftMode: true });
  });

  it("does not treat a leftover shift draft as the retry for an expense duplicate", () => {
    expect(resolveDuplicateRetry({
      pendingWorkShift: biancaShiftInput(seedDemoHousehold({ today, environment: "development" })),
      confirmCode: "duplicate",
      tab: "shift",
    })).toEqual({ kind: "add-form", openAdd: true, setShiftMode: false });
  });

  it("second same-day Confirm posts another shift, never an expense", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const input = biancaShiftInput(household);
    const first = postWorkShift(household, input);
    expect(first.postedIds.some((id) => id.startsWith("SHIFT-"))).toBe(true);
    expect(first.household.shifts.filter((shift) => shift.memberId === "MEM-001" && shift.date === today)).toHaveLength(1);

    expect(() => postWorkShift(first.household, input)).toThrow(NeedsConfirmationError);
    try {
      postWorkShift(first.household, input);
    } catch (caught) {
      expect(caught).toBeInstanceOf(NeedsConfirmationError);
      expect((caught as NeedsConfirmationError).code).toBe("sameShiftDay");
    }

    const second = postWorkShift(first.household, { ...input, confirmDuplicate: true });
    expect(second.postedIds.some((id) => id.startsWith("SHIFT-"))).toBe(true);
    expect(second.household.shifts.filter((shift) => shift.memberId === "MEM-001" && shift.date === today)).toHaveLength(2);
    const newTx = second.household.transactions.filter((tx) => !first.household.transactions.some((old) => old.id === tx.id));
    expect(newTx.length).toBeGreaterThan(0);
    expect(newTx.every((tx) => String(tx.sourceId || "").startsWith("SHIFT-"))).toBe(true);
  });
});
