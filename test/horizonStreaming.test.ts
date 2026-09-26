import { expect, it } from 'vitest';
import { buildDistricts, createDistrictStream, partitionWorldSolids, removeInternalFaces } from '../src/harbour/horizon/world/districts.ts';
import type { TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
import type { StructureSolid } from '../src/harbour/horizon/land/interfaces.ts';
import { prepareLiteWorld } from '../src/harbour/horizon/world/lite.ts';
import { simplifyPrismChains } from '../src/harbour/horizon/world/prismLod.ts';
import { emptyWorldDefinition } from '../src/harbour/horizon/world/empty.ts';
import { solidBounds, solidTopAt } from '../src/harbour/horizon/world/geometry.ts';
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
function railFixture(segments: [number, number, number, number][]): StructureSolid {
  const positions:number[]=[],indices:number[]=[],faces=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
  for(const [x1,z1,x2,z2] of segments){const length=Math.hypot(x2-x1,z2-z1),nx=-(z2-z1)/length*.045,nz=(x2-x1)/length*.045,n=positions.length/3;
    for(const h of [7.91,8])positions.push(x1-nx,h,z1-nz,x1+nx,h,z1+nz,x2+nx,h,z2+nz,x2-nx,h,z2-nz);indices.push(...faces.map(i=>i+n));}
  return{id:'thin.rail',kind:'handrail',positions,indices,surface:'metal',districtId:'harbour',bedIds:['V01'],walkable:false,role:'rail'};
}
it('coalesces bounded rail strips without thinning rails, changing bounds or removing undersides',()=>{
  const source=railFixture(Array.from({length:8},(_,i)=>[1450+i*4,1170,1454+i*4,1170])),before=JSON.stringify(source),result=simplifyPrismChains(source);
  expect(result.mergedPrisms).toBe(6);expect(result.solid.indices.length/3).toBe(24);expect(result.maxErrorEu).toBe(0);expect(result.minWidthRatio).toBe(1);
  expect(solidBounds(result.solid)).toEqual(solidBounds(source));expect(solidTopAt(result.solid,1458,1170)).toBe(8);expect(Math.min(...result.solid.positions.filter((_,i)=>i%3===1))).toBe(7.91);expect(JSON.stringify(source)).toBe(before);
});
it('keeps intentional rail gaps and curved corners that exceed the lite error bound',()=>{
  const gap=railFixture([[1450,1170,1454,1170],[1458,1170,1462,1170]]);expect(simplifyPrismChains(gap).solid).toBe(gap);
  const bend=railFixture([[1450,1170,1454,1171],[1454,1171,1458,1170]]);expect(simplifyPrismChains(bend).solid).toBe(bend);
});
it('reports actual lite triangles including terrain and preserves full collision geometry',async()=>{
  const raw=railFixture(Array.from({length:8},(_,i)=>[1450+i*4,1170,1454+i*4,1170])),solids=partitionWorldSolids([raw]),districts=buildDistricts(field,[],solids),world={...emptyWorldDefinition(),geometry:{solids},districts},before=JSON.stringify(world);
  const lite=await prepareLiteWorld(world,[raw]),full=solids.reduce((n,s)=>n+s.indices.length/3,0),saved=full-lite.geometry!.solids.reduce((n,s)=>n+(s.liteIndices??s.indices).length/3,0);
  expect(saved).toBeGreaterThan(0);expect(lite.districts.reduce((n,d)=>n+d.triangles!.lite,0)).toBe(districts.reduce((n,d)=>n+d.triangles!.lite,0)-saved);
  expect(lite.geometry!.solids[0]!.indices).toBe(solids[0]!.indices);expect(lite.geometry!.solids[0]!.positions).toBe(solids[0]!.positions);expect(JSON.stringify(world)).toBe(before);
  expect(lite.geometry!.simplification).toMatchObject({method:'prism-chain',maximumMergedPrisms:4,maxReportedErrorEu:0,fullCollisionUnchanged:true});
});
