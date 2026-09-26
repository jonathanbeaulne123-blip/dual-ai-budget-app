import { describe, expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { baseHeight, bandProbeEligibility, isWalkableSlope, terrainSurface, TERRAIN_SURFACE_PALETTE, WALKABLE_DEGREES } from '../src/harbour/horizon/land/terrain';
import { contains, polygonCentre } from '../src/harbour/horizon/land/terrain/geometry';
import { buildCoastline, islandContains } from '../src/harbour/horizon/land/coast';
import type { XY } from '../src/harbour/horizon/land/interfaces';

describe('Horizon authored continuous landforms', () => {
  it('respects every effective exposed polygon band and reports exclusions separately', () => {
    const report: Record<string, unknown> = {};
    for (const band of M.landforms) if (band.poly && Array.isArray(band.h)) {
      const poly = band.poly.map(p => [p[0]!, p[1]!] as XY), exclusions: Record<string, number> = {};
      let eligible = 0, passed = 0, all = 0, rawPass = 0;
      const minX = Math.min(...poly.map(p => p[0])), maxX = Math.max(...poly.map(p => p[0]));
      const minZ = Math.min(...poly.map(p => p[1])), maxZ = Math.max(...poly.map(p => p[1]));
      for (let z = minZ + 2.5; z < maxZ; z += 5) for (let x = minX + 2.5; x < maxX; x += 5) if (contains(poly, x, z)) {
        all++;
        const h = baseHeight(x, z), inBand = h >= band.h[0]! - 0.01 && h <= band.h[1]! + 0.01;
        rawPass += Number(inBand);
        const exclusion = bandProbeEligibility(band.id, x, z);
        if (exclusion) exclusions[exclusion] = (exclusions[exclusion] ?? 0) + 1;
        else { eligible++; passed += Number(inBand); }
      }
      report[band.id] = { eligible, coverage: passed / eligible, rawCoverage: rawPass / all, exclusions };
      expect(eligible, `${band.id}: no effective exposed probes`).toBeGreaterThan(0);
      expect(passed / eligible, JSON.stringify(report[band.id])).toBeGreaterThanOrEqual(0.9);
    }
    console.info('HORIZON_BAND_PROBES', JSON.stringify(report));
  }, 30000);
  it('keeps the Crown summit highest and measures actual mid-band contour asymmetry', () => {
    expect(baseHeight(1310, 470)).toBeCloseTo(158, 5);
    for (let z = 180; z < 1500; z += 20) for (let x = 300; x < 1710; x += 20) expect(baseHeight(x, z)).toBeLessThanOrEqual(158.001);
    for (const band of M.landforms) if (band.poly && Array.isArray(band.h)) {
      const poly = band.poly.map(p => [p[0]!, p[1]!] as XY), centre = polygonCentre(poly), radii: number[] = [];
      // Find the actual heightfield's first mid-band contour in each direction.
      const mid = (band.h[0]! + band.h[1]!) / 2;
      const startsAbove = baseHeight(centre[0], centre[1]) >= mid;
      for (let i = 0; i < 32; i++) {
        const a = i * Math.PI / 16; let d = 0;
        while ((baseHeight(centre[0] + d * Math.cos(a), centre[1] + d * Math.sin(a)) >= mid) === startsAbove && d < 800) d += 2;
        if (d < 800) radii.push(d);
      }
      const variation = (Math.max(...radii) - Math.min(...radii)) / (radii.reduce((a, b) => a + b, 0) / radii.length);
      console.info('HORIZON_CONTOUR', band.id, { variation, minimum: Math.min(...radii), maximum: Math.max(...radii), intersectedRays: radii.length, openRays: 32 - radii.length });
      // Coastal terraces and slopes have open contours. Open rays are reported,
      // never treated as an invented 800 m contour or counted as passing.
      expect(radii.length, `${band.id} measurable contour`).toBeGreaterThanOrEqual(2);
      if (band.id === 'crown') expect(radii).toHaveLength(32);
      expect(variation, band.id).toBeGreaterThanOrEqual(0.25);
    }
  }, 30000);
  it('follows a 300-vertex closed Catmull-Rom coast and keeps open inland ground above sea', () => {
    const coast = buildCoastline(); expect(coast).toHaveLength(300);
    for (let i = 0; i < M.island.outline.length; i++) expect(coast[i * 12]).toEqual(M.island.outline[i]);
    for (let z = 200; z < 1500; z += 25) for (let x = 300; x < 1700; x += 25) if (islandContains(x, z)) {
      if (baseHeight(x, z) <= 0) {
        // Only the named estuaries can cross sea level inside the outline.
        expect((x > 1200 && z > 1300) || (x < 900 && z > 780), `${x},${z}`).toBe(true);
      }
    }
  }, 30000);
  it('classifies every steep face as non-walkable strata with the existing 40 degree limit', () => {
    expect(WALKABLE_DEGREES).toBe(40); expect(isWalkableSlope(Math.tan(39 * Math.PI / 180))).toBe(true);
    expect(isWalkableSlope(Math.tan(41 * Math.PI / 180))).toBe(false);
    for (const [x, z] of [[1300, 450], [1200, 1010], [380, 650], [1650, 760]]) {
      expect(TERRAIN_SURFACE_PALETTE[terrainSurface(x!, z!, 75, 2)]!.id).toMatch(/^rock\./);
    }
  });
});
