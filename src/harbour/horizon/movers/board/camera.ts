/**
 * The board's follow camera (RIDE §10.2). Skate v2's chase numbers and its critically damped
 * springs (camera/skateCamera.ts — the numbers are reused here, the file is not) with RIDE's
 * two changes: roll is 0 at every tier, and the yaw target is the velocity direction, not the
 * board's heading — so a slide turns the board across the screen while the world keeps
 * flowing straight past.
 *
 * Pure over (state, dt, flags) plus its own spring state; no three, no DOM, no clock. Every
 * spring is solved exactly per call, so the camera is frame-rate independent.
 *
 * Obstruction (the skate cam's pull-in): with a `blocked(from, to)` probe (the geography's
 * `cameraBlocked`), the eye is pulled in along the target → eye line until the rider is in
 * sight; the eye is clamped to stay 0.6 above the terrain (`ground`) only when the rider is
 * above ground there, so in a culvert or under a deck it stays inside with the rider. The
 * pull-in is stateless per frame (no spring), so it stays frame-rate independent.
 */
import type {GroundEvent, GroundState, XYZ} from '../shared/ground/types.ts';
import {groundSpeed} from '../shared/ground/kernel.ts';

export const BOARD_CAM = Object.freeze({
  near: {dist: 2.5, height: 0.52},
  far: {dist: 3.35, height: 0.95},
  /** Target above the board (chest) and the eye's base lift above the board (skate cam: lookUp · 0.35). */
  lookUp: 0.85, eyeLift: 0.85 * 0.35,
  /** Look-ahead along velocity: seconds of travel, capped in metres. */
  leadTime: 0.16, leadMax: 1.1,
  fovRest: 54, fovFast: 72, fastSpeed: 11,
  /** Boost kick: +4° over 0.3 s (full tier only). */
  kickFov: 4, kickTime: 0.3,
  /** Spring angular frequencies (rad/s). */
  wFocus: 11, wFocusY: 7, wYaw: 4.2, wFrame: 3.2, wFov: 3,
  /** Yaw pans, never whips (skate cam yawRateMax). */
  yawRateMax: 3.4,
  /** Below this speed the yaw follows the board's heading instead of the velocity. */
  velocityYawMin: 0.5,
  /** Free look springs back over ~1.5 s (settle ≈ 4.6/ω). */
  wLookBack: 4.6 / 1.5, lookPitchMin: -0.6, lookPitchMax: 0.9,
  /** The eye stays at least this far above the terrain. */
  groundClearance: 0.6,
  /** Pull-in: the eye is drawn toward the target in these steps, no closer than `pullMin` of the distance. */
  pullStep: 0.08, pullMin: 0.12,
  /** The rider is underground (a culvert, under a deck) when the target is this far below the terrain. */
  underground: 0.3,
});

export interface BoardCameraFlags { reducedMotion: boolean; calm: boolean; tier: 'full' | 'lite' }
/** `kick` is the boost kick's share of `fov` (degrees, 0 when none); `yaw` the camera's look heading. */
export interface BoardCameraFrame { eye: XYZ; target: XYZ; fov: number; roll: number; yaw: number; kick: number }
export interface BoardCamera {
  /** One frame: `events` are the kernel events since the last call, `look` the free-look delta this frame (radians). */
  update(state: GroundState, events: readonly GroundEvent[], look: { dx: number; dy: number }, dt: number, flags: BoardCameraFlags): BoardCameraFrame;
  /** Cut: every spring on its goal (enter, fade back, bail recovery). */
  snap(state: GroundState, flags: BoardCameraFlags): BoardCameraFrame;
  /** The last frame (the same object `update` returns). */
  frame(): BoardCameraFrame;
}

type Spring = { x: number; v: number };
const spring = (x = 0): Spring => ({x, v: 0});
/** Exact critically damped step toward a fixed goal (the skate cam's `drive`). */
function drive(s: Spring, goal: number, w: number, dt: number): void {
  if (!(dt > 0)) return;
  const x0 = s.x - goal, v0 = s.v, e = Math.exp(-w * dt), j = (v0 + w * x0) * dt;
  s.x = goal + (x0 + j) * e;
  s.v = (v0 - w * j) * e;
  if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) { s.x = goal; s.v = 0; }
}
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
function driveAngle(s: Spring, goal: number, w: number, dt: number, rateMax: number): void {
  drive(s, s.x + wrap(goal - s.x), w, dt);
  if (s.v > rateMax) s.v = rateMax; else if (s.v < -rateMax) s.v = -rateMax;
  if (Math.abs(s.x) > 1e4) s.x = wrap(s.x);
}
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const smooth = (t: number): number => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };

/** The camera's settled framing for a state (no springs): what `snap` and every spring aim at. */
export function cameraGoal(state: GroundState, flags: BoardCameraFlags): { focus: XYZ; yaw: number; dist: number; height: number; fov: number } {
  const C = BOARD_CAM, s = groundSpeed(state), v = state.v, k = smooth(s / C.fastSpeed);
  const still = flags.reducedMotion || flags.calm || flags.tier === 'lite';
  const dolly = still ? 0.5 : 1;
  const hs = Math.hypot(v[0], v[2]), lead = Math.min(C.leadTime * hs, C.leadMax);
  const lx = hs > 1e-6 ? v[0] / hs * lead : 0, lz = hs > 1e-6 ? v[2] / hs * lead : 0;
  const nose = state.heading + (state.lead === 1 ? 0 : Math.PI);
  const yaw = hs >= C.velocityYawMin ? Math.atan2(v[0], v[2]) : nose;
  return {
    focus: [state.p[0] + lx, state.p[1], state.p[2] + lz], yaw,
    dist: C.near.dist + (C.far.dist - C.near.dist) * k * dolly,
    height: C.near.height + (C.far.height - C.near.height) * k * dolly,
    fov: still ? C.fovRest : C.fovRest + (C.fovFast - C.fovRest) * k,
  };
}

export function createBoardCamera(ground?: (x: number, z: number) => number, blocked?: (from: XYZ, to: XYZ) => boolean): BoardCamera {
  const C = BOARD_CAM;
  const fx = spring(), fy = spring(), fz = spring(), yaw = spring(), dist = spring(C.near.dist), height = spring(C.near.height), fov = spring(C.fovRest);
  const lookYaw = spring(), lookPitch = spring();
  let kick = -1;   // seconds into the boost kick, −1 = none
  const out: BoardCameraFrame = {eye: [0, 0, 0], target: [0, 0, 0], fov: C.fovRest, roll: 0, yaw: 0, kick: 0};

  function compose(flags: BoardCameraFlags): BoardCameraFrame {
    const cy = yaw.x + lookYaw.x, cp = lookPitch.x;
    const d = dist.x * Math.cos(cp);
    const tx = fx.x, ty = fy.x + C.lookUp, tz = fz.x;
    let ex = tx - Math.sin(cy) * d, ez = tz - Math.cos(cy) * d;
    let ey = fy.x + C.eyeLift + height.x + dist.x * Math.sin(cp);
    const gt = ground ? ground(tx, tz) : NaN, under = Number.isFinite(gt) && ty < gt - C.underground;
    if (ground && !under) { const g = ground(ex, ez); if (Number.isFinite(g) && ey < g + C.groundClearance) ey = g + C.groundClearance; }
    if (blocked) {
      // The skate cam's pull-in: the nearest unblocked eye on the target → eye line.
      const target: XYZ = [tx, ty, tz], ox = ex - tx, oy = ey - ty, oz = ez - tz;
      let f = 1;
      while (f > C.pullMin && blocked(target, [tx + ox * f, ty + oy * f, tz + oz * f])) f -= C.pullStep;
      if (f < 1) { ex = tx + ox * f; ey = ty + oy * f; ez = tz + oz * f; }
    }
    const kicking = kick >= 0 && kick <= C.kickTime && flags.tier === 'full' && !flags.reducedMotion && !flags.calm;
    out.eye[0] = ex; out.eye[1] = ey; out.eye[2] = ez;
    out.target[0] = tx; out.target[1] = ty; out.target[2] = tz;
    out.kick = kicking ? C.kickFov * Math.sin(Math.PI * kick / C.kickTime) : 0;
    out.fov = fov.x + out.kick;
    out.roll = 0;   // RIDE §10.2: roll 0 at every tier
    out.yaw = wrap(yaw.x);
    return out;
  }

  return {
    update(state, events, look, dt, flags) {
      const g = cameraGoal(state, flags);
      const h = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
      drive(fx, g.focus[0], C.wFocus, h); drive(fz, g.focus[2], C.wFocus, h); drive(fy, g.focus[1], C.wFocusY, h);
      driveAngle(yaw, g.yaw, C.wYaw, h, C.yawRateMax);
      drive(dist, g.dist, C.wFrame, h); drive(height, g.height, C.wFrame, h);
      drive(fov, g.fov, C.wFov, h);
      // Free look: an offset added by the pointer / Look pad that springs back behind the rider.
      if (Number.isFinite(look.dx)) lookYaw.x += look.dx;
      if (Number.isFinite(look.dy)) lookPitch.x = clamp(lookPitch.x + look.dy, C.lookPitchMin, C.lookPitchMax);
      drive(lookYaw, 0, C.wLookBack, h); drive(lookPitch, 0, C.wLookBack, h);
      if (kick >= 0) { kick += h; if (kick > C.kickTime) kick = -1; }
      if (events.some(e => e.kind === 'boost') && flags.tier === 'full' && !flags.reducedMotion && !flags.calm) kick = 0;
      return compose(flags);
    },
    snap(state, flags) {
      const g = cameraGoal(state, flags);
      for (const [s, x] of [[fx, g.focus[0]], [fy, g.focus[1]], [fz, g.focus[2]], [yaw, g.yaw], [dist, g.dist], [height, g.height], [fov, g.fov], [lookYaw, 0], [lookPitch, 0]] as const) { s.x = x; s.v = 0; }
      kick = -1;
      return compose(flags);
    },
    frame: () => out,
  };
}
