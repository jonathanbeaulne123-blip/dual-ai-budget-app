/**
 * Hearth Mountain v2 · how the Look camera flies between places (C8, C9).
 *
 * The house's exponential ease (`1 − e^(−7·dt)`) is kind to a small move and
 * brutal to a long one: its first frame moves seven times the whole distance
 * per second, which for a tour hop across the mountain is 700–2,500 units a
 * second. A long move is a **flight** instead:
 *
 * - the eye travels a straight line from where it is to where it is going,
 *   lifted on an arc wherever the terrain (or its clearance) is in the way,
 *   while the look-at point travels its own line — the view turns as it flies;
 * - it is paced by time, not by frame: accelerate, cruise, decelerate, with
 *   the cruise capped at `FLIGHT_SPEED` (under the 120 u/s product limit), so
 *   the duration scales with the distance;
 * - the path is re-parametrised by length, so that cap is the eye's real
 *   speed and not a parameter's;
 * - a turn of the view is given time too, so a short hop with a big re-aim
 *   is not a whip.
 *
 * Reduced motion never flies: the camera cuts (the caller's rule).
 * Pure: no three.js, no DOM, no clock of its own.
 */
import { poseEye, poseFrom, type CourtPose, type Vec3 } from "./poses.ts";

/** Cruise speed of the eye, units per second. The product limit is 120. */
export const FLIGHT_SPEED = 100;
/** Acceleration and deceleration, units per second squared. */
export const FLIGHT_ACCEL = 150;
/** The view may turn at most this fast in a flight, radians per second. */
export const FLIGHT_TURN = 1.6;
export const FLIGHT_MIN = 0.4;
/** How far over the terrain the arc keeps the eye. */
export const FLIGHT_CLEARANCE = 7;
/** Moves whose eye travels less than this ease the house's way (its first frame is then under 7 × 16 = 112 u/s); longer ones fly. */
export const FLIGHT_THRESHOLD = 16;

export type FlightPlan = {
  from: { eye: Vec3; look: Vec3 };
  to: { eye: Vec3; look: Vec3 };
  /** Arc height at the middle of the flight (both eye and look rise by `lift·sin(πu)`). */
  lift: number;
  duration: number;
  /** Path length (with the arc), and a table of cumulative length at even `u`. */
  length: number;
  table: number[];
};

const N = 40;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const at = (plan: Pick<FlightPlan, "from" | "to" | "lift">, u: number): { eye: Vec3; look: Vec3 } => {
  const k = Math.sin(Math.PI * u) * plan.lift;
  return {
    eye: [lerp(plan.from.eye[0], plan.to.eye[0], u), lerp(plan.from.eye[1], plan.to.eye[1], u) + k, lerp(plan.from.eye[2], plan.to.eye[2], u)],
    look: [lerp(plan.from.look[0], plan.to.look[0], u), lerp(plan.from.look[1], plan.to.look[1], u) + k, lerp(plan.from.look[2], plan.to.look[2], u)],
  };
};

/** Distance covered after `t` seconds of an accelerate–cruise–decelerate run of `length`. */
export function flightDistance(length: number, t: number, speed = FLIGHT_SPEED, accel = FLIGHT_ACCEL): number {
  if (!(length > 0)) return 0;
  const ramp = speed / accel, rampLength = 0.5 * accel * ramp * ramp;
  if (2 * rampLength >= length) {
    // Never reaches the cruise: a triangle.
    const half = Math.sqrt(length / accel), peak = accel * half;
    if (t <= half) return 0.5 * accel * t * t;
    const d = Math.min(t - half, half);
    return Math.min(length, length / 2 + peak * d - 0.5 * accel * d * d);
  }
  const cruise = (length - 2 * rampLength) / speed;
  if (t <= ramp) return 0.5 * accel * t * t;
  if (t <= ramp + cruise) return rampLength + speed * (t - ramp);
  const d = Math.min(t - ramp - cruise, ramp);
  return Math.min(length, length - rampLength + speed * d - 0.5 * accel * d * d);
}
/** How long that run takes. */
export function flightTime(length: number, speed = FLIGHT_SPEED, accel = FLIGHT_ACCEL): number {
  if (!(length > 0)) return 0;
  const ramp = speed / accel, rampLength = 0.5 * accel * ramp * ramp;
  if (2 * rampLength >= length) return 2 * Math.sqrt(length / accel);
  return 2 * ramp + (length - 2 * rampLength) / speed;
}

const angleBetween = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): number => {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - c[0], vy = d[1] - c[1], vz = d[2] - c[2];
  const lu = Math.hypot(ux, uy, uz) || 1, lv = Math.hypot(vx, vy, vz) || 1;
  return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (lu * lv))));
};

/**
 * Plan a flight between two poses (their drawn eyes and look-at points).
 * `ground` lifts the arc over the land; omit it for open sky or a room.
 */
export function planFlight(fromPose: CourtPose, toPose: CourtPose, ground?: (x: number, z: number) => number): FlightPlan {
  const from = { eye: poseEye(fromPose), look: fromPose.target };
  const to = { eye: poseEye(toPose), look: toPose.target };
  let lift = 0;
  if (ground) {
    for (let i = 1; i < N; i++) {
      const u = i / N, p = at({ from, to, lift: 0 }, u);
      const need = ground(p.eye[0], p.eye[2]) + FLIGHT_CLEARANCE - p.eye[1];
      if (Number.isFinite(need) && need > 0) lift = Math.max(lift, need / Math.max(0.25, Math.sin(Math.PI * u)));
    }
    lift = Math.min(lift, 160);
  }
  const table = [0];
  let length = 0, previous = at({ from, to, lift }, 0).eye;
  for (let i = 1; i <= N; i++) {
    const eye = at({ from, to, lift }, i / N).eye;
    length += Math.hypot(eye[0] - previous[0], eye[1] - previous[1], eye[2] - previous[2]);
    table.push(length);
    previous = eye;
  }
  const turn = angleBetween(from.eye, from.look, to.eye, to.look);
  const duration = Math.max(FLIGHT_MIN, flightTime(length), turn / FLIGHT_TURN);
  return { from, to, lift, duration, length, table };
}

/** Where the flight is `t` seconds in: the pose (for the hand) and its eye and look-at point (for the lens). */
export function flightAt(plan: FlightPlan, t: number): { pose: CourtPose; eye: Vec3; look: Vec3; done: boolean } {
  const done = t >= plan.duration;
  let u = 1;
  if (!done) {
    const natural = flightTime(plan.length);
    // A turn-limited flight is slower than its run: stretch the run to fill it.
    const s = plan.length > 1e-6 ? flightDistance(plan.length, (t / plan.duration) * natural) : 0;
    if (plan.length > 1e-6) {
      let i = 1;
      while (i < N && plan.table[i]! < s) i++;
      const a = plan.table[i - 1]!, b = plan.table[i]!;
      u = (i - 1 + (b > a ? (s - a) / (b - a) : 0)) / N;
    } else {
      const x = t / plan.duration;
      u = x * x * (3 - 2 * x);
    }
  }
  const p = at(plan, Math.max(0, Math.min(1, u)));
  return { pose: poseFrom(p.eye, p.look), eye: p.eye, look: p.look, done };
}
