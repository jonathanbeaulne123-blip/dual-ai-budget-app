/**
 * Little Harbour's row-house solver (protos/harbour `place.py`, final; SPEC §1), ported to run on the bake's own world
 * (`DressingContext`): narrow row houses packed along every real frontage of the town, deterministic, no randomness.
 *
 * Frontages, in priority order: the square's south, east and north edges, the upper street's west and east edges, the
 * quay's north edge, the storefront lane's south edge (the town tiers' pads, `land/town/build.ts TOWN_TIERS`), then the
 * town's beds in the bake's order (`town quay`, the links, the storefront walk, Town Weave `S3` as built in 3B, the walk
 * square, the homestead lane, the upper-street walk, both host approaches).
 *
 * Packing (per frontage, both sides): walk the polyline by arc length; at each station try widths 8, 7, 6.2, 5.5 (a chord
 * shorter than 0.9 × width is too curved for a straight front) and depths 9, 8, 7; the façade stands 1.3 eu beyond the
 * frontage's edge, facing it. The first valid footprint wins and the walk advances by its width + 0.25 (a party gap);
 * otherwise by 1 eu.
 *
 * A footprint is valid when every sample (a 5 × 5 grid over it, corners included, and its perimeter every 0.5 eu):
 *  - is inside the town and on dry ground (≥ 1.5);
 *  - stays out of page L's clearing (plan.ts `PAGE_L_WEDGE`, eaves included);
 *  - is outside page A's dam corridor (MANIFEST `views[A].damLine`, 14 eu either side) with 1 eu to spare (the eave's 0.75 overhang);
 *  - clears every bed by ≥ 1.0 eu beyond its half width; touches no pad (grown 0.8), water or baked solid (grown 0.3);
 * its ground varies by ≤ 6 eu (the plinth takes the slope), and it does not overlap a placed footprint shrunk by 0.12
 * (neighbours touch: row houses). Floors are the ground at the façade line, to the quarter metre.
 */
import type { Point2 } from '../../world/definition.ts';
import type { DressingContext } from '../types.ts';
import { pointInPolygon } from '../../world/geometry.ts';
import { PAGE_L_WEDGE, TOWN, damAcross, DAM_LINE, tier, type TierId } from './plan.ts';

export interface Frontage { name: string; points: readonly Point2[]; half: number }
export interface Footprint { cx: number; cz: number; w: number; d: number; yaw: number }
export interface Slot extends Footprint { id: string; floor: number; front: string; tier: 1 | 2 | 3 | 4 }
export interface SolverOptions { widths?: readonly number[]; depths?: readonly number[]; setback?: number; reserved?: readonly Footprint[] }

export const SOLVER = { widths: [8, 7, 6.2, 5.5], depths: [9, 8, 7], setback: 1.3, gap: 0.25, step: 1, bedClear: 1.0, padGrow: 0.8, solidGrow: 0.3, dry: 1.5, maxRelief: 6, damSpare: 1.0, shrink: 0.12 } as const;
/** Beds that are town frontages, in the bake's order (SPEC §1). */
export const FRONTAGE_BEDS = ['town quay', 'town.quayLink', 'town.storefront', 'town.bankLink', 'town.northLink', 'town.riverLink', 'S3', 'walk square',
  'homestead.lane', 'town.upperStreetWalk', 'host.home.approach', 'host.bank.approach'] as const;

/** The footprint's corners (local ±w/2, ±d/2 turned by yaw; the contract frame), grown by `pad`. */
export function corners(f: Footprint, pad = 0): Point2[] {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), hx = f.w / 2 + pad, hz = f.d / 2 + pad;
  return ([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const).map(([u, v]) => [f.cx + u * c + v * s, f.cz - u * s + v * c] as Point2);
}
function grid(f: Footprint, n = 5): Point2[] {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), out: Point2[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const u = (i / (n - 1) - 0.5) * f.w, v = (j / (n - 1) - 0.5) * f.d; out.push([f.cx + u * c + v * s, f.cz - u * s + v * c]); }
  return out;
}
function perimeter(f: Footprint, step = 0.5): Point2[] {
  const k = corners(f), out: Point2[] = [];
  for (let i = 0; i < 4; i++) { const a = k[i]!, b = k[(i + 1) % 4]!, n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let j = 0; j < n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
  return out;
}
/** Separating-axis overlap of two convex quads. */
export function overlaps(A: readonly Point2[], B: readonly Point2[]): boolean {
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const a = P[i]!, b = P[(i + 1) % 4]!, nx = b[1] - a[1], nz = a[0] - b[0];
    const pa = A.map(p => nx * p[0] + nz * p[1]), pb = B.map(p => nx * p[0] + nz * p[1]);
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}

/** Whether two convex polygons meet (separating axes over both polygons' edges). */
export function polygonsMeet(A: readonly Point2[], B: readonly Point2[]): boolean {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const a = P[i]!, b = P[(i + 1) % P.length]!, nx = b[1] - a[1], nz = a[0] - b[0];
    const pa = A.map(p => nx * p[0] + nz * p[1]), pb = B.map(p => nx * p[0] + nz * p[1]);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

/** The pad-edge and bed frontages of the town, in priority order. */
export function frontages(ctx: DressingContext): Frontage[] {
  const edge = (id: TierId, side: 'N' | 'S' | 'E' | 'W'): Point2[] => { const t = tier(id); return side === 'N' ? [[t.x0, t.z0], [t.x1, t.z0]] : side === 'S' ? [[t.x0, t.z1], [t.x1, t.z1]] : side === 'W' ? [[t.x0, t.z0], [t.x0, t.z1]] : [[t.x1, t.z0], [t.x1, t.z1]]; };
  const out: Frontage[] = [
    { name: 'square-S', points: edge('square', 'S'), half: 0 }, { name: 'square-E', points: edge('square', 'E'), half: 0 }, { name: 'square-N', points: edge('square', 'N'), half: 0 },
    { name: 'upper-W', points: edge('upperStreet', 'W'), half: 0 }, { name: 'upper-E', points: edge('upperStreet', 'E'), half: 0 },
    { name: 'quay-N', points: edge('quay', 'N'), half: 0 }, { name: 'lane-S', points: edge('storefrontLane', 'S'), half: 0 },
  ];
  const wanted = new Set<string>(FRONTAGE_BEDS);
  for (const b of ctx.beds) if (wanted.has(b.id)) out.push({ name: b.id, points: b.points.map(p => [p[0], p[2]] as Point2), half: (b.width ?? 0) / 2 });
  return out;
}

/** Arc-length resampling of a polyline (0.5 eu) and a point at arc length s. */
function resample(P: readonly Point2[], step = 0.5): { Q: Point2[]; A: number[] } {
  const Q: Point2[] = [P[0]!], A = [0];
  for (let i = 0; i < P.length - 1; i++) { const a = P[i]!, b = P[i + 1]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(L / step)); for (let k = 1; k <= n; k++) { Q.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); A.push(A[A.length - 1]! + L / n); } }
  return { Q, A };
}
function at(Q: readonly Point2[], A: readonly number[], s: number): Point2 {
  let lo = 0, hi = A.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m]! < s) lo = m + 1; else hi = m; }
  const i = Math.min(Math.max(lo, 1), A.length - 1), t = (s - A[i - 1]!) / ((A[i]! - A[i - 1]!) || 1);
  return [Q[i - 1]![0] + (Q[i]![0] - Q[i - 1]![0]) * t, Q[i - 1]![1] + (Q[i]![1] - Q[i - 1]![1]) * t];
}

