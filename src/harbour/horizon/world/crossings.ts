import type { Point2, Point3, Crossing, Line } from './definition.ts';
import type { LandCuts, BedCut, StructureSolid, WaterCut } from '../land/interfaces.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { closestOnPolyline, mixPoint, pointInPolygon, padOutline, raySolid, segmentIntersections, solidBounds, solidVerticalRangeAt } from './geometry.ts';

export interface Centreline { id: string; sourceId?: string; points: readonly Point3[]; clearHeight: number; kind: string; structureIds: string[] }
export interface Intersection { a: string; b: string; sourceA?: string; sourceB?: string; at: Point2; heightA: number; heightB: number; segmentA: number; segmentB: number; overlap: boolean; /** Collinear run collapsed into this record (R1-103), plan length in eu. */ overlapLength?: number }
/**
 * Proof classes (R1-11 vocabulary, R1-88):
 * - crossing: two routes meet; over/under need headroom from the LOWER SURFACE to the UPPER UNDERSIDE, a threshold needs a pad, marker and kerb gap;
 * - junction: two foot routes meet flush (≤ 0.5 eu): a path junction needs no marker or mode change;
 * - sharedStretch: two routes run collinear at one height (one record per run, not one per segment);
 * - footway: the Year Walk on a stretch MANIFEST `journey.yearWalk.shares` makes a footway of its host bed;
 * - waterBody: a bed runs inside a lake, lagoon or the sea OUTLINE without clearing its surface;
 * - waterConfluence / modeTransfer: as before.
 */
export type CrossingKind = 'crossing' | 'junction' | 'sharedStretch' | 'footway' | 'waterBody' | 'waterConfluence' | 'modeTransfer';
export interface CrossingProof extends Intersection { id: string; resolution: Crossing['resolution']; kind?: CrossingKind; manifestIndex?: number; registered: boolean; proposed: boolean; separation: number; clearHeight?: number; requiredClearance: number; clearancePass: boolean; structureIds: string[]; built: boolean; padId?: string; markerId?: string; kerbGap?: boolean; waterBodyIds?: string[]; moverPending?: boolean; note?: string; matchDistance?: number }
/** Register rows match a computed intersection only within this distance of the authored point or corridor (was 65 eu, R1-38). */
export const CROSSING_MATCH_EU = 10;
/** The thinnest upper deck STYLE §1.6 allows; headroom falls back to (upper centreline − this) when no deck solid is found. */
export const DECK_MIN_THICKNESS_EU = 0.6;
const FOOT = new Set(['walk', 'trail', 'boardwalk', 'stair']);
const canonical = (id: string): string => ({ 'Crown Road': 'V02', 'river mouth': 'river lower', 'water.river.upper': 'river upper', 'water.river.lower': 'river lower', 'water.brook': 'brook', 'water wash': 'wash', 'water.wash': 'wash', 'water.reach.1': 'reachChannel.1', 'water.reach.2': 'reachChannel.2', 'Reach west channel': 'reachChannel.1', 'Reach east channel': 'reachChannel.2', 'S1 finish': 'S1' }[id] ?? id);
function matches(name: string, id: string): boolean { return name.split('+').some(part => canonical(part.trim()) === canonical(id)); }
function camel(value: string): string { const words = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/); return words.map((w, i) => i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)).join(''); }
/** Arc length along a polyline to a plan point on segment `segment`. */
function arcAt(points: readonly Point3[], segment: number, at: Point2): number { let arc = 0; for (let i = 1; i <= segment && i < points.length; i++) arc += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![2] - points[i - 1]![2]); const p = points[segment]!; return arc + Math.hypot(at[0] - p[0], at[1] - p[2]); }
/**
 * Stable crossing ids (R1-68, CONTRACT §2.13). `cross.<a>.<b>.<n>`: the two route names in alphabetical
 * order (camel-cased) and the ordinal of this meeting along the first route (1 = nearest its start). The id
 * depends on WHICH routes meet and in what order along the route, never on coordinates or heights, so a
 * no-op re-bake or a centimetre move keeps every id; only a new or removed meeting of the same pair
 * renumbers that pair. Pads, markers, decks and lamps derived from a crossing (`crossing.<id>…`,
 * `<threshold>.lamp`) inherit the stability.
 */
