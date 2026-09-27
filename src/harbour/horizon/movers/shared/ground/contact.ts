/**
 * The contact adapter (RIDE §2.3, §6.5, §8.3): the kernel's `ContactQuery` over the Horizon
 * geography, the WorldDefinition's beds and threshold pads, and MANIFEST v1.7's paces and grip.
 * Pure: no three, no DOM, no clock. The kernel calls `sample` three times per 1/120 s step,
 * so bed lookup goes through per-bed bounds and a coarse grid of polyline segments.
 */
import type {createHorizonGeography} from '../../../runtime/geography.ts';
import type {Bed, WorldDefinition} from '../../../world/definition.ts';
import type {HORIZON_MANIFEST} from '../../../world/manifest.ts';
import type {ContactQuery, ContactSample, GroundProfile, Pace, XYZ} from './types.ts';

type Geography = ReturnType<typeof createHorizonGeography>;
type Manifest = typeof HORIZON_MANIFEST;
type SurfaceSegment = NonNullable<Bed['surfaceSegments']>[number];

/** How far above the height the kernel asks about a surface may still be seen (risers for the lip test). */
export const CONTACT_REACH = 0.5;
/** The bed counts out to its edge (and shoulders) plus this margin (RIDE §6.5: the gravel shoulders are the bed). */
export const BED_EDGE_MARGIN = 0.25;
/** A bed whose centreline is further than this above or below the surface is not the one under the wheels (bridges, tunnels). */
export const BED_HEIGHT_TOLERANCE = 1.5;
/** A pad is the ground only when its slab top is this close to the surface found. */
export const PAD_HEIGHT_TOLERANCE = 0.6;
/** The kernel's offbed class (RIDE §8.3): lateral grip on ground that does not roll. */
export const OFFBED_GRIP = 0.6;
/** Grip for a material the manifest does not list (terrain 'grass'). Pads' and the park's 'stone' has its own row (1.0). */
export const UNLISTED_GRIP = 0.6;
/** The Tideline park's pace. Its slab reports 'stone', whose manifest pace (threshold) belongs to the pads. */
export const PARK_PACE: Pace = 'flow';
/** The slab material of pads, station slabs and the park: it lends grip, never pace (a pad's pace comes from the pad itself). */
export const SLAB_MATERIAL = 'stone';
/** A pick-up pad with no bed under it rolls at this pace: a pick-up pad is the line's pace, not threshold pace. */
export const PICKUP_FALLBACK_PACE: Pace = 'fast';
/** The fade back walks a wet line this far each way for dry deck (RIDE §6.5), then falls back to a pad. */
export const DRY_SEARCH = 60;
const DRY_STEP = 1;
/** A fade target must stay dry this far below its ground, so the board is not set down on the water's very edge and faded again. */
export const DRY_MARGIN = 0.2;

const PACES: readonly Pace[] = ['fast', 'flow', 'slow', 'threshold', 'skate'];
const CELL = 16;

/** The profile word a bed answers to: 'skate', 'road', 'trail', or its own kind (walk, stair, …), which no mover lists. */
export function bedClass(bed: Pick<Bed, 'kind' | 'profile'>): string {
  if (bed.kind === 'skate' || bed.profile.startsWith('skate')) return 'skate';
  if (bed.kind === 'road' || bed.profile === 'road' || bed.profile === 'spur') return 'road';
  if (bed.kind === 'trail' || bed.profile === 'trail') return 'trail';
  return bed.kind ?? bed.profile;
}

export interface BedHit {
  bed: Bed; bedId: string; kind: string;
  /** Polyline segment index (points[i] → points[i + 1]) and the projection along it (0..1). */
  index: number; f: number;
  /** Index-fraction parameter along the polyline, the same parameter `surfaceSegments[*].from/to` slice (build.ts:63). */
  t: number;
  segment: SurfaceSegment | null; segmentIndex: number;
  /** Plan distance from the centreline; `at` is the nearest centreline point (with its height). */
  distance: number; at: XYZ;
}
export interface PadHit {
  padId: string; thresholdId: string; centre: XYZ; size: [number, number]; rotationDegrees: number;
  /** A pick-up pad: its threshold's modes hold no `X→feet` step (only `feet→board`, `feet→bicycle`, …). It rolls at the pace of the bed it starts. */
  pickup: boolean;
}

