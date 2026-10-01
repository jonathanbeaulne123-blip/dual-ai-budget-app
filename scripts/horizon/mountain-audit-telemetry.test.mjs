// Tiny pure-data checks only: no world, controller, renderer or geometry imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {nativeStationMap,nativeToChain,nativeSampleChainStation,kinematics,localPlanStation,currentProjectionFinishReached} from './mountain-audit-telemetry.mjs';
import {hairpinObservation,nearestLamp} from './summarize-mountain-hairpins.mjs';
const points=[[0,0,0],[3,4,0],[3,4,4]],source=points.map((at,i)=>({at,s:[0,5,9][i]}));
const chain={points,widths:[{s:100},{s:103},{s:107}],parts:[{id:'mountainV2.road',from:100,to:107}]};
const frame=(s,t,speed=20,extra={})=>({s,t,speed,segment:0,steer:.4,curvature:.1,turnRate:.2,...extra});
test('native spatial station uses horizontal segment lengths, not spatial s + offset',()=>{
 const m=nativeStationMap(source,points,chain);assert.equal(m.valid,true);
 assert.equal(nativeToChain(2.5,m),101.5);assert.equal(nativeToChain(7,m),105);
 assert.throws(()=>nativeToChain(10,m),/outside/);
});
test('mapping rejects different source geometry, chain geometry, count and length',()=>{
 assert.equal(nativeStationMap(source,points.slice(1),chain).valid,false);
 assert.equal(nativeStationMap(source.map((p,i)=>i? p:{...p,at:[0,1,0]}),points,chain).valid,false);
 assert.equal(nativeStationMap(source,points,{...chain,points:points.map(p=>[p[0]+1,p[1],p[2]])}).valid,false);
 assert.equal(nativeStationMap(source,points,{...chain,parts:[{id:'mountainV2.road',from:100,to:108}]}).valid,false);
});
test('only the named Foot/native start accepts its known 23 micrometre height alias',()=>{
 const road=[[1282,54.649977,720],[1283,54.74,720],[1285,55,720]],src=road.map((at,i)=>({at,s:[0,1.01,3.04][i]}));
 const linked={points:[[1282,54.65,721],[1282,54.65,720],...road.slice(1)],widths:[{s:99},{s:100},{s:101},{s:103}],
  parts:[{id:'mountainV2.footLane',from:99,to:100},{id:'mountainV2.road',from:100,to:103}]};
 const m=nativeStationMap(src,road,linked);assert.equal(m.valid,true);assert.ok(Math.abs(m.chainPointErrorM-23e-6)<1e-12);
 assert.equal(m.sharedStartHeightAlias.row,0);assert.equal(m.sharedStartHeightAlias.maximumHeightDifferenceM,25e-6);
 assert.ok(Math.abs(m.sharedStartHeightAlias.heightDifferenceM-23e-6)<1e-12);assert.equal(m.maxPositionErrorM,0);
 assert.equal(nativeToChain(0,m),100);assert.equal(nativeToChain(1.01,m),101);assert.equal(m.lengthErrorM,0);
 const edit=(i,axis,delta)=>({...linked,points:linked.points.map((p,j)=>j===i?p.map((v,k)=>v+(k===axis?delta:0)):p)});
 assert.equal(nativeStationMap(src,road,edit(1,0,1e-6)).valid,false,'alias never permits a plan displacement');
 assert.equal(nativeStationMap(src,road,edit(1,1,4e-6)).valid,false,'shared height remains bounded');
 assert.equal(nativeStationMap(src,road,edit(2,1,23e-6)).valid,false,'later rows retain the strict tolerance');
 assert.equal(nativeStationMap(src.map((p,i)=>i?p:{...p,at:[1282,54.65,720]}),road,linked).valid,false,'source-to-road matching is not relaxed');
 assert.equal(nativeStationMap(src,road,{...linked,parts:[{...linked.parts[0],id:'another-route'},linked.parts[1]]}).valid,false,'named Foot owner required');
 assert.equal(nativeStationMap(src,road,{...linked,parts:[{...linked.parts[0],to:99.999},linked.parts[1]]}).valid,false,'shared station required');
 const shift=p=>[p[0]+1,p[1],p[2]];
 assert.equal(nativeStationMap(src.map(p=>({...p,at:shift(p.at)})),road.map(shift),{...linked,points:linked.points.map(shift)}).valid,false,'unrelated first rows receive no allowance');
});
test('legacy native d omits initial half metre, reverses locally, and then adds reach offset',()=>{
 assert.equal(nativeSampleChainStation({d:.5},{direction:'forward',pathLengthM:7},{from:100,to:107}),101);
 assert.equal(nativeSampleChainStation({d:.5},{direction:'reverse',pathLengthM:7},{from:100,to:107}),106);
 assert.equal(nativeSampleChainStation({chainS:104,d:0},{direction:'reverse',pathLengthM:7},{from:100,to:107}),104);
});
test('actual heading/velocity derivatives wrap and low-speed curvature stays unavailable',()=>{
 const a={heading:Math.PI-.01,vx:4*Math.sin(Math.PI-.01),vy:0,vz:4*Math.cos(Math.PI-.01)};
 const b={heading:-Math.PI+.01,vx:4*Math.sin(-Math.PI+.01),vy:0,vz:4*Math.cos(-Math.PI+.01)};
 const k=kinematics(a,b,.1,.3);assert.ok(Math.abs(k.headingTurnRate-.2)<1e-10);assert.ok(Math.abs(k.observedCurvature-.05)<1e-10);assert.equal(k.steeringInputReserve,.7);
 assert.equal(kinematics({...a,vx:0,vz:0},b,.1,0).observedCurvature,null);
});
test('post-step local projection respects reversed canonical station direction',()=>{
 const q=[{cx:10,cz:0,s:110},{cx:5,cz:0,s:105},{cx:0,cz:0,s:100}];
 const p=localPlanStation(q,1,4,2);assert.equal(p.stationPlanM,104);assert.equal(p.distanceFromCentreM,2);
});
test('reverse entry speed uses a same-attempt bracket',()=>{
 const r=hairpinObservation([frame(106,0,6),frame(104,.25,4)],102,105,'reverse',.25);
 assert.equal(r.reached,true);assert.equal(r.entrySpeedMps,5);assert.equal(r.minimumSteeringInputReserve,.6);assert.equal(r.physicalGripMargin,null);
});
test('small hairpin crossed between observations is reached but has no invented turn/steer metrics',()=>{
 const r=hairpinObservation([frame(100,0,60),frame(105,.1,60)],102,103,'forward',.1);
 assert.equal(r.reached,true);assert.equal(r.interiorSamples,0);assert.equal(r.entrySpeedMps,60);
 assert.equal(r.maxObservedAbsCurvaturePerM,null);assert.equal(r.minimumSteeringInputReserve,null);
});
test('restart, recovery, unexplained jump, and stop before turn cannot fill an unsampled hairpin',()=>{
 for(const rows of [[frame(100,0,100),frame(110,.1,100,{segment:1})],[frame(100,0,100),frame(110,.1,100,{discontinuity:true})],[frame(100,0,1),frame(110,.1,1)],[frame(100,0),frame(101,.1)]]){
  const r=hairpinObservation(rows,102,105,'forward',.1);assert.equal(r.reached,false);assert.equal(r.entrySpeedMps,null);
 }
});
test('legacy restarted trace allows only explicit interior evidence and no cross-boundary interpolation',()=>{
 const r=hairpinObservation([frame(100,0,100),frame(103,.1,100)],102,105,'forward',.1,false);
 assert.equal(r.reached,true);assert.equal(r.entrySpeedMps,null);
});
test('legacy averaged curvature crossing a group boundary is not an interior peak',()=>{
 const r=hairpinObservation([frame(103,1,4,{curvatureIntervalStations:[100,103]})],102,105,'forward',1);
 assert.equal(r.maxObservedAbsCurvaturePerM,null);
});
test('lamp distance is to baked pool in plan and retains its vertical difference',()=>{
 const l=nearestLamp([{id:'lower',at:[0,0,0],pool:[0,-20,0],head:[0,-15,0],poolRadius:6},{id:'farther',at:[2,0,0]}],[0,5,0]);
 assert.equal(l.id,'lower');assert.equal(l.poolPlanDistanceM,0);assert.equal(l.poolHeightDifferenceM,-25);assert.equal(l.headSpatialDistanceM,20);assert.equal(nearestLamp([],[0,0,0]),null);
});

