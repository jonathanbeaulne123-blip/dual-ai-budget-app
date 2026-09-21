// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { STICK_RADIUS, mountHarbourWorld, type HarbourHit, type HarbourRuntime, type ProjectedRect } from "../src/harbour/scene/runtime.ts";
import { BREATH_INTERVAL_MS, CAMERA_INTERVAL_MS, harbourFramePolicy } from "../src/harbour/scene/framePolicy.ts";
import { dprCap, effectiveDpr, qualityTier } from "../src/harbour/scene/quality.ts";
import { GROUND_RADIUS, LAWN_RADIUS, SEA_LEVEL, TERRACE_LEVEL, TERRACE_RADIUS, groundHeightAt } from "../src/harbour/scene/ground.ts";
import { EMPTY_PLACE, PLACES, SCENE_DRESSING, poseFor, registerPlace, type Place } from "../src/harbour/scene/place.ts";
// Importing a place registers it: the convention test below reads all three.
import "../src/harbour/court/CourtScene.ts";
import "../src/harbour/tower/TowerScene.ts";
import "../src/harbour/cellar/CellarScene.ts";
// Captured at import, before any test swaps a place out of the registry.
const REGISTERED = [PLACES.court, PLACES.tower, PLACES.cellar];
import { createCourtCamera } from "../src/harbour/camera/courtCamera.ts";
import { COURT_BOUNDS } from "../src/harbour/camera/poses.ts";

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

describe("harbourFramePolicy", () => {
  const rest = { reduced: false, moving: false, breathing: false, touched: false, projectionChanged: false, hidden: false, toolOpen: false };
  it("draws nothing when the court is settled", () => {
    expect(harbourFramePolicy(rest)).toEqual({ animate: false, render: false, schedule: false, intervalMs: 0 });
  });
  it("eases the camera at 30 fps and breathes at 20 fps", () => {
    expect(harbourFramePolicy({ ...rest, moving: true })).toEqual({ animate: true, render: true, schedule: true, intervalMs: CAMERA_INTERVAL_MS });
    expect(harbourFramePolicy({ ...rest, breathing: true })).toEqual({ animate: true, render: true, schedule: true, intervalMs: BREATH_INTERVAL_MS });
  });
  it("never animates under reduced motion or behind an open tool, and stops entirely when hidden", () => {
    expect(harbourFramePolicy({ ...rest, breathing: true, reduced: true })).toEqual({ animate: false, render: false, schedule: false, intervalMs: 0 });
    expect(harbourFramePolicy({ ...rest, breathing: true, toolOpen: true }).animate).toBe(false);
    expect(harbourFramePolicy({ ...rest, moving: true, reduced: true })).toEqual({ animate: false, render: true, schedule: true, intervalMs: CAMERA_INTERVAL_MS });
    expect(harbourFramePolicy({ ...rest, moving: true, breathing: true, hidden: true })).toEqual({ animate: false, render: false, schedule: false, intervalMs: 0 });
  });
  it("paints once, without scheduling, when only the twins moved", () => {
    expect(harbourFramePolicy({ ...rest, projectionChanged: true })).toEqual({ animate: false, render: true, schedule: false, intervalMs: 0 });
  });
  it("keeps frames flowing while a finger is down", () => {
    expect(harbourFramePolicy({ ...rest, touched: true }).schedule).toBe(true);
  });
});

