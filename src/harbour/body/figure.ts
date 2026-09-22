import * as THREE from "three";
import { BODY_HEIGHT } from "./obstacles.ts";

/**
 * Little Harbour · the body you walk around as.
 *
 * A jointed figure in the island's material language — flat-shaded
 * `MeshStandardMaterial`, no textures, nothing to download — 0.58 units tall,
 * because the Queen is 2.05 and she is a plant. Seven meshes and no skeleton:
 * this is a model village and a model-village person is a carved one.
 *
 * The walk is **procedural**, not a clip. `src/wardrobe/scene.ts` is this
 * codebase's one rigged pipeline (an `AnimationMixer` over a GLB built for
 * Hercules), and it is the right answer when there is a rigged model to play;
 * there is none for a person, and a hand-swung leg that reads as a walk beats
 * a downloaded skeleton that does not exist. The parts that make it read are
 * the ones a rig would give you: legs and arms in opposition, a bob on each
 * footfall, a weight shift into the stance leg, and a forward lean that grows
 * with speed.
 *
 * `createBodyFigure` is a **factory**, not a singleton: the partner lane makes
 * a second one with its own colours and never touches this file.
 */

export type FigureColours = {
  /** The coat: the body's own colour, and the one you tell two people apart by. */
  coat: string;
  /** Face and hands. */
  skin: string;
  /** Legs. */
  trouser: string;
  shoe: string;
  hair: string;
};

/** The house's own body, in the Court's palette. A second body passes its own. */
export const DEFAULT_FIGURE_COLOURS: Readonly<FigureColours> = Object.freeze({
  coat: "#5d7f8e", skin: "#e8c39b", trouser: "#4a4a52", shoe: "#2f2b2c", hair: "#43332a",
});

/**
 * What the body is doing beyond simply going forward — the weight.
 * `body/bodyModel.ts` computes all three and nothing else writes them; a
 * caller with no opinion (the partner's body off the wire) leaves it out and
 * gets the plain walk, which is exactly what it used to get.
 */
export type BodyMotion = {
  /** Forward pitch, −1…1: taking off, or pulling up. */
  lean: number;
  /** Roll into the turn, −1…1, positive toward the body's right. */
  bank: number;
  /** How far into a run, 0…1: swing, cadence, bob and squash all grow with it. */
  run: number;
};

export const AT_REST: Readonly<BodyMotion> = Object.freeze({ lean: 0, bank: 0, run: 0 });

export type BodyFigure = {
  /** The whole body. Its position is the feet on the ground; its `rotation.y` is the facing. */
  group: THREE.Group;
  /**
   * Put the body in the pose its gait says. `phase` is the walk's phase in
   * radians (one step per π), `gait` is 0…1 of a full walk, `t` is seconds
   * since mount for the idle breath, and `motion` is the weight — left out,
   * the body walks exactly as it always did.
   */
  pose(phase: number, gait: number, t: number, motion?: BodyMotion): void;
  /** The bounding box the twins would use, in the body's own space. */
  readonly height: number;
  setColours(next: Partial<FigureColours>): void;
  dispose(): void;
};

/** How far the legs swing at a full walk, in radians, and how far the arms do. */
const LEG_SWING = 0.82, ARM_SWING = 0.58;
/** And how much further again at a full run: the legs reach, the arms drive. */
const LEG_SWING_RUN = 0.34, ARM_SWING_RUN = 0.62;
/** The bob on each footfall, the weight shift, and the lean into the walk. */
const BOB = 0.016, ROLL = 0.045, LEAN = 0.10;
/** The bob and the roll again at a full run, and how much further forward a run leans. */
const BOB_RUN = 1.5, ROLL_RUN = 0.7, LEAN_RUN = 0.16;
/**
 * The squash on the footfall. The body is at its lowest exactly where a foot
 * lands (`|sin phase|` is zero there), so `cos(phase)^8` is a short, sharp
 * pulse on the landing and nothing at all in between: the knee taking the
 * weight, which is the single cheapest thing that makes a walk look like one.
 */
const SQUASH = 0.055;
/** How far the acceleration signal pitches the body, and the heading error rolls it, in radians. */
const LEAN_GAIN = 0.20, BANK_GAIN = 0.28;
/** How much of the carriage's pitch the head gives back, so the face keeps looking ahead. */
const HEAD_LEVEL = 0.55;

