import * as THREE from 'three';
import type { FlipTrickDef, SkatePresent, SkateSimEvent } from '../contract.ts';
import { BOARD, DECK_TOP, deckHalfWidth, kickRise } from './boardGeometry.ts';
import { grabPose, grindStyle, type LookDefs } from './catalogs.ts';
import { createSpringBank, type SpringBank } from './spring.ts';

/**
 * Tideline Skate Club v2 · where the board is, relative to its rider.
 *
 * The sim says where the board's *rest frame* is (the ride frame: origin on
 * the ground under the board, nose +z, rotated by boardYaw/Pitch/Roll). This
 * rig says what the board is doing inside it, in two layers:
 *
 *  - `carrier` — the board as the feet know it: the tail snap of the pop, the
 *    lift up to the tucked feet, the manual's pitch, a grab's tweak, a
 *    powerslide's swing, a grind's lock. Feet are planted on the carrier.
 *  - `board` — the carrier with the flip on top (kickflip roll about the long
 *    axis, shove-it yaw about the vertical, impossible wrap about the back
 *    foot). At u = 0 and u = 1 the flip is identity (odd half-turn shove-its
 *    fold into `yawFlip`, invisible because the board is symmetric).
 *
 * Pitch/roll follow three.js: rotation.x > 0 tips the nose down (so a manual
 * is negative, as v1 had it and as GrindDef.deckPitch has it), rotation.z > 0
 * raises the +x rail.
 *
 * During a bail the board leaves: it flies on its own ballistic in world
 * space (`free`, `freeWorld`) and is brought back through the recover.
 */

export const RIG = Object.freeze({
  /** Board centre of mass, the pivot of rolls and shove-its. */
  centreY: BOARD.deckBottom + BOARD.thickness / 2,
  snapAngle: .42, snapIn: .05, snapOut: .17,
  /** The board rises with the pop to meet the tucked feet: up by `liftMax` from `liftAt` over `liftIn` s, down again on the drop. */
  liftMax: .11, liftAt: .03, liftIn: .13, liftClearance: .3,
  /** Flip rotation runs over this window of trick time (the flick before, the catch after). */
  flipFrom: .1, flipTo: .88,
  /** How far the soles stay above the spinning board's highest point. */
  flipMargin: .02,
  manualPitch: .19,
  compress: .014,
  gravity: 15,
  /**
   * The look's get-up after a bail, from the sim's `recovered`. The sim gets the
   * rider up where they fell when that spot is safe (and relocates, with
   * `recovered.moved`, only when it is not); its recover phase (sim tuning
   * RECOVER_TIME .48) hands control back at 0.8 of this, as the board is stamped
   * under the feet. The last beat plays through the idle/roll that follows, and
   * is hurried if the rider pushes off (integration, wave 3: was .9).
   */
  recoverSeconds: .6,
});

export type FootOffset = { x: number; z: number; lift: number };
/**
 * What the board had already turned when the sim switched the flip mid-air
 * (kickflip read on as a double: \`present.trick.flipId\` changes and \`u\` is
 * rescaled). In the def's own units (roll/pitch in full turns, yaw in half
 * turns, x = the impossible's swing-out before toeSign): the drawn flip is the
 * new trick plus this carry × w, where w = (1 − ease(u)) / (1 − ease(u0)) runs
 * 1 → 0 as the new trick turns, so the board neither pops at the switch nor
 * ends anywhere but the new trick's catch (integration, wave 3).
 */
