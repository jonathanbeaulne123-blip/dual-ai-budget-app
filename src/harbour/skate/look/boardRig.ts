import * as THREE from 'three';
import type { FlipTrickDef, SkatePresent, SkateSimEvent } from '../contract.ts';
import { BOARD, DECK_TOP } from './boardGeometry.ts';
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
  liftMax: .09, liftIn: .2, liftClearance: .28,
  manualPitch: .19,
  compress: .014,
  gravity: 15,
  recoverSeconds: .95,
});

export type FootOffset = { x: number; z: number; lift: number };
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
  trick: { id: string; def: FlipTrickDef | null; u: number; yaw: number } | null;
  manualPivot: number; grindPivot: number;
  wheelAngle: number; wheelRate: number;
  // Loose board.
  bailT: number; recoverT: number; freeWeight: number;
  pos: THREE.Vector3; vel: THREE.Vector3; quat: THREE.Quaternion; spin: THREE.Vector3; floorY: number;
  landedPos: THREE.Vector3; landedQuat: THREE.Quaternion; wasFree: boolean;
  lastLocal: THREE.Matrix4;
  pose: BoardRigPose;
};

export function createBoardRigState(): BoardRigState {
  return {
    springs: createSpringBank(STIFF), target: new Float64Array(C_COUNT),
    lastPhase: null, popped: false, popT: -1, popFrom: 'tail', eventDriven: false, popThisStep: false,
    yawFlip: 0, lastYaw: null, trick: null, manualPivot: -BOARD.truckZ, grindPivot: 0, wheelAngle: 0, wheelRate: 0,
    bailT: 0, recoverT: 0, freeWeight: 0,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), spin: new THREE.Vector3(), floorY: 0,
    landedPos: new THREE.Vector3(), landedQuat: new THREE.Quaternion(), wasFree: false,
    lastLocal: new THREE.Matrix4(),
    pose: {
      carrier: new THREE.Matrix4(), board: new THREE.Matrix4(), free: false, freeWeight: 0, freeWorld: new THREE.Matrix4(),
      deckRoll: 0, steer: 0, wheelAngle: 0, front: { x: 0, z: 0, lift: 0 }, back: { x: 0, z: 0, lift: 0 }, flip: 0, popT: -1, popFrom: 'tail', slideYaw: 0, grindYaw: 0,
    },
  };
}

/** Feed the sim's events for this step (null = no event stream: infer pops from take-offs). */
export function noteRigEvents(state: BoardRigState, events: readonly SkateSimEvent[] | null): void {
  state.popThisStep = false;
  if (!events) return;
  for (const e of events) {
    state.eventDriven = true;
    if (e.kind === 'pop') { state.popped = true; state.popT = 0; state.popFrom = e.from; state.popThisStep = true; }
  }
}

const smooth = (t: number) => { const k = t <= 0 ? 0 : t >= 1 ? 1 : t; return k * k * (3 - 2 * k); };
const clamp01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Flip easing: quick off the flick, slowing into the catch. */
export function flipEase(u: number): number { const k = clamp01(u); return 1 - (1 - k) * (1 - k); }

const _m = new THREE.Matrix4(), _n = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _axis = new THREE.Vector3();

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
export function flipMatrix(def: FlipTrickDef | null, u: number, toeSign: number, out: THREE.Matrix4, backFootZ = -BOARD.truckZ): THREE.Matrix4 {
  out.identity();
  if (!def) return out;
  const e = flipEase(u);
  const roll = -toeSign * def.roll * Math.PI * 2 * e, yaw = toeSign * def.yaw * Math.PI * e, pitch = def.pitch * Math.PI * 2 * e;
  if (yaw) about(out, _m.makeRotationY(yaw), 0, RIG.centreY, 0);
  if (pitch) {
    // An impossible wraps around the toe end of the back foot, out in front of the shins.
    const out2 = toeSign * .3 * Math.sin(Math.PI * clamp01(u));
    if (out2) { _m.makeTranslation(out2, 0, 0); out.multiply(_m); }
    about(out, _m.makeRotationX(pitch), 0, DECK_TOP + .03, backFootZ);
  }
  if (roll) about(out, _m.makeRotationZ(roll), 0, RIG.centreY, 0);
  return out;
}