/** True when no mode of a threshold steps onto feet (`board→feet`, `feet→feet`, `canoe→feet→canoe` all do): a pure pick-up. */
/** The bed classes each picked-up mover rolls on: whose pick-up pad a profile owns. */
const PICKUP_BEDS: Readonly<Record<string, readonly string[]>> = {board: ['skate'], bicycle: ['road', 'trail'], wheels: ['skate', 'road', 'trail']};

export function isPickupThreshold(modes: readonly string[]): boolean {
  return modes.length > 0 && modes.every(m => { const steps = m.split('→'); return steps.slice(1).every(to => to !== 'feet'); });
}

interface Pad extends PadHit { cos: number; sin: number; reach: number; takes: string[] }
interface BedIndex {
  beds: Bed[]; halfWidth: number[]; boxes: Float64Array;
  cells: Map<number, number[]>; pads: Pad[]; padCells: Map<number, number[]>;
  park: { x: number; z: number; hw: number; hd: number } | null;
}

const cellKey = (cx: number, cz: number) => cx * 65536 + cz;
function cover(map: Map<number, number[]>, x0: number, z0: number, x1: number, z1: number, value: number): void {
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      const k = cellKey(cx, cz), list = map.get(k);
      if (list) list.push(value); else map.set(k, [value]);
    }
}

function buildIndex(world: WorldDefinition, manifest?: Manifest): BedIndex {
  const shoulder = new Map((world.collision?.beds ?? []).map(b => [b.id, b.shoulder]));
  const beds = world.beds.filter(b => b.points.length >= 2 && b.kind !== 'cable');
  const halfWidth = beds.map(b => (b.width ?? 0) / 2 + (shoulder.get(b.id) ?? 0) + BED_EDGE_MARGIN);
  const boxes = new Float64Array(beds.length * 4), cells = new Map<number, number[]>();
  beds.forEach((b, i) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const r = halfWidth[i]!;
    for (let k = 0; k < b.points.length - 1; k++) {
      const a = b.points[k]!, c = b.points[k + 1]!;
      const sx0 = Math.min(a[0], c[0]) - r, sz0 = Math.min(a[2], c[2]) - r, sx1 = Math.max(a[0], c[0]) + r, sz1 = Math.max(a[2], c[2]) + r;
      x0 = Math.min(x0, sx0); z0 = Math.min(z0, sz0); x1 = Math.max(x1, sx1); z1 = Math.max(z1, sz1);
      cover(cells, sx0, sz0, sx1, sz1, i * 65536 + k);
    }
    boxes.set([x0, z0, x1, z1], i * 4);
  });
  // Threshold pads: the graded slab each threshold owns (WorldDefinition.collision.pads, by padId).
  // A world without collision data falls back to a 6 × 5 m box on the threshold's own point and height.
  const cutPads = new Map((world.collision?.pads ?? []).map(p => [p.id, p]));
  const pads: Pad[] = [], padCells = new Map<number, number[]>();
  for (const t of world.thresholds) {
    const cut = t.padId ? cutPads.get(t.padId) : undefined;
    const centre: XYZ = cut ? [cut.centre[0], cut.centre[1], cut.centre[2]] : [t.at[0], t.height ?? 0, t.at[1]];
    const size: [number, number] = cut ? [cut.size[0], cut.size[1]] : [6, 5], rotationDegrees = cut?.rotationDegrees ?? 0;
    const a = rotationDegrees * Math.PI / 180, reach = Math.hypot(size[0], size[1]) / 2;
    const pad: Pad = {padId: t.padId ?? `threshold.${t.id}`, thresholdId: t.id, centre, size, rotationDegrees, pickup: isPickupThreshold(t.modes ?? []), cos: Math.cos(a), sin: Math.sin(a), reach, takes: (t.modes ?? []).map(m => m.split('→').at(-1)!)};
    cover(padCells, centre[0] - reach, centre[2] - reach, centre[0] + reach, centre[2] + reach, pads.length);
    pads.push(pad);
  }
  const s = world.scaleFactor ?? 1, p = manifest?.skate.park;
  const park = p ? {x: p.xy[0]! * s, z: p.xy[1]! * s, hw: p.size[0]! * s / 2, hd: p.size[1]! * s / 2} : null;
  return {beds, halfWidth, boxes, cells, pads, padCells, park};
}

function segmentOf(bed: Bed, index: number): { segment: SurfaceSegment | null; segmentIndex: number } {
  const list = bed.surfaceSegments;
  if (!list?.length) return {segment: null, segmentIndex: -1};
  // The geometry's own rule (profiles.ts emitBedGeometry): slab i takes the slice its start index falls in.
  const k = Math.min(list.length - 1, Math.floor(index / (bed.points.length - 1) * list.length));
  return {segment: list[k]!, segmentIndex: k};
}

