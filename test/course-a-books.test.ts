import { describe, expect, it } from "vitest";
import {
  ValidationError,
  addRecurrence,
  applySitDown,
  catalogHousehold,
  compileHousehold,
  correctPostedAmount,
  monthKeyFromDateKey,
  monthSummary,
  postEntry,
  postShift,
  postTransfer,
  reversePostedMoney,
  setBudget,
  shiftSettingsFingerprint,
  sitDownPreview,
  todayKey,
  trialBalance,
  undo,
} from "../src/core/index.ts";

const actor = { createdBy: "MEM-001" };

function groceryActual(household: ReturnType<typeof catalogHousehold>, monthKey: string) {
  return monthSummary(household, monthKey).categories.find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES")?.actualCents ?? 0;
}

describe("Course A books verbs", () => {
  it("lets setBudget write $0 and a positive job", () => {
    const monthKey = monthKeyFromDateKey(todayKey());
    const zeroed = setBudget(catalogHousehold(), {
      monthKey,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: 0,
    });
    expect(monthSummary(zeroed.household, monthKey).categories.find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES")?.budgetedCents).toBe(0);
    const funded = setBudget(zeroed.household, {
      monthKey,
      subcategoryId: "SUB-LIFE-FUN",
      amount: "40.00",
    });
    expect(monthSummary(funded.household, monthKey).categories.find((row) => row.subcategoryId === "SUB-LIFE-FUN")?.budgetedCents).toBe(4000);
  });

  it("adds a first-time bill without posting, and postNow writes when due", () => {
    const today = todayKey();
    const added = addRecurrence(catalogHousehold(), {
      cadence: "monthly",
      nextDate: today,
      type: "expense",
      amount: 45,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "First hydro",
      origin: "manual",
      kind: "bill",
    });
    expect(added.household.recurrences.some((row) => row.note === "First hydro" && row.origin === "manual")).toBe(true);
    expect(added.household.transactions.some((tx) => tx.note === "First hydro")).toBe(false);

    const posted = addRecurrence(catalogHousehold(), {
      cadence: "monthly",
      nextDate: today,
      type: "expense",
      amount: 45,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "First hydro",
      origin: "manual",
      kind: "bill",
      postNow: true,
    });
    expect(posted.household.transactions.some((tx) => tx.note === "First hydro")).toBe(true);
    expect(posted.postedIds.length).toBeGreaterThan(1);

    expect(() => addRecurrence(catalogHousehold(), {
      cadence: "monthly",
      nextDate: "2099-01-01",
      type: "expense",
      amount: 45,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Future hydro",
      postNow: true,
    })).toThrow(ValidationError);
  });

  it("nets a same-month reverse to zero grocery actuals and stays in balance", () => {
    const today = todayKey();
    const monthKey = monthKeyFromDateKey(today);
    const start = catalogHousehold();
    const before = groceryActual(start, monthKey);
    const posted = postEntry(start, {
      date: today,
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Wrong milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    expect(groceryActual(posted.household, monthKey) - before).toBe(1250);
    const reversed = reversePostedMoney(posted.household, posted.postedIds[0]!, actor);
    expect(groceryActual(reversed.household, monthKey)).toBe(before);
    expect(trialBalance(compileHousehold(reversed.household)).inBalance).toBe(true);
  });

  it("corrects 12.50 to 9.00 with one undo back to the original row", () => {
    const today = todayKey();
    const monthKey = monthKeyFromDateKey(today);
    const start = catalogHousehold();
    const before = groceryActual(start, monthKey);
    const posted = postEntry(start, {
      date: today,
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Wrong milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const id = posted.postedIds[0]!;
    const corrected = correctPostedAmount(posted.household, id, "9.00", actor);
    expect(groceryActual(corrected.household, monthKey) - before).toBe(900);
    expect(corrected.household.transactions.some((tx) => tx.reversalOfId === id)).toBe(true);
    expect(corrected.household.transactions.some((tx) => tx.note === "Wrong milk" && tx.amountCents === 900 && !tx.reversalOfId)).toBe(true);
    expect(trialBalance(compileHousehold(corrected.household)).inBalance).toBe(true);

    const restored = undo(corrected.household, corrected.undo);
    expect(restored.transactions.find((tx) => tx.id === id)?.amountCents).toBe(1250);
    expect(restored.transactions.some((tx) => tx.reversalOfId === id)).toBe(false);
  });

  it("refuses transfer, shift, and same-amount corrections", () => {
    const today = todayKey();
    const moved = postTransfer(catalogHousehold(), {
      date: today,
      amount: "40.00",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    expect(() => correctPostedAmount(moved.household, moved.postedIds[0]!, "10.00", actor)).toThrow(/transfer/i);

    const posted = postEntry(catalogHousehold(), {
      date: today,
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    expect(() => correctPostedAmount(posted.household, posted.postedIds[0]!, "12.50", actor)).toThrow(/same amount/i);

    const shift = postShift(catalogHousehold(), {
      date: today,
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
    const wages = shift.household.transactions.find((tx) => tx.source === "shift");
    expect(wages).toBeTruthy();
    expect(() => correctPostedAmount(shift.household, wages!.id, "10.00", actor)).toThrow(/shift/i);
  });

  it("honors typed sit-down job amounts including $0", () => {
    const monthKey = monthKeyFromDateKey(todayKey());
    const start = catalogHousehold();
    const preview = sitDownPreview(start, monthKey);
    expect(preview.rows.some((row) => row.subcategoryId === "SUB-FOOD-GROCERIES" && !row.alreadyPlanned)).toBe(true);
    const applied = applySitDown(start, monthKey, { "SUB-FOOD-GROCERIES": 0 });
    expect(monthSummary(applied.household, preview.targetMonth).categories.find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES")?.budgetedCents).toBe(0);
  });
});
