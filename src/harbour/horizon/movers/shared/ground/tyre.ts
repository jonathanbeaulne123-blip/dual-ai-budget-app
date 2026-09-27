/**
 * The tyre (RIDE §3): one lateral force for carve, slide and twist, the yaw torques that
 * turn the board (steering, self-aligning, the S hold, countersteer assist), the kick-out
 * and the grip state. Pure functions over the kernel state; no allocation in the hot path
 * beyond small frames.
 *
 * Sign conventions: heading 0 faces +z, heading π/2 faces +x; yaw > 0 turns left (heading
 * grows). steer +1 = right (D) → commanded yaw < 0. β = travel heading − axis heading
 * (lead-corrected, in (−π, π]); a right turn that the travel has not followed yet has β > 0.
 */
import type {GroundEvent, GroundInput, GroundProfile, GroundState, XYZ} from './types.ts';

const RAD = Math.PI / 180;
/** Below this tangent speed β is undefined and reads 0. */
export const SLIP_MIN_SPEED = 0.05;
/** Grip under this is "a slide" for events, countersteer assist and the release window. */
export const SLIDE_GRIP = 0.7;
/** kernel: the lead flips when |β| passes 135° — far enough past broadside never to oscillate at 90°. */
export const TWIST_FLIP = 0.75 * Math.PI;
/** kernel: the S hold's servo on |β| (ω ≈ 9 rad/s, ζ ≈ 0.8). */
const HOLD_K = 81, HOLD_D = 14.4;
/** kernel: the countersteer servo on loose wheels (before ×catch; ω ≈ 6 rad/s with it): a countersteered exit from the 40–60° hold bites clean (< cleanExitDeg). */
const CATCH_K = 24, CATCH_D = 8;
/** kernel: stick magnitude under which the stick counts as centred. */
const STICK_DEAD = 0.1;

export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const wrapAngle = (a: number): number => { let r = a % (2 * Math.PI); if (r > Math.PI) r -= 2 * Math.PI; else if (r <= -Math.PI) r += 2 * Math.PI; return r; };
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dot = (a: XYZ, b: XYZ): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The board's frame on a contact normal: axis = nose (lead-corrected) lifted into the tangent plane; side = n × axis (the yaw-positive direction). */
export interface BoardFrame { a: XYZ; l: XYZ; n: XYZ }
export function boardFrame(heading: number, lead: 1 | -1, n: XYZ): BoardFrame {
  const fx = Math.sin(heading), fz = Math.cos(heading), ny = Math.abs(n[1]) > 1e-6 ? n[1] : 1e-6;
  const fy = -(n[0] * fx + n[2] * fz) / ny, m = Math.hypot(fx, fy, fz) || 1;
  const a: XYZ = [lead * fx / m, lead * fy / m, lead * fz / m];
  const l: XYZ = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  return {a, l, n};
}
/** Tangent-plane velocity split. */
export function tangentSpeed(v: XYZ, n: XYZ): number { const vn = dot(v, n); return Math.hypot(v[0] - vn * n[0], v[1] - vn * n[1], v[2] - vn * n[2]); }
export function slipOf(v: XYZ, f: BoardFrame): number {
  const lon = dot(v, f.a), lat = dot(v, f.l);
  return Math.hypot(lon, lat) < SLIP_MIN_SPEED ? 0 : Math.atan2(lat, lon);
}
/** Angle from the nearer home (0 or fakie-straight), 0..π/2. */
export const fromHome = (beta: number): number => Math.min(Math.abs(beta), Math.PI - Math.abs(beta));
/** Yaw sign that points home (the aligning torque's sign): sign(sin 2β). */
export const homeSign = (beta: number): number => Math.sign(Math.sin(2 * beta));

/** G = surfaceGrip · lerp(slideGrip, rollGrip, gripState) (§3.2). */
export const lateralGrip = (surfaceGrip: number, gripState: number, p: GroundProfile): number => surfaceGrip * lerp(p.grip.slide, p.grip.roll, clamp(gripState, 0, 1));

