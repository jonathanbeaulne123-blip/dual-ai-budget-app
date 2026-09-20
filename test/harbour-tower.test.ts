// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { TowerBank, TowerReading, TowerShelf } from "../src/harbour/data/reading.ts";
import { PLACES, poseFor } from "../src/harbour/scene/place.ts";
import {
  BANK_EVEN_HEIGHT, BANK_MAX_HEIGHT, BANK_MIN_HEIGHT, SQUASH_SECONDS,
  bankGlaze, bankHeight, bankPiece, bankSculpt, bankStepFill, squash,
} from "../src/harbour/tower/banks.ts";
import { TOWER_DRESSING, TOWER_THEMES, towerDressingFrom } from "../src/harbour/tower/dressing.ts";
import { landingWords } from "../src/harbour/tower/landing.ts";
import {
  TOWER_LAYOUT, TOWER_PROP_ZONES, bankSpot, createTower, readTowerReading, shelfOnFloor, shelfWords, towerFloorCount, towerPlace,
  type TowerHandle,
} from "../src/harbour/tower/TowerScene.ts";

/**
 * The Rook's Tower (BUILD_PLAN_SLICE2 §2, §7). Pure arithmetic first — a
 * bank's size from its goal, its fill from the backing step, the squash on a
 * deposit — then the place itself: its anchors, its doors, its poses, what it
 * rebuilds, and what it costs to draw.
 *
 * jsdom has no 2D canvas, so the engraved plates fall back to blank stone and
 * the studio's sculpture falls back to its clay stand-in; both are the
 * documented starved-page behaviour and the words live on the DOM twins.
 */

const bank = (key: string, targetCents: number, step = 0, extra: Partial<TowerBank> = {}): TowerBank => ({
  key,
  goalId: null,
  name: key,
  cents: Math.round((targetCents * step) / 10),
  targetCents,
  step,
  category: "build",
  sculptSeed: key,
  ...extra,
});

const shelf = (id: string, banks: TowerBank[], extra: Partial<TowerShelf> = {}): TowerShelf =>
  ({ id, share: 5, cutoff: 20, full: false, banks, ...extra });

const reading = (shelves: TowerShelf[], extra: Partial<TowerReading> = {}): TowerReading => {
  const targets = shelves.flatMap((row) => row.banks.map((row2) => row2.targetCents)).filter((cents) => cents > 0);
  return {
    shelves,
    jug: { safeCents: 0, custodian: false, holder: null },
    gun: { available: false },
    largestTargetCents: targets.length ? Math.max(...targets) : 0,
    smallestTargetCents: targets.length ? Math.min(...targets) : 0,
    ...extra,
  };
};

function build(value?: unknown, options: { quality?: "full" | "lite"; reducedMotion?: boolean } = {}) {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const scene = new THREE.Scene();
  const handle = createTower(scene, {
    dressing: TOWER_DRESSING.classic,
    quality: options.quality ?? "lite",
    reducedMotion: options.reducedMotion ?? false,
    ...(value === undefined ? {} : { reading: value }),
  });
  return { scene, handle };
}

