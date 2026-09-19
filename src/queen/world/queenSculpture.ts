import * as THREE from "three";
import type { KittyPaintV1 } from "../../core/types.ts";
import { PART_CANVAS_SIZE, partDip, presentPart, replayPart } from "../../kitty/studio/paintCanvas.ts";
import { studioHex } from "../../kitty/studio/palette.ts";
import { QUEEN_CLAY, QUEEN_GLAZE_AXIS, QUEEN_PAINTABLE_PARTS, queenSanitizePaint, type QueenGlazeAxis, type QueenPaintablePart, type QueenPose } from "./queenAuthoring.ts";
import type { QueenStone } from "../../core/queenPresentation.ts";
import type { QueenCharmPart, QueenCharmV1 } from "../../core/queenCharms.ts";
import { QUEEN_FORM_BASE, QUEEN_HEAD, QUEEN_SKIRT_PHI_START, queenSeamPathsFor, queenSkirtProfilePoints, type QueenForm } from "./queenCharmSurface.ts";
import { createQueenCharmSet } from "./queenCharmSet.ts";
import { queenModelAnchors, queenModelResources, type QueenModelAnchors } from "./queenModel.ts";

/**
 * The Queen as a sculpture: a seated, matriarchal terracotta cat with a
 * mandevilla vine for hair — white blooms down one side, crimson down the
 * other. Her own geometry, her own proportions, her own
 * anchors — not the thrown cat, though she is unmistakably a cat: ears with
 * an inner fold, a muzzle, whiskers, a tail curled around her base and front
 * paws folded in her lap.
 *
 * Two kinds of surface live on her. All six studio parts — body, head, both
 * ears, tail and paws — are paintable in the manner of the studio (a canvas
 * per part → texture → material), so the couple's colour, pattern and stamps
 * land where they put them, and so she can be worked on in the kitty bank
 * studio exactly like the banks. Everything that carries a reading is
 * separate geometry with its own material that the paint pipeline never
 * touches: the hair and its buds, the flower crown, the eyes and brow, the
 * gold seams, her cupped hands, the stones at her feet. Her posture and
 * scale move the body group; her fill widens the belly; her surface follows
 * evidence freshness through the same roughness/clearcoat axis a fired bank
 * uses. Charms — the couple's small add-ons — are instanced on the body
 * group by `queenCharmSet` and never touch a reserved mesh; they seat on her
 * body and head only, where the surface maths lives. Her form — the handles
 * thrown on the wheel and the rings her closed Chapters leave — is the
 * skirt's lathe, rebuilt only when the form changes; the gold seams follow
 * it. Her underside carries the makers' marks and is never painted. Under
 * whatever is painted, the fired-earthenware grain of the real pot reads
 * through: mottled clay and its white splatter, composited over the paint so
 * it tints the couple's work rather than replacing it. No money is read here.
 *
 * Jonathan's model (D-266). When `setModel` hands her the Mandevilla Queen
 * sculpt, that model *is* her, exactly as sculpted: the drawn body, face,
 * hair and crown step aside, and nothing here ever touches the model's
 * meshes, materials or transforms. The readings move around her instead —
 * the crown light shines on her vine crown, the fill is a stack of brass
 * coins beside her planter (glossy when the evidence is fresh, dull when it
 * is not), the gold seams are kintsugi on the planter, the Chapter's new
 * growth (young leaves, pink-tipped buds) is set on her vines, the stones
 * stay at her feet, and the makers' marks stay under her saucer. Paint,
 * charms and the thrown form are kept and saved but not drawn on her.
 */
export type QueenSculptureOptions = {
  clay?: string;
  gold?: string;
  leaf?: string;
  bud?: string;
  ink?: string;
  reducedMotion?: boolean;
};

/**
 * Framing height: her base to the tips of her ears, at scale 1. Her hair
 * falls rather than reaches, so nothing rises above the ears and the world
 * frames her silhouette rather than empty air over her head.
 */
export const QUEEN_HEIGHT = 3.75;
const BODY_ORIGIN_Y = 0;

type PartState = { layer: HTMLCanvasElement | null; display: HTMLCanvasElement | null; texture: THREE.CanvasTexture | null; mat: THREE.MeshPhysicalMaterial };

/**
 * The fired-earthenware grain of the real pot: mottling that is never flat,
 * and the white splatter it was finished with. Drawn once per canvas size and
 * composited over whatever the couple painted, so it reads as her clay under
 * their work instead of as a pattern on top of it. Deterministic — the same
 * grain every mount, so a screenshot is a screenshot.
 */
