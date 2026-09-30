#!/usr/bin/env node
/** Native branch movement evidence. Run only after final source geometry is ready.
 * node scripts/horizon/mountain-native-landings-audit.mjs <checkout> <new-output-dir> --run
 * Optional --full-branches adds separate full-branch attempts (including unchanged skill rails).
 * Optional --skate-only omits direct native walking runtime. Never overwrites earlier evidence. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const ROOT=resolve(process.argv[2]||process.cwd()),OUT=resolve(process.argv[3]||'/tmp/mountain-native-branch-audit/results');
if(process.env.HEARTH_REBAKE==='1')throw Error('Audit refuses HEARTH_REBAKE: use the existing native terrain asset');
if(!process.argv.includes('--run'))throw Error('Prepared only: --run is required after final geometry is confirmed ready');
if(existsSync(OUT))throw Error('Choose a new output directory; prior evidence is immutable');
process.chdir(ROOT);mkdirSync(OUT,{recursive:true});
const {build}=createRequire(resolve(ROOT,'package.json'))('esbuild'),sha=b=>createHash('sha256').update(b).digest('hex');
const exports=[
 ['createSkateDriver,skateField','skate/driver.ts'],['SKATE_NO_INTENT','skate/contract.ts'],
 ['SKILL_BRANCHES,MOUNTAIN_COURSE_POINTS','mountain/course.ts'],['groundHeightAt','scene/ground.ts'],
 ['courtObstacles,pushOut,BODY_RADIUS','body/obstacles.ts'],
 ['createBodyState,stepBody,NO_INPUT','body/bodyModel.ts'],
];
const bundle=await build({stdin:{contents:exports.map(([n,p])=>`export {${n}} from './src/harbour/${p}';`).join('\n'),resolveDir:ROOT,loader:'ts'},bundle:true,platform:'node',format:'esm',metafile:true,write:false,logLevel:'error',nodePaths:[resolve(ROOT,'node_modules')],loader:{'.png':'empty','.jpg':'empty','.svg':'empty','.css':'empty','.glb':'empty','.wav':'empty','.mp3':'empty'}});
const sourceHashes={};for(const p of Object.keys(bundle.metafile.inputs).filter(p=>p.startsWith('src/')))sourceHashes[p]=sha(readFileSync(resolve(ROOT,p)));
const assets=['public/mountain/terrain/hearth-mountain-geo-2.bin'];for(const p of assets)if(existsSync(p))sourceHashes[p]=sha(readFileSync(p));
// Import after hashing its exact compiled source; geometry may have top-level asset reads.
const scratch=mkdtempSync(join(tmpdir(),'mountain-native-landings-'));
process.on('exit',()=>rmSync(scratch,{recursive:true,force:true}));
writeFileSync(resolve(scratch,'runtime-bundle.mjs'),bundle.outputFiles[0].text);
const a=await import(resolve(scratch,'runtime-bundle.mjs'));
const generated={library:JSON.parse(readFileSync('src/harbour/mountain/generated/library-landing.json','utf8')),awning:JSON.parse(readFileSync('src/harbour/mountain/generated/awning-landing.json','utf8'))};
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v)),wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
function path(points){const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative[i-1]+dist(points[i-1],points[i]));return{points,cumulative,length:cumulative.at(-1)};}
function pointAt(p,d){d=clamp(d,0,p.length);let i=1;while(i<p.cumulative.length-1&&p.cumulative[i]<d)i++;const u=p.points[i-1],v=p.points[i],f=(d-p.cumulative[i-1])/(p.cumulative[i]-p.cumulative[i-1]||1);return{x:u[0]+f*(v[0]-u[0]),y:u[1]+f*(v[1]-u[1]),z:u[2]+f*(v[2]-u[2]),heading:Math.atan2(v[0]-u[0],v[2]-u[2])};}
const asPoint=p=>[p.x,p.y,p.z];
function slice(p,from,to){return[asPoint(pointAt(p,from)),...p.points.filter((_,i)=>p.cumulative[i]>from+1e-7&&p.cumulative[i]<to-1e-7),asPoint(pointAt(p,to))];}
function progress(p,x,z,previous){let best={d:previous,off:Infinity};for(let i=1;i<p.points.length;i++){if(p.cumulative[i]<previous-3||p.cumulative[i-1]>previous+10)continue;const u=p.points[i-1],v=p.points[i],dx=v[0]-u[0],dz=v[2]-u[2],t=clamp(((x-u[0])*dx+(z-u[2])*dz)/(dx*dx+dz*dz||1),0,1),off=Math.hypot(x-u[0]-t*dx,z-u[2]-t*dz);if(off<best.off)best={d:p.cumulative[i-1]+t*(p.cumulative[i]-p.cumulative[i-1]),off};}return best;}
const course=path(a.MOUNTAIN_COURSE_POINTS),routes=[];
function add(id,branch,startRow,endRow,scope){
 const selected=branch.points.slice(startRow,endRow+1),points=[...selected],approach=startRow===0,runout=endRow===branch.points.length-1;
 if(approach)points.unshift(...slice(course,Math.max(0,course.cumulative[branch.entry]-8),course.cumulative[branch.entry]).slice(0,-1));
 if(runout)points.push(...slice(course,course.cumulative[branch.exit],Math.min(course.length,course.cumulative[branch.exit]+8)).slice(1));
 routes.push({id,branchId:branch.id,scope,startRow,endRow,halfWidth:branch.halfWidth,roadApproachM:approach?8:0,roadRunoutM:runout?8:0,points,sourcePointsSha256:sha(JSON.stringify(branch.points)),selectedPointsSha256:sha(JSON.stringify(points))});
}
const library=a.SKILL_BRANCHES.find(b=>b.id==='library-balcony'),dam=a.SKILL_BRANCHES.find(b=>b.id==='dam-promenade'),awning=a.SKILL_BRANCHES.find(b=>b.id==='hearth-awning');
if(!library||!dam||!awning)throw Error('Missing authoritative branch');
if(!Number.isInteger(generated.library.entryPreservedFromRow)||!Number.isInteger(generated.library.lockedRows)||!Number.isInteger(generated.awning.lockedRows))throw Error('Landing metadata changed; review range selection');
add('library-entry',library,0,Math.min(library.points.length-1,generated.library.entryPreservedFromRow+2),'entry fairing plus two preserved rows and road approach');
add('library-exit',library,Math.max(0,generated.library.lockedRows-2),library.points.length-1,'contour exit from two preserved rows through road runout');
const damDeck=dam.segments.find(s=>s.kind==='deck');if(!damDeck)throw Error('Missing dam exit deck');
const damRow=dam.points.findIndex(p=>dist(p,damDeck.points[0])<1e-7&&Math.abs(p[1]-damDeck.points[0][1])<1e-7);if(damRow<0)throw Error('Dam segment no longer matches authoritative points');
add('dam-exit',dam,damRow,dam.points.length-1,'last deck and landing only; unchanged upstream dam crest and rail excluded');
add('awning-return',awning,Math.max(0,generated.awning.lockedRows-1),awning.points.length-1,'last locked row through changed contour return and road runout; first rail excluded');
if(process.argv.includes('--full-branches'))for(const branch of [library,dam,awning])add(branch.id+'-full',branch,0,branch.points.length-1,'optional whole branch, includes unchanged skill features; separate evidence');
writeFileSync(resolve(OUT,'routes.json'),JSON.stringify(routes,null,2));
const obstacles=a.courtObstacles('full'),field=a.skateField(),world={groundHeightAt:a.groundHeightAt,obstacles,room:null},dt=1/60;
const sourceSetSha256=sha(JSON.stringify(sourceHashes)),report={createdAt:new Date().toISOString(),root:ROOT,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSetSha256,sourceHashes,compiledBundleSha256:sha(bundle.outputFiles[0].text),obstacleCount:obstacles.length,method:'Native createSkateDriver with standalone default skateField, real court/mountain obstacles, dressing colliders, shore and slope rules; native walking directly calls the same createBodyState/stepBody as createWalker. One initial placement per independent attempt. Ordinary input only.',driver:{dt,lookaheadSkateM:.7,lookaheadWalkM:.7,pushBelowMs:2.4,brakeAboveMs:2.9,stallSeconds:6,maxSeconds:180,endToleranceM:.35,maxRouteHeightErrorM:1},limits:['Native standalone world only: this is not Horizon shell, streaming, camera, rendered UI or physical-device evidence.','Each direction/range/mode starts independently and cannot establish one uninterrupted whole branch or chain.','Scripted pursuit uses0.7m lookahead for these narrow branch contours, ordinary push below2.4m/s and brake above2.9m/s; it is not skilled human acceptance.','Contacts are native walker state or observational obstacle pushOut; native skate contact normals are not exposed.','Natural airborne motion is counted and reported; a completed attempt with airtime still needs review.','No jumps, grind commands, retries, checkpoint restoration, physics overrides or post-start coordinate writes.'],results:[]};
const snapshot=p=>({x:p.x,y:p.y,z:p.z,speed:p.speed,heading:p.heading??p.yaw,vx:p.vx,vy:p.vy,vz:p.vz,phase:p.phase,supportId:p.supportId,bail:p.bail?{...p.bail}:null,air:p.air??p.airTime,clearance:p.clearance});
function run(route,reverse,mode){
 const p=path(reverse?[...route.points].reverse():route.points),start=pointAt(p,0),end=pointAt(p,p.length),r={route:route.id,scope:route.scope,branchId:route.branchId,mode,direction:reverse?'reverse':'forward',sourceSetSha256,sourcePointsSha256:route.sourcePointsSha256,attemptedDistanceM:p.length,requestedStart:start,requestedEnd:end,restarts:0,completed:false,reason:'time-cap',completedDistanceM:0,travelM:0,elapsedS:0,maxDeviationM:0,maxHeightErrorM:0,airborneFrames:0,maxContinuousAirS:0,maxSpeedMs:0,maxTurnRateRadS:0,maxLateralAccelerationMs2:0,gripMargin:null,contacts:{},events:[],samples:[]};
 let input={...a.SKATE_NO_INTENT},driver=null,body=null;
 if(mode==='native-skate'){driver=a.createSkateDriver({obstacles},{getGamepads:null,intent:()=>input});driver.mount(start.x,start.z,start.heading,undefined,{y:start.y});}
 else body=a.createBodyState(start.x,start.z,start.heading,world,start.y);
 const present=()=>driver?driver.present():body;
 r.actualStart=snapshot(present());r.initialDisplacementM=Math.hypot(r.actualStart.x-start.x,r.actualStart.y-start.y,r.actualStart.z-start.z);
 if(r.initialDisplacementM>.25){r.reason='initial-placement-displaced';r.final=r.actualStart;driver?.unmount();return r;}
 let d=0,mark=0,stall=0,air=0,previous=asPoint(start),lastContact=null;
 for(let frame=0;frame<180/dt;frame++){
  const before=present(),pr=progress(p,before.x,before.z,d);d=Math.max(d,pr.d);const expected=pointAt(p,pr.d),heightError=Math.abs(before.y-expected.y);
  r.completedDistanceM=d;r.elapsedS=frame*dt;r.maxDeviationM=Math.max(r.maxDeviationM,pr.off);r.maxHeightErrorM=Math.max(r.maxHeightErrorM,heightError);r.maxSpeedMs=Math.max(r.maxSpeedMs,before.speed);
  const endDistance=Math.hypot(before.x-end.x,before.z-end.z);r.endResidualM=endDistance;
  if(d>=p.length-.35&&endDistance<.5&&heightError<.48){r.completed=true;r.reason='end';break;}
  if(d>mark+.1){mark=d;stall=0;}else stall+=dt;
  if(stall>6){r.reason='stalled-no-progress-6s';break;}
  if(pr.off>Math.max(1,route.halfWidth+.5)){r.reason='left-authored-route';break;}
  if(heightError>1){r.reason='left-authored-support-level';break;}
  const target=pointAt(p,pr.d+.7),dx=target.x-before.x,dz=target.z-before.z,headingBefore=before.heading??before.yaw;
  if(driver){const e=wrap(Math.atan2(dx,dz)-before.heading);input={...a.SKATE_NO_INTENT,steer:clamp(-e*1.8,-1,1),push:before.speed<2.4,brake:before.speed>2.9};driver.step(dt);
   for(const ev of driver.events())if(ev.kind!=='push')r.events.push({...ev,atS:r.elapsedS,distanceM:d});
  }else{const l=Math.hypot(dx,dz)||1;const frame=a.stepBody(body,{...a.NO_INPUT,forward:-dz/l,strafe:dx/l},0,dt,world);body=frame.state;if(frame.returned){r.restarts++;r.reason='automatic-return';break;}if(body.returning){r.reason='automatic-return-requested';break;}}
  const after=present(),headingAfter=after.heading??after.yaw,turn=Math.abs(wrap(headingAfter-headingBefore))/dt;
  r.maxTurnRateRadS=Math.max(r.maxTurnRateRadS,turn);r.maxLateralAccelerationMs2=Math.max(r.maxLateralAccelerationMs2,turn*after.speed);
  if(after.bail){r.reason='bail:'+after.bail.reason;break;}
  const recovered=driver?.events().find(e=>e.kind==='recovered'&&e.moved);if(recovered){r.restarts++;r.reason='automatic-recovery-relocated';break;}
  const airborne=driver?after.phase==='air':after.air>1e-5||after.vy>0;if(airborne){air+=dt;r.airborneFrames++;r.maxContinuousAirS=Math.max(r.maxContinuousAirS,air);}else air=0;
  const hit=a.pushOut(after.x,after.z,a.BODY_RADIUS,obstacles,after.y),contact=body?.contact??(Math.hypot(hit.x-after.x,hit.z-after.z)>1e-5?hit.hit??'obstacle-overlap':null);
  if(contact){r.contacts[contact]=(r.contacts[contact]??0)+1;if(lastContact!==contact)r.events.push({kind:'contact',id:contact,atS:r.elapsedS,distanceM:d});}lastContact=contact;
  r.travelM+=Math.hypot(after.x-previous[0],after.z-previous[2]);previous=[after.x,after.y,after.z];
  if(frame%15===0)r.samples.push({t:r.elapsedS,d,off:pr.off,heightError,input:driver?{steer:input.steer,push:input.push,brake:input.brake}:null,...snapshot(after)});
 }
 r.final=snapshot(present());r.finalSurface=field.sample(r.final.x,r.final.z,r.final.y);r.endResidualM=Math.hypot(r.final.x-end.x,r.final.z-end.z);driver?.unmount();return r;
}
for(const route of routes)for(const reverse of [false,true])for(const mode of process.argv.includes('--skate-only')?['native-skate']:['native-skate','native-walking']){
 const r=run(route,reverse,mode);report.results.push(r);writeFileSync(resolve(OUT,'results.json'),JSON.stringify(report,null,2));console.log(r.route,r.direction,r.mode,r.reason,r.completedDistanceM.toFixed(2)+'/'+r.attemptedDistanceM.toFixed(2),'end residual',r.endResidualM?.toFixed(2));
}
report.completedAt=new Date().toISOString();report.sourceChangedDuringRun=Object.entries(sourceHashes).filter(([p,h])=>sha(readFileSync(resolve(ROOT,p)))!==h).map(([p])=>p);report.validSourceSnapshot=report.sourceChangedDuringRun.length===0;writeFileSync(resolve(OUT,'results.json'),JSON.stringify(report,null,2));
if(!report.validSourceSnapshot){console.error('INVALID source snapshot: files changed during run',report.sourceChangedDuringRun);process.exitCode=2;}
