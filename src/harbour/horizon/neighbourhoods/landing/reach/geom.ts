/**
 * The Reach and the Greenway (STORY place 3): plan geometry shared by the Reach dressing — frames, distances, a deterministic
 * noise, the marsh's signed water-edge field, sightline keep-outs. Pure; reads only the `DressingContext` and the MANIFEST
 * (through the land's own pure line builders).
 */
import type { DressingContext } from '../../types.ts';

export type XY = [number, number];
export type XYZ = [number, number, number];

/** Yaw (contract frame: local +z → (sin yaw, cos yaw)) that faces from `a` toward `b`. */
export const yawTo = (a: readonly number[], b: readonly number[]) => Math.atan2(b[0]! - a[0]!, b[1]! - a[1]!);
/** A frame at `at` facing `yaw`: u across (right of the facing), v forward (the prototype's W(u, v)). */
export function frame(at: readonly number[], yaw: number) {
  const f: XY = [Math.sin(yaw), Math.cos(yaw)], r: XY = [Math.cos(yaw), -Math.sin(yaw)];
  return { f, r, yaw, W: (u: number, v: number): XY => [at[0]! + r[0] * u + f[0] * v, at[1]! + r[1] * u + f[1] * v] };
}
export function segDist(x: number, z: number, a: readonly number[], b: readonly number[]): { d: number; t: number } {
  const dx = b[0]! - a[0]!, dz = b[1]! - a[1]!, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]!) * dx + (z - a[1]!) * dz) / l2));
  return { d: Math.hypot(a[0]! + dx * t - x, a[1]! + dz * t - z), t };
}
/** Distance to a polyline and the arc length of the nearest point. */
export function polyDist(x: number, z: number, pts: readonly (readonly number[])[]): { d: number; s: number } {
  let best = Infinity, bs = 0, acc = 0;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!, l = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!), q = segDist(x, z, a, b); if (q.d < best) { best = q.d; bs = acc + q.t * l; } acc += l; }
  return { d: best, s: bs };
}
export function inPoly(x: number, z: number, poly: readonly (readonly number[])[]): boolean {
  let hit = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if ((a[1]! > z) !== (b[1]! > z) && x < (b[0]! - a[0]!) * (z - a[1]!) / (b[1]! - a[1]!) + a[0]!) hit = !hit; }
  return hit;
}
export function polyEdgeDist(x: number, z: number, poly: readonly (readonly number[])[]): number { return polyDist(x, z, [...poly, poly[0]!]).d; }

