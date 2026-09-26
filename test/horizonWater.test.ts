import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, BufferGeometry, Float32BufferAttribute, Raycaster, Vector3 } from 'three';
import { baseHeight, conserveWaterFootprint, createTerrainCutSampler, sampleTerrain } from '../src/harbour/horizon/land/terrain';
import { decodeTerrainAsset, encodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import type { TerrainField, WaterCut } from '../src/harbour/horizon/land/interfaces';
import { buildWaterCuts, bightMouthWidth, waterInfluence } from '../src/harbour/horizon/land/water';
import { islandContains } from '../src/harbour/horizon/land/coast';
import { buildNeedleArch, buildOffshoreSolids } from '../src/harbour/horizon/land/offshore';

/** A pool is level; within one lattice diagonal of a weir or fall the ground may stand at
 * the pool above it (the step itself), never higher. Graded reaches use their plane. */
function stepLevel(water: WaterCut, x: number, z: number, plane: number, step: number): number {
  let level = plane;
  for (const p of water.points) if (Math.hypot(p[0] - x, p[2] - z) <= step * Math.SQRT2 + water.width / 2) level = Math.max(level, p[1]);
  return level;
}

describe('Horizon water and offshore land', () => {
  it('fixes lake levels and keeps every channel monotonically downstream', () => {
    const waters = buildWaterCuts();
    expect(waters.find(w => w.id === 'water.stillwater')?.level).toBe(50);
    expect(waters.find(w => w.id === 'water.cup')?.level).toBe(100);
    expect(waters.find(w => w.id === 'water.deep')).toMatchObject({ level: 40, underground: true });
    expect(waters.find(w => w.id === 'water.river.lower')?.points.at(-1)).toEqual([1364, 0, 1390]);
    for (const water of waters) for (let i = 1; i < water.points.length; i++) expect(water.points[i]![1], water.id).toBeLessThanOrEqual(water.points[i - 1]![1]);
  });
  it('places surfaces below both banks and above beds except at named confluences', () => {
    const waters = buildWaterCuts(), report: Record<string, unknown> = {};
    for (const water of waters) {
      if (water.underground || water.kind === 'sea' || water.kind === 'lagoon') continue;
      let bankSamples = 0, joined = 0;
      const check = (x: number, z: number, level: number) => {
        const other = waters.find(w => w !== water && !w.underground && w.kind !== 'sea' && w.kind !== 'lagoon' && waterInfluence(w, x, z).distance < 8);
        if (other || !islandContains(x, z)) { joined++; return; }
        // The dam's solid holds Stillwater on its downstream side (no earth bank there).
        if (water.id === 'water.stillwater' && z > 905 && Math.abs(x - 1140) < 90) { joined++; return; }
        bankSamples++;
        // The bank stands above the water it borders (at a weir, the pool it faces).
        const faced = water.points.length ? waterInfluence(water, x, z).level : level;
        expect(baseHeight(x, z), `${water.id} bank ${x},${z}, water ${faced}`).toBeGreaterThan(faced);
      };
      if (water.points.length) {
        for (let j = 1; j < water.points.length; j++) {
          const a = water.points[j - 1]!, b = water.points[j]!, dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
          for (let t = 0.1; t < 1; t += 0.1) {
            const x = a[0] + dx * t, z = a[2] + dz * t, level = a[1] + (b[1] - a[1]) * t;
            expect(baseHeight(x, z), water.id).toBeLessThan(level + 0.02);
            for (const side of [-1, 1]) check(x - side * dz / length * (water.width / 2 + 4.5), z + side * dx / length * (water.width / 2 + 4.5), level);
          }
        }
      } else {
        for (let j = 0; j < water.outline.length; j++) {
          const a = water.outline[j]!, b = water.outline[(j + 1) % water.outline.length]!, dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
          check((a[0] + b[0]) / 2 + dz / length * 8.5, (a[1] + b[1]) / 2 - dx / length * 8.5, water.level);
        }
      }
      report[water.id] = { bankSamples, confluencesOrSea: joined };
      expect(bankSamples, water.id).toBeGreaterThan(0);
    }
    console.info('HORIZON_WATER_BANKS', JSON.stringify(report));
  });
  it('measures the Bight mouth and preserves its lagoon and submerged sandbar', () => {
    const width = bightMouthWidth(islandContains);
    console.info('HORIZON_BIGHT_MOUTH', width);
    expect(width).toBeGreaterThan(220); expect(width).toBeLessThan(285);
    expect(islandContains(620, 960)).toBe(false);
    expect(baseHeight(620, 1000)).toBeCloseTo(-0.22);
    expect(baseHeight(540, 1220)).toBeGreaterThan(6); expect(baseHeight(540, 1220)).toBeLessThanOrEqual(8);
  });
  it('keeps the entire wet width below its water plane after 5 m triangle interpolation', () => {
    const waters = buildWaterCuts(), sample = createTerrainCutSampler({ waters, beds: [], pads: [], mouths: [], solids: [], diagnostics: [] }, 5);
    const patch = (x: number, z: number): number => {
      const gx = Math.floor(x / 5) * 5, gz = Math.floor(z / 5) * 5;
      const f: TerrainField = { revision: 'horizon-geo-1', width: 5, depth: 5, step: 5, columns: 2, rows: 2, heights: new Float32Array([sample(gx, gz).height, sample(gx + 5, gz).height, sample(gx, gz + 5).height, sample(gx + 5, gz + 5).height]), surfaces: new Uint8Array(4) };
      return sampleTerrain(f, x - gx, z - gz);
    };
    for (const water of waters) if (!water.underground && water.points.length && water.kind !== 'dry') {
      for (let i = 1; i < water.points.length; i++) {
        const a = water.points[i - 1]!, b = water.points[i]!, dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
        // A level pool keeps its whole wet width under its plane; beside a short weir or
        // fall the ground stays under the pool above it (the step is the weir).
        for (let t = 0.05; t < 1; t += 0.05) for (const side of [-0.99, -0.5, 0, 0.5, 0.99]) {
          const x = a[0] + dx * t - side * dz / length * water.width / 2, z = a[2] + dz * t + side * dx / length * water.width / 2;
          expect(patch(x, z), `${water.id} wet footprint ${x},${z}`).toBeLessThan(stepLevel(water, x, z, a[1] + (b[1] - a[1]) * t, 5) + 0.01);
        }
      }
    }
  }, 60000);
  it('builds a closed thick arch with a clear 22 by 16 opening and visible underside', () => {
    const arch = buildNeedleArch(), edges = new Map<string, number>();
    for (let i = 0; i < arch.indices.length; i += 3) for (let j = 0; j < 3; j++) {
      const a = arch.indices[i + j]!, b = arch.indices[i + (j + 1) % 3]!, key = [Math.min(a, b), Math.max(a, b)].join(':'); edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    expect([...edges.values()].every(n => n === 2)).toBe(true);
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(arch.positions, 3)); geometry.setIndex(arch.indices);
    const mesh = new Mesh(geometry, new MeshBasicMaterial()); mesh.updateMatrixWorld();
    for (const y of [6, 14, 22]) for (const z of [669, 680, 691]) expect(new Raycaster(new Vector3(1700, y, z), new Vector3(1, 0, 0)).intersectObject(mesh)).toHaveLength(0);
    expect(new Raycaster(new Vector3(1790, 14, 680), new Vector3(0, 1, 0)).intersectObject(mesh)[0]?.point.y).toBeCloseTo(22.2, 4);
    expect(Math.max(...arch.positions.filter((_, i) => i % 3 === 0)) - Math.min(...arch.positions.filter((_, i) => i % 3 === 0))).toBe(20);
    geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose();
    expect(buildOffshoreSolids().filter(r => r.id.startsWith('offshore.stacks'))).toHaveLength(3);
  });
  it('keeps lite 10 m and Journey 20 m wet widths below water after conservative decimation', () => {
    const waters = buildWaterCuts(), full: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 5, columns: 401, rows: 361, heights: new Float32Array(401 * 361).fill(80), surfaces: new Uint8Array(401 * 361) };
    conserveWaterFootprint(full, waters);
    const bytes = encodeTerrainAsset(full, { waters });
    for (const lod of ['full', 'lite', 'journey'] as const) {
      const field = decodeTerrainAsset(bytes, lod);
      for (const water of waters) if (!water.underground && water.points.length && water.kind !== 'dry') for (let j = 1; j < water.points.length; j++) {
        const a = water.points[j - 1]!, b = water.points[j]!, dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
        for (let t = 0.05; t < 1; t += 0.05) for (const side of [-0.99, 0, 0.99]) {
          const x = a[0] + dx * t - side * dz / length * water.width / 2, z = a[2] + dz * t + side * dx / length * water.width / 2;
          expect(sampleTerrain(field, x, z), `${lod}: ${water.id} wet width`).toBeLessThan(stepLevel(water, x, z, a[1] + (b[1] - a[1]) * t, field.step) + 0.02);
        }
      }
      expect(field.heights[0]).toBe(80); // Far dry land is unchanged in every LOD.
    }
  });
});