export type FlipCarry = { roll: number; yaw: number; pitch: number; x: number; e0: number };
/** How much of a carry is left at trick time u (1 at the switch, 0 at the catch). */
export function carryWeight(c: FlipCarry | null | undefined, u: number): number {
  if (!c || c.e0 >= .98) return 0;
  return Math.max(0, (1 - flipEase(u)) / (1 - c.e0));
}
/** Reduce a whole-turn angle (turns) to the nearest equivalent in (−½, ½]. */
const nearTurn = (t: number) => t - Math.round(t);
export type BoardRigPose = {
  carrier: THREE.Matrix4;
  board: THREE.Matrix4;
  /** True while the board is loose in the world (bail, recover). */
  free: boolean;
  /** 0..1 how much of `freeWorld` to show over `board` (blends in/out). */
  freeWeight: number;
  freeWorld: THREE.Matrix4;
  /** Carve: deck roll (rad) and truck steer (rad), applied inside the board model. */
  deckRoll: number; steer: number;
  /** Accumulated wheel rotation (rad). */
  wheelAngle: number;
  /** How far each foot rides above the carrier to clear the flipping board, and its flick. */
  front: FootOffset; back: FootOffset;
  /** 0..1 how much of a flip is under way (for arms/tuck). */
  flip: number;
  /** Seconds since the pop (−1 if not popped this air). */
  popT: number;
  popFrom: 'tail' | 'nose';
  /** Powerslide swing of the board (rad, signed) so the rider can counter-rotate. */
  slideYaw: number;
  /** Grind yaw overlay (rad). */
  grindYaw: number;
  /** 0..1 through the get-up after a bail (−1 when not getting up). */
  getUp: number;
};

// Spring channels.
const C_ROLL = 0, C_STEER = 1, C_GRAB_ROLL = 2, C_GRAB_PITCH = 3, C_GRAB_X = 4, C_GRAB_LIFT = 5, C_MANUAL = 6,
  C_SLIDE_YAW = 7, C_SLIDE_ROLL = 8, C_GRIND_YAW = 9, C_GRIND_PITCH = 10, C_GRIND_ROLL = 11, C_GRIND_SEAT = 12, C_COUNT = 13;
const STIFF = [12, 12, 18, 18, 18, 18, 16, 14, 14, 26, 26, 26, 30];

export type BoardRigState = {
  springs: SpringBank;
  target: Float64Array;
  lastPhase: SkatePresent['phase'] | null;
  popped: boolean; popT: number; popFrom: 'tail' | 'nose';
  /** Set once a real event stream has been seen; before that, pops are inferred from take-offs. */
  eventDriven: boolean; popThisStep: boolean;
  /**
   * The board's physical yaw minus the sim's labelled `boardYaw` (inside the
   * ride frame). It absorbs what the flip overlay was showing when a trick
   * ends, and cancels every exact-π relabel of `boardYaw` (the sim swaps nose
   * and tail at a shove-it's catch and back at canonicalisation on landing),
   * so the drawn board never snaps (integration 2026-09-23).
   */
  yawFlip: number;
  /** `present.boardYaw` last frame (relabel detection). */
  lastYaw: number | null;
  trick: { id: string; def: FlipTrickDef | null; u: number; du: number; yaw: number; carry: FlipCarry | null } | null;
  manualPivot: number; grindPivot: number;
  /** Seconds the current grab has been held. */
  grabT: number;
  wheelAngle: number; wheelRate: number;
  // Loose board.
  bailT: number; recoverT: number; freeWeight: number;
  /** Getting up (the look's clock, `recoverT`), and whether the sim respawned the rider away from the heap (a cut). */
  getUp: boolean; cut: boolean; heap: THREE.Vector3;
  /** `recovered.moved` from the event stream this step (null = no event: a partner off the wire guesses from the distance). */
  moved: boolean | null;
  pos: THREE.Vector3; vel: THREE.Vector3; quat: THREE.Quaternion; spin: THREE.Vector3; floorY: number;
  landedPos: THREE.Vector3; landedQuat: THREE.Quaternion; wasFree: boolean;
  lastLocal: THREE.Matrix4;
  pose: BoardRigPose;
};

export function createBoardRigState(): BoardRigState {
  return {
    springs: createSpringBank(STIFF), target: new Float64Array(C_COUNT),
    lastPhase: null, popped: false, popT: -1, popFrom: 'tail', eventDriven: false, popThisStep: false,
    yawFlip: 0, lastYaw: null, trick: null, grabT: 0, manualPivot: -BOARD.truckZ, grindPivot: 0, wheelAngle: 0, wheelRate: 0,
    bailT: 0, recoverT: 0, freeWeight: 0, getUp: false, cut: false, heap: new THREE.Vector3(), moved: null,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), spin: new THREE.Vector3(), floorY: 0,
    landedPos: new THREE.Vector3(), landedQuat: new THREE.Quaternion(), wasFree: false,
    lastLocal: new THREE.Matrix4(),
    pose: {
      carrier: new THREE.Matrix4(), board: new THREE.Matrix4(), free: false, freeWeight: 0, freeWorld: new THREE.Matrix4(),
      deckRoll: 0, steer: 0, wheelAngle: 0, front: { x: 0, z: 0, lift: 0 }, back: { x: 0, z: 0, lift: 0 }, flip: 0, popT: -1, popFrom: 'tail', slideYaw: 0, grindYaw: 0, getUp: -1,
    },
  };
}

