/**
 * Guard runs (ROAD.md §2.5, §4.4): where a corridor's edge needs protection, what kind, and the line both the visible rail
 * kit (art track) and its collider (`solids.ts`) are built from. Retaining walls of cutting sides are runs too (kind
 * 'retaining': the wall is the edge there, CorridorEdge unchanged).
 *
 * - A guard wherever the drop 1.0–1.5 eu beyond the built edge exceeds CORRIDOR.guardDrop, except at a declared gap (a real
 *   opening: no rail or collider crosses it) and where a structure owns the road (its own rail: 'bridgeRail', not a run).
 * - Kind per context: mountain → stoneParapet; coastal, open, boulevard, developed → postRail; the outer side of a curve
 *   tighter than TIGHT_RADIUS in a coastal reach → stoneParapet. One kind per run.
 * - Runs of one kind merge across undeclared lulls shorter than MERGE_GAP; a run shorter than MIN_RUN extends along the
 *   road (it runs on to meet the ground) but never into a gap, a structure or another run.
 * - Ends: 'continues' onto a structure's rail; a stone parapet ends on a 'pier'; a post-and-rail 'flare's at a declared gap
 *   or a road end and is 'buried' where the ground comes up to meet it; a retaining wall ends at an 'abutment'.
 * - `line` is the rail's centre line at its base: `offset` beyond the centreline (the widest built edge of the run +
 *   CORRIDOR.guardSetback) at the ROAD SURFACE height of each station (the verge beside a drop is lower; the rail stands on
 *   the road's edge and the art carries its posts down to the ground). One point per station, lateral offsets pulled in on
 *   the inside of a tight curve exactly as the deck's (`lateralLine`).
 */
import type { HeightQuery, XYZ } from '../interfaces';
import { CORRIDOR, type CorridorStation, type GuardEnd, type GuardKind, type GuardRun } from './types';
import { builtEdge, lateralLine, type CorridorCore, type SideName } from './stations';
import { round3 } from './reaches';

/** Undeclared lulls shorter than this (eu, run end to run start) between two needs of one kind are bridged. */
export const MERGE_GAP = 6;
/** Built edges within this of each other (eu) carry one run (a kerb's width); a larger step starts a new run. */
export const EDGE_STEP = .3;
/** A run meeting an opening ends this far short of the opening's true edge (eu). */
export const GAP_CLEAR = .3;
/** Shortest guard or wall run (eu). */
export const MIN_RUN = 8;
/** An outer curve tighter than this radius (eu) in a coastal reach takes the stone parapet. */
export const TIGHT_RADIUS = 60;
/** A bank rising more than this within 1.5 eu of the built edge is a cutting: a retaining wall is the edge. */
export const CUTTING_RISE = .5;
/** Retaining wall: centre this far beyond the built edge, thickness, coping above the bank, foot below the road. */
export const RETAINING = Object.freeze({ setback: .3, thickness: .5, coping: .15, foot: .6 });

const owned = (st: CorridorStation, side: SideName) => !!st.structureId || st[side].edge === 'structure';
/** The guard (or wall) a station side needs, given the signed turn there (> 0: turning right, the left is the outer side). */
export function guardNeed(st: CorridorStation, side: SideName, turn: number): GuardKind {
  const s = st[side];
  // The Year Walk as the footway: its own outer edge (the walk's rail or wall) guards the drop beyond it (connect, never duplicate).
  if (owned(st, side) || s.gap || s.edge === 'yearWalk') return 'none';
  if (s.drop > CORRIDOR.guardDrop) {
    if (st.context === 'mountain') return 'stoneParapet';
    const outer: SideName = turn > 0 ? 'left' : 'right';
    if (st.context === 'coastal' && side === outer && Math.abs(turn) > 1 / TIGHT_RADIUS) return 'stoneParapet';
    return 'postRail';
  }
  if (-s.drop > CUTTING_RISE) return 'retaining';
  return 'none';
}
interface Span { a: number; b: number; kind: GuardKind }
function spansOf(kinds: readonly GuardKind[], order: readonly number[], sameEdge: (i: number, j: number) => boolean): Span[] {
  const out: Span[] = [];
  for (let i = 0; i < kinds.length;) { if (kinds[i] === 'none') { i++; continue; } let j = i; while (j + 1 < kinds.length && kinds[j + 1] === kinds[i] && sameEdge(order[j + 1]!, order[i]!)) j++; out.push({ a: i, b: j, kind: kinds[i]! }); i = j + 1; }
  return out;
}
/** Plans the guard and retaining runs of one corridor and sets each covered station side's `guard`. */
/** The top of a retaining wall at line point i: the highest ground across its thickness and the next 1.5 eu (the bank it
 * retains), plus its coping, and never lower than a kerb above the road. Shared by the run's `height` and its solid. */
