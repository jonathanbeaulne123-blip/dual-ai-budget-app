import { describe, expect, it } from "vitest";
import { newHouseholdTemplate, seedDemoHousehold } from "../src/core/seed.ts";
import { fundSnapshot, type FundSnapshot } from "../src/core/fundModel.ts";
import { fundPulse, deriveFundPulseInput, presenceLines, type FundPulse } from "../src/core/fundPulse.ts";
import { bubbleNotice, type HerculesNotice } from "../src/core/notices.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { cellarJars } from "../src/core/queenCellar.ts";
import { queenShelf, queenShelfOrder } from "../src/core/queenPresentation.ts";
import { buildCisternReading, buildHarbourReading, CISTERN_FLOOR, jarState, jarUmbrella, nextCommitment, noticedItem, HARBOUR_SLIP_LINES, type HarbourReading } from "../src/harbour/data/reading.ts";

// Fictional Development data only (seedDemoHousehold); the civil date is fixed so every assertion is stable.
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;

const pulseOf = (state: FundPulse["state"], destination: FundPulse["destination"] = "fund"): Pick<FundPulse, "state" | "headline" | "detail" | "destination"> =>
  ({ state, destination, headline: `${state}.`, detail: "Detail." });
const hercules: HerculesNotice = { key: "preset:x", kind: "habit-preset", rank: 90, spoken: "$2.25 · coffee 8 times. Save it as a preset?", lesson: "I noticed.", cad: "$2.25", amountCents: 225, action: "acceptPreset" };

describe("buildHarbourReading — one pure read over the shipped selectors", () => {
  const reading = buildHarbourReading(household, memberId, today, "current");

  it("carries the four numbers straight from fundSnapshot, null staying null", () => {
    const snapshot = fundSnapshot(household, { memberId, view: "household", today });
    expect(reading.everyday).toBe(snapshot.now);
    expect(reading.prepare.cents).toBe(snapshot.prepare.amountCents);
    expect(reading.prepare.target).toBe(snapshot.prepare.targetCents);
    expect(reading.prepare.coveredThrough).toBe(snapshot.prepare.coveredThrough);
    expect(reading.protect).toEqual({ cents: snapshot.protect.amountCents, target: snapshot.protect.targetCents });
    expect(reading.build).toEqual({ cents: snapshot.build.amountCents, target: snapshot.build.targetCents, goals: snapshot.build.goals.length });
    expect(reading.mode).toBe(snapshot.mode);
    expect(reading.freshness).toBe("current");
  });

  it("counts the tower's open goal banks and this month's cellar jars the way HouseWorld does", () => {
    const nest = projectKittyNest(household, memberId, "household", today);
    expect(reading.banks).toBe(nest.categories.flatMap((c) => c.children).filter((b) => b.tier === "goal" && b.state === "open").length);
    expect(reading.jars).toBe(cellarJars(nest, household, today).length);
    expect(reading.banks).toBeGreaterThan(0);
    expect(reading.jars).toBeGreaterThan(0);
  });

  it("points the sundial at the first unpaid dated flow item, a bill going to the cellar", () => {
    expect(reading.next).not.toBeNull();
    expect(reading.next!.date >= today).toBe(true);
    expect(reading.next!.daysAhead).toBeGreaterThanOrEqual(0);
    expect(reading.next!.target).toBe("cellar-bills");
    expect(reading.next!.label).toBe("Internet");
    expect(reading.next!.daysAhead).toBe(0);
  });

  it("lets a pulse need take the mailbox before Hercules's good news", () => {
    const pulse = fundPulse(deriveFundPulseInput(household, { memberId, today, freshness: "current" }));
    expect(pulse.state).toBe("checking");
    expect(bubbleNotice(household, today)).not.toBeNull();
    expect(reading.noticed?.source).toBe("pulse");
    expect(reading.noticed?.fact).toContain(pulse.headline);
    expect(reading.noticed?.target).toBe("cellar-bills");
  });

  it("pins at most three presence lines on the slip, in order", () => {
    const lines = presenceLines(household, { memberId, today }).map((line) => line.text);
    expect(reading.slip).toEqual(lines.slice(0, HARBOUR_SLIP_LINES));
    expect(reading.slip.length).toBeLessThanOrEqual(3);
  });

  it("reads the glaze from freshness and the condition from the house", () => {
    expect(reading.glaze).toBe("glazed");
    expect(buildHarbourReading(household, memberId, today, "stale").glaze).toBe("matte");
    expect(buildHarbourReading(household, memberId, today, "offline").glaze).toBe("offline");
    expect(["checking", "settled", "growing", "wilting", "weathered"]).toContain(reading.condition.state);
    expect(buildHarbourReading(household, memberId, today, "offline").condition.state).toBe("checking");
  });

  it("never invents a number: the type keeps null distinct from 0", () => {
    const shaped: HarbourReading = reading;
    for (const cents of [shaped.everyday, shaped.prepare.cents, shaped.protect.cents, shaped.build.cents]) {
      expect(cents === null || Number.isInteger(cents)).toBe(true);
    }
  });
});

