// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  PLACED_PLACE_IDS, PLACES, PLACE_HOLDS, PLACE_PLACEMENTS, PLACEMENT_SILL, SCENE_DRESSING, STREAM_MARGIN, STREAM_RELEASE,
  atThreshold, insidePlacement, placedHold, placedPose, placementDoor, placementLift, placementOf, placementReach,
  placementToWorld, streamInRadius, streamOutRadius, streamPlaces, type PlacePlacement,
} from "../src/harbour/scene/place.ts";
import { groundHeightAt } from "../src/harbour/scene/ground.ts";
import { holdPoseInRoom, type CourtPose } from "../src/harbour/camera/poses.ts";
import { HARBOUR_LANDMARKS, HARBOUR_PLACE_LEVELS, HARBOUR_PLACE_NAMES, HARBOUR_PLACE_ROOMS, type HarbourPlaceId } from "../src/harbour/flag.ts";
import { mountHarbourWorld, type HarbourRuntime } from "../src/harbour/scene/runtime.ts";
import "../src/harbour/court/CourtScene.ts";
import "../src/harbour/kiln/KilnScene.ts";
import "../src/harbour/cottage/CottageScene.ts";
import "../src/harbour/library/LibraryScene.ts";
import "../src/harbour/tower/TowerScene.ts";

vi.mock("../src/house/world/rendererOwner.ts", () => ({
  acquireWorldRenderer: () => ({
    active: true,
    renderer: { render: vi.fn(), setSize: vi.fn(), info: { render: { calls: 0 }, memory: { geometries: 0, textures: 0 } } },
    requestFrame: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
    cancelFrame: (id: number) => cancelAnimationFrame(id),
    listenCanvas: () => () => undefined,
    release: () => undefined,
  }),
}));

const ALL_PLACES = Object.keys(HARBOUR_PLACE_NAMES) as HarbourPlaceId[];
const PLACED: HarbourPlaceId[] = ["library", "cottage", "kiln"];
const UNPLACED = ALL_PLACES.filter((id) => !PLACED.includes(id));

/* ── 1. The placement is the Court's own spot, not a second opinion ────────── */

