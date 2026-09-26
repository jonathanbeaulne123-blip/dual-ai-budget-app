import { describe, expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { baseHeight, bandProbeEligibility, biomeGround, DAM_WINDOW, isWalkableSlope, packTerrainPaint, rockSetAt, rockWeight, ROCK_SETS, terrainPaintGround, terrainPaintRockSet, terrainSurface, TERRAIN_SURFACE_PALETTE, WALKABLE_DEGREES } from '../src/harbour/horizon/land/terrain';
import { contains, polygonCentre } from '../src/harbour/horizon/land/terrain/geometry';
import { buildCoastline, islandContains } from '../src/harbour/horizon/land/coast';
import { buildWaterCuts, waterInfluence } from '../src/harbour/horizon/land/water';
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
    expect(WALKABLE_DEGREES).toBe(M.profiles.walkable.slope_max_deg); expect(WALKABLE_DEGREES).toBe(40); expect(isWalkableSlope(Math.tan(39 * Math.PI / 180))).toBe(true);
    expect(isWalkableSlope(Math.tan(41 * Math.PI / 180))).toBe(false);
    for (const [x, z] of [[1300, 450], [1200, 1010], [380, 650], [1650, 760]]) {
      expect(TERRAIN_SURFACE_PALETTE[terrainSurface(x!, z!, 75, 2)]!.id).toMatch(/^rock\./);
    }
  });
  it('paints rock by triangle slope with a soft 35–45° blend: every face over the limit carries strata', () => {
    expect(rockWeight(35)).toBe(0); expect(rockWeight(45)).toBe(1);
    expect(rockWeight(WALKABLE_DEGREES + 1e-6)).toBeGreaterThanOrEqual(0.5);
    expect(rockWeight(WALKABLE_DEGREES - 5)).toBe(0);
    for (let ground = 0; ground < TERRAIN_SURFACE_PALETTE.length; ground++) for (let set = 0; set < ROCK_SETS.length; set++) {
      const byte = packTerrainPaint(ground, set); expect(byte).toBeLessThan(256);
      expect(terrainPaintGround(byte)).toBe(ground); expect(terrainPaintRockSet(byte)).toBe(set);
    }
    // Strata sets follow the landforms: the Notch walls, the Flats' ochre, the Prow's sea cliff, the Crown.
    expect(ROCK_SETS[rockSetAt(1200, 1010)]!.id).toBe('notch');
    expect(ROCK_SETS[rockSetAt(380, 650)]!.id).toBe('ochre');
    expect(ROCK_SETS[rockSetAt(1650, 760)]!.id).toBe('sea');
    expect(ROCK_SETS[rockSetAt(1300, 450)]!.id).toBe('crown');
  });
  it('draws biome ground from the landform polygons, not x/z/h rulers', () => {
    const id = (x: number, z: number, h: number) => TERRAIN_SURFACE_PALETTE[biomeGround(x, z, h)]!.id;
    // The old x = 580 ochre ruler: both sides of it outside the Flats are the same ground.
    expect(id(575, 700, 30)).toBe(id(585, 700, 30)); expect(id(575, 700, 30)).not.toBe('ochre');
    expect(id(450, 650, 38)).toBe('ochre');
    // The old h ≥ 110 grey: walkable Shoulder ground at 112 outside the Crown is turf, not rock.
    expect(id(1450, 760, 112)).toBe('bankedTurf');
    expect(id(1310, 470, 158)).toBe('scree');
  });
  it('opens the square→dam window: the dam crest is in sight and no bank in front of the face stands above 18 eu', () => {
    const [dx, dz] = M.structures.dam.xy as [number, number], [ex, ez] = M.views.find(v => v.id === 'A')!.xy as [number, number];
    const waters = buildWaterCuts().filter(w => !w.underground && w.kind !== 'sea' && w.kind !== 'lagoon');
    const eye = baseHeight(ex, ez) + 1.6, nearWater = (x: number, z: number) => waters.some(w => waterInfluence(w, x, z).distance < 15);
    let worstCap = -Infinity, worstLine = -Infinity;
    for (const tx of [1118.7, 1140, 1161.3]) for (let t = 0.05; t < 0.99; t += 0.005) {
      const x = ex + (tx - ex) * t, z = ez + (909 - ez) * t, h = baseHeight(x, z);
      worstLine = Math.max(worstLine, h - (eye + (49.3 - eye) * t));
      if (z > dz + 12 && !nearWater(x, z)) worstCap = Math.max(worstCap, h);
    }
    expect(worstLine, 'terrain over the square→crest sight line').toBeLessThan(0);
    expect(worstCap, 'bank in the square→dam cone').toBeLessThanOrEqual(DAM_WINDOW.cap + 1e-6);
    for (let x = dx - 60; x <= dx + 60; x += 5) if (!nearWater(x, dz + 20)) expect(baseHeight(x, dz + 20), `${x}`).toBeLessThanOrEqual(DAM_WINDOW.cap + 1e-6);
  }, 30000);
  it('widens the Notch under the High Span: ≥ 40 eu of floor at the water between the walls', () => {
    // The High Span gate spans x 1220–1260 at z 1095 (aperture 40 × 14 at h 16): the floor
    // there is the river and its shelf at the water (its 1 m bank lip), never a wall.
    const river = buildWaterCuts().find(w => w.id === 'water.river.lower')!;
    for (let x = 1220; x <= 1260; x += 2.5) expect(baseHeight(x, 1095), `${x}`).toBeLessThanOrEqual(waterInfluence(river, x, 1095).level + river.bank + 1e-6);
  });
});

it('keeps real rock over the Throat mouth after the band blend (P25: the Throat is never lit)', async () => {
  const { baseHeight } = await import('../src/harbour/horizon/land/terrain');
  // The corridor's roof stands at 128.6 over the 110 floor at the mouth (z 300) and falls south; the
  // Stage A blend had left the ground at 115–123 there, so the P25 samples (y 111–127) stood in open air.
  for (const z of [300, 305, 310, 320]) for (const x of [1289, 1300, 1311]) expect(baseHeight(x, z)).toBeGreaterThanOrEqual(131);
  // In front of the mouth the buttress falls away north (the mouth of daylight stays open).
  expect(baseHeight(1300, 270)).toBeLessThan(100);
});
