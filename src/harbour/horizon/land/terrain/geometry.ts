import type { XY, XYZ } from '../interfaces';

export const clamp = (n: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, n));
export const smooth = (n: number): number => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export function contains(poly: readonly XY[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function segmentPoint(x: number, z: number, a: XY, b: XY): { distance: number; t: number; x: number; z: number } {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1));
  const px = a[0] + t * dx, pz = a[1] + t * dz;
  return { distance: Math.hypot(x - px, z - pz), t, x: px, z: pz };
}
export function polygonDistance(poly: readonly XY[], x: number, z: number): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, segmentPoint(x, z, poly[i]!, poly[(i + 1) % poly.length]!).distance);
  return contains(poly, x, z) ? d : -d;
}
export function polygonCentre(poly: readonly XY[]): XY {
  let twiceArea = 0, x = 0, z = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!, cross = a[0] * b[1] - b[0] * a[1];
    twiceArea += cross; x += (a[0] + b[0]) * cross; z += (a[1] + b[1]) * cross;
  }
  return [x / (3 * twiceArea), z / (3 * twiceArea)];
}
export function ellipse(cx: number, cz: number, rx: number, rz: number, count = 48): XY[] {
  return Array.from({ length: count }, (_, i): XY => [cx + rx * Math.cos(i * Math.PI * 2 / count), cz + rz * Math.sin(i * Math.PI * 2 / count)]);
}
const arcs = new WeakMap<readonly XYZ[], { lengths: number[]; total: number }>();
/** Call only with the completed immutable cut data, never with a spline still being graded. */
export function polylineArcs(points: readonly XYZ[]): { lengths: number[]; total: number } {
  let cached = arcs.get(points);
  if (!cached) {
    const lengths = points.slice(1).map((b, i) => Math.hypot(b[0] - points[i]![0], b[2] - points[i]![2]));
    cached = { lengths, total: lengths.reduce((sum, length) => sum + length, 0) }; arcs.set(points, cached);
  }
  return cached;
}
export function linePoint(points: readonly XYZ[], x: number, z: number): { distance: number; height: number; progress: number; x: number; z: number; tangent: XY } {
  let best = { distance: Infinity, height: 0, progress: 0, x, z, tangent: [1, 0] as XY };
  const { lengths, total } = polylineArcs(points);
  let travelled = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!, length = lengths[i]!;
    const hit = segmentPoint(x, z, [a[0], a[2]], [b[0], b[2]]);
    if (hit.distance < best.distance) best = { distance: hit.distance, height: mix(a[1], b[1], hit.t), progress: (travelled + hit.t * length) / (total || 1), x: hit.x, z: hit.z, tangent: [(b[0] - a[0]) / (length || 1), (b[2] - a[2]) / (length || 1)] };
    travelled += length;
  }
  return best;
}
export function lineOutline(points: readonly XYZ[], width: number): XY[] {
  const side = (sign: number): XY[] => points.map((p, i) => {
    const before = points[Math.max(0, i - 1)]!, after = points[Math.min(points.length - 1, i + 1)]!;
    const dx = after[0] - before[0], dz = after[2] - before[2], l = Math.hypot(dx, dz) || 1;
    return [p[0] - sign * dz * width / (2 * l), p[2] + sign * dx * width / (2 * l)];
  });
  return [...side(1), ...side(-1).reverse()];
}
