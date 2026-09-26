import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { BedCut, LandCuts, PadCut, TerrainField, WaterCut, XY, XYZ } from '../interfaces';
import { coastCharacter, signedShoreDistance } from '../coast';
import { buildWaterCuts, waterInfluence } from '../water';
import { clamp, contains, linePoint, mix, polygonCentre, polygonDistance, polylineArcs, segmentPoint, smooth } from './geometry';

export const GEOGRAPHY_REVISION = 'horizon-geo-1' as const;
/** The one walkable limit: MANIFEST `profiles.walkable.slope_max_deg` (40°, Mountain v2's body
 * limit). Bake, paint and the runtime geography all read this constant. Kept pure so baking imports no body scene. */
export const WALKABLE_DEGREES: number = M.profiles.walkable.slope_max_deg;
export const WALKABLE_SLOPE = Math.tan(WALKABLE_DEGREES * Math.PI / 180);
export const isWalkableSlope = (slope: number): boolean => Number.isFinite(slope) && slope <= WALKABLE_SLOPE;
export const TERRAIN_SURFACE_PALETTE = [
  { id: 'sand', color: '#e0cfa5', night: '#6c7282' },
  { id: 'bankedTurf', color: '#7d9a58', night: '#37453c' },
  { id: 'duff', color: '#8a6f4f', night: '#37453c' },
  { id: 'ochre', color: '#d7ac6b', night: '#5d5660' },
  { id: 'rock.crown', color: '#a3998a', night: '#6c7282', strata: 'Crown' },
  { id: 'rock.crown.ledge', color: '#c4bba9', night: '#8991a1', strata: 'Crown' },
  { id: 'rock.notch', color: '#b3a58f', night: '#6c7282', strata: 'Notch' },
  { id: 'rock.notch.ledge', color: '#d3bf99', night: '#8991a1', strata: 'Notch' },
  { id: 'rock.ochre', color: '#8f6236', night: '#5d5660', strata: 'Ochre' },
  { id: 'rock.ochre.ledge', color: '#d7ac6b', night: '#8a5f45', strata: 'Ochre' },
  { id: 'rock.sea', color: '#9a9489', night: '#6c7282', strata: 'Sea cliff' },
  { id: 'rock.sea.ledge', color: '#c4bba9', night: '#8991a1', strata: 'Sea cliff' },
  { id: 'paved', color: '#c9b891', night: '#6c7282' },
  { id: 'packedEarth', color: '#b39f78', night: '#5d5660' },
  { id: 'apron', color: '#d9d2c2', night: '#6c7282' },
  { id: 'boardwalk', color: '#b08a5e', night: '#3a2c26' },
  { id: 'cobble', color: '#bfa982', night: '#6c7282' },
  { id: 'gravel', color: '#cbbb98', night: '#6c7282' },
  { id: 'plaza', color: '#d3bf99', night: '#6c7282' },
  { id: 'snow', color: '#f1f1ec', night: '#8fa3c7' },
  { id: 'scree', color: '#b8ad98', night: '#6c7282' },
] as const;
/** One byte per terrain vertex: the ground paint (palette index, bits 0–4) and the rock
 * strata set the vertex shows where the ground is steep (bits 5–6). Rock is not baked
 * per vertex: the renderer weights it from each triangle's slope (soft 35–45°) and draws
 * the ledges from world height, so paint follows contours, never the 5 m lattice. */
export const ROCK_SETS = [
  { id: 'crown', base: 'rock.crown', ledge: 'rock.crown.ledge', spacing: 3.2 },
  { id: 'notch', base: 'rock.notch', ledge: 'rock.notch.ledge', spacing: 2.2 },
  { id: 'ochre', base: 'rock.ochre', ledge: 'rock.ochre.ledge', spacing: 4 },
  { id: 'sea', base: 'rock.sea', ledge: 'rock.sea.ledge', spacing: 3.2 },
] as const;
export const packTerrainPaint = (ground: number, rockSet: number): number => (ground & 31) | ((rockSet & 3) << 5);
export const terrainPaintGround = (byte: number): number => byte & 31;
export const terrainPaintRockSet = (byte: number): number => (byte >> 5) & 3;
/** Biome ground that the renderer blends softly between neighbours (bed paint is never blended). */
export const BIOME_GROUNDS: readonly number[] = ['sand', 'bankedTurf', 'duff', 'ochre', 'scree'].map(id => TERRAIN_SURFACE_PALETTE.findIndex(p => p.id === id));
/** Rock weight from a triangle's slope: 0 at 35°, 1 at 45°, ≥ 0.5 above the walkable limit. */
export const ROCK_BLEND_DEGREES = [35, 45] as const;
export const rockWeight = (degrees: number): number => smooth((degrees - ROCK_BLEND_DEGREES[0]) / (ROCK_BLEND_DEGREES[1] - ROCK_BLEND_DEGREES[0]));

