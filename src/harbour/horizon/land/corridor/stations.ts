/**
 * Corridor stations (ROAD.md §1): every CORRIDOR.step along a road bed's FINAL points, measured against the FINAL ground
 * and solids. Built at the end of the bake (after settleBedEdges, junction aprons, span pins, grounding and foundations),
 * so every number here is what the rider meets.
 *
 * `createCorridorEnv` indexes the finished land once (walkable surfaces without the road beds' own old strips, bed
 * segments, water, structure decks); `buildCorridor` turns one road bed into its stations and reaches.
 */
import type { BedCut, HeightQuery, LandCuts, PadCut, StructureSolid, XY, XYZ } from '../interfaces';
import { waterHeightAt } from '../water';
import { distance, districtAt, nearestOnPath, plan } from '../structures/mesh';
import { CORRIDOR, type CorridorContext, type CorridorEdge, type CorridorGapKind, type CorridorReach, type CorridorSide, type CorridorStation } from './types';
import { isCorridorRoad, isServiceRoad, reachAt, resolveReaches, round3, stationContext } from './reaches';

/** Which structure owns the road at a station (a bridge deck, the gallery floor, a tunnel floor), or undefined.
 * The default (`detectStructureOwnership`) reads the built decks; L1's ownership export replaces it (`buildCorridors`' option). */
export type StructureOwnership = (bed: BedCut, at: XYZ) => string | undefined;
/** A station's height tolerance to a structure deck that owns it (a mismatch larger than this is a geometry blocker, L1's). */
export const OWNERSHIP_TOLERANCE = .6;
/** Other routes within body height of the road where they reach its edge band are mouths: the edge opens there (a drop
 * that needs a guard is deeper than this, so an opening never replaces a needed guard). */
export const AT_GRADE = 1.25;
/** Lateral reach (beyond the paved edge) inside which another route or a flush pad opens the road's edge. */
export const MOUTH_BAND = 3.5;
/** Where a side's drop is read, beyond its built edge (eu): from just past the edge (where a wheel leaves it) through
 * ROAD.md §2.5's 1.5 eu, and on to 2.5 so a steep bank that falls away just past the verge counts too. */
export const DROP_SAMPLES = [.25, .5, 1, 1.5, 2, 2.5] as const;
/** Solid ids a corridor road's corridor REPLACES (ROAD.md §1): its old prism strip and edge pieces. */
export const REPLACED_PIECES = ['bed', 'surface', 'shoulders', 'kerbs', 'edges', 'retaining', 'batter'] as const;
export const replacedBy = (roadIds: readonly string[]) => { const prefixes = roadIds.flatMap(id => REPLACED_PIECES.map(p => `${id}.${p}`)); return (s: StructureSolid) => prefixes.some(p => s.id === p || s.id.startsWith(`${p}.`)); };

