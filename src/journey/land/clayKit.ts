/**
 * A tiny clay kit (Horizon Clock, L2): the prototype's rounded box, merged vertex-painted meshes and "scatter" meshes
 * (many small toys — houses, trees, contact blobs — in ONE draw call, recoloured per theme and thinned by collapsing an
 * item's vertices onto its base). Sizes here are toy proportions in diorama units, never island coordinates.
 */
import * as THREE from "three";
import type { JourneyClayPalette } from "../contracts.ts";

/** A clay colour key of the palette (not `plinthFinish`). */
export type ClayPaint = Exclude<keyof JourneyClayPalette, "plinthFinish">;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The prototype's rounded box: a segmented box whose corners are pushed onto spheres of radius `r`. */
export function roundedBox(w: number, h: number, d: number, r: number, segments: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, segments, segments, segments);
  const p = g.getAttribute("position") as THREE.BufferAttribute, n = g.getAttribute("normal") as THREE.BufferAttribute;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd));
    o.subVectors(v, c);
    if (o.lengthSq() > 1e-10) { o.normalize(); v.copy(c).addScaledVector(o, r); p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, o.x, o.y, o.z); }
  }
  g.deleteAttribute("uv");
  return g;
}

/** One painted part of a toy template (geometry already placed in the toy's local frame). */
export type ToyPart = { geometry: THREE.BufferGeometry; paint: ClayPaint | "shadow" };
/** A toy placed on the island: local frame → diorama (position, yaw, uniform scale); `paints` remaps template paints. */
export type ToyItem = { parts: readonly ToyPart[]; at: THREE.Vector3; yaw: number; scale: number; paints?: Partial<Record<string, ClayPaint>> };

export type ScatterMesh = {
  mesh: THREE.Mesh;
  /** Item count (an item is one toy). */
  count: number;
  /** The base point of each item (diorama du). */
  bases: THREE.Vector3[];
  recolour(palette: JourneyClayPalette): void;
  /** Show only the items whose flag is true (hidden items collapse onto their base: no fragments, same buffer). */
  setShown(shown: readonly boolean[] | null): void;
  /** Move every item's base vertically (diorama du, from its built base), e.g. for Week calm. */
  setBaseY(y: readonly number[] | null): void;
  dispose(): void;
};

/**
 * Many toys as ONE indexed, vertex-painted mesh. Normals rotate with the item (uniform scale). The material is the
 * caller's (lit clay, or a transparent basic material for blobs: then `alpha` gives the per-vertex alpha).
 */
