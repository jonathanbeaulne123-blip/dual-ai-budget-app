import type {HorizonSurface} from './geography.ts';

/**
 * The Horizon walker, on foot (Jonathan, 2026-10-04: "fix the walking movement").
 *
 * Measured on the committed bake before this module (scripted walks, test/horizonWalkSim.test.ts):
 * - a body pushed diagonally into a rail stopped dead (1.3 m covered in 4 s, every later frame zero) — the old move broke out of
 *   its loop on the first blocked piece instead of sliding along the face;
 * - full pace on the first frame and zero on the first frame after release (no weight, no settle);
 * - a steep terrain sliver drawn a few centimetres over a stair's treads (cove stair, Bight pier stair, Lamp Gallery stair) was
 *   taken as the floor and its 45–83° face stopped the walker on the stair;
 * - a tap-to-walk route stood still for one frame at every one of its points (every ~3 m), and one blocked frame cancelled the
 *   whole route ("That path is blocked") where a slide along a retaining wall or a rail would have carried on;
 * - the gait ran on the wall clock (one cadence for a walk and a run, feet skating) and every stair riser was a y snap.
 *
 * This module is pure: no clock, no scene. `walkMove` is the collision step (collide and slide); `walkTick` integrates the
 * body's weight on a fixed timestep (`WALK_FIXED_DT`) and follows a route; `walkView` and `walkPose` are what the figure and
 * the camera read. Speeds stay MANIFEST `speeds_ms.walk|run` (2.4 / 5.0 m/s): measured, a run crosses the ~2 km island in
 * about seven minutes, which is right for a walk-everywhere island — so no generator input changes and no bake.
 */
export const WALK_FIXED_DT = 1 / 60;
/** The longest piece of a move tested at once (the old move's 0.15 m pieces). */
export const WALK_PIECE = .15;
/** The body's collision radius (the old move's `.3`). */
export const WALK_RADIUS = .3;
/** Highest lip or riser walked straight up (geography's HORIZON_STEP_HEIGHT and the old move's `.48`). */
export const WALK_STEP = .48;
/** A too-steep face lying no more than this over a walkable floor is a drawn sliver (terrain through a stair), not a wall. */
export const WALK_GRAZE = .3;
/** How deep an authored floor (a stair's treads, a deck) may lie under too-steep terrain drawn through it and still be walked. */
export const WALK_BURIED = 1.5;
/** Exponential rates (per second): gathering speed, and giving it up (the settle on release, and turning). */
export const WALK_ACCEL = 10, WALK_BRAKE = 7.5;
/** How fast the facing follows the way the body is asked to go (per second). */
export const WALK_TURN = 14;
/** Slope pace: uphill costs this × sin(grade); downhill gives this × sin(grade) back, capped at the walkable limit. */
export const WALK_UPHILL_COST = .45, WALK_DOWNHILL_GAIN = .12;
/** The gait: metres per step at a walk, and how much longer a full run's step reaches. */
export const WALK_STRIDE = .75, WALK_STRIDE_STRETCH = .45;
/** A route: points nearer than this are passed (rounding a corner), the last is reached inside `ARRIVE`; a route with no
 * progress for `STUCK` seconds is blocked. */
export const ROUTE_LOOKAHEAD = .9, ROUTE_ARRIVE = .08, ROUTE_STUCK = 1;
/** A stair riser (or any lip) is shown climbed over this rate (per second) instead of in one frame. */
export const WALK_RISE_EASE = 16;
/** A body moved farther than this by something else (a door, a ride, a restore) loses its momentum. */
export const WALK_TELEPORT = .5;