describe('Horizon water meets its banks (Stage A G6)', () => {
  it('holds the raster guard band at the water level: no moat below a pool', () => {
    const waters = buildWaterCuts(), sample = createTerrainCutSampler({ waters, beds: [], pads: [], mouths: [], solids: [], diagnostics: [] }, 5);
    const lake = waters.find(w => w.id === 'water.stillwater')!;
    // 3 m outside the north rim (inside the 7.07 m guard): exactly the lake level.
    expect(sample(1130, 820 - 85 - 3).height).toBeCloseTo(lake.level, 6);
    // Every pool of the lower river: a vertex 3 m outside its edge sits at its surface.
    const lower = waters.find(w => w.id === 'water.river.lower')!;
    for (let i = 1; i < lower.points.length; i++) {
      const a = lower.points[i - 1]!, b = lower.points[i]!; if (a[1] !== b[1]) continue;
      const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz), mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
      const x = mx - dz / l * (lower.width / 2 + 3), z = mz + dx / l * (lower.width / 2 + 3), w = waterInfluence(lower, x, z);
      if (Math.abs(w.level - a[1]) > 1e-9 || waters.some(o => o !== lower && !o.underground && o.kind !== 'sea' && o.kind !== 'lagoon' && waterInfluence(o, x, z).distance < 8)) continue;
      expect(sample(x, z).height, `${x},${z}`).toBeGreaterThanOrEqual(a[1] - 1e-6);
    }
  });
  it('makes the upper cascade a stair of level pools, and ends channels square like their ribbon', () => {
    const upper = buildWaterCuts().find(w => w.id === 'water.river.upper')!;
    const levels = new Set(upper.points.map(p => p[1])); expect(levels.size).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < upper.points.length; i++) {
      const a = upper.points[i - 1]!, b = upper.points[i]!, run = Math.hypot(b[0] - a[0], b[2] - a[2]);
      expect(a[1] === b[1] || run <= 1.5 + 1e-9, `segment ${i}`).toBe(true);
    }
    const lower = buildWaterCuts().find(w => w.id === 'water.river.lower')!, end = lower.points.at(-1)!, prev = lower.points.at(-2)!;
    const dx = end[0] - prev[0], dz = end[2] - prev[2], l = Math.hypot(dx, dz);
    // 2 m past the downstream end on the axis: dry (a round cap would still be wet).
    expect(waterInfluence(lower, end[0] + dx / l * 2, end[2] + dz / l * 2).distance).toBeGreaterThan(0);
  });
});