/** Every bed whose deck (with shoulders and margin) contains (x, z); nearest centreline first. With `y`, only beds near that height. */
function bedsAt(ix: BedIndex, x: number, z: number, y?: number): BedHit[] {
  const list = ix.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!list) return [];
  const best = new Map<number, BedHit>();
  for (const code of list) {
    const i = Math.floor(code / 65536), k = code % 65536, o = i * 4;
    if (x < ix.boxes[o]! || z < ix.boxes[o + 1]! || x > ix.boxes[o + 2]! || z > ix.boxes[o + 3]!) continue;
    const bed = ix.beds[i]!, a = bed.points[k]!, b = bed.points[k + 1]!;
    const dx = b[0] - a[0], dz = b[2] - a[2], d = dx * dx + dz * dz;
    const f = d ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / d)) : 0;
    const px = a[0] + dx * f, pz = a[2] + dz * f, distance = Math.hypot(x - px, z - pz);
    if (distance > ix.halfWidth[i]!) continue;
    const py = a[1] + (b[1] - a[1]) * f;
    if (y !== undefined && Math.abs(py - y) > BED_HEIGHT_TOLERANCE) continue;
    const prev = best.get(i);
    if (prev && prev.distance <= distance) continue;
    best.set(i, {bed, bedId: bed.id, kind: bedClass(bed), index: k, f, t: (k + f) / (bed.points.length - 1), ...segmentOf(bed, k), distance, at: [px, py, pz]});
  }
  return [...best.values()].sort((p, q) => p.distance - q.distance);
}

/**
 * The pad under (x, z): the one whose slab top is nearest `y`. Two pads on one spot (skateLineStarts.3 and
 * upperStreetSpur) tie; `prefer` then picks (the profile's own pick-up pad), else the first listed stands.
 */
function padAt(ix: BedIndex, x: number, z: number, y?: number, prefer?: ReadonlySet<Pad>): PadHit | null {
  const list = ix.padCells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!list) return null;
  let found: Pad | null = null, gap = Infinity;
  for (const i of list) {
    const p = ix.pads[i]!, rx = x - p.centre[0], rz = z - p.centre[2];
    if (Math.abs(rx * p.cos + rz * p.sin) > p.size[0] / 2 || Math.abs(-rx * p.sin + rz * p.cos) > p.size[1] / 2) continue;
    const dy = y === undefined ? 0 : Math.abs(y - p.centre[1]);
    if (dy > PAD_HEIGHT_TOLERANCE) continue;
    const tie = found !== null && Math.abs(dy - gap) < 1e-9;
    if (dy > gap || (tie && !(prefer?.has(p) && !prefer.has(found!)))) continue;
    found = p; gap = dy;
  }
  return found && {padId: found.padId, thresholdId: found.thresholdId, centre: found.centre, size: found.size, rotationDegrees: found.rotationDegrees, pickup: found.pickup};
}

const inPark = (ix: BedIndex, x: number, z: number) => !!ix.park && Math.abs(x - ix.park.x) <= ix.park.hw && Math.abs(z - ix.park.z) <= ix.park.hd;

const cache = new WeakMap<WorldDefinition, BedIndex>();
function indexFor(world: WorldDefinition, manifest?: Manifest): BedIndex {
  let ix = cache.get(world);
  if (!ix || (manifest && !ix.park)) { ix = buildIndex(world, manifest); cache.set(world, ix); }
  return ix;
}

/** The bed under (x, z): nearest centreline among the beds whose deck contains the point (at height `y` when given), with its surface segment. */
export function bedAt(world: WorldDefinition, x: number, z: number, y?: number): BedHit | null {
  return bedsAt(indexFor(world), x, z, y)[0] ?? null;
}

/** The pace the kernel rolls at for a sample: its pace on legal ground, the offbed class otherwise (or with no ground). */
export function paceOf(sample: ContactSample | null): Pace {
  return sample && sample.legal ? sample.pace : 'offbed';
}

export interface BoardContact extends ContactQuery {
  /** The best bed under (x, z) for this profile (a legal one when two overlap), at height `y` when given. */
  bedAt(x: number, z: number, y?: number): BedHit | null;
  padAt(x: number, z: number, y?: number): PadHit | null;
}

type PaceRow = { roll: number | null; pushGrip: number | null };
type SurfaceRow = { pace: string; grip: number | null };