export type WalkContact = {id: string; nx: number; nz: number};
export interface WalkWorld {
  /** Highest surface at or under `y + step` (geography.surface). */
  surface(x: number, z: number, y: number, step: number): HorizonSurface | null;
  /** The face a body of `radius` touches moving along `travel`, with its horizontal normal (geography.contact). */
  contact(x: number, z: number, y: number, radius: number, travel: readonly [number, number]): WalkContact | null;
  /** Visible water at (x, z) for feet at `feet`, else null (geography.waterLevel). */
  water(x: number, z: number, feet: number): number | null;
  /** False where collision has not arrived yet (the chunk / region gate): the body holds. */
  gate(x: number, z: number): boolean;
  extent: {w: number; h: number};
  /** Steepest walkable surface, degrees (HORIZON_WALKABLE_DEGREES). */
  walkable: number;
}
export type WalkBody = {x: number; y: number; z: number; yaw: number};
export type WalkBlocker = {at: [number, number, number]; surface: HorizonSurface | null; obstacle: string | null; water: boolean};
export type WalkMove = {moved: number; held: boolean; leftSupport: boolean; blocker: WalkBlocker | null; slid: boolean};
type Geo = {
  surface(x: number, z: number, y?: number, step?: number): HorizonSurface | null;
  contact(x: number, z: number, y: number, radius?: number, travel?: readonly [number, number]): WalkContact | null;
  waterLevel(x: number, z: number, feet?: number): number | null;
};
/** The runtime geography as a walk world: the same queries the old move made, with the same arguments. */
export function horizonWalkWorld(geography: Geo, extent: {w: number; h: number}, gate: (x: number, z: number) => boolean, walkable: number): WalkWorld {
  return {surface: (x, z, y, step) => geography.surface(x, z, y, step), contact: (x, z, y, radius, travel) => geography.contact(x, z, y, radius, travel),
    water: (x, z, feet) => geography.waterLevel(x, z, feet), gate, extent, walkable};
}

type Probe = {kind: 'held'} | {kind: 'ok'; x: number; z: number; hit: HorizonSurface | null; water: boolean} | {kind: 'blocked'; nx: number; nz: number; blocker: WalkBlocker};
function probe(world: WalkWorld, body: WalkBody, px: number, pz: number, grounded: boolean): Probe {
  const x = body.x + px, z = body.z + pz;
  if (!world.gate(x, z)) return {kind: 'held'};
  const edge = .4, {w, h} = world.extent;
  if (x < edge || z < edge || x > w - edge || z > h - edge) {
    const nx = x < edge ? 1 : x > w - edge ? -1 : 0, nz = z < edge ? 1 : z > h - edge ? -1 : 0, n = Math.hypot(nx, nz);
    return {kind: 'blocked', nx: nx / n, nz: nz / n, blocker: {at: [x, body.y, z], surface: null, obstacle: 'world-boundary', water: false}};
  }
  let hit = world.surface(x, z, body.y, WALK_STEP);
  const wet = world.water(x, z, body.y), wetOver = (s: HorizonSurface | null) => wet !== null && (!s || s.y < wet - .3);
  // A too-steep face only just over a walkable floor is a sliver drawn through it (terrain through a stair's treads): stand on
  // the floor. A real bank rises past WALK_GRAZE within a body's width and still stops (and slides) the body.
  // Terrain that pokes up through an authored stair or deck (a bake that did not cut the cliff over the cove stair, the Bight
  // pier stair, the Lamp Gallery stair: measured 0.3–0.8 m over the treads, 45–83°) is not a wall either: where an authored
  // walkable surface lies under terrain within WALK_BURIED, the body walks the authored one — walkable terrain too, or the body
  // climbs onto the uncut ground beside the treads and is later stranded above them (measured on the Lamp Gallery stair).
  if (hit && !wetOver(hit) && (hit.slope > world.walkable || hit.id === 'terrain')) {
    let probeY = hit.y;
    for (let i = 0; i < 4; i++) {
      const under = world.surface(x, z, probeY - 1e-3, 0);
      if (!under || hit.y - under.y > WALK_BURIED) break;
      const authoredUnderTerrain = hit.id === 'terrain' && under.id !== 'terrain';
      if (under.slope <= world.walkable && !wetOver(under) && (authoredUnderTerrain || (hit.slope > world.walkable && hit.y - under.y <= WALK_GRAZE))) { hit = under; break; }
      probeY = under.y;
    }
  }
  const water = wetOver(hit);
  const height = hit && !water && grounded ? Math.max(body.y, hit.y) : body.y;
  const obstacle = world.contact(x, z, height, WALK_RADIUS, [px, pz]);
  if (obstacle) return {kind: 'blocked', nx: obstacle.nx, nz: obstacle.nz, blocker: {at: [x, body.y, z], surface: hit, obstacle: obstacle.id, water}};
  if (hit && !water && hit.slope > world.walkable) {
    const n = Math.hypot(hit.nx, hit.nz);
    return {kind: 'blocked', nx: n > 1e-6 ? hit.nx / n : 0, nz: n > 1e-6 ? hit.nz / n : 0, blocker: {at: [x, body.y, z], surface: hit, obstacle: null, water}};
  }
  return {kind: 'ok', x, z, hit, water};
}

