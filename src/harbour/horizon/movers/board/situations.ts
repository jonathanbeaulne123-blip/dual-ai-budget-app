/**
 * The ride situations (RIDE §9) and the headless line rider (`horizonSkateLines`), on the real
 * baked beds through the real contact adapter and the board controller. Deterministic: fixed
 * 1/120 s frames, no clock, no RNG; every run returns its ride log (log.ts rows), and the caller
 * may have it written as JSON (`evidence/rides/board_<id>.json`) through a `RideLogSink`.
 * No file system here: this module ships in src/ and never imports node.
 *
 * The ranges are RIDE §9's. Where one is re-derived, the reason is in that check's own name or
 * the comment beside it (RIDE §9 allows re-derivation; a silently loosened range is not allowed):
 * R1 at 0.5 stick with the line held, R2's asserts follow the pendulum, R3 with shorter slides,
 * R4's quicker return, R5 with the countersteer after release. Fix round 2 restored RIDE's own
 * R2 speed shed (5–7), R3 grip hold (≥ 0.3 s) and Σ|Δheading| (80–140°), and R4 speed loss (2–3.5).
 */
import type {MoverDeps} from '../shared/registry.ts';
import type {MoverInput} from '../shared/mode.ts';
import type {Bed} from '../../world/definition.ts';
import {GROUND_DT, NEUTRAL_INPUT, type GroundEvent, type GroundInput, type GroundState} from '../shared/ground/types.ts';
import {groundSpeed, slipAngle} from '../shared/ground/kernel.ts';
import {recordRide, type RideLogRow} from '../shared/ground/log.ts';
import {createBoardController, type BoardController} from './controller.ts';
import {BOARD_PROFILE} from './profile.ts';

const DEG = Math.PI / 180;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/* ───────────────────────────── bed helpers */

export interface BedPath { bed: Bed; cum: number[]; length: number }
export function bedPath(bed: Bed): BedPath {
  const cum = [0];
  for (let i = 1; i < bed.points.length; i++) { const a = bed.points[i - 1]!, b = bed.points[i]!; cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[2] - a[2])); }
  return {bed, cum, length: cum[cum.length - 1]!};
}
/** The point `d` metres along the bed (plan distance), with the tangent heading there. */
export function pointAt(path: BedPath, d: number): { x: number; y: number; z: number; heading: number; index: number } {
  const {cum, bed} = path, P = bed.points, dd = clamp(d, 0, path.length);
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m]! <= dd) lo = m; else hi = m; }
  const a = P[lo]!, b = P[hi]!, seg = cum[hi]! - cum[lo]!, f = seg > 0 ? (dd - cum[lo]!) / seg : 0;
  return {x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, z: a[2] + (b[2] - a[2]) * f, heading: Math.atan2(b[0] - a[0], b[2] - a[2]), index: lo};
}
/** The distance along the bed of the nearest centreline point to (x, z), searched from `from` within ±`window` metres. */
export function progressOf(path: BedPath, x: number, z: number, from = 0, window = Infinity): { d: number; off: number } {
  const P = path.bed.points, {cum} = path;
  let best = {d: from, off: Infinity};
  for (let i = 0; i < P.length - 1; i++) {
    if (cum[i + 1]! < from - window || cum[i]! > from + window) continue;
    const a = P[i]!, b = P[i + 1]!, dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz;
    const f = L2 ? clamp(((x - a[0]) * dx + (z - a[2]) * dz) / L2, 0, 1) : 0;
    const off = Math.hypot(x - a[0] - dx * f, z - a[2] - dz * f);
    if (off < best.off) best = {d: cum[i]! + (cum[i + 1]! - cum[i]!) * f, off};
  }
  return best;
}
/** Circumradius of the bed through the points `span` metres either side of `d` (plan). */
export function bendRadius(path: BedPath, d: number, span = 5): number {
  const a = pointAt(path, d - span), b = pointAt(path, d), c = pointAt(path, d + span);
  const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ac = Math.hypot(c.x - a.x, c.z - a.z);
  const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  return Math.abs(cross) < 1e-9 ? Infinity : ab * bc * ac / (2 * Math.abs(cross));
}

/**
 * Pure pursuit on a bed's centreline (the line rider's steering, shared with the situations that
 * hold the line): the stick that turns the travel toward the point `L` metres ahead, where `L`
 * grows with speed. `d` is the rider's progress along the bed (a search hint).
 */
export function pursuitSteer(path: BedPath, st: GroundState, d: number): { steer: number; d: number; cross: number; e: number; L: number } {
  const P = BOARD_PROFILE, s = groundSpeed(st), p = st.p;
  const pr = progressOf(path, p[0], p[2], d, 30), L = clamp(2.5 + 0.35 * s, 3, 8), tgt = pointAt(path, pr.d + L), here = pointAt(path, pr.d);
  const hs = Math.hypot(st.v[0], st.v[2]);
  const travel = hs > 1 ? Math.atan2(st.v[0], st.v[2]) : st.heading + (st.lead === 1 ? 0 : Math.PI);
  const e = wrap(Math.atan2(tgt.x - p[0], tgt.z - p[2]) - travel);
  const R = Math.max(P.steer.radius0 + P.steer.radiusV * s, s * s / (P.grip.steerLimit * P.grip.roll));
  const cross = Math.cos(here.heading) * (p[0] - here.x) - Math.sin(here.heading) * (p[2] - here.z);
  return {steer: clamp(-2 * Math.sin(e) * R / L * 1.2, -1, 1), d: pr.d, cross, e, L};
}

/* ───────────────────────────── the ride log */

export interface RideRun { log: RideLogRow[]; events: GroundEvent[]; controller: BoardController }

/** A controller over the deps whose every step lands in `log` (row 0 = the start row). */
function logged(deps: MoverDeps, id: 'board' | 'bicycle' = 'board'): { run: RideRun; start(): void } {
  const log: RideLogRow[] = [], events: GroundEvent[] = [];
  const controller = createBoardController(deps, BOARD_PROFILE, {id, onStep(state, input, ev) { log.push(recordRide(state, input, ev)); events.push(...ev); }});
  return {run: {log, events, controller}, start() { log.length = 0; events.length = 0; log.push(recordRide(controller.state(), {...NEUTRAL_INPUT}, [])); }};
}

/** The kernel input as the runtime's MoverInput (W / S on forward, Space held → released for the pop). */
export function moverInputOf(gi: Partial<GroundInput>, jump = false): MoverInput {
  return {steer: gi.steer ?? 0, forward: gi.push ? 1 : gi.slide ? -1 : 0, jump, sprint: !!gi.sprint, crouch: gi.crouch ?? 0, accept: false, look: {dx: 0, dy: 0}};
}