test('report-only CLI keeps scenarios separate, selects baked lite IDs, and rejects mixed bakes',async()=>{
 const {mkdtempSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');const {createHash}=await import('node:crypto');
 const dir=mkdtempSync(join(tmpdir(),'hairpin-data-test-'));
 try{
  const put=(name,value)=>{const p=join(dir,name);writeFileSync(p,JSON.stringify(value));return p;};
  const world={roadChains:[{...chain,id:'mountain-road'}],collision:{beds:[{id:'mountainV2.road',points}]},corridors:[{id:'road',lamps:[{id:'full-near',at:[3,4,0],pool:[3,4,0]},{id:'lite-kept',at:[3,4,4],pool:[3,4,4]}],liteLampIds:['lite-kept']}]};
  const worldFile=put('world.json',world),sourceFile=put('source.json',{road:{samples:source}}),inventoryFile=put('inventory.json',{hairpins:[{id:'H1',s0:2.5,s1:7,at:[3,4,1],guardLeft:'open',guardRight:'kerb'}]});
  const worldSha256=createHash('sha256').update(readFileSync(worldFile)).digest('hex'),bake={worldSha256,terrainSha256:'same-synthetic-terrain'};
  const cruiser=put('cruiser.json',{meta:{scenario:{id:'natural-downhill',limits:[]},bake,telemetry:{sampleIntervalSeconds:.25}},drives:[{bed:'mountain-chain',dir:'rev',lane:0,steps:2,completed:false,reason:'stalled',restarts:[]}],telemetry:[{bed:'mountain-chain',dir:'rev',lane:0,chainS:106,timeSeconds:0,speed:6,segment:0},{bed:'mountain-chain',dir:'rev',lane:0,chainS:104,timeSeconds:.25,speed:4,segment:0}],stations:{'mountain-chain':[{s:103,L:'drop',Ld:3,R:'rail',Rd:4}]}});
  const native=put('native.json',{scenario:'paced',bake,telemetry:{sampleIntervalSeconds:.25},results:[{route:'mountainV2.road',routeKind:'reach',direction:'reverse',pathLengthM:7,attempted:true,completed:false,restarts:0,reason:'test-end',samples:[{t:0,d:.5,speed:6,velocity:[0,0,6],heading:0,steer:.2},{t:.25,d:2.5,speed:4,velocity:[0,0,4],heading:0,steer:.3}]}]});
  const script=fileURLToPath(new URL('./summarize-mountain-hairpins.mjs',import.meta.url));
  const args=['--world',worldFile,'--native-source',sourceFile,'--inventory',inventoryFile,'--cruiser',cruiser,'--native',native,'--out',join(dir,'result')];
  const run=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const result=JSON.parse(readFileSync(join(dir,'result/HAIRPINS.json'),'utf8'));assert.equal(result.rows.length,2);
  assert.deepEqual(result.rows.map(r=>r.scenario),['natural-downhill','paced']);assert.ok(result.rows.every(r=>r.entrySpeedMps===5));
  assert.equal(result.rows[0].nearestBakedLamp.full.id,'full-near');assert.equal(result.rows[0].nearestBakedLamp.lite.id,'lite-kept');assert.equal(result.rows[0].guards.finalStaticProbes[0].right.kind,'rail');
  const wrong=JSON.parse(readFileSync(native));wrong.bake.worldSha256='wrong';put('native.json',wrong);
  const rejected=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/world hash differs/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});


test('native and walking/bicycle finish cannot combine old station progress with a later return to the line',()=>{
 const missedFinish={d:99.7,off:1.2},rolledBack={d:97,off:.2};
 assert.equal(currentProjectionFinishReached(missedFinish,100),false);
 assert.equal(currentProjectionFinishReached(rolledBack,100),false);
 assert.equal(currentProjectionFinishReached({d:99.5,off:.99},100),true);
 assert.equal(currentProjectionFinishReached({d:99.5,off:1},100),false);
});
test('unmeasured legacy off-bed samples remain unavailable instead of green zero',()=>{
 const unknown=hairpinObservation([frame(103,0,4)],102,105,'forward');
 assert.equal(unknown.offBedSamples,null);assert.equal(unknown.offBedUnknownSamples,1);
 const known=hairpinObservation([frame(103,0,4,{offBed:false})],102,105,'forward');
 assert.equal(known.offBedSamples,0);assert.equal(known.offBedObservedSamples,1);
 const mixed=hairpinObservation([frame(103,0,4),frame(104,.1,4,{offBed:true})],102,105,'forward');
 assert.equal(mixed.offBedSamples,1);assert.equal(mixed.offBedUnknownSamples,1);
});
