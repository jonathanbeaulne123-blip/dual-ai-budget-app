import * as THREE from 'three';
import type { SkatePresent, SkateSimEvent, Stance } from '../contract.ts';
import type { BodyFigure, BodyMotion } from '../../body/figure.ts';
import { createSkateboard, type Skateboard } from '../board.ts';
import type { SkateDeckId } from '../park.ts';
import { BOARD } from './boardGeometry.ts';
import { createBoardRigState, noteRigEvents, solveBoardRig, type BoardRigState } from './boardRig.ts';
import { resolveCatalogs, type LookDefs, type SkateLookCatalogs } from './catalogs.ts';
import type { CanvasFactory } from './deckArt.ts';
import { createSkateFx, type FxContact, type LookTheme, type SkateFx } from './fx.ts';
import { measureFigureRig } from './ik.ts';
import { createHeadTwist, type HeadTwist } from './headTwist.ts';
import { createRiderPoseState, solveRiderPose, stanceSides, type RiderPoseState } from './riderPose.ts';

export { poseFromLegacyAct } from './legacy.ts';
export type { SkateLookCatalogs, LookDefs } from './catalogs.ts';
export type { LookTheme } from './fx.ts';

/**
 * Tideline Skate Club v2 · the look, in one place.
 *
 * `createSkaterLook` owns the board, the board rig, the rider's pose (applied
 * through the figure's `skatePose` hook) and the FX. Integration adds `root`
 * to the world container and, while skating, calls `update` once a frame:
 *
 *   const look = createSkaterLook({ figure, deckId, tier, catalogs, theme });
 *   world.add(look.root);
 *   // each frame: look.update(present, events, dt, reducedMotion);
 *   // on unmount: look.release();  // hands the figure back to its old parent
 *
 * While the look holds the figure it owns `figure.group`'s transform and calls
 * `figure.pose` itself — the walker must not write either.
 */
export type SkaterLookOptions = {
  figure: BodyFigure;
  deckId?: SkateDeckId;
  tier?: 'full' | 'lite';
  catalogs?: SkateLookCatalogs | LookDefs;
  theme?: LookTheme;
  /** Force a stance (else `present.stance`). */
  stance?: Stance | null;
  /** Uniform scale of the whole rider + board (the partner is drawn smaller). */
  scale?: number;
  canvas?: CanvasFactory;
};

export type SkaterLook = {
  /** Add to the world container. Holds the moving ride frame and the world-space FX. */
  root: THREE.Group;
  /** The ride frame (board rest frame): the board and the rider live inside it. */
  ride: THREE.Group;
  board: Skateboard;
  update(present: SkatePresent, events: readonly SkateSimEvent[] | null, dt: number, reducedMotion: boolean): void;
  setDeck(id: SkateDeckId): void;
  setStance(stance: Stance | null): void;
  setTheme(theme: LookTheme): void;
  /** Swap the rider (e.g. the walker changed avatar). */
  setFigure(figure: BodyFigure): void;
  /** A banked line worth celebrating: paper stars and lanterns, 0..1. */
  celebrate(strength: number): void;
  /** Hand the figure back to the parent it had, at rest. The look stays usable (next update re-adopts). */
  release(): void;
  dispose(): void;
};

