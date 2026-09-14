import * as THREE from "three";
import type { KittyPaintV1 } from "../../core/types.ts";
import { PART_CANVAS_SIZE, partDip, presentPart, replayPart } from "../../kitty/studio/paintCanvas.ts";
import { studioHex } from "../../kitty/studio/palette.ts";
import { QUEEN_GLAZE_AXIS, QUEEN_PAINTABLE_PARTS, queenSanitizePaint, type QueenGlazeAxis, type QueenPaintablePart, type QueenPose } from "./queenAuthoring.ts";
import type { QueenStone } from "../../core/queenPresentation.ts";
import type { QueenCharmPart, QueenCharmV1 } from "../../core/queenCharms.ts";
import { QUEEN_FORM_BASE, QUEEN_HEAD, QUEEN_SKIRT_PHI_START, queenSeamPathsFor, queenSkirtProfilePoints, type QueenForm } from "./queenCharmSurface.ts";
import { createQueenCharmSet } from "./queenCharmSet.ts";

/**
 * The Queen as a sculpture: a seated, matriarchal ceramic vessel with a
 * mandevilla vine for hair. Her own geometry, her own proportions, her own
 * anchors — not the thrown cat.
 *
 * Two kinds of surface live on her. Her body and head are paintable in the
 * manner of the studio (a canvas per part → texture → material), so the
 * couple's colour, pattern and stamps land where they put them. Everything
 * that carries a reading is separate geometry with its own material that the
 * paint pipeline never touches: the vine and buds, the crown, the eyes and
 * brow, the gold seams, her hands, the stones at her feet. Her posture and
 * scale move the body group; her fill widens the belly; her surface follows
 * evidence freshness through the same roughness/clearcoat axis a fired bank
 * uses. Charms — the couple's small add-ons — are instanced on the body
 * group by `queenCharmSet` and never touch a reserved mesh. Her form — the
 * handles thrown on the wheel and the rings her closed Chapters leave — is
 * the skirt's lathe, rebuilt only when the form changes; the gold seams
 * follow it. Her underside carries the makers' marks and is never painted.
 * No money is read here.
 */
export type QueenSculptureOptions = {
  clay?: string;
  gold?: string;
  leaf?: string;
  bud?: string;
  ink?: string;
  reducedMotion?: boolean;
};

/** Framing height: her body plus the vine above her head, at scale 1. */
export const QUEEN_HEIGHT = 4.6;
const BODY_ORIGIN_Y = 0;

