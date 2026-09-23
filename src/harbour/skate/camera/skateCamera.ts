/**
 * Tideline Skate Club v2 — the skate chase camera.
 *
 * A low, wide chase camera at island scale (a person is 1.25 tall) that sells
 * speed the way a skate game does, without owning the renderer: it turns
 * `SkatePresent` + this frame's `SkateSimEvent`s into an eye, a look-at point,
 * a vertical FOV and a roll. The runtime writes those onto its
 * PerspectiveCamera (see hud/NOTES-show.md for the exact plumbing).
 *
 * Everything is a critically damped spring solved exactly per step, so the
 * camera is frame-rate independent and never overshoots. No THREE, no
 * allocation in `update` (the returned frame object is reused — copy it if
 * you need to keep it).
 */
import type {SkatePhase, SkatePresent, SkateSimEvent} from '../contract.ts';
import {publishRiderAnchor} from './anchor.ts';

export type Vec3 = [number, number, number];
export type SkateCameraFrame = {position: Vec3; target: Vec3; fov: number; roll: number};
export type SkateCameraDistance = 'near' | 'far';
export type SkateCameraMode = 'chase' | 'air' | 'vert' | 'grind' | 'manual' | 'slide' | 'bail';
export type SkateCameraEnv = {
  aspect: number;
  reducedMotion?: boolean;
  /** Optional solid-geometry probe: true when (x,y,z) is inside something the eye must not enter. */
  blocked?: (x: number, y: number, z: number) => boolean;
};
export type SkateCameraOptions = {
  distance?: SkateCameraDistance;
  /** Ground height under a point — keeps the eye above the island. */
  ground?: (x: number, z: number) => number;
  /** FOV at rest and at full speed, degrees (vertical, landscape). */
  fovRest?: number; fovFast?: number;
  /** Speed (units/s) at which the FOV and dolly reach their widest. */
  fastSpeed?: number;
  /** Starting gravity estimate for landing prediction (refined online from vy). */
  gravity?: number;
};
export type SkateCamera = {
  update(present: SkatePresent, events: readonly SkateSimEvent[], dt: number, env: SkateCameraEnv): SkateCameraFrame;
  /** Cut: put every spring on its goal at once (respawn, spot jump, route start). Uses the last present seen. */
  snap(present?: SkatePresent): void;
  setDistance(distance: SkateCameraDistance): void;
  /** A drag look-around in pixels; it springs back behind the rider while rolling. */
  orbit(dx: number, dy: number): void;
  /** The camera's current heading (xz yaw it looks along). Useful as a walking basis on exit. */
  heading(): number;
  mode(): SkateCameraMode;
  /** Last frame (same object `update` returns). */
  frame(): SkateCameraFrame;
};

/* ---------------------------------------------------------------- tuning */
export const SKATE_CAM = Object.freeze({
  /** Skate-game chase: low (eye about the rider's shoulder) and close. */
  near: {dist: 2.5, height: 0.52},
  far: {dist: 3.35, height: 0.95},
  /** Extra pull-back at full speed. */
  speedDolly: 0.6,
  /** Where the eye looks, above the board (chest): the rider stands in the lower middle — head near 38 %, board near 82 % — and the top band stays clear. */
  lookUp: 0.85,
  /** Portrait screens: further back (the frame is narrow) and aimed a touch lower, so the rider sits above the thumbs. */
  portraitDist: 0.1, portraitAim: -0.34, portraitFov: 10,
  /** Look-ahead along velocity: seconds of travel, capped in units. */
  leadTime: 0.16, leadMax: 1.1,
  fovRest: 54, fovFast: 72, fastSpeed: 11,
  /** Spring angular frequencies (rad/s); ≈ settle time 4.6/ω. */
  wFocus: 11, wFocusY: 7, wYaw: 4.2, wFrame: 3.2, wFov: 3, wRoll: 5,
  /** Yaw only chases the travel heading above this horizontal speed. */
  yawSpeedLo: 0.35, yawSpeedHi: 2.4,
  /** Maximum camera yaw rate (rad/s) — a pan, never a whip. */
  yawRateMax: 3.4,
  /** Air: how much of the rise the focus follows, how far the eye lifts per unit of clearance, share of the way to the landing. */
  airFollow: 0.72, airRise: 0.26, airLandingShare: 0.38,
  /** Transitions and vert: swing this far round (rad) and back off, eye a little under the rider so it looks up. */
  vertSide: 0.95, vertLift: -0.3, vertDist: 1.1, climbLo: 0.45, climbHi: 0.85,
  grindSide: 0.9, grindDrop: -0.08, manualDrop: -0.18, slideSide: 0.35,
  bailOrbit: 0.32, bailDist: 0.7, bailSlow: 0.45, bailLift: 0.35,
  roll: 0.045, impactFov: 3.5, impactDip: 0.05,
  minLift: 0.28,
  /** Rider height used for the on-screen anchor (head) — a person is 1.25. */
  headHeight: 1.18,
});