/** How far the feet stay clear of a flipping board over u: up at once off the flick, down onto the bolts for the catch. */
export function flipClearance(u: number): number { return smooth(u / .1) * (1 - smooth((u - .74) / .26)); }

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
  if (state.trick && (!trick || trick.flipId !== state.trick.id)) {
    if (phase !== 'bail' && phase !== 'recover') state.yawFlip = wrap(state.yawFlip + state.trick.yaw);
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
    if (!state.trick) state.trick = { id: trick.flipId, def: defs.flip(trick.flipId), u: trick.u, yaw: 0 };
    state.trick.u = trick.u;
    const d = state.trick.def;
    state.trick.yaw = d && d.yaw ? toeSign * d.yaw * Math.PI * flipEase(clamp01(trick.u)) : 0;
  }

  // ── Targets.
  T.fill(0);
  const carve = Math.max(-1, Math.min(1, p.carve || 0));
  if (!air && phase !== 'grind' && phase !== 'bail' && phase !== 'recover') {
    T[C_ROLL] = -toeSign * .11 * carve;
    T[C_STEER] = toeSign * .2 * carve;
  }
  if (p.grab && air) {
    const g = defs.grab(p.grab.grabId);
    if (g) {
      const w = clamp01(p.grab.weight), gp = grabPose(g, toeSign, BOARD.halfWidth, BOARD.halfLength);
      T[C_GRAB_ROLL] = gp.boardRoll * w; T[C_GRAB_PITCH] = gp.boardPitch * w; T[C_GRAB_X] = gp.boardX * w; T[C_GRAB_LIFT] = gp.lift * w;
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
  if (state.popped && air) lift = RIG.liftMax * smooth(state.popT / RIG.liftIn) * clamp01(p.clearance / RIG.liftClearance);
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
  flipMatrix(def, u, toeSign, out.board);
  out.board.premultiply(c);
  if (state.yawFlip) { _m.makeRotationY(state.yawFlip); about(out.board, _m, 0, 0, 0); }

  // ── Feet clearance and flick.
  const f = out.front, b = out.back;
  f.x = f.z = f.lift = b.x = b.z = b.lift = 0; out.flip = 0;
  if (def && state.trick && air) {
    const bump = flipClearance(u);
    const rollAmt = Math.min(1, Math.abs(def.roll)), yawAmt = Math.min(1, Math.abs(def.yaw)), pitchAmt = Math.min(1, Math.abs(def.pitch));
    f.lift = bump * Math.max(.17 * rollAmt, .05 * yawAmt, .24 * pitchAmt);
    b.lift = bump * Math.max(.17 * rollAmt, .05 * yawAmt, .05 * pitchAmt);
    const flick = u < .32 ? Math.sin(Math.PI * u / .32) : 0;
    if (def.roll > 0) { f.x += toeSign * .11 * flick; f.z += .05 * flick; }
    if (def.roll < 0) { f.x -= toeSign * .09 * flick; f.z += .05 * flick; }
    if (def.yaw) { b.x += (def.yaw > 0 ? -toeSign : toeSign) * .09 * flick; b.z -= .03 * flick; }
    if (def.pitch) { b.z += .06 * flick; b.lift += .03 * flick; }
    out.flip = bump;
  }
  if (state.popped && air && state.popT < .3) {
    // The front foot drags up the grip toward the nose (the back foot for a nollie).
    const drag = Math.sin(Math.PI * clamp01(state.popT / .3));
    if (state.popFrom === 'nose') b.z -= .05 * drag; else f.z += .05 * drag;
  }
  out.popT = state.popped ? state.popT : -1; out.popFrom = state.popFrom;
  out.deckRoll = X[C_ROLL]!; out.steer = X[C_STEER]!;
  out.slideYaw = X[C_SLIDE_YAW]!; out.grindYaw = X[C_GRIND_YAW]!;

  // ── Wheels.
  const grounded = !air && phase !== 'bail' && phase !== 'recover';
  if (phase === 'grind' && !(p.manual)) state.wheelRate *= Math.exp(-8 * dt);
  else if (grounded) state.wheelRate = (p.fakie ? -1 : 1) * (p.speed || 0) / BOARD.wheelRadius;
  else state.wheelRate *= Math.exp(-1.2 * dt);
  state.wheelAngle = (state.wheelAngle + state.wheelRate * dt) % (Math.PI * 2);
  out.wheelAngle = state.wheelAngle;

  // ── The loose board.
  stepLooseBoard(p, state, dt, rideWorld);
  out.free = state.freeWeight > 0; out.freeWeight = state.freeWeight;
  if (!out.free) state.lastLocal.copy(out.board);
  state.lastPhase = phase;
  return out;
}

function stepLooseBoard(p: SkatePresent, state: BoardRigState, dt: number, rideWorld?: THREE.Matrix4): void {
  const out = state.pose;
  const bailing = p.phase === 'bail', recovering = p.phase === 'recover';
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
      state.recoverT += dt;
      const r = state.recoverT / RIG.recoverSeconds;
      // Lies there while the rider gets up, then the stamp: the board hops back upright to the feet.
      const k = smooth((r - .42) / .38);
      if (rideWorld) {
        rideWorld.decompose(_v, _q, _s);
        const hop = Math.sin(Math.PI * k) * .22;
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
