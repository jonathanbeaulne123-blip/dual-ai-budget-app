import { describe, expect, it } from "vitest";
import { shapeAccounts } from "../src/core/accountKinds.ts";
import {
  booksEquation,
  buildOpeningTruthDraft,
  cashFlowStatement,
  compileHousehold,
  emptyHousehold,
  householdForView,
  incomeStatement,
  monthSummary,
  postEntry,
  postOpeningBalances,
  reversePostedMoney,
  runHealthCheck,
  trialBalance,
} from "../src/core/index.ts";

function bareHousehold() {
  const household = emptyHousehold("development");
  household.timezone = "America/Toronto";
  household.members = [
    { id: "MEM-001", name: "Bianca", color: "#c45c26", active: true, updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "MEM-002", name: "Jonathan", color: "#2f6b4f", active: true, updatedAt: "2026-01-01T00:00:00.000Z" },
  ];
  household.accounts = shapeAccounts([
    { id: "ACC-CHEQUING", name: "Chequing", kind: "chequing", ownerMemberId: "joint" },
    { id: "ACC-VISA", name: "Visa", kind: "credit", ownerMemberId: "joint" },
    { id: "ACC-JON-CASH", name: "Jonathan cash", kind: "other", ownerMemberId: "MEM-002", scope: "personal" },
    { id: "ACC-BIA-CASH", name: "Bianca cash", kind: "other", ownerMemberId: "MEM-001", scope: "personal" },
  ], "2026-01-01T00:00:00.000Z");
  return household;
}

describe("opening truth", () => {
  it("balances assets and debts into opening equity and refuses partner Personal accounts", () => {
    const draft = buildOpeningTruthDraft(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 100_00 },
        { accountId: "ACC-VISA", amountCents: 40_00 },
      ],
    });
    expect(draft).toMatchObject({ assetCents: 100_00, liabilityCents: 40_00, openingEquityCents: 60_00, balanced: true });
    expect(() => buildOpeningTruthDraft(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      lines: [{ accountId: "ACC-BIA-CASH", amountCents: 5_00 }],
    })).toThrow(/Personal ledger/);
  });

  it("posts one idempotent batch to balance sheet only", () => {
    const first = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "OPEN-ONE",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 3000_00 },
        { accountId: "ACC-VISA", amountCents: 400_00 },
      ],
    });
    const again = postOpeningBalances(first.household, {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "OPEN-ONE",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 1 }],
    });
    const equation = booksEquation(compileHousehold(again.household));
    expect(first.postedIds).toHaveLength(2);
    expect(first.undo.commandKind).toBe("postOpeningBalances");
    expect(again.household.transactions).toHaveLength(2);
    expect(again.warnings[0]).toMatch(/already posted/i);
    expect(equation).toMatchObject({ assetCents: 3000_00, liabilityCents: 400_00, openingEquityCents: 2600_00, netIncomeCents: 0, holds: true });
    expect(trialBalance(compileHousehold(again.household)).inBalance).toBe(true);
    expect(monthSummary(again.household, "2026-09")).toMatchObject({ incomeActualCents: 0, expenseActualCents: 0 });
    expect(incomeStatement(again.household, "2026-09").netCents).toBe(0);
    expect(cashFlowStatement(again.household, "2026-09").netCashCents).toBe(0);
    expect(runHealthCheck(again.household).filter((finding) => finding.section === "Books")).toEqual([]);
    expect(() => postOpeningBalances(first.household, {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "OPEN-TWO",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 1 }],
    })).toThrow(/already posted/i);
  });

  it("keeps Personal rows scoped and reverses the complete mixed batch", () => {
    const opened = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "OPEN-MIXED",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 100_00 },
        { accountId: "ACC-VISA", amountCents: 40_00 },
        { accountId: "ACC-JON-CASH", amountCents: 20_00 },
      ],
    });
    expect(householdForView(opened.household, "MEM-002", "household").transactions.map((row) => row.accountId)).not.toContain("ACC-JON-CASH");
    expect(householdForView(opened.household, "MEM-002", "personal").transactions.map((row) => row.accountId)).toContain("ACC-JON-CASH");
    const reversed = reversePostedMoney(opened.household, opened.postedIds[0]!, { createdBy: "MEM-002", reversalDate: "2026-09-02" });
    expect(reversed.postedIds).toHaveLength(3);
    expect(booksEquation(compileHousehold(reversed.household))).toMatchObject({ assetCents: 0, liabilityCents: 0, openingEquityCents: 0, holds: true });
    expect(() => reversePostedMoney(reversed.household, opened.postedIds[1]!, { createdBy: "MEM-002", reversalDate: "2026-09-03" })).toThrow(/already reversed/i);
  });

  it("keeps the equation after later ordinary activity", () => {
    let household = bareHousehold();
    household.categories = [
      { id: "CAT-FOOD", parentId: null, recordType: "group", name: "Food", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "SUB-GROCERY", parentId: "CAT-FOOD", recordType: "category", name: "Groceries", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 2, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    household = postOpeningBalances(household, { asOfDate: "2026-09-01", createdBy: "MEM-002", confirmationId: "OPEN-SPEND", lines: [{ accountId: "ACC-CHEQUING", amountCents: 500_00 }] }).household;
    household = postEntry(household, { date: "2026-09-02", type: "expense", amount: 12, accountId: "ACC-CHEQUING", subcategoryId: "SUB-GROCERY", createdBy: "MEM-002", confirmDuplicate: true }).household;
    expect(booksEquation(compileHousehold(household)).holds).toBe(true);
    expect(() => postOpeningBalances(household, {
      asOfDate: "2026-09-03", createdBy: "MEM-002", confirmationId: "OPEN-LATE",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 1 }],
    })).toThrow(/already posted/i);
  });

  it("allows a corrected opening only after the complete original batch is reversed and before ordinary activity", () => {
    const opened = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01", createdBy: "MEM-002", confirmationId: "OPEN-WRONG",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 100_00 }],
    });
    const reversed = reversePostedMoney(opened.household, opened.postedIds[0]!, { createdBy: "MEM-002", reversalDate: "2026-09-01" });
    const corrected = postOpeningBalances(reversed.household, {
      asOfDate: "2026-09-01", createdBy: "MEM-002", confirmationId: "OPEN-CORRECTED",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 125_00 }],
    });
    expect(booksEquation(compileHousehold(corrected.household))).toMatchObject({ assetCents: 125_00, openingEquityCents: 125_00, holds: true });
  });

  it("refuses opening truth after ordinary accepted money", () => {
    const household = bareHousehold();
    household.categories = [
      { id: "CAT-FOOD", parentId: null, recordType: "group", name: "Food", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "SUB-GROCERY", parentId: "CAT-FOOD", recordType: "category", name: "Groceries", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 2, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    const spent = postEntry(household, { date: "2026-09-01", type: "expense", amount: 12, accountId: "ACC-CHEQUING", subcategoryId: "SUB-GROCERY", createdBy: "MEM-002", confirmDuplicate: true }).household;
    expect(() => postOpeningBalances(spent, {
      asOfDate: "2026-09-01", createdBy: "MEM-002", confirmationId: "OPEN-AFTER-MONEY",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 500_00 }],
    })).toThrow(/first accepted money/i);
  });
});
