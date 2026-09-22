// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  BODY_HEIGHT, BODY_RADIUS, NO_INPUT, RUN_SPEED, STRIDE, WALK_SPEED,
  cameraBasis, createBodyState, eyeHeight, stepBody, walkTo,
  type BodyState, type BodyWorld,
} from "../src/harbour/body/bodyModel.ts";
import {
  COURT_FURNITURE, ISLAND_BUILDINGS, SHORE_RADIUS, courtObstacles, holdAshore, isClear, pushOut, treeRingObstacles,
} from "../src/harbour/body/obstacles.ts";
import { createBodyFigure } from "../src/harbour/body/figure.ts";
import { createWalker, COURT_ARRIVAL } from "../src/harbour/body/walker.ts";
import { createFootprints, FOOTPRINT_LIFE, FOOTPRINT_POOL } from "../src/harbour/body/footprints.ts";
import {
  FOLLOW_DISTANCE, FOLLOW_MAX_R, FOLLOW_MIN_R, createFollowCamera,
} from "../src/harbour/camera/followCamera.ts";
import { harbourFramePolicy, CAMERA_INTERVAL_MS } from "../src/harbour/scene/framePolicy.ts";
import { GROUND_RADIUS, LAWN_RADIUS, SEA_LEVEL, TERRACE_LEVEL, TERRACE_RADIUS, createGround, groundHeightAt } from "../src/harbour/scene/ground.ts";
import { SCENE_DRESSING, type Place } from "../src/harbour/scene/place.ts";
import { mountHarbourWorld, type HarbourRuntime } from "../src/harbour/scene/runtime.ts";
// Entering a place needs it registered; a room off the island raises a body of its own.
import "../src/harbour/court/CourtScene.ts";
import { TOWER_LAYOUT } from "../src/harbour/tower/TowerScene.ts";
import { readFileSync } from "node:fs";

const release = vi.fn();
vi.mock("../src/house/world/rendererOwner.ts", () => ({
  acquireWorldRenderer: () => ({
    active: true,
    renderer: {
      render: vi.fn(), setSize: vi.fn(),
      info: { render: { calls: 0 }, memory: { geometries: 0, textures: 0 } },
    },
    requestFrame: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
    cancelFrame: (id: number) => cancelAnimationFrame(id),
    listenCanvas: () => () => undefined,
    release: (...args: unknown[]) => release(...args),
  }),
}));

/** The island a body walks on in these tests: the real ground, the real obstacles. */
const island: BodyWorld = { groundHeightAt, obstacles: courtObstacles("full") };
/** An empty island, for the arithmetic that has nothing to do with what stands on it. */
const bare: BodyWorld = { groundHeightAt, obstacles: [] };

/** Walk a body for `seconds` in one direction and hand back every state it passed through. */
function walk(state: BodyState, theta: number, seconds: number, world: BodyWorld, input = { forward: 1, strafe: 0 }): BodyState[] {
  const dt = 1 / 60, path: BodyState[] = [];
  for (let i = 0; i < Math.round(seconds / dt); i += 1) {
    state = stepBody(state, input, theta, dt, world).state;
    path.push(state);
  }
  return path;
}
/** The heading that makes "forward" point along +z, and the one that makes it point along −z. */
const TOWARD_Z = Math.PI, AWAY_FROM_Z = 0;

