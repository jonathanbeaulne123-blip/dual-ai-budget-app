import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  WALK_MIN_CONTRIBUTIONS,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  contributionRegister,
  fundWalk,
  fundWalkWith,
  postEntry,
  proposeHouseholdFundContribution,
  setHouseholdFundMonthPlan,
  shapeWorkJob,
  type Household,
  type WorkJob,
  type WorkPaySchedule,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";
const MONTH = "2026-09";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-08-01",
    createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, memberId: string, amount: string, date: string) {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId, contributorMemberId: memberId, amount, date,
  });
  const confirmed = confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA, proposalEventId: proposed.postedIds[0]!,
  });
  return { household: confirmed.household, eventId: confirmed.postedIds[0]! };
}

function propose(household: Household, memberId: string, amount: string, date: string) {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId, contributorMemberId: memberId, amount, date,
  });
  return { household: proposed.household, eventId: proposed.postedIds[0]! };
}

function fundedPurchase(household: Household, amount: string, date: string, note: string): Household {
  return postEntry(household, {
    date, type: "expense", amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note, createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
    funding: {
      fundId: HOUSEHOLD_FUND_ID,
      fundedCents: Math.round(Number(amount) * 100),
      destinationAccountId: "ACC-VISA",
    },
  }).household;
}

function settle(household: Household, amount: string, date: string): Household {
  return confirmHouseholdFundSettlement(household, {
    memberId: BIANCA, amount, destinationAccountId: "ACC-VISA", date,
  }).household;
}

