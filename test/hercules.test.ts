import { describe, expect, it } from "vitest";
import {
  applySitDown,
  askHercules,
  catalogHousehold,
  cookOffScore,
  describeCompanion,
  equipCosmetic,
  groceryHighFive,
  herculesPageBrief,
  hourInToronto,
  isCosmeticUnlocked,
  postEntry,
  postTransfer,
  scribbleChalk,
  seedDemoHousehold,
  shapeKitchen,
  shiftForecastDisplay,
  sitDownPostcard,
  weekRecap,
} from "../src/core/index.ts";
import { COSMETIC_BY_ID } from "../src/core/companion.ts";

const today = "2026-08-21";

describe("The Hercules Update", () => {
  it("defaults the companion to Hercules the Maine Coon and migrates Ember snapshots", () => {
    const fresh = catalogHousehold();
    expect(fresh.kitchen.companion.name).toBe("Hercules");
    expect(fresh.kitchen.companion.species).toBe("maine-coon");
    expect(fresh.kitchen.companion.equipped.collar).toBeNull();

    const migrated = shapeKitchen({
      chalkboard: [],
      companion: {
        name: "Ember",
        species: "ember",
        equipped: { hat: null, chain: null, house: null, collar: null },
        updatedAt: "",
      },
    });
    expect(migrated.companion.name).toBe("Hercules");
    expect(migrated.companion.species).toBe("maine-coon");
  });

  it("keeps a custom name and never posts from chat", () => {
    const household = catalogHousehold();
    household.kitchen.companion.name = "Kettle";
    const asked = askHercules(household, "who are you", today);
    expect(asked.kind).toBe("answer");
    expect(asked.sentence).toMatch(/Kettle/);
    expect(asked.sentence).toMatch(/do not write/);
    expect(household.transactions).toHaveLength(0);
  });

  it("high-fives only when both people posted groceries today", () => {
    let household = catalogHousehold();
    expect(groceryHighFive(household, today).yes).toBe(false);
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    expect(groceryHighFive(household, today).yes).toBe(false);
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "9",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    const five = groceryHighFive(household, today);
    expect(five.yes).toBe(true);
    expect(five.names).toHaveLength(2);
  });

  it("unlocks collar cosmetics from transfers, chalkboard, and shifts — never from chat", () => {
    let household = catalogHousehold();
    expect(COSMETIC_BY_ID.get("bell")?.slot).toBe("collar");
    household = postTransfer(household, {
      date: today,
      amount: "20",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      confirmDuplicate: true,
    }).household;
    const bell = equipCosmetic(household, { slot: "collar", itemId: "bell", today });
    expect(bell.postedIds).toEqual([]);
    expect(bell.household.kitchen.companion.equipped.collar).toBe("bell");
    expect(bell.household.transactions.filter((tx) => tx.type === "transfer").length).toBe(
      household.transactions.filter((tx) => tx.type === "transfer").length,
    );

    household = scribbleChalk(bell.household, { text: "one", author: "MEM-001" }).household;
    household = scribbleChalk(household, { text: "two", author: "MEM-001" }).household;
    household = scribbleChalk(household, { text: "three", author: "MEM-001" }).household;
    const yarn = equipCosmetic(household, { slot: "collar", itemId: "yarn", today });
    expect(yarn.household.kitchen.companion.equipped.collar).toBe("yarn");

    const demo = seedDemoHousehold({ today, environment: "development" });
    expect(demo.shifts.length).toBeGreaterThan(0);
    const fish = equipCosmetic(demo, { slot: "collar", itemId: "fish", today });
    expect(fish.postedIds).toEqual([]);
    expect(fish.household.kitchen.companion.equipped.collar).toBe("fish");
  });

  it("coaches and answers tips without inventing a write", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const coach = askHercules(household, "what should I do", today);
    expect(coach.kind).toBe("answer");
    expect(coach.sentence.length).toBeGreaterThan(8);
    const tips = askHercules(household, "tips this week", today);
    expect(tips.kind).toBe("answer");
    const skip = askHercules(household, "safe to skip", today);
    expect(skip.kind).toBe("answer");
    expect(herculesPageBrief(household, "calendar", today)).toMatch(/Calendar|remind/i);
    expect(describeCompanion(household, today).name).toBe("Hercules");
  });

  it("uses America/Toronto hours for greetings", () => {
    const hour = hourInToronto(new Date("2026-08-21T12:00:00Z"));
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThan(24);
  });

  it("unlocks the July patio in August and keeps winter ruff locked until a cold-month post", () => {
    const empty = catalogHousehold();
    expect(isCosmeticUnlocked(empty, COSMETIC_BY_ID.get("patio")!, today)).toBe(true);
    expect(isCosmeticUnlocked(empty, COSMETIC_BY_ID.get("ruff")!, today)).toBe(false);
    const winter = postEntry(empty, {
      date: "2026-01-15",
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    }).household;
    expect(isCosmeticUnlocked(winter, COSMETIC_BY_ID.get("ruff")!, today)).toBe(true);
    const patio = equipCosmetic(empty, { slot: "house", itemId: "patio", today });
    expect(patio.postedIds).toEqual([]);
    expect(patio.household.kitchen.companion.equipped.house).toBe("patio");
  });

  it("cooks off household groceries vs coffee without naming a person", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "40",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "12",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    const cook = cookOffScore(household, today);
    expect(cook.winner).toBe("kitchen");
    expect(cook.sentence).not.toMatch(/Bianca|Jonathan/);
    const asked = askHercules(household, "Cook-off", today);
    expect(asked.sentence).toMatch(/kitchen is winning/i);
  });

  it("prints a sit-down postcard and never treats forecast as a post", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const closed = applySitDown(household, "2026-08", {});
    const card = sitDownPostcard(closed.household);
    expect(card.ready).toBe(true);
    expect(card.text.length).toBeLessThanOrEqual(80);
    expect(closed.postedIds).toEqual([]);

    const forecast = shiftForecastDisplay(household);
    expect(forecast.unlocked).toBe(true);
    expect(forecast.weeksPosted).toBeGreaterThanOrEqual(8);
    const asked = askHercules(household, "forecast", today);
    expect(asked.kind).toBe("answer");
    expect(asked.sentence).toMatch(/Display only|will not post/i);

    const recap = weekRecap(household, "2026-08-23");
    expect(recap.isSunday).toBe(true);
    expect(recap.rows.length).toBeGreaterThan(2);
  });
});
