import {buildHorizonPrejoinSource} from '../scripts/horizon/bake-source';
import {createHash} from 'node:crypto';
import {transformSync} from 'esbuild';
import {createRegionGeography} from '../src/harbour/horizon/regions/mountainV2/geography';
import {prepareRegionGround} from '../src/harbour/horizon/regions/mountainV2/ground';
import {funicularFootPathPlacement,type FootPathArtProof} from '../src/harbour/horizon/regions/mountainV2/funicularFootPath';
import {MOUNTAIN_V2_OFFSET as O} from '../src/harbour/horizon/regions/mountainV2/placement';
import {PATH_EDGES} from '../src/harbour/mountain/pathGraph';
import {buildGroundPathArt} from '../src/harbour/mountain/art/routeArt';
import {mountainArtPalette} from '../src/harbour/mountain/art/palette';
import {SCENE_DRESSING} from '../src/harbour/scene/place';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {fitFootLaneJoin} from '../src/harbour/horizon/land/mountainV2/footLaneJoin';
import {mountainJoinRoadTop} from '../src/harbour/horizon/land/mountainV2/joins';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES} from '../src/harbour/horizon/runtime/geography';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2';
import {bedPath,pointAt,progressOf} from '../src/harbour/horizon/movers/board/situations';
import type {LandCuts} from '../src/harbour/horizon/land/interfaces';
const bytes=(p:string)=>{const b=readFileSync(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const world=parseHorizonDefinition(bytes('public/horizon/world/horizon-geo-1.json.gz'));
const servedTerrain=bytes('public/horizon/terrain/horizon-geo-1.bin');
// Build once from the exact production stages. Served compacted prisms and a
// selectively re-emitted neighbourhood are not interchangeable source inputs.
// This is intentionally real construction during collection, not a saved fixture.
const {cuts,buffer,field,ground}=buildHorizonPrejoinSource();
const sourceId=(s:LandCuts['solids'][number])=>s.sourceId??s.id.split('@')[0]!;
const isApron=(s:LandCuts['solids'][number])=>['mountainV2.footLane.apron','mountainV2.funicularFoot.apron'].includes(sourceId(s));
const isFittedSource=(s:LandCuts['solids'][number])=>/^(yearWalk|S1)\.(bed|surface|shoulders|batter)(\.|$)/.test(sourceId(s));
const originalPoints=JSON.stringify(cuts.beds.map(b=>[b.id,b.points]));
const untouched=JSON.stringify(cuts.solids.filter(s=>!isApron(s)&&!isFittedSource(s)));
fitFootLaneJoin(cuts,ground);
const finalRegion=createMountainV2Region({walkingJoinSolids:cuts.solids,horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:terraceBedExclusion(cuts.beds),exclude:mouthExclusion(cuts.mouths),terrainStep:field.step});
const geo=createHorizonGeography(field,cuts);geo.addDynamic(finalRegion.provider);
const lane=cuts.beds.find(b=>b.id==='mountainV2.footLane')!,path=bedPath(lane);
describe('visible Foot apron',()=>{
 it('uses byte-identical production terrain before asserting served/source geometry parity',()=>{
  const hash=(b:ArrayBuffer)=>createHash('sha256').update(new Uint8Array(b)).digest('hex');
  expect(hash(buffer)).toBe(hash(servedTerrain));
 });
 it('ends the visible Horizon join at the oblique native road edge without a proud interior triangle',()=>{
  // Regression: vertices outside the native end cap used to leave a 35.5 mm
  // Year Walk triangle above the native road at this interior point.
  const witness={x:1279.3497661352883,z:720.3418851595721};
  for(const dx of[-.01,0,.01])for(const dz of[-.01,0,.01]){
   const x=witness.x+dx,z=witness.z+dz,native=mountainJoinRoadTop(x,z,55.5);
   expect(native).not.toBeNull();
   const floor=geo.surface(x,z,native!,.5);expect(floor).not.toBeNull();
   expect(floor!.id).toBe('mountainV2:mountain-road');
   expect(Math.abs(floor!.y-native!)).toBeLessThan(.00001);
   expect(geo.contact(x,z,floor!.y,.25)).toBeNull();
  }
 });
 it('keeps both primary lanes and wider edge witnesses continuous in both directions',()=>{
  for(const offset of [-2.625,-2,0,2,2.625])for(const direction of [1,-1]){
   let previous:number|null=null;
   for(let n=0;n<=Math.floor((path.length-1)/.08);n++){
    const s=.5+n*.08,d=direction===1?s:path.length-s,p=pointAt(path,d),x=p.x-Math.cos(p.heading)*offset,z=p.z+Math.sin(p.heading)*offset;
    const floor=geo.surface(x,z,previous??p.y,.5);expect(floor).not.toBeNull();
    if(previous!==null)expect(Math.abs(floor!.y-previous)).toBeLessThan(.06);
    const native=mountainJoinRoadTop(x,z,floor!.y+.8);if(native!==null)expect(floor!.y).toBeLessThanOrEqual(native+.00001);
    expect(geo.contact(x,z,floor!.y,.25)).toBeNull();expect(geo.ceiling(x,z,floor!.y)-floor!.y).toBeGreaterThan(1.55);previous=floor!.y;
   }
  }
 });
 it('keeps new road faces below 12% and local walkable shoulders below 40 degrees',()=>{
  const inRoad=(x:number,z:number)=>lane.points.some((a,i)=>{
   const b=lane.points[i+1];if(!b)return false;
   const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),t=((x-a[0])*dx+(z-a[2])*dz)/(length*length);
   return t>=-(i===0?.5/length:0)&&t<=1+(i===lane.points.length-2?.5/length:0)&&Math.abs((x-a[0])*dz-(z-a[2])*dx)/length<=lane.width/2;
  });
  // These were exposed 51–89 degree slivers created by clipping a proud
  // interpolated knot beside the real native boundary. Include nearby faces,
  // not just centreline stations, so a sub-centimetre triangle cannot hide.
  for(const [x,y,z]of[[1278.611070900676,54.65748394302046,720.587334092059],[1284.0381584724093,54.657107356798555,719.6986301806443],[1282.346400842526,54.64775303895683,719.9510001721824],[1281.5560624085037,54.646521715998965,720.066414086224]]){
   const floor=geo.surface(x!,z!,y!,.5);expect(floor).not.toBeNull();
   expect(Math.tan(floor!.slope*Math.PI/180)).toBeLessThanOrEqual(.12+1e-7);
  }
  for(const mesh of cuts.solids.filter(s=>s.id.includes('.footJoin')||s.id==='mountainV2.footLane.apron'))for(let k=0;k<mesh.indices.length;k+=3){
   const v=mesh.indices.slice(k,k+3).map(i=>mesh.positions.slice(i*3,i*3+3));
   const a=v[0]!,b=v[1]!,c=v[2]!,u=b.map((n,j)=>n-a[j]!),w=c.map((n,j)=>n-a[j]!);
   const normal=[u[1]!*w[2]!-u[2]!*w[1]!,u[2]!*w[0]!-u[0]!*w[2]!,u[0]!*w[1]!-u[1]!*w[0]!];
   if(normal[1]!<=1e-9)continue;
   const grade=Math.hypot(normal[0]!,normal[2]!)/normal[1]!;
   expect(Math.atan(grade)*180/Math.PI,`${mesh.id} upward face ${k}`).toBeLessThanOrEqual(40+1e-7);
   for(const weights of[[1/3,1/3,1/3],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]]){
    const p=[0,1,2].map(j=>weights.reduce((sum,w,i)=>sum+w*v[i]![j]!,0));if(!inRoad(p[0]!,p[2]!))continue;
    const floor=geo.surface(p[0]!,p[2]!,p[1]!, .5);
    if(floor&&Math.abs(floor.y-p[1]!)<1e-5)expect(grade,`${mesh.id} exposed road face ${k}`).toBeLessThanOrEqual(.12+1e-7);
   }
  }
 });
 it('closes every fitted source mesh without open or nonmanifold edges',()=>{
  for(const mesh of cuts.solids.filter(s=>s.id.includes('.footJoin')||s.id==='mountainV2.footLane.apron')){
   const edges=new Map<string,{count:number;balance:number}>();
   for(let i=0;i<mesh.indices.length;i+=3)for(let k=0;k<3;k++){
    const a=mesh.indices[i+k]!,b=mesh.indices[i+(k+1)%3]!,key=a<b?`${a}:${b}`:`${b}:${a}`;
    const edge=edges.get(key)??{count:0,balance:0};edge.count++;edge.balance+=a<b?1:-1;edges.set(key,edge);
   }
   for(const [key,edge]of edges){
    expect(edge.count,`${mesh.id} edge ${key} incidence`).toBe(2);
    expect(edge.balance,`${mesh.id} edge ${key} winding`).toBe(0);
   }
  }
 });
 it('preserves source routes and unrelated geometry and owns one real closed apron',()=>{
  expect(JSON.stringify(cuts.beds.map(b=>[b.id,b.points]))).toBe(originalPoints);
  expect(JSON.stringify(cuts.solids.filter(s=>!isApron(s)&&!isFittedSource(s)))).toBe(untouched);
  const apron=cuts.solids.find(s=>s.id==='mountainV2.footLane.apron')!;expect(apron.walkable).toBe(true);expect(apron.bedIds).toContain(lane.id);
  for(let i=0;i<apron.positions.length;i+=6){
   const x=apron.positions[i]!,y=apron.positions[i+1]!,z=apron.positions[i+2]!,bottom=apron.positions[i+4]!;
   expect(bottom).toBeLessThanOrEqual(ground(x,z)-.099);expect(bottom).toBeLessThan(y);
   const native=mountainJoinRoadTop(x,z,y+.8);if(native!==null)expect(y).toBeLessThanOrEqual(native-.0049);
  }
  const once=JSON.stringify(cuts.solids);fitFootLaneJoin(cuts,ground);expect(JSON.stringify(cuts.solids)).toBe(once);
 });
});

