/**
 * Pure plan geometry for the Horizon Clock board (L3): no three, no DOM. Points are `[x, y]` concept metres or
 * `[x, z]` diorama units, whichever the caller works in; nothing here knows which.
 */
import type { DioramaFrame, JourneyLandData, Point2 } from "../contracts.ts";
import { JOURNEY_DIORAMA } from "../contracts.ts";

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** The prototype's in-out cubic. */
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** The prototype's back-out pop (overshoots a little, lands on 1). */
export function popE(t: number): number {
  if (t <= 0) return 0.001;
  if (t >= 1) return 1;
  const c = 1.70158 * 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}
export function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Day slot angle on the bezel: day 1 at north (−z), clockwise seen from above. */
export const slotAngle = (day: number) => ((day - 1) / JOURNEY_DIORAMA.slots) * Math.PI * 2;
/** Polar → diorama plan (x, z): angle 0 = north (−z). */
export const polar = (theta: number, r: number): Point2 => [r * Math.sin(theta), -r * Math.cos(theta)];

export function inPoly(poly: readonly Point2[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Distance from (x, y) to a polyline (closed = a ring). */
export function distToLine(poly: readonly Point2[], x: number, y: number, closed: boolean): number {
  let best = Infinity;
  const n = poly.length;
  if (n === 1) return Math.hypot(poly[0]![0] - x, poly[0]![1] - y);
  for (let i = 0; i < (closed ? n : n - 1); i += 1) {
    const a = poly[i]!, b = poly[(i + 1) % n]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    const t = L ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L, 0, 1) : 0;
    const ex = a[0] + dx * t - x, ey = a[1] + dy * t - y;
    best = Math.min(best, ex * ex + ey * ey);
  }
  return Math.sqrt(best);
}

/** Resample a polyline every `step` (keeps both ends). */
export function resample(pts: readonly Point2[], step: number): Point2[] {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
  const out: Point2[] = [[pts[0]![0], pts[0]![1]]];
  let acc = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!, b = pts[i]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = step - acc;
    while (s < L) { out.push([a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L]); s += step; }
    acc = L - (s - step);
  }
  const last = pts[pts.length - 1]!;
  out.push([last[0], last[1]]);
  return out;
}

/**
 * Open centripetal Catmull–Rom through `pts`, `n + 1` points evenly spaced by arc length (three's
 * `CatmullRomCurve3(…, false, "centripetal").getSpacedPoints(n)`, in plan).
 */
export function spacedCatmullRom(pts: readonly Point2[], n: number): Point2[] {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
  const dense: Point2[] = [];
  const P = (i: number) => pts[clamp(i, 0, pts.length - 1)]!;
  const extrapolated = (i: number): Point2 => {
    if (i < 0) { const a = pts[0]!, b = pts[1]!; return [2 * a[0] - b[0], 2 * a[1] - b[1]]; }
    if (i > pts.length - 1) { const a = pts[pts.length - 1]!, b = pts[pts.length - 2]!; return [2 * a[0] - b[0], 2 * a[1] - b[1]]; }
    return P(i);
  };
  const SUB = 24;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = extrapolated(i - 1), p1 = P(i), p2 = P(i + 1), p3 = extrapolated(i + 2);
    const tj = (a: Point2, b: Point2) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let k = 0; k < SUB; k += 1) {
      const t = t1 + ((t2 - t1) * k) / SUB;
      const mix = (a: Point2, b: Point2, ta: number, tb: number): Point2 => {
        const u = (tb - t) / (tb - ta), v = (t - ta) / (tb - ta);
        return [a[0] * u + b[0] * v, a[1] * u + b[1] * v];
      };
      const A1 = mix(p0, p1, t0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
      const B1 = mix(A1, A2, t0, t2), B2 = mix(A2, A3, t1, t3);
      dense.push(mix(B1, B2, t1, t2));
    }
  }
  const last = pts[pts.length - 1]!;
  dense.push([last[0], last[1]]);
  const cum = [0];
  for (let i = 1; i < dense.length; i += 1) cum.push(cum[i - 1]! + Math.hypot(dense[i]![0] - dense[i - 1]![0], dense[i]![1] - dense[i - 1]![1]));
  const total = cum[cum.length - 1]!;
  const out: Point2[] = [];
  let j = 0;
  for (let i = 0; i <= n; i += 1) {
    const s = (total * i) / n;
    while (j < cum.length - 2 && cum[j + 1]! < s) j += 1;
    const span = cum[j + 1]! - cum[j]! || 1, u = (s - cum[j]!) / span;
    const a = dense[j]!, b = dense[j + 1]!;
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

/** An arc-length parametrised polyline. */
export type Walk = { points: Point2[]; cum: number[]; length: number };
export function walkOf(points: readonly Point2[]): Walk {
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) cum.push(cum[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]));
  return { points: points.map((p) => [p[0], p[1]]), cum, length: cum[cum.length - 1] ?? 0 };
}
/** Point and unit tangent at arc length `s` (clamped). */
export function walkAt(w: Walk, s: number): { x: number; y: number; tx: number; ty: number } {
  const { points, cum } = w;
  if (points.length === 1) return { x: points[0]![0], y: points[0]![1], tx: 1, ty: 0 };
  s = clamp(s, 0, w.length);
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid]! <= s) lo = mid; else hi = mid; }
  const u = (s - cum[lo]!) / (cum[hi]! - cum[lo]! || 1), a = points[lo]!, b = points[hi]!;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, tx: (b[0] - a[0]) / l, ty: (b[1] - a[1]) / l };
}
export function walkSlice(w: Walk, s0: number, s1: number, step = 7): Point2[] {
  const n = Math.max(2, Math.ceil((s1 - s0) / step));
  const out: Point2[] = [];
  for (let i = 0; i <= n; i += 1) { const p = walkAt(w, s0 + ((s1 - s0) * i) / n); out.push([p.x, p.y]); }
  return out;
}
/** Arc position on `w` nearest (x, y). */
export function nearestArc(w: Walk, x: number, y: number): number {
  let best = 0, bd = Infinity;
  w.points.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = w.cum[i]!; } });
  return best;
}

/** True on dry land: inside the coast and outside (and `pad` metres clear of) every water body. */
export function isDry(land: Pick<JourneyLandData, "coastline" | "water">, x: number, y: number, pad = 0): boolean {
  if (!inPoly(land.coastline, x, y)) return false;
  return !land.water.some((w) => inPoly(w.outline, x, y) || (pad > 0 && distToLine(w.outline, x, y, true) < pad));
}

/**
 * The diorama frame. L2's `land.frame` (`dioramaFrame(land)`, from the coastline) is the source of truth; this is the
 * same idea for a land handle that does not carry one yet: the coast's bounding-box centre and its enclosing radius.
 * Never constants: it follows the coastline.
 */
export function frameFromCoast(coast: readonly Point2[]): DioramaFrame {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of coast) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const centre: Point2 = [(x0 + x1) / 2, (y0 + y1) / 2];
  let radius = 1;
  for (const p of coast) radius = Math.max(radius, Math.hypot(p[0] - centre[0], p[1] - centre[1]));
  return { centre, radius, scale: JOURNEY_DIORAMA.islandUnits / radius };
}

/** Plan concept metres → diorama plan (x, z). */
export const planToDu = (frame: DioramaFrame, x: number, y: number): Point2 => [(x - frame.centre[0]) * frame.scale, (y - frame.centre[1]) * frame.scale];