/** Where a run's ride log goes: the caller owns the file system (tests pass node:fs; the runtime has none). */
export interface RideLogSink { path: string; write(path: string, text: string): void }
export function saveRideLog(sink: RideLogSink | undefined, payload: unknown): void {
  if (sink) sink.write(sink.path, JSON.stringify(payload));
}

/* ───────────────────────────── the line rider */

export type LineId = 'S1' | 'S2' | 'S3' | 'S4';
export interface LineRun { completed: boolean; time: number; log: RideLogRow[]; events: GroundEvent[]; offbedSteps: number; bails: number; maxOff: number; reason: string; distance: number; blockedBy: string | null }

/**
 * The speed a bend of radius R can be carved at with room to correct: the board's own steering
 * law and its grip cap (RIDE §3.1) asked to make R / margin, at most 11.
 */
export function cornerSpeed(R: number, margin = 1.35, G = BOARD_PROFILE.grip.roll): number {
  if (!Number.isFinite(R)) return 11;
  const P = BOARD_PROFILE, r = R / margin;
  return clamp(Math.min(Math.sqrt(P.grip.steerLimit * G * r), (r - P.steer.radius0) / P.steer.radiusV), 1.5, 11);
}

export interface LineOptions {
  maxTime?: number;
  /** Braking the speed plan assumes (m/s²) and how far ahead it looks (m). */
  brake?: number; horizon?: number;
  /** The speed the rider never chooses to exceed (the slide holds it there), and its corner margin (the bend radius over the carve's). */
  cruise?: number; margin?: number;
  /** Ride only [from, to] metres of the line (plan distance along the bed), starting at `speed` along the bed. */
  from?: number; to?: number; speed?: number;
  /** Arrive at the end of the line at this speed (the rider brakes for the pad); default: ride through. */
  arrive?: number;
  /** Longest single slide before the rider swings it to the other side (s); it swings sooner when the drift nears the edge. */
  holdMax?: number;
  /** A leg of `runLineLegs` restarting past a land defect: its start speed is capped by the speed plan there. */
  restart?: boolean;
  /** Brake with the kernel's pendulum (S, stick centred; default when the profile has one) instead of the hand-made slalom. */
  pendulum?: boolean;
}

/**
 * A headless rider down one skate line: pure pursuit on the bed's centreline; S (the slide at
 * speed, the foot brake below 2.5) whenever the bends ahead want less speed than it has, W on
 * the flat below 4 m/s, a pop at any lip the kernel reports. It never chooses to leave the bed.
 */