/**
 * Move the body by (dx, dz) along the ground: in pieces of at most WALK_PIECE, stepping up lips and risers to WALK_STEP, down
 * to WALK_STEP, and — the fix — sliding along whatever stops it (a wall, a rail, the world's edge, a too-steep slope) instead of
 * stopping dead: the blocked piece loses only its component into the face, and a second face (a corner) stops it.
 * `leftSupport`: the body walked off its floor (no floor, a drop over WALK_STEP, or into water) — the caller hands it to the air.
 * `held`: collision ahead has not arrived (the gate); the body stays put.
 */
export function walkMove(world: WalkWorld, body: WalkBody, dx: number, dz: number, o: {swimming: boolean; grounded: boolean}): WalkMove {
  const length = Math.hypot(dx, dz), pieces = Math.max(1, Math.ceil(length / WALK_PIECE));
  let px = dx / pieces, pz = dz / pieces, moved = 0, slid = false;
  for (let i = 0; i < pieces; i++) {
    let first: [number, number] | null = null, done = false, blocker: WalkBlocker | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = probe(world, body, px, pz, o.grounded);
      if (r.kind === 'held') return {moved, held: true, leftSupport: false, blocker: null, slid};
      if (r.kind === 'ok') {
        body.x = r.x; body.z = r.z; moved += Math.hypot(px, pz);
        if (!o.swimming && (!r.hit || body.y - r.hit.y > WALK_STEP || r.water)) return {moved, held: false, leftSupport: true, blocker: null, slid};
        if (o.grounded && r.hit && !r.water && Math.abs(body.y - r.hit.y) <= .5) body.y = r.hit.y;
        done = true; break;
      }
      blocker = r.blocker;
      if (attempt === 2 || (!r.nx && !r.nz)) break;
      // Keep only the part of the piece along the face; in a corner, along both faces (nothing, in a true corner).
      let sx = px - (px * r.nx + pz * r.nz) * r.nx, sz = pz - (px * r.nx + pz * r.nz) * r.nz;
      if (first) { const d = sx * first[0] + sz * first[1]; if (d < 0) { sx -= d * first[0]; sz -= d * first[1]; } }
      if (Math.hypot(sx, sz) < 1e-5 || sx * px + sz * pz <= 0) break;
      first = [r.nx, r.nz]; px = sx; pz = sz; slid = true;
    }
    if (!done) return {moved, held: false, leftSupport: false, blocker, slid};
  }
  return {moved, held: false, leftSupport: false, blocker: null, slid};
}

export type WalkState = {
  /** Planar velocity, m/s. */
  vx: number; vz: number;
  /** The grade underfoot along the way of travel (rise over run), eased; + is uphill. */
  grade: number;
  /** Eased rise and eased run behind `grade`. */
  climb: [number, number];
  /** The gait's phase in radians, one step per π, advanced by distance walked. */
  phase: number;
  lean: number; incline: number;
  /** Seen height minus physical height: a riser climbed in one step is shown eased (WALK_RISE_EASE). */
  rise: number;
  /** Unsimulated time carried to the next tick (0 ≤ acc < WALK_FIXED_DT). */
  acc: number;
  /** Seconds a route has made no progress. */
  stuck: number;
  /** The pose at the start of the last fixed step (seen height), and the body as this module last left it. */
  prev: [number, number, number]; last: [number, number, number];
};
export function createWalkState(body: WalkBody): WalkState {
  return {vx: 0, vz: 0, grade: 0, climb: [0, 0], phase: 0, lean: 0, incline: 0, rise: 0, acc: 0, stuck: 0, prev: [body.x, body.y, body.z], last: [body.x, body.y, body.z]};
}
export type WalkSpeeds = {walk: number; run: number};
export type WalkInput = {
  /** The stick or keys in world x/z, magnitude 0…1 (a pad's tilt scales the pace). Ignored while a route is followed. */
  wishX: number; wishZ: number; run: boolean; speeds: WalkSpeeds;
  /** Swimming: this constant pace, no weight (unchanged from before). */
  swim?: number;
  /** A tap-to-walk route (consumed in place as it is walked). */
  route?: number[][];
};
export type WalkTick = {moved: number; held: boolean; leftSupport: boolean; blocker: WalkBlocker | null; routeBlocked: boolean; steps: number; speed: number};

