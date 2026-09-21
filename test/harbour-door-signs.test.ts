import { describe, expect, it } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading, EMPTY_ATLAS_READING, EMPTY_BOATHOUSE_READING, EMPTY_CELLAR_READING, EMPTY_CISTERN_READING, EMPTY_COTTAGE_READING, EMPTY_GLASSHOUSE_READING, EMPTY_KILN_READING, EMPTY_KITCHEN_READING, EMPTY_TOWER_READING, type HarbourReading } from "../src/harbour/data/reading.ts";
import { doorSigns, plainDollars, shortDate } from "../src/harbour/nav/doorSigns.ts";

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