describe("the body is a person in a model village", () => {
  it("is about 0.58 units tall, a bit over a quarter of the Queen", () => {
    // The Queen is 2.05 (camera/poses.ts). A person beside her must read as a person.
    expect(BODY_HEIGHT).toBeGreaterThan(0.5);
    expect(BODY_HEIGHT).toBeLessThan(0.65);
    expect(BODY_HEIGHT / 2.05).toBeGreaterThan(0.25);
    expect(BODY_HEIGHT / 2.05).toBeLessThan(0.31);
  });

  it("crosses the island in a believable number of seconds", () => {
    // 48 units across at 1.5 units a second is about half a minute at a walk,
    // and about eighteen seconds at a run. Long enough to be a journey.
    const across = GROUND_RADIUS * 2;
    expect(across / WALK_SPEED).toBeGreaterThan(24);
    expect(across / WALK_SPEED).toBeLessThan(40);
    expect(across / RUN_SPEED).toBeGreaterThan(14);
    expect(across / RUN_SPEED).toBeLessThan(22);
  });

  it("builds a figure of jointed parts, not a capsule, and takes its colours from the caller", () => {
    const figure = createBodyFigure({ coat: "#884422" });
    const names = new Set<string>();
    figure.group.traverse((node) => { if (node.name) names.add(node.name); });
    for (const part of ["body-torso", "body-head", "body-leg-left", "body-leg-right", "body-arm-left", "body-arm-right"]) {
      expect(names).toContain(part);
    }
    // The legs actually swing, and in opposition, and only as far as the gait says.
    const left = figure.group.getObjectByName("body-leg-left")!;
    const right = figure.group.getObjectByName("body-leg-right")!;
    figure.pose(Math.PI / 2, 1, 0);
    expect(left.rotation.x).toBeLessThan(-0.5);
    expect(right.rotation.x).toBeGreaterThan(0.5);
    expect(left.rotation.x).toBeCloseTo(-right.rotation.x, 10);
    // Standing still, the legs are under the body.
    figure.pose(Math.PI / 2, 0, 0);
    expect(left.rotation.x).toBeCloseTo(0, 10);
    // And the whole body sits inside its own height.
    figure.pose(0, 0, 0);
    figure.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(figure.group);
    expect(box.max.y).toBeLessThanOrEqual(BODY_HEIGHT + 1e-3);
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-3);
    figure.dispose();
  });
});

describe("the body follows the ground", () => {
  it("stands exactly on the island's own profile wherever it goes", () => {
    let state = createBodyState(3, 0, 0, bare);
    for (const next of walk(state, TOWARD_Z, 14, bare)) {
      expect(next.y).toBeCloseTo(groundHeightAt(next.x, next.z), 12);
    }
    state = createBodyState(3, 0, 0, bare);
    for (const next of walk(state, AWAY_FROM_Z, 14, bare)) {
      expect(next.y).toBeCloseTo(groundHeightAt(next.x, next.z), 12);
    }
  });

  it("walks up the lawn's hump and down toward the shore", () => {
    // The terrace is level to r 9.6, the lawn humps to +0.28 at its middle,
    // and the shore falls away quadratically to the sea.
    const path = walk(createBodyState(3, 0, 0, bare), TOWARD_Z, 20, bare);
    const heights = new Map<string, number>();
    for (const at of path) heights.set(Math.hypot(at.x, at.z).toFixed(1), at.y);
    const onTerrace = path.find((at) => Math.hypot(at.x, at.z) < TERRACE_RADIUS - 1)!;
    const onHump = path.find((at) => Math.abs(Math.hypot(at.x, at.z) - (TERRACE_RADIUS + LAWN_RADIUS) / 2) < 0.2)!;
    const onShore = path.find((at) => Math.hypot(at.x, at.z) > LAWN_RADIUS + 3)!;
    expect(onTerrace.y).toBeCloseTo(TERRACE_LEVEL, 10);
    // The top of the hump is a real climb: a quarter of the body's height.
    expect(onHump.y - TERRACE_LEVEL).toBeGreaterThan(0.25);
    expect(onShore.y).toBeLessThan(TERRACE_LEVEL);
    expect(heights.size).toBeGreaterThan(5);
  });

  it("is stopped by the water's edge and never walks into the sea", () => {
    const path = walk(createBodyState(3, 0, 0, bare), TOWARD_Z, 40, bare);
    const last = path[path.length - 1]!;
    expect(Math.hypot(last.x, last.z)).toBeLessThanOrEqual(SHORE_RADIUS + 1e-9);
    // Standing on sand, not in water: the shore's own height is still above the sea.
    expect(last.y).toBeGreaterThan(SEA_LEVEL);
    for (const at of path) expect(Math.hypot(at.x, at.z)).toBeLessThanOrEqual(SHORE_RADIUS + 1e-9);
    expect(holdAshore(40, 0).x).toBeCloseTo(SHORE_RADIUS, 10);
    expect(holdAshore(1, 1).ashore).toBe(true);
  });

  it("is frame-rate independent: one long step and many short ones land together", () => {
    const start = createBodyState(2, 0, 0, bare);
    let coarse = start, fine = start;
    for (let i = 0; i < 12; i += 1) coarse = stepBody(coarse, { forward: 1, strafe: 0 }, TOWARD_Z, 1 / 12, bare).state;
    for (let i = 0; i < 120; i += 1) fine = stepBody(fine, { forward: 1, strafe: 0 }, TOWARD_Z, 1 / 120, bare).state;
    expect(Math.hypot(coarse.x - fine.x, coarse.z - fine.z)).toBeLessThan(0.05);
  });
});

