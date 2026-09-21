// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  HARBOUR_CAMERA_SLOT_PREFIX, harbourCameraSlot, lidFor, roofFor, travelAt, travelEase, travelPlan,
  TRAVEL_BACK_MS, TRAVEL_UP_MS,
} from "../src/harbour/scene/travel.ts";
import { HARBOUR_PLACE_LEVELS, type HarbourPlaceId } from "../src/harbour/flag.ts";
import { mountHarbourWorld, scrubControls, scrubOf, type HarbourRuntime } from "../src/harbour/scene/runtime.ts";
import { PLACES, registerPlace, type Place, type PlaceHandle } from "../src/harbour/scene/place.ts";

/**
 * Little Harbour slice 2 · travel (BUILD_PLAN_SLICE2 §1). The plan is pure:
 * how long a journey takes, where the roof and the lid stand at each end, the
 * pose to arrive in, and that reduced motion is a cut with both already at
 * their end states. The runtime half proves the shape of it: both places live
 * for the length of the journey, the one you left is disposed at the end, one
 * renderer throughout, and each place keeps its own camera slot.
 */

const release = vi.fn();
const painted = vi.hoisted(() => ({ frames: 0 }));
vi.mock("../src/house/world/rendererOwner.ts", () => ({
  acquireWorldRenderer: () => ({
    active: true,
    renderer: { render: () => { painted.frames += 1; }, setSize: () => undefined, info: { render: { calls: 0 }, memory: { geometries: 0, textures: 0 } } },
    requestFrame: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
    cancelFrame: (id: number) => cancelAnimationFrame(id),
    listenCanvas: () => () => undefined,
    release: (...args: unknown[]) => release(...args),
  }),
}));

describe("travelPlan — the one shared motion", () => {
  it("lifts the tower's roof over 900 ms on the way up", () => {
    const plan = travelPlan("court", "tower", false);
    expect(plan.ms).toBe(TRAVEL_UP_MS);
    expect(plan.roof).toEqual([0, 1]);
    expect(plan.lid).toEqual([0, 0]);
    expect(plan.camera).toEqual({ mode: "court", anchor: null });
    expect(plan.rise).toBe(1);
    expect(plan.cut).toBe(false);
  });

  it("lifts the court's floor away as a lid on the way down", () => {
    const plan = travelPlan("court", "cellar", false);
    expect(plan.ms).toBe(TRAVEL_UP_MS);
    expect(plan.lid).toEqual([0, 1]);
    expect(plan.roof).toEqual([0, 0]);
    expect(plan.rise).toBe(-1);
  });

  it("comes back in 700 ms, framing the piece you came from", () => {
    const fromTower = travelPlan("tower", "court", false);
    expect(fromTower.ms).toBe(TRAVEL_BACK_MS);
    expect(fromTower.roof).toEqual([1, 0]);
    expect(fromTower.camera).toEqual({ mode: "object", anchor: "rook" });
    expect(fromTower.rise).toBe(-1);
    const fromCellar = travelPlan("cellar", "court", false);
    expect(fromCellar.ms).toBe(TRAVEL_BACK_MS);
    expect(fromCellar.lid).toEqual([1, 0]);
    expect(fromCellar.camera).toEqual({ mode: "object", anchor: "bishop" });
    expect(fromCellar.rise).toBe(1);
  });

  it("is total: any two places have a journey, and standing still is a cut", () => {
    const places: HarbourPlaceId[] = ["court", "tower", "cellar"];
    for (const from of places) for (const to of places) {
      const plan = travelPlan(from, to, false);
      expect(plan.roof[0]).toBe(roofFor(from === to ? to : from));
      expect(plan.roof[1]).toBe(roofFor(to));
      expect(plan.lid[1]).toBe(lidFor(to));
      expect(plan.ms).toBeGreaterThanOrEqual(0);
      if (from === to) { expect(plan.cut).toBe(true); expect(plan.ms).toBe(0); expect(plan.rise).toBe(0); }
    }
    // Level-to-level: the tower is above, the cellar below, the court between them.
    expect(HARBOUR_PLACE_LEVELS).toEqual({ court: "middle", tower: "above", cellar: "below", glasshouse: "above", kitchen: "middle", boathouse: "middle", library: "middle", cottage: "middle", kiln: "above", atlas: "above" });
    expect(travelPlan("tower", "cellar", false).rise).toBe(-1);
    expect(travelPlan("cellar", "tower", false).rise).toBe(1);
  });

  it("cuts under reduced motion, with the roof and the lid already at their end states", () => {
    for (const to of ["court", "tower", "cellar"] as HarbourPlaceId[]) {
      const plan = travelPlan("court", to, true);
      expect(plan.cut).toBe(true);
      expect(plan.ms).toBe(0);
      expect(plan.roof).toEqual([roofFor(to), roofFor(to)]);
      expect(plan.lid).toEqual([lidFor(to), lidFor(to)]);
      expect(travelAt(plan, 0)).toEqual({ k: 1, roof: roofFor(to), lid: lidFor(to), done: true });
    }
  });
});