export function retainingTop(core: CorridorCore, side: 'left' | 'right', offset: number, k: number, at: XYZ, ground: HeightQuery): number {
  const sign = side === 'left' ? -1 : 1;
  const bank = Math.max(ground(at[0], at[2]), ...[.25, .75, 1.5].map(o => { const p = lateralLine(core, round3(sign * (offset + o)))[k]!; return ground(p[0], p[2]); }));
  return round3(Math.max(at[1] + CORRIDOR.kerbRise, bank + RETAINING.coping));
}
export interface GuardEnv { ground: HeightQuery }
export function planGuards(core: CorridorCore, env: GuardEnv): GuardRun[] {
  const { stations, closed, step, turns } = core, n = stations.length, runs: GuardRun[] = [];
  if (n < 2) return runs;
  for (const side of ['left', 'right'] as const) {
    // A Year Walk side is a stop too: the walk's own edge guards its drop, and no run reaches across the walk.
    const need = stations.map((st, k) => guardNeed(st, side, turns[k] ?? 0)), blocked = stations.map(st => owned(st, side) || !!st[side].gap || st[side].edge === 'yearWalk');
    // One run stands at one built edge: a change of edge (a kerb, a sidewalk's back) of more than EDGE_STEP starts a new run.
    const edgeAt = stations.map(st => builtEdge(st[side])), sameEdge = (i: number, j: number) => Math.abs(edgeAt[i]! - edgeAt[j]!) <= EDGE_STEP;
    // A closed loop is walked from a station that needs nothing (a blocked one if there is one), so no run wraps the seam.
    let start = 0;
    if (closed) { const free = need.map((v, k) => v === 'none' ? k : -1).filter(k => k >= 0); start = free.find(k => blocked[k]) ?? free[0] ?? 0; }
    const order = Array.from({ length: n }, (_, i) => closed ? (start + i) % n : i), kinds = order.map(k => need[k]!), stop = order.map(k => blocked[k]!);
    // 1. Bridge short undeclared lulls between two needs of one kind.
    for (let i = 0; i + 1 < n; i++) {
      if (kinds[i] === 'none' || kinds[i + 1] !== 'none') continue;
      let j = i + 1; while (j < n && kinds[j] === 'none' && !stop[j]) j++;
      if (j < n && kinds[j] === kinds[i] && (j - i) * step < MERGE_GAP - 1e-9 && order.slice(i, j + 1).every(k => sameEdge(k, order[i]!))) for (let m = i + 1; m < j; m++) kinds[m] = kinds[i]!;
    }
    // 2. Extend short runs to MIN_RUN into free, unblocked stations (never into a gap, a structure or another run).
    const minStations = Math.ceil(MIN_RUN / step - 1e-9);
    for (const sp of spansOf(kinds, order, sameEdge)) {
      for (let grow = true; sp.b - sp.a < minStations && grow;) {
        grow = false;
        for (const k of [sp.b + 1, sp.a - 1]) {
          if (sp.b - sp.a >= minStations || k < 0 || k >= n || stop[k] || kinds[k] !== 'none' || !sameEdge(order[k]!, order[k > sp.b ? sp.b : sp.a]!)) continue;
          kinds[k] = sp.kind; if (k > sp.b) sp.b = k; else sp.a = k; grow = true;
        }
      }
    }
    // 3. One run per span; a span shorter than MIN_RUN between spans of its kind at another edge (a kerb station between two
    // sidewalk stations) joins its neighbour: the rail stands at the wider edge there rather than breaking.
    const spans = spansOf(kinds, order, sameEdge);
    for (let merged = true; merged;) {
      merged = false;
      for (let i = 0; i < spans.length; i++) {
        const sp = spans[i]!; if ((sp.b - sp.a + 1) * step >= MIN_RUN) continue;
        const prev = spans[i - 1], next = spans[i + 1], join = prev && prev.kind === sp.kind && prev.b + 1 === sp.a ? prev : next && next.kind === sp.kind && next.a === sp.b + 1 ? next : undefined;
        if (!join) continue;
        join.a = Math.min(join.a, sp.a); join.b = Math.max(join.b, sp.b); spans.splice(i, 1); merged = true; break;
      }
    }
    let index = 0;
    for (const sp of spans) {
      const ks = order.slice(sp.a, sp.b + 1), retaining = sp.kind === 'retaining', sign = side === 'left' ? -1 : 1;
      const offset = round3(Math.max(...ks.map(k => builtEdge(stations[k]![side]))) + (retaining ? RETAINING.setback : CORRIDOR.guardSetback));
      const lat = lateralLine(core, sign * offset), line: XYZ[] = ks.map(k => { const p = lat[k]!; return [round3(p[0]), round3(p[1]), round3(p[2])]; }), at = [...ks];
      // A run that meets an opening runs on to the opening's true edge (GAP_CLEAR short of it), not a station short of it.
      let from = stations[ks[0]!]!.s, to = stations[ks.at(-1)!]!.s;
      const reachGap = (end: 'start' | 'end') => {
        if (retaining) return;
        const i = end === 'end' ? sp.b + 1 : sp.a - 1, k = i >= 0 && i < n ? order[i] : undefined; if (k === undefined || !stations[k]![side].gap) return;
        // Walk from the run's end station toward the opening in eighth steps: the rail runs on while the ground beyond the edge
        // still drops, and stops GAP_CLEAR short of where the opening begins.
        const k0 = end === 'end' ? ks.at(-1)! : ks[0]!, a = stations[k0]!, b = stations[k]!, e = builtEdge(a[side]);
        let open = 1;
        for (let q = 1; q <= 8; q++) { const t = q / 8, x = a.at[0] + (b.at[0] - a.at[0]) * t, z = a.at[2] + (b.at[2] - a.at[2]) * t, y = a.at[1] + (b.at[1] - a.at[1]) * t; if (core.opensAt?.(side, x, z, y, a.tangent, e) ?? true) { open = t; break; } }
        const t = Math.min(.98, open - GAP_CLEAR / step); if (!(t > .02)) return;
        const la = lat[k0]!, lb = lat[k]!, p: XYZ = [round3(la[0] + (lb[0] - la[0]) * t), round3(la[1] + (lb[1] - la[1]) * t), round3(la[2] + (lb[2] - la[2]) * t)], total = core.total ?? Infinity;
        const sAt = a.s + (end === 'end' ? 1 : -1) * step * t, wrapped = round3(closed ? ((sAt % total) + total) % total : sAt);
        if (end === 'end') { line.push(p); at.push(k0); to = wrapped; } else { line.unshift(p); at.unshift(k0); from = wrapped; }
      };
      reachGap('start'); reachGap('end');
      if (line.length < 2) continue;
      const end = (i: number): GuardEnd => {
        if (retaining) return 'abutment';
        const k = i < 0 || i >= n ? undefined : order[i];
        if (k === undefined) return sp.kind === 'stoneParapet' ? 'pier' : 'flare';
        if (owned(stations[k]!, side)) return 'continues';
        if (sp.kind === 'stoneParapet') return 'pier';
        return stations[k]![side].gap ? 'flare' : 'buried';
      };
      // A closed loop's walk has no ends of its own: the station before index 0 is the last in the order.
      const before = sp.a > 0 ? sp.a - 1 : closed ? n - 1 : -1, after = sp.b + 1 < n ? sp.b + 1 : closed ? 0 : n;
      index++;
      const tag = `${side === 'left' ? 'L' : 'R'}.${index}`, height = retaining ? round3(Math.max(...line.map((p, i) => retainingTop(core, side, offset, at[i]!, p, env.ground) - p[1]))) : sp.kind === 'stoneParapet' ? CORRIDOR.stoneParapetHeight : CORRIDOR.postRailHeight;
      const run: GuardRun = { id: `${core.id}.guard.${tag}`, side, kind: sp.kind, from, to, offset, height, line, ends: [end(before), end(after)], colliderId: `${core.id}.corridor.${retaining ? 'retaining' : 'guard'}.${tag}` };
      runs.push(run); lineStations.set(run, at);
      for (const k of ks) stations[k]![side].guard = sp.kind;
    }
  }
  return runs;
}
/** Bake-side: the station each point of a run's line belongs to (an end point run on to an opening belongs to its end station). */
const lineStations = new WeakMap<GuardRun, number[]>();
/** The station index of each point of a run's line, in order (a closed loop's run may wrap past the last station). */
export function runStations(core: Pick<CorridorCore, 'stations' | 'closed'>, run: GuardRun): number[] {
  const known = lineStations.get(run); if (known) return known;
  const n = core.stations.length, first = core.stations.findIndex(st => Math.abs(st.s - run.from) < 1e-6);
  return first < 0 ? [] : Array.from({ length: run.line.length }, (_, i) => core.closed ? (first + i) % n : first + i);
}
