/**
 * TEST-ONLY adapter (Track P): the committed bake's real corridor stations when it carries them; otherwise approximate `CorridorStation[]` for V01 / VG / V03 from the committed bake, so the
 * corridor plan can be exercised on the real island before the stations track (`land/corridor/stations.ts`, L2)
 * lands. It is NOT the corridor: it reads the baked bed points, the terrain, the Year Walk and the crossings, and
 * makes the same kind of decisions L2 makes (context from ROAD.md §3 anchors, drop and water measured from the
 * terrain, Year Walk sides, gaps at other beds' junctions and at thresholds) in the simplest way that is honest.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Point2, Point3, WorldDefinition } from '../../src/harbour/horizon/world/definition.ts';
import type { TerrainField } from '../../src/harbour/horizon/land/interfaces.ts';
import { decodeTerrainAsset } from '../../src/harbour/horizon/land/terrain/asset.ts';
import { sampleTerrain } from '../../src/harbour/horizon/land/terrain/index.ts';
import { contains } from '../../src/harbour/horizon/land/terrain/geometry.ts';
import { CORRIDOR, type CorridorContext, type CorridorEdge, type CorridorGapKind, type CorridorReach, type CorridorSide, type CorridorStation, type GuardKind } from '../../src/harbour/horizon/land/corridor/types.ts';
import type { PlanEnv, PlanInput } from '../../src/harbour/horizon/land/corridor/plan.ts';

export interface Bake { world: WorldDefinition; field: TerrainField }
let cached: Bake | null = null;
export function loadBake(): Bake {
  if (cached) return cached;
  const world = JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.json.gz')).toString('utf8')) as WorldDefinition;
  const t = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const field = decodeTerrainAsset(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength) as ArrayBuffer, 'full');
  cached = { world, field };
  return cached;
}

/** ROAD.md §3: V01 reach anchors, labels and contexts. */
export const V01_REACHES: readonly { id: string; label: string; from: Point2; context: CorridorContext }[] = [
  { id: 'V01.R1', label: 'Harbour Gate', from: [1400, 1060], context: 'developed' },
  { id: 'V01.R2', label: 'Prow Gallery', from: [1543, 1001], context: 'structure' },
  { id: 'V01.R3', label: 'Prow Cliff Drive', from: [1599.5, 790.8], context: 'mountain' },
  { id: 'V01.R4', label: 'Crown Coast', from: [1560, 500], context: 'coastal' },
  { id: 'V01.R5', label: "Scholars' Crest", from: [1120, 250], context: 'open' },
  { id: 'V01.R6', label: 'West Rise', from: [720, 300], context: 'open' },
  { id: 'V01.R7', label: 'Flats Coast', from: [400, 470], context: 'coastal' },
  { id: 'V01.R8', label: 'Bight Descent', from: [390, 850], context: 'mountain' },
  { id: 'V01.R9', label: 'Bight Bridge', from: [460, 1030], context: 'structure' },
  { id: 'V01.R10', label: 'Long Sands Boulevard', from: [660, 1170], context: 'boulevard' },
  { id: 'V01.R11', label: 'Tideline & Campfire', from: [1100, 1400], context: 'coastal' },
  { id: 'V01.R12', label: 'Quay Crossing', from: [1300, 1380], context: 'structure' },
  { id: 'V01.R13', label: 'Harbour Avenue', from: [1370, 1260], context: 'boulevard' },
];
const ROAD_STRUCTURES: Record<string, { solid: string; kind: 'bridge' | 'tunnel' }[]> = {
  // V3 (D-M11): the Rim Tunnel (V01 under the Rim Bridge) spans the Prow/Crown district seam, so both floor pieces name it.
  V01: [{ solid: 'prowTunnel.floor@prow', kind: 'tunnel' }, { solid: 'rimTunnel.floor@prow', kind: 'tunnel' }, { solid: 'rimTunnel.floor@crown', kind: 'tunnel' }, { solid: 'bightBridge.deck@bight', kind: 'bridge' }, { solid: 'quayBridge.deck@reach', kind: 'bridge' }],
  VG: [{ solid: 'highSpan.deck@notch', kind: 'bridge' }],
  V03: [{ solid: 'mountainRoadTunnel.floor@prow', kind: 'tunnel' }, { solid: 'mountainRoadCanalBridge.deck@lakeside', kind: 'bridge' }],
};

