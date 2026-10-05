/**
 * The Water's Way (STORY.md): the neighbourhood dressing bake step.
 *
 * `createDressingContext` answers a module's questions (`DressingContext`) from the SAME world the bake builds (the final
 * ground, the beds, pads and aprons, the baked solids, the water, the hosts, the protected Green, the district partition)
 * and a seeded PRNG; `bakeDressings` runs every registered module once, validates its records, assigns each record to the
 * district under it (`districtAt`), turns building and prop colliders into baked `StructureSolid`s (kind `dressing`, ids
 * `dressing.<neighbourhood>.<recordId>.<part>`) with the grammar's `buildingCollision` and the prop kit's `propCollision`,
 * and collects the modules' light anchors, landmarks, lookouts, the hosts they re-dress and the Journey-map buildings.
 *
 * Validation (a bake with any problem throws one error listing all of them; `validateDressing` returns the list):
 *  1. every number finite; module `id` matches; building, prop, pool, landmark, lookout and light ids unique island-wide;
 *  2. a building's footprint (centre + corners) is not on a bed, pad/apron, stair, skate line, water or a baked solid, unless
 *     its kind is a deck-like structure (`BED_ALLOWED_BUILDINGS`: deck, platform, coveredBridge, gate, wall, liftTower, arch),
 *     it re-dresses a host (`hostId`: it stands on its own baked pad and solids), or `params.allowOnBed === true`;
 *  3. a prop is not in the inner part of a bed's tread (≥ 0.5 eu in from its edge) nor in water, unless it is a linear prop
 *     (`line`) or a water prop (`WATER_PROPS`: buoy, rowboat, kayak, gozzo, duckBox, net); a colliding prop also not on a pad;
 *  4. a plant is not on a bed or pad, and not in water unless aquatic (`AQUATIC_SPECIES`);
 *  5. nothing whose nominal height (`BUILDING` eave + roof; `PROP_HEIGHT` × scale; `SPECIES_HEIGHT` × scale) exceeds
 *     `PROTECTED_MAX_HEIGHT` (0.85) stands inside a protected area, unless the module lists its id in `allowInProtected`, or
 *     (plants) it stands at one of the module's own landmarks' base (within 0.5 eu): that plant IS the landmark tree.
 *  6. every collider part is finite, has top > bottom, and a walkable part is a 'deck' or 'floor'.
 *
 * Pure data: no scene or renderer imports here (the kits' collision/shape functions are pure geometry).
 */
import type { BedCut, PadCut, StructureSolid, WaterCut } from '../land/interfaces.ts';
import type { LightAnchor, Point2 } from '../world/definition.ts';
import { pointInPolygon } from '../world/geometry.ts';
import { waterHeightAt } from '../land/water/index.ts';
import { buildingCollision, buildingJourneyShape, type CollisionPart } from '../kit/buildings/index.ts';
import { propCollision } from '../kit/props/index.ts';
import { JOURNEY_MIN_HEIGHT, PROTECTED_MAX_HEIGHT, type BuildingKind, type BuildingRecord, type DistrictDressing, type DressingContext, type DressingSpecies, type JourneyDressingBuilding, type Landmark, type Lookout, type NeighbourhoodDressing, type NeighbourhoodModule, type PlantRecord, type PropKind, type PropRecord, type WorldDressing } from './types.ts';

/* ------------------------------------------------------------------ deterministic PRNG */

/** FNV-1a 32-bit hash of a string (the seed of a named stream). */
export function hashSeed(seed: string): number { let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); return h >>> 0; }
/** mulberry32: the same sequence on every machine for the same seed. Values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------------ the context */

/** The world-in-progress a context reads: the bake passes its cuts, ground, hosts and protected areas; tests pass small doubles. */
export interface DressingSource {
  ground: (x: number, z: number) => number;
  beds: readonly Pick<BedCut, 'id' | 'kind' | 'profile' | 'points' | 'width'>[];
  pads: readonly Pick<PadCut, 'id' | 'kind' | 'centre' | 'size' | 'rotationDegrees' | 'underground'>[];
  waters: readonly WaterCut[];
  solids: readonly Pick<StructureSolid, 'id' | 'positions' | 'indices'>[];
  hosts: DressingContext['hosts'];
  protectedAreas: DressingContext['protectedAreas'];
  districtAt: (x: number, z: number) => string;
}

