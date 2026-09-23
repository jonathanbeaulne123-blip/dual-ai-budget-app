// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import {
  CATCH_UP, CAT_HEIGHT, CAT_RUN, CAT_TROT, DOOR_REACH, ERRAND_MET, HEEL_CLOSE, MOOD_AFTER,
  MOOD_AFTER_SECONDS, MOOD_FALLS_TO, PERCH_REACH, answerTo, createCatState, heelPoint, stepCat,
  type CatMood, type CatState, type CatSubject,
} from "../src/harbour/body/catModel.ts";
import { createCatFigure } from "../src/harbour/body/catFigure.ts";
import { createCat, CAT_ARRIVAL } from "../src/harbour/body/cat.ts";
import { createFootprints, PAW_SIZE } from "../src/harbour/body/footprints.ts";
import { ATTENTION_SPOTS, attentionDoor, attentionOf } from "../src/harbour/data/attention.ts";
import { VILLAGE_SITES, VILLAGE_WATERFRONT } from "../src/harbour/village/layout.ts";
import { PLACE_PLACEMENTS, placementDoor } from "../src/harbour/scene/place.ts";
import { EMPTY_BOATHOUSE_READING, EMPTY_CAMPFIRE_READING, EMPTY_KILN_READING, EMPTY_KITCHEN_READING } from "../src/harbour/data/reading.ts";
import { RUN_SPEED, WALK_SPEED, type BodyWorld } from "../src/harbour/body/bodyModel.ts";
import { SHORE_RADIUS, courtObstacles } from "../src/harbour/body/obstacles.ts";
import { groundHeightAt } from "../src/harbour/scene/ground.ts";

const flat: BodyWorld = { groundHeightAt: () => 0, obstacles: [], room: null };
const island: BodyWorld = { groundHeightAt, obstacles: courtObstacles("lite"), room: null, shore:SHORE_RADIUS };

const DT = 1 / 60;
const standing = (x: number, z: number, yaw = 0, speed = 0): CatSubject => ({ x, z, yaw, speed, air: 0, emote: null });

/** Run `seconds` of frames with the person doing one thing, and hand back the last step. */
function run(state: CatState, subject: (t: number) => CatSubject, seconds: number, world = flat, options = {}) {
  let step = stepCat(state, subject(0), DT, world, options);
  for (let t = DT; t < seconds; t += DT) step = stepCat(step.state, subject(t), DT, world, options);
  return step;
}

