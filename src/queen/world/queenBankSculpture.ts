import * as THREE from "three";
import { KITTY_HEAD_R, KITTY_HEAD_SCALE, kittyBodyPoints } from "../../kitty/studio/silhouette.ts";
import { defaultKittySculpt } from "../../core/kittyStudio.ts";
import type { KittySculptV1 } from "../../core/types.ts";
import { BANK_DRESS } from "./queenBankDress.ts";

/**
 * The kitty bank, as the rooms hold it (2026-09-14).
 *
 * The cellar and the loft used to stand generic ceramic pots where the banks
 * belong. They stand the **studio's own cat** now: the same thrown silhouette
 * (`kittyBodyPoints`), the same head ellipsoid and head scales, the same brass
 * coin slot on the crown that the Kitty Bank Studio fires. One curve, three
 * renderers — the studio's sculpture, the room's bank and the flat SVG twin —
 * so a bank looks like itself wherever it is standing.
 *
 * What this is **not** is the studio sculpture itself. That one owns six
 * paintable canvases, a raycast surface, a hinge and a compartment, because a
 * person is painting it. A bank on a ledge is looked at, not painted, so this
 * builds the same shape out of shared geometry and plain materials: a room of
 * a dozen banks costs a dozen draws, not a dozen canvas textures.
 *
 * The form a bank takes is the tier it already had in the nest
 * (`nestDefaultPiece`), so nothing new is invented here: a bill is a bean-bodied
 * round-eared cat with no tail, a goal is the pear-bodied wrap-tailed one Build
 * uses, and a month on the cellar's rail is the same bill cat every month.
 *
 * Two rules stay physical and opposite: **an open slot accepts** — the brass
 * rim is open on her crown — and **a lid refuses** — a clay plate is seated over
 * the slot, because there was never a decision inside it. Both are poses, so
 * both read with motion off. No money is read here: swell and fill arrive as
 * bands already quantised by `queenPresentation`.
 */
export type BankForm = "jar" | "goal" | "bill" | "recurring" | "subscription" | "appointment" | "planned";

/** Head size dial per form, matching `nestDefaultPiece`: a bill's head is small. */
const HEAD_DIAL: Record<BankForm, number> = { jar: 0.75, goal: 1, bill: 0.75, recurring: 0.72, subscription: 0.85, appointment: 0.8, planned: 0.8 };

/** The tier sculpts, straight from the nest's own defaults. */
export const BANK_SCULPT: Record<BankForm, Pick<KittySculptV1, "body" | "head" | "ears" | "tail" | "profile">> = {
  // A month on the rail: the bill cat, the same one every month.
  jar: { body: "bean", head: "round", ears: "round", tail: "none", profile: defaultKittySculpt().profile },
  // Build's own bank: pear-bodied, tail wrapped round the foot.
  goal: { body: "pear", head: "round", ears: "pointed", tail: "wrap", profile: defaultKittySculpt().profile },
  // A lidded obligation: bean, round ears, no tail.
  bill: { body: "bean", head: "round", ears: "round", tail: "none", profile: defaultKittySculpt().profile },
  // The cellar's purposes (2026-09-14), one body each so a purpose is a shape before it is a word:
  // a recurring payment (a loan, an insurance) is the tall cat with pointed ears — upright, it stands and stays;
  recurring: { body: "tall", head: "wedge", ears: "pointed", tail: "none", profile: defaultKittySculpt().profile },
  // a subscription is the round cat with its tail wrapped round — the loop that comes back every month;
  subscription: { body: "round", head: "round", ears: "pointed", tail: "wrap", profile: defaultKittySculpt().profile },
  // an appointment is the low loaf, sitting, waiting on a date;
  appointment: { body: "loaf", head: "round", ears: "round", tail: "none", profile: defaultKittySculpt().profile },
  // a planned expense is a round cat with no tail, and it is frosted glass until it posts: the shape of what might be.
  planned: { body: "round", head: "round", ears: "round", tail: "none", profile: defaultKittySculpt().profile },
};

/** Every measurement a room needs to seat a bank of this form, in the cat's own units. */
export type BankMetrics = {
  /** Foot to ear tip, before normalising. */
  height: number;
  /** 1 / height: the scale that makes the cat exactly one unit tall. */
  unit: number;
  bodyTop: number;
  headY: number;
  headTop: number;
  /** Widest radius of the body, for the shadow and the seat's footprint. */
  radius: number;
};

