import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { QueenCharmKind } from "../../core/queenCharms.ts";

/**
 * The charm library: a dozen small ceramic add-ons built from primitives the
 * way `createNestSculptedProp` builds nest ornaments — torus, cone, cylinder,
 * sphere, extruded shape. No model files, no asset pipeline, no texture.
 *
 * Every charm is designed in a unit box (x, y in -0.5..0.5; z from 0, its
 * back against her surface, out to about 0.35) as a relief: a silhouette
 * first, detail second, because at charm scale a silhouette is all that
 * reads. Each kind merges into two geometries — the body, which takes the
 * charm's colour, and an ink accent (eyes, pips, a beak) — so the whole bin
 * on her is at most two draw calls per kind, instanced.
 */
export type CharmGeometry = { body: THREE.BufferGeometry; accent: THREE.BufferGeometry | null };

type Piece = { geometry: THREE.BufferGeometry; ink?: boolean };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const place = (geometry: THREE.BufferGeometry, at: { p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] | number }, ink = false): Piece => {
  const scale = typeof at.s === "number" ? V(at.s, at.s, at.s) : at.s ? V(...at.s) : V(1, 1, 1);
  const matrix = new THREE.Matrix4().compose(V(...(at.p ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(at.r ?? [0, 0, 0]))), scale);
  const shaped = geometry.index ? geometry.toNonIndexed() : geometry;
  if (shaped !== geometry) geometry.dispose();
  shaped.applyMatrix4(matrix);
  shaped.deleteAttribute("uv");
  return { geometry: shaped, ink };
};
const orb = (r: number, p: [number, number, number], s?: [number, number, number], ink = false) => place(new THREE.SphereGeometry(r, 14, 10), { p, s }, ink);
const rod = (rTop: number, rBottom: number, h: number, at: Parameters<typeof place>[1], ink = false) => place(new THREE.CylinderGeometry(rTop, rBottom, h, 14), at, ink);
const cone = (r: number, h: number, at: Parameters<typeof place>[1], ink = false) => place(new THREE.ConeGeometry(r, h, 12), at, ink);
const ring = (r: number, t: number, at: Parameters<typeof place>[1], arc = Math.PI * 2, ink = false) => place(new THREE.TorusGeometry(r, t, 8, 20, arc), at, ink);
const box = (w: number, h: number, d: number, at: Parameters<typeof place>[1], ink = false) => place(new THREE.BoxGeometry(w, h, d), at, ink);
const slab = (points: [number, number][], depth: number, at: Parameters<typeof place>[1] = {}, ink = false) => {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return place(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, steps: 1 }), at, ink);
};

