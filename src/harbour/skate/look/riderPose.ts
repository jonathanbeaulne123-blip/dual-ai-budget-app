import * as THREE from 'three';
import type { SkatePresent, Stance } from '../contract.ts';
import type { SkateJointPose, SkateLimbPose } from '../../body/figure.ts';
import { BOARD, DECK_TOP, deckTopAt } from './boardGeometry.ts';
import { RIG, SHOE, type BoardRigPose } from './boardRig.ts';
import { grabPose, grindStyle, type LookDefs } from './catalogs.ts';
import { solveTwoBone, type FigureRig, type LimbSolution } from './ik.ts';
import { createSpringBank, type SpringBank } from './spring.ts';

/**
 * Tideline Skate Club v2 · the rider's body, from the sim's facts.
 *
 * Every frame this turns a `SkatePresent` (and the board rig's pose) into a
 * `SkateJointPose` for the carved figure plus the figure root's transform in
 * the ride frame. The pose is built in *rider terms* — hips toward the toes or
 * the nose, feet on the bolts, arms out — spring-smoothed per channel in
 * closed form (so 30 and 144 fps agree), then solved onto the figure with
 * two-bone IK so the soles stay on the grip whatever the hips do.
 *
 * Stance: a regular rider's left foot is at the nose and they face the −x
 * rail; goofy mirrors it. Riding switch swaps which foot is at the nose
 * (goofy-on-the-board), fakie only changes which way the board travels.
 */

/* ------------------------------------------------------------------ channels */

const HIP_X = 0, HIP_Y = 1, HIP_Z = 2, PITCH = 3, ROLL = 4, YAW = 5, HEAD_Y = 6, HEAD_X = 7,
  F_X = 8, F_Z = 9, F_LIFT = 10, F_ANG = 11, B_X = 12, B_Z = 13, B_LIFT = 14, B_ANG = 15,
  G_W = 16, G_X = 17, G_Z = 18, G_LIFT = 19,
  AF_OUT = 20, AF_FWD = 21, AF_BEND = 22, AB_OUT = 23, AB_FWD = 24, AB_BEND = 25,
  GRAB_F = 26, GRAB_B = 27, AIR = 28, K_F = 29, K_B = 30, N = 31;
const STIFF = [
  13, 16, 13, 12, 11, 9, 8, 8,
  32, 32, 34, 22, 32, 32, 34, 22,
  20, 30, 30, 34,
  10, 10, 10, 10, 10, 10,
  16, 16, 12, 14, 14,
];

/**
 * The riding stance, in world units and radians (rider terms). A skater, not a
 * bench squat: front foot angled up the board over the front bolts, back foot
 * across the tail bolts, knees soft and turned in toward the nose, hips and
 * shoulders opened toward the nose, the head looking down the line.
 */
export const STANCE = Object.freeze({
  frontZ: SHOE.frontZ, backZ: SHOE.backZ, frontAngle: SHOE.frontAngle, backAngle: SHOE.backAngle,
  hipX: -.012, hipZ: -.012, pitch: .16, yaw: .62, headPitch: .16,
  /** Hip height above the deck as a fraction of the straight leg (hip pivot to sole). */
  hip: .855, crouch: .6, tuck: .86,
  /** Where each knee points (rad from straight across toward the nose): the back knee turns in. */
  frontKnee: .5, backKnee: .62,
});

/** The push stroke over `pushPhase` (the sim's kick runs 0.12..0.55 of the period). */
export const PUSH = Object.freeze({
  /** Foot down at `plant`, off the ground at `lift`. */
  plant: .12, lift: .58,
  /** Rider-terms z where the foot plants and where the sweep ends, its x beside the board, the swing's arc. */
  front: .12, back: -.34, side: .23, arc: .09,
  /** Hip height (fraction of the straight leg) with the foot up and down. */
  hipUp: .8, hipDown: .62,
});

export type RiderPoseState = {
  rig: FigureRig;
  springs: SpringBank;
  target: Float64Array;
  pose: SkateJointPose & { legs: [SkateLimbPose, SkateLimbPose]; arms: [SkateLimbPose, SkateLimbPose] };
  /** The figure root (figure.group) in the ride frame. Its scale is `rig.scale`. */
  root: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  clock: number; bailT: number; recoverT: number; lastPhase: SkatePresent['phase'] | null;
  /** Seconds the current grab has been held (style tweak). */
  grabT: number;
  bailDir: THREE.Vector3;
  started: boolean;
  /**
   * Where a grab wants the board moved (ride frame) so the grabbing hand meets
   * its edge: fed back to the board rig next frame (`solveBoardRig(..., pull)`).
   */
  grabPull: THREE.Vector3;
};