export function runLine(deps: MoverDeps, id: LineId, o: LineOptions = {}): LineRun {
  const bed = deps.world.beds.find(b => b.id === id);
  if (!bed) throw new Error(`runLine: no bed ${id}`);
  const path = bedPath(bed), {run, start} = logged(deps), c = run.controller, P0 = BOARD_PROFILE;
  const brake = o.brake ?? 1.0, maxTime = o.maxTime ?? 400, endD = Math.min(path.length, o.to ?? Infinity) - 1.5, cruise = o.cruise ?? 11, horizon = o.horizon ?? 120, holdMax = o.holdMax ?? 0.3, pendulum = o.pendulum ?? Number.isFinite(P0.grip.pendulumSwing);
  // Precompute the corner speed every 2 m.
  const corner: number[] = [];
  for (let d = 0; d <= path.length; d += 2) corner.push(Math.min(cornerSpeed(bendRadius(path, d, 5), o.margin), cornerSpeed(bendRadius(path, d, 9), o.margin)));
  /** Speed plan: the slowest corner ahead, allowing for braking distance (and the arrival speed at the end). */
  const plan = (d: number): number => {
    let allowed = o.arrive === undefined ? cruise : Math.min(cruise, Math.sqrt(o.arrive ** 2 + 2 * brake * Math.max(0, endD + 1.5 - d)));
    for (let k = Math.floor(d / 2); k < corner.length && k * 2 < d + horizon; k++) allowed = Math.min(allowed, Math.sqrt(corner[k]! ** 2 + 2 * brake * Math.max(0, k * 2 - d)));
    return allowed;
  };
  // A leg restarted past a defect (`restart`) rolls on no faster than the plan allows there.
  const s0 = pointAt(path, (o.from ?? 0) + 0.5), v0 = o.restart ? Math.min(o.speed ?? 0, plan(o.from ?? 0)) : o.speed ?? 0;
  c.place({x: s0.x, z: s0.z, y: s0.y, heading: s0.heading, speed: v0});
  start();
  let waitFor = 0, lastLeft = false, stallD = o.from ?? 0, d = o.from ?? 0, t = 0, mode: 'ride' | 'kick' | 'hold' | 'gap' | 'catch' = 'ride', modeFor = 0, popNext = false, maxOff = 0, offbedSteps = 0, bails = 0, reason = 'time', stall = 0;
  let blockedBy: string | null = null, popping = 0;
  const dt = GROUND_DT, P = BOARD_PROFILE;
  while (t < maxTime) {
    const st = c.state(), s = groundSpeed(st), p = st.p;
    const pr = progressOf(path, p[0], p[2], d, 30);
    d = Math.max(d, pr.d); maxOff = Math.max(maxOff, pr.off);
    if (d >= endD) { reason = 'end'; break; }
    const allowed = plan(d);
    // Pure pursuit toward a point on the centreline ahead.
    const L = clamp(2.5 + 0.35 * s, 3, 8), tgt = pointAt(path, d + L), here = pointAt(path, pr.d);
    const hs = Math.hypot(st.v[0], st.v[2]);
    const travel = hs > 1 ? Math.atan2(st.v[0], st.v[2]) : st.heading + (st.lead === 1 ? 0 : Math.PI);
    const e = wrap(Math.atan2(tgt.x - p[0], tgt.z - p[2]) - travel);
    const R = Math.max(P.steer.radius0 + P.steer.radiusV * s, s * s / (P.grip.steerLimit * P.grip.roll));
    const pursuit = clamp(-2 * Math.sin(e) * R / L * 1.2, -1, 1);
    // Signed cross-track: > 0 when the board is left of the centreline (left = the yaw-positive side).
    const cross = Math.cos(here.heading) * (p[0] - here.x) - Math.sin(here.heading) * (p[2] - here.z);
    const beta = slipAngle(st);
    let steer = pursuit, slide = false;
    modeFor += dt;
    // Which way the travel has to turn to rejoin the line (+: left, the yaw-positive side), with a dead band.
    const want = e + 0.12 * clamp(-cross, -2, 2);
    const offLine = Math.abs(cross) > 1.0 && Math.sign(want) === Math.sign(-cross);   // far out: carve back before braking again
    const braking = s > allowed + 0.4 && s >= P.grip.slideEntrySpeed + 0.5 && st.contact.on && !offLine;
    if (mode === 'ride' && braking) { mode = 'kick'; modeFor = 0; }
    if (mode === 'kick') {
      // Kick nose-in toward the line (A = −1 turns the travel left); alternate when the line is dead ahead.
      const left: boolean = Math.abs(want) > 0.03 ? want > 0 : !lastLeft;
      lastLeft = left; steer = left ? -1 : 1; slide = true; mode = 'hold'; modeFor = 0;
    } else if (mode === 'hold') {
      // Pendulum (the default since the fix round): S with the stick centred — the kernel swings the board side to side
      // across a travel that keeps its line. Otherwise (pendulum: false, or a profile without one) the hand-made
      // slalom: a short one-sided hold, stick into the rotation, then swing it to the other side.
      // Either way: re-kick toward the line if the drift nears an edge, and catch it when the speed is right.
      const side = st.latch.side;
      const done = s <= allowed - 0.3 || !st.contact.on || offLine;
      // With the pendulum, let go as the board swings through straight (|β| < 10°): grip comes back with the board
      // along its travel, so the release does not throw the line. Hold on (at most 0.8 s) until it does.
      // On a bend the pendulum (centred stick) would hold the straight: there the rider holds the stick into the
      // rotation (the one-sided hold, which turns the travel toward the nose) on the side the bend needs.
      const bend = Math.abs(want) > 0.07, needLeft = want > 0, noseLeft = side < 0;
      // Near the edge (or carving back to the line) the rider lets go at once: staying on the bed beats a clean release.
      // (Fix round 2: with the kernel's wheel footprint the rider meets S1's crown bend at speed for the first time,
      // and a 0.8 s wait for the swing drifted it 1.9 m into the bend's kerb at 198 m.)
      const urgent = offLine || Math.abs(cross) > 1.2;
      if (done && pendulum && !urgent && Math.abs(beta) > 10 * DEG && waitFor < 0.8) { waitFor += dt; slide = true; steer = bend && noseLeft === needLeft ? (side > 0 ? 1 : -1) : 0; }
      else if (done) { mode = 'catch'; modeFor = 0; waitFor = 0; }
      else if ((!pendulum && modeFor > holdMax) || (modeFor > 0.15 && (side < 0 ? cross > 0.8 : cross < -0.8)) || (pendulum && bend && noseLeft !== needLeft && modeFor > 0.15)) { mode = 'gap'; modeFor = 0; }
      else { slide = true; steer = pendulum && !bend ? 0 : side > 0 ? 1 : -1; }
    } else if (mode === 'gap') {
      steer = 0; mode = 'kick';   // one step off S so the next press kicks again
    } else if (mode === 'catch') {
      // Countersteer home on release (stick against the rotation) while the board is across, then back to the line.
      if ((st.grip >= 0.9 && Math.abs(beta) < 4 * DEG) || modeFor > 0.5) { mode = 'ride'; modeFor = 0; }
      else steer = Math.abs(beta) > 12 * DEG ? -Math.sign(Math.sin(2 * beta)) : pursuit;
    } else if (s > allowed + 0.2 && s < P.grip.slideEntrySpeed) slide = true;   // the foot brake, steering as usual
    // W on the flat and uphill (RIDE §5.3: you push like anyone else), never while sliding or steeply downhill.
    // Rolling back down the line (a stall on a climb): foot-brake to a stop; stopped facing back, pivot round.
    const back = s > 0.3 && st.v[0] * Math.sin(here.heading) + st.v[2] * Math.cos(here.heading) < 0;
    const nose = st.heading + (st.lead === 1 ? 0 : Math.PI), facing = wrap(Math.atan2(tgt.x - p[0], tgt.z - p[2]) - nose);
    if (back && mode === 'ride') { slide = s < P.grip.slideEntrySpeed; steer = 0; }
    else if (s < P.steer.pivotSpeed && Math.abs(facing) > 0.5 && mode === 'ride') steer = facing > 0 ? -1 : 1;
    const climbing = st.v[1] > 0.05 || Math.abs(st.contact.slope) < 3;
    const push = !slide && !back && mode === 'ride' && Math.abs(facing) < 1 && s < (climbing ? Math.max(2, Math.min(4, allowed - 0.5)) : 1.5);
    const gi: Partial<GroundInput> = {steer, slide, push};
    // A kerb or riser ahead taller than the wheels step: hold Space briefly and release (the pop) just before it.
    if (!popping && st.contact.on && hs > 0.8) {
      const reach = 0.3 + 0.12 * hs, fx = st.v[0] / hs, fz = st.v[2] / hs;
      const ahead = c.contact.sample(p[0] + fx * reach, p[2] + fz * reach, p[1] + P.contact.stepMax + 0.3);
      if (ahead && ahead.y - p[1] > P.contact.stepMax * 0.9 && ahead.y - p[1] < 0.5) popping = 1;
    }
    const jump = popping > 0 && popping <= 12;   // held 0.1 s (charge 0.1 → h ≈ 0.2 m), released on the 13th frame
    if (popping > 0) popping = popping > 40 ? 0 : popping + 1;
    const frame = c.update(dt, moverInputOf(gi, jump || popNext), t);
    if (frame.events.includes('bail')) { bails++; reason = 'bail'; t += dt; break; }
    if (!c.state().contact.legal && c.state().contact.on) offbedSteps++;
    // No progress for 3 s (stopped against something, or popping at a lip it cannot clear): stop the leg.
    if (d > stallD + 0.3) { stallD = d; stall = 0; } else stall += dt;
    if (stall > 2) { reason = 'stalled'; t += dt; break; }
    t += dt;
  }
  const q = c.state().p, h = pointAt(path, d + 1);
  if (reason !== 'end' && reason !== 'time') blockedBy = deps.geography.blocker(q[0], q[2], q[1], P.contact.width / 2, [h.x - q[0], h.z - q[2]]);
  return {completed: reason === 'end', time: t, log: run.log, events: run.events, offbedSteps, bails, maxOff, reason, distance: d, blockedBy};
}

/* ───────────────────────────── line defects (the land's, reported to the land track) */

