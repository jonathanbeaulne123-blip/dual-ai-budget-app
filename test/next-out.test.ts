// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addAccount,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  fundWalk,
  nextOut,
  proposeHouseholdFundContribution,
  setHouseholdFundMonthPlan,
  spokenFor,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const nextOutSource = readFileSync(new URL("../src/core/nextOut.ts", import.meta.url), "utf8");
const stageSource = readFileSync(new URL("../src/NextOutStage.tsx", import.meta.url), "utf8");

function configuredFund(openedOn = "2026-08-01"): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn,
    createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, contributorMemberId: string, amount: string, date: string): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: contributorMemberId, contributorMemberId, amount, date,
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA, proposalEventId: proposed.postedIds[0]!,
  }).household;
}

function expenseRecurrence(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly", nextDate: date, type: "expense", amount,
    accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

/**
 * The canonical run: three actual contributions, one future one on the 18th,
 * a buffer on file, and four obligations — the last two of which are the
 * only ones that ever push the walk negative.
 */
function canonicalMonth(): Household {
  let household = configuredFund();
  household = contribute(household, BIANCA, "1000", "2026-08-01");
  household = contribute(household, BIANCA, "500", "2026-09-04");
  household = contribute(household, JONATHAN, "300", "2026-09-08");
  household = contribute(household, JONATHAN, "400", "2026-09-18");
  household = expenseRecurrence(household, "700", "2026-09-20", "Rent · our share");
  household = expenseRecurrence(household, "500", "2026-09-24", "Groceries");
  household = expenseRecurrence(household, "1200", "2026-09-26", "Vet · Marmalade");
  const goal = addGoal(household, { name: "Halifax", target: "150", shared: true, ownerMemberId: BIANCA });
  household = addRecurrence(goal.household, {
    cadence: "monthly", nextDate: "2026-09-30", type: "transfer", amount: "150",
    accountId: "ACC-CHEQUING", transferToAccountId: "ACC-GOALS", goalId: goal.postedIds[0]!,
    note: "Standing · jar · Halifax",
  }).household;
  return setHouseholdFundMonthPlan(household, {
    memberId: BIANCA, monthKey: "2026-09", target: "0", buffer: "1100",
  }).household;
}

describe("nextOut", () => {
  it("walks the canonical month in date order, marking Vet as the only break", () => {
    const walk = fundWalk(canonicalMonth(), "2026-09", "2026-09-12");
    const table = nextOut(walk);

    expect(table.rows.map((row) => row.label)).toEqual([
      "Rent · our share", "Groceries", "Vet · Marmalade", "Halifax · goal claim",
    ]);
    expect(table.rows.map((row) => row.leavesCents)).toEqual([150000, 100000, -20000, -35000]);
    expect(table.rows.map((row) => row.breaks)).toEqual([false, false, true, false]);
    expect(table.breakRow?.label).toBe("Vet · Marmalade");
    expect(table.breakRow?.leavesCents).toBe(-20000);
    expect(table.rows.filter((row) => row.breaks)).toHaveLength(1);
    expect(table.totalCents).toBe(700_00 + 500_00 + 1200_00 + 150_00);
    expect(table.rows.map((row) => row.source)).toEqual([
      "recurrence", "recurrence", "recurrence", "goal-claim",
    ]);
  });

  it("marks every row under the agreed buffer, and only those rows", () => {
    const walk = fundWalk(canonicalMonth(), "2026-09", "2026-09-12");
    const table = nextOut(walk);
    // Buffer is $1,100. 150000 and 100000 clear it; the two negative rows don't.
    expect(table.rows.map((row) => row.underBuffer)).toEqual([false, true, true, true]);
  });

  it("marks nothing under the buffer for a household with no buffer on file", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "1000", "2026-08-01");
    household = expenseRecurrence(household, "1200", "2026-09-10", "Vet");
    const walk = fundWalk(household, "2026-09", "2026-09-01");
    const table = nextOut(walk);

    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.leavesCents).toBe(-20000);
    expect(table.rows[0]?.underBuffer).toBe(false);
  });

  it("returns an empty table, and null breakRow, for a month with nothing left owed", () => {
    const household = contribute(configuredFund(), BIANCA, "500", "2026-09-01");
    const walk = fundWalk(household, "2026-09", "2026-09-01");
    const table = nextOut(walk);

    expect(table.rows).toEqual([]);
    expect(table.breakRow).toBeNull();
    expect(table.totalCents).toBe(0);
  });
});

