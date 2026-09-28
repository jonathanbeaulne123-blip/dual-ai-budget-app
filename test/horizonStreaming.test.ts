import { expect, it, vi } from 'vitest';
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
it('never builds a district whose geometry chunk has not loaded, and asks the loader for it (R1-72)',()=>{
  const world={districts:buildDistricts(field,[],[])},built:string[]=[],requested:string[]=[],ready=new Set<string>();
  const stream=createDistrictStream(world,d=>{built.push(d.id);return{dispose(){}};},'full',{ready:id=>ready.has(id),request:id=>{requested.push(id);}});
  const at={x:1470,z:1186,now:0};
  stream.update(at);expect(built).toEqual([]);expect(requested.length).toBeGreaterThan(0);
  const first=requested[0]!;ready.add(first);stream.update({...at,now:16});expect(built).toEqual([first]);
});
it('loads the index, then one district chunk on request, appending its solids once; a stale chunk is refused (R1-72)',async()=>{
  const {gzipSync,strToU8}=await import('fflate');
  const {parseHorizonIndex,createHorizonChunkLoader,parseHorizonChunk}=await import('../src/house/world/horizonAssets.ts');
  const solid={id:'a@harbour',kind:'deck',positions:[0,0,0,1,0,0,0,0,1],indices:[0,1,2],surface:'stone',districtId:'harbour',bedIds:[],walkable:true,role:'deck'};
  const index={id:'horizon',geographyRevision:'horizon-geo-1',geometry:{solids:[]},collision:{beds:[]},pathGraph:{nodes:[],edges:[]},chunks:[{districtId:'harbour',url:'/horizon/world/horizon-geo-1/harbour.json.gz',bytes:1,sha256:'x',solids:1}]};
  const chunk=gzipSync(strToU8(JSON.stringify({id:'horizon-chunk',geographyRevision:'horizon-geo-1',districtId:'harbour',solids:[solid]})));
  const world=parseHorizonIndex(gzipSync(strToU8(JSON.stringify(index))).buffer as ArrayBuffer);
  const calls:string[]=[];vi.stubGlobal('fetch',async(url:string)=>{calls.push(url);return new Response(chunk as unknown as BodyInit);});
  try{
    const loader=createHorizonChunkLoader(world)!,landed:string[]=[];loader.onLoad(id=>landed.push(id));
    expect(loader.ready('harbour')).toBe(false);expect(loader.ready('green')).toBe(true);
    await Promise.all([loader.load('harbour'),loader.load('harbour')]);await loader.load('harbour');
    expect(calls).toEqual(['/horizon/world/horizon-geo-1/harbour.json.gz']);expect(landed).toEqual(['harbour']);
    expect(world.geometry.solids.map(s=>s.id)).toEqual(['a@harbour']);expect(loader.ready('harbour')).toBe(true);expect(loader.bytes()).toBe(chunk.byteLength);
  }finally{vi.unstubAllGlobals();}
  const stale=gzipSync(strToU8(JSON.stringify({id:'horizon-chunk',geographyRevision:'horizon-geo-0',districtId:'harbour',solids:[solid]})));
  expect(()=>parseHorizonChunk(stale.buffer as ArrayBuffer,index.chunks[0]!)).toThrow('stale');
  expect(()=>parseHorizonIndex(gzipSync(strToU8(JSON.stringify({...index,chunks:[{...index.chunks[0],url:'/horizon/world/horizon-geo-0/harbour.json.gz'}]}))).buffer as ArrayBuffer)).toThrow('revision');
});
it('falls back to the one-file definition when a bake has no index (404 or a dev server HTML fallback) (R1-72)',async()=>{
  const {encodeTerrainAsset}=await import('../src/harbour/horizon/land/terrain/asset.ts'),{loadHorizonAssets,HORIZON_INDEX_URL,HORIZON_MONOLITH_URL}=await import('../src/house/world/horizonAssets.ts');
  const buffer=encodeTerrainAsset({revision:'horizon-geo-1',width:2000,depth:1800,step:5,columns:401,rows:361,heights:new Float32Array(401*361),surfaces:new Uint8Array(401*361)});
  const definition={id:'horizon',geographyRevision:'horizon-geo-1',geometry:{solids:[{id:'a'}]},collision:{beds:[]},pathGraph:{nodes:[],edges:[]}},calls:string[]=[];
  vi.stubGlobal('fetch',async(url:string)=>{calls.push(url);return url===HORIZON_INDEX_URL?new Response('<!doctype html>',{headers:{'content-type':'text/html'}}):new Response(url.endsWith('.bin')?buffer as unknown as BodyInit:url.endsWith('cards.json')?'[]':JSON.stringify(definition));});
  try{const assets=await loadHorizonAssets('lite');expect(calls).toContain(HORIZON_MONOLITH_URL);expect(assets.chunks).toBeUndefined();expect(assets.world.geometry!.solids).toHaveLength(1);}
  finally{vi.unstubAllGlobals();}
});
it.each(['full', 'lite'] as const)('%s: ten Walk/Look toggles on SwiftShader frames release nothing the page can reach again; without the keep radius full thrashes offshore (Wave 6, P22)', tier => {
  const run = (keep: boolean) => {
    const world = { districts: buildDistricts(field, [], []) }, built: string[] = [], released: string[] = [];
    const stream = createDistrictStream(world, d => { built.push(d.id); return { dispose() { released.push(d.id); } }; }, tier);
    let now = 0; for (let i = 0; i < 600; i++) { stream.update({ x: 1470, z: 1186, now, mode: 'look', radius: 480, keepRadius: keep ? 480 : undefined }); now += 16; }
    const before = built.length, releasedBefore = released.length;
    // The browser harness (perf4, candidate 4): setMode, then four stream frames per mode at the tier's SwiftShader frame (median full 1,933 ms, lite 250 ms).
    for (let i = 0; i < 10; i++) for (let f = 0; f < 4; f++) { stream.update({ x: 1470, z: 1186, now, mode: i % 2 === 0 ? 'walk' : 'look', radius: i % 2 === 0 ? undefined : 480, keepRadius: keep ? 480 : undefined }); now += tier === 'full' ? 1933 : 250; }
    return { built: built.slice(before), released: released.slice(releasedBefore) };
  };
  const kept = run(true); expect(kept.built).toEqual([]); expect(kept.released).toEqual([]);
  if (tier === 'full') expect(run(false).built).toEqual(['offshore', 'offshore', 'offshore', 'offshore', 'offshore']);
  // A district nobody can reach again is still released after the grace.
  const world = { districts: buildDistricts(field, [], []) }, released: string[] = [];
  const stream = createDistrictStream(world, d => ({ dispose() { released.push(d.id); } }), tier);
  let now = 0; for (let i = 0; i < 300; i++) { stream.update({ x: 1470, z: 1186, now, mode: 'look', radius: 480, keepRadius: 480 }); now += 16; }
  for (let i = 0; i < 400; i++) { stream.update({ x: 420, z: 685, now, mode: 'walk', keepRadius: 200 }); now += 16; }
  expect(released).toContain('harbour');
});
it('chunk gate: footprints name the chunks under a step; a route lists its chunks in path order; the stale-index fallback uses the partition (Wave 6)', async () => {
  const { gzipSync, strToU8 } = await import('fflate');
  const { parseHorizonIndex, createHorizonChunkLoader } = await import('../src/house/world/horizonAssets.ts');
  const { createChunkGate, createChunkScheduler, CHUNK_REACH_EU } = await import('../src/harbour/horizon/runtime/chunkGate.ts');
  const { chunkFootprint } = await import('../scripts/horizon/artifacts.mjs');
  const deck = (id: string, district: string, x0: number, x1: number) => ({ id, kind: 'deck', positions: [x0, 12, 0, x1, 12, 0, x0, 12, 10, x1, 12, 10], indices: [0, 1, 2, 1, 3, 2], surface: 'stone', districtId: district, bedIds: [], walkable: true, role: 'deck' });
  const a = [deck('a@harbour', 'harbour', 0, 60)], b = [deck('b@bight', 'bight', 60, 200)];
  const ref = (id: string, solids: ReturnType<typeof deck>[]) => ({ districtId: id, url: `/horizon/world/horizon-geo-1/${id}.json.gz`, bytes: 1, sha256: 'x', solids: solids.length, footprint: chunkFootprint(solids) });
  expect(ref('bight', b).footprint).toEqual({ cell: 32, cells: [1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0] });
  const index = { id: 'horizon', geographyRevision: 'horizon-geo-1', geometry: { solids: [] }, collision: { beds: [] }, pathGraph: { nodes: [], edges: [] }, chunks: [ref('bight', b), ref('harbour', a)] };
  const world = parseHorizonIndex(gzipSync(strToU8(JSON.stringify(index))).buffer as ArrayBuffer);
  const payload = (id: string, solids: unknown[]) => gzipSync(strToU8(JSON.stringify({ id: 'horizon-chunk', geographyRevision: 'horizon-geo-1', districtId: id, solids })));
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => { calls.push(url); return new Response((url.includes('bight') ? payload('bight', b) : payload('harbour', a)) as unknown as BodyInit); });
  try {
    const loader = createHorizonChunkLoader(world)!, gate = createChunkGate(loader, () => 'harbour');
    await loader.load('harbour');
    // Walking east along z 5: every step up to the bight chunk's first cell is open; the first step into cell x 64 is held.
    // (Footprints are conservative: the bight deck starts at x 60, inside cell 1 = x 32–64; the gate probes 1 eu ahead.)
    let held = NaN; for (let k = 0; k <= 500; k++) { const x = 20 + k * 0.2; if (gate.missingAt(x, 5).length) { held = +x.toFixed(1); break; } }
    expect(held).toBe(31); expect(gate.missingAt(31, 5)).toEqual(['bight']); expect(gate.missingAt(30.8, 5)).toEqual([]);
    expect(gate.along([[10, 12, 5], [150, 12, 5]])).toEqual(['harbour', 'bight']); expect(gate.near(10, 5, CHUNK_REACH_EU)).toEqual(['harbour', 'bight']);
    // Bytes fetched ahead are appended at once by the gate (no wait); without bytes and not blocking it stays held.
    expect(loader.loadSync('bight')).toBe(false); await loader.prefetch('bight'); expect(loader.ready('bight')).toBe(false);
    expect(loader.loadSync('bight')).toBe(true); expect(gate.missingAt(63, 5)).toEqual([]); expect(world.geometry.solids.map(s => s.id)).toEqual(['a@harbour', 'b@bight']);
    await loader.load('bight'); expect(world.geometry.solids).toHaveLength(2); expect(calls.filter(u => u.includes('bight'))).toHaveLength(1);
    // Scheduler: the route's chunks load before what the view asked for, before the background.
    const order: string[] = [], ready = new Set<string>(), sched = createChunkScheduler({ ready: id => ready.has(id), load: async id => { order.push(id); ready.add(id); }, background: () => ['z', 'y'], isDisposed: () => false, yield: () => Promise.resolve() });
    sched.view(['v']); sched.route(['r1', 'r2']); sched.startBackground(); for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(order).toEqual(['v', 'r1', 'r2', 'z', 'y']);
  } finally { vi.unstubAllGlobals(); }
  // A stale index (no footprints): the gate falls back to the district partition around the point.
  const stale = createHorizonChunkLoader(parseHorizonIndex(gzipSync(strToU8(JSON.stringify({ ...index, chunks: index.chunks.map(({ footprint: _f, ...r }) => r) }))).buffer as ArrayBuffer))!;
  expect(stale.covering(10, 5, 1)).toBeNull();
  expect(createChunkGate(stale, x => (x < 60 ? 'harbour' : 'bight')).missingAt(59.5, 5)).toEqual(['harbour', 'bight']);
});
it('cable layer: a span renders only once both its anchors are in, an anchor draws itself while its district is not resident, and districts never draw the line (Wave 6)', async () => {
  const { createCableLayer, spanOf, cableSystems } = await import('../src/harbour/horizon/runtime/cableLayer.ts');
  const g1 = cableSystems().find(s => s.id === 'G1')!;
  expect(g1.anchors).toHaveLength(5); expect(spanOf(g1.anchors, 1480, 1090)).toBe(0); expect(spanOf(g1.anchors, 1335, 535)).toBe(3);
  // One cable solid with a triangle over span 0 and one over span 3; the base platform and the top platform as anchors.
  const [a0, a1] = [g1.anchors[0]!.xy, g1.anchors[1]!.xy], [a3, a4] = [g1.anchors[3]!.xy, g1.anchors[4]!.xy];
  const mid = (p: readonly number[], q: readonly number[]) => [(p[0]! + q[0]!) / 2, (p[1]! + q[1]!) / 2];
  const m0 = mid(a0, a1), m3 = mid(a3, a4);
  const cable = { id: 'G1.cable@harbour', sourceId: 'G1.cable', districtId: 'harbour', kind: 'cable', surface: 'metal', role: 'rail', walkable: false, bedIds: [], positions: [m0[0]!, 40, m0[1]!, m0[0]! + 1, 40, m0[1]!, m0[0]!, 41, m0[1]!, m3[0]!, 120, m3[1]!, m3[0]! + 1, 120, m3[1]!, m3[0]!, 121, m3[1]!], indices: [0, 1, 2, 3, 4, 5] };
  const slab = (id: string, district: string, xy: readonly number[]) => ({ id: `${id}@${district}`, sourceId: id, districtId: district, kind: 'platform', surface: 'stone', role: 'floor', walkable: true, bedIds: [], positions: [xy[0]!, 18, xy[1]!, xy[0]! + 2, 18, xy[1]!, xy[0]!, 18, xy[1]! + 2], indices: [0, 1, 2] });
  const world = { geometry: { solids: [cable, slab('platform.gondolaBase.slab', 'harbour', a0), slab('platform.gondolaTop.slab', 'crown', a4)] } } as unknown as Parameters<typeof createCableLayer>[0];
  const ready = new Set(['harbour']), where = (xy: readonly number[]) => [xy === a4 || xy[1]! < 800 ? 'crown' : 'harbour'];
  const layer = createCableLayer(world, 'full', id => ready.has(id), where);
  layer.rebuild();
  // Towers 1–3 sit (for this fake) in harbour, crown for the top: spans 0–1 drawn (base + tower 1, towers 1–2), 3 not (the top's chunk is out).
  expect(layer.stats().spans.filter(s => s.system === 'G1').map(s => s.drawn)).toEqual([true, true, false, false]);
  layer.update(new Set(['harbour']), false); expect(layer.stats().anchorsDrawn).toEqual([]);
  layer.update(new Set(['crown']), false); expect(layer.stats().anchorsDrawn).toEqual(['harbour']);
  ready.add('crown'); layer.rebuild(); layer.update(new Set(['harbour']), false);
  expect(layer.stats().spans.filter(s => s.system === 'G1').map(s => s.drawn)).toEqual([true, true, true, true]); expect(layer.stats().anchorsDrawn).toEqual(['crown']);
  layer.dispose();
  const { CABLE_LINE } = await import('../src/harbour/horizon/runtime/cards.ts'); expect(CABLE_LINE.test('G1.cable')).toBe(true); expect(CABLE_LINE.test('G1.towers')).toBe(false);
});

