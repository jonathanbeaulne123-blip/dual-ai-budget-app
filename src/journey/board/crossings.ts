/**
 * Route self-crossings (T3, pure). The board's route visits the twelve baked stations in calendar order, so on this
 * island the ribbon crosses itself (PLAN §A measured 4 chord crossings). Each crossing is drawn over/under — the LATER
 * month passes over the earlier one, the earlier ribbon has a gap — and no day space stands within
 * `CROSSING_CLEARANCE_EU` of a crossing (spaces are nudged along their arc instead, see `route.ts`).
 */
import type { ChapterId, Point2 } from "../contracts.ts";

/** No day space may stand closer than this (planar eu) to a crossing. */
export const CROSSING_CLEARANCE_EU = 12;
/** Intersections this close (eu) to a shared station are the route's own joints, not crossings. */
const JOINT_EPS = 2;
/** Two hits this close (eu) are one crossing. */
const MERGE_EPS = 1;

export type RouteCrossing = { at: Point2; overChapterId: ChapterId; underChapterId: ChapterId };

type Polyline2 = readonly Point2[];

/** Proper intersection of segments ab and cd (planar), or null. Collinear overlaps are ignored (never on a spline). */
export function segmentIntersection(a: Point2, b: Point2, c: Point2, d: Point2): Point2 | null {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const qx = c[0] - a[0], qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / denom, u = (qx * ry - qy * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [a[0] + t * rx, a[1] + t * ry];
}

const dist = (p: Point2, q: Point2) => Math.hypot(p[0] - q[0], p[1] - q[1]);

type Box = { x0: number; x1: number; y0: number; y1: number };
function boxOf(points: Polyline2): Box {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1 };
}

/**
 * Every place two stretches (or one stretch with itself) cross, in a stable order (by over chapter, under chapter,
 * then along the under stretch). `stretches` are in calendar order; `joints` are the station points the stretches
 * meet at (never counted as crossings).
 */
export function findCrossings(stretches: readonly { chapterId: ChapterId; points: Polyline2 }[], joints: readonly Point2[]): RouteCrossing[] {
  const found: RouteCrossing[] = [];
  const nearJoint = (p: Point2) => joints.some((j) => dist(j, p) < JOINT_EPS);
  const boxes = stretches.map((s) => boxOf(s.points));
  for (let i = 0; i < stretches.length; i += 1) {
    for (let j = i; j < stretches.length; j += 1) {
      const A = stretches[i]!, B = stretches[j]!, ba = boxes[i]!, bb = boxes[j]!;
      if (ba.x1 < bb.x0 || bb.x1 < ba.x0 || ba.y1 < bb.y0 || bb.y1 < ba.y0) continue;
      const hits: { at: Point2; along: number }[] = [];
      for (let p = 0; p + 1 < A.points.length; p += 1) {
        const a = A.points[p]!, b = A.points[p + 1]!;
        const segBox = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
        if (segBox.x1 < bb.x0 || bb.x1 < segBox.x0 || segBox.y1 < bb.y0 || bb.y1 < segBox.y0) continue;
        // Within one stretch, skip the segment itself and its neighbours (they share a vertex).
        for (let q = i === j ? p + 2 : 0; q + 1 < B.points.length; q += 1) {
          const hit = segmentIntersection(a, b, B.points[q]!, B.points[q + 1]!);
          if (!hit || nearJoint(hit)) continue;
          if (hits.some((h) => dist(h.at, hit) < MERGE_EPS)) continue;
          hits.push({ at: hit, along: p });
        }
      }
      hits.sort((x, y) => x.along - y.along);
      // Later month over the earlier one (ids are "YYYY-MM", so string order is calendar order).
      const over = A.chapterId >= B.chapterId ? A.chapterId : B.chapterId, under = over === A.chapterId ? B.chapterId : A.chapterId;
      for (const h of hits) {
        if (found.some((f) => dist(f.at, h.at) < MERGE_EPS)) continue;
        found.push({ at: [round2(h.at[0]), round2(h.at[1])], overChapterId: over, underChapterId: under });
      }
    }
  }
  return found;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Arc-length intervals of a stretch that lie within `clearance` of any crossing (planar), merged and sorted.
 * `arc[k]` is the cumulative planar length at `points[k]`.
 */
export function blockedIntervals(points: Polyline2, arc: readonly number[], crossings: readonly { at: Point2 }[], clearance = CROSSING_CLEARANCE_EU): [number, number][] {
  if (!crossings.length || points.length < 2) return [];
  const raw: [number, number][] = [];
  for (let k = 0; k + 1 < points.length; k += 1) {
    const a = points[k]!, b = points[k + 1]!, sa = arc[k]!, sb = arc[k + 1]!;
    const len = sb - sa;
    if (len <= 0) continue;
    for (const c of crossings) {
      // Solve |a + t(b−a) − c| < clearance for t in [0, 1].
      const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - c.at[0], fy = a[1] - c.at[1];
      const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - clearance * clearance;
      const disc = B * B - 4 * A * C;
      if (disc <= 0) continue;
      const root = Math.sqrt(disc);
      const t0 = Math.max(0, (-B - root) / (2 * A)), t1 = Math.min(1, (-B + root) / (2 * A));
      if (t0 >= t1) continue;
      raw.push([sa + t0 * len, sa + t1 * len]);
    }
  }
  raw.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const iv of raw) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], iv[1]);
    else merged.push([iv[0], iv[1]]);
  }
  return merged;
}
