// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  LEVEL_DAY_ONE_LINE,
  LEVEL_UNTIED_LINE,
  LEVEL_VIEW,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  fundWalk,
  levelAria,
  levelDrawing,
  levelSecondary,
  levelStageHeadline,
  levelX,
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
    custodianMemberId: BIANCA, openedOn: "2026-08-01", createdBy: BIANCA,
  }).household;
}
function contribute(household: Household, memberId: string, amount: string, date: string) {
  const proposed = proposeHouseholdFundContribution(household, { memberId, contributorMemberId: memberId, amount, date });
  const confirmed = confirmHouseholdFundContribution(proposed.household, { memberId: BIANCA, proposalEventId: proposed.postedIds[0]! });
  return { household: confirmed.household, eventId: confirmed.postedIds[0]! };
}
function fundedPurchase(household: Household, amount: string, date: string, note: string): Household {
  return postEntry(household, {
    date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC",
    note, createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
    funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: Math.round(Number(amount) * 100), destinationAccountId: "ACC-VISA" },
  }).household;
}
function settle(household: Household, amount: string, date: string): Household {
  return confirmHouseholdFundSettlement(household, { memberId: BIANCA, amount, destinationAccountId: "ACC-VISA", date }).household;
}
function bill(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly", nextDate: date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}
function halifaxClaim(household: Household): Household {
  const goal = addGoal(household, { name: "Halifax", target: "300", shared: true, ownerMemberId: BIANCA });
  return addRecurrence(goal.household, {
    cadence: "monthly", nextDate: "2026-09-30", type: "transfer", amount: "300",
    accountId: "ACC-CHEQUING", transferToAccountId: "ACC-GOALS", goalId: goal.postedIds[0]!, note: "Standing · jar · Halifax",
  }).household;
}

function payJob(memberId: string, paySchedule: WorkPaySchedule): WorkJob {
  return shapeWorkJob({
    id: "JOB-LEVEL-OBSERVED",
    memberId,
    name: "Observed pay clock",
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

/** The workshop's own canonical month — the early bills actually settled, so the line falls where it falls. */
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

describe("the Level's geometry", () => {
  it("shares one x-scale between the axis, the bands, the marks, and the dry mark", () => {
    const walk = fundWalk(settledScenario(), MONTH, TODAY);
    const drawing = levelDrawing(walk);
    expect(drawing.todayX).toBeCloseTo(levelX(TODAY, MONTH), 6);
    expect(drawing.dryMark).not.toBeNull();
    expect(drawing.dryMark!.x).toBeCloseTo(levelX(walk.dryDate!, MONTH), 6);
    expect(drawing.pxPerCent).toBeGreaterThan(0);
  });

  it("produces a dry mark and exactly two bands for the canonical month", () => {
    const walk = fundWalk(settledScenario(), MONTH, TODAY);
    const drawing = levelDrawing(walk);
    expect(drawing.presentation).toBe("ready");
    expect(drawing.dryMark).not.toBeNull();
    expect(drawing.bands).toHaveLength(2);
    expect(drawing.bands.every((band) => band.width > 0)).toBe(true);
  });

  it("produces an empty actual path and no dry mark on day one", () => {
    let household = configuredFund();
    household = bill(household, "186", "2026-09-18", "Insurance");
    const walk = fundWalk(household, MONTH, TODAY);
    const drawing = levelDrawing(walk);

    expect(walk.hasConfirmedContribution).toBe(false);
    expect(drawing.presentation).toBe("day-one");
    expect(drawing.actualPath).toBe("");
    expect(drawing.dryMark).toBeNull();
    expect(drawing.projectedPath.length).toBeGreaterThan(0);
  });

  it("draws the buffer line and axes even when untied, but no balance line, bands, marks or dry mark", () => {
    const walk = fundWalk(settledScenario(), MONTH, TODAY);
    const untied = { ...walk, tiesToProjection: false };
    const drawing = levelDrawing(untied);

    expect(drawing.presentation).toBe("untied");
    expect(drawing.actualPath).toBe("");
    expect(drawing.projectedPath).toBe("");
    expect(drawing.bands).toEqual([]);
    expect(drawing.marks).toEqual([]);
    expect(drawing.dryMark).toBeNull();
    // Still a real buffer position, not collapsed to the zero line.
    expect(drawing.bufferY).toBeLessThan(LEVEL_VIEW.axisY);
  });

  it("marks an estimated inflow hollow and a found one filled, by the estimated flag alone", () => {
    const walk = fundWalk(settledScenario(), MONTH, TODAY);
    const drawing = levelDrawing(walk);
    expect(drawing.marks.length).toBeGreaterThan(0);
    expect(drawing.marks.every((mark) => typeof mark.estimated === "boolean")).toBe(true);
  });
});

describe("the Level's headline ladder", () => {
  it("rung 1 — leads with the dry date, and rung 2 is the next-highest true statement", () => {
    const walk = fundWalk(settledScenario(), MONTH, TODAY);
    expect(levelStageHeadline(walk)).toBe("At this pace the Fund runs dry on the 26th.");
    expect(levelSecondary(walk)).toBe("Under the buffer from the 6th to the 17th — 12 days on $177.00.");
  });

  it("rung 2 alone — a below-buffer run with no dry date ahead", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "500", "2026-09-01").household;
    household = contribute(household, BIANCA, "500", "2026-09-20").household;
    household = setHouseholdFundMonthPlan(household, { memberId: BIANCA, monthKey: MONTH, target: "500", buffer: "600" }).household;
    const walk = fundWalk(household, MONTH, TODAY);

    expect(walk.dryDate).toBeNull();
    expect(levelStageHeadline(walk)).toMatch(/^Under the buffer/);
    expect(levelSecondary(walk)).toBeNull();
  });

  it("rung 3 — spoken for exceeds the pool (same day, money in before money out: fundWalk settles a same-day contribution ahead of a same-day obligation, so the running balance never dips negative even though the static claimed total already exceeds the pool)", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "100", "2026-09-01").household;
    household = bill(household, "30", "2026-09-15", "Small bill");
    household = contribute(household, BIANCA, "200", "2026-09-20").household;
    household = bill(household, "80", "2026-09-20", "Same-day bill");
    const walk = fundWalk(household, MONTH, TODAY);

    expect(walk.dryDate).toBeNull();
    expect(levelStageHeadline(walk)).toBe("$110.00 of the $100.00 in the pool is spoken for before the 20th.");
    expect(levelSecondary(walk)).toBeNull();
  });

  it("rung 4 — day one, unconditionally, even when a below-buffer run would otherwise fire", () => {
    let household = configuredFund();
    household = bill(household, "600", "2026-09-05", "Rent");
    household = setHouseholdFundMonthPlan(household, { memberId: BIANCA, monthKey: MONTH, target: "600", buffer: "400" }).household;
    const walk = fundWalk(household, MONTH, TODAY);

    expect(walk.hasConfirmedContribution).toBe(false);
    expect(walk.belowBufferRuns.some((run) => run.days >= 3)).toBe(true);
    expect(levelStageHeadline(walk)).toBe(LEVEL_DAY_ONE_LINE);
    expect(levelSecondary(walk)).toBeNull();
  });

  it("rung 5 — covered, and never manufactures a second sentence", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "2000", "2026-09-01").household;
    household = bill(household, "100", "2026-09-15", "Small bill");
    const walk = fundWalk(household, MONTH, TODAY);

    expect(walk.dryDate).toBeNull();
    expect(levelStageHeadline(walk)).toBe("September is covered.");
    expect(levelSecondary(walk)).toBeNull();
  });

  it("never calls estimate-dependent coverage covered", () => {
    let household = configuredFund();
    household = contribute(household, JONATHAN, "100", "2026-08-01").household;
    household = contribute(household, JONATHAN, "100", "2026-08-15").household;
    household = contribute(household, JONATHAN, "100", "2026-08-29").household;
    const schedule: WorkPaySchedule = {
      cadence: "biweekly",
      anchorDate: "2026-09-26",
      weekday: 6,
      monthDays: [15, 30],
      customDates: [],
      reminderTime: "09:00",
    };
    household.workJobs = [payJob(JONATHAN, schedule)];
    household = bill(household, "350", "2026-09-30", "Month end bill");
    const walk = fundWalk(household, MONTH, TODAY);

    expect(walk).toMatchObject({
      dryDate: null,
      inflowConfidence: "observed",
      shortfallCents: 5000,
    });
    expect(levelStageHeadline(walk)).toBe(
      "The register is still short $50.00. The dashed contribution is observed, not confirmed.",
    );
    expect(levelStageHeadline(walk)).not.toBe("September is covered.");
  });

  it("untied — its own line, never the ladder, and no secondary", () => {
    const walk = fundWalk(settledScenario(), MONTH, TODAY);
    const untied = { ...walk, tiesToProjection: false };
    expect(levelStageHeadline(untied)).toBe(LEVEL_UNTIED_LINE);
    expect(levelSecondary(untied)).toBeNull();
  });
});