/**
 * The tyre step (§3.2): remove lateral velocity at up to G. When the wheels take all of it
 * (a carve) the velocity is turned onto the axis without losing magnitude — rolling wheels
 * do not scrub; when they cannot (a slide) the remainder stays and the removal is the scrub
 * `G·sin β`. Mutates `v`; returns the lateral acceleration delivered (m/s²).
 */
export function tyreStep(v: XYZ, f: BoardFrame, G: number, dt: number): number {
  const lon = dot(v, f.a), lat = dot(v, f.l);
  const cap = G * dt, d = Math.min(Math.abs(lat), cap), sg = Math.sign(lat);
  if (d === 0) return 0;
  const vn = dot(v, f.n);
  if (Math.abs(lat) <= cap && Math.abs(lon) > 0.5) {
    const m = Math.hypot(lon, lat), k = Math.sign(lon) * m;
    v[0] = f.a[0] * k + f.n[0] * vn; v[1] = f.a[1] * k + f.n[1] * vn; v[2] = f.a[2] * k + f.n[2] * vn;
  } else { v[0] -= f.l[0] * sg * d; v[1] -= f.l[1] * sg * d; v[2] -= f.l[2] * sg * d; }
  return d / dt;
}

/** The rate (yaw sign) at which the tyre is turning the travel direction toward the board this step. */
export const travelYawRate = (beta: number, removal: number, s: number): number =>
  s < 0.3 ? 0 : -homeSign(beta) * removal * Math.abs(Math.cos(beta)) / s;

/** Commanded yaw rate (§3.1): ω = −steer·s/R(s), R = max(r0 + rV·s, s²/(steerLimit·rollGrip)); pivot below pivotSpeed. */
export function commandedYaw(steer: number, s: number, p: GroundProfile): number {
  const R = Math.max(p.steer.radius0 + p.steer.radiusV * s, s * s / (p.grip.steerLimit * p.grip.roll));
  return -steer * (s / R + p.steer.pivotRate * Math.max(0, 1 - s / p.steer.pivotSpeed));
}

/** Kick sense in yaw sign (§3.3): stick → the current yawRate → heelside (+1). Nose in, tail out. */
export function kickSense(steer: number, yawRate: number): 1 | -1 {
  if (steer > STICK_DEAD) return -1;
  if (steer < -STICK_DEAD) return 1;
  if (Math.abs(yawRate) > 0.05) return yawRate > 0 ? 1 : -1;
  return 1;
}

/** Horizontal travel heading (heading convention: atan2(vx, vz)); the pendulum's reference frame. */
export const travelHeading = (v: XYZ): number => Math.atan2(v[0], v[2]);

/** S entry (§3.3): one kick-out impulse per press at s ≥ slideEntrySpeed. */
export function slideEntry(state: GroundState, input: GroundInput, p: GroundProfile, s: number, ev: GroundEvent[]): void {
  const L = state.latch;
  if (!input.slide) { L.kicked = false; L.intoFor = 0; return; }
  if (L.kicked || s < p.grip.slideEntrySpeed) return;
  const dir = kickSense(input.steer, state.yawRate);
  state.yawRate = clamp(state.yawRate + dir * p.grip.kickYaw, -p.steer.yawMax, p.steer.yawMax);
  L.kicked = true; L.intoFor = 0; L.side = dir === 1 ? -1 : 1; anchorSwing(state, p);
  if (!L.sliding) { L.sliding = true; ev.push({kind: 'slideStart', step: state.step, data: {dir}}); }
}

