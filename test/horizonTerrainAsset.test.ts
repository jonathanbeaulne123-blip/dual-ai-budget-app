import { describe, expect, it } from 'vitest';
import type { TerrainField } from '../src/harbour/horizon/land/interfaces';
import { decodeTerrainAsset, encodeTerrainAsset, decimateTerrain } from '../src/harbour/horizon/land/terrain/asset';
import { packTerrainPaint, sampleTerrain, TERRAIN_SURFACE_PALETTE, terrainNormal, terrainPaintGround, terrainPaintRockSet } from '../src/harbour/horizon/land/terrain';
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

describe('Horizon terrain paint byte', () => {
  it('carries ground paint and rock set in the existing byte with no format change', () => {
    const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 5, columns: 401, rows: 361, heights: new Float32Array(401 * 361).fill(20), surfaces: new Uint8Array(401 * 361) };
    for (let i = 0; i < field.surfaces.length; i++) field.surfaces[i] = packTerrainPaint(i % TERRAIN_SURFACE_PALETTE.length, i % 4);
    const decoded = decodeTerrainAsset(encodeTerrainAsset(field), 'full');
    for (let i = 0; i < field.surfaces.length; i += 97) {
      expect(terrainPaintGround(decoded.surfaces[i]!)).toBe(i % TERRAIN_SURFACE_PALETTE.length);
      expect(terrainPaintRockSet(decoded.surfaces[i]!)).toBe(i % 4);
    }
  });
});

describe('Horizon terrain mesh (render = the baked lattice)', () => {
  it('casts shadows, weights rock per triangle slope and shades turf smoothly (no 0.82 step)', async () => {
    const { buildTerrainMeshes } = await import('../src/harbour/horizon/runtime/cards');
    const { districtAt } = await import('../src/harbour/horizon/world/districts');
    const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 5, columns: 401, rows: 361, heights: new Float32Array(401 * 361), surfaces: new Uint8Array(401 * 361) };
    // A 12 eu cliff (67°) across x = 1450 in open turf.
    for (let r = 0; r < 361; r++) for (let c = 0; c < 401; c++) { field.heights[r * 401 + c] = c * 5 > 1450 ? 22 : 10; field.surfaces[r * 401 + c] = packTerrainPaint(1, 0); }
    const id = districtAt(1450, 1180), built = buildTerrainMeshes(field, { mouths: [] }, id, true, null)!;
    expect(built.meshes.length).toBeGreaterThan(0);
    let steep = 0, flat = 0;
    for (const mesh of built.meshes) {
      expect(mesh.castShadow).toBe(true); expect(mesh.receiveShadow).toBe(true);
      const p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal'), info = mesh.geometry.getAttribute('rockInfo');
      for (let t = 0; t < p.count; t += 3) {
        const ys = [p.getY(t), p.getY(t + 1), p.getY(t + 2)];
        if (Math.max(...ys) - Math.min(...ys) > 10) { steep++; for (let k = 0; k < 3; k++) expect(info.getX(t + k)).toBeGreaterThanOrEqual(0.5); }
        else if (Math.abs(p.getX(t) - 1450) > 20) { flat++; for (let k = 0; k < 3; k++) { expect(info.getX(t + k)).toBe(0); expect(n.getY(t + k)).toBeCloseTo(1, 6); } }
      }
    }
    expect(steep).toBeGreaterThan(0); expect(flat).toBeGreaterThan(0);
    // Wave 7 (E's dotted sawtooth): the walkable faces TOUCHING the cliff carry no rock either (the corner bleed is gone).
    let edge = 0;
    for (const mesh of built.meshes) {
      const p = mesh.geometry.getAttribute('position'), info = mesh.geometry.getAttribute('rockInfo');
      for (let t = 0; t < p.count; t += 3) {
        const ys = [p.getY(t), p.getY(t + 1), p.getY(t + 2)], xs = [p.getX(t), p.getX(t + 1), p.getX(t + 2)];
        if (Math.max(...ys) - Math.min(...ys) < 1e-6 && xs.some(x => Math.abs(x - 1450) <= 5)) { edge++; for (let k = 0; k < 3; k++) expect(info.getX(t + k)).toBe(0); }
      }
    }
    expect(edge).toBeGreaterThan(0);
    built.dispose();
  });
});