interface Seg { bed: BedCut; i: number; a: XYZ; b: XYZ }
function segIndex(beds: readonly BedCut[], cell: number) {
  const map = new Map<string, Seg[]>();
  for (const bed of beds) for (let i = 1; i < bed.points.length; i++) {
    const a = bed.points[i - 1]!, b = bed.points[i]!, pad = bed.width / 2 + bed.shoulder;
    for (let x = Math.floor((Math.min(a[0], b[0]) - pad) / cell); x <= Math.floor((Math.max(a[0], b[0]) + pad) / cell); x++)
      for (let z = Math.floor((Math.min(a[2], b[2]) - pad) / cell); z <= Math.floor((Math.max(a[2], b[2]) + pad) / cell); z++) { const k = `${x}:${z}`, l = map.get(k); if (l) l.push({ bed, i, a, b }); else map.set(k, [{ bed, i, a, b }]); }
  }
  return (x: number, z: number, r: number): Seg[] => {
    const out: Seg[] = [], seen = new Set<Seg>();
    for (let cx = Math.floor((x - r) / cell); cx <= Math.floor((x + r) / cell); cx++) for (let cz = Math.floor((z - r) / cell); cz <= Math.floor((z + r) / cell); cz++) for (const s of map.get(`${cx}:${cz}`) ?? []) if (!seen.has(s)) { seen.add(s); out.push(s); }
    return out;
  };
}
/** Closest point of a segment to (x, z): plan distance, parameter and height there. */
export function onSegment(a: XYZ, b: XYZ, x: number, z: number): { d: number; t: number; y: number; p: XY } {
  const dx = b[0] - a[0], dz = b[2] - a[2], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1))), p: XY = [a[0] + dx * t, a[2] + dz * t];
  return { d: Math.hypot(x - p[0], z - p[1]), t, y: a[1] + (b[1] - a[1]) * t, p };
}
/** Up-facing triangles of solids, gridded: the highest top at (x, z) at or below a height. */
function topIndex(solids: readonly StructureSolid[], cell: number) {
  const map = new Map<string, number[]>(), tris: number[] = [];
  for (const s of solids) {
    const p = s.positions;
    for (let i = 0; i < s.indices.length; i += 3) {
      const a = s.indices[i]! * 3, b = s.indices[i + 1]! * 3, c = s.indices[i + 2]! * 3;
      const ux = p[b]! - p[a]!, uy = p[b + 1]! - p[a + 1]!, uz = p[b + 2]! - p[a + 2]!, vx = p[c]! - p[a]!, vy = p[c + 1]! - p[a + 1]!, vz = p[c + 2]! - p[a + 2]!;
      const ny = uz * vx - ux * vz, n = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx); if (n < 1e-9 || ny / n <= .05) continue;
      const id = tris.length / 9; tris.push(p[a]!, p[a + 1]!, p[a + 2]!, p[b]!, p[b + 1]!, p[b + 2]!, p[c]!, p[c + 1]!, p[c + 2]!);
      for (let x = Math.floor(Math.min(p[a]!, p[b]!, p[c]!) / cell); x <= Math.floor(Math.max(p[a]!, p[b]!, p[c]!) / cell); x++)
        for (let z = Math.floor(Math.min(p[a + 2]!, p[b + 2]!, p[c + 2]!) / cell); z <= Math.floor(Math.max(p[a + 2]!, p[b + 2]!, p[c + 2]!) / cell); z++) { const k = `${x}:${z}`, l = map.get(k); if (l) l.push(id); else map.set(k, [id]); }
    }
  }
  return (x: number, z: number, below: number): number => {
    let top = -Infinity;
    for (const id of map.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`) ?? []) {
      const o = id * 9, ax = tris[o]!, ay = tris[o + 1]!, az = tris[o + 2]!, bx = tris[o + 3]!, by = tris[o + 4]!, bz = tris[o + 5]!, cx = tris[o + 6]!, cy = tris[o + 7]!, cz = tris[o + 8]!;
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(det) < 1e-12) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det; if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const y = u * ay + v * by + (1 - u - v) * cy; if (y <= below && y > top) top = y;
    }
    return top;
  };
}
/** Non-walkable triangles, gridded: does any stand within `r` of (x, z) in plan between heights y0 and y1? */
function obstructionIndex(solids: readonly StructureSolid[], cell: number) {
  const map = new Map<string, number[]>(), tris: number[] = [];
  for (const s of solids) {
    const p = s.positions;
    for (let i = 0; i < s.indices.length; i += 3) {
      const a = s.indices[i]! * 3, b = s.indices[i + 1]! * 3, c = s.indices[i + 2]! * 3, id = tris.length / 9;
      tris.push(p[a]!, p[a + 1]!, p[a + 2]!, p[b]!, p[b + 1]!, p[b + 2]!, p[c]!, p[c + 1]!, p[c + 2]!);
      for (let x = Math.floor(Math.min(p[a]!, p[b]!, p[c]!) / cell); x <= Math.floor(Math.max(p[a]!, p[b]!, p[c]!) / cell); x++)
        for (let z = Math.floor(Math.min(p[a + 2]!, p[b + 2]!, p[c + 2]!) / cell); z <= Math.floor(Math.max(p[a + 2]!, p[b + 2]!, p[c + 2]!) / cell); z++) { const k = `${x}:${z}`, l = map.get(k); if (l) l.push(id); else map.set(k, [id]); }
    }
  }
  const segD = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  return (x: number, z: number, y0: number, y1: number, r = .3): boolean => (map.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`) ?? []).some(id => {
    const o = id * 9, ax = tris[o]!, ay = tris[o + 1]!, az = tris[o + 2]!, bx = tris[o + 3]!, by = tris[o + 4]!, bz = tris[o + 5]!, cx = tris[o + 6]!, cy = tris[o + 7]!, cz = tris[o + 8]!;
    if (Math.max(ay, by, cy) < y0 || Math.min(ay, by, cy) > y1) return false;
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) > 1e-12) { const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det; if (u >= 0 && v >= 0 && u + v <= 1) return true; }
    return Math.min(segD(x, z, ax, az, bx, bz), segD(x, z, bx, bz, cx, cz), segD(x, z, cx, cz, ax, az)) < r;
  });
}
function inPad(p: PadCut, x: number, z: number, grow = 0): boolean {
  const a = p.rotationDegrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = x - p.centre[0], dz = z - p.centre[2];
  return Math.abs(dx * c + dz * s) <= p.size[0] / 2 + grow && Math.abs(-dx * s + dz * c) <= p.size[1] / 2 + grow;
}
function inPolygon(q: readonly XY[], x: number, z: number): boolean { let hit = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const a = q[i]!, b = q[j]!; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit; } return hit; }

/** The finished land, indexed once for every corridor. */
export interface CorridorEnv {
  cuts: LandCuts;
  /** Final baked terrain height. */
  ground: HeightQuery;
  /** The walking surface at (x, z) no higher than `below`: terrain, walkable solids (not the corridor roads' replaced
   * strips) and the other corridor roads' carriageways. `except` leaves one corridor road out. */
  surface(x: number, z: number, below: number, except?: string): number;
  /** Open water over the ground at (x, z). */
  wet(x: number, z: number): boolean;
  /** A walkable solid of bed `bedId` has its top within 0.3 of height y at (x, z) (the bed's own deck is there). */
  deckOf(x: number, z: number, y: number, bedId: string): boolean;
  /** A non-walkable solid (a wall, rail, post, support, roof) stands within 0.3 of (x, z) between y0 and y1. */
  obstructed(x: number, z: number, y0: number, y1: number): boolean;
  /** Planting keeps off (x, z): a bed's carriageway and shoulders (+0.3), a pad, or a non-walkable solid within 0.5. */
  occupied(x: number, z: number): boolean;
  /** (x, z) lies on another corridor road's carriageway (paved, incl. shoulders) within `tol` of height y. */
  onOtherRoad(x: number, z: number, y: number, except: string, tol?: number): boolean;
  /** The highest other corridor road's carriageway height at (x, z) within `tol` of y, or null. */
  otherRoadHeight(x: number, z: number, y: number, except: string, tol?: number): number | null;
  /** Bed segments within `r` of (x, z). */
  segments(x: number, z: number, r: number): Seg[];
  /** The road-kind beds that get a corridor. */
  roads: BedCut[];
  ownership: StructureOwnership;
}
/** The default structure ownership: a station is owned by structure `sid` (one of the road's `structureIds`) where that
 * structure's own deck, floor or apron (`<sid>.deck|floor|apron`) lies under the station within OWNERSHIP_TOLERANCE. */
