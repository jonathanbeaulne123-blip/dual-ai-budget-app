// Read-only Phase 0 inventory. Uses the real loader from road-audit; emits evidence only.
import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
const base=resolve('scripts/horizon/road-audit.mjs');
let source=readFileSync(base,'utf8').split('// ─── Read-only helpers')[0];
source=source.replace('fileURLToPath(import.meta.url)',JSON.stringify(base));
source=source.replace("`export {CRUISER}","`export {MOUNTAIN_ROAD_LINE} from './src/harbour/mountain/roads.ts';`,\n    `export {BRIDGE_SPANS} from './src/harbour/mountain/bridges.ts';`,\n    `export {CRUISER}");
source+=`
const OUTDIR=resolve('docs/horizon/evidence/mountain-road/before');mkdirSync(OUTDIR,{recursive:true});
const V2=JSON.parse(readFileSync(resolve(ROOT,'src/harbour/horizon/land/mountainV2/v2-data.json'),'utf8'));
const native=api.MOUNTAIN_ROAD_LINE.samples.map(p=>({...p,at:[p.at[0]+1308,p.at[1]+54,p.at[2]+764]}));
const groups=[];for(const p of native){if(Math.abs(p.curvature)<1/30)continue;let q=groups.at(-1);if(!q||p.s-q.at(-1).s>18)groups.push(q=[]);q.push(p);}
const hairpins=groups.filter(q=>q.at(-1).s-q[0].s>3).map((q,i)=>{const c=q.reduce((a,b)=>Math.abs(a.curvature)>Math.abs(b.curvature)?a:b);return{id:'H'+(i+1),s0:q[0].s,s1:q.at(-1).s,at:c.at,minRadius:1/Math.abs(c.curvature),guardLeft:c.left,guardRight:c.right,grade:c.grade,halfWidth:c.halfWidth};});
const v03=world.beds.find(b=>b.id==='V03');
const len=pts=>pts.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-pts[i][0],p[2]-pts[i][2]),0);
const joins=[{id:'Prow-mouth',at:v03.points[0]},{id:'V03-lane',at:v03.points.at(-1)},{id:'road-foot',at:V2.road.foot},{id:'summit',at:V2.road.top}];
for(const id of ['structure.mountainRoadTunnel','structure.mountainRoadCanalBridge']){const b=world.beds.find(b=>b.id===id);if(b)joins.push({id:id+'-east',at:b.points[0]},{id:id+'-west',at:b.points.at(-1)});}
for(const id of ['b-foot','b2','b3']){const pts=V2.road.samples.filter(p=>p.bridge===id);if(pts.length)joins.push({id:id+'-foot',at:pts[0].at},{id:id+'-summit',at:pts.at(-1).at});}
const samples=native.filter((p,i)=>i%3===0).map(p=>({s:p.s,at:p.at,halfWidth:p.halfWidth,grade:p.grade,left:p.left,right:p.right,ground:g.ground(p.at[0],p.at[2]),surface:g.surface(p.at[0],p.at[2],p.at[1]+.3,.8),contact:g.contact(p.at[0],p.at[2],p.at[1],.46)}));
const blockerProbes = [
  {id:'Foot',at:[1281.47,54.87,717.04]}, {id:'OrePortal',at:[1350.46,66.9,681.95]},
  {id:'LibraryFloor',at:[1386.69,87.64,597.86]}, {id:'DamFloor',at:[1286.49,123.85,541.57]}
].map(p=>({...p,ground:g.ground(p.at[0],p.at[2]),headroomSamples:[[0,0],[.46,0],[-.46,0],[0,.46],[0,-.46]].map(([dx,dz])=>({x:p.at[0]+dx,z:p.at[2]+dz,ceiling:g.ceiling(p.at[0]+dx,p.at[2]+dz,p.at[1])})),ceiling:g.ceiling(p.at[0],p.at[2],p.at[1]),blocker:g.blocker(p.at[0],p.at[2],p.at[1],.46),surface:g.surface(p.at[0],p.at[2],p.at[1]+.3,.8),levels:[-.6,0,.6,1.2,2].map(d=>({near:p.at[1]+d,surface:g.surface(p.at[0],p.at[2],p.at[1]+d,.48)}))}));
const output={blockerProbes,sha:rootSha,worldHash:sha(worldBytes),terrainHash:sha(terrainBytes),nativeLength:api.MOUNTAIN_ROAD_LINE.length,nativeSamples:native.length,exportSamples:V2.road.samples.length,v03PlanLength:len(v03.points),planLength:len(V2.road.samples.map(p=>p.at)),maxGrade:Math.max(...native.map(p=>p.grade)),minGrade:Math.min(...native.map(p=>p.grade)),hairpins,joins,samples,bridges:api.BRIDGE_SPANS,blocked:world.pathGraph.blocked.filter(b=>JSON.stringify(b).includes('mountainV2.road'))};
writeFileSync(resolve(OUTDIR,'inventory.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify({nativeLength:output.nativeLength,planLength:output.planLength,maxGrade:output.maxGrade,hairpins,joins},null,2));
`;
const tmp=resolve('scripts/horizon/.mountain-inventory-run.mjs');writeFileSync(tmp,source);try{await import(tmp+'?t='+Date.now());}finally{unlinkSync(tmp);}