describe("spokenFor", () => {
  it("reads pool and claimed off the same walk, free when there's nothing due before the next inflow", () => {
    const walk = fundWalk(canonicalMonth(), "2026-09", "2026-09-12");
    const result = spokenFor(walk, "2026-09-12");

    expect(result).toEqual({
      poolCents: 180000, claimedCents: 0, freeCents: 180000, overCents: 0, throughDate: "2026-09-18",
      throughConfidence: "confirmed",
    });
  });

  it("goes over when a bill due before the next inflow outruns the pool", () => {
    let household = configuredFund("2026-09-01");
    household = contribute(household, BIANCA, "100", "2026-09-01");
    household = expenseRecurrence(household, "150", "2026-09-08", "Insurance");
    household = contribute(household, JONATHAN, "200", "2026-09-20");
    const walk = fundWalk(household, "2026-09", "2026-09-05");

    expect(spokenFor(walk, "2026-09-05")).toEqual({
      poolCents: 10000, claimedCents: 15000, freeCents: 0, overCents: 5000, throughDate: "2026-09-20",
      throughConfidence: "confirmed",
    });
  });

  it("falls back to the month's last day when nothing is projected to come in", () => {
    let household = configuredFund("2026-09-01");
    household = contribute(household, BIANCA, "100", "2026-09-01");
    household = expenseRecurrence(household, "50", "2026-09-10", "Phone");
    const walk = fundWalk(household, "2026-09", "2026-09-05");

    expect(spokenFor(walk, "2026-09-05")).toEqual({
      poolCents: 10000, claimedCents: 5000, freeCents: 5000, overCents: 0, throughDate: "2026-09-30",
      throughConfidence: "month-end",
    });
  });

  it("keeps an observed contribution explicit instead of presenting it as confirmed", () => {
    const walk = fundWalk(canonicalMonth(), "2026-09", "2026-09-12");
    const observedWalk = {
      ...walk,
      points: walk.points.map((point) => (
        !point.actual && point.deltaCents > 0 ? { ...point, estimated: true } : point
      )),
    };

    expect(spokenFor(observedWalk, "2026-09-12").throughConfidence).toBe("observed");
    expect(stageSource).toContain("before an observed contribution; it is not confirmed");
  });

  it("never carries a balance below zero into the pool", () => {
    const household = expenseRecurrence(configuredFund("2026-09-01"), "50", "2026-09-10", "Phone");
    const walk = fundWalk(household, "2026-09", "2026-09-05");
    expect(spokenFor(walk, "2026-09-05").poolCents).toBe(0);
  });

  it("free and over are never both non-zero", () => {
    for (const result of [
      spokenFor(fundWalk(canonicalMonth(), "2026-09", "2026-09-12"), "2026-09-12"),
      spokenFor(fundWalk(canonicalMonth(), "2026-09", "2026-09-26"), "2026-09-26"),
    ]) {
      expect(result.freeCents === 0 || result.overCents === 0).toBe(true);
    }
  });
});

describe("the nextOut fences", () => {
  it("computes no balance of its own", () => {
    expect(nextOutSource).not.toContain("projectHouseholdFund");
    expect(stageSource).not.toContain("projectHouseholdFund");
  });

  it("reserves a personal-account recurrence without exposing its label", () => {
    let household = configuredFund("2026-09-01");
    household = contribute(household, BIANCA, "100", "2026-09-01");
    const personal = addAccount(household, {
      name: "Bianca private card",
      kind: "credit",
      ownerMemberId: BIANCA,
      scope: "personal",
    });
    household = addRecurrence(personal.household, {
      cadence: "monthly",
      nextDate: "2026-09-20",
      type: "expense",
      amount: "50",
      accountId: personal.postedIds[0]!,
      subcategoryId: "SUB-LIFE-FUN",
      note: "Bianca private therapy",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }).household;

    const table = nextOut(fundWalk(household, "2026-09", "2026-09-05"));
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({ label: "Household obligation", amountCents: 5000 });
    expect(JSON.stringify(table)).not.toContain("Bianca private therapy");
  });
});