describe("levelAria", () => {
  it("names the balance, the dry date, and the buffer", () => {
    const walk = fundWalk(settledScenario(), MONTH, TODAY);
    const aria = levelAria(walk);
    expect(aria).toContain("$177.00");
    expect(aria).toContain("26th");
    expect(aria).toContain("$400.00");
  });

  it("omits the dry and buffer clauses when neither applies", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "2000", "2026-09-01").household;
    const walk = fundWalk(household, MONTH, TODAY);
    const aria = levelAria(walk);
    expect(aria).not.toContain("dry");
    expect(aria).not.toContain("buffer");
  });
});

describe("keeps its fences", () => {
  const viewSource = readFileSync(resolve(process.cwd(), "src/core/levelView.ts"), "utf8");
  const componentSource = readFileSync(resolve(process.cwd(), "src/Level.tsx"), "utf8");

  it("levelView.ts reads the walk and spokenFor, and computes no balance of its own", () => {
    expect(viewSource).toContain("import type { FundWalk } from \"./fundWalk.ts\";");
    expect(viewSource).toContain("spokenFor");
    expect(viewSource).not.toMatch(/Date\.now|Math\.random|toFixed/);
  });

  it("Level.tsx never renders a percentage or --danger, and never writes", () => {
    // The only legitimate "%" in this file is the modulo operator in the
    // ordinal-day helper (`day % 100`, `day % 10`); strip that usage and
    // nothing should remain — a stray "%" would mean a rendered percentage.
    expect(componentSource.replace(/ % /g, "")).not.toContain("%");
    expect(componentSource).not.toContain("--danger");
    expect(componentSource).not.toContain("onKitchen");
    expect(componentSource).not.toMatch(/from ".\/core\/commands\.ts"/);
  });
});
