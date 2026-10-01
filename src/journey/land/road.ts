/**
 * The road at map scale (ROAD.md §7; pure, no three): every drawn line cut into runs, classified against the road's
 * spans, covered stretches and boulevard reaches, with the drawn height of every vertex.
 *
 * - A line a bridge CARRIES (`bridge.lineIds`) rises onto the deck: vertices over the deck take the deck's height, and
 *   a short approach ramp blends back to the ground past the deck's ends and sides. Those vertices form DECK runs,
 *   drawn with the bridge (`bridges.ts`), so the road reads as crossing on the bridge, not painted on the water.
 * - A line that passes UNDER a deck (`bridge.underIds`: the ferry, a river run, a lower skate lane) is broken beneath it.
 * - A road stretch under cover (a tunnel, the Prow gallery) is flagged `covered`: drawn dimmed and dashed, with a short
 *   darker, wider `notch` at each portal.
 * - A boulevard reach is flagged `plant` (1 = planted median, 2 = planted verges): a wider road with a green inset.
 *
 * Every other vertex is draped exactly as before (`surfaceAt + LINE_LIFT`): GROUND runs, drawn by `lines.ts`.
 * The board overlay never reads any of this: the route, stations and spaces are laid out from the stations alone.
 */
import type { JourneyLandData, LandLineKind, Point2, Point3 } from "../contracts.ts";
import { compressHeight } from "../contracts.ts";
import { isMinorLine, LINE_TOLERANCE } from "./extract.ts";
import { arcOf, densify, projectOnSegment, simplifyLine } from "./simplify.ts";
import type { LandSurface } from "./surface.ts";

/** Longest ribbon segment (eu) before draping: one terrain lattice step. */
export const DRAPE_STEP = 20;
/** Height (eu) above the drawn surface per line kind (ground runs). */
export const LINE_LIFT: Readonly<Record<LandLineKind, number>> = { road: 0.6, skate: 0.7, walk: 0.6, cable: 0.9, rail: 0.65, ferry: 0.3, row: 0.3 };
/** A carried line rides this far above the deck top. */
export const DECK_LINE_LIFT = 0.3;
/** A line point this far (eu) beyond a deck's side still counts as on it. */
export const DECK_SIDE_SLACK = 1;
/** Approach ramps: a carried line blends from the deck to the ground over this distance (eu) past the deck. */
export const RAMP_EU = 14;
/** A line under a deck is broken this far (eu) beyond the deck's footprint, so it visibly passes beneath. */
export const UNDER_MARGIN_EU = 2.5;
/** Near a bridge, lines are sampled this finely (eu) so the ramp and the break are exact. */
const REFINE_STEP = 3;
const REFINE_REACH = RAMP_EU + 24;
const EPS = 1e-6;
/** Half length (eu, along the line) of a portal notch. */
export const NOTCH_EU = 1.6;

/** Map mesh error bounds, much tighter than Journey's 4m line simplification.
 * Full source axes still own underpasses, road draping, lengths and pier placement. */
export const BRIDGE_DRAW_ERROR = {plan: .15, height: .02} as const;
/** Retained source indices only: exact endpoints and source XYZ, no fitted/moved vertices.
 * Judge height against the chord at plan projection, so a straight but humped deck cannot flatten.
 * Reject projected reversals; then the bounds also hold between consecutive source vertices. */
