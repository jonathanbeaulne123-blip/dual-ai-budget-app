// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HARBOUR_PLACE_NAMES, harbourWayFor, type HarbourPlaceId } from "../src/harbour/flag.ts";
import { mountHarbourWorld, type HarbourRuntime } from "../src/harbour/scene/runtime.ts";
import { PLACES, PLACE_HOLDS, PLACE_PLACEMENTS, SCENE_DRESSING, placedHold, placementDoor, placementLift, placementOf, placementToWorld, type Anchor, type Place } from "../src/harbour/scene/place.ts";
import { holdPoseInRoom, poseEye, type Composition, type RoomHold } from "../src/harbour/camera/poses.ts";
import { createFollowCamera, followInRoom, FOLLOW_DISTANCE } from "../src/harbour/camera/followCamera.ts";
import { BODY_RADIUS, doorWall, holdInRoom, inRoom, pushOut, type Obstacle, type RoomBounds } from "../src/harbour/body/obstacles.ts";
import { createBodyState, stepBody, type BodyWorld } from "../src/harbour/body/bodyModel.ts";
import {
  EXIT_REACH, OPEN_AIR, PLACE_FLOOR, PLACE_HAZARDS, exitAnchors, followHoldIn,
  placeArrival, placeGround, placeObstacles, placeRoom, roomReach, walksIndoors,
} from "../src/harbour/body/places.ts";
import { groundHeightAt, TERRACE_LEVEL } from "../src/harbour/scene/ground.ts";
import { harbourFramePolicy } from "../src/harbour/scene/framePolicy.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import { BOATHOUSE_LAYOUT } from "../src/harbour/boathouse/BoathouseScene.ts";
import { TOWER_LAYOUT } from "../src/harbour/tower/TowerScene.ts";
// Importing a place registers it; every test below walks all eleven.
import "../src/harbour/court/CourtScene.ts";
import "../src/harbour/tower/TowerScene.ts";
import "../src/harbour/cellar/CellarScene.ts";
import "../src/harbour/glasshouse/GlasshouseScene.ts";
import "../src/harbour/kitchen/KitchenScene.ts";
import "../src/harbour/boathouse/BoathouseScene.ts";
import "../src/harbour/library/LibraryScene.ts";
import "../src/harbour/cottage/CottageScene.ts";
import "../src/harbour/kiln/KilnScene.ts";
import "../src/harbour/campfire/CampfireScene.ts";
import "../src/harbour/atlas/AtlasScene.ts";

/**
 * **Walk everywhere.**
 *
 * The character shipped Court-only: one condition in the shell
 * (`place === "court"`), and everywhere else W A S D fell through to a camera
 * pan that slid the look-at target while the stage's label said "W A S D
 * walk". This file is the proof that the gap is closed — a body in all eleven
 * places, walls that hold it, a camera that stays in the room, a way out of
 * each kind of room that is the same way out tapping the door already was, and
 * a world that goes back to asking for no frames when you stop.
 */

const release = vi.fn();
vi.mock("../src/house/world/rendererOwner.ts", () => ({
  acquireWorldRenderer: () => ({
    active: true,
    renderer: {
      render: vi.fn(), setSize: vi.fn(),
      domElement: { toDataURL: () => "" },
      info: { render: { calls: 0 }, memory: { geometries: 0, textures: 0 } },
    },
    requestFrame: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
    cancelFrame: (id: number) => cancelAnimationFrame(id),
    listenCanvas: () => () => undefined,
    release: (...args: unknown[]) => release(...args),
  }),
}));

const PLACE_IDS = Object.keys(HARBOUR_PLACE_NAMES) as HarbourPlaceId[];
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const reading = buildHarbourReading(household, household.members[0]!.id, today, "current");

/** A place, built once, off to the side: its anchors, its regions, its meshes. */
function built(id: HarbourPlaceId) {
  const scene = new THREE.Scene();
  const place: Place = PLACES[id]!;
  const handle = place.build(scene, SCENE_DRESSING.classic, reading, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => {} });
  return { scene, handle };
}

/** The place's own hold, moved onto the island with its building (what the runtime holds the camera with). */
const holdOf = (id: HarbourPlaceId): RoomHold | null => placedHold(PLACE_HOLDS[id] ?? null, placementOf(id));