export function createSkaterLook(opts: SkaterLookOptions): SkaterLook {
  const tier = opts.tier ?? 'full';
  const defs = resolveCatalogs(opts.catalogs);
  const scale = opts.scale ?? 1;
  let stance: Stance | null = opts.stance ?? null;
  let reducedLast = false;

  const root = new THREE.Group(); root.name = 'skater-look';
  const ride = new THREE.Group(); ride.name = 'skater-ride'; ride.scale.setScalar(scale); root.add(ride);
  const board = createSkateboard(opts.deckId ?? 'tideline', { tier, canvas: opts.canvas });
  ride.add(board.group);
  const fx: SkateFx = createSkateFx({ tier, theme: opts.theme ?? 'classic' });
  root.add(fx.group);

  let figure = opts.figure;
  let home: { parent: THREE.Object3D | null; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 } | null = null;
  let rider: RiderPoseState | null = null;
  let twist: HeadTwist | null = null;
  const rigState: BoardRigState = createBoardRigState();
  const motion: BodyMotion = { lean: 0, bank: 0, run: 0, air: 0, rise: 0, crouch: 0, slide: 0, emote: null, emoteAt: 0, flourish: 1 };
  let clock = 0;

  function adopt(): RiderPoseState {
    if (rider && home) return rider;
    const g = figure.group;
    home = { parent: g.parent, position: g.position.clone(), quaternion: g.quaternion.clone(), scale: g.scale.clone() };
    g.scale.divideScalar(scale);
    ride.add(g);
    rider = createRiderPoseState(measureFigureRig(g, g.scale.x));
    const carriage = g.getObjectByName('body-carriage');
    twist = carriage ? createHeadTwist(carriage, rider.rig.shoulders[0].y + .012) : null;
    return rider;
  }
  function release(): void {
    if (!home) return;
    const g = figure.group;
    if (home.parent) home.parent.add(g); else g.removeFromParent();
    g.position.copy(home.position); g.quaternion.copy(home.quaternion); g.scale.copy(home.scale);
    home = null; rider = null;
    twist?.release(); twist = null;
    motion.skatePose = undefined;
    figure.pose(0, 0, clock, motion);
  }

  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
  const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _s = new THREE.Vector3();
  const contact: FxContact = { wheels: new Float32Array(12), grind: new THREE.Vector3(), centre: new THREE.Vector3(), ground: 0 };

  return {
    root, ride, board,
    update(p, events, dt, reduced) {
      const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, .1) : 0;
      clock += step; reducedLast = reduced;
      const st = adopt();
      const who = stance ?? p.stance;
      const { toeSign } = stanceSides(who, p.switch);
      // The ride frame: where the sim says the board's rest frame is. In a bail only its heading counts.
      ride.position.set(p.x, p.y, p.z);
      const loose = p.phase === 'bail' || p.phase === 'recover';
      _e.set(loose ? 0 : p.boardPitch, p.boardYaw, loose ? 0 : p.boardRoll, 'YXZ');
      ride.quaternion.setFromEuler(_e);
      ride.updateMatrix();
      noteRigEvents(rigState, events);
      const pose = solveBoardRig(p, defs, rigState, step, toeSign, ride.matrix, reduced, st.grabPull);
      board.setCarve(reduced ? pose.deckRoll * .5 : pose.deckRoll, pose.steer);
      board.setWheelAngle(pose.wheelAngle);
      // Board: the rig's local pose, or the loose board brought into the ride frame.
      pose.board.decompose(_p, _q, _s);
      if (pose.freeWeight > 0) {
        _inv.copy(ride.matrix).invert();
        _m.multiplyMatrices(_inv, pose.freeWorld).decompose(_p2, _q2, _s);
        _p.lerp(_p2, pose.freeWeight); _q.slerp(_q2, pose.freeWeight);
      }
      board.group.position.copy(_p); board.group.quaternion.copy(_q); board.group.scale.set(1, 1, 1);
      // Rider.
      motion.skatePose = solveRiderPose(p, defs, st, step, who, pose, reduced);
      motion.flourish = reduced ? 0 : 1;
      figure.group.position.copy(st.root.position); figure.group.quaternion.copy(st.root.quaternion);
      figure.pose(0, 0, clock, motion);
      // An authored face is baked into the coat: turn it with the head (the plain figure turns its own head).
      if (twist) { twist.sync(); twist.set(motion.skatePose.head.y, motion.skatePose.head.x * .6); }
      // FX contacts, in root space.
      board.group.updateMatrix();
      _m.multiplyMatrices(ride.matrix, board.group.matrix);
      let k = 0;
      for (const z of [BOARD.truckZ, -BOARD.truckZ]) for (const x of [-BOARD.wheelX, BOARD.wheelX]) {
        _p.set(x, 0, z).applyMatrix4(_m); contact.wheels[k++] = _p.x; contact.wheels[k++] = _p.y; contact.wheels[k++] = _p.z;
      }
      contact.grind.set(0, BOARD.axleY * .5, 0).applyMatrix4(_m);
      contact.centre.set(p.x, p.y, p.z);
      contact.ground = p.y - (p.phase === 'air' ? p.clearance : 0);
      fx.update(p, events, step, reduced, contact);
    },
    setDeck(id) { board.setDeck(id); },
    setStance(next) { stance = next; },
    setTheme(theme) { fx.setTheme(theme); },
    setFigure(next) { if (next === figure) return; release(); figure = next; },
    celebrate(strength) { fx.celebrate(strength, contact.centre.x, contact.centre.y, contact.centre.z, reducedLast); },
    release,
    dispose() {
      release();
      fx.dispose(); board.dispose();
      root.removeFromParent(); root.clear();
    },
  };
}
