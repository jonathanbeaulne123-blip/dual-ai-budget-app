import { expect, it } from 'vitest';
import { buildDistricts, createDistrictStream, partitionWorldSolids, removeInternalFaces } from '../src/harbour/horizon/world/districts.ts';
import type { TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
import type { StructureSolid } from '../src/harbour/horizon/land/interfaces.ts';
import { prepareLiteWorld } from '../src/harbour/horizon/world/lite.ts';
import { simplifyPrismChains } from '../src/harbour/horizon/world/prismLod.ts';
import { emptyWorldDefinition } from '../src/harbour/horizon/world/empty.ts';
import { solidBounds, solidTopAt, pointInPolygon } from '../src/harbour/horizon/world/geometry.ts';
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
it.each(['full', 'lite'] as const)('caps %s residency, builds one per frame and never rebuilds on a Walk/Look toggle', tier => {
  const world = { districts: buildDistricts(field, [], []) }, released: string[] = [], built: string[] = [];
  const stream = createDistrictStream(world, d => { built.push(d.id); return { dispose: () => released.push(d.id) }; }, tier);
  for (let i = 0; i < 5; i++) stream.update({ x: 1455, z: 1175, now: i * 16, radius: 2000, mode: 'walk' });
  const before = [...stream.live.keys()], builds = built.length;
  // Ten Walk/Look toggles in place: the wanted set is unchanged, so nothing builds or releases (P22).
  for (let i = 0; i < 10; i++) stream.update({ x: 1455, z: 1175, now: 100 + i * 16, radius: 2000, mode: i % 2 ? 'walk' : 'look' });
  expect([...stream.live.keys()]).toEqual(before); expect(built.length).toBe(builds); expect(released).toEqual([]);
  expect(stream.history.every(frame => frame.built.length <= 1 && frame.resident.length <= (tier === 'full' ? 4 : 3))).toBe(true);
  stream.dispose(); expect(stream.live.size).toBe(0);
});
it.each(['full', 'lite'] as const)('%s: after a relocation the camera district is built on the first frame, releasing before building (R1-70)', tier => {
  const world = { districts: buildDistricts(field, [], []) }, released: string[] = [];
  const stream = createDistrictStream(world, d => ({ dispose: () => released.push(d.id) }), tier);
  for (let i = 0; i < 6; i++) stream.update({ x: 1455, z: 1175, now: i * 16, radius: 2000 });
  expect(stream.live.size).toBe(stream.cap);
  // Relocate to the Flats (the review measured 240 frames lite / 127 full before the camera district was built).
  stream.update({ x: 350, z: 550, now: 200, radius: 2000 });
  const frame = stream.history.at(-1)!;
  expect(frame.built).toEqual(['flats']); expect(frame.released).toHaveLength(1); expect(stream.live.has('flats')).toBe(true);
  // The rest of the new neighbourhood follows at one build per frame, each preceded by one release.
  let frames = 1; while (stream.history.at(-1)!.pending.length && frames < 20) { stream.update({ x: 350, z: 550, now: 200 + frames * 16, radius: 2000 }); frames++; }
  expect(frames).toBeLessThanOrEqual(stream.cap); expect(stream.history.every(f => f.built.length <= 1 && f.resident.length <= stream.cap)).toBe(true);
});
it('reads the partition and the offshore rules from the definition, not code constants (R1-67)', () => {
  const districts = buildDistricts(field, [], []);
  expect(districts.filter(d => d.id !== 'offshore').every(d => d.heart && pointInPolygon(d.heart[0], d.heart[1], d.outline))).toBe(true);
  const offshore = districts.find(d => d.id === 'offshore')!; expect(offshore.offshore!.sites.length).toBeGreaterThanOrEqual(7); expect(offshore.offshore!.islandBox).toEqual([[300, 0], [1720, 1530]]);
  // A definition that moves the Lamp moves the stream: the rocks come first at the definition's site.
  const moved = districts.map(d => d.id === 'offshore' ? { ...d, offshore: { ...d.offshore!, sites: [[1000, 900]] as [number, number][] } } : d), stream = createDistrictStream({ districts: moved }, () => ({ dispose() {} }), 'lite');
  stream.update({ x: 1010, z: 905, now: 0 }); expect([...stream.live.keys()][0]).toBe('offshore');
});
it('counts a district draw call per 256-eu card cell of terrain and of solids (was a solid count)', () => {
  const road = partitionWorldSolids([{ id: 'road', kind: 'road', positions: [1400, 12, 1150, 1410, 12, 1150, 1400, 12, 1160, 1500, 12, 1150, 1510, 12, 1150, 1500, 12, 1160], indices: [0, 1, 2, 3, 4, 5], surface: 'paved', districtId: 'harbour', bedIds: ['V01'], walkable: true, role: 'deck' }]);
  const harbour = buildDistricts(field, [], road).find(d => d.id === 'harbour')!, terrainOnly = buildDistricts(field, [], []).find(d => d.id === 'harbour')!;
  // Two triangles in two different 256-eu cells ([1400,1150] → 5:4, [1500,1150] → 5:4 and 5:4? 1500/256 = 5.86) share one cell.
  expect(harbour.drawCalls! - terrainOnly.drawCalls!).toBe(1); expect(harbour.solidIds).toHaveLength(1);
});
it('streams the underground child only on request within the same residency cap',()=>{
  const world={districts:buildDistricts(field,[],[])},stream=createDistrictStream(world,()=>({dispose(){}}),'lite');
  stream.update({x:1300,z:470,now:0,underground:true});expect(stream.live.has('undercroft')).toBe(true);
  for(let i=1;i<8;i++)stream.update({x:1300,z:470,now:i*16,underground:true});expect(stream.live.size).toBeLessThanOrEqual(3);
  stream.update({x:1300,z:470,now:200,underground:false});expect(stream.live.has('undercroft')).toBe(true);
  stream.update({x:1300,z:470,now:4200,underground:false});expect(stream.live.has('undercroft')).toBe(false);
});
it('loads the camera district first even when other district bounding boxes overlap it',()=>{
  const world={districts:buildDistricts(field,[],[])},stream=createDistrictStream(world,()=>({dispose(){}}),'lite');
  // The High Span camera was assigned distant box-overlapping districts, leaving
  // its close ground represented by the coarser Journey mesh.
  stream.update({x:1245,z:1125,now:0,mode:'look',radius:1000});
  expect([...stream.live.keys()][0]).toBe('notch');
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
it.each(['full', 'lite'] as const)('%s: ten Walk/Look toggles at the runtime radii (walking default vs the page radius) build nothing (P22)', tier => {
  const world = { districts: buildDistricts(field, [], []) }, built: string[] = [];
  const stream = createDistrictStream(world, d => { built.push(d.id); return { dispose() {} }; }, tier);
  // Page A's shot: look at the square with the page's 480 eu radius until settled (grace included).
  let now = 0; for (let i = 0; i < 600; i++) { stream.update({ x: 1470, z: 1186, now, mode: 'look', radius: 480 }); now += 16; }
  const before = built.length;
  // The browser harness: setMode every 200 ms; walk passes no radius (150 lite / 220 full), look the page's.
  for (let i = 0; i < 10; i++) for (let f = 0; f < 12; f++) { stream.update({ x: 1470, z: 1186, now, mode: i % 2 === 0 ? 'walk' : 'look', radius: i % 2 === 0 ? undefined : 480 }); now += 16; }
  expect(built.length - before).toBe(0);
  // A relocation still settles at once: the camera district on the first frame, the neighbourhood within the cap.
  stream.update({ x: 350, z: 550, now, radius: 2000 }); expect(stream.history.at(-1)!.built).toEqual(['flats']);
});