/** The pure numbers of one form. No three.js, so the layout can be reasoned about without a canvas. */
export function bankMetrics(form: BankForm): BankMetrics {
  const sculpt = BANK_SCULPT[form];
  const points = kittyBodyPoints(sculpt as KittySculptV1);
  const bodyTop = points[points.length - 1]![1];
  const radius = points.reduce((widest, [r]) => Math.max(widest, r), 0);
  const dial = HEAD_DIAL[form];
  const base = KITTY_HEAD_SCALE[sculpt.head];
  const headY = bodyTop + 0.25 * dial;
  const headTop = headY + KITTY_HEAD_R * base[1] * dial;
  // The ear stands above the crown; the slot sits on the crown between them.
  const ear = sculpt.ears === "round" ? 0.2 * dial : 0.42 * dial;
  const height = headTop + ear * 0.8;
  return { height, unit: 1 / height, bodyTop, headY, headTop, radius };
}

export type BankMaterials = {
  /** The bisque body. */
  clay: THREE.Material;
  /** What stands inside her: the level, never a bar. */
  glaze: THREE.Material;
  /** Ears, lid, tail, nose — the darker clay. */
  deep: THREE.Material;
  /** The slot's rim. */
  brass: THREE.Material;
  /** Eyes and the open slot. */
  ink: THREE.Material;
  /** A month that posted nothing: an outline claiming nothing. */
  ghost: THREE.Material;
  /** The envelope, the calendar leaf, the paper hat. Falls back to the clay. */
  paper?: THREE.Material;
  /** The postman's cap and the pennant. Falls back to the deep clay. */
  felt?: THREE.Material;
};

/** Geometry shared by every bank of a form. Built once, disposed by the room that registered it. */
export type BankGeometry = ReturnType<typeof bankGeometry>;

export function bankGeometry(form: BankForm, keep: <G extends THREE.BufferGeometry>(g: G) => G) {
  const sculpt = BANK_SCULPT[form];
  const metrics = bankMetrics(form);
  const dial = HEAD_DIAL[form];
  const points = kittyBodyPoints(sculpt as KittySculptV1).map(([r, y]) => new THREE.Vector2(r, y));
  const base = KITTY_HEAD_SCALE[sculpt.head];
  const head: [number, number, number] = [base[0] * dial, base[1] * dial, base[2] * dial];
  const body = keep(new THREE.LatheGeometry(points, 36));
  const tailPoints = sculpt.tail === "wrap"
    ? ([[-metrics.radius * 0.4, 0.06, -metrics.radius * 0.7], [-metrics.radius * 1.05, 0.05, -metrics.radius * 0.2], [-metrics.radius * 1.15, 0.05, metrics.radius * 0.4], [-metrics.radius * 0.7, 0.08, metrics.radius * 0.9], [0.05, 0.12, metrics.radius * 1.05]] as [number, number, number][])
    : null;
  return {
    metrics,
    head,
    ears: sculpt.ears,
    body,
    headGeo: keep(new THREE.SphereGeometry(KITTY_HEAD_R, 24, 16)),
    earRound: sculpt.ears === "round" ? keep(new THREE.SphereGeometry(0.2 * dial, 12, 10)) : null,
    earPointed: sculpt.ears === "pointed" ? keep(new THREE.ConeGeometry(0.19 * dial, 0.42 * dial, 16)) : null,
    inner: keep(new THREE.CircleGeometry(0.075 * dial, 12)),
    eye: keep(new THREE.SphereGeometry(0.052 * dial, 10, 8)),
    nose: keep(new THREE.SphereGeometry(0.036 * dial, 8, 6)),
    slotRim: keep(new THREE.BoxGeometry(0.31 * dial, 0.028, 0.092 * dial)),
    slot: keep(new THREE.BoxGeometry(0.26 * dial, 0.03, 0.037 * dial)),
    lid: keep(new THREE.CylinderGeometry(0.23 * dial, 0.21 * dial, 0.06, 18)),
    knob: keep(new THREE.SphereGeometry(0.055 * dial, 10, 8)),
    paw: keep(new THREE.SphereGeometry(0.19, 12, 10)),
    neck: keep(new THREE.CylinderGeometry(0.03, 0.035, 0.14, 8)),
    tail: tailPoints
      ? keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPoints.map((p) => new THREE.Vector3(...p))), 24, 0.085, 8, false))
      : null,
    dress: bankDressGeometry(form, dial, keep),
  };
}

