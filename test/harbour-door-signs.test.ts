import { describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading, EMPTY_ATLAS_READING, EMPTY_BOATHOUSE_READING, EMPTY_CAMPFIRE_READING, EMPTY_CELLAR_READING, EMPTY_CISTERN_READING, EMPTY_COTTAGE_READING, EMPTY_GLASSHOUSE_READING, EMPTY_KILN_READING, EMPTY_KITCHEN_READING, EMPTY_TOWER_READING, type HarbourReading } from "../src/harbour/data/reading.ts";
import { COURT_SIGN_PLACES, SIGN_LINE_MAX, SIGN_TITLES, courtSigns, doorSigns, placeSigns, plainDollars, shortDate, shortMonth } from "../src/harbour/nav/doorSigns.ts";
import { HARBOUR_PLACE_NAMES, type HarbourPlaceId } from "../src/harbour/flag.ts";
import { engravedPlate } from "../src/harbour/court/engraved.ts";

const today = "2026-09-20";
const settled: HarbourReading = {
  everyday: 41250,
  prepare: { cents: 30000, target: 43400, coveredThrough: "2026-09-25" },
  protect: { cents: 180000, target: 300000 },
  build: { cents: 124000, target: 900000, goals: 4 },
  next: { label: "Internet", date: "2026-09-18", cents: 9200, daysAhead: 0, target: "cellar-bills" },
  noticed: null,
  slip: [],
  condition: { state: "settled", days: 0, words: "The house is settled." },
  glaze: "glazed",
  banks: 4,
  jars: 3,
  mode: 2,
  freshness: "current",
  tower: {
    ...EMPTY_TOWER_READING,
    shelves: [{ id: "shelf-1", share: 5, cutoff: 20, full: false, banks: ["Trip", "Table", "Vet", "Winter"].map((name, i) => ({ key: `goal:${i}`, goalId: `G-${i}`, name, cents: 10_000, targetCents: 100_000, step: 1, category: "build" as const, sculptSeed: `goal:${i}` })) }],
  },
  cellar: EMPTY_CELLAR_READING,
  cistern: EMPTY_CISTERN_READING,
  glasshouse: EMPTY_GLASSHOUSE_READING,
  kitchen: EMPTY_KITCHEN_READING,
  boathouse: EMPTY_BOATHOUSE_READING,
  cottage: EMPTY_COTTAGE_READING,
  kiln: EMPTY_KILN_READING,
  campfire: EMPTY_CAMPFIRE_READING,
  atlas: EMPTY_ATLAS_READING,
};

describe("plain words for the door signs", () => {
  it("writes whole dollars with thousands separators and a dash for the unknown", () => {
    expect(plainDollars(124000)).toBe("$1,240");
    expect(plainDollars(180000)).toBe("$1,800");
    expect(plainDollars(123456789)).toBe("$1,234,568");
    expect(plainDollars(0)).toBe("$0");
    expect(plainDollars(-12050)).toBe("-$121");
    expect(plainDollars(-40)).toBe("$0");
    expect(plainDollars(null)).toBe("—");
  });

  it("shortens a month key to its month, and leaves anything else alone", () => {
    expect(shortMonth("2026-09")).toBe("Sep");
    expect(shortMonth("2027-01")).toBe("Jan");
    expect(shortMonth("later")).toBe("later");
  });

  it("shortens civil dates and leaves anything else alone", () => {
    expect(shortDate("2026-09-18")).toBe("Sep 18");
    expect(shortDate("2027-01-05")).toBe("Jan 5");
    expect(shortDate("someday")).toBe("someday");
  });
});