interface Band { id: string; min: number; max: number; poly: XY[]; centre: XY; bounds: number[]; priority: number }
let model: { bands: Band[]; water: WaterCut[]; scale: number } | undefined;
function getModel(): NonNullable<typeof model> {
  if (model) return model;
  const s = requireScaleFactor();
  const ordered = ['sands', 'reach', 'harbour', 'green', 'flats', 'scholars', 'prow', 'shoulder', 'crown', 'hollow', 'stillwater'];
  const bands: Band[] = [];
  for (const f of M.landforms) if (f.poly && Array.isArray(f.h)) {
    const poly: XY[] = f.poly.map(p => [p[0]! * s, p[1]! * s]);
    bands.push({ id: f.id, min: f.h[0]! * s, max: f.h[1]! * s, poly, centre: polygonCentre(poly), priority: ordered.indexOf(f.id),
      bounds: [Math.min(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[0])), Math.max(...poly.map(p => p[1]))] });
  }
  bands.sort((a, b) => a.priority - b.priority);
  return model = { bands, water: buildWaterCuts(), scale: s };
}
/** Polygon-normalised summit. Its contours inherit the unequal shoulders and ridges
 * of the Crown polygon; this is not a radial cone or a circular district plateau. */
function crownHeight(b: Band, x: number, z: number): number {
  const s = getModel().scale, summit = M.landforms.find(f => f.id === 'crown')!;
  const sx = summit.summit![0]! * s, sz = summit.summit![1]! * s;
  const dx = x - sx, dz = z - sz, distance = Math.hypot(dx, dz);
  if (distance < 1e-8) return summit.summitH! * s;
  const ux = dx / distance, uz = dz / distance;
  let edgeDistance = Infinity;
  for (let i = 0; i < b.poly.length; i++) {
    const a = b.poly[i]!, c = b.poly[(i + 1) % b.poly.length]!, ex = c[0] - a[0], ez = c[1] - a[1];
    const ax = a[0] - sx, az = a[1] - sz, cross = ux * ez - uz * ex;
    if (Math.abs(cross) < 1e-10) continue;
    const t = (ax * ez - az * ex) / cross, u = (ax * uz - az * ux) / cross;
    if (t > 0 && u >= -1e-10 && u <= 1 + 1e-10) edgeDistance = Math.min(edgeDistance, t);
  }
  // A broad north shoulder and a long south ridge; one peak, no equal-height rings.
  const q = clamp(distance / Math.max(1, edgeDistance));
  const ridge = clamp(1 - 0.16 * dx / (260 * s) + 0.12 * dz / (260 * s), 0.75, 1.25);
  let height = mix(110 * s, summit.summitH! * s, Math.pow(1 - smooth(q), ridge));
  // The Throat is cut into a north-facing buttress, not into an exposed low edge.
  // Its surveyed 110 m floor plus 18 m aperture has real rock above it.
  const tx = Math.abs(x / s - 1300), north = smooth((z / s - 268) / 24), south = 1 - smooth((z / s - 345) / 65);
  const buttress = smooth(1 - Math.max(0, tx - 18) / 72) * north * south;
  height = mix(height, Math.max(height, (131 + 5 * clamp((z / s - 300) / 60)) * s), buttress);
  // The skylight opens at the manifest's northern shaft endpoint (1300,400),
  // not at the lake centre (1300,420). A small rock saddle meets its 138 m rim.
  const opening = M.underground.rooms.deep.skylight;
  const saddleDistance = Math.max(Math.abs(x / s - opening.to[0]!) - 8, Math.abs(z / s - opening.to[1]!) - 8);
  if (saddleDistance < 20) height = mix(height, opening.topH * s, 1 - smooth(saddleDistance / 20));
  return height;
}
function bandHeight(b: Band, x: number, z: number): number {
  if (b.id === 'crown') return crownHeight(b, x, z);
  const dx = (x - b.centre[0]) / (b.bounds[2]! - b.bounds[0]!), dz = (z - b.centre[1]) / (b.bounds[3]! - b.bounds[1]!);
  let fraction = 0.55 - 0.5 * dz + 0.12 * dx;
  if (b.id === 'hollow') fraction = 0.28 + 1.35 * dx * dx - 0.64 * dz + 0.12 * dz * dz;
  if (b.id === 'scholars') fraction = 0.52 + 0.46 * dx + 0.38 * dz;
  if (b.id === 'flats') fraction = 0.48 + 0.65 * dx + 0.09 * dz;
  if (b.id === 'prow') fraction = 0.52 - 0.6 * dx + 0.1 * dz;
  if (b.id === 'sands') fraction = 0.42 - 0.66 * dz + 0.08 * dx;
  if (b.id === 'harbour') fraction = 0.55 - 0.52 * dz - 0.22 * dx;
  if (b.id === 'stillwater') fraction = 0.76 - 0.08 * dz;
  return mix(b.min, b.max, clamp(fraction, 0.04, 0.96));
}
function outsideHeight(x: number, z: number, shore: number, s: number): number {
  // Authored offshore land is part of this same heightfield. The arch/Stacks are solids.
  const lamp: XY[] = [[502, 1220], [510, 1202], [533, 1190], [558, 1200], [580, 1225], [573, 1250], [543, 1268], [515, 1255]].map(p => [p[0]! * s, p[1]! * s]);
  const d = polygonDistance(lamp, x, z);
  if (d >= 0) return (0.2 + 7.8 * smooth(d / (18 * s))) * s;
  const sandbar: XY[] = [[585, 1010], [606, 990], [642, 985], [657, 996], [631, 1005], [601, 1018]].map(p => [p[0]! * s, p[1]! * s]);
  if (contains(sandbar, x, z)) return -0.22 * s;
  return -Math.max(0.1 * s, Math.min(12 * s, -shore * 0.18));
}
/** landformRule band-edge blend (m) and the scarp over which a band gap is crossed (m). */
export const BAND_BLEND = 60, BAND_STEP = 15;
/** landformRule: the terraces cut into the Shoulder, and the Crown standing on it: each
 * holds its band to its own edge, and the transition is the Shoulder's (the Cup is water). */