const PRIOR_LIPS=[[1291.0616961611452, 55.410710511213495, 732.8975668732534], [1291.0484012127652, 55.64381738567546, 732.9125082368984], [1291.0711863525007, 55.4105928710155, 732.9060113236519], [1291.0578914041207, 55.640663698833926, 732.9209526872969], [1291.080676543856, 55.41047421299712, 732.9144557740506], [1291.067381595476, 55.63744193674016, 732.9293971376956], [1291.0806765382963, 55.41047421301289, 732.9144557743922], [1291.0939714797055, 55.64737857445139, 732.8995144045446], [1291.071186338601, 55.41059287105439, 732.9060113245059], [1291.08448128001, 55.65053226129295, 732.8910699546583], [1285.1309228876328, 54.904302359268215, 726.8793056016656], [1285.1577223680765, 54.9672902655398, 726.8975874029039], [1285.218333960715, 55.05977819459056, 726.8663036811555], [1285.232563585249, 54.9486247432568, 726.8183311221183], [1285.2145912091926, 54.88222865800711, 726.7898933142326], [1285.8426667654728, 54.67089375071819, 720.4688733289892], [1285.8429999674213, 54.6716750224434, 720.4770181849442], [1285.8633715454189, 54.66530108470719, 720.4856921888901], [1285.863620782803, 54.666013755623545, 720.4917845980239], [1285.8844435923354, 54.599977, 720.4707633516753], [1286.0169388094075, 55.04608570325797, 725.9837257107027], [1285.8577704606857, 55.01313203485238, 725.440526450058], [1285.8812310630808, 55.13427196051616, 725.4614018990591], [1286.0702821316004, 55.197752586771585, 726.0311910648841], [1285.8485243784028, 54.748149525072094, 721.4621972547334], [1285.8922279719652, 54.81462365810997, 721.410728976002]];


