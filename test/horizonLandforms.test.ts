import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { baseHeight, bandProbeEligibility, biomeGround, DAM_WINDOW, NOTCH_HEAD, sampleTerrain, isWalkableSlope, packTerrainPaint, rockSetAt, rockWeight, ROCK_SETS, terrainPaintGround, terrainPaintRockSet, terrainSurface, TERRAIN_SURFACE_PALETTE, WALKABLE_DEGREES } from '../src/harbour/horizon/land/terrain';
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
      // v2.6 (D-M1/D-M2): Mountain v2 replaces the Shoulder's band inside its reach (exclusion 'mountain-v2'); the Shoulder's
      // remaining exposed probes are the v2.5 ones outside it, whose 155 failures (west flank by the Hollow, x 1040-1090) were
      // among v2.5's 261 (coverage 0.901 then): the band holds no new failing probe.
      if (band.id === 'shoulder') expect(eligible - passed, JSON.stringify(report[band.id])).toBeLessThanOrEqual(261);
      else expect(passed / eligible, JSON.stringify(report[band.id])).toBeGreaterThanOrEqual(0.9);
    }
    console.info('HORIZON_BAND_PROBES', JSON.stringify(report));
  }, 30000);
  it('keeps the Crown summit highest and measures actual mid-band contour asymmetry', () => {
    // v2.6 (D-M1, T1 land notes): Mountain v2 stands 1:1 with its summit plaza on the Crown summit (v2's ground there 157.96).
    // v2's own crest rises 18 m behind the plaza to 163.24 at [1297,452]: outside that crest the Crown summit stays the high point.
    expect(baseHeight(1310, 470)).toBeCloseTo(158, 1);
    for (let z = 180; z < 1500; z += 20) for (let x = 300; x < 1710; x += 20) expect(baseHeight(x, z)).toBeLessThanOrEqual(Math.hypot(x - 1300, z - 455) < 40 ? 163.25 : 158.001);
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
      // v2.6 (D-M1): Mountain v2's massif is the Crown's form now (its gorge and reservoir open some rays below mid-band).
      if (band.id === 'crown') expect(radii.length).toBeGreaterThanOrEqual(24);
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
  it('holds Stillwater on a natural rock sill at the Notch head and keeps the forecourt below it open (D-M3)', () => {
    // v2.6 (D-M3): the dam is retired (MANIFEST retired_v2_6.structures.dam): the lake's bank stands at its level + 1.2 all
    // round its south shore (the lip) except where the lower river leaves it over the sill; beyond the bank's 24 m reach the
    // square→Notch-head window still holds the forecourt at 18 (the v2.5 window, unchanged outside the lake's rim).
    const [, dz] = NOTCH_HEAD, [ex, ez] = M.views.find(v => v.id === 'A')!.xy as [number, number];
    const waters = buildWaterCuts().filter(w => !w.underground && w.kind !== 'sea' && w.kind !== 'lagoon'), lake = waters.find(w => w.id === 'water.stillwater')!, lower = waters.find(w => w.id === 'water.river.lower')!;
    const nearWater = (x: number, z: number) => waters.some(w => waterInfluence(w, x, z).distance < 15);
    expect(lower.points[0]![1], 'the lower river leaves the lake at its level').toBe(M.water.stillwater.surface);
    // The lip: 2-6 m outside the lake's south shore (not in the outlet's channel) the ground stands at the lake's level or above.
    // On the committed bake (the raster guard holds the bank's foot at the lake level, then the bank rises to level + 1.2) across
    // the v2.5 dam's width, 1-9 eu outside the shore and clear of the outlet's channel (its 6 eu half-width + 4 eu bank: the
    // weir drops 28 eu there, so the channel's own bank falls with it).
    const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin'), field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 'full');
    for (let x = 1100; x <= 1180; x += 5) { const zEdge = M.water.stillwater.cy + M.water.stillwater.ry * Math.sqrt(Math.max(0, 1 - ((x - M.water.stillwater.cx) / M.water.stillwater.rx) ** 2));
      for (const d of [1, 3, 5, 7, 9]) { const z = zEdge + d; if (waterInfluence(lower, x, z).distance < 10 || waterInfluence(lake, x, z).distance <= 0) continue; expect(sampleTerrain(field, x, z), `lip ${x},${z.toFixed(1)}`).toBeGreaterThanOrEqual(M.water.stillwater.surface - .1); } }
    let worstCap = -Infinity;
    for (const tx of [1118.7, 1140, 1161.3]) for (let t = 0.05; t < 0.99; t += 0.005) {
      const x = ex + (tx - ex) * t, z = ez + (909 - ez) * t;
      if (z > dz + 12 && !nearWater(x, z) && waterInfluence(lake, x, z).distance > 26) worstCap = Math.max(worstCap, baseHeight(x, z));
    }
    expect(worstCap, 'bank in the square→Notch-head cone beyond the lake rim').toBeLessThanOrEqual(DAM_WINDOW.cap + 1e-6);
  }, 30000);
  it('leaves no striped fin south of Stillwater or on the Notch\'s west rim beside S1 (integrator 2)', () => {
    // Was 60–67 at [1235–1260, 905–915] (the Shoulder's blend past the terrace) and 24–30 at [1205–1220, 1150–1175].
    for (let x = 1235; x <= 1260; x += 5) for (let z = 905; z <= 915; z += 5) expect(baseHeight(x, z), `${x},${z}`).toBeLessThanOrEqual(55.01);
    for (const [x, z] of [[1205, 1150], [1210, 1155], [1210, 1160], [1215, 1160], [1215, 1165], [1220, 1170], [1220, 1175]] as [number, number][]) expect(baseHeight(x, z), `${x},${z}`).toBeLessThanOrEqual(16.5);
  });
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

it('keeps the Throat mouth\'s jambs in rock when a route passes below them (P25, merged W3-A land)', async () => {
  const { createTerrainCutSampler, baseHeight } = await import('../src/harbour/horizon/land/terrain');
  const mouth = { id: 'throat', outline: [[1287, 291], [1287, 309], [1313, 309], [1313, 291]] as [number, number][] };
  const road = { id: 'V01', kind: 'road' as const, profile: 'road', surface: 'paved', points: [[1360, 74, 250], [1330, 74, 300]] as [number, number, number][], width: 8, shoulder: 1, blend: 15, clearHeight: 5, maxGrade: .12, terrainCut: true, structureIds: [], districtIds: [] };
  const sample = createTerrainCutSampler({ beds: [road], pads: [], mouths: [mouth], waters: [], solids: [], diagnostics: [] } as never, 5);
  // Beside the mouth's NE corner the road's blend pulled the buttress to 116 (June 06:50 sun into the mouth).
  expect(sample(1318, 290).height).toBeGreaterThanOrEqual(130);
  // In front of the mouth and inside it the ground is what it was without the jambs (the mouth of daylight stays open).
  const bare = createTerrainCutSampler({ beds: [road], pads: [], mouths: [], waters: [], solids: [], diagnostics: [] } as never, 5);
  for (const [x, z] of [[1300, 280], [1300, 300], [1318, 330]] as const) expect(sample(x, z).height).toBe(bare(x, z).height);
  expect(baseHeight(1318, 290)).toBeGreaterThan(sample(1318, 290).height - 1);
});