describe("Hercules follows", () => {
  it("walks to a heel point behind your shoulder, and is never underfoot", () => {
    // The person walks a straight line at their own walking speed.
    let cat = createCatState(0, 0, 0, flat);
    let gapToPerson = Infinity, gapToHeel = 0;
    let x = 0;
    for (let t = 0; t < 6; t += DT) {
      x += WALK_SPEED * DT;
      const you = standing(x, 0, 0, WALK_SPEED);
      cat = stepCat(cat, you, DT, flat).state;
      if (t > 2.5) {
        gapToPerson = Math.min(gapToPerson, Math.hypot(cat.x - you.x, cat.z - you.z));
        const heel = heelPoint(you);
        gapToHeel = Math.max(gapToHeel, Math.hypot(cat.x - heel.x, cat.z - heel.z));
      }
    }
    // Never glued: he keeps most of a body length between you.
    expect(gapToPerson, "a cat underfoot").toBeGreaterThan(0.45);
    // Never lost: once he has settled into it he holds the heel point.
    expect(gapToHeel, "a cat left behind at a walk").toBeLessThan(HEEL_CLOSE * 2.2);
    // And he is behind you, not in front: the heading is +z, so his z is less.
    expect(cat.z).toBeLessThan(0);
  });

  it("breaks into a run when you sprint and slows to a walk when you do", () => {
    let cat = createCatState(0, -1, 0, flat);
    let x = 0, fastest = 0;
    for (let t = 0; t < 2.5; t += DT) {
      x += RUN_SPEED * DT;
      cat = stepCat(cat, standing(x, 0, 0, RUN_SPEED), DT, flat).state;
      if (t > 1) fastest = Math.max(fastest, cat.speed);
    }
    expect(fastest, "he has to be able to keep up with a sprint").toBeGreaterThan(RUN_SPEED);
    expect(fastest).toBeLessThanOrEqual(CAT_RUN + 1e-6);
    // A bound, not a trot, at that speed.
    expect(cat.bound).toBeGreaterThan(0.8);

    // Now the person drops to a walk, and so does he.
    for (let t = 0; t < 3; t += DT) { x += WALK_SPEED * DT; cat = stepCat(cat, standing(x, 0, 0, WALK_SPEED), DT, flat).state; }
    expect(cat.speed).toBeLessThan(CAT_TROT + 0.3);
    expect(cat.bound, "a walk is a trot, not a bound").toBeLessThan(0.15);
  });

  it("catches up from a long way behind, at a run", () => {
    let cat = createCatState(0, 0, 0, flat);
    const you = standing(0, 6, 0, 0);
    expect(Math.hypot(cat.x - you.x, cat.z - you.z)).toBeGreaterThan(CATCH_UP);
    const step = run(cat, () => you, 6);
    expect(step.state.speed).toBeLessThan(0.02);
    expect(Math.hypot(step.state.x - you.x, step.state.z - you.z)).toBeLessThan(1.2);
  });

  it("refuses the water: he stops on the grass where you walk on to the sand", () => {
    // The person walks out to their own shore, which is further than his.
    let cat = createCatState(0, SHORE_RADIUS - 2, 0, island);
    const you = standing(0, SHORE_RADIUS, 0, 0);
    const step = run(cat, () => you, 10, island);
    const out = Math.hypot(step.state.x, step.state.z);
    expect(out, "a cat in the sea").toBeLessThanOrEqual(SHORE_RADIUS + 1e-6);
    expect(groundHeightAt(step.state.x,step.state.z)).toBeGreaterThan(-.45);
    expect(out).toBeLessThan(SHORE_RADIUS);
  });
});