// v2.2 (reconciled with main #551/#552): the RIDE chunk rule. A board, bicycle, glider or parachute is taken only with every
// chunk resident (a glider cannot wait at a boundary in the air); the held offer boards by itself when the last chunk lands,
// if it is still the one on show; walking away drops it; parking never waits.
import { createRideGate, rideMissing } from '../src/harbour/horizon/runtime/chunkGate.ts';
it('holds a boarding until every chunk is resident, then boards the held offer by itself', () => {
  const resident = new Set(['harbour', 'landing']), loader = { refs: ['harbour', 'landing', 'crown', 'prow'].map(districtId => ({ districtId })), ready: (id: string) => resident.has(id) };
  expect(rideMissing(loader)).toEqual(['crown', 'prow']);
  const gate = createRideGate<{ id: string; to: string }>(loader), glide = { id: 'crownLaunch:feet→glider', to: 'glider' }, board = { id: 'skateLineStarts.1:feet→board', to: 'board' };
  expect(gate.request(glide)).toBe(false); expect(gate.pending()).toBe(glide);
  expect(gate.request({ id: 'landingQuay:board→feet', to: 'feet' })).toBe(true);   // parking never waits (and clears a held boarding)
  expect(gate.pending()).toBeNull();
  expect(gate.request(glide)).toBe(false);
  expect(gate.poll(glide)).toBeNull();                         // still missing: held
  resident.add('crown');
  expect(gate.poll(glide)).toBeNull();                         // one chunk still missing
  resident.add('prow');
  expect(gate.poll(glide)).toBe(glide); expect(gate.pending()).toBeNull();   // boards by itself, once
  expect(gate.request(board)).toBe(true);                      // all resident: at once
  expect(gate.stats()).toEqual({ pending: null, holds: 2 });
});
it('drops a held boarding when the rider walks away from its offer, and never holds without a chunked world', () => {
  const loader = { refs: [{ districtId: 'harbour' }, { districtId: 'crown' }], ready: (id: string) => id === 'harbour' };
  const gate = createRideGate<{ id: string; to: string }>(loader), glide = { id: 'crownLaunch:feet→glider', to: 'glider' };
  expect(gate.request(glide)).toBe(false);
  expect(gate.poll(null)).toBeNull(); expect(gate.pending()).toBeNull();   // no offer on show: dropped
  expect(gate.request(glide)).toBe(false);
  expect(gate.poll({ id: 'prowPlatform:feet→glider', to: 'glider' })).toBeNull(); expect(gate.pending()).toBeNull();   // another offer: dropped
  const monolith = createRideGate<{ id: string; to: string }>(undefined);
  expect(monolith.request(glide)).toBe(true); expect(monolith.missing()).toEqual([]);
});
it('wires the ride rule into the runtime: boarding asks the gate, the held offer is polled each frame, the review attach may load synchronously', async () => {
  const { readFileSync } = await import('node:fs');
  const runtime = readFileSync('src/harbour/horizon/runtime/index.ts', 'utf8');
  expect(runtime).toMatch(/if\(!riding&&offer\.to!=='feet'&&\(rideGateOpen\(\),!rideGate\.request\(offer\)\)\)\{options\.onStatus\?\.\(RIDE_WAITS_STATUS\);return false;\}/);
  // The held offer is looked up among the registry's offers at the body (not the offer row, which a Walk tween hides).
  expect(runtime).toMatch(/if\(held&&mode==='walk'\)\{rideGateOpen\(\);const here=registry\.offers\(body\)\.find\(o=>o\.id===held\.id\)\?\?null,go=rideGate\.poll\(here\);if\(go&&acceptOffer\(go\)\)/);
  expect(runtime).toMatch(/attachMover\(controller:ModeController,offer:ThresholdOffer\)\{.*if\(!rideGateOpen\(true\)\)return false;if\(!registry\.attach/);
  expect(runtime).toMatch(/ride:rideGate\.stats\(\)/);
});
it('R3-118: a failed chunk is retried with back-off (3 tries), then waits exhausted until a new route or hold asks for it again', async () => {
  const { createChunkScheduler, CHUNK_RETRY_TRIES, CHUNK_RETRY_BACKOFF_MS } = await import('../src/harbour/horizon/runtime/chunkGate.ts');
  let clock = 0, network = false; const timers: { at: number; fn: () => void }[] = [], ready = new Set<string>(), tries: string[] = [];
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const advance = async (ms: number) => { clock += ms; for (const t of timers.splice(0).filter(t => { if (t.at <= clock) return true; timers.push(t); return false; })) t.fn(); await flush(); };
  const sched = createChunkScheduler({ ready: id => ready.has(id), load: async id => { tries.push(id); if (!network) throw new Error('offline'); ready.add(id); }, background: () => [], isDisposed: () => false, yield: () => Promise.resolve(), now: () => clock, setTimer: (fn, ms) => timers.push({ at: clock + ms, fn }) });
  expect([CHUNK_RETRY_TRIES, ...CHUNK_RETRY_BACKOFF_MS]).toEqual([3, 1000, 4000]);
  sched.route(['lakeside']); await flush();
  expect(tries).toEqual(['lakeside']); expect(sched.failures()).toEqual([{ id: 'lakeside', tries: 1, retryAt: 1000, exhausted: false }]);
  await advance(999); expect(tries).toHaveLength(1);           // back-off: not before 1 s
  await advance(1); expect(tries).toHaveLength(2);             // try 2 at 1 s
  await advance(4000); expect(tries).toHaveLength(3);          // try 3 at 5 s
  expect(sched.failures()[0]).toMatchObject({ tries: 3, exhausted: true, retryAt: null });
  await advance(60_000); expect(tries).toHaveLength(3);        // exhausted: no busy retry loop; the gate stays held and says so
  expect(sched.queued().route).toEqual(['lakeside']);          // still queued in its place — never dropped (review 3: queued.route [])
  sched.route(['lakeside']); sched.view(['lakeside']); await advance(60_000); expect(tries).toHaveLength(3);   // a repeated identical demand is not a new one (Codex P2)
  network = true; sched.route(['lakeside'], true); await flush();   // a new walk plan is a fresh demand
  expect(tries).toHaveLength(4); expect(ready.has('lakeside')).toBe(true); expect(sched.failures()).toEqual([]);
});
it('Codex P2 (PR #561): a chunk that always 404s is tried 3 times across 600 frames of identical demand, stays "part failed", and a new route re-arms it exactly once', async () => {
  const { createChunkScheduler, CHUNK_FAILED_STATUS, CHUNK_ARRIVING_STATUS } = await import('../src/harbour/horizon/runtime/chunkGate.ts');
  let clock = 0; const timers: { at: number; fn: () => void }[] = [], ready = new Set<string>(), fetches: string[] = [];
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  let broken = '';
  const sched = createChunkScheduler({ ready: id => ready.has(id), load: async id => { fetches.push(id); if (id === broken) throw new Error('404'); ready.add(id); }, background: () => [], isDisposed: () => false, yield: () => Promise.resolve(), now: () => clock, setTimer: (fn, ms) => timers.push({ at: clock + ms, fn }) });
  // The district stream as the runtime wires it (runtime/index.ts: request → scheduler.view([id]), every animation frame).
  const world = { districts: buildDistricts(field, [], []) };
  const stream = createDistrictStream(world, () => ({ dispose() {} }), 'full', { ready: id => ready.has(id), request: id => { if (!broken) broken = id; sched.view([id]); } });
  const heldNow = () => [broken];   // the walker held at the broken chunk's boundary (runtime gateOpen)
  const status = () => (sched.failures().some(f => heldNow().includes(f.id)) ? CHUNK_FAILED_STATUS : CHUNK_ARRIVING_STATUS);   // runtime holdStatus
  const frames = async (n: number) => {
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      stream.update({ x: 1470, z: 1186, now: clock });                                                        // districts.ts:171 → view([id])
      sched.route([...heldNow(), ...sched.queued().route]);                                                  // a held ride's poll / the gate hold
      clock += 16; for (const t of timers.splice(0).filter(t => { if (t.at <= clock) return true; timers.push(t); return false; })) t.fn();
      await flush(); if (fetches.filter(id => id === broken).length) seen.add(status());
    }
    return seen;
  };
  const seen = await frames(600);   // 9.6 s of frames: the 1 s and 4 s back-offs both elapse
  const brokenFetches = () => fetches.filter(id => id === broken).length;
  expect(broken).not.toBe('');
  expect(brokenFetches()).toBe(3);                                               // was: one fetch + decompress + parse per frame, forever
  expect(sched.failures().find(f => f.id === broken)).toMatchObject({ tries: 3, exhausted: true, retryAt: null });
  expect([...seen]).toEqual([CHUNK_FAILED_STATUS]);                             // "part failed" on every frame once it failed
  expect(sched.rearms()).toBe(0);
  sched.route([broken, 'elsewhere'], true);                                      // a new walk plan that crosses it (runtime routeAhead)
  expect(sched.rearms()).toBe(1);
  expect([...await frames(600)]).toEqual([CHUNK_FAILED_STATUS]);
  expect(brokenFetches()).toBe(6); expect(sched.rearms()).toBe(1);               // re-armed exactly once: 3 more tries, then held again
  // A chunk newly entering the demand (it failed in the background, in neither list) is re-armed once by its first hold;
  // the same hold again — the walker pushing at that boundary frame after frame — is not a new demand.
  const bgTimers: { at: number; fn: () => void }[] = [], bgFetches: string[] = [];
  const bg = createChunkScheduler({ ready: () => false, load: async id => { bgFetches.push(id); throw new Error('404'); }, background: () => ['far'], isDisposed: () => false, yield: () => Promise.resolve(), now: () => clock, setTimer: (fn, ms) => bgTimers.push({ at: clock + ms, fn }) });
  const bgAdvance = async (ms: number) => { clock += ms; for (const t of bgTimers.splice(0).filter(t => { if (t.at <= clock) return true; bgTimers.push(t); return false; })) t.fn(); await flush(); };
  bg.startBackground(); await flush(); await bgAdvance(1000); await bgAdvance(4000);
  expect(bgFetches).toHaveLength(3); expect(bg.failures()[0]).toMatchObject({ id: 'far', exhausted: true });
  bg.route(['far']); await flush(); expect(bg.rearms()).toBe(1); expect(bgFetches).toHaveLength(4);   // first hold: newly demanded
  await bgAdvance(1000); await bgAdvance(4000); expect(bgFetches).toHaveLength(6);
  for (let i = 0; i < 600; i++) { bg.route(['far', ...bg.queued().route]); bg.view(['far']); await bgAdvance(16); }
  expect(bgFetches).toHaveLength(6); expect(bg.rearms()).toBe(1);
  bg.retry(['far']); await flush(); expect(bgFetches).toHaveLength(7); expect(bg.rearms()).toBe(2);   // Look → Walk onto it again: an explicit retry
});
it('R3-118 / R3-122: the runtime holds with a status line, retries on a new hold, never throws a failed review fetch, and restores wait for their chunk', async () => {
  const { readFileSync } = await import('node:fs');
  const runtime = readFileSync('src/harbour/horizon/runtime/index.ts', 'utf8'), gate = readFileSync('src/harbour/horizon/runtime/chunkGate.ts', 'utf8');
  expect(gate).toMatch(/CHUNK_ARRIVING_STATUS = 'The island is still arriving here\./);
  // Status while held (arriving, or failed and being retried); a new hold re-routes (a fresh demand).
  expect(runtime).toMatch(/text=failedHere\?CHUNK_FAILED_STATUS:CHUNK_ARRIVING_STATUS;\s*if\(text!==holdText\)\{holdText=text;options\.onStatus\?\.\(text\);\}/);
  expect(runtime).toMatch(/if\(heldNow\.join\(\)!==still\.join\(\)\)\{heldNow=still;hold\(\{districts:still,at,t\}\);scheduler\?\.route\(/);
  // R3-122 (b): the synchronous review fetch's NetworkError holds the step instead of escaping the loop.
  expect(runtime.match(/try\{chunks\.loadSync\(id,[^)]*\);\}catch\{/g)).toHaveLength(2);
  // R3-122 (a): a restore into a missing chunk holds at its saved height; the validation runs when the chunk lands.
  expect(runtime).toMatch(/if\(current&&!gateOpen\(saved\.x,saved\.z\)\)\{Object\.assign\(body,\{x:saved\.x,y:saved\.y!,z:saved\.z,yaw:saved\.yaw\}\);pendingRestore=\{\.\.\.saved\};scheduler\?\.retry\(heldNow\);\}/);
  expect(runtime).toMatch(/if\(pendingRestore\)\{const saved=pendingRestore;pendingRestore=null;const next=restoreHorizonPosition\(saved,/);
  expect(runtime).toMatch(/failures:scheduler!\.failures\(\)/);
});

it('reuses stationary spatial selection while still processing newly ready chunks and mode history',()=>{
  const districts=buildDistricts(field,[],[]),world={districts};
  const first=districts[0]!, polygon=first.outline, read=vi.fn(()=>polygon);
  Object.defineProperty(first,'outline',{get:read});
  const ready=new Set<string>(),request=vi.fn();
  const stream=createDistrictStream(world,()=>({dispose(){}}),'full',{ready:id=>ready.has(id),request});
  const at={x:1455,z:1175,now:0};stream.update(at);const reads=read.mock.calls.length;
  expect(reads).toBeGreaterThan(0);expect(stream.live.size).toBe(0);
  for(const [id] of request.mock.calls)ready.add(id);
  for(let i=1;i<=5;i++)stream.update({...at,now:i*16,mode:'look'});
  expect(read).toHaveBeenCalledTimes(reads);expect(stream.live.size).toBeGreaterThan(0);
  expect(stream.history.at(-1)!.mode).toBe('look');
  stream.update({...at,x:at.x+1,now:100});expect(read.mock.calls.length).toBeGreaterThan(reads);
  const movedReads=read.mock.calls.length;
  stream.update({...at,x:at.x+1,radius:2000,now:116});expect(read.mock.calls.length).toBeGreaterThan(movedReads);
  stream.dispose();
});