// Funicular repair regressions: source fixture and actual served assets remain
// separate. No source fixture can make the served-apron checks pass before bake.
const nativeWalk=(id:string)=>PATH_EDGES.find(p=>p.id===id)!;
const funicular=nativeWalk('path:station:funicular:town~road:foot'),town=nativeWalk('path:town:north~station:funicular:town');
const toWorld=(p:readonly (readonly number[])[])=>p.map(v=>[v[0]!+O.x,v[1]!+O.y,v[2]!+O.z] as [number,number,number]);
const funicularPoints=toWorld(funicular.points),townPoints=toWorld(town.points);
const year=cuts.beds.find(b=>b.id==='yearWalk')!,yearStart=year.points.findIndex(p=>Math.hypot(p[0]-1284.37,p[2]-719.65)<.02);
if(yearStart<1)throw new Error('Missing authored Year Walk crossing');
const yearPoints=year.points.slice(yearStart-1,yearStart+5).map(p=>[p[0],p[1],p[2]] as [number,number,number]);
const physical=createRegionGeography({walkingJoinSolids:cuts.solids,horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:terraceBedExclusion(cuts.beds),exclude:mouthExclusion(cuts.mouths)});
const preparedByTier=new Map<'full'|'lite',ReturnType<typeof prepareRegionGround>>();
function preparedFor(tier:'full'|'lite'){
 let p=preparedByTier.get(tier);if(!p){p=prepareRegionGround(tier,physical.contains,field.step,new Map(),physical.groundCeiling,physical.walkingGroundPatch);preparedByTier.set(tier,p);}return p;
}
function sweep(points:typeof funicularPoints,offset:number,reverse:boolean){
 const pth=bedPath({points:reverse?[...points].reverse():points}),failures:unknown[]=[];let failuresTotal=0,previous:number|null=null,last:{x:number;z:number}|null=null,count=0;
 const fail=(w:unknown)=>{failuresTotal++;if(failures.length<12)failures.push(w);};
 for(let d=.2;d<pth.length-.2;d+=.04){
  const p=pointAt(pth,d),next={x:p.x-Math.cos(p.heading)*offset,z:p.z+Math.sin(p.heading)*offset},from=last??next,n=Math.max(1,Math.ceil(Math.hypot(next.x-from.x,next.z-from.z)/.04));
  for(let j=1;j<=n;j++){
   const x=from.x+(next.x-from.x)*j/n,z=from.z+(next.z-from.z)*j/n,f=geo.surface(x,z,previous??p.y,.5);count++;
   if(!f){fail({x,z,reason:'no floor'});continue;}
   const delta=previous===null?0:Math.abs(previous-f.y),contact=geo.contact(x,z,f.y,.3),headroom=geo.ceiling(x,z,f.y)-f.y,water=geo.waterLevel(x,z,f.y);
   if(f.slope>40+1e-7||delta>=.06||contact||headroom<1.55||(water!==null&&f.y<=water))fail({x,z,f,delta,contact,headroom,water});previous=f.y;
  }last=next;
 }return {offset,reverse,count,failuresTotal,failures};
}
const runtimeWalkingSource=readFileSync('src/harbour/horizon/runtime/index.ts','utf8'),walkingStart=runtimeWalkingSource.indexOf('  function move(dx:number'),walkingEnd=runtimeWalkingSource.indexOf('  let emote:',walkingStart);
if(walkingStart<0||walkingEnd<=walkingStart)throw new Error('Update exact runtime walking extraction');
type TestBody={x:number;y:number;z:number;yaw:number};
const walkingCode=transformSync(`function make(body,geography,world,HORIZON_WALKABLE_DEGREES){let held=false,leftSupport=false,velocityY=0,swimming=false,lastMovementBlocker=null;const gateOpen=()=>true;const waterLevel=(x,z,y)=>geography.waterLevel(x,z,y);${runtimeWalkingSource.slice(walkingStart,walkingEnd)}return{move,report:()=>({leftSupport,lastMovementBlocker})}}`,{loader:'ts'}).code;
const makeWalker=new Function(`${walkingCode};return make;`)() as (body:TestBody,g:typeof geo,w:typeof world,limit:number)=>{move:(dx:number,dz:number,dt:number)=>void;report:()=>{leftSupport:boolean;lastMovementBlocker:unknown}};
function ordinaryWalk(points:typeof funicularPoints,offset:number,reverse:boolean){
 const pth=bedPath({points:reverse?[...points].reverse():points}),p=pointAt(pth,.2),sign=reverse?-1:1,ox=-Math.cos(p.heading)*offset*sign,oz=Math.sin(p.heading)*offset*sign,body={x:p.x+ox,y:p.y,z:p.z+oz,yaw:p.heading};
 const initial=geo.surface(body.x,body.z,body.y,.48);if(!initial)return{offset,reverse,reason:'no initial floor',body};body.y=initial.y;
 const walker=makeWalker(body,geo,world,HORIZON_WALKABLE_DEGREES);let progress=.2,checkpoint=.2,stall=0;
 for(let frame=0;frame<3600;frame++){
  progress=Math.max(progress,progressOf(pth,body.x-ox,body.z-oz,progress,20).d);
  if(progress>=pth.length-.2)return{offset,reverse,reason:'end',progress,restarts:0};
  if(progress>checkpoint+.05){checkpoint=progress;stall=0;}else if(++stall>180)return{offset,reverse,reason:'stalled',progress,body,blocker:walker.report().lastMovementBlocker};
  const target=pointAt(pth,Math.min(pth.length,progress+.8)),dx=target.x+ox-body.x,dz=target.z+oz-body.z,l=Math.hypot(dx,dz);if(l<1e-8)return{offset,reverse,reason:'no target',body};
  const step=Math.min(l,2.4/60);walker.move(dx/l*step,dz/l*step,1/60);
  const support=geo.surface(body.x,body.z,body.y,.02);if(walker.report().leftSupport||!support||Math.abs(body.y-support.y)>.05)return{offset,reverse,reason:'lost floor',body,support};
 }return{offset,reverse,reason:'timeout',body};
}
function topHeight(t:readonly (readonly number[])[],x:number,z:number):number|null{
 const[a,b,c]=t,ux=b![0]!-a![0]!,uz=b![2]!-a![2]!,vx=c![0]!-a![0]!,vz=c![2]!-a![2]!,det=ux*vz-uz*vx;if(Math.abs(det)<1e-12)return null;
 const u=((x-a![0]!)*vz-(z-a![2]!)*vx)/det,v=(ux*(z-a![2]!)-uz*(x-a![0]!))/det;
 return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7?a![1]!+(b![1]!-a![1]!)*u+(c![1]!-a![1]!)*v:null;
}
const weights=[[1/3,1/3,1/3],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]];

