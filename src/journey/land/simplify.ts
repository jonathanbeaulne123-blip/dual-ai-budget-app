/**
 * Plan geometry helpers for the Journey land (T2). Pure: no three, no IO.
 * Coordinates are concept metres (x east, y south) = engine (x, z).
 */
import type { Point2, Point3, Polygon } from "../contracts.ts";

/** Distance from p to the segment a–b (plan). */
export function segmentDistance(p: Point2, a: Point2, b: Point2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas–Peucker keep-mask on plan points (iterative; endpoints always kept). */
function keepMask(points: readonly Point2[], tolerance: number): boolean[] {
  const keep = new Array<boolean>(points.length).fill(false);
  if (points.length <= 2) return keep.fill(true);
  keep[0] = true; keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let worst = -1, worstAt = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i]!, points[first]!, points[last]!);
      if (d > worst) { worst = d; worstAt = i; }
    }
    if (worst > tolerance && worstAt > 0) { keep[worstAt] = true; stack.push([first, worstAt], [worstAt, last]); }
  }
  return keep;
}

/** Douglas–Peucker simplification of an open polyline (plan). */
export function simplifyLine(points: readonly Point2[], tolerance: number): Point2[] {
  const keep = keepMask(points, tolerance);
  return points.filter((_, i) => keep[i]).map((p) => [round(p[0]), round(p[1])] as const);
}

/** Douglas–Peucker on engine points (x, height, z), judged in plan (x, z); heights ride along. */
export function simplifyLine3(points: readonly Point3[], tolerance: number): Point3[] {
  const keep = keepMask(points.map((p) => [p[0], p[2]] as const), tolerance);
  return points.filter((_, i) => keep[i]).map((p) => [round(p[0]), round(p[1]), round(p[2])] as const);
}

/**
 * Simplify a closed ring. The ring is split at its two mutually-farthest-ish vertices so DP has fixed ends.
 * With `maxPoints`, the tolerance grows until the ring fits.
 */
export function simplifyRing(ring: Polygon, tolerance: number, maxPoints = Infinity): Point2[] {
  const open = closedRing(ring);
  if (open.length <= 3) return open.map((p) => [round(p[0]), round(p[1])] as const);
  let far = 0, best = -1;
  for (let i = 1; i < open.length; i++) { const d = Math.hypot(open[i]![0] - open[0]![0], open[i]![1] - open[0]![1]); if (d > best) { best = d; far = i; } }
  let tol = tolerance;
  for (let pass = 0; pass < 24; pass++) {
    const a = simplifyLine(open.slice(0, far + 1), tol), b = simplifyLine([...open.slice(far), open[0]!], tol);
    const out = [...a, ...b.slice(1, -1)];
    if (out.length <= maxPoints || out.length <= 3) return out;
    tol = tol > 0 ? tol * 1.5 : 0.5;
  }
  return open.slice(0, Math.max(3, Math.min(open.length, maxPoints))).map((p) => [round(p[0]), round(p[1])] as const);
}

/** Drop a repeated closing point. */
export function closedRing(ring: Polygon): Point2[] {
  const out = ring.slice() as Point2[];
  if (out.length > 1 && out[0]![0] === out[out.length - 1]![0] && out[0]![1] === out[out.length - 1]![1]) out.pop();
  return out;
}

/** Even–odd point in polygon. */
export function pointInPolygon(x: number, y: number, ring: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(ring: Polygon): Point2 {
  const pts = closedRing(ring);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** Signed area (positive = counter-clockwise in x-right / y-down plan terms is clockwise on screen). */
export function signedArea(ring: Polygon): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  return a / 2;
}

/** Insert points so no segment is longer than `maxStep` (for draping flat ribbons on the terrain). */
export function densify(points: readonly Point2[], maxStep: number): Point2[] {
  if (points.length < 2) return points.slice();
  const out: Point2[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxStep));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}


/** Plan projection of p on segment a→b: t along (0…1, unclamped) and signed lateral offset (right of a→b positive). */
export function projectOnSegment(p: readonly number[], a: readonly number[], b: readonly number[]): { t: number; lateral: number; length: number } {
  const dx = b[0]! - a[0]!, dz = b[1]! - a[1]!, length = Math.hypot(dx, dz) || 1;
  const px = p[0]! - a[0]!, pz = p[1]! - a[1]!;
  return { t: (px * dx + pz * dz) / (length * length), lateral: (-px * dz + pz * dx) / length, length };
}

/** Arc position (eu) of the point of a polyline nearest to q. */
export function arcOf(points: readonly Point2[], q: Point2): number {
  let best = Infinity, at = 0, run = 0;
  for (let i = 1; i < points.length; i++) {
    // The true segment length (projectOnSegment reports 1 for a zero-length segment; sliceByArc counts it as 0).
    const a = points[i - 1]!, b = points[i]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]), pr = projectOnSegment(q, a, b), t = len > 0 ? Math.min(Math.max(pr.t, 0), 1) : 0;
    const d = Math.hypot(a[0] + (b[0] - a[0]) * t - q[0], a[1] + (b[1] - a[1]) * t - q[1]);
    if (d < best) { best = d; at = run + t * len; }
    run += len;
  }
  return at;
}

/** The polyline between two arc positions (a < b), ends interpolated. */
export function sliceByArc(points: readonly Point2[], from: number, to: number): Point2[] {
  const out: Point2[] = [];
  let run = 0;
  const at = (a: Point2, b: Point2, t: number): Point2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0) {
      const s0 = run, s1 = run + len;
      if (s1 >= from && s0 <= to) {
        if (!out.length) out.push(at(a, b, Math.max(0, (from - s0) / len)));
        out.push(at(a, b, Math.min(1, (to - s0) / len)));
      }
    }
    run += len;
    if (run > to) break;
  }
  return out.filter((p, i) => i === 0 || p[0] !== out[i - 1]![0] || p[1] !== out[i - 1]![1]);
}

/** SVG path data for a polyline or ring, rounded to 0.1 concept metre. */
export function pathData(points: readonly Point2[], closed: boolean): string {
  if (!points.length) return "";
  const body = points.map((p, i) => `${i ? "L" : "M"}${fmt(p[0])} ${fmt(p[1])}`).join("");
  return closed ? `${body}Z` : body;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);
export const round = (n: number) => Math.round(n * 100) / 100;
