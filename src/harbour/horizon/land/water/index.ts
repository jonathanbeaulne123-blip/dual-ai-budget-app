import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { WaterCut, XY, XYZ } from '../interfaces';
import { ellipse, lineOutline, linePoint, polygonDistance, segmentPoint } from '../terrain/geometry';
import { islandContains } from '../coast';

/** Authored hydrology. Heights are independent of route grading and household state.
 * The lake's fixed 50 m level and the Cup's 100 m level therefore cannot drift. */
export function buildWaterCuts(): WaterCut[] {
  const s = requireScaleFactor();
  const channel = (id: string, kind: WaterCut['kind'], xy: readonly number[][], heights: number[], width: number, depth: number, bank = 1): WaterCut => {
    const points: XYZ[] = xy.map((p, i) => [p[0]! * s, heights[i]! * s, p[1]! * s]);
    return { id, kind, points, outline: lineOutline(points, width * s), level: heights[0]! * s, width: width * s, depth: depth * s, bank: bank * s };
  };
  const basin = (id: string, cx: number, cz: number, rx: number, rz: number, level: number, depth: number, kind: WaterCut['kind'] = 'lake'): WaterCut => ({
    id, kind, outline: ellipse(cx * s, cz * s, rx * s, rz * s), points: [], level: level * s, width: rx * 2 * s, depth: depth * s, bank: 1.2 * s,
  });
  const w = M.water;
  // The lower line includes a surveyed High Span station: water 9.2, bed 8.
  const lower = [...w.river.lower.slice(0, 3), [1236.875, 1105], ...w.river.lower.slice(3)];
  const bodies: WaterCut[] = [
    { id: 'water.sea', kind: 'sea', outline: [[0, 0], [M.extent.w * s, 0], [M.extent.w * s, M.extent.h * s], [0, M.extent.h * s]], points: [], level: 0, width: 0, depth: 12 * s, bank: 0 },
    // The lagoon lies in the island's open hook; its boundary is not a land carve.
    basin('water.bight', 620, 910, 98, 155, 0, 5, 'lagoon'),
    basin('water.stillwater', w.stillwater.cx, w.stillwater.cy, w.stillwater.rx, w.stillwater.ry, w.stillwater.surface, 5),
    basin('water.cup', w.cup.cx, w.cup.cy, w.cup.rx, w.cup.ry, w.cup.surface, 3),
    channel('water.river.upper', 'river', w.river.upper, [100, 75, 50], 7, 1, 1.1),
    channel('water.river.lower', 'river', lower, [22, 15, 10.8, 9.2, 6.5, 3.8, 1.8, 0.9, 0], 12, 1.2, 1),
    channel('water.brook', 'brook', w.brook.pts, [39, 32, 18, 7, 0], 5, 0.8, 0.7),
    channel('water.wash', 'dry', w.wash.pts, [35, 31, 25, 0], 11, 0.65, 0.7),
    ...w.reachChannels.map((p, i) => channel(`water.reach.${i + 1}`, 'river', p, [3.8, 2.5, 1], 7, 0.9, 0.65)),
    { ...basin('water.deep', w.deep.cx, w.deep.cy, 43, 28, w.deep.surface, 7, 'deep'), underground: true },
  ];
  return bodies;
}

/** Signed distance from a water edge: negative is wet, positive is outside. */
export function waterInfluence(water: WaterCut, x: number, z: number): { distance: number; level: number; progress: number } {
  if (water.points.length > 1) {
    const q = linePoint(water.points, x, z);
    return { distance: q.distance - water.width / 2, level: q.height, progress: q.progress };
  }
  return { distance: -polygonDistance(water.outline, x, z), level: water.level, progress: 0 };
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
