/**
 * The board's clay art kit (Horizon Clock, L3). Toys are AUTHORED like the approved prototype — small groups of
 * meshes (`part(geometry, colour)`) — and then BAKED: `bake(group)` merges every part under a pop group into at most
 * three draws (opaque clay, see-through clay with per-vertex alpha, blob shadows), with each part's colour in its
 * vertices. So a month of toys costs about two draws per slot, not one per sphere.
 *
 * No canvas, no text: every texture here is a `DataTexture` built from numbers (blob shadow, Newfoundland's painted
 * clapboard), so the kit runs the same in a browser, a worker or jsdom. All words stay in the DOM.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CLAPBOARD_BOARDS } from "./palette.ts";

/** What a part is painted with. `alpha` < 1 = see-through (drawn in the glass pass, never casting a shadow). */
export type Paint = { color: string; alpha?: number; shadow?: boolean };
const PAINT = "journeyPaint";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A mesh carrying a paint (its material is a placeholder; `bake` reads the paint). */
export function part(geometry: THREE.BufferGeometry, paint: Paint | string): THREE.Mesh {
  const p: Paint = typeof paint === "string" ? { color: paint } : paint;
  const m = new THREE.Mesh(geometry, PLACEHOLDER);
  m.userData[PAINT] = p;
  return m;
}
const PLACEHOLDER = new THREE.MeshBasicMaterial({ visible: false });

/** Rounded box (the prototype's `rbox`): a subdivided box with its corners pushed onto spheres of radius r. */
export function rbox(w: number, h: number, d: number, r: number, seg = 4): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position!, n = g.attributes.normal!;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 1) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd));
    o.subVectors(v, c);
    if (o.lengthSq() > 1e-10) { o.normalize(); v.copy(c).addScaledVector(o, r); p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, o.x, o.y, o.z); }
  }
  return g;
}

/** A lathe through radius/height pairs (r0, y0, r1, y1, …): toy profiles, never island coordinates. */
export function lathe(segments: number, ...flat: number[]): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i]!, flat[i + 1]!));
  return new THREE.LatheGeometry(pts, segments);
}

/** A ring lying flat (torus rotated to the ground). */
export function flatTorus(radius: number, tube: number, radial = 8, tubular = 40): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, tube, radial, tubular);
  g.rotateX(Math.PI / 2);
  return g;
}

/** A disc / ring lying flat at y 0. */
export function flatRing(inner: number, outer: number, segments = 64): THREE.BufferGeometry {
  const g = inner > 0 ? new THREE.RingGeometry(inner, outer, segments, 1) : new THREE.CircleGeometry(outer, segments);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Place a part (or group) and return it, prototype-style. */
export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, opts: { rx?: number; ry?: number; rz?: number; s?: number | [number, number, number] } = {}): T {
  o.position.set(x, y, z);
  if (opts.rx) o.rotation.x = opts.rx;
  if (opts.ry) o.rotation.y = opts.ry;
  if (opts.rz) o.rotation.z = opts.rz;
  if (opts.s !== undefined) { if (typeof opts.s === "number") o.scale.setScalar(opts.s); else o.scale.set(...opts.s); }
  return o;
}

// --- textures (numbers only) -------------------------------------------------------------------------------------

let blobTexture: THREE.DataTexture | null = null;
/** The soft contact shadow (radial alpha). Shared; never disposed per scene. */
export function blobTex(): THREE.DataTexture {
  if (blobTexture) return blobTexture;
  const N = 64, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
    const d = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
    const a = d >= 1 ? 0 : d < 0.5 ? 0.55 - 0.6 * d : 0.25 * (1 - (d - 0.5) / 0.5);
    const i = (y * N + x) * 4;
    data[i] = 40; data[i + 1] = 20; data[i + 2] = 30; data[i + 3] = Math.round(clamp(a, 0, 1) * 255);
  }
  blobTexture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  blobTexture.needsUpdate = true;
  return blobTexture;
}
/** A blob shadow quad (baked into the blob pass). */
export function blob(radius: number, opacity = 0.5): THREE.Mesh {
  const g = new THREE.PlaneGeometry(radius * 2, radius * 2);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, PLACEHOLDER);
  m.userData[PAINT] = { color: "#ffffff", alpha: opacity };
  m.userData.blob = true;
  return m;
}

let clapTexture: THREE.DataTexture | null = null;
/** Newfoundland's painted clapboard (the prototype's `clapTex`): coloured boards, white edges, lap shadows. */
export function clapboardTex(): THREE.DataTexture {
  if (clapTexture) return clapTexture;
  const W = 512, H = 32, n = 48, data = new Uint8Array(W * H * 4);
  const cols = CLAPBOARD_BOARDS.map((h) => new THREE.Color(h));
  for (let x = 0; x < W; x += 1) {
    const board = Math.floor((x / W) * n), edge = x - Math.floor((board * W) / n) < 2;
    const c = cols[board % cols.length]!;
    for (let y = 0; y < H; y += 1) {
      const lap = y % 5 === 3 ? 0.86 : y % 5 === 4 ? 1.1 : 1;
      const i = (y * W + x) * 4;
      const base = c.clone().convertLinearToSRGB();
      const v = (k: number) => Math.round(clamp((edge ? 0.15 * k + 0.85 : k) * lap, 0, 1) * 255);
      data[i] = v(base.r); data[i + 1] = v(base.g); data[i + 2] = v(base.b); data[i + 3] = 255;
    }
  }
  clapTexture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  clapTexture.colorSpace = THREE.SRGBColorSpace;
  clapTexture.wrapS = THREE.RepeatWrapping;
  clapTexture.needsUpdate = true;
  return clapTexture;
}

