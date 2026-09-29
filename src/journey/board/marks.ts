/**
 * The board's marks (T3, pure; no three): ONE list of every thing the UI can put a DOM button on — the piece, the
 * month spaces, the day spaces, clusters, stops and crossroads — with where each stands in board space. The 3D scene
 * projects these to `MarkAnchor`s every frame; `BoardFlat` draws the same ids on the SVG twin. One source, so the
 * two can never disagree about ids.
 *
 * Mark ids: `"piece"`; month = chapter id (`"2026-09"`); day = date (`"2026-09-18"`); cluster / stop / crossroads =
 * the board's own ids. Stops inside a cluster stand at the cluster's post. (District labels are added by the scene as
 * `district:<id>`; they are land, not board marks.)
 */
import type { CameraTier, Crossroads, JourneyBoard, Point2, Point3, RouteSpace, Stop } from "../contracts.ts";

export type BoardMarkKind = "piece" | "month" | "day" | "cluster" | "stop" | "crossroads";
export type BoardMark = {
  id: string;
  kind: BoardMarkKind;
  /** Board space (engine x, compressed height, engine z) of the space the mark stands on. */
  base: Point3;
  /** Planar offset from `base` in DESIGN UNITS (posts stand beside the route, not on it). */
  offset: Point2;
  /** Where the label anchors, in design units above the base. */
  head: number;
  /** Tiers at which the mark is drawn (its anchor is `visible` only then). */
  tiers: readonly CameraTier[];
  chapterId: string | null;
  date: string | null;
};

/** How far (design units ≈ px) posts stand beside the route. */
export const POST_OFFSET = 17;
/** Posts are authored small; at the board's 58° view they draw this much larger (the piece stays taller). */
export const POST_SCALE = 1.3;
export const HEADS = { piece: 40, month: 7, day: 3, post: 30 * POST_SCALE, cluster: 14 * POST_SCALE, crossroads: 33 * POST_SCALE } as const;
/** Spacing (design units) between crossroads posts that share a date. */
export const CROSSROADS_SPACING = 20;
/** At Sky at most this many posts (major stops / clusters / crossroads) stand on the board. */
export const SKY_POST_LIMIT = 8;

const ALL: readonly CameraTier[] = ["sky", "region", "stop"];
const CLOSE: readonly CameraTier[] = ["region", "stop"];

/** The side a post stands on: the route's left or right normal, whichever faces north (away from the camera). */
export function postSide(tangent: Point2): Point2 {
  let n: Point2 = [-tangent[1], tangent[0]];
  if (Math.abs(n[1]) < 0.25 ? n[0] < 0 : n[1] > 0) n = [-n[0], -n[1]];
  return n;
}

const isAttention = (s: Stop) =>
  (s.kind === "commitment" && (s.status === "overdue" || s.status === "needs-review")) ||
  (s.kind === "review" && s.reviewKind === "chapter-close" && (s.status === "close-due" || s.status === "waiting-on-you"));

/**
 * Posts that stand at Sky: crossroads first (real choices), then attention, then the next three, then milestones,
 * then other major stops; nearer to today first; at most `SKY_POST_LIMIT`. Returns post ids (cluster id for a
 * clustered stop, else the stop id; crossroads ids).
 */
export function skyPostIds(board: JourneyBoard): Set<string> {
  const postOf = (s: Stop) => board.clusters.find((c) => c.stopIds.includes(s.id))?.id ?? s.id;
  const dist = (date: string) => Math.abs(Date.parse(`${date}T12:00:00Z`) - Date.parse(`${board.today}T12:00:00Z`));
  type Cand = { id: string; rank: number; date: string };
  const cands: Cand[] = board.crossroads.map((c) => ({ id: c.id, rank: 0, date: c.date }));
  for (const s of board.stops) {
    const rank = isAttention(s) ? 1 : board.summary.next.includes(s.id) ? 2 : s.kind === "milestone" ? 3 : s.major ? 4 : -1;
    if (rank >= 0) cands.push({ id: postOf(s), rank, date: s.date });
  }
  cands.sort((a, b) => a.rank - b.rank || dist(a.date) - dist(b.date) || (a.id < b.id ? -1 : 1));
  const out = new Set<string>();
  for (const c of cands) { if (out.size >= SKY_POST_LIMIT) break; out.add(c.id); }
  return out;
}