const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (rate: number, h: number) => 1 - Math.exp(-rate * h);
const SIN_WALKABLE = Math.sin(40 * Math.PI / 180);
/** Pace on a grade (rise over run): uphill costs, downhill gives a little back. */
export function slopePace(grade: number): number {
  const s = Math.sin(Math.atan(grade));
  return s > 0 ? 1 - WALK_UPHILL_COST * s : 1 + WALK_DOWNHILL_GAIN * Math.min(-s, SIN_WALKABLE);
}
export const runFraction = (speed: number, s: WalkSpeeds) => clamp((speed - s.walk) / (s.run - s.walk), 0, 1);
const remaining = (route: number[][], x: number, z: number) => {
  let d = Math.hypot(route[0]![0]! - x, route[0]![2]! - z);
  for (let i = 1; i < route.length; i++) d += Math.hypot(route[i]![0]! - route[i - 1]![0]!, route[i]![2]! - route[i - 1]![2]!);
  return d;
};

/**
 * Advance the walker by `dt` seconds of real time, in fixed WALK_FIXED_DT steps (the remainder carries to the next tick, and
 * `walkView` interpolates across it). `move` is the collision step (`walkMove` over the runtime geography). Stops stepping as
 * soon as the body leaves its support or is held by the gate, so the caller's air hand-off and hold see the exact moment.
 */