describe("the body collides", () => {
  it("is pushed out of a building rather than through it", () => {
    const library = ISLAND_BUILDINGS.find((o) => o.id === "library-hall")!;
    expect(library.kind).toBe("box");
    if (library.kind !== "box") throw new Error("unreachable");
    // Straight at the Library's near wall from the lawn.
    const start = createBodyState((library.minX + library.maxX) / 2, library.maxZ + 2.4, 0, island);
    const path = walk(start, AWAY_FROM_Z, 8, island);
    for (const at of path) {
      const insideX = at.x > library.minX - BODY_RADIUS + 1e-6 && at.x < library.maxX + BODY_RADIUS - 1e-6;
      const insideZ = at.z > library.minZ - BODY_RADIUS + 1e-6 && at.z < library.maxZ + BODY_RADIUS - 1e-6;
      expect(insideX && insideZ).toBe(false);
    }
    const last = path[path.length - 1]!;
    // It ends pressed against the wall it walked into, a body's width off it.
    expect(last.z).toBeCloseTo(library.maxZ + BODY_RADIUS, 4);
    expect(last.contact).toBe("library-hall");
  });

  it("slides along a wall instead of stopping dead against it", () => {
    const kiln = ISLAND_BUILDINGS.find((o) => o.id === "kiln-house")!;
    if (kiln.kind !== "box") throw new Error("unreachable");
    // Walk into the near wall at 45°: the part of the push into the wall is
    // lost, the part along it survives. That is the whole of "slide".
    const start = createBodyState(kiln.minX + 0.1, kiln.maxZ + 0.28, 0, island);
    const path = walk(start, AWAY_FROM_Z, 4, island, { forward: 1, strafe: -1 });
    const pressed = path.filter((at) => Math.abs(at.z - (kiln.maxZ + BODY_RADIUS)) < 1e-6);
    expect(pressed.length).toBeGreaterThan(20);
    const xs = pressed.map((at) => at.x);
    // It travelled along the wall while it was against it.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.6);
    // And it never entered the building.
    for (const at of path) {
      const inside = at.x > kiln.minX - BODY_RADIUS + 1e-6 && at.x < kiln.maxX + BODY_RADIUS - 1e-6
        && at.z > kiln.minZ - BODY_RADIUS + 1e-6 && at.z < kiln.maxZ + BODY_RADIUS - 1e-6;
      expect(inside).toBe(false);
    }
  });

  it("walks round the Queen rather than through her", () => {
    const queen = COURT_FURNITURE.find((o) => o.id === "queen")!;
    if (queen.kind !== "circle") throw new Error("unreachable");
    const path = walk(createBodyState(1.0, 3.6, 0, island), AWAY_FROM_Z, 8, island);
    for (const at of path) {
      expect(Math.hypot(at.x - queen.x, at.z - queen.z)).toBeGreaterThanOrEqual(queen.r + BODY_RADIUS - 1e-6);
    }
  });

  it("pushes out perpendicular, with no jitter: a body already clear is left exactly where it stands", () => {
    const clear = pushOut(7.5, 0.4, BODY_RADIUS, courtObstacles("full"));
    expect(clear.x).toBe(7.5);
    expect(clear.z).toBe(0.4);
    expect(clear.hit).toBeNull();
    expect(isClear(7.5, 0.4, BODY_RADIUS, courtObstacles("full"))).toBe(true);
    // Twice out of the same overlap is the same answer — nothing shuttles.
    const once = pushOut(0.1, 0.1, BODY_RADIUS, [{ kind: "circle", id: "queen", x: 0, z: 0, r: 0.95 }]);
    const twice = pushOut(once.x, once.z, BODY_RADIUS, [{ kind: "circle", id: "queen", x: 0, z: 0, r: 0.95 }]);
    expect(twice.x).toBeCloseTo(once.x, 12);
    expect(twice.z).toBeCloseTo(once.z, 12);
    // Dead centre has an answer rather than a division by zero.
    const centre = pushOut(0, 0, BODY_RADIUS, [{ kind: "circle", id: "queen", x: 0, z: 0, r: 0.95 }]);
    expect(Number.isFinite(centre.x) && Number.isFinite(centre.z)).toBe(true);
    expect(Math.hypot(centre.x, centre.z)).toBeCloseTo(0.95 + BODY_RADIUS, 10);
  });

  it("collides with the tree ring the island actually planted", () => {
    // Not a guess at where the trees are: the same seed `scene/ground.ts` sows,
    // checked against the real instanced trunks. Move the ring and this fails.
    const scene = new THREE.Scene();
    for (const tier of ["full", "lite"] as const) {
      const ground = createGround(scene, SCENE_DRESSING.classic, tier);
      const trees = ground.group.getObjectByName("trees") as THREE.InstancedMesh;
      const mine = treeRingObstacles(tier);
      expect(mine).toHaveLength(trees.count);
      const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
      for (let i = 0; i < trees.count; i += 1) {
        trees.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        const trunk = mine[i]!;
        if (trunk.kind !== "circle") throw new Error("unreachable");
        expect(trunk.x).toBeCloseTo(position.x, 4);
        expect(trunk.z).toBeCloseTo(position.z, 4);
      }
      ground.dispose();
    }
  });

  it("gives up a tap-to-walk that is getting nowhere rather than pressing at a wall for ever", () => {
    const library = ISLAND_BUILDINGS.find((o) => o.id === "library-hall")!;
    if (library.kind !== "box") throw new Error("unreachable");
    // Told to walk to the far side of the Library: a straight line cannot get there.
    let state = createBodyState((library.minX + library.maxX) / 2, library.maxZ + 1.2, 0, island);
    state = walkTo(state, (library.minX + library.maxX) / 2, library.minZ - 2, island);
    expect(state.goal).not.toBeNull();
    for (let i = 0; i < 60 * 6; i += 1) state = stepBody(state, NO_INPUT, 0, 1 / 60, island).state;
    expect(state.goal).toBeNull();
    expect(state.speed).toBeLessThan(0.02);
  });
});

