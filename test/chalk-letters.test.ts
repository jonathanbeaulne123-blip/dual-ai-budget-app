import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  detectChalkLetters,
  eraseGlyphAt,
  inkFromText,
  mergeKitchen,
  neatenChalk,
  organizeNeatText,
  scribbleChalk,
  splitForSync,
} from "../src/core/index.ts";

describe("drawable chalkboard", () => {
  it("reads typeset letters from ink on-device", () => {
    expect(detectChalkLetters(inkFromText("MILK"))).toMatch(/MILK/);
    expect(detectChalkLetters(inkFromText("12"))).toMatch(/12/);
    expect(organizeNeatText("eggs\n2026-08-21 hydro\nmilk")).toBe("2026-08-21 hydro\neggs\nmilk");
  });

  it("keeps ink on the snapshot and neatens without posting", () => {
    const household = catalogHousehold();
    const drawn = scribbleChalk(household, {
      author: "MEM-001",
      ink: inkFromText("MILK"),
    });
    expect(drawn.postedIds).toEqual([]);
    expect(drawn.household.transactions).toHaveLength(household.transactions.length);
    const note = drawn.household.kitchen.chalkboard.at(-1);
    expect(note?.ink?.strokes.length).toBeGreaterThan(0);
    const neat = neatenChalk(drawn.household, note!.id);
    expect(neat.postedIds).toEqual([]);
    expect(neat.household.kitchen.chalkboard.at(-1)?.text).toMatch(/MILK/i);
  });

  it("merges ink across phones", () => {
    const jonathan = scribbleChalk(catalogHousehold(), { text: "oat milk", author: "MEM-002", ink: inkFromText("OAT") });
    const bianca = scribbleChalk(catalogHousehold(), { text: "eggs", author: "MEM-001" });
    const left = splitForSync(jonathan.household, "MEM-002").shared;
    const right = splitForSync(bianca.household, "MEM-001").shared;
    const merged = mergeKitchen(left.kitchen, right.kitchen, []);
    expect(merged.chalkboard.some((note) => note.ink && note.ink.strokes.length > 0)).toBe(true);
    expect(merged.chalkboard.map((note) => note.text).sort()).toEqual(["eggs", "oat milk"]);
  });

  it("erases one letter cluster without wiping the rest of the board", () => {
    const milk = inkFromText("MILK");
    const glyphs = milk.strokes;
    expect(glyphs.length).toBeGreaterThan(1);
    const first = glyphs[0]!.points[0]!;
    const erased = eraseGlyphAt(milk, first.x, first.y);
    expect(erased).not.toBeNull();
    expect(erased!.strokes.length).toBeLessThan(milk.strokes.length);
    expect(erased!.strokes.length).toBeGreaterThan(0);
  });
});
