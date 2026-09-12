/**
 * Parametric ceramic cat for the Kitty Bank Studio (2026-09-11).
 *
 * Every paintable part (body, head, both ears, tail, paws) owns a canvas
 * texture so freehand paint, dips and stamps land where the pointer hit.
 * Unfired clay is matte bisque with lifted colour; fired pieces are deep,
 * glassy and clearcoated. Growth (Slime Rancher feel) scales the cat from its
 * turntable; the turntable itself never moves. No money is read here.
 */
import * as THREE from "three";
import type { KittyPaintV1, KittyPart, KittyPieceV1, KittySculptV1, KittyStrokeV1 } from "../core/types.ts";
import { KITTY_PARTS, defaultKittyPaint, defaultKittySculpt } from "../core/kittyStudio.ts";
import { PART_CANVAS_SIZE, appendStroke, partDip, presentPart, replayPart } from "./studio/paintCanvas.ts";
import { studioHex } from "./studio/palette.ts";

export type KittyExpression = "open" | "happy" | "wide" | "sleepy";
export type KittySculptureOptions = {
  brass: string;
  wood: string;
  fired?: boolean;
  reducedMotion?: boolean;
  /** Called when the sculpture starts an animation and needs frames. */
  onAnimate?: () => void;
};
export type KittySculpture = ReturnType<typeof createKittySculpture>;

const BASE_Y = 0.16;
const GROW = 0.055;
const V2 = (x: number, y: number) => new THREE.Vector2(x, y);

/** Body silhouettes: [radius, height] pairs from base to neck; handles scale bands. */
const BODY_OUTLINES: Record<KittySculptV1["body"], Array<[number, number]>> = {
  round: [[0, 0], [0.42, 0.03], [0.73, 0.22], [0.85, 0.56], [0.83, 0.86], [0.73, 1.18], [0.56, 1.46], [0.36, 1.67], [0, 1.71]],
  pear: [[0, 0], [0.5, 0.03], [0.86, 0.2], [0.94, 0.5], [0.86, 0.82], [0.68, 1.12], [0.5, 1.4], [0.33, 1.62], [0, 1.66]],
  loaf: [[0, 0], [0.6, 0.03], [0.9, 0.16], [0.97, 0.42], [0.95, 0.7], [0.86, 0.98], [0.68, 1.2], [0.44, 1.36], [0, 1.4]],
  tall: [[0, 0], [0.4, 0.03], [0.62, 0.24], [0.7, 0.66], [0.7, 1.06], [0.64, 1.44], [0.52, 1.76], [0.34, 1.98], [0, 2.02]],
  bean: [[0, 0], [0.46, 0.03], [0.78, 0.2], [0.9, 0.5], [0.8, 0.8], [0.7, 1.08], [0.66, 1.36], [0.4, 1.62], [0, 1.66]],
};
function bodyPoints(sculpt: KittySculptV1) {
  const outline = BODY_OUTLINES[sculpt.body];
  const top = outline[outline.length - 1]![1];
  const [belly, waist, shoulder, neck] = sculpt.profile;
  return outline.map(([r, y]) => {
    const t = y / top;
    // Blend the four handles across height: belly 0.25, waist 0.5, shoulder 0.75, neck 1.
    const handle = t < 0.25 ? 1 + (belly - 1) * (t / 0.25) : t < 0.5 ? belly + (waist - belly) * ((t - 0.25) / 0.25) : t < 0.75 ? waist + (shoulder - waist) * ((t - 0.5) / 0.25) : shoulder + (neck - shoulder) * ((t - 0.75) / 0.25);
    return V2(r * handle, y);
  });
}
const HEAD_SCALE: Record<KittySculptV1["head"], [number, number, number]> = {
  round: [1.04, 0.91, 0.79],
  wedge: [1.12, 0.82, 0.86],
  chubby: [1.22, 0.95, 0.88],
  heart: [1.16, 0.88, 0.8],
};