describe("the walk reads as walking", () => {
  it("turns to face where it is going, smoothly", () => {
    let state = createBodyState(0, 8.4, 0, bare);
    // Sent off along +x: the facing swings round to it rather than snapping.
    const turns: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      state = stepBody(state, { forward: 0, strafe: 1 }, TOWARD_Z, 1 / 60, bare).state;
      turns.push(state.yaw);
    }
    // The heading that points along +x, in three.js's `rotation.y` sense.
    const wanted = Math.atan2(1, 0);
    expect(turns[0]).not.toBeCloseTo(wanted, 2);
    expect(turns[turns.length - 1]).toBeCloseTo(wanted, 2);
    // Every step is a small one: no snap.
    for (let i = 1; i < turns.length; i += 1) expect(Math.abs(turns[i]! - turns[i - 1]!)).toBeLessThan(0.3);
  });

  it("takes a step about every stride's length, and drops a foot when it does", () => {
    let state = createBodyState(0, 8.4, 0, bare);
    let feet = 0, distance = 0;
    for (let i = 0; i < 60 * 8; i += 1) {
      const before = state;
      const frame = stepBody(state, { forward: 1, strafe: 0 }, TOWARD_Z, 1 / 60, bare);
      state = frame.state;
      distance += Math.hypot(state.x - before.x, state.z - before.z);
      if (frame.footfall) feet += 1;
    }
    expect(feet).toBeGreaterThan(1);
    // One footfall per half-stride of travel, give or take the first stride.
    expect(Math.abs(feet - Math.floor(distance / STRIDE))).toBeLessThanOrEqual(2);
  });

  it("reads the keys relative to where the camera stands", () => {
    // The eye sits at target + r·(sin θ, …, cos θ), so it looks back along
    // (−sin θ, −cos θ) — which is where W has to go, whichever way it is swung.
    for (const theta of [0, 0.7, Math.PI / 2, Math.PI, -2.1]) {
      const basis = cameraBasis(theta);
      expect(basis.fx).toBeCloseTo(-Math.sin(theta), 12);
      expect(basis.fz).toBeCloseTo(-Math.cos(theta), 12);
      // Right is forward turned a quarter clockwise, and a unit long.
      expect(Math.hypot(basis.rx, basis.rz)).toBeCloseTo(1, 12);
      expect(basis.fx * basis.rx + basis.fz * basis.rz).toBeCloseTo(0, 12);
    }
    // W with the camera on the gate side walks away from the eye.
    const away = stepBody(createBodyState(0, 8.4, 0, bare), { forward: 1, strafe: 0 }, 0, 0.5, bare).state;
    expect(away.z).toBeLessThan(8.4);
  });

  it("leaves prints from a fixed pool and never allocates while walking", () => {
    const prints = createFootprints("#6b5a44");
    expect(prints.group.children).toHaveLength(FOOTPRINT_POOL);
    for (let i = 0; i < FOOTPRINT_POOL * 3; i += 1) prints.drop(i * 0.1, 0, 0, 0, i % 2 === 0);
    expect(prints.group.children).toHaveLength(FOOTPRINT_POOL);
    expect(prints.fade(0.1)).toBe(true);
    expect(prints.fade(FOOTPRINT_LIFE + 1)).toBe(false);
    // Faded away, they ask for nothing.
    expect(prints.fade(1)).toBe(false);
    prints.dispose();
  });
});