/** The body's world for a place, exactly as the runtime assembles it. */
function worldFor(id: HarbourPlaceId): { world: BodyWorld; room: RoomBounds | null; anchors: Anchor[] } {
  const { handle } = built(id);
  const anchors = handle.anchors();
  const room = placeRoom(id, anchors);
  const world: BodyWorld = {
    groundHeightAt: placeGround(id),
    obstacles: placeObstacles(id, handle.regions(), anchors, "lite"),
    room,
  };
  handle.dispose();
  return { world, room, anchors };
}

describe("a body stands in every place, on that place's own floor", () => {
  it("names a floor for all eleven, and only the Court follows the island", () => {
    expect(Object.keys(PLACE_FLOOR).sort()).toEqual([...PLACE_IDS].sort());
    const islands = PLACE_IDS.filter((id) => PLACE_FLOOR[id] === null);
    expect(islands).toEqual(["court"]);
  });

  for (const id of PLACE_IDS) {
    it(`${id}: the floor the table names is a surface this place really laid`, () => {
      const floor = PLACE_FLOOR[id];
      if (floor === null) {
        // The Court is the island: its floor is the analytic profile itself.
        expect(placeGround("court")(0, 0)).toBeCloseTo(groundHeightAt(0, 0), 9);
        expect(placeGround("court")(12, 0)).toBeCloseTo(groundHeightAt(12, 0), 9);
        return;
      }
      const { handle } = built(id);
      const arrival = placeArrival(id, handle.anchors());
      const placement = placementOf(id);
      // The arrival spot in the place's **own** coordinates, which is what its
      // geometry is written in.
      const local = placement
        ? (() => { const cos = Math.cos(placement.yaw), sin = Math.sin(placement.yaw), dx = arrival.x - placement.spot[0], dz = arrival.z - placement.spot[1]; return { x: dx * cos - dz * sin, z: dz * cos + dx * sin }; })()
        : { x: arrival.x, z: arrival.z };
      const ray = new THREE.Raycaster(new THREE.Vector3(local.x, 1.4, local.z), new THREE.Vector3(0, -1, 0));
      handle.group.updateMatrixWorld(true);
      const hits = ray.intersectObject(handle.group, true).map((hit) => hit.point.y);
      // A surface at the height the table names is under the spot you arrive on.
      expect(hits.some((y) => Math.abs(y - floor) < 0.06), `${id} floor ${floor} not among [${hits.map((y) => y.toFixed(3)).join(", ")}]`).toBe(true);
      handle.dispose();
    });
  }

  it("lifts a placed room's floor onto the island, and keeps the Campfire's apron over it", () => {
    for (const id of ["library", "cottage", "kiln"] as const) {
      const placement = PLACE_PLACEMENTS[id]!;
      expect(placeGround(id)(placement.spot[0], placement.spot[1])).toBeCloseTo(placementLift(placement), 9);
      // One plane: the same height in every corner of the room.
      expect(placeGround(id)(placement.spot[0] + 3, placement.spot[1] - 2)).toBeCloseTo(placementLift(placement), 9);
    }
    // The shore's swept apron is over the island, never under it: on the
    // terrace the apron wins, and out on the lawn's hump the island does.
    expect(placeGround("campfire")(0, 0)).toBeCloseTo(0, 9);
    expect(groundHeightAt(0, 0)).toBeCloseTo(TERRACE_LEVEL, 9);
    expect(placeGround("campfire")(0, 12)).toBeCloseTo(groundHeightAt(0, 12), 9);
    expect(OPEN_AIR.has("campfire")).toBe(true);
    expect(walksIndoors("campfire")).toBe(false);
    expect(walksIndoors("court")).toBe(false);
    expect(PLACE_IDS.filter(walksIndoors).length).toBe(9);
  });

  it("stands you a step inside the way out, facing the room — never on the doorway itself", () => {
    for (const id of PLACE_IDS) {
      if (id === "court") continue;
      const { handle } = built(id);
      const anchors = handle.anchors();
      const arrival = placeArrival(id, anchors);
      const placement = placementOf(id);
      const door = placement
        ? { x: placementDoor(placement)[0], z: placementDoor(placement)[2] }
        : (() => { const exit = exitAnchors(anchors)[0]!; return { x: exit.position[0], z: exit.position[2] }; })();
      const gap = Math.hypot(arrival.x - door.x, arrival.z - door.z);
      // Clear of the way out's own reach, so arriving is never leaving.
      expect(gap, `${id} arrives ${gap.toFixed(2)} from its door`).toBeGreaterThan(EXIT_REACH + 0.35);
      handle.dispose();
    }
  });
});