export function walkTick(state: WalkState, body: WalkBody, input: WalkInput, dt: number, move: (dx: number, dz: number) => WalkMove): WalkTick {
  // Something else moved the body (a deck carrying it, a restore, a door): keep the interpolation honest, and a real jump
  // away loses the momentum and any riser still being shown.
  const jx = body.x - state.last[0], jy = body.y - state.last[1], jz = body.z - state.last[2];
  if (jx || jy || jz) {
    state.prev = [state.prev[0] + jx, state.prev[1] + jy, state.prev[2] + jz];
    if (Math.hypot(jx, jy, jz) > WALK_TELEPORT) { state.vx = 0; state.vz = 0; state.rise = 0; state.stuck = 0; state.grade = 0; state.climb = [0, 0]; state.prev = [body.x, body.y, body.z]; }
  }
  const out: WalkTick = {moved: 0, held: false, leftSupport: false, blocker: null, routeBlocked: false, steps: 0, speed: Math.hypot(state.vx, state.vz)};
  state.acc += Math.max(0, dt);
  const h = WALK_FIXED_DT;
  while (state.acc >= h - 1e-9) {
    state.acc = Math.max(0, state.acc - h); out.steps++;
    state.prev = [body.x, body.y + state.rise, body.z];
    const top = input.swim ?? (input.run ? input.speeds.run : input.speeds.walk);
    // What the body wants: the stick, or the route's next point.
    let wx = input.wishX, wz = input.wishZ, cap = Infinity;
    const route = input.route;
    if (route && route.length) {
      while (route.length > 1 && Math.hypot(route[0]![0]! - body.x, route[0]![2]! - body.z) < ROUTE_LOOKAHEAD) route.shift();
      const tx = route[0]![0]! - body.x, tz = route[0]![2]! - body.z, d = Math.hypot(tx, tz);
      if (route.length === 1 && d < ROUTE_ARRIVE) { route.shift(); wx = 0; wz = 0; state.stuck = 0; }
      else {
        wx = d > 1e-9 ? tx / d : 0; wz = d > 1e-9 ? tz / d : 0;
        // Ease into the last point instead of overshooting it, and never crawl the last centimetres.
        // A linear ramp-down over the last ~1 m (2.4 per second per metre left), never below a stroll, so the walker is still
        // walking — not running — when it reaches the end, and its weight settles the rest.
        cap = Math.max(.3, 2.4 * remaining(route, body.x, body.z));
        if (route.length === 1) cap = Math.min(cap, d / h);
      }
    }
    const wish = Math.min(1, Math.hypot(wx, wz)), ux = wish ? wx / Math.hypot(wx, wz) : 0, uz = wish ? wz / Math.hypot(wx, wz) : 0;
    const wanted = Math.min(cap, wish * top * (input.swim === undefined ? slopePace(state.grade) : 1));
    const Wx = ux * wanted, Wz = uz * wanted, before = Math.hypot(state.vx, state.vz);
    if (input.swim !== undefined) { state.vx = Wx; state.vz = Wz; }
    else {
      // Quick to gather speed, slower to give it up — that asymmetry is the weight.
      const rate = wanted >= before && Wx * state.vx + Wz * state.vz >= before * before - 1e-9 ? WALK_ACCEL : WALK_BRAKE;
      state.vx += (Wx - state.vx) * ease(rate, h); state.vz += (Wz - state.vz) * ease(rate, h);
      if (!wanted && Math.hypot(state.vx, state.vz) < .02) { state.vx = 0; state.vz = 0; }
    }
    // Facing: toward where the body is asked to go (a swimmer turns at once, as before).
    if (wish > 1e-6) { const target = Math.atan2(ux, uz); body.yaw = input.swim !== undefined ? target : wrap(body.yaw + wrap(target - body.yaw) * ease(WALK_TURN, h)); }
    let dx = state.vx * h, dz = state.vz * h;
    if (route && route.length === 1) { const d = Math.hypot(route[0]![0]! - body.x, route[0]![2]! - body.z), l = Math.hypot(dx, dz); if (l > d && l > 0) { dx *= d / l; dz *= d / l; } }
    const want = Math.hypot(dx, dz), x0 = body.x, y0 = body.y, z0 = body.z;
    let r: WalkMove | null = null;
    if (want > 1e-7) {
      r = move(dx, dz);
      out.moved += r.moved;
      if (r.blocker) out.blocker = r.blocker;
      if (r.held) { out.held = true; state.vx = 0; state.vz = 0; }
      // Pressed into a face, the body keeps only the velocity it actually had along it.
      else if (r.slid || r.moved < want - 1e-6) { state.vx = (body.x - x0) / h; state.vz = (body.z - z0) / h; }
    }
    const walked = Math.hypot(body.x - x0, body.z - z0), dy = body.y - y0;
    // A riser or lip taken in one step is shown climbed (a smooth slope is followed exactly: its rise fits its run).
    if (Math.abs(dy) > walked + .01) state.rise -= dy;
    state.rise = Math.abs(state.rise) > .6 ? 0 : state.rise * (1 - ease(WALK_RISE_EASE, h));
    if (Math.abs(state.rise) < 1e-4) state.rise = 0;
    // The grade is eased rise over eased run, so a stair (flat treads, sudden risers) reads as its true pitch.
    state.climb[0] += (dy - state.climb[0]) * ease(4, h); state.climb[1] += (walked - state.climb[1]) * ease(4, h);
    state.grade = state.climb[1] > 1e-4 ? clamp(state.climb[0] / state.climb[1], -1.5, 1.5) : 0;
    const speed = Math.hypot(state.vx, state.vz);
    state.phase += input.swim === undefined ? walked / (WALK_STRIDE * (1 + WALK_STRIDE_STRETCH * runFraction(speed, input.speeds))) * Math.PI : 0;
    const wantLean = clamp((speed - before) / h / 12, -1, 1), wantIncline = walked > 1e-5 ? clamp(Math.sin(Math.atan(state.grade)), -1, 1) * Math.min(1, speed / input.speeds.walk) : 0;
    state.lean += (wantLean - state.lean) * ease(9, h); state.incline += (wantIncline - state.incline) * ease(6, h);
    if (Math.abs(state.lean) < .01 && Math.abs(wantLean) < .01) state.lean = 0;
    if (Math.abs(state.incline) < .01 && Math.abs(wantIncline) < .01) state.incline = 0;
    // A route that makes no headway for ROUTE_STUCK seconds is blocked (a single blocked frame no longer is).
    if (route && route.length && !out.held) {
      if (walked < .25 * wanted * h) state.stuck += h; else state.stuck = 0;
      if (state.stuck > ROUTE_STUCK) { route.length = 0; state.stuck = 0; out.routeBlocked = true; }
    }
    out.speed = speed;
    if (r?.leftSupport) { out.leftSupport = true; state.acc = 0; break; }
    if (out.held) { state.acc = 0; break; }
  }
  state.last = [body.x, body.y, body.z];
  return out;
}

/** Where the figure and the camera see the body: interpolated across the unsimulated remainder, risers eased. */
export function walkView(state: WalkState, body: WalkBody): {x: number; y: number; z: number} {
  if (body.x !== state.last[0] || body.y !== state.last[1] || body.z !== state.last[2]) return {x: body.x, y: body.y, z: body.z};
  const a = clamp(state.acc / WALK_FIXED_DT, 0, 1), y = body.y + state.rise;
  return {x: state.prev[0] + (body.x - state.prev[0]) * a, y: state.prev[1] + (y - state.prev[1]) * a, z: state.prev[2] + (body.z - state.prev[2]) * a};
}
/** The figure's gait from the walk: phase by distance, amplitude by speed, and the weight (lean, run, incline). */
export function walkPose(state: WalkState, speeds: WalkSpeeds): {phase: number; gait: number; motion: {lean: number; bank: number; run: number; incline: number}} {
  const speed = Math.hypot(state.vx, state.vz);
  return {phase: state.phase, gait: Math.min(1, speed / speeds.walk), motion: {lean: state.lean, bank: 0, run: runFraction(speed, speeds), incline: state.incline}};
}