describe("a place's placement is its exterior's spot", () => {
  const court = readFileSync(join(process.cwd(), "src/harbour/court/CourtScene.ts"), "utf8");
  /** The Court stands each building from a `const NAME: readonly [number, number] = [x, z];` and a `rotation.y = …`. */
  const spotIn = (constant: string): [number, number] => {
    const found = new RegExp(`${constant}\\s*:\\s*readonly \\[number, number\\] = \\[(-?[\\d.]+), (-?[\\d.]+)\\]`).exec(court);
    expect(found, `${constant} in CourtScene.ts`).not.toBeNull();
    return [Number(found![1]), Number(found![2])];
  };
  const yawIn = (constant: string, plus: boolean): number => {
    const [x, z] = spotIn(constant);
    // The Court's own expression, character for character:
    //   rotation.y = Math.atan2(-SPOT[0], -SPOT[1])  (+ Math.PI)
    const source = new RegExp(`rotation\\.y = Math\\.atan2\\(-${constant}\\[0\\], -${constant}\\[1\\]\\)${plus ? " \\+ Math\\.PI" : "(?! \\+)"}`);
    expect(source.test(court), `${constant} rotation in CourtScene.ts`).toBe(true);
    return Math.atan2(-x, -z) + (plus ? Math.PI : 0);
  };

  it("stands the Library, the Cottage and the Kiln exactly where the Court stands their shells", () => {
    expect(PLACE_PLACEMENTS.library!.spot).toEqual(spotIn("LIBRARY_SPOT"));
    expect(PLACE_PLACEMENTS.cottage!.spot).toEqual(spotIn("HERCULES_COTTAGE"));
    expect(PLACE_PLACEMENTS.kiln!.spot).toEqual(spotIn("KILN_SPOT"));
    expect(PLACE_PLACEMENTS.library!.yaw).toBeCloseTo(yawIn("LIBRARY_SPOT", false), 12);
    expect(PLACE_PLACEMENTS.cottage!.yaw).toBeCloseTo(yawIn("HERCULES_COTTAGE", false), 12);
    expect(PLACE_PLACEMENTS.kiln!.yaw).toBeCloseTo(yawIn("KILN_SPOT", false), 12);
  });

  /**
   * Every building's door faces the Court. A shell's door is modelled on its
   * +z face, and a yaw of `atan2(-x, -z)` turns +z toward the origin — so the
   * test is simply that the turned +z points back down the line to the Court,
   * for every building the Court stands, not only the placed three. A `+ π`
   * anywhere in that list points a door at the sea, which is what it used to do
   * for the Library, the Kitchen's cottage, the Kiln and the Boathouse.
   */
  it("turns every building's door toward the Court", () => {
    const shells: [string, string][] = [
      ["LIBRARY_SPOT", "library-hall"], ["COTTAGE_SPOT", "kitchen-cottage"], ["HERCULES_COTTAGE", "hercules-cottage"],
      ["KILN_SPOT", "kiln-house"], ["BOATHOUSE", "boathouse"],
    ];
    for (const [constant, name] of shells) {
      const [x, z] = spotIn(constant);
      const yaw = yawIn(constant, false);
      // The door's own normal, the shell's +z turned by the yaw.
      const normal = [Math.sin(yaw), Math.cos(yaw)] as const;
      const toCourt = [-x / Math.hypot(x, z), -z / Math.hypot(x, z)] as const;
      expect(normal[0] * toCourt[0] + normal[1] * toCourt[1], `${name}'s door faces the Court`).toBeCloseTo(1, 9);
    }
  });

  it("names the exterior shell the Court builds, so the two can never be drawn at once", () => {
    for (const id of PLACED) {
      const placement = PLACE_PLACEMENTS[id]!;
      expect(court).toContain(`.name = "${placement.exterior}"`);
    }
  });

  it("takes each room's doorway and footprint from the room's own layout", async () => {
    const { LIBRARY_LAYOUT } = await import("../src/harbour/library/LibraryScene.ts");
    const { COTTAGE_LAYOUT } = await import("../src/harbour/cottage/CottageScene.ts");
    const { KILN_LAYOUT } = await import("../src/harbour/kiln/KilnScene.ts");
    const pairs = [[PLACE_PLACEMENTS.library!, LIBRARY_LAYOUT], [PLACE_PLACEMENTS.cottage!, COTTAGE_LAYOUT], [PLACE_PLACEMENTS.kiln!, KILN_LAYOUT]] as const;
    for (const [placement, layout] of pairs) {
      expect(placement.halfWidth).toBe(layout.halfWidth);
      expect(placement.halfDepth).toBe(layout.halfDepth);
      expect(placement.door).toEqual([layout.door[0], layout.door[1], layout.door[2]]);
    }
  });

  it("lifts every placed floor clear of the highest island under it", () => {
    for (const id of PLACED) {
      const placement = PLACE_PLACEMENTS[id]!;
      const lift = placementLift(placement);
      const cos = Math.cos(placement.yaw), sin = Math.sin(placement.yaw);
      for (const [lx, lz] of [[0, 0], [-placement.halfWidth, -placement.halfDepth], [placement.halfWidth, placement.halfDepth], [placement.halfWidth, -placement.halfDepth], [-placement.halfWidth, placement.halfDepth]] as const) {
        const x = placement.spot[0] + lx * cos + lz * sin, z = placement.spot[1] + lz * cos - lx * sin;
        expect(lift).toBeGreaterThanOrEqual(groundHeightAt(x, z) + PLACEMENT_SILL - 1e-9);
      }
    }
  });

  it("puts a doorway on the island where the building's own door faces", () => {
    for (const id of PLACED) {
      const placement = PLACE_PLACEMENTS[id]!;
      const door = placementDoor(placement);
      expect(atThreshold(placement, door[0], door[2])).toBe(true);
      // A step outside the doorway's own radius is not an arrival.
      expect(atThreshold(placement, door[0] + placement.doorRadius + 0.5, door[2])).toBe(false);
      // The doorway is on the room's +z wall, which is the wall the Court's shell puts its door on.
      expect(placement.door[2]).toBeGreaterThan(0);
    }
  });
});