export function detectStructureOwnership(cuts: LandCuts): StructureOwnership {
  const ids = new Set(cuts.beds.flatMap(b => isCorridorRoad(b) ? b.structureIds : [])), byId = new Map<string, ReturnType<typeof topIndex>>();
  for (const sid of [...ids].sort()) {
    const re = new RegExp(`^${sid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(deck|floor|apron)(\\.|$)`), decks = cuts.solids.filter(s => (s.role === 'deck' || s.role === 'floor') && re.test(s.id));
    if (decks.length) byId.set(sid, topIndex(decks, 8));
  }
  return (bed, at) => {
    for (const sid of bed.structureIds) { const top = byId.get(sid)?.(at[0], at[2], at[1] + OWNERSHIP_TOLERANCE); if (top !== undefined && top > at[1] - OWNERSHIP_TOLERANCE) return sid; }
    return undefined;
  };
}
export function createCorridorEnv(cuts: LandCuts, ground: HeightQuery, ownership?: StructureOwnership): CorridorEnv {
  const roads = cuts.beds.filter(isCorridorRoad), replaced = replacedBy(roads.map(r => r.id));
  const tops = topIndex(cuts.solids.filter(s => s.walkable && s.role !== 'marker' && !replaced(s)), 8), walls = obstructionIndex(cuts.solids.filter(s => !s.walkable && s.role !== 'marker' && !replaced(s)), 8);
  const segments = segIndex(cuts.beds.filter(b => !['cable', 'cave', 'rail'].includes(b.kind) && b.points.length > 1), 16);
  const roadSet = new Set(roads), wetCache = new Map<string, boolean>(), pads = cuts.pads.filter(p => !p.underground), deckIndex = new Map<string, ReturnType<typeof topIndex>>();
  // The Greenway's scraped marsh pools (D-WW23, ≤ 0.3 deep) are reed beds, not water a road reads: a scrape needs no guard, clips
  // no planting band and is no "open water" view (the Long Sands Shore stop had moved 430 m west to face one; land integration).
  const waters = cuts.waters.filter(w => w.kind !== 'dry' && !w.underground && !w.scrape);
  return {
    cuts, ground, roads, segments, ownership: ownership ?? detectStructureOwnership(cuts),
    surface(x, z, below, except) {
      let y = ground(x, z);
      const t = tops(x, z, below); if (t > y) y = t;
      for (const s of segments(x, z, 0)) {
        if (!roadSet.has(s.bed) || s.bed.id === except) continue;
        const q = onSegment(s.a, s.b, x, z); if (q.d <= s.bed.width / 2 + s.bed.shoulder && q.y <= below && q.y > y) y = q.y;
      }
      return y;
    },
    obstructed: walls,
    deckOf(x, z, y, bedId) { let idx = deckIndex.get(bedId); if (!idx) { idx = topIndex(cuts.solids.filter(s => s.walkable && s.bedIds.includes(bedId)), 8); deckIndex.set(bedId, idx); } return Math.abs(idx(x, z, y + .3) - y) <= .3; },
    onOtherRoad(x, z, y, except, tol = .3) { return this.otherRoadHeight(x, z, y, except, tol) !== null; },
    otherRoadHeight(x, z, y, except, tol = .3) {
      let best: number | null = null;
      for (const s of segments(x, z, 0)) { if (!roadSet.has(s.bed) || s.bed.id === except) continue; const q = onSegment(s.a, s.b, x, z); if (q.d <= s.bed.width / 2 + s.bed.shoulder && Math.abs(q.y - y) <= tol && (best === null || q.y > best)) best = q.y; }
      return best;
    },
    occupied(x, z) {
      for (const s of segments(x, z, 1)) if (onSegment(s.a, s.b, x, z).d <= s.bed.width / 2 + s.bed.shoulder + .3) return true;
      if (pads.some(p => inPad(p, x, z, .3))) return true;
      const g = ground(x, z); return walls(x, z, g - .5, g + 6, .5);
    },
    wet(x, z) {
      const k = `${Math.round(x / 2)}:${Math.round(z / 2)}`; let v = wetCache.get(k);
      if (v === undefined) { const g = ground(x, z); v = waters.some(w => { const l = waterHeightAt(w, x, z); return l !== null && l > g + .05; }); wetCache.set(k, v); }
      return v;
    },
  };
}

/** A corridor before its plan and guards: what `planGuards`, `planCorridor` and the solids read. `turns` (signed turn per
 * eu at each station, > 0 turning right) is bake-side only: it keeps lateral offsets on the inside of a tight curve from
 * folding (`lateralLine`). */
export interface CorridorCore { id: string; closed: boolean; step: number; stations: CorridorStation[]; reaches: CorridorReach[]; bed: BedCut; turns: number[]; problems: string[];
  /** Bake-side: the arc extent of each side's openings (a guard run ends at the opening's true edge, not a station short). */
  gapSpans?: Record<'left' | 'right', [number, number][]>; total?: number;
  /** Bake-side: the ground beyond a side's edge `e` at (x, z), road height y, is at grade there (an opening a guard may end at). */
  opensAt?: (side: 'left' | 'right', x: number, z: number, y: number, t: readonly [number, number], e: number) => boolean }
