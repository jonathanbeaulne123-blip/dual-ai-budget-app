import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, BufferGeometry, Float32BufferAttribute, Raycaster, Vector3, DoubleSide } from 'three';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { buildWaterCuts, bightMouthWidth, waterInfluence } from '../src/harbour/horizon/land/water';
import { islandContains } from '../src/harbour/horizon/land/coast';
import { buildNeedleArch, buildOffshoreSolids } from '../src/harbour/horizon/land/offshore';

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
        bankSamples++;
        expect(baseHeight(x, z), `${water.id} bank ${x},${z}, water ${level}`).toBeGreaterThan(level);
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
  it('builds a closed thick arch with a clear 22 by 16 opening and visible underside', () => {
    const arch = buildNeedleArch(), edges = new Map<string, number>();
    for (let i = 0; i < arch.indices.length; i += 3) for (let j = 0; j < 3; j++) {
      const a = arch.indices[i + j]!, b = arch.indices[i + (j + 1) % 3]!, key = [Math.min(a, b), Math.max(a, b)].join(':'); edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    expect([...edges.values()].every(n => n === 2)).toBe(true);
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(arch.positions, 3)); geometry.setIndex(arch.indices);
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide })); mesh.updateMatrixWorld();
    for (const y of [6, 14, 22]) for (const z of [669, 680, 691]) expect(new Raycaster(new Vector3(1700, y, z), new Vector3(1, 0, 0)).intersectObject(mesh)).toHaveLength(0);
    expect(new Raycaster(new Vector3(1790, 14, 680), new Vector3(0, 1, 0)).intersectObject(mesh)[0]?.point.y).toBeCloseTo(22.2, 4);
    expect(Math.max(...arch.positions.filter((_, i) => i % 3 === 0)) - Math.min(...arch.positions.filter((_, i) => i % 3 === 0))).toBe(20);
    geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose();
    expect(buildOffshoreSolids().filter(r => r.id.startsWith('offshore.stacks'))).toHaveLength(3);
  });
});
