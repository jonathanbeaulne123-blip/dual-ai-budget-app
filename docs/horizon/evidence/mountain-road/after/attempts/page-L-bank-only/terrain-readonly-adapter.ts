import {clamp,contains} from './geometry';
export const GEOGRAPHY_REVISION = "horizon-geo-1";
export function sampleTerrain(field: TerrainField, x: number, z: number): number {
  const gx = clamp(x / field.step, 0, field.columns - 1), gz = clamp(z / field.step, 0, field.rows - 1);
  const i = Math.min(field.columns - 2, Math.floor(gx)), j = Math.min(field.rows - 2, Math.floor(gz));
  const tx = gx - i, tz = gz - j, n = j * field.columns + i;
  const nw = field.heights[n]!, ne = field.heights[n + 1]!, sw = field.heights[n + field.columns]!, se = field.heights[n + field.columns + 1]!;
  return tx + tz <= 1 ? nw + tx * (ne - nw) + tz * (sw - nw) : se + (1 - tx) * (sw - se) + (1 - tz) * (ne - se);
}
export function terrainTriangleVisible(x: number, z: number, cuts: Pick<LandCuts, 'mouths'>): boolean {
  return !cuts.mouths.some(m => contains(m.outline, x, z));
}
export function conserveBedFootprint(){throw Error('No terrain build allowed')}export function conserveWaterFootprint(){throw Error('No terrain build allowed')}export function despikeTerrain(){throw Error('No terrain build allowed')}