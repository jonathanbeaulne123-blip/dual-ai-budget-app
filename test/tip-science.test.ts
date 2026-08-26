import { describe, expect, it } from "vitest";
import {
  executeHerculesReadToolPlan,
  mulberry32,
  observeTipShifts,
  planTaxMilk,
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

  it("keeps the simulated floor inside the historical tip envelope", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const observations = observeTipShifts(household);
    const byMonth = new Map<string, number>();
    for (const row of observations) {
      const month = row.date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + row.netTipsCents);
    }
    const monthly = [...byMonth.values()];
    const maxMonth = Math.max(...monthly);
    const oracle = runTipOracle(household, { today, iterations: 1200, seed: 7, horizonDays: 28 });
    expect(oracle).not.toBeNull();
    // A 28-day safe floor must not exceed the best observed month by more than 25%.
    expect(oracle!.p10Cents).toBeLessThanOrEqual(Math.round(maxMonth * 1.25));
    // Cadence for one week should stay near historical weekly pace, not invent five shifts.
    const weekSlots = upcomingCadenceSchedule(household, today, { days: 7 }).length;
    expect(weekSlots).toBeLessThanOrEqual(4);
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

  it("plans educational tax milk, fails closed on unknown shift ids, and never posts", () => {
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

  it("keeps the seeded PRNG in unit interval", () => {
    const random = mulberry32(1);
    for (let i = 0; i < 20; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