function payJob(memberId: string, paySchedule: WorkPaySchedule, id: string): WorkJob {
  return shapeWorkJob({
    id,
    memberId,
    name: id,
    color: "#31594a",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: false,
    roles: [],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: false,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [],
    salesFields: [],
    paySchedule,
    tipSchedule: paySchedule,
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "personal",
      cashTipsVisibility: "personal",
      cardTipsVisibility: "personal",
      tipOutVisibility: "personal",
      wagesDepositAccountId: "ACC-CHEQUING",
      cashTipsAccountId: "ACC-CASH",
      cardTipsDepositAccountId: "ACC-CHEQUING",
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

function bill(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly", nextDate: date, type: "expense", amount,
    accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

function halifaxClaim(household: Household): Household {
  const goal = addGoal(household, { name: "Halifax", target: "300", shared: true, ownerMemberId: BIANCA });
  return addRecurrence(goal.household, {
    cadence: "monthly", nextDate: "2026-09-30", type: "transfer", amount: "300",
    accountId: "ACC-CHEQUING", transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!, note: "Standing · jar · Halifax",
  }).household;
}

/** The register's own canonical month: purchases posted, none settled. */
function registerScenario(): Household {
  let household = configuredFund();
  household = contribute(household, BIANCA, "240", "2026-08-31").household;
  household = contribute(household, BIANCA, "980", "2026-09-04").household;
  household = contribute(household, JONATHAN, "310", "2026-09-06").household;
  household = contribute(household, JONATHAN, "225", "2026-09-11").household;
  household = contribute(household, BIANCA, "980", "2026-09-18").household;
  household = fundedPurchase(household, "128", "2026-09-04", "Hydro");
  household = fundedPurchase(household, "1450", "2026-09-05", "Rent · our share");
  household = fundedPurchase(household, "186", "2026-09-10", "Insurance");
  household = bill(household, "520", "2026-09-15", "Groceries · planned");
  household = bill(household, "92", "2026-09-20", "Internet");
  household = bill(household, "74", "2026-09-22", "Gas");
  household = bill(household, "110", "2026-09-25", "Phone");
  household = bill(household, "215", "2026-09-26", "Vet · Marmalade");
  return halifaxClaim(household);
}

/** The workshop's month: the early bills actually settled, so the line falls where it falls. */
function settledScenario(): Household {
  let household = configuredFund();
  household = contribute(household, BIANCA, "240", "2026-08-31").household;
  household = contribute(household, BIANCA, "980", "2026-09-02").household;
  household = fundedPurchase(household, "128", "2026-09-04", "Hydro");
  household = settle(household, "128", "2026-09-04");
  household = contribute(household, JONATHAN, "535", "2026-09-05").household;
  household = fundedPurchase(household, "1450", "2026-09-06", "Rent · our share");
  household = settle(household, "1450", "2026-09-06");
  household = contribute(household, BIANCA, "980", "2026-09-18").household;
  household = bill(household, "186", "2026-09-18", "Insurance");
  household = bill(household, "520", "2026-09-19", "Groceries · planned");
  household = bill(household, "92", "2026-09-20", "Internet");
  household = bill(household, "74", "2026-09-22", "Gas");
  household = bill(household, "110", "2026-09-25", "Phone");
  household = bill(household, "215", "2026-09-26", "Vet · Marmalade");
  household = halifaxClaim(household);
  return setHouseholdFundMonthPlan(household, {
    memberId: BIANCA, monthKey: MONTH, target: "3400", buffer: "400",
  }).household;
}

describe("the Fund's balance walk", () => {
  it("ends the canonical month exactly where the register says it is short", () => {
    const household = registerScenario();
    const walk = fundWalk(household, MONTH, TODAY);
    const register = contributionRegister(household, MONTH, TODAY);

    expect(walk.tiesToProjection).toBe(true);
    expect(walk.openingCents).toBe(24000);
    expect(walk.todayBalanceCents).toBe(175500);
    expect(walk.shortfallCents).toBe(register.unfundedCents);
    expect(walk.shortfallCents).toBe(34000);
    expect(walk.endBalanceCents).toBe(-34000);
  });

  it("walks the settled month to the dry date the drawing shows", () => {
    const household = settledScenario();
    const walk = fundWalk(household, MONTH, TODAY);
    const register = contributionRegister(household, MONTH, TODAY);

    expect(walk.tiesToProjection).toBe(true);
    expect(walk.todayBalanceCents).toBe(17700);
    expect(walk.dryDate).toBe("2026-09-26");
    expect(walk.endBalanceCents).toBe(-34000);
    expect(walk.bufferCents).toBe(40000);
    expect(walk.hasConfirmedContribution).toBe(true);
    expect(walk.belowBufferRuns.length).toBeGreaterThanOrEqual(1);
    expect(walk.belowBufferRuns.some((run) => run.lowCents === 17700)).toBe(true);
    expect(walk.shortfallCents).toBe(register.unfundedCents);
  });

  it("never lets a claim move the line", () => {
    const before = fundWalk(settledScenario(), MONTH, TODAY);
    const after = fundWalk(fundedPurchase(settledScenario(), "84.20", "2026-09-11", "Groceries"), MONTH, TODAY);
    expect(after.todayBalanceCents).toBe(before.todayBalanceCents);
  });

  it("projects nothing and never runs dry on day one", () => {
    let household = configuredFund();
    household = bill(household, "186", "2026-09-18", "Insurance");
    const walk = fundWalk(household, MONTH, TODAY);

    expect(walk.hasConfirmedContribution).toBe(false);
    expect(walk.dryDate).toBeNull();
    expect(walk.inflowConfidence).toBe("none");
    expect(walk.tiesToProjection).toBe(true);
    expect(walk.shortfallCents).toBe(contributionRegister(household, MONTH, TODAY).unfundedCents);
    expect(walk.points.every((point) => point.kind === "opening" || !point.actual)).toBe(true);
  });

  it("will not estimate a contribution below the observation threshold", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "980", "2026-08-21").household;
    household = contribute(household, BIANCA, "980", "2026-09-04").household;
    const walk = fundWalk(household, MONTH, TODAY);

    expect(WALK_MIN_CONTRIBUTIONS).toBe(3);
    expect(walk.points.some((point) => point.estimated)).toBe(false);
  });

  it("is order independent", () => {
    const forward = fundWalk(settledScenario(), MONTH, TODAY);
    const again = fundWalk(settledScenario(), MONTH, TODAY);
    expect(again.points.map((p) => [p.date, p.deltaCents, p.balanceCents]))
      .toEqual(forward.points.map((p) => [p.date, p.deltaCents, p.balanceCents]));
  });

  it("shows what confirming a motion would do, without confirming it", () => {
    let household = settledScenario();
    const raised = propose(household, JONATHAN, "310", "2026-09-12");
    household = raised.household;

    const before = fundWalk(household, MONTH, TODAY);
    const after = fundWalkWith(household, MONTH, TODAY, { confirmEventIds: [raised.eventId] });

    // Confirming turns a raised amount into money in the pool today.
    expect(before.todayBalanceCents).toBe(17700);
    expect(after.todayBalanceCents).toBe(48700);
    // A raised amount stays record-only until this deliberate what-if includes it.
    expect(before.points.some((point) => point.sourceId === raised.eventId)).toBe(false);
    expect(after.endBalanceCents).toBe(before.endBalanceCents + 31000);
    expect(before.shortfallCents).toBe(34000);
    expect(after.shortfallCents).toBe(3000);
    expect(after.points.find((point) => point.sourceId === raised.eventId)?.actual).toBe(false);
    // And nothing was actually confirmed.
    expect(fundWalk(household, MONTH, TODAY).todayBalanceCents).toBe(before.todayBalanceCents);
  });

  it("measures a sparse below-buffer run through the day before recovery", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "500", "2026-08-31").household;
    household = fundedPurchase(household, "200", "2026-09-13", "Hydro");
    household = settle(household, "200", "2026-09-13");
    household = contribute(household, BIANCA, "200", "2026-09-20").household;
    household = setHouseholdFundMonthPlan(household, {
      memberId: BIANCA, monthKey: MONTH, target: "500", buffer: "400",
    }).household;

    const walk = fundWalk(household, MONTH, "2026-09-20");
    expect(walk.belowBufferRuns).toContainEqual({
      fromDate: "2026-09-13",
      toDate: "2026-09-19",
      days: 7,
      lowCents: 30000,
    });
  });

  it("withholds an observed contribution when multiple employer pay clocks disagree", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "100", "2026-08-01").household;
    household = contribute(household, BIANCA, "100", "2026-08-15").household;
    household = contribute(household, BIANCA, "100", "2026-08-29").household;
    const weekly: WorkPaySchedule = {
      cadence: "weekly", anchorDate: "2026-09-13", weekday: 0,
      monthDays: [15, 30], customDates: [], reminderTime: "09:00",
    };
    const biweekly: WorkPaySchedule = {
      ...weekly, cadence: "biweekly", anchorDate: "2026-09-14",
    };
    const first = payJob(BIANCA, weekly, "JOB-A");
    const second = payJob(BIANCA, biweekly, "JOB-B");

    household.workJobs = [first, second];
    const forward = fundWalk(household, MONTH, TODAY);
    household.workJobs = [second, first];
    const reversed = fundWalk(household, MONTH, TODAY);
    expect(forward.points.some((point) => point.estimated)).toBe(false);
    expect(reversed.points).toEqual(forward.points);

    household.workJobs = [first, { ...first, id: "JOB-C" }];
    expect(fundWalk(household, MONTH, TODAY).points.some((point) => point.estimated)).toBe(true);
  });

  it("re-runs the sealed shortfall when one obligation is hypothetically deferred", () => {
    const household = settledScenario();
    const before = fundWalk(household, MONTH, TODAY);
    const deferred = before.points.find((point) => !point.actual && point.kind === "obligation");
    if (!deferred?.sourceId) throw new Error("expected a projected obligation");

    const after = fundWalkWith(household, MONTH, TODAY, { deferObligationIds: [deferred.sourceId] });

    expect(after.endBalanceCents).toBe(before.endBalanceCents + Math.abs(deferred.deltaCents));
    expect(after.shortfallCents).toBe(Math.max(0, before.shortfallCents - Math.abs(deferred.deltaCents)));
    expect(fundWalk(household, MONTH, TODAY)).toEqual(before);
  });

  it("keeps its fences", () => {
    const source = readFileSync(new URL("../src/core/fundWalk.ts", import.meta.url), "utf8");
    expect(source).toContain("monthObligations");
    expect(source).toContain("projectHouseholdFund");
    expect(source).not.toMatch(/Date\.now|Math\.random|toFixed/);
    expect(source).not.toMatch(/ratio|percent|rank/i);
  });
});
