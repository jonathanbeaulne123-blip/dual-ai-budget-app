import { describe, expect, it } from "vitest";
import {
  addRecurrence,
  assembleHousehold,
  catalogHousehold,
  mergeShared,
  postOneRecurrence,
  recordBillPayment,
  setRecurrenceGoogleSync,
  splitForSync,
  updateRecurrence,
} from "../src/core/index.ts";
import { dueOccurrenceReview, type DueOccurrenceRequest } from "../src/core/dueOccurrenceReview.ts";

function bill() {
  const added = addRecurrence(catalogHousehold(), {
    cadence: "monthly",
    nextDate: "2026-09-01",
    type: "expense",
    amount: "50",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "Synthetic rent",
    splits: [{ party: "MEM-001", amountCents: 5000 }],
  });
  return { unpaid: added.household, id: added.household.recurrences.at(-1)!.id };
}

describe("recurrence payment merge", () => {
  it("keeps paid occurrences when a later calendar sync wins the template", () => {
    const { unpaid, id } = bill();
    const paid = recordBillPayment(unpaid, {
      recurrenceId: id,
      occurrenceDate: "2026-09-01",
      paymentDate: "2026-09-03",
      amount: "47",
      accountId: "ACC-VISA",
      createdBy: "MEM-001",
    }).household;
    const synced = setRecurrenceGoogleSync(unpaid, [{
      recurrenceId: id,
      memberId: "MEM-002",
      calendarId: "cal-bianca",
      eventId: "evt-rent",
    }]).household;
    const merged = assembleHousehold(
      mergeShared(splitForSync(paid, "MEM-001").shared, splitForSync(synced, "MEM-002").shared),
      splitForSync(paid, "MEM-001").personal,
    );
    const row = merged.recurrences.find((item) => item.id === id)!;
    expect(row.payments).toEqual([expect.objectContaining({ occurrenceDate: "2026-09-01", paymentDate: "2026-09-03", amountCents: 4700 })]);
    expect(row.nextDate).toBe("2026-10-01");
    expect(row.googleSync["MEM-002"]).toEqual({ calendarId: "cal-bianca", eventId: "evt-rent" });
    expect(merged.transactions.filter((tx) => tx.source === "recurring" && tx.sourceId === id)).toHaveLength(1);
    expect(() => postOneRecurrence(merged, id, "2026-09-08")).toThrow(/already posted|not due/);
  });

  it("keeps payment history when a later note edit wins last-write-wins", () => {
    const { unpaid, id } = bill();
    const paid = recordBillPayment(unpaid, {
      recurrenceId: id,
      occurrenceDate: "2026-09-01",
      paymentDate: "2026-09-01",
      amount: "50",
      accountId: "ACC-VISA",
      createdBy: "MEM-001",
    }).household;
    const edited = updateRecurrence(unpaid, {
      id,
      cadence: "monthly",
      nextDate: "2026-09-01",
      type: "expense",
      amount: "50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Synthetic rent — 2bed",
      splits: [{ party: "MEM-001", amountCents: 5000 }],
    }).household;

    const merged = assembleHousehold(
      mergeShared(splitForSync(paid, "MEM-001").shared, splitForSync(edited, "MEM-002").shared),
      splitForSync(paid, "MEM-001").personal,
    );
    const row = merged.recurrences.find((item) => item.id === id)!;
    expect(row.note).toBe("Synthetic rent — 2bed");
    expect(row.payments).toEqual([expect.objectContaining({ occurrenceDate: "2026-09-01" })]);
    expect(row.nextDate).toBe("2026-10-01");
    const posted = postOneRecurrence(merged, id, "2026-09-08", { allowNotDue: true });
    const recurring = posted.household.transactions.filter((tx) => tx.source === "recurring" && tx.sourceId === id);
    expect(recurring).toHaveLength(2);
    expect(recurring.filter((tx) => tx.date === "2026-09-01")).toHaveLength(1);
    expect(recurring.some((tx) => tx.date === "2026-10-01")).toBe(true);
  });

  it("refuses to post a paid occurrence even if nextDate was rewound", () => {
    const { unpaid, id } = bill();
    const paid = recordBillPayment(unpaid, {
      recurrenceId: id,
      occurrenceDate: "2026-09-01",
      paymentDate: "2026-09-03",
      amount: "47",
      accountId: "ACC-VISA",
      createdBy: "MEM-001",
    }).household;
    const rewound = {
      ...paid,
      recurrences: paid.recurrences.map((row) => row.id === id ? { ...row, nextDate: "2026-09-01" as const } : row),
    };
    expect(() => postOneRecurrence(rewound, id, "2026-09-08")).toThrow(/already posted/);
    const request: DueOccurrenceRequest = {
      environment: rewound.environment,
      householdId: rewound.householdId,
      memberId: "MEM-001",
      view: "household",
      today: "2026-09-08",
      recurrenceId: id,
      occurrenceDate: "2026-09-01",
    };
    expect(dueOccurrenceReview(rewound, request).kind).toBe("unavailable");
  });
});
