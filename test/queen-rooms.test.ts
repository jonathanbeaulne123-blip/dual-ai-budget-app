// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Household } from "../src/core/types.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { addGoal, addRecurrence } from "../src/core/commands.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { saveKittyNestDesign, shapeKittyNestDesigns } from "../src/core/kittyNestDesigns.ts";
import { QUEEN_SHELF_BANK_KEY, queenRibbons, queenShelf, queenShelfOrder, queenShelfReorder, type QueenShelfItem } from "../src/core/queenPresentation.ts";

const memberId = "MEM-001";
const today = "2026-09-12";
/** A household with something on the ledge: one Build goal and one lidded Build bill. Fictional throughout. */
function withLedge(): Household {
  let h = planLifeFixture("household");
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-26", type: "expense", amount: "60", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional date night" }).household;
  h = addGoal(h, { name: "Fictional trip to the shore", target: "2000", shared: true, ownerMemberId: memberId }).household;
  h = addGoal(h, { name: "Fictional new stove", target: "900", shared: true, ownerMemberId: memberId }).household;
  return h;
}
const shelfOf = (h: Household) => queenShelf(projectKittyNest(h, memberId, "household", today), h, queenShelfOrder(h.kittyNestDesigns));
const keepOrder = (h: Household, order: string[], who = memberId) => {
  const design = h.kittyNestDesigns?.find((row) => row.bankKey === QUEEN_SHELF_BANK_KEY && row.visibility === "household");
  return saveKittyNestDesign(h, { memberId: who, view: "household", bankKey: QUEEN_SHELF_BANK_KEY, expectedRevision: design?.revision ?? 0, name: design?.name ?? "Build", glaze: design?.glaze ?? "cream", order }).household;
};
const names = (rows: readonly QueenShelfItem[]) => rows.map((row) => row.name);

describe("The loft's shelf — arrangement is the data, and the last save wins", () => {
  it("keeps the nest's own order until somebody moves something", () => {
    const h = withLedge();
    const shelf = shelfOf(h);
    expect(shelf.length).toBeGreaterThan(1);
    expect(shelf.every((row) => row.place === null)).toBe(true);
    expect(queenShelfOrder(h.kittyNestDesigns)).toEqual([]);
  });

  it("moves one bank and leaves every other bank where it was", () => {
    const shelf = shelfOf(withLedge());
    const keys = shelf.map((row) => row.designKey);
    const moving = shelf[shelf.length - 1]!;
    const toFront = queenShelfReorder(shelf, moving.id, 0);
    expect(toFront[0]).toBe(moving.designKey);
    expect(toFront.slice(1)).toEqual(keys.slice(0, -1));
    expect(new Set(toFront).size).toBe(keys.length);
    // Back where it started is a no-op, not a shuffle.
    expect(queenShelfReorder(shelf, moving.id, shelf.length)).toEqual(keys);
    // A bank the shelf does not hold cannot move anything.
    expect(queenShelfReorder(shelf, "nothing", 0)).toEqual(keys);
  });

  it("round-trips a rank through the design row, and the later save wins", () => {
    let h = withLedge();
    const shelf = shelfOf(h);
    const last = shelf[shelf.length - 1]!;
    const first = shelf[0]!;
    h = keepOrder(h, queenShelfReorder(shelf, last.id, 0));
    expect(names(shelfOf(h))[0]).toBe(last.name);
    // The other partner moves it back. No proposal, no confirmation: the later save is the shelf.
    h = keepOrder(h, queenShelfReorder(shelfOf(h), last.id, shelf.length), "MEM-002");
    expect(names(shelfOf(h))[0]).toBe(first.name);
    expect(names(shelfOf(h)).at(-1)).toBe(last.name);
    // The order survives the shaper, and a stale revision is still refused.
    expect(queenShelfOrder(shapeKittyNestDesigns(h.kittyNestDesigns))).toHaveLength(shelf.length);
    expect(() => saveKittyNestDesign(h, { memberId, view: "household", bankKey: QUEEN_SHELF_BANK_KEY, expectedRevision: 0, name: "Build", glaze: "cream", order: [] })).toThrow();
  });

  it("refuses a malformed order, and a shelf that changed under the order still reads", () => {
    let h = withLedge();
    const shelf = shelfOf(h);
    h = keepOrder(h, queenShelfReorder(shelf, shelf[shelf.length - 1]!.id, 0));
    const row = shapeKittyNestDesigns(h.kittyNestDesigns).find((d) => d.bankKey === QUEEN_SHELF_BANK_KEY)!;
    for (const bad of [["a", "a"], [""], [1 as unknown as string], Array.from({ length: 201 }, (_, i) => `k${i}`), "x" as unknown as string[]]) {
      expect(() => shapeKittyNestDesigns([{ ...row, order: bad }]), JSON.stringify(bad).slice(0, 40)).toThrow();
    }
    // Only a shelf's own row may carry one.
    expect(() => shapeKittyNestDesigns([{ ...row, bankKey: "king", id: row.id.replace(QUEEN_SHELF_BANK_KEY, "king"), category: null }])).toThrow();
    // A key for a bank that has left the shelf is simply ignored; the rest still reads.
    const stale = keepOrder(h, ["goal:gone", ...queenShelfOrder(h.kittyNestDesigns)]);
    expect(names(shelfOf(stale))).toEqual(names(shelfOf(h)));
  });

  it("carries the form the ledge reads and never an amount", () => {
    const shelf = shelfOf(withLedge());
    for (const row of shelf) {
      expect(row.fullness).toBeGreaterThanOrEqual(0);
      expect(row.fullness).toBeLessThanOrEqual(1);
      // Quantised to a twentieth: a level you can see, not a percentage you can read.
      expect(Math.abs(row.fullness * 20 - Math.round(row.fullness * 20))).toBeLessThan(1e-9);
      expect(["small", "middling", "large"]).toContain(row.size);
      expect(Number.isInteger(row.parts)).toBe(true);
      expect(row.designKey.length).toBeGreaterThan(0);
      expect(["open", "lidded"]).toContain(row.mouth);
    }
  });
});

describe("The cellar's ribbon — one axis, and it is time", () => {
  it("gives every jar a swell and a fill as bands, and a quiet month claims nothing", () => {
    const ribbons = queenRibbons(planLifeFixture("household"), today);
    expect(ribbons.length).toBeGreaterThan(0);
    for (const ribbon of ribbons) {
      for (const jar of ribbon.jars) {
        expect(jar.swell).toBeGreaterThanOrEqual(0.85);
        expect(jar.swell).toBeLessThanOrEqual(1.45);
        expect(jar.fill).toBeGreaterThanOrEqual(0);
        expect(jar.fill).toBeLessThanOrEqual(1);
        // Both are stepped, so no dollar figure survives the trip onto a shape.
        expect(Math.abs(jar.swell * 20 - Math.round(jar.swell * 20))).toBeLessThan(1e-9);
        expect(Math.abs(jar.fill * 20 - Math.round(jar.fill * 20))).toBeLessThan(1e-9);
        if (jar.beat !== "posted") { expect(jar.swell).toBe(1); expect(jar.fill).toBe(0); }
      }
      // The month that broke the beat is the one that swelled furthest.
      const outlier = ribbon.jars.find((jar) => jar.outlier);
      if (outlier) for (const jar of ribbon.jars) if (jar.beat === "posted" && !jar.outlier) expect(outlier.swell).toBeGreaterThanOrEqual(jar.swell);
    }
  });
});
