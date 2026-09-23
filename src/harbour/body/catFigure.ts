import * as THREE from "three";
import { CAT_HEIGHT, type CatMood } from "./catModel.ts";

/**
 * Little Harbour · Hercules, in the flesh.
 *
 * Built the way the person is built (`body/figure.ts`): flat-shaded
 * `MeshStandardMaterial`, no textures, nothing to download, fourteen meshes
 * and no skeleton. The rigged cat in `models/hercules.source.glb` is the right
 * answer in the Cottage, where you stand over him and look; out on the island
 * he is 0.28 units tall at forty metres and a carved one reads better and
 * costs nothing.
 *
 * The gait is procedural and there are two of them, because a cat has two:
 *
 * - a **trot**, diagonal pairs — front-left with back-right — which is what
 *   he does at your walking pace and is the gait that reads as "a cat", and
 * - a **bound**, both fronts and then both backs with the spine flexing
 *   between them, which is what he does when you sprint.
 *
 * `bound` crossfades the two, so there is no moment where he switches gaits;
 * he gathers into the second one as he speeds up, exactly as a cat does.
 *
 * Every oscillation below is multiplied by `life`, which `catModel.ts` eases
 * to **exactly zero** when there is nothing to perform. That is not a polish
 * detail: it is how a world with a cat in it is still allowed to go to sleep.
 */

export type CatColours = {
  /** The coat. A brown-tabby Maine Coon, which is what he is. */
  coat: string;
  /** Chest, chin, paws and the tip of the tail. */
  cream: string;
  /** Ears inside, and the nose. */
  pink: string;
  /** Eyes and the dark of the muzzle. */
  ink: string;
};

export const DEFAULT_CAT_COLOURS: Readonly<CatColours> = Object.freeze({
  coat: "#8a6a49", cream: "#e8dac2", pink: "#c98a86", ink: "#33291f",
});

/** What he is doing, beyond going forward. */
export type CatMotion = {
  mood: CatMood;
  /** How far into the mood, in seconds. */
  moodAt: number;
  /** 0 on his feet, 1 sitting. Eased by the model, so standing up is a movement. */
  seated: number;
  /** The amplitude of every flourish, 0…1. Reduced motion and rest both take it to zero. */
  life: number;
  /** 0 a trot, 1 a bound. */
  bound: number;
  /** Ears: 0 laid back, 1 pricked. */
  ears: number;
};

export const CAT_AT_REST: Readonly<CatMotion> = Object.freeze({ mood: "sit", moodAt: 0, seated: 1, life: 0, bound: 0, ears: 0.5 });

export type CatFigure = {
  /** The whole cat. Its position is his paws on the ground; its `rotation.y` is his facing. */
  group: THREE.Group;
  pose(phase: number, gait: number, t: number, motion?: CatMotion): void;
  readonly height: number;
  dispose(): void;
};

/** How far the legs swing at a full trot, and how much further again in a bound. */
const LEG_SWING = 0.72, LEG_SWING_BOUND = 0.55;
/** The bob on each pair of paws, the spine's flex in a bound, and how far a run stretches him out. */
const BOB = 0.012, FLEX = 0.1, STRETCH = 0.055;
/** How deep a sit drops the hips, how far it tips the chest up, and how far the tail curls round. */
const SIT_DROP = 0.055, SIT_PITCH = 0.42, SIT_TAIL = 1.15;
/** A flop is a sit rolled onto his side. */
const FLOP_ROLL = 1.15, FLOP_DROP = 0.085;

/** The body's own measurements, in units, off the 0.28 total. */
const HIP_Y = 0.155, SHOULDER_Y = 0.165, BODY_LENGTH = 0.15;