/* ---------------------------------------------------------------- springs */
type Spring = {x: number; v: number};
const spring = (x = 0): Spring => ({x, v: 0});
/** Exact critically damped step toward a fixed goal. Frame-rate independent. */
function drive(s: Spring, goal: number, w: number, dt: number): void {
  if (!(dt > 0)) return;
  const x0 = s.x - goal, v0 = s.v, e = Math.exp(-w * dt), j = (v0 + w * x0) * dt;
  s.x = goal + (x0 + j) * e;
  s.v = (v0 - w * j) * e;
  if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) { s.x = goal; s.v = 0; }
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Angular spring: the goal is taken as the nearest equivalent angle, the rate optionally capped. */
function driveAngle(s: Spring, goal: number, w: number, dt: number, rateMax = Infinity): void {
  const g = s.x + wrap(goal - s.x);
  drive(s, g, w, dt);
  if (s.v > rateMax) s.v = rateMax; else if (s.v < -rateMax) s.v = -rateMax;
  if (Math.abs(s.x) > 1e4) s.x = wrap(s.x);
}
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const fin = (v: number, or = 0) => (Number.isFinite(v) ? v : or);
const smooth = (lo: number, hi: number, v: number) => { const t = clamp((v - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t); };

const PHASE_MODE: Record<SkatePhase, SkateCameraMode> = {
  idle: 'chase', push: 'chase', roll: 'chase', crouch: 'chase', land: 'chase', recover: 'chase',
  air: 'air', grind: 'grind', manual: 'manual', powerslide: 'slide', bail: 'bail',
};

export function createSkateCamera(options: SkateCameraOptions = {}): SkateCamera {
  const C = SKATE_CAM;
  const fovRest = options.fovRest ?? C.fovRest, fovFast = options.fovFast ?? C.fovFast;
  const fastSpeed = options.fastSpeed ?? C.fastSpeed;
  const ground = options.ground;
  let distance: SkateCameraDistance = options.distance ?? 'near';
  let gravity = options.gravity ?? 14;

  // Focus (what the camera orbits: the rider, eased) and framing parameters.
  const fx = spring(), fy = spring(), fz = spring();
  const yaw = spring(), dist = spring(C.near.dist), height = spring(C.near.height), side = spring();
  const lead = [spring(), spring(), spring()] as const;
  const fov = spring(fovRest), roll = spring(), lift = spring(), pull = spring(1), floor = spring();
  const vertBlend = spring(), orbitYaw = spring(), orbitPitch = spring();

  let mode: SkateCameraMode = 'chase';
  let started = false, last: SkatePresent | null = null;
  let airYaw = 0, airStartY = 0, airVert = false, vertSide = 1, prevVy = 0, airFrames = 0;
  /** A climb up a transition: the heading we came in on, and whether we are on the wall now. */
  let wallYaw = 0, onWall = false;
  let seenX = 0, seenZ = 0, floorGoal = 0, pullGoal = 1, lastReduced = false, lastAspect = 1.6, landX = 0, landZ = 0, landDirX = 0, landDirZ = 0;
  let bailClock = 0, bailYaw = 0, impactKick = 0, userYaw = 0, userPitch = 0;
  const out: SkateCameraFrame = {position: [0, 0, 0], target: [0, 0, 0], fov: fovRest, roll: 0};

  const hSpeed = (p: SkatePresent) => Math.hypot(fin(p.vx), fin(p.vz));
  const travelYaw = (p: SkatePresent) => {
    const hs = hSpeed(p);
    if (hs > 0.3 || (!Number.isFinite(p.heading) && hs > 1e-4)) return Math.atan2(fin(p.vx), fin(p.vz));
    return Number.isFinite(p.heading) ? p.heading : yaw.x;
  };
  /** How much of the motion is straight up a wall (−1 down … +1 up). */
  const climb = (p: SkatePresent) => { const vx = fin(p.vx), vy = fin(p.vy), vz = fin(p.vz); return vy / Math.max(0.8, Math.hypot(vx, vy, vz)); };

  /** Goals for this present; written into `goal` scratch. */
  const goal: Record<'fx' | 'fy' | 'fz' | 'yaw' | 'dist' | 'height' | 'side' | 'fov' | 'roll' | 'lift' | 'lx' | 'ly' | 'lz' | 'vert' | 'aim' | 'wYaw' | 'wFocus' | 'wFocusY' | 'wFrame', number> = {fx: 0, fy: 0, fz: 0, yaw: 0, dist: 0, height: 0, side: 0, fov: 0, roll: 0, lift: 0, lx: 0, ly: 0, lz: 0, vert: 0, aim: 0, wYaw: C.wYaw, wFocus: C.wFocus, wFocusY: C.wFocusY, wFrame: C.wFrame};
  let aim = 0;

  function computeGoals(p: SkatePresent, reduced: boolean, aspect: number): void {
    const base = distance === 'far' ? C.far : C.near;
    const x = fin(p.x), y = fin(p.y), z = fin(p.z), vx = fin(p.vx), vy = fin(p.vy), vz = fin(p.vz);
    const hs = Math.hypot(vx, vz), speedK = smooth(0.5, fastSpeed, fin(p.speed, hs));
    const portrait = clamp((1.25 - fin(aspect, 1.6)) / 0.8, 0, 1);
    // Velocity feed-forward: a critically damped spring chasing a moving point lags by 2v/ω; aim ahead by that so the rider stays framed.
    goal.fx = x + vx * 2 / C.wFocus; goal.fz = z + vz * 2 / C.wFocus;
    goal.fy = y + clamp(vy * 2 / C.wFocusY, -0.3, 1.2);
    goal.dist = base.dist * (1 + portrait * C.portraitDist) + speedK * C.speedDolly * (reduced ? 0.5 : 1);
    goal.height = base.height;
    goal.side = 0; goal.lift = 0; goal.vert = 0; goal.roll = 0; goal.aim = portrait * C.portraitAim;
    goal.wYaw = C.wYaw; goal.wFocus = C.wFocus; goal.wFocusY = C.wFocusY; goal.wFrame = C.wFrame;
    goal.fov = (reduced ? fovRest : fovRest + (fovFast - fovRest) * speedK) + portrait * C.portraitFov;
    // Look-ahead along velocity (never along the board nose: fakie stays put).
    const leadK = Math.min(C.leadMax, hs * C.leadTime) / Math.max(hs, 1e-6);
    goal.lx = vx * leadK; goal.ly = 0; goal.lz = vz * leadK;
    // Yaw: chase travel, but only as firmly as there is travel to chase.
    const follow = smooth(C.yawSpeedLo, C.yawSpeedHi, hs);
    goal.yaw = follow > 0 ? travelYaw(p) : yaw.x;
    goal.wYaw = C.wYaw * (0.15 + 0.85 * follow);
    if (!reduced) goal.roll = -clamp(fin(p.carve), -1, 1) * C.roll * speedK;

    // Up a transition (quarterpipe, bowl wall): hold the heading we came in on and swing round to
    // the side as the ride turns vertical, so the fakie return is two quarter pans, not a whip.
    if (mode !== 'air' && mode !== 'bail') {
      const up = smooth(C.climbLo, C.climbHi, climb(p));
      if (up > 0.02) {
        if (!onWall) { onWall = true; wallYaw = yaw.x; vertSide = side.x < -0.05 ? -1 : 1; }
        goal.vert = up; goal.lx *= 1 - up; goal.lz *= 1 - up;
        goal.yaw = reduced ? wallYaw : wallYaw + vertSide * C.vertSide * up; goal.wYaw = C.wYaw * 0.8;
        goal.wFocusY = C.wFocusY * 1.5;
      } else if (climb(p) < 0.1) onWall = false;
    }

    switch (mode) {
      case 'air': {
        goal.yaw = airYaw; goal.wYaw = C.wYaw * 0.6;
        // Predict the landing on a flat at the surface we left from, then frame between rider and landing.
        const ground0 = y - Math.max(0, fin(p.clearance));
        const g = Math.max(4, gravity), disc = vy * vy + 2 * g * Math.max(0, y - ground0);
        const tLand = clamp((vy + Math.sqrt(Math.max(0, disc))) / g, 0, 2.5);
        const lx = vx * tLand, lz = vz * tLand;
        landX = x + lx; landZ = z + lz; landDirX = hs > 1e-3 ? vx / hs : 0; landDirZ = hs > 1e-3 ? vz / hs : 0;
        // Net of the focus feed-forward, so the target sits between rider and landing, never past it.
        goal.lx = lx * C.airLandingShare - vx * 2 / C.wFocus; goal.lz = lz * C.airLandingShare - vz * 2 / C.wFocus;
        // The eye rises less than the rider (a look up at the air); the focus follows most of the rise.
        const rise = y - airStartY;
        goal.fy = rise > 0 ? airStartY + rise * C.airFollow : y + clamp(vy * 2 / C.wFocusY, -1.2, 0);
        goal.ly = Math.max(0, ground0 - goal.fy) * C.airLandingShare;
        goal.lift = Math.min(1.4, Math.max(0, fin(p.clearance)) * C.airRise);
        goal.wFocusY = C.wFocusY * 0.8;
        if (airVert) {
          goal.vert = 1; goal.fy = y + clamp(vy * 2 / (C.wFocusY * 1.5), -1, 1); goal.wFocusY = C.wFocusY * 1.5;
          goal.lx = 0; goal.lz = 0; goal.ly = 0; goal.lift = 0;
          goal.yaw = reduced ? airYaw : airYaw + vertSide * C.vertSide; goal.wYaw = C.wYaw * 0.8;
        }
        break;
      }
      case 'grind': goal.side = C.grindSide * (p.grind?.faceSign ?? 1); goal.lift = C.grindDrop; break;
      case 'manual': goal.lift = C.manualDrop; break;
      case 'slide': goal.side = C.slideSide * (fin(p.carve) >= 0 ? 1 : -1); break;
      case 'bail': {
        // Slow everything down and hold the tumble; back off, lift, and drift gently round it.
        const k = reduced ? 1 : C.bailSlow;
        goal.wFocus = C.wFocus * k; goal.wFocusY = C.wFocusY * k; goal.wFrame = C.wFrame * k;
        goal.fx = x + vx * 2 / (C.wFocus * k); goal.fz = z + vz * 2 / (C.wFocus * k); goal.fy = y;
        goal.yaw = reduced ? bailYaw : bailYaw + Math.min(bailClock, 2.5) * C.bailOrbit;
        goal.wYaw = C.wYaw * 0.5;
        goal.dist += C.bailDist; goal.lift = C.bailLift; goal.lx = goal.lz = 0;
        goal.fov = fovRest + portrait * C.portraitFov;
        break;
      }
      default: break;
    }
    if (reduced) { goal.roll = 0; goal.wYaw *= 0.7; goal.wFrame *= 0.7; goal.vert = 0; }
  }

  function enterMode(next: SkateCameraMode, p: SkatePresent): void {
    if (next === mode) return;
    if (next === 'air') {
      const hs = hSpeed(p), vy = fin(p.vy);
      airVert = vy > 1 && hs < vy * 0.6;
      // Off a wall the heading we climbed on is the one to hold; otherwise keep the camera's own.
      airYaw = onWall ? wallYaw : mode === 'chase' || mode === 'manual' || mode === 'slide' || mode === 'grind' ? yaw.x : travelYaw(p);
      if (!onWall && hs > C.yawSpeedHi) airYaw = travelYaw(p);
      if (airVert && !onWall) vertSide = side.x < -0.05 ? -1 : 1;
      airStartY = fin(p.y) - Math.max(0, fin(p.clearance));
      airFrames = 0; prevVy = vy;
    }
    if (mode === 'air') onWall = false;
    if (next === 'bail') { bailClock = 0; bailYaw = yaw.x; }
    mode = next;
  }

  function place(reduced: boolean, env: SkateCameraEnv | null): void {
    const vb = vertBlend.x;
    const camYaw = yaw.x + orbitYaw.x;
    const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
    let tx = fx.x + lead[0].x, tz = fz.x + lead[2].x;
    if (mode === 'air' && !airVert) {
      // Never aim past the predicted landing along the travel direction.
      const over = (tx - landX) * landDirX + (tz - landZ) * landDirZ;
      if (over > 0) { tx -= over * landDirX; tz -= over * landDirZ; }
    }
    let ty = fy.x + C.lookUp + aim + lead[1].x + lift.x * 0.5 + vb * 0.3;
    // The rider's middle: where the eye must always have a clear line to.
    const cx = fx.x, cy0 = fy.x + C.lookUp, cz = fz.x;
    // Look-ahead must not aim into a ramp face: shorten it until the aim point is in open air.
    if (env?.blocked) for (let k = 0; k < 4 && env.blocked(tx, ty, tz); k++) { tx = cx + (tx - cx) * 0.5; ty = cy0 + (ty - cy0) * 0.5; tz = cz + (tz - cz) * 0.5; }
    const r = (dist.x + vb * C.vertDist) * pull.x;
    const h = (height.x + lift.x + vb * C.vertLift + orbitPitch.x) * pull.x;
    // Eye: behind the travel heading, lifted, drifted sideways.
    let ex = fx.x - sy * r + cy * side.x, ez = fz.x - cy * r - sy * side.x;
    let ey = fy.x + C.lookUp * 0.35 + h - (reduced ? 0 : impactKick * C.impactDip);
    if (ground) { const g0 = fin(ground(ex, ez), -Infinity) + C.minLift; if (ey < g0) ey = g0; }
    // Something between the rider and the eye (a ramp behind, a bowl lip): crane up first, then pull in.
    // The crane goes up at once and eases back down; the pull-in keeps a floor so the board stays in shot.
    const solid = env?.blocked;
    if (solid) {
      const lineClear = (lift0: number): number => {
        const py0 = ey + lift0;
        if (solid(ex, py0 - 0.12, ez)) return 0;
        for (let i = 1; i <= 6; i++) {
          const t = i / 6;
          if (solid(cx + (ex - cx) * t, cy0 + (py0 - cy0) * t, cz + (ez - cz) * t)) return (i - 1) / 6;
        }
        return 1;
      };
      let rise = 0, clear = lineClear(0);
      for (const up of [0.3, 0.6, 0.9, 1.2]) { if (clear >= 1) break; const c = lineClear(up); if (c >= 1 || c > clear + 0.3) { rise = up; clear = c; } }
      if (rise > floor.x) { floor.x = rise; floor.v = 0; }
      floorGoal = rise;
      ey += floor.x;
      if (clear < 1) {
        const span = Math.hypot(ex - cx, ey - cy0, ez - cz), hard = Math.max(0.05, clear - 0.04), soft = Math.max(hard, Math.min(1, 1.7 / Math.max(span, 1e-3)));
        const k = soft > hard && !solid(cx + (ex - cx) * soft, cy0 + (ey - cy0) * soft - 0.12, cz + (ez - cz) * soft) ? soft : hard;
        ex = cx + (ex - cx) * k; ey = cy0 + (ey - cy0) * k; ez = cz + (ez - cz) * k;
        if (k < pull.x) { pull.x = Math.max(k, pull.x * 0.5 + k * 0.5); pull.v = 0; }
        pullGoal = Math.max(0.7, k);
      } else pullGoal = 1;
    } else { pullGoal = 1; floorGoal = 0; ey += floor.x; }
    out.position[0] = ex; out.position[1] = ey; out.position[2] = ez;
    out.target[0] = tx; out.target[1] = ty; out.target[2] = tz;
    out.fov = fov.x + (reduced ? 0 : impactKick * C.impactFov);
    out.roll = reduced ? 0 : roll.x;
    if (last) {
      const px = fin(last.x), py = fin(last.y), pz = fin(last.z);
      const head = projectToView(out, [px, py + C.headHeight, pz], lastAspect), board = projectToView(out, [px, py + 0.05, pz], lastAspect);
      publishRiderAnchor(head && board ? {head, board} : null);
    }
  }
  function cut(p: SkatePresent, reduced: boolean, aspect: number): void {
    onWall = false;
    enterMode(PHASE_MODE[p.phase] ?? 'chase', p);
    if (mode === 'air') airYaw = travelYaw(p);
    const y0 = travelYaw(p);
    yaw.x = y0; yaw.v = 0; airYaw = y0; bailYaw = y0; wallYaw = y0;
    computeGoals(p, reduced, aspect);
    const set = (s: Spring, v: number) => { s.x = v; s.v = 0; };
    set(fx, goal.fx); set(fy, goal.fy); set(fz, goal.fz); set(dist, goal.dist); set(height, goal.height);
    set(side, goal.side); set(fov, goal.fov); set(roll, goal.roll); set(lift, goal.lift); set(pull, 1); set(floor, 0);
    set(lead[0], goal.lx); set(lead[1], goal.ly); set(lead[2], goal.lz); set(vertBlend, goal.vert);
    set(orbitYaw, 0); set(orbitPitch, 0); userYaw = userPitch = 0; impactKick = 0; aim = goal.aim;
    started = true;
  }

  const api: SkateCamera = {
    update(p, events, dtIn, env) {
      const reduced = Boolean(env.reducedMotion);
      const aspect = fin(env.aspect, 1.6) > 0 ? fin(env.aspect, 1.6) : 1.6;
      const dt = clamp(fin(dtIn), 0, 0.1);
      lastReduced = reduced; lastAspect = aspect;
      // The sim moved the rider somewhere velocity cannot explain (bail recovery, a reset): cut, don't chase.
      const jumped = started && Math.hypot(fin(p.x) - seenX, fin(p.z) - seenZ) > 1 + Math.hypot(fin(p.vx), fin(p.vz)) * dt * 3;
      last = p; seenX = fin(p.x); seenZ = fin(p.z);
      if (!started || jumped) cut(p, reduced, aspect);
      for (const e of events) {
        if (e.kind === 'land') impactKick = Math.max(impactKick, clamp(0.35 + fin(e.airTime) * 0.6, 0, 1));
        else if (e.kind === 'bail') enterMode('bail', p);
        else if (e.kind === 'recovered' && mode === 'bail') enterMode('chase', p);
      }
      enterMode(PHASE_MODE[p.phase] ?? 'chase', p);
      if (mode === 'air') {
        // Refine gravity from the ballistic arc (skip the first frames: the pop is still accelerating).
        const vy = fin(p.vy);
        if (++airFrames > 2 && dt > 0 && p.grind === null) {
          const g = (prevVy - vy) / dt;
          if (g > 3 && g < 60) gravity += (g - gravity) * Math.min(1, dt * 4);
        }
        prevVy = vy;
      }
      if (mode === 'bail') bailClock += dt;
      impactKick = Math.max(0, impactKick - dt * 3.2);
      computeGoals(p, reduced, aspect);
      // User look-around: springs back once rolling.
      const rolling = hSpeed(p) > 0.4;
      if (rolling) { userYaw *= Math.exp(-1.4 * dt); userPitch *= Math.exp(-1.4 * dt); }
      drive(fx, goal.fx, goal.wFocus, dt); drive(fz, goal.fz, goal.wFocus, dt); drive(fy, goal.fy, goal.wFocusY, dt);
      driveAngle(yaw, goal.yaw, goal.wYaw, dt, reduced ? C.yawRateMax * 0.6 : C.yawRateMax);
      drive(dist, goal.dist, goal.wFrame, dt); drive(height, goal.height, goal.wFrame, dt);
      drive(side, goal.side, goal.wFrame, dt); drive(lift, goal.lift, goal.wFrame, dt);
      drive(fov, goal.fov, C.wFov, dt); drive(roll, goal.roll, C.wRoll, dt);
      drive(vertBlend, reduced ? 0 : goal.vert, C.wFrame, dt);
      drive(lead[0], goal.lx, C.wFrame, dt); drive(lead[1], goal.ly, C.wFrame, dt); drive(lead[2], goal.lz, C.wFrame, dt);
      drive(orbitYaw, userYaw, 8, dt); drive(orbitPitch, userPitch, 8, dt);
      drive(pull, pullGoal, 1.6, dt); drive(floor, floorGoal, 2.2, dt);
      aim += (goal.aim - aim) * Math.min(1, dt * 3);
      place(reduced, env);
      return out;
    },
    snap(p) {
      const q = p ?? last;
      if (!q) { started = false; return; }
      last = q; seenX = fin(q.x); seenZ = fin(q.z);
      cut(q, lastReduced, lastAspect); place(lastReduced, null);
    },
    setDistance(d) { distance = d === 'far' ? 'far' : 'near'; },
    orbit(dx, dy) {
      userYaw = clamp(userYaw - fin(dx) * 0.006, -1.4, 1.4);
      userPitch = clamp(userPitch + fin(dy) * 0.004, -0.4, 1.2);
    },
    heading: () => wrap(yaw.x + orbitYaw.x),
    mode: () => (mode === 'air' && airVert ? 'vert' : mode),
    frame: () => out,
  };
  return api;
}

/**
 * Where a world point lands on screen for this frame: `[u, v]` with u 0 → 1
 * left → right and v 0 → 1 top → bottom (outside 0..1 = off screen), or null
 * when it is behind the eye. Matches three's `lookAt` + `rotateZ(roll)` +
 * vertical-FOV projection, so the HUD can hang things off the rider.
 */
export function projectToView(f: SkateCameraFrame, P: readonly number[], aspect: number): [number, number] | null {
  const [px, py, pz] = f.position, [tx, ty, tz] = f.target;
  let fx = tx - px, fy = ty - py, fz = tz - pz; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // right = forward × up(0,1,0); up' = right × forward.
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const dx = (P[0] ?? 0) - px, dy = (P[1] ?? 0) - py, dz = (P[2] ?? 0) - pz;
  const depth = dx * fx + dy * fy + dz * fz;
  if (!(depth > 0.02)) return null;
  const t = Math.tan(fin(f.fov, 55) * Math.PI / 360), a = fin(aspect, 1.6) > 0 ? fin(aspect, 1.6) : 1.6;
  let sx = (dx * rx + dz * rz) / depth / (t * a), sy = (dx * ux + dy * uy + dz * uz) / depth / t;
  if (f.roll) { const c = Math.cos(f.roll), s = Math.sin(f.roll), x0 = sx * a, y0 = sy; sx = (x0 * c + y0 * s) / a; sy = -x0 * s + y0 * c; }
  return [(sx + 1) / 2, (1 - sy) / 2];
}

/**
 * The frame as the island's orbit-pose language ({target, r, theta, phi}, the
 * `CourtPose` shape `poseEye` inverts), so leaving the board can hand the view
 * to the walking follow camera with `follow.seed(skateCameraPose(frame))` — a
 * move, not a cut.
 */
export function skateCameraPose(f: SkateCameraFrame): {target: Vec3; r: number; theta: number; phi: number} {
  const dx = f.position[0] - f.target[0], dy = f.position[1] - f.target[1], dz = f.position[2] - f.target[2];
  const r = Math.max(1e-6, Math.hypot(dx, dy, dz));
  return {target: [f.target[0], f.target[1], f.target[2]], r, theta: Math.atan2(dx, dz), phi: Math.acos(clamp(dy / r, -1, 1))};
}