/** Feed the sim's events for this step (null = no event stream: infer pops from take-offs). */
export function noteRigEvents(state: BoardRigState, events: readonly SkateSimEvent[] | null): void {
  state.popThisStep = false; state.moved = null;
  if (!events) return;
  for (const e of events) {
    state.eventDriven = true;
    if (e.kind === 'pop') { state.popped = true; state.popT = 0; state.popFrom = e.from; state.popThisStep = true; }
    else if (e.kind === 'recovered') state.moved = e.moved === true;
  }
}

const smooth = (t: number) => { const k = t <= 0 ? 0 : t >= 1 ? 1 : t; return k * k * (3 - 2 * k); };
const clamp01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Flip easing: nothing until the flick, then the board turns fastest mid-air
 * (near the apex of a flat-ground pop) and settles square into the catch.
 */
export function flipEase(u: number): number {
  const k = clamp01((u - RIG.flipFrom) / (RIG.flipTo - RIG.flipFrom));
  return k * k * (3 - 2 * k);
}

const _m = new THREE.Matrix4(), _n = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _axis = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);

function about(out: THREE.Matrix4, rot: THREE.Matrix4, px: number, py: number, pz: number): THREE.Matrix4 {
  // out = out · T(p) · rot · T(−p)
  _n.makeTranslation(px, py, pz); out.multiply(_n); out.multiply(rot); _n.makeTranslation(-px, -py, -pz); out.multiply(_n);
  return out;
}

/**
 * The flip overlay for `def` at normalised trick time `u`, for a rider whose
 * toes face `toeSign` (±1 along board x). Roll + = toe edge dips first (the
 * kickflip); yaw + = tail swings to the heel side (backside shove-it);
 * pitch + = the tail scoops up and over the back foot (impossible).
 */
export function flipMatrix(def: FlipTrickDef | null, u: number, toeSign: number, out: THREE.Matrix4, backFootZ = -BOARD.truckZ, carry: FlipCarry | null = null): THREE.Matrix4 {
  out.identity();
  if (!def) return out;
  const a = flipAngles(def, u, carry, _angles);
  const roll = -toeSign * a.roll * Math.PI * 2, yaw = toeSign * a.yaw * Math.PI, pitch = a.pitch * Math.PI * 2;
  if (yaw) about(out, _m.makeRotationY(yaw), 0, RIG.centreY, 0);
  // An impossible wraps around the toe end of the back foot, out in front of the shins.
  const out2 = toeSign * a.x;
  if (out2) { _m.makeTranslation(out2, 0, 0); out.multiply(_m); }
  if (pitch) about(out, _m.makeRotationX(pitch), 0, DECK_TOP + .03, backFootZ);
  if (roll) about(out, _m.makeRotationZ(roll), 0, RIG.centreY, 0);
  return out;
}

type FlipAngles = { roll: number; yaw: number; pitch: number; x: number };
const _angles: FlipAngles = { roll: 0, yaw: 0, pitch: 0, x: 0 }, _was: FlipAngles = { roll: 0, yaw: 0, pitch: 0, x: 0 };
/** The flip's turns so far (def units, before toeSign), carry included. */
export function flipAngles(def: FlipTrickDef | null, u: number, carry: FlipCarry | null, out: FlipAngles): FlipAngles {
  const e = def ? flipEase(u) : 0, w = carryWeight(carry, u);
  out.roll = (def?.roll ?? 0) * e; out.yaw = (def?.yaw ?? 0) * e; out.pitch = (def?.pitch ?? 0) * e;
  out.x = def?.pitch ? .3 * Math.sin(Math.PI * clamp01(u)) : 0;
  if (carry && w > 0) { out.roll += carry.roll * w; out.yaw += carry.yaw * w; out.pitch += carry.pitch * w; out.x += carry.x * w; }
  return out;
}