export function createCatFigure(colours: Partial<CatColours> = {}): CatFigure {
  const palette: CatColours = { ...DEFAULT_CAT_COLOURS, ...colours };
  const kept: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { kept.push(item); return item; };
  const material = (colour: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    track(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.92, flatShading: true, ...extra }));
  const coat = material(palette.coat);
  const cream = material(palette.cream, { flatShading: false, roughness: 0.85 });
  const pink = material(palette.pink, { roughness: 0.7 });
  const ink = material(palette.ink, { flatShading: false, roughness: 0.5 });

  const group = new THREE.Group();
  group.name = "hercules";
  /** Everything under here, so the root's position stays his paws on the ground. */
  const carriage = new THREE.Group();
  carriage.name = "hercules-carriage";
  group.add(carriage);

  // ── The barrel, and the ruff that makes him a Maine Coon rather than a cat ──
  const barrel = new THREE.Mesh(track(new THREE.SphereGeometry(0.085, 14, 10)), coat);
  barrel.scale.set(0.85, 0.78, 1.5);
  barrel.position.set(0, HIP_Y, 0.0);
  barrel.castShadow = true;
  carriage.add(barrel);
  const ruff = new THREE.Mesh(track(new THREE.SphereGeometry(0.068, 12, 9)), cream);
  ruff.scale.set(1.05, 0.9, 0.8);
  ruff.position.set(0, SHOULDER_Y, BODY_LENGTH * 0.62);
  carriage.add(ruff);

  // ── The head, on a neck that can look up, round, and down at a paw ──────────
  const neck = new THREE.Group();
  neck.name = "hercules-neck";
  neck.position.set(0, SHOULDER_Y + 0.022, BODY_LENGTH * 0.72);
  carriage.add(neck);
  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.055, 14, 10)), coat);
  head.scale.set(1, 0.92, 0.95);
  head.castShadow = true;
  neck.add(head);
  const muzzle = new THREE.Mesh(track(new THREE.SphereGeometry(0.03, 10, 8)), cream);
  muzzle.scale.set(1, 0.75, 0.85);
  muzzle.position.set(0, -0.018, 0.043);
  neck.add(muzzle);
  const nose = new THREE.Mesh(track(new THREE.SphereGeometry(0.009, 6, 5)), pink);
  nose.position.set(0, -0.006, 0.068);
  neck.add(nose);
  const eyes = new THREE.Mesh(
    track(mergeTwo(new THREE.SphereGeometry(0.0105, 7, 6), [-0.024, 0.012, 0.043], [0.024, 0.012, 0.043])), ink);
  neck.add(eyes);
  // Ears: tufted, upright, and on a pivot of their own so they can lay back.
  const earPivot = new THREE.Group();
  earPivot.name = "hercules-ears";
  neck.add(earPivot);
  const earOuter = new THREE.Mesh(
    track(mergeTwo(new THREE.ConeGeometry(0.023, 0.05, 5), [-0.031, 0.055, -0.004], [0.031, 0.055, -0.004])), coat);
  earPivot.add(earOuter);
  const earInner = new THREE.Mesh(
    track(mergeTwo(new THREE.ConeGeometry(0.012, 0.03, 5), [-0.031, 0.056, 0.004], [0.031, 0.056, 0.004])), pink);
  earPivot.add(earInner);

  // ── Four legs, each a pivot at the shoulder or the hip ─────────────────────
  const legGeometry = track(new THREE.CapsuleGeometry(0.015, 0.085, 3, 6));
  /** front-left, front-right, back-left, back-right — the order every gait below is written in. */
  const legs: THREE.Group[] = [];
  for (const [side, front] of [[-1, true], [1, true], [-1, false], [1, false]] as const) {
    const pivot = new THREE.Group();
    pivot.name = `hercules-leg-${front ? "front" : "back"}-${side < 0 ? "left" : "right"}`;
    pivot.position.set(side * 0.042, front ? SHOULDER_Y - 0.02 : HIP_Y - 0.02, front ? BODY_LENGTH * 0.52 : -BODY_LENGTH * 0.58);
    const leg = new THREE.Mesh(legGeometry, front ? cream : coat);
    leg.position.y = -0.055;
    pivot.add(leg);
    carriage.add(pivot);
    legs.push(pivot);
  }
  const [frontLeft, frontRight, backLeft, backRight] = legs as [THREE.Group, THREE.Group, THREE.Group, THREE.Group];

  // ── The tail: a base and a tip, on a pivot, so it sways, lifts and curls ───
  const tailPivot = new THREE.Group();
  tailPivot.name = "hercules-tail";
  tailPivot.position.set(0, HIP_Y + 0.012, -BODY_LENGTH * 0.92);
  carriage.add(tailPivot);
  const tailBase = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.018, 0.08, 3, 6)), coat);
  tailBase.rotation.x = Math.PI / 2;
  tailBase.position.z = -0.045;
  tailPivot.add(tailBase);
  const tailTip = new THREE.Group();
  tailTip.position.z = -0.09;
  tailPivot.add(tailTip);
  const tip = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.016, 0.07, 3, 6)), cream);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = -0.04;
  tailTip.add(tip);

  const rest: CatMotion = { ...CAT_AT_REST };

  function pose(phase: number, gait: number, t: number, motion: CatMotion = rest): void {
    const life = clamp(motion.life, 0, 1);
    const bound = clamp(motion.bound, 0, 1);
    const seated = clamp(motion.seated, 0, 1);
    const amp = clamp(gait, 0, 1) * life;

    // ── The two gaits, crossfaded ──────────────────────────────────────────
    // A trot is the diagonals in antiphase; a bound is the fronts together and
    // the backs a beat behind them. Each leg's swing is the blend of what the
    // two gaits would have given it, so there is no switch to see.
    const swing = (LEG_SWING + LEG_SWING_BOUND * bound) * amp * (1 - seated);
    const trotFL = Math.sin(phase), trotBR = trotFL;
    const trotFR = Math.sin(phase + Math.PI), trotBL = trotFR;
    const boundFront = Math.sin(phase), boundBack = Math.sin(phase - Math.PI * 0.62);
    frontLeft.rotation.x = (trotFL * (1 - bound) + boundFront * bound) * swing;
    frontRight.rotation.x = (trotFR * (1 - bound) + boundFront * bound) * swing;
    backLeft.rotation.x = (trotBL * (1 - bound) + boundBack * bound) * swing;
    backRight.rotation.x = (trotBR * (1 - bound) + boundBack * bound) * swing;

    // The spine: a trot barely moves it, a bound flexes it through the stride.
    const flex = Math.sin(phase - Math.PI * 0.3) * FLEX * bound * amp;
    carriage.rotation.x = flex + SIT_PITCH * seated * -1;
    barrel.scale.z = 1.5 * (1 + STRETCH * bound * amp * Math.sin(phase));

    // ── Where the body sits over the paws ──────────────────────────────────
    const flop = motion.mood === "flop" ? seated : 0;
    const bob = Math.abs(Math.cos(phase)) * BOB * amp * (1 + bound);
    // A bounce is the whole cat leaving the ground. It rides on the carriage
    // rather than on the root, because the root's y is his paws on the island
    // and `body/cat.ts` writes it every frame.
    const hop = motion.mood === "bounce" ? Math.abs(Math.sin(motion.moodAt * 7.5)) * 0.055 * life : 0;
    carriage.position.y = bob + hop - SIT_DROP * seated - FLOP_DROP * flop;
    carriage.rotation.z = FLOP_ROLL * flop;
    // Sitting, the back legs fold under him and the front ones go straight.
    backLeft.rotation.x = backLeft.rotation.x - 1.15 * seated;
    backRight.rotation.x = backRight.rotation.x - 1.15 * seated;

    // ── The head ───────────────────────────────────────────────────────────
    // Level through the carriage's own pitch, so he keeps looking where he is
    // going; then whatever the mood is doing on top of that.
    let pitch = -carriage.rotation.x * 0.8;
    let turn = 0;
    if (motion.mood === "look-up") pitch += 0.55 * life + Math.sin(motion.moodAt * 5) * 0.05 * life;
    else if (motion.mood === "groom") {
      // A paw up and the head down to it, with the small quick strokes a cat
      // actually makes. All of it × `life`, so it stops.
      const stroke = Math.sin(motion.moodAt * 9);
      pitch += (0.85 + stroke * 0.16) * life;
      frontLeft.rotation.x = -1.2 * life;
      turn = 0.24 * life;
    } else if (motion.mood === "watch") {
      turn = Math.sin(motion.moodAt * 2.4) * 0.22 * life;
      pitch += -0.12 * life;
    } else if (motion.mood === "wait") {
      // Waiting by a door: a slow look back to you and away again.
      turn = Math.sin(t * 0.9) * 0.4 * life;
    }
    neck.rotation.x = pitch;
    neck.rotation.y = turn;
    // ── Ears and tail ──────────────────────────────────────────────────────
    earPivot.rotation.x = (1 - clamp(motion.ears, 0, 1)) * -0.55;
    // The tail is the one thing on him that never stops while he is awake and
    // stops completely when he is not: sway with the stride at a trot, up and
    // streaming in a bound, curled round the paws in a sit.
    const sway = Math.sin(phase * 0.5) * 0.5 * amp;
    tailPivot.rotation.y = sway * (1 - seated) + Math.sin(t * 1.6) * 0.1 * life * (1 - amp);
    // Up while he is going somewhere — a trotting cat carries his tail up and
    // it is most of what reads as a cat at this size — and curled round the
    // paws when he sits.
    tailPivot.rotation.x = (0.55 + 0.5 * bound) * amp - SIT_TAIL * seated;
    tailTip.rotation.x = 0.4 * amp - 0.5 * seated;
    tailTip.rotation.y = Math.sin(phase * 0.5 - 0.7) * 0.4 * amp;
  }

  pose(0, 0, 0);

  return {
    group,
    pose,
    height: CAT_HEIGHT,
    dispose() {
      group.removeFromParent();
      for (const item of kept) item.dispose();
      kept.length = 0;
    },
  };
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Two copies of one small geometry, merged into one mesh: ears, eyes. Two draw calls saved each time. */
function mergeTwo(geometry: THREE.BufferGeometry, a: readonly [number, number, number], b: readonly [number, number, number]): THREE.BufferGeometry {
  const left = geometry.clone().translate(a[0], a[1], a[2]);
  const right = geometry.clone().translate(b[0], b[1], b[2]);
  const merged = mergeGeometries([left, right]);
  geometry.dispose(); left.dispose(); right.dispose();
  return merged;
}

/**
 * The smallest merge that does this job: both inputs come from the same
 * geometry, so they have the same attributes in the same order and a
 * concatenation is the whole of it. Pulling `BufferGeometryUtils` in for two
 * cones would cost more to download than the cat costs to draw.
 */
function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const names = Object.keys(parts[0]!.attributes);
  let base = 0;
  const indices: number[] = [];
  for (const part of parts) {
    const index = part.getIndex();
    const count = part.attributes.position!.count;
    if (index) for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i) + base);
    else for (let i = 0; i < count; i += 1) indices.push(i + base);
    base += count;
  }
  for (const name of names) {
    const first = parts[0]!.getAttribute(name) as THREE.BufferAttribute;
    const size = first.itemSize;
    const array = new Float32Array(base * size);
    let at = 0;
    for (const part of parts) {
      const attribute = part.getAttribute(name) as THREE.BufferAttribute;
      for (let i = 0; i < attribute.count * size; i += 1) array[at + i] = attribute.array[i] as number;
      at += attribute.count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  out.setIndex(indices);
  out.computeBoundingSphere();
  return out;
}