describe("qualityTier", () => {
  const desktop = { dpr: 2, cores: 8, width: 1100, reducedMotion: false, saveData: false, webgl: true };
  it("gives a capable desktop the full tier and a phone the lite tier", () => {
    expect(qualityTier(desktop)).toBe("full");
    expect(qualityTier({ ...desktop, width: 390 })).toBe("lite");
    expect(qualityTier({ ...desktop, cores: 4 })).toBe("lite");
  });
  it("reads no WebGL, Save-Data or motion: flat as the reading edition", () => {
    expect(qualityTier({ ...desktop, webgl: false })).toBe("flat");
    expect(qualityTier({ ...desktop, saveData: true })).toBe("flat");
    expect(qualityTier({ ...desktop, motion: "flat" })).toBe("flat");
    expect(qualityTier({ ...desktop, reducedMotion: true })).toBe("full");
  });
  it("caps pixel ratio per tier", () => {
    expect(dprCap("full")).toBe(1.5); expect(dprCap("lite")).toBe(1);
    expect(effectiveDpr("full", 3)).toBe(1.5); expect(effectiveDpr("lite", 3)).toBe(1); expect(effectiveDpr("full", 0)).toBe(1);
  });
});

describe("groundHeightAt", () => {
  it("keeps the terrace level, lifts the lawn a little and lets the shore fall to the sea", () => {
    expect(groundHeightAt(0, 0)).toBe(TERRACE_LEVEL);
    expect(TERRACE_LEVEL).toBeLessThan(0); // the court's paving, not the island, is the surface
    expect(groundHeightAt(TERRACE_RADIUS - 0.1, 0)).toBe(TERRACE_LEVEL);
    expect(groundHeightAt((TERRACE_RADIUS + LAWN_RADIUS) / 2, 0)).toBeGreaterThan(0.2);
    expect(groundHeightAt(LAWN_RADIUS, 0)).toBeCloseTo(TERRACE_LEVEL, 5);
    expect(groundHeightAt(GROUND_RADIUS, 0)).toBeLessThan(-0.8);
    expect(groundHeightAt(GROUND_RADIUS + 5, 0)).toBeLessThan(SEA_LEVEL);
  });
});

describe("place registry", () => {
  it("resolves a composition's own pose before the shared one, in either spelling", () => {
    const poses = { court: { target: [0, 1, 0] as const, r: 9, theta: 0, phi: 1 }, "court@phone": { target: [0, 1, 0] as const, r: 12, theta: 0, phi: 1 } };
    expect(poseFor(poses, "court", "phone")?.r).toBe(12);
    expect(poseFor(poses, "court", "desktop")?.r).toBe(9);
    expect(poseFor(poses, "sky", "phone")).toBeUndefined();
    // `key:composition` is the convention and wins over the older `key@composition`.
    const both = { ...poses, "court:phone": { target: [0, 1, 0] as const, r: 7, theta: 0, phi: 1 } };
    expect(poseFor(both, "court", "phone")?.r).toBe(7);
  });

  it("every place writes its poses in one convention: key:composition", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const places = REGISTERED;
    expect(places.filter(Boolean)).toHaveLength(3);
    for (const place of places) {
      if (!place) continue;
      const scene = new THREE.Scene();
      const handle = place.build(scene, SCENE_DRESSING.classic, null, "lite", { composition: "phone", signal: new AbortController().signal, invalidate: () => {} });
      // The registry's own build: no loaders, no reading — just the geometry and the tables.
      const keys = Object.keys(handle.poses());
      expect(keys.length, place.id).toBeGreaterThan(0);
      // No `@` spelling survives, and the room's own key resolves for both compositions.
      expect(keys.filter((key) => key.includes("@")), place.id).toEqual([]);
      expect(poseFor(handle.poses(), place.id, "phone"), place.id).toBeDefined();
      expect(poseFor(handle.poses(), place.id, "desktop"), place.id).toBeDefined();
      handle.dispose();
    }
  });
  it("registers the court by id and offers every theme a dressing", () => {
    const place: Place = { id: "court", build: EMPTY_PLACE.build };
    expect(registerPlace(place)).toBe(place);
    expect(PLACES.court).toBe(place);
    delete PLACES.court;
    expect(Object.keys(SCENE_DRESSING).sort()).toEqual(["classic", "newfoundland", "taylor"]);
  });
});