const d2 = (a: Point2 | Point3, b: Point2 | Point3) => Math.hypot(a[0] - (b.length === 3 ? b[0] : b[0]), (a.length === 3 ? a[2] : a[1]) - (b.length === 3 ? b[2] : b[1]));
const xz = (p: Point2 | Point3): Point2 => (p.length === 3 ? [p[0], p[2]] : p);

/** Segment index over polylines (for "nearest point of bed X" queries). */
class SegIndex {
  private cells = new Map<string, number[]>();
  readonly segs: { a: Point3; b: Point3; id: string; half: number }[] = [];
  constructor(lines: readonly { id: string; points: readonly Point3[]; half: number }[]) {
    for (const l of lines) for (let i = 1; i < l.points.length; i++) {
      const a = l.points[i - 1]!, b = l.points[i]!, k = this.segs.length;
      this.segs.push({ a, b, id: l.id, half: l.half });
      const x0 = Math.floor((Math.min(a[0], b[0]) - l.half) / 24), x1 = Math.floor((Math.max(a[0], b[0]) + l.half) / 24);
      const z0 = Math.floor((Math.min(a[2], b[2]) - l.half) / 24), z1 = Math.floor((Math.max(a[2], b[2]) + l.half) / 24);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = `${x}:${z}`, c = this.cells.get(key) ?? []; c.push(k); this.cells.set(key, c); }
    }
  }
  near(x: number, z: number, filter?: (id: string) => boolean): { d: number; id: string; half: number; p: Point3 } | null {
    let best: { d: number; id: string; half: number; p: Point3 } | null = null;
    for (const k of this.cells.get(`${Math.floor(x / 24)}:${Math.floor(z / 24)}`) ?? []) {
      const s = this.segs[k]!; if (filter && !filter(s.id)) continue;
      const dx = s.b[0] - s.a[0], dz = s.b[2] - s.a[2], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[2]) * dz) / l)) : 0;
      const p: Point3 = [s.a[0] + dx * t, s.a[1] + (s.b[1] - s.a[1]) * t, s.a[2] + dz * t], d = Math.hypot(x - p[0], z - p[2]);
      if (!best || d - s.half < best.d - best.half) best = { d, id: s.id, half: s.half, p };
    }
    return best;
  }
}

export interface Island {
  bake: Bake;
  ground(x: number, z: number): number;
  water(x: number, z: number): boolean;
  occupied(x: number, z: number): boolean;
  beds: SegIndex;
  yearWalk: { id: string; points: readonly Point3[] };
}
let island: Island | null = null;
export function loadIsland(): Island {
  if (island) return island;
  const bake = loadBake(), { world, field } = bake;
  const ground = (x: number, z: number) => sampleTerrain(field, x, z);
  const waters = world.water.filter(w => w.kind !== 'dry');
  const water = (x: number, z: number) => { const g = ground(x, z); for (const w of waters) if (g <= w.level + 0.05 && contains(w.outline, x, z)) return true; return false; };
  const lineKinds = new Set(['road', 'walk', 'skate', 'boardwalk', 'stair', 'trail']);
  const beds = new SegIndex(world.beds.filter(b => lineKinds.has(b.kind ?? '')).map(b => ({ id: b.id, points: b.points, half: (b.width ?? 4) / 2 + (b.kind === 'road' ? 1 : 0.3) })));
  const pads = (world.collision?.pads ?? []).filter(p => !p.underground).map(p => {
    const a = (p.rotationDegrees * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return { cx: p.centre[0], cz: p.centre[2], hx: p.size[0] / 2 + (p.margin ?? 0), hz: p.size[1] / 2 + (p.margin ?? 0), c, s };
  });
  const hostPolys = world.hosts.flatMap(h => (h.footprint ? [h.footprint] : []));
  const occupied = (x: number, z: number) => {
    const b = beds.near(x, z); if (b && b.d < b.half) return true;
    for (const p of pads) { const dx = x - p.cx, dz = z - p.cz, u = dx * p.c + dz * p.s, v = -dx * p.s + dz * p.c; if (Math.abs(u) <= p.hx && Math.abs(v) <= p.hz) return true; }
    for (const poly of hostPolys) if (contains(poly, x, z)) return true;
    return false;
  };
  island = { bake, ground, water, occupied, beds, yearWalk: { id: world.journey.yearWalk.id, points: world.journey.yearWalk.points } };
  return island;
}

/** Resample a polyline every `step` eu by arc length (heights interpolated). */
function resample(points: readonly Point3[], step: number, closed: boolean): { at: Point3; s: number }[] {
  const pts = closed && d2(points[0]!, points[points.length - 1]!) < 0.01 ? points.slice(0, -1) : points.slice();
  const segs: [Point3, Point3][] = [];
  for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1]!, pts[i]!]);
  if (closed) segs.push([pts[pts.length - 1]!, pts[0]!]);
  let total = 0; for (const [a, b] of segs) total += d2(a, b);
  const out: { at: Point3; s: number }[] = [], n = closed ? Math.round(total / step) : Math.floor(total / step) + 1;
  let si = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const s = closed ? (k * total) / n : Math.min(total, k * step);
    while (si < segs.length - 1 && acc + d2(segs[si]![0], segs[si]![1]) < s) { acc += d2(segs[si]![0], segs[si]![1]); si++; }
    const [a, b] = segs[si]!, l = d2(a, b) || 1, t = Math.max(0, Math.min(1, (s - acc) / l));
    out.push({ s, at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] });
  }
  return out;
}