/** Bed kinds that are not ground a thing could stand on (a cable in the air, a cave underground). */
const OFF_GROUND_BEDS = new Set(['cable', 'cave']);
const GRID = 32;
type Segment = { ax: number; az: number; bx: number; bz: number; half: number; bed: number };

function segmentDistance(s: { ax: number; az: number; bx: number; bz: number }, x: number, z: number): number {
  const dx = s.bx - s.ax, dz = s.bz - s.az, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(s.ax + dx * t - x, s.az + dz * t - z);
}
function triangleDistance2d(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, x: number, z: number): number {
  const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz), d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz), d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  if (!(neg && pos)) return 0;
  return Math.min(segmentDistance({ ax, az, bx, bz }, x, z), segmentDistance({ ax: bx, az: bz, bx: cx, bz: cz }, x, z), segmentDistance({ ax: cx, az: cz, bx: ax, bz: az }, x, z));
}

export type DressingContextImpl = DressingContext & {
  /** The bed whose tread holds (x, z) at least `inset` in from its edge, or null. */
  onBed(x: number, z: number, inset?: number): string | null;
  onPad(x: number, z: number, margin?: number): string | null;
  inWater(x: number, z: number): boolean;
  inSolid(x: number, z: number, margin?: number, ignore?: (id: string) => boolean): string | null;
};

