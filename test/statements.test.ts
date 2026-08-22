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
  mergeKitchen,
  NeedsConfirmationError,
  notesToFinancialStatements,
  postEntry,
  postTransfer,
  recordReconciliation,
  reopenBooksMonth,
  seedDemoHousehold,
  statementOfChangesInEquity,
  subsequentEvents,
  talkHercules,
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
    expect(rec.postedIds).toEqual([]);
    expect(rec.household.transactions).toHaveLength(household.transactions.length);
    expect(rec.household.kitchen.books.reconciliations[0]?.status).toBe("tied");
    expect(isCosmeticUnlocked(rec.household, specs, today)).toBe(true);
  });

  it("asks for a second look before posting into a closed month and still never lets Hercules write", () => {
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
    })).toThrow(NeedsConfirmationError);
    const posted = postEntry(household, {
      date: "2026-07-15",
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmClosedMonth: true,
      confirmDuplicate: true,
    });
    expect(posted.household.transactions).toHaveLength(1);
    household = reopenBooksMonth(posted.household, "2026-07").household;
    expect(isMonthClosed(household, "2026-07")).toBe(false);

    const asked = askHercules(posted.household, "opinion", today);
    expect(asked.sentence).toMatch(/Unmodified|Qualified|Adverse/);
    const talk = talkHercules(posted.household, "who are you", today, "ledger");
    expect(talk.spoken).toMatch(/auditor|don't write/i);
    expect(posted.postedIds.length).toBe(1);

    const ink = COSMETIC_BY_ID.get("ink")!;
    expect(isCosmeticUnlocked(posted.household, ink, today)).toBe(true);
    const reopened = reopenBooksMonth(posted.household, "2026-07");
    expect(reopened.household.tombstones.some((row) => row.id === closedPeriodId("2026-07"))).toBe(true);
    const merged = mergeKitchen(posted.household.kitchen, reopened.household.kitchen, reopened.household.tombstones);
    expect(merged.books.closedMonths).toHaveLength(0);
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