/** Signed turn per eu at each station (> 0: turning right, so the left side is the outer side). */
export function stationTurns(stations: readonly CorridorStation[], closed: boolean, step: number): number[] {
  const n = stations.length;
  return stations.map((_, k) => {
    const i = closed ? (k - 1 + n) % n : Math.max(0, k - 1), j = closed ? (k + 1) % n : Math.min(n - 1, k + 1), a = stations[i]!.tangent, b = stations[j]!.tangent;
    const ds = (closed ? 2 : j - i) * step; if (ds <= 0) return 0;
    return Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]) / ds;
  });
}
/** On the inside of a curve a lateral offset never exceeds this share of the local radius (no folded ribbon). */
export const INNER_RADIUS_SHARE = .8;
const lateralCache = new WeakMap<CorridorStation[], Map<number, XYZ[]>>();
/** The fold-free points at signed lateral offset `o` (> 0 right) of every station, at the station's height: pulled in on the
 * inside of a curve tighter than the offset, then (a sharp polyline corner) shrunk toward the centreline until each
 * segment runs forward. Every lateral piece (deck edge, kerb, sidewalk, guard line) is built from these, so they agree. */
export function lateralLine(core: Pick<CorridorCore, 'stations' | 'turns' | 'closed' | 'step'>, o: number): XYZ[] {
  let cache = lateralCache.get(core.stations); if (!cache) { cache = new Map(); lateralCache.set(core.stations, cache); }
  const key = Math.round(o * 1000) / 1000, hit = cache.get(key); if (hit) return hit;
  const st = core.stations, n = st.length, v = st.map((_, k) => { const turn = core.turns[k] ?? 0; return turn * o > 0 && Math.abs(turn) > 1e-9 ? Math.sign(o) * Math.min(Math.abs(o), INNER_RADIUS_SHARE / Math.abs(turn)) : o; });
  const P = (k: number) => offsetPoint(st[k]!, v[k]!);
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    for (let k = 0; k < (core.closed ? n : n - 1); k++) {
      const j = (k + 1) % n, a = P(k), b = P(j), tx = st[k]!.tangent[0] + st[j]!.tangent[0], tz = st[k]!.tangent[1] + st[j]!.tangent[1], tl = Math.hypot(tx, tz) || 1;
      if (((b[0] - a[0]) * tx + (b[2] - a[2]) * tz) / tl < .25 * core.step) { v[k] = v[k]! * .85; v[j] = v[j]! * .85; changed = true; }
    }
    if (!changed) break;
  }
  const out = st.map((_, k) => P(k)); cache.set(key, out); return out;
}
/** Arc-length walker over a polyline. */
export function polyline(points: readonly XYZ[]) {
  const arcs = [0]; for (let i = 1; i < points.length; i++) arcs.push(arcs[i - 1]! + distance(plan(points[i - 1]!), plan(points[i]!)));
  const total = arcs.at(-1)!;
  const at = (s: number): XYZ => {
    const v = Math.max(0, Math.min(total, s)); let lo = 0, hi = points.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arcs[m]! <= v) lo = m; else hi = m; }
    const a = points[lo]!, b = points[hi]!, span = arcs[hi]! - arcs[lo]!, t = span > 1e-12 ? (v - arcs[lo]!) / span : 0;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  return { arcs, total, at };
}
const SIDES = [['left', -1], ['right', 1]] as const;
export type SideName = 'left' | 'right';
/** The station's right-hand unit normal (ROAD contract: right(t) = (-t.z, t.x)). */
export const rightOf = (t: readonly [number, number]): XY => [-t[1], t[0]];
/** A point `o` eu to the right (negative: left) of a station. */
export const offsetPoint = (st: CorridorStation, o: number, y = st.at[1]): XYZ => { const r = rightOf(st.tangent); return [st.at[0] + r[0] * o, y, st.at[2] + r[1] * o]; };
/** The outer edge the corridor itself builds on a side: the paved edge, the kerb's back, or the sidewalk's back. */
export function builtEdge(side: CorridorSide): number {
  // The Year Walk as the footway: the road's protective edge lies beyond it (the walk's own edge guards its drop).
  if ((side.edge === 'sidewalk' || side.edge === 'yearWalk') && side.footway) return Math.max(side.paved, side.footway.outer);
  return side.edge === 'kerb' || side.edge === 'sidewalk' ? side.paved + CORRIDOR.kerbWidth : side.paved;
}
const GAP_RANK: Record<CorridorGapKind, number> = { junction: 0, crossing: 1, entrance: 2, threshold: 3, layby: 4, viewpoint: 5 };
const mark = (gaps: Map<number, Partial<Record<SideName, CorridorGapKind>>>, i: number, side: SideName, kind: CorridorGapKind) => {
  const g = gaps.get(i) ?? {}; const was = g[side]; if (!was || GAP_RANK[kind] < GAP_RANK[was]) g[side] = kind; gaps.set(i, g);
};
/** ROAD.md §5: nothing taller than CORRIDOR.sightlineMaxHeight within this reach of a junction mouth; the Green's protected
 * centre (STYLE rule 12) holds nothing taller than a bench. */
export const GREEN_CENTRE = { at: [1040, 1065] as XY, r: 160, maxHeight: .85 } as const;
const PLANTING_BAND = 12, SIDEWALK_MIN_RUN = 12;
/** How far beyond the paved edge a structure's own rail is looked for (eu). */
export const RAIL_SEARCH = 2.5;

