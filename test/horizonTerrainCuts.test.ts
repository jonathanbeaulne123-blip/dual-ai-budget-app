import { describe, expect, it } from 'vitest';
import type { BedCut, LandCuts, TerrainField } from '../src/harbour/horizon/land/interfaces';
import { BED_LEVEL_TOLERANCE, BED_TERRAIN_CLEARANCE, conserveBedFootprint, createBedSampler, createTerrainCutSampler, PAD_FILL_MAX, raiseForbidden, sampleTerrain } from '../src/harbour/horizon/land/terrain';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
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
      const original = height; let footprintHeight = Infinity, deck = -Infinity;
      for (const b of beds) {
        if (!b.terrainCut || b.terrainExclusions?.some(e => Math.hypot(x - e.at[0], z - e.at[1]) < e.radius)) continue;
        const hit = linePoint(b.points, x, z);
        height = mix(height, hit.height, 1 - smooth((hit.distance - b.width / 2 - b.shoulder) / 15));
        if (hit.distance <= b.width / 2 + b.shoulder) footprintHeight = Math.min(footprintHeight, hit.height);
        if (hit.distance <= b.width / 2) deck = Math.max(deck, hit.height);
      }
      if (Number.isFinite(footprintHeight)) height = footprintHeight;
      // A lower route never excavates under an upper deck; no bed raises the sea floor or tops the summit.
      if (deck > height + BED_LEVEL_TOLERANCE) height = deck;
      if (height > original && raiseForbidden(x, z)) height = original;
      if (height > original) height = Math.min(height, Math.max(original, M.landforms.find(f => f.id === 'crown')!.summitH! - 1));
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

  it('preserves clearance across full and lite triangles and centimetre encoding', () => {
    const route = bed('diagonal', [[1451.3, 12, 1101.7], [1511.3, 19.2, 1181.7]], { width: 2.5, shoulder: 0 });
    const original = flatField(), asset = encodeTerrainAsset(original, { beds: [route] });
    expect(original.heights[0]).toBe(80); expect(original.heights[230 * 401 + 296]).toBe(80);
    for (const lod of ['full', 'lite'] as const) {
      const field = decodeTerrainAsset(asset, lod);
      for (let t = 0; t <= 1; t += .025) for (const across of [-1.2, 0, 1.2]) {
        const x = 1451.3 + 60 * t - .8 * across, z = 1101.7 + 80 * t + .6 * across, deck = 12 + 7.2 * t;
        expect(sampleTerrain(field, x, z), `${lod} t=${t} across=${across}`).toBeLessThanOrEqual(deck - .044);
      }
      expect(sampleTerrain(field, 1300, 1000)).toBe(80);
    }
  });

  it('retains the master lattice for Journey instead of adding coarse route trenches', () => {
    const original = flatField();
    const asset = encodeTerrainAsset(original, { beds: [bed('route', [[100, 5, 100], [300, 5, 100]])] });
    expect(sampleTerrain(decodeTerrainAsset(asset, 'journey'), 200, 100)).toBe(80);
    expect(sampleTerrain(decodeTerrainAsset(asset, 'full'), 200, 100)).toBeLessThan(5);
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

it('caps banks below named open bridge decks without filling their channels or cutting tunnel roofs',()=>{
 const bridge=bed('structure.highSpan',[[100,24,100],[300,24,100]],{terrainCut:false,structureIds:['highSpan']});
 const river=flatField();river.heights.fill(4);conserveBedFootprint(river,[bridge]);expect(sampleTerrain(river,200,100)).toBe(4);
 const bank=flatField();conserveBedFootprint(bank,[bridge]);expect(sampleTerrain(bank,200,100)).toBeCloseTo(23.35,4);expect(sampleTerrain(bank,200,200)).toBe(80);
});

it('clears generated bridge spans while preserving an adjacent tunnel exclusion',()=>{
 const route=bed('upper',[[100,24,100],[400,24,100]],{terrainExclusions:[{at:[180,100],radius:30,openSpan:true},{at:[330,100],radius:30}]});
 const bank=flatField();conserveBedFootprint(bank,[route]);expect(sampleTerrain(bank,180,100)).toBeCloseTo(23.35,4);expect(sampleTerrain(bank,330,100)).toBe(80);
});

describe('Horizon bed override guards (Stage A G1/G7)', () => {
  it('never raises the sea floor or the Bight lagoon floor under a bed or deck', () => {
    // [586,1147.8] is 57–71 m off the outline under the Bight Bridge; [620,910] is the lagoon.
    for (const [x, z] of [[586, 1147.8], [620, 910], [1500, 330]] as const) {
      expect(raiseForbidden(x, z), `${x},${z}`).toBe(true);
      const causeway = bed('offshore', [[x - 40, 12, z], [x + 40, 12, z]]);
      expect(createBedSampler([causeway])(x, z, -4).height).toBe(-4);
    }
    expect(raiseForbidden(1470, 1186)).toBe(false);
  });
  it('never buries a lower route under an upper deck it passes beneath; the upper fills only beside it', () => {
    // Integration (Stage A): VG was buried 3-7 eu under the Garden Walk's fill at [969,766]. A lower route keeps its
    // carriageway clear; the upper deck with no named span over it is reported as an unsupported run instead.
    const upper = bed('upper', [[1300, 30, 900], [1400, 30, 900]], { width: 8 }), lower = bed('lower', [[1350, 20, 850], [1350, 20, 950]], { width: 5 });
    for (const beds of [[upper, lower], [lower, upper]]) {
      expect(createBedSampler(beds)(1350, 900, 25).height).toBe(20);
      expect(createTerrainCutSampler(cuts(beds), 5)(1350, 900).height).toBeCloseTo(20 - BED_TERRAIN_CLEARANCE, 5);
      expect(createBedSampler(beds)(1370, 900, 25).height).toBe(30);
    }
    // At grade (within 0.5 eu) the lowest bed still gets its clearance.
    const flush = bed('flush', [[1350, 20.3, 850], [1350, 20.3, 950]], { width: 5 }), road = bed('road', [[1300, 20, 900], [1400, 20, 900]]);
    expect(createBedSampler([road, flush])(1350, 900, 25).height).toBe(20);
  });
  it('limits the clearance plane extrapolation to one raster diagonal and the land floor (P05)', () => {
    // A steep leg meeting a flat one: the steep plane extended 10 m past its end dug below the sea (−0.41 eu).
    const walk = bed('walk', [[950, 6, 1400], [950, 0.2, 1440], [950, 0.2, 1480]], { kind: 'walk', width: 5.2, shoulder: 1.2 });
    const sample = createTerrainCutSampler(cuts([walk]), 5);
    for (let z = 1440; z <= 1452; z += 2.5) expect(sample(950, z).height, `${z}`).toBeGreaterThanOrEqual(0.1 - 1e-9);
    // Pads raise no mound: a threshold at 100 over ground at 56.7 fills at most PAD_FILL_MAX.
    const tower = createTerrainCutSampler(cuts([], [{ id: 'threshold.prowPlatform', kind: 'threshold', centre: [1610, 100, 640], size: [6, 5], rotationDegrees: 0, margin: 0, blend: 6 }]), 5);
    const ground = createTerrainCutSampler(cuts([]), 5)(1610, 640).height;
    expect(tower(1610, 640).height).toBeLessThanOrEqual(ground + PAD_FILL_MAX + 1e-6);
  });
});

describe('Sketchbook sight windows (Stage A W3-C, P27)', () => {
  it('holds the open ground between a page eye and its subject under the sight plane, never on a bed', async () => {
    const { SIGHT_WINDOWS, sightWindows, baseHeight, HIGH_SPAN_EAST_RIM } = await import('../src/harbour/horizon/land/terrain');
    const { readFileSync } = await import('node:fs');
    // The window eyes are the poses' measured eyes (floor + 1.6) on the committed bake.
    const world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as { views: { id: string; eye: number[] }[] };
    for (const w of SIGHT_WINDOWS) expect(Math.abs(world.views.find(v => v.id === w.page)!.eye[1]! - w.eyeH)).toBeLessThan(.3);
    // Page A: the Notch's east rim at [1296,1121] stood as a 35 eu spine over a 22.3 sight line to the High Span's deck
    // line; the rim cap holds it at the gorge's floor-side ground, under the line, with no spire left.
    expect(baseHeight(1296, 1121)).toBeLessThanOrEqual(HIGH_SPAN_EAST_RIM + 1e-6);
    for (const [x, z] of [[1280, 1080], [1295, 1150], [1300, 1130]] as const) expect(baseHeight(x, z), `${x},${z}`).toBeLessThan(23);
    // The dam window: the gallery embankment at [1172,917] is trimmed; a bed's shoulder (edge gap 0) never is.
    expect(sightWindows(1172, 917, 43)).toBeLessThan(43);
    expect(sightWindows(1172, 917, 43, 0)).toBe(43);
    expect(sightWindows(1296, 1300, 35)).toBe(35);
  });

});

describe('Stage A W5 terrain for Jonathan\'s rulings (MANIFEST v2.0)', () => {
  it('D-A1: the Bight Bridge west abutment is a 14 × 24 embankment at the deck (12) and never earth under the deck', async () => {
    const { baseHeight, BIGHT_ABUTMENT } = await import('../src/harbour/horizon/land/terrain');
    const B = M.structures.bightBridge as { h_deck: number; ends: { west: number[]; east: number[] } }, w = B.ends.west, e = B.ends.east, l = Math.hypot(e[0]! - w[0]!, e[1]! - w[1]!), u = [(e[0]! - w[0]!) / l, (e[1]! - w[1]!) / l], n = [u[1]!, -u[0]!];
    const at = (s: number, o: number) => baseHeight(w[0]! + u[0]! * s + n[0]! * (o + BIGHT_ABUTMENT.centreOffset), w[1]! + u[1]! * s + n[1]! * (o + BIGHT_ABUTMENT.centreOffset));
    expect(BIGHT_ABUTMENT).toMatchObject({ length: 14, width: 24 });
    // Raise only: the box stands at the deck wherever the spit is lower (it rises to 13–19 at its north-west corner).
    let flat = 0; for (const s of [-14, -10, -5, -1]) for (const o of [-12, -6, 0, 6, 12]) { const h = at(s, o); expect(h).toBeGreaterThanOrEqual(B.h_deck - 1e-6); if (Math.abs(h - B.h_deck) < 1e-6) flat++; }
    expect(flat).toBeGreaterThanOrEqual(14);
    // Under the deck (s ≥ 2.5, the first bays) the ground is the sea floor, below 0 across the whole section.
    for (const s of [2.5, 5, 10, 20]) for (const o of [-10.8, 0, 10.8]) expect(at(s, o)).toBeLessThan(0);
  });
  it('D-A1: S2\'s west ramp passes the spit knoll in a cutting of at most 4 eu (the ground at the cutting\'s crest)', async () => {
    const { baseHeight, s2WestRamp, SPIT_KNOLL_CUT: c } = await import('../src/harbour/horizon/land/terrain');
    const ramp = s2WestRamp();
    expect(ramp[0]).toEqual([485, 23.7, 800]); expect(ramp.at(-1)).toEqual([466.1, 12, 1021.3]);
    let worst = -Infinity, samples = 0;
    for (let z = 950; z <= 1010; z += 2) {
      // The ramp's centreline at this z (the knoll stretch runs one segment per z), and its plan normal.
      const i = ramp.findIndex((p, k) => k > 0 && (ramp[k - 1]![2] - z) * (p[2] - z) <= 0), a = ramp[i - 1]!, b = ramp[i]!, t = (z - a[2]) / (b[2] - a[2]), x = mix(a[0], b[0], t), h = mix(a[1], b[1], t);
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]), nx = -(b[2] - a[2]) / len, nz = (b[0] - a[0]) / len;
      for (const side of [-1, 1]) { const d = c.shoulder + c.face, g = baseHeight(x + nx * d * side, z + nz * d * side); if (g > h) { worst = Math.max(worst, g - h); samples++; } }
    }
    expect(samples).toBeGreaterThan(20); expect(worst).toBeLessThanOrEqual(4 + 1e-6);
  });
  it('D-A8: the ground under the November station pad [1626,904] (turned 90°, + 2 m) is solid at 54–57', async () => {
    const { baseHeight } = await import('../src/harbour/horizon/land/terrain');
    const [px, pz] = (M.journey.station as { pad_m: number[] }).pad_m, nov = M.journey.stations.find(q => q.id === 'nov')!;
    const hs: number[] = [];
    for (let a = -(pz! / 2 + 2); a <= pz! / 2 + 2; a += 1) for (let b = -(px! / 2 + 2); b <= px! / 2 + 2; b += 1) hs.push(baseHeight(nov.xy[0]! + a, nov.xy[1]! + b));
    expect(Math.min(...hs)).toBeGreaterThan(53.5); expect(Math.max(...hs)).toBeLessThan(57.5);
  });
  it('D-C14: the cove cliff stair\'s flights are benched into the face, never buried (W5-S request 1)', async () => {
    const { baseHeight, COVE_STAIR_BENCH: c } = await import('../src/harbour/horizon/land/terrain');
    let worst = -Infinity;
    for (const [k, flight] of [[0, c.flights[0]], [2, c.flights[2]]] as const) for (let t = k === 2 ? .2 : 0; t <= 1; t += .05) {
      const [a, b] = flight, x = mix(a[0], b[0], t), h = mix(a[1], b[1], t), z = mix(a[2], b[2], t);
      for (const o of [-c.half, 0, c.half]) { const n = [-(b[2] - a[2]), b[0] - a[0]], l = Math.hypot(n[0]!, n[1]!); worst = Math.max(worst, baseHeight(x + n[0]! / l * o, z + n[1]! / l * o) - (h - c.tread)); }
    }
    expect(worst).toBeLessThanOrEqual(1e-6);
  });
  it('R2-60: the spring at the Reach is a water body with a visible source rock standing 3.2 over the ground', async () => {
    const { buildWaterCuts, buildSpringSolids, SPRING } = await import('../src/harbour/horizon/land/water');
    const pool = buildWaterCuts().find(w => w.id === 'water.spring')!;
    expect(pool).toMatchObject({ kind: 'lake', level: SPRING.pool.level, bank: .3 });
    const [rock] = buildSpringSolids(() => 6), ys = rock!.positions.filter((_, i) => i % 3 === 1);
    expect(rock!.id).toBe('water.spring.source'); expect(Math.max(...ys)).toBeCloseTo(9.2, 6); expect(Math.min(...ys)).toBeCloseTo(4.5, 6);
    expect(Math.hypot(SPRING.source.c[0] - 1250, SPRING.source.c[1] - 1180)).toBeLessThan(6);
  });
});
