import * as THREE from "three";
import { BODY_HEIGHT } from "./obstacles.ts";
import { EMOTE_SECONDS, type EmoteId } from "./bodyModel.ts";

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

/** Neutral joint positions measured from an authored playable surface. */
export type FigureAnatomy = {
  shoulderX: number; shoulderY: number; sleeveRadius: number; sleeveLength: number;
  hipX: number; hipY: number; legRadius: number; legLength: number;
  waist?: { centre: readonly [number, number, number]; size: readonly [number, number, number] };
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
  /**
   * The slope underfoot along the way the body is going, −1…1 (sine of the
   * grade; + is uphill). A climb leans the carriage into the hill and
   * shortens the stride's lift; a descent sits the body back.
   */
  incline?: number;
  /** A board rider holds a sideways stance instead of taking walking strides. (v1; superseded by `skatePose`.) */
  skate?: {push:number;balance:number;bail:boolean};
  /**
   * A complete joint pose for a board rider, solved by `skate/look/riderPose.ts`.
   * When present it wins over everything above: the carriage, both legs with
   * their knees and ankles, both arms with their elbows, and the head are set
   * straight from it. Absent, every hinge is straight and the body is exactly
   * the walker it always was.
   */
  skatePose?: SkateJointPose;

  /* ── The moves ─────────────────────────────────────────────────────────── */
  /** Height above the ground, in units. Anything above nothing is a body in flight. */
  air?: number;
  /** Vertical speed, −1…1 of a full jump: +1 is the push off, −1 is the drop. */
  rise?: number;
  /** 0…1 — the dip before a jump and the squash after a landing. */
  crouch?: number;
  /** 0…1 — how deep into a slide. */
  slide?: number;
  /** The emote playing, and how many seconds into it. */
  emote?: EmoteId | null;
  emoteAt?: number;
  /**
   * How much of the *performance* to play, 0…1. Reduced motion sets it to
   * zero: the pose still reads — an arm is still up to wave — it simply stops
   * oscillating. The move itself is never withheld; the flourish on it is.
   */
  flourish?: number;
};

/**
 * Hip (or shoulder) Euler XYZ plus the hinge below it, radians. `foot`,
 * `footYaw` and `footRoll` are the ankle's Euler XYZ (pitch, turn, roll), so a
 * skater's shoe can sit across the board while the knee points elsewhere.
 */
export type SkateLimbPose = { x: number; y: number; z: number; bend: number; foot?: number; footYaw?: number; footRoll?: number };
/**
 * A skate pose in the figure's own rig units and joint frames. Index 0 of
 * `legs`/`arms` is the limb at −x (`body-leg-left`, `body-arm-left`). A knee's
 * `bend` is positive as the shin folds back; an elbow's as the forearm folds
 * forward. The carriage rotation is Euler XYZ about the feet origin.
 */
export type SkateJointPose = {
  carriage: { x: number; y: number; z: number; rx: number; ry: number; rz: number };
  head: { x: number; y: number };
  legs: readonly [SkateLimbPose, SkateLimbPose];
  arms: readonly [SkateLimbPose, SkateLimbPose];
};

export const AT_REST: Readonly<BodyMotion> = Object.freeze({ lean: 0, bank: 0, run: 0 });

/** The authored biped coordinate system; the group is scaled to world height. */
export const FIGURE_RIG_HEIGHT = 0.58;

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
/** How far the carriage pitches into a full (sine 1) slope: a hill is leaned into, a descent sat back from. */
const INCLINE_GAIN = 0.32;
/** How much of the carriage's pitch the head gives back, so the face keeps looking ahead. */
const HEAD_LEVEL = 0.55;
/** How far the body dips into a crouch, and how much it squashes doing it. */
const CROUCH_DIP = 0.072, CROUCH_SQUASH = 0.2;
/** How low a slide rides, how far back it leans, and how wide the arms go for balance. */
const SLIDE_DIP = 0.15, SLIDE_LEAN = 0.34, SLIDE_ARMS = 0.85;