describe("the follow camera", () => {
  const subjectAt = (x: number, z: number, yaw: number, speed = WALK_SPEED) => ({ x, y: 0.4, z, yaw, speed });
  function settle(follow: ReturnType<typeof createFollowCamera>, seconds = 4) {
    for (let i = 0; i < Math.round(seconds * 60); i += 1) follow.tick(1 / 60);
  }
  const camera = () => new THREE.PerspectiveCamera(42, 1.6, 0.1, 220);

  it("stands behind the body and looks at it", () => {
    for (const yaw of [0, 0.9, Math.PI / 2, -2.4, Math.PI]) {
      const follow = createFollowCamera({ camera: camera(), composition: "desktop", reduced: false });
      follow.setSubject(subjectAt(3, -4, yaw));
      follow.snap();
      settle(follow);
      const pose = follow.pose(), eye = follow.eye();
      // Behind: the eye is on the opposite side of the body from its facing.
      const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const toEye = { x: eye[0] - pose.target[0], z: eye[2] - pose.target[2] };
      const reach = Math.hypot(toEye.x, toEye.z);
      expect((toEye.x * forward.x + toEye.z * forward.z) / reach).toBeLessThan(-0.99);
      // And it is looking at the body, at the follow distance.
      expect(pose.target[0]).toBeCloseTo(3, 3);
      expect(pose.target[2]).toBeCloseTo(-4, 3);
      expect(pose.r).toBeCloseTo(FOLLOW_DISTANCE.desktop, 2);
    }
  });

  it("trails the body rather than snapping to it", () => {
    const follow = createFollowCamera({ camera: camera(), composition: "desktop", reduced: false });
    follow.setSubject(subjectAt(0, 0, 0));
    follow.snap();
    // The body jumps four units away: the camera is still catching up a frame later.
    follow.setSubject(subjectAt(0, 4, 0));
    follow.tick(1 / 60);
    expect(follow.pose().target[2]).toBeGreaterThan(0);
    expect(follow.pose().target[2]).toBeLessThan(4);
    settle(follow);
    expect(follow.pose().target[2]).toBeCloseTo(4, 3);
  });

  it("orbits with a drag — the same pixels on a desktop and a phone — and settles back behind you as you walk", () => {
    const desktop = createFollowCamera({ camera: camera(), composition: "desktop", reduced: false });
    const phone = createFollowCamera({ camera: camera(), composition: "phone", reduced: false });
    for (const follow of [desktop, phone]) { follow.setSubject(subjectAt(0, 0, 0)); follow.snap(); follow.drag(120, 0); }
    // A standing product rule: a drag of 120 px turns the same amount either way.
    expect(desktop.offset()).toBeCloseTo(phone.offset(), 12);
    expect(Math.abs(desktop.offset())).toBeGreaterThan(0.5);
    // Standing still, the view you chose is the view you keep.
    desktop.setSubject(subjectAt(0, 0, 0, 0));
    settle(desktop, 3);
    expect(Math.abs(desktop.offset())).toBeGreaterThan(0.4);
    // Walking, it gives itself back and the camera settles behind you again.
    desktop.setSubject(subjectAt(0, 0, 0, WALK_SPEED));
    settle(desktop, 10);
    expect(Math.abs(desktop.offset())).toBeLessThan(0.08);
  });

  it("latches the heading a key is read against while a direction is held", () => {
    // The loop this prevents: the body turns to face its travel, the camera
    // turns to face the body, "forward" turns with it — and you walk in a slow
    // circle. While a key is held the basis does not move; the camera does.
    const follow = createFollowCamera({ camera: camera(), composition: "desktop", reduced: false });
    follow.setSubject(subjectAt(0, 0, 0, WALK_SPEED));
    follow.snap();
    follow.drag(200, 0);
    follow.setSteering(true);
    const latched = follow.basis();
    settle(follow, 3);
    // The camera swung round behind the body; the basis stayed exactly put.
    expect(follow.basis()).toBeCloseTo(latched, 12);
    expect(Math.abs(follow.pose().theta - latched)).toBeGreaterThan(0.2);
    // The key comes up and the basis is what you can see again.
    follow.setSteering(false);
    expect(follow.basis()).toBeCloseTo(follow.pose().theta, 12);
  });

  it("pinches and wheels in log-radius, and is held between a shoulder and the sky", () => {
    const follow = createFollowCamera({ camera: camera(), composition: "desktop", reduced: false });
    follow.setSubject(subjectAt(0, 0, 0)); follow.snap();
    for (let i = 0; i < 60; i += 1) follow.zoom(-0.3);
    settle(follow);
    expect(follow.pose().r).toBeCloseTo(FOLLOW_MIN_R, 2);
    for (let i = 0; i < 120; i += 1) follow.zoom(0.3);
    settle(follow);
    expect(follow.pose().r).toBeCloseTo(FOLLOW_MAX_R, 2);
  });

  it("cuts rather than swings under reduced motion, and never puts the eye under the ground", () => {
    const cut = createFollowCamera({ camera: camera(), composition: "desktop", reduced: true, groundHeightAt });
    cut.setSubject(subjectAt(0, 0, 0)); cut.snap();
    cut.setSubject(subjectAt(0, 6, 0));
    // One tick and it is already there: no easing, and nothing left to schedule.
    expect(cut.tick(1 / 60)).toBe(false);
    expect(cut.pose().target[2]).toBeCloseTo(6, 6);

    const lifted = createFollowCamera({ camera: camera(), composition: "desktop", reduced: false, groundHeightAt });
    // Out on the shore, tilted almost flat: the eye is still above the sand.
    lifted.setSubject({ x: 0, y: groundHeightAt(0, 19) + 0.45, z: 19, yaw: 0, speed: 0 });
    lifted.drag(0, -600);
    lifted.snap();
    settle(lifted);
    const eye = lifted.eye();
    expect(eye[1]).toBeGreaterThan(groundHeightAt(eye[0], eye[2]));
  });
});

