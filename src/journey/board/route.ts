/**
 * `layoutRoute(board, land)` (T3, pure; no three): the board's route as data.
 *
 * One geometry for every camera tier (PLAN §A "The route", P3): a centripetal Catmull-Rom ribbon through the twelve
 * baked station anchors in calendar order. The stations form a cycle (Dec → Jan), so every stretch has real
 * neighbours for its tangents and a full-year window closes into one lap. Month m's stretch runs from station(m−1)
 * to station(m); its N days are spaced evenly by arc length with day N ON the station (dayLedger's `station`).
 * Crossings (`crossings.ts`) are drawn over/under and no day space stands within 12 eu of one — a space that would is
 * nudged along its own arc, locally, keeping order. Heights are the land's compressed surface + the route lift; x/z
 * are never changed, so a board point handed to Horizon is the same place. Deterministic: same board + land → same
 * route, byte for byte. Ids are the board's own (chapter ids, day dates).
 */
import type {
  ChapterId, DaySpace, JourneyBoard, JourneyLandData, LayoutRoute, MonthSpace, Point2, Point3, RouteSpace, RouteStretch, StationId,
} from "../contracts.ts";
import { HEIGHT_COMPRESSION, STATION_IDS } from "../contracts.ts";
import { createLandSurface } from "../land/surface.ts";
import { blockedIntervals, CROSSING_CLEARANCE_EU, findCrossings } from "./crossings.ts";

/** Dense sampling step (eu) used for arc length and placement. */
const DENSE_STEP = 1.5;
/** Ribbon centreline sample spacing (eu) handed to the renderer, per quality tier. */
export const ROUTE_SAMPLE_EU = { full: 8, lite: 12 } as const;
/** Spaces are kept this much further than the clearance, so a rounding step never lands one on the line. */
const CLEARANCE_MARGIN = 0.75;

/** A day space with its arc position along its stretch (planar eu from the previous station). */
export type BoardDaySpace = DaySpace & { arcEu: number };
export type BoardRouteStretch = Omit<RouteStretch, "days"> & { days: BoardDaySpace[]; /** Cumulative planar arc (eu) at each centreline point. */ arc: number[] };
export type BoardRouteSpace = Omit<RouteSpace, "stretches"> & { stretches: BoardRouteStretch[] };

type Dense = { pts: Point2[]; arc: number[]; length: number };

