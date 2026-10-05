import {currentProjectionFinishReached} from './mountain-audit-telemetry.mjs';
import {walkingClearanceAim} from './walking-clearance-aim.mjs';
// Current shared Mountain Road chain and new link with the real bicycle and extracted walking runtime. Optional --registry-board retains the separate legacy legal-bed profile.
import {mountainFootwayRoutes} from './mountain-footway-routes.mjs';
import {routeSpeedPlan} from './route-speed-plan.mjs';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const ROOT=resolve(process.argv[2]||process.cwd());
const OUT=resolve(process.argv[3]||'docs/horizon/evidence/mountain-road/after/modes');mkdirSync(OUT,{recursive:true});
process.chdir(ROOT);
const {build,transform}=createRequire(resolve(ROOT,'package.json'))('esbuild');
const exports=[
 ['restoreHorizonPosition,HORIZON_RESTORE_TOLERANCE','src/harbour/horizon/runtime/savedPosition.ts'],['HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD','src/worldGeography.ts'],
 ['mountainRoadChain','src/harbour/horizon/land/corridor/chain.ts'],
 ['parseHorizonDefinition','src/house/world/horizonAssets.ts'],['decodeTerrainAsset','src/harbour/horizon/land/terrain/asset.ts'],['sampleTerrain','src/harbour/horizon/land/terrain/index.ts'],['createHorizonGeography,HORIZON_WALKABLE_DEGREES','src/harbour/horizon/runtime/geography.ts'],['walkMove,horizonWalkWorld','src/harbour/horizon/runtime/walkSim.ts'],['createMountainV2Region,terraceBedExclusion,mouthExclusion','src/harbour/horizon/regions/mountainV2/index.ts'],['createBoardController','src/harbour/horizon/movers/board/controller.ts'],['createBicycleController','src/harbour/horizon/movers/bicycle/controller.ts'],['HORIZON_MANIFEST','src/harbour/horizon/world/manifest.ts'],['bedPath,pointAt,progressOf,bendRadius','src/harbour/horizon/movers/board/situations.ts']
];
const bundle=await build({stdin:{contents:exports.map(([names,file])=>`export {${names}} from './${file}';`).join('\n'),resolveDir:ROOT,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error',nodePaths:[resolve(ROOT,'node_modules')],loader:{'.png':'empty','.jpg':'empty','.svg':'empty','.css':'empty','.glb':'empty','.wav':'empty','.mp3':'empty'}});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const bytes=readFileSync(resolve(ROOT,'public/horizon/world/horizon-geo-1.json.gz')), terrain=readFileSync(resolve(ROOT,'public/horizon/terrain/horizon-geo-1.bin')), ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const world=api.parseHorizonDefinition(ab(bytes)),field=api.decodeTerrainAsset(ab(terrain),'full');
const g=api.createHorizonGeography(field,{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]});
g.addDynamic(api.createMountainV2Region({walkingJoinSolids:world.geometry.solids,horizonGround:(x,z)=>api.sampleTerrain(field,x,z),yield:api.terraceBedExclusion(world.collision.beds),exclude:api.mouthExclusion(world.collision.mouths),terrainStep:field.step}).provider);
const deps={world,geography:{...g,cameraBlocked:undefined},manifest:api.HORIZON_MANIFEST,reducedMotion:false,calm:false,tier:'full'};
const source=readFileSync(resolve(ROOT,'src/harbour/horizon/runtime/index.ts'),'utf8');
const moveSource=source.slice(source.indexOf('  function move(dx:number'),source.indexOf('  let emote:',source.indexOf('  function move(dx:number')));
if(!moveSource.includes('return moved;'))throw Error('walking source extraction failed');
const compiled=await transform(`export function walker(body,geography,world,HORIZON_WALKABLE_DEGREES){let held=false,leftSupport=false,velocityY=0,swimming=false,lastMovementBlocker=null;const gateOpen=()=>true;const waterLevel=(x,z,y)=>geography.waterLevel(x,z,y);${moveSource}return {move,report:()=>({held,leftSupport,lastMovementBlocker})}}`,{loader:'ts',format:'esm'});
writeFileSync(OUT+'/walker-extracted.mjs',compiled.code);
// The runtime move() binds walkSim's collision step; the extracted body reads walkMove/horizonWalkWorld from globals set here.
globalThis.walkMove=api.walkMove;globalThis.horizonWalkWorld=api.horizonWalkWorld;
const {walker}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const chain=world.roadChains?.find(c=>c.id==='mountain-road')??api.mountainRoadChain(world.beds);
if(!chain)throw new Error('Missing Mountain Road chain');
const roadRoutes=[{id:chain.id,points:chain.points,kind:'chain'},...chain.parts.map(part=>({id:part.id,kind:'reach',points:chain.points.filter((_,i)=>chain.widths[i].s>=part.from-1e-6&&chain.widths[i].s<=part.to+1e-6)})),...world.beds.filter(b=>b.id==='spur stillwater').map(b=>({id:b.id,kind:'link',points:b.points}))];
const footways=process.argv.includes('--footways'),walkingClearance=process.argv.includes('--walk-clearance');
if(walkingClearance&&!footways)throw new Error('--walk-clearance is an optional footway walking driver only');
let baseline=null,baselineIdentity=null,nativeSnapshot=null,baselineNativeSnapshot=null,nativeSnapshotIdentity=null;
if(footways){try{const ref=process.env.MOUNTAIN_BASELINE_REF??'324cd5f246ab295af5cf64d553ebf78fad57f7b5',file=process.env.MOUNTAIN_BASELINE_WORLD,raw=file?readFileSync(resolve(file)):execFileSync('git',['show',ref+':public/horizon/world/horizon-geo-1.json'],{maxBuffer:64*1024*1024});baseline=JSON.parse(raw);baselineIdentity={source:file??ref,sha256:createHash('sha256').update(raw).digest('hex')};}catch(error){throw new Error('Footway inventory requires a readable baseline world: '+error.message);}}
if(footways){
 const sourcePath='src/harbour/horizon/land/mountainV2/v2-data.json',raw=readFileSync(resolve(ROOT,sourcePath));
 nativeSnapshot=JSON.parse(raw);nativeSnapshotIdentity={source:sourcePath,sha256:createHash('sha256').update(raw).digest('hex'),walks:nativeSnapshot.nativePlanning?.walks?.length??0,baseline:null};
 try{
  const explicit=process.env.MOUNTAIN_BASELINE_NATIVE,ref=process.env.MOUNTAIN_BASELINE_REF??'324cd5f246ab295af5cf64d553ebf78fad57f7b5';
  // A custom baseline world must not be silently paired with a different git snapshot.
  if(explicit||!process.env.MOUNTAIN_BASELINE_WORLD){
   const old=explicit?readFileSync(resolve(explicit)):execFileSync('git',['show',ref+':'+sourcePath],{maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
   baselineNativeSnapshot=JSON.parse(old);nativeSnapshotIdentity.baseline={source:explicit??ref+':'+sourcePath,sha256:createHash('sha256').update(old).digest('hex'),walks:baselineNativeSnapshot.nativePlanning?.walks?.length??0};
  }
 }catch(error){nativeSnapshotIdentity.baselineUnavailable=error.message;}
}
const routes=footways?mountainFootwayRoutes(world,baseline,nativeSnapshot,baselineNativeSnapshot):roadRoutes;
writeFileSync(OUT+'/routes.json',JSON.stringify(routes,null,2));
if(footways)writeFileSync(OUT+'/footway-inventory.json',JSON.stringify({baseline:baselineIdentity,nativeSnapshot:nativeSnapshotIdentity,limits:['Independent contiguous route attempts; no full Year Walk or whole-chain completion claim.','January entries deliberately overlap Year Walk clips.','All named lines, local approaches and exported native paths are retained even when walking fails; water, unsupported-ground and stalled outcomes remain failures.'],routes:routes.map(({points,...r})=>r)},null,2));
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceProof={telemetryHelperSha256:sha(readFileSync(resolve(ROOT,'scripts/horizon/mountain-audit-telemetry.mjs'))),runtimeBundleSha256:sha(bundle.outputFiles[0].text),walkingRuntimeSha256:sha(compiled.code),auditSha256:sha(readFileSync(resolve(ROOT,'scripts/horizon/mountain-modes-audit.mjs'))),walkingClearanceSha256:sha(readFileSync(resolve(ROOT,'scripts/horizon/walking-clearance-aim.mjs'))),walkingClearance};
// Alternate ordinary-input policy; default evidence remains reproducible. No route-point exceptions.
const cautiousBicycle=process.argv.includes('--cautious-bicycle');
const results=[];
function run(route,dir,mode){
 const points=dir==='forward'?route.points:[...route.points].reverse(),validPoints=points.length>1&&points.every(p=>p.length===3&&p.every(Number.isFinite)),path=validPoints?api.bedPath({points}):{length:0},dt=1/60;
 const r={driverPolicy:mode==='bicycle'?(cautiousBicycle?'cautious-2.2-short-lookahead-hysteresis':'original-4-adaptive-lookahead'):null,restarts:0,route:route.id,routeKind:route.kind,...(footways?{sourceBedId:route.sourceBedId,sourcePathId:route.sourcePathId??null,sourceGeometry:route.sourceGeometry??null,sourceWidthM:route.sourceWidthM??null,sourceRange:route.sourceRange,routeStart:route.start,routeEnd:route.end,attemptStart:points[0]??null,attemptEnd:points.at(-1)??null,scope:route.scope,baseline:route.baseline,independentAttempt:true}:{}),direction:dir,mode,attemptedDistanceM:Math.max(0,path.length-.5),completedDistanceM:0,travelM:0,elapsedS:0,completed:false,reason:'timeout',maxDeviationM:0,airborneFrames:0,offbedFrames:0,bails:0,contacts:{},events:[],samples:[]};
 if(!validPoints||path.length<=1){r.reason='walking-invalid-route';r.finalPosition=points[0]?[...points[0]]:null;return r;}
 const start=api.pointAt(path,0.5);
 let body={x:start.x,y:start.y,z:start.z,yaw:start.heading},c=null,w=null;
 if(mode==='walking'){
  // Use the actual runtime's same-revision initial placement. The former
  // unbounded lower-floor query could start a summit walk67m underground.
  // A fallback to another graph node is an invalid source start, never a ride.
  const authored=[body.x,body.y,body.z];let standValidated=false;
  const placed=api.restoreHorizonPosition({x:body.x,y:body.y,z:body.z,yaw:body.yaw,place:'court',world:api.HORIZON_PRESENCE_WORLD,geo:api.HORIZON_GEOGRAPHY},world.pathGraph,g.ground,(x,z,y)=>{
   const at=g.surface(x,z,y+.5,api.HORIZON_RESTORE_TOLERANCE);
   if(at&&at.slope<=api.HORIZON_WALKABLE_DEGREES&&!g.submerged(x,z,at.y)&&!g.blocked(x,z,at.y)){standValidated=true;return{standY:at.y};}return null;
  });
  const sameXZ=Math.hypot(placed.x-body.x,placed.z-body.z)<1e-8,delta=placed.y-body.y;
  r.startPlacement={policy:'actual-same-revision-restore',authored,placed,sameXZ,standValidated,heightDeltaM:delta,restoreToleranceM:api.HORIZON_RESTORE_TOLERANCE};
  if(!standValidated||!sameXZ||!Number.isFinite(delta)||Math.abs(delta)>api.HORIZON_RESTORE_TOLERANCE){r.reason='walking-runtime-start-unavailable-at-source';r.finalPosition=authored;return r;}
  r.initialSupport={source:authored,selected:g.surface(body.x,body.z,placed.y,0),selectedDeltaM:delta};
  body.y=placed.y;w=walker(body,g,world,api.HORIZON_WALKABLE_DEGREES);
 }else{c=(mode==='bicycle'?api.createBicycleController:api.createBoardController)(deps);c.place({x:start.x,y:start.y,z:start.z,heading:start.heading,speed:0});}
 // Bicycle brakes deliver 4 m/s² on flat ground; a 1 m/s² planning budget leaves
 // room for downhill gravity and ordinary input latency. It is a driver assumption,
 // not changed tuning or a guarantee of controller completion.
 const speedPlan=mode==='bicycle'?routeSpeedPlan(path.length,s=>{
  const P=c.profile,radius=api.bendRadius(path,s,3);
  const cap=cautiousBicycle?2.2:4;
  return clamp(Math.min(cap,(radius/1.5-P.steer.radius0)/P.steer.radiusV,Math.sqrt(P.grip.roll*.6*radius)),cautiousBicycle?1.1:1.3,cap);
 }):null;
 if(speedPlan)r.speedPlan={kind:'backward-braking',stepM:speedPlan.step,decelerationMs2:speedPlan.deceleration};
 let braking=false;
 let d=.5,checkpoint=.5,stall=0,prev=[body.x,body.y,body.z],lastContact=null,walkingPlan=null;
 if(walkingClearance)r.walkingDriver={kind:'source-width-clearance',bodyRadiusM:.3,edgeMarginM:.05,lookaheadM:3,planningHz:10};
 const limit=Math.min(1500,path.length/1.0+60);
 for(let frame=0;frame<limit/dt;frame++){
  const st=c?.state(),p=st?st.p:[body.x,body.y,body.z],pr=api.progressOf(path,p[0],p[2],d,20);d=Math.max(d,pr.d);r.maxDeviationM=Math.max(r.maxDeviationM,pr.off);
  r.completedDistanceM=Math.max(0,d-.5);r.elapsedS=frame*dt;
  if(currentProjectionFinishReached(pr,path.length)){r.completed=true;r.reason='end';break;}
  if(d>checkpoint+.2){checkpoint=d;stall=0;}else stall+=dt;
  if(stall>5){r.reason='stalled-no-progress-5s';break;}
  if(pr.off>8){r.reason='left-route-over-8m';break;}
  const speed=st?Math.hypot(...st.v):api.HORIZON_MANIFEST.speeds_ms.walk,L=mode==='walking'?.8:mode==='bicycle'&&cautiousBicycle?clamp(1+.3*speed,1.2,2.2):clamp(1.6+.3*speed,2,5);
  let target=api.pointAt(path,pr.d+L);
  if(!c&&walkingClearance){
   if(frame%6===0){
    const width=route.sourceWidthM??world.collision.beds.find(b=>b.id===(route.sourceBedId??route.id))?.width;
    walkingPlan=width?walkingClearanceAim({position:p,progress:pr.d,pointAt:s=>api.pointAt(path,s),halfWidth:width/2,geography:g,maxSlope:api.HORIZON_WALKABLE_DEGREES}):null;
    r.walkingPlanQueries=(r.walkingPlanQueries??0)+1;
   }
   if(walkingPlan){target=walkingPlan.target;r.steeringFrames=(r.steeringFrames??0)+(Math.abs(walkingPlan.offset)>.01?1:0);r.maxPlannedOffsetM=Math.max(r.maxPlannedOffsetM??0,Math.abs(walkingPlan.offset));}
  }
  const dx=target.x-p[0],dz=target.z-p[2];
  if(c){
   const P=c.profile,hs=Math.hypot(st.v[0],st.v[2]),travel=hs>1?Math.atan2(st.v[0],st.v[2]):st.heading+(st.lead===1?0:Math.PI),e=wrap(Math.atan2(dx,dz)-travel),R=Math.max(P.steer.radius0+P.steer.radiusV*speed,speed*speed/(P.grip.steerLimit*P.grip.roll));
   const steer=clamp(-2*Math.sin(e)*R/L*1.2,-1,1),radius=api.bendRadius(path,pr.d+3,3),allowed=speedPlan?speedPlan.at(pr.d+.5):clamp(Math.min(4,(radius/1.5-P.steer.radius0)/P.steer.radiusV,Math.sqrt(P.grip.roll*.6*radius)),1.3,4);
   if(mode==='bicycle'&&cautiousBicycle){if(braking&&speed<allowed-.15)braking=false;else if(!braking&&speed>allowed+.1)braking=true;}
   const forward=mode==='bicycle'&&cautiousBicycle?(braking?-1:speed<allowed-.1?1:0):(speed>allowed+.4?-1:speed<allowed-.2?1:0);
   const input={steer,forward,jump:false,sprint:false,crouch:0,accept:false,look:{dx:0,dy:0}};
   const f=c.update(dt,input);for(const ev of f.events){r.events.push({atS:r.elapsedS,distanceM:d,kind:ev,p:[...c.state().p]});if(ev==='bail')r.bails++;}
   if(!c.state().contact.on)r.airborneFrames++;if(!c.state().contact.legal)r.offbedFrames++;
   if(f.events.includes('fadeBack')){r.restarts++;r.reason='automatic-fadeBack-reset';break;}if(f.events.includes('bail')){r.reason='bail';break;}
  }else{
   const l=Math.hypot(dx,dz);if(!Number.isFinite(l)||l<1e-9){r.reason='walking-invalid-target';break;}const pace=Math.min(l,api.HORIZON_MANIFEST.speeds_ms.walk*dt);w.move(dx/l*pace,dz/l*pace,dt);
   const width=route.sourceWidthM;
   if(Number.isFinite(width)){
    const actual=api.progressOf(path,body.x,body.z,d,20),excess=actual.off+.3-width/2;r.footprintChecks=(r.footprintChecks??0)+1;
    if(excess>(r.maxPhysicalFootprintExcessM??-Infinity)){r.maxPhysicalFootprintExcessM=excess;r.widestBodyWitness={p:[body.x,body.y,body.z],progress:actual.d,centrelineDistanceM:actual.off,bodyRadiusM:.3,sourceWidthM:width};}
   }
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
const report={inventoryMode:footways?'footways-independent':'road-chain',baseline:baselineIdentity,nativeSnapshot:nativeSnapshotIdentity,createdAt:new Date().toISOString(),head:execFileSync('git',['-C',ROOT,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),worldSha256:createHash('sha256').update(bytes).digest('hex'),terrainSha256:createHash('sha256').update(terrain).digest('hex'),method:'real unmodified bicycle and Horizon board controllers; exact extracted walking runtime move() with full terrain, baked solids, always-active Mountain region; inputs only after one initial placement per attempt',limits:['walking starts use actual runtime restoration at source XY; any graph-node relocation is rejected; movement is never rearmed','original legacy-start failures remain retained in the baseline evidence','walking stops at first airborne handoff (no parachute continuation)','scripted pursuit is not skilled human acceptance; brake/sliding driver can cause avoidable deviations','board profile legal beds are skate/park/pad, bicycle road/trail/pad; footway may deliberately be illegal','all reaches are separate initial placements and never count as full uninterrupted chain','0.5 m omitted at each endpoint for initial pose and end tolerance','no assist, pops, snaps, retries or restart within an attempt','camera collision callback omitted for headless performance; all body collision geography unchanged; rendering/streaming/region readiness and device behavior untested'],results};
report.sourceProof=sourceProof;
const modes=footways?['walking']:process.argv.includes('--registry-board')?['bicycle','board','walking']:['bicycle','walking'];
for(const route of routes.filter(r=>!process.env.MOUNTAIN_ROUTES||process.env.MOUNTAIN_ROUTES.split(',').includes(r.id)))for(const dir of ['forward','reverse'])for(const mode of modes){const r=run(route,dir,mode);results.push(r);console.log(r.route,dir,mode,r.reason,r.completedDistanceM.toFixed(2)+'/'+r.attemptedDistanceM.toFixed(2),r.finalPosition);writeFileSync(OUT+'/results.json',JSON.stringify(report,null,2));}