describe("tower banks — the pure arithmetic", () => {
  it("sizes a bank by its goal on a log scale, monotonic and clamped", () => {
    const small = 1_000, large = 1_000_000; // $10 and $10,000
    const heights = [1_000, 5_000, 20_000, 100_000, 400_000, 1_000_000].map((target) => bankHeight(target, small, large));
    for (let i = 1; i < heights.length; i++) expect(heights[i]!).toBeGreaterThan(heights[i - 1]!);
    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(BANK_MIN_HEIGHT);
      expect(height).toBeLessThanOrEqual(BANK_MAX_HEIGHT);
    }
    expect(heights[0]).toBeCloseTo(BANK_MIN_HEIGHT, 6);
    expect(heights[heights.length - 1]).toBeCloseTo(BANK_MAX_HEIGHT, 6);
  });

  it("makes a thimble of a ten-dollar goal and a mixing bowl of a ten-thousand-dollar one", () => {
    const thimble = bankHeight(1_000, 1_000, 1_000_000);
    const bowl = bankHeight(1_000_000, 1_000, 1_000_000);
    expect(bowl - thimble).toBeGreaterThan(0.5);
    expect(bowl / thimble).toBeGreaterThan(3);
  });

  it("stands every bank the same when every target is the same, or the range is unknown", () => {
    expect(bankHeight(50_000, 50_000, 50_000)).toBe(BANK_EVEN_HEIGHT);
    expect(bankHeight(50_000, 0, 0)).toBe(BANK_EVEN_HEIGHT);
    expect(bankHeight(50_000, Number.NaN, 90_000)).toBe(BANK_EVEN_HEIGHT);
    // A goal with no money on it yet is the smallest thing on the shelf, never a guess.
    expect(bankHeight(0, 1_000, 1_000_000)).toBe(BANK_MIN_HEIGHT);
  });

  it("clamps a target outside the shelf's own range instead of running off the scale", () => {
    expect(bankHeight(10, 1_000, 1_000_000)).toBeCloseTo(BANK_MIN_HEIGHT, 6);
    expect(bankHeight(99_000_000, 1_000, 1_000_000)).toBeCloseTo(BANK_MAX_HEIGHT, 6);
  });

  it("turns the ten-percent backing step into a fill", () => {
    expect(bankStepFill(0)).toBe(0);
    expect(bankStepFill(5)).toBe(0.5);
    expect(bankStepFill(10)).toBe(1);
    expect(bankStepFill(13)).toBe(1);
    expect(bankStepFill(-2)).toBe(0);
    expect(bankStepFill(Number.NaN)).toBe(0);
    expect(bankStepFill(4.4)).toBe(0.4);
  });

  it("springs on a deposit and comes back to exactly one", () => {
    expect(squash(0)).toEqual({ sx: 1, sy: 1 });
    expect(squash(SQUASH_SECONDS)).toEqual({ sx: 1, sy: 1 });
    expect(squash(SQUASH_SECONDS + 1)).toEqual({ sx: 1, sy: 1 });
    expect(squash(Number.NaN)).toEqual({ sx: 1, sy: 1 });
    const mid = squash(0.08);
    expect(mid.sy).toBeGreaterThan(1);
    expect(mid.sx).toBeLessThan(1);
    // Volume is kept: what it gains in height it loses around the middle.
    expect(mid.sx * mid.sx * mid.sy).toBeCloseTo(1, 6);
    // Never a silly amount of bounce.
    for (let t = 0; t <= SQUASH_SECONDS; t += 0.01) expect(Math.abs(squash(t).sy - 1)).toBeLessThan(0.3);
  });

  it("derives a stable look from the bank's seed", () => {
    expect(bankSculpt("goal:kettle")).toEqual(bankSculpt("goal:kettle"));
    expect(bankSculpt("goal:kettle")).not.toEqual(bankSculpt("goal:ferry"));
    expect(bankGlaze("goal:kettle", "build")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(bankGlaze("goal:kettle", "build")).toBe(bankGlaze("goal:kettle", "build"));
    const piece = bankPiece(bank("goal:kettle", 40_000));
    expect(piece.id).toBe("tower:goal:kettle");
    expect(piece.sculpt.profile.every((value) => value >= 0.55 && value <= 1.15)).toBe(true);
  });
});