/** Centripetal Catmull-Rom (α = 0.5) point on the P1→P2 span at t ∈ [0, 1]. */
export function centripetalPoint(p0: Point2, p1: Point2, p2: Point2, p3: Point2, t: number): Point2 {
  const knot = (a: Point2, b: Point2, prev: number) => prev + Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-4);
  const t0 = 0, t1 = knot(p0, p1, t0), t2 = knot(p1, p2, t1), t3 = knot(p2, p3, t2);
  const u = t1 + (t2 - t1) * t;
  const lerp = (a: Point2, b: Point2, ta: number, tb: number): Point2 => {
    const w = (u - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
  const a1 = lerp(p0, p1, t0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, t0, t2), b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

function denseSpan(p0: Point2, p1: Point2, p2: Point2, p3: Point2): Dense {
  const chord = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  // Oversample in t, then the arc table does the rest (the curve is ≤ ~1.6× its chord here).
  const n = Math.max(8, Math.ceil((chord * 1.8) / DENSE_STEP));
  const pts: Point2[] = [p1];
  for (let i = 1; i < n; i += 1) pts.push(centripetalPoint(p0, p1, p2, p3, i / n));
  pts.push(p2);
  const arc = [0];
  for (let i = 1; i < pts.length; i += 1) arc.push(arc[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  return { pts, arc, length: arc[arc.length - 1]! };
}

/** Index k with arc[k] ≤ s < arc[k+1] (binary search). */
function spanIndex(arc: readonly number[], s: number): number {
  let lo = 0, hi = arc.length - 2;
  if (s <= 0) return 0;
  if (s >= arc[arc.length - 1]!) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arc[mid]! <= s) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function pointAtArc(pts: readonly Point2[], arc: readonly number[], s: number): Point2 {
  const k = spanIndex(arc, s), a = pts[k]!, b = pts[k + 1]!, len = arc[k + 1]! - arc[k]!;
  const w = len > 0 ? Math.min(Math.max((s - arc[k]!) / len, 0), 1) : 0;
  return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
}

export function tangentAtArc(pts: readonly Point2[], arc: readonly number[], s: number): Point2 {
  const k = spanIndex(arc, s), a = pts[k]!, b = pts[k + 1]!;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

const inside = (s: number, blocked: readonly [number, number][]) => blocked.some(([a, b]) => s > a && s < b);

/** Allowed measure of (lo, hi) minus the blocked intervals, as sorted sub-intervals. */
function allowedParts(lo: number, hi: number, blocked: readonly [number, number][]): [number, number][] {
  const parts: [number, number][] = [];
  let cursor = lo;
  for (const [a, b] of blocked) {
    if (b <= cursor || a >= hi) continue;
    if (a > cursor) parts.push([cursor, Math.min(a, hi)]);
    cursor = Math.max(cursor, b);
    if (cursor >= hi) break;
  }
  if (cursor < hi) parts.push([cursor, hi]);
  return parts;
}

/**
 * Arc positions for days 1…N on a stretch of `length`: evenly spaced, day N = `length` (the station). A day that
 * falls in a blocked interval is nudged: its run (plus neighbours when the room is tight) is re-spread evenly over
 * the allowed arc between the nearest fixed spaces. Strictly increasing; deterministic.
 */
export function placeDays(length: number, count: number, blocked: readonly [number, number][]): number[] {
  const s = Array.from({ length: count }, (_, i) => (length * (i + 1)) / count);
  if (!blocked.length || count === 0) return s;
  const ideal = length / count;
  const fixedAt = (i: number) => (i < 0 ? 0 : s[i]!);
  let i = 0;
  while (i < count - 1) {
    if (!inside(s[i]!, blocked)) { i += 1; continue; }
    let j = i;
    while (j + 1 < count - 1 && inside(s[j + 1]!, blocked)) j += 1;
    // Window (lo, hi) exclusive: fixed spaces at lo and hi; re-spread i…j, widening while the room is tight.
    let lo = i - 1, hi = j + 1;
    for (;;) {
      const parts = allowedParts(fixedAt(lo), s[hi]!, blocked);
      const room = parts.reduce((sum, [a, b]) => sum + (b - a), 0);
      const k = hi - lo - 1;
      if (room / (k + 1) >= ideal * 0.5 || (lo < 0 && hi >= count - 1)) {
        let u = 0, part = 0;
        for (let t = 1; t <= k; t += 1) {
          const target = (room * t) / (k + 1);
          while (part < parts.length - 1 && u + (parts[part]![1] - parts[part]![0]) < target) { u += parts[part]![1] - parts[part]![0]; part += 1; }
          s[lo + t] = parts[part]![0] + (target - u);
        }
        break;
      }
      if (lo >= 0) lo -= 1;
      if (hi < count - 1) hi += 1;
    }
    i = hi;
  }
  return s;
}

const stationIndex = (id: StationId) => STATION_IDS.indexOf(id);

/** Centreline samples (planar) every `step` eu along a dense span, endpoints exact. */
function resample(dense: Dense, step: number): { pts: Point2[]; arc: number[] } {
  const n = Math.max(2, Math.ceil(dense.length / step));
  const pts: Point2[] = [], arc: number[] = [];
  for (let i = 0; i <= n; i += 1) {
    const s = (dense.length * i) / n;
    pts.push(i === n ? dense.pts[dense.pts.length - 1]! : pointAtArc(dense.pts, dense.arc, s));
    arc.push(s);
  }
  return { pts, arc };
}

/** A stretch passing closer than this (planar eu) to ANOTHER month's station bends around it. */
export const STATION_CLEARANCE_EU = 30;

function withArc(pts: Point2[]): Dense {
  const arc = [0];
  for (let i = 1; i < pts.length; i += 1) arc.push(arc[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  return { pts, arc, length: arc[arc.length - 1]! };
}

function closestApproach(dense: Dense, p: Point2): { d: number; s: number } {
  let best = { d: Infinity, s: 0 };
  for (let i = 0; i + 1 < dense.pts.length; i += 1) {
    const a = dense.pts[i]!, b = dense.pts[i + 1]!, dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(Math.max(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2, 0), 1) : 0;
    const d = Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
    if (d < best.d) best = { d, s: dense.arc[i]! + t * (dense.arc[i + 1]! - dense.arc[i]!) };
  }
  return best;
}

/**
 * Bend a span around a foreign station: a raised-cosine bump along the normal at the closest approach, "away" (keep
 * the side it passes on) or "across" (pass on the other side). The bump never reaches the span's own stations.
 */
function detour(dense: Dense, station: Point2, side: "away" | "across"): Dense {
  let current = dense;
  for (let iter = 0; iter < 5; iter += 1) {
    const { d, s } = closestApproach(current, station);
    if (d >= STATION_CLEARANCE_EU - 0.5 && (side === "away" || iter > 0)) return current;
    const t = tangentAtArc(current.pts, current.arc, s), at = pointAtArc(current.pts, current.arc, s);
    let n: Point2 = [-t[1], t[0]];
    const toStation = (station[0] - at[0]) * n[0] + (station[1] - at[1]) * n[1];
    // "away": push to the side opposite the station; "across" (first pass only): through and beyond it.
    const crossing = side === "across" && iter === 0;
    if ((toStation > 0) !== crossing) n = [-n[0], -n[1]];
    const amount = crossing ? STATION_CLEARANCE_EU + Math.abs(toStation) : STATION_CLEARANCE_EU - d + 0.5;
    const w = Math.min(STATION_CLEARANCE_EU * 3, s * 0.9, (current.length - s) * 0.9);
    if (w < STATION_CLEARANCE_EU * 0.5) return current;
    current = withArc(current.pts.map((p, i) => {
      const u = (current.arc[i]! - s) / w;
      if (Math.abs(u) >= 1) return p;
      const g = amount * 0.5 * (1 + Math.cos(Math.PI * u));
      return [p[0] + n[0] * g, p[1] + n[1] * g] as Point2;
    }));
  }
  return current;
}

/** Crossing count and how many of them stand too near a station (those cannot be fixed by nudging days). */
function lapScore(spans: readonly Dense[], stations: readonly Point2[]): [number, number] {
  const lines = spans.map((d, k) => ({ chapterId: String(k).padStart(2, "0"), points: resample(d, ROUTE_SAMPLE_EU.full).pts }));
  const crossings = findCrossings(lines, stations);
  const nearStation = crossings.filter((c) => stations.some((st) => Math.hypot(st[0] - c.at[0], st[1] - c.at[1]) < CROSSING_CLEARANCE_EU + CLEARANCE_MARGIN)).length;
  return [nearStation, crossings.length];
}

const lapCache = new WeakMap<JourneyLandData, Dense[]>();

/**
 * The full lap on this island: span k ends at station k (jan = 0) and starts at station k−1. Depends on the land only
 * (never on the window), so a stretch keeps its shape as months roll by. Cached per land object.
 */
function lapFor(land: JourneyLandData): Dense[] {
  const cached = lapCache.get(land);
  if (cached) return cached;
  const anchorOf = new Map(land.stations.map((st) => [st.id, st.anchor] as const));
  const stations = STATION_IDS.map((id) => anchorOf.get(id)!);
  const cyc = (k: number): Point2 => stations[((k % 12) + 12) % 12]!;
  const spans = STATION_IDS.map((_, k) => denseSpan(cyc(k - 2), cyc(k - 1), cyc(k), cyc(k + 1)));
  // Greedy, deterministic: span order, then station order; each detour picks the side with fewer unfixable
  // crossings, then fewer crossings, then "away" (the smaller bend).
  for (let k = 0; k < 12; k += 1) {
    for (let j = 0; j < 12; j += 1) {
      if (j === k || j === (k + 11) % 12) continue;
      if (closestApproach(spans[k]!, stations[j]!).d >= STATION_CLEARANCE_EU - 0.5) continue;
      const options = (["away", "across"] as const).map((side) => {
        const trial = spans.slice(); trial[k] = detour(spans[k]!, stations[j]!, side);
        return { side, span: trial[k]!, score: lapScore(trial, stations) };
      });
      options.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1]);
      spans[k] = options[0]!.span;
    }
  }
  lapCache.set(land, spans);
  return spans;
}

export type LayoutRouteOptions = { sampleEu?: number };

/** The full layout (with arc positions) — `layoutRoute` is this, typed as the contract. */
export function layoutBoardRoute(board: JourneyBoard, land: JourneyLandData, options: LayoutRouteOptions = {}): BoardRouteSpace {
  const surface = createLandSurface(land);
  const lift = HEIGHT_COMPRESSION.routeLift;
  const board3 = (p: Point2): Point3 => [p[0], round3(surface.surfaceAt(p[0], p[1]) + lift), p[1]];
  const anchorOf = new Map(land.stations.map((st) => [st.id, st.anchor] as const));
  const chapters = [...board.chapters].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const step = options.sampleEu ?? ROUTE_SAMPLE_EU.full;
  const lap = lapFor(land);

  const spans = chapters.map((chapter) => {
    const k = stationIndex(chapter.stationId);
    const dense = lap[k]!;
    return { chapter, k, dense, line: resample(dense, step) };
  });
  const joints = STATION_IDS.map((id) => anchorOf.get(id)!);
  const crossings = findCrossings(spans.map((sp) => ({ chapterId: sp.chapter.id, points: sp.line.pts })), joints);

  const stretches: BoardRouteStretch[] = spans.map(({ chapter, k, dense, line }) => {
    const blocked = blockedIntervals(dense.pts, dense.arc, crossings, CROSSING_CLEARANCE_EU + CLEARANCE_MARGIN);
    const arcs = placeDays(dense.length, chapter.days.length, blocked);
    const days: BoardDaySpace[] = chapter.days.map((cell, i) => {
      const s = i === chapter.days.length - 1 ? dense.length : arcs[i]!;
      const p = i === chapter.days.length - 1 ? dense.pts[dense.pts.length - 1]! : pointAtArc(dense.pts, dense.arc, s);
      const t = tangentAtArc(dense.pts, dense.arc, Math.min(s, dense.length - 1e-6));
      return {
        date: cell.date, chapterId: chapter.id, index: i + 1, at: board3(p), tangent: [round5(t[0]), round5(t[1])],
        relation: cell.relation, stopIds: [...cell.stopIds], clusterId: cell.clusterId, flagstone: cell.flagstone, arcEu: round3(s),
      };
    });
    return {
      chapterId: chapter.id,
      fromStationId: STATION_IDS[(k + 11) % 12]!,
      toStationId: chapter.stationId,
      points: line.pts.map(board3),
      arc: line.arc.map(round3),
      lengthEu: round3(dense.length),
      days,
    };
  });

  const months: MonthSpace[] = chapters.map((chapter) => ({
    chapterId: chapter.id, stationId: chapter.stationId, at: board3(anchorOf.get(chapter.stationId)!), state: chapter.state,
  }));
  return { months, stretches, crossings };
}

export const layoutRoute: LayoutRoute = (board, land) => layoutBoardRoute(board, land);

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** The day space for a date, if it is on the route. */
export function daySpaceFor(route: RouteSpace, date: string): DaySpace | undefined {
  const month = date.slice(0, 7);
  const stretch = route.stretches.find((s) => s.chapterId === month);
  return stretch?.days.find((d) => d.date === date);
}

/** The stretch's arc midpoint (planar concept xy): where a chapter is framed at Region. */
export function stretchMidpoint(route: RouteSpace, chapterId: ChapterId): Point3 | null {
  const stretch = route.stretches.find((s) => s.chapterId === chapterId);
  if (!stretch || !stretch.points.length) return null;
  const mid = stretch.days[Math.floor((stretch.days.length - 1) / 2)];
  return mid ? mid.at : stretch.points[Math.floor(stretch.points.length / 2)]!;
}
