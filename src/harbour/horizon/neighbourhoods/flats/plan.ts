/**
 * The Flats & the Bight (story place 6, golden hour → night): the plan's fixed decisions, read by the module (index.ts), its
 * planting (planting.ts) and its tests. Every position is read from its one definition — MANIFEST (the strip, the windsock
 * footing, the balloon mooring, the stargazing pad, the Wash Arch and the hoodoo footings, the Bight Shore plots), the airport
 * layout (the hybrid's walk and collision contract) or the story registry (the elevator) — and only the dressing's own choices
 * are numbers here. Pure data and geometry; no scene imports.
 *
 * Sources: protos/flats SPEC.md (the hybrid: A's elevator, Quonset and station; C's geoglyph and stargazing deck; B's arch and a
 * small hoodoo cluster), STYLE §2.4 as amended 2026-10-05, RULINGS 3/4, BRIEF-NEIGHBOURHOODS.
 */
import type { Point2 } from '../../world/definition.ts';
import { HORIZON_MANIFEST as M } from '../../world/manifest.ts';
import { storyLandmark } from '../../world/story.ts';
import { AIRPORT_BOXES, AIRPORT_DECKS, deckAt } from '../../airport/layout.ts';
import { stripClearanceBreach, stripLocal } from '../../land/structures/westLand.ts';

export { stripClearanceBreach, stripLocal };

/** The strip (MANIFEST structures.strip): north threshold `a`, south `b`, unit vector along. */
const STRIP = M.structures.strip as unknown as { from: [number, number]; to: [number, number]; width_m: number; windsock: [number, number]; balloonMooring: [number, number] };
export const STRIP_A = STRIP.from, STRIP_B = STRIP.to;
export const STRIP_LENGTH = Math.hypot(STRIP_B[0] - STRIP_A[0], STRIP_B[1] - STRIP_A[1]);
export const STRIP_U: Point2 = [(STRIP_B[0] - STRIP_A[0]) / STRIP_LENGTH, (STRIP_B[1] - STRIP_A[1]) / STRIP_LENGTH];
/** Plan point at strip-local (s along from the north threshold, o offset + east). */
export const stripPoint = (s: number, o: number): Point2 => [STRIP_A[0] + STRIP_U[0] * s + STRIP_U[1] * o, STRIP_A[1] + STRIP_U[1] * s - STRIP_U[0] * o];

/* ------------------------------------------------------------------ the landmark: the grain elevator */

/**
 * On the airport tower's footprint (the story's `elevator`, RULINGS: base [395, 35.5, 706], top 63.5). The building kit's
 * `elevator` rises to h + 0.3 + headH + head-house gable (40°) + beacon 1.55 + 0.6: with a 9.6 square bin and headH 3.6 the
 * bin's eave is 19.13 above the floor, the beacon cap 28.0. The 9.6 square encloses the airport tower's boxes (base 5 × 5,
 * cabin 8 × 8, cap 9 × 9 to 49.4), whose collision stays as it is inside the elevator's own. Door and front face the strip.
 */
const E = storyLandmark('elevator');
export const ELEVATOR = { at: [E.at[0], E.at[1], E.at[2]] as [number, number, number], top: E.top[1], size: { w: 9.6, d: 9.6, h: 19.13 }, headH: 3.6, yaw: Math.PI / 2 } as const;

/* ------------------------------------------------------------------ fixed places */

export const WINDSOCK: Point2 = STRIP.windsock;
export const BALLOON: Point2 = (M.sky as unknown as { balloon: { xy: Point2 } }).balloon.xy;
export const STARGAZING = M.structures.stargazing as unknown as { xy: Point2; h: number; size_m: Point2; deck: { xy: Point2; size_m: Point2; top: number }; observatory: { xy: Point2; size_m: Point2; top: number } };
export const WASH_ARCH = M.structures.washArch as unknown as { at: Point2; legOffset_m: number; legRadius_m: number[]; lean_m: number; lintel: { underside: number; thickness_m: number; width_m: number }; clear_eu: number };
export const WASH_HOODOOS = M.structures.washHoodoos as unknown as { xy: Point2[]; footing_m: number; rise_m: number };
/** The Bight Shore reserve plots (MANIFEST reserves.bightShore): centre, rotation (degrees, the pad's), size. */
const BS = M.reserves.bightShore as unknown as { plots: Point2[]; rot_deg: number[]; size_m: Point2; placeIds: string[] };
export const BIGHT_PLOTS = BS.plots.map((c, i) => ({ id: BS.placeIds[i]!, centre: c, rot: (BS.rot_deg[i]! * Math.PI) / 180, size: BS.size_m }));
/** A plot's local (u across its first size axis, v along its second) to world plan, the pad frame of neighbourhoods/bake.ts onPad. */
export function plotPoint(p: (typeof BIGHT_PLOTS)[number], u: number, v: number): Point2 {
  const c = Math.cos(p.rot), s = Math.sin(p.rot); return [p.centre[0] + u * c - v * s, p.centre[1] + u * s + v * c];
}
/** The hangar bay's reserve (MANIFEST reserves small.hangarBay, the baked plot.flats.1 pad 11 × 18 at [458.2, 600]). */
export const HANGAR_BAY = { centre: [458.2, 600] as Point2, size: [11, 18] as Point2 };
/** The porch: the hangar's bench by the hangar bay, watching the take-offs and the Bight Bridge's arch over the rim (D-WW86). */
export const PORCH_BENCH: Point2 = [449.5, 616.5];
export const BIGHT_BRIDGE_ARCH: Point2 = [561, 1099];
/** The one wind-shaped pine, by THE hangar (the Quonset) in its lee: north-west of its closed west end. */
export const PINE: Point2 = [376.5, 566];
/** The chalk bush-plane geoglyph: on the north approach's centreline, nose toward the threshold (flat ≤ 0.2; RULINGS 4: no letters). */
export const GEOGLYPH = { s: -78, half: [32, 20.5] as Point2 };
/** The Flats' landform (MANIFEST landforms.flats): the tree-cover and open-ground figures are measured over it. */
export const FLATS_LANDFORM = (M.landforms as unknown as { id: string; poly: Point2[] }[]).find(l => l.id === 'flats')!.poly;
/** The Wash's paint band (protos/flats §7 polygon, the prototype's mask). */
export const WASH_BAND: Point2[] = [[474.53, 559.41], [459.5, 700.11], [479.66, 801.33], [509.73, 901.58], [520.27, 898.42], [490.34, 798.67], [470.5, 699.89], [485.47, 560.59]];
/** STYLE §1.9: the thermal hawks mark (MANIFEST sky.lift.thermals[0]). */
export const THERMAL = (M.sky as unknown as { lift: { thermals: { xy: Point2; r: number; hours: [number, number] }[] } }).lift.thermals[0]!;