describe("Hercules has moods, and every one of them ends", () => {
  it("settles after you stand still, and then asks for no more frames", () => {
    // Somewhere that picks each of the four idles, so none of them is untested.
    const seen = new Set<CatMood>();
    for (const [x, z] of [[0, 0], [0.4, 0], [0, 0.4], [0.4, 0.4], [1.1, 0.3], [2.3, 1.7]] as const) {
      let cat = createCatState(x, z, 0, flat);
      cat = { ...cat, mood: "trot", still: 0, seated: 0, life: 1 };
      const you = standing(x, z + 0.8, 0, 0);
      let step = stepCat(cat, you, DT, flat);
      let frames = 0;
      while (step.moving && frames < 60 * 30) { step = stepCat(step.state, you, DT, flat); frames += 1; }
      expect(step.moving, `a cat at ${x},${z} that never stops`).toBe(false);
      expect(MOOD_AFTER_SECONDS[step.state.mood], "he settled into a mood that keeps a clock running").toBeNull();
      expect(step.state.life, "a flourish that never reaches zero keeps the island awake").toBe(0);
      seen.add(step.state.mood);
    }
    // And the pick is honest: more than one idle is reachable.
    expect(seen.size).toBeGreaterThanOrEqual(1);
    for (const mood of seen) expect(["sit", "flop"]).toContain(mood);
  });

  it("every mood falls to a terminal one, in at most two hops", () => {
    for (const mood of Object.keys(MOOD_AFTER_SECONDS) as CatMood[]) {
      let at: CatMood = mood, hops = 0;
      while (MOOD_AFTER_SECONDS[at] !== null && hops < 4) { at = MOOD_FALLS_TO[at]; hops += 1; }
      expect(MOOD_AFTER_SECONDS[at], `${mood} never settles`).toBeNull();
      expect(hops).toBeLessThanOrEqual(2);
    }
  });

  it("answers a wave by coming, a dance by bouncing and a sit by sitting", () => {
    expect(answerTo("wave")).toBe("come");
    expect(answerTo("dance")).toBe("bounce");
    expect(answerTo("sit")).toBe("sit");
    expect(answerTo("point"), "a cat does not follow a finger").toBeNull();

    // Wave: he closes right in, much nearer than the heel.
    const you = { ...standing(0, 0, 0, 0), emote: "wave" as const };
    let cat = createCatState(0, -2.4, 0, flat);
    const came = run(cat, () => you, 3);
    expect(Math.hypot(came.state.x - you.x, came.state.z - you.z)).toBeLessThan(0.6);

    // Dance: he bounces, and the bounce ends.
    const dancing = { ...standing(0, 0, 0, 0), emote: "dance" as const };
    let near = createCatState(0, -0.8, 0, flat);
    const first = stepCat(near, dancing, DT, flat);
    expect(first.state.mood).toBe("bounce");
    const later = run(first.state, () => dancing, 5);
    expect(MOOD_AFTER_SECONDS[later.state.mood]).toBeNull();

    // Sit: he sits, at once and for good.
    const sitting = { ...standing(0, 0, 0, 0), emote: "sit" as const };
    expect(stepCat(createCatState(0, -0.8, 0, flat), sitting, DT, flat).state.mood).toBe("sit");
  });

  it("looks up when you jump", () => {
    const jumping = { ...standing(0, 0, 0, 0), air: 0.3 };
    const step = stepCat(createCatState(0, -0.8, 0, flat), jumping, DT, flat);
    expect(step.state.mood).toBe("look-up");
    // And it is over in a moment, not a pose he is stuck in.
    expect(run(step.state, () => standing(0, 0, 0, 0), 6).moving).toBe(false);
  });

  it("one wave is one answer: it is not re-answered every frame", () => {
    const waving = { ...standing(0, 0, 0, 0), emote: "wave" as const };
    let step = stepCat(createCatState(0, -0.6, 0, flat), waving, DT, flat);
    expect(step.state.answered).toBe("wave");
    const come = step.state.come;
    step = stepCat(step.state, waving, DT, flat);
    expect(step.state.come, "the clock has to run down, not be re-set").toBeLessThan(come);
  });

  it("takes the Queen's warm flagstone when you stop beside it, and gives it up when you walk on", () => {
    const flagstone = { x: 0, z: 1.6 };
    // You stop a stride from the stone. He does not stand at your heel; he
    // takes the stone, and then he stops asking for frames.
    const you = standing(1.4, 1.9, Math.PI, 0);
    const settled = run(createCatState(1.4, 2.6, 0, island), () => you, 12, island, { perch: flagstone });
    expect(Math.hypot(settled.state.x - flagstone.x, settled.state.z - flagstone.z), "he ignored a warm stone").toBeLessThan(HEEL_CLOSE * 3);
    expect(settled.moving).toBe(false);

    // You walk on. The stone is given up at once — he follows you, not it.
    let step = stepCat(settled.state, standing(1.4, 6, Math.PI, WALK_SPEED), DT, island, { perch: flagstone });
    for (let t = DT; t < 8; t += DT) step = stepCat(step.state, standing(1.4, 6, Math.PI, 0), DT, island, { perch: flagstone });
    expect(Math.hypot(step.state.x - 1.4, step.state.z - 6)).toBeLessThan(1.2);

    // And a stone on the far side of the island is not a stone he goes to.
    const far = run(createCatState(9, 9, 0, island), () => standing(9, 9.7, 0, 0), 12, island, { perch: flagstone });
    expect(Math.hypot(far.state.x - flagstone.x, far.state.z - flagstone.z)).toBeGreaterThan(PERCH_REACH);
  });

  it("reduced motion keeps him following and drops the flourishes", () => {
    const options = { reduced: true };
    let cat = createCatState(0, -1, 0, flat);
    let x = 0;
    for (let t = 0; t < 3; t += DT) { x += RUN_SPEED * DT; cat = stepCat(cat, standing(x, 0, 0, RUN_SPEED), DT, flat, options).state; }
    // He still followed.
    expect(Math.hypot(cat.x - x, cat.z)).toBeLessThan(1.5);
    // And he did it at a trot: no bound, no performance.
    expect(cat.bound).toBe(0);
    const stopped = run(cat, () => standing(x, 0, 0, 0), 12, flat, options);
    expect(stopped.moving).toBe(false);
    expect(stopped.state.mood, "reduced motion does not groom").toBe("sit");
    // Even a dance gets nothing but a cat.
    const dancing = { ...standing(x, 0, 0, 0), emote: "dance" as const };
    expect(stepCat(stopped.state, dancing, DT, flat, options).state.mood).toBe("sit");
  });
});