describe('funicular walking repair permanent contracts',()=>{
 it('removes the exact previously recorded lip neighborhoods without a grade or step waiver',()=>{
  const failures:unknown[]=[];let failuresTotal=0,samples=0;
  for(const[x,y,z]of PRIOR_LIPS)for(const dx of[-.015,-.005,0,.005,.015])for(const dz of[-.015,-.005,0,.005,.015]){
   const f=geo.surface(x!+dx,z!+dz,y!,.5);samples++;
   if(!f||f.slope>40+1e-7){failuresTotal++;if(failures.length<12)failures.push({x:x!+dx,z:z!+dz,f});continue;}
   for(const[ex,ez]of[[.005,0],[0,.005]]){const q=geo.surface(x!+dx+ex!,z!+dz+ez!,f.y,.5);if(!q||Math.abs(q.y-f.y)>=.06){failuresTotal++;if(failures.length<12)failures.push({x:x!+dx,z:z!+dz,f,q});}}
  }expect(samples).toBe(PRIOR_LIPS.length*25);expect({failuresTotal,failures}).toEqual({failuresTotal:0,failures:[]});
 });
 it('sweeps the native funicular and Year Walk full widths and town body-safe ±1.3m lanes continuously',()=>{
  const results=[];for(const[points,offsets]of[[funicularPoints,[-1.8,-1.5,0,1.5,1.8]],[yearPoints,[-2.3,0,2.3]],[townPoints,[-1.3,0,1.3]]] as const)for(const off of offsets)for(const reverse of[false,true])results.push(sweep(points,off,reverse));
  expect(results).toHaveLength(22);expect(results.filter(r=>r.count===0||r.failuresTotal)).toEqual([]);
 },60000);
 it('records the unchanged post contacts outside the town body-safe centre envelope',()=>{
  expect(town.halfWidth-.3).toBeCloseTo(1.3,10);
  const witnesses=[[1292.7439527978524,725.7673373429574],[1292.9829957413067,725.6774354370818]];
  for(const[x,z]of witnesses){const f=geo.surface(x!,z!,55.65,.5);expect(f).not.toBeNull();expect(geo.contact(x!,z!,f!.y,.3)?.id).toBe('mountainV2:station-art:funicular:town:post:2');}
 });
 it('completes fourteen ordinary walking attempts without a restart or loss of support',()=>{
  const results=[];for(const[points,offsets]of[[funicularPoints,[-1.45,0,1.45]],[yearPoints,[0]],[townPoints,[-1.25,0,1.25]]] as const)for(const off of offsets)for(const reverse of[false,true])results.push(ordinaryWalk(points,off,reverse));
  expect(results).toHaveLength(14);expect(results.filter(r=>r.reason!=='end')).toEqual([]);
 },60000);
 it.each(['full','lite'] as const)('uses the same canonical physical mesh in the actual %s render buffers',tier=>{
  const p=preparedFor(tier),patch=physical.walkingGroundPatch!;expect(patch).toBeDefined();expect(p.walkingPatch).toBe(patch);
  const r=p.render;expect(r.positions.slice(r.baseVertices*3,(r.baseVertices+r.patchVertices)*3)).toEqual(patch.lattice.positions);
  expect(Array.from(r.indices.slice(r.patchIndexStart,r.patchIndexStart+r.patchIndexCount),i=>i-r.baseVertices)).toEqual(Array.from(patch.lattice.indices));
 });
});

