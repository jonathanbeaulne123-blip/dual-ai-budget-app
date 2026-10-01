#!/usr/bin/env node
/** Read-only baseline over the committed bake. Real board/bicycle/cruiser controllers;
 * unsupported/missing modes remain unverified. No synthetic replacement physics. */
import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),args=process.argv.slice(2),oi=args.indexOf('--out');
if(oi>=0&&(!args[oi+1]||args[oi+1].startsWith('--')))throw new Error('--out requires a directory');
if(args.some((v,i)=>v.startsWith('--')&&!['--out','--no-drive','--baseline-ref'].includes(v)))throw new Error('Unknown option');
const out=resolve(oi>=0?args[oi+1]:'docs/horizon/evidence/bridges/before'),drive=!args.includes('--no-drive');
const exports=[
['parseHorizonDefinition','src/house/world/horizonAssets.ts'],['decodeTerrainAsset','src/harbour/horizon/land/terrain/asset.ts'],
['sampleTerrain','src/harbour/horizon/land/terrain/index.ts'],['createHorizonGeography','src/harbour/horizon/runtime/geography.ts'],
['createMountainV2Region, terraceBedExclusion','src/harbour/horizon/regions/mountainV2/index.ts'],
['SPANS, structureStretches','src/harbour/horizon/land/structures/build.ts'],['nearestOnPath, bounds','src/harbour/horizon/land/structures/mesh.ts'],
['HORIZON_MANIFEST','src/harbour/horizon/world/manifest.ts'],['createBoardController','src/harbour/horizon/movers/board/controller.ts'],
['createBicycleController','src/harbour/horizon/movers/bicycle/controller.ts'],['createCruiserState, stepCruiser','src/harbour/horizon/movers/cruiser/sim.ts']];
const b=await build({stdin:{contents:exports.map(([e,p])=>`export {${e}} from './${p}';`).join('\n'),resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error'});
const a=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const baseline=args.includes('--baseline-ref')?args[args.indexOf('--baseline-ref')+1]:null;
const asset=path=>baseline?execFileSync('git',['show',`${baseline}:${path}`],{maxBuffer:100*1024*1024}):readFileSync(path);
const wb=asset('public/horizon/world/horizon-geo-1.json.gz'),tb=asset('public/horizon/terrain/horizon-geo-1.bin');
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),w=a.parseHorizonDefinition(ab(wb)),f=a.decodeTerrainAsset(ab(tb),'full');
const g=a.createHorizonGeography(f,{...w.collision,solids:w.geometry.solids,diagnostics:w.diagnostics??[]});
g.addDynamic(a.createMountainV2Region({walkingJoinSolids:w.geometry.solids,horizonGround:(x,z)=>a.sampleTerrain(f,x,z),yield:a.terraceBedExclusion(w.beds),terrainStep:f.step}).provider);
const deps={world:w,geography:g,manifest:a.HORIZON_MANIFEST,reducedMotion:false,calm:false,tier:'full'};
const pathAt=(p,s)=>{for(let i=1;i<p.length;i++){const q=p[i-1],r=p[i],l=Math.hypot(r[0]-q[0],r[2]-q[2]);if(s<=l||i===p.length-1){const t=Math.max(0,Math.min(1,s/(l||1)));return q.map((v,k)=>v+(r[k]-v)*t);}s-=l;}return p[0];};
const length=p=>p.slice(1).reduce((s,q,i)=>s+Math.hypot(q[0]-p[i][0],q[2]-p[i][2]),0);
const spans=a.SPANS.map(s=>({...s}));
const prow=a.HORIZON_MANIFEST.structures.prowLoopFootbridge;
if(prow){const mid=[(prow.from[0]+prow.to[0])/2,(prow.from[1]+prow.to[1])/2];spans.push({id:'prowLoopFootbridge',at:mid,route:'yearWalk',length:29,width:6});}
const trestle=a.structureStretches(w.collision.beds).find(s=>s.structureId==='bightSpurTrestle');
if(trestle){const bed=w.collision.beds.find(b=>b.id===trestle.bedId),p=pathAt(bed.points,(trestle.from+trestle.to)/2);spans.push({id:'bightSpurTrestle',at:[p[0],p[2]],route:bed.id,length:trestle.to-trestle.from,width:bed.width,from:trestle.from,to:trestle.to});}
const rows=[];
for(const s of spans){
 const bed=w.collision.beds.find(b=>b.id===s.route),solids=w.geometry.solids.filter(x=>x.id.startsWith(s.id+'.'));
 if(!bed){rows.push({...s,status:'missing baked bed',runs:[]});continue;}
 const mid=a.nearestOnPath(s.at,bed.points).along,L=length(bed.points),from=Math.max(0,(s.from??mid-s.length/2)-6),to=Math.min(L,(s.to??mid+s.length/2)+6);
 const samples=[];for(let p=from;p<=to;p+=.5){const q=pathAt(bed.points,p),hit=g.surface(q[0],q[2],q[1],.48);samples.push({s:p,at:q,surfaceId:hit?.id??null,y:hit?.y??null,bedY:q[1],ceiling:hit?g.ceiling(q[0],q[2],hit.y):null,blocker:hit?g.blocker(q[0],q[2],hit.y,.3):null});}
 const runs=[];
 if(drive)for(const mode of ['board','bicycle','cruiser'])for(const dir of [1,-1]){
  if(mode==='cruiser'&&!['V01','VG','V03','VBS'].includes(s.route)){runs.push({mode,direction:dir,status:'not-applicable',reason:'No authored road on this deck'});continue;}
  const start=pathAt(bed.points,dir===1?from:to),target=pathAt(bed.points,(dir===1?from:to)+dir*2),yaw=Math.atan2(target[0]-start[0],target[2]-start[2]);
  const controller=mode==='board'?a.createBoardController(deps):mode==='bicycle'?a.createBicycleController(deps):null;
  let state=controller?null:a.createCruiserState({x:start[0],y:start[1],z:start[2],yaw});
  controller?.place({x:start[0],y:start[1],z:start[2],heading:yaw,speed:2});
  let reached=false,events=new Set(),maxLateral=0,airSteps=0,lastProgress=0,stalled=0,steps=0;
  for(;steps<120*120;steps++){
   const cs=controller?.state(),p=cs?cs.p:[state.x,state.y,state.z],heading=cs?cs.heading:state.yaw,n=a.nearestOnPath([p[0],p[2]],bed.points);
   const progress=dir===1?n.along-from:to-n.along;
   if(progress>=to-from-.8){reached=true;break;}
   maxLateral=Math.max(maxLateral,n.distance);if(n.distance>Math.max(8,bed.width))break;
   if(progress>lastProgress+.1){lastProgress=progress;stalled=0;}else if(++stalled>120*6)break;
   const aim=pathAt(bed.points,n.along+dir*5),desired=Math.atan2(aim[0]-p[0],aim[2]-p[2]),err=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
   const steer=Math.max(-1,Math.min(1,-err*1.6));
   if(controller){const frame=controller.update(1/120,{forward:1,steer,jump:false,sprint:false,crouch:0,accept:false,look:{dx:0,dy:0}},steps/120);frame.events.forEach(e=>events.add(e));if(frame.fade)events.add('fade');if(!controller.state().contact.on)airSteps++;}
   else{state=a.stepCruiser(state,{forward:1,steer,jump:false},g,1/120);if(state.contact)events.add(state.contact);if(!state.grounded)airSteps++;}
  }
  runs.push({start,final:controller?.state().p??[state.x,state.y,state.z],progress:lastProgress,mode,direction:dir,status:reached?'end-reached-unverified':'incomplete-probe',seconds:steps/120,maxLateral,airSteps,events:[...events],note:'Input-only pursuit driver; no position reset after start. Incomplete is not classified as a world fault until visually corroborated.'});controller?.dispose();
 }
 rows.push({...s,from,to,deckSolids:solids.filter(x=>x.role==='deck').map(x=>({id:x.id,bounds:a.bounds(x),triangles:x.indices.length/3})),solidCount:solids.length,triangles:solids.reduce((n,x)=>n+x.indices.length/3,0),surfaceProbe:{count:samples.length,missing:samples.filter(x=>x.y===null).length,maxBedMismatch:Math.max(0,...samples.filter(x=>x.y!==null).map(x=>Math.abs(x.y-x.bedY))),headroom:(()=>{const valid=samples.filter(x=>x.y!==null),finite=valid.filter(x=>Number.isFinite(x.ceiling)).sort((a,b)=>(a.ceiling-a.y)-(b.ceiling-b.y));return finite.length?{state:'measured',minimum:finite[0].ceiling-finite[0].y,station:finite[0].s,at:finite[0].at,surfaceId:finite[0].surfaceId}:{state:valid.length?'open-sky':'no-surface',minimum:null};})(),blockedSamples:samples.filter(x=>x.blocker).length,witnesses:samples.filter(x=>x.y===null||x.blocker||Math.abs(x.y-x.bedY)>.02).sort((a,b)=>Math.abs((b.y??0)-b.bedY)-Math.abs((a.y??0)-a.bedY)).slice(0,12)},runs});
 console.log(s.id,runs.map(r=>`${r.mode}:${r.direction}:${r.status}`).join(' '));
}
const report={schema:2,baseline,drive,scriptSha256:createHash('sha256').update(readFileSync('scripts/horizon/bridge-audit.mjs')).digest('hex'),sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worldSha256:createHash('sha256').update(wb).digest('hex'),terrainSha256:createHash('sha256').update(tb).digest('hex'),method:'Source inventory, baked surface queries and real ground controllers. No model or physics changes. Not full bridge acceptance.',rows,diagnostics:(w.diagnostics??[]).filter(d=>/bridge|span|trestle/i.test(d.id+' '+d.message)),unverified:{walk:'Runtime closure: use browser simulateMotion; static body probe here is not walking simulation',ferry:'No registered controller at baseline',rowboat:'No registered controller at baseline; fleet kayak is a different craft',plane:baseline?'Historical assets selected; aircraft passage not audited':'Powered aircraft implemented by airport #576; bridge swept-wing passage not audited',zip:'No registered controller at baseline',glider:'Implemented; authored-course bidirectional replay not yet audited',gondola:'Implemented; cable swept envelope not yet measured',monorail:'Implemented kinematic transport; swept envelope not yet measured',skate:'Board deck runs only; S2/S4 grind lines not covered'}};
mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
const describeRun=r=>!r?'unverified':r.status+(r.seconds===undefined?'':` (${r.seconds.toFixed(2)}s; air ${r.airSteps} steps; lateral ${r.maxLateral.toFixed(2)}eu; events ${r.events.join(', ')||'none'})`);
writeFileSync(resolve(out,'AUDIT.md'),'# Bridge baseline audit\n\nSource '+report.sha+'. Local full bake; no device evidence.\n\nCounts below are controller runs, not verified geometry defects. `incomplete-probe` needs capture correlation.\n\n| Bridge | Mode | Forward | Reverse |\n|---|---|---|---|\n'+rows.flatMap(r=>['board','bicycle','cruiser'].map(m=>'| '+r.id+' | '+m+' | '+describeRun(r.runs.find(x=>x.mode===m&&x.direction===1))+' | '+describeRun(r.runs.find(x=>x.mode===m&&x.direction===-1))+' |')).join('\n')+'\n\nReaching an end projection is NOT a traversal pass: falls, contacts, fades, deck height and lateral error require witness review. Per-run airSteps/events/maxLateral/start/final/progress are in audit.json.\n\n## Unverified modes\n\n'+Object.entries(report.unverified).map(([k,v])=>'- '+k+': '+v).join('\n')+'\n');