export function buildCorridor(bed: BedCut, env: CorridorEnv): CorridorCore {
  const line = polyline(bed.points), total = line.total, first = bed.points[0]!, last = bed.points.at(-1)!;
  const closed = distance(plan(first), plan(last)) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-3 && bed.points.length > 3;
  const n = Math.max(1, Math.ceil(total / CORRIDOR.step - 1e-9)), step = total / n, count = closed ? n : n + 1;
  const { reaches, problems } = resolveReaches(bed), service = isServiceRoad(bed.id);
  const half = bed.width / 2, paved = bed.width / 2 + bed.shoulder, window = Math.max(CORRIDOR.step, Math.min(half, 4));
  const wrap = (s: number) => closed ? ((s % total) + total) % total : Math.max(0, Math.min(total, s));
  const sOf = (k: number) => k * step;
  // 1. Positions, tangents, grades, ownership.
  const pos: XYZ[] = [], tan: [number, number][] = [], grade: number[] = [], owner: (string | undefined)[] = [], carried: boolean[] = [];
  for (let k = 0; k < count; k++) {
    const s = sOf(k), p = line.at(s);
    const a = line.at(closed ? wrap(s - window) : Math.max(0, s - window)), b = line.at(closed ? wrap(s + window) : Math.min(total, s + window));
    let tx = b[0] - a[0], tz = b[2] - a[2], tl = Math.hypot(tx, tz);
    if (tl < 1e-9) { const q = line.at(Math.min(total, s + .5)), r = line.at(Math.max(0, s - .5)); tx = q[0] - r[0]; tz = q[2] - r[2]; tl = Math.hypot(tx, tz) || 1; }
    const g0 = line.at(closed ? wrap(s - CORRIDOR.step) : Math.max(0, s - CORRIDOR.step)), g1 = line.at(closed ? wrap(s + CORRIDOR.step) : Math.min(total, s + CORRIDOR.step)), run = distance(plan(g0), plan(g1));
    const at: XYZ = [round3(p[0]), round3(p[1]), round3(p[2])];
    pos.push(at); tan.push([round3(tx / tl), round3(tz / tl)]); grade.push(round3(run > 1e-6 ? (g1[1] - g0[1]) / run : 0));
    owner.push(env.ownership(bed, at)); carried.push(!!bed.carried?.some(c => nearestOnPath(plan(at), c.map(q => [q[0], 0, q[1]] as XYZ)).distance < 1));
  }
  // 2. Gaps: other routes' mouths at grade, flush pads, (viewpoints: `applyViewpointGaps` after the plan).
  const gaps = new Map<number, Partial<Record<SideName, CorridorGapKind>>>();
  const cellOf = new Map<string, number[]>(), CELL = 8;
  pos.forEach((p, k) => { const key = `${Math.floor(p[0] / CELL)}:${Math.floor(p[2] / CELL)}`; const l = cellOf.get(key); if (l) l.push(k); else cellOf.set(key, [k]); });
  /** The station nearest (x, z) with the point's along and lateral offsets from it. */
  const project = (x: number, z: number, reach: number): { k: number; along: number; o: number } | null => {
    let best: { k: number; along: number; o: number; d: number } | null = null;
    for (let cx = Math.floor((x - reach) / CELL); cx <= Math.floor((x + reach) / CELL); cx++) for (let cz = Math.floor((z - reach) / CELL); cz <= Math.floor((z + reach) / CELL); cz++) for (const k of cellOf.get(`${cx}:${cz}`) ?? []) {
      const p = pos[k]!, t = tan[k]!, dx = x - p[0], dz = z - p[2], along = dx * t[0] + dz * t[1], o = dx * -t[1] + dz * t[0], d = Math.hypot(dx, dz);
      if (Math.abs(along) <= step * .75 + .01 && Math.abs(o) <= reach && (!best || d < best.d)) best = { k, along, o, d };
    }
    return best;
  };
  const kAt = (s: number) => closed ? ((Math.round(s / step) % count) + count) % count : Math.max(0, Math.min(count - 1, Math.round(s / step)));
  const gapSpans: Record<SideName, [number, number][]> = { left: [], right: [] };
  const markSpan = (s: number, halfWidth: number, side: SideName, kind: CorridorGapKind) => { gapSpans[side].push([s - halfWidth, s + halfWidth]); for (let d = -halfWidth; d <= halfWidth + 1e-9; d += step / 2) { const k = kAt(s + d); if (closed || (s + d >= -step / 2 && s + d <= total + step / 2)) mark(gaps, k, side, kind); } };
  const reach = paved + CORRIDOR.kerbWidth + CORRIDOR.sidewalkWidth + 1;
  const others = env.cuts.beds.filter(b => b !== bed && b.points.length > 1 && ['road', 'skate', 'walk', 'trail', 'boardwalk', 'stair'].includes(b.kind) && !b.id.startsWith('structure.') && !bed.structureIds.includes(b.id) && b.id !== 'strip');
  const bx0 = Math.min(...pos.map(p => p[0])) - reach - 2, bx1 = Math.max(...pos.map(p => p[0])) + reach + 2, bz0 = Math.min(...pos.map(p => p[2])) - reach - 2, bz1 = Math.max(...pos.map(p => p[2])) + reach + 2;
  for (const other of others) {
    if (!other.points.some((p, i) => i > 0 && Math.max(p[0], other.points[i - 1]![0]) >= bx0 && Math.min(p[0], other.points[i - 1]![0]) <= bx1 && Math.max(p[2], other.points[i - 1]![2]) >= bz0 && Math.min(p[2], other.points[i - 1]![2]) <= bz1)) continue;
    const footway = (other.sharedEdges ?? []).filter(e => e.other === bed.id).map(e => e.at.map(q => [q[0], 0, q[1]] as XYZ));
    const halfWidth = other.kind === 'road' ? other.width / 2 + other.shoulder + 2.5 : other.width / 2 + .75;
    type Hit = { s: number; o: number };
    let run: Hit[] = [];
    const flush = () => {
      if (!run.length) return;
      const crosses = run.some(h => h.o < -.5) && run.some(h => h.o > .5), kind: CorridorGapKind = other.kind === 'road' ? 'junction' : crosses ? 'crossing' : 'entrance';
      // Only where the route actually reaches the edge band (a mouth), not where it merely runs beside the road.
      for (const h of run) if (Math.abs(h.o) >= half - .5 && Math.abs(h.o) <= paved + 1.5) markSpan(h.s, halfWidth, h.o < 0 ? 'left' : 'right', kind);
      run = [];
    };
    for (let i = 1; i < other.points.length; i++) {
      const a = other.points[i - 1]!, b = other.points[i]!, len = distance(plan(a), plan(b)), m = Math.max(1, Math.ceil(len / .5));
      for (let j = i === 1 ? 0 : 1; j <= m; j++) {
        const t = j / m, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t;
        const hit = x < bx0 || x > bx1 || z < bz0 || z > bz1 ? null : project(x, z, reach);
        const onFootway = hit && footway.some(f => nearestOnPath([x, z], f).distance < 1.5);
        if (!hit || onFootway || Math.abs(y - (pos[hit.k]![1] + grade[hit.k]! * hit.along)) > AT_GRADE) { flush(); continue; }
        run.push({ s: sOf(hit.k) + hit.along, o: hit.o });
      }
    }
    flush();
  }
  const pads = env.cuts.pads.filter(p => !p.underground && p.kind !== 'host');
  // 3. Stations: sides.
  const stations: CorridorStation[] = [];
  for (let k = 0; k < count; k++) {
    const s = round3(sOf(k)), at = pos[k]!, t = tan[k]!, r = rightOf(t), h = at[1], structureId = owner[k], reachRow = reachAt(reaches, s);
    const context: CorridorContext = service ? 'open' : stationContext(reachRow, structureId);
    const sides = {} as Record<SideName, CorridorSide>;
    for (const [name, sign] of SIDES) {
      const P = (o: number): XY => [at[0] + r[0] * sign * o, at[2] + r[1] * sign * o];
      let gap = gaps.get(k)?.[name];
      if (!gap) for (const pad of pads) { if (Math.abs(pad.centre[1] - h) > .6) continue; if ([.5, 1.5].some(o => { const q = P(paved + o); return inPad(pad, q[0], q[1]); })) { const kind: CorridorGapKind = /layby/.test(pad.id) ? 'layby' : pad.kind === 'threshold' ? 'threshold' : 'entrance'; if (!gap || GAP_RANK[kind] < GAP_RANK[gap]) gap = kind; } }
      const owned = !!structureId || carried[k]!;
      // The Year Walk (or any footway sharing this road's edge) running beside: it IS the footway on this side.
      let footway: CorridorSide['footway'], edge: CorridorEdge = 'shoulder';
      if (!owned) {
        let best: { o: number; bed: BedCut; y: number; d: number } | undefined;
        for (const e of bed.sharedEdges ?? []) {
          if (nearestOnPath(plan(at), e.at.map(q => [q[0], 0, q[1]] as XYZ)).distance > 1.5) continue;
          for (const seg of env.segments(at[0], at[2], 14)) {
            if (seg.bed.id !== e.other) continue;
            const q = onSegment(seg.a, seg.b, at[0], at[2]), o = (q.p[0] - at[0]) * r[0] + (q.p[1] - at[2]) * r[1];
            const sx = seg.b[0] - seg.a[0], sz = seg.b[2] - seg.a[2], sl = Math.hypot(sx, sz) || 1;
            if (o * sign <= .5 || Math.abs(o) > 14 || Math.abs(q.y - h) > .6 || Math.abs((sx * t[0] + sz * t[1]) / sl) < .7) continue;
            // The footway's own point abreast of the station (its nearest point, not a segment end further along).
            if (!best || q.d < best.d) best = { o, bed: seg.bed, y: q.y, d: q.d };
          }
        }
        // Only a footway with its own walking surface there (a lane carried by a structure has none of its own).
        if (best) { const b = best, inner = Math.max(paved + .25, Math.abs(b.o) - b.bed.width / 2 + .25); if ([-step / 2, 0, step / 2].some(along => [inner, Math.max(inner, Math.abs(b.o))].some(o => { const q = P(o), x = q[0] + t[0] * along, z = q[1] + t[1] * along; return !env.deckOf(x, z, b.y, b.bed.id); }))) best = undefined; }
        if (best) { edge = 'yearWalk'; footway = { inner: round3(Math.max(0, Math.abs(best.o) - best.bed.width / 2)), outer: round3(Math.abs(best.o) + best.bed.width / 2), height: round3(best.y), bedId: best.bed.id }; }
      }
      if (!owned && !footway && !service && (context === 'developed' || context === 'boulevard')) {
        edge = 'kerb';
        if (context === 'developed') {
          const inner = paved + CORRIDOR.kerbWidth, outer = inner + CORRIDOR.sidewalkWidth;
          const atGrade = [inner + .2, (inner + outer) / 2, outer - .1].every(o => { const q = P(o), y = env.surface(q[0], q[1], h + .6, bed.id); return y <= h + .1 && y >= h - 1 && env.ground(q[0], q[1]) <= h + .1 && !env.wet(q[0], q[1]) && !env.obstructed(q[0], q[1], h + .2, h + 2.4); });
          if (atGrade) { edge = 'sidewalk'; footway = { inner: round3(inner), outer: round3(outer), height: round3(h + CORRIDOR.kerbRise) }; }
        }
      }
      if (owned) {
        edge = 'structure';
        // A foot route the structure carries beside the road (the Year Walk on the Bight Bridge) is this side's footway: the
        // plan hangs its bridge lanterns on the rail between the road and that footway, never on the open edge.
        let best: { o: number; bed: BedCut; y: number; d: number } | undefined;
        for (const seg of env.segments(at[0], at[2], 14)) {
          const b = seg.bed; if (b === bed || isCorridorRoad(b) || b.id.startsWith('structure.') || !['walk', 'trail', 'boardwalk'].includes(b.kind)) continue;
          const q = onSegment(seg.a, seg.b, at[0], at[2]), o = (q.p[0] - at[0]) * r[0] + (q.p[1] - at[2]) * r[1];
          const sx = seg.b[0] - seg.a[0], sz = seg.b[2] - seg.a[2], sl = Math.hypot(sx, sz) || 1;
          if (o * sign <= paved - .5 || Math.abs(o) > 14 || Math.abs(q.y - h) > .6 || Math.abs((sx * t[0] + sz * t[1]) / sl) < .7) continue;
          if (!best || q.d < best.d) best = { o, bed: b, y: q.y, d: q.d };
        }
        if (best) footway = { inner: round3(Math.max(paved, Math.abs(best.o) - best.bed.width / 2)), outer: round3(Math.abs(best.o) + best.bed.width / 2), height: round3(best.y), bedId: best.bed.id };
      }
      const side: CorridorSide = { edge, guard: owned ? 'bridgeRail' : 'none', drop: 0, waterEu: null, paved: round3(paved), ...(footway ? { footway } : {}), ...(gap && !owned ? { gap } : {}) };
      // Drop 1.0–1.5 beyond the built edge (positive = down); a bank above the road reads as a negative drop.
      // The Year Walk is this side's footway only where it is level with the road: with a drop between them the side is a
      // plain edge (the road guards its own drop).
      if (side.edge === 'yearWalk') {
        let near = -Infinity; for (const o of [.5, 1]) { const q = P(paved + o); near = Math.max(near, h - env.surface(q[0], q[1], h + .6, bed.id)); }
        if (near > CORRIDOR.guardDrop) { side.edge = 'shoulder'; delete side.footway; }
      }
      const e = builtEdge(side);
      // Read at the station and half a step either side of it (along the road), so nothing between stations is missed.
      let drop = -Infinity, rise = -Infinity;
      for (const along of [-step / 2, 0, step / 2]) for (const o of DROP_SAMPLES) { const q = P(e + o), x = q[0] + t[0] * along, z = q[1] + t[1] * along, y = h + grade[k]! * along; drop = Math.max(drop, y - env.surface(x, z, y + .6, bed.id)); }
      for (const o of [.5, 1, 1.5]) { const q = P(e + o); rise = Math.max(rise, env.ground(q[0], q[1]) - h); }
      side.drop = round3(drop > .05 ? drop : rise > .05 ? -rise : Math.max(drop, 0));
      // A gap over a drop is an opening only where something at grade continues beyond it (the joining route's own deck or
      // a flush pad); the flank of a mouth over a drop, or a route that is not there at the road's height, keeps its guard.
      // A gap is an opening only where it opens onto something at grade: the joining route's own walking width (or a flush
      // pad) just beyond the edge. Over a drop anywhere else (the flank of an oblique mouth, a route that is not there at the
      // road's height) the side keeps its guard.
      // A structure that owns the deck but has no rail of its own on this side, over a drop that needs one: the corridor
      // guards it (never a second rail where the structure has one: any wall, rail or parapet at body height within
      // RAIL_SEARCH beyond the paved edge counts as the structure's).
      if (owned && side.drop > CORRIDOR.guardDrop && !side.gap) {
        // Railed only where something stops a body at a contact level (0.2 or 0.65 over the deck, the cruiser's and walker's) at
        // every sample along the station: posts with a top rail at 1.05 alone do not (a rider passes between the posts under it).
        const railed = [-step / 2, 0, step / 2].every(along => [[.12, .28], [.57, .73]].some(([y0, y1]) => { for (let o = paved - .5; o <= paved + RAIL_SEARCH; o += .25) { const q = P(o), x = q[0] + t[0] * along, z = q[1] + t[1] * along, y = h + grade[k]! * along; if (env.obstructed(x, z, y + y0!, y + y1!)) return true; } return false; }));
        if (!railed) side.bare = true;
      }
      if (side.gap && side.drop > CORRIDOR.guardDrop) {
        // The surface right past the edge (0.25 and 0.5 out, where a wheel leaves the road) must be the joining route's at grade.
        // A real walking surface (the joining route's own deck, a pad's slab) at grade across the band a guard would stand in.
        const opens = [.25, .5, 1, 1.5].every(o => { const q = P(e + o); return h - env.surface(q[0], q[1], h + .6, bed.id) <= CORRIDOR.guardDrop; });
        if (!opens) delete side.gap;
      }
      for (let d = 0; d <= 80; d += 4) { const q = P(paved + d); if (env.wet(q[0], q[1])) { side.waterEu = round3(d); break; } }
      sides[name] = side;
    }
    stations.push({ s, at, tangent: t, grade: grade[k]!, context, reachId: reachRow.id, half: round3(half), left: sides.left, right: sides.right, ...(structureId ? { structureId } : {}) });
  }
  // 4. Openings: a kerb side's gap is flush (no kerb); a sidewalk ends at a junction mouth or a lay-by (the footway meets the
  // side road or the pad) and runs on, dropped flush, across an entrance, a crossing, a threshold or a viewpoint.
  for (const st of stations) for (const [name] of SIDES) {
    const side = st[name];
    if (side.gap && (side.edge === 'kerb' || side.edge === 'sidewalk' && (side.gap === 'junction' || side.gap === 'layby'))) { side.edge = 'shoulder'; delete side.footway; }
  }
  // 5. Sidewalk runs: shorter than SIDEWALK_MIN_RUN fall back to a kerb; each run is one new walk bed `<road>.walk.<L|R>.<n>`
  // whose ends (and CORRIDOR.droppedKerbLength around every opening) are dropped flush, ramped at kerbRise per station step.
  for (const [name] of SIDES) {
    let from = -1; const runs: [number, number][] = [];
    for (let k = 0; k <= stations.length; k++) { const on = k < stations.length && stations[k]![name].edge === 'sidewalk'; if (on && from < 0) from = k; if (!on && from >= 0) { runs.push([from, k - 1]); from = -1; } }
    let n = 0;
    for (const [a, b] of runs) {
      if ((b - a) * step < SIDEWALK_MIN_RUN) { for (let k = a; k <= b; k++) { const side = stations[k]![name]; side.edge = stations[k]![name].gap ? 'shoulder' : 'kerb'; delete side.footway; } continue; }
      n++; const bedId = `${bed.id}.walk.${name === 'left' ? 'L' : 'R'}.${n}`, reachK = Math.max(1, Math.ceil((CORRIDOR.droppedKerbLength / 2) / step));
      const dropped = new Set<number>([a, b]);
      for (let k = a; k <= b; k++) if (stations[k]![name].gap) for (let d = -reachK; d <= reachK; d++) dropped.add(k + d);
      // Each dropped kerb ramps up over two station steps (half the kerb rise per step: 3.75 % over the road's own grade).
      for (let k = a; k <= b; k++) {
        const fw = stations[k]![name].footway!, h = stations[k]!.at[1]; fw.bedId = bedId;
        if (dropped.has(k)) fw.height = h; else if (dropped.has(k - 1) || dropped.has(k + 1)) fw.height = round3(h + CORRIDOR.kerbRise / 2);
      }
    }
  }
  plantingBands(stations, bed, env, service);
  // The true extent of each opening (a mouth's plan width; a pad or viewpoint opening fills its station's half steps).
  for (const [name] of SIDES) stations.forEach((st, k) => { if (st[name].gap && !gapSpans[name].some(([a, b]) => st.s >= a - 1e-6 && st.s <= b + 1e-6)) gapSpans[name].push([st.s - step / 2, st.s + step / 2]); void k; });
  const opensAt = (side: SideName, x: number, z: number, y: number, t: readonly [number, number], e: number) => { const sign = side === 'left' ? -1 : 1, r = rightOf(t); return [.25, .5, 1, 1.5].every(o => { const qx = x + r[0] * sign * (e + o), qz = z + r[1] * sign * (e + o); return y - env.surface(qx, qz, y + .6, bed.id) <= CORRIDOR.guardDrop; }); };
  return { id: bed.id, closed, step: round3(step), stations, reaches, bed, turns: stationTurns(stations, closed, step), problems, gapSpans, total, opensAt };
}
/** ROAD.md §5: where planting may stand on each side (absolute offsets) and how tall. */
function plantingBands(stations: CorridorStation[], bed: BedCut, env: CorridorEnv, service: boolean): void {
  const junctions = stations.filter(st => st.left.gap === 'junction' || st.right.gap === 'junction').map(st => st.s);
  const nearJunction = (s: number) => junctions.some(j => Math.abs(j - s) <= CORRIDOR.sightlineReach);
  for (const st of stations) for (const name of ['left', 'right'] as const) {
    const side = st[name];
    if (service || st.structureId || side.edge === 'structure' || side.gap || st.context === 'structure') continue;
    const sea = side.waterEu !== null;
    if (st.context === 'mountain' && sea) continue;
    const inner = Math.max(builtEdge(side), side.footway?.outer ?? 0) + CORRIDOR.plantingSetback;
    let outer = inner + PLANTING_BAND; if (side.waterEu !== null) outer = Math.min(outer, side.paved + side.waterEu - 1);
    if (outer < inner + .5) continue;
    let maxHeight: number | undefined;
    if (st.context === 'coastal' && sea) maxHeight = .9;
    if (nearJunction(st.s)) maxHeight = Math.min(maxHeight ?? Infinity, CORRIDOR.sightlineMaxHeight);
    if (distance(plan(st.at), GREEN_CENTRE.at) < GREEN_CENTRE.r + outer) maxHeight = Math.min(maxHeight ?? Infinity, GREEN_CENTRE.maxHeight);
    side.planting = { inner: round3(inner), outer: round3(outer), ...(maxHeight !== undefined ? { maxHeight } : {}) };
  }
  void bed; void env;
}
/** Viewpoint gaps (a scenic stop's mouth, chosen by the plan): station sides whose edge band lies inside a stop's outline
 * open (a real opening: no guard, kerb or planting there). */
export function applyViewpointGaps(core: CorridorCore, stops: readonly { outline: readonly XY[] }[]): void {
  if (!stops.length) return;
  for (const st of core.stations) for (const [name, sign] of SIDES) {
    const side = st[name]; if (side.edge === 'structure') continue;
    const e = builtEdge(side);
    if (stops.some(stop => stop.outline.length > 2 && [.5, 1.5].some(o => { const q = offsetPoint(st, sign * (e + o)); return inPolygon(stop.outline, q[0], q[2]); }))) {
      if (!side.gap) core.gapSpans?.[name].push([st.s - core.step / 2, st.s + core.step / 2]);
      if (!side.gap || GAP_RANK.viewpoint < GAP_RANK[side.gap]) side.gap = 'viewpoint';
      delete side.planting;
    }
  }
}
/** The district a point streams with (the emitters' rectangles, `structures/mesh.ts`). */
export const districtOf = (p: XYZ | XY): string => districtAt(p[0]!, p.length === 3 ? (p as XYZ)[2] : (p as XY)[1]);