/** Nominal crown radius (eu, at scale 1) for the tree-cover figure (the plant kit's crowns are drawn within these). */
export const CROWN_RADIUS: Partial<Record<string, number>> = { juniper: 1.5, cedar: 2.2, pine: 2.8, spruce: 2.3, balsam: 2.1 };

/* ------------------------------------------------------------------ clearings and keep-outs */

/** Inside (or within `margin` of) the airport campus: any box or deck of the airport layout (runtime geometry, not baked). */
export function inAirport(x: number, z: number, margin = 0): boolean {
  for (const b of AIRPORT_BOXES) if (Math.abs(x - b.x) <= b.w / 2 + margin && Math.abs(z - b.z) <= b.d / 2 + margin) return true;
  for (const d of AIRPORT_DECKS) if (deckAt({ ...d, width: d.width + 2 * margin }, x, z)) return true;
  return false;
}
/** The elevator's plan (bin + annex + spout) with a margin. */
export function inElevator(x: number, z: number, margin = 0): boolean {
  return Math.abs(x - ELEVATOR.at[0]) <= 7.5 + margin && Math.abs(z - (ELEVATOR.at[2] + 2)) <= 10 + margin;
}
/** The geoglyph's plan rectangle (its local frame) grown by `margin`. */
export function geoglyphCentre(): Point2 { return stripPoint(GEOGLYPH.s, 0); }
export const GEOGLYPH_YAW = Math.atan2(STRIP_U[0], STRIP_U[1]);
export function inGeoglyph(x: number, z: number, margin = 0): boolean {
  const c = geoglyphCentre(), dx = x - c[0], dz = z - c[1], cy = Math.cos(GEOGLYPH_YAW), sy = Math.sin(GEOGLYPH_YAW);
  const u = dx * cy - dz * sy, v = dx * sy + dz * cy;
  return Math.abs(u) <= GEOGLYPH.half[0] + margin && v >= -GEOGLYPH.half[1] + 2 - margin && v <= GEOGLYPH.half[1] + margin;
}
/** Anything over 1 m (`r` its plan radius) breaks the strip's approach or side clearance (MANIFEST strip.clearances; D-WW81). */
export const breaksStrip = (x: number, z: number, r = 0) => stripClearanceBreach(x, z, r) !== null;

/* ------------------------------------------------------------------ small geometry */

export function pointInPoly(x: number, z: number, poly: readonly Point2[]): boolean {
  let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k;
}
export function polyArea(poly: readonly Point2[]): number { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
/** The nearest point on a polyline (plan) to (x, z): the point (with its y), the segment's unit direction and the distance. */
export function nearestOn(points: readonly (readonly [number, number, number])[], x: number, z: number): { at: [number, number, number]; dir: Point2; d: number } {
  let best = { at: [points[0]![0], points[0]![1], points[0]![2]] as [number, number, number], dir: [1, 0] as Point2, d: Infinity };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / L2));
    const p: [number, number, number] = [a[0] + dx * t, a[1] + (b[1] - a[1]) * t, a[2] + dz * t], d = Math.hypot(p[0] - x, p[2] - z), L = Math.sqrt(L2);
    if (d < best.d) best = { at: p, dir: [dx / L, dz / L], d };
  }
  return best;
}
/** Deterministic value noise and its fbm (no Math.random): drifts follow it. */
const h2 = (i: number, j: number) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x: number, z: number): number {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = h2(i, j), b = h2(i + 1, j), c = h2(i, j + 1), d = h2(i + 1, j + 1);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}
export function fbm(x: number, z: number): number { return vnoise(x, z) * 0.6 + vnoise(x * 2.03 + 17, z * 2.03 - 9) * 0.3 + vnoise(x * 4.1 - 5, z * 4.1 + 23) * 0.1; }
/** Yaw (contract frame) whose local +z points from `from` toward `to`. */
export const yawToward = (from: Point2, to: Point2) => Math.atan2(to[0] - from[0], to[1] - from[1]);