describe("travelAt — where the roof stands part way", () => {
  const plan = travelPlan("court", "tower", false);
  it("starts closed, ends open, and never overshoots", () => {
    expect(travelAt(plan, 0).roof).toBe(0);
    expect(travelAt(plan, TRAVEL_UP_MS).roof).toBe(1);
    expect(travelAt(plan, TRAVEL_UP_MS * 2).done).toBe(true);
    expect(travelAt(plan, TRAVEL_UP_MS * 2).roof).toBe(1);
    expect(travelAt(plan, -50).roof).toBe(0);
    const half = travelAt(plan, TRAVEL_UP_MS / 2);
    expect(half.roof).toBeCloseTo(0.5, 6);
    expect(half.done).toBe(false);
  });
  it("eases in and out, monotonically", () => {
    expect(travelEase(0)).toBe(0);
    expect(travelEase(1)).toBe(1);
    expect(travelEase(0.5)).toBeCloseTo(0.5, 6);
    expect(travelEase(0.25)).toBeLessThan(0.25);
    expect(travelEase(0.75)).toBeGreaterThan(0.75);
    let last = -1;
    for (let k = 0; k <= 1.0001; k += 0.05) { const value = travelEase(k); expect(value).toBeGreaterThanOrEqual(last); last = value; }
    expect(travelEase(Number.NaN)).toBe(1);
  });
});

describe("the camera return slots", () => {
  it("keeps one eye per composition and per place", () => {
    expect(harbourCameraSlot("phone", "court")).toBe(`${HARBOUR_CAMERA_SLOT_PREFIX}:phone:court`);
    expect(harbourCameraSlot("desktop", "tower")).toBe("camera:v3:harbour:desktop:tower");
    expect(harbourCameraSlot("phone", "cellar")).toBe("camera:v3:harbour:phone:cellar");
    const slots = (["phone", "desktop"] as const).flatMap(c => (["court", "tower", "cellar"] as HarbourPlaceId[]).map(p => harbourCameraSlot(c, p)));
    expect(new Set(slots).size).toBe(slots.length);
  });
});

// ---------------------------------------------------------------------------
// The runtime half: two places alive for the journey, one renderer, the place
// you left disposed at the end.

type Probe = PlaceHandle & { setRoof(k: number): void; setLid(k: number): void; setScrub(index: number): void };
const built: Record<string, number> = {};
const disposed: Record<string, number> = {};
const roofs: Record<string, number> = {};
const lids: Record<string, number> = {};
let scrubbed = -1;

function probePlace(id: HarbourPlaceId): Place {
  return {
    id,
    build(scene) {
      built[id] = (built[id] ?? 0) + 1;
      const group = new THREE.Group();
      group.name = `probe:${id}`;
      scene.add(group);
      const handle: Probe = {
        group,
        setRoof(k) { roofs[id] = k; },
        setLid(k) { lids[id] = k; },
        setScrub(index) { scrubbed = index; },
        update() {},
        animate() {},
        dispose() { disposed[id] = (disposed[id] ?? 0) + 1; scene.remove(group); },
        anchors: () => [{ id: "stair", position: [0, 0, 0] as const, zone: "stair", label: "The stair." }],
        poses: () => ({}),
        regions: () => [],
      };
      return handle;
    },
  };
}

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
async function settle(ms: number): Promise<void> {
  const until = performance.now() + ms;
  for (let i = 0; i < 4000 && performance.now() < until; i += 1) {
    await frame();
    await new Promise<void>(resolve => { setTimeout(resolve, 2); });
  }
  for (let i = 0; i < 6; i += 1) await frame();
}

