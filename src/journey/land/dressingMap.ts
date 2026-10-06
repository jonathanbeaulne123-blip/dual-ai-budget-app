/**
 * The Water's Way on the Journey map (Horizon Clock clay): the neighbourhood buildings at or above the Journey height
 * (`JOURNEY_MIN_HEIGHT`, the grammar's `buildingJourneyShape` footprint, eave and roof rise carried by the index /
 * slim `dressing`) as clay blocks under a hipped roof, and every story landmark as a clay pin — a tapered shaft up to
 * its sighted top under a honey cap (the evening relay's light). DIORAMA UNITS, like the rest of the clay land: plan
 * from `ClaySurface.toX/toZ` (`dioramaFrame`), ground from `groundAt`, toy proportions in `DRESSING_TOY` (never island
 * coordinates). One scatter mesh (one draw call), painted from the theme's clay palette (`wall`, `roof1…3`, `trunk`,
 * `honey`) so a theme change recolours in place, and thinned / lifted by Week calm like the houses.
 *
 * Budget (`clay.ts` `JOURNEY_LAND_BUDGET`): landmarks always; buildings, tallest (and landmark-carrying) first, only
 * while they fit `CLAY_LAND_LOD[tier].dressingTriangles`. Lite carries no buildings (lite drops, never substitutes).
 */
import * as THREE from "three";
import type { JourneyLandData, JourneyLandDressingMap, Point2 } from "../contracts.ts";
import { buildScatter, type ClayPaint, type ScatterMesh, type ToyItem, type ToyPart } from "./clayKit.ts";
import type { ClaySurface } from "./diorama.ts";

export const DRESSING_MAP_NAME = "journey-land:dressing";

/** Toy proportions of the dressing (multiples of true size at the frame's scale, du where named). */
export const DRESSING_TOY = {
  /** Footprints drawn this many times their true plan size about their centre (rows stay apart at 1.5). */
  plan: 1.5,
  /** Heights (eave, roof, landmark) drawn this many times their true rise — the member homes' toy factor (D53). */
  height: 2.6,
  /** A landmark pin rises at least this many metres (true) so a low landmark still reads as a marker. */
  landmarkMinM: 14,
  /** Pin shaft radius at the ground and under the cap, and the cap's radius (du). */
  shaftBase: 0.014, shaftTop: 0.006, cap: 0.03,
  /** Sunk this far into the clay (du), like the toys. */
  sink: 0.02,
} as const;

/** Pin detail per tier (shaft sides, cap: icosahedron detail or an octahedron). */
const PIN = { full: { sides: 6, cap: "ico" }, lite: { sides: 4, cap: "octa" } } as const;
const ROOFS: readonly ClayPaint[] = ["roof1", "roof2", "roof3"];

/** A dressing toy's concept position, for Week calm (`landmark` pins are never thinned). */
export type DressingPlaced = { id: string; x: number; y: number; landmark: boolean };
export type ClayDressing = { scatter: ScatterMesh; placed: DressingPlaced[]; dispose(): void };

/** Triangles a building block costs: two per wall, one per hipped roof facet. */
export const buildingTriangles = (footprint: readonly Point2[]) => footprint.length * 3;

/**
 * Which buildings the map draws within `triangles`: landmark-carrying buildings first, then the tallest, ties by id
 * (stable). A building that does not fit is skipped and smaller ones may still fit.
 */
export function chooseDressingBuildings(dressing: JourneyLandDressingMap, triangles: number): JourneyLandDressingMap["buildings"] {
  const marks = new Set(dressing.landmarks.map((l) => l.id));
  const order = dressing.buildings.filter((b) => b.footprint.length >= 3).slice().sort((a, b) =>
    Number(marks.has(b.id)) - Number(marks.has(a.id)) || (b.height + b.roofHeight) - (a.height + a.roofHeight) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: JourneyLandDressingMap["buildings"] = [];
  let used = 0;
  for (const b of order) { const t = buildingTriangles(b.footprint); if (used + t > triangles) continue; used += t; out.push(b); }
  return out;
}

const hash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h / 4294967296; };

