import { HORIZON_MANIFEST, requireScaleFactor } from '../../world/manifest';
import type { XY } from '../interfaces';
import { contains, polygonDistance } from '../terrain/geometry';

let cached: XY[] | undefined;
/** The closed manifest Catmull–Rom outline, 300 vertices at the selected scale.
 * The lazy cache stores only the shoreline, never a solved terrain or a district. */
export function buildCoastline(samplesPerSpan = 12): XY[] {
  const scale = requireScaleFactor(), points = HORIZON_MANIFEST.island.outline;
  const at = (i: number): number[] => points[(i + points.length) % points.length]!;
  const result: XY[] = [];
  for (let i = 0; i < points.length; i++) for (let j = 0; j < samplesPerSpan; j++) {
    const t = j / samplesPerSpan, t2 = t * t, t3 = t2 * t;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const axis = (n: number) => 0.5 * ((2 * p1[n]!) + (-p0[n]! + p2[n]!) * t +
      (2 * p0[n]! - 5 * p1[n]! + 4 * p2[n]! - p3[n]!) * t2 + (-p0[n]! + 3 * p1[n]! - 3 * p2[n]! + p3[n]!) * t3) * scale;
    result.push([axis(0), axis(1)]);
  }
  return result;
}
const outline = (): XY[] => cached ??= buildCoastline();
export const islandContains = (x: number, z: number): boolean => contains(outline(), x, z);
/** Positive inside the island. Zero is the surveyed shoreline. */
export const signedShoreDistance = (x: number, z: number): number => polygonDistance(outline(), x, z);
export type CoastCharacter = 'eastCliff' | 'southBeach' | 'westPlateau' | 'northCliff' | 'bight';
export function coastCharacter(x: number, z: number): CoastCharacter {
  const s = requireScaleFactor(); x /= s; z /= s;
  if (z > 1320) return 'southBeach';
  if (x > 1520) return 'eastCliff';
  if (z < 350) return 'northCliff';
  if (x < 470) return 'westPlateau';
  return 'bight';
}
export function coastBands(x: number, z: number): { shore: boolean; shallows: boolean; character: CoastCharacter } {
  const distance = signedShoreDistance(x, z), s = requireScaleFactor();
  return { shore: distance >= 0 && distance < 12 * s, shallows: distance <= 0 && distance > -50 * s, character: coastCharacter(x, z) };
}
