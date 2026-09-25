import type { BedCut, TerrainField, WaterCut } from '../interfaces';
import { conserveBedFootprint, conserveWaterFootprint, GEOGRAPHY_REVISION } from './index';

export type TerrainLod = 'full' | 'lite' | 'journey';
const MAGIC = 'HZGEO001';
const HEADER = 96;
const ENTRIES = 32;
const LODS: TerrainLod[] = ['full', 'lite', 'journey'];
/** No averaging: decimation selects the same lattice before named-footprint conservation. */
export function decimateTerrain(field: TerrainField, factor: number): TerrainField {
  if ((field.columns - 1) % factor || (field.rows - 1) % factor) throw new Error('LOD factor must divide the terrain lattice');
  const columns = (field.columns - 1) / factor + 1, rows = (field.rows - 1) / factor + 1;
  const result = { ...field, columns, rows, step: field.step * factor, heights: new Float32Array(columns * rows), surfaces: new Uint8Array(columns * rows) };
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * columns + i, b = j * factor * field.columns + i * factor;
    result.heights[a] = field.heights[b]!; result.surfaces[a] = field.surfaces[b]!;
  }
  return result;
}
/** Little-endian format: 96-byte versioned header, three 32-byte LOD entries,
 * then int16 centimetres + uint8 palette index per vertex. Quantisation ≤ 5 mm.
 * A revision mismatch or corrupt length is rejected before allocation. */
export function encodeTerrainAsset(field: TerrainField, options: { waters?: WaterCut[]; beds?: BedCut[] } = {}): ArrayBuffer {
  if (field.revision !== GEOGRAPHY_REVISION) throw new Error('Terrain revision mismatch');
  // The master 2.5 m solve decimates by 8 to Journey; a 5 m full-tier export
  // retains that same 20 m Journey lattice by decimating its retained samples by 4.
  const journeyFactor = 20 * (field.width / 2000) / field.step;
  if (!Number.isInteger(journeyFactor) || journeyFactor < 2) throw new Error('Full terrain must retain the 20 m Journey lattice');
  const levels = [options.beds ? {...field, heights: field.heights.slice(), surfaces: field.surfaces.slice()} : field, decimateTerrain(field, 2), decimateTerrain(field, journeyFactor)];
  if (options.waters) for (const level of levels.slice(1)) conserveWaterFootprint(level, options.waters);
  if (options.beds) for (const level of levels) conserveBedFootprint(level, options.beds);
  const bytes = HEADER + LODS.length * ENTRIES + levels.reduce((n, f) => n + f.heights.length * 3, 0);
  if (bytes > 2_500_000) throw new Error(`Terrain asset exceeds 2.5 MB: ${bytes}`);
  const buffer = new ArrayBuffer(bytes), view = new DataView(buffer), array = new Uint8Array(buffer);
  array.set(new TextEncoder().encode(MAGIC), 0);
  array.set(new TextEncoder().encode(GEOGRAPHY_REVISION), 8);
  view.setUint32(32, bytes, true); view.setUint32(36, levels.length, true);
  view.setFloat64(40, field.width, true); view.setFloat64(48, field.depth, true);
  let offset = HEADER + LODS.length * ENTRIES;
  levels.forEach((f, i) => {
    const entry = HEADER + i * ENTRIES;
    view.setUint32(entry, f.columns, true); view.setUint32(entry + 4, f.rows, true);
    view.setFloat64(entry + 8, f.step, true); view.setUint32(entry + 16, offset, true);
    view.setUint32(entry + 20, f.heights.length, true);
    // Bit 0: conservative water; bit 1: conservative ground-level route clearance.
    view.setUint32(entry + 24, (i > 0 && options.waters ? 1 : 0) | (options.beds ? 2 : 0), true);
    for (let n = 0; n < f.heights.length; n++) {
      const cm = Math.round(f.heights[n]! * 100);
      if (cm < -32768 || cm > 32767 || !Number.isFinite(cm)) throw new Error('Terrain height outside signed-centimetre asset range');
      view.setInt16(offset + n * 3, cm, true); view.setUint8(offset + n * 3 + 2, f.surfaces[n]!);
    }
    offset += f.heights.length * 3;
  });
  return buffer;
}
export function decodeTerrainAsset(buffer: ArrayBuffer, lod: TerrainLod = 'full'): TerrainField {
  if (buffer.byteLength < HEADER + 3 * ENTRIES || buffer.byteLength > 2_500_000) throw new Error('Invalid terrain asset length');
  const view = new DataView(buffer), text = new TextDecoder();
  if (text.decode(new Uint8Array(buffer, 0, 8)) !== MAGIC) throw new Error('Invalid terrain asset magic');
  if (text.decode(new Uint8Array(buffer, 8, GEOGRAPHY_REVISION.length)) !== GEOGRAPHY_REVISION) throw new Error('Terrain revision mismatch');
  if (view.getUint32(32, true) !== buffer.byteLength || view.getUint32(36, true) !== 3) throw new Error('Invalid terrain asset header');
  const index = LODS.indexOf(lod);
  if (index < 0) throw new Error('Unknown terrain LOD');
  const entry = HEADER + index * ENTRIES;
  const columns = view.getUint32(entry, true), rows = view.getUint32(entry + 4, true), step = view.getFloat64(entry + 8, true);
  const offset = view.getUint32(entry + 16, true), count = view.getUint32(entry + 20, true);
  const width = view.getFloat64(40, true), depth = view.getFloat64(48, true);
  if (columns < 2 || rows < 2 || columns * rows !== count || !Number.isFinite(step) || step <= 0 ||
      width !== (columns - 1) * step || depth !== (rows - 1) * step || offset < HEADER + 3 * ENTRIES || offset + count * 3 > buffer.byteLength) throw new Error('Invalid terrain lattice');
  const heights = new Float32Array(count), surfaces = new Uint8Array(count);
  for (let n = 0; n < count; n++) { heights[n] = view.getInt16(offset + n * 3, true) / 100; surfaces[n] = view.getUint8(offset + n * 3 + 2); }
  return { revision: GEOGRAPHY_REVISION, width, depth, step, columns, rows, heights, surfaces };
}