const SHOULDER_RINGED = new Set(['hollow', 'stillwater', 'crown']);
/** Authored land and named hydrology, before Track B's beds, aprons and openings. */
export function baseHeight(x: number, z: number): number {
  const m = getModel(), s = m.scale, shore = signedShoreDistance(x, z);
  if (shore < 0) return outsideHeight(x, z, shore, s);
  let height = (9 + 28 * clamp((1150 - z / s) / 1000) + 10 * clamp((x / s - 1050) / 650)) * s;
  // landformRule: where polygons overlap or meet, the higher band wins and its 60 m
  // blend lies INSIDE the winner, so the lower landform keeps its band to the edge.
  // Q is the proximity to lower-priority landforms (1 inside one, fading over 60 m);
  // against open ground (Q = 0) the blend stays outward as before. Where two bands
  // do not meet (a terrace cut into the Shoulder) the gap is one short scarp.
  const blend = BAND_BLEND * s, step = BAND_STEP * s, distances: number[] = [];
  for (const b of m.bands) {
    const far = x < b.bounds[0]! - blend || z < b.bounds[1]! - blend || x > b.bounds[2]! + blend || z > b.bounds[3]! + blend;
    const distance = far ? -Infinity : polygonDistance(b.poly, x, z);
    let proximity = 0;
    for (const lower of distances) if (lower > -blend) proximity = Math.max(proximity, lower >= 0 ? 1 : 1 - smooth(-lower / blend));
    distances.push(distance);
    if (distance <= -blend) continue;
    // A terrace cut INTO the Shoulder (landformRule) holds its band to its own edge and the
    // scarp is the Shoulder's wall; elsewhere the winner's own edge carries the scarp.
    const d = distance + (SHOULDER_RINGED.has(b.id) ? step * proximity : 0);
    const weight = d < 0 ? smooth(1 + d / blend) * (1 - proximity) : 1 - (1 - smooth(d / blend)) * proximity;
    height = mix(height, bandHeight(b, x, z), weight);
    if (d > 0) height = mix(height, clamp(height, b.min, b.max), smooth(d / step));
  }
  const character = coastCharacter(x, z), shoreWidth = character === 'southBeach' ? 44 * s : character === 'bight' ? 23 * s : 10 * s;
  height = mix(0.14 * s, height, smooth(shore / shoreWidth));
  height = damWindow(x, z, notchHeight(x, z, height));
  return applyWaters(x, z, height, m.water);
}
/** The High Span's surveyed station on the lower river (water 9.2, bed 8). */
const HIGH_SPAN_STATION: XY = [1236.875, 1105];
function notchHeight(x: number, z: number, height: number): number {
  const m = getModel(), s = m.scale, river = m.water.find(w => w.id === 'water.river.lower')!;
  const q = linePoint(river.points, x, z);
  // The gorge opens progressively to the Reach; it is never a uniform trench.
  if (q.z > 1170 * s || q.z < 906 * s) return height;
  // Under the High Span the floor is a shelf at the water, ≥ 40 m across between the
  // walls (the flight gate's aperture): 28 m on the east (Green-rim) side, 16 m west.
  const span = 1 - smooth((Math.hypot(q.x - HIGH_SPAN_STATION[0] * s, q.z - HIGH_SPAN_STATION[1] * s) - 40 * s) / (40 * s));
  const east = q.tangent[0] * (z - q.z) - q.tangent[1] * (x - q.x) < 0;
  const floor = mix(river.width / 2, (east ? 28 : 16) * s, span), wall = (22 + 11 * q.progress) * s - river.width / 2;
  const half = floor + wall, run = NOTCH_RIM_RUN * s;
  if (q.distance >= half + run) return height;
  const rim = Math.max(height, q.height + (32 - 7 * q.progress) * s);
  // The gorge floor meets the river at its surface; applyWaters carves the wet bed.
  if (q.distance <= floor) return q.height;
  if (q.distance <= half) { const t = smooth((q.distance - floor) / Math.max(1, wall)); return mix(q.height, rim, t * t); }
  return mix(rim, height, smooth((q.distance - half) / run));
}
/** How far the Notch's rim shoulder runs back before meeting the surrounding ground (m). */
export const NOTCH_RIM_RUN = 20;
/** The square→dam window (page A, F): in front of the dam face nothing between the
 * square and the dam stands above 18 eu, and no bank shades the face at 09:00/15:00.
 * The dam's own abutments stay; the river's channel and banks are applied after this. */