describe("the walls hold the body in the room", () => {
  for (const id of PLACE_IDS) {
    if (id === "court") continue;
    it(`${id}: walking hard at every wall never puts you outside it`, () => {
      const { world, room, anchors } = worldFor(id);
      expect(room, `${id} has no floor`).not.toBeNull();
      const start = placeArrival(id, anchors);
      const gap = doorWall(room!);
      let escapes = 0;
      for (let i = 0; i < 24; i += 1) {
        const theta = (i / 24) * Math.PI * 2;
        let state = createBodyState(start.x, start.z, 0, world);
        // Eight seconds of leaning on one heading: long enough to cross any of
        // these rooms twice over. The walk stops the moment the body is out of
        // the walls, which is the moment the runtime hands the place over.
        for (let step = 0; step < 480 && inRoom(state.x, state.z, room!); step += 1) {
          state = stepBody(state, { forward: 1, strafe: 0, run: true }, theta, 1 / 60, world).state;
        }
        if (inRoom(state.x, state.z, room!)) continue;
        // The only way out is the doorway, and only a placed building has one.
        expect(gap, `${id} leaked through a wall at heading ${theta.toFixed(2)}`).not.toBeNull();
        const cos = Math.cos(room!.yaw), sin = Math.sin(room!.yaw);
        const dx = state.x - room!.x, dz = state.z - room!.z;
        const local = { x: dx * cos - dz * sin, z: dz * cos + dx * sin };
        const across = gap!.axis === "z" ? Math.abs(local.x - room!.door!.x) : Math.abs(local.z - room!.door!.z);
        expect(across, `${id} left the room away from its doorway`).toBeLessThanOrEqual(room!.door!.half + 1e-6);
        escapes += 1;
      }
      // A room with a doorway has one, and a room without one has none.
      if (gap) expect(escapes, `${id} has a doorway nobody can walk out of`).toBeGreaterThan(0);
      else expect(escapes).toBe(0);
    });
  }

  it("holds a body pressed into a corner, and lets a body already outside walk away", () => {
    const room: RoomBounds = { x: 0, z: 0, halfX: 3, halfZ: 2, yaw: 0, door: { x: 0, z: 2, half: 0.6 } };
    const corner = holdInRoom(9, 9, BODY_RADIUS, room);
    // Outside the walls: not this room's business, and never yanked back in.
    expect(corner).toEqual({ x: 9, z: 9, inside: false, wall: null });
    const pressed = holdInRoom(2.95, -1.98, BODY_RADIUS, room);
    expect(pressed.inside).toBe(true);
    expect(pressed.x).toBeCloseTo(3 - BODY_RADIUS, 9);
    expect(pressed.z).toBeCloseTo(-(2 - BODY_RADIUS), 9);
    // And straight at the doorway there is no wall at all.
    const through = holdInRoom(0.1, 1.99, BODY_RADIUS, room);
    expect(through.wall).toBeNull();
    expect(through.z).toBeCloseTo(1.99, 9);
  });

  it("collides in a placed room's own axes, not in an island-aligned envelope", () => {
    const placement = PLACE_PLACEMENTS.library!;
    // A metre-square thing in the middle of the room, as the room writes it.
    const regions = [{ id: "lectern", box: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1.4, 0.5)) }];
    const [solid] = placeObstacles("library", regions as never, [], "lite");
    expect(solid!.kind).toBe("obox");
    const centre = placementToWorld(placement, [0, 0, 0], 0);
    // A point just outside the turned box's corner is clear; an island-aligned
    // envelope of the same box would have swallowed it.
    const diagonal = 0.5 * Math.SQRT2;
    const off = pushOut(centre[0] + diagonal - 0.01, centre[2] + diagonal - 0.01, 0.01, [solid!]);
    expect(Math.hypot(off.x - (centre[0] + diagonal - 0.01), off.z - (centre[2] + diagonal - 0.01))).toBeLessThan(1e-9);
    // And a point inside it is pushed out, perpendicular to the room's own wall.
    const inside = pushOut(centre[0], centre[2], 0.01, [solid!]);
    expect(inside.hit).toBe("lectern");
  });

  it("keeps the Boathouse's slip in step with the deck it is cut into", () => {
    const { slip } = BOATHOUSE_LAYOUT;
    expect(PLACE_HAZARDS.boathouse).toEqual([
      { kind: "box", id: "slip", minX: -slip.halfWidth, maxX: slip.halfWidth, minZ: slip.fromZ, maxZ: slip.toZ },
    ]);
    const { world } = worldFor("boathouse");
    const ids = world.obstacles.map((o: Obstacle) => o.id);
    expect(ids).toContain("slip");
    // The way out is never solid: you have to reach the door you leave by.
    expect(ids).not.toContain("shore-door");
  });
});

