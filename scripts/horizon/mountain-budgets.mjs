/** Run from the worktree AFTER the final bake: node scripts/horizon/mountain-budgets.mjs > /tmp/mountain-budgets.json
 * Runtime geometry only. Does not import a source world builder or run terrain solving.
 * Optional CORRIDOR_IDS comma-separated; default is complete new mountain connection.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.cwd();
const esbuild=await import(pathToFileURL(path.join(root,'node_modules/esbuild/lib/main.js')));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'mountain-budgets-'));
process.on('exit',()=>fs.rmSync(scratch,{recursive:true,force:true}));
const bundle=path.join(scratch,'runtime.mjs');
await esbuild.build({stdin:{contents:`export {createCorridorArt} from './src/harbour/horizon/runtime/corridorArt.ts';export {createCorridorPlanting} from './src/harbour/horizon/runtime/corridorPlanting.ts';export {districtAt,useDefinitionDistricts} from './src/harbour/horizon/world/districts.ts';export {decodeTerrainAsset} from './src/harbour/horizon/land/terrain/asset.ts';export {sampleTerrain} from './src/harbour/horizon/land/terrain/index.ts';export {PerspectiveCamera} from 'three';`,resolveDir:root,loader:'ts'},platform:'node',format:'esm',bundle:true,outfile:bundle,plugins:[{name:'pure-crown-budget-adapter',setup(build){build.onLoad({filter:/[/\\]mountain[/\\]planting\.ts$/},({path:file})=>{
 const source=fs.readFileSync(file,'utf8');const crown=source.match(/export function crownOf[\s\S]*?^}/m)?.[0];if(!crown)throw Error('crownOf source contract changed');
 // Keep the exact geometry helper; prevent the unrelated scene definition's eager terrain work.
 return {contents:crown+"\nexport function mountainPlanting(){throw new Error('Budget probe must not generate native planting');}",loader:'ts',resolveDir:path.dirname(file)};
});}}]});
const m=await import(pathToFileURL(bundle));
const worldPath=process.env.MOUNTAIN_BUDGET_WORLD??path.join(root,'public/horizon/world/horizon-geo-1.json');
const worldBytes=fs.readFileSync(worldPath),world=JSON.parse(worldBytes);
m.useDefinitionDistricts(world.districts);
const wanted=process.env.CORRIDOR_IDS==='all'?world.corridors.map(c=>c.id):(process.env.CORRIDOR_IDS??'V03,spur stillwater,mountainV2.road').split(',');
const corridors=(world.corridors??[]).filter(c=>wanted.includes(c.id));
for(const id of wanted)if(!corridors.some(c=>c.id===id))throw Error('Missing baked corridor '+id);
const w={...world,corridors};
const bytes=fs.readFileSync(process.env.MOUNTAIN_BUDGET_TERRAIN??path.join(root,'public/horizon/terrain/horizon-geo-1.bin'));
const field=m.decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'full');
const ground=(x,z)=>m.sampleTerrain(field,x,z);
const district=(p)=>m.districtAt(p[0],p[2],1);
const ids=world.districts.map(d=>d.id);
const plantPositions=corridors.flatMap(c=>c.planting.flatMap(g=>g.items.map(i=>i.at)));
const sha=value=>createHash('sha256').update(value).digest('hex');
const out={worldSha256:sha(worldBytes),terrainSha256:sha(bytes),runtimeBundleSha256:sha(fs.readFileSync(bundle)),auditSha256:sha(fs.readFileSync(path.join(root,'scripts/horizon/mountain-budgets.mjs'))),worldMtime:fs.statSync(worldPath).mtime.toISOString(),corridors:corridors.map(c=>({id:c.id,lamps:c.lamps.length,stops:c.stops.length,plants:c.planting.reduce((n,g)=>n+g.items.length,0)})),notes:[
  'Counts actual runtime builders without WebGL; not a GPU timing or screen acceptance test. An offline adapter retains the exact crownOf source helper and forbids unrelated native planting generation.',
  'Road furniture includes all district-resident detail. Halo triangles are allocated by actual head district; one shared halo draw for the whole resident chain, charged once globally.',
  'Plant groups are kept whole before lite selection. Capacity is an upper bound with every selected plant resident; sampled is a measured peak over every plant position plus station samples, in four seasons. Distance hysteresis may retain a larger subset on other trajectories, so use capacity for the gate.',
  'Ground is the baked Horizon terrain lattice. Existing native supported floors already have existingFloor=true; no native geometry build is imported. This budget probe does not validate furniture support.',
  'Triangle totals cover corridor art, new corridor planting and halos, excluding unchanged native road/region geometry, terrain, shadows rendered in additional passes, and unrelated corridors.'
],results:{}};
for(const theme of ['classic','taylor','newfoundland'])for(const tier of ['full','lite']){
 const art=m.createCorridorArt(w,{tier,theme,ground});art.prebuild(ids);const a=art.stats();
 const heads=art.lampHeads();const haloByDistrict={};for(const h of heads){const d=district(h.head);haloByDistrict[d]=(haloByDistrict[d]??0)+2;}
 const result={districts:{},globalHaloDrawCalls:heads.length?1:0,totalHaloTriangles:heads.length*2};
 for(const d of ids){
  const positions=plantPositions.filter(p=>district(p)===d);
  const samples=[...positions,...corridors.flatMap(c=>c.stations.filter((s,i)=>i%12===0&&district(s.at)===d).map(s=>s.at))];
  let capacityTriangles=0,capacityDrawCalls=0,sampledTriangles=0,sampledDrawCalls=0,capacitySeason='',sampledSeason='',capacityLayers=[];
  // Union actual resident instance matrices over every plant root. Every kept plant/layer becomes active at
  // its own root; identical matrices retain their simultaneous multiplicity. This measures district capacity
  // without filtering source groups before liteKeep or changing runtime radii.
  for(const season of ['spring','summer','autumn','winter']){
   const planting=m.createCorridorPlanting(w,{tier,theme,season});const camera=new m.PerspectiveCamera();
   const layers=new Map();
   for(const p of samples){camera.position.set(p[0],p[1]+8,p[2]);planting.update(camera,new Set([d]));const st=planting.stats();
    if(st.triangles>sampledTriangles){sampledTriangles=st.triangles;sampledSeason=season;}sampledDrawCalls=Math.max(sampledDrawCalls,st.drawCalls);
    planting.group.traverse(o=>{if(!o.isInstancedMesh||!o.count)return;
     let layer=layers.get(o.name);if(!layer){const g=o.geometry;layer={triangles:(g.index?g.index.count:g.getAttribute('position').count)/3,matrices:new Map()};layers.set(o.name,layer);}
     const local=new Map();for(let i=0;i<o.count;i++){const key=Array.from(o.instanceMatrix.array.slice(i*16,i*16+16)).join(',');local.set(key,(local.get(key)??0)+1);}
     for(const [key,n]of local)layer.matrices.set(key,Math.max(layer.matrices.get(key)??0,n));
    });
   }
   const n=[...layers.values()].reduce((sum,l)=>sum+l.triangles*[...l.matrices.values()].reduce((a,b)=>a+b,0),0);if(n>capacityTriangles){capacityTriangles=n;capacitySeason=season;capacityLayers=[...layers].map(([name,l])=>({name,trianglesEach:l.triangles,count:[...l.matrices.values()].reduce((a,b)=>a+b,0)}));}capacityDrawCalls=Math.max(capacityDrawCalls,layers.size);
   planting.dispose();
  }
  const furniture=a.districts[d]??{triangles:0,drawCalls:0,instances:0};const halos=haloByDistrict[d]??0;
  if(!furniture.triangles&&!sampledTriangles&&!halos)continue;
  result.districts[d]={furniture,plants:{sampledTriangles,sampledDrawCalls,sampledSeason,capacityTriangles,capacityDrawCalls,capacitySeason,capacityLayers,samples:samples.length},haloTriangles:halos,capacityTotalTriangles:furniture.triangles+capacityTriangles+halos,capacityTotalDrawCallsExcludingSharedHalo:furniture.drawCalls+capacityDrawCalls,sampledTotalTriangles:furniture.triangles+sampledTriangles+halos,sampledTotalDrawCallsExcludingSharedHalo:furniture.drawCalls+sampledDrawCalls};
 }
 out.results[theme+'.'+tier]=result;art.dispose();
}
console.log(JSON.stringify(out,null,2));