export const DAM_WINDOW = { cap: 18, feather: 20, halfWidth: 30, forecourt: 70 } as const;
/** The dam's crest (m): the lake at 50 is held by a wall topped at 49.3–50. */
const DAM_CREST = 50;
function damWindow(x: number, z: number, height: number): number {
  const s = getModel().scale, dam = M.structures.dam.xy, view = M.views.find(v => v.id === 'A')!.xy;
  const dx = dam[0]! * s, dz = dam[1]! * s;
  // The abutments tie into the ground at crest height (the lake terrace), no higher.
  if (z > dz - 12 * s && z < dz + 16 * s && Math.abs(x - dx) < 90 * s) height = Math.min(height, mix(height, DAM_CREST * s, 1 - smooth((Math.abs(x - dx) - 60 * s) / (30 * s))));
  if (z < dz + 4 * s || height <= DAM_WINDOW.cap * s) return height;
  // A corridor as wide as the wall (±22 m) plus margin from the dam toward the square,
  // and the forecourt in front of the face.
  const ax = view[0]! * s - dx, az = view[1]! * s - dz, length = Math.hypot(ax, az), ux = ax / length, uz = az / length;
  const along = (x - dx) * ux + (z - dz) * uz, across = Math.abs(-(x - dx) * uz + (z - dz) * ux);
  const corridor = along < 0 || along > length - 40 * s ? Infinity : across - DAM_WINDOW.halfWidth * s;
  const outside = Math.min(corridor, Math.hypot(x - dx, z - dz) - DAM_WINDOW.forecourt * s);
  const weight = (1 - smooth(outside / (DAM_WINDOW.feather * s))) * smooth((z - dz - 4 * s) / (6 * s));
  return mix(height, DAM_WINDOW.cap * s, weight);
}
const waterBounds = new WeakMap<WaterCut, readonly [number, number, number, number]>();
/** Named water in its bed. The raster guard (one lattice diagonal outside the true
 * edge) holds the bank AT the water level, never below it: a triangle straddling the
 * edge stays under a level pool, and the bank meets the surface where it is drawn. */
function applyWaters(x: number, z: number, original: number, waters: WaterCut[], rasterMargin = 0): number {
  const s = getModel().scale;
  let h = original, wetBedCeiling = Infinity;
  for (const water of waters) {
    if (water.underground || water.kind === 'sea' || water.kind === 'lagoon') continue;
    const guard = water.kind === 'dry' ? 0 : rasterMargin;
    const bankWidth = water.points.length ? 4 * s : 8 * s, outer = (water.points.length ? 12 * s : 24 * s) + guard;
    let bounds = waterBounds.get(water);
    if (!bounds) {
      bounds = water.points.length ? [Math.min(...water.points.map(p => p[0])) - water.width / 2, Math.min(...water.points.map(p => p[2])) - water.width / 2, Math.max(...water.points.map(p => p[0])) + water.width / 2, Math.max(...water.points.map(p => p[2])) + water.width / 2] :
        [Math.min(...water.outline.map(p => p[0])), Math.min(...water.outline.map(p => p[1])), Math.max(...water.outline.map(p => p[0])), Math.max(...water.outline.map(p => p[1]))];
      waterBounds.set(water, bounds);
    }
    if (x < bounds[0] - outer || z < bounds[1] - outer || x > bounds[2] + outer || z > bounds[3] + outer) continue;
    const { distance, level, grade } = waterInfluence(water, x, z);
    if (distance > outer) continue;
    if (distance <= 0) {
      // A weir's short run keeps the vertices of its straddling triangles below it.
      const depth = water.depth * mix(0.22, 1, smooth(-distance / (water.points.length ? water.width / 2 : 14 * s))) + Math.min(grade * guard, 1.5 * s);
      h = Math.min(h, level - depth);
      wetBedCeiling = Math.min(wetBedCeiling, level - depth);
      continue;
    }
    // The dam holds Stillwater on its downstream side: no lake bank is raised there.
    if (water.id === 'water.stillwater' && damHolds(x, z)) continue;
    // The guard band IS the bank's foot: exactly at the water level (raised or cut to it).
    if (distance <= guard) { h = level; wetBedCeiling = Math.min(wetBedCeiling, level); continue; }
    const d = distance - guard;
    if (d < bankWidth) h = mix(guard > 0 ? level : Math.min(h, level), Math.max(h, level + water.bank), smooth(d / bankWidth));
    else h = Math.max(h, mix(level + water.bank, h, smooth((d - bankWidth) / (outer - bankWidth))));
  }
  return Math.min(h, wetBedCeiling);
}
/** South of the dam line the lake is held by the dam's solid, not by an earth bank. */
function damHolds(x: number, z: number): boolean {
  const s = getModel().scale, dam = M.structures.dam.xy;
  return z > dam[1]! * s && Math.abs(x - dam[0]! * s) < 90 * s;
}
const padFrames = new WeakMap<PadCut, { cos: number; sin: number; xReach: number; zReach: number }>();
function padDistance(p: PadCut, x: number, z: number): number {
  let frame = padFrames.get(p);
  if (!frame) {
    const r = p.rotationDegrees * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r), a = p.size[0] / 2 + p.margin, b = p.size[1] / 2 + p.margin;
    frame = { cos, sin, xReach: Math.abs(cos) * a + Math.abs(sin) * b + p.blend, zReach: Math.abs(sin) * a + Math.abs(cos) * b + p.blend }; padFrames.set(p, frame);
  }
  const dx = x - p.centre[0], dz = z - p.centre[2], beyond = Math.max(Math.abs(dx) - frame.xReach, Math.abs(dz) - frame.zReach);
  if (beyond > 0) return p.blend + beyond;
  const a = Math.abs(dx * frame.cos + dz * frame.sin) - p.size[0] / 2 - p.margin;
  const b = Math.abs(-dx * frame.sin + dz * frame.cos) - p.size[1] / 2 - p.margin;
  return Math.hypot(Math.max(0, a), Math.max(0, b)) + Math.min(0, Math.max(a, b));
}
interface PreparedSegment { bed: BedCut; a: XYZ; b: XYZ; arc: number; length: number; total: number }
interface PreparedBeds { bins: Map<string, PreparedSegment[]>; cell: number }
const preparedBedCache = new WeakMap<BedCut[], Map<number, PreparedBeds>>();
const cellKey = (x: number, z: number, cell: number): string => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
const cutsTerrain = (bed: BedCut) => bed.terrainCut && !['cave', 'rail', 'cable'].includes(bed.kind);
function prepareBeds(beds: BedCut[], rasterMargin = 0): PreparedBeds {
  const cache = preparedBedCache.get(beds), cached = cache?.get(rasterMargin); if (cached) return cached;
  const cell = 64 * getModel().scale, bins = new Map<string, PreparedSegment[]>();
  // Every potentially influencing segment is inserted; order remains bed order,
  // then segment order. Closed routes spanning the island no longer scan globally.
  for (const bed of beds) {
    if (!cutsTerrain(bed) || bed.points.length < 2) continue;
    const reach = bed.width / 2 + bed.shoulder + Math.max(bed.blend, 15 * getModel().scale, rasterMargin);
    const { lengths, total } = polylineArcs(bed.points); let arc = 0;
    for (let i = 0; i < bed.points.length - 1; i++) {
      const a = bed.points[i]!, b = bed.points[i + 1]!, length = lengths[i]!;
      const segment = { bed, a, b, length, arc, total }; arc += length;
      const minX = Math.floor((Math.min(a[0], b[0]) - reach) / cell), maxX = Math.floor((Math.max(a[0], b[0]) + reach) / cell);
      const minZ = Math.floor((Math.min(a[2], b[2]) - reach) / cell), maxZ = Math.floor((Math.max(a[2], b[2]) + reach) / cell);
      for (let j = minZ; j <= maxZ; j++) for (let k = minX; k <= maxX; k++) {
        const key = `${k},${j}`, bin = bins.get(key); if (bin) bin.push(segment); else bins.set(key, [segment]);
      }
    }
  }
  const prepared = { bins, cell }, next = cache ?? new Map<number, PreparedBeds>();
  next.set(rasterMargin, prepared); preparedBedCache.set(beds, next); return prepared;
}
/** Ground that no bed or pad may raise: the sea floor outside the surveyed
 * shoreline and the floor of every open basin (the Bight lagoon, the lakes). */