/**
 * The pendulum speed check (kernel; board.md "Braking with S"). A one-sided hold turns the travel toward the
 * nose at G·cosβ/s, so a straight-line S brake walks off a narrow bed. With S held (kicked, at speed) and the
 * stick centred, once the travel has turned more than `pendulumSwing` in the direction the current side drives
 * it (−side) since `swingRef`, the hold's side flips: the servo takes β through 0 to the other side while S keeps
 * grip low (no re-kick), and the reference becomes the travel at the flip. The flip anticipates the travel the
 * board will still turn while it swings through (≈ G·sin|β|/(s·yawMax), at most a quarter swing). While it is
 * active the servo holds ±pendulumAngle (missing = holdAngle) instead of ±holdAngle. The first swing after the kick (or
 * after the stick lets go, a landing or a twist) is measured from half a swing behind that line (`anchorSwing`),
 * so the pendulum swings about the rider's line instead of beside it. With the stick held the hold stays
 * one-sided (a carving slide steers the line) and the anchor follows the travel. Infinity (or a missing field)
 * disables it. Returns true on a flip.
 */
/** kernel: the pendulum's anticipation is capped at this fraction of a swing (it can never chatter). */
const SWING_AHEAD_MAX = 0.25;
export function pendulumStep(state: GroundState, input: GroundInput, p: GroundProfile, s: number, beta: number, G: number): boolean {
  const L = state.latch;
  if (!(input.slide && L.kicked && s > 1)) return false;
  const trav = travelHeading(state.v), swing = p.grip.pendulumSwing * RAD;
  if (!(swing < Infinity)) { L.swingRef = trav; return false; }
  if (Math.abs(input.steer) >= STICK_DEAD) { anchorSwing(state, p); return false; }
  // Anticipation: the travel keeps turning (G·cosβ/s) while the board swings through to 0 at yawMax, ≈ G·sin|β|/(s·yawMax).
  const ahead = Math.min(SWING_AHEAD_MAX * swing, G * Math.abs(Math.sin(beta)) / (s * p.steer.yawMax));
  if (-L.side * wrapAngle(trav - L.swingRef) + ahead <= swing) return false;
  L.side = L.side === 1 ? -1 : 1; L.swingRef = trav;
  return true;
}
/** Anchors the pendulum on the current travel line for the current side: the reference sits half a swing behind it. */
export function anchorSwing(state: GroundState, p: GroundProfile): void {
  const L = state.latch, swing = p.grip.pendulumSwing * RAD;
  L.swingRef = wrapAngle(travelHeading(state.v) + (swing < Infinity ? L.side * swing / 2 : 0));
}

/** Grip state (§3.3): toward 0 at kickOut while S is held at speed, else toward 1 at bite·cos²β. Returns the previous grip. */
export function gripStep(state: GroundState, input: GroundInput, p: GroundProfile, s: number, beta: number, dt: number, ev: GroundEvent[]): number {
  const g0 = state.grip;
  if (input.slide && s >= p.grip.slideEntrySpeed) state.grip = Math.max(0, g0 - p.grip.kickOut * dt);
  else { const c = Math.cos(beta); state.grip = Math.min(1, g0 + p.grip.bite * c * c * dt); }
  if (state.grip < SLIDE_GRIP && !state.latch.sliding) { state.latch.sliding = true; ev.push({kind: 'slideStart', step: state.step, data: {dir: 0}}); }
  if (g0 < SLIDE_GRIP && state.grip >= SLIDE_GRIP && state.latch.sliding) { state.latch.sliding = false; ev.push({kind: 'slideEnd', step: state.step}); }
  return g0;
}

export interface YawTorques { align: number; rider: number; total: number; catchApplied: boolean; hold: boolean; target: number; into: number }
export interface YawContext { s: number; beta: number; G: number; removal: number; dt: number }

/**
 * Yaw torques for one step (rad/s²). Pure: reads state.yawRate / grip / latch, writes nothing.
 * - aligning `A·sin 2β`, A = align·G/rollGrip: toward the nearer of straight and fakie-straight;
 * - S held (kicked, at speed): the back foot servos |β| to holdAngle ± holdDeepen·stick (into
 *   deepens, against shallows) and cancels the aligning torque, so the hold is exact; after
 *   `twistAfter` s of stick held into, the target keeps coming round at twistRate (the twist);
 * - released, loose wheels (grip < 0.7), stick against the rotation: a countersteer servo
 *   taking |β| home relative to the travel line;
 * - otherwise the stick: a servo toward ω_cmd (gain and clamp `yawResponse`), whose authority
 *   over the travel line scales with grip (loose wheels do not steer); centred: `yawDamping`
 *   (relative to the travel line as grip goes, so a released board drifts back on its own time);
 * - countersteer assist ×catch when a stick torque points home while sliding (never centred).
 */