/** Deterministic value noise in [−1, 1] (two octaves), the prototypes' `fbm` patchiness mask. */
function hash2(i: number, j: number): number { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x: number, z: number): number {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}
export const fbm = (x: number, z: number) => vnoise(x, z) * 0.65 + vnoise(x * 2.03 + 17.1, z * 2.03 - 9.4) * 0.35;
export const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * The marsh's signed water edge on a 1 eu grid: negative inside fresh water (the Reach's river and channels, the spring, the
 * Greenway's scraped pools — any water whose level stands over `FRESH_LEVEL`), positive outside, the distance (eu) to the
 * nearest edge (a two-pass chamfer transform). The sea and the lagoon are not marsh water (their level is the sea's).
 * Cells outside `want` are never sampled (dry).
 */
export const FRESH_LEVEL = 0.6;
export class WaterEdge {
  readonly x0: number; readonly z0: number; readonly nx: number; readonly nz: number;
  private readonly sd: Float32Array; private readonly lvl: Float32Array;
  constructor(ctx: DressingContext, box: [number, number, number, number], want: (x: number, z: number) => boolean) {
    this.x0 = Math.floor(box[0]); this.z0 = Math.floor(box[2]); this.nx = Math.ceil(box[1]) - this.x0 + 1; this.nz = Math.ceil(box[3]) - this.z0 + 1;
    const n = this.nx * this.nz, wet = new Uint8Array(n); this.lvl = new Float32Array(n).fill(NaN);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const x = this.x0 + i, z = this.z0 + j; if (!want(x, z)) continue;
      const l = ctx.waterLevelAt(x, z); if (l !== null && l > FRESH_LEVEL) { wet[j * this.nx + i] = 1; this.lvl[j * this.nx + i] = l; }
    }
    const out = this.dt(wet, 1), inn = this.dt(wet, 0); this.sd = new Float32Array(n);
    for (let k = 0; k < n; k++) this.sd[k] = wet[k] ? -inn[k]! : out[k]!;
  }
  /** Distance to the nearest cell whose wet flag is `src`. */
  private dt(wet: Uint8Array, src: number): Float32Array {
    const { nx, nz } = this, d = new Float32Array(nx * nz).fill(1e6), D = 1, E = Math.SQRT2;
    for (let k = 0; k < d.length; k++) if (wet[k] === src) d[k] = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let v = d[k]!;
      if (i > 0) v = Math.min(v, d[k - 1]! + D); if (j > 0) { v = Math.min(v, d[k - nx]! + D); if (i > 0) v = Math.min(v, d[k - nx - 1]! + E); if (i < nx - 1) v = Math.min(v, d[k - nx + 1]! + E); } d[k] = v; }
    for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let v = d[k]!;
      if (i < nx - 1) v = Math.min(v, d[k + 1]! + D); if (j < nz - 1) { v = Math.min(v, d[k + nx]! + D); if (i < nx - 1) v = Math.min(v, d[k + nx + 1]! + E); if (i > 0) v = Math.min(v, d[k + nx - 1]! + E); } d[k] = v; }
    // A cell's edge lies half a cell from its centre.
    for (let k = 0; k < d.length; k++) if (d[k]! > 0 && d[k]! < 1e6) d[k] = d[k]! - 0.5;
    return d;
  }
  /** Signed distance (eu) to the fresh-water edge at (x, z); +Infinity-ish (1e6) off the grid. */
  at(x: number, z: number): number {
    const i = Math.round(x - this.x0), j = Math.round(z - this.z0);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return 1e6;
    return this.sd[j * this.nx + i]!;
  }
  /** Connected bodies of fresh water on the grid (4-neighbour), each with its centroid, equal-area radius and mean level. */
  bodies(): { c: XY; r: number; level: number; cells: number }[] {
    const { nx, nz } = this, seen = new Uint8Array(nx * nz), out: { c: XY; r: number; level: number; cells: number }[] = [];
    for (let k0 = 0; k0 < nx * nz; k0++) {
      if (seen[k0] || !(this.sd[k0]! < 0)) continue;
      let n = 0, sx = 0, sz = 0, sl = 0; const stack = [k0]; seen[k0] = 1;
      while (stack.length) { const k = stack.pop()!, i = k % nx, j = (k - i) / nx; n++; sx += i; sz += j; sl += this.lvl[k]!;
        for (const q of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < nz - 1 ? k + nx : -1]) if (q >= 0 && !seen[q] && this.sd[q]! < 0) { seen[q] = 1; stack.push(q); } }
      out.push({ c: [this.x0 + sx / n, this.z0 + sz / n], r: Math.sqrt(n / Math.PI), level: sl / n, cells: n });
    }
    return out;
  }
  /** The fresh water's level at the nearest wet cell (NaN when dry there). */
  level(x: number, z: number): number {
    const i = Math.round(x - this.x0), j = Math.round(z - this.z0);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return NaN;
    return this.lvl[j * this.nx + i]!;
  }
}

/**
 * A sightline the planting keeps clear (STORY sight chain, the lookouts' binocular lines, page I): from `eye` to `aim`, a
 * plant (top `top`, crown radius `r`) within `r + pad` of the line in plan must stand ≥ `clear` under it.
 */
export interface Sightline { id: string; eye: XYZ; aim: XYZ; pad: number; clear: number; from?: number }
export function blocksSight(lines: readonly Sightline[], x: number, z: number, top: number, r: number): string | null {
  for (const l of lines) {
    const a: XY = [l.eye[0], l.eye[2]], b: XY = [l.aim[0], l.aim[2]], q = segDist(x, z, a, b), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (q.d > r + l.pad || q.t * len < (l.from ?? 0)) continue;
    const y = l.eye[1] + (l.aim[1] - l.eye[1]) * q.t;
    if (top > y - l.clear) return l.id;
  }
  return null;
}
/** A view corridor (the prototype's `corr`: width w0 + k·s from `start` m along it): planting taller than `maxH` stays out. */
export interface Corridor { from: XY; to: XY; w0: number; k: number; start: number; maxH: number; end?: number }
export function inCorridor(cs: readonly Corridor[], x: number, z: number, h: number): boolean {
  for (const c of cs) {
    if (h <= c.maxH) continue;
    const q = segDist(x, z, c.from, c.to), s = q.t * Math.hypot(c.to[0] - c.from[0], c.to[1] - c.from[1]);
    if (s > c.start && (c.end === undefined || s < c.end) && q.d < c.w0 + c.k * s) return true;
  }
  return false;
}
