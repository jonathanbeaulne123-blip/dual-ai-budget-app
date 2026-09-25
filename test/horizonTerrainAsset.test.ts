import { describe, expect, it } from 'vitest';
import type { TerrainField } from '../src/harbour/horizon/land/interfaces';
import { decodeTerrainAsset, encodeTerrainAsset, decimateTerrain } from '../src/harbour/horizon/land/terrain/asset';
import { sampleTerrain, terrainNormal } from '../src/harbour/horizon/land/terrain';
import { readFileSync } from 'node:fs';

describe('Horizon asynchronous terrain asset format', () => {
  const fixture = (): TerrainField => {
    const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 2.5, columns: 801, rows: 721, heights: new Float32Array(801 * 721), surfaces: new Uint8Array(801 * 721) };
    for (let i = 0; i < field.heights.length; i++) { field.heights[i] = 35 + (i % 47) * 0.031; field.surfaces[i] = i % 12; }
    return field;
  };
  it('keeps all three matching LODs under 2.5 MB with centimetre precision', () => {
    const original = fixture(), encoded = encodeTerrainAsset(original);
    expect(encoded.byteLength).toBeLessThanOrEqual(2_500_000);
    expect(encoded.byteLength).toBe(2_194_611);
    for (const [lod, factor] of [['full', 1], ['lite', 2], ['journey', 8]] as const) {
      const f = decodeTerrainAsset(encoded, lod);
      expect(f.step).toBe(2.5 * factor); expect(f.width).toBe(2000); expect(f.depth).toBe(1800);
      for (let z = 0; z < f.rows; z += 13) for (let x = 0; x < f.columns; x += 17) {
        const a = z * f.columns + x, b = z * factor * original.columns + x * factor;
        expect(Math.abs(f.heights[a]! - original.heights[b]!)).toBeLessThanOrEqual(0.0051);
        expect(f.surfaces[a]).toBe(original.surfaces[b]);
      }
    }
  });
  it('rejects corrupted data and revision mismatches', () => {
    expect(() => decodeTerrainAsset(new ArrayBuffer(4))).toThrow();
    const bytes = encodeTerrainAsset(fixture()); new Uint8Array(bytes)[8] = 120;
    expect(() => decodeTerrainAsset(bytes)).toThrow('revision');
  });
  it('exports a 5 m full tier without changing the 20 m Journey sample positions', () => {
    const master = fixture(), full = decimateTerrain(master, 2), asset = encodeTerrainAsset(full);
    expect(asset.byteLength).toBeLessThan(600_000);
    expect(decodeTerrainAsset(asset, 'full').step).toBe(5);
    expect(decodeTerrainAsset(asset, 'lite').step).toBe(10);
    const journey = decodeTerrainAsset(asset, 'journey'); expect(journey.step).toBe(20);
    expect(journey.heights).toEqual(decodeTerrainAsset(encodeTerrainAsset(master), 'journey').heights);
  });
  it('interpolates the exact NW-SW-NE / NE-SW-SE mesh, not a different curved floor', () => {
    const f: TerrainField = { revision: 'horizon-geo-1', width: 1, depth: 1, step: 1, columns: 2, rows: 2, heights: new Float32Array([0, 0, 0, 4]), surfaces: new Uint8Array(4) };
    expect(sampleTerrain(f, 0.4, 0.4)).toBe(0);
    expect(sampleTerrain(f, 0.8, 0.8)).toBeCloseTo(2.4);
    expect(terrainNormal(f, 0.4, 0.4)).toEqual([-0, 1, -0]);
    expect(terrainNormal(f, 0.8, 0.8)[1]).toBeCloseTo(1 / Math.sqrt(33));
  });
  it('does not solve a terrain at module evaluation', () => {
    const source = readFileSync(new URL('../src/harbour/horizon/land/terrain/index.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/(?:const|let)\s+\w+\s*=\s*buildTerrain\(/);
    expect(source).not.toContain('new Float32Array(801');
  });
});