export type StopKind = 'wall' | 'gap' | 'step' | 'junction' | 'climb' | 'water' | 'rider';
export interface LineStop { d: number; off: number; at: [number, number, number]; kind: StopKind; solid: string | null; speed: number; reason: string }

/**
 * Why a leg stopped short of the end. `wall`: a solid stands on the deck across the rider's path
 * (not the deck's own edge kerb at the side); `gap`: the deck has a hole there (the geography
 * reports ground well below the bed under the board — the wedge left between two slabs on a
 * bend); `step`: a riser ahead taller than a pop (a pad or shoulder not graded to the deck);
 * `junction`: the deck handed the board onto a structure that is not the bed (a bridge deck or slab
 * where the line meets it) and the fade back put it where it cannot go on;
 * `water`: the deck lies under the water (the fade back lands in it again);
 * `climb`: stalled pushing up a threshold-pace slice (roll 1.8 on a grade outpushes the stroke);
 * `rider`: none of these — the headless rider's own mistake (the test allows none).
 */
export function classifyStop(deps: MoverDeps, id: LineId, run: LineRun): LineStop {
  const path = bedPath(deps.world.beds.find(b => b.id === id)!), log = run.log, g = deps.geography;
  // The last row that was still moving (a bail or a stall zeroes the speed).
  let k = log.length - 1;
  while (k > 0 && log[k]!.s < 0.3) k--;
  const row = log[k]!, last = log[log.length - 1]!, [x, y, z] = row.p;
  const pr = progressOf(path, x, z), here = pointAt(path, pr.d);
  const off = Math.cos(here.heading) * (x - here.x) - Math.sin(here.heading) * (z - here.z);
  const speed = log[Math.max(0, k - 60)]!.s;
  const base = {d: pr.d, off, at: [last.p[0], last.p[1], last.p[2]] as [number, number, number], speed, reason: run.reason};
  const hv = Math.hypot(row.v[0], row.v[2]) || 1, dir: [number, number] = [row.v[0] / hv, row.v[2] / hv];
  for (const f of [0.05, 0.15, 0.3]) {
    const solid = g.blocker(x + dir[0] * f, z + dir[1] * f, y, BOARD_PROFILE.contact.width / 2, dir);
    if (solid && !(solid.startsWith(`${id}.edges`) && Math.abs(off) > 1.3)) return {...base, kind: 'wall', solid};
    if (solid) return {...base, kind: 'rider', solid};
  }
  // A riser ahead along the line taller than the pop clears (a pad or shoulder not graded to the deck).
  for (let a = 0; a <= 1.5; a += 0.1) {
    const ahead = pointAt(path, pr.d + a), sfc = g.surface(ahead.x, ahead.z, y + 1.2, 0.5);
    if (sfc && sfc.y - y > 0.25 && sfc.y - y < 1.2) return {...base, kind: 'step', solid: sfc.id};
  }
  // The deck itself is under water: the leg met the water (the fade puts it on the dry edge, and it rolls back in).
  if (log.slice(-360).some(r => r.event?.includes('water'))) return {...base, kind: 'water', solid: null};
  // The kernel met a riser on the line (a lip without a solid) and the rider could not pop it.
  const recent = log.slice(-240);
  if (Math.abs(off) <= 1.3 && recent.some(r => r.event?.includes('lip'))) {
    const lipAt = recent.find(r => r.event?.includes('lip'))!;
    const sfc = g.surface(lipAt.p[0], lipAt.p[2], lipAt.p[1] + 0.6, 0.5);
    if (sfc && sfc.id !== 'terrain') return {...base, kind: 'step', solid: sfc.id};
  }
  // The deck handed the board onto a structure that is not the bed (a bridge or slab at a deck junction), then the fade back.
  const offbed = log.slice(-900).filter(r => r.pace === 'offbed');
  for (const r of offbed) {
    const sfc = g.surface(r.p[0], r.p[2], r.p[1] + 0.2, 0.5);
    if (sfc && sfc.id !== 'terrain' && !sfc.id.startsWith(`${id}.`)) return {...base, kind: 'junction', solid: sfc.id};
  }
  // A climb the pace cannot be pushed up (threshold pace, roll 1.8, on an uphill).
  if (run.reason === 'stalled' && row.pace === 'threshold') {
    const a = pointAt(path, pr.d - 3), b = pointAt(path, pr.d + 3);
    if (b.y - a.y > 0.06) return {...base, kind: 'climb', solid: null};
  }
  // A hole in the deck within a board length of where it stopped.
  for (let a = -0.4; a <= 0.41; a += 0.1) for (let b = -0.4; b <= 0.41; b += 0.1) {
    const px = last.p[0] + a, pz = last.p[2] + b, bed = pointAt(path, progressOf(path, px, pz, pr.d, 5).d);
    const sfc = g.surface(px, pz, bed.y + 0.6, 0.5);
    if (sfc && !sfc.id.startsWith(`${id}.surface`) && bed.y - sfc.y > BOARD_PROFILE.contact.stepMax) return {...base, kind: 'gap', solid: sfc.id};
  }
  return {...base, kind: 'rider', solid: null};
}

export interface LineLegs { completed: boolean; time: number; legs: LineRun[]; stops: LineStop[]; log: RideLogRow[] }

/**
 * The whole line in legs: ride; when a leg stops at a land defect (a wall across the deck or a
 * hole in it), carry the board `skip` metres past it and ride on at the speed it had. A `rider`
 * stop ends the run (not completed). `time` sums the legs: the line's time with the defects
 * stepped over, never counting a stop.
 */
export function runLineLegs(deps: MoverDeps, id: LineId, o: LineOptions & { skip?: number; maxLegs?: number } = {}): LineLegs {
  const legs = lineLegSteps(deps, id, o);
  for (;;) { const next = legs.next(); if (next.done) return next.value; }
}

/**
 * `runLineLegs` one leg at a time: yields each leg as it ends and returns the whole line. A caller
 * may hand the event loop back between legs (the line suites do: a long line is minutes of
 * synchronous stepping otherwise). Same legs, same order, same result as `runLineLegs`.
 */