describe("the walker: one body, made by a factory", () => {
  it("can be made twice, with its own colours and its own spot — nothing here is a singleton", () => {
    const you = createWalker({ groundHeightAt, tier: "lite" });
    const them = createWalker({ groundHeightAt, tier: "lite", colours: { coat: "#9a4f55" }, start: { x: -3, z: 4 } });
    expect(you.group).not.toBe(them.group);
    expect(you.state().x).toBeCloseTo(COURT_ARRIVAL.x, 6);
    expect(them.state().x).toBeCloseTo(-3, 6);
    them.goTo(0, 0);
    expect(them.state().goal).not.toBeNull();
    expect(you.state().goal).toBeNull();
    you.dispose(); them.dispose();
  });

  it("stands on the ground, asks for no frames at rest, and reports its shoulders for the camera", () => {
    const one = createWalker({ groundHeightAt, tier: "lite", start: { x: 2, z: 11 } });
    expect(one.step(1 / 60, 0, 0)).toBe(false);
    expect(one.walking()).toBe(false);
    one.setInput({ forward: 1, strafe: 0 });
    expect(one.step(1 / 60, 0, TOWARD_Z)).toBe(true);
    const at = one.state();
    expect(at.y).toBeCloseTo(groundHeightAt(at.x, at.z), 12);
    expect(one.shoulders()[1]).toBeCloseTo(eyeHeight(at), 12);
    expect(one.shoulders()[1]).toBeGreaterThan(at.y);
    expect(one.shoulders()[1]).toBeLessThan(at.y + BODY_HEIGHT);
    one.dispose();
  });
});

