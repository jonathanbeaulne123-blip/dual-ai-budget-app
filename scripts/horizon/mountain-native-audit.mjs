// Real native skate through the same loaded Horizon geometry. CLI: node scripts/horizon/mountain-native-audit.mjs <checkout> <output> [paced|natural-downhill]
import{a,hosted,g,world,ROOT,runtimeBundleSha256}from'./mountain-audit-world.mjs';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';import{createHash}from'node:crypto';const OUT=resolve(process.argv[3]??'/tmp/mountain-skate-regressions');mkdirSync(OUT,{recursive:true});const scenario=process.argv[4]??'paced';if(!['paced','natural-downhill'].includes(scenario))throw new Error('scenario must be paced or natural-downhill');
// Resolve every route from this run's baked definition; never reuse previous probe coordinates.
const road=world.beds.find(b=>b.id==='mountainV2.road'),v03=world.beds.find(b=>b.id==='V03');
if(!road||!v03)throw new Error('Expected Mountain road and V03 baked beds');
const chain=world.roadChains?.find(c=>c.id==='mountain-road')??a.mountainRoadChain(world.beds);
if(!chain)throw new Error('Expected mountain-road chain');
const routes=[{id:chain.id,kind:'chain',points:chain.points},...chain.parts.map(part=>({id:part.id,kind:'reach',points:chain.points.filter((_,i)=>chain.widths[i].s>=part.from-1e-6&&chain.widths[i].s<=part.to+1e-6)})),...world.beds.filter(b=>b.id==='spur stillwater').map(b=>({id:b.id,kind:'stillwater-link',points:b.points}))],results=[];
writeFileSync(OUT+'/routes.json',JSON.stringify(routes,null,2));
const sha=p=>createHash('sha256').update(readFileSync(resolve(ROOT,p))).digest('hex');
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(v,hi)),wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const report={scenario,createdAt:new Date().toISOString(),bake:{worldSha256:sha('public/horizon/world/horizon-geo-1.json.gz'),terrainSha256:sha('public/horizon/terrain/horizon-geo-1.bin')},stillwaterLinksFound:routes.filter(r=>r.kind==='stillwater-link').map(r=>r.id),method:'Current real native driver + real Horizon skate world adapter + full baked Horizon geometry and drawn Mountain provider; ordinary pursuit input; each attempt starts once, no route jumps/restarts/snaps. Canonical baked mountain-road chain (source fallback only when absent), separate parts and spur stillwater, both directions. Velocity/heading derivative trace is kinematic; internal tire grip margin is not exposed.',limits:['All world chunks and region are loaded at start; not streaming proof.','Park art/camera/UI not mounted.','Paced profile uses ordinary push/brake inputs targeting1.5–4m/s; natural-downhill uses no brake and pushes only below1.5m/s. Neither modifies controller physics.','900 simulated seconds maximum per attempt, 5 second stall detection, 8m route departure, first bail ends attempt. No timeout counts as success.','Incomplete distance is not end-to-end acceptance; pursuit is a probe, not a human rider.'],results};
report.sourceProof={runtimeBundleSha256,auditSha256:sha('scripts/horizon/mountain-native-audit.mjs'),worldLoaderSha256:sha('scripts/horizon/mountain-audit-world.mjs')};
for(const route of routes.filter(r=>!process.env.MOUNTAIN_ROUTES||process.env.MOUNTAIN_ROUTES.split(',').includes(r.id)))for(const direction of ['forward','reverse']){
 const points=direction==='forward'?route.points:[...route.points].reverse();if(scenario==='natural-downhill'&&points.at(-1)[1]>=points[0][1]-.5)continue;const path=a.bedPath({points}),s=a.pointAt(path,.5),radius=Math.hypot(s.x-1308,s.z-764);
 const r={route:route.id,routeKind:route.kind,direction,mode:'hosted-native-shell-skate-driver',attempted:false,shellStartEligible:hosted.canStart(s.x,s.z,s.y),nativeStartRadius:radius,pathLengthM:path.length,restarts:0,attemptedDistanceM:path.length-.5,endResidualM:null,maxSpeed:0,maxTurnRate:0,maxLateralAcceleration:0,contacts:{},gripMargin:null,completedDistanceM:0,completed:false,reason:'host-cannot-start-here',elapsedS:0,maxDeviationM:0,airborneFrames:0,events:[],samples:[]};results.push(r);
 if(hosted.canStart(s.x,s.z,s.y)){
  r.attempted=true;let intent={...a.SKATE_NO_INTENT},clock=0;const driver=a.createSkateDriver({obstacles:[],field:hosted.field,physics:hosted.physics},{now:()=>clock*1000,reducedMotion:()=>false,getGamepads:null,intent:()=>intent});driver.mount(s.x-1308,s.z-764,s.heading,undefined,{y:s.y-54});driver.takeCut();
  let d=.5,mark=.5,stall=0;r.reason='time-limit-900s';
  for(let f=0;f<900*60;f++){
   clock=f/60;const p=driver.present(),x=p.x+1308,z=p.z+764,pr=a.progressOf(path,x,z,d,20);d=Math.max(d,pr.d);r.elapsedS=clock;r.completedDistanceM=Math.max(0,d-.5);r.maxDeviationM=Math.max(r.maxDeviationM,pr.off);r.endResidualM=path.length-pr.d;
   if(d>=path.length-.5&&pr.off<1){r.completed=true;r.reason='end';break;}
   if(d>mark+.2){mark=d;stall=0;}else stall+=1/60;
   if(stall>5){r.reason='stalled-no-progress-5s';break;}if(pr.off>8){r.reason='left-route-over-8m';break;}
   const L=clamp(1.5+.3*p.speed,2,5),t=a.pointAt(path,pr.d+L),e=wrap(Math.atan2(t.x-x,t.z-z)-p.heading),speedLimit=clamp(Math.sqrt(a.bendRadius(path,pr.d+3,3)*1.6),1.5,4);
   intent={...a.SKATE_NO_INTENT,steer:clamp(-e*1.8,-1,1),push:scenario==='natural-downhill'?p.speed<1.5:p.speed<speedLimit-.2,brake:scenario==='natural-downhill'?false:p.speed>speedLimit+.3};
   const beforeHeading=p.heading; // present() is a live object mutated by step().
   driver.step(1/60);const q=driver.present(),turnRate=wrap(q.heading-beforeHeading)*60,lateralAcceleration=Math.abs(turnRate)*Math.hypot(q.vx,q.vz);r.maxSpeed=Math.max(r.maxSpeed,q.speed);r.maxTurnRate=Math.max(r.maxTurnRate,Math.abs(turnRate));r.maxLateralAcceleration=Math.max(r.maxLateralAcceleration,lateralAcceleration);if(q.phase==='air')r.airborneFrames++;
   const ev=driver.events();for(const event of ev)if(event.kind!=='push')r.events.push({...event,atS:clock,distanceM:d,p:[q.x+1308,q.y+54,q.z+764]});
   if(q.bail||ev.some(v=>v.kind==='bail')){r.reason='bail';break;}if(ev.some(v=>v.kind==='recovered')){r.reason='recovered';break;}
   if(f%60===0){const hit=g.contact(q.x+1308,q.z+764,q.y+54,.3,undefined,false,1.08);if(hit)r.contacts[hit.id]=(r.contacts[hit.id]??0)+1;r.samples.push({t:clock,d:d-.5,p:[q.x+1308,q.y+54,q.z+764],speed:q.speed,velocity:[q.vx,q.vy,q.vz],heading:q.heading,turnRate,lateralAcceleration,steer:intent.steer,brake:intent.brake,bendRadius:a.bendRadius(path,pr.d+3,3),phase:q.phase,off:pr.off,contact:hit?.id??null});}
  }
  const q=driver.present();r.finalPosition=[q.x+1308,q.y+54,q.z+764];r.finalPhase=q.phase;driver.unmount();
 }
 console.log(route.id,direction,r.reason,r.completedDistanceM.toFixed(2)+'/'+r.attemptedDistanceM.toFixed(2));writeFileSync(OUT+'/native-results.json',JSON.stringify(report,null,2));
}