export function* lineLegSteps(deps: MoverDeps, id: LineId, o: LineOptions & { skip?: number; maxLegs?: number } = {}): Generator<LineRun, LineLegs, void> {
  const path = bedPath(deps.world.beds.find(b => b.id === id)!), legs: LineRun[] = [], stops: LineStop[] = [], log: RideLogRow[] = [];
  let from = o.from ?? 0, speed = o.speed ?? 0, time = 0;
  for (let n = 0; n < (o.maxLegs ?? 64); n++) {
    const leg = runLine(deps, id, {...o, from, speed, restart: legs.length > 0});
    legs.push(leg); log.push(...leg.log);
    yield leg;
    // (A leg that already ends in the last few metres counts as the end of the line.)
    if (leg.completed) return {completed: true, time: time + leg.time, legs, stops, log};
    if (leg.reason === 'time') return {completed: false, time: time + leg.time, legs, stops, log};
    const stop = classifyStop(deps, id, leg);
    stops.push(stop);
    // Time up to the moment it was last moving (the stall or bail itself is the defect's, not the line's).
    const moving = leg.log.filter(r => r.s >= 0.3).length;
    time += moving * GROUND_DT;
    if (stop.kind === 'rider') return {completed: false, time, legs, stops, log};
    // A defect in the last few metres (the end pad not graded to the line): the line is done.
    if (Math.max(from, stop.d) + (o.skip ?? 4) >= path.length - 2) return {completed: true, time, legs, stops, log};
    from = Math.max(from, stop.d) + (o.skip ?? 4);
    // Under water: restart past the whole submerged stretch of the deck (a 4 m skip would start in it again).
    // The stop may be at the dry edge the fade put it on, so find the water ahead first, then its far edge.
    if (stop.kind === 'water') {
      const wet = (d: number) => { const q = pointAt(path, d); return deps.geography.submerged(q.x, q.z, q.y - 0.2); };
      let d = Math.max(0, stop.d - 2);
      while (d < stop.d + 30 && !wet(d)) d += 0.5;
      while (d < path.length - 2 && wet(d)) d += 0.5;
      from = Math.max(from, d + 2);
    }
    speed = clamp(stop.speed, 2, 11);
  }
  return {completed: false, time, legs, stops, log};
}

/* ───────────────────────────── the ride situations (RIDE §9) */

export type SituationId = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export type SituationVariant = 'base' | 'noW' | 'lateW';
export interface ScriptStep { t: number; input: Partial<GroundInput> }
/** Named checks: [passed, the measured value]. */
export type Checks = Record<string, [boolean, number | string]>;
export interface SituationStart { x: number; z: number; heading: number; speed: number }
export interface Situation {
  id: SituationId; title: string;
  /** Where on the real beds (for the reader; `start` is the pose itself). */
  where: string;
  start: SituationStart;
  script: ScriptStep[];
  /** The rider also holds this line: pure pursuit × `gain` added to the scripted stick, clamped to ±1. */
  follow?: { line: LineId; gain: number };
  duration: number;
  /** Named checks over the run's metrics: [passed, the measured value] each. */
  asserts(m: SituationMetrics): Checks;
}

/** Per-step series and the events of a situation run, time from the start (s). */
export interface SituationMetrics {
  t: number[]; s: number[]; beta: number[]; grip: number[]; heading: number[]; travel: number[]; lead: number[]; charge: number[];
  legal: boolean[]; aLat: number[]; events: { kind: string; t: number; data?: Record<string, number | string> }[];
  /** Plan distance travelled at each step, and (with `follow`) the travel's heading relative to the bed's tangent. */
  dist: number[]; rel: number[];
  /** R5: the exit speed (at boostReady), the peak within 0.7 s after it (after the W, for 'lateW'), and the W press time used. */
  exit?: { t: number; speed: number; peak: number; rise: number; wAt: number | null };
  variant: SituationVariant;
}

const at = (script: ScriptStep[], t: number): Partial<GroundInput> => {
  let cur: Partial<GroundInput> = {};
  for (const step of script) if (step.t <= t + 1e-9) cur = step.input; else break;
  return cur;
};
const count = (m: SituationMetrics, kind: string, from = 0, to = Infinity) => m.events.filter(e => e.kind === kind && e.t >= from && e.t <= to).length;
const maxAbs = (xs: number[]) => xs.reduce((a, x) => Math.max(a, Math.abs(x)), 0);
const range = (v: number, lo: number, hi: number): [boolean, number] => [v >= lo && v <= hi, +v.toFixed(3)];
const idxAt = (m: SituationMetrics, t: number) => Math.min(m.t.length - 1, Math.max(0, m.t.findIndex(x => x >= t - 1e-9)));
const firstT = (m: SituationMetrics, kind: string, from = 0) => m.events.find(e => e.kind === kind && e.t >= from)?.t ?? NaN;
/** Signed heading change of the travel (the velocity direction) between two times, unwrapped (rad). */
function turn(m: SituationMetrics, a: number, b: number): number {
  let sum = 0;
  for (let i = idxAt(m, a) + 1; i <= idxAt(m, b); i++) if (m.s[i]! > 0.5 && m.s[i - 1]! > 0.5) sum += wrap(m.travel[i]! - m.travel[i - 1]!);
  return sum;
}

/*
 * Start poses on the baked beds (horizon-geo-1), from the bed polylines: `S1 at 10 m` means 10 m of
 * plan distance down S1's centreline, heading along it. Re-derive them if the land pass moves a bed.
 */