describe("the frame policy, honestly extended", () => {
  const rest = { reduced: false, moving: false, breathing: false, touched: false, projectionChanged: false, hidden: false, toolOpen: false };
  it("runs the world at the camera's rate while a body walks", () => {
    expect(harbourFramePolicy({ ...rest, walking: true })).toEqual({ animate: true, render: true, schedule: true, intervalMs: CAMERA_INTERVAL_MS });
  });
  it("keeps walking under reduced motion, and still runs no ambient idle", () => {
    const reduced = harbourFramePolicy({ ...rest, walking: true, reduced: true });
    expect(reduced.render).toBe(true);
    expect(reduced.schedule).toBe(true);
    // The character walks; the Queen does not breathe.
    expect(reduced.animate).toBe(false);
  });
  it("asks for nothing the moment the body stands still", () => {
    expect(harbourFramePolicy({ ...rest, walking: false })).toEqual({ animate: false, render: false, schedule: false, intervalMs: 0 });
    expect(harbourFramePolicy({ ...rest, walking: true, hidden: true })).toEqual({ animate: false, render: false, schedule: false, intervalMs: 0 });
  });
});

/** The Court, as small as a test needs it: one anchor, one region, and a ground to tap. */
const anchorPlace: Place = {
  id: "court",
  build(scene) {
    const group = new THREE.Group();
    const rook = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial());
    rook.position.set(4.2, 1, -3.0); rook.userData.anchor = "rook";
    group.add(rook); scene.add(group);
    return {
      group, update() {}, animate() {}, dispose() { scene.remove(group); },
      anchors: () => [{ id: "rook", position: [4.2, 0, -3.0], zone: "court", label: "The Rook", door: { target: "loft-banks" } }],
      poses: () => ({}),
      regions: () => [],
    };
  },
};