export function createDressingContext(src: DressingSource): DressingContextImpl {
  const beds = src.beds.filter(b => !OFF_GROUND_BEDS.has(b.kind) && b.points.length > 0);
  const segs: Segment[] = [], grid = new Map<number, number[]>(), cellKey = (cx: number, cz: number) => cx * 65536 + cz;
  let maxHalf = 0;
  beds.forEach((b, bed) => {
    const half = (b.width ?? 0) / 2; maxHalf = Math.max(maxHalf, half);
    const pts = b.points.length === 1 ? [b.points[0]!, b.points[0]!] : b.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, c = pts[i]!, k = segs.length; segs.push({ ax: a[0], az: a[2], bx: c[0], bz: c[2], half, bed });
      const x0 = Math.floor((Math.min(a[0], c[0]) - half) / GRID), x1 = Math.floor((Math.max(a[0], c[0]) + half) / GRID), z0 = Math.floor((Math.min(a[2], c[2]) - half) / GRID), z1 = Math.floor((Math.max(a[2], c[2]) + half) / GRID);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const key = cellKey(cx, cz); let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(k); }
    }
  });
  /** Signed distance (eu) to the nearest bed edge passing `accept`, negative on a tread; +Infinity when none. */
  function nearestEdge(x: number, z: number, accept: (bed: number) => boolean): { d: number; bed: number } {
    let best = Infinity, bestBed = -1; const cx = Math.floor(x / GRID), cz = Math.floor(z / GRID), seen = new Set<number>();
    for (let ring = 0; ring <= 80; ring++) {
      if (ring * GRID - GRID - maxHalf > best) break;
      for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        for (const k of grid.get(cellKey(cx + i, cz + j)) ?? []) { if (seen.has(k)) continue; seen.add(k); const s = segs[k]!; if (!accept(s.bed)) continue; const d = segmentDistance(s, x, z) - s.half; if (d < best) { best = d; bestBed = s.bed; } }
      }
    }
    if (best === Infinity) for (let k = 0; k < segs.length; k++) { const s = segs[k]!; if (!accept(s.bed)) continue; const d = segmentDistance(s, x, z) - s.half; if (d < best) { best = d; bestBed = s.bed; } }
    return { d: best, bed: bestBed };
  }
  const pads = src.pads.filter(p => !p.underground);
  function onPad(x: number, z: number, margin = 0): string | null {
    for (const p of pads) {
      const a = p.rotationDegrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = x - p.centre[0], dz = z - p.centre[2];
      if (Math.abs(dx * c + dz * s) <= p.size[0] / 2 + margin && Math.abs(-dx * s + dz * c) <= p.size[1] / 2 + margin) return p.id;
    }
    return null;
  }
  const waters = src.waters.filter(w => !w.underground && w.kind !== 'dry');
  function waterLevelAt(x: number, z: number): number | null { for (const w of waters) { const h = waterHeightAt(w, x, z); if (h !== null) return h; } return null; }
  // Baked solids' plan footprints: every triangle's xz projection in a lazy grid (built on the first solid query).
  let solidGrid: Map<number, number[]> | null = null; const tris: { s: number; p: number[] }[] = [];
  function buildSolidGrid() {
    solidGrid = new Map();
    src.solids.forEach((solid, si) => {
      const P = solid.positions, I = solid.indices;
      for (let i = 0; i < I.length; i += 3) {
        const a = I[i]! * 3, b = I[i + 1]! * 3, c = I[i + 2]! * 3, p = [P[a]!, P[a + 2]!, P[b]!, P[b + 2]!, P[c]!, P[c + 2]!];
        const area = Math.abs((p[2]! - p[0]!) * (p[5]! - p[1]!) - (p[4]! - p[0]!) * (p[3]! - p[1]!));
        if (area < 1e-6) continue; // vertical faces project to a line; their neighbours carry the footprint
        const k = tris.length; tris.push({ s: si, p });
        const x0 = Math.floor(Math.min(p[0]!, p[2]!, p[4]!) / GRID), x1 = Math.floor(Math.max(p[0]!, p[2]!, p[4]!) / GRID), z0 = Math.floor(Math.min(p[1]!, p[3]!, p[5]!) / GRID), z1 = Math.floor(Math.max(p[1]!, p[3]!, p[5]!) / GRID);
        for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const key = cellKey(cx, cz); let l = solidGrid!.get(key); if (!l) solidGrid!.set(key, l = []); l.push(k); }
      }
    });
  }
  function inSolid(x: number, z: number, margin = 0, ignore?: (id: string) => boolean): string | null {
    if (!solidGrid) buildSolidGrid();
    const r = Math.ceil(margin / GRID), cx = Math.floor(x / GRID), cz = Math.floor(z / GRID);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const k of solidGrid!.get(cellKey(cx + i, cz + j)) ?? []) {
      const t = tris[k]!, id = src.solids[t.s]!.id; if (ignore?.(id)) continue;
      if (triangleDistance2d(t.p[0]!, t.p[1]!, t.p[2]!, t.p[3]!, t.p[4]!, t.p[5]!, x, z) <= margin) return id;
    }
    return null;
  }
  const onBed = (x: number, z: number, inset = 0) => { const n = nearestEdge(x, z, () => true); return n.d <= -inset ? beds[n.bed]!.id : null; };
  return {
    heightAt: src.ground,
    bedClearance(x, z, prefixes) { return nearestEdge(x, z, prefixes?.length ? b => prefixes.some(p => beds[b]!.id.startsWith(p)) : () => true).d; },
    occupied(x, z, margin = 0) { return nearestEdge(x, z, () => true).d <= margin || onPad(x, z, margin) !== null || waterLevelAt(x, z) !== null || inSolid(x, z, margin) !== null; },
    waterLevelAt,
    districtAt: src.districtAt,
    beds: beds.map(b => ({ id: b.id, profile: b.profile, points: b.points, width: b.width })),
    hosts: src.hosts,
    protectedAreas: src.protectedAreas,
    rng: seed => mulberry32(hashSeed(seed)),
    onBed, onPad, inWater: (x, z) => waterLevelAt(x, z) !== null, inSolid,
  };
}

/* ------------------------------------------------------------------ rules */