export function createBodyFigure(colours: Partial<FigureColours> = {}): BodyFigure {
  const palette: FigureColours = { ...DEFAULT_FIGURE_COLOURS, ...colours };
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const material = (colour: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    track(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9, flatShading: true, ...extra }));

  const coatMaterial = material(palette.coat);
  const skinMaterial = material(palette.skin, { flatShading: false, roughness: 0.75 });
  const trouserMaterial = material(palette.trouser);
  const shoeMaterial = material(palette.shoe, { roughness: 1 });
  const hairMaterial = material(palette.hair, { flatShading: false });

  const group = new THREE.Group();
  group.name = "body";
  // Everything below the root so the root's position stays the feet on the
  // ground: the bob, the roll and the lean move the body, not its footing.
  const carriage = new THREE.Group();
  carriage.name = "body-carriage";
  group.add(carriage);

  const torsoGeometry = track(new THREE.CapsuleGeometry(0.082, 0.12, 4, 10));
  const torso = new THREE.Mesh(torsoGeometry, coatMaterial);
  torso.name = "body-torso";
  torso.position.y = 0.30;
  torso.castShadow = true;
  carriage.add(torso);

  const headGeometry = track(new THREE.SphereGeometry(0.068, 14, 10));
  const head = new THREE.Mesh(headGeometry, skinMaterial);
  head.name = "body-head";
  head.position.y = 0.494;
  head.castShadow = true;
  carriage.add(head);
  // A cap of hair, so the head has a front and the facing reads from behind.
  const hairGeometry = track(new THREE.SphereGeometry(0.0715, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62));
  const hair = new THREE.Mesh(hairGeometry, hairMaterial);
  hair.position.y = 0.494;
  hair.rotation.x = -0.22;
  carriage.add(hair);

  const legGeometry = track(new THREE.CapsuleGeometry(0.042, 0.145, 4, 8));
  const shoeGeometry = track(new THREE.BoxGeometry(0.072, 0.034, 0.108));
  const armGeometry = track(new THREE.CapsuleGeometry(0.031, 0.118, 4, 8));
  const handGeometry = track(new THREE.SphereGeometry(0.034, 10, 8));

  /** Hips and shoulders are pivots: the limb hangs below them and swings about x. */
  const legs: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1] as const) {
    const hip = new THREE.Group();
    hip.name = side < 0 ? "body-leg-left" : "body-leg-right";
    hip.position.set(side * 0.048, 0.235, 0);
    const leg = new THREE.Mesh(legGeometry, trouserMaterial);
    leg.position.y = -0.1145;
    leg.castShadow = true;
    const shoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    shoe.position.set(0, -0.212, 0.018);
    hip.add(leg, shoe);
    carriage.add(hip);
    legs.push(hip);

    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? "body-arm-left" : "body-arm-right";
    shoulder.position.set(side * 0.092, 0.402, 0);
    const arm = new THREE.Mesh(armGeometry, coatMaterial);
    arm.position.y = -0.09;
    const hand = new THREE.Mesh(handGeometry, skinMaterial);
    hand.position.y = -0.172;
    shoulder.add(arm, hand);
    shoulder.rotation.z = side * 0.09;
    carriage.add(shoulder);
    arms.push(shoulder);
  }

  const [leftLeg, rightLeg] = legs as [THREE.Group, THREE.Group];
  const [leftArm, rightArm] = arms as [THREE.Group, THREE.Group];
  const armRest = [leftArm.rotation.z, rightArm.rotation.z] as const;

  return {
    group,
    height: BODY_HEIGHT,
    pose(phase, gait, t, motion = AT_REST) {
      const g = Math.max(0, Math.min(1, gait));
      const run = Math.max(0, Math.min(1, motion.run));
      const swing = Math.sin(phase);
      // Legs in opposition; a positive rotation about x swings the limb back,
      // because the body looks along +z. A run reaches further than a walk.
      const legSwing = (LEG_SWING + LEG_SWING_RUN * run) * g;
      leftLeg.rotation.x = -swing * legSwing;
      rightLeg.rotation.x = swing * legSwing;
      // Arms opposite their own leg, and a little less far — but they gain
      // more than the legs do at a run, which is what pumping looks like.
      const armSwing = (ARM_SWING + ARM_SWING_RUN * run) * g;
      leftArm.rotation.x = swing * armSwing;
      rightArm.rotation.x = -swing * armSwing;
      // And the elbows come away from the ribs as the pace picks up.
      leftArm.rotation.z = armRest[0] - swing * 0.05 * g - run * g * 0.16;
      rightArm.rotation.z = armRest[1] - swing * 0.05 * g + run * g * 0.16;
      // The body rises on each footfall (twice a stride), rolls into the
      // stance leg, banks into the turn it has been asked for, and leans
      // further forward the faster it goes and the harder it is pushing.
      carriage.position.y = Math.abs(swing) * BOB * (1 + BOB_RUN * run) * g;
      carriage.rotation.z = swing * ROLL * (1 + ROLL_RUN * run) * g + motion.bank * BANK_GAIN;
      const pitch = (LEAN + LEAN_RUN * run) * g + motion.lean * LEAN_GAIN;
      carriage.rotation.x = -pitch;
      // The knee takes the weight on the landing: a short squash, gone again
      // by mid-stride, and deeper the harder the foot came down.
      const impact = Math.pow(Math.abs(Math.cos(phase)), 8);
      const squash = SQUASH * (1 + run) * g * impact;
      carriage.scale.set(1 + squash * 0.45, 1 - squash, 1 + squash * 0.45);
      // Whatever the body does, the face keeps looking where it is going.
      head.rotation.x = pitch * HEAD_LEVEL;
      hair.rotation.x = -0.22 + pitch * HEAD_LEVEL;
      // Standing still, it breathes. The head keeps its height whatever the
      // chest does, so a resting body does not nod.
      const breath = (1 - g) * Math.sin(t * 1.5) * 0.012;
      torso.scale.set(1 + breath * 0.5, 1 + breath, 1 + breath * 0.5);
      head.position.y = 0.494 + breath * 0.06;
      hair.position.y = head.position.y;
    },
    setColours(next) {
      if (next.coat) coatMaterial.color.set(next.coat);
      if (next.skin) skinMaterial.color.set(next.skin);
      if (next.trouser) trouserMaterial.color.set(next.trouser);
      if (next.shoe) shoeMaterial.color.set(next.shoe);
      if (next.hair) hairMaterial.color.set(next.hair);
    },
    dispose() {
      group.removeFromParent();
      for (const item of disposables) item.dispose();
    },
  };
}