export function boardMarks(board: JourneyBoard, route: RouteSpace): BoardMark[] {
  const marks: BoardMark[] = [];
  const dayOf = new Map(route.stretches.flatMap((s) => s.days.map((d) => [d.date, d] as const)));
  const monthOf = new Map(route.months.map((m) => [m.chapterId, m] as const));
  const sky = skyPostIds(board);
  const placeOf = (date: string, chapterId: string): { base: Point3; side: Point2 } | null => {
    const day = dayOf.get(date);
    if (day) return { base: day.at, side: postSide(day.tangent) };
    const month = monthOf.get(chapterId);
    return month ? { base: month.at, side: [0, -1] } : null;
  };

  // The piece stands on today's day space (or its month space).
  const piece = placeOf(board.piece.atDate, board.piece.anchorChapterId);
  if (piece) marks.push({ id: "piece", kind: "piece", base: piece.base, offset: [0, 0], head: HEADS.piece, tiers: ALL, chapterId: board.piece.anchorChapterId, date: board.piece.atDate });

  for (const m of route.months) marks.push({ id: m.chapterId, kind: "month", base: m.at, offset: [0, 0], head: HEADS.month, tiers: ALL, chapterId: m.chapterId, date: null });
  for (const s of route.stretches) {
    for (const d of s.days) marks.push({ id: d.date, kind: "day", base: d.at, offset: [0, 0], head: HEADS.day, tiers: CLOSE, chapterId: d.chapterId, date: d.date });
  }

  const clusterOf = new Map<string, string>();
  for (const c of board.clusters) {
    for (const id of c.stopIds) clusterOf.set(id, c.id);
    const at = placeOf(c.date, c.chapterId);
    if (!at) continue;
    marks.push({ id: c.id, kind: "cluster", base: at.base, offset: [at.side[0] * POST_OFFSET, at.side[1] * POST_OFFSET], head: HEADS.cluster, tiers: sky.has(c.id) ? ALL : CLOSE, chapterId: c.chapterId, date: c.date });
  }
  for (const s of board.stops) {
    const at = placeOf(s.date, s.chapterId);
    if (!at) continue;
    const post = clusterOf.get(s.id) ?? s.id;
    marks.push({
      id: s.id, kind: "stop", base: at.base, offset: [at.side[0] * POST_OFFSET, at.side[1] * POST_OFFSET],
      head: clusterOf.has(s.id) ? HEADS.cluster : HEADS.post, tiers: sky.has(post) ? ALL : CLOSE, chapterId: s.chapterId, date: s.date,
    });
  }
  // Crossroads stand on the other side of the route; several on one date stand in a short row along it.
  const onDate = new Map<string, number>();
  for (const x of board.crossroads) {
    const at = crossroadsPlace(x, placeOf);
    if (!at) continue;
    const k = onDate.get(x.date) ?? 0;
    onDate.set(x.date, k + 1);
    const along: Point2 = [at.side[1], -at.side[0]];
    const shift = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * CROSSROADS_SPACING;
    marks.push({
      id: x.id, kind: "crossroads", base: at.base,
      offset: [-at.side[0] * POST_OFFSET + along[0] * shift, -at.side[1] * POST_OFFSET + along[1] * shift],
      head: HEADS.crossroads, tiers: ALL, chapterId: x.chapterId, date: x.date,
    });
  }
  return marks;
}

function crossroadsPlace(x: Crossroads, placeOf: (date: string, chapterId: string) => { base: Point3; side: Point2 } | null) {
  return placeOf(x.date, x.chapterId);
}

/** The mark ids the board draws (piece, months, days, clusters, stops, crossroads) — the flat twin's `data-id`s. */
export function boardMarkIds(board: JourneyBoard, route: RouteSpace): string[] {
  return boardMarks(board, route).map((m) => m.id);
}