describe("the camera stays in the room, with the body anywhere on its floor", () => {
  for (const id of PLACE_IDS) {
    if (id === "court") continue;
    for (const composition of ["desktop", "phone"] as Composition[]) {
      it(`${id} on ${composition}: every pose the follow camera can show is inside the hold`, () => {
        const hold = holdOf(id)!;
        const { room, anchors } = worldFor(id);
        const floor = placeRoom(id, anchors)!;
        const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 220);
        const follow = createFollowCamera({ camera, composition, reduced: false, groundHeightAt: placeGround(id) });
        follow.setHold(followHoldIn(hold, room));
        const reach = walksIndoors(id) ? roomReach(room) : null;
        follow.setPlan(reach === null ? null : followInRoom(reach, composition));
        const ground = placeGround(id);
        const cos = Math.cos(floor.yaw), sin = Math.sin(floor.yaw);
        // The extremes of the floor: every corner, every edge's middle, the centre.
        for (const [lx, lz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          const ex = lx * (floor.halfX - BODY_RADIUS), ez = lz * (floor.halfZ - BODY_RADIUS);
          const x = floor.x + ex * cos + ez * sin, z = floor.z + ez * cos - ex * sin;
          for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            follow.setSubject({ x, y: ground(x, z) + 0.45, z, yaw, speed: 0 });
            follow.snap();
            // A hand on the camera too: a drag and a zoom out, then look again.
            for (const [dx, dy, zoom] of [[0, 0, 0], [240, -120, 0.6], [-300, 160, -0.6]] as const) {
              follow.drag(dx, dy); follow.zoom(zoom);
              for (let i = 0; i < 90; i += 1) follow.tick(1 / 60);
              const eye = follow.eye();
              for (let axis = 0; axis < 3; axis += 1) {
                expect(eye[axis]!, `${id} ${composition} eye[${axis}] at (${x.toFixed(2)},${z.toFixed(2)})`).toBeGreaterThanOrEqual(hold.eye.min[axis]! - 1e-6);
                expect(eye[axis]!, `${id} ${composition} eye[${axis}] at (${x.toFixed(2)},${z.toFixed(2)})`).toBeLessThanOrEqual(hold.eye.max[axis]! + 1e-6);
              }
            }
          }
        }
      });
    }
  }

  it("stands the eye closer and higher indoors than under open sky, and never closer than a shoulder", () => {
    for (const composition of ["desktop", "phone"] as Composition[]) {
      for (const id of PLACE_IDS.filter(walksIndoors)) {
        const reach = roomReach(placeRoom(id, built(id).handle.anchors()))!;
        const plan = followInRoom(reach, composition);
        expect(plan.r, `${id} ${composition}`).toBeLessThan(FOLLOW_DISTANCE[composition]);
        expect(plan.r, `${id} ${composition}`).toBeGreaterThan(1.2);
        // `phi` is from vertical, so indoors is the smaller number: more from above.
        expect(plan.phi).toBeLessThan(1.06);
      }
    }
  });

  it("leaves the Court and the Campfire under open sky, held by nothing and no closer", () => {
    expect(placeRoom("court")).toBeNull();
    expect(followHoldIn(null, null)).toBeNull();
    expect(walksIndoors("campfire")).toBe(false);
    // The shore's own clearing still holds the body, but the camera keeps its distance.
    expect(placeRoom("campfire", built("campfire").handle.anchors())).not.toBeNull();
  });

  it("never moves `holdPoseInRoom` itself: an unheld pose comes back identical", () => {
    const pose = { target: [1, 2, 3] as const, r: 4, theta: 0.5, phi: 1.1 };
    expect(holdPoseInRoom(pose, null)).toBe(pose);
    const hold = holdOf("cellar")!;
    const inside = holdPoseInRoom({ target: [0, 1, 0], r: 2, theta: 0, phi: 1.2 }, hold);
    const eye = poseEye(inside);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(eye[axis]!).toBeGreaterThanOrEqual(hold.eye.min[axis]! - 1e-6);
      expect(eye[axis]!).toBeLessThanOrEqual(hold.eye.max[axis]! + 1e-6);
    }
  });
});