export function raiseForbidden(x: number, z: number): boolean {
  if (signedShoreDistance(x, z) < 0) return true;
  return getModel().water.some(w => !w.underground && !w.points.length && w.kind !== 'sea' && contains(w.outline, x, z));
}
/** Two beds whose decks overlap in plan within this height are one level (at grade). */
export const BED_LEVEL_TOLERANCE = .5;
/** Exact local segment lookup, exported for equivalence probes against brute force. */
export function createBedSampler(beds: BedCut[]): (x: number, z: number, original: number) => { height: number; surface: number | null } {
  const prepared = prepareBeds(beds), s = getModel().scale;
  return (x, z, original) => {
    let height = original, surface: number | null = null, active: BedCut | null = null;
    let distance = Infinity, target = 0, progress = 0, excluded = false;
    let footprintHeight = Infinity, footprintSurface: number | null = null;
    let deckHeight = -Infinity, deckSurface: number | null = null;
    const apply = () => {
      if (!active || excluded) return;
      const edge = active.width / 2 + active.shoulder, blend = Math.max(active.blend, 15 * s);
      const weight = 1 - smooth((distance - edge) / blend);
      if (weight <= 0) return;
      height = mix(height, target, weight);
      if (distance <= active.width / 2) {
        const material = active.surfaceSegments?.find(segment => progress >= segment.from && progress <= segment.to)?.surface ?? active.surface;
        surface = Math.max(0, TERRAIN_SURFACE_PALETTE.findIndex(p => p.id === material));
        // The highest deck over this point: a lower route's cut may never excavate under it.
        if (target > deckHeight) { deckHeight = target; deckSurface = surface; }
      }
      // A neighbouring route's soft bank cannot bury a visible bed. At an at-grade
      // crossing the lowest eligible bed needs clearance; solids own each deck.
      if (distance <= edge && target < footprintHeight) {
        footprintHeight = target; footprintSurface = surface;
      }
    };
    for (const segment of prepared.bins.get(cellKey(x, z, prepared.cell)) ?? []) {
      if (segment.bed !== active) {
        apply(); active = segment.bed; distance = Infinity;
        excluded = !!active.terrainExclusions?.some(e => Math.hypot(x - e.at[0], z - e.at[1]) < e.radius);
      }
      if (excluded) continue;
      const { a, b } = segment, q = segmentPoint(x, z, [a[0], a[2]], [b[0], b[2]]);
      if (q.distance < distance) { distance = q.distance; target = mix(a[1], b[1], q.t); progress = (segment.arc + segment.length * q.t) / (segment.total || 1); }
    }
    apply();
    let result = Number.isFinite(footprintHeight) ? footprintHeight : height, paint = footprintSurface ?? surface;
    if (deckHeight > result + BED_LEVEL_TOLERANCE) { result = deckHeight; paint = deckSurface; }
    // No bed raises the sea floor or a basin floor: offshore decks stand on piers.
    if (result > original && raiseForbidden(x, z)) result = original;
    // No route or deck builds ground above the Crown's summit (it stays the island's highest point).
    if (result > original) result = Math.min(result, Math.max(original, crownSummitHeight() - 1 * s));
    return { height: result, surface: paint };
  };
}
/** Five centimetres survives centimetre encoding without terrain sharing the road's top face. */
export const BED_TERRAIN_CLEARANCE = .05;