const SITUATION_TABLE: Record<SituationId, Situation> = {
  R0: {
    id: 'R0', title: 'The twist', where: 'S1 Crown drop (fast, paved, ~15 %), S1 at 140 m, heading 5° left of the line, 12 m/s — not the S2 Strip rim: on its ~0 % the slide stops the board before the hold commits (2.5 s)',
    start: {x: 1304.98, z: 639.05, heading: 0.1086, speed: 12},
    // S + D held past broadside (the hold commits after twistAfter 1.8 s into and comes round at 120°/s) until the
    // lead flips at 135°; release, and the same stick (now pointing home, at fakie-straight) catches it.
    script: [{t: 0, input: {slide: true, steer: 1}}, {t: 2.85, input: {steer: 1}}, {t: 3.4, input: {}}],
    duration: 4.5,
    asserts(m) {
      const twists = m.events.filter(e => e.kind === 'twist');
      const flipAt = twists[0]?.t ?? NaN, after = idxAt(m, 4.4);
      return {
        'lead flips once': [twists.length === 1, twists.length],
        'rides fakie after': [m.lead[after] === -1, m.lead[after]!],
        'grip returns fakie (≥ 0.9)': [m.grip[after]! >= 0.9, +m.grip[after]!.toFixed(3)],
        'straight at fakie (|β| < 10° at the end)': [Math.abs(m.beta[after]!) < 10 * DEG, +(m.beta[after]! / DEG).toFixed(1)],
        'exit is clean (boostReady, no boostLost)': [count(m, 'boostReady', flipAt) >= 1 && count(m, 'boostLost', flipAt, firstT(m, 'boostReady', flipAt)) === 0, count(m, 'boostReady')],
        'no bail': [count(m, 'bail') === 0, count(m, 'bail')],
      };
    },
  },
  R1: {
    id: 'R1', title: 'Downhill carve', where: 'S1 Crown drop (fast, paved, 13–18 %), S1 at 6 m below skateLineStarts.1, 3 m/s',
    start: {x: 1309.06, z: 505.93, heading: -0.1646, speed: 3},
    // No S; alternating A / D holds of 1.2 s (the first 0.6 s, so the zigzag is centred on the line) at 0.5 stick
    // (kernel note: full stick carves 40–57° per hold), while the rider holds the line with 0.6 × pure pursuit: on a
    // 4 m bed with parapets an open-loop zigzag leaves the line at the first bend (62 m).
    script: Array.from({length: 16}, (_, k) => ({t: k === 0 ? 0 : 0.6 + (k - 1) * 1.2, input: {steer: k % 2 ? -0.5 : 0.5}})),
    follow: {line: 'S1', gain: 0.6},
    duration: 14.4,
    asserts(m) {
      const i120 = m.dist.findIndex(d => d >= 120), carves: number[] = [];
      for (let k = 2; k < 11; k++) { const a = idxAt(m, 0.6 + (k - 1) * 1.2), b = idxAt(m, 0.6 + k * 1.2); carves.push(Math.abs(wrap(m.rel[b]! - m.rel[a]!)) / DEG); }
      let mono = i120 > 0;
      for (let i = 60; i < i120; i += 60) if (m.s[i]! < m.s[i - 60]! - 0.05) mono = false;   // per 0.5 s, allowing the carve's wobble
      return {
        // Measured 13.48: inside RIDE's range with 0.02 to spare (review R2-16). A kernel change that tips it over re-derives here, with the reason.
        'speed at 120 m 11–13.5 (RIDE §9)': range(i120 < 0 ? NaN : m.s[i120]!, 11, 13.5),
        'speed rises to 120 m': [mono, +(m.dist[m.dist.length - 1] ?? 0).toFixed(1)],
        '|β| < 8° throughout': [maxAbs(m.beta) < 8 * DEG, +(maxAbs(m.beta) / DEG).toFixed(2)],
        // The 0.9 G cap is on the commanded yaw (§3.1); the yaw servo's rate-limited catch-up overshoots it by ~1 % for a few steps.
        'lateral acceleration ≤ 0.9 G (7.2, +3 % servo overshoot) to 120 m': [Math.max(...m.aLat.slice(0, i120 + 1)) <= 0.9 * BOARD_PROFILE.grip.roll * 1.03, +Math.max(...m.aLat.slice(0, i120 + 1)).toFixed(2)],
        'heading change per carve against the line 20–35°': [carves.every(c => c >= 20 && c <= 35), `${Math.min(...carves).toFixed(1)}–${Math.max(...carves).toFixed(1)}`],
        'no bail': [count(m, 'bail') === 0, count(m, 'bail')],
        'on the bed': [m.legal.every(Boolean), m.legal.filter(x => !x).length],
      };
    },
  },
  R2: {
    id: 'R2', title: 'Sustained slide (the pendulum)', where: 'S2 the Wash bowl, into the bend at [465,700] (flow, ochre, ~3 %), S2 at 185 m on the centreline, 10 m/s — clear of the bend\'s crossing pad, where a released board would stall and come round',
    start: {x: 466.58, z: 664.45, heading: -0.0859, speed: 10},
    // RIDE §9's R2 is "S held 2.0 s, stick centred". Since the fix round the centred S hold is the kernel's pendulum
    // (pendulumSwing 12°, pendulumAngle 70°): the board swings across the travel from side to side, the wheels stay
    // loose the whole time and the travel keeps its line. So the script is unchanged and the asserts follow the
    // pendulum, not the old one-sided 40° hold (that is still S with the stick held: R3, R5).
    script: [{t: 0, input: {slide: true}}, {t: 2.0, input: {}}],
    duration: 3.0,
    asserts(m) {
      const i03 = idxAt(m, 0.3), i18 = idxAt(m, 1.8), i20 = idxAt(m, 2.0);
      const drift = m.travel.slice(0, i20 + 1).map(t => Math.abs(wrap(t - m.travel[0]!)) / DEG);
      let flips = 0, sign = 0;
      for (let i = 0; i <= i20; i++) { const b = m.beta[i]!; if (Math.abs(b) < 2 * DEG) continue; const sg = Math.sign(b); if (sign && sg !== sign) flips++; sign = sg; }
      const loose = m.grip.slice(i03, i20 + 1);
      return {
        'travel within ±16° of the start for the hold': [Math.max(...drift) <= 16, +Math.max(...drift).toFixed(1)],
        // RIDE's R2 has no sign-change rule (the pendulum is new); 2 is the least that shows a swing each way.
        // Measured 2 on this script: at the bound, no margin (review R2-16) — the 2 s hold covers two swings.
        'β changes sign ≥ 2 times (the pendulum; 2 s covers two swings, measured at the bound)': [flips >= 2, flips],
        'the wheels stay loose (grip < 0.3) from 0.3 s to the release': [Math.max(...loose) < 0.3, +Math.max(...loose).toFixed(3)],
        'speed sheds 5–7 m/s over the 2 s (RIDE §9)': range(m.s[0]! - m.s[i20]!, 5, 7),
        'charge ≥ 0.8 by 1.8 s': [m.charge[i18]! >= 0.8, +m.charge[i18]!.toFixed(3)],
        'no twist': [count(m, 'twist') === 0, count(m, 'twist')],
        'no bail': [count(m, 'bail') === 0, count(m, 'bail')],
        'on the bed': [m.legal.every(Boolean), m.legal.filter(x => !x).length],
      };
    },
  },
  R3: {
    id: 'R3', title: 'Direction change', where: 'S1 Shoulder sweep (flow, banked turf, 17 %), S1 at 230 m, 0.6 m right of the centreline, heading 15° right of it, 9 m/s',
    start: {x: 1325.49, z: 703.35, heading: 1.304, speed: 9},
    // Kernel note: RIDE's 1.6 s + 1.2 s slides scrub the board to a stop on 15 %; shorter slides keep ≥ 2 m/s.
    // Release with the countersteer (D) so grip returns, carve on with A, then S + D the other way.
    script: [{t: 0, input: {slide: true, steer: -1}}, {t: 1.0, input: {steer: 1}}, {t: 1.25, input: {steer: -1}}, {t: 1.7, input: {slide: true, steer: 1}}, {t: 2.5, input: {}}],
    duration: 3.5,
    asserts(m) {
      const a = turn(m, 0, 1.25), b = turn(m, 1.7, 2.5), gripIn = m.grip.slice(idxAt(m, 1.0), idxAt(m, 1.7));
      let gripped = 0, best = 0;
      for (const g of gripIn) { gripped = g >= 0.7 ? gripped + GROUND_DT : 0; best = Math.max(best, gripped); }
      const slides = m.events.filter(e => e.kind === 'slideStart').map(e => Number(e.data?.dir ?? 0)).filter(d => d !== 0);
      const total = (Math.abs(a) + Math.abs(turn(m, 1.25, 1.7)) + Math.abs(b)) / DEG;
      return {
        'two slides of opposite sign': [slides.length >= 2 && slides[0]! * slides[1]! < 0, slides.join(',')],
        'grip ≥ 0.7 for ≥ 0.3 s between them (RIDE §9)': [best >= 0.3 - 1e-9, +best.toFixed(3)],
        'the turn reverses': [Math.sign(a) !== Math.sign(b) && Math.abs(a) > 5 * DEG && Math.abs(b) > 5 * DEG, `${(a / DEG).toFixed(1)} / ${(b / DEG).toFixed(1)}`],
        'Σ|Δheading| 80–140° (RIDE §9)': range(total, 80, 140),
        'speed never below 2 m/s': [Math.min(...m.s.slice(0, idxAt(m, 2.5))) >= 2, +Math.min(...m.s.slice(0, idxAt(m, 2.5))).toFixed(2)],
        'no bail': [count(m, 'bail') === 0, count(m, 'bail')],
      };
    },
  },
  R4: {
    id: 'R4', title: 'Straightening recovery', where: 'S1 Notch shelf (fast, paved, 18 %), S1 at 710 m, 1.2 m right of the centreline, heading 20° left of it, 13 m/s',
    start: {x: 1258.74, z: 852.94, heading: -0.1961, speed: 13},
    script: [{t: 0, input: {slide: true, steer: 1}}, {t: 0.5, input: {steer: -1}}, {t: 1.0, input: {}}],
    duration: 2.0,
    asserts(m) {
      const release = 0.5, back = m.t.findIndex((t, i) => t > release && Math.abs(m.beta[i]!) < 10 * DEG);
      const crossings = m.grip.reduce((n, g, i) => (i > 0 && m.grip[i - 1]! < 0.7 && g >= 0.7 ? n + 1 : n), 0);
      const peakBeta = maxAbs(m.beta.slice(0, idxAt(m, release) + 1)) / DEG;
      return {
        'β ≈ 60° by the release (45–65°)': range(peakBeta, 45, 65),
        'β under 10° 0.25–0.6 s after release': range(back < 0 ? NaN : m.t[back]! - release, 0.25, 0.6),
        'grip crosses 0.7 once': [crossings === 1, crossings],
        'speed loss 2–3.5 m/s (RIDE §9)': range(m.s[0]! - m.s[idxAt(m, 1.0)]!, 2, 3.5),
        'no twist, no bail': [count(m, 'twist') + count(m, 'bail') === 0, count(m, 'twist') + count(m, 'bail')],
      };
    },
  },
  R5: {
    id: 'R5', title: 'Boost exit', where: 'S1 Quay finish (fast, paved, flat — not ~4 %), S1 at 1190 m, 1.2 m left of the centreline, heading 20° right of it, 11 m/s (re-derived in the fix round: the crossS1YearWalk pad now grips 1.0, which moved the old exit line onto the grass)',
    start: {x: 1257.96, z: 1255.23, heading: -0.1004, speed: 11},
    // Kernel note: after S + A the post-release steer is the countersteer (D); W is pressed 0.1 s after grip returns.
    script: [{t: 0, input: {slide: true, steer: -1}}, {t: 1.6, input: {steer: 1}}, {t: 1.9, input: {}}],
    duration: 3.6,
    asserts(m): Checks {
      const i16 = idxAt(m, 1.6), hold = m.beta.slice(idxAt(m, 1.0), i16).map(b => Math.abs(b) / DEG), e = m.exit;
      if (m.variant !== 'base') {
        // Without W, or with W 0.6 s after the window closed: no boost and no rise (a late W is only a push stroke).
        return {
          'clean exit flagged (boostReady)': [count(m, 'boostReady') === 1, count(m, 'boostReady')],
          'no boost': [count(m, 'boost') === 0, count(m, 'boost')],
          'the unclaimed arc is lost (boostLost)': [count(m, 'boostLost') >= 1, count(m, 'boostLost')],
          'no rise (< 0.5 m/s)': [(e?.rise ?? 0) < 0.5, +(e?.rise ?? 0).toFixed(3)],
          'on the bed': [m.legal.every(Boolean), m.legal.filter(x => !x).length],
        };
      }
      return {
        'β settles 50–60° in the hold': [hold.every(b => b >= 50 && b <= 60), `${Math.min(...hold).toFixed(1)}–${Math.max(...hold).toFixed(1)}`],
        'charge ≥ 0.85 at the release': [m.charge[i16]! >= 0.85, +m.charge[i16]!.toFixed(3)],
        'clean exit flagged (boostReady)': [count(m, 'boostReady') === 1 && count(m, 'boostLost', 0, e?.t ?? Infinity) === 0, count(m, 'boostReady')],
        'boost fires': [count(m, 'boost') === 1, count(m, 'boost')],
        'peak 1.6–2.4 above the exit speed within 0.7 s': range(e?.rise ?? NaN, 1.6, 2.4),
        'no bail': [count(m, 'bail') === 0, count(m, 'bail')],
        'on the bed': [m.legal.every(Boolean), m.legal.filter(x => !x).length],
      };
    },
  },
};
export const SITUATIONS: Readonly<Record<SituationId, Situation>> = Object.freeze(SITUATION_TABLE);

