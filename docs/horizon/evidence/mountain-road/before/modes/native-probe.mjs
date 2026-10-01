import {createRequire} from 'node:module';import{readFileSync,writeFileSync}from'node:fs';import{resolve}from'node:path';
const ROOT=process.argv[2]||'/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book',OUT='/tmp/mountain-modes-probe';process.chdir(ROOT);
const {build}=createRequire(resolve(ROOT,'package.json'))('esbuild');
const b=await build({stdin:{contents:`export {createSkateDriver} from './src/harbour/skate/driver.ts';export {SKATE_NO_INTENT} from './src/harbour/skate/contract.ts';export {bedPath,pointAt,progressOf,bendRadius} from './src/harbour/horizon/movers/board/situations.ts';`,resolveDir:ROOT,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error',nodePaths:[resolve(ROOT,'node_modules')],loader:{'.png':'empty','.jpg':'empty','.svg':'empty','.css':'empty','.glb':'empty','.wav':'empty','.mp3':'empty'}});
const a=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const routes=JSON.parse(readFileSync(OUT+'/routes.json','utf8')).routes,results=[];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(v,hi)),wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const report={createdAt:new Date().toISOString(),method:'Exact createSkateDriver({obstacles:[]}), as instantiated by createNativeSkate; Horizon/native translation [1308,54,764]. Native shell start eligibility radius<64 enforced. Headless driver intent hook supplies ordinary riding inputs, no state mutation after mount.',limits:['Native driver uses native Mountain skateField and native body physics, NOT full Horizon baked collisions; this matches shell adapter behavior and cannot establish full-Horizon collider acceptance.','createNativeSkate rendered look, park drawing, UI and camera are not mounted; exact underlying driver instantiated instead.','Full chain endpoints cannot start native skate through shell canStart. Reported unavailable starts are not failed rides; no invented teleport to bypass eligibility.','No jumps, route selection, race route countdown, rescue, checkpoint restore, snaps, retries or post-bail recovery.','Pure pursuit could fail avoidably; observed inability is not automatically a world defect.','Maximum 180 simulated seconds per admitted reach; stop if off route over 8m, bail, recovered, or no 0.2m progress in 5 seconds.'],results};
for(const route of routes)for(const direction of ['forward','reverse']){
 const points=direction==='forward'?route.points:[...route.points].reverse(),path=a.bedPath({points}),s=a.pointAt(path,.5),radius=Math.hypot(s.x-1308,s.z-764);
 const r={route:route.id,routeKind:route.kind,direction,mode:'native-shell-skate-driver',attempted:false,shellStartEligible:radius<64,nativeStartRadius:radius,attemptedDistanceM:path.length-.5,completedDistanceM:0,completed:false,reason:'shell-start-outside-radius-64',elapsedS:0,maxDeviationM:0,airborneFrames:0,events:[],samples:[]};results.push(r);
 if(radius<64){
  r.attempted=true;let intent={...a.SKATE_NO_INTENT},clock=0;const driver=a.createSkateDriver({obstacles:[]},{now:()=>clock*1000,reducedMotion:()=>false,getGamepads:null,intent:()=>intent});driver.mount(s.x-1308,s.z-764,s.heading,undefined,{y:s.y-54});driver.takeCut();
  let d=.5,mark=.5,stall=0;r.reason='time-limit-180s';
  for(let f=0;f<180*60;f++){
   clock=f/60;const p=driver.present(),x=p.x+1308,z=p.z+764,pr=a.progressOf(path,x,z,d,20);d=Math.max(d,pr.d);r.elapsedS=clock;r.completedDistanceM=Math.max(0,d-.5);r.maxDeviationM=Math.max(r.maxDeviationM,pr.off);
   if(d>=path.length-.5&&pr.off<1){r.completed=true;r.reason='end';break;}
   if(d>mark+.2){mark=d;stall=0;}else stall+=1/60;
   if(stall>5){r.reason='stalled-no-progress-5s';break;}if(pr.off>8){r.reason='left-route-over-8m';break;}
   const L=clamp(1.5+.3*p.speed,2,5),t=a.pointAt(path,pr.d+L),e=wrap(Math.atan2(t.x-x,t.z-z)-p.heading),speedLimit=clamp(Math.sqrt(a.bendRadius(path,pr.d+3,3)*1.6),1.5,4);
   intent={...a.SKATE_NO_INTENT,steer:clamp(-e*1.8,-1,1),push:p.speed<speedLimit-.2,brake:p.speed>speedLimit+.3};
   driver.step(1/60);const q=driver.present();if(q.phase==='air')r.airborneFrames++;
   const ev=driver.events();for(const event of ev)if(event.kind!=='push')r.events.push({...event,atS:clock,distanceM:d,p:[q.x+1308,q.y+54,q.z+764]});
   if(q.bail||ev.some(v=>v.kind==='bail')){r.reason='bail';break;}if(ev.some(v=>v.kind==='recovered')){r.reason='recovered';break;}
   if(f%60===0)r.samples.push({t:clock,d:d-.5,p:[q.x+1308,q.y+54,q.z+764],speed:q.speed,phase:q.phase,off:pr.off});
  }
  const q=driver.present();r.finalPosition=[q.x+1308,q.y+54,q.z+764];r.finalPhase=q.phase;driver.unmount();
 }
 console.log(route.id,direction,r.reason,r.completedDistanceM.toFixed(2)+'/'+r.attemptedDistanceM.toFixed(2));writeFileSync(OUT+'/native-results.json',JSON.stringify(report,null,2));
}
