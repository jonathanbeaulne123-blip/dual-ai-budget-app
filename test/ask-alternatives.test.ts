import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addGoal,
  addRecurrence,
  askAlternatives,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  householdAsk,
  proposeHouseholdFundContribution,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

function addBill(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly",
    nextDate: date,
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

function addGoalClaim(household: Household, name: string, amount: string, date: string): Household {
  const goal = addGoal(household, { name, target: amount, shared: true, ownerMemberId: BIANCA });
  return addRecurrence(goal.household, {
    cadence: "monthly",
    nextDate: date,
    type: "transfer",
    amount,
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!,
    note: `Standing · jar · ${name}`,
  }).household;
}

function contribute(household: Household, amount: string): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: BIANCA,
    contributorMemberId: BIANCA,
    amount,
    date: "2026-09-01",
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  }).household;
}

describe("Ask alternatives", () => {
  it("offers the canonical Halifax claim as the other door from $340 to $40", () => {
    let household = configuredFund();
    household = addBill(household, "40", "2026-09-20", "Phone");
    household = addGoalClaim(household, "Halifax", "300", "2026-09-30");

    const ask = householdAsk(household, "2026-09-12");

    expect(ask.askCents).toBe(34000);
    const expectedRecurrence = household.recurrences.find((row) => row.note.includes("Halifax"))!;
    expect(askAlternatives(ask)).toEqual([{
      goalId: expectedRecurrence.goalId,
      recurrenceId: expectedRecurrence.id,
      claimDate: "2026-09-30",
      label: "Halifax",
      claimCents: 30000,
      askIfDeferredCents: 4000,
      copy: "Or move Halifax to next month, and the ask is $40.00.",
    }]);
  });

  it("never offers a household bill as something to move", () => {
    const ask = householdAsk(addBill(configuredFund(), "340", "2026-09-20", "Hydro"), "2026-09-12");

    expect(ask.askCents).toBe(34000);
    expect(askAlternatives(ask)).toEqual([]);
  });

  it("offers a partly unfunded goal but omits a fully funded goal", () => {
    let partlyFunded = addGoalClaim(configuredFund(), "Halifax", "300", "2026-09-30");
    partlyFunded = contribute(partlyFunded, "100");
    let fullyFunded = addGoalClaim(configuredFund(), "Halifax", "300", "2026-09-30");
    fullyFunded = contribute(fullyFunded, "300");

    expect(askAlternatives(householdAsk(partlyFunded, "2026-09-12"))).toMatchObject([{
      label: "Halifax",
      claimCents: 30000,
      askIfDeferredCents: 0,
    }]);
    expect(askAlternatives(householdAsk(fullyFunded, "2026-09-12"))).toEqual([]);
  });

  it("orders alternatives by largest claim, then label and goal id", () => {
    let household = configuredFund();
    household = addGoalClaim(household, "Winter reserve", "125", "2026-09-28");
    household = addGoalClaim(household, "Halifax", "300", "2026-09-29");
    household = addGoalClaim(household, "Appliances", "125", "2026-09-30");

    expect(askAlternatives(householdAsk(household, "2026-09-12")).map((row) => row.label)).toEqual([
      "Halifax",
      "Appliances",
      "Winter reserve",
    ]);
  });

  it("fails closed on an untied or mismatched Ask and does not mutate the input", () => {
    let household = addGoalClaim(configuredFund(), "Halifax", "300", "2026-09-30");
    const ask = householdAsk(household, "2026-09-12");
    const before = structuredClone(ask);
    const untied = { ...ask, register: { ...ask.register, tiesToProjection: false } };

    expect(askAlternatives(untied)).toEqual([]);
    expect(askAlternatives({ ...ask, askCents: ask.askCents - 1 })).toEqual([]);
    expect(askAlternatives({ ...ask, askCents: -1 })).toEqual([]);
    expect(askAlternatives(ask)).toHaveLength(1);
    expect(ask).toEqual(before);
  });

  it("uses only canonical goal-claim rows with their exact recurrence identity", () => {
    const source = readFileSync(new URL("../src/core/ask.ts", import.meta.url), "utf8");

    expect(source).toContain('const GOAL_CLAIM_PREFIX = "goal-claim:"');
    expect(source).toContain("row.recurrenceId");
    expect(source).toContain("row.goalId !== goalId");
    expect(source).not.toContain('"posted"');
    expect(source).not.toContain("monthObligations");
  });
});