/** R5's W press: 0.1 s after grip returns (the boostReady step), or 0.6 s later than that ('lateW'), or never ('noW'). */
function withW(script: ScriptStep[], wAt: number | null): ScriptStep[] {
  if (wAt === null) return script;
  const out = script.filter(s => s.t < wAt).concat([{t: wAt, input: {push: true}}, {t: wAt + 0.2, input: {}}]);
  return out.sort((a, b) => a.t - b.t);
}

export interface SituationRun { log: RideLogRow[]; metrics: SituationMetrics; checks: Record<string, [boolean, number | string]>; failures: string[]; frames: import('../shared/mode.ts').MoverFrame[]; controller: BoardController }
export interface SituationOptions { variant?: SituationVariant; sink?: RideLogSink; flags?: Partial<Pick<MoverDeps, 'reducedMotion' | 'calm' | 'tier'>>; keepFrames?: boolean }

function play(deps: MoverDeps, sit: Situation, script: ScriptStep[], o: SituationOptions): { run: RideRun; metrics: SituationMetrics; frames: import('../shared/mode.ts').MoverFrame[] } {
  const {run, start} = logged({...deps, ...o.flags});
  const c = run.controller, frames: import('../shared/mode.ts').MoverFrame[] = [];
  c.place({...sit.start});
  start();
  const n = Math.round(sit.duration / GROUND_DT);
  const path = sit.follow ? bedPath(deps.world.beds.find(b => b.id === sit.follow!.line)!) : null;
  let d = path ? progressOf(path, sit.start.x, sit.start.z).d : 0;
  const rel: number[] = [0], normals: [number, number, number][] = [[...c.state().contact.n]];
  for (let i = 0; i < n; i++) {
    const input = {...at(script, i * GROUND_DT)};
    if (path) {
      const f = pursuitSteer(path, c.state(), d);
      d = f.d; input.steer = clamp((input.steer ?? 0) + sit.follow!.gain * f.steer, -1, 1);
    }
    const f = c.update(GROUND_DT, moverInputOf(input), i * GROUND_DT);
    if (o.keepFrames) frames.push(f);
    if (path) { const st = c.state(), tan = pointAt(path, progressOf(path, st.p[0], st.p[2], d, 10).d).heading; rel.push(wrap(Math.atan2(st.v[0], st.v[2]) - tan)); }
    const st = c.state();
    normals.push(st.contact.on ? [st.contact.n[0], st.contact.n[1], st.contact.n[2]] : [0, 0, 0]);
  }
  const log = run.log, s0 = log[0]!.step, m: SituationMetrics = {t: [], s: [], beta: [], grip: [], heading: [], travel: [], lead: [], charge: [], legal: [], aLat: [], events: [], dist: [], rel: [], variant: o.variant ?? 'base'};
  let dist = 0;
  log.forEach((r, i) => {
    const t = (r.step - s0) * GROUND_DT, prev = log[i - 1];
    m.t.push(t); m.s.push(r.s); m.beta.push(r.beta); m.grip.push(r.grip); m.heading.push(r.heading); m.lead.push(r.lead); m.charge.push(r.charge);
    m.legal.push(r.pace !== 'offbed');
    m.travel.push(Math.atan2(r.v[0], r.v[2]));
    if (prev) dist += Math.hypot(r.p[0] - prev.p[0], r.p[2] - prev.p[2]);
    m.dist.push(dist); m.rel.push(rel[i] ?? 0);
    for (const k of r.event ?? []) m.events.push({kind: k, t});
  });
  // The events' data (dir of a slide, reason of a bail) from the run's event list, by step.
  for (const e of m.events) { const src = run.events.find(x => x.kind === e.kind && Math.abs((x.step - s0) * GROUND_DT - e.t) < 1e-9); if (src?.data) e.data = src.data; }
  // Lateral acceleration the wheels deliver, averaged over 0.1 s (12 steps): the velocity change across the travel
  // in the contact plane, less gravity's share of it (the kernel's tangent gravity g·(n_y·n − ŷ)); 0 in the air.
  const g = BOARD_PROFILE.g;
  for (let i = 0; i < log.length; i++) {
    const j = Math.max(0, i - 12), nv = normals[i], a = log[i]!, b = log[j]!;
    if (i === j || !nv || nv[1] === 0 || normals.slice(j, i + 1).some(q => q[1] === 0) || a.s < 1) { m.aLat.push(0); continue; }
    const k = (i - j) * GROUND_DT, v = a.v, sv = Math.hypot(v[0], v[1], v[2]);
    const acc: [number, number, number] = [(v[0] - b.v[0]) / k - g * nv[1] * nv[0], (v[1] - b.v[1]) / k - g * (nv[1] * nv[1] - 1), (v[2] - b.v[2]) / k - g * nv[1] * nv[2]];
    const l: [number, number, number] = [nv[1] * v[2] - nv[2] * v[1], nv[2] * v[0] - nv[0] * v[2], nv[0] * v[1] - nv[1] * v[0]];
    const ll = Math.hypot(l[0], l[1], l[2]) || 1;
    m.aLat.push(Math.abs((acc[0] * l[0] + acc[1] * l[1] + acc[2] * l[2]) / ll));
    void sv;
  }
  return {run, metrics: m, frames};
}

