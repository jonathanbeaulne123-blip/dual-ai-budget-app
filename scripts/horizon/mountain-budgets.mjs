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
await esbuild.build({stdin:{contents:`export {createCorridorArt} from './src/harbour/horizon/runtime/corridorArt.ts';export {createCorridorPlanting} from './src/harbour/horizon/runtime/corridorPlanting.ts';export {districtAt,useDefinitionDistricts} from './src/harbour/horizon/world/districts.ts';export {decodeTerrainAsset} from './src/harbour/horizon/land/terrain/asset.ts';export {sampleTerrain} from './src/harbour/horizon/land/terrain/index.ts';export {PerspectiveCamera,Scene} from 'three';export {createRoadLights} from './src/harbour/horizon/runtime/roadLights.ts';export {ROAD_LIGHTS} from './src/harbour/horizon/sky/night.ts';`,resolveDir:root,loader:'ts'},platform:'node',format:'esm',bundle:true,outfile:bundle,plugins:[{name:'pure-crown-budget-adapter',setup(build){build.onLoad({filter:/[/\\]mountain[/\\]planting\.ts$/},({path:file})=>{
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
const out={worldSha256:sha(worldBytes),terrainSha256:sha(bytes),runtimeBundleSha256:sha(fs.readFileSync(bundle)),auditSha256:sha(fs.readFileSync(new URL(import.meta.url))),worldMtime:fs.statSync(worldPath).mtime.toISOString(),corridors:corridors.map(c=>({id:c.id,lamps:c.lamps.length,stops:c.stops.length,plants:c.planting.reduce((n,g)=>n+g.items.length,0)})),notes:[
 'Actual runtime builders without WebGL: submitted base-pass geometry counts, not GPU timing, rendered pixels, shadows or extra render passes. The crown adapter prevents unrelated terrain generation.',
 'Art uses externalLampHalos=true, exactly as live runtime. Road lighting uses the full world and all themed retained lampAnchors, so unrelated lamps and door/threshold cards compete under the real shared cap. Only selected corridor lamps are attributed to district additions.',
 'Night samples every selected lamp pool and route station every12 samples plus endpoints, at rider eye1.65m in both directions. Records sampled peaks and witnesses; this finite set is not an exhaustive camera bound.',
 'Night capacity is a conservative upper bound from actual geometry buffers and each district lamp count under the shared cap. Two road night draws (glows and pools) are shared globally, not2 per lamp or physically2 per district. Per-district totals charging these2 are conservative attribution, never additive across districts.',
 'Plant capacity unions resident instance matrices at every plant root plus route/lamp samples in4 seasons. Sampled component maxima may occur at different viewpoints/seasons. Their sum is labelled an upper bound, not a measured simultaneous peak; hysteresis can retain larger subsets elsewhere.',
 'Pool grids use baked terrain to avoid a native source build. Their submitted topology/count is independent of conformed vertex heights; pool alpha/support correctness is not validated here. Real composed geography is still required for visual/support acceptance.',
 'The fixed6full/2lite point pool covers road lamps only. The inherited airport has5 independent night point lights; this script does not mount or count airport geometry, and does not claim a whole-scene6/2 cap.',
 'Triangle totals exclude baked corridor structural paint, unchanged native/terrain geometry and unselected corridor furniture. Use CORRIDOR_IDS=all for combined corridor furniture/plant additions; this script alone is not a whole-district renderer acceptance gate.'
],results:{}};
const key=p=>p.map(Math.fround).join(',');
const poseKey=p=>[...p.at,...p.direction].join(',');
const peak=(target,metric,value,witness)=>{if(value>(target[metric]??0)){target[metric]=value;target[metric+'Witness']=witness;}};
for(const theme of ['classic','taylor','newfoundland'])for(const tier of ['full','lite']){
 const art=m.createCorridorArt(w,{tier,theme,ground,externalLampHalos:true});art.prebuild(ids);const a=art.stats();
 // The full-world plan supplies live cap competition without building unrelated district geometry.
 const lightArt=m.createCorridorArt(world,{tier,theme,ground,externalLampHalos:true}),anchors=lightArt.lampAnchors();
 if(art.group.getObjectByName('horizon.corridorArt.halos'))throw Error('Live composition unexpectedly contains art halos');
 const selectedIds=new Set(art.lampAnchors().map(a=>a.id)),selectedAnchors=anchors.filter(a=>selectedIds.has(a.id));
 const selectedByDistrict=new Map(ids.map(d=>[d,selectedAnchors.filter(a=>district(a.at)===d)]));
 const poses=new Map();
 const addPose=(at,direction,label)=>{const p={at:[at[0],at[1]+1.65,at[2]],direction,label,district:district(at)};poses.set(poseKey(p),p);};
 for(const c of corridors){
  for(let i=0;i<c.stations.length;i++)if(i%12===0||i===c.stations.length-1){
   const s=c.stations[i],next=c.stations[Math.min(i+1,c.stations.length-1)],prev=c.stations[Math.max(0,i-1)];
   let dx=next.at[0]-prev.at[0],dz=next.at[2]-prev.at[2];if(Math.hypot(dx,dz)<1e-9){dx=1;dz=0;}const l=Math.hypot(dx,dz);
   for(const sign of[-1,1])addPose(s.at,[sign*dx/l,sign*dz/l],`${c.id}:station:${i}:${sign}`);
  }
 }
 for(const anchor of selectedAnchors)for(const sign of[-1,1])addPose(anchor.pool??anchor.at,[sign,0],`${anchor.id}:pool:${sign}`);
 const scene=new m.Scene(),lights=m.createRoadLights(scene,world,{tier,corridorAnchors:anchors,ground:(x,z)=>ground(x,z)});
 const glows=scene.getObjectByName('lightCards.roadGlows'),pools=scene.getObjectByName('lightCards.roadPools');
 if(!glows||!pools)throw Error('Road lighting mesh contract changed');
 const poolVertices=pools.geometry.getAttribute('position').count/glows.instanceMatrix.count,poolTrianglesEach=pools.geometry.index.count/glows.instanceMatrix.count/3;
 if(!Number.isInteger(poolVertices)||!Number.isInteger(poolTrianglesEach))throw Error('Road pool geometry allocation contract changed');
 // Resolve the same complete list as createRoadLights for geometric attribution. Fail rather than
 // misattribute a co-located lamp if the indistinguishable heads/pools belong to different owners.
 const owned=new Set(world.corridors.flatMap(c=>c.lamps.map(l=>l.id))),chosen=new Map(anchors.map(a=>[a.id,a]));
 const all=world.lights.filter(a=>!owned.has(a.id)||chosen.has(a.id)).map(a=>chosen.get(a.id)??a),have=new Set(all.map(a=>a.id));
 for(const anchor of anchors)if(!have.has(anchor.id)){all.push(anchor);have.add(anchor.id);}
 const byHead=new Map(),byPool=new Map();
 for(const anchor of all.filter(a=>Object.hasOwn(m.ROAD_LIGHTS.kinds,a.kind))){
  const owner=selectedIds.has(anchor.id)?district(anchor.at):null;
  for(const [map,k]of[[byHead,key(anchor.head??[anchor.at[0],anchor.at[1]+5.2,anchor.at[2]])],[byPool,key([(anchor.pool??anchor.at)[0],(anchor.pool??anchor.at)[2]])]]){
   if(map.has(k)&&map.get(k)!==owner)throw Error(`Ambiguous light geometry attribution at ${k}`);map.set(k,owner);
  }
 }
 const nightDistricts=Object.fromEntries(ids.map(d=>[d,{sampledTriangles:0,sampledDrawCalls:0,sampledGlowTriangles:0,sampledPoolTriangles:0}]));
 const night={poseCount:poses.size,cardCap:lights.stats().cap,poolTrianglesEach,roadPointLights:lights.lights.length,roadPointCap:m.ROAD_LIGHTS.pointLights[tier],capacitySharedDrawCalls:lights.stats().roadLamps?2:0,capacitySharedTriangles:Math.min(lights.stats().cap,lights.stats().roadLamps)*(2+poolTrianglesEach),sampledSharedDrawCalls:0,sampledSharedTriangles:0,sampledSelectedTriangles:0,sampledPointLightsLit:0,sampledTotalCards:0,sampledAnchorDrawCalls:0,sampledAnchorTriangles:0};
 if(night.roadPointLights!==(lights.stats().roadLamps?night.roadPointCap:0))throw Error('Road point-light cap violated');
 const camera=new m.PerspectiveCamera();let now=0;
 for(const pose of poses.values()){
  camera.position.set(...pose.at);camera.lookAt(pose.at[0]+pose.direction[0],pose.at[1],pose.at[2]+pose.direction[1]);camera.updateMatrixWorld(true);
  lights.refresh();let settled=false;
  // Settle only the bounded existing slot fade and per-pick pool-conform work. No wall-clock sleep.
  for(let i=0;i<80;i++){lights.update(camera,-12,now+=100,{at:pose.at});if(!lights.busy(now)){settled=true;break;}}
  if(!settled)throw Error(`Road lights failed to settle at ${pose.label}`);
  const st=lights.stats(),witness={label:pose.label,district:pose.district,eye:pose.at,direction:pose.direction};
  if(st.cards>st.cap||st.pointLightsLit>night.roadPointCap)throw Error('Live light-card or road-point cap violated');
  const attribution=Object.fromEntries(ids.map(d=>[d,{glow:0,pool:0}]));
  for(let i=0;i<glows.count;i++){
   const mat=glows.instanceMatrix.array,offset=i*16,k=key([mat[offset+12],mat[offset+13],mat[offset+14]]);
   if(!byHead.has(k))throw Error('Unmatched actual glow '+k);const owner=byHead.get(k);if(owner!==null)attribution[owner].glow+=2;
  }
  const poolCount=pools.geometry.drawRange.count/(poolTrianglesEach*3),position=pools.geometry.getAttribute('position').array;
  if(!Number.isInteger(poolCount))throw Error('Partial road pool draw contract changed');
  for(let i=0;i<poolCount;i++){
   const offset=i*poolVertices*3,k=key([position[offset],position[offset+2]]);
   if(!byPool.has(k))throw Error('Unmatched actual pool '+k);const owner=byPool.get(k);if(owner!==null)attribution[owner].pool+=poolTrianglesEach;
  }
  const globalDraws=Number(glows.count>0)+Number(poolCount>0),globalTriangles=glows.count*2+poolCount*poolTrianglesEach;
  if(st.poolTriangles!==poolCount*poolTrianglesEach)throw Error('Pool stats disagree with actual draw range');
  let selectedTriangles=0;
  for(const [d,count]of Object.entries(attribution)){
   const dest=nightDistricts[d],triangles=count.glow+count.pool;selectedTriangles+=triangles;
   peak(dest,'sampledTriangles',triangles,witness);peak(dest,'sampledDrawCalls',Number(count.glow>0)+Number(count.pool>0),witness);
   peak(dest,'sampledGlowTriangles',count.glow,witness);peak(dest,'sampledPoolTriangles',count.pool,witness);
  }
  let anchorDraws=0,anchorTriangles=0;
  for(const name of['lightCards.anchorPools','lightCards.beads']){const mesh=scene.getObjectByName(name);if(mesh.visible&&mesh.count){anchorDraws++;anchorTriangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3*mesh.count;}}
  for(const [metric,value]of Object.entries({sampledSharedDrawCalls:globalDraws,sampledSharedTriangles:globalTriangles,sampledSelectedTriangles:selectedTriangles,sampledPointLightsLit:st.pointLightsLit,sampledTotalCards:st.cards,sampledAnchorDrawCalls:anchorDraws,sampledAnchorTriangles:anchorTriangles}))peak(night,metric,value,witness);
 }
 lights.dispose();lightArt.dispose();
 const result={districts:{},sharedNight:night};
 for(const d of ids){
  const positions=plantPositions.filter(p=>district(p)===d),localPoses=[...poses.values()].filter(p=>p.district===d);
  const samples=[...new Map([...positions,...localPoses.map(p=>[p.at[0],p.at[1]-1.65,p.at[2]])].map(p=>[key(p),p])).values()];
  let capacityTriangles=0,capacityDrawCalls=0,sampledTriangles=0,sampledDrawCalls=0,capacitySeason='',sampledSeason='',capacityLayers=[];
  for(const season of ['spring','summer','autumn','winter']){
   const planting=m.createCorridorPlanting(w,{tier,theme,season});const camera=new m.PerspectiveCamera(),layers=new Map();
   for(const p of samples){camera.position.set(p[0],p[1]+1.65,p[2]);planting.update(camera,new Set([d]));const st=planting.stats();
    if(st.triangles>sampledTriangles){sampledTriangles=st.triangles;sampledSeason=season;}sampledDrawCalls=Math.max(sampledDrawCalls,st.drawCalls);
    for(const r of planting.activeRecords()){
     let layer=layers.get(r.batch);if(!layer){layer={records:new Map()};layers.set(r.batch,layer);}
     layer.records.set(r.id,{triangles:r.triangles,source:r.layer});
    }
   }
   const n=[...layers.values()].reduce((sum,l)=>sum+[...l.records.values()].reduce((a,b)=>a+b.triangles,0),0);if(n>capacityTriangles){capacityTriangles=n;capacitySeason=season;capacityLayers=[...layers].map(([name,l])=>({name,triangles:[...l.records.values()].reduce((a,b)=>a+b.triangles,0),count:l.records.size,sources:[...new Set([...l.records.values()].map(r=>r.source))]}));}capacityDrawCalls=Math.max(capacityDrawCalls,layers.size);
   planting.dispose();
  }
  const furniture=a.districts[d]??{triangles:0,drawCalls:0,instances:0},lampCount=selectedByDistrict.get(d).length,localNight=nightDistricts[d];
  const capacityNightCards=Math.min(lampCount,night.cardCap),capacityNightTriangles=capacityNightCards*(2+poolTrianglesEach),capacityNightDrawCalls=capacityNightCards?2:0;
  if(!furniture.triangles&&!capacityTriangles&&!lampCount)continue;
  result.districts[d]={furniture,plants:{sampledTriangles,sampledDrawCalls,sampledSeason,capacityTriangles,capacityDrawCalls,capacitySeason,capacityLayers,samples:samples.length},night:{...localNight,retainedFixtures:lampCount,capacityCards:capacityNightCards,capacityTriangles:capacityNightTriangles,capacitySharedDrawCallsCharged:capacityNightDrawCalls},capacityTotalTriangles:furniture.triangles+capacityTriangles+capacityNightTriangles,capacityTotalDrawCallsExcludingSharedNight:furniture.drawCalls+capacityDrawCalls,capacityTotalDrawCallsWithSharedNightCharged:furniture.drawCalls+capacityDrawCalls+capacityNightDrawCalls,sampledComponentPeakUpperBoundTriangles:furniture.triangles+sampledTriangles+localNight.sampledTriangles,sampledComponentPeakUpperBoundDrawCallsWithSharedNightCharged:furniture.drawCalls+sampledDrawCalls+localNight.sampledDrawCalls};
 }
 out.results[theme+'.'+tier]=result;art.dispose();
}
console.log(JSON.stringify(out,null,2));