describe("courtCamera through the runtime's eyes", () => {
  it("stays inside the court's bounds and cuts under reduced motion", () => {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: true });
    court.zoom(10); expect(court.pose().r).toBe(COURT_BOUNDS.maxR);
    court.zoom(-10); expect(court.pose().r).toBe(COURT_BOUNDS.minR);
    court.drag(0, 10_000); expect(court.pose().phi).toBe(COURT_BOUNDS.minPhi);
    court.drag(0, -10_000); expect(court.pose().phi).toBe(COURT_BOUNDS.maxPhi);
    court.go("sky"); expect(court.tick(0.016)).toBe(false);
    expect(camera.position.y).toBeGreaterThan(10);
  });
  it("eases toward a pose frame-rate independently and reports when it has arrived", () => {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: false });
    court.go("sky");
    expect(court.tick(0.033)).toBe(true);
    for (let i = 0; i < 400; i += 1) court.tick(0.033);
    expect(court.tick(0.033)).toBe(false);
    expect(court.pose().r).toBeCloseTo(COURT_BOUNDS.maxR, 3);
    court.goTo({ target: [1.35, 0.6, 1.85] });
    for (let i = 0; i < 400; i += 1) court.tick(0.033);
    expect(court.pose().target).toEqual([1.35, 0.6, 1.85]);
    court.restore([6, 5, 6]);
    expect(court.pose().r).toBeCloseTo(Math.hypot(6 - 1.35, 5 - 0.6, 6 - 1.85), 6);
  });
});

