/** Real bounded glider crossing probes, not launch-to-landing or swept-wing acceptance. */
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const root=process.cwd();
const built=await build({stdin:{contents:`export * from './src/harbour/horizon/land/bridges/frames';export * from './src/harbour/horizon/movers/glider/wing';export * from './src/harbour/horizon/movers/glider/env';export {GLIDER_TRIM_MS} from './src/harbour/horizon/movers/glider/polar';export {createMountainV2Region,terraceBedExclusion,mouthExclusion} from './src/harbour/horizon/regions/mountainV2';export {sampleTerrain} from './src/harbour/horizon/land/terrain';export * from './src/harbour/horizon/land/bridges/measure';export * from './src/harbour/horizon/runtime/geography';export {decodeTerrainAsset} from './src/harbour/horizon/land/terrain/asset';`,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false});
const a=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const w=JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),t=readFileSync('public/horizon/terrain/horizon-geo-1.bin'),f=a.decodeTerrainAsset(t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength),'full'),g=a.createHorizonGeography(f,{...w.collision,solids:w.geometry.solids,diagnostics:[]});

const region=a.createMountainV2Region({walkingJoinSolids:w.geometry.solids,horizonGround:(x,z)=>a.sampleTerrain(f,x,z),exclude:a.mouthExclusion(w.collision.mouths),yield:a.terraceBedExclusion(w.collision.beds),terrainStep:f.step});g.addDynamic(region.provider);
const env=a.createGliderEnv({world:w,geography:g,cuts:w.collision});
const runs=[];
for(const id of ['bightBridge','highSpan'])for(const direction of[1,-1]){
 const gate=w.sky.volumes.find(v=>v.id===id),b=w.bridges.find(v=>v.id===id),path=b.path;
 const c=Math.cos(gate.yaw),s=Math.sin(gate.yaw),axis=[s,c];
 let near=path[0],best=Infinity;for(let i=1;i<path.length;i++){const p=path[i-1],q=path[i],dx=q[0]-p[0],dz=q[2]-p[2],t=Math.max(0,Math.min(1,((gate.centre[0]-p[0])*dx+(gate.centre[2]-p[2])*dz)/(dx*dx+dz*dz)));const n=[p[0]+t*dx,p[1],p[2]+t*dz],d=Math.hypot(n[0]-gate.centre[0],n[2]-gate.centre[2]);if(d<best){best=d;near=n;}}
 const offset=(near[0]-gate.centre[0])*axis[0]+(near[2]-gate.centre[2])*axis[1],lo=Math.min(-5,offset-b.width/2-4),hi=Math.max(5,offset+b.width/2+4),start=direction===1?lo:hi,end=direction===1?hi:lo;
 const speed=a.GLIDER_TRIM_MS,vx=direction*axis[0],vz=direction*axis[1],dot=-4*vz,t=dot+Math.sqrt(dot*dot+speed*speed-16),heading=Math.atan2(t*vx,t*vz+4);
 let wing={x:gate.centre[0]+axis[0]*start,y:gate.centre[1]+2,z:gate.centre[2]+axis[1]*start,heading,bank:0,airspeed:speed,vs:0,phase:'flight',stallT:0,t:0};
 const initial={...wing},live=env.wingEnv(()=>wing.y,{walls:()=>true});let crossed=false,gateAt=null,steps=0,reason='timeout';
 for(;steps<1200;steps++){const prev=wing;wing=a.stepWing(wing,{bar:0,bank:0},live,1/60);const along=(wing.x-gate.centre[0])*axis[0]+(wing.z-gate.centre[2])*axis[1],old=(prev.x-gate.centre[0])*axis[0]+(prev.z-gate.centre[2])*axis[1];if(old*along<=0){const lateral=(wing.x-gate.centre[0])*c-(wing.z-gate.centre[2])*s;gateAt={y:wing.y,lateral,within:Math.abs(lateral)<=gate.halfSize[0]&&Math.abs(wing.y-gate.centre[1])<=gate.halfSize[1]};crossed=gateAt.within;}if(wing.phase==='touchdown'){reason='touchdown';break;}if(direction*(along-end)>=0){reason='traversed';break;}}
 runs.push({id,direction,initial,end:wing,reason,steps:steps+1,gateAt,crossed,bridgeCentre:near,groundAtStart:env.groundAt(initial.x,initial.z,initial.y)});
}

const out='docs/horizon/evidence/bridges/after/flight';mkdirSync(out,{recursive:true});writeFileSync(out+'/audit.json',JSON.stringify({method:'Real stepWing and world environment; airborne probe placement, no position correction, default wind and authored lift, walls active. Not full-course or device acceptance.',worldSha256:createHash('sha256').update(readFileSync('public/horizon/world/horizon-geo-1.json.gz')).digest('hex'),runs},null,2));console.log(runs.map(r=>({id:r.id,direction:r.direction,status:r.reason,crossed:r.crossed})));if(runs.some(r=>r.reason!=='traversed'||!r.crossed))process.exitCode=1;
