import { beforeEach, describe, expect, it } from "vitest";
import {
  eraseDevelopmentData,
  executeHerculesReadToolPlan,
  seedStressHousehold,
  splitForSync,
  stressHouseholdAnnualIncome,
  tipWeather,
  weekdaySunday0,
  workReportFacts,
} from "../src/core/index.ts";

const TODAY = "2026-08-25" as const;
const household = seedStressHousehold({
  today: TODAY,
  environment: "development",
  seed: 12345,
  numberStyle: "pretty",
});
const realistic = seedStressHousehold({
  today: TODAY,
  environment: "development",
  seed: 424242,
  numberStyle: "realistic",
});

describe("Development stress data controls", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

  it("refuses to replace Production books with fictional fixture data", () => {
    expect(() => seedStressHousehold({
      today: TODAY,
      environment: "production",
      seed: 1,
      numberStyle: "realistic",
    })).toThrow(/Development-only.*Production books/i);
  });

  it("builds a valid twelve-month household across the major product surfaces", () => {
    expect(household.transactions.length).toBeGreaterThan(500);
    expect(household.shifts.length).toBeGreaterThan(90);
    expect(household.transactions.some((row) => row.source === "import")).toBe(true);
    expect(household.recurrences.length).toBeGreaterThanOrEqual(5);
    expect(household.appointments.length).toBeGreaterThanOrEqual(4);
    expect(household.claims.length).toBeGreaterThanOrEqual(2);
    expect(household.goals.length).toBeGreaterThanOrEqual(3);
    expect(household.presets.length).toBeGreaterThanOrEqual(2);
    expect(household.workJobs.length).toBe(1);
    expect(household.transactions.map((row) => row.date).sort()[0]).toBe("2025-09-01");
    expect(stressHouseholdAnnualIncome(household)).toBeGreaterThanOrEqual(80_000);
    expect(stressHouseholdAnnualIncome(household)).toBeLessThanOrEqual(160_000);
    expect(household.booksAcceptedHash).toBeNull();
    expect(household.name).toBe("The Pretty Numbers Household");
    expect(household.budgetPlans.every((row) => row.amountCents % 500 === 0)).toBe(true);
  });

  it("posts full job-based shifts with weather notes, clock times, and sales forms filled", () => {
    expect(household.shifts.every((shift) => shift.jobId && shift.roleId)).toBe(true);
    expect(household.shifts.every((shift) => shift.startedAt && shift.endedAt)).toBe(true);
    expect(household.shifts.every((shift) => /°C/.test(shift.note ?? ""))).toBe(true);
    expect(household.shifts.some((shift) => /Patio section|Dining room|Bar rail|Private dining/.test(shift.note ?? ""))).toBe(true);
    expect(household.shifts.some((shift) => (shift.paidBreakHours ?? 0) > 0)).toBe(true);
    expect(household.shifts.some((shift) => (shift.salesByField?.["SALES-FOOD"] ?? 0) > 0)).toBe(true);
    expect(household.shifts.some((shift) => (shift.salesByField?.["SALES-ALCOHOL"] ?? 0) > 0)).toBe(true);
    expect(household.shifts.some((shift) => (shift.salesByField?.["SALES-OTHER"] ?? 0) > 0)).toBe(true);
    expect(household.shifts.some((shift) => (shift.deferredTipOutCents ?? 0) > 0)).toBe(true);
  });

  it("stamps realistic Toronto locations on shift income and ordinary spend", () => {
    const shiftRows = household.transactions.filter((row) => row.source === "shift" && row.location);
    const groceryRows = household.transactions.filter((row) => /groceries/i.test(row.note) && row.location);
    expect(shiftRows.length).toBeGreaterThan(50);
    expect(groceryRows.length).toBeGreaterThan(10);
    expect(shiftRows.every((row) => row.location!.latitude > 43.63 && row.location!.latitude < 43.65)).toBe(true);
    expect(shiftRows.every((row) => row.location!.longitude > -79.39 && row.location!.longitude < -79.37)).toBe(true);
    expect(shiftRows.some((row) => /Harbourfront/i.test(row.location!.label ?? ""))).toBe(true);
    expect(groceryRows.some((row) => row.occurredAt)).toBe(true);
  });

  it("weighs weekend and clear-weather tips higher so Hercules Pro can spot trends", () => {
    const tipRate = (shifts: typeof household.shifts) => {
      const tips = shifts.reduce((sum, shift) => sum + shift.netTipsCents, 0);
      const hours = shifts.reduce((sum, shift) => sum + shift.hours, 0);
      return hours ? tips / hours : 0;
    };
    const fridaySaturday = realistic.shifts.filter((shift) => {
      const day = weekdaySunday0(shift.date);
      return day === 5 || day === 6;
    });
    const midweek = realistic.shifts.filter((shift) => {
      const day = weekdaySunday0(shift.date);
      return day >= 1 && day <= 3;
    });
    expect(fridaySaturday.length).toBeGreaterThan(10);
    expect(midweek.length).toBeGreaterThan(10);
    expect(tipRate(fridaySaturday)).toBeGreaterThan(tipRate(midweek));

    const rainy = realistic.shifts.filter((shift) => /raining|snowy/i.test(shift.note ?? ""));
    const clearish = realistic.shifts.filter((shift) => /sunny|humid|clear/i.test(shift.note ?? ""));
    expect(rainy.length).toBeGreaterThan(5);
    expect(clearish.length).toBeGreaterThan(10);
    expect(tipRate(clearish)).toBeGreaterThan(tipRate(rainy));

    const weather = tipWeather(realistic, TODAY);
    expect(weather.fourWeekHours).toBeGreaterThan(0);
    expect(weather.tipsPerHourCents).toBeGreaterThan(0);
    const friday = weather.byWeekday.find((row) => row.weekday === "Friday");
    const monday = weather.byWeekday.find((row) => row.weekday === "Monday");
    expect((friday?.tipsCents ?? 0)).toBeGreaterThan(0);
    expect((monday?.hours ?? 0) + (friday?.hours ?? 0)).toBeGreaterThan(0);
  });

  it("settles wages and tip envelopes through the ordinary work commands", () => {
    expect(household.transactions.some((row) => /paycheck received/i.test(row.note))).toBe(true);
    expect(household.transactions.some((row) => /tip envelope received/i.test(row.note))).toBe(true);
    expect(household.transactions.some((row) => /deferred tip-out paid/i.test(row.note))).toBe(true);
  });

  it("erases Development activity but preserves the household setup and rejects Production", () => {
    const erased = eraseDevelopmentData(household);

    expect(erased.householdId).toBe(household.householdId);
    expect(erased.members).toEqual(household.members);
    expect(erased.accounts).toEqual(household.accounts);
    expect(erased.categories).toEqual(household.categories);
    expect(erased.workJobs).toEqual(household.workJobs);
    expect(erased.transactions).toEqual([]);
    expect(erased.shifts).toEqual([]);
    expect(erased.recurrences).toEqual([]);
    expect(erased.appointments).toEqual([]);
    expect(erased.claims).toEqual([]);
    expect(erased.goals).toEqual([]);
    expect(erased.budgetPlans).toEqual([]);

    expect(() => eraseDevelopmentData({ ...household, environment: "production" })).toThrow(/Development/);
  });

  it("keeps harbour tip shifts in the shared cloud projection Hercules Pro reads", () => {
    const tipMemberId = "MEM-002";
    const seeded = seedStressHousehold({
      today: TODAY,
      environment: "development",
      seed: 777,
      numberStyle: "realistic",
      tipMemberId,
    });
    const { shared, personal } = splitForSync(seeded, tipMemberId);
    expect(seeded.shifts.length).toBeGreaterThan(90);
    expect(seeded.shifts.every((shift) => shift.visibility === "both")).toBe(true);
    expect(shared.shifts).toHaveLength(seeded.shifts.length);
    expect(personal.shifts).toHaveLength(0);
    const monthStart = `${TODAY.slice(0, 7)}-01`;
    const report = workReportFacts(seeded, tipMemberId, monthStart, TODAY);
    expect(report.count).toBeGreaterThan(0);
    const run = executeHerculesReadToolPlan(seeded, {
      calls: [{ name: "shift_summary", args: { period: "this_month", member: "Jonathan" } }],
    }, TODAY, { memberId: tipMemberId, view: "household" });
    expect(run.results[0]?.status).toBe("ok");
    expect(run.results[0]?.sentence).toMatch(new RegExp(`${report.count} posted shift`));
  }, 60_000);

  it("preserves Google continuity identity on Reload so Hercules Pro can still read the fixture", () => {
    const linked = {
      ...realistic,
      householdId: "HH-pro-fixture",
      inviteCode: "pro-fixture-invite",
      linked: true,
      revision: 17,
      baseRevision: 17,
      google: {
        ...realistic.google,
        links: [{
          memberId: "MEM-002",
          subject: "google-sub-jonathan",
          email: "jonathan@example.com",
          displayName: "Jonathan",
          grantedScopes: ["openid", "email", "profile"],
          active: true,
          linkedAt: "2026-08-01T12:00:00.000Z",
          lastConfirmedAt: "2026-08-01T12:00:00.000Z",
          updatedAt: "2026-08-01T12:00:00.000Z",
        }],
      },
    };
    const reloaded = seedStressHousehold({
      today: TODAY,
      environment: "development",
      seed: 99,
      numberStyle: "realistic",
      preserveFrom: linked,
      tipMemberId: "MEM-001",
    });
    expect(reloaded.householdId).toBe("HH-pro-fixture");
    expect(reloaded.inviteCode).toBe("pro-fixture-invite");
    expect(reloaded.linked).toBe(true);
    expect(reloaded.revision).toBe(17);
    expect(reloaded.google.links).toEqual(linked.google.links);
    expect(reloaded.shifts.length).toBeGreaterThan(90);
    expect(reloaded.shifts.every((shift) => shift.memberId === "MEM-001")).toBe(true);
    expect(reloaded.workJobs[0]?.memberId).toBe("MEM-001");
  }, 60_000);
});