describe("the keys drive the body, not the camera", () => {
  let world: HarbourRuntime | undefined;
  let host: HTMLDivElement;
  let frames: Map<number, FrameRequestCallback>;
  let serial: number, clock: number, width: number, height: number;
  let reducedMatches: boolean;

  beforeEach(() => {
    frames = new Map(); serial = 0; width = 1440; height = 800; clock = 10_000; reducedMatches = false; release.mockClear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal("matchMedia", () => ({ get matches() { return reducedMatches; }, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    host = document.createElement("div");
    document.body.append(host);
    host.getBoundingClientRect = () => ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  });
  afterEach(() => { world?.dispose(); world = undefined; host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function frame(advance = 34) {
    const pending = [...frames.values()]; frames.clear();
    clock += advance;
    pending.forEach((callback) => callback(clock));
  }
  function run(times: number, advance = 34) { for (let i = 0; i < times; i += 1) frame(advance); }

  it("raises a body in the Court and leaves the Look camera in charge until you move", () => {
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace });
    const body = world.body();
    expect(body).not.toBeNull();
    expect(body!.following()).toBe(false);
    expect(host.dataset.harbourBody).toBe("standing");
    expect(body!.at().x).toBeCloseTo(COURT_ARRIVAL.x, 6);
  });

  it("walks a straight line while a direction is held, not a circle", () => {
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace });
    const body = world.body()!;
    const before = body.at();
    body.input({ forward: 1, strafe: 0 });
    const path: { x: number; z: number }[] = [];
    for (let i = 0; i < 40; i += 1) { frame(34); path.push({ x: body.at().x, z: body.at().z }); }
    const last = path[path.length - 1]!;
    const travelled = Math.hypot(last.x - before.x, last.z - before.z);
    // A second and a bit at a walk is well over a unit of ground covered — and
    // it is covered in a line, so the distance and the displacement agree.
    expect(travelled).toBeGreaterThan(1.4);
    let along = 0;
    for (let i = 1; i < path.length; i += 1) along += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
    expect(travelled / along).toBeGreaterThan(0.93);
  });

  it("walks the body, and leaves the Look camera's own target where it was", () => {
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace });
    const body = world.body()!;
    const before = body.at();
    const target = [...world.pose().target];
    body.input({ forward: 1, strafe: 0 });
    run(30);
    const after = body.at();
    // The body moved.
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.5);
    // And the camera's target was never panned: W A S D is not a camera pan any more.
    expect([...world.pose().target]).toEqual(target);
    // The follow camera took over the moment it moved.
    expect(body.following()).toBe(true);
    expect(host.dataset.harbourBody).toBe("following");
  });

  it("comes back to rest: the body stops, and the world stops asking for frames", () => {
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace });
    // The test place has nothing that breathes; only the walk should keep frames coming.
    world.setBreathing(false);
    const body = world.body()!;
    body.input({ forward: 1, strafe: 0 });
    run(20);
    expect(body.walking()).toBe(true);
    expect(frames.size).toBeGreaterThan(0);
    body.input({ forward: 0, strafe: 0 });
    run(80);
    expect(body.walking()).toBe(false);
    // Nothing is moving, so nothing is queued: the island sleeps again.
    expect(frames.size).toBe(0);
  });

  it("walks to a tap on the open ground, and hands the view back on request", () => {
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace });
    const body = world.body()!;
    const before = body.at();
    body.goTo(before.x - 3, before.z - 3);
    run(40);
    const after = body.at();
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);
    expect(body.following()).toBe(true);
    body.follow(false);
    expect(body.following()).toBe(false);
    expect(host.dataset.harbourBody).toBe("standing");
  });

  it("raises a fresh body in a room off the island, and puts you down at its own way in", () => {
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace });
    expect(world.body()).not.toBeNull();
    // The Tower is up a stair: somewhere else, so the Court's body is put away
    // and the Tower raises one of its own on the landing.
    world.enter("tower", { from: "court", reduced: true });
    const upstairs = world.body();
    expect(upstairs).not.toBeNull();
    expect(host.dataset.harbourBody).toBe("standing");
    const stood = upstairs!.at();
    // On the landing (floor 0 at y = 0), a step inside the stair, not out on the island.
    expect(stood.y).toBeCloseTo(0, 6);
    expect(Math.hypot(stood.x, stood.z)).toBeLessThan(TOWER_LAYOUT.radius);
    world.enter("court", { from: "tower", reduced: true });
    expect(world.body()).not.toBeNull();
    // Back on the island's own profile, not a room's flat floor.
    expect(world.body()!.at().y).toBeCloseTo(TERRACE_LEVEL, 6);
  });

  it("never lets your own body swallow a tap meant for a door", () => {
    const taps: string[] = [];
    world = mountHarbourWorld(host, "classic", "lite", {
      onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace,
      onTap: (hit) => taps.push(hit.kind === "anchor" ? hit.id : hit.kind),
    });
    const body = world.body()!;
    // Stand the body right in front of the Rook, then frame the Rook and tap it.
    body.place(4.2, -3.0);
    world.go("object", "rook");
    run(30);
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
      Object.defineProperty(event, "pointerId", { value: 1 });
      host.dispatchEvent(event);
    };
    pointer("pointerdown", width / 2, height / 2);
    pointer("pointerup", width / 2, height / 2);
    // The tap reached the door, not the coat standing in front of it.
    expect(taps).toEqual(["rook"]);
  });
});

describe("what a body may never do", () => {
  it("writes no money and reads no storage", () => {
    // The trust boundary is absolute, and a character does not move it.
    const sources = [
      "body/bodyModel.ts", "body/obstacles.ts", "body/figure.ts", "body/footprints.ts", "body/walker.ts", "camera/followCamera.ts",
    ];
    for (const name of sources) {
      const source = readFileSync(`src/harbour/${name}`, "utf8");
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(/);
      expect(source).not.toMatch(/postEntry|postShift|commitCommand|acceptHouseholdWrite/);
      // The hard rule: the renderer lease owns the loop.
      expect(source).not.toMatch(/requestAnimationFrame\s*\(/);
    }
  });
});