describe('Horizon terrain leftovers (Stage A W3-C: P01, P05, P06)', () => {
  const waters = buildWaterCuts(), sample = createTerrainCutSampler({ waters, beds: [], pads: [], mouths: [], solids: [], diagnostics: [] }, 5);
  it('holds Stillwater\'s band to its own west edge (P01 owner rule 0.786 -> 1.00)', () => {
    // The west edge at x 1000 borders open ground; it held 85 % of the band (40.9–44.7 at z 870–890).
    for (const z of [870, 880, 890]) expect(baseHeight(1000.5, z)).toBeGreaterThanOrEqual(45);
  });
  it('keeps the brook mouth\'s bank foot above the sea on land (P05: two samples at 0.00)', () => {
    for (const x of [820, 825]) expect(sample(x, 865).height).toBeGreaterThan(0);
  });
  it('banks a basin at its surface within one lattice diagonal and west of the dam (P06)', () => {
    const lake = waters.find(w => w.id === 'water.stillwater')!;
    // The south shore west of the abutments: the lake at 50 stood over ground at 40–49 ([1061,889], [1100,908]).
    for (const [x, z] of [[1061.6, 888.9], [1100.9, 904], [1099.6, 907.8]] as const) expect(sample(x, z).height, `${x},${z}`).toBeGreaterThanOrEqual(lake.level - 1e-6);
    // East of the dam the forecourt stays open (page A, P25): no lake bank raised in front of the face.
    expect(sample(1180, 925).height).toBeLessThan(40);
  });
});
