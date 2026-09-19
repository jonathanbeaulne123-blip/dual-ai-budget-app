import { describe, expect, it } from "vitest";
import {
  ROAM_HOME_RADIUS,
  ROAM_MAX_FLICK,
  ROAM_MAX_PHI,
  ROAM_MIN_PHI,
  ROAM_MIN_R,
  ZERO_INPUT,
  ZERO_MOTION,
  adoptRoam,
  clampRoamCam,
  flickVelocity,
  panDelta,
  restRoam,
  roamAxes,
  roamBounds,
  roamEye,
  roamFacing,
  roamInputActive,
  roamInputFrom,
  roamKeyAxis,
  roamMoving,
  roamSpeed,
  stepRoam,
  wrapAngle,
  type RoamCam,
  type RoamInput,
  type RoamStep,
} from "../src/path/world/roamCamera.ts";

const cam = (over: Partial<RoamCam> = {}): RoamCam => ({ tx: 0, tz: 0, r: 60, theta: 0.7, phi: 0.95, ...over });
const input = (over: Partial<RoamInput> = {}): RoamInput => ({ ...ZERO_INPUT, ...over });

describe("free roam bounds (D-286)", () => {
  it("keeps the whole journey reachable, not just visible", () => {
    const latched = roamBounds({ eraExtent: 240, latched: 260 });
    // The latched camera stops at eraExtent + 20; roam reaches well past the farthest island.
    expect(latched.radius).toBeGreaterThan(240 + 20);
    expect(latched.radius).toBe(240 + 70);
  });

  it("gives an island with no journey a generous ring of its own", () => {
    const bounds = roamBounds({ eraExtent: 0, latched: 84 });
    expect(bounds.radius).toBe(ROAM_HOME_RADIUS);
    expect(bounds.radius).toBeGreaterThan(84);
  });

  it("lets the camera come closer and pull back further than the latched one", () => {
    const bounds = roamBounds({ maxRadius: 200 });
    expect(bounds.minR).toBe(ROAM_MIN_R);
    expect(bounds.minR).toBeLessThan(14);
    expect(bounds.maxR).toBeGreaterThan(200);
    expect(bounds.minPhi).toBe(ROAM_MIN_PHI);
    expect(bounds.maxPhi).toBe(ROAM_MAX_PHI);
  });

  it("never lets the target leave the ring, however hard it is pushed", () => {
    const bounds = roamBounds({ eraExtent: 120 });
    let state: RoamStep = { cam: cam({ tx: 0, tz: 0, r: 120 }), motion: { ...ZERO_MOTION }, moving: false };
    for (let i = 0; i < 2000; i++) state = stepRoam(state.cam, state.motion, input({ forward: 1, boost: true }), 1 / 60, bounds);
    expect(Math.hypot(state.cam.tx, state.cam.tz)).toBeLessThanOrEqual(bounds.radius + 1e-6);
  });

  it("does not buzz against the ring: speed into the wall is dropped", () => {
    const bounds = roamBounds({ eraExtent: 60 });
    let state: RoamStep = { cam: cam({ tx: bounds.radius, tz: 0, r: 60, theta: -Math.PI / 2 }), motion: { ...ZERO_MOTION }, moving: false };
    for (let i = 0; i < 200; i++) state = stepRoam(state.cam, state.motion, input({ forward: 1 }), 1 / 60, bounds);
    // Still pinned to the ring, and once the key is let go it stops rather than grinding along it.
    for (let i = 0; i < 120; i++) state = stepRoam(state.cam, state.motion, ZERO_INPUT, 1 / 60, bounds);
    expect(roamMoving(state.motion)).toBe(false);
  });

  it("clamps distance and tilt but leaves a legal view alone", () => {
    const bounds = roamBounds({ eraExtent: 100 });
    const legal = cam({ tx: 12, tz: -30, r: 44, theta: 0.7, phi: 0.95 });
    expect(clampRoamCam(legal, bounds)).toEqual({ ...legal, theta: wrapAngle(legal.theta) });
    expect(clampRoamCam(cam({ r: 2 }), bounds).r).toBe(ROAM_MIN_R);
    expect(clampRoamCam(cam({ phi: 3 }), bounds).phi).toBe(ROAM_MAX_PHI);
    expect(clampRoamCam(cam({ phi: -1 }), bounds).phi).toBe(ROAM_MIN_PHI);
  });
});

