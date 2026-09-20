// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { poseFor } from "../src/harbour/scene/place.ts";
import { CELLAR_DRESSING, CELLAR_LIGHT, CELLAR_THEMES, cellarDressingFrom, cellarLightFor, shelfTrimWords } from "../src/harbour/cellar/dressing.ts";
import { CELLAR_LAYOUT, cellarPlace, createCellar, physicalConditionOf, readCellarView, type CellarHandle } from "../src/harbour/cellar/CellarScene.ts";
import { JAR_MIN_HEIGHT, JAR_RADIUS, createJar, isUmbrellaBankId, jarHeight, jarVisualFor, umbrellaAsset } from "../src/harbour/cellar/jars.ts";
import { CELLAR_SCALE_UNITS, createWater, dollarsToUnits } from "../src/harbour/cellar/water.ts";
import { dayIndexOf, dayState, scrubDateWords, scrubIndex, scrubOffset, scrubReading, scrubStep, scrubToday } from "../src/harbour/cellar/scrub.ts";
import { CISTERN, CISTERN_POSITION, cisternLevel, cisternWords, createCistern, readCisternReading } from "../src/harbour/court/cistern.ts";
import { COURT_DRESSING, contrastRatio } from "../src/harbour/court/dressing.ts";
import { COURT_LAYOUT, createCourt, readCourtReading } from "../src/harbour/court/CourtScene.ts";
import { PLACES } from "../src/harbour/scene/place.ts";
import { UMBRELLA_BANK_MODELS } from "../src/queen/world/bankModels.ts";
import type { CellarJarReading, CellarReadingView } from "../src/harbour/data/reading.ts";

/**
 * Little Harbour · slice 2, the Cellar and the Cistern (BUILD_PLAN_SLICE2 §3–4, §7).
 * Pure tests: the one dollar scale both the water and the jars are measured on,
 * the jar state machine, the day scrub, the cistern's clamp and its door, and
 * both Places' contracts. Nothing here moves money, because nothing there does.
 */

const SCALE = 200_000; // $2,000 — the room's ruler for these fixtures.

const jar = (over: Partial<CellarJarReading> & Pick<CellarJarReading, "key">): CellarJarReading => ({
  label: over.key, umbrella: null, amountCents: 50_000, fill: 0.5, state: "planned", size: 3, due: "2026-09-10", missingMark: false, ...over,
});

const days = (count: number, todayIndex: number): CellarReadingView["days"] =>
  Array.from({ length: count }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    balanceCents: 100_000 + i * 1_000,
    belowBuffer: i > count - 3,
    today: i === todayIndex,
  }));

const view = (over: Partial<CellarReadingView> = {}): CellarReadingView => ({
  jars: [jar({ key: "bank/rent", label: "Rent", amountCents: 120_000, size: 5, due: "2026-09-01", state: "paid" }),
    jar({ key: "bank/hydro", label: "Hydro", amountCents: 40_000, size: 2, due: "2026-09-15", state: "set-aside", umbrella: "utilities" }),
    jar({ key: "bank/phone", label: "Phone", amountCents: 6_000, size: 1, due: "2026-09-28", state: "planned" })],
  days: days(30, 9),
  todayIndex: 9,
  prepareCents: 140_000,
  scaleCents: SCALE,
  ...over,
});

