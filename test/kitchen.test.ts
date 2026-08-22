import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addGoal,
  addRecurrence,
  applySitDown,
  catalogHousehold,
  contributeToGoal,
  describeCompanion,
  equipCosmetic,
  isCosmeticUnlocked,
  makeHearthPass,
  mergeShared,
  postEntry,
  postOneRecurrence,
  renameCompanion,
  scribbleChalk,
  seedDemoHousehold,
  splitForSync,
  wipeChalk,
} from "../src/core/index.ts";
import { COSMETIC_BY_ID } from "../src/core/companion.ts";
import { ValidationError } from "../src/core/types.ts";

const today = "2026-08-21";

describe("daily kitchen cosmetics", () => {
  it("scribbles and wipes without touching transactions", () => {
    const household = catalogHousehold();
    const posted = postEntry(household, {
      date: today,
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      confirmDuplicate: true,
    });
    const chalked = scribbleChalk(posted.household, { text: "Leftover chili", author: "MEM-001" });
    expect(chalked.household.transactions).toHaveLength(posted.household.transactions.length);
    expect(chalked.household.kitchen.chalkboard).toHaveLength(1);
    expect(chalked.household.kitchen.chalkboard[0]?.text).toBe("Leftover chili");
    expect(chalked.postedIds).toEqual([]);

    const wiped = wipeChalk(chalked.household, chalked.household.kitchen.chalkboard[0]!.id);
    expect(wiped.household.kitchen.chalkboard).toHaveLength(0);
    expect(wiped.household.transactions).toHaveLength(posted.household.transactions.length);
    expect(wiped.household.tombstones.some((tombstone) => tombstone.id.startsWith("CHALK-"))).toBe(true);
  });

  it("refuses a locked cosmetic and equips one that is earned", () => {
    const empty = catalogHousehold();
    const gold = COSMETIC_BY_ID.get("gold")!;
    expect(isCosmeticUnlocked(empty, gold, today)).toBe(false);
    expect(() => equipCosmetic(empty, { slot: "chain", itemId: "gold", today })).toThrow(ValidationError);
    expect(() => equipCosmetic(empty, { slot: "chain", itemId: "gold", today })).toThrow(/still locked/);
    expect(empty.transactions).toHaveLength(0);

    let household = postEntry(empty, {
      date: today,
      type: "expense",
      amount: "8.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    }).household;
    const toque = equipCosmetic(household, { slot: "hat", itemId: "toque", today });
    expect(toque.household.kitchen.companion.equipped.hat).toBe("toque");
    expect(toque.household.transactions).toHaveLength(1);

    household = addGoal(toque.household, { name: "Tiny", target: "10", shared: true }).household;
    household = contributeToGoal(household, household.goals[0]!.id, "10").household;
    const chain = equipCosmetic(household, { slot: "chain", itemId: "gold", today });
    expect(chain.household.kitchen.companion.equipped.chain).toBe("gold");
  });

  it("unlocks the visor after a repeating bill is posted, never from a reminder", () => {
    let household = catalogHousehold();
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: today,
      type: "expense",
      amount: "40",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Hydro",
    }).household;
    expect(isCosmeticUnlocked(household, COSMETIC_BY_ID.get("visor")!, today)).toBe(false);
    household = postOneRecurrence(household, household.recurrences[0]!.id, today).household;
    expect(isCosmeticUnlocked(household, COSMETIC_BY_ID.get("visor")!, today)).toBe(true);
  });

  it("renames Hercules and computes hiding when Health is dirty", () => {
    const named = renameCompanion(catalogHousehold(), "Kettle");
    expect(named.household.kitchen.companion.name).toBe("Kettle");
    const view = describeCompanion(named.household, today);
    expect(view.mood === "content" || view.mood === "glowing" || view.mood === "restless").toBe(true);

    const broken = catalogHousehold();
    broken.timezone = "America/Vancouver" as typeof broken.timezone;
    expect(describeCompanion(broken, today).mood).toBe("hiding");
  });

  it("carries chalkboard notes on a Hearth Pass and merge", () => {
    const left = scribbleChalk(catalogHousehold(), { text: "Bianca was here", author: "MEM-001" }).household;
    const pass = makeHearthPass(left);
    expect(pass.shared.kitchen.chalkboard.map((note) => note.text)).toEqual(["Bianca was here"]);
    const right = scribbleChalk(catalogHousehold(), { text: "Jonathan was here", author: "MEM-002" }).household;
    right.inviteCode = left.inviteCode;
    right.householdId = left.householdId;
    const merged = mergeShared(splitForSync(left, "MEM-001").shared, splitForSync(right, "MEM-002").shared);
    expect(merged.kitchen.chalkboard.map((note) => note.text).sort()).toEqual(["Bianca was here", "Jonathan was here"]);
  });

  it("sit-down still writes budgets and chef hat unlocks from that activity", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = household.budgetPlans.length;
    const result = applySitDown(household, "2026-08", {});
    expect(result.household.budgetPlans.length).toBeGreaterThan(before);
    expect(result.household.activity.some((row) => row.action === "Monthly Sit-Down")).toBe(true);
    expect(isCosmeticUnlocked(result.household, COSMETIC_BY_ID.get("chef")!, today)).toBe(true);
  });

  it("does not hardcode a $50 goal contribution in the Plan tab", () => {
    const src = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/contributeToGoal\([^)]*["']50["']/);
    expect(src).toMatch(/contributeToGoal\(household, goal\.id, amount\)/);
    expect(src).toMatch(/formatCad\(row\.lastActualCents\)/);
  });
});
