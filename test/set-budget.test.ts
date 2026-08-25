import { describe, expect, it } from "vitest";
import { catalogHousehold, monthKeyFromDateKey, monthSummary, setBudget } from "../src/core/index.ts";

const today = "2026-08-21";
const monthKey = monthKeyFromDateKey(today);

describe("setBudget command", () => {
  it("updates the monthly plan for a category", () => {
    const household = catalogHousehold();
    const before = monthSummary(household, monthKey);
    const groceries = before.categories.find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES");
    expect(groceries?.budgetedCents ?? 0).toBe(0);

    const result = setBudget(household, {
      monthKey,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: "650",
    });
    const after = monthSummary(result.household, monthKey);
    const planned = after.categories.find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES");
    expect(planned?.budgetedCents).toBe(65000);
    expect(result.undo.label).toMatch(/Groceries/);
    expect(result.household.transactions).toEqual(household.transactions);
  });

  it("replaces an existing plan for the same month and category", () => {
    let household = setBudget(catalogHousehold(), {
      monthKey,
      subcategoryId: "SUB-HOUSING-RENT",
      amount: "1800",
    }).household;
    household = setBudget(household, {
      monthKey,
      subcategoryId: "SUB-HOUSING-RENT",
      amount: "1850",
    }).household;
    const rent = monthSummary(household, monthKey).categories.find((row) => row.subcategoryId === "SUB-HOUSING-RENT");
    expect(rent?.budgetedCents).toBe(185000);
    expect(
      household.budgetPlans.filter((plan) => plan.monthKey === monthKey && plan.subcategoryId === "SUB-HOUSING-RENT"),
    ).toHaveLength(1);
  });

  it("rejects invalid amounts without mutating plans", () => {
    const household = catalogHousehold();
    expect(() =>
      setBudget(household, {
        monthKey,
        subcategoryId: "SUB-FOOD-GROCERIES",
        amount: "nope",
      }),
    ).toThrow(/Budgeted amount/);
    expect(household.budgetPlans).toEqual(catalogHousehold().budgetPlans);
  });
});
