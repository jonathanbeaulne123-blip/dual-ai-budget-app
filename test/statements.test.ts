import { describe, expect, it } from "vitest";
import {
  agedPayables,
  askHercules,
  auditOpinion,
  balanceSheet,
  bookBalanceAsOf,
  cashFlowStatement,
  catalogHousehold,
  closeBooksMonth,
  closePackageText,
  closedPeriodId,
  incomeStatement,
  isCosmeticUnlocked,
  isMonthClosed,
  liquidityWatch,
  markDuplicate,
  mergeKitchen,
  notesToFinancialStatements,
  postEntry,
  postTransfer,
  recordReconciliation,
  reopenBooksMonth,
  reversePostedMoney,
  seedDemoHousehold,
  statementOfChangesInEquity,
  subsequentEvents,
  talkHercules,
  ValidationError,
} from "../src/core/index.ts";
import { COSMETIC_BY_ID } from "../src/core/companion.ts";

const today = "2026-08-21";

describe("Audit Office", () => {
  it("issues an unmodified opinion when the demo journal balances and Health is clean enough to loaf", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const opinion = auditOpinion(household);
    expect(opinion.trialInBalance).toBe(true);
    expect(opinion.equationHolds).toBe(true);
    expect(["unmodified", "qualified"]).toContain(opinion.kind);
    expect(opinion.hercules).toMatch(/Unmodified|Qualified/);
    const sheet = balanceSheet(household);
    expect(sheet.holds).toBe(true);
    expect(sheet.assetCents).toBe(sheet.liabilityCents + sheet.equityCents);
    const income = incomeStatement(household, "2026-08");
    expect(income.netCents).toBe(income.incomeCents - income.expenseCents);
    const pack = closePackageText(household, "2026-08", today);
    expect(pack).toMatch(/HEARTH CLOSE PACKAGE/);
    expect(pack).toMatch(/AUDIT OPINION/);
    expect(pack).toMatch(/BALANCE SHEET/);
    expect(pack).toMatch(/STATEMENT OF CHANGES IN EQUITY/);
    expect(pack).toMatch(/WORKING CAPITAL/);
    expect(pack).toMatch(/NOTES TO THE FINANCIAL STATEMENTS/);
    expect(pack).not.toMatch(/INSERT INTO/);
    const equity = statementOfChangesInEquity(household, "2026-08");
    expect(equity.rolls).toBe(true);
    expect(equity.openingCents + equity.netIncomeCents).toBe(equity.closingCents);
    const notes = notesToFinancialStatements(household, "2026-08", today);
    expect(notes.length).toBeGreaterThanOrEqual(8);
    expect(notes.some((note) => /command kernel/i.test(note.body))).toBe(true);
  });

  it("treats Visa spend as non-cash and Visa payment as debt paydown", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "40",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "100",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    household = postTransfer(household, {
      date: today,
      amount: "40",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      confirmDuplicate: true,
    }).household;
    const cash = cashFlowStatement(household, "2026-08");
    expect(cash.cardSpendCents).toBe(4000);
    expect(cash.operatingInCents).toBe(10000);
    expect(cash.debtPaydownCents).toBe(4000);
    expect(cash.netCashCents).toBe(6000);
  });

  it("nets transfer reversals and reinstatements in cash flow", () => {
    const transfer = postTransfer(catalogHousehold(), {
      date: today,
      amount: "40",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      confirmDuplicate: true,
    });
    const reversed = reversePostedMoney(transfer.household, transfer.postedIds[0]!, {
      reversalDate: today,
    });
    expect(cashFlowStatement(reversed.household, "2026-08").debtPaydownCents).toBe(0);

    const reversalId = reversed.household.transactions.find((tx) => (
      tx.reversalOfId === transfer.postedIds[0]
    ))?.id;
    if (!reversalId) throw new Error("Missing transfer reversal");
    const reinstated = reversePostedMoney(reversed.household, reversalId, { reversalDate: today });
    expect(cashFlowStatement(reinstated.household, "2026-08").debtPaydownCents).toBe(4000);
  });

  it("counts only projected reversal lineage in subsequent events", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-07-15",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    });
    const transactionId = posted.postedIds.find((id) => id.startsWith("TXN-"));
    if (!transactionId) throw new Error("Missing expense row");
    const reversed = reversePostedMoney(posted.household, transactionId, { reversalDate: today });
    const reversalId = reversed.household.transactions.find((row) => row.reversalOfId === transactionId)?.id;
    if (!reversalId) throw new Error("Missing reversal row");
    const excluded = markDuplicate(reversed.household, reversalId, true).household;
    const reinstated = reversePostedMoney(excluded, reversalId, { reversalDate: today }).household;

    expect(subsequentEvents(reinstated, "2026-07", today)).toMatchObject({
      count: 0,
      incomeCents: 0,
      expenseCents: 0,
      hercules: "No subsequent events after 2026-07.",
    });
  });

  it("records a bank rec without posting money and unlocks audit spectacles when it ties", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "50.00",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "12.00",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    }).household;
    const book = bookBalanceAsOf(household, "ACC-CHEQUING", today);
    const specs = COSMETIC_BY_ID.get("specs")!;
    expect(isCosmeticUnlocked(household, specs, today)).toBe(false);
    const rec = recordReconciliation(household, {
      accountId: "ACC-CHEQUING",
      statementDate: today,
      statementAmount: book / 100,
      createdBy: "MEM-001",
    });
    expect(rec.postedIds).toEqual([rec.household.kitchen.books.reconciliations[0]!.id]);
    expect(rec.undo.commandKind).toBe("recordReconciliation");
    expect(rec.household.transactions).toHaveLength(household.transactions.length);
    expect(rec.household.kitchen.books.reconciliations[0]?.status).toBe("tied");
    expect(isCosmeticUnlocked(rec.household, specs, today)).toBe(true);
  });

  it("refuses posting into a closed month until you reopen, and still never lets Hercules write", () => {
    let household = catalogHousehold();
    household = closeBooksMonth(household, { monthKey: "2026-07", createdBy: "MEM-001" }).household;
    expect(isMonthClosed(household, "2026-07")).toBe(true);
    expect(isCosmeticUnlocked(household, COSMETIC_BY_ID.get("ink")!, today)).toBe(true);
    expect(() => postEntry(household, {
      date: "2026-07-15",
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
    })).toThrow(ValidationError);
    expect(() => postEntry(household, {
      date: "2026-07-15",
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      // @ts-expect-error the confirmClosedMonth bypass is gone
      confirmClosedMonth: true,
    })).toThrow(ValidationError);

    const asked = askHercules(household, "opinion", today);
    expect(asked.sentence).toMatch(/Unmodified|Qualified|Adverse/);
    const talk = talkHercules(household, "who are you", today, "ledger");
    expect(talk.spoken).toMatch(/auditor|don't write/i);

    const ink = COSMETIC_BY_ID.get("ink")!;
    expect(isCosmeticUnlocked(household, ink, today)).toBe(true);
    const reopened = reopenBooksMonth(household, "2026-07");
    expect(reopened.household.tombstones.some((row) => row.id === closedPeriodId("2026-07"))).toBe(true);
    const merged = mergeKitchen(household.kitchen, reopened.household.kitchen, reopened.household.tombstones);
    expect(merged.books.closedMonths).toHaveLength(0);
    const posted = postEntry(reopened.household, {
      date: "2026-07-15",
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    });
    expect(posted.household.transactions).toHaveLength(1);
  });

  it("ages repeating bills without naming who spent", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const aging = agedPayables(household, today);
    expect(aging.some((item) => item.bucket)).toBe(true);
    const asked = askHercules(household, "aged bills", today);
    expect(asked.sentence).not.toMatch(/Bianca spent|Jonathan spent/);
    const capital = askHercules(household, "working capital", today);
    expect(capital.sentence).toMatch(/Liquidity|ordinary|tight|uncertainty|Working capital/i);
    expect(capital.sentence).not.toMatch(/Bianca spent|Jonathan spent/);
    const liq = liquidityWatch(household, today);
    expect(["comfortable", "tight", "material-uncertainty"]).toContain(liq.goingConcern);
    const events = subsequentEvents(household, "2026-07", today);
    expect(events.hercules).not.toMatch(/Bianca|Jonathan/);
    const fieldwork = talkHercules(catalogHousehold(), "", today, "ledger");
    expect(fieldwork.spoken).toMatch(/Fieldwork/);
  });
});