describe("doorSigns — tower, cellar, cistern", () => {
  it("counts the banks the rack actually holds, so the sign and the room agree", () => {
    expect(doorSigns({ ...settled, banks: 9 }).tower.line).toBe("4 banks · $1,240 saved");
    expect(doorSigns({ ...settled, banks: 9, tower: { ...settled.tower, shelves: [{ ...settled.tower.shelves[0]!, banks: [] }] } }).tower.line).toBe("0 banks · $1,240 saved");
  });

  it("reads the plan's examples back word for word", () => {
    const signs = doorSigns(settled);
    expect(signs.tower.line).toBe("4 banks · $1,240 saved");
    expect(signs.cellar.line).toBe("3 bills · next Internet Sep 18");
    expect(signs.cistern.line).toBe("$1,800 of $3,000");
    expect(signs.tower.aria).toBe("The tower. 4 kitty banks, $1,240 saved. Opens the Loft.");
    expect(signs.cellar.aria).toBe("The cellar stair. 3 bill jars this month; the next is Internet on Sep 18, today. Opens the Cellar.");
    expect(signs.cistern.aria).toBe("The cistern. $1,800 of a $3,000 buffer. Opens the Protect bank.");
  });

  it("uses singular words for one bank, one bill", () => {
    const signs = doorSigns({ ...settled, banks: 1, jars: 1, tower: { ...settled.tower, shelves: [{ ...settled.tower.shelves[0]!, banks: settled.tower.shelves[0]!.banks.slice(0, 1) }] }, next: { ...settled.next!, daysAhead: 1 } });
    expect(signs.tower.line).toBe("1 bank · $1,240 saved");
    expect(signs.cellar.line).toBe("1 bill · next Internet Sep 18");
    expect(signs.cellar.aria).toContain("1 bill jar this month; the next is Internet on Sep 18, tomorrow.");
  });

  it("shows a dash, never $0, when the money is unknown", () => {
    const signs = doorSigns({ ...settled, build: { cents: null, target: 0, goals: 0 }, protect: { cents: null, target: 300000 }, cistern: { cents: null, target: 300000, level: 0.06 } });
    expect(signs.tower.line).toBe("4 banks · — saved");
    expect(signs.tower.aria).toContain("not known yet");
    expect(signs.cistern.line).toBe("—");
    expect(signs.cistern.aria).toContain("not known yet");
    expect(JSON.stringify(signs)).not.toContain("$0");
  });

  it("says when nothing is dated, and does not point the cellar at a goal", () => {
    expect(doorSigns({ ...settled, next: null }).cellar.line).toBe("3 bills · nothing dated");
    const goalNext = doorSigns({ ...settled, next: { label: "Trip", date: "2026-11-01", cents: 1, daysAhead: 42, target: "loft-banks" } });
    expect(goalNext.cellar.line).toBe("3 bills · nothing dated");
    expect(goalNext.cellar.aria).toContain("no dated bill is next");
  });

  it("names a buffer that is set aside without an agreed target", () => {
    const signs = doorSigns({ ...settled, protect: { cents: 50000, target: 0 }, cistern: { cents: 50000, target: 0, level: 0.06 } });
    expect(signs.cistern.line).toBe("$500 set aside");
    expect(signs.cistern.aria).toContain("no buffer agreed yet");
  });

  it("speaks in days for a bill further out", () => {
    expect(doorSigns({ ...settled, next: { ...settled.next!, daysAhead: 5 } }).cellar.aria).toContain("on Sep 18, in 5 days.");
  });

  it("reads the demo household without jargon", () => {
    const signs = doorSigns(buildHarbourReading(seedDemoHousehold({ today }), "MEM-001", today, "current"));
    for (const sign of Object.values(signs)) {
      expect(sign.line.length).toBeGreaterThan(0);
      expect(sign.aria).toMatch(/Opens the/);
      expect(sign.line + sign.aria).not.toMatch(/cents|snapshot|nest|pulse|null|undefined|NaN/i);
    }
    expect(signs.cellar.line).toBe("4 bills · next Internet Sep 20");
  });
});

