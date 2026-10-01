/** Prepare/run only in the shared geometry slot. No application source writes.
 * node /tmp/mountain-awning-diagnostic.mjs --root "$CHECKOUT" --out /tmp/awning-current.json
 * Repeat with baseline checkout and distinct --out for exact source comparison.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2), arg = (key) => args[args.indexOf(key) + 1];
if (!args.includes('--root') || !args.includes('--out')) throw new Error('Required: --root CHECKOUT --out /tmp/report.json');
const root = resolve(arg('--root')), out = resolve(arg('--out'));
if (!out.startsWith('/tmp/') && !out.startsWith('/private/tmp/')) throw new Error('Output must be under /tmp');
const req = createRequire(join(root, 'package.json')), {build} = req('esbuild');
const temp = mkdtempSync(join(tmpdir(), 'awning-exact-'));
const modulePath = rel => JSON.stringify(join(root, rel));
const source = `
import {SKILL_BRANCHES,nearestOnRoute} from ${modulePath('src/harbour/mountain/definition.ts')};
import {WORLD_SURFACES,worldCeilingAt} from ${modulePath('src/harbour/mountain/surfaces.ts')};
import {createSkateSim} from ${modulePath('src/harbour/skate/sim/index.ts')};
import {skateField,skateSimOptions,SKATE_CATALOGS} from ${modulePath('src/harbour/skate/driver.ts')};
import {courtObstacles} from ${modulePath('src/harbour/body/obstacles.ts')};
import {pathSegmentClear} from ${modulePath('src/harbour/body/pathfinder.ts')};
import {kick,intent} from ${modulePath('src/harbour/skate/sim/testKit.ts')};
import {pushOutAll,hit} from ${modulePath('src/harbour/skate/sim/geometry.ts')};
import {SKATE_TUNING} from ${modulePath('src/harbour/skate/sim/tuning.ts')};
const copy=(x:any)=>JSON.parse(JSON.stringify(x,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v));
const branch=SKILL_BRANCHES.find(b=>b.id==='hearth-awning')!,route=branch.points,baseField=skateField(),obstacles=courtObstacles('full');
const a=route[0]!,b=route[1]!,yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);
const options=skateSimOptions(obstacles,baseField);
const clearance=(s:any,x:number,z:number)=>{
 if(s.kind==='circle')return Math.hypot(x-s.x,z-s.z)-s.r;
 const dx=x-(s.kind==='box'?(s.minX+s.maxX)/2:s.x),dz=z-(s.kind==='box'?(s.minZ+s.maxZ)/2:s.z);
 const c=Math.cos(s.yaw??0),n=Math.sin(s.yaw??0),lx=dx*c-dz*n,lz=dx*n+dz*c;
 const hx=s.kind==='box'?(s.maxX-s.minX)/2:s.halfX,hz=s.kind==='box'?(s.maxZ-s.minZ)/2:s.halfZ;
 const qx=Math.abs(lx)-hx,qz=Math.abs(lz)-hz;
 return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0);
};
const nearby=(p:any)=>[...obstacles.map(s=>({s,source:'island'})),...baseField.solids.map(s=>({s,source:'park'})),...(options.extraSolids??[]).map(s=>({s,source:'soft dressing'}))]
 .map(({s,source})=>({source,solid:s,planClearance:clearance(s,p.x,p.z),hit:copy(pushOutAll(p.x,p.z,p.y,SKATE_TUNING.RADIUS,[s] as any,[],hit()))}))
 .filter(s=>s.planClearance<3).sort((a,b)=>a.planClearance-b.planClearance);
const runs=[];
for(const speed of [8,12]){
 let reads:any[]=[];
 // Observational wrappers call the original methods once with their exact arguments.
 const field=Object.assign(Object.create(baseField),{
  sample(...args:any[]){const r=(baseField.sample as any)(...args);reads.push({kind:'sample',args,result:copy(r)});return r;},
  ceilingAt(...args:any[]){const r=(baseField.ceilingAt as any)(...args);reads.push({kind:'ceiling',args,result:copy(r)});return r;},
 });
 const sim=createSkateSim(field,SKATE_CATALOGS,{x:a[0],z:a[2],y:a[1],yaw,stance:'regular',...options});
 kick(sim,{vx:Math.sin(yaw)*speed,vz:Math.cos(yaw)*speed});
 let index=0,bails=0,arrived=false,firstBail:any=null,ticks=0;const history:any[]=[],progress:any[]=[],events:any[]=[];
 for(let tick=0;tick<60*15;tick++){
  // Exactly the original test's look-ahead, high-water index, intent and 1/60 step.
  const p=sim.present(),before=copy(p),projection=nearestOnRoute(p.x,p.z,route);index=Math.max(index,projection.index);
  if(index>=route.length-3){arrived=true;break;}
  let aim=index,ahead=0;
  while(aim<route.length-1&&ahead<Math.max(2,p.speed*.35)){
   const a=route[aim]!,b=route[++aim]!;ahead+=Math.hypot(b[0]-a[0],b[2]-a[2]);
  }
  const target=route[aim]!,error=Math.atan2(Math.sin(Math.atan2(target[0]-p.x,target[2]-p.z)-p.boardYaw),Math.cos(Math.atan2(target[0]-p.x,target[2]-p.z)-p.boardYaw));
  const input=intent({push:p.speed<3,steer:p.phase==='air'?0:Math.max(-1,Math.min(1,-error*2.2))});
  reads=[];const r=sim.step(input,1/60),after=copy(r.present),ev=copy(r.events);ticks=tick+1;
  const frame={tick,time:(tick+1)/60,before,after,index,projection:copy(projection),aim,target,input,events:ev,reads};
  history.push(frame);if(history.length>90)history.shift();
  if(tick%30===0||ev.length)progress.push({tick,index,projection:copy(projection),pose:after,events:ev});
  events.push(...ev.map((e:any)=>({tick,...e})));
  const bailEvents=ev.filter((e:any)=>e.kind==='bail');bails+=bailEvents.length;
  if(bailEvents.length&&!firstBail){
   const ceilingQueries=reads.filter(x=>x.kind==='ceiling');
   firstBail={frame,prior90Frames:copy(history),nearbyBefore:nearby(before),nearbyAfter:nearby(after),
    ceilingCandidates:ceilingQueries.map(q=>({query:q,surfaces:WORLD_SURFACES.map(s=>({id:s.id,ceiling:worldCeilingAt(q.args[0],q.args[1],q.args[2],.2,[s])})).filter(s=>Number.isFinite(s.ceiling))})),
    savedState:copy(sim.save())};
  }
 }
 runs.push({speed,bails,arrived,ticks,firstBail,events,progress,final:copy(sim.present()),finalProjection:copy(nearestOnRoute(sim.present().x,sim.present().z,route)),
  note:speed===12?'Original assertion aborts after speed 8 on the observed failure; speed 12 is an additional identical-input attempt.':null});
}
const gateA={x:7.715598107341353,z:-191.3168118322227},gateB={x:88.67828044808631,z:-162.32254217463523};
const ninthRouteWitness={note:'Exact newly reported full-tier straight gate9 chord; 2D diagnostic only, not the road trajectory.',a:gateA,b:gateB,blockers:obstacles.filter(o=>!pathSegmentClear(gateA,gateB,{obstacles:[o]}))};
export default {ninthRouteWitness,method:'Unmodified branch-finishing controller inputs; one initial kick, no diagnostic resets/state writes. Existing simulator automatic bail recovery remains enabled exactly as the test.',branch:copy(branch),runs};
`;
const bundle = join(temp,'awning.mjs');
const result = await build({absWorkingDir:root,stdin:{contents:source,loader:'ts',resolveDir:root,sourcefile:'awning-exact.ts'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:bundle,metafile:true,logLevel:'warning'});
process.chdir(root);
const report = (await import(pathToFileURL(bundle).href)).default;
const hashes = Object.fromEntries(Object.keys(result.metafile.inputs).filter(p=>!p.startsWith('<')&&!p.includes('node_modules')).map(p=>{const path=resolve(root,p);try{return [p,createHash('sha256').update(readFileSync(path)).digest('hex')];}catch{return [p,'unreadable'];}}));
writeFileSync(out,JSON.stringify({root,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceHashes:hashes,bundle,...report},null,2)+'\n');
console.log(JSON.stringify({out,runs:report.runs.map(r=>({speed:r.speed,bails:r.bails,arrived:r.arrived,firstBail:r.firstBail?.frame}))},null,2));