/* ── 2. Streaming, with hysteresis ────────────────────────────────────────── */

describe("streamPlaces", () => {
  const kiln = PLACE_PLACEMENTS.kiln!;
  /** A point `d` from a placement's spot, straight along +x. */
  const away = (placement: PlacePlacement, d: number): [number, number] => [placement.spot[0] + d, placement.spot[1]];
  const actions = (focus: [number, number], resident: HarbourPlaceId[], keep: HarbourPlaceId[] = []) =>
    streamPlaces(focus, resident, keep).map((step) => `${step.id}:${step.action}`);

  it("keeps the in radius inside the out radius, so the two can never meet", () => {
    for (const id of PLACED_PLACE_IDS) {
      const placement = PLACE_PLACEMENTS[id]!;
      expect(streamInRadius(placement)).toBe(placementReach(placement) + STREAM_MARGIN);
      expect(streamOutRadius(placement)).toBe(streamInRadius(placement) + STREAM_RELEASE);
      expect(streamOutRadius(placement)).toBeGreaterThan(streamInRadius(placement));
      // The building itself always fits well inside the radius that builds it.
      expect(streamInRadius(placement)).toBeGreaterThan(placementReach(placement));
    }
  });

  it("builds a placed interior when the viewer comes near and lets it go when they are well away", () => {
    expect(actions(away(kiln, streamInRadius(kiln) - 0.1), [])).toContain("kiln:raise");
    expect(actions(away(kiln, streamOutRadius(kiln) + 0.1), ["kiln"])).toContain("kiln:release");
  });

  it("does not thrash: walking back and forth across one threshold changes nothing", () => {
    const inside = streamInRadius(kiln), outside = streamOutRadius(kiln);
    // Just outside the build radius, already standing: the band holds it up.
    for (const d of [inside + 0.01, inside + 1, outside - 0.01]) {
      expect(actions(away(kiln, d), ["kiln"])).toEqual([]);
    }
    // Just inside the release radius, not standing: the band keeps it down.
    for (const d of [outside - 0.01, inside + 0.01]) {
      expect(actions(away(kiln, d), [])).toEqual([]);
    }
  });

  it("never lets go of the place you are in, or the one a journey is still leaving", () => {
    const far = away(kiln, streamOutRadius(kiln) + 40);
    expect(actions(far, ["kiln"], ["kiln"])).toEqual([]);
    expect(actions(far, ["kiln"], [])).toEqual(["kiln:release"]);
  });

  it("leaves the Court's own centre with no interior standing — the Court alone pays for the Court", () => {
    expect(streamPlaces([0, 0], [])).toEqual([]);
    for (const id of PLACED_PLACE_IDS) {
      const placement = PLACE_PLACEMENTS[id]!;
      const fromCourt = Math.hypot(placement.spot[0], placement.spot[1]);
      // Never built from the Court's centre …
      expect(fromCourt).toBeGreaterThan(streamInRadius(placement));
      // … and, having been built, let go again the moment you are back there.
      expect(fromCourt).toBeGreaterThan(streamOutRadius(placement));
    }
    expect(streamPlaces([0, 0], [...PLACED_PLACE_IDS]).map((s) => s.action)).toEqual(PLACED_PLACE_IDS.map(() => "release"));
  });

  it("stands the Kiln and the Cottage together from the lawn between them", () => {
    const kiln = PLACE_PLACEMENTS.kiln!, cottage = PLACE_PLACEMENTS.cottage!;
    const between: [number, number] = [(kiln.spot[0] + cottage.spot[0]) / 2, (kiln.spot[1] + cottage.spot[1]) / 2];
    expect(actions(between, [])).toEqual(["cottage:raise", "kiln:raise"]);
  });

  it("says nothing at all about the eight places that declare no placement", () => {
    expect([...PLACED_PLACE_IDS].sort()).toEqual([...PLACED].sort());
    for (const id of UNPLACED) {
      expect(placementOf(id)).toBeNull();
      expect(streamPlaces([0, 0], [id]).map((s) => s.id)).not.toContain(id);
    }
  });
});

