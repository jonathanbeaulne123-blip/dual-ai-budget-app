import { describe, expect, it } from "vitest";
import { calendarDaysBetween } from "../src/core/calendar.ts";
import {
  executeHerculesReadToolPlan,
  explainShiftYearSimulation,
  mulberry32,
  observeTipShifts,
  planTaxMilk,
  runShiftYearSimulation,
  runTipOracle,
  seedDemoHousehold,
  shiftOutlook,
  simulateTipSchedule,
  upcomingCadenceSchedule,
} from "../src/core/index.ts";
import type { Household } from "../src/core/types.ts";

const today = "2026-08-21";

function shuffleShifts(household: Household, seed: number): Household {
  const random = mulberry32(seed);
  const shifts = [...household.shifts];
  for (let i = shifts.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shifts[i], shifts[j]] = [shifts[j]!, shifts[i]!];
  }
  return { ...household, shifts };
}

describe("Hercules Shift Oracle tip science", () => {
  it("keeps Monte Carlo deterministic across seed and shift-array order", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const a = runTipOracle(household, { today, iterations: 800, seed: 42, horizonDays: 28 });
    const b = runTipOracle(household, { today, iterations: 800, seed: 42, horizonDays: 28 });
    const shuffled = shuffleShifts(household, 99);
    const c = runTipOracle(shuffled, { today, iterations: 800, seed: 42, horizonDays: 28 });
    const d = runTipOracle(household, { today, iterations: 800, seed: 43, horizonDays: 28 });
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(d?.p50Cents).not.toEqual(a?.p50Cents);
    expect(a!.p10Cents).toBeLessThanOrEqual(a!.p50Cents);
    expect(a!.p50Cents).toBeLessThanOrEqual(a!.p90Cents);
    expect(a!.safeBaselineCents).toBe(a!.p10Cents);
    expect(a!.assumptions.some((line) => /projection|not a promise/i.test(line))).toBe(true);
    expect(household).toEqual(before);
  });

  it("keeps the simulated floor near historical tip pace and reacts to today", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const observations = observeTipShifts(household);
    const first = observations[0]!.date;
    const last = observations[observations.length - 1]!.date;
    const spanDays = Math.max(1, calendarDaysBetween(first, last) + 1);
    const totalTips = observations.reduce((sum, row) => sum + row.netTipsCents, 0);
    const expected28 = (totalTips / spanDays) * 28;
    const oracle = runTipOracle(household, { today, iterations: 1500, seed: 7, horizonDays: 28 });
    expect(oracle).not.toBeNull();
    // p50 should sit within a reasonable band of historical daily pace × horizon.
    expect(oracle!.p50Cents).toBeGreaterThan(Math.round(expected28 * 0.45));
    expect(oracle!.p50Cents).toBeLessThan(Math.round(expected28 * 1.55));
    expect(oracle!.p10Cents).toBeLessThanOrEqual(oracle!.p50Cents);

    const monday = runTipOracle(household, { today: "2026-08-24", iterations: 800, seed: 11, horizonDays: 10 });
    const friday = runTipOracle(household, { today: "2026-08-21", iterations: 800, seed: 11, horizonDays: 10 });
    expect(monday).not.toBeNull();
    expect(friday).not.toBeNull();
    expect(monday!.p50Cents).not.toEqual(friday!.p50Cents);

    const weekSlots = upcomingCadenceSchedule(household, today, { days: 7 }).length;
    expect(weekSlots).toBeGreaterThan(0);
    expect(weekSlots).toBeLessThanOrEqual(6);
  });

  it("produces weather-adjusted shift outlook and schedule advice as projections", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const clear = shiftOutlook(household, { date: "2026-08-22", hours: 6, meal: "dinner", weatherGlass: "clear" });
    const rain = shiftOutlook(household, { date: "2026-08-22", hours: 6, meal: "dinner", weatherGlass: "rain" });
    expect(clear).not.toBeNull();
    expect(rain).not.toBeNull();
    expect(clear!.expectedTipCents).not.toEqual(rain!.expectedTipCents);
    expect(clear!.assumptions.some((line) => /projection/i.test(line))).toBe(true);

    const schedule = upcomingCadenceSchedule(household, today, { days: 7 });
    const sim = simulateTipSchedule(household, schedule);
    expect(sim).not.toBeNull();
    expect(sim!.rows.length).toBeGreaterThan(0);
    expect(sim!.totalLowCents).toBeLessThanOrEqual(sim!.totalExpectedCents);
    expect(sim!.totalExpectedCents).toBeLessThanOrEqual(sim!.totalHighCents);
    expect(["protect-floor", "chase-spike", "neutral"]).toContain(sim!.rows[0]!.recommendation);
  });

  it("plans educational tax milk, fails closed on unknown or non-positive tips, and never posts", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const plan = planTaxMilk(household, { tipCents: 40_000, taxRateBps: 2500 });
    expect(plan).not.toBeNull();
    expect(plan && !("error" in plan) && plan.taxMilkCents).toBe(10_000);
    if (plan && !("error" in plan)) {
      expect(plan.taxMilkCents + plan.bufferCents + plan.leftoverCents).toBe(plan.tipCents);
      expect(plan.assumptions.some((line) => /Confirm/i.test(line))).toBe(true);
    }
    const missing = planTaxMilk(household, { shiftId: "SHIFT-NOPE" });
    expect(missing && "error" in missing && missing.error).toMatch(/cannot match shift/i);
    const negative = planTaxMilk(household, { tipCents: -12000 });
    expect(negative && "error" in negative && negative.error).toMatch(/negative|zero/i);
    expect(household).toEqual(before);
  });

  it("exposes Oracle tools through the Hercules read catalog without write authority", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const run = executeHerculesReadToolPlan(household, {
      calls: [
        { name: "tip_oracle", args: { horizonDays: 28, iterations: 400, seed: 9 } },
        { name: "shift_outlook", args: { date: "2026-08-22", hours: 5.5, meal: "dinner", weatherGlass: "rain" } },
        { name: "tip_schedule_sim", args: { days: 7 } },
        { name: "tax_milk_plan", args: { tipCents: 22000, taxRateBps: 2500 } },
        { name: "post_entry", args: { amountCents: 1 } },
      ],
    }, today, { memberId: "MEM-001", view: "household" });
    expect(household).toEqual(before);
    expect(run.results.map((result) => result.name)).toEqual([
      "tip_oracle", "shift_outlook", "tip_schedule_sim", "tax_milk_plan",
    ]);
    expect(run.results.every((result) => result.status === "ok")).toBe(true);
    expect(run.results.every((result) => result.facts.every((fact) => fact.basis === "projection"))).toBe(true);
    expect(run.talk.spoken).toMatch(/projection|tax milk|tips/i);

    const badId = executeHerculesReadToolPlan(household, {
      calls: [{ name: "tax_milk_plan", args: { shiftId: "SHIFT-NOPE" } }],
    }, today, { memberId: "MEM-001", view: "household" });
    expect(badId.results[0]?.status).toBe("empty");
    expect(badId.results[0]?.sentence).toMatch(/cannot match shift/i);
  });

  it("simulates a year of tips and wages and teaches the method without posting", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const a = runShiftYearSimulation(household, { today, months: 12, iterations: 400, seed: 21 });
    const b = runShiftYearSimulation(household, { today, months: 12, iterations: 400, seed: 21 });
    const c = runShiftYearSimulation(shuffleShifts(household, 5), { today, months: 12, iterations: 400, seed: 21 });
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(a!.byMonth).toHaveLength(12);
    expect(a!.tipsP10Cents).toBeLessThanOrEqual(a!.tipsP50Cents);
    expect(a!.wagesP50Cents).toBeGreaterThan(0);
    expect(a!.totalP50Cents).toBeGreaterThan(a!.tipsP50Cents);
    expect(a!.assumptions.some((line) => /never posts|Confirm/i.test(line))).toBe(true);

    const lesson = explainShiftYearSimulation(household);
    expect(lesson?.method.length).toBeGreaterThan(0);
    expect(lesson?.limitations.some((line) => /Python sandbox/i.test(line))).toBe(true);

    const tools = executeHerculesReadToolPlan(household, {
      calls: [
        { name: "shift_year_simulation", args: { months: 12, iterations: 300, seed: 3 } },
        { name: "explain_shift_simulation", args: {} },
      ],
    }, today, { memberId: "MEM-002", view: "household" });
    expect(household).toEqual(before);
    expect(tools.results.every((result) => result.status === "ok")).toBe(true);
    expect(tools.results.every((result) => result.facts.every((fact) => fact.basis === "projection"))).toBe(true);
    expect(tools.results[0]?.sentence).toMatch(/tips and .* wages|wages at the midpoint/i);
    expect(tools.results[1]?.sentence).toMatch(/Monte Carlo|method|year sim/i);
  });

  it("keeps the seeded PRNG in unit interval", () => {
    const random = mulberry32(1);
    for (let i = 0; i < 20; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
