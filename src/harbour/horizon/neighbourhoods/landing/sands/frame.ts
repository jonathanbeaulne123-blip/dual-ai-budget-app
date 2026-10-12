/**
 * Long Sands (STORY place 5, STYLE §2.5 Direction B): the shared geometry every Long Sands solver reads (horizon-create
 * rule 1: one definition). Everything is derived from the bake-time world the module is handed (`DressingContext`):
 * the promenade and the Strand are the land pass's beds (`walk promenade`, `walk strand`, D-WW76), Horizon Drive is `V01`,
 * the shore is the ground's 0.3 contour, the pier is `structure.longSandsPier` (D-WW74).
 *
 * Frame: x east, z south (the sea is +z), y up. Along the promenade, `frameAt(x)` gives the centre point, the unit
 * tangent (x increasing) and the SEAWARD normal n (n.z > 0); offsets are measured along n (+ seaward, − inland).
 * `yaw` turns a record's local +z (its front) to face the sea: local z = (sin yaw, cos yaw) = n.
 */
import type { Point2, Point3 } from '../../../world/definition.ts';
import type { DressingContext } from '../../types.ts';

export type Frame = { x: number; z: number; y: number; tx: number; tz: number; nx: number; nz: number; yaw: number };

/** A polyline that is a function of x (the promenade, the Drive's Long Sands stretch): z, y and the frame at any x. */
export type XLine = { x0: number; x1: number; zAt(x: number): number; yAt(x: number): number; frameAt(x: number): Frame; at(x: number, offset: number): Point2 };

export function xLine(points: readonly Point3[]): XLine {
  const pts = [...points].sort((a, b) => a[0] - b[0]).filter((p, i, a) => i === 0 || p[0] - a[i - 1]![0] > 1e-6);
  if (pts.length < 2) throw new Error('Long Sands: a line needs two points');
  const seg = (x: number) => { let i = 1; while (i < pts.length - 1 && pts[i]![0] < x) i++; return i; };
  const lerp = (x: number, k: 1 | 2) => { const i = seg(x), a = pts[i - 1]!, b = pts[i]!, t = (x - a[0]) / (b[0] - a[0]); return a[k] + (b[k] - a[k]) * t; };
  const zAt = (x: number) => lerp(x, 2), yAt = (x: number) => lerp(x, 1);
  const frameAt = (x: number): Frame => {
    const dx = 2, za = zAt(x - dx), zb = zAt(x + dx), l = Math.hypot(2 * dx, zb - za), tx = 2 * dx / l, tz = (zb - za) / l;
    const nx = -tz, nz = tx; // seaward: tx > 0 ⇒ n.z > 0
    return { x, z: zAt(x), y: yAt(x), tx, tz, nx, nz, yaw: Math.atan2(nx, nz) };
  };
  return { x0: pts[0]![0], x1: pts[pts.length - 1]![0], zAt, yAt, frameAt, at: (x, o) => { const f = frameAt(x); return [f.x + f.nx * o, f.z + f.nz * o]; } };
}

/** The bed `id` from the context (one definition: the land pass's own polyline). */
export function bedLine(ctx: DressingContext, id: string): { points: readonly Point3[]; width: number } {
  const b = ctx.beds.find(q => q.id === id);
  if (!b) throw new Error(`Long Sands: the world has no bed ${id}`);
  return { points: b.points, width: b.width ?? 0 };
}

/** Local (along the frame's tangent, across along n) to world plan. */
export const onFrame = (f: Frame, along: number, across: number): Point2 => [f.x + f.tx * along + f.nx * across, f.z + f.tz * along + f.nz * across];

/** The rectangle (centre, half sizes along local x and z, yaw in the contract's frame) as world corners. */
export function rectCorners(cx: number, cz: number, hx: number, hz: number, yaw: number): Point2[] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return ([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const).map(([lx, lz]) => [cx + lx * c + lz * s, cz + lz * c - lx * s] as Point2);
}
/** Points on and inside a rectangle every `step` eu (edges and a coarse interior), for occupancy checks. */
export function rectSamples(cx: number, cz: number, hx: number, hz: number, yaw: number, step = 1): Point2[] {
  const c = Math.cos(yaw), s = Math.sin(yaw), out: Point2[] = [], nx = Math.max(1, Math.ceil(2 * hx / step)), nz = Math.max(1, Math.ceil(2 * hz / step));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) { const lx = -hx + 2 * hx * i / nx, lz = -hz + 2 * hz * j / nz; out.push([cx + lx * c + lz * s, cz + lz * c - lx * s]); }
  return out;
}

/** Ground slope (rise per eu) at (x, z), central differences over ±1 eu. */
export function slopeAt(ctx: DressingContext, x: number, z: number): number {
  const h = ctx.heightAt;
  return Math.hypot((h(x + 1, z) - h(x - 1, z)) / 2, (h(x, z + 1) - h(x, z - 1)) / 2);
}

/**
 * The shore: the first point south of `fromZ` (in 0.5 eu steps) where the ground falls to `level` (0.3 = the wet line,
 * 0.25 = the high-water wrack line), or `fromZ + 160` when none.
 */
export function shoreZ(ctx: DressingContext, x: number, fromZ: number, level = 0.3): number {
  for (let z = fromZ; z < fromZ + 160; z += 0.5) if (ctx.heightAt(x, z) <= level) return z;
  return fromZ + 160;
}

/** Deterministic picks from a seeded stream. */
export const between = (r: () => number, a: number, b: number) => a + (b - a) * r();
export const pickOf = <T>(r: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(r() * list.length))]!;
/** Round to 1/1000 eu: baked records stay short and identical on every machine. */
export const q3 = (v: number) => Math.round(v * 1000) / 1000;
export const q3p = (p: readonly number[]) => p.map(q3);
/** A point rounded to 1/1000 eu, kept a `Point3`. */
export const q3v = (p: readonly [number, number, number]): Point3 => [q3(p[0]), q3(p[1]), q3(p[2])];
