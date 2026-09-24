import * as THREE from 'three';

/**
 * Two-bone IK for the carved figure's limbs, and a measurement of the figure
 * read off its scene graph (so a playable avatar with its own anatomy is
 * measured, not assumed).
 *
 * Limb convention (figure.ts): a limb hangs along −y from its pivot; the hinge
 * is a rotation about the limb's local x. `sigma = +1` is a knee (the distal
 * bone folds back, so the joint points +z); `sigma = −1` an elbow (the
 * forearm folds forward, the joint points −z).
 */
export type FigureRig = {
  /** figure.group scale inside the look's ride frame. */
  scale: number;
  hips: readonly [THREE.Vector3, THREE.Vector3];
  shoulders: readonly [THREE.Vector3, THREE.Vector3];
  thigh: number; shin: number;
  /** Shoe centre relative to the ankle pivot (y down, z toward the toes), and its half-length. */
  soleDrop: number; toeOffset: number; shoeHalf: number;
  upperArm: number; forearm: number; hand: number;
  hipCentreY: number;
};

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Read the rig off a figure built by `createBodyFigure` (defaults when a part is missing). */
export function measureFigureRig(group: THREE.Object3D, scale = group.scale.x): FigureRig {
  const get = (n: string) => group.getObjectByName(n) ?? null;
  const hipL = get('body-leg-left'), hipR = get('body-leg-right');
  const knee = get('body-knee-left'), ankle = get('body-ankle-left'), shoe = get('body-shoe-left') as THREE.Mesh | null;
  const shL = get('body-arm-left'), shR = get('body-arm-right'), elbow = get('body-elbow-left'), hand = get('body-hand-left');
  const hips = [hipL ? hipL.position.clone() : v(-.048, .235), hipR ? hipR.position.clone() : v(.048, .235)] as const;
  const shoulders = [shL ? shL.position.clone() : v(-.092, .402), shR ? shR.position.clone() : v(.092, .402)] as const;
  let shoeHalf = .054;
  if (shoe?.geometry) { shoe.geometry.computeBoundingBox(); const b = shoe.geometry.boundingBox!; shoeHalf = (b.max.z - b.min.z) / 2; }
  return {
    scale, hips, shoulders,
    thigh: knee ? -knee.position.y : .1145,
    shin: ankle ? -ankle.position.y : .0805,
    soleDrop: shoe ? -shoe.position.y + .017 : .034,
    toeOffset: shoe ? shoe.position.z : .018,
    shoeHalf,
    upperArm: elbow ? -elbow.position.y : .09,
    forearm: hand ? -hand.position.y : .082,
    hand: .034,
    hipCentreY: (hips[0].y + hips[1].y) / 2,
  };
}

export type LimbSolution = { x: number; y: number; z: number; bend: number };

const _d = v(), _e1 = v(), _e2 = v(), _e3 = v(), _f1 = v(), _f2 = v(), _f3 = v(), _tmp = v();
const _E = new THREE.Matrix4(), _F = new THREE.Matrix4(), _R = new THREE.Matrix4(), _eul = new THREE.Euler();

/**
 * Solve a two-bone limb whose pivot is at `root` (parent space) so its end
 * reaches `target`, with the hinge pointing toward `pole`. Writes Euler XYZ
 * and the hinge bend into `out`. Unreachable targets are clamped to reach.
 */
export function solveTwoBone(root: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3, l1: number, l2: number, sigma: 1 | -1, out: LimbSolution): LimbSolution {
  _d.subVectors(target, root);
  let dist = _d.length();
  if (dist < 1e-6) { _d.set(0, -1, 0); dist = 1e-6; }
  const lo = Math.abs(l1 - l2) + 1e-4, hi = (l1 + l2) * .9995;
  const D = Math.min(hi, Math.max(lo, dist));
  const cosK = (l1 * l1 + l2 * l2 - D * D) / (2 * l1 * l2);
  const bend = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosK)));
  // The chain's end in the limb's local frame at this bend.
  _e1.set(0, -l1 - l2 * Math.cos(bend), -sigma * l2 * Math.sin(bend)).normalize();
  _e2.set(0, 0, sigma).addScaledVector(_e1, -_e1.z * sigma).normalize();
  _e3.crossVectors(_e1, _e2);
  _f1.copy(_d).normalize();
  _f2.copy(pole).addScaledVector(_f1, -pole.dot(_f1));
  if (_f2.lengthSq() < 1e-8) { _tmp.set(0, 0, sigma); _f2.copy(_tmp).addScaledVector(_f1, -_tmp.dot(_f1)); if (_f2.lengthSq() < 1e-8) _f2.set(1, 0, 0); }
  _f2.normalize();
  _f3.crossVectors(_f1, _f2);
  _E.makeBasis(_e1, _e2, _e3); _F.makeBasis(_f1, _f2, _f3);
  _R.copy(_E).transpose().premultiply(_F);
  _eul.setFromRotationMatrix(_R, 'XYZ');
  out.x = _eul.x; out.y = _eul.y; out.z = _eul.z; out.bend = bend;
  return out;
}