/* ── 3. Holds follow the transform; the unplaced ones are untouched ───────── */

describe("a placed room's hold", () => {
  it("gives an unplaced place its own box back, identically", () => {
    for (const id of UNPLACED) {
      const hold = PLACE_HOLDS[id];
      expect(placedHold(hold, placementOf(id))).toBe(hold);
    }
    expect(placedHold(null, PLACE_PLACEMENTS.kiln!)).toBeNull();
  });

  it("moves onto the island with its building, and still contains the room it holds", () => {
    for (const id of PLACED) {
      const placement = PLACE_PLACEMENTS[id]!;
      const hold = placedHold(PLACE_HOLDS[id]!, placement)!;
      const lift = placementLift(placement);
      // Every corner of the room's own eye box is inside the moved envelope.
      const written = PLACE_HOLDS[id]!;
      for (const x of [written.eye.min[0], written.eye.max[0]]) for (const z of [written.eye.min[2], written.eye.max[2]]) {
        const [wx, , wz] = placementToWorld(placement, [x, 0, z]);
        expect(wx).toBeGreaterThanOrEqual(hold.eye.min[0] - 1e-9);
        expect(wx).toBeLessThanOrEqual(hold.eye.max[0] + 1e-9);
        expect(wz).toBeGreaterThanOrEqual(hold.eye.min[2] - 1e-9);
        expect(wz).toBeLessThanOrEqual(hold.eye.max[2] + 1e-9);
      }
      // Height moves with the floor; distance and tilt are the room's own and do not.
      expect(hold.eye.min[1]).toBeCloseTo(written.eye.min[1] + lift, 9);
      expect(hold.minR).toBe(written.minR);
      expect(hold.maxPhi).toBe(written.maxPhi);
      // And the envelope is centred on the building, not on the origin: the
      // room's own box centre, carried onto the island.
      const centre = placementToWorld(placement, [(written.eye.min[0] + written.eye.max[0]) / 2, 0, (written.eye.min[2] + written.eye.max[2]) / 2]);
      expect((hold.eye.min[0] + hold.eye.max[0]) / 2).toBeCloseTo(centre[0], 6);
      expect((hold.eye.min[2] + hold.eye.max[2]) / 2).toBeCloseTo(centre[2], 6);
      expect(Math.hypot(centre[0], centre[2])).toBeGreaterThan(8);
    }
  });

  it("holds a pose standing in the placed room, through the same holdPoseInRoom", () => {
    const placement = PLACE_PLACEMENTS.kiln!;
    const hold = placedHold(PLACE_HOLDS.kiln!, placement)!;
    const middle = placementToWorld(placement, [0, 1.4, 0]);
    const pose: CourtPose = { target: middle, r: 3.2, theta: placement.yaw, phi: 1.1 };
    const held = holdPoseInRoom(pose, hold);
    expect(held.target[0]).toBeCloseTo(middle[0], 9);
    expect(held.target[2]).toBeCloseTo(middle[2], 9);
    // A pose out on the Court's terrace is pulled back to the building. The
    // hold is a **soft** volume — the axis-aligned envelope of a room that is
    // not square to the island — so what it promises is that the eye is at the
    // building and not on the terrace, not that it is square to the walls.
    const stray = holdPoseInRoom({ target: [0, 1, 0], r: 12, theta: 0, phi: 1.1 }, hold);
    expect(Math.hypot(stray.target[0] - placement.spot[0], stray.target[2] - placement.spot[1])).toBeLessThan(placementReach(placement) * 1.5);
    // The Court's own terrace reaches six units; the held target is past it.
    expect(Math.hypot(stray.target[0], stray.target[2])).toBeGreaterThan(6);
    expect(insidePlacement(placement, middle[0], middle[2])).toBe(true);
  });

  it("leaves holdPoseInRoom itself exactly as it was for the unplaced places", () => {
    const pose: CourtPose = { target: [0, 1.2, 0], r: 3, theta: 0.2, phi: 1.1 };
    for (const id of UNPLACED) {
      const hold = PLACE_HOLDS[id];
      expect(holdPoseInRoom(pose, placedHold(hold, placementOf(id)))).toEqual(holdPoseInRoom(pose, hold));
    }
  });

  it("turns a pose written in the room's own words onto the island", () => {
    const placement = PLACE_PLACEMENTS.cottage!;
    const turned = placedPose({ target: [0, 1, 0] as const, r: 3, theta: 0, phi: 1.1 }, placement);
    expect(turned.theta).toBeCloseTo(placement.yaw, 9);
    expect(turned.target[0]).toBeCloseTo(placement.spot[0], 9);
    expect(turned.target[2]).toBeCloseTo(placement.spot[1], 9);
    expect(placedPose({ target: [0, 1, 0] as const, r: 3, theta: 0, phi: 1.1 }, null).target).toEqual([0, 1, 0]);
  });
});

