import { describe, expect, it } from "vitest";
import {
  addGoal,
  kittyBankBars,
  kittyBankFill,
  kittyBankGlance,
  kittyBankStep,
  kittyBanksInView,
  seedDemoHousehold,
} from "../src/core/index.ts";

describe("Kitty Banks", () => {
  it("keeps Shared banks as existing shared goals and Personal banks as unshared goals", () => {
    const household = seedDemoHousehold({ environment: "development", today: "2026-08-21" });
    const shared = kittyBanksInView(household, "household");
    const personal = kittyBanksInView(household, "personal");
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((goal) => goal.shared)).toBe(true);
    expect(personal.every((goal) => !goal.shared)).toBe(true);
    const glance = kittyBankGlance(shared);
    expect(glance.count).toBe(shared.length);
    expect(glance.label).toMatch(/bank/);
    expect(glance.cents).toBe(shared.reduce((sum, goal) => sum + goal.savedCents, 0));
    expect(kittyBankFill(shared[0]!)).toBeGreaterThan(0);
    expect(kittyBankFill(shared[0]!)).toBeLessThanOrEqual(1);
    expect(kittyBankBars(shared)[0]?.cents).toBe(shared[0]!.savedCents);
  });

  it("maps savedCents into distinct 10% fatness steps", () => {
    expect(kittyBankStep({ savedCents: 0, targetCents: 10000 })).toBe(0);
    expect(kittyBankStep({ savedCents: 999, targetCents: 10000 })).toBe(0);
    expect(kittyBankStep({ savedCents: 1000, targetCents: 10000 })).toBe(1);
    expect(kittyBankStep({ savedCents: 5000, targetCents: 10000 })).toBe(5);
    expect(kittyBankStep({ savedCents: 9999, targetCents: 10000 })).toBe(9);
    expect(kittyBankStep({ savedCents: 10000, targetCents: 10000 })).toBe(10);
    expect(kittyBankStep({ savedCents: 12000, targetCents: 10000 })).toBe(10);
  });

  it("does not invent a second envelope when adding a personal bank", () => {
    const seeded = seedDemoHousehold({ environment: "development", today: "2026-08-21" });
    const before = kittyBanksInView(seeded, "personal").length;
    const next = addGoal(seeded, {
      name: "Headphones",
      target: "200",
      shared: false,
      ownerMemberId: "MEM-002",
    }).household;
    expect(kittyBanksInView(next, "personal").some((goal) => goal.name === "Headphones")).toBe(true);
    expect(kittyBanksInView(next, "household").some((goal) => goal.name === "Headphones")).toBe(false);
    expect(kittyBanksInView(next, "personal").length).toBe(before + 1);
    expect(kittyBanksInView(seeded, "personal", "MEM-002").every((goal) => goal.ownerMemberId === "MEM-002")).toBe(true);
    expect(kittyBanksInView(seeded, "personal", "MEM-002").some((goal) => goal.name === "Bianca trip fund")).toBe(false);
  });
});