export function yawTorques(state: GroundState, input: GroundInput, p: GroundProfile, c: YawContext): YawTorques {
  const {s, beta, G, removal} = c;
  const A = p.grip.align * G / p.grip.roll;
  const align = s < 0.3 ? 0 : A * Math.sin(2 * beta);
  const wTrav = travelYawRate(beta, removal, s);
  const h = homeSign(beta) || -Math.sign(state.yawRate) || 1;
  const stick = Math.abs(input.steer) >= STICK_DEAD;
  const hold = input.slide && state.latch.kicked && s > 1;
  // > 0 deepens the slide, < 0 steers home. Under the hold "deeper" is measured on the kick's side
  // from the lead's own straight (|β| toward π is the twist); otherwise from the nearer home.
  const side = state.latch.side;
  const into = !stick ? 0 : hold ? input.steer * side : input.steer * h;
  let rider: number, catchApplied = false, target = 0, cancel = 0;
  if (hold) {
    const commit = into > 0.5 ? Math.max(0, state.latch.intoFor - p.grip.twistAfter) * p.grip.twistRate : 0;
    const pendulum = !stick && p.grip.pendulumSwing < Infinity;   // the centred hold swings at pendulumAngle (pendulumStep)
    const base = pendulum ? p.grip.pendulumAngle ?? p.grip.holdAngle : p.grip.holdAngle;
    target = clamp((base + into * p.grip.holdDeepen + commit) * RAD, 0, Math.PI);
    rider = -HOLD_K * (side * target - beta) - HOLD_D * (state.yawRate - wTrav);   // β → side·target, through 0 if the kick changed sides
    cancel = -align;                                     // the back foot balances the wheels' aligning torque
  } else if (stick && into < 0 && state.grip < SLIDE_GRIP && s > 1) {
    // Countersteer on loose wheels: the stick servos the board home relative to the travel line.
    rider = h * CATCH_K * -into * fromHome(beta) - CATCH_D * (state.yawRate - wTrav);
  } else if (stick) {
    const wCmd = commandedYaw(input.steer, s, p);
    const wT = wTrav + clamp(state.grip, 0, 1) * (wCmd - wTrav);
    rider = clamp(p.steer.yawResponse * (wT - state.yawRate), -p.steer.yawResponse, p.steer.yawResponse);
  } else rider = -p.steer.yawDamping * (state.yawRate - (1 - clamp(state.grip, 0, 1)) * wTrav);
  if (stick && into < 0 && rider * h > 0 && (state.grip < SLIDE_GRIP || hold)) { rider *= p.grip.catch; catchApplied = true; }
  rider += cancel;
  return {align, rider, total: align + rider, catchApplied, hold, target, into};
}

/** Integrate the torques into yawRate (clamped at yawMax) and advance the stick-into timer. */
export function yawStep(state: GroundState, input: GroundInput, p: GroundProfile, c: YawContext): YawTorques {
  const t = yawTorques(state, input, p, c);
  state.yawRate = clamp(state.yawRate + t.total * c.dt, -p.steer.yawMax, p.steer.yawMax);
  state.latch.intoFor = t.hold && t.into > 0.5 ? state.latch.intoFor + c.dt : 0;
  return t;
}

/** The twist (§3.5): once |β| passes 135° the lead flips and β re-centres. Returns true on a flip. */
export function twistCheck(state: GroundState, beta: number, ev: GroundEvent[], p: GroundProfile): boolean {
  if (Math.abs(beta) <= TWIST_FLIP) return false;
  state.lead = state.lead === 1 ? -1 : 1;
  state.latch.intoFor = 0; state.latch.side = state.latch.side === 1 ? -1 : 1; anchorSwing(state, p);
  ev.push({kind: 'twist', step: state.step, data: {lead: state.lead}});
  return true;
}
