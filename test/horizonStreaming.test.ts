import { expect, it } from 'vitest';
import { buildDistricts, createDistrictStream } from '../src/harbour/horizon/world/districts.ts';
import type { TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 100, columns: 21, rows: 19, heights: new Float32Array(399), surfaces: new Uint8Array(399) };
it('keeps thirteen surface districts with the Undercroft owned by Crown', () => {
  const districts = buildDistricts(field, [], []);
  expect(districts).toHaveLength(13);
  expect(districts.find(d => d.id === 'crown')?.children?.[0]).toMatchObject({ id: 'undercroft', childOf: 'crown' });
  expect(districts.every(d => d.bounds && d.triangles!.full <= 150000 && d.triangles!.lite <= 60000)).toBe(true);
});
it.each(['full', 'lite'] as const)('caps %s residency and builds one per frame across a Walk/Look switch', tier => {
  const world = { districts: buildDistricts(field, [], []) }, released: string[] = [];
  const stream = createDistrictStream(world, d => ({ dispose: () => released.push(d.id) }), tier);
  for (let i = 0; i < 5; i++) stream.update({ x: 1455, z: 1175, now: i * 16, radius: 2000, mode: 'walk' });
  const before = [...stream.live.keys()];
  stream.update({ x: 350, z: 550, now: 100, radius: 2000, mode: 'look' });
  expect([...stream.live.keys()]).toEqual(before); expect(released).toEqual([]);
  stream.update({ x: 350, z: 550, now: 4099, radius: 2000 }); expect(released).toEqual([]);
  stream.update({ x: 350, z: 550, now: 4100, radius: 2000 });
  expect(released.length).toBeGreaterThan(0);
  expect(stream.history.every(frame => frame.built.length <= 1 && frame.resident.length <= (tier === 'full' ? 4 : 3))).toBe(true);
  stream.dispose(); expect(stream.live.size).toBe(0);
});
