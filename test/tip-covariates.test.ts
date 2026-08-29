import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  encodeListCursor,
  eventTipFactor,
  executeHerculesReadToolPlan,
  listTipShifts,
  observeTipShifts,
  postWorkShift,
  seedDemoHousehold,
  softCovariateFactor,
  shiftOutlook,
  staticMacroPrior,
  upsertWorkJob,
  ValidationError,
  type WorkJob,
} from "../src/core/index.ts";

const today = "2026-08-21";

function tippedJob(): WorkJob {
  return {
    id: "",
    memberId: "MEM-002",
    name: "Café Tip Lab",
    color: "#2f6b4f",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: false,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [
        { id: "RATE-1", effectiveDate: "2026-01-01", grossHourlyRateCents: 1800, takeHomeMode: "direct", takeHomeHourlyRateCents: 1500, deductions: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: false,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [],
    salesFields: [{ id: "FOOD", label: "Food", requirement: "required", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: "ACC-CASH", cardTipsDepositAccountId: "ACC-CASH" },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  };
}

describe("tip covariates + list_shifts", () => {
  it("rejects tipped Confirm without covers or staffing, then posts with covariates", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: tippedJob() }).household;
    const job = saved.workJobs[0]!;

    expect(() => postWorkShift(saved, {
      date: today,
      memberId: "MEM-002",
      jobId: job.id,
      roleId: "ROLE-SERVER",
      workedHours: 5,
      paidBreakHours: 0,
      salesByField: { FOOD: 800 },
      cashTips: 40,
      cardTips: 60,
      confirmDuplicate: true,
      createdBy: "MEM-002",
    })).toThrow(ValidationError);

    const posted = postWorkShift(saved, {
      date: today,
      memberId: "MEM-002",
      jobId: job.id,
      roleId: "ROLE-SERVER",
      workedHours: 5,
      paidBreakHours: 0,
      salesByField: { FOOD: 800 },
      cashTips: 40,
      cardTips: 60,
      customersServed: 32,
      staffingCount: 5,
      eventTag: "sports",
      weatherGlass: "clear",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    });
    const shift = posted.household.shifts.at(-1)!;
    expect(shift.customersServed).toBe(32);
    expect(shift.staffingCount).toBe(5);
    expect(shift.eventTag).toBe("sports");
    expect(shift.weatherGlass).toBe("clear");
  });

  it("observes sales/covers/staffing, soft factors, macro, and pages list_shifts", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const observations = observeTipShifts(household);
    expect(observations.length).toBeGreaterThan(3);
    expect(observations.some((row) => row.salesCents > 0)).toBe(true);
    expect(eventTipFactor("holiday")).toBeGreaterThan(1);
    const soft = softCovariateFactor(observations, {
      salesCents: observations[0]!.salesCents,
      customersServed: observations[0]!.customersServed ?? undefined,
      staffingCount: observations[0]!.staffingCount ?? undefined,
    });
    expect(soft.factor).toBeGreaterThan(0.8);

    const first = listTipShifts(household, { limit: 3 });
    expect(first.rows).toHaveLength(3);
    expect(first.totalMatched).toBeGreaterThan(3);
    expect(first.nextCursor).toBe(encodeListCursor(3));
    const second = listTipShifts(household, { limit: 3, cursor: first.nextCursor });
    expect(second.rows[0]?.id).not.toBe(first.rows[0]?.id);

    const free = executeHerculesReadToolPlan(household, {
      calls: [{ id: "1", name: "list_shifts", args: { period: "last_30_days", limit: 50 } }],
    }, today, { memberId: "MEM-002", view: "personal", toolPageMode: "free" });
    expect(Number(free.results[0]?.payload?.limit ?? 0)).toBeLessThanOrEqual(10);

    const pro = executeHerculesReadToolPlan(household, {
      calls: [{ id: "1", name: "list_shifts", args: { period: "last_30_days", limit: 50 } }],
    }, today, { memberId: "MEM-002", view: "personal", toolPageMode: "pro" });
    expect(pro.results[0]?.payload?.limit).toBe(50);
    expect(pro.results[0]?.status).toBe("ok");

    const macro = staticMacroPrior("2026-08");
    const outlook = shiftOutlook(household, {
      date: "2026-08-22",
      hours: 6,
      meal: "dinner",
      eventTag: "holiday",
      salesCents: 120_000,
      customersServed: 40,
      staffingCount: 4,
      macroPrior: macro,
    });
    expect(outlook).not.toBeNull();
    expect(outlook!.eventFactor).toBe(eventTipFactor("holiday"));
    expect(outlook!.macroFactor).toBe(macro.factor);
    expect(outlook!.assumptions.some((line) => /macro/i.test(line))).toBe(true);
  });
});