describe("mountHarbourWorld", () => {
  let world: HarbourRuntime | undefined;
  let host: HTMLDivElement;
  let frames: Map<number, FrameRequestCallback>;
  let serial: number;
  let clock: number;
  let width: number;
  let height: number;
  let reducedMatches: boolean;
  const taps: HarbourHit[] = [];
  const projections: ProjectedRect[][] = [];

  beforeEach(() => {
    frames = new Map(); serial = 0; width = 1440; height = 800; clock = 10_000; reducedMatches = true; taps.length = 0; projections.length = 0; release.mockClear();
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

  function frame(advance = 100) {
    const pending = [...frames.values()]; frames.clear();
    clock += advance;
    pending.forEach(callback => callback(clock));
  }
  function pointer(type: string, x: number, y: number) {
    const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
    Object.defineProperty(event, "pointerId", { value: 1 });
    host.dispatchEvent(event);
  }
  const anchorPlace: Place = {
    id: "court",
    build(scene) {
      const group = new THREE.Group();
      const rook = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial());
      rook.position.set(3, 1, 0); rook.userData.anchor = "rook";
      const queen = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshStandardMaterial());
      queen.position.set(0, 1, 0); queen.userData.region = "face";
      group.add(rook, queen); scene.add(group);
      return {
        group, update() {}, animate() {}, dispose() { scene.remove(group); },
        anchors: () => [{ id: "rook", position: [3, 0, 0], zone: "court", label: "The Rook", door: { target: "loft-banks" } }],
        poses: () => ({ "object:rook": { target: [3, 1, 0], r: 4, theta: 0.4, phi: 1 } }),
        regions: () => [{ id: "face", group: "queen", label: "Her face", objects: [queen] }],
      };
    },
  };

  it("mounts on the shared lease, reports ready, writes the camera slot and sleeps when settled", () => {
    const ready = vi.fn(), failure = vi.fn();
    world = mountHarbourWorld(host, "classic", "lite", { onReady: ready, onFailure: failure });
    expect(ready).toHaveBeenCalledTimes(1);
    expect(host.dataset.harbourTier).toBe("lite");
    expect(host.dataset.renderer).toBe("active");
    const camera = JSON.parse(host.dataset.houseCamera ?? "null") as number[];
    expect(camera).toHaveLength(3);
    frame(); frame();
    // Reduced motion: the pose is reached in one cut, so no frame stays queued.
    expect(frames.size).toBe(0);
    expect(failure).not.toHaveBeenCalled();
  });

  it("cuts to a pose under reduced motion and eases toward it otherwise", () => {
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn() });
    const before = world.camera();
    world.go("sky"); frame();
    const sky = world.camera();
    expect(sky).not.toEqual(before);
    expect(sky[1]).toBeGreaterThan(before[1]);
    reducedMatches = false;
    world.go("court"); frame(40);
    const easing = world.camera();
    expect(easing).not.toEqual(sky);
    expect(frames.size).toBe(1);
    for (let i = 0; i < 80; i += 1) frame(40);
    expect(world.camera()[1]).toBeLessThan(sky[1]);
    expect(frames.size).toBe(0);
  });

  it("routes a tap to the anchor, the Queen's region or the ground, and projects twins clamped inside the stage", () => {
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace, onTap: hit => taps.push(hit), onProject: rects => projections.push(rects) });
    frame();
    expect(projections.length).toBeGreaterThan(0);
    const rects = projections.at(-1)!;
    const rook = rects.find(r => r.id === "rook")!, face = rects.find(r => r.id === "face")!;
    expect(rook.door).toEqual({ target: "loft-banks" });
    expect(face.group).toBe("queen");
    for (const rect of rects) { expect(rect.w).toBeGreaterThanOrEqual(44); expect(rect.h).toBeGreaterThanOrEqual(44); expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.w).toBeLessThanOrEqual(width); }
    const tapAt = (x: number, y: number) => { pointer("pointerdown", x, y); clock += 50; pointer("pointerup", x, y); };
    tapAt(face.x + face.w / 2, face.y + face.h / 2);
    expect(taps.at(-1)?.kind).toBe("queen");
    tapAt(rook.x + rook.w / 2, rook.y + rook.h / 2 + 20);
    expect(taps.at(-1)?.kind).toBe("anchor");
    tapAt(width * 0.5, height * 0.92);
    expect(taps.at(-1)?.kind).toBe("ground");
  });

  it("orbits on a ground drag, never on a Queen stroke, and reports the stroke instead of a tap", () => {
    const gestures: string[] = [];
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace, onTap: hit => taps.push(hit), onGesture: g => gestures.push(g.region), onProject: rects => projections.push(rects) });
    frame();
    const face = projections.at(-1)!.find(r => r.id === "face")!;
    const start = world.pose();
    pointer("pointerdown", width * 0.5, height * 0.92); pointer("pointermove", width * 0.5 + 60, height * 0.92); clock += 500; pointer("pointerup", width * 0.5 + 60, height * 0.92);
    expect(world.pose().theta).not.toBe(start.theta);
    expect(taps).toHaveLength(0);
    const orbit = world.pose();
    frame();
    const moved = projections.at(-1)!.find(r => r.id === "face")!;
    expect(moved).not.toEqual(face);
    const cx = moved.x + moved.w / 2, cy = moved.y + moved.h / 2;
    pointer("pointerdown", cx, cy); pointer("pointermove", cx, cy - 40); clock += 500; pointer("pointerup", cx, cy - 40);
    expect(world.pose()).toEqual(orbit);
    expect(gestures).toEqual(["face"]);
    expect(taps).toHaveLength(0);
  });

  it("restores a return record's camera and releases the lease on dispose", () => {
    world = mountHarbourWorld(host, "classic", "full", { onReady: vi.fn(), onFailure: vi.fn() });
    world.restore([6, 5, 6]);
    const [x, y, z] = world.camera();
    expect(x).toBeCloseTo(6, 3); expect(y).toBeCloseTo(5, 3); expect(z).toBeCloseTo(6, 3);
    world.dispose(); world = undefined;
    expect(release).toHaveBeenCalledTimes(1);
    expect(host.dataset.houseCamera).toBeUndefined();
    expect(frames.size).toBe(0);
  });

  /**
   * The phone's thumb-stick (W7 b) and the close hold's gesture (W7 a). Both
   * are driven from the same pointers the camera already reads, so neither
   * costs a timer, a listener or a frame the world was not already spending.
   */
  it("grows a thumb-stick from a press held still on the ground, and walks with it", () => {
    const sticks: ({ x: number; y: number; dx: number; dy: number } | null)[] = [];
    width = 390; height = 844; // the stick is a phone's, and the stage decides that by its width
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace, onStick: (next) => sticks.push(next) });
    const before = world.camera();
    // A press out on the open ground, well away from anything that stands.
    pointer("pointerdown", 40, 700);
    // Too soon, and still a tap: no stick yet.
    frame(200);
    expect(sticks).toEqual([]);
    // Held past the threshold, and still: the stick appears where the thumb is.
    frame(300);
    expect(sticks).toHaveLength(1);
    expect(sticks[0]).toEqual({ x: 40, y: 700, dx: 0, dy: 0 });

    // Push it up: the camera walks forward, and the push is reported for drawing.
    pointer("pointermove", 40, 620);
    const pushed = sticks[sticks.length - 1]!;
    expect(pushed!.dy).toBeLessThan(0);
    // Clamped to the stick's own radius, so a thumb off the edge does not run away.
    expect(Math.hypot(pushed!.dx, pushed!.dy)).toBeLessThanOrEqual(STICK_RADIUS + 1e-9);
    frame(40); frame(40);
    expect(world.camera()).not.toEqual(before);

    // The thumb comes off and the stick goes with it.
    pointer("pointerup", 40, 620);
    expect(sticks[sticks.length - 1]).toBeNull();
  });

  it("never grows a stick on a desktop, or from a press that was really a drag", () => {
    const sticks: unknown[] = [];
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace, onStick: (next) => sticks.push(next) });
    pointer("pointerdown", 40, 700); frame(500);
    expect(sticks).toEqual([]);
    pointer("pointerup", 40, 700);
    world.dispose(); world = undefined;

    const phone: unknown[] = [];
    width = 390; height = 844;
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace, onStick: (next) => phone.push(next) });
    pointer("pointerdown", 40, 700);
    pointer("pointermove", 90, 700); // an orbit, not a press
    frame(500);
    expect(phone).toEqual([]);
  });

  it("takes the close hold on and off with two taps on the open ground, and only there", () => {
    const closes: boolean[] = [];
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace, onClose: (on) => closes.push(on) });
    const tap = (x: number, y: number) => { pointer("pointerdown", x, y); pointer("pointerup", x, y); };
    // One tap on the ground is one tap: the ground opens nothing, and nothing happens.
    tap(40, 700);
    expect(world.closed()).toBe(false);
    // The second, quickly and in the same spot, is the gesture.
    clock += 100;
    tap(42, 702);
    expect(world.closed()).toBe(true);
    expect(closes).toEqual([true]);
    // And the same gesture lets it go — it can never strand you.
    clock += 100; tap(40, 700);
    clock += 100; tap(41, 701);
    expect(world.closed()).toBe(false);
    expect(closes).toEqual([true, false]);

    // Two taps too far apart in time are two taps.
    clock += 100; tap(40, 700);
    clock += 4000; tap(40, 700);
    expect(world.closed()).toBe(false);
  });

  it("has no close hold in a place that has not earned one, and remembers the ones that have", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // jsdom has no 2D canvas; the plates fall back to blank stone.
    // An earlier test takes the Court out of the registry; walking back into
    // it needs something standing there, and `anchorPlace` carries its id.
    const registered = PLACES.court;
    registerPlace(anchorPlace);
    world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: anchorPlace });
    // `anchorPlace` stands under the Court's id, which has a close hold.
    expect(world.toggleClose(true)).toBe(true);
    expect(world.closed()).toBe(true);
    // Walking to a place with none simply leaves the camera alone.
    world.enter("tower", { from: "court", reduced: true });
    expect(world.closed()).toBe(false);
    // And back: the Court opens the way it was left.
    world.enter("court", { from: "tower", reduced: true });
    expect(world.closed()).toBe(true);
    if (registered) registerPlace(registered); else delete PLACES.court;
  });
});