const BUILDERS: Record<QueenCharmKind, () => Piece[]> = {
  "sitting-cat": () => [
    orb(0.2, [0, -0.2, 0.14], [1, 1.25, 0.8]),
    orb(0.17, [0, 0.16, 0.16]),
    cone(0.07, 0.16, { p: [-0.11, 0.33, 0.14], r: [0, 0, 0.25] }),
    cone(0.07, 0.16, { p: [0.11, 0.33, 0.14], r: [0, 0, -0.25] }),
    ring(0.15, 0.035, { p: [0.24, -0.34, 0.1], r: [0, 0, Math.PI / 2] }, Math.PI),
    orb(0.028, [-0.06, 0.18, 0.31], undefined, true),
    orb(0.028, [0.06, 0.18, 0.31], undefined, true),
  ],
  "paper-airplane": () => [
    slab([[-0.5, 0.06], [0.5, 0.0], [-0.34, -0.12]], 0.08, { p: [0, 0.02, 0.08] }),
    slab([[-0.5, -0.02], [0.5, 0.0], [-0.24, -0.3]], 0.06, { p: [0, -0.02, 0.02], r: [0.35, 0, 0] }),
  ],
  "coffee-mug": () => [
    rod(0.19, 0.16, 0.44, { p: [-0.05, 0, 0.16] }),
    ring(0.12, 0.04, { p: [0.15, 0.02, 0.16] }),
    rod(0.16, 0.16, 0.03, { p: [-0.05, 0.22, 0.16] }, true),
  ],
  teapot: () => [
    orb(0.24, [0, -0.04, 0.16], [1.1, 0.85, 0.9]),
    rod(0.06, 0.09, 0.1, { p: [0, 0.2, 0.16] }),
    orb(0.05, [0, 0.29, 0.16]),
    rod(0.035, 0.07, 0.3, { p: [0.28, 0.06, 0.16], r: [0, 0, -0.9] }),
    ring(0.13, 0.035, { p: [-0.27, 0.0, 0.16], r: [0, 0, Math.PI / 2] }, Math.PI),
  ],
  snail: () => [
    orb(0.19, [0.07, 0.05, 0.14], [1, 1, 0.75]),
    orb(0.08, [0.1, 0.06, 0.29], undefined, true),
    orb(0.1, [-0.2, -0.15, 0.1], [2.2, 0.75, 0.9]),
    rod(0.014, 0.014, 0.16, { p: [-0.36, 0.02, 0.1], r: [0, 0, 0.3] }),
    rod(0.014, 0.014, 0.16, { p: [-0.3, 0.02, 0.1], r: [0, 0, -0.1] }),
    orb(0.024, [-0.38, 0.1, 0.1], undefined, true),
    orb(0.024, [-0.29, 0.1, 0.1], undefined, true),
  ],
  mushroom: () => [
    place(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0.02, 0.14], s: [1, 0.9, 0.8] }),
    rod(0.09, 0.12, 0.34, { p: [0, -0.2, 0.14] }),
    orb(0.045, [-0.12, 0.14, 0.31], undefined, true),
    orb(0.035, [0.1, 0.19, 0.3], undefined, true),
    orb(0.03, [0.03, 0.08, 0.36], undefined, true),
  ],
  "paper-boat": () => [
    slab([[-0.5, 0.0], [0.5, 0.0], [0.34, -0.26], [-0.34, -0.26]], 0.16, { p: [0, 0.0, 0.06] }),
    slab([[-0.17, 0.0], [0.17, 0.0], [0, 0.34]], 0.12, { p: [0, -0.02, 0.1] }),
  ],
  "small-bird": () => [
    orb(0.2, [0.02, -0.06, 0.14], [1.2, 0.85, 0.85]),
    orb(0.13, [0.18, 0.14, 0.15]),
    cone(0.05, 0.14, { p: [0.34, 0.14, 0.15], r: [0, 0, -Math.PI / 2] }, true),
    slab([[-0.2, 0.0], [-0.5, 0.12], [-0.46, -0.1]], 0.1, { p: [0, -0.06, 0.1] }),
    orb(0.026, [0.2, 0.18, 0.27], undefined, true),
  ],
  bell: () => [
    place(new THREE.LatheGeometry([new THREE.Vector2(0.02, 0.32), new THREE.Vector2(0.12, 0.28), new THREE.Vector2(0.15, 0.1), new THREE.Vector2(0.2, -0.1), new THREE.Vector2(0.28, -0.24), new THREE.Vector2(0.28, -0.3), new THREE.Vector2(0.02, -0.3)], 20), { p: [0, 0.02, 0.16] }),
    orb(0.06, [0, 0.36, 0.16]),
    orb(0.07, [0, -0.3, 0.16], undefined, true),
  ],
  key: () => [
    ring(0.15, 0.06, { p: [0, 0.28, 0.1] }),
    box(0.11, 0.62, 0.11, { p: [0, -0.12, 0.1] }),
    box(0.16, 0.08, 0.11, { p: [0.12, -0.36, 0.1] }),
    box(0.12, 0.08, 0.11, { p: [0.1, -0.22, 0.1] }),
    orb(0.05, [0, 0.28, 0.1], undefined, true),
  ],
  die: () => [
    box(0.5, 0.5, 0.36, { p: [0, 0, 0.18], r: [0, 0, 0.18] }),
    orb(0.045, [0, 0, 0.37], undefined, true),
    orb(0.045, [-0.15, 0.15, 0.37], undefined, true),
    orb(0.045, [0.15, -0.15, 0.37], undefined, true),
    orb(0.045, [0.15, 0.15, 0.37], undefined, true),
    orb(0.045, [-0.15, -0.15, 0.37], undefined, true),
  ],
  spool: () => [
    rod(0.24, 0.24, 0.07, { p: [0, 0.24, 0.16] }),
    rod(0.24, 0.24, 0.07, { p: [0, -0.24, 0.16] }),
    rod(0.16, 0.16, 0.42, { p: [0, 0, 0.16] }, true),
    box(0.02, 0.5, 0.02, { p: [0.28, -0.04, 0.3], r: [0, 0, 0.12] }, true),
  ],
};

/** Build one kind: two merged, non-indexed geometries. The caller owns disposal. */
export function buildCharmGeometry(kind: QueenCharmKind): CharmGeometry {
  const pieces = BUILDERS[kind]();
  const merge = (rows: THREE.BufferGeometry[]) => {
    if (!rows.length) return null;
    const merged = mergeGeometries(rows, false);
    for (const row of rows) row.dispose();
    if (!merged) return null;
    merged.computeBoundingSphere();
    return merged;
  };
  const body = merge(pieces.filter((piece) => !piece.ink).map((piece) => piece.geometry));
  const accent = merge(pieces.filter((piece) => piece.ink).map((piece) => piece.geometry));
  if (!body) throw new Error(`charm ${kind} has no body`);
  return { body, accent };
}