export function createBodyFigure(colours: Partial<FigureColours> = {}, anatomy?: FigureAnatomy): BodyFigure {
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
  // Keep every existing gait/emote authored in its compact model-space units.
  // The root remains at the feet, while world scale follows BODY_HEIGHT.
  group.scale.setScalar(BODY_HEIGHT / FIGURE_RIG_HEIGHT);
  // Everything below the root so the root's position stays the feet on the
  // ground: the bob, the roll and the lean move the body, not its footing.
  const carriage = new THREE.Group();
  carriage.name = "body-carriage";
  group.add(carriage);

  const torsoGeometry = track(new THREE.CapsuleGeometry(anatomy ? .048 : .082, anatomy ? anatomy.shoulderY - anatomy.hipY - .096 : .12, 4, 10));
  const torso = new THREE.Mesh(torsoGeometry, coatMaterial);
  torso.name = "body-torso";
  torso.position.y = anatomy ? (anatomy.shoulderY + anatomy.hipY) / 2 : .30;
  torso.castShadow = true;
  carriage.add(torso);

  const headY = anatomy ? .511 : .494;
  const headGeometry = track(new THREE.SphereGeometry(anatomy ? .056 : .068, 14, 10));
  const head = new THREE.Mesh(headGeometry, skinMaterial);
  head.name = "body-head";
  head.position.y = headY;
  head.castShadow = true;
  carriage.add(head);
  // A cap of hair, so the head has a front and the facing reads from behind.
  const hairGeometry = track(new THREE.SphereGeometry(anatomy ? .059 : .0715, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62));
  const hair = new THREE.Mesh(hairGeometry, hairMaterial);
  hair.name = "body-hair";
  hair.position.y = headY;
  hair.rotation.x = -0.22;
  carriage.add(hair);

  const legRadius = anatomy?.legRadius ?? .042, legLength = anatomy?.legLength ?? .145;
  const sleeveRadius = anatomy?.sleeveRadius ?? .031, sleeveLength = anatomy?.sleeveLength ?? .118;
  const legHeight = legLength + legRadius * 2, sleeveHeight = sleeveLength + sleeveRadius * 2;
  const pelvisGeometry = track(anatomy?.waist ? new THREE.BoxGeometry(...anatomy.waist.size) : new THREE.CapsuleGeometry(.061, .052, 4, 8));
  const shoeGeometry = track(new THREE.BoxGeometry(anatomy ? .064 : .072, .034, anatomy ? .094 : .108));
  const handGeometry = track(new THREE.SphereGeometry(anatomy ? .027 : .034, 10, 8));

  /**
   * Hips and shoulders are pivots: the limb hangs below them and swings about x.
   * Each limb is two capsules on a hinge — thigh/shin, upper arm/forearm —
   * whose rounded ends share the knee (elbow) centre, so with the hinge at
   * zero their union is exactly the one capsule a walk always drew. Nothing
   * but a skate pose ever bends them.
   */
  const legs: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const ankles: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  const kneeDrop = legHeight / 2, elbowDrop = sleeveHeight / 2;
  const thighGeometry = track(new THREE.CapsuleGeometry(legRadius, kneeDrop - legRadius, 4, 8));
  const upperArmGeometry = track(new THREE.CapsuleGeometry(sleeveRadius, elbowDrop - sleeveRadius, 4, 8));
  const shoeY = anatomy ? -anatomy.hipY + .017 : -.212, handY = anatomy ? -sleeveHeight : -.172;
  for (const side of [-1, 1] as const) {
    const suffix = side < 0 ? "left" : "right";
    const hip = new THREE.Group();
    hip.name = `body-leg-${suffix}`;
    hip.position.set(side * (anatomy?.hipX ?? .048), anatomy?.hipY ?? .235, 0);
    const thigh = new THREE.Mesh(thighGeometry, trouserMaterial);
    thigh.name = `body-thigh-${suffix}`;
    thigh.position.y = -(kneeDrop + legRadius) / 2;
    thigh.castShadow = true;
    const knee = new THREE.Group();
    knee.name = `body-knee-${suffix}`;
    knee.position.y = -kneeDrop;
    const shin = new THREE.Mesh(thighGeometry, trouserMaterial);
    shin.name = `body-shin-${suffix}`;
    shin.position.y = -(kneeDrop - legRadius) / 2;
    shin.castShadow = true;
    // The ankle sits on top of the shoe, so a flexed foot pivots where a foot does.
    const ankle = new THREE.Group();
    ankle.name = `body-ankle-${suffix}`;
    ankle.position.y = shoeY + kneeDrop + .017;
    const shoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    shoe.name = `body-shoe-${suffix}`;
    shoe.position.set(0, -.017, .018);
    ankle.add(shoe);
    knee.add(shin, ankle);
    hip.add(thigh, knee);
    carriage.add(hip);
    legs.push(hip); knees.push(knee); ankles.push(ankle);

    const shoulder = new THREE.Group();
    shoulder.name = `body-arm-${suffix}`;
    shoulder.position.set(side * (anatomy?.shoulderX ?? .092), anatomy?.shoulderY ?? .402, 0);
    const upper = new THREE.Mesh(upperArmGeometry, coatMaterial);
    upper.name = `body-upper-arm-${suffix}`;
    upper.position.y = -(elbowDrop + sleeveRadius) / 2;
    const elbow = new THREE.Group();
    elbow.name = `body-elbow-${suffix}`;
    elbow.position.y = -elbowDrop;
    const forearm = new THREE.Mesh(upperArmGeometry, coatMaterial);
    forearm.name = `body-forearm-${suffix}`;
    forearm.position.y = -(elbowDrop - sleeveRadius) / 2;
    const hand = new THREE.Mesh(handGeometry, skinMaterial);
    hand.name = `body-hand-${suffix}`;
    hand.position.y = handY + elbowDrop;
    elbow.add(forearm, hand);
    shoulder.add(upper, elbow);
    shoulder.rotation.z = side * 0.09;
    carriage.add(shoulder);
    arms.push(shoulder); elbows.push(elbow);
  }

  // The generic biped needs a bridge. Authored garments supply their own
  // measured waist, or conceal the joint beneath a long coat.
  const pelvis = new THREE.Mesh(pelvisGeometry, trouserMaterial);
  pelvis.name = "body-pelvis";
  pelvis.position.set(...(anatomy?.waist?.centre ?? [0, .258, 0] as const));
  pelvis.visible = !anatomy || Boolean(anatomy.waist);
  pelvis.castShadow = true;
  carriage.add(pelvis);

  const [leftLeg, rightLeg] = legs as [THREE.Group, THREE.Group];
  const [leftArm, rightArm] = arms as [THREE.Group, THREE.Group];
  const armRest = [leftArm.rotation.z, rightArm.rotation.z] as const;

  /**
   * The six. Each is a pose first and a performance second: the arm is up
   * whether or not it is waving, which is what lets reduced motion turn
   * `flourish` down to nothing and still have the body say the thing.
   */
  function playEmote(id: EmoteId, at: number, f: number): void {
    // Loops come round; the rest hold their last frame rather than snapping.
    const e = at % Math.max(EMOTE_SECONDS[id], 0.001);
    carriage.position.y = 0;
    carriage.rotation.x = 0;
    carriage.rotation.z = 0;
    carriage.scale.set(1, 1, 1);
    leftLeg.rotation.x = 0; rightLeg.rotation.x = 0;
    leftArm.rotation.x = 0; rightArm.rotation.x = 0;
    leftArm.rotation.z = armRest[0]; rightArm.rotation.z = armRest[1];
    switch (id) {
      case "wave": {
        rightArm.rotation.x = -2.45;
        rightArm.rotation.z = armRest[1] + 0.42 + Math.sin(e * 9.5) * 0.46 * f;
        carriage.rotation.z = -0.06 - Math.sin(e * 9.5) * 0.03 * f;
        break;
      }
      case "dance": {
        const beat = e * 6.4;
        carriage.position.y = Math.abs(Math.sin(beat)) * 0.034 * f;
        carriage.rotation.z = Math.sin(beat * 0.5) * 0.24 * f;
        carriage.rotation.y = Math.sin(beat * 0.5) * 0.34 * f;
        carriage.rotation.x = -0.05;
        leftArm.rotation.x = -1.15 + Math.sin(beat) * 0.72 * f;
        rightArm.rotation.x = -1.15 - Math.sin(beat) * 0.72 * f;
        leftArm.rotation.z = armRest[0] - 0.42; rightArm.rotation.z = armRest[1] + 0.42;
        leftLeg.rotation.x = Math.sin(beat) * 0.3 * f;
        rightLeg.rotation.x = -Math.sin(beat) * 0.3 * f;
        break;
      }
      case "sit": {
        // Knees up, weight back, hands behind: a body at rest on the grass.
        carriage.position.y = -0.135;
        carriage.rotation.x = 0.16;
        leftLeg.rotation.x = -1.42; rightLeg.rotation.x = -1.3;
        leftArm.rotation.x = 0.62; rightArm.rotation.x = 0.62;
        leftArm.rotation.z = armRest[0] - 0.2; rightArm.rotation.z = armRest[1] + 0.2;
        // The slow breath of somebody who has stopped.
        carriage.position.y += Math.sin(e * 1.6) * 0.006 * f;
        break;
      }
      case "cheer": {
        leftArm.rotation.x = -2.62; rightArm.rotation.x = -2.62;
        leftArm.rotation.z = armRest[0] - 0.3; rightArm.rotation.z = armRest[1] + 0.3;
        const hop = Math.abs(Math.sin(e * 7.5));
        carriage.position.y = hop * 0.05 * f;
        carriage.rotation.x = -0.12 - hop * 0.06 * f;
        leftLeg.rotation.x = -hop * 0.2 * f; rightLeg.rotation.x = -hop * 0.2 * f;
        break;
      }
      case "laugh": {
        // Thrown back, hands to the ribs, shaking.
        carriage.rotation.x = 0.3 + Math.sin(e * 12) * 0.075 * f;
        leftArm.rotation.x = 0.48; rightArm.rotation.x = 0.48;
        leftArm.rotation.z = armRest[0] - 0.62; rightArm.rotation.z = armRest[1] + 0.62;
        carriage.position.y = -0.012 + Math.abs(Math.sin(e * 12)) * 0.008 * f;
        break;
      }
      case "point": {
        // Straight out along the heading, which is the direction the body
        // faces — so pointing at a thing is walking toward it and stopping.
        rightArm.rotation.x = -1.56;
        rightArm.rotation.z = armRest[1] + 0.02;
        leftArm.rotation.x = 0.12;
        carriage.rotation.x = -0.15;
        carriage.rotation.y = -0.1;
        break;
      }
    }
  }

  return {
    group,
    height: BODY_HEIGHT,
    pose(phase, gait, t, motion = AT_REST) {
      // Every hinge straight and every twist square, unless a skate pose says otherwise.
      for (let i = 0; i < 2; i += 1) {
        legs[i]!.rotation.y = 0; legs[i]!.rotation.z = 0; arms[i]!.rotation.y = 0;
        knees[i]!.rotation.x = 0; ankles[i]!.rotation.set(0, 0, 0); elbows[i]!.rotation.x = 0;
      }
      carriage.position.x = 0; carriage.position.z = 0; head.rotation.y = 0; hair.rotation.y = 0;
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
      const pitch = (LEAN + LEAN_RUN * run) * g + motion.lean * LEAN_GAIN + Math.max(-1, Math.min(1, motion.incline ?? 0)) * INCLINE_GAIN;
      carriage.rotation.x = -pitch;
      // The knee takes the weight on the landing: a short squash, gone again
      // by mid-stride, and deeper the harder the foot came down.
      const impact = Math.pow(Math.abs(Math.cos(phase)), 8);
      const squash = SQUASH * (1 + run) * g * impact;
      carriage.scale.set(1 + squash * 0.45, 1 - squash, 1 + squash * 0.45);
      // ── The moves ──────────────────────────────────────────────────────
      // Everything above is the walk. Everything below is played *over* it,
      // in the order a body would: the flight wins over the gait, the slide
      // wins over the flight, and an emote is only ever reached by a body
      // that is doing none of the three.
      const f = Math.max(0, Math.min(1, motion.flourish ?? 1));
      const crouched = Math.max(0, Math.min(1, motion.crouch ?? 0));
      const sliding = Math.max(0, Math.min(1, motion.slide ?? 0));
      const flying = (motion.air ?? 0) > 1e-4;
      carriage.rotation.y = 0;

      if (flying) {
        // In the air. The lead knee comes up on the way out and reaches for
        // the ground on the way down; the arms go with it.
        const rise = Math.max(-1, Math.min(1, motion.rise ?? 0));
        leftLeg.rotation.x = -0.52 - 0.5 * rise;
        rightLeg.rotation.x = 0.3 - 0.26 * rise;
        leftArm.rotation.x = -0.5 - 0.85 * rise;
        rightArm.rotation.x = -0.5 - 0.85 * rise;
        leftArm.rotation.z = armRest[0] - 0.34;
        rightArm.rotation.z = armRest[1] + 0.34;
        carriage.rotation.x = -(0.08 + 0.2 * rise);
        carriage.rotation.z = motion.bank * BANK_GAIN * 0.5;
        carriage.position.y = 0;
        // A body stretches on the way up and gathers on the way down.
        const stretch = 0.045 * rise;
        carriage.scale.set(1 - stretch * 0.6, 1 + stretch, 1 - stretch * 0.6);
      } else if (sliding > 0) {
        // Down into the crouch, weight back, one leg out in front of the
        // other and both arms out for balance: a skid, read from behind.
        leftLeg.rotation.x = -1.02;
        rightLeg.rotation.x = 0.5;
        leftArm.rotation.x = 0.28; rightArm.rotation.x = 0.28;
        leftArm.rotation.z = armRest[0] - SLIDE_ARMS;
        rightArm.rotation.z = armRest[1] + SLIDE_ARMS;
        carriage.rotation.x = SLIDE_LEAN;
        carriage.rotation.z = motion.bank * BANK_GAIN;
        carriage.position.y = -SLIDE_DIP;
        carriage.scale.set(1.1, 0.9, 1.1);
      } else if (motion.emote) {
        playEmote(motion.emote, motion.emoteAt ?? 0, f);
      }

      // The crouch rides on top of whatever the body is otherwise doing: it is
      // the dip before a take-off and the squash after a landing, and both
      // want to be seen through the pose, not instead of it.
      if (crouched > 0 && !flying) {
        carriage.position.y -= CROUCH_DIP * crouched;
        const squash = CROUCH_SQUASH * crouched;
        carriage.scale.set(carriage.scale.x * (1 + squash * 0.5), carriage.scale.y * (1 - squash), carriage.scale.z * (1 + squash * 0.5));
        leftLeg.rotation.x -= 0.3 * crouched;
        rightLeg.rotation.x += 0.3 * crouched;
      }

      if (motion.skate) {
        const {push,balance,bail}=motion.skate;
        carriage.rotation.y=Math.PI*.4;
        carriage.rotation.z=motion.bank*.2*f;
        carriage.rotation.x=bail?.85:-.08;
        carriage.position.y=bail?-.2:-.035-crouched*.055;
        carriage.scale.set(1,1-crouched*.12,1);
        leftLeg.rotation.x=-.25-crouched*.5;
        rightLeg.rotation.x=.23+push*.65*f;
        leftArm.rotation.x=-.38;rightArm.rotation.x=.25;
        leftArm.rotation.z=armRest[0]-.3-balance*.35;
        rightArm.rotation.z=armRest[1]+.4+balance*.35;
      }
      // Whatever the body does, the face keeps looking where it is going.
      head.rotation.x = carriage.rotation.x * -HEAD_LEVEL;
      hair.rotation.x = -0.22 + carriage.rotation.x * -HEAD_LEVEL;

      const sp = motion.skatePose;
      if (sp) {
        carriage.position.set(sp.carriage.x, sp.carriage.y, sp.carriage.z);
        carriage.rotation.set(sp.carriage.rx, sp.carriage.ry, sp.carriage.rz);
        carriage.scale.set(1, 1, 1);
        for (let i = 0; i < 2; i += 1) {
          const leg = sp.legs[i]!, arm = sp.arms[i]!;
          legs[i]!.rotation.set(leg.x, leg.y, leg.z);
          knees[i]!.rotation.x = leg.bend;
          ankles[i]!.rotation.set(leg.foot ?? 0, leg.footYaw ?? 0, leg.footRoll ?? 0);
          arms[i]!.rotation.set(arm.x, arm.y, arm.z);
          elbows[i]!.rotation.x = -arm.bend;
        }
        head.rotation.x = sp.head.x; head.rotation.y = sp.head.y;
        hair.rotation.x = -0.22 + sp.head.x; hair.rotation.y = sp.head.y;
        // Keep the feet planted on the deck. Board emotes use the shoulders,
        // arms and face, so carving and landing remain readable underneath.
        if (motion.emote) {
          const beat = Math.sin((motion.emoteAt ?? 0) * 8);
          switch (motion.emote) {
            case 'wave': rightArm.rotation.x = -1.5; rightArm.rotation.z = -0.8 + beat * 0.24; break;
            case 'dance': leftArm.rotation.x = -0.9 + beat * 0.22; rightArm.rotation.x = -0.9 - beat * 0.22; carriage.rotation.y += beat * 0.12; break;
            case 'sit': carriage.position.y -= 0.045; carriage.rotation.x += 0.18; leftArm.rotation.x = -0.45; rightArm.rotation.x = -0.45; break;
            case 'cheer': leftArm.rotation.x = -2.3; rightArm.rotation.x = -2.3; break;
            case 'laugh': leftArm.rotation.x = -0.65; rightArm.rotation.x = -0.65; head.rotation.x += beat * 0.07; break;
            case 'point': rightArm.rotation.x = -1.25; rightArm.rotation.z = -0.18; head.rotation.y += 0.24; break;
          }
        }
      }

      // Standing still, it breathes. The head keeps its height whatever the
      // chest does, so a resting body does not nod.
      const breath = (1 - g) * Math.sin(t * 1.5) * 0.012;
      torso.scale.set(1 + breath * 0.5, 1 + breath, 1 + breath * 0.5);
      head.position.y = headY + breath * .06;
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