const limb = (): SkateLimbPose => ({ x: 0, y: 0, z: 0, bend: 0, foot: 0, footYaw: 0, footRoll: 0 });

export function createRiderPoseState(rig: FigureRig): RiderPoseState {
  return {
    rig, springs: createSpringBank(STIFF), target: new Float64Array(N),
    pose: { carriage: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }, head: { x: 0, y: 0 }, legs: [limb(), limb()], arms: [limb(), limb()] },
    root: { position: new THREE.Vector3(0, DECK_TOP, 0), quaternion: new THREE.Quaternion() },
    clock: 0, bailT: 0, recoverT: 0, grabT: 0, lastPhase: null, bailDir: new THREE.Vector3(0, 0, 1), started: false, grabPull: new THREE.Vector3(),
  };
}

/** Which way the rider's toes point along board x, and which figure limb is at the nose. */
export function stanceSides(stance: Stance, switchRiding: boolean): { toeSign: 1 | -1; front: 0 | 1 } {
  const goofyOnBoard = (stance === 'goofy') !== Boolean(switchRiding);
  // Regular faces −x; the figure's +x limbs (index 1) then sit at the nose.
  return goofyOnBoard ? { toeSign: 1, front: 0 } : { toeSign: -1, front: 1 };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (t: number) => clamp(t, 0, 1);
const smooth = (t: number) => { const k = clamp01(t); return k * k * (3 - 2 * k); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Scratch.
const _root = new THREE.Matrix4(), _car = new THREE.Matrix4(), _carInv = new THREE.Matrix4(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _hip = new THREE.Vector3(), _anc = new THREE.Vector3(), _ang = new THREE.Vector3(), _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _pole = new THREE.Vector3();
const _s1 = new THREE.Vector3(1, 1, 1), _Y = new THREE.Vector3(0, 1, 0), _axis = new THREE.Vector3();
const _sol: LimbSolution = { x: 0, y: 0, z: 0, bend: 0 };
const _limbQ = new THREE.Quaternion();
const _ikCar = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
const LIMB_ORDER_REGULAR = [[1, true], [0, false]] as const, LIMB_ORDER_GOOFY = [[0, true], [1, false]] as const;

/**
 * Solve one frame. `defs` looks up the trick catalogs; `board` is this frame's
 * board rig pose (solve the rig first); `stance` overrides `present.stance`.
 */
export function solveRiderPose(p: SkatePresent, defs: LookDefs, state: RiderPoseState, dt: number, stance: Stance = p.stance, board: BoardRigPose, reduced = false): SkateJointPose {
  const rig = state.rig, fs = rig.scale, T = state.target;
  const { toeSign, front: fi } = stanceSides(stance, p.switch);
  const bi = (1 - fi) as 0 | 1;
  const n = -toeSign; // the nose's side along the figure's own x
  const legLen = (rig.thigh + rig.shin + rig.soleDrop) * fs;
  const flourish = reduced ? .35 : 1;
  const phase = p.phase, air = phase === 'air';
  state.clock += dt;

  // ── Bail / recover clocks.
  if (phase === 'bail') {
    if (state.lastPhase !== 'bail') {
      state.bailT = 0;
      const dx = p.bail?.dirX ?? Math.sin(p.heading), dz = p.bail?.dirZ ?? Math.cos(p.heading);
      const c = Math.cos(p.boardYaw), s = Math.sin(p.boardYaw);
      state.bailDir.set(dx * c - dz * s, 0, dx * s + dz * c);
      if (state.bailDir.lengthSq() < 1e-8) state.bailDir.set(0, 0, 1);
      state.bailDir.normalize();
    }
    state.bailT += dt;
  }
  // The get-up runs on the board rig's clock (it outlasts the sim's short recover phase).
  const rec = board.getUp >= 0, gr = rec ? board.getUp : 0;
  state.recoverT = gr * RIG.recoverSeconds;

  state.grabT = p.grab && air ? state.grabT + dt : 0;

  // ── Targets, in rider terms.
  T[HIP_X] = STANCE.hipX; T[HIP_Y] = STANCE.hip * legLen; T[HIP_Z] = STANCE.hipZ;
  const travelTurn=Math.atan2(Math.sin(p.heading-p.boardYaw),Math.cos(p.heading-p.boardYaw));
  const faceTravel=Math.atan2(Math.sin(1.25-toeSign*travelTurn),Math.cos(1.25-toeSign*travelTurn));
  T[PITCH] = STANCE.pitch; T[ROLL] = 0; T[YAW] = faceTravel;
  T[HEAD_Y] = 0; T[HEAD_X] = STANCE.headPitch;
  T[F_X] = 0; T[F_Z] = STANCE.frontZ; T[F_LIFT] = 0; T[F_ANG] = STANCE.frontAngle;
  T[B_X] = 0; T[B_Z] = STANCE.backZ; T[B_LIFT] = 0; T[B_ANG] = STANCE.backAngle;
  T[K_F] = STANCE.frontKnee; T[K_B] = STANCE.backKnee;
  T[G_W] = 0; T[G_X] = .21; T[G_Z] = -.05; T[G_LIFT] = .06;
  // Loose, uneven arms: the lead arm a little forward and out, the back arm hanging back.
  T[AF_OUT] = .34; T[AF_FWD] = .2; T[AF_BEND] = .5; T[AB_OUT] = .26; T[AB_FWD] = -.24; T[AB_BEND] = .28;
  T[GRAB_F] = 0; T[GRAB_B] = 0; T[AIR] = air ? 1 : 0;

  const carve = clamp(p.carve || 0, -1, 1), bal = clamp(p.balance || 0, -1, 1);
  const breath = Math.sin(state.clock * 1.7) * .006 * flourish;
  if (phase === 'idle') {
    // Standing on it, taller and quieter; arms hang.
    T[HIP_Y] = (STANCE.hip + .04) * legLen + breath; T[PITCH] = .1;
    T[AF_OUT] = .16; T[AB_OUT] = .18; T[AF_FWD] = .08; T[AB_FWD] = -.1; T[AF_BEND] = .3; T[AB_BEND] = .22;
  }

  if (!air && phase !== 'grind' && phase !== 'bail' && !rec) {
    // Carve: lean into the edge, hips drop, arms go with the chest.
    T[HIP_X] += .07 * carve; T[HIP_Y] -= .05 * Math.abs(carve) * legLen; T[PITCH] += .22 * carve;
    T[AF_FWD] += .25 * carve; T[AB_FWD] += .2 * carve; T[AF_OUT] += .15 * Math.abs(carve);
    // Toe-side carve opens the shoulders toward the turn; heel-side closes them.
    T[YAW] += .12 * carve;
  }

  if (phase === 'push') {
    // Front foot turns up the board over the front bolts, the body faces the nose, and the back foot
    // steps off, plants beside the board ahead of the tail, sweeps back along the ground, and swings forward again.
    const pp = ((p.pushPhase % 1) + 1) % 1;
    const K0 = PUSH.plant, K1 = PUSH.lift;
    T[F_ANG] = 1.25; T[F_Z] = .17; T[F_X] = 0; T[K_F] = 1.2;
    T[PITCH] = .3; T[HEAD_X] = .1;
    // One loop: down at `plant` (front of the stroke), sweep back to `lift`, then up and forward again.
    let gz: number, glift: number, plant: number, sw: number;
    if (pp >= K0 && pp < K1) { const k = (pp - K0) / (K1 - K0); gz = lerp(PUSH.front, PUSH.back, k); glift = 0; plant = 1; sw = -Math.cos(Math.PI * k); }
    else {
      const k = ((pp - K1 + 1) % 1) / (1 - K1 + K0);
      gz = lerp(PUSH.back, PUSH.front, smooth(k)); glift = PUSH.arc * Math.sin(Math.PI * k); plant = 1 - Math.sin(Math.PI * Math.min(1, k * 1.15)); sw = Math.cos(Math.PI * k);
    }
    T[G_W] = 1; T[G_X] = PUSH.side; T[G_Z] = gz; T[G_LIFT] = glift;
    // The standing knee takes the drop so the stroke can reach the ground; hips ride over the front foot and follow the stroke back.
    T[HIP_Y] = (PUSH.hipUp - (PUSH.hipUp - PUSH.hipDown) * plant) * legLen;
    T[HIP_Z] = lerp(.07, -.07, clamp01((gz - PUSH.front) / (PUSH.back - PUSH.front))); T[HIP_X] = .045;
    // Arms swing against the stroke: the back arm forward as the foot sweeps back.
    sw *= flourish;
    T[AF_FWD] = .1 - .35 * sw; T[AB_FWD] = .1 + .55 * sw; T[AF_OUT] = .22; T[AB_OUT] = .2; T[AF_BEND] = .55; T[AB_BEND] = .5;
  }

  const crouch = clamp01(p.crouch || 0);
  if (!air && crouch > 0 && phase !== 'bail' && !rec) {
    T[HIP_Y] -= (STANCE.hip - STANCE.crouch) * legLen * crouch; T[HIP_Z] -= .03 * crouch; T[PITCH] += .32 * crouch;
    T[AF_OUT] = lerp(T[AF_OUT]!, .25, crouch); T[AB_OUT] = lerp(T[AB_OUT]!, .3, crouch);
    T[AF_FWD] = lerp(T[AF_FWD]!, -.25, crouch); T[AB_FWD] = lerp(T[AB_FWD]!, -.35, crouch);
    T[AF_BEND] = lerp(T[AF_BEND]!, .55, crouch); T[AB_BEND] = lerp(T[AB_BEND]!, .5, crouch);
    T[HEAD_X] = .3; T[YAW] += .08 * crouch;
  }

  if (air) {
    // In flight the hips hold their height in the ride frame; the board comes up to the feet, so the knees tuck.
    const pt = board.popT;
    const burst = pt >= 0 ? Math.sin(Math.PI * clamp01(pt / .22)) : 0;
    T[HIP_Y] = (STANCE.tuck + .08 * burst) * legLen;
    T[PITCH] = .2 + .1 * board.flip; T[HEAD_X] = .35;
    if (pt >= 0 && pt < .12) { T[AF_OUT] = .65; T[AB_OUT] = .6; T[AF_FWD] = -.35; T[AB_FWD] = -.2; T[AF_BEND] = .3; T[AB_BEND] = .3; T[PITCH] = .06; }
    else { T[AF_OUT] = .75; T[AB_OUT] = .7; T[AF_FWD] = .2; T[AB_FWD] = .05; T[AF_BEND] = .55; T[AB_BEND] = .5; }
    // Reaching for the ground as it arrives.
    if ((p.vy || 0) < 0 && p.clearance < .35 && board.flip < .2) { T[AF_OUT] = .95; T[AB_OUT] = .9; T[PITCH] = .12; }
    // Air spins: shoulders lead, arms wrap.
    const twist = clamp(Math.abs(p.bodyTwist || 0) / 1.2, 0, 1);
    if (twist > 0) { T[AF_FWD] = lerp(T[AF_FWD]!, .7, twist); T[AB_FWD] = lerp(T[AB_FWD]!, .55, twist); T[AF_OUT] = lerp(T[AF_OUT]!, .25, twist); T[AB_OUT] = lerp(T[AB_OUT]!, .2, twist); T[AF_BEND] = lerp(T[AF_BEND]!, 1.1, twist); T[AB_BEND] = lerp(T[AB_BEND]!, 1, twist); }
    if (p.grab) {
      const g = defs.grab(p.grab.grabId);
      if (g) {
        const w = clamp01(p.grab.weight), gp = grabPose(g, toeSign, BOARD.halfWidth, BOARD.halfLength);
        // Held longer, the grab gets its style: the tweak grows (board rig) and the body arches with it.
        const tweak = smooth((state.grabT - .3) / .45) * flourish;
        const tip = g.edge === 'nose' || g.edge === 'tail';
        if (g.hand === 'front') T[GRAB_F] = w; else T[GRAB_B] = w;
        // Knees up and the board pulled to the hips; the chest stays up and reaches down to the edge rather than folding over it.
        T[HIP_Y] -= .1 * w * legLen;
        T[PITCH] = lerp(T[PITCH]!, g.edge === 'toe' ? .34 : g.edge === 'heel' ? -.02 : .22, w) + gp.lean * .2 * tweak;
        // Reach: drop the grabbing shoulder toward its edge (heel grabs reach behind, so the chest opens instead).
        T[ROLL] += (g.hand === 'front' ? .16 : -.16) * w * (tip ? 1.5 : 1);
        T[YAW] += (g.edge === 'heel' ? -.2 : g.edge === 'toe' ? .12 : g.edge === 'nose' ? .25 : -.1) * w + (g.edge === 'heel' ? -.18 : .1) * tweak;
        T[HIP_X] += (g.edge === 'heel' ? -.03 : .02) * w;
        T[HEAD_X] = lerp(T[HEAD_X]!, .45, w);
        // The other arm is thrown out for balance and style.
        if (g.hand === 'front') { T[AB_OUT] = lerp(T[AB_OUT]!, 1.05 + .25 * tweak, w); T[AB_FWD] = lerp(T[AB_FWD]!, -.35, w); T[AB_BEND] = lerp(T[AB_BEND]!, .75 - .3 * tweak, w); }
        else { T[AF_OUT] = lerp(T[AF_OUT]!, 1.05 + .25 * tweak, w); T[AF_FWD] = lerp(T[AF_FWD]!, .4, w); T[AF_BEND] = lerp(T[AF_BEND]!, .75 - .3 * tweak, w); }
      }
    }
  }

  if (phase === 'land' || (p.impact || 0) > .05) { T[AF_OUT] += .4 * (p.impact || 0); T[AB_OUT] += .4 * (p.impact || 0); }

  if (phase === 'grind' && p.grind) {
    const def = defs.grind(p.grind.grindId);
    if (def) {
      const st = grindStyle(def, BOARD.truckZ, BOARD.halfLength, BOARD.axleY, BOARD.deckBottom);
      // Locked on: down in the knees, chest over the rail, weight toward the grinding truck.
      T[HIP_Z] = st.hz + .05 * st.press; T[ROLL] = .28 * st.press; T[HIP_Y] = (STANCE.hip - .13 - .07 * Math.abs(st.press)) * legLen;
      T[PITCH] = .26;
      T[F_LIFT] = st.frontLift; T[B_LIFT] = st.backLift;
      T[AF_OUT] = .55 + .7 * st.arms; T[AB_OUT] = .5 + .7 * st.arms; T[AF_FWD] = .1; T[AB_FWD] = 0; T[AF_BEND] = .25; T[AB_BEND] = .25;
      if (st.straddle > 0) { T[YAW] = lerp(T[YAW]!, .12, st.straddle); T[PITCH] = .14; T[HIP_Y] -= .03 * legLen; T[K_F] = T[K_B] = lerp(T[K_B]!, .2, st.straddle); }
    }
    // Balance: hips and arms see-saw.
    T[HIP_X] += .035 * bal; T[ROLL] += .18 * bal;
    T[AF_OUT] += .45 * bal * flourish; T[AB_OUT] -= .45 * bal * flourish;
  }

  if (phase === 'manual' || p.manual) {
    const nose = p.manual === 'nose-manual';
    T[HIP_Z] = nose ? .14 : -.14; T[PITCH] = nose ? .22 : .04; T[HIP_Y] = (STANCE.hip - .05) * legLen;
    T[AF_OUT] = 1.1 + .45 * bal * flourish; T[AB_OUT] = 1.05 - .45 * bal * flourish; T[AF_FWD] = .1; T[AB_FWD] = 0; T[AF_BEND] = .2; T[AB_BEND] = .2;
    T[ROLL] = .15 * bal; T[HIP_X] += .02 * bal;
  }

  if (phase === 'powerslide') {
    // Sat back against the slide: knees bent, hips toward the heels, chest still facing down the line, arms out front.
    T[HIP_Y] = (STANCE.hip - .17) * legLen; T[PITCH] = -.16; T[HIP_Z] = .03; T[HIP_X] = -.06; T[B_Z] = STANCE.backZ - .03;
    T[AF_OUT] = .7; T[AB_OUT] = .55; T[AF_FWD] = .6; T[AB_FWD] = .25; T[AF_BEND] = .5; T[AB_BEND] = .6;
  }

  state.springs.step(T, state.started ? dt : 0);
  if (!state.started) { for (let i = 0; i < N; i += 1) state.springs.set(i, T[i]!); state.started = true; }
  const X = state.springs.x;

  // ── The root: the figure in the ride frame (turned with the board's own yaw overlays; tumbling in a bail).
  // Keep the feet planted sideways on the deck; the carriage turns the rider toward travel.
  const theta = toeSign * Math.PI / 2;
  const root = state.root;
  let ikW = 1;
  const pose = state.pose;
  let fk = false;
  if (phase === 'bail' || rec) {
    fk = true;
    const t = state.bailT, bailing = phase === 'bail';
    // Bail: the feet stay where the board was for a beat while the body pitches over (fast, then a bounce in the heap).
    // Get-up: from the heap onto hands and knees, up to a crouch, stamp the tail, onto the board.
    const fall = bailing ? 1 - (1 - clamp01(t / .45)) ** 2 : 1 - smooth(gr / .55);
    const bounce = bailing && t > .45 ? Math.sin((t - .45) * 16) * Math.exp(-(t - .45) * 7) * .1 * flourish : 0;
    const A = 1.45 * fall + bounce;
    _axis.set(state.bailDir.z, 0, -state.bailDir.x).normalize();
    _q.setFromAxisAngle(_axis, A);
    _q2.setFromAxisAngle(_Y, theta + .5 * smooth(t / .6) * fall);
    root.quaternion.copy(_q).multiply(_q2);
    const slide = .28 * smooth(t / .6) * (bailing ? 1 : fall);
    let rootY = lerp(DECK_TOP, .1, smooth(t / .35));
    if (bailing) ikW = 1 - smooth(t / .2);
    else {
      rootY = lerp(.1 * fall, DECK_TOP, smooth((gr - .55) / .3));
      ikW = smooth((gr - .55) / .35);
    }
    root.position.set(state.bailDir.x * slide, rootY, state.bailDir.z * slide);
  } else {
    _q.setFromAxisAngle(_Y, theta + board.slideYaw + board.grindYaw);
    root.quaternion.copy(_q);
    root.position.set(0, DECK_TOP, 0);
  }
  _root.compose(root.position, root.quaternion, _v.set(fs, fs, fs));

  // ── Carriage: hips placed in the ride frame, torso turned in rider terms.
  const carrierY = board.carrier.elements[13]!;
  const hipBaseY = DECK_TOP + carrierY * (1 - X[AIR]!);
  const impact = clamp01(p.impact || 0);
  const hy = X[HIP_Y]! - .34 * legLen * impact;
  // Rider terms to board space: toe side = toeSign·x, nose = +z. (Hips ride the board's yaw overlays.)
  _hip.set(toeSign * X[HIP_X]!, hipBaseY + hy, X[HIP_Z]!);
  _hip.applyAxisAngle(_Y, board.slideYaw + board.grindYaw);
  // Into root-local rig units.
  _m.copy(_root).invert();
  _hip.applyMatrix4(_m);
  const twist = air ? clamp(p.bodyTwist || 0, -1.4, 1.4) : 0;
  _q.setFromAxisAngle(_Y, n * X[YAW]! + twist - .55 * board.slideYaw);
  // (+x rotation tips the chest toward the toes: the figure looks along its own +z.)
  _q2.setFromAxisAngle(_v.set(1, 0, 0), X[PITCH]! + .28 * impact); _q.multiply(_q2);
  _q2.setFromAxisAngle(_v.set(0, 0, 1), -n * X[ROLL]!); _q.multiply(_q2);
  _e.setFromQuaternion(_q, 'XYZ');
  _v.set(0, rig.hipCentreY, 0).applyQuaternion(_q);
  const car = pose.carriage;
  const ikCar = _ikCar; ikCar.x = _hip.x - _v.x; ikCar.y = _hip.y - _v.y; ikCar.z = _hip.z - _v.z; ikCar.rx = _e.x; ikCar.ry = _e.y; ikCar.rz = _e.z;

  // FK carriage for the tumble: curled, hips at rest.
  const t = state.bailT;
  const flail = (phase === 'bail' ? Math.exp(-(t - .25) * 3) * smooth(t / .25) : 0) * flourish;
  // Knees stay folded under the body until it is up on its feet.
  const curl = phase === 'bail' ? .45 + .55 * smooth(t / .4) : 1 - smooth((gr - .35) / .3);
  // Falling forward the body folds over; falling back it lies flat and the knees come up.
  const forward = state.bailDir.x * toeSign >= 0 ? 1 : -1;
  if (fk) {
    car.x = lerp(0, ikCar.x, ikW); car.y = lerp(-.05 * curl, ikCar.y, ikW); car.z = lerp(0, ikCar.z, ikW);
    car.rx = lerp((forward > 0 ? .12 : -.2) * curl + .1 * Math.sin(t * 9) * flail, ikCar.rx, ikW); car.ry = lerp(0, ikCar.ry, ikW); car.rz = lerp(.15 * Math.sin(t * 7) * flail, ikCar.rz, ikW);
  } else Object.assign(car, ikCar);
  _e.set(car.rx, car.ry, car.rz, 'XYZ'); _q.setFromEuler(_e);
  _car.compose(_w.set(car.x, car.y, car.z), _q, _s1).premultiply(_root);
  if (fk) {
    // A body in a heap rests on the ground: never let the head or hips sink into it.
    let low = Infinity;
    for (const y of [rig.hipCentreY, rig.shoulders[0].y + .09]) low = Math.min(low, _v.set(0, y, 0).applyMatrix4(_car).y);
    const floor = .07 * fs * (1 - ikW);
    if (low < floor) { root.position.y += floor - low; _root.compose(root.position, root.quaternion, _v.set(fs, fs, fs)); _car.compose(_w.set(car.x, car.y, car.z), _q, _s1).premultiply(_root); }
  }
  _carInv.copy(_car).invert();

  // ── Legs.
  const carrier = board.carrier;
  const order = fi === 1 ? LIMB_ORDER_REGULAR : LIMB_ORDER_GOOFY;
  for (const [i, isFront] of order) {
    const leg = pose.legs[i];
    const ox = isFront ? board.front.x : board.back.x, oz = isFront ? board.front.z : board.back.z, ol = isFront ? board.front.lift : board.back.lift;
    const fx = toeSign * X[isFront ? F_X : B_X]! + ox, fz = X[isFront ? F_Z : B_Z]! + oz;
    const lift = X[isFront ? F_LIFT : B_LIFT]! + ol;
    const ang = X[isFront ? F_ANG : B_ANG]!;
    // Sole on the grip, the ankle above it and a little behind the shoe centre.
    _fwd.set(toeSign * Math.cos(ang), 0, Math.sin(ang));
    _anc.set(fx, deckTopAt(fx, fz) + lift, fz)
      .addScaledVector(_Y, rig.soleDrop * fs).addScaledVector(_fwd, -rig.toeOffset * fs)
      .applyMatrix4(carrier);
    _up.set(0, 1, 0).transformDirection(carrier);
    _fwd.transformDirection(carrier);
    // The knee points across the board toward the toes, turned in toward the nose (the back knee more).
    const ka = X[isFront ? K_F : K_B]!;
    _pole.set(toeSign * Math.cos(ka), .12, Math.sin(ka)).transformDirection(carrier);
    if (!isFront && X[G_W]! > 1e-3) {
      // The push foot on the ground beside the board, toe side, pointing down the line.
      const gw = clamp01(X[G_W]!);
      _w.set(0, 0, 1);
      _ang.set(toeSign * X[G_X]!, X[G_LIFT]! + rig.soleDrop * fs, X[G_Z]!).addScaledVector(_w, -rig.toeOffset * fs);
      _anc.lerp(_ang, gw); _fwd.lerp(_w, gw).normalize(); _up.lerp(_Y, gw).normalize();
      _pole.lerp(_v.set(toeSign * .35, .1, 1).normalize(), gw).normalize();
    }
    _anc.applyMatrix4(_carInv);
    _fwd.transformDirection(_carInv); _up.transformDirection(_carInv); _pole.transformDirection(_carInv);
    solveTwoBone(rig.hips[i], _anc, _pole, rig.thigh, rig.shin, 1, _sol);
    let lx = _sol.x, ly = _sol.y, lz = _sol.z, bend = _sol.bend;
    // Flatten the sole to the deck and point the toes where the stance says (not where the knee happens to point):
    // the ankle's rotation = (hip · knee)⁻¹ · (shoe frame: up = the grip's normal, forward = the foot's direction).
    _e.set(lx, ly, lz, 'XYZ'); _limbQ.setFromEuler(_e);
    _q2.setFromAxisAngle(_v.set(1, 0, 0), bend); _limbQ.multiply(_q2);
    _fwd.addScaledVector(_up, -_fwd.dot(_up)).normalize();
    _w.crossVectors(_up, _fwd);
    _m.makeBasis(_w, _up, _fwd);
    _q2.setFromRotationMatrix(_m);
    _q2.premultiply(_limbQ.invert());
    _e.setFromQuaternion(_q2, 'XYZ');
    const foot = _e.x, footYaw = _e.y, footRoll = _e.z;
    let fp = foot, fy = footYaw, fr = footRoll;
    if (fk) {
      // Tumble: thighs curl, knees fold, legs kick loosely.
      const side = i === fi ? 1 : -1;
      const kick = Math.sin(t * 11 + side) * .5 * flail;
      let fx0 = -.9 * curl + kick, fb = 1.3 * curl;
      if (rec) {
        // Up off the knees, then the back foot lifts and stamps the tail (the board hops up to meet it).
        const stamp = i === bi ? Math.sin(Math.PI * clamp01((gr - .44) / .24)) : 0;
        fx0 = -1.1 * curl - .7 * stamp; fb = 1.7 * curl + 1.1 * stamp;
      }
      lx = lerp(fx0, lx, ikW); ly = lerp(0, ly, ikW); lz = lerp(side * .12 * curl, lz, ikW); bend = lerp(fb, bend, ikW);
      fp = lerp(.2, fp, ikW); fy = lerp(0, fy, ikW); fr = lerp(0, fr, ikW);
    }
    leg.x = lx; leg.y = ly; leg.z = lz; leg.bend = bend; leg.foot = fp; leg.footYaw = fy; leg.footRoll = fr;
  }

  // ── Arms: forward-kinematic poses, with IK hands for grabs.
  let pulled = false;
  for (const [i, isFront] of order) {
    const arm = pose.arms[i], sd = i === 1 ? 1 : -1;
    let ax = -X[isFront ? AF_FWD : AB_FWD]!, ay = 0, az = sd * X[isFront ? AF_OUT : AB_OUT]!, ab = X[isFront ? AF_BEND : AB_BEND]!;
    const gw = clamp01(X[isFront ? GRAB_F : GRAB_B]!);
    if (gw > 1e-3 && p.grab) {
      const g = defs.grab(p.grab.grabId);
      if (g) {
        const gp = grabPose(g, toeSign, BOARD.halfWidth, BOARD.halfLength);
        const tip = g.edge === 'nose' || g.edge === 'tail';
        const hx = tip ? 0 : gp.x + Math.sign(gp.x) * .012, hz = tip ? gp.z + Math.sign(gp.z) * .02 : gp.z;
        _anc.set(hx, RIG.centreY, hz).applyMatrix4(board.board).applyMatrix4(_carInv);
        _pole.set(sd, -.2, -.6);
        solveTwoBone(rig.shoulders[i], _anc, _pole, rig.upperArm, rig.forearm, -1, _sol);
        ax = lerp(ax, _sol.x, gw); ay = lerp(0, _sol.y, gw); az = lerp(az, _sol.z, gw); ab = lerp(ab, _sol.bend, gw);
        // Out of reach: ask the rig to bring the board up to the hand.
        _v.subVectors(_anc, rig.shoulders[i]);
        const reach = (rig.upperArm + rig.forearm) * .97, dist = _v.length();
        const short = dist > reach ? dist - reach : 0;
        _v.multiplyScalar(dist > 1e-6 ? -short / dist : 0).transformDirection(_car).multiplyScalar(short * fs);
        pulled = true;
        state.grabPull.addScaledVector(_v, gw * (1 - Math.exp(-14 * dt)));
        state.grabPull.y = clamp(state.grabPull.y, -.05, .24);
        state.grabPull.x = clamp(state.grabPull.x, -.18, .18); state.grabPull.z = clamp(state.grabPull.z, -.2, .2);
      }
    }
    if (fk) {
      // Hands out in front to break the fall, a loose flap in the heap, then pushing up off the ground.
      const brace = phase === 'bail' ? 1 - smooth((t - .35) / .3) : smooth(gr / .2) * (1 - smooth((gr - .5) / .25));
      const flap = Math.sin(t * 13 + i * 2) * .5 * flail;
      const loose = phase === 'bail' ? .95 + .3 * Math.sin(t * 10 + i) * flail : .38;
      const fx = lerp(phase === 'bail' ? -.5 + flap : -.25, -1.45 + .2 * (isFront ? 1 : -1), brace), fz = sd * lerp(loose, .42, brace);
      ax = lerp(fx, ax, ikW); az = lerp(fz, az, ikW); ab = lerp(lerp(.5, .3, brace), ab, ikW); ay = lerp(0, ay, ikW);
    }
    arm.x = ax; arm.y = ay; arm.z = az; arm.bend = ab;
  }

  if (!pulled) state.grabPull.multiplyScalar(Math.exp(-8 * dt));

  // ── Head: looks down the line of travel.
  const look = (p.fakie ? -n : n) * Math.PI / 2 * .85 - car.ry;
  pose.head.y = fk ? lerp(0, clamp(look, -1.3, 1.3), ikW) : clamp(look, -1.3, 1.3) + X[HEAD_Y]!;
  pose.head.x = X[HEAD_X]! - car.rx * .4;
  state.lastPhase = phase;
  return pose;
}