const PAVED = 5, HALF = 4;

export interface AdapterOptions { median?: boolean; /** Force the approximate stations even when the bake carries corridors. */ adapter?: boolean }
/** Approximate stations + reaches + plan env for one of V01 / VG / V03. */
export function adaptRoad(id: 'V01' | 'VG' | 'V03', opts: AdapterOptions = {}): { input: PlanInput; env: PlanEnv; structureKinds: Record<string, 'bridge' | 'tunnel'> } {
  const I = loadIsland(), { world } = I.bake;
  const bed = world.beds.find(b => b.id === id)!, closed = id === 'V01';
  const samples = resample(bed.points, CORRIDOR.step, closed), n = samples.length;
  const length = closed ? samples[n - 1]!.s + d2(samples[n - 1]!.at, samples[0]!.at) : samples[n - 1]!.s;
  const tangent = (k: number): Point2 => {
    const a = samples[closed ? (k - 2 + n) % n : Math.max(0, k - 2)]!.at, b = samples[closed ? (k + 2) % n : Math.min(n - 1, k + 2)]!.at;
    const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l];
  };
  const gradeAt = (k: number) => {
    const a = samples[closed ? (k - 2 + n) % n : Math.max(0, k - 2)]!, b = samples[closed ? (k + 2) % n : Math.min(n - 1, k + 2)]!;
    let ds = b.s - a.s; if (ds <= 0) ds += length; return (b.at[1] - a.at[1]) / (ds || 1);
  };
  const sOf = (p: Point2): number => { let best = 0, bd = Infinity; for (const q of samples) { const d = d2(q.at, p); if (d < bd) { bd = d; best = q.s; } } return best; };

  // Reaches.
  let reaches: CorridorReach[];
  if (id === 'V01') {
    const froms = V01_REACHES.map(r => sOf(r.from));
    reaches = V01_REACHES.map((r, k) => ({ id: r.id, label: r.label, from: froms[k]!, to: k + 1 < froms.length ? froms[k + 1]! : length, context: r.context }));
  } else reaches = [{ id: `${id}.all`, label: id === 'VG' ? 'Green Road' : 'Mountain Road', from: 0, to: length, context: id === 'VG' ? 'open' : 'mountain' }];
  const reachAt = (s: number) => { for (const r of reaches) if (s >= r.from && s < r.to) return r; return reaches[reaches.length - 1]!; };

  // Structures: stations inside a deck/floor footprint (bridges also need the ground well below the road).
  const structureKinds: Record<string, 'bridge' | 'tunnel'> = {};
  const structs = (ROAD_STRUCTURES[id] ?? []).map(x => { const s = world.structures.find(q => q.id === x.solid)!; structureKinds[x.solid.split('.')[0]!] = x.kind; return { id: x.solid.split('.')[0]!, kind: x.kind, fp: s.footprint }; });
  const structureOf = (p: Point3): string | undefined => {
    for (const x of structs) if (contains(x.fp, p[0], p[2]) && (x.kind === 'tunnel' || I.ground(p[0], p[2]) < p[1] - 1.5 || I.water(p[0], p[2]))) return x.id;
    return undefined;
  };
  const sid = samples.map(q => structureOf(q.at));
  for (let k = 1; k < n - 1; k++) if (!sid[k] && sid[k - 1] && sid[k - 1] === sid[k + 1]) sid[k] = sid[k - 1];

  // Gaps from crossings / thresholds / laybys: [s, side | both, kind, half-length].
  const gaps: { s: number; side: 'left' | 'right' | 'both'; kind: CorridorGapKind; half: number }[] = [];
  const lateral = (k: number, p: Point2) => { const q = samples[k]!.at, t = tangent(k); return (p[0] - q[0]) * -t[1] + (p[1] - q[2]) * t[0]; };
  const nearestK = (p: Point2) => { let best = 0, bd = Infinity; samples.forEach((q, k) => { const d = d2(q.at, p); if (d < bd) { bd = d; best = k; } }); return { k: best, d: bd }; };
  for (const c of world.crossings) {
    if (c.resolution !== 'threshold' || (c.a !== id && c.b !== id)) continue;
    const other = c.a === id ? c.b : c.a, ob = world.beds.find(b => b.id === other); if (!ob) continue;
    const { k, d } = nearestK(c.at); if (d > 12) continue;
    // Which side(s) the other bed leaves on: its points 8–25 eu from the crossing.
    const sides = new Set<'left' | 'right'>();
    for (const p of ob.points) { const dd = d2(p, c.at); if (dd < 8 || dd > 25) continue; const o = lateral(k, xz(p)); if (Math.abs(o) > PAVED + 1) sides.add(o > 0 ? 'right' : 'left'); }
    if (!sides.size) continue;
    const kind: CorridorGapKind = ob.kind === 'road' ? 'junction' : 'crossing';
    const half = (ob.width ?? 4) / 2 + (kind === 'junction' ? 2.5 : 1.5);
    gaps.push({ s: samples[k]!.s, side: sides.size === 2 ? 'both' : [...sides][0]!, kind, half });
  }
  // V01's own start/end is the VG junction (the loop closes there): VG leaves on the right at s 0.
  for (const th of world.thresholds) {
    if (!th.kerbGap || !Number.isFinite(th.at[0])) continue;
    const { k, d } = nearestK(th.at); if (d > PAVED + 6 || d < PAVED - 1) continue;
    if (gaps.some(g => Math.abs(g.s - samples[k]!.s) < 6)) continue;
    gaps.push({ s: samples[k]!.s, side: lateral(k, th.at) > 0 ? 'right' : 'left', kind: 'entrance', half: 3 });
  }
  // Journey station pads beside the road (station.jul on R7, station.oct on R5): their frontage is an entrance.
  for (const p of world.collision?.pads ?? []) {
    if (p.kind !== 'station' || p.underground) continue;
    const { k, d } = nearestK([p.centre[0], p.centre[2]]); if (d > Math.max(p.size[0], p.size[1]) / 2 + PAVED + 4) continue;
    if (gaps.some(g => Math.abs(g.s - samples[k]!.s) < 8)) continue;
    gaps.push({ s: samples[k]!.s, side: lateral(k, [p.centre[0], p.centre[2]]) > 0 ? 'right' : 'left', kind: 'entrance', half: 4 });
  }
  for (const p of world.collision?.pads ?? []) {
    if (!/layby/.test(p.id)) continue;
    const { k, d } = nearestK([p.centre[0], p.centre[2]]); if (d > 16) continue;
    gaps.push({ s: samples[k]!.s, side: lateral(k, [p.centre[0], p.centre[2]]) > 0 ? 'right' : 'left', kind: 'layby', half: 8 });
  }
  // Structure ends are thresholds on both sides (the structure's own edge begins).
  for (let k = 1; k < n; k++) if (!!sid[k] !== !!sid[k - 1]) gaps.push({ s: samples[k]!.s, side: 'both', kind: 'threshold', half: 1 });
  const gapAt = (s: number, side: 'left' | 'right'): CorridorGapKind | undefined => {
    for (const g of gaps) { let ds = Math.abs(g.s - s); if (closed) ds = Math.min(ds, length - ds); if (ds <= g.half && (g.side === 'both' || g.side === side)) return g.kind; }
    return undefined;
  };

  // Developed patches inside open/coastal reaches: V01×VG / library junction and station.oct (R5), Tideline Park (R11),
  // station.jul lamp pair is a junction pair (R7 stays coastal), the town end of R13; VG's two junction ends.
  const developedAt = (p: Point3, s: number, r: CorridorReach): boolean => {
    const near = (q: Point2, rr: number) => Math.hypot(p[0] - q[0], p[2] - q[1]) < rr;
    if (id === 'V01') {
      // ROAD §3 R5: the junction box at the Green Road / library junction and the station.oct frontage.
      if (r.id === 'V01.R5') return near([900, 290], 45) || near([790, 322], 40);
      // Tideline Park (pad [1020, 1430], 60 × 32) lies at the R10/R11 seam: its frontage is developed in either reach.
      if (r.id === 'V01.R10' || r.id === 'V01.R11') return near([1020, 1430], 60);
      if (r.id === 'V01.R13') return s > r.from + (r.to - r.from) * 0.55;
      if (r.id === 'V01.R12') return false;
    }
    if (id === 'VG') return s < 45 || s > length - 45;
    return false;
  };
  const yw = I.yearWalk;
  const ywNear = new SegIndex([{ id: yw.id, points: yw.points, half: 2.6 }]);

  const stations: CorridorStation[] = samples.map((q, k) => {
    const r = reachAt(q.s), t = tangent(k), structureId = sid[k];
    let context: CorridorContext = structureId ? 'structure' : r.context === 'structure' ? 'open' : r.context;
    if (!structureId && developedAt(q.at, q.s, r)) context = 'developed';
    if (id === 'V01' && r.id === 'V01.R6' && q.s > (r.from + r.to) / 2) context = 'coastal';
    const side = (name: 'left' | 'right'): CorridorSide => {
      const sg = name === 'right' ? 1 : -1, ox = -t[1] * sg, oz = t[0] * sg;
      const probe = (o: number): Point2 => [q.at[0] + ox * o, q.at[2] + oz * o];
      const edgeP = probe(PAVED + 1.5), drop = q.at[1] - (I.water(...edgeP) ? 0 : I.ground(...edgeP));
      let waterEu: number | null = null;
      for (let o = PAVED; o <= 80; o += 2) { const p = probe(o); if (I.water(p[0], p[1])) { waterEu = o - PAVED; break; } }
      // The Year Walk as this side's footway: its centre 5.5–14 eu out on this side, near the road's height.
      let footway: CorridorSide['footway'];
      const c = ywNear.near(q.at[0] + ox * 9, q.at[2] + oz * 9);
      if (c && c.d < 6) {
        const o = (c.p[0] - q.at[0]) * ox + (c.p[2] - q.at[2]) * oz;
        if (o > PAVED + 0.3 && o < 14 && Math.abs(c.p[1] - q.at[1]) < 1.5) footway = { inner: Math.max(PAVED + 0.25, o - 2.6), outer: o + 2.6, height: c.p[1], bedId: yw.id };
      }
      let edge: CorridorEdge = structureId ? 'structure' : footway ? 'yearWalk' : 'shoulder';
      if (!structureId && !footway && context === 'developed') {
        const land = waterEu === null || (name === 'right' ? 1 : -1) === 1;
        edge = land ? 'sidewalk' : 'kerb';
      }
      if (!structureId && !footway && context === 'boulevard') edge = 'kerb';
      if (edge === 'sidewalk') footway = { inner: PAVED + CORRIDOR.kerbWidth, outer: PAVED + CORRIDOR.kerbWidth + CORRIDOR.sidewalkWidth, height: q.at[1] + CORRIDOR.kerbRise };
      const guard: GuardKind = structureId ? 'bridgeRail' : drop > CORRIDOR.guardDrop ? (context === 'mountain' ? 'stoneParapet' : 'postRail') : 'none';
      const inner = Math.max(PAVED + CORRIDOR.plantingSetback, (footway?.outer ?? 0) + 0.2);
      const outer = PAVED + (context === 'developed' ? 10 : context === 'boulevard' ? 12 : 20);
      const planting = structureId || guard === 'stoneParapet' && drop > 6 ? undefined : inner < outer ? { inner: PAVED + CORRIDOR.plantingSetback, outer } : undefined;
      const gap = gapAt(q.s, name);
      return { edge, guard, drop: Math.round(drop * 100) / 100, waterEu, paved: PAVED, ...(footway ? { footway } : {}), ...(planting ? { planting } : {}), ...(gap ? { gap } : {}) };
    };
    return { s: q.s, at: q.at, tangent: t, grade: gradeAt(k), context, reachId: r.id, half: HALF, left: side('left'), right: side('right'), ...(structureId ? { structureId } : {}) };
  });

  // An adapter median (tests the median rules): R10's straightest 140 eu away from gaps, carriageways kept ≥ 5.
  if (opts.median && id === 'V01') {
    const r10 = stations.filter(st => st.reachId === 'V01.R10' && !st.structureId);
    let best: { k: number; score: number } | null = null;
    for (let k = 0; k + 70 < r10.length; k++) {
      const a = r10[k]!, b = r10[k + 70]!; if (b.s - a.s > 150) continue;
      let turn = 0, bad = false;
      for (let j = k; j <= k + 70; j++) { const st = r10[j]!; if (st.left.gap || st.right.gap) bad = true; if (j > k) turn += Math.abs(Math.atan2(st.tangent[1], st.tangent[0]) - Math.atan2(r10[j - 1]!.tangent[1], r10[j - 1]!.tangent[0])); }
      if (bad) continue;
      const gapNear = gaps.some(g => g.s > a.s - 20 && g.s < b.s + 20);
      if (gapNear) continue;
      if (!best || turn < best.score) best = { k, score: turn };
    }
    if (best) for (let j = best.k; j <= best.k + 70; j++) {
      const st = r10[j]! as { -readonly [K in keyof CorridorStation]: CorridorStation[K] };
      st.median = { half: 1.5 }; st.half = 1.5 + 4;
      for (const nm of ['left', 'right'] as const) { const sd = st[nm] as { -readonly [K in keyof CorridorSide]: CorridorSide[K] }; sd.paved = 1.5 + 5; if (sd.planting) sd.planting = { inner: sd.paved + CORRIDOR.plantingSetback, outer: Math.max(sd.planting.outer, sd.paved + 8) }; if (sd.footway) { sd.footway = { ...sd.footway, inner: Math.max(sd.footway.inner, sd.paved + 0.25), outer: Math.max(sd.footway.outer, sd.paved + 0.25 + 2.2) }; } }
    }
  }

  const input: PlanInput = { id, closed, step: CORRIDOR.step, stations, reaches };
  const env: PlanEnv = {
    ground: I.ground, occupied: I.occupied, water: I.water, seed: 'horizon-geo-1', walks: [I.yearWalk],
    destinations: [
      ...world.journey.stations.flatMap(s => ('xy' in s.anchor ? [{ id: s.id, at: s.anchor.xy }] : [])),
      ...world.hosts.flatMap(h => ('xy' in h.door ? [{ id: h.id, at: h.door.xy }] : [])),
      ...world.places.filter(p => /tideline|campfire/i.test(p.id)).flatMap(p => ('xy' in p.anchor ? [{ id: p.id, at: p.anchor.xy }] : [])),
    ],
    structureKind: sid2 => structureKinds[sid2] ?? 'bridge',
  };
  // Integration: once the bake carries the real corridor (land/corridor, L2), the plan is exercised on its stations and
  // reaches exactly as the bake runs it; the adapter's env (ground, occupied, seed) stays.
  const real = world.corridors?.find(c => c.id === id);
  if (real && !opts.adapter) return { input: { id: real.id, closed: real.closed, step: real.step, stations: real.stations, reaches: real.reaches }, env, structureKinds };
  return { input, env, structureKinds };
}