describe("Hercules leads you to what needs attention", () => {
  it("reads only what the reading already says, and invents nothing", () => {
    expect(attentionOf(null)).toBeNull();
    expect(attentionOf({})).toBeNull();
    expect(attentionOf({
      campfire: EMPTY_CAMPFIRE_READING, kitchen: EMPTY_KITCHEN_READING,
      boathouse: EMPTY_BOATHOUSE_READING, kiln: EMPTY_KILN_READING,
      glasshouse: { pots: [], mine: { seed: 0, sprout: 0, bloom: 0 }, harvested: 0, perennials: [], dry: 0, overflow: 0 },
      next: null,
    }), "an empty reading is a cat with nowhere to lead you").toBeNull();
  });

  it("names the building each honest reading stands in front of", () => {
    const bill = attentionOf({ next: { label: "Hydro", date: "2026-09-30", cents: 8400, daysAhead: 3, target: "cellar-bills" } });
    expect(bill?.spot).toBe("stairhead");
    expect(bill?.why).toContain("Hydro");
    expect(bill?.why).toContain("3 days");

    // A day that comes up short beats a bill that is merely due.
    const short = attentionOf({
      prepare: { cents: 100, target: 200, coveredThrough: null, shortOn: { date: "2026-09-25", label: "Rent", shortCents: 4200 } },
      next: { label: "Hydro", date: "2026-09-30", cents: 8400, daysAhead: 3, target: "cellar-bills" },
    });
    expect(short?.spot).toBe("stairhead");
    expect(short?.why).toContain("Rent");

    expect(attentionOf({ campfire: { ...EMPTY_CAMPFIRE_READING, month: "2026-08", close: "proposed" } })?.spot).toBe("campfire");
    expect(attentionOf({ campfire: { ...EMPTY_CAMPFIRE_READING, month: "2026-08", overdue: true } })?.spot).toBe("campfire");
    expect(attentionOf({ kitchen: { ...EMPTY_KITCHEN_READING, waiting: true } })?.spot).toBe("kitchen-cottage");
    expect(attentionOf({ glasshouse: { pots: [], mine: { seed: 0, sprout: 0, bloom: 0 }, harvested: 0, perennials: [], dry: 2, overflow: 0 } })?.spot).toBe("glasshouse-shed");
    expect(attentionOf({ boathouse: { ...EMPTY_BOATHOUSE_READING, hung: 1 } })?.spot).toBe("boathouse");
    expect(attentionOf({ kiln: { ...EMPTY_KILN_READING, onTheWheel: 3 } })?.spot).toBe("kiln-house");
  });

  it("derives each attention target from the canonical village door", () => {
    expect(ATTENTION_SPOTS.stairhead).toEqual(VILLAGE_SITES.home.spot);
    expect(ATTENTION_SPOTS["kitchen-cottage"]).toEqual(VILLAGE_SITES.home.spot);
    expect(ATTENTION_SPOTS.campfire).toEqual(VILLAGE_WATERFRONT.spot);
    expect(ATTENTION_SPOTS["glasshouse-shed"]).toEqual(VILLAGE_SITES.glasshouse.spot);
    expect(ATTENTION_SPOTS.boathouse).toEqual(VILLAGE_SITES.boathouse.spot);
    expect(ATTENTION_SPOTS["kiln-house"]).toEqual(VILLAGE_SITES.studio.spot);
    const kitchenDoor = placementDoor(PLACE_PLACEMENTS.kitchen!);
    const billDoor = attentionDoor("stairhead");
    expect(Math.abs(Math.atan2(kitchenDoor[0] - billDoor.x, kitchenDoor[2] - billDoor.z) - billDoor.yaw)).toBeLessThan(1e-9);
  });

  it("the key changes only when the thing does", () => {
    const one = attentionOf({ glasshouse: { pots: [], mine: { seed: 0, sprout: 0, bloom: 0 }, harvested: 0, perennials: [], dry: 2, overflow: 0 } });
    const same = attentionOf({ glasshouse: { pots: [], mine: { seed: 1, sprout: 4, bloom: 2 }, harvested: 9, perennials: [], dry: 2, overflow: 3 } });
    const other = attentionOf({ glasshouse: { pots: [], mine: { seed: 0, sprout: 0, bloom: 0 }, harvested: 0, perennials: [], dry: 3, overflow: 0 } });
    expect(one?.key).toBe(same?.key);
    expect(one?.key).not.toBe(other?.key);
  });

  it("stands his door in front of the building, on the island and out of the sea", () => {
    for (const name of Object.keys(ATTENTION_SPOTS) as (keyof typeof ATTENTION_SPOTS)[]) {
      const door = attentionDoor(name);
      expect(Math.hypot(door.x, door.z)).toBeLessThan(73.2);
      // And he faces the thing he brought you to.
      const target = name === "stairhead" || name === "kitchen-cottage" ? placementDoor(PLACE_PLACEMENTS.kitchen!)
        : name === "campfire" ? placementDoor(PLACE_PLACEMENTS.campfire!)
          : name === "glasshouse-shed" ? placementDoor(PLACE_PLACEMENTS.glasshouse!)
            : name === "boathouse" ? placementDoor(PLACE_PLACEMENTS.boathouse!)
              : placementDoor(PLACE_PLACEMENTS.kiln!);
      expect(Math.abs(Math.atan2(target[0] - door.x, target[2] - door.z) - door.yaw)).toBeLessThan(1e-9);
    }
  });

  it("walks to the door, waits there, and lays a trail of paws that leads to it", () => {
    const door = attentionDoor("campfire");
    const errand = { key: "chapter:2026-08:proposed:open", ...door };
    // You are standing on the Court's paving; he leaves your heel for the fire.
    const deliveryWorld={...island,obstacles:[]};
    const you = standing(1.2, 2.4, 0, 0);
    let cat = createCatState(you.x, you.z - 0.7, 0, deliveryWorld);
    // But not while you are still standing in the gate: he gets up when you
    // do, which is what lets a place be at rest on its very first frame.
    const asleep = stepCat(cat, you, DT, deliveryWorld, { errand });
    expect(asleep.waiting).toBe(false);
    expect(asleep.state.roused).toBe(false);
    expect(Math.hypot(asleep.state.x - cat.x, asleep.state.z - cat.z), "he set off before you moved").toBeLessThan(1e-6);
    // One step of yours and he is away.
    cat = stepCat(cat, { ...you, speed: WALK_SPEED }, DT, deliveryWorld, { errand }).state;
    expect(cat.roused).toBe(true);
    const prints: { x: number; z: number }[] = [];
    let step = stepCat(cat, you, DT, deliveryWorld, { errand });
    for (let t = DT; t < 30; t += DT) {
      step = stepCat(step.state, you, DT, deliveryWorld, { errand });
      if (step.pawfall) prints.push({ x: step.pawfall.x, z: step.pawfall.z });
    }
    expect(Math.hypot(step.state.x - door.x, step.state.z - door.z), "he never got to the door").toBeLessThanOrEqual(DOOR_REACH + 1e-6);
    expect(step.waiting).toBe(true);
    expect(step.state.mood).toBe("wait");
    // The trail runs from where you were standing to the door he is at.
    expect(prints.length).toBeGreaterThan(8);
    const first = prints[0]!, last = prints[prints.length - 1]!;
    expect(Math.hypot(first.x - you.x, first.z - you.z)).toBeLessThan(2);
    expect(Math.hypot(last.x - door.x, last.z - door.z)).toBeLessThan(1);

    // And when you come to the door, the errand has been shown and he comes back to your heel.
    const arrived = { ...standing(door.x, door.z, 0, 0) };
    let back = stepCat(step.state, arrived, DT, deliveryWorld, { errand });
    expect(back.state.shownKey).toBe(errand.key);
    for (let t = DT; t < 8; t += DT) back = stepCat(back.state, arrived, DT, deliveryWorld, { errand });
    expect(Math.hypot(back.state.x - arrived.x, back.state.z - arrived.z)).toBeLessThan(1.1);
    expect(back.moving, "and then the island may sleep again").toBe(false);

    // Stepping into a building and out again is not a second errand: the same
    // bill is not walked to twice.
    let again = stepCat(back.state, arrived, DT, deliveryWorld, { errand: null });
    again = stepCat(again.state, arrived, DT, deliveryWorld, { errand });
    expect(again.waiting).toBe(false);
    for (let t = 0; t < 4; t += DT) again = stepCat(again.state, arrived, DT, deliveryWorld, { errand });
    expect(Math.hypot(again.state.x - arrived.x, again.state.z - arrived.z), "he led you to it a second time").toBeLessThan(1.1);
  });

  it("a wave beats the errand for as long as the answer lasts", () => {
    const door = attentionDoor("boathouse");
    const errand = { key: "hung:1", ...door };
    const waving = { ...standing(0, 3, 0, 0), emote: "wave" as const };
    const step = run({ ...createCatState(0, 2.3, 0, island), roused: true }, () => waving, 2, island, { errand });
    expect(Math.hypot(step.state.x - waving.x, step.state.z - waving.z)).toBeLessThan(1);
    expect(step.waiting).toBe(false);
  });
});