export function bridgeDrawIndices(axis: readonly Point3[]): number[] {
  if (axis.length < 3) return axis.map((_, i) => i);
  const keep = new Set([0, axis.length - 1]), stack: [number, number][] = [[0, axis.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!, a = axis[first]!, b = axis[last]!;
    const dx = b[0] - a[0], dz = b[2] - a[2], length2 = dx * dx + dz * dz;
    let worst = 1, split = -1, previousT = 0;
    for (let i = first + 1; i < last; i++) {
      const p = axis[i]!, t = length2 ? ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / length2 : 0;
      const u = Math.max(0, Math.min(1, t));
      const plan = Math.hypot(p[0] - a[0] - u * dx, p[2] - a[2] - u * dz);
      const height = Math.abs(p[1] - a[1] - u * (b[1] - a[1]));
      const error = t < previousT || t > 1 ? Infinity : Math.max(plan / BRIDGE_DRAW_ERROR.plan, height / BRIDGE_DRAW_ERROR.height);
      if (error > worst) { worst = error; split = i; }
      previousT = t;
    }
    if (split >= 0) { keep.add(split); stack.push([first, split], [split, last]); }
  }
  return [...keep].sort((a, b) => a - b);
}

/** A bridge prepared for drawing: plan axis with arc lengths, compressed deck top per axis point. */
export type BridgePlan = {
  id: string;
  width: number;
  half: number;
  plan: Point2[];
  arc: number[];
  length: number;
  /** Compressed deck top (board space) per axis point. */
  tops: number[];
  /** Optional map-mesh detail only; every relationship keeps reading the full arrays above. */
  drawIndices?: readonly number[];
  lineIds: ReadonlySet<string>;
  underIds: ReadonlySet<string>;
};

export function planBridges(data: Pick<JourneyLandData, "bridges">): BridgePlan[] {
  return (data.bridges ?? []).flatMap((b) => {
    if (b.axis.length < 2 || !(b.width > 0)) return [];
    const plan = b.axis.map((p) => [p[0], p[2]] as const);
    const arc = [0];
    for (let i = 1; i < plan.length; i++) arc.push(arc[i - 1]! + Math.hypot(plan[i]![0] - plan[i - 1]![0], plan[i]![1] - plan[i - 1]![1]));
    const length = arc[arc.length - 1]!;
    if (!(length > 0)) return [];
    return [{ id: b.id, width: b.width, half: b.width / 2, plan, arc, length, drawIndices: bridgeDrawIndices(b.axis), tops: b.axis.map((p) => compressHeight(p[1])), lineIds: new Set(b.lineIds), underIds: new Set(b.underIds ?? []) }];
  });
}

/**
 * Where (x, z) lies relative to a bridge's axis: `along` (eu of arc, extrapolated below 0 / above length on the end
 * segments), `lateral` (unsigned distance from the axis line), and the deck top there (clamped to the ends).
 */
export function locateOnBridge(b: BridgePlan, x: number, z: number): { along: number; lateral: number; top: number } {
  let best = Infinity, seg = 0, bestT = 0;
  for (let i = 1; i < b.plan.length; i++) {
    const pr = projectOnSegment([x, z], b.plan[i - 1]!, b.plan[i]!), t = Math.min(Math.max(pr.t, 0), 1);
    const a = b.plan[i - 1]!, c = b.plan[i]!;
    const d = Math.hypot(a[0] + (c[0] - a[0]) * t - x, a[1] + (c[1] - a[1]) * t - z);
    if (d < best) { best = d; seg = i; bestT = pr.t; }
  }
  const a = b.plan[seg - 1]!, c = b.plan[seg]!, pr = projectOnSegment([x, z], a, c), len = b.arc[seg]! - b.arc[seg - 1]!;
  let along: number, lateral: number;
  if (seg === 1 && bestT < 0) { along = bestT * len; lateral = Math.abs(pr.lateral); }
  else if (seg === b.plan.length - 1 && bestT > 1) { along = b.length + (bestT - 1) * len; lateral = Math.abs(pr.lateral); }
  else { along = b.arc[seg - 1]! + Math.min(Math.max(bestT, 0), 1) * len; lateral = best; }
  return { along, lateral, top: topAt(b, along) };
}

/** Compressed deck top at an arc position (clamped to the deck). */
export function topAt(b: BridgePlan, along: number): number {
  const s = Math.min(Math.max(along, 0), b.length);
  for (let i = 1; i < b.arc.length; i++) {
    if (s <= b.arc[i]! || i === b.arc.length - 1) {
      const len = b.arc[i]! - b.arc[i - 1]!, t = len > 0 ? (s - b.arc[i - 1]!) / len : 0;
      return b.tops[i - 1]! + (b.tops[i]! - b.tops[i - 1]!) * Math.min(Math.max(t, 0), 1);
    }
  }
  return b.tops[b.tops.length - 1]!;
}

/** 1 on the deck, falling to 0 over the ramp past its ends and sides. */
export function deckBlend(b: BridgePlan, where: { along: number; lateral: number }): number {
  const over = Math.max(-where.along, where.along - b.length, 0), side = Math.max(where.lateral - (b.half + DECK_SIDE_SLACK), 0);
  return 1 - Math.min(Math.max(Math.max(over, side) / RAMP_EU, 0), 1);
}

/** Is (along, lateral) under the deck, with the break margin? */
export function underDeck(b: BridgePlan, where: { along: number; lateral: number }): boolean {
  return where.along >= -UNDER_MARGIN_EU && where.along <= b.length + UNDER_MARGIN_EU && where.lateral <= b.half + UNDER_MARGIN_EU;
}

export type RoadVertex = {
  x: number; z: number; y: number;
  /** Arc length (eu) along the drawn line (dash phase). */
  arc: number;
  /** 0 = on the ground, 1 = on a deck (0…1 on its ramps). */
  deck: number;
  covered: boolean;
  /** 0 = none, 1 = planted median, 2 = planted verges. */
  plant: 0 | 1 | 2;
  /** A tunnel / gallery portal. */
  notch: boolean;
};
export type RoadRun = { lineId: string; kind: LandLineKind; minor: boolean; verts: RoadVertex[] };
export type RoadPlan = {
  /** Draped runs (lines.ts, the major / minor meshes). */
  ground: RoadRun[];
  /** Runs on bridge decks and their approach ramps (lines.ts, the deck mesh drawn over the bridges). */
  deck: RoadRun[];
  bridges: BridgePlan[];
};

type Range = { from: number; to: number; wrap: boolean; value: number };
const inRange = (r: Range, s: number) => (r.wrap ? s >= r.from || s <= r.to : s >= r.from && s <= r.to);

/** Arc ranges on a drawn line for a stretch given by its first and last plan points. */
function rangeOn(points: readonly Point2[], closed: boolean, first: Point2, last: Point2, value: number): Range {
  const a = arcOf(points, first), b = arcOf(points, last);
  if (a <= b) return { from: a, to: b, wrap: false, value };
  return closed ? { from: a, to: b, wrap: true, value } : { from: b, to: a, wrap: false, value };
}

/** Insert duplicated points at the given arc positions (the first copy slightly before, the second slightly after). */
function withCuts(path: readonly Point2[], cuts: readonly number[]): { p: Point2; arc: number; key: number }[] {
  const out: { p: Point2; arc: number; key: number }[] = [];
  const sorted = [...new Set(cuts)].sort((m, n) => m - n);
  let run = 0, k = 0;
  out.push({ p: path[0]!, arc: 0, key: 0 });
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (k < sorted.length && sorted[k]! < run + len) {
      const s = sorted[k]!;
      if (s > run) {
        const t = (s - run) / len, p: Point2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        out.push({ p, arc: s, key: s - EPS }, { p, arc: s, key: s + EPS });
      }
      k++;
    }
    run += len;
    out.push({ p: b, arc: run, key: run });
  }
  return out;
}