export const BED_ALLOWED_BUILDINGS: ReadonlySet<BuildingKind> = new Set(['deck', 'platform', 'coveredBridge', 'gate', 'wall', 'liftTower', 'arch']);
export const WATER_PROPS: ReadonlySet<PropKind> = new Set(['buoy', 'rowboat', 'kayak', 'gozzo', 'duckBox', 'net']);
export const AQUATIC_SPECIES: ReadonlySet<DressingSpecies> = new Set(['reed', 'cattail', 'sedge', 'lily']);
/** Nominal height (eu) of a plant at scale 1 (the protected-area rule; generous, never smaller than drawn). */
export const SPECIES_HEIGHT: Record<DressingSpecies, number> = {
  round: 6, fruit: 4.5, birch: 7, pine: 8, poplar: 9, alpine: 5, shrub: 1.3, flowering: 1.3, hedge: 1.3, heath: 0.5, palm: 8, flowerBed: 0.4, grassTuft: 0.4,
  reed: 1.8, cattail: 1.6, sedge: 0.6, lily: 0.05, willow: 9, tamarack: 10, spruce: 11, balsam: 9, oakGiant: 36, cypress: 10, olive: 5, stonePine: 11,
  juniper: 3, cedar: 10, prairieGrass: 0.9, fanPalm: 9, canaryPalm: 10, fern: 0.6, woodlandCard: 9, iceplant: 0.15, bougainvillea: 2.5, lemonPot: 1.3, dogwood: 5, apple: 4.5,
};
/** Nominal height (eu) of a prop at scale 1. */
export const PROP_HEIGHT: Record<PropKind, number> = {
  viewer: 1.5, viewerSeated: 1.3, bench: 0.85, ringBench: 0.85, picnicTable: 0.8, panel: 1.4, lantern: 2.6, lanternLow: 0.9, bollard: 0.8,
  railOpen: 1.05, fence: 1.1, drystoneWall: 1.1, hive: 0.7, hayBale: 1.2, kayak: 0.4, rowboat: 0.7, gozzo: 1.2, umbrella: 2.4, towel: 0.02,
  laundryLine: 2.4, stall: 2.6, cafeTable: 0.8, fountain: 1.6, planter: 0.8, bikeRack: 0.8, mapBoard: 1.6, sundial: 1.1, monthStone: 0.6,
  kite: 12, swing: 3, windsock: 6, beacon: 4, fireRing: 0.4, volleyNet: 2.4, lifeRing: 1.4, rodHolder: 1, duckBox: 1.5,
  ospreyPole: 12, snag: 8, buoy: 1, bollardQuay: 0.7, net: 1.5, crate: 0.8, cairn: 1.2, sheepFank: 1.2, festoon: 3, flag: 6,
  bocceCourt: 0.3, skateBowl: 0.2, geoglyph: 0.2, readingTable: 0.8, bookCart: 1.1, birdFeeder: 1.8, bell: 1,
};
export const buildingHeight = (r: BuildingRecord) => r.size.h + (r.roof.form === 'flat' || r.roof.form === 'none' ? 0 : Math.tan(r.roof.pitch * Math.PI / 180) * Math.min(r.size.w, r.size.d) / 2);

/** Corners (inset 0.1 eu) and centre of a building's plan footprint. */
export function footprintSamples(r: BuildingRecord): Point2[] {
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw), hx = Math.max(0, r.size.w / 2 - 0.1), hz = Math.max(0, r.size.d / 2 - 0.1);
  return ([[0, 0], [-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const).map(([lx, lz]) => [r.at[0] + lx * c + lz * s, r.at[2] + lz * c - lx * s] as Point2);
}

const finite = (v: unknown): boolean => typeof v !== 'number' || Number.isFinite(v);
function allFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value && typeof value === 'object') return Object.values(value).every(allFinite);
  return finite(value);
}