export type Reject = 'land' | 'dam' | 'page' | 'relief' | 'bed' | 'occupied' | 'overlap' | null;
/** The footprint test (see the header); `placed` are shrunk corner quads of what already stands. */
export function footprintProblem(ctx: DressingContext, f: Footprint, placed: readonly Point2[][]): Reject {
  const me = corners(f, -SOLVER.shrink);
  for (const o of placed) if (overlaps(me, o)) return 'overlap';
  if (polygonsMeet(corners(f, 0.75), PAGE_L_WEDGE)) return 'page';
  const g = grid(f); let lo = Infinity, hi = -Infinity;
  for (const [x, z] of g) {
    if (!pointInPolygon(x, z, TOWN as Point2[])) return 'land';
    const h = ctx.heightAt(x, z); if (!(h >= SOLVER.dry) || ctx.waterLevelAt(x, z) !== null) return 'land';
    if (damAcross(x, z) <= DAM_LINE.halfWidth + SOLVER.damSpare) return 'dam';
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  if (hi - lo > SOLVER.maxRelief) return 'relief';
  const pts = [...g, ...perimeter(f)];
  for (const [x, z] of pts) if (ctx.bedClearance(x, z) < SOLVER.bedClear) return 'bed';
  for (const [x, z] of perimeter(f)) if (damAcross(x, z) <= DAM_LINE.halfWidth + SOLVER.damSpare) return 'dam';
  for (const [x, z] of pts) if (ctx.occupied(x, z, SOLVER.solidGrow) || (ctx.onPad?.(x, z, SOLVER.padGrow) ?? null) !== null) return 'occupied';
  return null;
}

const tierOf = (floor: number): Slot['tier'] => (floor >= 16 ? 1 : floor >= 11 ? 2 : floor >= 6 ? 3 : 4);
const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-');

/** Pack every frontage (SPEC §1). Deterministic: same world → same slots in the same order. */
export function solveRowHouses(ctx: DressingContext, o: SolverOptions = {}): Slot[] {
  const widths = o.widths ?? SOLVER.widths, depths = o.depths ?? SOLVER.depths, setback = o.setback ?? SOLVER.setback;
  const placed: Point2[][] = (o.reserved ?? []).map(f => corners(f, -SOLVER.shrink)), out: Slot[] = [];
  for (const fr of frontages(ctx)) {
    const { Q, A } = resample(fr.points), L = A[A.length - 1]!;
    let n = 0;
    for (const side of [1, -1]) {
      let s = 0;
      while (s < L - 5) {
        let ok = false, used = 0;
        for (const w of widths) {
          if (s + w > L) continue;
          const a = at(Q, A, s), b = at(Q, A, s + w), ch = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (ch < w * 0.9) continue;
          const ux = (b[0] - a[0]) / ch, uz = (b[1] - a[1]) / ch, nx = -uz * side, nz = ux * side, yaw = Math.atan2(-nx, -nz), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
          for (const d of depths) {
            const off = fr.half + setback + d / 2, f: Footprint = { cx: mx + nx * off, cz: mz + nz * off, w, d, yaw };
            if (footprintProblem(ctx, f, placed) !== null) continue;
            const fx = mx + nx * (fr.half + setback), fz = mz + nz * (fr.half + setback), floor = Math.round(ctx.heightAt(fx, fz) * 4) / 4;
            out.push({ ...f, id: `row.${slug(fr.name)}.${n}`, floor, front: fr.name, tier: tierOf(floor) });
            placed.push(corners(f, -SOLVER.shrink)); n++; ok = true; used = w; break;
          }
          if (ok) break;
        }
        s += ok ? used + SOLVER.gap : SOLVER.step;
      }
    }
  }
  return out;
}
