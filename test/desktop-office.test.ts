import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOOK,
  DEFAULT_ORDER,
  PERSONALITY_DESK,
  PINNED_INSTRUMENTS,
  applyPersonality,
  cycleInstrumentSize,
  defaultLayout,
  packRects,
  packWide,
  parseOfficeLayout,
  parseOfficeLook,
  sizeOf,
  tidyOfficeLayout,
} from "../src/core/index.ts";

function overlap(left: { x: number; y: number; w: number; h: number }, right: { x: number; y: number; w: number; h: number }): boolean {
  return left.x < right.x + right.w
    && left.x + left.w > right.x
    && left.y < right.y + right.h
    && left.y + left.h > right.y;
}

describe("wide desk packing", () => {
  it("does not overlap default sizes at 900px or 1100px", () => {
    const items = DEFAULT_ORDER.map((id) => ({ id, size: sizeOf({ id }) }));
    for (const width of [900, 1100]) {
      const rects = packRects(items, width);
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          expect(overlap(rects[i]!, rects[j]!)).toBe(false);
        }
      }
      expect(packWide(items, width).calculator).toEqual({ x: 16, y: 16 });
    }
  });

  it("floors the pad at M and parks everything a personality did not name", () => {
    expect(cycleInstrumentSize("calculator", "m")).toBe("l");
    expect(cycleInstrumentSize("calculator", "l")).toBe("m");
    expect(cycleInstrumentSize("mail", "s")).toBe("m");
    const cpa = applyPersonality(defaultLayout(), "cpa");
    expect(cpa.items.find((item) => item.id === "calculator")?.hidden).toBeFalsy();
    expect(cpa.items.find((item) => item.id === "blotter")?.size).toBe("l");
    expect(cpa.items.find((item) => item.id === "hangman")?.hidden).toBe(true);
    expect(cpa.items.filter((item) => !item.hidden).map((item) => item.id)).toEqual(
      PERSONALITY_DESK.cpa.map(([id]) => id),
    );
    expect(PINNED_INSTRUMENTS).toContain("calculator");
  });

  it("keeps a saved size on v:1 layouts and fail-softs look JSON", () => {
    const parsed = parseOfficeLayout({
      v: 1,
      items: [{ id: "blotter", size: "l", x: 16, y: 40 }],
      expanded: null,
      minimized: [],
      windowMinimized: false,
    });
    expect(parsed.items.find((item) => item.id === "blotter")?.size).toBe("l");
    expect(parseOfficeLook({ stock: "neon", density: "loud", cat: 480 })).toEqual(DEFAULT_LOOK);
    expect(parseOfficeLook({ stock: "graph", density: "glance" })).toEqual({ stock: "graph", density: "glance" });
    expect(parseOfficeLook({ stock: "pink", density: "names" }).stock).toBe("pink");
    expect(parseOfficeLook({ stock: "gold", density: "names" }).stock).toBe("gold");
    expect(parseOfficeLook({ stock: "slate", density: "names" }).stock).toBe("slate");
    const tidied = tidyOfficeLayout(parsed, "wide", 900);
    expect(tidied.items.find((item) => item.id === "blotter")?.x).toBe(16);
    expect(tidied.expanded).toBeNull();
  });
});

describe("desktop warmth fence", () => {
  it("keeps Fraunces names and refuses a 1280 lobby or 10px Bloomberg labels", () => {
    const office = readFileSync("src/office.css", "utf8");
    const styles = readFileSync("src/styles.css", "utf8");
    expect(office).toMatch(/\.instrument-name \{[\s\S]*font-family: var\(--display\)/);
    expect(office).toMatch(/font-size: 13px;/);
    expect(office).not.toMatch(/\.office \.instrument-name \{[\s\S]*font-size: 10px/);
    expect(styles).toMatch(/max-width: min\(900px, 100%\)/);
    expect(styles).not.toMatch(/1280px/);
    expect(office).not.toMatch(/always-open panel/);
    const cabinets = readFileSync("src/widgets/Cabinets.tsx", "utf8");
    expect(cabinets).toMatch(/Home theme/);
    const instrument = readFileSync("src/widgets/Instrument.tsx", "utf8");
    expect(instrument).not.toMatch(/alwaysBody/);
  });
});