describe("the cellar's one dollar scale", () => {
  it("measures the water and a jar with the same ruler: $1,000 of water is a $1,000 jar's height", () => {
    const thousand = 100_000;
    expect(jarHeight(thousand, SCALE)).toBeCloseTo(dollarsToUnits(thousand, SCALE), 12);
    // And at every amount tall enough to clear the smallest jar there ever is.
    for (const cents of [40_000, 75_000, 100_000, 150_000, SCALE]) {
      expect(dollarsToUnits(cents, SCALE)).toBeGreaterThanOrEqual(JAR_MIN_HEIGHT);
      expect(jarHeight(cents, SCALE)).toBeCloseTo(dollarsToUnits(cents, SCALE), 12);
    }
    // Twice the money is twice the height, for water and glass alike.
    expect(dollarsToUnits(100_000, SCALE)).toBeCloseTo(dollarsToUnits(50_000, SCALE) * 2, 12);
  });

  it("is total: an unusable scale, a negative or a non-finite amount is no height, never a wrong one", () => {
    for (const bad of [[100, 0], [100, -1], [100, Number.NaN], [Number.NaN, SCALE], [-500, SCALE], [0, SCALE]] as const) {
      expect(dollarsToUnits(bad[0], bad[1])).toBe(0);
    }
    expect(dollarsToUnits(SCALE * 4, SCALE)).toBe(CELLAR_SCALE_UNITS);
  });

  it("floors the smallest bill so a $2 jar is still a jar you can see and tap", () => {
    expect(dollarsToUnits(200, SCALE)).toBeLessThan(JAR_MIN_HEIGHT);
    expect(jarHeight(200, SCALE)).toBe(JAR_MIN_HEIGHT);
    // Width is the band, not the money.
    expect(JAR_RADIUS[1]).toBeLessThan(JAR_RADIUS[5]);
  });

  it("drives the water's own height off the same function", () => {
    const water = createWater({ dressing: CELLAR_DRESSING.classic, scaleCents: SCALE, reduced: true });
    water.setLevel(100_000);
    expect(water.height()).toBeCloseTo(jarHeight(100_000, SCALE), 12);
    water.setLevel(null);
    expect(water.height()).toBe(0);
    expect(water.words()).toBe("Prepare's water — —");
    water.setLevel(0);
    expect(water.words()).toBe("Prepare's water — $0");
    // Reduced motion: no ripple, nothing left moving.
    expect(water.tick(0, 0.016)).toBe(false);
    water.dispose();
  });
});