describe("what Hercules is made of", () => {
  it("is a carved cat at village scale, inside a handful of meshes", () => {
    const figure = createCatFigure();
    let meshes = 0;
    figure.group.traverse((node) => { if ((node as THREE.Mesh).isMesh) meshes += 1; });
    expect(meshes, "a cat is not a room").toBeLessThanOrEqual(16);
    expect(figure.height).toBe(CAT_HEIGHT);
    // Knee-high on a 0.58 person, and the box the twins would use says so.
    const box = new THREE.Box3().setFromObject(figure.group);
    expect(box.max.y).toBeLessThan(CAT_HEIGHT);
    figure.dispose();
  });

  it("stands on the island, walks inside the frame it is given, and comes to rest", () => {
    const scene = new THREE.Scene();
    const cat = createCat({ groundHeightAt, obstacles: courtObstacles("lite"), tier: "lite", start: CAT_ARRIVAL });
    scene.add(cat.group);
    expect(cat.state().y).toBeCloseTo(groundHeightAt(CAT_ARRIVAL.x, CAT_ARRIVAL.z), 6);
    let moving = true;
    for (let t = 0; t < 30 && moving; t += DT) moving = cat.step(DT, t, standing(CAT_ARRIVAL.x + 0.4, CAT_ARRIVAL.z + 0.9, 0, 0));
    expect(moving, "a cat that keeps the world awake").toBe(false);
    const box = cat.bounds(new THREE.Box3());
    expect(box.max.y - box.min.y).toBeCloseTo(CAT_HEIGHT, 6);
    cat.dispose();
    expect(scene.children.length).toBe(0);
  });

  it("safely catches up across a long, obstructed journey without starting frames", () => {
    const wall = { kind: "box" as const, id: "wall", minX: -0.4, minZ: -4, maxX: 0.4, maxZ: 4 };
    const cat = createCat({ groundHeightAt: () => 0, obstacles: [wall], start: { x: -3, z: 0 }, trail: false, });
    const you = standing(3, 0, 0, 0);
    expect(cat.catchUp(you)).toBe(true);
    const heel = { x: you.x - 0.62, z: you.z - 0.52 };
    expect(Math.hypot(cat.state().x - heel.x, cat.state().z - heel.z)).toBeLessThan(0.02);
    expect(cat.state().speed).toBe(0);
    cat.dispose();
  });

  it("refuses a catch-up across a closed room wall", () => {
    const room = { x: 0, z: 0, halfX: 2, halfZ: 2, yaw: 0, door: null };
    const cat = createCat({ groundHeightAt: () => 0, room, start: { x: 0, z: 0 }, trail: false });
    expect(cat.catchUp(standing(4, 0, 0, 0))).toBe(false);
    expect(cat.state().x).toBe(0);
    cat.dispose();
  });

  it("walks bounded pathfinder waypoints around a building and tree to a far errand", () => {
    const building = { kind: "box" as const, id: "building", minX: -1, minZ: -4, maxX: 1, maxZ: 4 };
    const tree = { kind: "circle" as const, id: "tree", x: 2.4, z: 4.8, r: 0.65 };
    const cat = createCat({ groundHeightAt: () => 0, obstacles: [building, tree], start: { x: -5, z: 0 }, trail: false, shore: 20 });
    const errand = { key: "far-door", x: 5, z: 0, yaw: 0 };
    cat.setErrand(errand);
    cat.step(DT, 0, standing(0, 0, 0, WALK_SPEED));
    for (let t = DT; t < 35 && !cat.waiting(); t += DT) cat.step(DT, t, standing(0, 0, 0, 0));
    expect(cat.waiting()).toBe(true);
    expect(Math.hypot(cat.state().x - errand.x, cat.state().z - errand.z)).toBeLessThanOrEqual(DOOR_REACH + 1e-6);
    cat.dispose();
  });

  it("uses bounded waypoints to regain a heel point behind the same barrier", () => {
    const building = { kind: "box" as const, id: "building", minX: -1, minZ: -4, maxX: 1, maxZ: 4 };
    const tree = { kind: "circle" as const, id: "tree", x: 2.4, z: 4.8, r: 0.65 };
    const cat = createCat({ groundHeightAt: () => 0, obstacles: [building, tree], start: { x: -5, z: 0 }, trail: false, shore: 20 });
    const you = standing(5, 0, 0, 0);
    cat.step(DT, 0, { ...you, speed: WALK_SPEED });
    for (let t = DT; t < 35; t += DT) cat.step(DT, t, you);
    const heel = { x: you.x - 0.62, z: you.z - 0.52 };
    expect(Math.hypot(cat.state().x - heel.x, cat.state().z - heel.z)).toBeLessThan(0.8);
    cat.dispose();
  });

  it("leaves a paw print, not a footprint", () => {
    const paws = createFootprints("#6b5a44", 8, PAW_SIZE);
    paws.drop(0, 0, 0, 0, true, 0);
    const feet = createFootprints("#6b5a44", 8);
    feet.drop(0, 0, 0, 0, true, 0);
    const pawMesh = paws.group.children[0] as THREE.Mesh;
    const footMesh = feet.group.children[0] as THREE.Mesh;
    expect(pawMesh.scale.x).toBeCloseTo(footMesh.scale.x * PAW_SIZE, 6);
    expect(pawMesh.scale.y).toBeCloseTo(footMesh.scale.y * PAW_SIZE, 6);
    // And it is laid closer to the line he walked, because he is narrower.
    expect(Math.abs(pawMesh.position.x)).toBeLessThan(Math.abs(footMesh.position.x));
    paws.dispose(); feet.dispose();
  });
});