describe('funicular picture against final physical and rendered support',()=>{
 it.each((['full','lite'] as const).flatMap(tier=>(['classic','taylor','newfoundland'] as const).map(theme=>({tier,theme}))))('retains native outside art and seats repaired art in $tier / $theme',({tier,theme})=>{
  const prepared=preparedFor(tier),pal=mountainArtPalette(SCENE_DRESSING[theme]),failures:unknown[]=[];let failureCount=0,repairedSamples=0,preservedSamples=0;
  const fail=(w:unknown)=>{failureCount++;if(failures.length<12)failures.push(w);};
  for(const path of[funicular,town]){
   const proof:FootPathArtProof={ribbon:[],stones:[],preservedRibbon:[],preservedStones:[],discardedFans:[]};
   const emitted:number[][][]=[],boxes:number[][]=[];
   const builder={ink:[0,0,0],pencil:[0,0,0],tri:(a:number[],b:number[],c:number[])=>emitted.push([a,b,c]),quad:(a:number[],b:number[],c:number[],d:number[])=>{emitted.push([a,b,c],[a,c,d]);},box:(...args:unknown[])=>boxes.push(args.slice(0,7).map(Number))} as unknown as Parameters<typeof buildGroundPathArt>[0];
   const originalTriangles:number[][][]=[],originalBoxes:number[][]=[];
   buildGroundPathArt(builder,pal,tier,path,{band(points){originalTriangles.push(toWorld([points[0]!,points[1]!,points[2]!]),toWorld([points[0]!,points[2]!,points[3]!]));return false;},stone(s){originalBoxes.push([s.x,s.z,s.yaw,s.hx,s.hz,s.bottom,s.top]);return false;}});
   const placement=funicularFootPathPlacement(cuts.solids,prepared,proof);expect(placement(builder,pal,tier,path)).toBe(true);expect(emitted.length).toBeGreaterThan(0);
   for(const t of emitted)if(t.some(p=>p.some(n=>!Number.isFinite(n))))fail({path:path.id,reason:'nonfinite emitted geometry',t});
   for(const t of proof.ribbon)for(const w of weights){
    const p=[0,1,2].map(j=>t.reduce((n,v,k)=>n+v[j]!*w[k]!,0)),f=geo.surface(p[0]!,p[2]!,p[1]!, .5),gap=f?p[1]!-f.y:null;repairedSamples++;
    if(gap===null||gap<.035||gap>.06)fail({path:path.id,p,f,gap});
   }
   // Clipped outside pieces must retain their original native triangle plane;
   // comparing against old floor alone would miss a changed floating picture.
   for(const t of proof.preservedRibbon??[])for(const w of weights){
    const p=[0,1,2].map(j=>t.reduce((n,v,k)=>n+v[j]!*w[k]!,0));preservedSamples++;
    if(!originalTriangles.some(t=>{const y=topHeight(t,p[0]!,p[2]!);return y!==null&&Math.abs(y-p[1]!)<1e-8;}))fail({path:path.id,reason:'outside native plane changed',p});
   }
   for(const s of proof.preservedStones??[]){
    const matches=originalBoxes.filter(b=>Math.hypot(b[0]!+O.x-s.x,b[1]!+O.z-s.z)<1e-8&&Math.abs(b[5]!+O.y-s.bottom)<1e-8&&Math.abs(b[6]!+O.y-s.top)<1e-8);
    if(matches.length!==1||!boxes.some(b=>b.every((v,i)=>Math.abs(v-matches[0]![i]!)<1e-10)))fail({path:path.id,reason:'outside native stone changed',s});
   }
   for(const s of proof.stones){
    const b=boxes.find(b=>Math.hypot(b[0]!+O.x-s.x,b[1]!+O.z-s.z)<1e-8&&Math.abs(b[5]!+O.y-s.bottom)<1e-8&&Math.abs(b[6]!+O.y-s.top)<1e-8);
    if(!b){fail({path:path.id,reason:'repaired stone not emitted',s});continue;}
    const[x,z,yaw,hx,hz,bottom,top]=b as [number,number,number,number,number,number,number];
    for(const u of[-hx,hx])for(const v of[-hz,hz]){const px=x+O.x+u*Math.cos(yaw)+v*Math.sin(yaw),pz=z+O.z-u*Math.sin(yaw)+v*Math.cos(yaw),f=geo.surface(px,pz,top+O.y,.5);if(!f||bottom+O.y>f.y||top+O.y<f.y)fail({path:path.id,reason:'repaired stone support',px,pz,f,bottom:bottom+O.y,top:top+O.y});}
   }
  }
  expect(repairedSamples).toBeGreaterThan(0);expect(preservedSamples).toBeGreaterThan(0);expect({failureCount,failures}).toEqual({failureCount:0,failures:[]});
 },60000);
});