/**
 * The dressing's geometry (`queenBankDress`): one hat, one back piece, one
 * collar, one foot prop at most, each from a few primitives in the cat's own
 * units so it scales with her. Only what the form wears is built.
 */
/** A pennant: one triangle of cloth, lit from both sides by the room's felt material. */
function pennantGeometry(): THREE.BufferGeometry {
  const cloth = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.62, -0.14, 0), new THREE.Vector3(0, -0.34, 0)]);
  cloth.setIndex([0, 1, 2]);
  cloth.computeVertexNormals();
  return cloth;
}

function bankDressGeometry(form: BankForm, dial: number, keep: <G extends THREE.BufferGeometry>(g: G) => G) {
  const dress = BANK_DRESS[form];
  const r = KITTY_HEAD_R * dial;
  return {
    // The postman's cap: a shallow crown and a flat peak, slid back on the head.
    capCrown: dress.hat === "cap" ? keep(new THREE.CylinderGeometry(r * 0.92, r * 1.0, r * 0.46, 20)) : null,
    capPeak: dress.hat === "cap" ? keep(new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 0.07, 18, 1, false, 0, Math.PI)) : null,
    capBand: dress.hat === "cap" ? keep(new THREE.CylinderGeometry(r * 1.03, r * 1.03, r * 0.14, 20)) : null,
    // The calendar leaf: a square page, a ring through its top, the day's corner folded.
    leaf: dress.hat === "calendar" ? keep(new THREE.BoxGeometry(r * 1.5, r * 1.4, r * 0.1)) : null,
    leafHead: dress.hat === "calendar" ? keep(new THREE.BoxGeometry(r * 1.5, r * 0.34, r * 0.12)) : null,
    leafRing: dress.hat === "calendar" ? keep(new THREE.TorusGeometry(r * 0.16, r * 0.04, 8, 16)) : null,
    leafFold: dress.hat === "calendar" ? keep(new THREE.BoxGeometry(r * 0.4, r * 0.4, r * 0.13)) : null,
    // The folded paper hat: a triangle of paper, its brim turned up.
    paperHat: dress.hat === "paper" ? keep(new THREE.ConeGeometry(r * 1.05, r * 1.25, 4, 1)) : null,
    paperBrim: dress.hat === "paper" ? keep(new THREE.BoxGeometry(r * 2.3, r * 0.2, r * 0.5)) : null,
    // The wind-up key: a stem out of her back and a two-lobed bow you could turn.
    keyStem: dress.back === "key" ? keep(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 10)) : null,
    keyBow: dress.back === "key" ? keep(new THREE.TorusGeometry(0.2, 0.06, 8, 18)) : null,
    keyBar: dress.back === "key" ? keep(new THREE.BoxGeometry(0.72, 0.1, 0.1)) : null,
    // The collar and its bell.
    collar: dress.collar === "bell" ? keep(new THREE.TorusGeometry(r * 0.86, r * 0.09, 8, 24)) : null,
    bell: dress.collar === "bell" ? keep(new THREE.SphereGeometry(r * 0.26, 12, 10)) : null,
    // The envelope leaning on her paws, and the pennant planted beside her.
    envelope: dress.foot === "envelope" ? keep(new THREE.BoxGeometry(0.9, 0.58, 0.05)) : null,
    envelopeFlap: dress.foot === "envelope" ? keep(new THREE.BoxGeometry(0.56, 0.05, 0.06)) : null,
    flagPole: dress.foot === "flag" ? keep(new THREE.CylinderGeometry(0.03, 0.035, 1.5, 8)) : null,
    flag: dress.foot === "flag" ? keep(pennantGeometry()) : null,
  };
}

export type BankVessel = {
  /** Everything that scales with the seat. One unit tall, foot on y = 0. */
  group: THREE.Group;
  /** The thrown body. The room swells this one, and nothing else, so a fat month is a fat belly. */
  body: THREE.Mesh;
  /** The level standing inside her: the same lathe, scaled from the foot. */
  glaze: THREE.Mesh;
};

/**
 * One bank, standing. `parts` puts that many small necks on her shoulder, so
 * how many pieces are inside is a shape and not a count you can read as money.
 */