describe("the jar state machine", () => {
  it("maps each reading state to its one glass, and cracks only on a confirmed shortfall", () => {
    expect(jarVisualFor("planned")).toBe("frosted");
    expect(jarVisualFor("set-aside")).toBe("solid");
    expect(jarVisualFor("paid")).toBe("shattered");
    expect(jarVisualFor("short")).toBe("cracked");
    const cracked = (["planned", "set-aside", "paid", "short"] as const).filter((state) => jarVisualFor(state) === "cracked");
    expect(cracked).toEqual(["short"]);
  });

  it("frosts what is planned, clears the glass for what is set aside, and keeps the crack hidden until it is short", () => {
    const built = createJar({ reading: jar({ key: "bank/hydro", state: "planned" }), dressing: CELLAR_DRESSING.classic, scaleCents: SCALE, loadModels: false });
    const crack = built.group.getObjectByName("jar-crack")!;
    expect(built.visual()).toBe("frosted");
    expect(crack.visible).toBe(false);
    expect(built.group.getObjectByName("jar-bank")!.visible).toBe(false); // you cannot see the cat through etched glass
    built.setState("set-aside");
    expect(built.visual()).toBe("solid");
    expect(built.group.getObjectByName("jar-bank")!.visible).toBe(true);
    expect(crack.visible).toBe(false);
    built.setState("short");
    expect(built.visual()).toBe("cracked");
    expect(crack.visible).toBe(true);
    built.dispose();
  });

  it("breaks cleanly when it is paid, leaves the shards, and sweeps them on the next mount", () => {
    const live = createJar({ reading: jar({ key: "bank/rent", state: "set-aside" }), dressing: CELLAR_DRESSING.classic, scaleCents: SCALE, loadModels: false });
    expect(live.shards()).toBe(false);
    live.setState("paid");
    expect(live.visual()).toBe("shattered");
    expect(live.shards()).toBe(true);
    expect(live.group.getObjectByName("jar-body")!.visible).toBe(false);
    expect(live.group.getObjectByName("jar-broken")!.visible).toBe(true);
    live.dispose();
    // The next entry finds the rail tidy.
    const swept = createJar({ reading: jar({ key: "bank/rent", state: "paid" }), dressing: CELLAR_DRESSING.classic, scaleCents: SCALE, loadModels: false });
    expect(swept.visual()).toBe("shattered");
    expect(swept.shards()).toBe(false);
    expect(swept.group.getObjectByName("jar-shards")!.visible).toBe(false);
    swept.dispose();
  });

  it("sizes from the reading's band, fills 0–1 clamped, and goes pale on request", () => {
    const built = createJar({ reading: jar({ key: "bank/rent", size: 5, amountCents: 120_000, fill: 2 }), dressing: CELLAR_DRESSING.classic, scaleCents: SCALE, loadModels: false });
    expect(built.radius).toBe(JAR_RADIUS[5]);
    expect(built.height).toBeCloseTo(jarHeight(120_000, SCALE) + 0.03, 10);
    const contents = built.group.getObjectByName("jar-contents")!;
    built.setFill(2); expect(contents.scale.y).toBeCloseTo(jarHeight(120_000, SCALE) * 0.94, 10);
    built.setFill(-1); expect(contents.scale.y).toBeCloseTo(0.001, 10);
    built.setFill(Number.NaN); expect(contents.scale.y).toBeCloseTo(0.001, 10);
    expect(built.pale()).toBe(false);
    built.setPale(true);
    expect(built.pale()).toBe(true);
    built.dispose();
  });

  it("keeps a shrunken subscription's label with a missing-mark for one cycle", () => {
    const marked = createJar({ reading: jar({ key: "bank/stream", state: "set-aside", missingMark: true }), dressing: CELLAR_DRESSING.classic, scaleCents: SCALE, loadModels: false });
    expect(marked.group.getObjectByName("jar-mark")!.visible).toBe(true);
    marked.setState("paid"); // a clean break takes the tag with it
    expect(marked.group.getObjectByName("jar-mark")!.visible).toBe(false);
    marked.dispose();
    const plain = createJar({ reading: jar({ key: "bank/stream" }), dressing: CELLAR_DRESSING.classic, scaleCents: SCALE, loadModels: false });
    expect(plain.group.getObjectByName("jar-mark")!.visible).toBe(false);
    plain.dispose();
  });

  it("only stands a bank for one of the twelve umbrellas, and a porcelain jar otherwise", () => {
    expect(isUmbrellaBankId("utilities")).toBe(true);
    expect(isUmbrellaBankId("coming-in")).toBe(false);
    expect(isUmbrellaBankId("toString")).toBe(false);
    expect(isUmbrellaBankId(null)).toBe(false);
    expect(readCellarView({ jars: [{ key: "a", umbrella: "not-an-umbrella" }, { key: "b", umbrella: "travel" }] }).jars.map((j) => j.umbrella)).toEqual([null, "travel"]);
  });

  it("stands the umbrella's own shipped bank inside the glass", () => {
    for (const id of Object.keys(UMBRELLA_BANK_MODELS) as (keyof typeof UMBRELLA_BANK_MODELS)[]) {
      const asset = umbrellaAsset(id);
      expect(asset.url).toBe(UMBRELLA_BANK_MODELS[id].url);
      expect(asset.gz).toBe(`${UMBRELLA_BANK_MODELS[id].url}.gz`);
      expect(asset.sha256).toBe(UMBRELLA_BANK_MODELS[id].sha256);
    }
    const loaded: string[] = [];
    const built = createJar({
      reading: jar({ key: "bank/hydro", umbrella: "utilities" }), dressing: CELLAR_DRESSING.classic, scaleCents: SCALE,
      load: async (asset) => { loaded.push(asset.url); const root = new THREE.Group(); root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))); return { root, asset, release: () => loaded.push("released") }; },
    });
    return built.ready.then(() => {
      expect(loaded[0]).toBe("/models/banks/utilities.v1.glb");
      expect(built.group.getObjectByName("jar-bank")!.children).toHaveLength(1);
      built.dispose();
      expect(loaded).toContain("released");
    });
  });
});

