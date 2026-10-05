import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { StructureSolid, WaterCut, XY, XYZ } from '../interfaces';
import { ellipse, lineOutline, polygonDistance, polylineArcs, segmentPoint } from '../terrain/geometry';
import { islandContains } from '../coast';
import { buildMountainV3Waters } from '../mountainV3/water';

/** Authored hydrology. Heights are independent of route grading and household state.
 * The lake's fixed 50 m level therefore cannot drift. */
export function buildWaterCuts(): WaterCut[] {
  const s = requireScaleFactor();
  const channel = (id: string, kind: WaterCut['kind'], xy: readonly number[][], heights: number[], width: number, depth: number, bank = 1): WaterCut => {
    const controls: XYZ[] = xy.map((p, i) => [p[0]! * s, heights[i]! * s, p[1]! * s]);
    // Running water is a stair of level pools and short weirs/falls (a dry wash keeps its
    // graded bed): a level pool's banks meet its surface exactly on the 5 m lattice.
    const points = kind === 'dry' ? controls : poolSteps(controls, s);
    return { id, kind, points, outline: lineOutline(points, width * s), level: heights[0]! * s, width: width * s, depth: depth * s, bank: bank * s };
  };
  const basin = (id: string, cx: number, cz: number, rx: number, rz: number, level: number, depth: number, kind: WaterCut['kind'] = 'lake'): WaterCut => ({
    id, kind, outline: ellipse(cx * s, cz * s, rx * s, rz * s), points: [], level: level * s, width: rx * 2 * s, depth: depth * s, bank: 1.2 * s,
  });
  const w = M.water;
  // The lower line includes a surveyed High Span station: water 9.2, bed 8.
  // v2.6 (D-M3): Stillwater drains over a natural rock sill (water.river.sill): the lower river begins in the lake at the
  // sill's lip (the lake level) and falls to its old head at 22 over one weir; no dam holds the lake.
  const sill = (w.river as { sill?: { xy: number[]; level: number } }).sill;
  const lower = [...(sill ? [sill.xy] : []), ...w.river.lower.slice(0, 3), [1236.875, 1105], ...w.river.lower.slice(3)];
  const lowerLevels = [...(sill ? [sill.level] : []), 22, 15, 10.8, 9.2, 6.5, 3.8, 1.8, 0.9, 0];
  // v2.6 (D-M3): Mountain v2's river leaves its gorge onto the Foot terrace and runs v2's town channel (the region draws both);
  // from v2's channel end [1317,833] the Horizon carries it west into Stillwater as a brook (it replaces the Cup and the upper
  // river as the lake's inflow).
  const mountain = (w.river as { mountain?: { pts: number[][]; levels: number[]; width_m: number; depth_m: number; kind?: WaterCut['kind'] } }).mountain;
  const bodies: WaterCut[] = [
    { id: 'water.sea', kind: 'sea', outline: [[0, 0], [M.extent.w * s, 0], [M.extent.w * s, M.extent.h * s], [0, M.extent.h * s]], points: [], level: 0, width: 0, depth: 12 * s, bank: 0 },
    // The lagoon lies in the island's open hook; its boundary is not a land carve.
    basin('water.bight', 620, 910, 98, 155, 0, 5, 'lagoon'),
    basin('water.stillwater', w.stillwater.cx, w.stillwater.cy, w.stillwater.rx, w.stillwater.ry, w.stillwater.surface, 5),
    // v2.6: the Cup (water.cup) and the upper river (water.river.upper) are retired (MANIFEST retired_v2_6): Mountain v2's
    // reservoir and gorge river stand there.
    ...(mountain ? [channel('water.river.mountain', mountain.kind ?? 'river', mountain.pts, mountain.levels, mountain.width_m, mountain.depth_m, 0.7)] : []),
    channel('water.river.lower', 'river', lower, lowerLevels, 12, 1.2, 1),
    channel('water.brook', 'brook', w.brook.pts, [39, 32, 18, 7, 0], 5, 0.8, 0.7),
    channel('water.wash', 'dry', w.wash.pts, [35, 31, 25, 0], 11, 0.65, 0.7),
    ...w.reachChannels.map((p, i) => channel(`water.reach.${i + 1}`, 'river', p, [3.8, 2.5, 1], 7, 0.9, 0.65)),
    { ...basin('water.deep', w.deep.cx, w.deep.cy, 43, 28, w.deep.surface, 7, 'deep'), underground: true },
    // R2-60: the spring at the Reach (water.spring) is a water body with a visible source: a pool at the foot of the
    // west bank (SPRING below; the source rock is `buildSpringSolids`).
    { ...basin('water.spring', SPRING.pool.c[0], SPRING.pool.c[1], SPRING.pool.r[0], SPRING.pool.r[1], SPRING.pool.level, 0.6, 'lake'), bank: SPRING.pool.bank * s },
    // Mountain V3 (D-M11): the glacier-fed network on the ring round Mountain v2 (land/mountainV3/water.ts).
    ...buildMountainV3Waters(s),
  ];
  return bodies;
}

