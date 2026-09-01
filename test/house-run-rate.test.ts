import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  RUN_RATE_MIN_WEEKS,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  houseRunRate,
  postEntry,
  proposeHouseholdFundContribution,
} from "../src/core/index.ts";
import type { Household, Visibility } from "../src/core/types.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const OPENED = "2026-01-01";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: OPENED,
    createdBy: BIANCA,
  }).household;
}

function postFundExpense(
  household: Household,
  input: { date: string; dollars: number; visibility?: Visibility; subcategoryId?: string },
): { household: Household; transactionId: string } {
  const posted = postEntry(household, {
    date: input.date,
    type: "expense",
    amount: input.dollars,
    accountId: "ACC-VISA",
    subcategoryId: input.subcategoryId ?? "SUB-FOOD-GROCERIES",
    createdBy: JONATHAN,
    visibility: input.visibility ?? "household",
    confirmDuplicate: true,
    funding: {
      fundId: HOUSEHOLD_FUND_ID,
      fundedCents: input.dollars * 100,
      destinationAccountId: "ACC-VISA",
    },
  });
  return { household: posted.household, transactionId: posted.postedIds[0]! };
}

describe("Household Fund run rate", () => {
  it("watches one complete week without extrapolating or suggesting", () => {
    const household = postFundExpense(configuredFund(), { date: OPENED, dollars: 100 }).household;
    const result = houseRunRate(household, "2026-01-07");

    expect(RUN_RATE_MIN_WEEKS).toBe(3);
    expect(result).toMatchObject({
      weeksWatched: 1,
      confidence: "watching",
      observedMonthlyCents: 0,
      lowMonthlyCents: 0,
      highMonthlyCents: 0,
      byCategory: [],
      suggestion: null,
      copy: "Three weeks in, I'll have a first read on what the house costs. Right now I've watched 1.",
    });
  });

  it("reports a five-week provisional reading from Fund-backed purchases only", () => {
    let household = configuredFund();
    for (const [date, dollars] of [
      ["2026-01-01", 100],
      ["2026-01-08", 200],
      ["2026-01-15", 300],
      ["2026-01-22", 400],
      ["2026-01-29", 500],
    ] as const) {
      household = postFundExpense(household, { date, dollars }).household;
    }
    household = postFundExpense(household, { date: "2026-02-05", dollars: 777 }).household;
    household = postEntry(household, {
      date: "2026-01-29",
      type: "expense",
      amount: 999,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: 5000,
      date: "2026-01-29",
    });
    household = confirmHouseholdFundContribution(proposal.household, {
      memberId: BIANCA,
      proposalEventId: proposal.postedIds[0]!,
    }).household;

    const result = houseRunRate(household, "2026-02-10");
    expect(result).toMatchObject({
      weeksWatched: 5,
      confidence: "provisional",
      observedMonthlyCents: 130000,
      lowMonthlyCents: 43333,
      highMonthlyCents: 216667,
      suggestion: {
        monthlyNeedCents: 130000,
        note: "Observed Fund spending annualised from 5 complete weeks; this is a household need, not a split.",
      },
      copy: "On 5 weeks, the house looks like about $1300.00 a month — somewhere between $433.33 and $2166.67. Ask me again at the end of the month.",
    });
    expect(result.byCategory).toEqual([{
      subcategoryId: "SUB-FOOD-GROCERIES",
      label: "Groceries",
      monthlyCents: 130000,
      weeksSeen: 5,
    }]);
  });

  it("settles at ten complete weeks", () => {
    let household = configuredFund();
    for (let week = 0; week < 10; week += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + week * 7)).toISOString().slice(0, 10);
      household = postFundExpense(household, { date, dollars: 100 }).household;
    }

    expect(houseRunRate(household, "2026-03-11")).toMatchObject({
      weeksWatched: 10,
      confidence: "settled",
      observedMonthlyCents: 43333,
      lowMonthlyCents: 43333,
      highMonthlyCents: 43333,
      copy: "The house has run about $433.33 a month across 10 weeks.",
    });
  });

  it("nets Fund refunds and redacts Personal category provenance", () => {
    let household = configuredFund();
    const purchase = postFundExpense(household, { date: "2026-01-01", dollars: 300 });
    household = purchase.household;
    household = postEntry(household, {
      date: "2026-01-08",
      type: "refund",
      amount: 100,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      refundOfId: purchase.transactionId,
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household = postFundExpense(household, {
      date: "2026-01-15",
      dollars: 50,
      visibility: "personal",
      subcategoryId: "SUB-LIFE-FUN",
    }).household;

    const result = houseRunRate(household, "2026-01-21");
    expect(result.observedMonthlyCents).toBe(36111);
    expect(result.byCategory).toEqual([
      { subcategoryId: "SUB-FOOD-GROCERIES", label: "Groceries", monthlyCents: 28889, weeksSeen: 1 },
      { subcategoryId: "HOUSEHOLD-PURCHASE", label: "Household purchase", monthlyCents: 7222, weeksSeen: 1 },
    ]);
    expect(result.byCategory.some((row) => row.subcategoryId === "SUB-LIFE-FUN" || row.label === "Fun")).toBe(false);
  });

  it("keeps every result free of person-level contribution instructions", () => {
    let household = configuredFund();
    for (let week = 0; week < 10; week += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + week * 7)).toISOString().slice(0, 10);
      household = postFundExpense(household, { date, dollars: 25 + week }).household;
    }

    for (const today of ["2026-01-07", "2026-02-04", "2026-03-11"]) {
      const text = JSON.stringify(houseRunRate(household, today)).toLowerCase();
      expect(text).not.toContain("should contribute");
      expect(text).not.toContain("you need to put in");
    }
  });

  it("fails closed before every early watching return when Fund facts are corrupt", () => {
    const posted = postFundExpense(configuredFund(), { date: OPENED, dollars: 25 }).household;
    const malformedConfig = {
      ...posted,
      householdFund: { ...posted.householdFund!, openedOn: "not-a-date" },
    };
    expect(() => houseRunRate(malformedConfig, "2026-01-07")).toThrow(/configured fund/i);

    const wrongMember = {
      ...posted,
      fundEvents: posted.fundEvents?.map((event) => ({ ...event, createdBy: "MEM-UNKNOWN" })),
    };
    expect(() => houseRunRate(wrongMember, "2025-12-31")).toThrow(/wrong fund or member/i);
  });
});