/** Each supporting grid vertex is below the extended plane of every nearby bed
 * segment. Linear interpolation then stays below that same rendered deck plane.
 * The diagonal margin covers every vertex of a triangle touching the footprint.
 * Open spans cap intruding ground without filling their channels; tunnel roofs stay intact. */
export function createBedClearanceSampler(beds: BedCut[], rasterMargin = 0): (x: number, z: number) => number {
  // A bridge exclusion prevents raising the channel to the road, but must not
  // preserve a bank poking through its deck. Cap ground under named open spans
  // without raising it or cutting any tunnel/cave roof.
  const isSpan=(b:BedCut)=>b.id.startsWith('structure.')&&b.structureIds.length>0;
  const clearanceBeds=beds.map(b=>isSpan(b)?{...b,terrainCut:true,terrainExclusions:[]}:b);
  const prepared = prepareBeds(clearanceBeds, rasterMargin), s = getModel().scale;
  const floor = LAND_FLOOR * s;
  return (x, z) => {
    let ceiling = Infinity, upperDeck = -Infinity;
    const candidates: { value: number; plane: number }[] = [];
    for (const {bed, a, b, length} of prepared.bins.get(cellKey(x, z, prepared.cell)) ?? []) {
      const exclusions=bed.terrainExclusions?.filter(e=>Math.hypot(x-e.at[0],z-e.at[1])<e.radius+rasterMargin)??[];
      if (length < 1e-8 || exclusions.some(e=>!e.openSpan)) continue;
      const hit = segmentPoint(x, z, [a[0], a[2]], [b[0], b[2]]);
      if (hit.distance > bed.width / 2 + bed.shoulder + rasterMargin) continue;
      const dx = b[0] - a[0], dz = b[2] - a[2], open = isSpan(bed)||exclusions.some(e=>e.openSpan);
      // The extended deck plane keeps a triangle straddling a grade break below both
      // segments, but only across one raster diagonal: never a pit metres past the end.
      const reach = rasterMargin / length, t = clamp(((x - a[0]) * dx + (z - a[2]) * dz) / (length * length), -reach, 1 + reach);
      const clearance = open ? .65 : BED_TERRAIN_CLEARANCE, plane = mix(a[1], b[1], hit.t);
      // Extrapolation may not dig below the land floor unless the deck itself is lower.
      const value = Math.max(mix(a[1], b[1], t) - clearance, Math.min(plane - clearance, floor));
      candidates.push({ value, plane });
      if (!open && hit.distance <= bed.width / 2) upperDeck = Math.max(upperDeck, plane);
    }
    // A lower route's cut never excavates under an upper deck it passes beneath.
    for (const c of candidates) if (c.plane >= upperDeck - BED_LEVEL_TOLERANCE) ceiling = Math.min(ceiling, c.value);
    return ceiling;
  };
}
/** Lowest open ground on land outside named water: sea level plus 0.1 eu. */
export const LAND_FLOOR = .1;

/** Largest earth fill a threshold or landing pad may make; a higher deck is a structure. */
export const PAD_FILL_MAX = 3;
const crownSummitHeight = (): number => M.landforms.find(f => f.id === 'crown')!.summitH! * getModel().scale;