export function stableCrossingIds(hits: readonly Intersection[], lines: ReadonlyMap<string, Centreline>): string[] {
  const keyed = hits.map((hit, index) => { const names = [hit.a, hit.b].sort(), first = names[0] === hit.a ? { id: hit.sourceA ?? hit.a, seg: hit.segmentA } : { id: hit.sourceB ?? hit.b, seg: hit.segmentB }, second = first.id === (hit.sourceA ?? hit.a) ? { id: hit.sourceB ?? hit.b, seg: hit.segmentB } : { id: hit.sourceA ?? hit.a, seg: hit.segmentA }; const l1 = lines.get(first.id), l2 = lines.get(second.id); return { index, pair: `cross.${camel(names[0]!)}.${camel(names[1]!)}`, arc1: l1 ? arcAt(l1.points, first.seg, hit.at) : 0, arc2: l2 ? arcAt(l2.points, second.seg, hit.at) : 0 }; });
  const ids: string[] = new Array(hits.length), groups = new Map<string, typeof keyed>();
  for (const k of keyed) (groups.get(k.pair) ?? groups.set(k.pair, []).get(k.pair)!).push(k);
  for (const [pair, group] of groups) group.sort((a, b) => a.arc1 - b.arc1 || a.arc2 - b.arc2).forEach((k, n) => { ids[k.index] = `${pair}.${n + 1}`; });
  return ids;
}
/** A stable key for a MANIFEST crossing row (its route names, then its ordinal among rows of that pair), never its list index. */
export function registerRowKey(index: number, rows: readonly { a: string; b: string }[] = HORIZON_MANIFEST.crossings): string {
  const row = rows[index]!, pair = (r: { a: string; b: string }) => [camel(r.a), camel(r.b)].join('.'), key = pair(row);
  return `crossing.${key}.${rows.slice(0, index + 1).filter(r => pair(r) === key).length}`;
}
export function collectCentrelines(cuts: LandCuts, lines: readonly Line[] = [], raw = false): Centreline[] {
  const physicalOwner = (b: BedCut) => { if (b.id.startsWith('structure.')) { const name = b.id.slice('structure.'.length), source = cuts.solids.find(s => s.id.startsWith(`${name}.`) && s.role === 'deck' && s.bedIds.length === 1); if (source) return source.bedIds[0]!; } return ({ prowTunnel: 'V01', shoulderTunnel: 'V02', duneCulvert: 'S4' } as Record<string, string>)[b.id] ?? b.id; };
  const out: Centreline[] = cuts.beds.filter(b => b.points.length > 1).map(b => ({ id: raw ? b.id : canonical(physicalOwner(b)), sourceId: b.id, points: b.points, clearHeight: b.clearHeight, kind: b.kind, structureIds: b.structureIds }));
  for (const line of lines) if (line.points.length > 1 && !out.some(c => c.sourceId === line.id || c.id === line.id)) out.push({ id: !raw && line.id === 'RIVER_RUN' ? 'river lower' : line.id, sourceId: line.id, points: line.points, clearHeight: line.mode === 'gondola' ? 8 : line.mode === 'ferry' || line.mode === 'row' ? 4 : 1.25, kind: line.mode, structureIds: [] });
  for (const water of cuts.waters) if (water.points.length > 1) out.push({ id: raw ? water.id : canonical(water.id), sourceId: water.id, points: water.points, clearHeight: water.kind === 'brook' || water.kind === 'dry' ? 1.25 : 4, kind: water.kind === 'dry' ? 'dry' : 'water', structureIds: [] });
  return out;
}
/** Spatial bins reduce candidate pairs only. Exact segment tests decide every intersection. */
export function computeIntersections(lines: readonly Centreline[]): Intersection[] {
  const segments: { line: number; segment: number; a: Point3; b: Point3 }[] = [], bins = new Map<string, number[]>();
  lines.forEach((line, l) => { for (let i = 1; i < line.points.length; i++) { const a = line.points[i - 1]!, b = line.points[i]!, n = segments.length; segments.push({ line: l, segment: i - 1, a, b }); for (let z = Math.floor(Math.min(a[2], b[2]) / 64); z <= Math.floor(Math.max(a[2], b[2]) / 64); z++) for (let x = Math.floor(Math.min(a[0], b[0]) / 64); x <= Math.floor(Math.max(a[0], b[0]) / 64); x++) { const key = `${x}:${z}`, bucket = bins.get(key) ?? []; bucket.push(n); bins.set(key, bucket); } } });
  const visited = new Set<string>(), result = new Map<string, Intersection>();
  for (const bucket of bins.values()) for (let i = 0; i < bucket.length; i++) for (let j = i + 1; j < bucket.length; j++) { const ai = bucket[i]!, bi = bucket[j]!, sa = segments[ai]!, sb = segments[bi]!; if (sa.line === sb.line) continue; const pair = `${Math.min(ai, bi)}:${Math.max(ai, bi)}`; if (visited.has(pair)) continue; visited.add(pair);
    const first = sa.line < sb.line ? sa : sb, second = sa.line < sb.line ? sb : sa, a = lines[first.line]!, b = lines[second.line]!;
    // A structural deck and its source bed are one route. Intersections with every other route remain tested.
    if (a.id === b.id) continue;
    for (const hit of segmentIntersections(first.a, first.b, second.a, second.b)) {
      const p = mixPoint(first.a, first.b, hit.t), q = mixPoint(second.a, second.b, hit.u), key = `${a.id}|${b.id}|${hit.at[0].toFixed(3)}|${hit.at[1].toFixed(3)}|${p[1].toFixed(3)}|${q[1].toFixed(3)}`;
      const previous = result.get(key); result.set(key, { a: a.id, b: b.id, sourceA: a.sourceId ?? a.id, sourceB: b.sourceId ?? b.id, at: hit.at, heightA: p[1], heightB: q[1], segmentA: first.segment, segmentB: second.segment, overlap: hit.overlap || previous?.overlap === true });
    }
  }
  return [...result.values()].sort((a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b) || a.at[0] - b.at[0] || a.at[1] - b.at[1]);
}
/** Collapse chained collinear overlap hits of one pair into one record at the run's middle (R1-103). */
export function collapseOverlapRuns(hits: readonly Intersection[], lines: ReadonlyMap<string, Centreline>, gap = 1): Intersection[] {
  const out: Intersection[] = [], runs = new Map<string, Intersection[]>();
  for (const hit of hits) { if (!hit.overlap) { out.push(hit); continue; } const key = `${hit.sourceA ?? hit.a}|${hit.sourceB ?? hit.b}`; (runs.get(key) ?? runs.set(key, []).get(key)!).push(hit); }
  for (const group of runs.values()) {
    const line = lines.get(group[0]!.sourceA ?? group[0]!.a), other = lines.get(group[0]!.sourceB ?? group[0]!.b), arc = (h: Intersection) => line ? arcAt(line.points, h.segmentA, h.at) : 0;
    const sorted = group.map(h => ({ h, s: arc(h) })).sort((a, b) => a.s - b.s);
    // Two consecutive overlap hits belong to one run when the stretch between them lies on both routes.
    const joined = (p: Intersection, q: Intersection) => { if (Math.hypot(q.at[0] - p.at[0], q.at[1] - p.at[1]) <= gap) return true; if (!other) return false; const m: Point2 = [(p.at[0] + q.at[0]) / 2, (p.at[1] + q.at[1]) / 2]; return closestOnPolyline(other.points, m[0], m[1]).distance < .05 && (!line || closestOnPolyline(line.points, m[0], m[1]).distance < .05); };
    let run: typeof sorted = [];
    const flush = () => { if (!run.length) return; const mid = run[Math.floor(run.length / 2)]!.h; out.push({ ...mid, overlapLength: run.at(-1)!.s - run[0]!.s }); run = []; };
    for (const item of sorted) { if (run.length && !joined(run.at(-1)!.h, item.h)) flush(); run.push(item); }
    flush();
  }
  return out.sort((a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b) || a.at[0] - b.at[0] || a.at[1] - b.at[1]);
}
/**
 * Beds against water OUTLINES (R1-01 part, R1-103): a bed run whose surface does not clear a lake, lagoon or
 * sea surface by 0.5 eu is a meeting with that water body, recorded once per wet run at its middle.
 */
