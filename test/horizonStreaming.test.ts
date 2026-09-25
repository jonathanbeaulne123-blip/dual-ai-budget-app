import { expect, it } from 'vitest';
import { buildDistricts, createDistrictStream, partitionWorldSolids, removeInternalFaces } from '../src/harbour/horizon/world/districts.ts';
import type { TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 100, columns: 21, rows: 19, heights: new Float32Array(399), surfaces: new Uint8Array(399) };
it('partitions a long mesh by triangle location while retaining its source identity and every triangle',()=>{
  const chunks=partitionWorldSolids([{id:'road',kind:'road',positions:[400,30,600,410,30,600,400,30,610,1450,12,1170,1460,12,1170,1450,12,1180],indices:[0,1,2,3,4,5],surface:'paved',districtId:'harbour',bedIds:['V01'],walkable:true,role:'deck'}]);
  expect(chunks).toHaveLength(2);expect(chunks.map(c=>c.districtId).sort()).toEqual(['flats','harbour']);
  expect(chunks.reduce((n,c)=>n+c.indices.length/3,0)).toBe(2);expect(chunks.every(c=>c.sourceId==='road')).toBe(true);
});
it('removes only coincident internal faces of adjacent closed cubes',()=>{
  const positions:number[]=[],indices:number[]=[],faces=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
  for(const x of [0,2]){const base=positions.length/3;positions.push(x-1,0,-1,x-1,0,1,x+1,0,1,x+1,0,-1,x-1,2,-1,x-1,2,1,x+1,2,1,x+1,2,-1);indices.push(...faces.map(i=>i+base));}
  const solid={id:'boxes',positions,indices,kind:'box',surface:'stone',districtId:'harbour',bedIds:[],role:'wall' as const,walkable:false};
  const reduced=removeInternalFaces(solid);expect(indices.length/3).toBe(24);expect(reduced.indices.length/3).toBe(20);
  expect(Math.min(...reduced.positions.filter((_,i)=>i%3===0))).toBe(-1);expect(Math.max(...reduced.positions.filter((_,i)=>i%3===0))).toBe(3);
});
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
it('streams the underground child only on request within the same residency cap',()=>{
  const world={districts:buildDistricts(field,[],[])},stream=createDistrictStream(world,()=>({dispose(){}}),'lite');
  stream.update({x:1300,z:470,now:0,underground:true});expect(stream.live.has('undercroft')).toBe(true);
  for(let i=1;i<8;i++)stream.update({x:1300,z:470,now:i*16,underground:true});expect(stream.live.size).toBeLessThanOrEqual(3);
  stream.update({x:1300,z:470,now:200,underground:false});expect(stream.live.has('undercroft')).toBe(true);
  stream.update({x:1300,z:470,now:4200,underground:false});expect(stream.live.has('undercroft')).toBe(false);
});