export function createKittySculpture(piece: KittyPieceV1 | null, options: KittySculptureOptions) {
  const group = new THREE.Group();
  const cat = new THREE.Group();
  cat.position.y = BASE_Y;
  group.add(cat);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  let sculpt: KittySculptV1 = piece?.sculpt ?? defaultKittySculpt();
  let paint: KittyPaintV1 = piece?.paint ?? defaultKittyPaint();
  let fired = options.fired ?? Boolean(piece?.firedAt);
  const reduced = Boolean(options.reducedMotion);

  const material = (color: string, roughness: number, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m);
    return m;
  };
  const brass = material(options.brass, 0.32, 0.72), walnut = material(options.wood, 0.7);
  const ink = material("#302b29", 0.8), paper = material("#f0dfbc", 0.8), velvet = material("#614837", 1), blush = material("#c9927d", 0.7), white = material("#fff8ee", 0.5);
  const sparkleMat = new THREE.MeshBasicMaterial({ color: "#ffe9a3", transparent: true, opacity: 0, depthWrite: false });
  materials.add(sparkleMat);

  // One layer + display canvas + texture + material per paintable part.
  const parts = Object.fromEntries(
    KITTY_PARTS.map((part) => {
      const size = PART_CANVAS_SIZE[part];
      const layer = document.createElement("canvas"), display = document.createElement("canvas");
      layer.width = layer.height = size;
      display.width = display.height = size;
      const texture = new THREE.CanvasTexture(display);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      textures.add(texture);
      const mat = new THREE.MeshPhysicalMaterial({ map: texture, color: "#ffffff", roughness: 0.92, metalness: 0.02, clearcoat: 0 });
      materials.add(mat);
      return [part, { layer, display, texture, mat, meshes: [] as THREE.Mesh[] }];
    }),
  ) as Record<KittyPart, { layer: HTMLCanvasElement; display: HTMLCanvasElement; texture: THREE.CanvasTexture; mat: THREE.MeshPhysicalMaterial; meshes: THREE.Mesh[] }>;
  const doorMat = new THREE.MeshPhysicalMaterial({ color: partDip(paint, "body"), roughness: 0.92, clearcoat: 0 });
  materials.add(doorMat);

  const applyFinish = () => {
    for (const part of KITTY_PARTS) {
      const m = parts[part].mat;
      m.roughness = fired ? 0.18 : 0.92;
      m.clearcoat = fired ? 1 : 0;
      m.clearcoatRoughness = 0.08;
      m.envMapIntensity = fired ? 0.7 : 0.15;
      m.needsUpdate = true;
    }
    doorMat.roughness = fired ? 0.18 : 0.92;
    doorMat.clearcoat = fired ? 1 : 0;
    doorMat.clearcoatRoughness = 0.08;
    doorMat.envMapIntensity = fired ? 0.7 : 0.15;
    doorMat.needsUpdate = true;
  };
  const present = (part: KittyPart, rect?: { x: number; y: number; w: number; h: number }) => {
    presentPart(parts[part].layer, parts[part].display, fired, rect);
    parts[part].texture.needsUpdate = true;
  };
  const replayAll = () => {
    for (const part of KITTY_PARTS) {
      replayPart(parts[part].layer, paint, part);
      present(part);
    }
    doorMat.color.set(fired ? partDip(paint, "body") : bisqueOf(partDip(paint, "body")));
  };
  const bisqueOf = (hex: string) => {
    const c = new THREE.Color(studioHex(hex));
    const gray = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const lift = (v: number, t: number) => { const d = v + 0.25 * (gray - v); return d + 0.35 * (t - d); };
    return new THREE.Color(lift(c.r, 239 / 255), lift(c.g, 230 / 255), lift(c.b, 216 / 255));
  };

  // ---- sculpt-dependent meshes (rebuilt on setSculpt) ----
  const sculptGeometries = new Set<THREE.BufferGeometry>();
  const sculptGroup = new THREE.Group();
  cat.add(sculptGroup);
  let eyeMeshes: Record<KittyExpression, THREE.Group> | null = null;
  let slotRim: THREE.Mesh | null = null;
  let hinge: THREE.Group | null = null;
  let compartment: THREE.Group | null = null;
  let headTop = 2.4, headY = 2.1, bodyTop = 1.71;
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, paintable?: KittyPart) => {
    sculptGeometries.add(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.decorative = true;
    if (paintable) {
      m.userData.part = paintable;
      parts[paintable].meshes.push(m);
    }
    parent.add(m);
    return m;
  };
  const tube = (points: [number, number, number][], radius: number, mat: THREE.Material, parent: THREE.Object3D, paintable?: KittyPart) =>
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 36, radius, 10, false), mat, parent, paintable);
  const sphere = (r: number, scale: [number, number, number], pos: [number, number, number], mat: THREE.Material, parent: THREE.Object3D, paintable?: KittyPart) => {
    const m = mesh(new THREE.SphereGeometry(r, 32, 24, -Math.PI / 2), mat, parent, paintable);
    m.scale.set(...scale);
    m.position.set(...pos);
    return m;
  };
  const clearSculpt = () => {
    sculptGroup.clear();
    for (const g of sculptGeometries) g.dispose();
    sculptGeometries.clear();
    for (const part of KITTY_PARTS) parts[part].meshes = [];
    eyeMeshes = null;
  };
  const build = () => {
    clearSculpt();
    const points = bodyPoints(sculpt);
    bodyTop = points[points.length - 1]!.y;
    const body = mesh(new THREE.LatheGeometry(points, 64, Math.PI), parts.body.mat, sculptGroup, "body");
    body.scale.z = 0.86;
    headY = bodyTop + 0.25;
    const hs = HEAD_SCALE[sculpt.head];
    sphere(0.59, hs, [0, headY, 0.035], parts.head.mat, sculptGroup, "head");
    if (sculpt.head === "heart") {
      for (const side of [-1, 1]) sphere(0.3, [1, 0.9, 0.9], [side * 0.36, headY + 0.36, 0.0], parts.head.mat, sculptGroup, "head");
    }
    headTop = headY + 0.59 * hs[1];
    // Ears
    for (const side of [-1, 1] as const) {
      const part: KittyPart = side < 0 ? "earL" : "earR";
      const earGroup = new THREE.Group();
      earGroup.position.set(side * 0.34 * hs[0], headTop - 0.08, -0.04);
      earGroup.rotation.z = -side * 0.22;
      sculptGroup.add(earGroup);
      if (sculpt.ears === "none") continue;
      if (sculpt.ears === "round") sphere(0.2, [1, 1, 0.55], [0, 0.1, 0], parts[part].mat, earGroup, part);
      else {
        const height = sculpt.ears === "folded" ? 0.26 : sculpt.ears === "tufted" ? 0.5 : 0.42;
        const ear = mesh(new THREE.ConeGeometry(0.19, height, 24, 1, false, Math.PI), parts[part].mat, earGroup, part);
        ear.scale.z = 0.55;
        ear.position.y = height / 2 - 0.04;
        if (sculpt.ears === "folded") ear.rotation.x = 0.9;
        if (sculpt.ears === "tufted") {
          const tuft = tube([[0, height - 0.08, 0], [side * 0.05, height + 0.08, 0.02], [side * 0.12, height + 0.2, 0.04]], 0.02, parts[part].mat, earGroup, part);
          tuft.castShadow = false;
        }
      }
      const inner = mesh(new THREE.CircleGeometry(0.075, 16), blush, earGroup);
      inner.scale.set(0.7, sculpt.ears === "folded" ? 0.6 : 1.4, 1);
      inner.position.set(0, 0.16, 0.115);
      inner.rotation.x = sculpt.ears === "folded" ? 0.9 : 0;
    }
    // Face: nose, mouth, whiskers, eyes (all four expressions built, one visible)
    const faceZ = 0.59 * hs[2];
    const face = new THREE.Group();
    face.position.set(0, headY, 0.035);
    sculptGroup.add(face);
    const noseY = -0.05;
    if (sculpt.nose === "button") sphere(0.047, [1, 0.6, 0.6], [0, noseY, faceZ - 0.02], blush, face);
    else if (sculpt.nose === "tiny") sphere(0.028, [1, 0.7, 0.6], [0, noseY, faceZ - 0.01], blush, face);
    else {
      sphere(0.03, [1, 0.8, 0.5], [-0.02, noseY + 0.01, faceZ - 0.015], blush, face);
      sphere(0.03, [1, 0.8, 0.5], [0.02, noseY + 0.01, faceZ - 0.015], blush, face);
      sphere(0.03, [1, 0.8, 0.5], [0, noseY - 0.02, faceZ - 0.015], blush, face);
    }
    const mz = faceZ - 0.03;
    const mouthY = noseY - 0.09;
    if (sculpt.mouth === "w" || sculpt.mouth === "tongue") {
      for (const side of [-1, 1]) tube([[side * 0.005, mouthY + 0.03, mz], [side * 0.05, mouthY - 0.01, mz - 0.01], [side * 0.1, mouthY + 0.03, mz - 0.03]], 0.011, ink, face);
      if (sculpt.mouth === "tongue") sphere(0.03, [1, 0.8, 0.5], [0, mouthY - 0.03, mz - 0.01], blush, face);
    } else if (sculpt.mouth === "smile") tube([[-0.12, mouthY + 0.03, mz - 0.03], [0, mouthY - 0.03, mz], [0.12, mouthY + 0.03, mz - 0.03]], 0.011, ink, face);
    else if (sculpt.mouth === "grin") {
      tube([[-0.16, mouthY + 0.05, mz - 0.05], [0, mouthY - 0.04, mz], [0.16, mouthY + 0.05, mz - 0.05]], 0.012, ink, face);
      const teeth = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.01), white, face);
      teeth.position.set(0, mouthY - 0.005, mz - 0.005);
    } else tube([[-0.05, mouthY, mz - 0.005], [0.05, mouthY, mz - 0.005]], 0.009, ink, face);
    if (sculpt.whiskers !== "none") {
      const len = sculpt.whiskers === "long" ? 0.42 : 0.24;
      for (const side of [-1, 1])
        for (let i = 0; i < (sculpt.whiskers === "curly" ? 2 : 3); i++) {
          const y = mouthY + 0.05 - i * 0.05;
          const pts: [number, number, number][] = sculpt.whiskers === "curly"
            ? [[side * 0.2, y, mz - 0.06], [side * 0.34, y + 0.06 - i * 0.1, mz - 0.14], [side * 0.3, y + 0.16 - i * 0.2, mz - 0.18]]
            : [[side * 0.2, y, mz - 0.06], [side * (0.2 + len), y + 0.04 - i * 0.05, mz - 0.14]];
          tube(pts, 0.007, ink, face).castShadow = false;
        }
    }
    eyeMeshes = { open: new THREE.Group(), happy: new THREE.Group(), wide: new THREE.Group(), sleepy: new THREE.Group() };
    const ez = faceZ - 0.09, eyeY = 0.1;
    for (const side of [-1, 1]) {
      const x = side * 0.19;
      sphere(0.05, [1, 1.1, 0.5], [x, eyeY, ez], ink, eyeMeshes.open);
      sphere(0.015, [1, 1, 0.5], [x + side * 0.015, eyeY + 0.025, ez + 0.03], white, eyeMeshes.open);
      tube([[x - 0.06, eyeY - 0.01, ez], [x, eyeY + 0.05, ez + 0.02], [x + 0.06, eyeY - 0.01, ez]], 0.013, ink, eyeMeshes.happy);
      sphere(0.075, [1, 1.15, 0.5], [x, eyeY + 0.01, ez - 0.01], ink, eyeMeshes.wide);
      sphere(0.026, [1, 1, 0.5], [x + side * 0.02, eyeY + 0.04, ez + 0.035], white, eyeMeshes.wide);
      tube([[x - 0.06, eyeY, ez], [x, eyeY - 0.025, ez + 0.015], [x + 0.06, eyeY, ez]], 0.012, ink, eyeMeshes.sleepy);
    }
    for (const g of Object.values(eyeMeshes)) { g.visible = false; face.add(g); }
    eyeMeshes[expression].visible = true;
    // Coin slot on the crown
    slotRim = mesh(new THREE.BoxGeometry(0.31, 0.028, 0.092), brass, sculptGroup);
    slotRim.position.set(0, headTop + 0.02, 0.01);
    const slot = mesh(new THREE.BoxGeometry(0.26, 0.03, 0.037), ink, sculptGroup);
    slot.position.set(0, headTop + 0.024, 0.01);
    // Paws
    for (const side of [-1, 1]) {
      sphere(0.25, [1, 0.65, 1.2], [side * 0.36 * sculpt.profile[0], 0.12, 0.54 * sculpt.profile[0]], parts.paws.mat, sculptGroup, "paws");
      sphere(0.16, [0.65, 1.55, 0.8], [side * (0.64 * sculpt.profile[1] + 0.1), 0.66, 0.47], parts.paws.mat, sculptGroup, "paws");
    }
    // Tail
    const r0 = points[3]!.x;
    if (sculpt.tail === "curl") tube([[r0 * 0.7, 0.13, -0.34], [r0 * 1.1, 0.28, -0.48], [r0 * 1.2, 0.6, -0.3], [r0 * 1.05, 0.81, -0.07], [r0 * 0.9, 0.76, 0.08]], 0.087, parts.tail.mat, sculptGroup, "tail");
    else if (sculpt.tail === "up") tube([[0, 0.14, -r0 * 0.75], [0.05, 0.54, -r0 * 1.05], [0.12, 1.14, -r0 * 1.1], [0.05, 1.64, -r0 * 0.9]], 0.085, parts.tail.mat, sculptGroup, "tail");
    else if (sculpt.tail === "wrap") tube([[-r0 * 0.4, 0.06, -r0 * 0.7], [-r0 * 1.05, 0.05, -r0 * 0.2], [-r0 * 1.15, 0.05, r0 * 0.4], [-r0 * 0.7, 0.08, r0 * 0.9], [0.05, 0.12, r0 * 1.05]], 0.085, parts.tail.mat, sculptGroup, "tail");
    // Compartment ahead of the body, pinned to the sculpted belly
    const doorZ = 0.68 * (points[4]!.x / 0.83) * 0.86 + 0.12;
    compartment = new THREE.Group();
    compartment.position.set(0, 0.8, doorZ);
    sculptGroup.add(compartment);
    const frame = new THREE.Shape();
    frame.moveTo(-0.32, -0.32); frame.lineTo(0.32, -0.32); frame.lineTo(0.32, 0.32); frame.lineTo(-0.32, 0.32); frame.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.27, -0.27); hole.lineTo(-0.27, 0.27); hole.lineTo(0.27, 0.27); hole.lineTo(0.27, -0.27); hole.closePath();
    frame.holes.push(hole);
    mesh(new THREE.ExtrudeGeometry(frame, { depth: 0.13, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3 }), brass, compartment);
    const back = mesh(new THREE.BoxGeometry(0.55, 0.55, 0.015), velvet, compartment);
    back.position.z = 0.08;
    for (let i = 0; i < 3; i++) {
      const env = new THREE.Group();
      env.position.set((i - 1) * 0.052, 0.02 + (i - 1) * 0.04, 0.11 + i * 0.022);
      env.rotation.z = (i - 1) * -0.08;
      compartment.add(env);
      mesh(new THREE.BoxGeometry(0.36, 0.23, 0.012), paper, env);
      const flap = new THREE.Shape();
      flap.moveTo(-0.18, 0.115); flap.lineTo(0, -0.015); flap.lineTo(0.18, 0.115); flap.closePath();
      mesh(new THREE.ShapeGeometry(flap), walnut, env).position.z = 0.008;
      mesh(new THREE.CircleGeometry(0.025, 16), brass, env).position.set(0, 0, 0.011);
    }
    hinge = new THREE.Group();
    hinge.position.set(-0.32, 0, 0.205);
    compartment.add(hinge);
    const door = mesh(new THREE.BoxGeometry(0.64, 0.64, 0.045), doorMat, hinge);
    door.position.x = 0.32;
    mesh(new THREE.SphereGeometry(0.038, 16, 12), brass, hinge).position.set(0.55, 0, 0.052);
    hinge.rotation.y = open ? -1.9 : 0;
  };

  // ---- fixed furniture ----
  const fixedGeo = (g: THREE.BufferGeometry) => { geometries.add(g); return g; };
  const disk = new THREE.Mesh(fixedGeo(new THREE.CylinderGeometry(1.06, 1.1, 0.13, 64)), walnut);
  disk.scale.z = 0.77; disk.position.y = 0.085; disk.receiveShadow = true; disk.userData.decorative = true;
  group.add(disk);
  const rim = new THREE.Mesh(fixedGeo(new THREE.TorusGeometry(1.06, 0.018, 8, 64)), brass);
  rim.rotation.x = Math.PI / 2; rim.scale.y = 0.77; rim.position.y = 0.15; rim.userData.decorative = true;
  group.add(rim);
  // Sparkles: one geometry, one material, at most 12 sprites.
  const sparkleGeo = fixedGeo(new THREE.PlaneGeometry(0.07, 0.07));
  const sparkles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; spin: number }> = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(sparkleGeo, sparkleMat);
    m.visible = false;
    m.rotation.z = Math.PI / 4;
    m.userData.decorative = true;
    cat.add(m);
    sparkles.push({ mesh: m, vx: 0, vy: 0, vz: 0, spin: 0 });
  }

  // ---- state + animation ----
  let open = true, expression: KittyExpression = sculpt.eyes, step = 0;
  let restScale = 1;
  type Anim = { kind: "grow"; from: number; start: number } | { kind: "shrink"; from: number; start: number } | null;
  let anim: Anim = null;
  let happyUntil = 0, sparkleUntil = 0, slotPulseUntil = 0, highlightUntil = 0;
  let breathing = false, spinSpeed = 0, lastTick = 0;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const kick = () => options.onAnimate?.();
  const applyScale = (sx: number, sy: number, sz: number) => cat.scale.set(sx, sy, sz);
  const showEyes = (e: KittyExpression) => {
    if (!eyeMeshes) return;
    for (const [key, g] of Object.entries(eyeMeshes)) g.visible = key === e;
  };

  build();
  replayAll();
  applyFinish();

  return {
    group,
    /** Paintable meshes for raycasting; decorative ink is excluded. */
    get paintables() {
      return KITTY_PARTS.flatMap((part) => parts[part].meshes);
    },
    setSculpt(next: KittySculptV1) {
      sculpt = next;
      expression = anim?.kind === "grow" && happyUntil > now() ? "happy" : sculpt.eyes;
      build();
      showEyes(expression);
      doorMat.color.set(fired ? partDip(paint, "body") : bisqueOf(partDip(paint, "body")));
    },
    setPaint(next: KittyPaintV1) {
      paint = next;
      replayAll();
    },
    replayPaint(next: KittyPaintV1) {
      paint = next;
      replayAll();
    },
    /** Incremental: draw points from `fromIndex` of an in-progress stroke. */
    paintStroke(stroke: KittyStrokeV1, fromIndex = 0) {
      const touched = new Set<KittyPart>([stroke.part]);
      if (stroke.mirror) touched.add(stroke.part === "earL" ? "earR" : stroke.part === "earR" ? "earL" : stroke.part);
      for (const part of touched) {
        const rects = appendStroke(parts[part].layer, paint, part, stroke, fromIndex);
        for (const rect of rects) {
          const size = parts[part].layer.width;
          presentPart(parts[part].layer, parts[part].display, fired, rect);
          presentPart(parts[part].layer, parts[part].display, fired, { ...rect, x: rect.x + size });
          presentPart(parts[part].layer, parts[part].display, fired, { ...rect, x: rect.x - size });
        }
        parts[part].texture.needsUpdate = true;
      }
    },
    setFired(next: boolean) {
      if (fired === next) return;
      fired = next;
      applyFinish();
      for (const part of KITTY_PARTS) present(part);
      doorMat.color.set(fired ? partDip(paint, "body") : bisqueOf(partDip(paint, "body")));
    },
    get fired() {
      return fired;
    },
    setOpen(v: boolean) {
      open = v;
      if (hinge) hinge.rotation.y = v ? -1.9 : 0;
    },
    setExpression(e: KittyExpression) {
      expression = e;
      showEyes(e);
    },
    /** 0..10 backing step → resting scale 1 + step*0.055. Animate only for a visible deposit/use. */
    setFill(next: number, animate: boolean) {
      const target = Math.max(0, Math.min(10, Math.round(next)));
      const previous = step;
      step = target;
      const from = restScale;
      restScale = 1 + step * GROW;
      if (!animate || reduced || previous === target) {
        applyScale(restScale, restScale, restScale);
        anim = null;
        if (animate && reduced && target > previous) { highlightUntil = now() + 120; kick(); }
        return;
      }
      const start = now();
      if (target > previous) {
        anim = { kind: "grow", from, start };
        happyUntil = start + 1400;
        sparkleUntil = start + 900;
        slotPulseUntil = start + 320;
        showEyes("happy");
        const slotY = headTop + 0.02;
        for (const [i, s] of sparkles.entries()) {
          s.mesh.visible = true;
          s.mesh.position.set(0, slotY, 0.01);
          const a = (i / sparkles.length) * Math.PI * 2;
          s.vx = Math.cos(a) * 0.45; s.vz = Math.sin(a) * 0.3; s.vy = 1.1 + (i % 3) * 0.35; s.spin = (i % 2 ? 1 : -1) * 4;
        }
        sparkleMat.opacity = 1;
      } else anim = { kind: "shrink", from, start };
      kick();
    },
    /** Slow ±1.2% breathe while visible. Off under reduced motion. */
    setIdle(v: boolean) {
      breathing = v && !reduced;
      if (breathing) kick();
      else if (!anim) applyScale(restScale, restScale, restScale);
    },
    /** Turntable spin in radians per second (Wheel bench). */
    setSpin(radPerSec: number) {
      spinSpeed = reduced ? 0 : radPerSec;
      if (spinSpeed) kick();
    },
    /** Advance animations. Returns true while more frames are needed. */
    update(t = now()): boolean {
      const dt = lastTick ? Math.min(0.05, (t - lastTick) / 1000) : 0;
      lastTick = t;
      let busy = false;
      if (spinSpeed) { group.rotation.y += spinSpeed * dt; busy = true; }
      if (anim) {
        const e = (t - anim.start) / 1000;
        if (anim.kind === "grow") {
          const env = Math.exp(-4.2 * e / 0.9), osc = env * Math.cos(35 * e);
          applyScale(restScale * (1 + 0.32 * osc), restScale * (1 + 0.07 * osc), restScale * (1 + 0.32 * osc));
          if (e > 0.95) { anim = null; applyScale(restScale, restScale, restScale); } else busy = true;
        } else {
          const k = Math.min(1, e / 0.5), ease = 1 - Math.pow(1 - k, 3);
          const s = anim.from + (restScale - anim.from) * ease;
          applyScale(s, s, s);
          if (k >= 1) anim = null; else busy = true;
        }
      } else if (breathing) {
        const s = restScale * (1 + 0.012 * Math.sin((t / 6000) * Math.PI * 2));
        applyScale(s, s, s);
        busy = true;
      }
      if (slotRim) {
        const p = slotPulseUntil > t ? 1 + 0.3 * Math.sin(((slotPulseUntil - t) / 320) * Math.PI) : 1;
        slotRim.scale.set(p, 1, p);
        if (slotPulseUntil > t) busy = true;
      }
      if (happyUntil) {
        if (t >= happyUntil) { happyUntil = 0; showEyes(sculpt.eyes); } else busy = true;
      }
      if (sparkleUntil) {
        if (t >= sparkleUntil) { sparkleUntil = 0; for (const s of sparkles) s.mesh.visible = false; sparkleMat.opacity = 0; }
        else {
          const remaining = (sparkleUntil - t) / 900;
          sparkleMat.opacity = Math.min(1, remaining * 1.6);
          for (const s of sparkles) {
            s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt;
            s.vy -= 1.6 * dt; s.mesh.rotation.z += s.spin * dt;
          }
          busy = true;
        }
      }
      if (highlightUntil) {
        const on = t < highlightUntil;
        for (const part of KITTY_PARTS) parts[part].mat.emissive.set(on ? "#3a2f12" : "#000000");
        if (!on) highlightUntil = 0; else busy = true;
      }
      if (!busy) lastTick = 0;
      return busy;
    },
    get animating() {
      return Boolean(anim || breathing || spinSpeed || happyUntil || sparkleUntil || slotPulseUntil || highlightUntil);
    },
    /** First paintable hit under the ray, as {part, uv}. */
    raycastPart(raycaster: THREE.Raycaster): { part: KittyPart; uv: { u: number; v: number } } | null {
      const hit = raycaster.intersectObjects(KITTY_PARTS.flatMap((part) => parts[part].meshes), false)[0];
      if (!hit || !hit.uv) return null;
      const u = ((hit.uv.x % 1) + 1) % 1;
      return { part: hit.object.userData.part as KittyPart, uv: { u, v: Math.max(0, Math.min(1, hit.uv.y)) } };
    },
    dispose() {
      clearSculpt();
      group.clear();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      geometries.clear();
      materials.clear();
      textures.clear();
    },
  };
}
