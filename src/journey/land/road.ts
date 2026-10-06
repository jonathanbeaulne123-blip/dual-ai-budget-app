/**
 * The road's spans at map scale (ROAD.md §7; pure, no three): each baked bridge prepared for drawing (plan axis, arc
 * lengths, compressed deck tops, the map-mesh detail it keeps), where a point lies against a deck, and how far the clay
 * road blends onto it. The clay land (`clay.ts`) lays its plank decks and lifts the carried roads from these.
 */
import type { JourneyLandData, Point2, Point3 } from "../contracts.ts";
import { compressHeight } from "../contracts.ts";
import { projectOnSegment } from "./simplify.ts";

/** A carried line point this far (eu) beyond a deck's side still counts as on it. */
export const DECK_SIDE_SLACK = 1;
/** Approach ramps: the clay road blends from the deck to the ground over this distance (eu) past the deck. */
export const RAMP_EU = 14;

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
