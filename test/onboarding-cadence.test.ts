import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assembleHousehold,
  catalogHousehold,
  compileHousehold,
  configureHouseholdFund,
  evidenceFor,
  fundWalk,
  nextPaydayDate,
  onboardingCadenceProbe,
  paydayTicks,
  recordChapterAcknowledgement,
  recordEarningCadence,
  shapeWorkJob,
  splitForSync,
  workScheduleMatches,
  type Household,
  type WorkJob,
  type WorkPaySchedule,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const AT = "2026-09-04T14:00:00.000Z";

function schedule(cadence: WorkPaySchedule["cadence"]): WorkPaySchedule {
  return {
    cadence,
    anchorDate: "2026-09-03",
    weekday: 4,
    monthDays: [15, 30],
    customDates: cadence === "custom" ? ["2026-09-09", "2026-09-23"] : [],
    reminderTime: "09:00",
  };
}

function privateJob(memberId: string, paySchedule = schedule("biweekly")): WorkJob {
  return shapeWorkJob({
    id: `JOB-${memberId}`,
    memberId,
    name: `PRIVATE-EMPLOYER-${memberId}`,
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "PRIVATE-PLACE",
    gpsEnabled: false,
    roles: [{
      id: `ROLE-${memberId}`,
      name: "PRIVATE-ROLE",
      tipped: true,
      active: true,
      rates: [{
        id: `RATE-${memberId}`,
        effectiveDate: "2026-01-01",
        grossHourlyRateCents: 987654,
        takeHomeMode: "direct",
        takeHomeHourlyRateCents: 876543,
        deductions: [],
        createdAt: AT,
        updatedAt: AT,
      }],
      createdAt: AT,
      updatedAt: AT,
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [],
    salesFields: [],
    paySchedule,
    tipSchedule: schedule("irregular"),
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "personal",
      cashTipsVisibility: "personal",
      cardTipsVisibility: "personal",
      tipOutVisibility: "personal",
      wagesDepositAccountId: "PRIVATE-WAGES-ACCOUNT",
      cashTipsAccountId: "PRIVATE-CASH-ACCOUNT",
      cardTipsDepositAccountId: "PRIVATE-TIPS-ACCOUNT",
    },
    wagesReceivableAccountId: "PRIVATE-WAGES-RECEIVABLE",
    cardTipsReceivableAccountId: "PRIVATE-TIPS-RECEIVABLE",
    note: "PRIVATE-NOTE",
    createdAt: AT,
    updatedAt: AT,
  }, AT);
}

function record(household: Household, memberId: string, cadence: WorkPaySchedule["cadence"], at = AT): Household {
  return recordEarningCadence(household, {
    memberId,
    createdBy: memberId,
    paySchedule: schedule(cadence),
    detailAction: "skip",
    at,
  }).household;
}

describe("onboarding Chapter 8 earning cadence", () => {
  it("lets each member satisfy only their own probe and cites timing without partner detail", () => {
    let household = catalogHousehold("development");
    household.workJobs = [privateJob(JONATHAN)];

    expect(onboardingCadenceProbe(household, BIANCA).complete).toBe(false);
    expect(onboardingCadenceProbe(household, JONATHAN).complete).toBe(true);

    household = record(household, BIANCA, "biweekly");
    const biancaEvidence = evidenceFor(household, "ch-08-cadence", BIANCA);
    const jonathanEvidence = evidenceFor(household, "ch-08-cadence", JONATHAN);

    expect(biancaEvidence).toMatchObject({
      kind: "accepted",
      card: {
        scope: "household",
        sourceIds: [`earning-cadence:${BIANCA}`],
        lines: [{ label: "Earning rhythm", value: "Bianca is paid every second Thursday." }],
      },
    });
    expect(jonathanEvidence.kind).toBe("accepted");
    expect(JSON.stringify(biancaEvidence)).not.toMatch(/PRIVATE-|987654|876543/);
    expect(JSON.stringify(jonathanEvidence)).not.toMatch(/PRIVATE-(?:EMPLOYER|PLACE|ROLE|ACCOUNT|RECEIVABLE|NOTE)|987654|876543/);
  });

  it("records an explicit detail skip, creates no income or job row, and cannot be written for a partner", () => {
    const before = catalogHousehold("development");
    const journalBefore = compileHousehold(before).entries;
    const saved = recordEarningCadence(before, {
      memberId: BIANCA,
      createdBy: BIANCA,
      paySchedule: schedule("weekly"),
      detailAction: "skip",
      at: AT,
    });

    expect(saved.postedIds).toEqual([]);
    expect(saved.household.transactions).toEqual(before.transactions);
    expect(saved.household.workJobs).toEqual(before.workJobs);
    expect(saved.household.members.find((member) => member.id === BIANCA)).toMatchObject({
      earningCadence: { cadence: "weekly" },
      earningCadenceUpdatedAt: AT,
      earningDetailSkippedAt: AT,
    });
    expect(compileHousehold(saved.household).entries).toEqual(journalBefore);
    expect(() => recordEarningCadence(before, {
      memberId: BIANCA,
      createdBy: JONATHAN,
      paySchedule: schedule("weekly"),
      detailAction: "skip",
    })).toThrow(/own progress/i);
  });

  it.each(["weekly", "biweekly", "twice-monthly", "custom", "irregular"] as const)(
    "preserves %s through shaping and Shared continuity",
    (cadence) => {
      const household = record(catalogHousehold("development"), BIANCA, cadence);
      const { shared, personal } = splitForSync(household, BIANCA);
      const roundTrip = assembleHousehold(shared, personal, { linked: household.linked });

      expect(shared.members.find((member) => member.id === BIANCA)?.earningCadence?.cadence).toBe(cadence);
      expect(roundTrip.members.find((member) => member.id === BIANCA)?.earningCadence?.cadence).toBe(cadence);
      expect(onboardingCadenceProbe(roundTrip, BIANCA).complete).toBe(true);
    },
  );

  it("drops a malformed cached cadence instead of shaping it into a valid payday", () => {
    const household = catalogHousehold("development");
    household.members = household.members.map((member) => member.id === BIANCA
      ? {
          ...member,
          earningCadence: { cadence: "mystery", anchorDate: "not-a-date" } as unknown as WorkPaySchedule,
          earningCadenceUpdatedAt: AT,
        }
      : member);
    const { shared, personal } = splitForSync(household, BIANCA);
    const roundTrip = assembleHousehold(shared, personal, { linked: household.linked });

    expect(roundTrip.members.find((member) => member.id === BIANCA)?.earningCadence).toBeUndefined();
    expect(onboardingCadenceProbe(roundTrip, BIANCA).complete).toBe(false);
  });

  it("treats irregular as complete but never invents a payday, metronome tick, or Fund inflow", () => {
    let household = record(catalogHousehold("development"), BIANCA, "irregular");
    household = configureHouseholdFund(household, {
      custodianMemberId: BIANCA,
      openedOn: "2026-09-01",
      createdBy: BIANCA,
    }).household;

    expect(onboardingCadenceProbe(household, BIANCA).complete).toBe(true);
    expect(evidenceFor(household, "ch-08-cadence", BIANCA)).toMatchObject({
      kind: "accepted",
      card: { lines: [{ value: "Bianca doesn't have a fixed payday." }] },
    });
    expect(workScheduleMatches(schedule("irregular"), "2026-09-03")).toBe(false);
    expect(nextPaydayDate(household, BIANCA, "2026-09-01")).toBeNull();
    expect(paydayTicks(household, "2026-09")).toEqual([]);
    expect(fundWalk(household, "2026-09", "2026-09-01").points.filter((point) => point.estimated && point.kind === "contribution")).toEqual([]);
  });

  it("blocks acknowledgement until the acting member has their own valid cadence", () => {
    let household = record(catalogHousehold("development"), JONATHAN, "irregular");
    expect(() => recordChapterAcknowledgement(household, {
      memberId: BIANCA,
      chapterId: "ch-08-cadence",
      createdBy: BIANCA,
      at: AT,
    })).toThrow(/your own earning rhythm/i);

    household = record(household, BIANCA, "weekly", "2026-09-04T14:01:00.000Z");
    const accepted = recordChapterAcknowledgement(household, {
      memberId: BIANCA,
      chapterId: "ch-08-cadence",
      createdBy: BIANCA,
      at: "2026-09-04T14:02:00.000Z",
    });
    expect(accepted.postedIds).toEqual([]);
  });

  it("keeps the chapter projector pure and amount-free", () => {
    const cadenceSource = readFileSync(new URL("../src/core/onboarding/cadence.ts", import.meta.url), "utf8");
    const evidenceSource = readFileSync(new URL("../src/core/onboarding/evidence.ts", import.meta.url), "utf8");
    for (const source of [cadenceSource, evidenceSource]) {
      expect(source).not.toMatch(/\b(document|window|fetch|localStorage)\b/);
      expect(source).not.toMatch(/from\s+["'][^"']*\.tsx["']/);
    }
    expect(cadenceSource).not.toMatch(/amountCents|wagesCents|takeHomeHourlyRateCents|grossHourlyRateCents/);
  });
});