/** The kernel's ContactQuery over the Horizon geography, for one mover's profile. */
export function createBoardContact(geography: Geography, world: WorldDefinition, manifest: Manifest, profile: GroundProfile): BoardContact {
  const ix = indexFor(world, manifest), legalKinds = new Set(profile.beds);
  const paces = manifest.paces as unknown as Record<string, PaceRow>;
  const surfaces = manifest.surfaces as unknown as Record<string, SurfaceRow | undefined>;
  const asPace = (value: string | undefined): Pace | null => (value && (PACES as readonly string[]).includes(value) && paces[value]?.roll != null ? value as Pace : null);
  const gripOf = (material: string) => surfaces[material]?.grip ?? UNLISTED_GRIP;
  const materialPace = (material: string) => (material === SLAB_MATERIAL ? null : asPace(surfaces[material]?.pace));

  function pick(x: number, z: number, y?: number): BedHit | null {
    const hits = bedsAt(ix, x, z, y);
    return hits.find(h => legalKinds.has(h.kind)) ?? hits[0] ?? null;
  }

  // A pick-up pad for this profile's own mover (feet→board for a profile on skate beds, feet→bicycle on roads and trails)
  // wins a tie with another pad on the same spot: skateLineStarts.3 for the board, upperStreetSpur for the bicycle.
  const ownPickups: ReadonlySet<Pad> = new Set(ix.pads.filter(p => p.pickup && p.takes.some(m => (PICKUP_BEDS[m] ?? []).some(k => legalKinds.has(k)))));

  /** A bed's pace at a surface: the slice (named exactly by the deck's solid id), the material, then the bed's own surface. */
  function bedPace(hit: BedHit, s: { id: string; material: string }): Pace | null {
    let segment = hit.segment;
    // On the deck itself the solid names its slice (`S1.surface.3.…`), exact at slab joins.
    if (hit.bed.surfaceSegments && s.id.startsWith(`${hit.bedId}.surface.`)) {
      const k = Number.parseInt(s.id.slice(hit.bedId.length + 9), 10);
      if (Number.isInteger(k) && hit.bed.surfaceSegments[k]) segment = hit.bed.surfaceSegments[k]!;
    }
    return asPace(segment?.pace) ?? materialPace(s.material) ?? asPace(surfaces[hit.bed.surface]?.pace);
  }

  function sample(x: number, z: number, y: number): ContactSample | null {
    const s = geography.surface(x, z, y, CONTACT_REACH);
    if (!s) return null;
    const n: XYZ = [s.nx, s.ny, s.nz], material = s.material;
    const offbed = (bedId: string | null, padId: string | null): ContactSample =>
      ({y: s.y, n, material, pace: 'offbed', legal: false, roll: profile.roll.offbed, grip: OFFBED_GRIP, pushGrip: 0, slope: s.slope, bedId, padId});
    const legal = (pace: Pace, bedId: string | null, padId: string | null): ContactSample =>
      ({y: s.y, n, material, pace, legal: true, roll: paces[pace]!.roll!, grip: gripOf(material), pushGrip: paces[pace]!.pushGrip ?? 1, slope: s.slope, bedId, padId});

    const pad = padAt(ix, x, z, s.y, ownPickups);
    if (pad) {
      if (!legalKinds.has('pad')) return offbed(null, pad.padId);
      if (!pad.pickup) return legal('threshold', null, pad.padId);
      // A pick-up pad is the line's pace, not threshold pace: the bed it starts, else the surface's own pace, else fast.
      const start = pick(x, z, s.y);
      return legal((start && bedPace(start, s)) ?? materialPace(material) ?? PICKUP_FALLBACK_PACE, start?.bedId ?? null, pad.padId);
    }
    const hit = pick(x, z, s.y);
    if (hit && legalKinds.has(hit.kind)) {
      const pace = bedPace(hit, s);
      return pace ? legal(pace, hit.bedId, null) : offbed(hit.bedId, null);
    }
    if (legalKinds.has('park') && inPark(ix, x, z)) return legal(materialPace(material) ?? PARK_PACE, null, null);
    return offbed(hit?.bedId ?? null, null);
  }

  // The fade back's targets: every legal bed polyline, the pads those beds run through, and the park.
  // Only dry ground counts (RIDE §6.5): S2's Bight Bridge lane dips under the Bight, and a fade that lands
  // in water fades again forever. A wet nearest point walks along its polyline both ways for dry deck.
  const legalBeds = ix.beds.filter(b => legalKinds.has(bedClass(b)));
  const padTargets = legalKinds.has('pad')
    ? ix.pads.filter(p => bedsAt(ix, p.centre[0], p.centre[2], p.centre[1]).some(h => legalKinds.has(h.kind))).map(p => p.centre)
    : [];
  /** The ground at a candidate (x, z) near height y, or null when it is missing or under (or within DRY_MARGIN of) water. */
  function dry(x: number, z: number, y: number): XYZ | null {
    const g = geography.surface(x, z, y, CONTACT_REACH);
    return g && !geography.submerged(x, z, g.y - DRY_MARGIN) ? [x, g.y, z] : null;
  }
  const lerp = (b: Bed, k: number, f: number): XYZ => {
    const a = b.points[k]!, c = b.points[k + 1]!;
    return [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f, a[2] + (c[2] - a[2]) * f];
  };
  /** The first dry point along bed b from (k, f) in direction dir (±1), within DRY_SEARCH metres of arc. */
  function walkDry(b: Bed, k: number, f: number, dir: 1 | -1): XYZ | null {
    let arc = 0, prev = lerp(b, k, f);
    // Vertices ahead of (k, f): k + 1, k + 2, … going up; k, k − 1, … going down.
    for (let v = dir > 0 ? k + 1 : k; v >= 0 && v < b.points.length; v += dir) {
      const p = b.points[v]!, len = Math.hypot(p[0] - prev[0], p[2] - prev[2]), steps = Math.max(1, Math.ceil(len / DRY_STEP));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, q: XYZ = [prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t, prev[2] + (p[2] - prev[2]) * t];
        if (arc + len * t > DRY_SEARCH) return null;
        const g = dry(q[0], q[2], q[1]);
        if (g) return g;
      }
      arc += len; prev = [p[0], p[1], p[2]];
    }
    return null;
  }
  function nearestBedPoint(x: number, z: number): XYZ | null {
    const plan = (p: XYZ) => Math.hypot(x - p[0], z - p[2]);
    let best: XYZ | null = null, gap = Infinity;
    const offer = (p: XYZ | null) => { if (p && plan(p) < gap) { gap = plan(p); best = p; } };
    // Each legal bed's nearest centreline point, nearest first; a wet one searches its line for dry deck.
    const near: { b: Bed; k: number; f: number; dist: number }[] = [];
    for (const b of legalBeds) {
      let bk = 0, bf = 0, bd = Infinity;
      for (let k = 0; k < b.points.length - 1; k++) {
        const a = b.points[k]!, c = b.points[k + 1]!, dx = c[0] - a[0], dz = c[2] - a[2], d = dx * dx + dz * dz;
        const f = d ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / d)) : 0;
        const dist = Math.hypot(x - a[0] - dx * f, z - a[2] - dz * f);
        if (dist < bd) { bd = dist; bk = k; bf = f; }
      }
      near.push({b, k: bk, f: bf, dist: bd});
    }
    near.sort((p, q) => p.dist - q.dist);
    for (const n of near) {
      if (n.dist >= gap) break;   // a walked point is never nearer than its projection
      const at = lerp(n.b, n.k, n.f), here = dry(at[0], at[2], at[1]);
      if (here) { offer(here); continue; }
      offer(walkDry(n.b, n.k, n.f, 1)); offer(walkDry(n.b, n.k, n.f, -1));
    }
    for (const c of padTargets) if (plan(c) < gap) offer(dry(c[0], c[2], c[1]));
    if (legalKinds.has('park') && ix.park) {
      const px = Math.max(ix.park.x - ix.park.hw, Math.min(ix.park.x + ix.park.hw, x)), pz = Math.max(ix.park.z - ix.park.hd, Math.min(ix.park.z + ix.park.hd, z));
      if (Math.hypot(x - px, z - pz) < gap) { const g = geography.surface(px, pz); if (g) offer(dry(px, pz, g.y)); }
    }
    if (best) return best;
    // Nothing dry within DRY_SEARCH of any line's nearest point: the profile's nearest threshold pad.
    for (const c of padTargets) offer([c[0], c[1], c[2]]);
    return best;
  }

  return {
    sample,
    submerged: (x, z, y) => geography.submerged(x, z, y),
    blocked: (x, z, y, radius, travel) => geography.blocker(x, z, y, radius, travel) !== null,
    nearestBedPoint,
    bedAt: pick,
    padAt: (x, z, y) => padAt(ix, x, z, y, ownPickups),
  };
}
