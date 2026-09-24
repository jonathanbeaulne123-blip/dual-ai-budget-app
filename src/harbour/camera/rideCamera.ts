/**
 * Hearth Mountain v2 · the ride camera (C4).
 *
 * The funicular and the gondola get their own scripted camera instead of the
 * walking camera with its facing forced to zero:
 *
 * - **Along** — behind and above the cabin, a little to one side, looking
 *   ahead along the direction of travel (the transport spline's own tangent).
 * - **Reveal** (gondola only) — over the middle of the ride it eases round to
 *   the cabin's side and looks out over the gorge to the town: the cabin and
 *   its rider in the foreground, the reveal behind. Authored against the
 *   adapter's `GORGE_REVEAL` and `TOWN_SQUARE`, so it follows the cable.
 * - **Composition** — every frame, the rider is kept inside the frame: when
 *   the shot would lose them, the look-at point is drawn toward them until
 *   they are back inside the safe area. The eye is kept over the land and out
 *   of solids (the cabin excepted — it is what we are looking at).
 * - **Hand-back** — at the far station the Walk camera stands behind the
 *   body facing *away from the platform* (`rideExitHeading`).
 *
 * Eye and look-at are critically damped springs toward the keyframes, solved
 * exactly per step (frame-rate independent). A skip or a new ride cuts
 * (`start`). Reduced motion never eases: every frame is its keyframe.
 * Pure: no three.js, no DOM, no time of its own.
 */
import type { Vec3 } from "./poses.ts";
import { projectView } from "./mountainPoses.ts";
import { clearFraction, type Blocked } from "./obstruction.ts";
import { CAMERA_DISTRICTS, GORGE_REVEAL, TOWN_SQUARE, stopAt, type TransportKind } from "./worldAdapter.ts";

export type RideInput = {
  kind: TransportKind;
  /** Progress through the trip, 0…1. */
  u: number;
  /** The cabin: where it is and which way it travels (unit). */
  cabin: Vec3;
  dir: Vec3;
  /** The point to keep in frame: the rider's chest. */
  rider: Vec3;
  aspect: number;
  fov: number;
};
export type RideShot = { eye: Vec3; look: Vec3; fov: number; reveal: number };
export type RideCamera = {
  /** Cut to the first keyframe of a ride. */
  start(input: RideInput): RideShot;
  update(input: RideInput, dt: number, reduced: boolean): RideShot;
  shot(): RideShot;
};
export type RideCameraOptions = { ground?: (x: number, z: number) => number; blocked?: Blocked };

export const RIDE = Object.freeze({
  /** Along: how far behind, above and aside of the cabin the eye rides, and how far ahead it looks. */
  back: 9, rise: 3.6, aside: 2.2, ahead: 16,
  /** Reveal: beside the cabin on the view's side, a little behind and above. */
  revealAside: 8.5, revealRise: 3.2, revealBack: 2,
  /** When the reveal eases in and out (share of the ride). */
  revealIn: [0.18, 0.4] as const, revealOut: [0.7, 0.88] as const,
  /** Spring stiffness (rad/s) for eye and look-at. */
  wEye: 3.2, wLook: 4.2,
  /** The safe area the rider is kept inside (NDC). */
  safe: 0.72,
  /** The ride lens widens a little over the reveal. */
  revealFov: 6,
});

const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** How much of the reveal the gondola shows at `u` (0 on the funicular). */
export function revealWeight(kind: TransportKind, u: number): number {
  if (kind !== "gondola") return 0;
  return smooth(RIDE.revealIn[0], RIDE.revealIn[1], u) * (1 - smooth(RIDE.revealOut[0], RIDE.revealOut[1], u));
}

/** The keyframe the camera is heading for at this moment of the ride. */
export function rideKeyframe(input: RideInput): { eye: Vec3; look: Vec3; reveal: number } {
  const { cabin, dir } = input;
  let hx = dir[0], hz = dir[2];
  const hl = Math.hypot(hx, hz);
  if (hl < 1e-4) { hx = 0; hz = -1; } else { hx /= hl; hz /= hl; }
  // Right of travel.
  const rx = -hz, rz = hx;
  const along = {
    eye: [cabin[0] - hx * RIDE.back + rx * RIDE.aside, cabin[1] + RIDE.rise - dir[1] * RIDE.back * 0.5, cabin[2] - hz * RIDE.back + rz * RIDE.aside] as Vec3,
    look: [cabin[0] + dir[0] * RIDE.ahead, cabin[1] + dir[1] * RIDE.ahead + 0.6, cabin[2] + dir[2] * RIDE.ahead] as Vec3,
  };
  const w = revealWeight(input.kind, input.u);
  if (w <= 0) return { ...along, reveal: 0 };
  // The view: across the gorge to the town. The eye goes to the cabin's far side from it.
  const view = lerp3(GORGE_REVEAL, TOWN_SQUARE, 0.45);
  let vx = view[0] - cabin[0], vz = view[2] - cabin[2];
  const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
  const reveal = {
    eye: [cabin[0] - vx * RIDE.revealAside - hx * RIDE.revealBack, cabin[1] + RIDE.revealRise, cabin[2] - vz * RIDE.revealAside - hz * RIDE.revealBack] as Vec3,
    look: view,
  };
  return { eye: lerp3(along.eye, reveal.eye, w), look: lerp3(along.look, reveal.look, w), reveal: w };
}