function host(): HTMLDivElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  document.body.append(element);
  return element;
}

describe("the runtime's journey", () => {
  const kept = { court: PLACES.court, tower: PLACES.tower, cellar: PLACES.cellar };
  let world: HarbourRuntime | null = null;

  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  });

  afterEach(() => {
    world?.dispose(); world = null;
    document.body.innerHTML = "";
    for (const key of Object.keys(built)) delete built[key];
    for (const key of Object.keys(disposed)) delete disposed[key];
    PLACES.court = kept.court; PLACES.tower = kept.tower; PLACES.cellar = kept.cellar;
    vi.unstubAllGlobals();
  });

  it("keeps both places alive for the journey, then drops the one you left", async () => {
    const court = registerPlace(probePlace("court")), tower = registerPlace(probePlace("tower"));
    world = mountHarbourWorld(host(), "classic", "lite", { onReady: () => {}, onFailure: () => {}, place: court, composition: "desktop" });
    expect(world.placeId()).toBe("court");
    expect(built.court).toBe(1);

    const plan = world.enter("tower");
    expect(plan.ms).toBe(TRAVEL_UP_MS);
    expect(world.placeId()).toBe("tower");
    expect(built.tower).toBe(1);
    // Both stand while the roof lifts; nothing has been disposed yet.
    expect(disposed.court ?? 0).toBe(0);
    expect(world.traveling()).toBe(true);
    expect(tower.id).toBe("tower");

    await settle(TRAVEL_UP_MS + 300);
    expect(world.traveling()).toBe(false);
    expect(disposed.court).toBe(1);
    expect(roofs.tower).toBe(1);
  });

  it("asks for no frames once the journey is over", async () => {
    const court = registerPlace(probePlace("court"));
    registerPlace(probePlace("tower"));
    world = mountHarbourWorld(host(), "classic", "lite", { onReady: () => {}, onFailure: () => {}, place: court, composition: "desktop" });
    world.enter("tower");
    await settle(TRAVEL_UP_MS + 300);
    expect(world.traveling()).toBe(false);
    const settledAt = painted.frames;
    await settle(300);
    // A tower at rest has no idle motion of its own: nothing is drawn until something invalidates it.
    expect(painted.frames).toBe(settledAt);
  });

  it("cuts under reduced motion: the roof is simply present, and the place you left goes at once", () => {
    const court = registerPlace(probePlace("court"));
    registerPlace(probePlace("cellar"));
    world = mountHarbourWorld(host(), "classic", "lite", { onReady: () => {}, onFailure: () => {}, place: court, composition: "desktop" });
    const plan = world.enter("cellar", { reduced: true });
    expect(plan.cut).toBe(true);
    expect(world.traveling()).toBe(false);
    expect(disposed.court).toBe(1);
    expect(lids.cellar).toBe(1);
    expect(world.placeId()).toBe("cellar");
  });

  it("leases one renderer for the whole journey and releases it once", async () => {
    release.mockClear();
    const court = registerPlace(probePlace("court"));
    registerPlace(probePlace("tower"));
    world = mountHarbourWorld(host(), "classic", "lite", { onReady: () => {}, onFailure: () => {}, place: court, composition: "desktop" });
    world.enter("tower");
    await settle(TRAVEL_UP_MS + 200);
    expect(release).not.toHaveBeenCalled();
    world.dispose(); world = null;
    expect(release).toHaveBeenCalledTimes(1);
    // Every place that stood is disposed with the world.
    expect(disposed.tower).toBe(1);
  });

  it("does nothing when the place has not registered itself", () => {
    const court = registerPlace(probePlace("court"));
    delete PLACES.tower;
    world = mountHarbourWorld(host(), "classic", "lite", { onReady: () => {}, onFailure: () => {}, place: court, composition: "desktop" });
    const plan = world.enter("tower");
    expect(plan.ms).toBe(TRAVEL_UP_MS);
    expect(world.placeId()).toBe("court");
    expect(disposed.court ?? 0).toBe(0);
  });

  it("hands the cellar's day scrub to the place that has one", () => {
    const cellar = registerPlace(probePlace("cellar"));
    world = mountHarbourWorld(host(), "classic", "lite", { onReady: () => {}, onFailure: () => {}, place: cellar, composition: "desktop" });
    scrubOf(world.place())?.(11);
    expect(scrubbed).toBe(11);
    expect(scrubOf({ ...world.place(), setScrub: undefined } as unknown as PlaceHandle)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The seams between the three places (slice-2 integration).

describe("the seams between the places", () => {
  const kept = { court: PLACES.court, tower: PLACES.tower, cellar: PLACES.cellar };
  let world: HarbourRuntime | null = null;
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  });
  afterEach(() => {
    world?.dispose(); world = null;
    document.body.innerHTML = "";
    PLACES.court = kept.court; PLACES.tower = kept.tower; PLACES.cellar = kept.cellar;
    vi.unstubAllGlobals();
  });

  it("adapts to the cellar's own scrub names, and to the shorter one", () => {
    const base = { group: new THREE.Group(), update() {}, animate() {}, dispose() {}, anchors: () => [], poses: () => ({}), regions: () => [] } as PlaceHandle;
    const moves: string[] = [];
    let where = 5;
    const cellar = { ...base, index: () => where, scrubTo: (i: number) => { where = i; moves.push(`to:${i}`); }, step: (d: number) => { where += d; moves.push(`step:${d}`); }, today: () => { where = 9; moves.push("today"); } } as PlaceHandle;
    const controls = scrubControls(cellar, 9)!;
    expect(controls).not.toBeNull();
    controls.to(3); controls.step(1); controls.today();
    expect(moves).toEqual(["to:3", "step:1", "today"]);
    expect(controls.index()).toBe(9);

    // A place that only says `setScrub` still gets a step and a today, from the index it reports.
    const plain = { ...base, setScrub: (i: number) => { where = i; moves.push(`set:${i}`); } } as PlaceHandle;
    const simple = scrubControls(plain, 12)!;
    moves.length = 0;
    simple.step(-1); simple.today();
    expect(moves).toEqual(["set:11", "set:12"]);
    // A place with no rail at all has no controls, and nothing to walk.
    expect(scrubControls(base)).toBeNull();
  });

  it("frames a place that is not the Court through its own pose table", () => {
    // Reduced motion so the camera cuts to its goal and the pose can be read at once.
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const court = registerPlace(probePlace("court"));
    registerPlace({
      id: "tower",
      build(scene) {
        const group = new THREE.Group(); scene.add(group);
        return { group, update() {}, animate() {}, dispose() { scene.remove(group); },
          anchors: () => [], regions: () => [],
          poses: () => ({ "tower:desktop": { target: [0, 1, 0] as const, r: 3, theta: 0, phi: 1.3 } }) };
      },
    });
    world = mountHarbourWorld(host(), "classic", "lite", { onReady: () => {}, onFailure: () => {}, place: court, composition: "desktop" });
    const inCourt = world.pose();
    world.enter("tower", { reduced: true });
    const inTower = world.pose();
    // The tower's own pose: up in the tower, and closer in than the court's diorama.
    // The pose sits inside the tower's hold (PLACE_HOLDS.tower), so it lands untouched.
    expect(inTower.target[1]).toBe(1);
    expect(inTower.r).toBe(3);
    expect(inTower.target[1]).toBeGreaterThan(inCourt.target[1]);
    expect(inTower.r).toBeLessThan(inCourt.r);
    // And the room holds what a hand does next: no zoom can pull the eye out through the wall.
    world.gesture({ kind: "zoom", delta: 5 });
    const heldPose = world.pose();
    expect(heldPose.r).toBeLessThanOrEqual(5.2);
    const eyeY = heldPose.target[1] + heldPose.r * Math.cos(heldPose.phi);
    expect(eyeY).toBeLessThanOrEqual(3.4 + 1e-6);
  });
});