/** How far the feet stay clear of a flipping board over u: up at once off the flick, down onto the bolts as the rotation squares up (the catch). */
export function flipClearance(u: number): number { return smooth((u - .01) / .1) * (1 - smooth((u - (RIG.flipTo - .08)) / .12)); }

/**
 * Where the rider's shoes stand on the board, in rider terms (centred on the
 * board's line, z toward the nose; angle from straight across toward the
 * nose), and their footprint (the biggest avatar's shoe, a hair over): the flip clearance keeps the board out of exactly these.
 * `riderPose.ts` STANCE places the feet from the same numbers.
 */
export const SHOE = Object.freeze({ frontZ: .2, backZ: -.205, frontAngle: .66, backAngle: .14, halfLength: .12, halfWidth: .082 });
/** The whole board as a handful of points: deck edges and centre line along its length, and the trucks and wheels. */
const SECTION: readonly THREE.Vector3[] = (() => {
  const pts: THREE.Vector3[] = [];
  for (let k = -10; k <= 10; k += 1) {
    const z = k / 10 * BOARD.halfLength * .94, hw = deckHalfWidth(z), rise = kickRise(z);
    for (const sx of [-1, -.5, 0, .5, 1]) pts.push(new THREE.Vector3(sx * hw, DECK_TOP + BOARD.concave * sx * sx + rise, z), new THREE.Vector3(sx * hw, BOARD.deckBottom + rise, z));
  }
  for (const tz of [-BOARD.truckZ, BOARD.truckZ]) {
    for (const sx of [-1, 1]) pts.push(new THREE.Vector3(sx * BOARD.wheelX, 0, tz), new THREE.Vector3(sx * (BOARD.wheelX - BOARD.wheelWidth / 2), BOARD.axleY * .3, tz));
    for (const sx of [-1, 0, 1]) pts.push(new THREE.Vector3(sx * .09, BOARD.axleY - .012, tz), new THREE.Vector3(sx * .03, BOARD.deckBottom - .012, tz));
  }
  return pts;
})();
const _pt = new THREE.Vector3();
/**
 * How high above the resting grip (DECK_TOP) the flip `m` (board space) carries
 * any part of the board that passes under a shoe at `z`. A shoe stands across
 * the board and reaches further toward the toes than the heels.
 */
export function clearAbove(m: THREE.Matrix4, x: number, z: number, angle: number, toeSign: number): number {
  let top = -Infinity;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (const s of SECTION) {
    _pt.copy(s).applyMatrix4(m);
    // Only what passes under the shoe counts (a shove-it swings the nose away from it).
    const dx = _pt.x * toeSign - x, dz = _pt.z - z;
    const along = dx * ca + dz * sa, across = -dx * sa + dz * ca;
    if (Math.abs(along) < SHOE.halfLength && Math.abs(across) < SHOE.halfWidth) top = Math.max(top, _pt.y);
  }
  return top === -Infinity ? 0 : Math.max(0, top - DECK_TOP);
}

/** The tail (or nose) snap of a pop, 0..1 over the first quarter second. */
export function snapCurve(t: number): number {
  if (t < 0) return 0;
  if (t < RIG.snapIn) return smooth(t / RIG.snapIn);
  return 1 - smooth((t - RIG.snapIn) / RIG.snapOut);
}

/**
 * One step of the board rig. `toeSign` is +1 when the rider's toes face +x of
 * the board (goofy-footed on the board), −1 otherwise. `rideWorld` is the ride
 * frame's world matrix (needed only for the loose board in a bail).
 */
