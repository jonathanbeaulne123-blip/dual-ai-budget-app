import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { BedCut, LandCuts, PadCut, TerrainField, WaterCut, XY, XYZ } from '../interfaces';
import { coastCharacter, signedShoreDistance } from '../coast';
import { buildWaterCuts, waterInfluence } from '../water';
import { clamp, contains, linePoint, mix, polygonCentre, polygonDistance, smooth } from './geometry';

export const GEOGRAPHY_REVISION = 'horizon-geo-1' as const;
/** Mountain v2 body/bodyModel.ts WALKABLE_DEG. Kept pure so baking imports no body scene. */
export const WALKABLE_DEGREES = 40;
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
] as const;

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
  let lo = 0, hi = 1600 * s;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (contains(b.poly, sx + dx / distance * mid, sz + dz / distance * mid)) lo = mid; else hi = mid;
  }
  // A broad north shoulder and a long south ridge; one peak, no equal-height rings.
  const q = clamp(distance / Math.max(1, lo));
  const ridge = clamp(1 - 0.16 * dx / (260 * s) + 0.12 * dz / (260 * s), 0.75, 1.25);
  return mix(110 * s, summit.summitH! * s, Math.pow(1 - smooth(q), ridge));
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
/** Authored land and named hydrology, before Track B's beds, aprons and openings. */
export function baseHeight(x: number, z: number): number {
  const m = getModel(), s = m.scale, shore = signedShoreDistance(x, z);
  if (shore < 0) return outsideHeight(x, z, shore, s);
  let height = (9 + 28 * clamp((1150 - z / s) / 1000) + 10 * clamp((x / s - 1050) / 650)) * s;
  for (const b of m.bands) {
    if (x < b.bounds[0]! - 60 * s || z < b.bounds[1]! - 60 * s || x > b.bounds[2]! + 60 * s || z > b.bounds[3]! + 60 * s) continue;
    const distance = polygonDistance(b.poly, x, z);
    if (distance <= -60 * s) continue;
    height = mix(height, bandHeight(b, x, z), smooth(1 + distance / (60 * s)));
  }
  const character = coastCharacter(x, z), shoreWidth = character === 'southBeach' ? 44 * s : character === 'bight' ? 23 * s : 10 * s;
  height = mix(0.14 * s, height, smooth(shore / shoreWidth));
  height = notchHeight(x, z, height);
  return applyWaters(x, z, height, m.water);
}
function notchHeight(x: number, z: number, height: number): number {
  const m = getModel(), s = m.scale, river = m.water.find(w => w.id === 'water.river.lower')!;
  const q = linePoint(river.points, x, z);
  // The gorge opens progressively to the Reach; it is never a uniform trench.
  if (q.z > 1170 * s || q.z < 906 * s) return height;
  const half = (22 + 11 * q.progress) * s;
  if (q.distance >= half + 12 * s) return height;
  const rim = Math.max(height, q.height + (32 - 7 * q.progress) * s);
  if (q.distance <= half) {
    const t = smooth((q.distance - river.width / 2) / Math.max(1, half - river.width / 2));
    return mix(q.height - river.depth, rim, t * t);
  }
  return mix(rim, height, smooth((q.distance - half) / (12 * s)));
}
function applyWaters(x: number, z: number, original: number, waters: WaterCut[]): number {
  const s = getModel().scale;
  let h = original, wetBedCeiling = Infinity;
  for (const water of waters) {
    if (water.underground || water.kind === 'sea' || water.kind === 'lagoon') continue;
    const { distance: d, level } = waterInfluence(water, x, z);
    const bankWidth = water.points.length ? 4 * s : 8 * s, outer = water.points.length ? 12 * s : 24 * s;
    if (d > outer) continue;
    if (d <= 0) {
      const depth = water.depth * mix(0.22, 1, smooth(-d / (water.points.length ? water.width / 2 : 14 * s)));
      h = Math.min(h, level - depth);
      wetBedCeiling = Math.min(wetBedCeiling, level - depth);
    } else if (d < bankWidth) {
      const edge = level - water.depth * 0.22, bank = Math.max(h, level + water.bank);
      h = mix(edge, bank, smooth(d / bankWidth));
    } else {
      h = Math.max(h, mix(level + water.bank, h, smooth((d - bankWidth) / (outer - bankWidth))));
    }
  }
  return Math.min(h, wetBedCeiling);
}
function padDistance(p: PadCut, x: number, z: number): number {
  const r = p.rotationDegrees * Math.PI / 180, dx = x - p.centre[0], dz = z - p.centre[2];
  const a = Math.abs(dx * Math.cos(r) + dz * Math.sin(r)) - p.size[0] / 2 - p.margin;
  const b = Math.abs(-dx * Math.sin(r) + dz * Math.cos(r)) - p.size[1] / 2 - p.margin;
  return Math.hypot(Math.max(0, a), Math.max(0, b)) + Math.min(0, Math.max(a, b));
}
interface PreparedBed { bed: BedCut; minX: number; minZ: number; maxX: number; maxZ: number }
function prepareBeds(beds: BedCut[]): PreparedBed[] {
  return beds.filter(b => b.terrainCut && b.points.length > 1).map(b => {
    const reach = b.width / 2 + b.shoulder + Math.max(b.blend, 15 * getModel().scale);
    return { bed: b, minX: Math.min(...b.points.map(p => p[0])) - reach, minZ: Math.min(...b.points.map(p => p[2])) - reach, maxX: Math.max(...b.points.map(p => p[0])) + reach, maxZ: Math.max(...b.points.map(p => p[2])) + reach };
  });
}
function cutHeight(x: number, z: number, cuts: LandCuts, beds: PreparedBed[]): { height: number; surface: number | null } {
  let height = baseHeight(x, z), surface: number | null = null;
  for (const { bed: b, minX, minZ, maxX, maxZ } of beds) {
    if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
    if (b.terrainExclusions?.some(e => Math.hypot(x - e.at[0], z - e.at[1]) < e.radius)) continue;
    const q = linePoint(b.points, x, z), edge = b.width / 2 + b.shoulder;
    const blend = Math.max(b.blend, 15 * getModel().scale), weight = 1 - smooth((q.distance - edge) / blend);
    if (weight <= 0) continue;
    height = mix(height, q.height, weight);
    if (q.distance <= b.width / 2) surface = Math.max(0, TERRAIN_SURFACE_PALETTE.findIndex(p => p.id === b.surface));
  }
  for (const p of cuts.pads) {
    if (p.underground) continue;
    const distance = padDistance(p, x, z);
    if (distance > p.blend) continue;
    height = mix(height, p.centre[1], 1 - smooth(distance / Math.max(p.blend, 0.01)));
    if (distance <= 0) surface = p.kind === 'reserve' ? 13 : 14;
  }
  // Mouths are topology masks read by terrainIndices(), not pits through a heightfield.
  // A cave's floor and ceiling remain independent surfaces under this continuous roof.
  height = applyWaters(x, z, height, cuts.waters.length ? cuts.waters : getModel().water);
  return { height, surface };
}
/** Offline-only solve. Importing this module allocates no heightfield. */
export function buildTerrain(cuts: LandCuts, options: { step?: number } = {}): TerrainField {
  const step = options.step ?? 2.5 * requireScaleFactor(), width = M.extent.w * requireScaleFactor(), depth = M.extent.h * requireScaleFactor();
  if (!(step > 0) || width % step !== 0 || depth % step !== 0) throw new Error('Terrain step must divide the scaled extent');
  const columns = width / step + 1, rows = depth / step + 1;
  const field: TerrainField = { revision: GEOGRAPHY_REVISION, width, depth, step, columns, rows, heights: new Float32Array(columns * rows), surfaces: new Uint8Array(columns * rows) };
  const beds = prepareBeds(cuts.beds), painted = new Int16Array(columns * rows).fill(-1);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const p = cutHeight(i * step, j * step, cuts, beds), n = j * columns + i;
    field.heights[n] = p.height; painted[n] = p.surface ?? -1;
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const n = j * columns + i, x = i * step, z = j * step;
    const normal = terrainNormal(field, x, z), slope = Math.hypot(normal[0], normal[2]) / normal[1];
    field.surfaces[n] = isWalkableSlope(slope) && painted[n]! >= 0 ? painted[n]! : terrainSurface(x, z, field.heights[n]!, slope);
  }
  return field;
}
export function terrainSurface(x: number, z: number, height: number, slope: number): number {
  const s = getModel().scale;
  if (!isWalkableSlope(slope)) {
    const notch = linePoint(getModel().water.find(w => w.id === 'water.river.lower')!.points, x, z);
    const set = notch.distance < 48 * s && z < 1190 * s && z > 905 * s ? 6 : x < 580 * s ? 8 : x > 1540 * s ? 10 : 4;
    const spacing = set === 6 ? 2.2 : set === 8 ? 4 : 3.2;
    return set + (Math.floor(height / spacing) % 3 === 0 ? 1 : 0);
  }
  if (height < 1 * s || z > 1360 * s) return 0;
  if (height >= 110 * s) return 4;
  if (x < 580 * s) return 3;
  if (x < 1020 * s && z < 550 * s) return 2;
  return 1;
}
export function sampleTerrain(field: TerrainField, x: number, z: number): number {
  const gx = clamp(x / field.step, 0, field.columns - 1), gz = clamp(z / field.step, 0, field.rows - 1);
  const i = Math.min(field.columns - 2, Math.floor(gx)), j = Math.min(field.rows - 2, Math.floor(gz));
  const tx = gx - i, tz = gz - j, n = j * field.columns + i;
  const nw = field.heights[n]!, ne = field.heights[n + 1]!, sw = field.heights[n + field.columns]!, se = field.heights[n + field.columns + 1]!;
  return tx + tz <= 1 ? nw + tx * (ne - nw) + tz * (sw - nw) : se + (1 - tx) * (sw - se) + (1 - tz) * (ne - se);
}
export function terrainNormal(field: TerrainField, x: number, z: number): XYZ {
  const d = field.step, dx = (sampleTerrain(field, x + d, z) - sampleTerrain(field, x - d, z)) / (2 * d);
  const dz = (sampleTerrain(field, x, z + d) - sampleTerrain(field, x, z - d)) / (2 * d), length = Math.hypot(dx, 1, dz);
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
  for (const higher of m.bands) if (higher.priority > b.priority && polygonDistance(higher.poly, x, z) > -60 * m.scale) return 'higher-band-or-60m-blend';
  for (const w of m.water) if (!w.underground && !['sea', 'lagoon'].includes(w.kind) && waterInfluence(w, x, z).distance < 24 * m.scale) return 'named-water-and-banks';
  const notch = linePoint(m.water.find(w => w.id === 'water.river.lower')!.points, x, z);
  if (notch.distance < 50 * m.scale && z > 905 * m.scale && z < 1170 * m.scale) return 'notch-walls';
  if (cuts) {
    for (const p of cuts.pads) if (!p.underground && padDistance(p, x, z) < p.blend) return 'graded-pad';
    for (const b of cuts.beds) if (b.terrainCut && linePoint(b.points, x, z).distance < b.width / 2 + b.shoulder + Math.max(15 * m.scale, b.blend)) return 'bed-and-15m-blend';
    if (!terrainTriangleVisible(x, z, cuts)) return 'named-mouth';
  }
  return null;
}