export function buildBankVessel(shape: BankGeometry, materials: BankMaterials, options: { form: BankForm; hollow?: boolean; lidded: boolean; parts?: number }): BankVessel {
  const { metrics, head } = shape;
  const group = new THREE.Group();
  const norm = new THREE.Group();
  norm.name = "queen-bank-norm";
  norm.scale.setScalar(metrics.unit);
  group.add(norm);
  const clay = options.hollow ? materials.ghost : materials.clay;
  const deep = options.hollow ? materials.ghost : materials.deep;
  const put = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string, parent: THREE.Object3D = norm) => {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    parent.add(object);
    return object;
  };

  const body = put(shape.body, clay, "queen-bank-body");
  body.scale.z = 0.86;
  const glaze = put(shape.body, materials.glaze, "queen-bank-glaze");
  glaze.scale.set(0.94, 0.001, 0.94 * 0.86);
  glaze.visible = false;

  const headMesh = put(shape.headGeo, clay, "queen-bank-head");
  headMesh.scale.set(...head);
  headMesh.position.set(0, metrics.headY, 0.035);

  // Ears, seated on the skull rather than buried in it.
  const earY = metrics.headTop - 0.08;
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.34 * head[0], earY, -0.04);
    ear.rotation.z = -side * 0.22;
    norm.add(ear);
    if (shape.earRound) {
      const round = put(shape.earRound, clay, "queen-bank-ear", ear);
      round.scale.set(1, 1, 0.55);
      round.position.y = 0.06;
    } else if (shape.earPointed) {
      const pointed = put(shape.earPointed, clay, "queen-bank-ear", ear);
      pointed.scale.z = 0.55;
      pointed.position.y = 0.17;
    }
    const inner = put(shape.inner, deep, "queen-bank-ear-inner", ear);
    inner.scale.set(0.7, 1.3, 1);
    inner.position.set(0, 0.1, 0.1);
  }

  // A face that still reads at thumbnail size: two eyes and a nose, no more.
  const front = KITTY_HEAD_R * head[2] * 0.86 + 0.035;
  for (const side of [-1, 1] as const) {
    const eye = put(shape.eye, materials.ink, "queen-bank-eye");
    eye.scale.set(1, 1.1, 0.5);
    eye.position.set(side * 0.21 * head[0], metrics.headY + 0.1 * head[1], front);
  }
  const nose = put(shape.nose, deep, "queen-bank-nose");
  nose.scale.set(1, 0.7, 0.6);
  nose.position.set(0, metrics.headY - 0.05 * head[1], front + 0.01);

  // Front paws, so she sits rather than hovers.
  for (const side of [-1, 1] as const) {
    const paw = put(shape.paw, clay, "queen-bank-paw");
    paw.scale.set(1, 0.6, 1.2);
    paw.position.set(side * 0.34 * metrics.radius, 0.1, 0.52 * metrics.radius);
  }
  if (shape.tail) put(shape.tail, clay, "queen-bank-tail");

  // Her dressing — the purpose, readable from across the room (queenBankDress).
  // Every hat sits back on the skull so the crown, the slot and the lid stay in front of it.
  const d = shape.dress;
  const paper = options.hollow ? materials.ghost : materials.paper ?? clay;
  const felt = options.hollow ? materials.ghost : materials.felt ?? deep;
  const r = KITTY_HEAD_R * head[1];
  if (d.capCrown && d.capPeak && d.capBand) {
    const cap = new THREE.Group();
    cap.name = "queen-bank-dress-cap";
    cap.position.set(0, metrics.headY + r * 0.58, -r * 0.18);
    cap.rotation.x = -0.32;
    cap.rotation.z = 0.12;
    norm.add(cap);
    put(d.capBand, materials.ink, "queen-bank-cap-band", cap).position.y = 0.02;
    put(d.capCrown, felt, "queen-bank-cap-crown", cap).position.y = r * 0.26;
    const peak = put(d.capPeak, materials.ink, "queen-bank-cap-peak", cap);
    peak.position.set(0, -0.02, r * 0.55);
    peak.rotation.y = Math.PI / 2;
  }
  if (d.leaf && d.leafHead && d.leafRing && d.leafFold) {
    const leaf = new THREE.Group();
    leaf.name = "queen-bank-dress-calendar";
    leaf.position.set(0, metrics.headY + r * 1.02, -r * 0.3);
    leaf.rotation.x = -0.34;
    leaf.rotation.z = -0.14;
    norm.add(leaf);
    put(d.leaf, paper, "queen-bank-leaf", leaf);
    put(d.leafHead, materials.ink, "queen-bank-leaf-head", leaf).position.y = r * 0.53;
    const ring = put(d.leafRing, materials.brass, "queen-bank-leaf-ring", leaf);
    ring.position.set(0, r * 0.74, 0);
    const fold = put(d.leafFold, deep, "queen-bank-leaf-fold", leaf);
    fold.position.set(r * 0.5, -r * 0.46, 0.02);
    fold.rotation.z = Math.PI / 4;
  }
  if (d.paperHat && d.paperBrim) {
    const hat = new THREE.Group();
    hat.name = "queen-bank-dress-paper";
    hat.position.set(0, metrics.headY + r * 0.7, -r * 0.2);
    hat.rotation.x = -0.28;
    hat.rotation.z = -0.16;
    norm.add(hat);
    const cone = put(d.paperHat, paper, "queen-bank-paper-hat", hat);
    cone.rotation.y = Math.PI / 4;
    cone.position.y = r * 0.6;
    put(d.paperBrim, paper, "queen-bank-paper-brim", hat);
  }
  if (d.keyStem && d.keyBow && d.keyBar) {
    const key = new THREE.Group();
    key.name = "queen-bank-dress-key";
    // The key stands out of her flank so it reads from the front of the room, as a wind-up toy's does.
    key.position.set(-metrics.radius * 0.9, metrics.bodyTop * 0.62, 0.05);
    key.rotation.z = Math.PI / 2;
    norm.add(key);
    put(d.keyStem, materials.brass, "queen-bank-key-stem", key).position.y = 0.2;
    const bow = put(d.keyBow, materials.brass, "queen-bank-key-bow", key);
    bow.position.y = 0.5;
    put(d.keyBar, materials.brass, "queen-bank-key-bar", key).position.y = 0.5;
  }
  if (d.collar && d.bell) {
    const collar = put(d.collar, materials.ink, "queen-bank-collar");
    collar.position.set(0, metrics.bodyTop + 0.02, 0.02);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1, 0.86, 1);
    const bell = put(d.bell, materials.brass, "queen-bank-bell");
    bell.position.set(0, metrics.bodyTop - 0.08, r * 0.86);
  }
  if (d.envelope && d.envelopeFlap) {
    const post = new THREE.Group();
    post.name = "queen-bank-dress-envelope";
    post.position.set(metrics.radius * 0.34, 0.25, metrics.radius * 0.98);
    post.rotation.set(-0.28, 0, 0.14);
    norm.add(post);
    put(d.envelope, paper, "queen-bank-envelope", post);
    for (const side of [-1, 1] as const) {
      const flap = put(d.envelopeFlap, deep, "queen-bank-envelope-flap", post);
      flap.position.set(side * 0.19, 0.06, 0.03);
      flap.rotation.z = -side * 0.5;
    }
  }
  if (d.flagPole && d.flag) {
    const pennant = new THREE.Group();
    pennant.name = "queen-bank-dress-flag";
    pennant.position.set(metrics.radius * 1.05, 0, metrics.radius * 0.3);
    pennant.rotation.z = -0.08;
    norm.add(pennant);
    put(d.flagPole, deep, "queen-bank-flag-pole", pennant).position.y = 0.75;
    const cloth = put(d.flag, felt, "queen-bank-flag", pennant);
    cloth.position.set(0.03, 1.48, 0);
  }

  // The slot on her crown, and what answers it.
  if (options.lidded) {
    const lid = put(shape.lid, deep, "queen-bank-lid");
    lid.position.set(0, metrics.headTop + 0.03, 0.01);
    const knob = put(shape.knob, deep, "queen-bank-knob");
    knob.position.set(0, metrics.headTop + 0.09, 0.01);
  } else {
    const rim = put(shape.slotRim, materials.brass, "queen-bank-slot-rim");
    rim.position.set(0, metrics.headTop + 0.02, 0.01);
    const slot = put(shape.slot, materials.ink, "queen-bank-slot");
    slot.position.set(0, metrics.headTop + 0.026, 0.01);
    const parts = Math.min(3, Math.max(0, options.parts ?? 0));
    for (let i = 0; i < parts; i += 1) {
      const neck = put(shape.neck, deep, "queen-bank-neck");
      neck.position.set((i - (parts - 1) / 2) * 0.16, metrics.bodyTop + 0.02, -0.22);
    }
  }
  return { group, body, glaze };
}
