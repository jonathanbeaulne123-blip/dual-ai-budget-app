// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harbourFramePolicy } from "../src/harbour/scene/framePolicy.ts";
import { mountHarbourWorld, type HarbourRuntime } from "../src/harbour/scene/runtime.ts";
import { PLACES, PLACE_HOLDS, SCENE_DRESSING, type Place } from "../src/harbour/scene/place.ts";
import { CLOSE_PLACES, closePose, courtPose, samePose } from "../src/harbour/camera/poses.ts";
import { createCourtCamera } from "../src/harbour/camera/courtCamera.ts";
import { HARBOUR_PLACE_NAMES, type HarbourPlaceId } from "../src/harbour/flag.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
// Importing a place registers it; the audit below walks every one of them.
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
 * Reduced motion, audited across the whole island (W7 c).
 *
 * The promise is not "less movement". It is three exact things:
 *
 * 1. **Every camera move is a cut.** No easing, no fly-in, nothing that moves
 *    under you — the camera is simply already there.
 * 2. **Every ambient animation stops.** Her breath, Hercules's tail, the
 *    kiln's glow, the campfire's embers, the boathouse's lanterns.
 * 3. **The frame policy genuinely returns "no frames".** Not a slower loop —
 *    no loop. A settled place with reduced motion asks the renderer for
 *    nothing at all, so the phone is not warm in your hand for a still image.
 *
 * The third is the one that rots quietly, so it is the one tested by mounting
 * the real runtime and counting what it asks the renderer for.
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

describe("the frame policy says no frames, at rest, whatever a place declares", () => {
  const rest = { reduced: true, moving: false, breathing: false, touched: false, projectionChanged: false, hidden: false, toolOpen: false };
  it("asks for nothing however loudly the place says it is alive", () => {
    for (const breathing of [false, true]) {
      for (const toolOpen of [false, true]) {
        const policy = harbourFramePolicy({ ...rest, breathing, toolOpen });
        expect(policy, `breathing:${breathing} toolOpen:${toolOpen}`).toEqual({ animate: false, render: false, schedule: false, intervalMs: 0 });
      }
    }
  });

  it("never animates under reduced motion even while something is moving", () => {
    expect(harbourFramePolicy({ ...rest, moving: true }).animate).toBe(false);
    expect(harbourFramePolicy({ ...rest, touched: true }).animate).toBe(false);
    // One paint for the twins, and then nothing: a repaint is not a loop.
    expect(harbourFramePolicy({ ...rest, projectionChanged: true })).toEqual({ animate: false, render: true, schedule: false, intervalMs: 0 });
  });
});

describe("every camera move is a cut", () => {
  it("lands in one tick from every mode, in both compositions, in every room", () => {
    for (const composition of ["phone", "desktop"] as const) {
      const camera = new THREE.PerspectiveCamera(42, composition === "phone" ? 390 / 844 : 1440 / 900, 0.1, 200);
      const court = createCourtCamera({ camera, composition, reduced: true });
      for (const id of PLACE_IDS) {
        court.setHold(PLACE_HOLDS[id]);
        for (const move of [() => court.go("sky"), () => court.go("court"), () => court.go("object", "rook"), () => court.goTo({ target: [1, 1, 1] })]) {
          move();
          expect(court.tick(1 / 60), `${id} ${composition}`).toBe(false);
          expect(samePose(court.pose(), court.goal(), 1e-9), `${id} ${composition}`).toBe(true);
        }
        if (CLOSE_PLACES.includes(id)) {
          court.close(closePose(id, composition));
          expect(court.tick(1 / 60), `${id} close`).toBe(false);
          court.close(null);
          expect(court.tick(1 / 60), `${id} close off`).toBe(false);
        }
      }
    }
  });

  it("cuts a move that was already in flight the moment reduced motion comes on", () => {
    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 200);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: false, aspect: 1.6 });
    court.go("sky");
    expect(court.tick(1 / 60)).toBe(true);
    court.setReduced(true);
    expect(samePose(court.pose(), court.goal(), 1e-9)).toBe(true);
    expect(court.tick(1 / 60)).toBe(false);
    expect(samePose(court.pose(), courtPose("sky", undefined, "desktop", 1.6), 1e-6)).toBe(true);
  });
});