/** Every validation problem of the modules' outputs against the context (empty = valid). */
export function validateDressing(outputs: readonly { module: NeighbourhoodModule['id']; dressing: NeighbourhoodDressing }[], ctx: DressingContextImpl): string[] {
  const problems: string[] = [], ids = { building: new Set<string>(), prop: new Set<string>(), pool: new Set<string>(), landmark: new Set<string>(), lookout: new Set<string>(), light: new Set<string>() };
  const unique = (kind: keyof typeof ids, id: string, where: string) => { if (!id) problems.push(`${where}: a ${kind} has no id`); else if (ids[kind].has(id)) problems.push(`${where}: duplicate ${kind} id ${id}`); else ids[kind].add(id); };
  const protectedAt = (x: number, z: number) => ctx.protectedAreas.find(a => pointInPolygon(x, z, a.outline))?.id ?? null;
  for (const { module, dressing: d } of outputs) {
    const where = `neighbourhood ${module}`, allow = new Set(d.allowInProtected ?? []);
    if (d.id !== module) problems.push(`${where}: build() returned id ${d.id}`);
    const lists = ['buildings', 'plants', 'props', 'ground', 'pools', 'life', 'lights', 'landmarks', 'lookouts'] as const;
    if (lists.some(key => !Array.isArray(d[key]))) { problems.push(`${where}: ${lists.filter(key => !Array.isArray(d[key])).join(', ')} not a list`); continue; }
    for (const b of d.buildings ?? []) {
      const w = `${where} building ${b.id}`; unique('building', b.id, where);
      if (!allFinite([b.at, b.yaw, b.size, b.roof.pitch, b.roof.overhang, b.paint ?? 0, b.params ?? {}, b.door?.u ?? 0, b.storeys ?? 0]) || b.at.length !== 3) { problems.push(`${w}: a non-finite number`); continue; }
      if (!(b.size.w > 0 && b.size.d > 0 && b.size.h > 0)) problems.push(`${w}: size must be positive`);
      if (!b.hostId && !BED_ALLOWED_BUILDINGS.has(b.kind) && b.params?.allowOnBed !== true) {
        for (const [x, z] of footprintSamples(b)) {
          const hit = ctx.onBed(x, z) ?? ctx.onPad(x, z) ?? (ctx.inWater(x, z) ? 'water' : null) ?? ctx.inSolid(x, z, 0, id => id.startsWith('dressing.'));
          if (hit) { problems.push(`${w}: footprint at [${x.toFixed(1)}, ${z.toFixed(1)}] is on ${hit}`); break; }
        }
      }
      const zone = footprintSamples(b).map(([x, z]) => protectedAt(x, z)).find(Boolean);
      if (zone && buildingHeight(b) > PROTECTED_MAX_HEIGHT && !allow.has(b.id) && b.params?.allowInProtected !== true) problems.push(`${w}: ${buildingHeight(b).toFixed(2)} eu tall inside protected ${zone}`);
    }
    d.props?.forEach((p, i) => {
      const w = `${where} prop ${p.id ?? `#${i}`}`; if (p.id !== undefined) unique('prop', p.id, where);
      if (!allFinite([p.at, p.yaw, p.scale ?? 1, p.variant ?? 0, p.line ?? []]) || p.at.length !== 3) { problems.push(`${w}: a non-finite number`); return; }
      const [x, , z] = p.at;
      if (!p.line && !WATER_PROPS.has(p.kind)) {
        const bed = ctx.onBed(x, z, 0.5), pad = p.collide ? ctx.onPad(x, z) : null, wet = ctx.inWater(x, z);
        if (bed || pad || wet) problems.push(`${w}: ${p.kind} stands on ${bed ?? pad ?? 'water'}`);
      }
      const zone = protectedAt(x, z), h = PROP_HEIGHT[p.kind] * (p.scale ?? 1);
      if (zone && h > PROTECTED_MAX_HEIGHT && !(p.id && allow.has(p.id))) problems.push(`${w}: ${p.kind} ${h.toFixed(2)} eu tall inside protected ${zone}`);
    });
    d.plants?.forEach((p, i) => {
      const w = `${where} plant #${i} (${p.species})`;
      if (!allFinite([p.at, p.scale, p.yaw, p.tint ?? 0, p.lean ?? 0]) || p.at.length !== 3 || !(p.scale > 0)) { problems.push(`${w}: a non-finite number or scale`); return; }
      const [x, , z] = p.at, bed = ctx.onBed(x, z), pad = ctx.onPad(x, z), wet = !AQUATIC_SPECIES.has(p.species) && ctx.inWater(x, z);
      if (bed || pad || wet) problems.push(`${w}: on ${bed ?? pad ?? 'water'}`);
      const zone = protectedAt(x, z), h = (SPECIES_HEIGHT[p.species] ?? 10) * p.scale;
      if (zone && h > PROTECTED_MAX_HEIGHT && !d.landmarks?.some(l => Math.hypot(l.at[0] - x, l.at[2] - z) <= 0.5)) problems.push(`${w}: ${h.toFixed(2)} eu tall inside protected ${zone}`);
    });
    for (const g of d.ground ?? []) if (g.polygon.length < 3 || !allFinite(g.polygon)) problems.push(`${where}: ground paint ${g.surface} needs ≥ 3 finite points`);
    for (const p of d.pools ?? []) { unique('pool', p.id, where); if (p.outline.length < 3 || !allFinite([p.outline, p.level])) problems.push(`${where} pool ${p.id}: needs ≥ 3 finite points and a finite level`); }
    for (const l of d.life ?? []) if (!allFinite([l.at, l.radius, l.count])) problems.push(`${where}: life ${l.kind} has a non-finite number`);
    for (const l of d.lights ?? []) { unique('light', l.id, where); if (!allFinite(l)) problems.push(`${where} light ${l.id}: a non-finite number`); }
    for (const l of d.landmarks ?? []) { unique('landmark', l.id, where); if (!allFinite([l.at, l.top])) problems.push(`${where} landmark ${l.id}: a non-finite number`); if (l.neighbourhood !== module) problems.push(`${where} landmark ${l.id}: belongs to ${l.neighbourhood}`); }
    for (const l of d.lookouts ?? []) { unique('lookout', l.id, where); if (!allFinite([l.eye, l.facing])) problems.push(`${where} lookout ${l.id}: a non-finite number`); }
  }
  return problems;
}