/**
 * The spring at the Reach (MANIFEST `water.spring` [1250,1180], "a decorative spring at the Reach; not the Deep's
 * outflow"; R2-60). Its pool lies at the foot of the west bank, level 5.6 (ground 5.6–7 round it on candidate 3);
 * it seeps to the river (no rill: walk reach and the Reach Footbridge's west end run between the pool and the
 * river at x 1256–1263, and a surface rill would add an unregistered crossing under them).
 * The source is a banded rock the water issues from, set into the bank on the pool's north-west side, standing
 * 3.2 over the ground so page I's boardwalk eye (5.4, 52 eu away) holds it over the bank at [1250,1190] (6.6).
 */
export const SPRING = {
  pool: { c: [1250, 1184] as const, r: [4.5, 3] as const, level: 5.6, bank: 0.3 },
  source: { c: [1245.4, 1180.2] as const, radius: 2.6, rise: 3.2, sink: 1.5 },
} as const;
/** The spring's source rock: a banded, tapering octagonal outcrop (the offshore stack form, land scale), its foot sunk
 * `sink` below the lowest ground under it so no edge hangs, its top `rise` over the highest. */
export function buildSpringSolids(ground: (x: number, z: number) => number): StructureSolid[] {
  const s = requireScaleFactor(), src = SPRING.source, cx = src.c[0] * s, cz = src.c[1] * s, r = src.radius * s;
  const profile: XY[] = [[-0.91, -0.3], [-0.62, -0.83], [0.12, -1], [0.83, -0.52], [1, 0.18], [0.61, 0.78], [-0.24, 1], [-0.84, 0.48]];
  const under = profile.map(p => ground(cx + r * p[0], cz + r * p[1])), low = Math.min(...under, ground(cx, cz)), high = Math.max(...under, ground(cx, cz));
  const foot = low - src.sink * s, top = high + src.rise * s, positions: number[] = [], indices: number[] = [];
  const tiers = [{ y: foot, size: 1.05, x: 0, z: 0 }, { y: high, size: 1, x: -0.04, z: 0.03 }, { y: mix(high, top, 0.55), size: 0.82, x: 0.06, z: -0.04 }, { y: top, size: 0.5, x: 0.1, z: -0.08 }];
  for (const t of tiers) for (const p of profile) positions.push(cx + r * (p[0] * t.size + t.x), t.y, cz + r * (p[1] * t.size + t.z));
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, c, b, a, d, c);
  for (let k = 0; k < tiers.length - 1; k++) for (let i = 0; i < profile.length; i++) quad(k * 8 + i, k * 8 + (i + 1) % 8, (k + 1) * 8 + (i + 1) % 8, (k + 1) * 8 + i);
  for (let i = 1; i < 7; i++) { indices.push(0, i, i + 1); indices.push(24, 24 + i + 1, 24 + i); }
  return [{ id: 'water.spring.source', kind: 'springSource', positions, indices, surface: 'rock.spring', districtId: 'reach', bedIds: [], walkable: false, role: 'rock' }];
}
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Largest drop of one weir or fall (m), the shortest pool (m) and a weir's run (m). */
export const WATER_STEP = { drop: 1, pool: 8, weir: 1.5 } as const;
/** Split each graded reach into level pools joined by short weirs; control points and
 * their surveyed levels are kept, so the chain stays monotonic and the ends unchanged. */