describe('actual served funicular apron, never satisfied by the source fixture',()=>{
 it('contains the final source apron, a shared logical origin, closed topology and walkable rendered tops',()=>{
  const served=world.geometry.solids.filter(s=>sourceId(s)==='mountainV2.funicularFoot.apron'),source=cuts.solids.find(s=>sourceId(s)==='mountainV2.funicularFoot.apron')!;
  expect(served.length,'fresh final bake must publish the apron').toBeGreaterThan(0);expect(source.renderOrigin).toBeDefined();
  // Match every actual baked face to final source at the serializer's nine decimals.
  const faceKeys=(meshes:LandCuts['solids'])=>meshes.flatMap(mesh=>Array.from({length:mesh.indices.length/3},(_,k)=>mesh.indices.slice(k*3,k*3+3).map(i=>mesh.positions.slice(i*3,i*3+3).map(v=>Number(v.toFixed(9))).join(',')).sort().join('|'))).sort();
  expect(faceKeys(served)).toEqual(faceKeys([source]));
  const failures:unknown[]=[];let failureCount=0,faces=0;const fail=(w:unknown)=>{failureCount++;if(failures.length<12)failures.push(w);};
  for(const mesh of served){
   if(!mesh.renderOrigin||mesh.renderOrigin.some((v,i)=>!Number.isFinite(v)||Math.abs(v-source.renderOrigin![i]!)>1e-8)){fail({id:mesh.id,reason:'missing or stale render origin',origin:mesh.renderOrigin});continue;}
   const edges=new Map<string,{count:number;balance:number}>(),origin=mesh.renderOrigin;
   for(let k=0;k<mesh.indices.length;k+=3){
    const ids=mesh.indices.slice(k,k+3),p=ids.map(i=>mesh.positions.slice(i*3,i*3+3));faces++;
    const sourceTop=(p[1]![2]!-p[0]![2]!)*(p[2]![0]!-p[0]![0]!)-(p[1]![0]!-p[0]![0]!)*(p[2]![2]!-p[0]![2]!)>1e-9;
    for(const variant of['served','rendered'] as const){
     const q=variant==='served'?p:p.map(v=>v.map((n,j)=>Math.fround(n-origin[j]!)+origin[j]!)),[a,b,c]=q,u=b!.map((v,j)=>v-a![j]!),v=c!.map((v,j)=>v-a![j]!),n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!],length=Math.hypot(...n);
     if(!Number.isFinite(length)||length<=1e-12||(sourceTop&&n[1]!<1e-8)||(n[1]!>0&&Math.atan2(Math.hypot(n[0]!,n[2]!),n[1]!)*180/Math.PI>40+1e-7))fail({id:mesh.id,k,variant,n,q});
    }
    for(let j=0;j<3;j++){const a=ids[j]!,b=ids[(j+1)%3]!,key=a<b?`${a}:${b}`:`${b}:${a}`,e=edges.get(key)??{count:0,balance:0};e.count++;e.balance+=a<b?1:-1;edges.set(key,e);}
   }
   for(const[key,e]of edges)if(e.count!==2||e.balance!==0)fail({id:mesh.id,key,e});
  }expect(faces).toBeGreaterThan(0);expect({failureCount,failures}).toEqual({failureCount:0,failures:[]});
 });
 it('delivers every local above-ground host in the same complete chunk as the apron',()=>{
  const served=world.geometry.solids.filter(s=>sourceId(s)==='mountainV2.funicularFoot.apron');expect(served.length).toBeGreaterThan(0);
  const districts=new Set(served.map(s=>s.districtId));expect([...districts]).toEqual(['lakeside']);
  const patch=physical.walkingGroundPatch!,b=patch.bounds,h=patch.lattice.positions;
  let minY=Infinity,maxY=-Infinity;for(let k=1;k<h.length;k+=3){minY=Math.min(minY,h[k]!+O.y);maxY=Math.max(maxY,h[k]!+O.y);}
  for(const s of served)for(let k=1;k<s.positions.length;k+=3)maxY=Math.max(maxY,s.positions[k]!);
  const separatelyDelivered:unknown[]=[];let hosts=0;
  for(const s of world.geometry.solids){if(!s.walkable)continue;let relevantHost=false;
   for(let k=0;k<s.indices.length;k+=3){const p=s.indices.slice(k,k+3).map(i=>s.positions.slice(i*3,i*3+3)),[a,c,d]=p,ny=(c![2]!-a![2]!)*(d![0]!-a![0]!)-(c![0]!-a![0]!)*(d![2]!-a![2]!);if(ny<=1e-9)continue;
    const x=p.map(v=>v[0]!),z=p.map(v=>v[2]!),y=p.map(v=>v[1]!);
    if(Math.max(...x)<b.x0+O.x||Math.min(...x)>b.x1+O.x||Math.max(...z)<b.z0+O.z||Math.min(...z)>b.z1+O.z||Math.max(...y)<minY-.01||Math.min(...y)>maxY+.5)continue;
    relevantHost=true;break;
   }if(relevantHost){hosts++;if(!districts.has(s.districtId))separatelyDelivered.push({id:s.id,sourceId:sourceId(s),district:s.districtId});}
  }expect(hosts).toBeGreaterThan(1);expect(separatelyDelivered).toEqual([]);
 });
});
