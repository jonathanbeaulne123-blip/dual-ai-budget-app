import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addGoal,
  addRecurrence,
  assembleHousehold,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  monthObligations,
  postEntry,
  postOneRecurrence,
  proposeHouseholdFundContribution,
  splitForSync,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

function fund(household: Household, amount = "1000"): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount,
    date: "2026-09-01",
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  }).household;
}

describe("month obligations", () => {
  it("folds two recurrences, one bounded goal claim, and one posted Fund purchase through commands", () => {
    let household = fund(configuredFund());
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-20",
      type: "expense",
      amount: "100",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Hydro",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }).household;
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-25",
      type: "expense",
      amount: "50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Internet",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 3000, destinationAccountId: "ACC-VISA" },
    }).household;
    const goal = addGoal(household, { name: "Halifax", target: "60", shared: true, ownerMemberId: BIANCA });
    household = goal.household;
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-30",
      type: "transfer",
      amount: "75",
      accountId: "ACC-CHEQUING",
      transferToAccountId: "ACC-GOALS",
      goalId: goal.postedIds[0]!,
      note: "Standing · jar · Halifax",
    }).household;
    const purchase = postEntry(household, {
      date: "2026-09-10",
      type: "expense",
      amount: "40",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Groceries",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" },
    });
    household = purchase.household;

    const result = monthObligations(household, "2026-09", "2026-09-12");

    expect(result.tiesToProjection).toBe(true);
    expect(result.owedCents).toBe(23000);
    expect(result.rows).toMatchObject([
      { label: "Groceries", date: "2026-09-10", amountCents: 4000, source: "posted", transactionId: purchase.postedIds[0] },
      { label: "Hydro", date: "2026-09-20", amountCents: 10000, source: "recurrence" },
      { label: "Internet", date: "2026-09-25", amountCents: 3000, source: "recurrence" },
      { label: "Halifax · goal claim", date: "2026-09-30", amountCents: 6000, source: "goal-claim", goalId: goal.postedIds[0] },
    ]);
  });

  it("counts a posted recurring purchase once", () => {
    let household = fund(configuredFund(), "100");
    const added = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-10",
      type: "expense",
      amount: "25",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Phone",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    });
    household = added.household;
    const recurrenceId = added.postedIds[0]!;
    const posted = postOneRecurrence(household, recurrenceId, "2026-09-10");

    const result = monthObligations(posted.household, "2026-09", "2026-09-10");

    expect(result.tiesToProjection).toBe(true);
    expect(result.owedCents).toBe(2500);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ source: "posted", recurrenceId, amountCents: 2500 });
  });

  it("keeps a Personal purchase label private while preserving its shared Fund obligation", () => {
    let household = fund(configuredFund(), "100");
    household = postEntry(household, {
      date: "2026-09-10",
      type: "expense",
      amount: "25",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Private pharmacy detail",
      createdBy: BIANCA,
      visibility: "personal",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 2500, destinationAccountId: "ACC-VISA" },
    }).household;
    const shared = assembleHousehold(splitForSync(household, BIANCA).shared, null);

    const result = monthObligations(shared, "2026-09", "2026-09-10");

    expect(result.tiesToProjection).toBe(true);
    expect(result.rows).toMatchObject([{ label: "Household purchase", source: "posted", amountCents: 2500 }]);
    expect(JSON.stringify(result)).not.toContain("Private pharmacy detail");
  });

  it("refuses to tie when a stale recurrence would duplicate its posted occurrence", () => {
    let household = fund(configuredFund(), "100");
    const added = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-10",
      type: "expense",
      amount: "25",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Phone",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    });
    const recurrenceId = added.postedIds[0]!;
    household = postOneRecurrence(added.household, recurrenceId, "2026-09-10").household;
    household = {
      ...household,
      recurrences: household.recurrences.map((row) => row.id === recurrenceId ? { ...row, nextDate: "2026-09-10" } : row),
    };

    const result = monthObligations(household, "2026-09", "2026-09-10");

    expect(result.tiesToProjection).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.source).toBe("posted");
  });

  it("does not re-project a posted goal standing order when its recurrence is stale", () => {
    let household = configuredFund();
    const goal = addGoal(household, { name: "Halifax", target: "100", shared: true, ownerMemberId: BIANCA });
    household = goal.household;
    const added = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-30",
      type: "transfer",
      amount: "25",
      accountId: "ACC-CHEQUING",
      transferToAccountId: "ACC-GOALS",
      goalId: goal.postedIds[0]!,
      note: "Standing · jar · Halifax",
    });
    const recurrenceId = added.postedIds[0]!;
    household = postOneRecurrence(added.household, recurrenceId, "2026-09-30").household;
    household = {
      ...household,
      recurrences: household.recurrences.map((row) => row.id === recurrenceId ? { ...row, nextDate: "2026-09-30" } : row),
    };

    const result = monthObligations(household, "2026-09", "2026-09-01");

    expect(result.tiesToProjection).toBe(false);
    expect(result.rows.some((row) => row.source === "goal-claim")).toBe(false);
  });

  it("uses the Fund's recurrence projection instead of importing or defining another one", () => {
    const source = readFileSync(new URL("../src/core/monthObligations.ts", import.meta.url), "utf8");
    expect(source).toContain("projectHouseholdFundRecurrenceDates");
    expect(source).toContain("projectHouseholdFundRecurrenceOccurrences");
    expect(source).not.toMatch(/from ["']\.\/recurrence\.ts["']/);
    expect(source).not.toContain("projectCadence");
    expect(source).not.toContain("advanceCadence");
  });
});
