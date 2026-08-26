import { describe, expect, it } from "vitest";
import {
  executeHerculesReadToolPlan,
  mulberry32,
  planTaxMilk,
  runTipOracle,
  seedDemoHousehold,
  shiftOutlook,
  simulateTipSchedule,
  upcomingCadenceSchedule,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("Hercules Shift Oracle tip science", () => {
  it("keeps Monte Carlo deterministic for the same seed and never mutates the household", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const a = runTipOracle(household, { today, iterations: 800, seed: 42, horizonDays: 28 });
    const b = runTipOracle(household, { today, iterations: 800, seed: 42, horizonDays: 28 });
    const c = runTipOracle(household, { today, iterations: 800, seed: 43, horizonDays: 28 });
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
    expect(c?.p50Cents).not.toEqual(a?.p50Cents);
    expect(a!.p10Cents).toBeLessThanOrEqual(a!.p50Cents);
    expect(a!.p50Cents).toBeLessThanOrEqual(a!.p90Cents);
    expect(a!.safeBaselineCents).toBe(a!.p10Cents);
    expect(a!.assumptions.some((line) => /projection|not a promise/i.test(line))).toBe(true);
    expect(household).toEqual(before);
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

  it("plans educational tax milk and peak buffers without posting", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const plan = planTaxMilk(household, { tipCents: 40_000, taxRateBps: 2500 });
    expect(plan).not.toBeNull();
    expect(plan!.taxMilkCents).toBe(10_000);
    expect(plan!.taxMilkCents + plan!.bufferCents + plan!.leftoverCents).toBe(plan!.tipCents);
    expect(plan!.assumptions.some((line) => /Confirm/i.test(line))).toBe(true);
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
    expect(run.results.every((result) => result.facts.every((fact) => fact.basis === "projection" || fact.label === "Sample shifts"))).toBe(true);
    expect(run.talk.spoken).toMatch(/projection|tax milk|tips/i);
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