/** Densify, then refine segments near any of these bridges to REFINE_STEP. */
function drape(points: readonly Point2[], near: readonly BridgePlan[]): Point2[] {
  const coarse = densify(points, DRAPE_STEP);
  if (!near.length) return coarse;
  const close = (p: Point2) => near.some((b) => { const w = locateOnBridge(b, p[0], p[1]); return w.along > -REFINE_REACH && w.along < b.length + REFINE_REACH && w.lateral < b.half + REFINE_REACH; });
  const out: Point2[] = [coarse[0]!];
  for (let i = 1; i < coarse.length; i++) {
    const a = coarse[i - 1]!, b = coarse[i]!;
    if (close(a) || close(b)) out.push(...densify([a, b], REFINE_STEP).slice(1)); else out.push(b);
  }
  return out;
}

/**
 * Plan every drawn line (at the tier's simplification) into ground and deck runs. Pure and deterministic.
 */
export function planRoad(data: JourneyLandData, surface: Pick<LandSurface, "surfaceAt">, tier: "full" | "lite"): RoadPlan {
  const bridges = planBridges(data);
  const ground: RoadRun[] = [], deck: RoadRun[] = [];
  const covers = data.covers ?? [], boulevards = data.boulevards ?? [];
  for (const line of data.lines) {
    const points = tier === "lite" ? simplifyLine(line.points, LINE_TOLERANCE.lite) : line.points;
    if (points.length < 2) continue;
    const carriers = bridges.filter((b) => b.lineIds.has(line.id)), overs = bridges.filter((b) => b.underIds.has(line.id));
    const path = drape(points, [...carriers, ...overs]);
    const closed = path.length > 2 && path[0]![0] === path[path.length - 1]![0] && path[0]![1] === path[path.length - 1]![1];
    const coverRanges = line.kind === "road" ? covers.filter((c) => c.lineId === line.id && c.portals.length === 2).map((c) => rangeOn(path, closed, c.portals[0]!, c.portals[1]!, 1)) : [];
    const plantRanges = line.kind === "road" ? boulevards.filter((b) => b.lineId === line.id && b.points.length >= 2).map((b) => rangeOn(path, closed, b.points[0]!, b.points[b.points.length - 1]!, b.median ? 1 : 2)) : [];
    const notchRanges = coverRanges.flatMap((r) => [r.from, r.to].map((s) => ({ from: s - NOTCH_EU, to: s + NOTCH_EU, wrap: false, value: 1 })));
    const cuts = [...coverRanges, ...plantRanges, ...notchRanges].flatMap((r) => [r.from, r.to]).filter((s) => s > 0);
    const samples = withCuts(path, cuts);
    const lift = LINE_LIFT[line.kind];
    const minor = line.kind === "road" && isMinorLine(line.id);
    const verts: (RoadVertex & { drop: boolean })[] = samples.map(({ p, arc, key }) => {
      const base = surface.surfaceAt(p[0], p[1]) + lift;
      let blend = 0, top = 0, drop = false;
      for (const b of carriers) {
        const where = locateOnBridge(b, p[0], p[1]), d = deckBlend(b, where);
        if (d > blend) { blend = d; top = where.top; }
      }
      for (const b of overs) if (underDeck(b, locateOnBridge(b, p[0], p[1]))) drop = true;
      const plant = plantRanges.find((r) => inRange(r, key))?.value ?? 0;
      return {
        x: p[0], z: p[1], y: blend > 0 ? base + (top + DECK_LINE_LIFT - base) * blend : base, arc, deck: blend,
        covered: coverRanges.some((r) => inRange(r, key)), plant: plant as 0 | 1 | 2, notch: notchRanges.some((r) => inRange(r, key)), drop,
      };
    });
    // Runs: ground = neither dropped nor on a deck; deck = on a deck or its ramp, plus the ground vertex either side.
    const strip = ({ drop: _drop, ...v }: RoadVertex & { drop: boolean }): RoadVertex => v;
    let current: RoadVertex[] = [];
    const flush = (into: RoadRun[]) => { if (current.length >= 2) into.push({ lineId: line.id, kind: line.kind, minor, verts: current }); current = []; };
    for (let i = 0; i < verts.length; i++) { const v = verts[i]!; if (!v.drop && v.deck === 0) current.push(strip(v)); else flush(ground); }
    flush(ground);
    for (let i = 0; i < verts.length; i++) {
      const v = verts[i]!;
      if (!v.drop && v.deck > 0) {
        if (!current.length && i > 0 && !verts[i - 1]!.drop) current.push(strip(verts[i - 1]!));
        current.push(strip(v));
        if (i + 1 < verts.length && verts[i + 1]!.deck === 0 && !verts[i + 1]!.drop) { current.push(strip(verts[i + 1]!)); flush(deck); }
      } else flush(deck);
    }
    flush(deck);
  }
  return { ground, deck, bridges };
}