describe("every place, mounted, asks for no frames at rest", () => {
  let host: HTMLDivElement;
  let world: HarbourRuntime | undefined;
  let frames: Map<number, FrameRequestCallback>;
  let serial = 0, clock = 10_000;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // jsdom has no 2D canvas; the plates fall back to blank stone.
    frames = new Map(); serial = 0; clock = 10_000; release.mockClear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    host = document.createElement("div");
    document.body.append(host);
    host.getBoundingClientRect = () => ({ width: 390, height: 844, left: 0, top: 0, right: 390, bottom: 844, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  });
  afterEach(() => { world?.dispose(); world = undefined; host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function settle(rounds = 20) {
    for (let i = 0; i < rounds && frames.size > 0; i += 1) {
      const pending = [...frames.values()]; frames.clear();
      clock += 100;
      pending.forEach((callback) => callback(clock));
    }
    return frames.size;
  }

  for (const id of PLACE_IDS) {
    it(`${id}: stands still and queues nothing`, () => {
      const place: Place | undefined = PLACES[id];
      expect(place, `${id} is not registered`).toBeDefined();
      world = mountHarbourWorld(host, "classic", "lite", {
        onReady: vi.fn(), onFailure: vi.fn(), place, reading, dressing: SCENE_DRESSING.classic, composition: "phone",
      });
      // Everything the shell does on arrival: the reading, the place's own
      // "something moved" and a camera move. Under reduced motion all of it
      // lands at once, and then the world is quiet.
      world.setReading(reading);
      world.invalidate();
      world.go("court");
      // **One** round of frames, not twenty: a cut is one paint and then
      // silence. A place that needs a second round is easing something.
      expect(settle(1), `${id} is still asking for frames after one paint`).toBe(0);
      // And it stays quiet: nothing wakes itself up a beat later.
      expect(settle(), `${id} woke itself up`).toBe(0);
    });
  }

  it("the close hold is a cut too, and leaves nothing running", () => {
    world = mountHarbourWorld(host, "classic", "lite", {
      onReady: vi.fn(), onFailure: vi.fn(), place: PLACES.court, reading, dressing: SCENE_DRESSING.classic, composition: "phone",
    });
    settle();
    expect(world.toggleClose()).toBe(true);
    expect(settle(1), "the close hold is still easing").toBe(0);
    expect(world.closed()).toBe(true);
    expect(world.toggleClose()).toBe(false);
    expect(settle(1), "letting the close hold go is still easing").toBe(0);
  });
});

describe("the stylesheets stop their own motion", () => {
  const harbour = join(process.cwd(), "src", "harbour");
  const sheets = (function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : name.endsWith(".css") ? [path] : [];
    });
  })(harbour);

  it("has a stylesheet or two, and every one of them answers the query", () => {
    expect(sheets.length).toBeGreaterThan(0);
    for (const sheet of sheets) {
      const source = readFileSync(sheet, "utf8");
      const name = relative(harbour, sheet);
      if (!/animation:|transition:|@keyframes/.test(source)) continue;
      expect(source, `${name} animates and never answers prefers-reduced-motion`).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
      const guard = source.slice(source.indexOf("@media (prefers-reduced-motion: reduce)"));
      expect(guard, `${name} does not turn its animations off`).toMatch(/animation:\s*none/);
    }
  });

  it("covers the stage's own new furniture: the thumb-stick and the door signs sit inside the guard", () => {
    const source = readFileSync(join(harbour, "harbour.css"), "utf8");
    // Both live inside `.harbour-world`, whose whole subtree the guard silences.
    expect(source).toMatch(/\.harbour-stick/);
    expect(source).toMatch(/\.place-flat__sign/);
    expect(source).toMatch(/\.harbour-world \*[^}]*animation: none/);
  });
});