export function solveBoardRig(p: SkatePresent, defs: LookDefs, state: BoardRigState, dt: number, toeSign: number, rideWorld?: THREE.Matrix4, reduced = false, pull?: THREE.Vector3): BoardRigPose {
  const out = state.pose, T = state.target, sp = state.springs;
  const phase = p.phase, air = phase === 'air';
  // ── The get-up clock (see RIG.recoverSeconds).
  if (phase === 'bail') { state.getUp = false; state.heap.set(p.x, p.y, p.z); }
  else if (phase === 'recover' && state.lastPhase === 'bail') {
    state.getUp = true; state.recoverT = 0;
    // A relocation (the sim says so; off the wire, a jump from the heap) lays the board at the new spot; otherwise the rider gets up where they fell.
    state.cut = state.moved ?? Math.hypot(p.x - state.heap.x, p.z - state.heap.z) > .4;
  }
  if (state.getUp) {
    if (air || phase === 'grind' || phase === 'manual' || state.recoverT >= RIG.recoverSeconds) state.getUp = false;
    else state.recoverT += dt * (phase === 'recover' || phase === 'idle' || phase === 'roll' ? 1 : 3);
  }
  const rec = state.getUp;
  out.getUp = rec ? Math.min(1, state.recoverT / RIG.recoverSeconds) : -1;
  const wasAir = state.lastPhase === 'air';
  if (air && !wasAir && !state.popThisStep) {
    // A take-off. With an event stream, only a real pop snaps the tail; without one (a partner off the wire) every take-off is a pop.
    if (state.eventDriven) { if (!(state.popped && state.popT >= 0 && state.popT < .05)) { state.popped = false; state.popT = -1; } }
    else { state.popped = true; state.popT = 0; state.popFrom = 'tail'; }
  }
  if (!air && phase !== 'crouch' && !state.popThisStep) { state.popped = false; state.popT = -1; }
  if (state.popped && !state.popThisStep) state.popT += dt;
  if (state.popThisStep) state.popT = 0;

  // ── Flip bookkeeping. When a trick ends, keep the board where the overlay
  // last drew it (fold the shove-it's turn into yawFlip). When the sim
  // relabels nose/tail (boardYaw jumps by exactly π, e.g. at a shove-it's
  // catch), cancel the jump: the physical board did not move.
  const trick = p.trick;
  // Mid-air, a different flip id with the board still going is the same flip read further on (the sim's
  // upgrade: kickflip → double, a corner corrected): carry what the board has turned instead of ending it.
  let from: { def: FlipTrickDef | null; u: number; carry: FlipCarry | null } | null = null;
  if (state.trick && (!trick || trick.flipId !== state.trick.id)) {
    if (air && trick) from = { def: state.trick.def, u: clamp01(state.trick.u + state.trick.du), carry: state.trick.carry }; // one frame on: it keeps its pace
    else if (phase !== 'bail' && !rec) state.yawFlip = wrap(state.yawFlip + state.trick.yaw);
    state.trick = null;
  }
  if (Number.isFinite(p.boardYaw)) {
    if (state.lastYaw !== null) {
      const jump = wrap(p.boardYaw - state.lastYaw);
      if (Math.abs(Math.abs(jump) - Math.PI) < .02) state.yawFlip = wrap(state.yawFlip - jump);
    }
    state.lastYaw = p.boardYaw;
  }
  if (trick) {
    if (!state.trick) {
      const def = defs.flip(trick.flipId), u0 = clamp01(trick.u);
      state.trick = { id: trick.flipId, def, u: trick.u, du: 0, yaw: 0, carry: null };
      // Starting part-way through (an upgrade, or one picked up after a catch): begin from what is drawn now.
      if (air && def && (from || u0 > .02)) {
        const was = from ? flipAngles(from.def, from.u, from.carry, _was) : (_was.roll = _was.yaw = _was.pitch = _was.x = 0, _was);
        const now = flipAngles(def, u0, null, _angles);
        const carry: FlipCarry = { roll: nearTurn(was.roll - now.roll), yaw: was.yaw - now.yaw, pitch: nearTurn(was.pitch - now.pitch), x: was.x - now.x, e0: flipEase(u0) };
        if (Math.abs(carry.roll) + Math.abs(carry.yaw) + Math.abs(carry.pitch) + Math.abs(carry.x) > 1e-6) state.trick.carry = carry;
      }
    }
    state.trick.du = Math.max(0, Math.min(.2, trick.u - state.trick.u)); state.trick.u = trick.u;
    const d = state.trick.def, c = state.trick.carry;
    state.trick.yaw = d ? toeSign * ((d.yaw || 0) * flipEase(clamp01(trick.u)) + (c ? c.yaw * carryWeight(c, clamp01(trick.u)) : 0)) * Math.PI : 0;
  }

  state.grabT = p.grab && air ? state.grabT + dt : 0;

  // ── Targets.
  T.fill(0);
  const carve = Math.max(-1, Math.min(1, p.carve || 0));
  if (!air && phase !== 'grind' && phase !== 'bail' && !rec) {
    T[C_ROLL] = -toeSign * .11 * carve;
    T[C_STEER] = toeSign * .2 * carve;
  }
  if (p.grab && air) {
    const g = defs.grab(p.grab.grabId);
    if (g) {
      const w = clamp01(p.grab.weight), gp = grabPose(g, toeSign, BOARD.halfWidth, BOARD.halfLength);
      // Held longer, the tweak grows: the grabbed edge is pulled further round.
      const tweak = reduced ? 0 : smooth((state.grabT - .3) / .45);
      T[C_GRAB_ROLL] = gp.boardRoll * w * (1 + .7 * tweak); T[C_GRAB_PITCH] = gp.boardPitch * w; T[C_GRAB_X] = gp.boardX * w; T[C_GRAB_LIFT] = gp.lift * w;
    }
  }
  if (p.manual || phase === 'manual') {
    const nose = p.manual === 'nose-manual';
    state.manualPivot = nose ? BOARD.truckZ : -BOARD.truckZ;
    const wobble = reduced ? 0 : .045 * (p.balance || 0);
    T[C_MANUAL] = nose ? RIG.manualPitch + wobble : -RIG.manualPitch - wobble;
  }
  if (phase === 'powerslide') {
    // Trust a sim that already swung boardYaw; otherwise swing it ourselves.
    const already = Math.abs(Math.sin(wrap(p.boardYaw - p.heading))) > .5;
    const sign = carve < 0 ? -1 : 1;
    T[C_SLIDE_YAW] = already ? 0 : sign * toeSign * Math.PI * .42;
    T[C_SLIDE_ROLL] = toeSign * .07;
  }
  if (p.grind && phase === 'grind') {
    const def = defs.grind(p.grind.grindId);
    if (def) {
      const st = grindStyle(def, BOARD.truckZ, BOARD.halfLength, BOARD.axleY, BOARD.deckBottom);
      // Desired board yaw relative to the direction of travel; overlay only what the sim has not already turned.
      const across = Math.abs(Math.sin(def.deckYaw)) > .7;
      const s = across ? st.crossing * -Math.sign(toeSign || -1) : 1;
      let best = 0, bestErr = Infinity;
      for (const sg of [s, -s]) for (const k of [0, Math.PI]) {
        const cand = wrap(p.heading + sg * def.deckYaw + k);
        const err = Math.abs(wrap(cand - p.boardYaw)) + (sg === s ? 0 : .35) + (k ? .05 : 0);
        if (err < bestErr) { bestErr = err; best = wrap(cand - p.boardYaw); }
      }
      T[C_GRIND_YAW] = best;
      T[C_GRIND_PITCH] = def.deckPitch;
      T[C_GRIND_ROLL] = st.roll * (p.grind.faceSign || 1) * -toeSign;
      T[C_GRIND_SEAT] = st.seat;
      state.grindPivot = st.pivotZ;
    }
  }
  sp.step(T, dt);
  const X = sp.x;

  // ── Carrier.
  const c = out.carrier.identity();
  let lift = 0;
  if (state.popped && air) {
    // Up with the pop (the front foot drags it up to meet the tuck), and back down onto the ride frame as the ground arrives.
    const down = (p.vy || 0) > 0 ? 1 : clamp01(p.clearance / RIG.liftClearance);
    lift = RIG.liftMax * smooth((state.popT - RIG.liftAt) / RIG.liftIn) * down;
  }
  lift += X[C_GRAB_LIFT]! * clamp01(p.clearance / .2 + .3);
  const compress = RIG.compress * clamp01(p.impact || 0);
  c.makeTranslation(X[C_GRAB_X]! + (pull?.x ?? 0), lift + X[C_GRIND_SEAT]! - compress + (pull?.y ?? 0), pull?.z ?? 0);
  const yawOverlay = X[C_SLIDE_YAW]! + X[C_GRIND_YAW]!;
  if (Math.abs(yawOverlay) > 1e-6) about(c, _m.makeRotationY(yawOverlay), 0, 0, 0);
  if (Math.abs(X[C_GRIND_PITCH]!) > 1e-6) about(c, _m.makeRotationX(X[C_GRIND_PITCH]!), 0, 0, state.grindPivot);
  if (Math.abs(X[C_MANUAL]!) > 1e-6) about(c, _m.makeRotationX(X[C_MANUAL]!), 0, 0, state.manualPivot);
  const roll = X[C_GRIND_ROLL]! + X[C_SLIDE_ROLL]! + X[C_GRAB_ROLL]!;
  if (Math.abs(roll) > 1e-6) about(c, _m.makeRotationZ(roll), 0, RIG.centreY, 0);
  if (Math.abs(X[C_GRAB_PITCH]!) > 1e-6) about(c, _m.makeRotationX(X[C_GRAB_PITCH]!), 0, RIG.centreY, 0);
  if (state.popped && air) {
    const snap = RIG.snapAngle * snapCurve(state.popT);
    if (snap > 1e-6) {
      // Tail pop: nose up about the back wheels (rotation.x < 0); nollie: tail up about the front wheels.
      const nose = state.popFrom === 'nose';
      about(c, _m.makeRotationX(nose ? snap : -snap), 0, 0, nose ? BOARD.truckZ : -BOARD.truckZ);
    }
  }

  // ── Flip on top.
  const def = state.trick?.def ?? null, u = state.trick ? clamp01(state.trick.u) : 0;
  flipMatrix(def, u, toeSign, out.board, -BOARD.truckZ, state.trick?.carry ?? null);
  out.board.premultiply(c);
  if (state.yawFlip) { _m.makeRotationY(state.yawFlip); about(out.board, _m, 0, 0, 0); }

  // ── Feet clearance and flick.
  const f = out.front, b = out.back;
  f.x = f.z = f.lift = b.x = b.z = b.lift = 0; out.flip = 0;
  if (state.popped && air && state.popT < .3) {
    // The front foot drags up the grip toward the nose (the back foot for a nollie).
    const drag = Math.sin(Math.PI * clamp01(state.popT / .3));
    if (state.popFrom === 'nose') b.z -= .05 * drag; else f.z += .05 * drag;
  }
  if (def && state.trick && air) {
    const bump = flipClearance(u);
    // The flick: the front foot kicks off the toe-side corner of the nose (kickflip) or out past the nose with the heel (heelflip);
    // the back foot scoops a shove-it round and pops an impossible up.
    const flick = u < .24 ? Math.sin(Math.PI * u / .24) : 0;
    if (def.roll > 0) { f.x += toeSign * .12 * flick; f.z += .06 * flick; f.lift += .04 * flick; }
    if (def.roll < 0) { f.x += toeSign * .05 * flick; f.z += .1 * flick; f.lift += .05 * flick; }
    if (def.yaw) { b.x += (def.yaw > 0 ? -toeSign : toeSign) * .09 * flick; b.z -= .03 * flick; }
    if (def.pitch) { b.z += .06 * flick; b.lift += .03 * flick; }
    // Just clear of the spinning board: each sole rides the highest point of the board passing under its footprint.
    _n.copy(c).invert().multiply(out.board);
    f.lift += bump * Math.min(.3, clearAbove(_n, f.x * toeSign, SHOE.frontZ + f.z, SHOE.frontAngle, toeSign) + RIG.flipMargin);
    b.lift += bump * Math.min(.3, clearAbove(_n, b.x * toeSign, SHOE.backZ + b.z, SHOE.backAngle, toeSign) + RIG.flipMargin);
    out.flip = bump;
  }
  out.popT = state.popped ? state.popT : -1; out.popFrom = state.popFrom;
  out.deckRoll = X[C_ROLL]!; out.steer = X[C_STEER]!;
  out.slideYaw = X[C_SLIDE_YAW]!; out.grindYaw = X[C_GRIND_YAW]!;

  // ── Wheels.
  const grounded = !air && phase !== 'bail' && !rec;
  if (phase === 'grind' && !(p.manual)) state.wheelRate *= Math.exp(-8 * dt);
  else if (grounded) state.wheelRate = (p.fakie ? -1 : 1) * (p.speed || 0) / BOARD.wheelRadius;
  else state.wheelRate *= Math.exp(-1.2 * dt);
  state.wheelAngle = (state.wheelAngle + state.wheelRate * dt) % (Math.PI * 2);
  out.wheelAngle = state.wheelAngle;

  // ── The loose board.
  stepLooseBoard(p, state, dt, toeSign, rideWorld);
  out.free = state.freeWeight > 0; out.freeWeight = state.freeWeight;
  if (!out.free) state.lastLocal.copy(out.board);
  state.lastPhase = phase;
  return out;
}

