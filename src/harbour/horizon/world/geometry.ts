import type { Point2, Point3, Polygon } from './definition.ts';
import type { TerrainField, StructureSolid, PadCut } from '../land/interfaces.ts';

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixPoint = (a: Point3, b: Point3, t: number): Point3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const distance3 = (a: Point3, b: Point3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function arcLengths(points: readonly Point3[]): number[] { const out = [0]; for (let i = 1; i < points.length; i++) out.push(out[i - 1]! + distance3(points[i - 1]!, points[i]!)); return out; }
export const length3 = (points: readonly Point3[]) => arcLengths(points).at(-1) ?? 0;
export function pointInPolygon(x: number, z: number, outline: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function terrainHeight(field: TerrainField, x: number, z: number): number {
  const u = Math.max(0, Math.min(field.columns - 1, x / field.step)), v = Math.max(0, Math.min(field.rows - 1, z / field.step));
  const a = Math.min(field.columns - 2, Math.floor(u)), b = Math.min(field.rows - 2, Math.floor(v));
  const h = (dx: number, dz: number) => field.heights[(b + dz) * field.columns + a + dx]!;
  const tx = u - a, tz = v - b;
  return tx + tz <= 1 ? h(0, 0) + tx * (h(1, 0) - h(0, 0)) + tz * (h(0, 1) - h(0, 0)) : h(1, 1) + (1 - tx) * (h(0, 1) - h(1, 1)) + (1 - tz) * (h(1, 0) - h(1, 1));
}
export function rectangle(centre: Point2, size: Point2, degrees = 0): Point2[] {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => [centre[0] + x! * size[0] / 2 * c - z! * size[1] / 2 * s, centre[1] + x! * size[0] / 2 * s + z! * size[1] / 2 * c]);
}
export const padOutline = (pad: PadCut) => rectangle([pad.centre[0], pad.centre[2]], pad.size, pad.rotationDegrees);
export function ellipse(cx: number, z: number, rx: number, rz = rx, count = 40): Point2[] { return Array.from({ length: count }, (_, i) => [cx + Math.cos(i / count * Math.PI * 2) * rx, z + Math.sin(i / count * Math.PI * 2) * rz]); }
export function bounds(points: readonly Point3[]) { const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity]; for (const p of points) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, p[k]!); max[k] = Math.max(max[k]!, p[k]!); } return { min, max }; }
export function solidBounds(s: StructureSolid) { const points: Point3[] = []; for (let i = 0; i < s.positions.length; i += 3) points.push([s.positions[i]!, s.positions[i + 1]!, s.positions[i + 2]!]); return bounds(points); }
export function closestOnPolyline(points: readonly Point3[], x: number, z: number) {
  let best = { distance: Infinity, point: [x, 0, z] as Point3, segment: 0, t: 0, arc: 0 };
  let arc = 0;
  for (let i = 1; i < points.length; i++) { const a = points[i - 1]!, b = points[i]!, dx = b[0] - a[0], dz = b[2] - a[2]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1))), p = mixPoint(a, b, t), d = Math.hypot(p[0] - x, p[2] - z), len = distance3(a, b); if (d < best.distance) best = { distance: d, point: p, segment: i - 1, t, arc: arc + len * t }; arc += len; }
  return best;
}
/** Closed intersections include shared endpoints and collinear overlap boundaries. */
export function segmentIntersections(a: Point3, b: Point3, c: Point3, d: Point3): { at: Point2; t: number; u: number; overlap: boolean }[] {
  const rx = b[0] - a[0], rz = b[2] - a[2], sx = d[0] - c[0], sz = d[2] - c[2], qx = c[0] - a[0], qz = c[2] - a[2], cross = rx * sz - rz * sx, rr = rx * rx + rz * rz, ss = sx * sx + sz * sz, eps = 1e-7;
  if (rr < eps || ss < eps) return [];
  if (Math.abs(cross) > eps) { const t = (qx * sz - qz * sx) / cross, u = (qx * rz - qz * rx) / cross; return t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps ? [{ at: [a[0] + t * rx, a[2] + t * rz], t, u, overlap: false }] : []; }
  if (Math.abs(qx * rz - qz * rx) > eps) return [];
  const t0 = (qx * rx + qz * rz) / rr, t1 = t0 + (sx * rx + sz * rz) / rr, lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(1, Math.max(t0, t1));
  if (hi < lo - eps) return [];
  return (hi - lo < eps ? [lo] : [lo, hi]).map(t => { const x = a[0] + t * rx, z = a[2] + t * rz; return { at: [x, z], t, u: ((x - c[0]) * sx + (z - c[2]) * sz) / ss, overlap: hi - lo > eps }; });
}
export function rayTriangle(origin: Point3, end: Point3, a: Point3, b: Point3, c: Point3): number | null {
  const sub = (u: Point3, v: Point3): Point3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u: Point3, v: Point3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2], cross = (u: Point3, v: Point3): Point3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dir = sub(end, origin), e1 = sub(b, a), e2 = sub(c, a), p = cross(dir, e2), det = dot(e1, p); if (Math.abs(det) < 1e-8) return null;
  const t = sub(origin, a), u = dot(t, p) / det; if (u < 0 || u > 1) return null; const q = cross(t, e1), v = dot(dir, q) / det; if (v < 0 || u + v > 1) return null; const f = dot(e2, q) / det; return f > 1e-5 && f < .999 ? f : null;
}
export function raySolid(origin: Point3, end: Point3, solid: StructureSolid): boolean {
  const get = (i: number): Point3 => [solid.positions[i * 3]!, solid.positions[i * 3 + 1]!, solid.positions[i * 3 + 2]!];
  for (let i = 0; i < solid.indices.length; i += 3) if (rayTriangle(origin, end, get(solid.indices[i]!), get(solid.indices[i + 1]!), get(solid.indices[i + 2]!)) !== null) return true;
  return false;
}