describe("the day scrub — a reading, never a change", () => {
  it("maps a point on the rail to a day and back, with whole days at both ends", () => {
    expect(scrubIndex(0, 100, 30)).toBe(0);
    expect(scrubIndex(100, 100, 30)).toBe(29);
    expect(scrubIndex(-40, 100, 30)).toBe(0);
    expect(scrubIndex(50, 100, 30)).toBe(15);
    expect(scrubIndex(5, 0, 30)).toBe(0);
    expect(scrubIndex(5, 100, 0)).toBe(0);
    for (const index of [0, 7, 29]) expect(scrubIndex(scrubOffset(index, 100, 30), 100, 30)).toBe(index);
  });

  it("says where a jar's day stands against the day in the gate", () => {
    expect(dayState(10, 4)).toBe("behind");
    expect(dayState(10, 10)).toBe("at");
    expect(dayState(10, 22)).toBe("ahead");
    expect(dayState(Number.NaN, 3)).toBe("at");
  });

  it("reads the water and the jars at a day, greying only what has not come yet", () => {
    const reading = view();
    const today = scrubReading(reading, 9); // Sep 10
    expect(today.date).toBe("2026-09-10");
    expect(today.levelCents).toBe(reading.days[9]!.balanceCents);
    expect(today.jarStates["bank/rent"]).toBe("paid");        // Sep 1, behind — its own state
    expect(today.jarStates["bank/hydro"]).toBe("ahead");       // Sep 15, not its day yet
    expect(today.jarStates["bank/phone"]).toBe("ahead");       // Sep 28
    const later = scrubReading(reading, 20); // Sep 21
    expect(later.jarStates["bank/hydro"]).toBe("set-aside");
    expect(later.jarStates["bank/phone"]).toBe("ahead");
    const end = scrubReading(reading, 29);
    expect(end.jarStates["bank/phone"]).toBe("planned");
    // Out of range clamps; it never reads off the end of the month.
    expect(scrubReading(reading, -5)).toEqual(scrubReading(reading, 0));
    expect(scrubReading(reading, 400)).toEqual(scrubReading(reading, 29));
    // A jar with no date is never ahead of anything.
    const undated = view({ jars: [jar({ key: "bank/loose", due: null, state: "short" })] });
    expect(scrubReading(undated, 0).jarStates["bank/loose"]).toBe("short");
  });

  it("steps, returns to today, and reads an empty rail without inventing a day", () => {
    const reading = view();
    expect(scrubStep(reading, 9, 1)).toBe(10);
    expect(scrubStep(reading, 0, -1)).toBe(0);
    expect(scrubStep(reading, 29, 1)).toBe(29);
    expect(scrubStep(reading, 9, Number.NaN)).toBe(9);
    expect(scrubToday(reading)).toBe(9);
    expect(scrubToday({ days: days(30, 9).map((d) => ({ ...d, today: false })), todayIndex: 4 })).toBe(4);
    const empty = view({ jars: [], days: [], todayIndex: 0 });
    expect(scrubReading(empty, 3)).toEqual({ levelCents: 0, date: "", jarStates: {} });
    expect(dayIndexOf(reading, "2026-09-15")).toBe(14);
    expect(dayIndexOf(reading, null)).toBe(-1);
    expect(scrubDateWords("2026-09-15")).toBe("Sep 15");
    expect(scrubDateWords(null)).toBe("—");
    expect(scrubDateWords("nonsense")).toBe("—");
  });
});

