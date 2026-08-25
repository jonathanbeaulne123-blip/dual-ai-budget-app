import { describe, expect, it } from "vitest";
import {
  eraseDevelopmentData,
  seedStressHousehold,
  stressHouseholdAnnualIncome,
} from "../src/core/index.ts";

const TODAY = "2026-08-25" as const;
const household = seedStressHousehold({
  today: TODAY,
  environment: "development",
  seed: 12345,
  numberStyle: "pretty",
});

describe("Development stress data controls", () => {
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
    expect(stressHouseholdAnnualIncome(household)).toBeLessThanOrEqual(120_000);
    expect(household.booksAcceptedHash).toBeNull();
    expect(household.name).toBe("The Pretty Numbers Household");
    expect(household.budgetPlans.every((row) => row.amountCents % 500 === 0)).toBe(true);
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
});