function cutHeight(x: number, z: number, cuts: LandCuts, sampleBeds: ReturnType<typeof createBedSampler>, rasterMargin: number, bedCeiling: (x: number, z: number) => number): { height: number; surface: number | null } {
  let { height, surface } = sampleBeds(x, z, baseHeight(x, z));
  const ground = height, s = getModel().scale;
  for (const p of cuts.pads) {
    if (p.underground) continue;
    const distance = padDistance(p, x, z);
    if (distance > p.blend) continue;
    height = mix(height, p.centre[1], 1 - smooth(distance / Math.max(p.blend, 0.01)));
    if (distance <= 0) surface = p.kind === 'reserve' ? 13 : 14;
  }
  // A threshold or landing is a mark on the ground or a structure's deck, never
  // an earth mound: its fill is capped, and no pad raises the sea floor or tops the summit.
  if (height > ground) {
    const fillCap = cuts.pads.some(p => !p.underground && (p.kind === 'threshold' || p.kind === 'landing') && p.centre[1] > ground + PAD_FILL_MAX * s && padDistance(p, x, z) <= p.blend) ? PAD_FILL_MAX * s : Infinity;
    height = Math.min(height, ground + fillCap, Math.max(ground, crownSummitHeight() - 1 * s));
    if (raiseForbidden(x, z)) height = ground;
  }
  // Mouths are topology masks read by terrainIndices(), not pits through a heightfield.
  // A cave's floor and ceiling remain independent surfaces under this continuous roof.
  height = applyWaters(x, z, height, cuts.waters.length ? cuts.waters : getModel().water, rasterMargin);
  // Apply after pads and water too: no later blend may raise the terrain
  // through a ground-level road. This changes the visible mesh, not collision.
  height = Math.min(height, bedCeiling(x, z));
  return { height, surface };
}
/** Vertices of every grid triangle touching a water footprint are capped below
 * its graded surface. This prevents coarse LOD interpolation bridging over a brook.
 * The bank begins outside that conservative raster footprint; water width stays fixed. */
export function createTerrainCutSampler(cuts: LandCuts, step: number): (x: number, z: number) => { height: number; surface: number | null } {
  const beds = createBedSampler(cuts.beds), rasterMargin = step * Math.SQRT2;
  const bedCeiling = createBedClearanceSampler(cuts.beds, rasterMargin);
  return (x, z) => cutHeight(x, z, cuts, beds, rasterMargin, bedCeiling);
}
/** Reapply the same road clearance to each retained LOD lattice. Decimation
 * alone can reconnect high vertices across a narrow road even if full was safe. */
export function conserveBedFootprint(field: TerrainField, beds: BedCut[]): void {
  const ceiling = createBedClearanceSampler(beds, field.step * Math.SQRT2);
  for (let j = 0; j < field.rows; j++) for (let i = 0; i < field.columns; i++) {
    const n = j * field.columns + i;
    field.heights[n] = Math.min(field.heights[n]!, ceiling(i * field.step, j * field.step));
  }
  // Paint does not depend on slope (the renderer weights rock per triangle), so no repaint.
}
/** Conservative lower-LOD approximation of this same lattice. Only vertices that
 * support a named wet footprint or its bank transition may move downward; dry
 * districts, route data and the authored water plane/width remain the same. */
export function conserveWaterFootprint(field: TerrainField, waters: WaterCut[]): void {
  const margin = field.step * Math.SQRT2;
  for (let j = 0; j < field.rows; j++) for (let i = 0; i < field.columns; i++) {
    const n = j * field.columns + i, original = field.heights[n]!;
    field.heights[n] = Math.min(original, applyWaters(i * field.step, j * field.step, original, waters, margin));
  }
}
/** Offline-only solve. Importing this module allocates no heightfield. */
export function buildTerrain(cuts: LandCuts, options: { step?: number } = {}): TerrainField {
  const step = options.step ?? 2.5 * requireScaleFactor(), width = M.extent.w * requireScaleFactor(), depth = M.extent.h * requireScaleFactor();
  if (!(step > 0) || width % step !== 0 || depth % step !== 0) throw new Error('Terrain step must divide the scaled extent');
  const columns = width / step + 1, rows = depth / step + 1;
  const field: TerrainField = { revision: GEOGRAPHY_REVISION, width, depth, step, columns, rows, heights: new Float32Array(columns * rows), surfaces: new Uint8Array(columns * rows) };
  const sample = createTerrainCutSampler(cuts, step), painted = new Int16Array(columns * rows).fill(-1);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const p = sample(i * step, j * step), n = j * columns + i;
    field.heights[n] = p.height; painted[n] = p.surface ?? -1;
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const n = j * columns + i, x = i * step, z = j * step;
    field.surfaces[n] = packTerrainPaint(painted[n]! >= 0 ? painted[n]! : biomeGround(x, z, field.heights[n]!), rockSetAt(x, z));
  }
  return field;
}
/** Landform-polygon biomes (no x/z/h rulers): beach sand by the shore, the Flats' ochre
 * dust, needles in Scholars' Edge and the Hollow, scree on the Crown, turf elsewhere. */
export function biomeGround(x: number, z: number, height: number): number {
  const m = getModel(), s = m.scale, shore = signedShoreDistance(x, z), inside = (id: string) => { const b = m.bands.find(f => f.id === id); return !!b && contains(b.poly, x, z); };
  const beach = coastCharacter(x, z) === 'southBeach' ? 30 * s : coastCharacter(x, z) === 'bight' ? 12 * s : 4 * s;
  if (height < 1 * s || shore < beach || inside('sands')) return PAINT.sand;
  if (inside('crown') && height >= 120 * s) return PAINT.scree;
  if (inside('flats')) return PAINT.ochre;
  if (inside('scholars') || inside('hollow')) return PAINT.duff;
  return PAINT.bankedTurf;
}
/** The strata set a face shows: the Notch walls, the Flats/Wash ochre, the Prow and east
 * sea cliffs, and the Crown's grey everywhere else (STYLE §3.3). */