describe("nextCommitment — the sundial's order", () => {
  const nest = { categories: [] };
  const base: Pick<FundSnapshot, "prepare" | "flow"> = {
    prepare: { amountCents: 0, targetCents: 0, coveredThrough: null, bills: [], fundBills: [] },
    flow: [],
  };

  it("a short Fund bill comes first, with the bill's own amount when it is on the rail", () => {
    const bill = { id: "b", designKey: "recurrence:r", tier: "bill" as const, parentId: null, category: "prepare" as const, name: "Hydro", amountCents: 1000, targetCents: 9000, date: "2026-09-25", state: "open" as const, children: [] };
    const snapshot = { ...base, prepare: { ...base.prepare, shortOn: { date: "2026-09-25", label: "Hydro", shortCents: 8000 }, fundBills: [bill] }, flow: [{ date: "2026-09-21", kind: "goal" as const, fund: "build" as const, label: "Trip", amountCents: 500, state: "expected" as const, sourceId: "g" }] };
    expect(nextCommitment(snapshot, nest, today)).toEqual({ label: "Hydro", date: "2026-09-25", cents: 9000, daysAhead: 5, target: "cellar-bills" });
  });

  it("falls back to the short amount when the bill is not on the rail", () => {
    const snapshot = { ...base, prepare: { ...base.prepare, shortOn: { date: "2026-09-25", label: "Hydro", shortCents: 8000 } } };
    expect(nextCommitment(snapshot, nest, today)?.cents).toBe(8000);
  });

  it("skips paid, past, unknown-amount and contribution flow items; goals go to the loft", () => {
    const flow = [
      { date: "2026-09-10", kind: "bill" as const, fund: "prepare" as const, label: "Old", amountCents: 100, state: "open" as const, sourceId: "1" },
      { date: "2026-09-21", kind: "contribution" as const, fund: null, label: "Contribution", amountCents: 50000, state: "arrived" as const, sourceId: "2" },
      { date: "2026-09-22", kind: "bill" as const, fund: "prepare" as const, label: "Paid", amountCents: 100, state: "paid" as const, sourceId: "3" },
      { date: "2026-09-23", kind: "bill" as const, fund: "prepare" as const, label: "Unknown", amountCents: null, state: "expected" as const, sourceId: "4" },
      { date: "2026-09-24", kind: "goal" as const, fund: "build" as const, label: "Trip", amountCents: 12000, state: "expected" as const, sourceId: "5" },
    ];
    expect(nextCommitment({ ...base, flow }, nest, today)).toEqual({ label: "Trip", date: "2026-09-24", cents: 12000, daysAhead: 4, target: "loft-banks" });
  });

  it("then takes the earliest open dated nest bank, and null when nothing is dated", () => {
    const bank = (name: string, date: string | null, tier: "goal" | "bill", state: "open" | "broken" = "open") =>
      ({ id: name, designKey: `goal:${name}`, tier, parentId: null, category: "build" as const, name, amountCents: 0, targetCents: 4200, date, state, children: [] });
    const categories = [{ ...bank("Build", null, "goal"), tier: "plan" as const, children: [bank("Later", "2026-12-01", "goal"), bank("Undated", null, "goal"), bank("Broken", "2026-09-21", "goal", "broken"), bank("Past", "2026-09-01", "bill"), bank("Soon", "2026-10-02", "goal")] }];
    expect(nextCommitment(base, { categories }, today)).toEqual({ label: "Soon", date: "2026-10-02", cents: 4200, daysAhead: 12, target: "loft-banks" });
    expect(nextCommitment(base, nest, today)).toBeNull();
  });
});

