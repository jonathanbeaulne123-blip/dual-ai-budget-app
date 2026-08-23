import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/seed.ts";
import {
  postEntry,
  postShift,
  postTransfer,
  undo,
  reversePostedMoney,
} from "../src/core/commands.ts";
import { createWriteQueue } from "../src/core/writeQueue.ts";
import { shiftSettingsFingerprint } from "../src/core/shift.ts";
import { UNPUBLISHED_PHRASE } from "../src/api.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("write queue", () => {
  it("runs household writes in order even when they overlap", async () => {
    const enqueue = createWriteQueue();
    const order: number[] = [];
    const first = enqueue(async () => {
      await delay(30);
      order.push(1);
      return 1;
    });
    const second = enqueue(async () => {
      order.push(2);
      return 2;
    });
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });
});

describe("reverse and undo", () => {
  it("reverses an expense and can undo the reversing entry", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-21",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "QA milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const reversed = reversePostedMoney(posted.household, posted.postedIds[0]!);
    expect(reversed.household.transactions).toHaveLength(2);
    expect(reversed.household.transactions.some((tx) => tx.note === "QA milk")).toBe(true);
    expect(reversed.household.transactions.some((tx) => tx.reversalOfId === posted.postedIds[0])).toBe(true);
    const restored = undo(reversed.household, reversed.undo);
    expect(restored.transactions).toHaveLength(1);
    expect(restored.transactions[0]?.note).toBe("QA milk");
  });

  it("reverses both sides of a transfer without deleting the original pair", () => {
    const posted = postTransfer(catalogHousehold(), {
      date: "2026-08-21",
      amount: "40.00",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    expect(posted.household.transactions).toHaveLength(2);
    const reversed = reversePostedMoney(posted.household, posted.postedIds[0]!);
    expect(reversed.household.transactions).toHaveLength(4);
    expect(reversed.postedIds).toHaveLength(2);
  });

  it("reverses shift income and keeps the shift row", () => {
    const posted = postShift(catalogHousehold(), {
      date: "2026-08-21",
      memberId: "MEM-002",
      accountId: "ACC-CASH",
      sales: "100.00",
      cashTips: "10.00",
      ccTips: "5.00",
      hours: "4.00",
      settingsFingerprint: shiftSettingsFingerprint(catalogHousehold().shiftSettings),
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    expect(posted.household.shifts).toHaveLength(1);
    expect(posted.household.transactions).toHaveLength(2);
    const wages = posted.household.transactions.find((tx) => tx.note.startsWith("Wages"));
    const reversed = reversePostedMoney(posted.household, wages!.id);
    expect(reversed.household.shifts).toHaveLength(1);
    expect(reversed.household.transactions.length).toBeGreaterThanOrEqual(4);
  });

  it("tombstones posted ids even when undo gets a stale current snapshot", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-21",
      type: "expense",
      amount: "0.01",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "QA TEST UNDO",
      place: "QA TEST UNDO",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    expect(posted.undo.postedIds).toEqual(posted.postedIds);
    const stale = catalogHousehold();
    const restored = undo(stale, posted.undo);
    expect(restored.transactions).toHaveLength(0);
    expect(restored.tombstones.some((item) => item.id === posted.postedIds[0])).toBe(true);
  });
});

describe("join copy", () => {
  it("does not tell Bianca a missing phrase is right", () => {
    expect(UNPUBLISHED_PHRASE).not.toMatch(/phrase is right/i);
    expect(UNPUBLISHED_PHRASE).toMatch(/Check the three words/);
  });
});
