import { describe, expect, it } from "vitest";
import { appendPlanSitdownTurn, closeChapter, openChapter, postEntry, type Household } from "../src/core/index.ts";
import { pathMonths, umbrellaSeedMonth } from "../src/core/pathSignals.ts";
import { effectivePathRecipes } from "../src/core/pathWorld.ts";
import { umbrellaHueForCategory } from "../src/core/fundModel.ts";
import { growIsland } from "../src/path/grow.ts";
import { ALEX, fundedHousehold, migrated } from "./fixtures/fund-model.ts";
import type { PlanVersion } from "../src/core/planSystem.ts";

/** Fictional books only. */
const today = "2026-10-20";
function spend(h: Household, date: string, amount: number, subcategoryId: string): Household {
  return postEntry(h, { date, type: "expense", amount, accountId: "ACC-CHEQUING", subcategoryId, createdBy: ALEX, note: "Fictional spending", confirmDuplicate: true }).household;
}
function agreedPlan(h: Household, monthKey: `${number}-${number}`, createdAt: string): Household {
  const version: PlanVersion = { id: `PV-${monthKey}`, scope: "household", monthKey, sequence: 1, lines: [], assumptions: [], reason: "Fictional", digest: "fictional", state: "active", createdBy: ALEX, createdAt, activatedAt: createdAt };
  return { ...h, planVersions: [...(h.planVersions ?? []), version] };
}
function sortedBooks(): Household {
  let h = fundedHousehold("2000");
  h = spend(h, "2026-09-05", 120, "SUB-FOOD-GROCERIES");
  h = migrated(h, "2026-09-16T12:00:00.000Z");
  h = spend(h, "2026-10-03", 80, "SUB-FOOD-GROCERIES");
  h = spend(h, "2026-10-04", 60, "SUB-HOUSING-ELECTRIC");
  return h;
}

describe("Slice 11 — world pieces per umbrella (D-281)", () => {
  it("reads a shape per umbrella only once the household is sorted, never an amount", () => {
    const v1 = pathMonths(spend(fundedHousehold("2000"), "2026-09-05", 120, "SUB-FOOD-GROCERIES"), today);
    expect(v1.every(month => month.umbrellas === undefined)).toBe(true);
    const months = pathMonths(sortedBooks(), today);
    const october = months.find(month => month.key === "2026-10")!;
    expect(Object.keys(october.umbrellas!).sort()).toEqual(["food", "utilities"]);
    expect(Object.values(october.umbrellas!).every(v => v > 0 && v <= 1)).toBe(true);
    expect(october.why["umbrella:food"]).toBe("Spending under Food");
  });

  it("the first plan agreed after the migration seeds the slots; an earlier plan does not", () => {
    let h = sortedBooks();
    h = agreedPlan(h, "2026-08", "2026-08-01T12:00:00.000Z");
    expect(umbrellaSeedMonth(h)).toBeNull();
    expect(growIsland(pathMonths(h, today), effectivePathRecipes(h), 99).pieces.some(p => p.kind === "umbrella")).toBe(false);
    h = agreedPlan(h, "2026-10", "2026-10-01T12:00:00.000Z");
    expect(umbrellaSeedMonth(h)).toBe("2026-10");
    const months = pathMonths(h, today);
    expect(months.find(m => m.key === "2026-10")!.tags).toContain("umbrella-slots");
    const island = growIsland(months, effectivePathRecipes(h), months.length - 1);
    const pennants = island.pieces.filter(p => p.kind === "umbrella");
    expect(pennants.map(p => p.umbrellaId).sort()).toEqual(["food", "utilities"]);
    expect(pennants.find(p => p.umbrellaId === "utilities")!.hue).toBe(umbrellaHueForCategory(h, "SUB-HOUSING-ELECTRIC"));
    // No amounts in the world.
    for (const piece of pennants) for (const line of piece.why) expect(line).not.toMatch(/\$|\d+\.\d\d|cents?/);
  });

  it("keeps every existing piece exactly where it was", () => {
    const h = agreedPlan(sortedBooks(), "2026-10", "2026-10-01T12:00:00.000Z");
    const months = pathMonths(h, today);
    const withPennants = growIsland(months, effectivePathRecipes(h), months.length - 1).pieces.filter(p => p.kind !== "umbrella");
    const without = growIsland(months.map(({ umbrellas: _u, ...m }) => ({ ...m, tags: m.tags.filter(t => t !== "umbrella-slots") })), effectivePathRecipes(h), months.length - 1).pieces;
    expect(withPennants).toEqual(without);
  });

  it("closing the check-in and the Chapter feed the month", () => {
    let h = sortedBooks();
    h = openChapter(h, { memberId: ALEX, foundationId: "make-rent-boring", at: "2026-09-02T12:00:00.000Z" }).household;
    const before = pathMonths(h, today).find(m => m.key === "2026-10")!;
    expect(before.scores.together).toBe(0);
    h = appendPlanSitdownTurn(h, { sitDownSessionId: "SITDOWN-FICTIONAL", monthKey: "2026-10", planDraftId: "PLAN-2026-10", memberId: ALEX, text: "We are carrying the plan forward.", checkpoint: { stage: 7 } }).household;
    const session = h.planHerculesSessions!.find(row => row.monthKey === "2026-10")!;
    h = { ...h, planHerculesSessions: h.planHerculesSessions!.map(row => row.id === session.id ? { ...row, state: "closed" as const } : row) };
    const chapterId = h.chapters!.find(row => row.state === "open")!.id;
    h = closeChapter(h, { memberId: ALEX, chapterId, outcome: "established", at: "2026-10-18T12:00:00.000Z" }).household;
    const after = pathMonths(h, today).find(m => m.key === "2026-10")!;
    expect(after.scores.together).toBeGreaterThanOrEqual(0.7);
    expect(after.why.together).toContain("a Sitdown");
    expect(after.scores.learning).toBe(0.8);
  });
});
