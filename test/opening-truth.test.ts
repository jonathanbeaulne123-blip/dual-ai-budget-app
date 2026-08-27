import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/seed.ts";
import {
  booksEquation,
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
  buildOpeningTruthDraft,
  hasPostedOpeningTruth,
} from "../src/core/index.ts";
import { shapeAccounts } from "../src/core/accountKinds.ts";

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
    { id: "ACC-JON-CASH", name: "Jonathan cash", kind: "other", ownerMemberId: "MEM-002" },
    { id: "ACC-BIA-CASH", name: "Bianca cash", kind: "other", ownerMemberId: "MEM-001" },
  ], "2026-01-01T00:00:00.000Z");
  return household;
}

describe("opening truth draft", () => {
  it("balances assets and debts into opening equity", () => {
    const draft = buildOpeningTruthDraft(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 100_00 },
        { accountId: "ACC-VISA", amountCents: 40_00 },
      ],
    });
    expect(draft.assetCents).toBe(100_00);
    expect(draft.liabilityCents).toBe(40_00);
    expect(draft.openingEquityCents).toBe(60_00);
    expect(draft.balanced).toBe(true);
  });

  it("refuses another member’s personal account", () => {
    expect(() =>
      buildOpeningTruthDraft(bareHousehold(), {
        asOfDate: "2026-09-01",
        createdBy: "MEM-002",
        lines: [{ accountId: "ACC-BIA-CASH", amountCents: 5_00 }],
      }),
    ).toThrow(/Personal ledger/);
  });
});

describe("postOpeningBalances", () => {
  it("posts assets-only opening and keeps the equation", () => {
    const posted = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-assets",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 250_00 }],
    });
    const books = compileHousehold(posted.household);
    const tb = trialBalance(books);
    const equation = booksEquation(books);
    expect(tb.inBalance).toBe(true);
    expect(equation.holds).toBe(true);
    expect(equation.assetCents).toBe(250_00);
    expect(equation.openingEquityCents).toBe(250_00);
    expect(equation.netIncomeCents).toBe(0);
    expect(hasPostedOpeningTruth(posted.household)).toBe(true);
  });

  it("posts debt-only and mixed openings", () => {
    const debt = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-debt",
      lines: [{ accountId: "ACC-VISA", amountCents: 80_00 }],
    });
    let equation = booksEquation(compileHousehold(debt.household));
    expect(equation.holds).toBe(true);
    expect(equation.liabilityCents).toBe(80_00);
    expect(equation.openingEquityCents).toBe(-80_00);

    const mixed = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-mixed",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 200_00 },
        { accountId: "ACC-VISA", amountCents: 50_00 },
        { accountId: "ACC-JON-CASH", amountCents: 20_00 },
      ],
    });
    equation = booksEquation(compileHousehold(mixed.household));
    expect(equation.holds).toBe(true);
    expect(equation.assetCents).toBe(220_00);
    expect(equation.liabilityCents).toBe(50_00);
    expect(equation.openingEquityCents).toBe(170_00);
  });

  it("does not change P&L, cash flow, or budget actuals", () => {
    const base = bareHousehold();
    const opened = postOpeningBalances(base, {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-pnl",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 100_00 },
        { accountId: "ACC-VISA", amountCents: 25_00 },
      ],
    }).household;
    const month = monthSummary(opened, "2026-09");
    expect(month.incomeActualCents).toBe(0);
    expect(month.expenseActualCents).toBe(0);
    expect(incomeStatement(opened, "2026-09").netCents).toBe(0);
    expect(cashFlowStatement(opened, "2026-09").netCashCents).toBe(0);
    expect(booksEquation(compileHousehold(opened)).netIncomeCents).toBe(0);
  });

  it("keeps personal opening rows out of the household view", () => {
    const posted = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-personal",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 10_00 },
        { accountId: "ACC-JON-CASH", amountCents: 5_00 },
      ],
    }).household;
    const shared = householdForView(posted, "MEM-002", "household");
    expect(shared.transactions.some((tx) => tx.accountId === "ACC-JON-CASH")).toBe(false);
    expect(shared.transactions.some((tx) => tx.accountId === "ACC-CHEQUING")).toBe(true);
    const personal = householdForView(posted, "MEM-002", "personal");
    expect(personal.transactions.some((tx) => tx.accountId === "ACC-JON-CASH")).toBe(true);
  });

  it("is idempotent for the same confirmation id", () => {
    const first = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-once",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 10_00 }],
    });
    const second = postOpeningBalances(first.household, {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-once",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 10_00 }],
    });
    expect(second.household.transactions.filter((tx) => tx.source === "opening")).toHaveLength(1);
    expect(second.warnings[0]).toMatch(/already posted/i);
  });

  it("reverses a whole opening batch and restores zero net worth", () => {
    const posted = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-rev",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 100_00 },
        { accountId: "ACC-VISA", amountCents: 40_00 },
      ],
    });
    const openingId = posted.postedIds[0]!;
    const reversed = reversePostedMoney(posted.household, openingId, { createdBy: "MEM-002" });
    const equation = booksEquation(compileHousehold(reversed.household));
    expect(equation.holds).toBe(true);
    expect(equation.assetCents).toBe(0);
    expect(equation.liabilityCents).toBe(0);
    expect(equation.openingEquityCents).toBe(0);
  });

  it("leaves catalog household equation holding after opening on a fresh shell", () => {
    // Sanity: existing catalog still compiles after EQ-OPENING chart addition.
    const books = compileHousehold(catalogHousehold());
    expect(trialBalance(books).inBalance).toBe(true);
    expect(booksEquation(books).holds).toBe(true);
    expect(runHealthCheck(catalogHousehold()).every((f) => f.section !== "Books" || !/equation/i.test(f.message))).toBe(true);
  });

  it("still holds the equation after opening plus a later expense", () => {
    const opened = postOpeningBalances(bareHousehold(), {
      asOfDate: "2026-09-01",
      createdBy: "MEM-002",
      confirmationId: "open-then-spend",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 100_00 }],
    }).household;
    // bare household has no categories — use catalog for expense path
    const catalog = catalogHousehold();
    const withOpen = postOpeningBalances(catalog, {
      asOfDate: "2026-08-01",
      createdBy: "MEM-002",
      confirmationId: "open-catalog",
      lines: [{ accountId: catalog.accounts.find((a) => a.kind === "chequing")!.id, amountCents: 500_00 }],
    }).household;
    const spent = postEntry(withOpen, {
      date: "2026-08-21",
      type: "expense",
      amount: 12,
      accountId: withOpen.accounts.find((a) => a.kind === "chequing")!.id,
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    expect(booksEquation(compileHousehold(spent.household)).holds).toBe(true);
    expect(monthSummary(spent.household, "2026-08").expenseActualCents).toBeGreaterThan(0);
    void opened;
  });
});
