import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  householdAsk,
  nextPaydayDate,
  postEntry,
  proposeHouseholdFundContribution,
  shapeWorkJob,
  type Household,
  type WorkJob,
  type WorkPaySchedule,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function configuredFund(openedOn = "2026-08-01"): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn,
    createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, contributorMemberId: string, amount: string, date: string): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: contributorMemberId,
    contributorMemberId,
    amount,
    date,
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  }).household;
}

function addExpenseRecurrence(household: Household, amount: string, date: string, note: string): Household {
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

function payJob(memberId: string, paySchedule: WorkPaySchedule, id = "JOB-PAY"): WorkJob {
  return shapeWorkJob({
    id,
    memberId,
    name: "Pay timing",
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

describe("household Ask", () => {
  it("says the canonical register's exact $340 tail without recomputing it", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "240", "2026-08-31");
    household = contribute(household, BIANCA, "980", "2026-09-04");
    household = contribute(household, JONATHAN, "310", "2026-09-06");
    household = contribute(household, JONATHAN, "225", "2026-09-11");
    household = contribute(household, BIANCA, "980", "2026-09-18");
    for (const posted of [
      { amount: "128", date: "2026-09-04", note: "Hydro" },
      { amount: "1450", date: "2026-09-05", note: "Rent · our share" },
      { amount: "186", date: "2026-09-10", note: "Insurance" },
    ]) household = postEntry(household, {
      date: posted.date,
      type: "expense",
      amount: posted.amount,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: posted.note,
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
      funding: {
        fundId: HOUSEHOLD_FUND_ID,
        fundedCents: Math.round(Number(posted.amount) * 100),
        destinationAccountId: "ACC-VISA",
      },
    }).household;
    for (const obligation of [
      { amount: "520", date: "2026-09-15", note: "Groceries · planned" },
      { amount: "92", date: "2026-09-20", note: "Internet" },
      { amount: "74", date: "2026-09-22", note: "Gas" },
      { amount: "110", date: "2026-09-25", note: "Phone" },
      { amount: "215", date: "2026-09-26", note: "Vet · Marmalade" },
    ]) household = addExpenseRecurrence(household, obligation.amount, obligation.date, obligation.note);
    const goal = addGoal(household, { name: "Winter reserve", target: "300", shared: true, ownerMemberId: BIANCA });
    household = addRecurrence(goal.household, {
      cadence: "monthly",
      nextDate: "2026-09-30",
      type: "transfer",
      amount: "300",
      accountId: "ACC-CHEQUING",
      transferToAccountId: "ACC-GOALS",
      goalId: goal.postedIds[0]!,
      note: "Standing · jar · Winter reserve",
    }).household;

    const ask = householdAsk(household, "2026-09-12");

    expect(ask).toMatchObject({
      horizon: "month",
      throughDate: "2026-09-30",
      askCents: 34000,
      confidence: "provisional",
      copy: "September still needs $340.00.",
    });
    expect(ask.askCents).toBe(ask.register.unfundedCents);
    expect(ask.register.tiesToProjection).toBe(true);
  });

  it("renders a covered month as zero with the exact covered copy", () => {
    let household = configuredFund("2026-09-01");
    household = contribute(household, BIANCA, "100", "2026-09-01");
    household = addExpenseRecurrence(household, "100", "2026-09-20", "Phone");

    const ask = householdAsk(household, "2026-09-12");

    expect(ask.askCents).toBe(0);
    expect(ask.askCents).toBe(ask.register.unfundedCents);
    expect(ask.copy).toBe("September is covered.");
  });

  it("uses the custodian's next pay cadence for a secondary through-date register", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "50", "2026-09-01");
    household = addExpenseRecurrence(household, "200", "2026-09-25", "Rent");
    household = postEntry(household, {
      date: "2026-09-10",
      type: "expense",
      amount: "100",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Hydro",
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 10000, destinationAccountId: "ACC-VISA" },
    }).household;
    household = contribute(household, JONATHAN, "500", "2026-09-20");
    household = {
      ...household,
      workJobs: [
        payJob(JONATHAN, {
          cadence: "weekly",
          anchorDate: "2026-09-13",
          weekday: 0,
          monthDays: [15, 30],
          customDates: [],
          reminderTime: "09:00",
        }, "JOB-OTHER-MEMBER"),
        payJob(BIANCA, {
          cadence: "biweekly",
          anchorDate: "2026-09-04",
          weekday: 5,
          monthDays: [15, 30],
          customDates: [],
          reminderTime: "09:00",
        }),
      ],
    };

    const ask = householdAsk(household, "2026-09-12", "payday");

    expect(nextPaydayDate(household, BIANCA, "2026-09-12")).toBe("2026-09-18");
    expect(ask).toMatchObject({
      horizon: "payday",
      throughDate: "2026-09-18",
      askCents: 5000,
      copy: "$50.00 of that lands before the 18th.",
    });
    expect(ask.askCents).toBe(ask.register.unfundedCents);
    expect(ask.register.rows.map((row) => row.label)).toEqual(["Hydro"]);
    expect(ask.register.sources.filter((source) => source.kind === "contribution")).toHaveLength(1);
  });

  it("keeps the number and appends the exact watching caveat", () => {
    let household = configuredFund("2026-09-01");
    household = addExpenseRecurrence(household, "100", "2026-09-20", "Phone");

    const ask = householdAsk(household, "2026-09-12");

    expect(ask.askCents).toBe(10000);
    expect(ask.confidence).toBe("watching");
    expect(ask.copy).toBe("September still needs $100.00 — though I've only watched 1 weeks of this house.");
  });

  it("does not fabricate a payday when the custodian has no active pay schedule", () => {
    const household = configuredFund();

    expect(nextPaydayDate(household, BIANCA, "2026-09-12")).toBeNull();
    expect(householdAsk(household, "2026-09-12", "payday")).toMatchObject({
      horizon: "month",
      throughDate: "2026-09-30",
    });
  });

  it.each([
    ["weekly", "2026-09-04"],
    ["biweekly", "2026-09-11"],
  ] as const)("projects a long-running %s pay schedule beyond the recurrence lookahead", (cadence, expected) => {
    const household = configuredFund();
    household.workJobs = [payJob(BIANCA, {
      cadence,
      anchorDate: "2024-01-05",
      weekday: 5,
      monthDays: [15, 30],
      customDates: [],
      reminderTime: "09:00",
    })];

    expect(nextPaydayDate(household, BIANCA, "2026-09-01")).toBe(expected);
  });

  it("keeps obligation arithmetic out of the Ask and projects timing without pay amounts", () => {
    const source = readFileSync(new URL("../src/core/ask.ts", import.meta.url), "utf8");

    expect(source).toContain("contributionRegister");
    expect(source).toContain("register.unfundedCents");
    expect(source).toContain("nextWorkScheduleDate");
    expect(source).not.toContain("monthObligations");
    expect(source).not.toContain("projectCadence");
    expect(source).not.toContain("rows.reduce");
    expect(source).not.toContain("wagesCents");
    expect(source).not.toContain("amountCents");
  });
});