/** Non-indexed triangles with flat normals, each face wound to face away from `inside` (walls) or up (roof). */
function blockGeometry(ring: readonly [number, number][], eave: number, apex: number): { walls: THREE.BufferGeometry; roof: THREE.BufferGeometry } {
  const n = ring.length, cx = ring.reduce((s, p) => s + p[0], 0) / n, cz = ring.reduce((s, p) => s + p[1], 0) / n;
  const walls: number[] = [], roof: number[] = [];
  const push = (out: number[], a: number[], b: number[], c: number[], outward: THREE.Vector3) => {
    const e1 = new THREE.Vector3(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!), e2 = new THREE.Vector3(c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!);
    if (e1.cross(e2).dot(outward) < 0) out.push(...a, ...c, ...b); else out.push(...a, ...b, ...c);
  };
  for (let i = 0; i < n; i++) {
    const p = ring[i]!, q = ring[(i + 1) % n]!, out = new THREE.Vector3((p[0] + q[0]) / 2 - cx, 0, (p[1] + q[1]) / 2 - cz);
    push(walls, [p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], eave, q[1]], out);
    push(walls, [p[0], 0, p[1]], [q[0], eave, q[1]], [p[0], eave, p[1]], out);
    push(roof, [p[0], eave, p[1]], [q[0], eave, q[1]], [cx, apex, cz], new THREE.Vector3(out.x, Math.max(0.001, apex - eave) * 4, out.z));
  }
  const geometry = (pos: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
  return { walls: geometry(walls), roof: geometry(roof) };
}

/**
 * The clay dressing for `data.dressing` on `clay` (diorama units), or null when there is nothing to draw. The caller
 * owns adding `scatter.mesh`, recolouring it with the land's palette and disposing it.
 */
export function buildClayDressing(data: Pick<JourneyLandData, "dressing">, clay: Pick<ClaySurface, "frame" | "toX" | "toZ" | "groundAt">, tier: "full" | "lite", triangles: number, material: THREE.Material): ClayDressing | null {
  const d = data.dressing;
  if (!d || (!d.buildings.length && !d.landmarks.length)) return null;
  const s = clay.frame.scale, up = s * DRESSING_TOY.height, owned: THREE.BufferGeometry[] = [], items: ToyItem[] = [], placed: DressingPlaced[] = [];
  for (const b of tier === "full" ? chooseDressingBuildings(d, triangles) : []) {
    const ring = b.footprint, n = ring.length, cx = ring.reduce((a, p) => a + p[0], 0) / n, cy = ring.reduce((a, p) => a + p[1], 0) / n;
    const plan = ring.map((p) => [(p[0] - cx) * DRESSING_TOY.plan, (p[1] - cy) * DRESSING_TOY.plan] as [number, number]);
    // The block stands from the lowest clay under its (toy) footprint, so no wall floats on a slope.
    const ground = Math.min(clay.groundAt(cx, cy), ...plan.map((p) => clay.groundAt(cx + p[0], cy + p[1]))) - DRESSING_TOY.sink;
    const eave = DRESSING_TOY.sink + Math.max(0, b.height) * up, apex = eave + Math.max(0, b.roofHeight) * up;
    const g = blockGeometry(plan.map((p) => [p[0] * s, p[1] * s]), eave, apex);
    owned.push(g.walls, g.roof);
    const parts: ToyPart[] = [{ geometry: g.walls, paint: "wall" }, { geometry: g.roof, paint: ROOFS[Math.floor(hash01(b.id) * ROOFS.length)]! }];
    items.push({ parts, at: new THREE.Vector3(clay.toX(cx), ground, clay.toZ(cy)), yaw: 0, scale: 1 });
    placed.push({ id: b.id, x: cx, y: cy, landmark: false });
  }
  const pin = PIN[tier];
  for (const l of d.landmarks) {
    const x = l.top[0], y = l.top[2], rise = Math.max(DRESSING_TOY.landmarkMinM, l.top[1] - l.at[1]) * up + DRESSING_TOY.sink;
    const shaft = new THREE.CylinderGeometry(DRESSING_TOY.shaftTop, DRESSING_TOY.shaftBase, rise, pin.sides, 1, true);
    shaft.translate(0, rise / 2, 0);
    const cap = pin.cap === "ico" ? new THREE.IcosahedronGeometry(DRESSING_TOY.cap, 0) : new THREE.OctahedronGeometry(DRESSING_TOY.cap, 0);
    cap.translate(0, rise + DRESSING_TOY.cap * 0.6, 0);
    for (const g of [shaft, cap]) if (g.getAttribute("uv")) g.deleteAttribute("uv");
    owned.push(shaft, cap);
    items.push({ parts: [{ geometry: shaft, paint: "trunk" }, { geometry: cap, paint: "honey" }], at: new THREE.Vector3(clay.toX(x), clay.groundAt(x, y) - DRESSING_TOY.sink, clay.toZ(y)), yaw: 0, scale: 1 });
    placed.push({ id: l.id, x, y, landmark: true });
  }
  const scatter = buildScatter(DRESSING_MAP_NAME, items, material);
  return { scatter, placed, dispose() { scatter.dispose(); for (const g of owned) g.dispose(); } };
}