export function poolSteps(controls: readonly XYZ[], s = 1): XYZ[] {
  const out: XYZ[] = [controls[0]!];
  for (let i = 1; i < controls.length; i++) {
    const a = controls[i - 1]!, b = controls[i]!, length = Math.hypot(b[0] - a[0], b[2] - a[2]), drop = a[1] - b[1];
    const count = Math.max(1, Math.min(Math.ceil(drop / (WATER_STEP.drop * s) - 1e-9), Math.floor(length / (WATER_STEP.pool * s))));
    if (count <= 1 && drop <= WATER_STEP.drop * s) { out.push(b); continue; }
    const at = (d: number, h: number): XYZ => [a[0] + (b[0] - a[0]) * d / length, h, a[2] + (b[2] - a[2]) * d / length];
    const pool = length / count, weir = Math.min(WATER_STEP.weir * s, pool / 3);
    for (let k = 0; k < count; k++) {
      const level = a[1] - drop * k / count, next = a[1] - drop * (k + 1) / count;
      out.push(at(pool * (k + 1) - weir, level));
      out.push(k === count - 1 ? b : at(pool * (k + 1), next));
    }
  }
  return out;
}
/** Signed distance from a water edge: negative is wet, positive is outside. A channel's
 * wet region is exactly its rendered ribbon: round joins at bends, square ends. */
export function waterInfluence(water: WaterCut, x: number, z: number): { distance: number; level: number; progress: number; grade: number } {
  const p = water.points;
  if (p.length > 1) {
    const { lengths, total } = polylineArcs(p);
    let best = Infinity, level = 0, progress = 0, grade = 0, travelled = 0, segment = 0;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1]!, b = p[i]!, length = lengths[i - 1]!, hit = segmentPoint(x, z, [a[0], a[2]], [b[0], b[2]]);
      if (hit.distance < best - 1e-9) { best = hit.distance; level = a[1] + (b[1] - a[1]) * hit.t; progress = (travelled + hit.t * length) / (total || 1); grade = Math.abs(a[1] - b[1]) / (length || 1); segment = i; }
      travelled += length;
    }
    let distance = best - water.width / 2;
    // Beyond either end the ribbon stops square; the round cap is dry ground.
    const ends = [[p[0]!, p[1]!, 1], [p[p.length - 1]!, p[p.length - 2]!, p.length - 1]] as const;
    for (const [end, next, index] of ends) {
      if (segment !== index) continue;
      const dx = end[0] - next[0], dz = end[2] - next[2], l = Math.hypot(dx, dz) || 1, over = ((x - end[0]) * dx + (z - end[2]) * dz) / l;
      if (over > 0) distance = Math.max(distance, over);
    }
    return { distance, level, progress, grade };
  }
  return { distance: -polygonDistance(water.outline, x, z), level: water.level, progress: 0, grade: 0 };
}
export function waterHeightAt(water: WaterCut, x: number, z: number): number | null {
  if ((water.kind === 'sea' || water.kind === 'lagoon') && islandContains(x, z)) return null;
  const p = waterInfluence(water, x, z);
  return p.distance <= 0 ? p.level : null;
}
/** Distance between the actual shoreline intersections along the authored Bight crossing. */
export function bightMouthWidth(containsLand: (x: number, z: number) => boolean): number {
  const s = requireScaleFactor(), centre = M.structures.bightBridge.xy;
  const road = M.roads.V01.pts;
  let nearest = Infinity, segment = 0;
  for (let i = 1; i < road.length; i++) {
    const a: XY = [road[i - 1]![0]!, road[i - 1]![1]!], b: XY = [road[i]![0]!, road[i]![1]!];
    const distance = segmentPoint(centre[0]!, centre[1]!, a, b).distance;
    if (distance < nearest) { nearest = distance; segment = i - 1; }
  }
  const a: XY = [road[segment]![0]! * s, road[segment]![1]! * s], b: XY = [road[segment + 1]![0]! * s, road[segment + 1]![1]! * s];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let wet = 0;
  for (let i = 0; i < 2000; i++) {
    const t = (i + 0.5) / 2000;
    if (!containsLand(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) wet += length / 2000;
  }
  return wet;
}