export function waterOutlineIntersections(beds: readonly Centreline[], waters: readonly WaterCut[], wetAt: (w: WaterCut, x: number, z: number) => number | null, step = 2): Intersection[] {
  const out: Intersection[] = [], bodies = waters.filter(w => !w.underground && ['lake', 'lagoon', 'sea'].includes(w.kind));
  for (const bed of beds) {
    if (['water', 'dry', 'row', 'ferry', 'cable'].includes(bed.kind)) continue;
    for (const w of bodies) {
      let run: { at: Point2; h: number; seg: number }[] = [];
      const flush = () => { if (run.length) { const mid = run[Math.floor(run.length / 2)]!; out.push({ a: bed.id, b: canonical(w.id), sourceA: bed.sourceId ?? bed.id, sourceB: w.id, at: mid.at, heightA: mid.h, heightB: w.level, segmentA: mid.seg, segmentB: 0, overlap: run.length > 1, overlapLength: (run.length - 1) * step }); run = []; } };
      for (let i = 1; i < bed.points.length; i++) {
        const a = bed.points[i - 1]!, b = bed.points[i]!, n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / step));
        for (let k = i === 1 ? 0 : 1; k <= n; k++) { const p = mixPoint(a, b, k / n), level = wetAt(w, p[0], p[2]); if (level !== null && p[1] < level + .5) run.push({ at: [p[0], p[2]], h: p[1], seg: i - 1 }); else flush(); }
      }
      flush();
    }
  }
  return out;
}
/** Plan segments of a route's own centreline within `reach` eu (by plan arc) of `at`, clamped to the route's ends. */
export function approachMouth(points: readonly Point3[], at: Point2, reach: number): [Point2, Point2][] {
  const arcs = [0]; for (let i = 1; i < points.length; i++) arcs.push(arcs[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![2] - points[i - 1]![2]));
  const near = closestOnPolyline(points, at[0], at[1]), a = points[near.segment]!, b = points[Math.min(points.length - 1, near.segment + 1)]!;
  const hitArc = arcs[near.segment]! + Math.hypot(b[0] - a[0], b[2] - a[2]) * near.t, lo = Math.max(0, hitArc - reach), hi = Math.min(arcs.at(-1)!, hitArc + reach);
  const at2 = (arc: number): Point2 => { let i = 1; while (i < points.length - 1 && arcs[i]! < arc) i++; const p = points[i - 1]!, q = points[i]!, span = arcs[i]! - arcs[i - 1]! || 1, t = Math.max(0, Math.min(1, (arc - arcs[i - 1]!) / span)); return [p[0] + (q[0] - p[0]) * t, p[2] + (q[2] - p[2]) * t]; };
  const stops = [lo, ...arcs.filter(x => x > lo && x < hi), hi], out: [Point2, Point2][] = [];
  for (let i = 1; i < stops.length; i++) if (stops[i]! - stops[i - 1]! > 1e-6) out.push([at2(stops[i - 1]!), at2(stops[i]!)]);
  return out;
}
/** Year Walk footway stretches (MANIFEST v1.7 `journey.yearWalk.shares`), in engine units. */
function footwayStretches(): { host: string; from: Point2; to: Point2 }[] {
  const s = requireScaleFactor(), shares = (HORIZON_MANIFEST.journey.yearWalk as { shares?: { host: string; from: number[]; to: number[] }[] }).shares ?? [];
  return shares.map(r => ({ host: canonical(r.host), from: [r.from[0]! * s, r.from[1]! * s], to: [r.to[0]! * s, r.to[1]! * s] }));
}
/** Corridor register rows ("[460,1030] to [660,1170] …") match by distance to the authored segment. */
function rowDistance(at: unknown, hit: Point2, s: number): number {
  if (Array.isArray(at)) return Math.hypot((at[0] as number) * s - hit[0], (at[1] as number) * s - hit[1]);
  if (typeof at !== 'string') return Infinity;
  const pts = [...at.matchAll(/\[(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\]/g)].map(m => [Number(m[1]) * s, Number(m[2]) * s] as Point2);
  if (pts.length < 2) return Infinity;
  let best = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!, dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((hit[0] - a[0]) * dx + (hit[1] - a[1]) * dz) / (dx * dx + dz * dz || 1))); best = Math.min(best, Math.hypot(hit[0] - a[0] - t * dx, hit[1] - a[1] - t * dz)); }
  return best;
}
export interface CrossingContext { ground?: (x: number, z: number) => number; waterAt?: (w: WaterCut, x: number, z: number) => number | null }
export function buildCrossings(cuts: LandCuts, lines: readonly Line[] = [], context: CrossingContext = {}): { crossings: Crossing[]; proofs: CrossingProof[]; rawIntersections: Intersection[] } {
  const centre = collectCentrelines(cuts, lines), byId = new Map(centre.map(l => [l.sourceId ?? l.id, l])), s = requireScaleFactor();
  const wet = context.waterAt ? waterOutlineIntersections(centre, cuts.waters, context.waterAt) : [];
  const intersections = [...collapseOverlapRuns(computeIntersections(centre), byId), ...wet], ids = stableCrossingIds(intersections, byId);
  const boxes = new Map(cuts.solids.map(solid => [solid.id, solidBounds(solid)])), stretches = footwayStretches();
  const solidNear = (solid: StructureSolid, at: Point2, radius: number) => { const b = boxes.get(solid.id)!; return at[0] >= b.min[0] - radius && at[0] <= b.max[0] + radius && at[1] >= b.min[2] - radius && at[1] <= b.max[2] + radius; };
  const proofs = intersections.map((hit, hitIndex) => {
    const a = byId.get(hit.sourceA ?? hit.a) ?? { id: hit.a, points: [], clearHeight: 1.25, kind: 'water', structureIds: [] }, b = byId.get(hit.sourceB ?? hit.b) ?? { id: hit.b, points: [], clearHeight: 1.25, kind: 'water', structureIds: [] };
    const lower = hit.heightA < hit.heightB ? a : b, upper = hit.heightA < hit.heightB ? b : a, separation = Math.abs(hit.heightA - hit.heightB);
    const foot = Math.min(hit.heightA, hit.heightB), upperHeight = Math.max(hit.heightA, hit.heightB), ground = context.ground?.(hit.at[0], hit.at[1]);
    // A cable over a route in rock is separated by the rock: the 8 eu cable rule is measured over the ground, not to the tunnel (R1-39).
    const lowerInRock = upper.kind === 'cable' && ground !== undefined && foot < ground - 2;
    const required = Math.max(1.25, lower.clearHeight, upper.kind === 'cable' || lower.kind === 'cable' ? 8 : 0);
    const candidates = HORIZON_MANIFEST.crossings.map((row, index) => ({ row, index, flipped: matches(row.a, hit.b) && matches(row.b, hit.a) })).filter(({ row, flipped }) => flipped || matches(row.a, hit.a) && matches(row.b, hit.b)).map(entry => ({ ...entry, distance: rowDistance(entry.row.at, hit.at, s) })).filter(entry => entry.distance <= CROSSING_MATCH_EU * s).sort((x, y) => x.distance - y.distance);
    const match = candidates[0];
    const aquatic = (line: Centreline) => ['water', 'row', 'ferry'].includes(line.kind) || line.id === 'DEEP_RUN';
    const waterBody = wet.includes(hit), confluence = !waterBody && aquatic(a) && aquatic(b), ferryTransfer = hit.a === 'FERRY' && hit.b.startsWith('ferry.') || hit.b === 'FERRY' && hit.a.startsWith('ferry.');
    const mover = [a, b].find(line => line.kind === 'cable' || line.kind === 'rail'), footLine = mover === a ? b : a;
    const endpointTransfer = !!mover && ['walk', 'road', 'trail', 'boardwalk', 'cave'].includes(footLine.kind) && [mover.points[0]!, mover.points.at(-1)!].some(p => p && Math.hypot(p[0] - hit.at[0], p[2] - hit.at[1]) < 1);
    // A jetty or dock deck standing over water is a boarding interface (feet → boat), not a land route
    // meeting water: it is proved like a ferry pier, on its own deck within the transfer tolerance.
    const jetty = (line: Centreline) => /^(jetty|ferry)\./.test(line.sourceId ?? line.id) && !aquatic(line);
    const boarding = !ferryTransfer && (jetty(a) && aquatic(b) || jetty(b) && aquatic(a));
    const transfer = ferryTransfer || endpointTransfer || boarding;
    const yw = [hit.sourceA, hit.sourceB, hit.a, hit.b].includes('yearWalk'), host = hit.a === 'yearWalk' ? hit.b : hit.b === 'yearWalk' ? hit.a : null;
    const footway = yw && host !== null && stretches.some(st => st.host === canonical(host) && (() => { const h = byId.get(host === hit.a ? hit.sourceA ?? hit.a : hit.sourceB ?? hit.b); if (!h) return false; const p = closestOnPolyline(h.points, hit.at[0], hit.at[1]).arc, f = closestOnPolyline(h.points, st.from[0], st.from[1]).arc, t = closestOnPolyline(h.points, st.to[0], st.to[1]).arc; return p >= Math.min(f, t) - 15 && p <= Math.max(f, t) + 15; })());
    const flushFoot = FOOT.has(a.kind) && FOOT.has(b.kind) && separation <= .5;
    const kind: CrossingKind = waterBody ? 'waterBody' : confluence ? 'waterConfluence' : transfer ? 'modeTransfer' : footway ? 'footway' : hit.overlap && separation <= .5 ? 'sharedStretch' : flushFoot ? 'junction' : 'crossing';
    const resolution: Crossing['resolution'] = confluence || transfer || footway || kind === 'sharedStretch' || kind === 'junction' ? 'threshold' : waterBody ? match ? match.row.resolution === 'threshold' ? 'threshold' : ((match.row.resolution === 'over') !== match.flipped ? 'over' : 'under') : 'threshold' : match ? match.row.resolution === 'threshold' ? 'threshold' : ((match.row.resolution === 'over') !== match.flipped ? 'over' : 'under') : separation >= required ? hit.heightA > hit.heightB ? 'over' : 'under' : 'threshold';
    const namedStructure = match?.row.structure?.split(' (')[0];
    const relevant = cuts.solids.filter(solid => solid.role !== 'marker' && solidNear(solid, hit.at, 3 * s) && (solid.bedIds.some(id => canonical(id) === hit.a || canonical(id) === hit.b) || namedStructure !== undefined && solid.id.startsWith(namedStructure)));
    const id = ids[hitIndex]!;
    const pad = cuts.pads.find(p => (p.id === `crossing.${id}` || (match !== undefined && p.id === registerRowKey(match.index)) || p.kind === 'threshold') && (pointInPolygon(hit.at[0], hit.at[1], padOutline(p)) || transfer && p.id.startsWith('threshold.ferryPiers.') && Math.hypot(p.centre[0] - hit.at[0], p.centre[2] - hit.at[1]) <= 20));
    const marker = pad && cuts.solids.find(solid => solid.role === 'marker' && (solid.id === `${pad.id}.marker` || solidNear(solid, hit.at, 8 * s)));
    // A kerb gap is measured against the actual rail/wall solids through the centre of the crossing.
    const obstructionHeight = foot + .08;
    // Approach mouths only: each route's own extent within 6 eu of the hit (a T-junction's stem ends at the
    // hit, so its ray never reaches the through route's far-edge parapet, which must stay over a drop).
    const mouths = [a, b].filter(line => line.points.length > 1).flatMap(line => approachMouth(line.points, hit.at, 6));
    const kerbGap = !cuts.solids.some(solid => (solid.role === 'rail' || solid.role === 'wall') && solidNear(solid, hit.at, 8) && boxes.get(solid.id)!.min[1] <= obstructionHeight && boxes.get(solid.id)!.max[1] >= obstructionHeight && mouths.some(([p, q]) => raySolid([p[0], obstructionHeight, p[1]], [q[0], obstructionHeight, q[1]], solid)));
    // Headroom = LOWER SURFACE → UPPER UNDERSIDE (R1-39). The underside is the lowest bottom of the upper route's own
    // deck/roof solids at this point; with none found it is the upper centreline less the thinnest deck STYLE allows.
    let underside = upperHeight - DECK_MIN_THICKNESS_EU; const physical: StructureSolid[] = [];
    for (const solid of relevant) {
      const range = solidVerticalRangeAt(solid, hit.at[0], hit.at[1]); if (!range) continue;
      if (solid.role === 'roof' && solid.bedIds.some(id => canonical(id) === lower.id) && range.bottom > foot) { underside = Math.min(underside, range.bottom); physical.push(solid); continue; }
      if (solid.role === 'deck' && Math.abs(range.top - upperHeight) <= .75) {
        const prefix = solid.id.replace(/\.(deck|bed|floor|surface\.\d+)$/, '');
        if (cuts.solids.some(p => p.role === 'support' && (p.id.startsWith(`${prefix}.`) || p.bedIds.some(id => canonical(id) === upper.id) && solidNear(p, hit.at, 50)))) { underside = Math.min(underside, range.bottom); physical.push(solid); }
        continue;
      }
      if (upper.kind === 'cable' && solid.kind === 'cable' && solid.role === 'rail' && solid.bedIds.some(id => canonical(id) === upper.id) && cuts.solids.some(p => p.role === 'support' && (p.bedIds.includes(upper.id) || upper.id === 'ZIP' && p.id.startsWith('platform.')))) { underside = Math.min(underside, range.bottom); physical.push(solid); }
    }
    const clearHeight = lowerInRock ? upperHeight - Math.max(ground!, foot) : underside - foot;
    const direction = resolution === 'over' ? hit.heightA - hit.heightB : hit.heightB - hit.heightA;
    const clearancePass = resolution === 'threshold' ? separation <= (transfer ? 1.25 : .5) && !waterBody : direction >= 0 && clearHeight >= required - 1e-6;
    const flushNoMarker = kind === 'junction' || kind === 'sharedStretch' || kind === 'footway';
    const built = confluence ? clearancePass : waterBody ? false : transfer ? !!pad && !!marker && cuts.solids.some(solid => (solid.role === 'deck' || solid.role === 'floor') && solidNear(solid, hit.at, .5) && solidVerticalRangeAt(solid, hit.at[0], hit.at[1]) !== null) && clearancePass : flushNoMarker ? clearancePass && (kind !== 'junction' || kerbGap) : resolution === 'threshold' ? !!pad && !!marker && kerbGap && clearancePass : (physical.length > 0 || lowerInRock) && clearancePass;
    const proof: CrossingProof = { ...hit, id, resolution, kind, registered: !!match || footway, proposed: !match && !footway, ...(match ? { manifestIndex: match.index, matchDistance: match.distance } : {}), separation, clearHeight, requiredClearance: resolution === 'threshold' ? transfer ? 1.25 : .5 : required, clearancePass, structureIds: relevant.map(solid => solid.id), built, ...(pad ? { padId: pad.id } : {}), ...(marker ? { markerId: marker.id } : {}), ...(resolution === 'threshold' && !confluence ? { kerbGap } : {}),
      ...(confluence ? { waterBodyIds: [hit.sourceA ?? hit.a, hit.sourceB ?? hit.b], note: 'Continuous water confluence; one physical waterway, no pedestrian pad or furniture in the basin.' } : waterBody ? { waterBodyIds: [hit.sourceB ?? hit.b], note: `The bed runs ${hit.overlapLength?.toFixed(0) ?? 0} eu inside the water outline below its surface + 0.5 eu: a bridge, a causeway or a re-route is owed.` } : transfer ? { moverPending: true, note: 'Graded boarding threshold land interface; vehicle geometry and boarding animation require the movers pass.' } : footway ? { note: 'Year Walk footway of its host bed (MANIFEST journey.yearWalk.shares): one bed, no marker.' } : kind === 'junction' ? { note: 'Flush path junction: no marker, no mode change.' } : kind === 'sharedStretch' ? { note: `Shared stretch of ${hit.overlapLength?.toFixed(1) ?? 0} eu at one height.` } : match?.row.note ? { note: match.row.note } : {}) };
    return proof;
  });
  return { proofs, rawIntersections: computeIntersections(collectCentrelines(cuts, lines, true)), crossings: proofs.map(p => ({ id: p.id, a: p.a, b: p.b, at: p.at, resolution: p.resolution, structure: p.structureIds[0], proof: p })) };
}
export function bedHeightAt(bed: BedCut, at: Point2): number { return closestOnPolyline(bed.points, at[0], at[1]).point[1]; }