function stepLooseBoard(p: SkatePresent, state: BoardRigState, dt: number, toeSign: number, rideWorld?: THREE.Matrix4): void {
  const out = state.pose;
  const bailing = p.phase === 'bail', recovering = state.getUp;
  if (recovering && state.cut && state.recoverT <= dt + 1e-9 && rideWorld) {
    // The sim respawned the rider at a safe spot (a camera cut): the board lies grip-up beside them there, not back at the heap.
    rideWorld.decompose(_v, _q, _s);
    state.landedPos.set(toeSign * .36, 0, .06).applyQuaternion(_q).add(_v);
    state.landedQuat.copy(_q).multiply(_q2.setFromAxisAngle(_Y, .5));
  }
  if (bailing && !state.wasFree) {
    // Launch: from where the board was drawn last frame, thrown along the bail with a flip of its own.
    _m.copy(rideWorld ?? _n.identity()).multiply(state.lastLocal);
    _m.decompose(state.pos, state.quat, _v);
    const dx = p.bail?.dirX ?? 0, dz = p.bail?.dirZ ?? 1, len = Math.hypot(dx, dz) || 1;
    state.vel.set((p.vx || 0) * .6 + dx / len * 1.4, 2.6, (p.vz || 0) * .6 + dz / len * 1.4);
    state.spin.set(4.5, 3.2, 11);
    state.floorY = p.y - (p.clearance || 0);
    state.bailT = 0; state.recoverT = 0;
  }
  if (bailing || recovering) {
    state.wasFree = true; state.freeWeight = 1;
    if (bailing) {
      state.bailT += dt;
      // Ballistic, with a floor, a bounce and a settle.
      state.vel.y -= RIG.gravity * dt;
      state.pos.addScaledVector(state.vel, dt);
      _axis.copy(state.spin); const w = _axis.length();
      if (w > 1e-6) { _q.setFromAxisAngle(_axis.multiplyScalar(1 / w), w * dt); state.quat.multiply(_q); }
      _v.set(0, 1, 0).applyQuaternion(state.quat);
      const low = state.pos.y + Math.min(0, _v.y) * DECK_TOP - (1 - Math.abs(_v.y)) * BOARD.halfWidth;
      if (low < state.floorY) {
        state.pos.y += state.floorY - low;
        if (state.vel.y < 0) state.vel.y *= -.32;
        state.vel.x *= Math.exp(-6 * dt); state.vel.z *= Math.exp(-6 * dt);
        state.spin.multiplyScalar(Math.exp(-7 * dt));
        // Settle flat, grip up or grip down, whichever it is nearer.
        const upSide = _v.y >= 0 ? 1 : -1;
        _axis.set(0, upSide, 0);
        _q.setFromUnitVectors(_v, _axis).multiply(state.quat);
        state.quat.slerp(_q, 1 - Math.exp(-6 * dt));
      }
      state.landedPos.copy(state.pos); state.landedQuat.copy(state.quat);
      state.recoverT = 0;
    } else {
      const r = state.recoverT / RIG.recoverSeconds;
      // Lies there while the rider gets up, then the stamp: the board hops back upright to the feet.
      const k = smooth((r - .46) / .3);
      if (rideWorld) {
        rideWorld.decompose(_v, _q, _s);
        const hop = Math.sin(Math.PI * k) * .2;
        state.pos.lerpVectors(state.landedPos, _v, k); state.pos.y += hop;
        state.quat.copy(state.landedQuat).slerp(_q, k);
      }
      if (r >= .85) state.freeWeight = Math.max(0, 1 - (r - .85) / .15);
    }
    out.freeWorld.compose(state.pos, state.quat, _s.set(1, 1, 1));
    return;
  }
  if (state.wasFree) {
    state.freeWeight = Math.max(0, state.freeWeight - dt / .15);
    if (state.freeWeight <= 0) state.wasFree = false;
    return;
  }
  state.freeWeight = 0;
}