/**
 * Runs one situation headless on the real beds (the board controller over the real contact
 * adapter), checks it against its re-derived ranges, and hands the ride log to `sink`.
 * R5 runs its script once to find the step where grip returns (boostReady), then again with
 * W 0.1 s after it ('base'), 0.6 s later than that ('lateW'), or without W ('noW').
 */
export function runSituation(deps: MoverDeps, id: SituationId, o: SituationOptions = {}): SituationRun {
  const sit = SITUATIONS[id];
  let script = sit.script, wAt: number | null = null;
  if (id === 'R5') {
    const probe = play(deps, sit, script, {flags: o.flags});
    const ready = firstT(probe.metrics, 'boostReady');
    const variant = o.variant ?? 'base';
    wAt = variant === 'noW' || !Number.isFinite(ready) ? null : ready + 0.1 + (variant === 'lateW' ? 0.6 : 0);
    script = withW(script, wAt);
  }
  const {run, metrics, frames} = play(deps, sit, script, o);
  if (id === 'R5') {
    const ready = firstT(metrics, 'boostReady');
    if (Number.isFinite(ready)) {
      const i0 = idxAt(metrics, ready), i1 = idxAt(metrics, ready + 0.1 + 0.7 + (o.variant === 'lateW' ? 0.6 : 0));
      const speed = metrics.s[i0]!, peak = Math.max(...metrics.s.slice(i0, i1 + 1));
      metrics.exit = {t: ready, speed, peak, rise: peak - speed, wAt};
    }
  }
  const checks = sit.asserts(metrics);
  const failures = Object.entries(checks).filter(([, [ok]]) => !ok).map(([k, [, v]]) => `${id} ${k}: got ${v}`);
  saveRideLog(o.sink, {situation: id, variant: o.variant ?? 'base', title: sit.title, where: sit.where, start: sit.start, script, checks, exit: metrics.exit ?? null, log: run.log});
  return {log: run.log, metrics, checks, failures, frames, controller: run.controller};
}
