import { describe, expect, it } from "vitest";
import {
  addAccount,
  archiveAccount,
  askHercules,
  booksEquation,
  cashFlowStatement,
  catalogHousehold,
  compileHousehold,
  creditCardView,
  ensureHouseholdShape,
  householdWallet,
  householdTableStory,
  isCosmeticUnlocked,
  markInvestmentValue,
  normalizeAccountKind,
  postCardInterest,
  postCardRewards,
  postEntry,
  postSavingsInterest,
  postTransfer,
  runHealthCheck,
  seedDemoHousehold,
  shapeAccount,
  talkHercules,
  trialBalance,
} from "../src/core/index.ts";
import { COSMETIC_BY_ID } from "../src/core/companion.ts";

const today = "2026-08-21";

describe("The Accounts Floor", () => {
  it("migrates old cash accounts to other and fills desks", () => {
    expect(normalizeAccountKind("cash")).toBe("other");
    expect(normalizeAccountKind("checking")).toBe("chequing");
    const shaped = shapeAccount({
      id: "ACC-CASH",
      name: "Cash / tips",
      kind: "cash" as never,
      currency: "CAD",
      active: true,
      ownerMemberId: "MEM-002",
    });
    expect(shaped.kind).toBe("other");
    expect(shaped.institution).toBe("");
    expect(shaped.credit).toBeNull();
    const loaded = ensureHouseholdShape({
      ...catalogHousehold(),
      accounts: [{
        id: "ACC-OLD",
        name: "Jar",
        kind: "cash" as never,
        currency: "CAD",
        active: true,
        ownerMemberId: "joint",
      } as never],
    });
    expect(loaded.accounts[0]?.kind).toBe("other");
  });

  it("opens a second card and refuses to archive the last active account", () => {
    let household = catalogHousehold();
    household = addAccount(household, {
      name: "Amex Cobalt",
      kind: "credit",
      creditLimit: 8000,
      aprPercent: 20.99,
      cashbackPercent: 1,
      groceryCashbackPercent: 5,
    }).household;
    const amex = household.accounts.find((account) => account.name === "Amex Cobalt");
    expect(amex?.kind).toBe("credit");
    expect(amex?.credit?.aprBps).toBe(2099);
    expect(amex?.credit?.creditLimitCents).toBe(800000);
    expect(() => {
      let next = household;
      for (const account of household.accounts.filter((row) => row.active)) {
        next = archiveAccount(next, account.id).household;
      }
    }).toThrow(/at least one active/i);
  });

  it("treats utilization and cashback as looks until a command posts", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-10",
      type: "expense",
      amount: "100",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    }).household;
    const visa = household.accounts.find((account) => account.id === "ACC-VISA")!;
    const asOf = "2026-08-15";
    const before = creditCardView(household, visa, asOf);
    expect(before.cashbackCycleCents).toBe(300);
    expect(before.owedCents).toBe(10000);
    expect(household.transactions.filter((tx) => /reward|interest/i.test(tx.note)).length).toBe(0);
    const findings = runHealthCheck(household);
    expect(findings.some((finding) => /utilization/i.test(finding.message))).toBe(false);

    household = postCardRewards(household, { accountId: "ACC-VISA", as: "statement-credit", date: asOf }).household;
    const after = creditCardView(household, household.accounts.find((account) => account.id === "ACC-VISA")!, asOf);
    expect(after.owedCents).toBe(9700);
    expect(after.cashbackPostedCents).toBe(300);
    const books = compileHousehold(household);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(booksEquation(books).holds).toBe(true);
  });

  it("posts card interest onto the card and keeps paydown as a transfer", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-07-25",
      type: "expense",
      amount: "400",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    }).household;
    const visa = household.accounts.find((account) => account.id === "ACC-VISA")!;
    const view = creditCardView(household, visa, today);
    expect(view.paidInFull).toBe(false);
    expect(view.estimatedInterestCents).toBeGreaterThan(0);
    const posted = postCardInterest(household, { accountId: "ACC-VISA", date: today });
    expect(posted.postedIds.length).toBe(1);
    const after = creditCardView(posted.household, visa, today);
    expect(after.owedCents).toBe(view.owedCents + view.estimatedInterestCents);
  });

  it("marks TFSA market value without posting money and treats contributions as investing cash flow", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "200",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    household = postTransfer(household, {
      date: today,
      amount: "80",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-TFSA",
      note: "TFSA contribution",
      confirmDuplicate: true,
    }).household;
    const marked = markInvestmentValue(household, { accountId: "ACC-TFSA", markedValue: 95, markedAt: today });
    expect(marked.postedIds).toEqual([]);
    const tile = householdWallet(marked.household, today).tiles.find((row) => row.account.id === "ACC-TFSA");
    expect(tile?.investment?.costBasisCents).toBe(8000);
    expect(tile?.investment?.markedValueCents).toBe(9500);
    expect(tile?.investment?.unrealizedCents).toBe(1500);
    const cash = cashFlowStatement(marked.household, "2026-08");
    expect(cash.investingOutCents).toBe(8000);
    expect(cash.debtPaydownCents).toBe(0);
  });

  it("groups the wallet and still balances the demo journal", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const wallet = householdWallet(household, today);
    expect(wallet.groups.map((group) => group.kind)).toEqual(["chequing", "savings", "credit", "investment", "receivable", "other"]);
    expect(wallet.tiles.some((tile) => tile.account.id === "ACC-MC")).toBe(true);
    expect(householdTableStory(wallet).map((group) => group.kind)).toEqual(["chequing", "savings", "credit"]);
    expect(wallet.story.map((group) => group.kind)).toContain("investment");
    const books = compileHousehold(household);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(booksEquation(books).holds).toBe(true);
    expect(runHealthCheck(household).filter((finding) => finding.section === "Books")).toEqual([]);
  });

  it("keeps Visa paydown as cash, not investing, and answers card questions without naming people", () => {
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
    expect(cash.investingOutCents).toBe(0);
    expect(cash.netCashCents).toBe(6000);

    const asked = askHercules(household, "What's on the Visa?", today);
    expect(asked.kind).toBe("answer");
    expect(asked.sentence).not.toMatch(/Bianca|Jonathan/);
    const talk = talkHercules(household, "utilization", today, "home");
    expect(talk.spoken).not.toMatch(/Bianca|Jonathan/);
    expect(talk.spoken.length).toBeLessThanOrEqual(120);

    const clip = COSMETIC_BY_ID.get("clip")!;
    expect(isCosmeticUnlocked(catalogHousehold(), clip, today)).toBe(true);
  });

  it("does not post savings interest until asked, then credits the savings account", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "1200",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    household = postTransfer(household, {
      date: today,
      amount: "1200",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-SAVINGS",
      confirmDuplicate: true,
    }).household;
    const before = household.transactions.length;
    const posted = postSavingsInterest(household, { accountId: "ACC-SAVINGS", date: today });
    expect(posted.postedIds.length).toBe(1);
    expect(posted.household.transactions.length).toBe(before + 1);
    const interest = posted.household.transactions.find((tx) => tx.id === posted.postedIds[0]);
    expect(interest?.type).toBe("income");
    expect(interest?.accountId).toBe("ACC-SAVINGS");
  });
});