/* ------------------------------------------------------------------ collision */

/** One collider part → the solid's positions/indices (outward-wound, closed). */
export function collisionPartMesh(part: CollisionPart): { positions: number[]; indices: number[] } {
  let ring: [number, number][], tops: number[];
  if (part.kind === 'box') {
    const c = Math.cos(part.yaw), s = Math.sin(part.yaw), hx = part.size[0] / 2, hz = part.size[1] / 2;
    ring = ([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const).map(([lx, lz]) => [part.centre[0] + lx * c + lz * s, part.centre[1] + lz * c - lx * s] as [number, number]);
    tops = ring.map(() => part.top);
  } else { ring = part.corners.map(p => [p[0], p[2]]); tops = part.corners.map(p => p[1]); }
  // Counter-clockwise seen from above (+y), so the top fan faces up and the side quads face out.
  let area = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i]!, b = ring[(i + 1) % ring.length]!; area += a[0] * b[1] - b[0] * a[1]; }
  if (area > 0) { ring = [...ring].reverse(); tops = [...tops].reverse(); }
  const n = ring.length, positions: number[] = [], indices: number[] = [];
  for (let i = 0; i < n; i++) positions.push(ring[i]![0], tops[i]!, ring[i]![1]);
  for (let i = 0; i < n; i++) positions.push(ring[i]![0], part.bottom, ring[i]![1]);
  const triangulated = earClip(ring);
  for (const [a, b, c] of triangulated) { indices.push(a, b, c); indices.push(n + a, n + c, n + b); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; indices.push(i, n + i, j, j, n + i, n + j); }
  return { positions, indices };
}
/** Ear clipping of a simple polygon given in the order whose top-face triangles (a, b, c) face +y. */
function earClip(ring: readonly [number, number][]): [number, number, number][] {
  const idx = ring.map((_, i) => i), out: [number, number, number][] = [];
  const cross = (a: number, b: number, c: number) => { const A = ring[a]!, B = ring[b]!, C = ring[c]!; return (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); };
  const inside = (p: number, a: number, b: number, c: number) => cross(a, b, p) < 0 && cross(b, c, p) < 0 && cross(c, a, p) < 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k + idx.length - 1) % idx.length]!, b = idx[k]!, c = idx[(k + 1) % idx.length]!;
      if (cross(a, b, c) >= 0) continue; // reflex (or straight) in this winding
      if (idx.some(p => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push([a, b, c]); idx.splice(k, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (idx.length >= 3) for (let k = 1; k < idx.length - 1; k++) out.push([idx[0]!, idx[k]!, idx[k + 1]!]);
  return out;
}

function partProblems(part: CollisionPart, where: string): string[] {
  const out: string[] = [];
  if (!allFinite(part)) out.push(`${where}: a non-finite collider number`);
  const top = part.kind === 'box' ? part.top : Math.min(...part.corners.map(c => c[1]));
  if (!(top > part.bottom)) out.push(`${where}: collider top ≤ bottom`);
  if (part.kind === 'prism' && part.corners.length < 3) out.push(`${where}: prism needs ≥ 3 corners`);
  if (part.walkable && part.role !== 'deck' && part.role !== 'floor') out.push(`${where}: a walkable part must be a deck or floor (${part.role})`);
  return out;
}

export function collisionSolids(neighbourhood: string, recordId: string, districtId: string, parts: readonly CollisionPart[], problems: string[]): StructureSolid[] {
  return parts.flatMap((part, i) => {
    const id = `dressing.${neighbourhood}.${recordId}.${i}`, issues = partProblems(part, id);
    if (issues.length) { problems.push(...issues); return []; }
    const mesh = collisionPartMesh(part);
    return [{ id, kind: 'dressing', positions: mesh.positions, indices: mesh.indices, surface: part.surface, districtId, bedIds: [], walkable: part.walkable, role: part.role }];
  });
}

/* ------------------------------------------------------------------ the bake */

export interface DressingBake {
  /** The world-definition payload (`WorldDefinition.dressing`); null when no module dresses anything. */
  dressing: WorldDressing | null;
  /** Baked collision (kind `dressing`), appended to the world's solids before partitioning. */
  solids: StructureSolid[];
  /** The modules' night anchors, appended to `world.lights`. */
  lights: LightAnchor[];
}

const emptyDistrict = (districtId: string): DistrictDressing => ({ districtId, buildings: [], plants: [], props: [], ground: [], pools: [], life: [] });
const centroid = (poly: readonly Point2[]): Point2 => { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; };

export function bakeDressings(modules: readonly NeighbourhoodModule[], ctx: DressingContextImpl): DressingBake {
  if (!modules.length) return { dressing: null, solids: [], lights: [] };
  const seen = new Set<string>();
  for (const m of modules) { if (seen.has(m.id)) throw new Error(`Duplicate neighbourhood module ${m.id}`); seen.add(m.id); }
  const outputs = [...modules].sort((a, b) => a.id.localeCompare(b.id)).map(m => ({ module: m.id, dressing: m.build(ctx) }));
  const problems = validateDressing(outputs, ctx);
  if (problems.length) throw new Error(`Neighbourhood dressing is invalid (${problems.length}):\n  ${problems.slice(0, 40).join('\n  ')}${problems.length > 40 ? '\n  …' : ''}`);
  const byDistrict = new Map<string, DistrictDressing>(), at = (id: string) => { let d = byDistrict.get(id); if (!d) byDistrict.set(id, d = emptyDistrict(id)); return d; };
  const solids: StructureSolid[] = [], lights: LightAnchor[] = [], landmarks: Landmark[] = [], lookouts: Lookout[] = [], journey: JourneyDressingBuilding[] = [], hosts = new Set<string>();
  for (const { module, dressing: d } of outputs) {
    for (const src of d.buildings) {
      const districtId = ctx.districtAt(src.at[0], src.at[2]), b: BuildingRecord = { ...src, districtId };
      at(districtId).buildings.push(b);
      if (b.collide) solids.push(...collisionSolids(module, b.id, districtId, buildingCollision(b, ctx.heightAt), problems));
      if (b.hostId) hosts.add(b.hostId);
      if (b.size.h >= JOURNEY_MIN_HEIGHT || b.landmarkId) { const s = buildingJourneyShape(b); journey.push({ id: b.id, districtId, footprint: s.footprint.map(p => [p[0], p[1]] as Point2), base: b.at[1], height: s.height, roofHeight: s.roofHeight, ...(b.landmarkId ? { landmarkId: b.landmarkId } : {}) }); }
    }
    d.plants.forEach(p => at(ctx.districtAt(p.at[0], p.at[2])).plants.push(p as PlantRecord));
    d.props.forEach((p, i) => {
      const districtId = ctx.districtAt(p.at[0], p.at[2]); at(districtId).props.push(p as PropRecord);
      if (p.collide) solids.push(...collisionSolids(module, p.id ?? `prop${i}`, districtId, propCollision(p, ctx.heightAt), problems));
    });
    for (const g of d.ground) { const c = centroid(g.polygon); at(ctx.districtAt(c[0], c[1])).ground.push(g); }
    for (const p of d.pools) { const c = centroid(p.outline); at(ctx.districtAt(c[0], c[1])).pools.push(p); }
    for (const l of d.life) at(ctx.districtAt(l.at[0], l.at[2])).life.push(l);
    lights.push(...d.lights); landmarks.push(...d.landmarks); lookouts.push(...d.lookouts);
  }
  if (problems.length) throw new Error(`Neighbourhood dressing colliders are invalid (${problems.length}):\n  ${problems.slice(0, 40).join('\n  ')}`);
  const districts = [...byDistrict.values()].sort((a, b) => a.districtId.localeCompare(b.districtId));
  const empty = !districts.length && !landmarks.length && !lookouts.length && !lights.length;
  return {
    dressing: empty ? null : { districts, landmarks, lookouts, ...(hosts.size ? { redressedHosts: [...hosts].sort() } : {}), ...(journey.length ? { journey } : {}) },
    solids, lights,
  };
}