describe("the keys walk the body, and never the camera, wherever you stand", () => {
  it("has no camera pan left to fall through to", () => {
    const shell = readFileSync("src/harbour/HarbourWorld.tsx", "utf8");
    const runtime = readFileSync("src/harbour/scene/runtime.ts", "utf8");
    // The lie, in the two files that told it.
    expect(shell).not.toMatch(/kind:\s*"pan"/);
    expect(runtime).not.toMatch(/kind === "pan"/);
    expect(runtime).not.toMatch(/court\.pan\(/);
    // And the one condition that made walking Court-only.
    expect(shell).not.toMatch(/placeRef\.current !== "court" \|\| !runtime\.current\?\.body\(\)/);
  });

  it("says the same true thing on every stage, and names the Cellar's rail", async () => {
    const { stageWords } = await import("../src/harbour/HarbourWorld.tsx");
    for (const id of PLACE_IDS) {
      const words = stageWords(id, HARBOUR_PLACE_NAMES[id], false);
      expect(words, id).toMatch(/W A S D/);
      expect(words, id).toMatch(/walks? you around/);
      expect(words, id).toMatch(/Shift runs/);
      expect(words, id).not.toMatch(/orbit/);
    }
    expect(stageWords("cellar", HARBOUR_PLACE_NAMES.cellar, false)).toMatch(/left and right arrows walk the bill rail/);
    expect(stageWords("court", HARBOUR_PLACE_NAMES.court, false)).toMatch(/around the island/);
    expect(stageWords("campfire", HARBOUR_PLACE_NAMES.campfire, false)).toMatch(/around the fire/);
  });
});

describe("the runtime, standing in a room", () => {
  let host: HTMLDivElement;
  let world: HarbourRuntime | undefined;
  let frames: Map<number, FrameRequestCallback>;
  let serial: number, clock: number;
  let reducedMatches: boolean;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // jsdom has no 2D canvas; the engraved plates fall back to blank stone.
    frames = new Map(); serial = 0; clock = 10_000; reducedMatches = false; release.mockClear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal("matchMedia", () => ({ get matches() { return reducedMatches; }, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    host = document.createElement("div");
    document.body.append(host);
    host.getBoundingClientRect = () => ({ width: 1440, height: 800, left: 0, top: 0, right: 1440, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  });
  afterEach(() => { world?.dispose(); world = undefined; host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function run(times: number, advance = 34) {
    for (let i = 0; i < times; i += 1) {
      const pending = [...frames.values()]; frames.clear();
      clock += advance;
      pending.forEach((callback) => callback(clock));
    }
  }

  function mount(id: HarbourPlaceId, extra: Partial<Parameters<typeof mountHarbourWorld>[3]> = {}) {
    world = mountHarbourWorld(host, "classic", "lite", {
      onReady: vi.fn(), onFailure: vi.fn(), place: PLACES[id], reading, dressing: SCENE_DRESSING.classic, ...extra,
    });
    return world;
  }

  for (const id of PLACE_IDS) {
    it(`${id}: raises a body on this place's own floor from the first frame`, () => {
      const stage = mount(id);
      const body = stage.body();
      expect(body, `${id} raised no body`).not.toBeNull();
      expect(host.dataset.harbourBody).toBe("standing");
      const at = body!.at();
      expect(at.y, `${id} floor`).toBeCloseTo(placeGround(id)(at.x, at.z), 6);
      const room = placeRoom(id, stage.place().anchors());
      if (room) expect(inRoom(at.x, at.z, room), `${id} arrived outside its own floor`).toBe(true);
      // And the Look camera still has the view: the first screen is untouched.
      expect(body!.following()).toBe(false);
    });
  }

  for (const id of ["tower", "cellar", "library"] as const) {
    it(`${id}: a direction walks the body and leaves the Look camera's target where it was`, () => {
      const stage = mount(id);
      const body = stage.body()!;
      const before = body.at();
      const target = [...stage.pose().target];
      body.input({ forward: 1, strafe: 0 });
      run(25);
      const after = body.at();
      expect(Math.hypot(after.x - before.x, after.z - before.z), `${id} did not walk`).toBeGreaterThan(0.3);
      expect([...stage.pose().target]).toEqual(target);
      expect(body.following()).toBe(true);
      expect(host.dataset.harbourBody).toBe("following");
      // On this room's own floor the whole way, never the island's profile.
      expect(after.y).toBeCloseTo(placeGround(id)(after.x, after.z), 6);
    });
  }

  it("walking out of a placed room's doorway makes the Court's own route change", () => {
    const crossings: HarbourPlaceId[] = [];
    const stage = mount("library", { onThreshold: (next: HarbourPlaceId) => crossings.push(next) });
    const body = stage.body()!;
    run(2);
    expect(stage.placeId()).toBe("library");
    // Walk at the doorway: a point a stride outside it, on the island.
    const placement = PLACE_PLACEMENTS.library!;
    const out = placementToWorld(placement, [placement.door[0], 0, placement.door[2] + 2.2]);
    body.goTo(out[0], out[2]);
    run(140);
    expect(crossings).toContain("court");
    // And the body really is outside the walls it was standing in.
    const at = body.at();
    expect(inRoom(at.x, at.z, placeRoom("library", stage.place().anchors())!)).toBe(false);
  });

  it("walking to an unplaced room's stair fires the very anchor a tap on it fires", () => {
    const exits: Anchor[] = [];
    const stage = mount("cellar", { onExit: (anchor: Anchor) => exits.push(anchor) });
    const body = stage.body()!;
    run(2);
    const stair = exitAnchors(stage.place().anchors())[0]!;
    body.goTo(stair.position[0], stair.position[2]);
    run(120);
    expect(exits.map((anchor) => anchor.id)).toEqual(["stair"]);
    // The route a tap on that anchor takes — the same table, the same answer.
    expect(harbourWayFor(exits[0]!.id, exits[0]!.zone)).toBe("court");
  });

  it("every unplaced room's own way out leads somewhere the house already knows", () => {
    for (const id of PLACE_IDS) {
      if (id === "court" || placementOf(id)) continue;
      const { handle } = built(id);
      const ways = exitAnchors(handle.anchors());
      expect(ways.length, `${id} has no way out`).toBeGreaterThan(0);
      for (const way of ways) expect(harbourWayFor(way.id, way.zone), `${id} → ${way.id}`).toBeTruthy();
      handle.dispose();
    }
  });

  it("does not leave through a door it arrived at: the way out is armed by walking away first", () => {
    const exits: Anchor[] = [];
    const stage = mount("glasshouse", { onExit: (anchor: Anchor) => exits.push(anchor) });
    run(30);
    // Standing still on arrival, a step inside the garden door: nothing fires.
    expect(exits).toEqual([]);
    expect(stage.placeId()).toBe("glasshouse");
  });

  it("comes back to rest in a room: the body stops and the world stops asking for frames", () => {
    const stage = mount("library");
    stage.setBreathing(false);
    const body = stage.body()!;
    body.input({ forward: 1, strafe: 0 });
    run(15);
    expect(body.walking()).toBe(true);
    expect(frames.size).toBeGreaterThan(0);
    expect(harbourFramePolicy({ reduced: false, moving: false, breathing: false, touched: false, projectionChanged: false, hidden: false, toolOpen: false, walking: true }).schedule).toBe(true);
    body.input({ forward: 0, strafe: 0 });
    run(90);
    expect(body.walking()).toBe(false);
    expect(frames.size).toBe(0);
  });

  it("keeps the body walking under reduced motion, with the camera cutting", () => {
    reducedMatches = true;
    const stage = mount("kitchen");
    const body = stage.body()!;
    const before = body.at();
    body.input({ forward: 1, strafe: 0 });
    run(25);
    expect(Math.hypot(body.at().x - before.x, body.at().z - before.z)).toBeGreaterThan(0.3);
  });

  it("streams the island from the body's feet only where the body is on the island", () => {
    // Standing in the Tower — up a stair, off the island — the Tower's own
    // stair happens to sit where nothing of the island's is, and the streamer
    // must not read a room's coordinates as island coordinates.
    const stage = mount("tower");
    const body = stage.body()!;
    body.input({ forward: 1, strafe: 1 });
    run(40);
    expect(stage.resident()).toEqual([]);
    expect(Math.hypot(...stage.focus())).toBeLessThan(TOWER_LAYOUT.radius * 2);
  });
});