type PartState = { layer: HTMLCanvasElement | null; display: HTMLCanvasElement | null; texture: THREE.CanvasTexture | null; mat: THREE.MeshPhysicalMaterial };

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

  const clayColor = options.clay ?? "#d9cfbd";
  const gold = mat(new THREE.MeshStandardMaterial({ color: options.gold ?? "#c9a227", roughness: 0.35, metalness: 0.8, emissive: "#000000" }));
  const goldSeam = mat(new THREE.MeshStandardMaterial({ color: options.gold ?? "#c9a227", roughness: 0.3, metalness: 0.85, emissive: options.gold ?? "#c9a227", emissiveIntensity: 0.35 }));
  const leaf = mat(new THREE.MeshStandardMaterial({ color: options.leaf ?? "#2c6a4e", roughness: 0.8 }));
  const stem = mat(new THREE.MeshStandardMaterial({ color: "#3f5d47", roughness: 0.85 }));
  const bud = mat(new THREE.MeshPhysicalMaterial({ color: options.bud ?? "#c45c26", roughness: 0.4, clearcoat: 0.6 }));
  const ink = mat(new THREE.MeshStandardMaterial({ color: options.ink ?? "#1b1712", roughness: 0.8 }));
  const white = mat(new THREE.MeshStandardMaterial({ color: "#fff8ee", roughness: 0.5 }));
  const stone = mat(new THREE.MeshStandardMaterial({ color: "#8e8474", roughness: 0.95 }));
  /** Reserved clay for her hands and shoulders: the same clay as her body, never painted. */
  const reservedClay = mat(new THREE.MeshPhysicalMaterial({ color: clayColor, roughness: QUEEN_GLAZE_AXIS.glazed.roughness, clearcoat: QUEEN_GLAZE_AXIS.glazed.clearcoat, metalness: 0.02 }));

  // ---- paintable parts: body, head ----
  const canvasOk = typeof document !== "undefined" && (() => { try { return Boolean(document.createElement("canvas").getContext("2d")); } catch { return false; } })();
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

  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, name: string) => {
    const object = new THREE.Mesh(geo(g), m);
    object.name = name;
    object.castShadow = false;
    object.receiveShadow = false;
    parent.add(object);
    return object;
  };
  const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
  const tube = (points: [number, number, number][], radius: number, m: THREE.Material, parent: THREE.Object3D, name: string) =>
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 24, radius, 8, false), m, parent, name);

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
  // Hands, held at the front: the Move's seat. Reserved.
  const hands = mesh(new THREE.SphereGeometry(0.34, 24, 16), reservedClay, body, "queen-hands");
  hands.scale.set(1.35, 0.55, 0.8);
  hands.position.set(0, 1.86, 0.92);
  // Head.
  const head = mesh(new THREE.SphereGeometry(QUEEN_HEAD.radius, 40, 28, QUEEN_HEAD.phiStart), parts.head.mat, body, "queen-head");
  head.position.set(...QUEEN_HEAD.position);
  head.scale.set(...QUEEN_HEAD.scale);
  const headTop = QUEEN_HEAD.position[1] + QUEEN_HEAD.radius * QUEEN_HEAD.scale[1];

  // Face: eyes closed (arcs), open (whites + pupils), brow, three mouths. Reserved.
  const face = new THREE.Group();
  face.name = "queen-face";
  face.position.set(0, 2.78, 0.04);
  body.add(face);
  const fz = 0.5 * 0.96 - 0.02;
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
  }
  face.add(eyesClosed, eyesOpen);
  eyesOpen.visible = false;
  const mouths = {
    serene: tube([[-0.11, -0.16, fz - 0.03], [0, -0.21, fz], [0.11, -0.16, fz - 0.03]], 0.012, ink, face, "queen-mouth-serene"),
    level: tube([[-0.1, -0.17, fz - 0.03], [0, -0.185, fz], [0.1, -0.17, fz - 0.03]], 0.012, ink, face, "queen-mouth-level"),
    set: tube([[-0.1, -0.2, fz - 0.03], [0, -0.17, fz], [0.1, -0.2, fz - 0.03]], 0.012, ink, face, "queen-mouth-set"),
  };
  mouths.level.visible = false; mouths.set.visible = false;

  // Crown: five gold points on a ring, and a light that comes up when both are here. Reserved.
  const crown = new THREE.Group();
  crown.name = "queen-crown";
  crown.position.set(0, headTop - 0.06, 0);
  body.add(crown);
  const crownRing = mesh(new THREE.TorusGeometry(0.34, 0.035, 10, 32), gold, crown, "queen-crown-ring");
  crownRing.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const point = mesh(new THREE.ConeGeometry(0.07, 0.24, 5), gold, crown, "queen-crown-point");
    point.position.set(Math.sin(a) * 0.32, 0.14, Math.cos(a) * 0.32);
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
      seam.geometry = geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p))), 24, seamRadii[i]!, 8, false));
    }
    shoulders.scale.set(form.handles.neck, 1, form.handles.neck);
  };

  // The mandevilla vine: her hair, the Chapter, grown by acts. Buds are goals in motion. Reserved.
  const vine = new THREE.Group();
  vine.name = "queen-vine";
  vine.position.set(0, headTop - 0.1, -0.05);
  body.add(vine);
  tube([[0, 0, 0], [-0.25, 0.45, 0.05], [-0.62, 0.78, 0.12], [-0.86, 1.1, 0.2]], 0.032, stem, vine, "queen-stem");
  tube([[0, 0, 0], [0.22, 0.5, 0.02], [0.6, 0.86, 0.12], [0.98, 1.0, 0.24]], 0.03, stem, vine, "queen-stem");
  const leafSeats: Array<[number, number, number, number]> = [[-0.3, 0.55, 0.1, -0.6], [-0.66, 0.9, 0.2, -0.9], [0.5, 0.8, 0.14, 0.8], [0.3, 0.5, 0.06, 0.5], [0.9, 1.02, 0.3, 0.4]];
  const leaves = leafSeats.map(([x, y, z, rz]) => {
    const l = mesh(new THREE.SphereGeometry(0.16, 14, 10), leaf, vine, "queen-leaf");
    l.position.set(x, y, z); l.scale.set(1.6, 0.6, 0.35); l.rotation.z = rz; l.visible = false;
    return l;
  });
  const budSeats: Array<[number, number, number, number]> = [[-0.9, 1.16, 0.22, 0.12], [1.02, 1.06, 0.26, 0.1], [-0.45, 0.72, 0.16, 0.085], [0.72, 0.62, 0.14, 0.08]];
  const buds = budSeats.map(([x, y, z, r]) => {
    // A bud is a long, tightly furled spiral held upright, not a ball: the honest form for a Chapter in progress.
    const b = mesh(new THREE.SphereGeometry(r, 16, 12), bud, vine, "queen-bud");
    b.position.set(x, y, z); b.scale.set(0.62, 1.7, 0.62); b.rotation.z = -x * 0.25; b.visible = false;
    return b;
  });

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
        state.texture.needsUpdate = true;
      } catch { state.mat.color.set(studioHex(partDip(paint, part))); }
    }
  };
  const applyAxis = () => {
    for (const m of [parts.body.mat, parts.head.mat, reservedClay]) {
      m.roughness = axis.roughness; m.clearcoat = axis.clearcoat; m.envMapIntensity = axis.envMapIntensity; m.needsUpdate = true;
    }
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

  return {
    group,
    /** Total height in world units at scale 1, for framing. */
    height: QUEEN_HEIGHT,
    get disposed() { return disposed; },
    /** Names of the reserved groups and meshes, for tests that assert the paint never reaches them. */
    reserved: { vine, crown, crownLight, face, eyesOpen, eyesClosed, hands, seams, feet, stones, belly, underside, shoulders },
    paintable: { body: skirt, head },
    materials: { body: parts.body.mat, head: parts.head.mat, reservedClay, gold, goldSeam, leaf, bud, ink },
    counts() { const c = charms.counts(); return { geometries: geometries.size + c.geometries, materials: materials.size + (c.geometries ? c.materials : 0), textures: textures.size }; },
    charmCounts() { return charms.counts(); },
    /** The charms on her, in the piece's own coordinates. Sanitized by the caller; drawn here. */
    setCharms(next: QueenCharmV1[]) { charms.setCharms(next); },
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
    /** Where a ray lands on her paintable surface: the part and its uv, or null off her or on a reserved mesh. */
    pick(raycaster: THREE.Raycaster): { part: QueenCharmPart; u: number; v: number } | null {
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
    },
    /** Evidence freshness owns the surface. There is no setFired: nobody fires her. */
    setGlaze(next: QueenGlazeAxis) {
      if (next === axis) return;
      axis = next;
      applyAxis();
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
      for (const [index, seam] of seams.entries()) seam.visible = index < seamCount;
    },
    setVine(chapter: boolean, growth: number, budCount: number) {
      const scale = chapter ? 0.74 + Math.max(0, Math.min(4, growth)) * 0.09 : 0.56;
      vine.scale.setScalar(scale);
      const leafCount = chapter ? 1 + Math.max(0, Math.min(4, growth)) : 0;
      for (const [index, l] of leaves.entries()) l.visible = index < leafCount;
      for (const [index, b] of buds.entries()) b.visible = index < budCount;
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
    },
  };
}
export type QueenSculpture = ReturnType<typeof createQueenSculpture>;