function queenClayGrain(size: number): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let seed = 0x5eed;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  const blobs = Math.round(size / 2);
  for (let i = 0; i < blobs; i += 1) {
    ctx.globalAlpha = 0.05 + rnd() * 0.06;
    ctx.fillStyle = rnd() < 0.5 ? QUEEN_CLAY.deep : QUEEN_CLAY.light;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, (0.06 + rnd() * 0.23) * size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  const specks = Math.round(size * 1.2);
  for (let i = 0; i < specks; i += 1) {
    const r = (rnd() < 0.86 ? 1 + rnd() * 2.6 : 3 + rnd() * 5) * (size / 1024);
    ctx.globalAlpha = 0.5 + rnd() * 0.5;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, Math.max(0.6, r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export function createQueenSculpture(options: QueenSculptureOptions = {}) {
  const group = new THREE.Group();
  group.name = "queen";
  const body = new THREE.Group();
  body.name = "queen-body";
  group.add(body);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  let disposed = false;
  const geo = <G extends THREE.BufferGeometry>(g: G): G => { geometries.add(g); return g; };
  const mat = <M extends THREE.Material>(m: M): M => { materials.add(m); return m; };

  const clayColor = options.clay ?? QUEEN_CLAY.base;
  const gold = mat(new THREE.MeshStandardMaterial({ color: options.gold ?? "#c9a227", roughness: 0.35, metalness: 0.8, emissive: "#000000" }));
  const goldSeam = mat(new THREE.MeshStandardMaterial({ color: options.gold ?? "#c9a227", roughness: 0.3, metalness: 0.85, emissive: options.gold ?? "#c9a227", emissiveIntensity: 0.35 }));
  const leaf = mat(new THREE.MeshStandardMaterial({ color: options.leaf ?? "#2c6a4e", roughness: 0.8 }));
  const stem = mat(new THREE.MeshStandardMaterial({ color: "#3f5d47", roughness: 0.85 }));
  const bud = mat(new THREE.MeshPhysicalMaterial({ color: options.bud ?? "#c45c26", roughness: 0.4, clearcoat: 0.6 }));
  const ink = mat(new THREE.MeshStandardMaterial({ color: options.ink ?? "#1b1712", roughness: 0.8 }));
  const white = mat(new THREE.MeshStandardMaterial({ color: "#fff8ee", roughness: 0.5 }));
  const stone = mat(new THREE.MeshStandardMaterial({ color: "#8e8474", roughness: 0.95 }));
  /** The mandevilla's two colours: white down one side of her hair, crimson down the other — white to the room's left. They meet only in the crown. */
  const petalWhite = mat(new THREE.MeshPhysicalMaterial({ color: QUEEN_CLAY.petalWhite, roughness: 0.5, clearcoat: 0.35 }));
  const petalRed = mat(new THREE.MeshPhysicalMaterial({ color: QUEEN_CLAY.petalRed, roughness: 0.45, clearcoat: 0.4 }));
  const petalEye = mat(new THREE.MeshStandardMaterial({ color: "#e8a33a", roughness: 0.55 }));
  const budTip = mat(new THREE.MeshStandardMaterial({ color: "#e9a0b4", roughness: 0.55 }));
  /** Reserved clay for her hands, shoulders and the small dark reads of her face. The same clay as her body, never painted. */
  const reservedClay = mat(new THREE.MeshPhysicalMaterial({ color: clayColor, roughness: QUEEN_GLAZE_AXIS.glazed.roughness, clearcoat: QUEEN_GLAZE_AXIS.glazed.clearcoat, metalness: 0.02 }));
  const clayDeep = mat(new THREE.MeshStandardMaterial({ color: QUEEN_CLAY.deep, roughness: 0.7 }));

  // ---- paintable parts: the six studio parts, so the studio reaches her exactly as it reaches a bank ----
  const canvasOk = typeof document !== "undefined" && (() => { try { return Boolean(document.createElement("canvas").getContext("2d")); } catch { return false; } })();
  const grain = new Map<number, HTMLCanvasElement | null>();
  const grainFor = (size: number) => { if (!grain.has(size)) grain.set(size, queenClayGrain(size)); return grain.get(size) ?? null; };
  const parts = Object.fromEntries(QUEEN_PAINTABLE_PARTS.map((part) => {
    const material = mat(new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: QUEEN_GLAZE_AXIS.glazed.roughness, clearcoat: QUEEN_GLAZE_AXIS.glazed.clearcoat, clearcoatRoughness: 0.08, metalness: 0.02, envMapIntensity: QUEEN_GLAZE_AXIS.glazed.envMapIntensity }));
    if (!canvasOk) { material.color.set(clayColor); return [part, { layer: null, display: null, texture: null, mat: material }]; }
    const size = PART_CANVAS_SIZE[part];
    const layer = document.createElement("canvas"), display = document.createElement("canvas");
    layer.width = layer.height = size; display.width = display.height = size;
    const texture = new THREE.CanvasTexture(display);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.add(texture);
    material.map = texture;
    return [part, { layer, display, texture, mat: material }];
  })) as Record<QueenPaintablePart, PartState>;
  const paintMaterials = QUEEN_PAINTABLE_PARTS.map((part) => parts[part].mat);

  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, name: string) => {
    const object = new THREE.Mesh(geo(g), m);
    object.name = name;
    object.castShadow = false;
    object.receiveShadow = false;
    parent.add(object);
    return object;
  };
  const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
  const curveOf = (points: [number, number, number][]) => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const tube = (points: [number, number, number][], radius: number, m: THREE.Material, parent: THREE.Object3D, name: string) =>
    mesh(new THREE.TubeGeometry(curveOf(points), 24, radius, 8, false), m, parent, name);

  // Her belly and skirt: a seated vessel, widest low, gathered at the shoulders.
  const belly = new THREE.Group();
  belly.name = "queen-belly";
  body.add(belly);
  let form: QueenForm = QUEEN_FORM_BASE;
  const lathe = (f: QueenForm) => new THREE.LatheGeometry(queenSkirtProfilePoints(f).map(([r, y]) => V2(r, y)), 48, QUEEN_SKIRT_PHI_START, Math.PI * 2);
  const skirt = mesh(lathe(form), parts.body.mat, belly, "queen-skirt");
  skirt.position.y = BODY_ORIGIN_Y;
  // Her underside: the base disc she tips over to show, with the makers' marks. Reserved clay; never painted, never a charm seat.
  const undersideMat = mat(new THREE.MeshStandardMaterial({ color: clayColor, roughness: 0.92, metalness: 0 }));
  const underside = mesh(new THREE.CircleGeometry(0.9, 40), undersideMat, belly, "queen-underside");
  underside.rotation.x = Math.PI / 2;
  underside.position.y = -0.004;
  let marksTexture: THREE.CanvasTexture | null = null;
  // Shoulders and neck: reserved clay, so the paint cannot creep over the collar where the seams meet. They open with the rim.
  const shoulders = mesh(new THREE.LatheGeometry([V2(0.58, 1.84), V2(0.66, 2.02), V2(0.5, 2.24), V2(0.28, 2.34)], 40), reservedClay, body, "queen-shoulders");
  // Her cupped hands, held at the front between her paws: the Move's seat, and the one thing the paws never cover. Reserved.
  const hands = mesh(new THREE.SphereGeometry(0.34, 24, 16), reservedClay, body, "queen-hands");
  hands.scale.set(0.72, 0.34, 0.5);
  hands.position.set(0, 1.62, 0.6);

  // Her front paws, folded in her lap on either side of the cradle. Paintable: they are hers to decorate, and the Move still sits above them.
  const paws = new THREE.Group();
  paws.name = "queen-paws";
  paws.position.set(0, 1.5, 0.86);
  body.add(paws);
  for (const side of [-1, 1]) {
    const pad = mesh(new THREE.SphereGeometry(0.23, 22, 16), parts.paws.mat, paws, "queen-paw");
    pad.position.set(side * 0.31, 0, 0);
    pad.scale.set(0.9, 0.62, 1.4);
    for (let toe = -1; toe <= 1; toe += 1) {
      const t = mesh(new THREE.SphereGeometry(0.04, 10, 8), clayDeep, paws, "queen-paw-toe");
      t.position.set(side * 0.31 + toe * 0.078, 0.09, 0.26);
      t.scale.set(1, 0.5, 1);
    }
  }

  // Her tail, curled around the base with the tip lifted. Paintable.
  const tailCurve = curveOf([[-0.3, 0.16, -1.0], [-1.28, 0.14, -0.42], [-1.46, 0.14, 0.5], [-1.12, 0.16, 1.12], [-0.6, 0.22, 1.46], [-0.14, 0.52, 1.54]]);
  const tail = mesh(new THREE.TubeGeometry(tailCurve, 56, 0.115, 10, false), parts.tail.mat, body, "queen-tail");
  const tailTip = mesh(new THREE.SphereGeometry(0.115, 14, 10), parts.tail.mat, body, "queen-tail-tip");
  tailTip.position.copy(tailCurve.getPoint(1));

  // Head: the skull the charm surface knows, plus the muzzle and cheeks that make her a cat. All on the head's paint.
  const head = mesh(new THREE.SphereGeometry(QUEEN_HEAD.radius, 40, 28, QUEEN_HEAD.phiStart), parts.head.mat, body, "queen-head");
  head.position.set(...QUEEN_HEAD.position);
  head.scale.set(...QUEEN_HEAD.scale);
  const headTop = QUEEN_HEAD.position[1] + QUEEN_HEAD.radius * QUEEN_HEAD.scale[1];
  const muzzle = mesh(new THREE.SphereGeometry(0.22, 26, 18), parts.head.mat, body, "queen-muzzle");
  muzzle.position.set(QUEEN_HEAD.position[0], QUEEN_HEAD.position[1] - 0.13, QUEEN_HEAD.position[2] + 0.41);
  muzzle.scale.set(1.25, 0.78, 0.86);
  for (const side of [-1, 1]) {
    const cheek = mesh(new THREE.SphereGeometry(0.17, 20, 14), parts.head.mat, body, "queen-cheek");
    cheek.position.set(side * 0.22, QUEEN_HEAD.position[1] - 0.11, QUEEN_HEAD.position[2] + 0.33);
    cheek.scale.set(1, 0.86, 0.9);
  }

  // Her ears, with the inner fold. Their own parts, and their own paint.
  const ears: Record<"earL" | "earR", THREE.Group> = { earL: new THREE.Group(), earR: new THREE.Group() };
  for (const [key, side] of [["earL", -1], ["earR", 1]] as const) {
    const ear = ears[key];
    ear.name = `queen-${key}`;
    // Seated on the crown of her head, tilted out, so the cone clears the skull and reads at a glance.
    ear.position.set(side * 0.27, headTop - 0.05, QUEEN_HEAD.position[2] - 0.03);
    ear.rotation.z = side * -0.34;
    ear.rotation.x = -0.1;
    body.add(ear);
    const outer = mesh(new THREE.ConeGeometry(0.23, 0.52, 5), parts[key].mat, ear, `queen-${key}-outer`);
    outer.scale.set(1, 1, 0.6);
    const inner = mesh(new THREE.ConeGeometry(0.14, 0.35, 5), clayDeep, ear, `queen-${key}-fold`);
    inner.position.set(0, -0.03, 0.065);
    inner.scale.set(1, 1, 0.5);
  }

  // Face: eyes closed (arcs), open (whites + pupils), brow, three mouths, nose and whiskers. Reserved.
  const face = new THREE.Group();
  face.name = "queen-face";
  face.position.set(0, 2.78, 0.04);
  body.add(face);
  const fz = 0.5 * 0.96 - 0.02;
  /** The muzzle's own front, where the nose and the mouths sit: out past the skull, not buried in it. */
  const mz = 0.41 + 0.19;
  const eyesClosed = new THREE.Group(); eyesClosed.name = "queen-eyes-closed";
  const eyesOpen = new THREE.Group(); eyesOpen.name = "queen-eyes-open";
  const pupils: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.19, y = 0.06;
    tube([[x - 0.09, y, fz - 0.03], [x, y - 0.05, fz], [x + 0.09, y, fz - 0.03]], 0.014, ink, eyesClosed, "queen-eye-closed");
    const ball = mesh(new THREE.SphereGeometry(0.075, 18, 12), white, eyesOpen, "queen-eye-white");
    ball.position.set(x, y, fz - 0.02); ball.scale.set(1.3, 1, 0.4);
    const pupil = mesh(new THREE.SphereGeometry(0.036, 14, 10), ink, eyesOpen, "queen-pupil");
    pupil.position.set(x, y, fz + 0.03); pupil.scale.set(1, 1.1, 0.5);
    pupils.push(pupil);
    const brow = tube([[x - 0.11, y + 0.13, fz - 0.06], [x, y + 0.17, fz - 0.02], [x + 0.11, y + 0.14, fz - 0.06]], 0.013, ink, face, "queen-brow");
    brow.visible = false;
    // Three whiskers a side: thin, swept back, unmistakably cat.
    for (let i = 0; i < 3; i += 1) {
      const whisker = mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.5, 5), clayDeep, face, "queen-whisker");
      whisker.position.set(side * 0.26, -0.08 - i * 0.045, mz - 0.14);
      whisker.rotation.z = side * (Math.PI / 2 - 0.18 + i * 0.12);
      whisker.rotation.y = side * -0.3;
    }
  }
  const nose = mesh(new THREE.SphereGeometry(0.058, 14, 10), clayDeep, face, "queen-nose");
  nose.position.set(0, -0.05, mz - 0.01);
  nose.scale.set(1.25, 0.8, 0.7);
  face.add(eyesClosed, eyesOpen);
  eyesOpen.visible = false;
  const mouths = {
    serene: tube([[-0.1, -0.19, mz - 0.07], [0, -0.24, mz - 0.03], [0.1, -0.19, mz - 0.07]], 0.012, ink, face, "queen-mouth-serene"),
    level: tube([[-0.09, -0.2, mz - 0.07], [0, -0.215, mz - 0.03], [0.09, -0.2, mz - 0.07]], 0.012, ink, face, "queen-mouth-level"),
    set: tube([[-0.09, -0.23, mz - 0.07], [0, -0.2, mz - 0.03], [0.09, -0.23, mz - 0.07]], 0.012, ink, face, "queen-mouth-set"),
  };
  mouths.level.visible = false; mouths.set.visible = false;

  // ---- the mandevilla: one bloom, one bud, one leaf, built once and reused ----
  /** A mandevilla bloom: five petals that lap the same way round, and the yellow throat at the centre. The handedness is what makes it a mandevilla and not a daisy. */
  const bloom = (petal: THREE.Material) => {
    const flower = new THREE.Group();
    for (let i = 0; i < 5; i += 1) {
      const holder = new THREE.Group();
      const p = mesh(new THREE.SphereGeometry(0.093, 12, 9), petal, holder, "queen-petal");
      p.scale.set(1, 0.2, 1.55);
      p.position.set(0, 0, 0.093);
      holder.rotation.y = i * ((Math.PI * 2) / 5);
      holder.rotation.x = -0.34;
      holder.rotation.z = 0.2;
      flower.add(holder);
    }
    const throat = mesh(new THREE.SphereGeometry(0.034, 10, 8), petalEye, flower, "queen-throat");
    throat.position.y = 0.02;
    return flower;
  };
  /** A bud: a long, tightly furled spiral held upright — five facets read as furled — with the pink flush at its tip. The honest form for a Chapter in progress. */
  const budForm = (petal: THREE.Material) => {
    const g = new THREE.Group();
    const pts = Array.from({ length: 10 }, (_, i) => { const t = i / 9; return V2(0.042 * Math.sin(Math.PI * (0.15 + t * 0.72)) * (1 - t * 0.55) + 0.003, t * 0.24); });
    const furl = mesh(new THREE.LatheGeometry(pts, 5), petal, g, "queen-bud-furl");
    furl.rotation.y = 0.4;
    const tip = mesh(new THREE.SphereGeometry(0.021, 8, 6), budTip, g, "queen-bud-tip");
    tip.position.y = 0.24;
    return g;
  };
  /** A leaf: a broad blade, not a sliver — a leaf thin enough to vanish edge-on reads as a stray wire, and the Chapter's growth stops being visible. */
  const leafForm = (parent: THREE.Object3D, name: string) => {
    const l = mesh(new THREE.SphereGeometry(0.1, 12, 9), leaf, parent, name);
    l.scale.set(0.62, 0.2, 1);
    return l;
  };

  // Her hair: the mandevilla, the Chapter, grown by acts. White on her left, crimson on her right.
  // Buds are goals in motion. Reserved — the studio cannot recolour, cover or remove a strand.
  const vine = new THREE.Group();
  vine.name = "queen-vine";
  vine.position.set(0, headTop - 0.1, -0.03);
  body.add(vine);
  /** Seats along the strands where a leaf cluster or a bud can sit, gathered so the counts stay the Chapter's. */
  const leafSeats: THREE.Vector3[][] = [];
  const budSeats: { at: THREE.Vector3; side: -1 | 1 }[] = [];
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 6 - 0.5) * 1.7;
      // Out past the width of her head at the very first point, or the whole fall hides behind her skull.
      const out = 0.58 + (i % 3) * 0.13 + (i > 3 ? 0.1 : 0);
      const z = Math.sin(a) * 0.44 + 0.1;
      // Hair is not a bowl cut: every strand falls a different length, or fourteen of them read as one green hoop.
      const drop = 1.5 + ((i * 7) % 5) * 0.22;
      const sway = side * (0.1 + (i % 2) * 0.12);
      const strand = curveOf([
        [side * 0.4, 0.08, z * 0.55],
        [side * out, -drop * 0.24, z * 0.9],
        [side * (out + 0.2) + sway, -drop * 0.56, z],
        [side * (out + 0.26), -drop * 0.85, z * 0.86],
        [side * (out + 0.06) + sway, -drop, z * 0.6],
      ]);
      mesh(new THREE.TubeGeometry(strand, 32, 0.022 + (i % 2) * 0.008, 6, false), stem, vine, "queen-stem");
      // Her flowers, permanent: they are who she is, not a reward. One colour a side; they meet only in the crown.
      for (const [t, scale] of [[0.38, 1.15], [0.72, 0.95], [0.98, 0.8]] as const) {
        const flower = bloom(side < 0 ? petalWhite : petalRed);
        flower.name = "queen-bloom";
        flower.position.copy(strand.getPoint(t));
        flower.rotation.set(0.55 + (i % 3) * 0.14, i * 0.9, side * 0.35);
        flower.scale.setScalar(scale * (0.9 + (i % 3) * 0.12));
        vine.add(flower);
      }
      if (i % 2 === 0) leafSeats.push([strand.getPoint(0.3), strand.getPoint(0.58), strand.getPoint(0.82)]);
      if (i === 1 || i === 5) budSeats.push({ at: strand.getPoint(0.72), side });
    }
  }
  /** Leaf clusters: one per act, up to five. Each is a direct child of the hair so the Chapter's growth is countable. */
  const leaves = leafSeats.slice(0, 5).map((seats, index) => {
    const cluster = new THREE.Group();
    cluster.name = "queen-leaf";
    for (const [k, seat] of seats.entries()) {
      const l = leafForm(cluster, "queen-leaf-blade");
      l.position.copy(seat);
      // Tilted face-on to the room rather than edge-on, so a leaf reads as a leaf from the one angle the camera has.
      l.rotation.set(0.95 + k * 0.16, (index % 2 ? 1 : -1) * (0.45 + k * 0.2), (index % 2 ? 1 : -1) * 0.45);
    }
    cluster.visible = false;
    vine.add(cluster);
    return cluster;
  });
  /** Buds: one per goal in motion, up to four, furled on the strands where a bloom has not opened. */
  const buds = budSeats.slice(0, 4).map((seat, index) => {
    // A bud keeps its strand's colour, the same as the blooms beside it.
    const b = budForm(seat.side < 0 ? petalWhite : petalRed);
    b.name = "queen-bud";
    b.position.copy(seat.at);
    b.rotation.set(0.3, index * 1.4, seat.side * 0.2);
    b.visible = false;
    vine.add(b);
    return b;
  });

  // Her flower crown: where the two colours interweave, bound on a gold band. Both partners present lights it. Reserved.
  const crown = new THREE.Group();
  crown.name = "queen-crown";
  crown.position.set(0, headTop - 0.16, QUEEN_HEAD.position[2] - 0.01);
  body.add(crown);
  const crownRing = mesh(new THREE.TorusGeometry(0.46, 0.028, 10, 40), gold, crown, "queen-crown-ring");
  crownRing.rotation.x = Math.PI / 2;
  crownRing.scale.set(1, 1, 0.92);
  const crownBand = mesh(new THREE.TorusGeometry(0.455, 0.022, 8, 40), stem, crown, "queen-crown-band");
  crownBand.rotation.x = Math.PI / 2;
  crownBand.scale.set(1, 1, 0.92);
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const node = i % 3 === 2 ? budForm(i % 2 ? petalRed : petalWhite) : bloom(i % 2 ? petalRed : petalWhite);
    node.name = i % 3 === 2 ? "queen-crown-bud" : "queen-crown-bloom";
    node.position.set(Math.cos(angle) * 0.46, 0.03, Math.sin(angle) * 0.42);
    node.rotation.set(-0.5, -angle, 0);
    node.scale.setScalar(0.78);
    crown.add(node);
  }
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const point = mesh(new THREE.ConeGeometry(0.045, 0.16, 4), gold, crown, "queen-crown-point");
    point.position.set(Math.cos(a) * 0.46, 0.14, Math.sin(a) * 0.42);
  }
  const crownLight = new THREE.PointLight("#ffe08a", 0, 3.2, 2);
  crownLight.name = "queen-crown-light";
  crownLight.position.set(0, 0.5, 0.2);
  crown.add(crownLight);

  // Gold seams on the belly: kintsugi, left visible on purpose. Reserved.
  const seamRadii = [0.022, 0.02, 0.02];
  const seams = queenSeamPathsFor(form).map((path, i) => tube(path.map((p) => [...p] as [number, number, number]), seamRadii[i]!, goldSeam, belly, "queen-seam"));
  for (const seam of seams) seam.visible = false;
  let seamCount = 0;
  /** The skirt and the seams follow the form; everything else keeps its place. Rebuilt only when the form actually changes. */
  const rebuildForm = () => {
    const nextSkirt = lathe(form);
    geometries.delete(skirt.geometry); skirt.geometry.dispose();
    skirt.geometry = geo(nextSkirt);
    for (const [i, path] of queenSeamPathsFor(form).entries()) {
      const seam = seams[i]!;
      geometries.delete(seam.geometry); seam.geometry.dispose();
      seam.geometry = geo(new THREE.TubeGeometry(curveOf(path.map((p) => [...p] as [number, number, number])), 24, seamRadii[i]!, 8, false));
    }
    shoulders.scale.set(form.handles.neck, 1, form.handles.neck);
  };

  // Stones at her feet: how many, how near. Reserved.
  const feet = new THREE.Group();
  feet.name = "queen-feet";
  group.add(feet);
  const stoneSeats: Array<[number, number]> = [[-0.35, 1.25], [0.55, 1.35], [-1.05, 1.15], [1.15, 1.05]];
  const stones = stoneSeats.map(([x, z]) => {
    const s = mesh(new THREE.SphereGeometry(0.14, 14, 10), stone, feet, "queen-stone");
    s.position.set(x, 0.05, z); s.scale.set(1, 0.5, 0.8); s.visible = false;
    return s;
  });
  const plinth = mesh(new THREE.CylinderGeometry(1.42, 1.5, 0.05, 48), mat(new THREE.MeshStandardMaterial({ color: "#000000", transparent: true, opacity: 0.12, roughness: 1 })), group, "queen-plinth");
  plinth.scale.z = 0.72;
  plinth.position.y = -0.02;

  // ---- charms: instanced on the body group, riding posture and fill, never on a reserved mesh ----
  const charms = createQueenCharmSet(body, { ink: options.ink });
  /** The couple's charms, kept while her sculpted model stands in: they are laid on the drawn figure only. */
  let charmRows: QueenCharmV1[] = [];
  const pickable = [skirt, head];
  const partOf: Record<string, QueenCharmPart> = { "queen-skirt": "body", "queen-head": "head" };

  // ---- paint ----
  let paint: KittyPaintV1 = queenSanitizePaint(null);
  let axis: QueenGlazeAxis = QUEEN_GLAZE_AXIS.glazed;
  const present = () => {
    for (const part of QUEEN_PAINTABLE_PARTS) {
      const state = parts[part];
      if (!state.layer || !state.display || !state.texture) { state.mat.color.set(axis === QUEEN_GLAZE_AXIS.glazed ? studioHex(partDip(paint, part)) : clayColor); continue; }
      try {
        replayPart(state.layer, paint, part);
        presentPart(state.layer, state.display, axis.clearcoat === 1);
        // Her clay, over their paint: the mottling and the white splatter the real pot was finished with.
        const size = state.display.width;
        const texture = grainFor(size);
        const ctx = texture ? state.display.getContext("2d") : null;
        if (texture && ctx) { ctx.save(); ctx.globalAlpha = 0.85; ctx.drawImage(texture, 0, 0, size, size); ctx.restore(); }
        state.texture.needsUpdate = true;
      } catch { state.mat.color.set(studioHex(partDip(paint, part))); }
    }
  };
  const applyAxis = () => {
    for (const m of [...paintMaterials, reservedClay]) {
      m.roughness = axis.roughness; m.clearcoat = axis.clearcoat; m.envMapIntensity = axis.envMapIntensity; m.needsUpdate = true;
    }
  };

  // ---- Jonathan's model: when it is hers, the drawn figure steps aside and the readings stand around it ----
  let model: THREE.Object3D | null = null;
  let awaiting = false;
  let fillLevel = 0, growthLeaves = 0, growthBuds = 0;
  const holder = new THREE.Group();
  holder.name = "queen-model";
  body.add(holder);
  /** The drawn figure: everything that is her look when there is no model. Readings are not in this list. */
  const drawn: THREE.Object3D[] = [skirt, shoulders, hands, paws, tail, tailTip, head, muzzle, ears.earL, ears.earR, face, vine,
    ...body.children.filter((child) => child.name === "queen-cheek"),
    ...crown.children.filter((child) => child !== crownLight)];
  const drawnCrown = crown.position.clone();
  /** Brass coins stacked beside her planter: the fill, one coin a step. They take the glaze axis; the model never does. */
  const coinMat = mat(new THREE.MeshStandardMaterial({ color: "#c49a4a", roughness: 0.2, metalness: 0.85, envMapIntensity: 1 }));
  const coinRim = mat(new THREE.MeshStandardMaterial({ color: "#8f6d2f", roughness: 0.35, metalness: 0.8 }));
  const coinGeo = geo(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 28));
  const coinEdge = geo(new THREE.TorusGeometry(0.15, 0.008, 6, 28));
  const coins = new THREE.Group();
  coins.name = "queen-coins";
  coins.visible = false;
  group.add(coins);
  const coinStack = Array.from({ length: 10 }, (_, i) => {
    const coin = new THREE.Group();
    coin.name = "queen-coin";
    const disc = new THREE.Mesh(coinGeo, coinMat);
    const edge = new THREE.Mesh(coinEdge, coinRim);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.025;
    coin.add(disc, edge);
    // A hand-made stack: each coin a little off true, so it reads as coins and not a cylinder.
    coin.position.set(Math.sin(i * 2.3) * 0.018, 0.025 + i * 0.052, Math.cos(i * 1.7) * 0.018);
    coin.rotation.set(Math.sin(i * 1.3) * 0.04, i * 0.6, Math.cos(i * 0.9) * 0.04);
    coin.visible = false;
    coins.add(coin);
    return coin;
  });
  let modelSeams: THREE.Mesh[] = [];
  const modelSeamGroup = new THREE.Group();
  modelSeamGroup.name = "queen-model-seams";
  body.add(modelSeamGroup);
  const growth = new THREE.Group();
  growth.name = "queen-growth";
  body.add(growth);
  /** Young leaves: a spring green a shade lighter than hers, so the Chapter's new growth reads against her own foliage. */
  let youngLeaf: THREE.MeshStandardMaterial | null = null;
  let growthLeafClusters: THREE.Group[] = [];
  let growthBudForms: THREE.Group[] = [];
  const clearModelExtras = () => {
    for (const seam of modelSeams) { geometries.delete(seam.geometry); seam.geometry.dispose(); }
    modelSeams = [];
    modelSeamGroup.clear();
    for (const node of [...growthLeafClusters, ...growthBudForms]) node.traverse((child) => { if (child instanceof THREE.Mesh) { geometries.delete(child.geometry); child.geometry.dispose(); } });
    growthLeafClusters = []; growthBudForms = [];
    growth.clear();
  };
  const buildModelExtras = (anchors: QueenModelAnchors, scale: number) => {
    clearModelExtras();
    // Kintsugi on the planter: three mends running up from its foot like the cracks they repair — straight runs with sharp turns, hugging the thrown profile.
    const { bottom, top, radiusAt } = anchors.pot;
    for (const [index, angle] of [-0.5, 0.2, 0.62].entries()) {
      const path = new THREE.CurvePath<THREE.Vector3>();
      const from = bottom + (top - bottom) * 0.04, to = top - (top - bottom) * (0.22 + index * 0.12);
      const steps = 5;
      let last: THREE.Vector3 | null = null;
      for (let k = 0; k <= steps; k += 1) {
        const y = from + ((to - from) * k) / steps;
        const a = angle + (k % 2 ? 1 : -1) * (0.035 + ((k * 7 + index * 3) % 4) * 0.012) * (k ? 1 : 0);
        const r = radiusAt(y) + 0.0025;
        const point = new THREE.Vector3(Math.sin(a) * r * scale, y * scale, Math.cos(a) * r * scale);
        if (last) path.add(new THREE.LineCurve3(last, point));
        last = point;
      }
      const seam = new THREE.Mesh(geo(new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, steps * 6, [0.014, 0.012, 0.012][index]!, 5, false)), goldSeam);
      seam.name = "queen-seam";
      seam.visible = index < seamCount;
      modelSeamGroup.add(seam);
      modelSeams.push(seam);
    }
    // The Chapter's new growth on her vines: young leaves on her white side and her crimson side in turn, buds among them.
    const blade = youngLeaf ??= mat(new THREE.MeshStandardMaterial({ color: "#8cc063", roughness: 0.55 }));
    const seats = [0, 1, 2, 3, 4].flatMap((i) => [anchors.hair.left[i], anchors.hair.right[i]]).filter((p): p is THREE.Vector3 => Boolean(p));
    growthLeafClusters = [0, 1, 2, 3, 4].map((index) => {
      const cluster = new THREE.Group();
      cluster.name = "queen-leaf";
      const seat = seats[index * 2 % Math.max(1, seats.length)];
      if (seat) cluster.position.copy(seat).multiplyScalar(scale);
      for (const side of [-1, 1]) {
        const l = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 12, 9)), blade);
        l.name = "queen-leaf-blade";
        l.scale.set(0.62, 0.2, 1);
        l.position.set(side * 0.06, 0, 0.05);
        l.rotation.set(0.95, side * 0.6, side * 0.45);
        cluster.add(l);
      }
      cluster.visible = false;
      growth.add(cluster);
      return cluster;
    });
    growthBudForms = [0, 1, 2, 3].map((index) => {
      const seat = seats[(index * 2 + 1) % Math.max(1, seats.length)];
      const b = budForm(index % 2 ? petalRed : petalWhite);
      b.name = "queen-bud";
      if (seat) b.position.copy(seat).multiplyScalar(scale).add(new THREE.Vector3(0, 0, 0.04));
      b.rotation.set(0.3, index * 1.4, (index % 2 ? 1 : -1) * 0.25);
      b.scale.setScalar(1.15);
      b.visible = false;
      growth.add(b);
      b.traverse((child) => { if (child instanceof THREE.Mesh) geometries.add(child.geometry); });
      return b;
    });
    // Stand the coins clear of her saucer, to her right, below her hair.
    coins.position.set((anchors.saucer.radius * scale) + 0.36, 0, 0.5);
    underside.scale.setScalar(Math.max(0.2, (anchors.saucer.radius * scale) / 0.9));
    crown.position.copy(anchors.crown).multiplyScalar(scale);
  };
  let modelResources: ReturnType<typeof queenModelResources> | null = null;
  const applyMode = () => {
    charms.setCharms(model || awaiting ? [] : charmRows);
    for (const node of drawn) node.visible = !model && !awaiting;
    for (const [index, seam] of seams.entries()) seam.visible = !model && !awaiting && index < seamCount;
    holder.visible = Boolean(model);
    coins.visible = Boolean(model);
    growth.visible = Boolean(model);
    modelSeamGroup.visible = Boolean(model);
    if (!model) { crown.position.copy(drawnCrown); underside.scale.setScalar(1); }
    for (const [index, coin] of coinStack.entries()) coin.visible = index < fillLevel;
    for (const [index, l] of growthLeafClusters.entries()) l.visible = index < growthLeaves;
    for (const [index, b] of growthBudForms.entries()) b.visible = index < growthBuds;
  };
  const applyCoinAxis = () => {
    coinMat.roughness = 0.12 + axis.roughness * 0.7;
    coinMat.metalness = axis === QUEEN_GLAZE_AXIS.glazed ? 0.9 : 0.55;
    coinMat.envMapIntensity = axis === QUEEN_GLAZE_AXIS.glazed ? 1 : 0.35;
    coinMat.needsUpdate = true;
  };

  // ---- state ----
  let restScale = 1, lean = 0, breathOffset = 0, tipped = false;
  const applyBody = () => {
    body.scale.setScalar(restScale);
    body.rotation.z = lean;
    // Tipped over toward the room: her underside faces the camera. A deliberate gesture, one still, no motion of its own.
    body.rotation.x = tipped ? -Math.PI * 0.47 : 0;
    body.position.y = breathOffset + (tipped ? 2.0 : 0);
    body.position.z = tipped ? 0.3 : 0;
  };
  present();
  applyAxis();
  applyCoinAxis();

  return {
    group,
    /** Total height in world units at scale 1, for framing. */
    height: QUEEN_HEIGHT,
    get disposed() { return disposed; },
    /** Hand her Jonathan's model (fitted to her height here), or null to draw her again. The model is never altered. */
    setModel(next: THREE.Object3D | null) {
      if (disposed || next === model) return;
      if (model) {
        holder.remove(model);
        if (modelResources) {
          for (const g of modelResources.geometries) { geometries.delete(g); g.dispose(); }
          for (const m of modelResources.materials) { materials.delete(m); m.dispose(); }
          for (const t of modelResources.textures) { textures.delete(t); t.dispose(); }
        }
        modelResources = null;
        clearModelExtras();
      }
      model = next;
      awaiting = false;
      if (next) {
        const anchors = queenModelAnchors(next);
        const box = new THREE.Box3().setFromObject(next);
        const scale = QUEEN_HEIGHT / anchors.height;
        holder.scale.setScalar(scale);
        // The planter is thrown on the model's own axis; only the base is lifted to her floor.
        holder.position.set(0, -box.min.y * scale, 0);
        holder.add(next);
        modelResources = queenModelResources(next);
        for (const g of modelResources.geometries) geometries.add(g);
        for (const m of modelResources.materials) materials.add(m);
        for (const t of modelResources.textures) textures.add(t);
        buildModelExtras(anchors, scale);
      }
      applyMode();
    },
    /** While the model is on its way, draw nothing of her rather than the old figure for a moment. */
    setAwaitingModel(next: boolean) {
      if (disposed) return;
      awaiting = next && !model;
      applyMode();
    },
    get model() { return model; },
    get modelState(): "model" | "awaiting" | "drawn" { return model ? "model" : awaiting ? "awaiting" : "drawn"; },
    /** What stands around the model, for tests and evidence. */
    aroundModel: { coins, coinStack, coinMaterial: coinMat, growth, crownLight, get seams() { return modelSeams; }, get leaves() { return growthLeafClusters; }, get buds() { return growthBudForms; } },
    /** Names of the reserved groups and meshes, for tests that assert the paint never reaches them. */
    reserved: { vine, crown, crownLight, face, eyesOpen, eyesClosed, hands, seams, feet, stones, belly, underside, shoulders },
    paintable: { body: skirt, head, earL: ears.earL, earR: ears.earR, tail, paws },
    materials: { body: parts.body.mat, head: parts.head.mat, earL: parts.earL.mat, earR: parts.earR.mat, tail: parts.tail.mat, paws: parts.paws.mat, reservedClay, gold, goldSeam, leaf, bud, ink, petalWhite, petalRed },
    counts() { const c = charms.counts(); return { geometries: geometries.size + c.geometries, materials: materials.size + (c.geometries ? c.materials : 0), textures: textures.size }; },
    charmCounts() { return charms.counts(); },
    /** The charms on her, in the piece's own coordinates. Sanitized by the caller; drawn here. */
    setCharms(next: QueenCharmV1[]) { charmRows = next; charms.setCharms(model || awaiting ? [] : next); },
    /** Her form: the thrown handles and the ring count. The lathe is rebuilt only when it changes. */
    setForm(next: QueenForm) {
      if (next.rings === form.rings && next.handles.belly === form.handles.belly && next.handles.waist === form.handles.waist && next.handles.shoulder === form.handles.shoulder && next.handles.neck === form.handles.neck) return;
      form = next;
      rebuildForm();
      charms.setForm(next);
    },
    get form() { return form; },
    /** Tipped over to show her underside, or seated. */
    setTipped(next: boolean) { tipped = next; applyBody(); },
    get tipped() { return tipped; },
    /** The makers' marks on her underside: both partners' marks and the date she was last worked on. Drawn once into one small texture. */
    setMarks(marks: { initials: readonly string[]; date: string } | null) {
      if (marksTexture) { textures.delete(marksTexture); marksTexture.dispose(); marksTexture = null; undersideMat.map = null; undersideMat.needsUpdate = true; }
      if (!marks || !canvasOk) return;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = clayColor; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = options.ink ?? "#1b1712"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "600 56px ui-serif, Georgia, serif";
      ctx.fillText(marks.initials.slice(0, 2).join(" · "), 128, 104);
      ctx.font = "30px ui-monospace, Menlo, monospace";
      ctx.fillText(marks.date, 128, 166);
      marksTexture = new THREE.CanvasTexture(canvas);
      marksTexture.colorSpace = THREE.SRGBColorSpace;
      textures.add(marksTexture);
      undersideMat.map = marksTexture; undersideMat.needsUpdate = true;
    },
    /** Where a ray lands on her charm surface: the part and its uv, or null off her or on a reserved mesh. */
    pick(raycaster: THREE.Raycaster): { part: QueenCharmPart; u: number; v: number } | null {
      // Charms are not drawn on the model; the flat pick seats them instead.
      if (model || awaiting) return null;
      const hit = raycaster.intersectObjects(pickable, false)[0];
      if (!hit || !hit.uv) return null;
      const part = partOf[hit.object.name];
      return part ? { part, u: hit.uv.x, v: hit.uv.y } : null;
    },
    setPose(pose: QueenPose) {
      restScale = pose.scale;
      lean = pose.lean;
      applyBody();
      eyesOpen.visible = pose.eyes === "open";
      eyesClosed.visible = pose.eyes !== "open";
      const dx = pose.gaze === "crown" ? -0.03 : pose.gaze === "face" ? 0.03 : pose.gaze === "vine" ? -0.01 : 0;
      const dy = pose.gaze === "vine" ? 0.02 : pose.gaze === "body" || pose.gaze === "belly" || pose.gaze === "hem" || pose.gaze === "hands" ? -0.03 : 0;
      for (const [index, pupil] of pupils.entries()) pupil.position.set((index === 0 ? -0.19 : 0.19) + dx, 0.06 + dy, fz + 0.03);
      for (const child of face.children) if (child.name === "queen-brow") child.visible = pose.brow === "weighted";
      mouths.serene.visible = pose.mouth === "serene"; mouths.level.visible = pose.mouth === "level"; mouths.set.visible = pose.mouth === "set";
    },
    /** 0..10 → the belly widens and settles. `fill(n)` from the stage API, on her own geometry. */
    setFill(level: number) {
      const n = Math.max(0, Math.min(10, level));
      const width = 0.86 + (n / 10) * 0.14;
      belly.scale.set(width, 1, width);
      charms.setBellyWidth(width);
      fillLevel = Math.round(n);
      for (const [index, coin] of coinStack.entries()) coin.visible = index < fillLevel;
    },
    /** Evidence freshness owns the surface. There is no setFired: nobody fires her. */
    setGlaze(next: QueenGlazeAxis) {
      if (next === axis) return;
      axis = next;
      applyAxis();
      applyCoinAxis();
      charms.setGlaze(next);
      present();
    },
    setCrown(lit: boolean) {
      crownLight.intensity = lit ? 1.6 : 0;
      gold.emissive.set(lit ? "#8a6a14" : "#000000");
      gold.emissiveIntensity = lit ? 0.5 : 0;
    },
    setSeams(count: number) {
      seamCount = count;
      for (const [index, seam] of seams.entries()) seam.visible = !model && !awaiting && index < seamCount;
      for (const [index, seam] of modelSeams.entries()) seam.visible = index < seamCount;
    },
    setVine(chapter: boolean, growth: number, budCount: number) {
      // Acts lengthen her hair. Width barely moves — hair that narrows as well as shortens disappears behind her head.
      const grown = Math.max(0, Math.min(4, growth));
      vine.scale.set(chapter ? 0.94 + grown * 0.015 : 0.9, chapter ? 0.78 + grown * 0.055 : 0.62, chapter ? 0.94 + grown * 0.015 : 0.9);
      const leafCount = chapter ? 1 + Math.max(0, Math.min(4, growth)) : 0;
      for (const [index, l] of leaves.entries()) l.visible = index < leafCount;
      for (const [index, b] of buds.entries()) b.visible = index < budCount;
      growthLeaves = leafCount;
      growthBuds = Math.max(0, Math.min(4, budCount));
      for (const [index, l] of growthLeafClusters.entries()) l.visible = index < growthLeaves;
      for (const [index, b] of growthBudForms.entries()) b.visible = index < growthBuds;
    },
    setFeet(nearness: QueenStone["size"][]) {
      for (const [index, s] of stones.entries()) {
        const size = nearness[index];
        s.visible = Boolean(size);
        const k = size === "near" ? 1.15 : size === "soon" ? 0.9 : 0.7;
        s.scale.set(k, 0.5 * k, 0.8 * k);
      }
    },
    setPaint(next: KittyPaintV1 | null) {
      paint = queenSanitizePaint(next);
      present();
    },
    /** The only ambient motion: a slow drift in y. The caller decides whether it runs. */
    setBreath(offset: number) {
      breathOffset = offset;
      applyBody();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      charms.dispose();
      group.removeFromParent();
      group.clear();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      geometries.clear(); materials.clear(); textures.clear();
      grain.clear();
    },
  };
}
export type QueenSculpture = ReturnType<typeof createQueenSculpture>;