describe("placeSigns — every building on the island wears its own", () => {
  const places = Object.keys(HARBOUR_PLACE_NAMES) as HarbourPlaceId[];

  it("gives every place a sign, and no place a blank one", () => {
    const signs = placeSigns(settled);
    expect(Object.keys(signs).sort()).toEqual([...places].sort());
    for (const place of places) {
      const sign = signs[place];
      expect(sign.line.length).toBeGreaterThan(0);
      expect(sign.line.length).toBeLessThanOrEqual(SIGN_LINE_MAX);
      expect(sign.aria.length).toBeGreaterThan(sign.line.length);
    }
  });

  it("reads the empty island without jargon, a lie or a fault", () => {
    const signs = placeSigns(settled);
    for (const sign of Object.values(signs)) {
      expect(sign.line + sign.aria).not.toMatch(/cents|snapshot|nest|pulse|null|undefined|NaN|\[object/i);
    }
    expect(signs.glasshouse.line).toBe("Clear benches");
    expect(signs.kitchen.line).toBe("No plan on the wall");
    expect(signs.boathouse.line).toBe("0 wishes · 0 memories");
    expect(signs.cottage.line).toBe("0 looks · 0 keepsakes");
    expect(signs.kiln.line).toBe("0 pieces fired · cold");
    expect(signs.campfire.line).toBe("Unlit kindling");
    expect(signs.atlas.line).toBe("No era yet");
    expect(signs.library.line).toBe("Books current · settled");
    expect(signs.court.line).toBe("$413 everyday · settled");
  });

  it("counts what each room actually holds", () => {
    const signs = placeSigns({
      ...settled,
      glasshouse: { ...EMPTY_GLASSHOUSE_READING, pots: [1, 2, 3].map((n) => ({ key: `task/${n}`, title: `Pot ${n}`, state: "seed" as const, dry: n === 1, thread: "both" as const, bench: 0 as const, staked: false, cat: false, date: null })), dry: 1, overflow: 2 },
      kitchen: { ...EMPTY_KITCHEN_READING, cards: [{ key: "line/1", what: "Groceries", amountCents: 40_000, when: null, pot: "everyday" as const, who: "both" as const }], monthKey: "2026-09", overflow: 0 },
      boathouse: { wishes: 1, memories: 4, letters: 2, encounters: 0, hung: 0 },
      cottage: { name: "Hercules", worn: 2, looks: 1, keepsakes: 7 },
      kiln: { ...EMPTY_KILN_READING, fired: 6, onTheWheel: 1, sinceFiring: 0, warmth: 1 },
      campfire: { ...EMPTY_CAMPFIRE_READING, lit: true, stones: 5, month: "2026-09", close: "awaiting-partner" as const },
      atlas: { ...EMPTY_ATLAS_READING, eras: 3, stones: 14, era: { key: "era:2", name: "The flat by the water", index: 2, months: 7, home: "rented" as never, homeLabel: "a small flat", finishLine: "a place of our own", plans: 2 } },
      freshness: "stale",
    });
    expect(signs.glasshouse.line).toBe("5 pots · 1 dry");
    expect(signs.kitchen.line).toBe("1 card · Sep");
    expect(signs.boathouse.line).toBe("1 wish · 4 memories");
    expect(signs.cottage.line).toBe("1 look · 7 keepsakes");
    expect(signs.kiln.line).toBe("6 pieces fired · still hot");
    expect(signs.campfire.line).toBe("5 stones · one seat empty");
    expect(signs.atlas.line).toBe("Era 2 of 3 · 14 stones");
    expect(signs.library.line).toBe("Books not fresh · settled");
    for (const sign of Object.values(signs)) expect(sign.line.length).toBeLessThanOrEqual(SIGN_LINE_MAX);
  });

  it("never shows a private content — only how many there are", () => {
    const signs = placeSigns({
      ...settled,
      kiln: { ...EMPTY_KILN_READING, fired: 2, keptPrivate: 3 },
      atlas: { ...EMPTY_ATLAS_READING, eras: 1, stones: 2, keptPrivate: 4, era: { key: "era:1", name: "Now", index: 1, months: 1, home: "rented" as never, homeLabel: "a small flat", finishLine: "the secret goal", plans: 1 } },
    });
    // A private piece or bank is counted inside the room, and never named on the wall outside it.
    expect(signs.kiln.line + signs.kiln.aria).not.toMatch(/private/i);
    expect(signs.atlas.line).toBe("The first era · 2 stones");
  });

  it("stays legible on the demo household, and every sign says which door it opens", () => {
    const signs = placeSigns(buildHarbourReading(seedDemoHousehold({ today }), "MEM-001", today, "current"));
    for (const [place, sign] of Object.entries(signs)) {
      expect(sign.line.length, `${place}: ${sign.line}`).toBeLessThanOrEqual(SIGN_LINE_MAX);
      expect(sign.aria, place).toMatch(/Opens the|Opens Journey|Meet the Queen/);
    }
  });
});

describe("courtSigns — the plates standing on the Court's lawn", () => {
  it("engraves one plate per building, with the building's name over its line", () => {
    const lawn = courtSigns(settled);
    expect(Object.keys(lawn).sort()).toEqual(Object.keys(COURT_SIGN_PLACES).sort());
    for (const [anchor, sign] of Object.entries(lawn)) {
      const [title, line] = sign.plate.split("\n");
      expect(title).toBe(SIGN_TITLES[COURT_SIGN_PLACES[anchor]!]);
      expect(line).toBe(sign.line);
      // Two lines is all an engraved plate holds; a third would be carved too small to read from the path.
      expect(sign.plate.split("\n")).toHaveLength(2);
    }
    // Every landmark building on the lawn has a sign; the Court's own three doors keep their plinth plates.
    expect(Object.keys(lawn)).toContain("kiln-house");
    expect(lawn["library-hall"]!.place).toBe("library");
  });

  it("is an empty table, never a throw, before the books answer", () => {
    expect(courtSigns(null)).toEqual({});
    expect(courtSigns(undefined)).toEqual({});
    expect(courtSigns({ everyday: 1 } as unknown as HarbourReading)).toEqual({});
  });
});

describe("the sign board itself", () => {
  it("draws to the board's own shape and brings the letters down to fit it", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // jsdom has no 2D canvas; the plate falls back to blank stone.
    // node-canvas is not installed, so this exercises the pure geometry of the
    // fit: the canvas takes the board's aspect instead of growing around the
    // letters. Without `fit`, slice 1's box is unchanged.
    const board = engravedPlate("The Glasshouse\n12 pots · 2 dry", { width: 640, size: "small", aspect: 1.7 / 0.54 });
    expect(board.image.width).toBe(640);
    expect(board.image.height).toBe(Math.round(640 / (1.7 / 0.54)));
    const box = engravedPlate("$1,240", { width: 512, size: "large" });
    expect(box.image.width).toBe(512);
    expect(box.image.height).toBeGreaterThan(64);
    board.dispose(); box.dispose();
  });
});