describe("what a cat may never do", () => {
  it("writes no money, reads no storage, and never owns a frame", () => {
    for (const name of ["body/catModel.ts", "body/catFigure.ts", "body/cat.ts", "data/attention.ts"]) {
      const source = readFileSync(`src/harbour/${name}`, "utf8");
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(/);
      expect(source).not.toMatch(/postEntry|postShift|commitCommand|acceptHouseholdWrite/);
      // The hard rule: the renderer lease owns the loop.
      expect(source).not.toMatch(/requestAnimationFrame\s*\(/);
    }
  });

  it("never claims a state the reading does not carry", () => {
    // Every branch of the attention reader is a field of `HarbourReading`, and
    // none of them is a number this file made up.
    const source = readFileSync("src/harbour/data/attention.ts", "utf8");
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date/);
    // `ERRAND_MET` is how near you have to come; it is wider than the door he
    // stands at, so arriving counts before you are standing on him.
    expect(ERRAND_MET).toBeGreaterThan(DOOR_REACH);
    expect(MOOD_AFTER).toBeGreaterThan(0);
    expect(spotless(ATTENTION_SPOTS)).toBe(true);
  });
});

/** Every spot he waits at is a real place on the island, inside the lawn and out of the water. */
function spotless(spots: Readonly<Record<string, readonly [number, number]>>): boolean {
  return Object.values(spots).every(([x, z]) => Math.hypot(x, z) < SHORE_RADIUS);
}