describe("the cellar dressing", () => {
  it("authors all three themes, in data with no branches and ink that reads on the plate", () => {
    expect(Object.keys(CELLAR_DRESSING).sort()).toEqual([...CELLAR_THEMES].sort());
    for (const theme of CELLAR_THEMES) {
      const d = CELLAR_DRESSING[theme];
      expect(d.theme).toBe(theme);
      expect(contrastRatio(d.ink, d.plate), `${theme} plate`).toBeGreaterThanOrEqual(4.5);
      for (const colour of [d.stone, d.stoneAlt, d.mortar, d.floor, d.vault, d.vaultRib, d.flagstoneUnderside, d.railTimber, d.railShelf, d.brass, d.stairStone, d.stairRail, d.water, d.waterDeep, d.stain, d.glass, d.glassFrost, d.crack, d.porcelain, d.plate, d.plateHighlight]) {
        expect(colour, `${theme} ${colour}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
      const light = CELLAR_LIGHT[theme];
      expect(light.lampIntensity).toBeGreaterThan(0);
      expect(light.fog.near).toBeLessThan(light.fog.far);
      expect(cellarLightFor(d)).toBe(light);
    }
    expect(new Set(CELLAR_THEMES.map((t) => CELLAR_DRESSING[t].shelfTrim)).size).toBe(3);
    expect(shelfTrimWords("washi-tape")).toBe("taped with washi");
    expect(cellarDressingFrom("taylor")).toBe(CELLAR_DRESSING.taylor);
    expect(cellarDressingFrom({ theme: "newfoundland" })).toBe(CELLAR_DRESSING.newfoundland);
    expect(cellarDressingFrom(undefined)).toBe(CELLAR_DRESSING.classic);
  });
});

describe("the Cellar place", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => undefined);

  function build(reading: unknown = { cellar: view() }, quality: "full" | "lite" = "full"): { handle: CellarHandle; scene: THREE.Scene } {
    const scene = new THREE.Scene();
    return { handle: createCellar(scene, { dressing: CELLAR_DRESSING.classic, reading, quality, loadModels: false, reduced: false }), scene };
  }

  it("registers as the 'cellar' Place with its named anchors, jar doors, poses and regions", () => {
    quiet();
    expect(cellarPlace.id).toBe("cellar");
    expect(PLACES.cellar).toBe(cellarPlace);
    const { handle, scene } = build();
    expect(scene.children).toContain(handle.group);
    const anchors = handle.anchors();
    const ids = anchors.map((a) => a.id);
    for (const id of ["stair", "rail", "waterline", "date", "scrub-back", "scrub-forward", "today"]) expect(ids).toContain(id);
    for (const key of ["bank/rent", "bank/hydro", "bank/phone"]) expect(ids).toContain(`jar:${key}`);
    const byId = Object.fromEntries(anchors.map((a) => [a.id, a]));
    expect(byId.stair!.zone).toBe("stair");
    expect(byId.stair!.door).toBeUndefined(); // the shell routes the stair; the place only says where it is
    expect(byId["jar:bank/hydro"]!.door).toEqual({ target: "cellar-bills", object: "bank/hydro" });
    expect(byId["jar:bank/hydro"]!.zone).toBe("jar");
    // Every touchable thing says words, not just a number.
    for (const anchor of anchors) expect(anchor.label).toMatch(/[A-Za-z]{3}/);
    const poses = handle.poses();
    for (const key of ["cellar:phone", "cellar:desktop", "object:stair:phone", "object:jar:bank/hydro:desktop"]) expect(poses[key]).toBeDefined();
    expect(poses["cellar@phone"]).toBeUndefined();
    expect(poseFor(poses, "cellar", "phone")).toEqual(poses["cellar:phone"]);
    const regions = handle.regions().map((r) => r.id);
    expect(regions).toEqual(expect.arrayContaining(["stair", "rail", "waterline", "jar:bank/rent", "scrub-back", "scrub-forward", "today"]));
    handle.dispose();
    expect(scene.children).not.toContain(handle.group);
  });

  it("stays inside the draw-call budget before the jar GLBs", () => {
    quiet();
    const many = view({ jars: Array.from({ length: 14 }, (_, i) => jar({ key: `bank/b${i}`, label: `Bill ${i}`, size: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5 })) });
    const { handle } = build({ cellar: many });
    expect(handle.jars()).toHaveLength(14);
    expect(handle.drawCalls()).toBeLessThanOrEqual(120);
    handle.dispose();
  });

  it("scrubs the rail: the water moves, the jars ahead go pale, the date plate follows, and nothing is written", () => {
    quiet();
    const reading = view();
    const { handle } = build({ cellar: reading });
    expect(handle.index()).toBe(9);
    expect(handle.words().date).toBe("Sep 10 · today");
    const before = handle.words().jars;
    expect(before.find((j) => j.key === "bank/hydro")!.pale).toBe(true);
    expect(before.find((j) => j.key === "bank/rent")!.state).toBe("shattered");
    handle.scrubTo(20);
    expect(handle.index()).toBe(20);
    expect(handle.words().date).toBe("Sep 21");
    expect(handle.words().jars.find((j) => j.key === "bank/hydro")!.pale).toBe(false);
    expect(handle.words().jars.find((j) => j.key === "bank/phone")!.pale).toBe(true);
    handle.step(-1); expect(handle.index()).toBe(19);
    handle.step(-400); expect(handle.index()).toBe(0);
    handle.step(400); expect(handle.index()).toBe(29);
    handle.today(); expect(handle.index()).toBe(9);
    // The reading it was handed is untouched: the scrub is a reading, not a change.
    expect(reading).toEqual(view());
    handle.dispose();
  });

  it("reads an empty cellar as a dry rail, not as a fault, and never as $0", () => {
    quiet();
    const { handle } = build({ cellar: view({ jars: [], days: [], prepareCents: null, scaleCents: 0 }) });
    expect(handle.jars()).toHaveLength(0);
    expect(handle.words().rail).toBe("no bills on the rail yet");
    expect(handle.words().date).toBe("—");
    expect(handle.words().water).toBe("Prepare's water — —");
    expect(handle.anchors().find((a) => a.id === "rail")!.label).toContain("no bills on the rail yet");
    // No reading at all is the same calm room.
    handle.update(null);
    expect(handle.jars()).toHaveLength(0);
    expect(handle.words().date).toBe("—");
    handle.dispose();
  });

  it("asks for no frames once the water has settled, and none at all under reduced motion", () => {
    quiet();
    const scene = new THREE.Scene();
    const still = createCellar(scene, { dressing: CELLAR_DRESSING.newfoundland, reading: { cellar: view() }, quality: "lite", loadModels: false, reduced: true });
    expect(still.animate(0, 0.016)).toBe(true); // the first frame after a build paints
    expect(still.animate(1, 0.016)).toBe(false);
    still.scrubTo(15);
    expect(still.animate(2, 0.016)).toBe(true);  // the redraw the scrub asked for
    expect(still.animate(3, 0.016)).toBe(false); // and then still: no ripple, the level cut
    still.dispose();
    const moving = createCellar(scene, { dressing: CELLAR_DRESSING.classic, reading: { cellar: view() }, quality: "full", loadModels: false, reduced: false });
    moving.scrubTo(25);
    expect(moving.animate(0.1, 0.016)).toBe(true);
    let frames = 0;
    while (moving.animate(0.2 + frames * 0.016, 0.016) && frames < 600) frames++;
    expect(frames).toBeGreaterThan(0);   // the water ripples and settles
    expect(frames).toBeLessThan(600);    // and then it is still
    moving.dispose();
  });

  it("darkens the stone and shows the old water mark when the house is worn", () => {
    quiet();
    const { handle } = build({ cellar: view(), condition: { state: "weathered" } });
    expect(physicalConditionOf({ condition: { state: "weathered" } })).toBe("damaged");
    expect(physicalConditionOf({ condition: { state: "wilting" } })).toBe("worn");
    expect(physicalConditionOf({ condition: { state: "settled" } })).toBe("kept");
    expect(physicalConditionOf({ condition: { physical: "worn" } })).toBe("worn");
    expect(handle.group.getObjectByName("cellar-old-mark")!.visible).toBe(true);
    handle.update({ cellar: view(), condition: { state: "settled" } });
    expect(handle.group.getObjectByName("cellar-old-mark")!.visible).toBe(false);
    handle.dispose();
  });

  it("narrows any reading-shaped value without inventing money", () => {
    const narrowed = readCellarView({ jars: [{ key: "bank/x" }, { label: "no key" }, 7], days: [{ date: "2026-09-01" }, { date: "nope" }], todayIndex: "x", prepareCents: "x", scaleCents: null });
    expect(narrowed.jars).toHaveLength(1);
    expect(narrowed.jars[0]).toEqual({ key: "bank/x", label: "bank/x", umbrella: null, amountCents: 0, fill: 0, state: "planned", size: 1, due: null, missingMark: false });
    expect(narrowed.days).toEqual([{ date: "2026-09-01", balanceCents: 0, belowBuffer: false, today: false }]);
    expect(narrowed.prepareCents).toBeNull();
    expect(narrowed.scaleCents).toBe(0);
    expect(narrowed.todayIndex).toBe(0);
    expect(CELLAR_LAYOUT.railLength).toBeGreaterThan(0);
  });
});

describe("the Cistern in the Court", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => undefined);

  it("clamps its level between a wet floor and the brass band", () => {
    expect(cisternLevel(null)).toBe(CISTERN.minLevel);
    expect(cisternLevel({ cents: 0, target: 100_000, level: 0 })).toBe(CISTERN.minLevel);
    expect(cisternLevel({ cents: 400_000, target: 100_000, level: 4 })).toBe(CISTERN.maxLevel);
    expect(cisternLevel({ cents: 50_000, target: 100_000, level: 0.5 })).toBeCloseTo(0.5, 12);
    expect(cisternLevel({ cents: null, target: 0, level: Number.NaN })).toBe(CISTERN.minLevel);
    // With no level of its own it works one out from the two numbers.
    expect(cisternLevel({ cents: 25_000, target: 100_000, level: Number.NaN })).toBeCloseTo(0.25, 12);
  });

  it("writes the two numbers, and an unknown as '—' and never '$0'", () => {
    expect(cisternWords({ cents: 120_000, target: 300_000, level: 0.4 })).toBe("$1,200\nof $3,000");
    expect(cisternWords({ cents: null, target: 300_000, level: 0.06 })).toBe("—\nof $3,000");
    expect(cisternWords({ cents: 0, target: 0, level: 0 })).toBe("$0\nof —");
    expect(cisternWords(null)).toBe("—\nof —");
  });

  it("falls back to Protect's own two numbers while a reading has no cistern row", () => {
    expect(readCisternReading({ protect: { cents: 60_000, target: 200_000 } }).cistern).toEqual({ cents: 60_000, target: 200_000, level: 0.3 });
    expect(readCisternReading({ cistern: { cents: 1, target: 2, level: 0.5 } }).cistern).toEqual({ cents: 1, target: 2, level: 0.5 });
    expect(readCisternReading({}).cistern).toBeNull();
    expect(readCisternReading({ condition: { physical: "damaged" } }).physical).toBe("damaged");
  });

  it("stands beside the Knight, opens Protect, and sits its water low when the house is worn", () => {
    quiet();
    const cistern = createCistern(COURT_DRESSING.classic, { cistern: { cents: 90_000, target: 100_000, level: 0.9 } });
    cistern.group.position.set(...CISTERN_POSITION);
    expect(cistern.level()).toBeCloseTo(0.9, 12);
    expect(cistern.words()).toBe("$900\nof $1,000");
    const [anchor] = cistern.anchors();
    expect(anchor!.id).toBe("cistern");
    expect(anchor!.door).toEqual({ target: "loft-banks", object: "bank/plan:protect" });
    expect(anchor!.label).toContain("Protect");
    expect(cistern.regions()[0]!.id).toBe("cistern");
    const water = cistern.group.getObjectByName("cistern-water")!;
    const full = water.position.y;
    cistern.update({ cistern: { cents: 90_000, target: 100_000, level: 0.9 }, condition: { state: "weathered" } });
    expect(water.position.y).toBeLessThan(full);
    expect(cistern.group.getObjectByName("cistern-old-line")!.visible).toBe(true);
    cistern.dispose();
  });

  it("is built into the Court beside the Knight, without colliding with it or the props", () => {
    quiet();
    const scene = new THREE.Scene();
    const handle = createCourt(scene, { dressing: COURT_DRESSING.classic, reading: readCourtReading({ protect: { cents: 50_000 } }), quality: "full", loadModels: false });
    const ids = handle.anchors().map((a) => a.id);
    expect(ids).toContain("cistern");
    expect(handle.regions().map((r) => r.id)).toContain("cistern");
    expect(handle.group.getObjectByName("cistern")).toBeDefined();
    const [cx, , cz] = COURT_LAYOUT.cistern;
    const [kx, , kz] = [-4.2, 0, -3.0];
    expect(Math.hypot(cx - kx, cz - kz)).toBeGreaterThan(CISTERN.radius + 0.71); // clear of the Knight's plinth
    for (const [px, , pz] of COURT_LAYOUT.props) expect(Math.hypot(cx - px, cz - pz)).toBeGreaterThan(CISTERN.radius + 0.42);
    expect(Math.hypot(cx, cz)).toBeLessThan(COURT_LAYOUT.terraceRadius); // on the terrace, not off the edge
    handle.dispose();
  });
});
