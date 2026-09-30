// Phase 0 endpoint and chord screening. Not a fitted road or swept-envelope proof.
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),out=resolve('docs/horizon/evidence/mountain-road/before/neighbour-scans.json');
const bundle=await build({stdin:{contents:`export {decodeTerrainAsset} from './src/harbour/horizon/land/terrain/asset.ts';export {sampleTerrain} from './src/harbour/horizon/land/terrain/index.ts';export {ROAD_WAYPOINTS,ORCHARD_LANE_CENTRE} from './src/harbour/mountain/roadLine.ts';export {GONDOLA_LINE} from './src/harbour/mountain/transport.ts';`,loader:'ts',resolveDir:root},bundle:true,platform:'node',format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const terrain=readFileSync('public/horizon/terrain/horizon-geo-1.bin'),field=api.decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset,terrain.byteOffset+terrain.byteLength),'full');
const world=JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json'));
const p3=w=>[w.at[0]+1308,w.y+54,w.at[1]+764],tag=t=>p3(api.ROAD_WAYPOINTS.find(w=>w.tag===t));
const pAt=(pts,target)=>{let best=null;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((target[0]-a[0])*dx+(target[2]-a[2])*dz)/(dx*dx+dz*dz)));const p=a.map((v,k)=>v+t*(b[k]-v)),distance=Math.hypot(p[0]-target[0],p[2]-target[2]);if(!best||distance<best.distance)best={p,distance,segment:i-1,t};}return best;};
const bed=id=>world.beds.find(b=>b.id===id).points;
const foot=tag('foot'),orchard=api.ORCHARD_LANE_CENTRE.at(-1).map((v,i)=>v+[1308,54,764][i]);
const inputs=[['stillwater',foot,pAt(bed('walk lakerim'),foot).p],['green-direct',foot,pAt(bed('VG'),foot).p],['hollow',orchard,pAt(bed('VG'),orchard).p],['clearing',tag('clearing'),bed('VG').reduce((a,b)=>Math.hypot(b[0]-1000,b[2]-600)<Math.hypot(a[0]-1000,a[2]-600)?b:a)],['north',tag('summit'),bed('V01').reduce((a,b)=>Math.hypot(b[0]-1300,b[2]-260)<Math.hypot(a[0]-1300,a[2]-260)?b:a)],['shoulder',tag('shelf'),[1450,api.sampleTerrain(field,1450,650),650]]];
inputs.push(['scholars',tag('clearing'),bed('VG').reduce((a,b)=>Math.hypot(b[0]-940,b[2]-460)<Math.hypot(a[0]-940,a[2]-460)?b:a)]);
const scans=inputs.map(([id,start,end])=>{const plan=Math.hypot(end[0]-start[0],end[2]-start[2]),n=Math.ceil(plan),samples=[];for(let i=0;i<=n;i++){const t=i/n,p=start.map((v,k)=>v+t*(end[k]-v)),ground=api.sampleTerrain(field,p[0],p[2]);samples.push({s:plan*t,p,ground,cut:ground-p[1]});}return{id,start,end,plan,heightChange:end[1]-start[1],minimum10:Math.max(plan,10*Math.abs(end[1]-start[1])),maxCut:Math.max(...samples.map(p=>p.cut)),maxFill:Math.max(...samples.map(p=>-p.cut)),samples};});
// Intersect proposed Stillwater chord with actual sampled G1 cable plan; interpolate cable height from the source line.
const sw=scans.find(s=>s.id==='stillwater'),A=sw.start,B=sw.end,cable=api.GONDOLA_LINE.path??api.GONDOLA_LINE.points;
const cross=[];if(cable){for(let i=1;i<cable.length;i++){const C=cable[i-1].map((v,k)=>v+[1308,54,764][k]),D=cable[i].map((v,k)=>v+[1308,54,764][k]),rx=B[0]-A[0],rz=B[2]-A[2],sx=D[0]-C[0],sz=D[2]-C[2],det=rx*sz-rz*sx;if(Math.abs(det)<1e-9)continue;const t=((C[0]-A[0])*sz-(C[2]-A[2])*sx)/det,u=((C[0]-A[0])*rz-(C[2]-A[2])*rx)/det;if(t>=0&&t<=1&&u>=0&&u<=1){const roadY=A[1]+t*(B[1]-A[1]),cableY=C[1]+u*(D[1]-C[1]);cross.push({segment:i-1,roadFraction:t,cableFraction:u,at:[A[0]+t*rx,A[2]+t*rz],roadY,cableY,cabinFloorY:cableY-3.1,floorToRoad:cableY-3.1-roadY,source:'transport.ts sampled cable path; 3.1 m hang; centreline only'});}}}
writeFileSync(out,JSON.stringify({method:'Existing source endpoints; straight-chord samples on baked 5 m field at <=1 m. No dynamic region, road width or swept envelopes.',terrainHash:createHash('sha256').update(terrain).digest('hex'),scans,gondolaCrossings:cross},null,2));
console.log(JSON.stringify({scans:scans.map(({samples,...s})=>s),gondolaCrossings:cross,gondolaKeys:Object.keys(api.GONDOLA_LINE)},null,2));
