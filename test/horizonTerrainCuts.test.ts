import { describe, expect, it } from 'vitest';
import type { BedCut, LandCuts, TerrainField } from '../src/harbour/horizon/land/interfaces';
import { BED_TERRAIN_CLEARANCE, conserveBedFootprint, createBedSampler, createTerrainCutSampler, sampleTerrain } from '../src/harbour/horizon/land/terrain';
import { decodeTerrainAsset, encodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { linePoint, mix, smooth } from '../src/harbour/horizon/land/terrain/geometry';

const bed = (id: string, points: BedCut['points'], extra: Partial<BedCut> = {}): BedCut => ({ id, kind: 'road', profile: 'road', surface: 'paved', points, width: 10, shoulder: 2, blend: 15, clearHeight: 5, maxGrade: 0.12, terrainCut: true, structureIds: [], districtIds: [], ...extra });
const cuts = (beds: BedCut[], pads: LandCuts['pads'] = []): LandCuts => ({ beds, pads, waters: [], solids: [], mouths: [], diagnostics: [] });
const flatField = (): TerrainField => ({ revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 5, columns: 401, rows: 361, heights: new Float32Array(401 * 361).fill(80), surfaces: new Uint8Array(401 * 361) });

describe('Horizon spatial bed cut solver', () => {
  it('retains exact brute-force cut heights across bin boundaries, route crossings and excluded spans', () => {
    const beds = [
      bed('ring', [[20, 5, 20], [480, 20, 20], [480, 25, 480], [20, 12, 480], [20, 5, 20]]),
      bed('zigzag', [[20, 5, 20], [400, 17, 100], [40, 10, 280], [380, 30, 470]], { terrainExclusions: [{ at: [260, 150], radius: 55 }] }),
      bed('crossing', [[0, 40, 170], [420, 20, 230]]),
      bed('bridge', [[50, 100, 50], [400, 100, 400]], { terrainCut: false }),
    ];
    const indexed = createBedSampler(beds);
    for (let z = -8; z <= 512; z += 7.25) for (let x = -8; x <= 512; x += 7.25) {
      let height = 3 + x * 0.02 - z * 0.004;
      const original = height; let footprintHeight = Infinity;
      for (const b of beds) {
        if (!b.terrainCut || b.terrainExclusions?.some(e => Math.hypot(x - e.at[0], z - e.at[1]) < e.radius)) continue;
        const hit = linePoint(b.points, x, z);
        height = mix(height, hit.height, 1 - smooth((hit.distance - b.width / 2 - b.shoulder) / 15));
        if (hit.distance <= b.width / 2 + b.shoulder) footprintHeight = Math.min(footprintHeight, hit.height);
      }
      if (Number.isFinite(footprintHeight)) height = footprintHeight;
      expect(indexed(x, z, original).height, `${x},${z}`).toBeCloseTo(height, 9);
    }
  });

  it('gives the actual bed footprint priority over neighbouring blends and raised pads', () => {
    const low = bed('route', [[1450, 12, 1150], [1490, 12, 1150]], { width: 5.2, shoulder: 1.2 });
    const high = bed('nearby-ramp', [[1450, 18, 1160], [1490, 18, 1160]], { width: 2.5, shoulder: 0 });
    for (const beds of [[low, high], [high, low]]) {
      expect(createBedSampler(beds)(1470, 1150, 40).height).toBe(12);
      const sample = createTerrainCutSampler(cuts(beds, [{ id: 'upper-pad', kind: 'place', centre: [1470, 18, 1150], size: [8, 8], rotationDegrees: 0, margin: 0, blend: 6 }]), 5);
      expect(sample(1470, 1150).height).toBeLessThanOrEqual(12 - BED_TERRAIN_CLEARANCE);
    }
  });

  it('keeps the measured yearWalk obstruction below its visible sloped bed', () => {
    // Real failing segment: upperStreet's 18 m blend buried yearWalk's 12.04 m bed.
    const route = bed('yearWalk', [[1472.635358600583, 12.187263773443348, 1117.7610728862974], [1472.488478498542, 11.98487208390219, 1120.8160320699708]], { kind: 'walk', width: 5.2, shoulder: 1.2 });
    const sample = createTerrainCutSampler(cuts([route], [{ id: 'town.upperStreet', kind: 'place', centre: [1480, 18, 1080], size: [34, 70], rotationDegrees: 0, margin: 0, blend: 6 }]), 5);
    const field = flatField(), x = 1472.5311, z = 1119.9431;
    for (const vx of [1470, 1475]) for (const vz of [1115, 1120]) field.heights[vz / 5 * field.columns + vx / 5] = sample(vx, vz).height;
    expect(sampleTerrain(field, x, z)).toBeLessThan(linePoint(route.points, x, z).height - .049);
  });

  it('preserves clearance across full, lite and Journey triangles and centimetre encoding', () => {
    const route = bed('diagonal', [[1451.3, 12, 1101.7], [1511.3, 19.2, 1181.7]], { width: 2.5, shoulder: 0 });
    const original = flatField(), asset = encodeTerrainAsset(original, { beds: [route] });
    expect(original.heights[0]).toBe(80); expect(original.heights[230 * 401 + 296]).toBe(80);
    for (const lod of ['full', 'lite', 'journey'] as const) {
      const field = decodeTerrainAsset(asset, lod);
      for (let t = 0; t <= 1; t += .025) for (const across of [-1.2, 0, 1.2]) {
        const x = 1451.3 + 60 * t - .8 * across, z = 1101.7 + 80 * t + .6 * across, deck = 12 + 7.2 * t;
        expect(sampleTerrain(field, x, z), `${lod} t=${t} across=${across}`).toBeLessThanOrEqual(deck - .044);
      }
      expect(sampleTerrain(field, 1300, 1000)).toBe(80);
    }
  });

  it('leaves bridges, cave and cable beds and named tunnel roof cells intact', () => {
    const ignored = [bed('bridge', [[100, 5, 100], [300, 5, 100]], { terrainCut: false }), bed('cave', [[100, -30, 300], [300, -30, 300]], { kind: 'cave' }), bed('rail', [[100, 5, 500], [300, 5, 500]], { kind: 'rail' }), bed('cable', [[100, 5, 700], [300, 5, 700]], { kind: 'cable' })];
    const route = bed('tunnel-route', [[100, 5, 900], [500, 5, 900]], { terrainExclusions: [{ at: [300, 900], radius: 40 }] });
    const field = flatField(); conserveBedFootprint(field, [...ignored, route]);
    for (const z of [100, 300, 500, 700]) expect(sampleTerrain(field, 200, z)).toBe(80);
    expect(sampleTerrain(field, 300, 900)).toBe(80);
    expect(sampleTerrain(field, 340, 900)).toBe(80);
    expect(sampleTerrain(field, 150, 900)).toBeCloseTo(5 - BED_TERRAIN_CLEARANCE, 5);
    expect(createBedSampler([ignored[1]!])(200, 300, 80).height).toBe(80);
  });
});