// --- materials ---------------------------------------------------------------------------------------------------

export type KitMaterials = { solid: THREE.MeshStandardMaterial; glass: THREE.MeshStandardMaterial; blob: THREE.MeshBasicMaterial; dispose(): void };
/** The three shared materials a scene bakes into. Colours live in the vertices, so a theme change rebakes, never recompiles. */
export function kitMaterials(): KitMaterials {
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  solid.name = "journey-map:clay";
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0, transparent: true, depthWrite: false });
  glass.name = "journey-map:glass";
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex(), vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  blobMat.name = "journey-map:blob";
  return { solid, glass, blob: blobMat, dispose() { solid.dispose(); glass.dispose(); blobMat.dispose(); } };
}

// --- baking ------------------------------------------------------------------------------------------------------

const tmpColor = new THREE.Color();
function prepared(mesh: THREE.Mesh, matrix: THREE.Matrix4, paint: Paint, keepUv: boolean): THREE.BufferGeometry {
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && !(keepUv && name === "uv")) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (keepUv && !g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) {
    // A mirrored part: flip winding so its faces still face out.
    const p = g.attributes.position!.array as Float32Array, n = g.attributes.normal!.array as Float32Array;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k += 1) {
      const a = i + 3 + k, b = i + 6 + k;
      [p[a], p[b]] = [p[b]!, p[a]!];
      [n[a], n[b]] = [n[b]!, n[a]!];
    }
  }
  tmpColor.set(paint.color);
  const count = g.attributes.position!.count, col = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) { col[i * 4] = tmpColor.r; col[i * 4 + 1] = tmpColor.g; col[i * 4 + 2] = tmpColor.b; col[i * 4 + 3] = paint.alpha ?? 1; }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  return g;
}

export type Baked = { group: THREE.Group; triangles: number };
/**
 * Merge every painted part under `root` (positions relative to `root`) into ≤ 3 meshes, added to a fresh group that
 * takes `root`'s own transform. Opaque parts cast shadows on the full tier (`shadows`); see-through parts never do.
 * Part geometries are disposed (they were authored for this bake only, except shared ones marked `userData.shared`).
 */
export function bake(root: THREE.Object3D, materials: KitMaterials, shadows: boolean, name = "journey-map:baked"): Baked {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const solid: THREE.BufferGeometry[] = [], glass: THREE.BufferGeometry[] = [], blobs: THREE.BufferGeometry[] = [];
  const owned = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const paint = mesh.userData?.[PAINT] as Paint | undefined;
    if (!mesh.isMesh || !paint || !o.visible) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    const isBlob = !!mesh.userData.blob;
    const g = prepared(mesh, m, paint, isBlob);
    (isBlob ? blobs : (paint.alpha ?? 1) < 0.999 ? glass : solid).push(g);
    if (!mesh.geometry.userData.shared) owned.add(mesh.geometry);
  });
  for (const g of owned) g.dispose();
  const group = new THREE.Group();
  group.name = name;
  group.position.copy(root.position); group.quaternion.copy(root.quaternion); group.scale.copy(root.scale);
  let triangles = 0;
  const add = (list: THREE.BufferGeometry[], material: THREE.Material, kind: string, cast: boolean, order: number) => {
    if (!list.length) return;
    const merged = list.length === 1 ? list[0]! : mergeGeometries(list, false);
    if (list.length > 1) for (const g of list) g.dispose();
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `${name}:${kind}`;
    mesh.castShadow = cast;
    mesh.receiveShadow = kind !== "blob";
    mesh.renderOrder = order;
    group.add(mesh);
    triangles += merged.attributes.position!.count / 3;
  };
  add(solid, materials.solid, "solid", shadows, 2);
  add(blobs, materials.blob, "blob", false, 1);
  add(glass, materials.glass, "glass", false, 3);
  return { group, triangles };
}

/** Dispose the geometries a baked group owns (materials are the scene's, shared). */
export function disposeBaked(o: THREE.Object3D): void {
  o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && !m.geometry.userData.shared) m.geometry.dispose(); });
}

/** Recolour every part under `root` toward white (pale = not recorded) or grey (faded = past and recorded). */
export function stylePaint(root: THREE.Object3D, style: { pale?: boolean; faded?: boolean }): void {
  if (!style.pale && !style.faded) return;
  const c = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  root.traverse((o) => {
    const p = o.userData?.[PAINT] as Paint | undefined;
    if (!p) return;
    c.set(p.color);
    if (style.pale) { c.lerp(white, 0.24); p.alpha = Math.min(p.alpha ?? 1, 0.93); }
    else { const g = (c.r + c.g + c.b) / 3; c.lerp(new THREE.Color(g, g, g), 0.18); }
    p.color = `#${c.getHexString()}`;
  });
}
