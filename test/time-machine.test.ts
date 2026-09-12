import { describe, expect, it } from "vitest";
import { fundContributionReviewDigest } from "../src/core/fundContributionSources.ts";
import {
  HOUSEHOLD_FUND_ID,
  activeHouseholdFundEvents,
  addGoal,
  catalogHousehold,
  compareMonths,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  contributeToGoal,
  fundLensForPeriod,
  fundLensToday,
  goalMonthSeries,
  goalSavedAsOf,
  householdFundOperatingDelta,
  monthForecast,
  monthMemories,
  monthState,
  monthView,
  postEntry,
  projectHouseholdFund,
  projectHouseholdFundAsOf,
  proposeHouseholdFundContribution,
  thisTimeLastYear,
  timelineBeads,
  timelineRange,
  yearShape,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";

/** A household with money in July, August and September, so the past is real. */
function threeMonths(): Household {
  let household = configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-07-01",
    createdBy: BIANCA,
  }).household;
  for (const [date, amount] of [["2026-07-03", "800"], ["2026-08-03", "900"], ["2026-09-03", "1000"]] as const) {
    const proposal = proposeHouseholdFundContribution(household, {
      source: { version: 1, kind: "external-received", explanation: "Synthetic test contribution from untracked savings." },
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount,
      date,
    });
    household = proposal.household;
    household = confirmHouseholdFundContribution(household, {
      received: true,
      expectedProposalDigest: fundContributionReviewDigest(household, proposal.postedIds[0]!),
      memberId: BIANCA,
      proposalEventId: proposal.postedIds[0]!,
    }).household;
  }
  for (const [date, amount] of [["2026-07-10", "120"], ["2026-08-11", "260"], ["2026-09-08", "140"]] as const) {
    household = postEntry(household, {
      date,
      type: "expense",
      amount,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
  }
  return household;
}

function balanceThrough(household: Household, through: string): number {
  return activeHouseholdFundEvents(household, HOUSEHOLD_FUND_ID)
    .filter((event) => event.date <= through)
    .reduce((sum, event) => sum + householdFundOperatingDelta(event), 0);
}

describe("the as-of foundation", () => {
  it("leaves every present-day Fund reading exactly as it was", () => {
    const household = threeMonths();
    expect(projectHouseholdFundAsOf(household, fundLensToday(TODAY))).toEqual(projectHouseholdFund(household, TODAY));
  });

  it("reads a past month at that month's own close, not today's balance", () => {
    const household = threeMonths();
    const july = projectHouseholdFundAsOf(household, fundLensForPeriod("2026-07", TODAY));
    expect(july.operatingBalanceCents).toBe(balanceThrough(household, "2026-07-31"));
    expect(july.operatingBalanceCents).not.toBe(projectHouseholdFund(household, TODAY).operatingBalanceCents);
    // A month that is over has nothing still upcoming in it, so its free-to-spend
    // is arithmetic inside one month rather than across two.
    expect(july.upcomingReserveCents).toBe(0);
    expect(july.freeToSpendCents).toBe(
      july.operatingBalanceCents - july.transferDueCents + july.transferCreditCents,
    );
  });

  it("reads a month ahead from its first day, with the whole month still to come", () => {
    const household = threeMonths();
    const lens = fundLensForPeriod("2026-11", TODAY);
    expect(lens.anchor).toBe("2026-11-01");
    const november = projectHouseholdFundAsOf(household, lens);
    expect(november.operatingBalanceCents).toBe(balanceThrough(household, "2026-11-01"));
  });

  it("never lets one projection mix two months", () => {
    for (const period of ["2026-07", "2026-08", "2026-09", "2026-10"]) {
      const lens = fundLensForPeriod(period, TODAY);
      expect(lens.period).toBe(period);
      expect(lens.anchor.slice(0, 7)).toBe(period);
      expect(lens.asOf).toBe(lens.anchor);
    }
  });
});

describe("goals get a history", () => {
  it("derives a per-month series and an as-of balance from goalContributions", () => {
    let household = addGoal(catalogHousehold(), { name: "Japan", target: "5000", shared: true }).household;
    const goalId = household.goals.at(-1)!.id;
    for (const [date, amount] of [["2026-07-15", "200"], ["2026-08-15", "300"], ["2026-09-05", "250"]] as const) {
      household = contributeToGoal(household, goalId, amount, { createdBy: JONATHAN, date }).household;
    }
    expect(goalSavedAsOf(household, goalId, "2026-07-31")).toBe(20000);
    expect(goalSavedAsOf(household, goalId, "2026-08-31")).toBe(50000);
    const series = goalMonthSeries(household, goalId, { from: "2026-07", to: "2026-09" });
    expect(series.map((row) => row.balanceCents)).toEqual([20000, 50000, 75000]);
    expect(series[1]!.addedCents).toBe(30000);
  });
});

describe("the ribbon", () => {
  it("gives one bead per month, each carrying that month's own figures", () => {
    const household = threeMonths();
    const beads = timelineBeads(household, TODAY, { from: "2026-07", to: "2026-10" });
    expect(beads.map((bead) => bead.monthKey)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(beads.map((bead) => bead.state)).toEqual(["behind", "behind", "now", "ahead"]);
    expect(beads[0]!.expenseCents).toBe(12000);
    expect(beads[1]!.expenseCents).toBe(26000);
    expect(beads[3]!.signal).toBe("planned");
    // Each bead's Fund figure is that month's, not today's.
    expect(beads[0]!.fundCents).toBe(balanceThrough(household, "2026-07-31"));
    expect(beads[1]!.fundCents).toBe(balanceThrough(household, "2026-08-31"));
  });

  it("reaches back to the first month with anything in it", () => {
    const household = threeMonths();
    expect(timelineRange(household, TODAY).to).toBe("2027-03");
    expect(monthState("2026-09", TODAY)).toBe("now");
  });
});

describe("one period per page", () => {
  it("hands a month view its own state and copy", () => {
    const household = threeMonths();
    const behind = monthView(household, "2026-07", TODAY);
    const ahead = monthView(household, "2026-12", TODAY);
    expect(behind.state).toBe("behind");
    expect(behind.stateLine).toMatch(/not rewritten/);
    expect(ahead.state).toBe("ahead");
    expect(ahead.stateLine).toMatch(/Expected, not posted/);
    expect(behind.fund.operatingBalanceCents).toBe(balanceThrough(household, "2026-07-31"));
  });
});

describe("comparison", () => {
  it("says what changed, what is new and what stopped", () => {
    let household = threeMonths();
    household = postEntry(household, {
      date: "2026-08-20",
      type: "expense",
      amount: "75",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    const comparison = compareMonths(household, "2026-07", "2026-08");
    const utilities = comparison.lines.find((row) => row.id === "SUB-HOUSING-ELECTRIC");
    expect(utilities?.change).toBe("new");
    expect(comparison.expenseDeltaCents).toBe(26000 + 7500 - 12000);
    expect(comparison.headlines.length).toBeGreaterThan(0);
  });
});

describe("the memory layer", () => {
  it("remembers a bank that filled, from dated records only", () => {
    let household = addGoal(catalogHousehold(), { name: "Tires", target: "300", shared: true }).household;
    const goalId = household.goals.at(-1)!.id;
    household = contributeToGoal(household, goalId, "150", { createdBy: JONATHAN, date: "2026-07-20" }).household;
    expect(monthMemories(household, "2026-07").some((row) => row.kind === "goal-reached")).toBe(false);
    household = contributeToGoal(household, goalId, "150", { createdBy: JONATHAN, date: "2026-08-20" }).household;
    const august = monthMemories(household, "2026-08");
    expect(august.some((row) => row.kind === "goal-reached" && row.title.includes("Tires"))).toBe(true);
  });
});

describe("the year and the year before", () => {
  it("shapes twelve months and names the hardest one that happened", () => {
    const household = threeMonths();
    const shape = yearShape(household, 2026, TODAY);
    expect(shape.months).toHaveLength(12);
    expect(shape.hardestMonthKey).toBe("2026-08");
    expect(shape.months[11]!.state).toBe("ahead");
  });

  it("stays quiet when there is no last year to compare with", () => {
    expect(thisTimeLastYear(threeMonths(), TODAY)).toBeNull();
  });
});

describe("the forecast", () => {
  it("either projects from the reviewed Fund horizon or refuses out loud", () => {
    const forecast = monthForecast(threeMonths(), TODAY, 3);
    if (forecast.kind === "forecast") {
      expect(forecast.months.length).toBeGreaterThan(0);
      expect(forecast.assumptions.length).toBeGreaterThan(0);
      for (const month of forecast.months) expect(Number.isSafeInteger(month.endBalanceCents)).toBe(true);
    } else {
      expect(forecast.reasons.length).toBeGreaterThan(0);
      expect(forecast.reasons[0]!.message).toBeTruthy();
    }
  });
});