export function rockSetAt(x: number, z: number): number {
  const m = getModel(), s = m.scale;
  const notch = linePoint(m.water.find(w => w.id === 'water.river.lower')!.points, x, z);
  if (notch.distance < 48 * s && z < 1190 * s && z > 905 * s) return 1;
  const near = (id: string, reach: number) => { const b = m.bands.find(f => f.id === id); return !!b && polygonDistance(b.poly, x, z) > -reach * s; };
  const wash = m.water.find(w => w.id === 'water.wash');
  if (near('flats', 40) || (wash && waterInfluence(wash, x, z).distance < 30 * s)) return 2;
  if (near('prow', 40) || (coastCharacter(x, z) === 'eastCliff' && signedShoreDistance(x, z) < 80 * s)) return 3;
  return 0;
}
const PAINT = Object.fromEntries(TERRAIN_SURFACE_PALETTE.map((p, i) => [p.id, i])) as Record<(typeof TERRAIN_SURFACE_PALETTE)[number]['id'], number>;
/** The dominant palette id at a vertex: its strata set's rock (base or ledge by height)
 * where the slope is over the walkable limit, else its ground. For probes and tests;
 * the renderer blends rock by per-triangle weight and draws ledges per pixel. */
export function terrainSurface(x: number, z: number, height: number, slope: number): number {
  if (!isWalkableSlope(slope)) {
    const set = ROCK_SETS[rockSetAt(x, z)]!, ledge = ((height / set.spacing) % 1 + 1) % 1 < 0.34;
    return PAINT[ledge ? set.ledge : set.base];
  }
  return biomeGround(x, z, height);
}
export function sampleTerrain(field: TerrainField, x: number, z: number): number {
  const gx = clamp(x / field.step, 0, field.columns - 1), gz = clamp(z / field.step, 0, field.rows - 1);
  const i = Math.min(field.columns - 2, Math.floor(gx)), j = Math.min(field.rows - 2, Math.floor(gz));
  const tx = gx - i, tz = gz - j, n = j * field.columns + i;
  const nw = field.heights[n]!, ne = field.heights[n + 1]!, sw = field.heights[n + field.columns]!, se = field.heights[n + field.columns + 1]!;
  return tx + tz <= 1 ? nw + tx * (ne - nw) + tz * (sw - nw) : se + (1 - tx) * (sw - se) + (1 - tz) * (ne - se);
}
export function terrainNormal(field: TerrainField, x: number, z: number): XYZ {
  const gx = clamp(x / field.step, 0, field.columns - 1), gz = clamp(z / field.step, 0, field.rows - 1);
  const i = Math.min(field.columns - 2, Math.floor(gx)), j = Math.min(field.rows - 2, Math.floor(gz)), n = j * field.columns + i;
  const nw = field.heights[n]!, ne = field.heights[n + 1]!, sw = field.heights[n + field.columns]!, se = field.heights[n + field.columns + 1]!;
  const first = gx - i + gz - j <= 1;
  const dx = (first ? ne - nw : se - sw) / field.step, dz = (first ? sw - nw : se - ne) / field.step;
  const length = Math.hypot(dx, 1, dz);
  return [-dx / length, 1 / length, -dz / length];
}
/** Named portals/skylights are the only holes. Render and collision share this mask. */
export function terrainTriangleVisible(x: number, z: number, cuts: Pick<LandCuts, 'mouths'>): boolean {
  return !cuts.mouths.some(m => contains(m.outline, x, z));
}
/** Probe exclusions are explicit precedence rules, never silently counted as passing. */
export function bandProbeEligibility(id: string, x: number, z: number, cuts?: LandCuts): string | null {
  const m = getModel(), b = m.bands.find(f => f.id === id);
  if (!b || !contains(b.poly, x, z)) return 'outside-polygon';
  if (signedShoreDistance(x, z) <= 12 * m.scale) return 'shore-clipping-and-stroke';
  // Owner rule: only ground inside a higher band's polygon belongs to it; the blend ring is counted.
  for (const higher of m.bands) if (higher.priority > b.priority && contains(higher.poly, x, z)) return 'higher-band';
  for (const w of m.water) if (!w.underground && !['sea', 'lagoon'].includes(w.kind) && waterInfluence(w, x, z).distance < 24 * m.scale) return 'named-water-and-banks';
  const notch = linePoint(m.water.find(w => w.id === 'water.river.lower')!.points, x, z);
  if (notch.distance < 50 * m.scale && z > 905 * m.scale && z < 1170 * m.scale) return 'notch-walls';
  if (cuts) {
    for (const p of cuts.pads) if (!p.underground && padDistance(p, x, z) < p.blend) return 'graded-pad';
    const prepared = prepareBeds(cuts.beds);
    for (const segment of prepared.bins.get(cellKey(x, z, prepared.cell)) ?? []) {
      const b = segment.bed;
      if (b.terrainExclusions?.some(e => Math.hypot(x - e.at[0], z - e.at[1]) < e.radius)) continue;
      if (segmentPoint(x, z, [segment.a[0], segment.a[2]], [segment.b[0], segment.b[2]]).distance < b.width / 2 + b.shoulder + Math.max(15 * m.scale, b.blend)) return 'bed-and-15m-blend';
    }
    if (!terrainTriangleVisible(x, z, cuts)) return 'named-mouth';
  }
  return null;
}