describe("taking the camera (mode transitions)", () => {
  it("keeps the exact view: every place the latched camera can reach is legal in free roam", () => {
    const bounds = roamBounds({ eraExtent: 240, latched: 260, maxRadius: 300 });
    // The latched camera's own extremes: its ring (eraExtent + 20), its closest and farthest radius, its tilt band.
    const corners: RoamCam[] = [
      { tx: 260, tz: 0, r: 14, theta: 0, phi: 0.35 },
      { tx: 0, tz: -260, r: 300, theta: 3.1, phi: 1.3 },
      { tx: 100, tz: 100, r: 118, theta: 0.7, phi: 0.95 },
    ];
    for (const view of corners) expect(adoptRoam(view, bounds)).toEqual({ ...view, theta: wrapAngle(view.theta) });
  });

  it("leaves the camera exactly where it was when nothing is asked of it and it is at rest", () => {
    const bounds = roamBounds({ eraExtent: 100 });
    const start = cam({ tx: 10, tz: 20, r: 70 });
    const step = stepRoam(start, restRoam(), ZERO_INPUT, 1 / 60, bounds);
    expect(step.cam).toEqual({ ...start, theta: wrapAngle(start.theta) });
    expect(step.moving).toBe(false);
  });

  it("wraps a heading so a long roam never drifts into large numbers", () => {
    expect(wrapAngle(7 * Math.PI)).toBeCloseTo(Math.PI, 6);
    const bounds = roamBounds({});
    let state: RoamStep = { cam: cam(), motion: { ...ZERO_MOTION }, moving: false };
    for (let i = 0; i < 1200; i++) state = stepRoam(state.cam, state.motion, input({ turn: 1, boost: true }), 1 / 60, bounds);
    expect(Math.abs(state.cam.theta)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe("frame-rate independence", () => {
  const bounds = roamBounds({ eraExtent: 400 });
  const run = (steps: number, seconds: number, held: RoamInput) => {
    let state: RoamStep = { cam: cam({ r: 60 }), motion: { ...ZERO_MOTION }, moving: false };
    for (let i = 0; i < steps; i++) state = stepRoam(state.cam, state.motion, held, seconds / steps, bounds);
    return state;
  };

  it("lands in the same place at 30fps, 60fps and 144fps", () => {
    const held = input({ forward: 1, strafe: -1, rise: 1 });
    const a = run(15, 0.5, held), b = run(30, 0.5, held), c = run(72, 0.5, held);
    for (const key of ["tx", "tz", "theta", "phi"] as const) {
      expect(b.cam[key]).toBeCloseTo(a.cam[key], 6);
      expect(c.cam[key]).toBeCloseTo(a.cam[key], 6);
    }
    expect(b.motion.vx).toBeCloseTo(a.motion.vx, 6);
  });

  it("turns through the same angle whatever the frame rate", () => {
    const held = input({ turn: 1 });
    const a = run(15, 0.5, held), b = run(72, 0.5, held);
    expect(b.cam.theta).toBeCloseTo(a.cam.theta, 6);
  });

  it("only drifts a hair when turning and running at once (the heading moves under the step)", () => {
    const held = input({ forward: 1, strafe: -1, turn: 1, rise: 1 });
    const a = run(15, 0.5, held), c = run(72, 0.5, held);
    expect(Math.hypot(c.cam.tx - a.cam.tx, c.cam.tz - a.cam.tz)).toBeLessThan(0.05);
  });

  it("coasts the same distance whatever the frame rate", () => {
    const glide = (steps: number) => {
      let state: RoamStep = { cam: cam({ tx: 0, tz: 0 }), motion: { ...ZERO_MOTION, vx: 40, vz: -20 }, moving: true };
      for (let i = 0; i < steps; i++) state = stepRoam(state.cam, state.motion, ZERO_INPUT, 0.5 / steps, bounds);
      return state.cam;
    };
    const slow = glide(12), fast = glide(120);
    expect(fast.tx).toBeCloseTo(slow.tx, 6);
    expect(fast.tz).toBeCloseTo(slow.tz, 6);
  });

  it("ignores a stalled tab's enormous frame gap instead of teleporting", () => {
    const one = stepRoam(cam(), { ...ZERO_MOTION }, input({ forward: 1 }), 30, bounds);
    const capped = stepRoam(cam(), { ...ZERO_MOTION }, input({ forward: 1 }), 0.05, bounds);
    expect(one.cam.tx).toBeCloseTo(capped.cam.tx, 10);
    expect(one.cam.tz).toBeCloseTo(capped.cam.tz, 10);
  });

  it("never moves on a zero or negative frame gap", () => {
    for (const dt of [0, -1, Number.NaN]) {
      const step = stepRoam(cam(), { ...ZERO_MOTION, vx: 50 }, input({ forward: 1 }), dt, bounds);
      expect(step.cam.tx).toBeCloseTo(0, 10);
    }
  });
});

describe("inertia, damping and reduced motion", () => {
  const bounds = roamBounds({ eraExtent: 200 });

  it("glides on after the keys are let go, then settles", () => {
    let state: RoamStep = { cam: cam(), motion: { ...ZERO_MOTION }, moving: false };
    for (let i = 0; i < 30; i++) state = stepRoam(state.cam, state.motion, input({ forward: 1 }), 1 / 60, bounds);
    const released = { ...state.cam };
    expect(roamMoving(state.motion)).toBe(true);
    let coasted = 0;
    for (let i = 0; i < 20; i++) { state = stepRoam(state.cam, state.motion, ZERO_INPUT, 1 / 60, bounds); coasted++; if (!state.moving) break; }
    expect(Math.hypot(state.cam.tx - released.tx, state.cam.tz - released.tz)).toBeGreaterThan(0.5);
    expect(coasted).toBeGreaterThan(1);
    for (let i = 0; i < 300; i++) state = stepRoam(state.cam, state.motion, ZERO_INPUT, 1 / 60, bounds);
    expect(state.moving).toBe(false);
    expect(roamMoving(state.motion)).toBe(false);
  });

  it("with reduced motion there is no inertia at all: it stops the instant the key is let go", () => {
    let state: RoamStep = { cam: cam(), motion: { ...ZERO_MOTION }, moving: false };
    for (let i = 0; i < 30; i++) state = stepRoam(state.cam, state.motion, input({ forward: 1 }), 1 / 60, bounds, true);
    expect(state.moving).toBe(true);
    expect(state.motion).toEqual({ ...ZERO_MOTION });
    const stopped = stepRoam(state.cam, state.motion, ZERO_INPUT, 1 / 60, bounds, true);
    expect(stopped.cam).toEqual(state.cam);
    expect(stopped.moving).toBe(false);
  });

  it("still moves under reduced motion while a key is held, at the same speed", () => {
    const held = input({ forward: 1 });
    const a = stepRoam(cam(), { ...ZERO_MOTION }, held, 0.05, bounds, true);
    expect(Math.hypot(a.cam.tx, a.cam.tz)).toBeCloseTo(roamSpeed(60) * 0.05, 4);
  });
});

describe("what the keys and drags mean", () => {
  const bounds = roamBounds({ eraExtent: 200 });

  it("moves relative to where the camera looks, not to the world's axes", () => {
    for (const theta of [0, 0.7, Math.PI / 2, 2.4, -1.1]) {
      const { fx, fz } = roamAxes(theta);
      const step = stepRoam(cam({ theta }), { ...ZERO_MOTION }, input({ forward: 1 }), 0.05, bounds, true);
      const moved = Math.hypot(step.cam.tx, step.cam.tz);
      expect(step.cam.tx / moved).toBeCloseTo(fx, 6);
      expect(step.cam.tz / moved).toBeCloseTo(fz, 6);
    }
  });

  it("strafes square to the way it looks", () => {
    const { fx, fz } = roamAxes(0.7);
    const step = stepRoam(cam({ theta: 0.7 }), { ...ZERO_MOTION }, input({ strafe: 1 }), 0.05, bounds, true);
    expect(step.cam.tx * fx + step.cam.tz * fz).toBeCloseTo(0, 6);
  });

  it("does not let a diagonal run faster than a straight one", () => {
    const straight = stepRoam(cam(), { ...ZERO_MOTION }, input({ forward: 1 }), 0.05, bounds, true);
    const diagonal = stepRoam(cam(), { ...ZERO_MOTION }, input({ forward: 1, strafe: 1 }), 0.05, bounds, true);
    expect(Math.hypot(diagonal.cam.tx, diagonal.cam.tz)).toBeCloseTo(Math.hypot(straight.cam.tx, straight.cam.tz), 6);
  });

  it("covers more ground high up than down among the stones, and Shift is faster still", () => {
    expect(roamSpeed(20)).toBeLessThan(roamSpeed(160));
    expect(roamSpeed(60, true)).toBeGreaterThan(roamSpeed(60));
    // Never so slow it feels stuck, never so fast it is unusable.
    expect(roamSpeed(11)).toBeGreaterThan(5);
    expect(roamSpeed(600, true)).toBeLessThan(400);
  });

  it("rises toward overhead and falls toward the horizon", () => {
    const up = stepRoam(cam({ phi: 0.9 }), { ...ZERO_MOTION }, input({ rise: 1 }), 0.05, bounds, true);
    const down = stepRoam(cam({ phi: 0.9 }), { ...ZERO_MOTION }, input({ rise: -1 }), 0.05, bounds, true);
    expect(up.cam.phi).toBeLessThan(0.9);
    expect(down.cam.phi).toBeGreaterThan(0.9);
  });

  it("reads W/A/S/D, the arrows, Q/E, R/F and +/−, and nothing else", () => {
    expect(roamKeyAxis("w")).toEqual({ axis: "forward", sign: 1 });
    expect(roamKeyAxis("W")).toEqual({ axis: "forward", sign: 1 });
    expect(roamKeyAxis("ArrowUp")).toEqual({ axis: "forward", sign: 1 });
    expect(roamKeyAxis("ArrowLeft")).toEqual({ axis: "strafe", sign: -1 });
    expect(roamKeyAxis("q")).toEqual({ axis: "turn", sign: -1 });
    expect(roamKeyAxis("e")).toEqual({ axis: "turn", sign: 1 });
    expect(roamKeyAxis("r")).toEqual({ axis: "rise", sign: 1 });
    expect(roamKeyAxis("+")).toEqual({ axis: "rise", sign: 1 });
    expect(roamKeyAxis("f")).toEqual({ axis: "rise", sign: -1 });
    expect(roamKeyAxis("-")).toEqual({ axis: "rise", sign: -1 });
    expect(roamKeyAxis("Escape")).toBeNull();
    expect(roamKeyAxis(" ")).toBeNull();
    expect(roamKeyAxis("Tab")).toBeNull();
  });

  it("cancels opposing keys and reports whether anything is asked for", () => {
    expect(roamInputFrom(["w", "s"], false)).toEqual({ ...ZERO_INPUT, forward: 0 });
    expect(roamInputFrom(["w", "d"], true)).toEqual({ forward: 1, strafe: 1, turn: 0, rise: 0, boost: true });
    expect(roamInputActive(roamInputFrom(["w", "s"], false))).toBe(false);
    expect(roamInputActive(roamInputFrom(["e"], false))).toBe(true);
    expect(roamInputActive(ZERO_INPUT)).toBe(false);
  });

  it("turns a drag into a move across the ground, bigger the further out you are", () => {
    const near = panDelta(40, 0, 20, 0);
    const far = panDelta(40, 0, 200, 0);
    expect(Math.hypot(far.dx, far.dz)).toBeGreaterThan(Math.hypot(near.dx, near.dz));
    // Dragging right pulls the world right, so the camera walks left.
    expect(panDelta(40, 0, 60, 0).dx).toBeLessThan(0);
  });

  it("caps a flick so a stray swipe cannot launch the camera across the sea", () => {
    const wild = flickVelocity(900, 900, 0.008);
    expect(Math.hypot(wild.vx, wild.vz)).toBeCloseTo(ROAM_MAX_FLICK, 6);
    expect(flickVelocity(1, 1, 0)).toEqual({ vx: 0, vz: 0 });
  });
});

describe("the eye and the minimap", () => {
  it("never sinks under the land, under the eye or under the target", () => {
    const low = roamEye(cam({ r: 11, phi: ROAM_MAX_PHI }), 30, 0);
    expect(low.y).toBeGreaterThanOrEqual(30);
    const overIsland = roamEye(cam({ r: 40, phi: 1.2 }), 0, 26);
    expect(overIsland.y).toBeGreaterThan(26);
  });

  it("stands the eye behind the target and looks just above the ground", () => {
    const eye = roamEye(cam({ tx: 10, tz: 5, r: 50, theta: 0, phi: 1 }), 0, 0);
    expect(eye.z).toBeGreaterThan(5);
    expect(eye.lookY).toBeCloseTo(1.5, 6);
  });

  it("reports where the camera stands and which way it faces, with a wider cone on a wide screen", () => {
    const facing = roamFacing(cam({ tx: 0, tz: 0, r: 60, theta: 0, phi: 1 }), 1.6);
    expect(facing.z).toBeGreaterThan(0);
    // Screen "up" points from the eye toward the target: the camera faces -z here.
    expect(Math.abs(wrapAngle(facing.heading - Math.PI))).toBeCloseTo(0, 6);
    expect(roamFacing(cam(), 2.4).cone).toBeGreaterThan(roamFacing(cam(), 0.6).cone);
    expect(facing.reach).toBeGreaterThan(0);
  });
});