/** Draw the look-at point toward the rider until the rider is inside the safe area. */
export function composeRider(eye: Vec3, look: Vec3, rider: Vec3, aspect: number, fov: number, safe = RIDE.safe): Vec3 {
  const inside = (l: Vec3) => { const p = projectView(eye, l, rider, aspect, fov); return p.depth > 0.2 && Math.abs(p.x) <= safe && Math.abs(p.y) <= safe; };
  if (inside(look)) return look;
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inside(lerp3(look, rider, mid))) hi = mid; else lo = mid; }
  return lerp3(look, rider, hi);
}

/** The heading (a body yaw) that faces away from a stop's platform: toward where you are going next on foot. */
export function rideExitHeading(kind: TransportKind, index: number): number {
  const stop = stopAt(kind, index);
  let best: Vec3 = TOWN_SQUARE as Vec3, gap = Math.hypot(stop[0] - TOWN_SQUARE[0], stop[2] - TOWN_SQUARE[2]);
  for (const d of CAMERA_DISTRICTS) {
    const g = Math.hypot(stop[0] - d.at[0], stop[2] - d.at[2]);
    if (g < gap) { gap = g; best = d.at as Vec3; }
  }
  return Math.atan2(best[0] - stop[0], best[2] - stop[2]);
}

type Spring = { x: number; v: number };
function drive(s: Spring, goal: number, w: number, dt: number): void {
  const x0 = s.x - goal, e = Math.exp(-w * dt), j = (s.v + w * x0) * dt;
  s.x = goal + (x0 + j) * e;
  s.v = (s.v - w * j) * e;
  if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) { s.x = goal; s.v = 0; }
}

export function createRideCamera(options: RideCameraOptions = {}): RideCamera {
  const eye = [0, 1, 2].map(() => ({ x: 0, v: 0 })) as [Spring, Spring, Spring];
  const look = [0, 1, 2].map(() => ({ x: 0, v: 0 })) as [Spring, Spring, Spring];
  let out: RideShot = { eye: [0, 0, 0], look: [0, 0, -1], fov: 50, reveal: 0 };

  function finish(input: RideInput, e: Vec3, l: Vec3, reveal: number): RideShot {
    let ex = e[0], ey = e[1], ez = e[2];
    // Over the land.
    if (options.ground) { const floor = options.ground(ex, ez) + 1.2; if (Number.isFinite(floor) && ey < floor) ey = floor; }
    // Out of solids between the rider and the eye (the rider's own cabin is not in the way).
    if (options.blocked) {
      const from = input.rider, span = Math.hypot(ex - from[0], ey - from[1], ez - from[2]);
      // Start the test outside the cabin: 2.6 units out from the rider.
      const skip = Math.min(0.9, 2.6 / Math.max(span, 1e-3));
      const start: Vec3 = lerp3(from, [ex, ey, ez], skip);
      const open = clearFraction(start, [ex, ey, ez], options.blocked, 0.3, 32);
      if (open < 1) { const k = skip + (1 - skip) * open; ex = from[0] + (ex - from[0]) * k; ey = from[1] + (ey - from[1]) * k; ez = from[2] + (ez - from[2]) * k; }
    }
    const drawn: Vec3 = [ex, ey, ez];
    const fov = input.fov + RIDE.revealFov * reveal;
    const aimed = composeRider(drawn, l, input.rider, input.aspect, fov);
    out = { eye: drawn, look: aimed, fov, reveal };
    return out;
  }
  // The springs hold the eye and look-at *relative to the cabin*: the cabin's
  // own speed never makes the camera fall behind, only a change of shot eases.
  function cut(input: RideInput): RideShot {
    const k = rideKeyframe(input), c = input.cabin;
    for (let i = 0; i < 3; i++) { eye[i]!.x = k.eye[i]! - c[i]!; eye[i]!.v = 0; look[i]!.x = k.look[i]! - c[i]!; look[i]!.v = 0; }
    return finish(input, k.eye, k.look, k.reveal);
  }
  return {
    start: cut,
    update(input, dt, reduced) {
      const step = Math.max(0, Math.min(dt, 0.1));
      if (reduced || !(step > 0)) return cut(input);
      const k = rideKeyframe(input), c = input.cabin;
      for (let i = 0; i < 3; i++) { drive(eye[i]!, k.eye[i]! - c[i]!, RIDE.wEye, step); drive(look[i]!, k.look[i]! - c[i]!, RIDE.wLook, step); }
      return finish(input, [c[0] + eye[0].x, c[1] + eye[1].x, c[2] + eye[2].x], [c[0] + look[0].x, c[1] + look[1].x, c[2] + look[2].x], k.reveal);
    },
    shot: () => out,
  };
}