/* ── 4. The world itself: streaming, doors and coherence ──────────────────── */

describe("the standing world", () => {
  let world: HarbourRuntime | null = null;
  let host: HTMLDivElement | null = null;
  const crossings: HarbourPlaceId[] = [];

  const mount = (): HarbourRuntime => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    host = document.createElement("div");
    host.getBoundingClientRect = () => ({ width: 1440, height: 900, top: 0, left: 0, right: 1440, bottom: 900, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.append(host);
    world = mountHarbourWorld(host, "classic", "lite", {
      onReady: () => undefined, onFailure: () => undefined,
      onThreshold: (place) => { crossings.push(place); },
      dressing: SCENE_DRESSING.classic,
    });
    return world;
  };

  afterEach(() => { world?.dispose(); world = null; host?.remove(); host = null; crossings.length = 0; vi.unstubAllGlobals(); });

  /** A named object anywhere in the standing scene — the Court's shells live in the Court's own group. */
  const named = (name: string): THREE.Object3D | null => {
    let found: THREE.Object3D | null = null;
    const root = world!.place().group.parent ?? world!.place().group;
    root.traverse((node) => { if (!found && node.name === name) found = node as THREE.Object3D; });
    return found;
  };
  const shell = named;

  it("stands in the Court with no interior resident, and builds one when the viewer walks over", () => {
    const runtime = mount();
    expect(runtime.placeId()).toBe("court");
    expect(runtime.resident()).toEqual([]);
    const kiln = PLACE_PLACEMENTS.kiln!;
    runtime.setFocus(kiln.spot[0], kiln.spot[1]);
    expect(runtime.resident()).toContain("kiln");
  });

  it("puts the interior where the building stands, and hides the shell that would be drawn twice", () => {
    const runtime = mount();
    const kiln = PLACE_PLACEMENTS.kiln!;
    expect(shell("kiln-house")?.visible).toBe(true);
    runtime.setFocus(kiln.spot[0], kiln.spot[1]);
    expect(shell("kiln-house")?.visible).toBe(false);
    // The interior's own root group carries the Court's spot and yaw.
    const group = named("kiln");
    expect(group).not.toBeNull();
    expect(group!.position.x).toBeCloseTo(kiln.spot[0], 9);
    expect(group!.position.z).toBeCloseTo(kiln.spot[1], 9);
    expect(group!.position.y).toBeCloseTo(placementLift(kiln), 9);
    expect(group!.rotation.y).toBeCloseTo(kiln.yaw, 9);
    // Walk well away: the room is let go and the shell comes back.
    runtime.setFocus(0, 0);
    expect(runtime.resident()).not.toContain("kiln");
    expect(shell("kiln-house")?.visible).toBe(true);
  });

  it("reports the doorway as a crossing, once, and the way back out as a return to the Court", () => {
    const runtime = mount();
    const kiln = PLACE_PLACEMENTS.kiln!;
    const door = placementDoor(kiln);
    runtime.setFocus(door[0], door[2]);
    expect(crossings).toEqual(["kiln"]);
    // Still inside: no second arrival.
    runtime.setFocus(kiln.spot[0], kiln.spot[1]);
    expect(crossings).toEqual(["kiln"]);
    // The route follows, exactly as a tap from across the lawn would make it.
    runtime.enter("kiln", { from: "court", threshold: true });
    expect(runtime.placeId()).toBe("kiln");
    // And out again.
    runtime.setFocus(0, 0);
    expect(crossings).toEqual(["kiln", "court"]);
  });

  it("does not tear a placed interior down when the route leaves it, and does tear an unplaced one down", () => {
    const runtime = mount();
    const kiln = PLACE_PLACEMENTS.kiln!;
    runtime.setFocus(kiln.spot[0], kiln.spot[1]);
    runtime.enter("kiln", { from: "court", threshold: true });
    expect(runtime.resident()).toContain("kiln");
    // Leaving by the route alone (a tap on the compass): the room stands until the streamer says otherwise.
    runtime.enter("court", { from: "kiln", reduced: true });
    expect(runtime.placeId()).toBe("court");
    expect(runtime.resident()).toContain("kiln");
    // An unplaced place is still disposed on the way out, exactly as before.
    runtime.enter("tower", { from: "court", reduced: true });
    expect(runtime.placeId()).toBe("tower");
    runtime.enter("court", { from: "tower", reduced: true });
    expect(runtime.placeId()).toBe("court");
    runtime.setFocus(0, 0);
    expect(runtime.resident()).toEqual([]);
  });

  it("builds each placed interior in turn, and lets the last one go behind you", () => {
    const runtime = mount();
    for (const id of PLACED) {
      const placement = PLACE_PLACEMENTS[id]!;
      runtime.setFocus(placement.spot[0], placement.spot[1]);
      expect(runtime.resident()).toContain(id);
      expect(shell(placement.exterior)?.visible).toBe(false);
    }
    // The Library is twenty units behind you by the time you reach the Kiln.
    expect(runtime.resident()).not.toContain("library");
    expect(shell("library-hall")?.visible).toBe(true);
  });

  it("comes back standing after the whole runtime is torn down and rebuilt (a theme or tier change)", () => {
    const kiln = PLACE_PLACEMENTS.kiln!;
    // Stand in the Kiln, then throw the world away the way `HarbourWorld.tsx`
    // does when the theme or the render tier changes.
    let runtime = mount();
    runtime.setFocus(kiln.spot[0], kiln.spot[1]);
    runtime.enter("kiln", { from: "court", threshold: true });
    expect(runtime.placeId()).toBe("kiln");
    world!.dispose(); host!.remove();
    crossings.length = 0;

    // The shell remounts with the place the route says, and the body puts the
    // focus back where it was.
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    host = document.createElement("div");
    host.getBoundingClientRect = () => ({ width: 1440, height: 900, top: 0, left: 0, right: 1440, bottom: 900, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.append(host);
    runtime = mountHarbourWorld(host, "taylor", "lite", {
      onReady: () => undefined, onFailure: () => undefined,
      onThreshold: (place) => { crossings.push(place); },
      place: PLACES.kiln, dressing: SCENE_DRESSING.taylor,
    });
    world = runtime;
    runtime.setFocus(kiln.spot[0], kiln.spot[1]);
    expect(runtime.placeId()).toBe("kiln");
    expect(runtime.resident()).toContain("kiln");
    // The island came back under it, and its shell is hidden again.
    expect(named("court")).not.toBeNull();
    expect(shell("kiln-house")?.visible).toBe(false);
    // Standing inside where you already were is not a fresh arrival: the shell
    // must not be sent navigating on a rebuild.
    expect(crossings).toEqual([]);
  });

  it("stands all three at once when the route is in one and the viewer is between the other two", () => {
    const runtime = mount();
    const library = PLACE_PLACEMENTS.library!, kiln = PLACE_PLACEMENTS.kiln!, cottage = PLACE_PLACEMENTS.cottage!;
    runtime.setFocus(library.spot[0], library.spot[1]);
    runtime.enter("library", { from: "court", threshold: true });
    expect(runtime.placeId()).toBe("library");
    // Out of the Library and across to the Making lawn without the route following.
    runtime.setFocus((kiln.spot[0] + cottage.spot[0]) / 2, (kiln.spot[1] + cottage.spot[1]) / 2);
    expect([...runtime.resident()].sort()).toEqual(["cottage", "kiln", "library"]);
    for (const id of PLACED) expect(shell(PLACE_PLACEMENTS[id]!.exterior)?.visible).toBe(false);
  });
});

/* ── 5. Nothing downstream can tell a walk from a tap ─────────────────────── */

describe("the flat edition and the compass stay whole", () => {
  it("still answers where you are and what you can do for every place, placed or not", async () => {
    const flat = readFileSync(join(process.cwd(), "src/harbour/flat/PlaceFlat.tsx"), "utf8");
    for (const id of ALL_PLACES) {
      // Being in a place is still the route's place: the flat edition is keyed on it and nothing else.
      expect(HARBOUR_PLACE_ROOMS[id]).toBeTruthy();
      expect(HARBOUR_PLACE_LEVELS[id]).toBeTruthy();
      expect(HARBOUR_PLACE_NAMES[id]).toBeTruthy();
    }
    for (const id of PLACED) expect(flat).toContain(`place === "${id}"`);
    // No placement leaks into the reading edition: it has no geometry to be wrong about.
    expect(flat).not.toMatch(/PLACE_PLACEMENTS|placementOf|setFocus/);
  });

  it("walks a crossing to the same room and level a tap on the building walks to", () => {
    const byExterior: Record<string, HarbourPlaceId> = { "library-hall": "library", "hercules-cottage": "cottage", "kiln-house": "kiln" };
    for (const id of PLACED) {
      const placement = PLACE_PLACEMENTS[id]!;
      const landmark = HARBOUR_LANDMARKS[placement.exterior];
      expect(landmark, placement.exterior).toBeTruthy();
      expect(byExterior[placement.exterior]).toBe(id);
      // The tap's route and the crossing's route are the same route.
      expect(landmark!.room).toBe(HARBOUR_PLACE_ROOMS[id]);
      expect(landmark!.level).toBe(HARBOUR_PLACE_LEVELS[id]);
    }
  });

  it("keeps the shell wiring that makes a crossing a route change and nothing more", () => {
    const shell = readFileSync(join(process.cwd(), "src/harbour/HarbourWorld.tsx"), "utf8");
    expect(shell).toMatch(/onThreshold/);
    expect(shell).toMatch(/onNavigateRef\.current\(HARBOUR_PLACE_ROOMS\[next\], HARBOUR_PLACE_LEVELS\[next\]\)/);
    // Still no money: the harbour reads and opens doors, it never writes.
    expect(shell).not.toMatch(/kitchenCommand|ledgerSync/);
  });
});