describe("tower dressing", () => {
  it("authors all three themes with every surface named", () => {
    expect(Object.keys(TOWER_DRESSING).sort()).toEqual([...TOWER_THEMES].sort());
    for (const theme of TOWER_THEMES) {
      const d = TOWER_DRESSING[theme];
      expect(d.theme).toBe(theme);
      for (const colour of [d.stone, d.stoneAlt, d.mortar, d.timber, d.floorboard, d.beam, d.brass, d.lamp, d.lampGlow, d.windowLight, d.windowFrame, d.roof, d.roofTrim, d.roofUnder, d.rope, d.jug, d.stand, d.plate, d.plateHighlight, d.wood]) {
        expect(colour, `${theme}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
    // Each theme is its own architecture, not a recolour of one table.
    expect(TOWER_DRESSING.classic.floorboard).not.toBe(TOWER_DRESSING.taylor.floorboard);
    expect(TOWER_DRESSING.newfoundland.rope).not.toBe(TOWER_DRESSING.classic.roof);
  });

  it("takes a theme id, a dressing, or anything else", () => {
    expect(towerDressingFrom("taylor").theme).toBe("taylor");
    expect(towerDressingFrom(TOWER_DRESSING.newfoundland).theme).toBe("newfoundland");
    expect(towerDressingFrom({ theme: "taylor" }).theme).toBe("taylor");
    expect(towerDressingFrom(null).theme).toBe("classic");
    expect(towerDressingFrom("nonsense").theme).toBe("classic");
  });
});

describe("the landing's words", () => {
  it("says what is on the stand, and who has it when it is not you", () => {
    expect(landingWords({ safeCents: 24_500, custodian: true, holder: null }, { available: true }).jug).toBe("The jug — $245 safe to pour. Open the Loft.");
    expect(landingWords({ safeCents: 0, custodian: true, holder: null }, { available: true }).jug).toContain("nothing safe to pour");
    expect(landingWords({ safeCents: 24_500, custodian: false, holder: "Bianca" }, { available: true }).jug).toBe("The jug — Bianca holds it. Open the Loft.");
    expect(landingWords(null, null).jug).toContain("no jug here yet");
  });

  it("keeps the gun off the peg unless the custodian can use it", () => {
    expect(landingWords({ safeCents: 10, custodian: true, holder: null }, { available: true }).gun).toContain("money gun");
    expect(landingWords({ safeCents: 10, custodian: true, holder: null }, { available: false }).gun).toContain("not here");
    expect(landingWords({ safeCents: 10, custodian: false, holder: "Bianca" }, { available: true }).gun).toContain("not here");
  });
});

describe("the tower's layout rules", () => {
  it("gives one floor per rack shelf, between two and four", () => {
    expect(towerFloorCount([])).toBe(2);
    expect(towerFloorCount([shelf("a", [])])).toBe(2);
    expect(towerFloorCount([shelf("a", []), shelf("b", []), shelf("c", [])])).toBe(3);
    expect(towerFloorCount([1, 2, 3, 4, 5].map((n) => shelf(`s${n}`, [])))).toBe(4);
  });

  it("puts the rack's bottom shelf on the landing and its top shelf on the top floor", () => {
    const shelves = [shelf("top", []), shelf("middle", []), shelf("landing", [])];
    expect(shelfOnFloor(shelves, 0)?.id).toBe("landing");
    expect(shelfOnFloor(shelves, 2)?.id).toBe("top");
    expect(shelfOnFloor([shelf("only", [])], 1)).toBeNull();
  });

  it("spreads banks across the floor without stacking them", () => {
    expect(bankSpot(0, 1).x).toBe(0);
    const spots = [0, 1, 2, 3].map((index) => bankSpot(index, 4));
    for (let i = 1; i < spots.length; i++) expect(spots[i]!.x).toBeGreaterThan(spots[i - 1]!.x);
    for (const spot of spots) expect(Math.abs(spot.x)).toBeLessThanOrEqual(TOWER_LAYOUT.bankSpread + 0.001);
  });

  it("says a shelf's share in parts, never in money", () => {
    const words = shelfWords(shelf("s", [], { share: 3, cutoff: 10 }), 9, 1, 3);
    expect(words).toContain("3 parts of 9");
    expect(words).toContain("50%");
    expect(words).not.toMatch(/\$/);
    expect(shelfWords(shelf("s", [], { full: true }), 5, 0, 2)).toContain("at its mark");
    expect(shelfWords(null, 5, 1, 2)).toContain("nothing on the shelf yet");
  });

  it("reads a tower off the whole harbour reading, a bare tower reading, or nothing at all", () => {
    const tower = reading([shelf("a", [bank("k", 1_000)])]);
    expect(readTowerReading({ everyday: 1, tower }).shelves[0]!.banks[0]!.key).toBe("k");
    expect(readTowerReading(tower).shelves).toHaveLength(1);
    expect(readTowerReading(null).shelves).toEqual([]);
    expect(readTowerReading({ shelves: "nope" }).shelves).toEqual([]);
    // Unknown figures read as nothing, never as a guess at somebody's money.
    const loose = readTowerReading({ shelves: [{ id: "s", banks: [{ key: "x" }] }] });
    expect(loose.shelves[0]!.banks[0]).toMatchObject({ key: "x", cents: 0, targetCents: 0, step: 0, goalId: null });
    expect(loose.jug.custodian).toBe(false);
  });
});

describe("the tower as a place", () => {
  it("registers itself, stands up and takes itself down", () => {
    expect(towerPlace.id).toBe("tower");
    expect(PLACES.tower).toBe(towerPlace);
    const { scene, handle } = build(reading([shelf("a", [bank("k", 1_000)])]));
    expect(scene.children).toContain(handle.group);
    handle.dispose();
    expect(scene.children).not.toContain(handle.group);
  });

  it("anchors the stair, the landing and every bank, and every anchor is a door or a prop", () => {
    const { handle } = build(reading(
      [shelf("top", [bank("k1", 1_000, 3, { goalId: "goal-1" })]), shelf("landing", [bank("k2", 500_000, 10)])],
      { jug: { safeCents: 12_000, custodian: true, holder: null }, gun: { available: true } },
    ));
    const anchors = handle.anchors();
    const byId = Object.fromEntries(anchors.map((anchor) => [anchor.id, anchor]));
    expect(Object.keys(byId)).toEqual(expect.arrayContaining(["stair", "jug", "gun", "bank:k1", "bank:k2", "shelf:top", "shelf:landing", "window", "lamp"]));

    // The stair is a route the shell owns, not a door into a surface.
    expect(byId.stair!.zone).toBe("stair");
    expect(byId.stair!.door).toBeUndefined();
    // A bank opens the Loft at its own plan; the jug and the gun open the Loft.
    expect(byId["bank:k1"]!.door).toEqual({ target: "loft-banks", object: "bank/plan:goal-1" });
    expect(byId["bank:k2"]!.door).toEqual({ target: "loft-banks", object: "bank/plan:k2" });
    expect(byId.jug!.door).toEqual({ target: "loft-banks", object: "pour" });
    expect(byId.gun!.door).toEqual({ target: "loft-banks", object: "gun" });
    expect(byId.jug!.label).toContain("$120");

    for (const anchor of anchors) {
      expect(anchor.label.length, anchor.id).toBeGreaterThan(3);
      expect(Boolean(anchor.door) || TOWER_PROP_ZONES.includes(anchor.zone), `${anchor.id} must be a door or a prop`).toBe(true);
    }
    // The bank on the landing shelf stands on the landing; the top shelf's is a storey up.
    expect(byId["bank:k2"]!.position[1]).toBeLessThan(byId["bank:k1"]!.position[1]);
    handle.dispose();
  });

  it("gives a region with plain words for everything you can touch", () => {
    const { handle } = build(reading([shelf("a", [bank("k1", 1_000), bank("k2", 9_000)])]));
    const regions = handle.regions();
    const anchorIds = handle.anchors().map((anchor) => anchor.id);
    expect(regions.map((region) => region.id)).toEqual(anchorIds);
    for (const region of regions) {
      expect(region.group).toBe("tower");
      expect(region.label).not.toMatch(/^[\d$.,\s]+$/); // words, never numbers alone
      expect(region.box!.min.y).toBeGreaterThanOrEqual(0);
      expect(region.box!.max.y).toBeGreaterThan(region.box!.min.y);
    }
    handle.dispose();
  });

  it("composes a phone and a desktop pose for the room and for every anchor", () => {
    const { handle } = build(reading([shelf("a", [bank("k1", 1_000)])]));
    const poses = handle.poses();
    for (const key of ["tower:phone", "tower:desktop", "sky:phone", "sky:desktop", "object:jug:phone", "object:bank:k1:desktop", "object:stair:phone"]) {
      expect(poses[key], key).toBeDefined();
    }
    // One convention: `<key>:<composition>`, resolved by `poseFor`.
    expect(poses["tower@phone"]).toBeUndefined();
    expect(poseFor(poses, "tower", "phone")).toEqual(poses["tower:phone"]);
    expect(poses["tower:phone"]!.phi).toBeGreaterThan(poses["sky:phone"]!.phi);
    expect(poses["tower:phone"]!.r).toBeLessThan(poses["sky:phone"]!.r);
    expect(poses["object:jug:phone"]!.r).toBeLessThan(poses["tower:phone"]!.r);
    handle.dispose();
  });

  it("rebuilds the banks when the rack changes, and only grows them when it has not", () => {
    const first = reading([shelf("a", [bank("k1", 10_000, 2), bank("k2", 50_000, 5)])]);
    const { handle } = build(first);
    expect(handle.banks()).toEqual(["k1", "k2"]);
    const built = handle.rebuilds();

    // Same banks, new figures: no rebuild.
    handle.update(reading([shelf("a", [bank("k1", 10_000, 4), bank("k2", 50_000, 5)])]));
    expect(handle.rebuilds()).toBe(built);
    expect(handle.banks()).toEqual(["k1", "k2"]);

    // A bank added: rebuilt, and standing on the floor.
    handle.update(reading([shelf("a", [bank("k1", 10_000, 4), bank("k2", 50_000, 5), bank("k3", 90_000, 0)])]));
    expect(handle.rebuilds()).toBe(built + 1);
    expect(handle.banks()).toEqual(["k1", "k2", "k3"]);

    // A shelf hung: rebuilt again, and a floor added for it.
    handle.update(reading([shelf("top", [bank("k1", 10_000, 4)]), shelf("a", [bank("k2", 50_000, 5), bank("k3", 90_000, 0)])]));
    expect(handle.rebuilds()).toBe(built + 2);
    expect(handle.words().shelves).toHaveLength(2);
    handle.dispose();
  });

  it("stands still: animate() is false at rest, and true while a deposit springs", () => {
    const { handle } = build(reading([shelf("a", [bank("k1", 10_000, 2)])]));
    expect(handle.animate(0, 0)).toBe(true); // the first frame after building paints once
    expect(handle.animate(1, 0.016)).toBe(false);
    expect(handle.animate(2, 0.016)).toBe(false);

    handle.update(reading([shelf("a", [bank("k1", 10_000, 5)])]));
    expect(handle.animate(3, 0.016)).toBe(true); // the deposit
    expect(handle.animate(3 + SQUASH_SECONDS * 0.5, 0.016)).toBe(true);
    expect(handle.animate(3 + SQUASH_SECONDS + 0.01, 0.016)).toBe(true); // the frame that settles it
    expect(handle.animate(5, 0.016)).toBe(false);
    handle.dispose();
  });

  it("lifts the roof on arrival, and has it already off under reduced motion", () => {
    const { handle } = build(reading([shelf("a", [])]));
    expect(handle.roof()).toBe(0);
    handle.setRoof(0.5);
    expect(handle.roof()).toBe(0.5);
    handle.setRoof(3);
    expect(handle.roof()).toBe(1);
    handle.dispose();

    const still = build(reading([shelf("a", [])]), { reducedMotion: true });
    expect(still.handle.roof()).toBe(1);
    still.handle.setRoof(0);
    expect(still.handle.roof()).toBe(1); // no lift to animate: the roof is simply off
    still.handle.dispose();
  });

  it("keeps a deposit still under reduced motion", () => {
    const { handle } = build(reading([shelf("a", [bank("k1", 10_000, 2)])]), { reducedMotion: true });
    handle.update(reading([shelf("a", [bank("k1", 10_000, 6)])]));
    handle.animate(1, 0.016);
    expect(handle.animate(1.1, 0.016)).toBe(false);
    handle.dispose();
  });

  it("furnishes the landing only for the custodian", () => {
    const held = build(reading([shelf("a", [])], { jug: { safeCents: 9_000, custodian: false, holder: "Bianca" }, gun: { available: true } }));
    expect(held.handle.landing.present()).toEqual({ jug: false, gun: false });
    expect(held.handle.words().jug).toContain("Bianca holds it");
    held.handle.dispose();

    const mine = build(reading([shelf("a", [])], { jug: { safeCents: 9_000, custodian: true, holder: null }, gun: { available: true } }));
    expect(mine.handle.landing.present()).toEqual({ jug: true, gun: true });
    expect(mine.handle.words().jug).toContain("$90 safe to pour");
    mine.handle.setPour(1);
    mine.handle.dispose();
  });

  it("is cosy when there is nothing on the shelf yet", () => {
    const { handle } = build(reading([]));
    expect(handle.words().empty).toBe(true);
    expect(handle.banks()).toEqual([]);
    expect(handle.words().shelves).toHaveLength(2);
    expect(handle.anchors().some((anchor) => anchor.id === "jug")).toBe(true);
    handle.dispose();
  });

  it("draws the tower itself inside its budget, before any sculpture", () => {
    const busy = reading([
      shelf("s1", [bank("a", 1_000, 1), bank("b", 5_000, 3), bank("c", 20_000, 5), bank("d", 60_000, 7), bank("e", 200_000, 9)], { share: 9, full: true }),
      shelf("s2", [bank("f", 1_500, 2), bank("g", 7_000, 4), bank("h", 30_000, 6)], { share: 5, cutoff: 12 }),
      shelf("s3", [bank("i", 2_000, 0), bank("j", 900_000, 10)], { share: 3, cutoff: 4 }),
      shelf("s4", [bank("k", 4_000, 1)], { share: 1 }),
    ], { jug: { safeCents: 40_000, custodian: true, holder: null }, gun: { available: true } });
    const { handle } = build(busy, { quality: "full" });
    expect(handle.sculptureCount()).toBe(11);
    expect(handle.drawCalls()).toBeLessThanOrEqual(120);
    handle.dispose();
  });
});

describe("the place contract", () => {
  it("builds through the registry with the shell's own dressing and reading", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const scene = new THREE.Scene();
    const controller = new AbortController();
    let painted = 0;
    const handle = towerPlace.build(
      scene,
      { theme: "newfoundland" } as never,
      { tower: reading([shelf("a", [bank("k1", 10_000, 2)])]) } as never,
      "lite",
      { composition: "phone", signal: controller.signal, invalidate: () => { painted += 1; } },
    ) as TowerHandle;
    expect(scene.children).toContain(handle.group);
    expect(handle.banks()).toEqual(["k1"]);
    expect(painted).toBeGreaterThanOrEqual(0);
    handle.update({ tower: reading([shelf("a", [bank("k1", 10_000, 2), bank("k2", 1_000, 0)])]) });
    expect(handle.banks()).toEqual(["k1", "k2"]);
    handle.dispose();
    expect(scene.children).not.toContain(handle.group);
  });
});