describe("noticedItem — need before good news", () => {
  it("raises the flag for reset, needs-us and checking with the pulse's own destination", () => {
    expect(noticedItem(pulseOf("reset", "path"), hercules)).toEqual({ fact: "reset. Detail.", next: "Step into Journey.", target: "journey", source: "pulse" });
    expect(noticedItem(pulseOf("needs-us", "together"), hercules)?.target).toBe("encounters");
    expect(noticedItem(pulseOf("needs-us", "fund"), null)?.target).toBe("cellar-bills");
    expect(noticedItem(pulseOf("checking", "status"), null)?.target).toBe("more");
  });

  it("hands the mailbox to Hercules only when covered or building, and only for an actionable notice", () => {
    expect(noticedItem(pulseOf("covered"), hercules)).toEqual({ fact: hercules.spoken, next: "Save it as a preset with Hercules.", target: "hercules", source: "hercules" });
    expect(noticedItem(pulseOf("building"), { ...hercules, action: "reviewPotentialExpense" })?.next).toBe("Review it with Hercules.");
    expect(noticedItem(pulseOf("building"), { ...hercules, action: "none" })).toBeNull();
    expect(noticedItem(pulseOf("covered"), null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Slice 2: the tower, the cellar and the cistern (BUILD_PLAN_SLICE2 §5).

describe("the tower, the cellar and the cistern — slice 2's reading", () => {
  const reading = buildHarbourReading(household, memberId, today, "current");
  const empty = newHouseholdTemplate();
  const emptyReading = buildHarbourReading(empty, empty.members[0]?.id ?? "MEM-001", today, "current");

  it("stands the rack's shelves in the tower, each bank with its 0–10 step", () => {
    const nest = projectKittyNest(household, memberId, "household", today);
    const order = queenShelfOrder(household.kittyNestDesigns);
    const shelf = queenShelf(nest, household, order);
    expect(reading.tower.shelves.length).toBeGreaterThan(0);
    const banks = reading.tower.shelves.flatMap((row) => row.banks);
    expect(banks.map((bank) => bank.key).sort()).toEqual(shelf.map((item) => item.designKey).sort());
    for (const bank of banks) {
      expect(Number.isInteger(bank.step)).toBe(true);
      expect(bank.step).toBeGreaterThanOrEqual(0);
      expect(bank.step).toBeLessThanOrEqual(10);
      expect(bank.targetCents).toBeGreaterThanOrEqual(0);
      expect(bank.sculptSeed).toBe(bank.key);
      expect(["protect", "everyday", "build", "prepare"]).toContain(bank.category);
    }
    for (const row of reading.tower.shelves) {
      expect(row.share).toBeGreaterThanOrEqual(1);
      expect(row.cutoff).toBeGreaterThanOrEqual(0);
      expect(row.cutoff).toBeLessThanOrEqual(20);
    }
  });

  it("names the goal scale's ends, largest and smallest, over the banks that have a target", () => {
    const targets = reading.tower.shelves.flatMap((row) => row.banks).map((bank) => bank.targetCents).filter((cents) => cents > 0);
    expect(reading.tower.largestTargetCents).toBe(targets.length ? Math.max(...targets) : 0);
    expect(reading.tower.smallestTargetCents).toBe(targets.length ? Math.min(...targets) : 0);
    expect(reading.tower.largestTargetCents).toBeGreaterThanOrEqual(reading.tower.smallestTargetCents);
    // A shelf of goals nobody has put a target on has no scale to speak of, and says 0 rather than infinity.
    expect(Number.isFinite(reading.tower.largestTargetCents)).toBe(true);
    expect(Number.isFinite(reading.tower.smallestTargetCents)).toBe(true);
  });

  it("hands the jug and the gun to the Fund's custodian only", () => {
    const custodianId = household.householdFund?.custodianMemberId ?? null;
    expect(reading.tower.jug.custodian).toBe(custodianId === memberId);
    expect(reading.tower.gun.available).toBe(reading.tower.jug.custodian);
    expect(reading.tower.jug.safeCents).toBeGreaterThanOrEqual(0);
    if (custodianId) expect(reading.tower.jug.holder).toBe(household.members.find((row) => row.id === custodianId)?.name ?? null);
    const other = household.members.find((row) => row.id !== custodianId);
    if (other) expect(buildHarbourReading(household, other.id, today, "current").tower.jug.custodian).toBe(false);
  });

  it("puts one jar on the rail per bill, in the cellar's own states and sizes", () => {
    const jars = cellarJars(projectKittyNest(household, memberId, "household", today), household, today);
    expect(reading.cellar.jars).toHaveLength(jars.length);
    expect(reading.cellar.jars.map((jar) => jar.key)).toEqual(jars.map((jar) => jar.id));
    for (const jar of reading.cellar.jars) {
      expect(["planned", "set-aside", "paid", "short"]).toContain(jar.state);
      expect([1, 2, 3, 4, 5]).toContain(jar.size);
      expect(jar.fill).toBeGreaterThanOrEqual(0);
      expect(jar.fill).toBeLessThanOrEqual(1);
      expect(jar.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(jar.umbrella === null || typeof jar.umbrella === "string").toBe(true);
      expect(jar.umbrella).not.toBe("coming-in");
      expect(jar.umbrella).not.toBe("moving-money");
    }
  });

  it("walks the month day by day and points at today", () => {
    expect(reading.cellar.days.length).toBeGreaterThan(27);
    expect(reading.cellar.days[reading.cellar.todayIndex]?.date).toBe(today);
    expect(reading.cellar.days[reading.cellar.todayIndex]?.today).toBe(true);
    expect(reading.cellar.days.filter((day) => day.today)).toHaveLength(1);
  });

  it("gives the water and the jars one dollar scale: the larger of the biggest jar and the prepare balance", () => {
    const biggest = reading.cellar.jars.reduce((top, jar) => Math.max(top, jar.amountCents), 0);
    expect(reading.cellar.prepareCents).toBe(reading.prepare.cents);
    expect(reading.cellar.scaleCents).toBe(Math.max(biggest, reading.prepare.cents ?? 0));
    expect(reading.cellar.scaleCents).toBeGreaterThanOrEqual(biggest);
  });

  it("reads the cistern as Protect against its target, never below a dark ring", () => {
    expect(reading.cistern.cents).toBe(reading.protect.cents);
    expect(reading.cistern.target).toBe(reading.protect.target);
    expect(reading.cistern.level).toBeGreaterThanOrEqual(CISTERN_FLOOR);
    expect(reading.cistern.level).toBeLessThanOrEqual(1);
    expect(buildCisternReading({ cents: null, target: 300000 }).level).toBe(CISTERN_FLOOR);
    expect(buildCisternReading({ cents: 50000, target: 0 }).level).toBe(CISTERN_FLOOR);
    expect(buildCisternReading({ cents: 150000, target: 300000 }).level).toBeCloseTo(0.5, 6);
    expect(buildCisternReading({ cents: 900000, target: 300000 }).level).toBe(1);
    expect(buildCisternReading({ cents: null, target: 0 })).toEqual({ cents: null, target: 0, level: CISTERN_FLOOR });
  });

  it("is cosy, not broken, on a household with nothing in it", () => {
    expect(emptyReading.tower.shelves.flatMap((row) => row.banks)).toEqual([]);
    expect(emptyReading.tower.largestTargetCents).toBe(0);
    expect(emptyReading.tower.smallestTargetCents).toBe(0);
    expect(emptyReading.tower.jug.custodian).toBe(false);
    expect(emptyReading.tower.gun.available).toBe(false);
    expect(emptyReading.cellar.jars).toEqual([]);
    expect(emptyReading.cellar.todayIndex).toBeGreaterThanOrEqual(0);
    expect(emptyReading.cistern.level).toBe(CISTERN_FLOOR);
    // Unknown stays unknown: an empty house never engraves a confident zero.
    expect(emptyReading.cellar.prepareCents).toBe(emptyReading.prepare.cents);
  });

  it("reads a jar's state exactly as the vision words it", () => {
    expect(jarState({ paid: true, full: true, strike: "shard" })).toBe("paid");
    expect(jarState({ paid: false, full: false, strike: "crack" })).toBe("short");
    expect(jarState({ paid: false, full: true, strike: "hammer" })).toBe("set-aside");
    expect(jarState({ paid: false, full: false, strike: "none" })).toBe("planned");
    // A confirmed shortfall is the only crack: a jar that is merely not full is still planned.
    expect(jarState({ paid: false, full: false, strike: "none" })).not.toBe("short");
  });

  it("keeps the two bankless umbrellas out of the jars", () => {
    expect(jarUmbrella({ umbrellaId: "coming-in" })).toBeNull();
    expect(jarUmbrella({ umbrellaId: "moving-money" })).toBeNull();
    expect(jarUmbrella({ umbrellaId: null })).toBeNull();
    expect(jarUmbrella({ umbrellaId: "home" })).toBe("home");
  });
});
