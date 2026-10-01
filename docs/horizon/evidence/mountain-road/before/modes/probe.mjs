import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const ROOT=process.argv[2]||'/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book';
const OUT='/tmp/mountain-modes-probe';
process.chdir(ROOT);
const {build,transform}=createRequire(resolve(ROOT,'package.json'))('esbuild');
const exports=[
 ['parseHorizonDefinition','src/house/world/horizonAssets.ts'],['decodeTerrainAsset','src/harbour/horizon/land/terrain/asset.ts'],['sampleTerrain','src/harbour/horizon/land/terrain/index.ts'],['createHorizonGeography,HORIZON_WALKABLE_DEGREES','src/harbour/horizon/runtime/geography.ts'],['createMountainV2Region,terraceBedExclusion','src/harbour/horizon/regions/mountainV2/index.ts'],['createBoardController','src/harbour/horizon/movers/board/controller.ts'],['createBicycleController','src/harbour/horizon/movers/bicycle/controller.ts'],['HORIZON_MANIFEST','src/harbour/horizon/world/manifest.ts'],['bedPath,pointAt,progressOf,bendRadius','src/harbour/horizon/movers/board/situations.ts']
];
const bundle=await build({stdin:{contents:exports.map(([names,file])=>`export {${names}} from './${file}';`).join('\n'),resolveDir:ROOT,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error',nodePaths:[resolve(ROOT,'node_modules')],loader:{'.png':'empty','.jpg':'empty','.svg':'empty','.css':'empty','.glb':'empty','.wav':'empty','.mp3':'empty'}});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const bytes=readFileSync(resolve(ROOT,'public/horizon/world/horizon-geo-1.json.gz')), terrain=readFileSync(resolve(ROOT,'public/horizon/terrain/horizon-geo-1.bin')), ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const world=api.parseHorizonDefinition(ab(bytes)),field=api.decodeTerrainAsset(ab(terrain),'full');
const g=api.createHorizonGeography(field,{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]});
g.addDynamic(api.createMountainV2Region({horizonGround:(x,z)=>api.sampleTerrain(field,x,z),yield:api.terraceBedExclusion(world.beds),terrainStep:field.step}).provider);
const deps={world,geography:{...g,cameraBlocked:undefined},manifest:api.HORIZON_MANIFEST,reducedMotion:false,calm:false,tier:'full'};
const source=readFileSync(resolve(ROOT,'src/harbour/horizon/runtime/index.ts'),'utf8');
const moveSource=source.slice(source.indexOf('  function move(dx:number'),source.indexOf('  let emote:',source.indexOf('  function move(dx:number')));
if(!moveSource.includes('return moved;'))throw Error('walking source extraction failed');
const compiled=await transform(`export function walker(body,geography,world,HORIZON_WALKABLE_DEGREES){let held=false,leftSupport=false,velocityY=0,swimming=false,lastMovementBlocker=null;const gateOpen=()=>true;const waterLevel=(x,z,y)=>geography.waterLevel(x,z,y);${moveSource}return {move,report:()=>({held,leftSupport,lastMovementBlocker})}}`,{loader:'ts',format:'esm'});
writeFileSync(OUT+'/walker-extracted.mjs',compiled.code);
const {walker}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const road=world.beds.find(b=>b.id==='mountainV2.road'),v03=world.beds.find(b=>b.id==='V03');
const data=JSON.parse(readFileSync(resolve(ROOT,'src/harbour/horizon/land/mountainV2/v2-data.json'),'utf8'));
const course=data.course.points, foot=road.points[0];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const nearest=(pts,p)=>pts.reduce((a,q,i)=>dist(q,p)<dist(pts[a],p)?i:a,0);
const vi=dist(v03.points[0],foot)<dist(v03.points.at(-1),foot)?0:v03.points.length-1;
const roadward=vi===0?[...v03.points].reverse():v03.points;
const end=roadward.at(-1), ci=nearest(course,end),fi=nearest(course,foot);
const lane=[end,...course.slice(fi,ci).reverse(),foot].filter((p,i,arr)=>i===0||dist(p,arr[i-1])>.001);
const all=[...roadward,...lane.slice(1),...road.points.slice(1)];
const walks=world.beds.filter(b=>b.kind==='walk'||b.profile==='walk').filter(b=>b.id.includes('crown')||b.id.includes('promenade')||b.id.toLowerCase().includes('year'));
console.log('walks',walks.map(b=>[b.id,b.points.length]));
const routes=[{id:'full-V03-lane-mountain-road',points:all,kind:'chain'},{id:'V03',points:roadward,kind:'reach'},{id:'v2-lane-course-link',points:lane,kind:'reach'},{id:'mountainV2.road',points:road.points,kind:'reach'}];
for(const b of walks){
 if(b.id.toLowerCase().includes('year')){
  // Separate contiguous mountain reaches only; no chords across omitted parts of the Year Walk.
  let run=[];let n=0; for(const p of [...b.points,null]){if(p&&p[0]>1150&&p[0]<1470&&p[2]>440&&p[2]<744)run.push(p);else{if(run.length>1)routes.push({id:b.id+' mountain reach '+(++n),points:run,kind:'footway'});run=[];}}
 }else routes.push({id:b.id,points:b.points,kind:'footway'});
}
writeFileSync(OUT+'/routes.json',JSON.stringify({join:{V03endpoint:end,courseIndex:ci,footIndex:fi,courseNearest:course[ci],gap:dist(end,course[ci])},routes},null,2));
const results=[];
function run(route,dir,mode){
 const points=dir==='forward'?route.points:[...route.points].reverse(),path=api.bedPath({points}),start=api.pointAt(path,0.5),dt=1/60;
 const r={route:route.id,routeKind:route.kind,direction:dir,mode,attemptedDistanceM:path.length-.5,completedDistanceM:0,travelM:0,elapsedS:0,completed:false,reason:'timeout',maxDeviationM:0,airborneFrames:0,offbedFrames:0,bails:0,contacts:{},events:[],samples:[]};
 let body={x:start.x,y:start.y,z:start.z,yaw:start.heading},c=null,w=null;
 if(mode==='walking'){const surface=g.surface(body.x,body.z,body.y,.48);if(surface)body.y=surface.y;w=walker(body,g,world,api.HORIZON_WALKABLE_DEGREES);}else{c=(mode==='bicycle'?api.createBicycleController:api.createBoardController)(deps);c.place({x:start.x,y:start.y,z:start.z,heading:start.heading,speed:0});}
 let d=.5,checkpoint=.5,stall=0,prev=[body.x,body.y,body.z],lastContact=null;
 const limit=Math.min(1500,path.length/1.0+60);
 for(let frame=0;frame<limit/dt;frame++){
  const st=c?.state(),p=st?st.p:[body.x,body.y,body.z],pr=api.progressOf(path,p[0],p[2],d,20);d=Math.max(d,pr.d);r.maxDeviationM=Math.max(r.maxDeviationM,pr.off);
  r.completedDistanceM=Math.max(0,d-.5);r.elapsedS=frame*dt;
  if(d>=path.length-.5&&pr.off<1){r.completed=true;r.reason='end';break;}
  if(d>checkpoint+.2){checkpoint=d;stall=0;}else stall+=dt;
  if(stall>5){r.reason='stalled-no-progress-5s';break;}
  if(pr.off>8){r.reason='left-route-over-8m';break;}
  const speed=st?Math.hypot(...st.v):api.HORIZON_MANIFEST.speeds_ms.walk,L=mode==='walking'?.8:clamp(1.6+.3*speed,2,5),target=api.pointAt(path,pr.d+L),dx=target.x-p[0],dz=target.z-p[2];
  if(c){
   const P=c.profile,hs=Math.hypot(st.v[0],st.v[2]),travel=hs>1?Math.atan2(st.v[0],st.v[2]):st.heading+(st.lead===1?0:Math.PI),e=wrap(Math.atan2(dx,dz)-travel),R=Math.max(P.steer.radius0+P.steer.radiusV*speed,speed*speed/(P.grip.steerLimit*P.grip.roll));
   const steer=clamp(-2*Math.sin(e)*R/L*1.2,-1,1),radius=api.bendRadius(path,pr.d+3,3),allowed=clamp(Math.min(4,(radius/1.5-P.steer.radius0)/P.steer.radiusV,Math.sqrt(P.grip.roll*.6*radius)),1.3,4);
   const input={steer,forward:speed>allowed+.4?-1:speed<allowed-.2?1:0,jump:false,sprint:false,crouch:0,accept:false,look:{dx:0,dy:0}};
   const f=c.update(dt,input);for(const ev of f.events){r.events.push({atS:r.elapsedS,distanceM:d,kind:ev,p:[...c.state().p]});if(ev==='bail')r.bails++;}
   if(!c.state().contact.on)r.airborneFrames++;if(!c.state().contact.legal)r.offbedFrames++;
   if(f.events.includes('fadeBack')){r.reason='automatic-fadeBack-reset';break;}if(f.events.includes('bail')){r.reason='bail';break;}
  }else{
   const l=Math.hypot(dx,dz),pace=Math.min(l,api.HORIZON_MANIFEST.speeds_ms.walk*dt);w.move(dx/l*pace,dz/l*pace,dt);
   const report=w.report(),floor=g.surface(body.x,body.z,body.y,.02),wet=g.waterLevel(body.x,body.z,body.y);
   if(report.leftSupport||!floor||body.y-floor.y>.05){r.airborneFrames++;r.reason='walking-airborne-handoff';break;}
   if(wet!==null&&body.y<=wet-.3){r.reason='walking-water';break;}
   if(report.lastMovementBlocker)r.walkBlocker=report.lastMovementBlocker;
  }
  const next=c?c.state().p:[body.x,body.y,body.z];r.travelM+=Math.hypot(next[0]-prev[0],next[2]-prev[2]);prev=[...next];
  const hit=g.contact(next[0],next[2],next[1],c?c.profile.contact.width/2:.3);if(hit){r.contacts[hit.id]=(r.contacts[hit.id]||0)+1;if(lastContact!==hit.id)r.events.push({atS:r.elapsedS,distanceM:d,kind:'contact',id:hit.id,p:[...next]});}lastContact=hit?.id;
  if(frame%60===0)r.samples.push({t:r.elapsedS,d:d-.5,p:[...next],speed,off:pr.off,legal:c?.state().contact.legal});
 }
 r.finalPosition=c?[...c.state().p]:[body.x,body.y,body.z];r.surface=g.surface(r.finalPosition[0],r.finalPosition[2],r.finalPosition[1],.5);r.blocker=g.blocker(r.finalPosition[0],r.finalPosition[2],r.finalPosition[1],.3);
 c?.dispose();return r;
}
const report={createdAt:new Date().toISOString(),head:execFileSync('git',['-C',ROOT,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),worldSha256:createHash('sha256').update(bytes).digest('hex'),terrainSha256:createHash('sha256').update(terrain).digest('hex'),method:'real unmodified bicycle and Horizon board controllers; exact extracted walking runtime move() with full terrain, baked solids, always-active Mountain region; inputs only after one initial placement per attempt',limits:['walking stops at first airborne handoff (no parachute continuation)','scripted pursuit is not skilled human acceptance; brake/sliding driver can cause avoidable deviations','board profile legal beds are skate/park/pad, bicycle road/trail/pad; footway may deliberately be illegal','all reaches are separate initial placements and never count as full uninterrupted chain','0.5 m omitted at each endpoint for initial pose and end tolerance','no assist, pops, snaps, retries or restart within an attempt','camera collision callback omitted for headless performance; all body collision geography unchanged; rendering/streaming/region readiness and device behavior untested'],results};
for(const route of routes)for(const dir of ['forward','reverse'])for(const mode of ['bicycle','board','walking']){const r=run(route,dir,mode);results.push(r);console.log(r.route,dir,mode,r.reason,r.completedDistanceM.toFixed(2)+'/'+r.attemptedDistanceM.toFixed(2),r.finalPosition);writeFileSync(OUT+'/results.json',JSON.stringify(report,null,2));}