export function buildScatter(name: string, items: readonly ToyItem[], material: THREE.Material, alpha?: (part: ToyPart, vertex: number) => number): ScatterMesh {
  let vertices = 0, indices = 0;
  for (const it of items) for (const part of it.parts) {
    vertices += part.geometry.getAttribute("position").count;
    indices += part.geometry.index ? part.geometry.index.count : part.geometry.getAttribute("position").count;
  }
  const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3), colours = new Float32Array(vertices * (alpha ? 4 : 3));
  const built = new Float32Array(vertices * 3), owner = new Uint32Array(vertices), paints: (ClayPaint | "shadow")[] = new Array(vertices);
  const alphas = alpha ? new Float32Array(vertices) : null;
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  let vo = 0, io = 0;
  const bases: THREE.Vector3[] = [];
  items.forEach((it, k) => {
    q.setFromAxisAngle(up, it.yaw); s.setScalar(it.scale); m.compose(it.at, q, s); nm.getNormalMatrix(m);
    bases.push(it.at.clone());
    for (const part of it.parts) {
      const pos = part.geometry.getAttribute("position"), nor = part.geometry.getAttribute("normal"), count = pos.count;
      const paint = part.paint === "shadow" ? "shadow" : (it.paints?.[part.paint] ?? part.paint);
      for (let i = 0; i < count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        positions.set([v.x, v.y, v.z], (vo + i) * 3);
        if (nor) { v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); normals.set([v.x, v.y, v.z], (vo + i) * 3); }
        owner[vo + i] = k; paints[vo + i] = paint;
        if (alphas) alphas[vo + i] = alpha!(part, i);
      }
      if (part.geometry.index) { const src = part.geometry.index; for (let i = 0; i < src.count; i++) index[io + i] = src.getX(i) + vo; io += src.count; }
      else { for (let i = 0; i < count; i++) index[io + i] = vo + i; io += count; }
      vo += count;
    }
  });
  built.set(positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, alpha ? 4 : 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  let shown: readonly boolean[] | null = null, lift: readonly number[] | null = null;
  const place = () => {
    for (let i = 0; i < vertices; i++) {
      const k = owner[i]!, base = bases[k]!, dy = lift ? (lift[k] ?? base.y) - base.y : 0;
      if (shown && !shown[k]) positions.set([base.x, base.y + dy, base.z], i * 3);
      else { positions[i * 3] = built[i * 3]!; positions[i * 3 + 1] = built[i * 3 + 1]! + dy; positions[i * 3 + 2] = built[i * 3 + 2]!; }
    }
    (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    geometry.computeBoundingSphere();
  };
  const c = new THREE.Color(), shadow = new THREE.Color(40 / 255, 20 / 255, 30 / 255);
  return {
    mesh, count: items.length, bases,
    recolour(palette) {
      const cache = new Map<string, THREE.Color>();
      for (let i = 0; i < vertices; i++) {
        const key = paints[i]!;
        let col = cache.get(key);
        if (!col) { col = key === "shadow" ? shadow.clone() : c.set(palette[key]).clone(); cache.set(key, col); }
        if (alphas) colours.set([col.r, col.g, col.b, alphas[i]!], i * 4); else colours.set([col.r, col.g, col.b], i * 3);
      }
      (geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    },
    setShown(next) { shown = next; place(); },
    setBaseY(next) { lift = next; place(); },
    dispose() { geometry.dispose(); },
  };
}

/** A flat contact-shadow disc (fan) of radius r; alpha falls from `centre` to 0 at the rim. */
export function blobDisc(r: number, segments = 10): THREE.BufferGeometry {
  const pos = [0, 0, 0], nor = [0, 1, 0], idx: number[] = [];
  for (let i = 0; i < segments; i++) { const a = (i / segments) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); nor.push(0, 1, 0); }
  for (let i = 0; i < segments; i++) idx.push(0, 1 + ((i + 1) % segments), 1 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Concatenate indexed or non-indexed geometries (position + normal [+ any listed float attributes]) into one indexed geometry. */
export function mergeParts(parts: readonly THREE.BufferGeometry[], extra: readonly string[] = []): THREE.BufferGeometry {
  let vertices = 0, indices = 0;
  for (const g of parts) { const n = g.getAttribute("position").count; vertices += n; indices += g.index ? g.index.count : n; }
  const out = new THREE.BufferGeometry();
  const names = ["position", "normal", ...extra];
  const arrays = names.map((name) => { const size = parts[0]?.getAttribute(name)?.itemSize ?? 3; return { name, size, data: new Float32Array(vertices * size) }; });
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  let vo = 0, io = 0;
  for (const g of parts) {
    const n = g.getAttribute("position").count;
    for (const a of arrays) { const src = g.getAttribute(a.name); if (!src) continue; for (let i = 0; i < n; i++) for (let k = 0; k < a.size; k++) a.data[(vo + i) * a.size + k] = src.getComponent(i, k); }
    if (g.index) { for (let i = 0; i < g.index.count; i++) index[io + i] = g.index.getX(i) + vo; io += g.index.count; }
    else { for (let i = 0; i < n; i++) index[io + i] = vo + i; io += n; }
    vo += n;
  }
  for (const a of arrays) out.setAttribute(a.name, new THREE.BufferAttribute(a.data, a.size));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

/** Triangles and draw calls of the visible meshes / lines under `root` (a line set is one draw call, no triangles). */
export function countDraws(root: THREE.Object3D): { triangles: number; drawCalls: number } {
  let triangles = 0, drawCalls = 0;
  const visit = (node: THREE.Object3D) => {
    if (!node.visible) return;
    const drawable = node as THREE.Mesh | THREE.LineSegments;
    if ((drawable as THREE.Mesh).isMesh) {
      const g = drawable.geometry, count = g.index ? g.index.count : g.getAttribute("position").count;
      if (count > 0) { triangles += count / 3; drawCalls += 1; }
    } else if ((drawable as THREE.LineSegments).isLine) {
      if (drawable.geometry.getAttribute("position").count > 0) drawCalls += 1;
    }
    for (const child of node.children) visit(child);
  };
  visit(root);
  return { triangles: Math.round(triangles), drawCalls };
}
