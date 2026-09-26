import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { addFlatPad, bed, heightOnBeds } from '../beds/profiles';
import { gradeRoute, sampleSpline } from '../beds/solver';
import { baseHeight } from '../terrain';
import { buildWaterCuts } from '../water';
import { FOOTING_SINK, GROUND_CONTACT, pier, wallToGround } from './foundations';
import { box, clamp, distance, districtAt, mix, nearestOnPath, plan, slab, solid } from './mesh';

export interface SpanSpec { id:string; at:XY; route:string; length:number; width:number; height?:number; clear?:number; covered?:boolean; supportSpacing?:number; /** A clear opening centred on the span, carried by a through truss. */ opening?:number; /** Build abutments to the ground at both ends. */ abutments?:boolean; /** v1.9: the deck follows the route's own graded points (plan and height) instead of a level chord. */ followRoute?:boolean }
export const SPANS:SpanSpec[]=[
  {id:'highSpan',at:[1240,1105],route:'VG',length:104,width:10,height:24,clear:14,supportSpacing:12,opening:44},
  {id:'quayBridge',at:[1350,1345],route:'V01',length:90,width:16,height:9,clear:4},
  {id:'bightBridge',at:[560,1100],route:'V01',length:230,width:17,height:12,clear:8,abutments:true},
  {id:'apronBridge',at:[1158,949],route:'S1',length:45,width:4,height:31,clear:5},
  {id:'hollowBridge',at:[893,600],route:'walk garden',length:32,width:8,height:37,clear:4,covered:true},
  {id:'inletFootbridge',at:[1161,731],route:'walk lakerim',length:28,width:3,height:55,clear:4},
  {id:'reachFootbridge',at:[1274,1203],route:'walk reach',length:48,width:3,height:9.5,clear:4},
  {id:'reachBoardwalk',at:[1255,1251],route:'S1',length:112,width:4,height:5,clear:1},
  {id:'timberCrossing',at:[1500,1250],route:'homestead.lane',length:20,width:3,height:5,clear:2},
  // v1.9 named footbridges (MANIFEST structures.<id> with route + span_m): a foot route over a lower
  // route's corridor on its own grade, bents outside the corridor, a truss over the opening.
  ...Object.entries(M.structures as unknown as Record<string,{xy?:number[];route?:string;span_m?:number;opening_m?:number;width_m?:number}>)
    .filter(([,s])=>s&&typeof s==='object'&&s.route&&s.span_m&&s.xy)
    .map(([id,s]):SpanSpec=>({id,at:s.xy as unknown as XY,route:s.route!,length:s.span_m!,width:s.width_m??3.2,clear:2.4,supportSpacing:7,...(s.opening_m?{opening:s.opening_m}:{}),followRoute:true})),
];
/** Stair and landing supports stand no further apart than this (plan eu). */
const STAIR_BENT=6;
/** Below this drop a stair stands on masonry cheek walls; above it on stringers, piers and footings. */
const CHEEK_MAX=2.5;
/** Longest clear stringer span a stair may take over a protected lane before it must refuse. */
const STAIR_CLEAR_MAX=24;
const conflict=(cuts:LandCuts,id:string,message:string,at:XY,measured?:number,required?:number)=>cuts.diagnostics.push({id,severity:'conflict',message,at:[Number(at[0].toFixed(2)),Number(at[1].toFixed(2))],...(measured===undefined?{}:{measured}),...(required===undefined?{}:{required})});

function axisAt(b:BedCut|undefined,at:XY):XY {
  if(!b)return [1,0];const n=nearestOnPath(at,b.points),a=b.points[n.segment]!,p=b.points[Math.min(n.segment+1,b.points.length-1)]!,len=distance(plan(a),plan(p))||1;return [(p[0]!-a[0]!)/len,(p[2]!-a[2]!)/len];
}
/** Point and unit direction at an arc length along a polyline. */
function along(path:readonly XYZ[],s:number):{p:XYZ;dir:XY} {
  let run=0;
  for(let i=1;i<path.length;i++){const a=path[i-1]!,b=path[i]!,len=distance(plan(a),plan(b));if(len<1e-9)continue;if(run+len>=s||i===path.length-1){const t=clamp((s-run)/len,0,1);return {p:[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)],dir:[(b[0]-a[0])/len,(b[2]-a[2])/len]};}run+=len;}
  const p=path[0]!;return {p,dir:[1,0]};
}
const planLength=(path:readonly XYZ[])=>path.slice(1).reduce((n,p,i)=>n+distance(plan(path[i]!),plan(p)),0);
/** The route's own graded points within ±length/2 of the nearest station to `centre`, ends interpolated. */
/** R2-03: eu of floor apron past each road-tunnel portal (the mouth mask reaches 3 eu outside the face). */
export const PORTAL_APRON=6.5;
/** R2-03: eu a road tunnel's mouth mask reaches outside the portal face. At 3 the lite tier's 10 m lattice kept a visible
 * sliver of the cut-to-cover ramp (the phone's body met 69 deg ground at [1444.1,420.1]); at 6 the whole ramp row is masked. */
export const PORTAL_MOUTH_OUT=6;
/** R2-03: eu each tunnel floor piece laps its neighbours (no wedge slit at a bend). */
export const FLOOR_LAP=.5;
function routeStretch(route:BedCut,centre:XY,length:number,height?:number):XYZ[] {
  const mid=nearestOnPath(centre,route.points).along,total=planLength(route.points),from=clamp(mid-length/2,0,total),to=clamp(mid+length/2,0,total);
  const out:XYZ[]=[along(route.points,from).p];let run=0;
  for(let i=1;i<route.points.length;i++){run+=distance(plan(route.points[i-1]!),plan(route.points[i]!));if(run>from+.5&&run<to-.5)out.push(route.points[i]!);}
  out.push(along(route.points,to).p);
  return height===undefined?out:out.map(p=>[p[0],height,p[2]] as XYZ);
}
/** Lower routes and boat lanes a footing may not stand in. */
function laneGuard(cuts:LandCuts):(xy:XY,above:number,ownBeds:readonly string[])=>string|undefined {
  const lanes:{id:string;pts:XY[];half:number}[]=[{id:'FERRY',pts:sampleSpline(M.water_routes.FERRY.pts as unknown as XY[],4),half:7},{id:'RIVER_RUN',pts:sampleSpline(M.water_routes.RIVER_RUN.pts as unknown as XY[],4),half:4}];
  const segDistance=(p:XY,a:XY,b:XY)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return distance(p,[a[0]+t*dx,a[1]+t*dz]);};
  return (xy,above,own)=>{
    for(const lane of lanes)for(let i=1;i<lane.pts.length;i++)if(segDistance(xy,lane.pts[i-1]!,lane.pts[i]!)<lane.half)return lane.id;
    for(const b of cuts.beds){
      if(b.kind==='cable'||b.kind==='cave'||b.kind==='rail'||own.includes(b.id))continue;const margin=b.width/2+b.shoulder+1.1;
      for(let j=1;j<b.points.length;j++){const s=b.points[j-1]!,e=b.points[j]!;
        if(xy[0]<Math.min(s[0],e[0])-margin||xy[0]>Math.max(s[0],e[0])+margin||xy[1]<Math.min(s[2],e[2])-margin||xy[1]>Math.max(s[2],e[2])+margin)continue;
        const dx=e[0]-s[0],dz=e[2]-s[2],t=clamp(((xy[0]-s[0])*dx+(xy[1]-s[2])*dz)/(dx*dx+dz*dz||1),0,1);
        if(mix(s[1],e[1],t)<above-1.25&&distance(xy,[mix(s[0],e[0],t),mix(s[2],e[2],t)])<margin)return b.id;}
    }
    return undefined;
  };
}
/** Rail posts every ≤ 2 eu with a bar between each pair, so a clipped junction removes only a local bay. */
function postedRail(rails:StructureSolid,path:readonly XYZ[],offset:number,height=1.05,spacing=2):void {
  const length=planLength(path),n=Math.max(1,Math.ceil(length/spacing));let prev:XYZ|undefined;
  for(let k=0;k<=n;k++){const {p,dir}=along(path,length*k/n),xy:XY=[p[0]-dir[1]*offset,p[2]+dir[0]*offset];box(rails,xy,p[1]+height,[.1,.1],p[1]-.35);const top:XYZ=[p[0],p[1],p[2]];if(prev)slab(rails,prev,top,.09,.09,offset,height);prev=top;}
}
/** Deck → bearing → pier → footing: every span lists its supports; a support that would stand in a lower lane refuses and reports. */
export function buildSpan(spec:SpanSpec,cuts:LandCuts,base:HeightQuery):void {
  const route=cuts.beds.find(b=>b.id===spec.route),axis=axisAt(route,spec.at),normal:XY=[-axis[1]!,axis[0]!];
  const h=spec.height??heightOnBeds(cuts,spec.at,base),a:XYZ=[spec.at[0]!-axis[0]!*spec.length/2,h,spec.at[1]!-axis[1]!*spec.length/2],b:XYZ=[spec.at[0]!+axis[0]!*spec.length/2,h,spec.at[1]!+axis[1]!*spec.length/2];
  const curve=(spec.id==='quayBridge'||spec.id==='highSpan')&&route?routeStretch(route,spec.at,spec.length+6,h):spec.followRoute&&route?routeStretch(route,spec.at,spec.length):[];
  const path=curve.length>1?curve:[a,b],length=planLength(path),bedIds=[spec.route,`structure.${spec.id}`];
  const deck=solid(`${spec.id}.deck`,spec.covered?'coveredFootbridge':'bridge','stone','deck',[spec.route],districtAt(...spec.at));for(let i=1;i<path.length;i++)slab(deck,path[i-1]!,path[i]!,spec.width,.6);
  const piers=solid(`${spec.id}.supports`,'pier','stone','support',bedIds,deck.districtId),rails=solid(`${spec.id}.rails`,'parapet','stone','rail',[spec.route],deck.districtId);
  const spacing=spec.supportSpacing??12,half=length/2;let stations:number[]=[];
  if(spec.opening){const o=spec.opening/2,n=Math.max(1,Math.ceil((half-o)/spacing));for(let k=0;k<=n;k++){const s=o+(half-o)*k/n;stations.push(half-s,half+s);}}
  else{const n=Math.max(1,Math.ceil(length/spacing));stations=Array.from({length:n+1},(_,k)=>length*k/n);}
  stations.sort((x,y)=>x-y);
  const placed:number[]=[],guard=spec.followRoute?laneGuard(cuts):undefined;
  const bentAt=(s:number)=>{const {p,dir}=along(path,s);return {p,top:spec.followRoute?p[1]:h,feet:[-1,1].map(side=>[p[0]-dir[1]*side*(spec.width/2-.6),p[2]+dir[0]*side*(spec.width/2-.6)] as XY)};};
  const laneAt=(s:number)=>{if(!guard)return undefined;const b=bentAt(s);return b.feet.map(xy=>guard(xy,b.top,[spec.route,`structure.${spec.id}`])).find(Boolean);};
  for(const s0 of stations){
    // A named footbridge never stands a bent in a lower route's corridor: the bent moves outward (away
    // from the opening) up to 6 eu to the first free ground, or it is refused and reported.
    let s=s0;const out=s0<half?-1:1;
    for(let shift=0;shift<=6&&laneAt(s);shift++)s=clamp(s0+out*shift,0,length);
    const lane=laneAt(s);
    if(lane){conflict(cuts,`structures.${spec.id}.bentInLane`,`${spec.id}: the bent at ${s0.toFixed(1)} eu stands in ${lane}'s corridor (and 6 eu outward); it is not built`,plan(bentAt(s0).p));continue;}
    const {feet,top}=bentAt(s);
    for(const xy of feet){pier(piers,xy,top-.9,base,[.8,.8],[2.4,2.4]);box(piers,xy,top-.5,[1.4,1.4],top-.9);}
    placed.push(s);
  }
  placed.sort((x,y)=>x-y);
  // Supports within 15 eu of every point of the deck, or a truss carrying the opening.
  for(let i=1;i<placed.length;i++)if(placed[i]!-placed[i-1]!>30.01&&!(spec.opening&&(Math.abs((placed[i]!+placed[i-1]!)/2-half)<1||spec.followRoute&&placed[i-1]!<half&&placed[i]!>half))){const m=along(path,(placed[i]!+placed[i-1]!)/2).p;conflict(cuts,`structures.${spec.id}.bay`,`${spec.id}: a ${(placed[i]!-placed[i-1]!).toFixed(1)} eu bay exceeds the 30 eu masonry limit`,plan(m),placed[i]!-placed[i-1]!,30);}
  if(spec.opening){
    // A through truss over the gate opening: bottom chords under the deck edges bear on the flanking pier caps.
    // The truss bears on the innermost bents either side of the opening (named footbridges may have moved them outward).
    const inner=[Math.max(...placed.filter(x=>x<half),half-spec.opening/2),Math.min(...placed.filter(x=>x>half),half+spec.opening/2)];
    const truss=solid(`${spec.id}.truss`,'truss','metal','support',bedIds,deck.districtId),from=spec.followRoute?inner[0]!:half-spec.opening/2,to=spec.followRoute?inner[1]!:half+spec.opening/2,panels=Math.ceil((to-from)/5.5),rise=4.5,off=spec.width/2+.3;
    for(const side of [-1,1]){
      const node=(k:number):XYZ=>along(path,from+(to-from)*k/panels).p;
      for(let k=0;k<panels;k++){const p=node(k),q=node(k+1);
        slab(truss,p,q,.7,.8,side*(off-.35),-.6);slab(truss,p,q,.5,.5,side*off,rise);
        slab(truss,k%2?[p[0],p[1]-.6,p[2]]:[p[0],p[1]+rise-.5,p[2]],k%2?[q[0],q[1]+rise-.5,q[2]]:[q[0],q[1]-.6,q[2]],.3,.5,side*off,0);}
      for(let k=0;k<=panels;k++){const {p,dir}=along(path,from+(to-from)*k/panels);box(truss,[p[0]-dir[1]*side*off,p[2]+dir[0]*side*off],p[1]+rise,[.4,.4],p[1]-1.4);}
    }
    cuts.solids.push(truss);
  }
  for(const side of [-1,1])for(let i=1;i<path.length;i++){slab(rails,path[i-1]!,path[i]!,.25,1,side*(spec.width/2-.125),1);slab(rails,path[i-1]!,path[i]!,.4,.15,side*(spec.width/2-.125),1.15);}
  cuts.solids.push(deck,piers,rails);
  if(spec.abutments){
    // Abutments carry the deck ends and the approaches down to the bank; they never step into the channel.
    const abut=solid(`${spec.id}.abutments`,'abutment','stone','support',bedIds,deck.districtId);
    // Each abutment follows the route's own approach outward from the deck end (the road curves off the straight deck).
    const approach=route??bed(`structure.${spec.id}.approach`,'road',path,false),total=planLength(approach.points),ends=[path[0]!,path.at(-1)!].map(p=>nearestOnPath(plan(p),approach.points).along);
    for(const [i,endAlong] of ends.entries()){
      const outward=endAlong<ends[1-i]!?-1:1;let built=0;
      for(let k=-1;k<15;k++){const s0=clamp(endAlong+outward*k*2,0,total),s1=clamp(endAlong+outward*(k+1)*2,0,total);if(Math.abs(s1-s0)<.5)break;
        const p0=along(approach.points,s0).p,p1=along(approach.points,s1).p,g0=base(p0[0],p0[2]),g1=base(p1[0],p1[2]);
        if((g0+g1)/2<-.5)continue; // never step into the channel
        if(Math.max(p0[1],p1[1])-.6-Math.min(g0,g1)<=.3&&k>0)break;
        wallToGround(abut,[p0[0],p0[1]-.6,p0[2]],[p1[0],p1[1]-.6,p1[2]],spec.width+1,0,base);built++;}
      if(!built)conflict(cuts,`structures.${spec.id}.abutment`,`${spec.id}: no dry bank for an abutment at this end; the channel is not filled`,plan(path[i?path.length-1:0]!));
    }
    cuts.solids.push(abut);
  }
  const structuralBed=bed(`structure.${spec.id}`,spec.route.startsWith('walk')?'walk':'road',path,false);structuralBed.width=spec.width;structuralBed.structureIds=[spec.id];cuts.beds.push(structuralBed);
  // The source corridor is split at the span limits so no water is raised to its deck.
  if(route)route.structureIds.push(spec.id);
  if(spec.covered){
    const roof=solid(`${spec.id}.roof`,'roof','stone','roof',[spec.route],deck.districtId);slab(roof,a,b,spec.width+1,.35,0,4);cuts.solids.push(roof);
    // Roof posts stand on the deck directly over the pier caps.
    const posts=solid(`${spec.id}.posts`,'post','timber','support',bedIds,deck.districtId);
    for(const s of placed)for(const side of [-1,1]){const {p,dir}=along(path,s);box(posts,[p[0]-dir[1]*side*(spec.width/2-.6),p[2]+dir[0]*side*(spec.width/2-.6)],h+4,[.25,.25],h-.9);}
    cuts.solids.push(posts);void normal;
  }
}
export interface TunnelOptions { bedIds?:string[]; base?:HeightQuery }
/** A lined tube along graded points: floor, walls, roof. Where the ground falls below the floor the walls
 * are carried down to it (a cut-and-cover box on its own footing) — the tube never hangs. */
export function tunnel(id:string,points:XYZ[],width:number,clear:number,cuts:LandCuts,district='crown',options:TunnelOptions={}):void {
  const sources:Record<string,string>={oreTunnel:'ORE',oreSiding:'ORE',seaPassage:'DEEP_RUN',prowTunnel:'V01',shoulderTunnel:'V02',duneCulvert:'S4'},bedIds=options.bedIds??[sources[id]??id],base=options.base;
  const floor=solid(`${id}.floor`,'tunnel','stone','floor',bedIds,district),walls=solid(`${id}.walls`,'tunnel','rock','wall',bedIds,district),roof=solid(`${id}.roof`,'tunnel','rock','roof',bedIds,district),footings=solid(`${id}.footings`,'tunnelFooting','stone','support',bedIds,district);
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!;slab(roof,a,b,width+1.2,.6,0,clear+.6);
    // R2-03: each floor piece overlaps its neighbours by FLOOR_LAP along the route: at a bend, abutting pieces left a wedge
    // slit on the outer side (0.1 eu at the Year Walk footway, 5.9 eu off the Shoulder Tunnel's axis, where the body fell).
    {const l=distance(plan(a),plan(b))||1,k=Math.min(FLOOR_LAP,l)/l,ex=(p:XYZ,q:XYZ):XYZ=>[p[0]+(p[0]-q[0])*k,p[1]+(p[1]-q[1])*k,p[2]+(p[2]-q[2])*k];slab(floor,i>1?ex(a,b):a,i<points.length-1?ex(b,a):b,width,.6);}
    for(const side of [-1,1]){
      slab(walls,a,b,.6,clear+.6,side*(width/2+.3),clear);
      // Below the floor slab the wall continues as a footing strip to the ground wherever the ground falls away.
      if(base)wallToGround(footings,[a[0],a[1]-.6,a[2]],[b[0],b[1]-.6,b[2]],.6,side*(width/2+.3),base,.3);
    }
  }
  cuts.solids.push(floor,walls,roof);if(footings.indices.length)cuts.solids.push(footings);
}
/** Minimum rock over a tube roof, away from its portals. */
function tunnelCover(points:readonly XYZ[],clear:number,base:HeightQuery,portal=8):{cover:number;at:XY} {
  const length=planLength(points);let cover=Infinity,at:XY=plan(points[0]!);
  for(let s=portal;s<=length-portal;s+=2){const {p}=along(points,s),c=base(p[0],p[2])-(p[1]+clear+.6);if(c<cover){cover=c;at=[p[0],p[2]];}}
  return {cover,at};
}
/** Portal mouth, rotated to the tube axis: from 6 eu inside the face to 3 eu outside it. */
function portalMouth(id:string,end:XYZ,outward:XY,width:number,clear:number,out=3):import('../interfaces').MouthMask {
  const n:XY=[-outward[1],outward[0]],w=width/2+1,pt=(u:number,v:number):XY=>[end[0]+outward[0]*u+n[0]*v,end[2]+outward[1]*u+n[1]*v];
  return {id,kind:'portal',floor:end[1],ceiling:end[1]+clear+.6,outline:[pt(-6,-w),pt(-6,w),pt(out,w),pt(out,-w)]};
}
/** Stair: treads → stringers → cheek walls (low) or piers and footings (high) → ground; handrails on posts.
 * A footing that would stand in a lower lane moves along the flight; if no footing fits within the clear-span limit the stair reports. */
export function buildStair(id:string,from:XYZ,to:XYZ,width:number,cuts:LandCuts,base:HeightQuery=baseHeight):void {
  const rise=Math.abs(to[1]!-from[1]!),stepCount=Math.max(1,Math.ceil(rise/.17)),district=districtAt(from[0]!,from[2]!);
  const steps=solid(`${id}.treads`,'stair','stone','deck',[id],district),rails=solid(`${id}.rails`,'handrail','metal','rail',[id],district);
  const stringers=solid(`${id}.stringers`,'stringer','stone','support',[id],district),cheeks=solid(`${id}.cheeks`,'cheekWall','stone','support',[id],district),piers=solid(`${id}.supports`,'pier','stone','support',[id],district);
  for(let i=0;i<stepCount;i++){
    const t=i/stepCount,u=(i+1)/stepCount,h=mix(from[1]!,to[1]!,u),a:XYZ=[mix(from[0]!,to[0]!,t),h,mix(from[2]!,to[2]!,t)],b:XYZ=[mix(from[0]!,to[0]!,u),h,mix(from[2]!,to[2]!,u)];
    slab(steps,a,b,width,.35+rise/stepCount);
  }
  const run=distance(plan(from),plan(to)),line=(t:number):XYZ=>[mix(from[0],to[0],t),mix(from[1],to[1],t),mix(from[2],to[2],t)],dir:XY=run>1e-6?[(to[0]-from[0])/run,(to[2]-from[2])/run]:[1,0],edge=width/2-.15;
  const sideXY=(t:number,side:number):XY=>{const p=line(t);return [p[0]-dir[1]*side*edge,p[2]+dir[0]*side*edge];};
  // Stringers in short pieces (≤ 0.75 eu of run, 1 cm joints) under both tread edges: top 0.2 below the pitch line, 0.8 deep.
  const pieces=Math.max(1,Math.ceil(run/.75)),joint=.005/Math.max(run,1e-6);for(let k=0;k<pieces;k++)for(const side of [-1,1])slab(stringers,line(k/pieces+joint),line((k+1)/pieces-joint),.3,.8,side*edge,-.2);
  const under=(t:number)=>line(t)[1]-1,drop=(t:number,side:number)=>under(t)-base(...sideXY(t,side));
  // Bents every ≤ STAIR_BENT eu: a pier pair on footings (always drawn; settleFoundations carries each footing to the final ground).
  const guard=laneGuard(cuts),stations=Math.max(1,Math.ceil(run/STAIR_BENT)),bearings:number[]=[];
  const free=(t:number)=>[-1,1].every(side=>!guard(sideXY(t,side),under(t),[id]));
  for(let k=0;k<=stations;k++){
    const t=k/stations;let u:number|undefined=free(t)?t:undefined;
    for(let shift=1;u===undefined&&shift<=3;shift++)for(const sgn of [-1,1]){const v=t+sgn*shift/Math.max(run,1e-6);if(u===undefined&&v>=0&&v<=1&&free(v))u=v;}
    if(u===undefined)continue;bearings.push(u);
    for(const side of [-1,1])pier(piers,sideXY(u,side),under(u),base,[.6,.6],[1.4,1.4]);
  }
  bearings.sort((a,b)=>a-b);
  const limits=[0,...bearings,1];
  for(let i=1;i<limits.length;i++){const gap=(limits[i]!-limits[i-1]!)*run,endGap=i===1||i===limits.length-1;
    if(gap>(endGap?STAIR_BENT:STAIR_CLEAR_MAX)+.01){const m=line((limits[i]!+limits[i-1]!)/2);conflict(cuts,`structures.${id}.clearSpan`,`${id}: a protected lane leaves ${gap.toFixed(1)} eu of flight with no footing${endGap?' at its end':''}; it needs a girder span or a re-route`,plan(m),gap,endGap?STAIR_BENT:STAIR_CLEAR_MAX);}
    // Any interior bay longer than a bent spacing is a stringer girder over a protected lane: always reported.
    else if(gap>STAIR_BENT+.01)cuts.diagnostics.push({id:`structures.${id}.girderSpan`,severity:'info',message:`${id}: stringers carry a ${gap.toFixed(1)} eu clear span over a protected lane`,at:plan(line((limits[i]!+limits[i-1]!)/2)),measured:gap,required:STAIR_CLEAR_MAX});
  }
  // Masonry cheek walls from the stringer to the ground wherever the flight is low.
  for(let k=0;k<pieces;k++)for(const side of [-1,1]){const t0=k/pieces,t1=(k+1)/pieces;const worst=Math.max(drop(t0,side),drop(t1,side));if(worst>CHEEK_MAX||worst<=GROUND_CONTACT)continue;
    if(guard(sideXY((t0+t1)/2,side),under((t0+t1)/2),[id]))continue;
    const p=line(t0),q=line(t1);wallToGround(cheeks,[p[0],p[1]-.2,p[2]],[q[0],q[1]-.2,q[2]],.3,side*edge,base);}
  for(const side of [-1,1])postedRail(rails,[from,to],side*width/2);
  for(const s of [steps,stringers,cheeks,piers,rails])if(s.indices.length)cuts.solids.push(s);
  const b=bed(id,'stair',[from,to],false);b.maxGrade=10;cuts.beds.push(b);
}
/** A level landing or platform deck. On the ground it is a terrain pad; raised, it is a structure on columns — never a terrain mound. */
function landing(cuts:LandCuts,id:string,at:XY,h:number,size:XY,base:HeightQuery,columns=4):void {
  const ground=Math.min(...[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>base(at[0]!+x!*size[0]!/2,at[1]!+z!*size[1]!/2)),base(...at));
  if(ground>=h-1){addFlatPad(cuts,id,'landing',at,h,size);return;}
  const deck=solid(`${id}.slab`,'landing','stone','floor',[id],districtAt(...at));box(deck,at,h,size,h-.6);
  const supports=solid(`${id}.columns`,'tower','stone','support',[id],deck.districtId),nx=columns>4?3:2;
  for(let i=0;i<nx;i++)for(const z of [-1,1]){const x=nx===2?(i?1:-1):i-1;pier(supports,[at[0]!+x*(size[0]!/2-.6),at[1]!+z*(size[1]!/2-.6)],h-.6,base,[.8,.8],[1.8,1.8]);}
  const rails=solid(`${id}.rails`,'handrail','metal','rail',[id],deck.districtId),c=(x:number,z:number):XYZ=>[at[0]!+x*size[0]!/2,h,at[1]!+z*size[1]!/2];
  postedRail(rails,[c(-1,-1),c(1,-1),c(1,1),c(-1,1)],-.1);
  cuts.solids.push(deck,supports,rails);
}
/** A slab whose underside follows the ground (a bowl or pan on grade). */
function slabOnGrade(out:StructureSolid,a:XYZ,b:XYZ,width:number,base:HeightQuery):void {wallToGround(out,a,b,width,0,base,.6);}
/** v1.9: the surface of any channel or level water body under a plan point (T3-4: the Boathouse jetty's fixed deck at 1
 * stood 0.15 under the Reach east channel's water). */
let waterCache:ReturnType<typeof buildWaterCuts>|undefined;
function waterSurfaceNear(cuts:LandCuts,p:XY,reach:number):number|undefined {
  let best:number|undefined;
  // The land build runs before the water cuts join `cuts`: read the manifest's water directly.
  for(const w of cuts.waters.length?cuts.waters:(waterCache??=buildWaterCuts())){
    if(w.kind==='dry')continue;
    if(w.points.length>1){for(let i=1;i<w.points.length;i++){const a=w.points[i-1]!,b=w.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((p[0]-a[0])*dx+(p[1]-a[2])*dz)/(dx*dx+dz*dz||1),0,1);if(distance(p,[a[0]+dx*t,a[2]+dz*t])<=w.width/2+reach)best=Math.max(best??-Infinity,mix(a[1],b[1],t));}}
    else if(w.outline.length>2){let inside=false;for(let i=0,j=w.outline.length-1;i<w.outline.length;j=i++){const a=w.outline[i]!,b=w.outline[j]!;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}if(inside)best=Math.max(best??-Infinity,w.level);}
  }
  return best;
}
function dock(id:string,p:XY,height0:number,cuts:LandCuts,base:HeightQuery,width=5,length=12):void {
  // The deck stands 0.6 over the water it reaches (never under it); dry-land docks keep their authored height.
  const surface=waterSurfaceNear(cuts,p,length/2),height=surface===undefined?height0:Math.max(height0,surface+.6);
  if(surface!==undefined&&height!==height0)cuts.diagnostics.push({id:`structures.${id}.deckOverWater`,severity:'info',message:`${id}: deck raised from ${height0} to ${height.toFixed(2)} (water surface ${surface.toFixed(2)} + 0.6)`,at:p,measured:height,required:surface+.6});
  const a:XYZ=[p[0]!,height,p[1]!-length/2],b:XYZ=[p[0]!,height,p[1]!+length/2],deck=solid(`${id}.deck`,'jetty','boardwalk','deck',[id],districtAt(...p)),piles=solid(`${id}.supports`,'pile','timber','support',[id],deck.districtId),rails=solid(`${id}.rails`,'handrail','metal','rail',[id],deck.districtId);
  slab(deck,a,b,width,.35);for(let offset=-length/2;offset<=length/2+.01;offset+=3)for(const side of [-1,1]){const xy:XY=[p[0]!+side*(width/2-.2),p[1]!+offset];box(piles,xy,height-.2,[.3,.3],Math.min(-2,base(...xy))-FOOTING_SINK);}
  postedRail(rails,[a,b],width/2);postedRail(rails,[a,b],-width/2);cuts.solids.push(deck,piles,rails);const bcut=bed(id,'boardwalk',[a,b],false);bcut.width=width;bcut.structureIds=[id];cuts.beds.push(bcut);
}
/** High Span's lower levels: the S1 shelf on the west wall, the Reach gallery on the west bank beside
 * (never in) the river, and camera C's overlook as a bank platform at its v1.7 coordinate. */
function highSpanLevels(cuts:LandCuts,base:HeightQuery):void {
  for(const [id,h,width,x] of [['highSpan.shelf',12,4,1204]] as const){
    const a:XYZ=[x,h,1078],b:XYZ=[x,h,1135],deck=solid(`${id}.deck`,'shelf','stone','deck',['S1'],'notch'),brackets=solid(`${id}.supports`,'corbel','rock','support',['S1',id],'notch'),rail=solid(`${id}.rail`,'handrail','metal','rail',deck.bedIds,'notch');slab(deck,a,b,width,.6);
    for(let z=1078;z<=1135;z+=9.5)box(brackets,[x-width/2,z],h-.5,[width+1,1.2],Math.min(base(x-width/2,z)-FOOTING_SINK,h-2));postedRail(rail,[a,b],width/2);cuts.solids.push(deck,brackets,rail);
  }
  // Gallery: 8 eu west of the river centreline (6 eu half-width + 2 eu bank), graded 1 eu above the water, joining the Reach walk at [1240,9,1130].
  const river=sampleSpline(M.water_routes.RIVER_RUN.pts as unknown as XY[],4),gallery:XYZ[]=[];
  for(const z of [1080,1090,1100,1110,1120]){const hit=nearestOnPath([1232,z],river.map(p=>[p[0],0,p[1]] as XYZ)),i=Math.min(hit.segment+1,river.length-1),d=river[i]!,c=river[hit.segment]!,len=distance(c,d)||1,n:XY=[-(d[1]-c[1])/len,(d[0]-c[0])/len],w:XY=n[0]<0?n:[-n[0],-n[1]];
    gallery.push([hit.at[0]+w[0]*8,0,hit.at[2]+w[1]*8]);}
  gallery.push([1240,9,1130]);const heights=[10.8,10.5,10.1,9.8,9.4,9];const g=gallery.map((p,i)=>[p[0],heights[i]!,p[2]] as XYZ);
  const deck=solid('highSpan.walk.deck','shelf','stone','deck',['walk reach'],'notch'),supports=solid('highSpan.walk.supports','pier','stone','support',['walk reach','highSpan.walk'],'notch'),rail=solid('highSpan.walk.rail','handrail','metal','rail',['walk reach'],'notch'),cheek=solid('highSpan.walk.cheeks','cheekWall','stone','support',['walk reach','highSpan.walk'],'notch');
  for(let i=1;i<g.length;i++){slab(deck,g[i-1]!,g[i]!,3,.6);for(const side of [-1,1])wallToGround(cheek,[g[i-1]![0],g[i-1]![1]-.6,g[i-1]![2]],[g[i]![0],g[i]![1]-.6,g[i]![2]],.3,side*1.35,base);}
  postedRail(rail,g,1.5);cuts.solids.push(deck,cheek,rail);if(supports.indices.length)cuts.solids.push(supports);
  const lowerGalleryBed=bed('highSpan.walk','walk',g,false);lowerGalleryBed.width=3;cuts.beds.push(lowerGalleryBed);
  // Overlook platform at camera C [1268,1145], reached from the Reach walk at [1244.7,7.9,1142.4].
  const view=M.views.find(v=>v.id==='C')!,c=view.xy as unknown as XY,oh=10,size:XY=[7,6];
  const overlook=solid('highSpan.overlook.deck','shelf','stone','deck',['highSpan.overlook'],'notch');box(overlook,c,oh,size,oh-.6);
  const piles=solid('highSpan.overlook.supports','pier','stone','support',['highSpan.overlook'],'notch');
  for(const x of [-1,1])for(const z of [-1,1])pier(piles,[c[0]!+x*(size[0]/2-.5),c[1]!+z*(size[1]/2-.5)],oh-.6,base,[.6,.6],[1.4,1.4]);
  const overlookRail=solid('highSpan.overlook.rails','handrail','metal','rail',['highSpan.overlook'],'notch'),q=(x:number,z:number):XYZ=>[c[0]!+x*size[0]/2,oh,c[1]!+z*size[1]/2];
  postedRail(overlookRail,[q(-1,-1),q(1,-1),q(1,1),q(-1,1),q(-1,.35)],-.1);
  cuts.solids.push(overlook,overlookRail);if(piles.indices.length)cuts.solids.push(piles);
  const approach:XYZ[]=[[1244.7,7.9,1142.4],[c[0]!-size[0]/2,oh,c[1]!]];
  const approachDeck=solid('highSpan.overlook.approach','shelf','stone','deck',['highSpan.overlook'],'notch'),approachCheeks=solid('highSpan.overlook.approach.cheeks','cheekWall','stone','support',['highSpan.overlook'],'notch');
  slab(approachDeck,approach[0]!,approach[1]!,2.5,.5);for(const side of [-1,1])wallToGround(approachCheeks,[approach[0]![0],approach[0]![1]-.5,approach[0]![2]],[approach[1]![0],approach[1]![1]-.5,approach[1]![2]],.3,side*1.1,base);
  cuts.solids.push(approachDeck);if(approachCheeks.indices.length)cuts.solids.push(approachCheeks);
  const overlookBed=bed('highSpan.overlook','walk',[...approach,[c[0]!,oh,c[1]!]],false);overlookBed.width=2.5;cuts.beds.push(overlookBed);
}
export function buildStructures(cuts:LandCuts,base:HeightQuery):void {
  SPANS.forEach(s=>buildSpan(s,cuts,base));
  highSpanLevels(cuts,base);
  // Road tunnels follow their road's graded profile; the section carries the road and the Year Walk footway (+6.5 eu).
  for(const [id,route,length,width,clear] of [['prowTunnel','V01',90,17,5],['shoulderTunnel','V02',110,17,5],['duneCulvert','S4',32,5,3]] as const){
    const s=M.structures[id]!,xy=s.xy as unknown as XY,b=cuts.beds.find(p=>p.id===route)!,points=routeStretch(b,xy,length);
    tunnel(id,points,width,clear,cuts,districtAt(...xy),{base});
    // R2-03: a floor apron as wide as the mouth mask carries the road and its footway across the portal mouth (PORTAL_MOUTH_OUT
    // outside the face, where the mask hides the terrain), so no strip of the mouth is left without a surface.
    if(id!=='duneCulvert'){const ext=routeStretch(b,xy,length+2*PORTAL_APRON),apron=solid(`${id}.apron`,'tunnel','stone','floor',[route],districtAt(...xy));
      const e0=ext[0]!,e1=ext.at(-1)!,lap=(p:XYZ,q:XYZ):XYZ=>{const l=distance(plan(p),plan(q))||1,k=Math.min(FLOOR_LAP,l)/l;return [p[0]+(p[0]-q[0])*k,p[1]+(p[1]-q[1])*k,p[2]+(p[2]-q[2])*k];};
      // Each apron laps FLOOR_LAP into the tube (abutting pieces left a slit at the footway, 5.9 eu off the axis).
      if(distance(plan(e0),plan(points[0]!))>.5)slab(apron,e0,lap(points[0]!,e0),width+2,.6);if(distance(plan(e1),plan(points.at(-1)!))>.5)slab(apron,lap(points.at(-1)!,e1),e1,width+2,.6);
      for(const side of [-1,1])for(const [a0,a1] of [[e0,points[0]!],[points.at(-1)!,e1]] as const)if(distance(plan(a0),plan(a1))>.5)wallToGround(apron,[a0[0],a0[1]-.6,a0[2]],[a1[0],a1[1]-.6,a1[2]],.6,side*(width/2+.7),base,.3);
      if(apron.indices.length)cuts.solids.push(apron);}
    const first=points[0]!,last=points.at(-1)!,d0=along(points,0).dir,d1=along(points,planLength(points)).dir;
    const out=id==='duneCulvert'?3:PORTAL_MOUTH_OUT;cuts.mouths.push(portalMouth(`${id}.portal.0`,first,[-d0[0],-d0[1]],width,clear,out),portalMouth(`${id}.portal.1`,last,d1,width,clear,out));
    // The dune culvert's cover is the V01 road deck crossing over it, not the terrain.
    const {cover,at}=id==='duneCulvert'?(()=>{const road=cuts.beds.find(r=>r.id==='V01')!,hit=nearestOnPath(xy,road.points),under=nearestOnPath(plan(hit.at),points).at;return {cover:hit.at[1]-.6-(under[1]+clear+.6),at:plan(hit.at)};})():tunnelCover(points,clear,base);
    if(cover<(id==='duneCulvert'?0:2))conflict(cuts,`structures.${id}.cover`,`${id}: ${id==='duneCulvert'?'the V01 deck clears the culvert roof by':'rock cover over the lined roof is'} ${cover.toFixed(1)} eu${id==='prowTunnel'?' (RESERVED location, built as authored)':''}; the tube stands on its own wall footings where the ground falls away`,at,cover,2);
    const tunnelBed=bed(id,route==='S4'?'skateMain':'road',points,false);tunnelBed.width=width;tunnelBed.structureIds=[id];cuts.beds.push(tunnelBed);
  }
  // The crest spans a real opening; the curved shoulders carry the spillway to its abutments.
  const dam=solid('dam.wall','dam','stone','wall',[],'lakeside'),crest=solid('dam.crest','dam','stone','deck',['walk damCrest'],'lakeside');
  for(let i=0;i<22;i++){
    const x=1118+i*2,arch=Math.abs(x-1140)<10?34+Math.sqrt(Math.max(0,100-(x-1140)**2)):27;
    box(dam,[x+1,905],52,[2.03,5],arch);if(Math.abs(x-1140)>=10)box(dam,[x+1,905],arch,[2.03,8],20);
  }
  slab(crest,[1118,52,903],[1162,52,903],4,.6);cuts.solids.push(dam,crest);cuts.beds.push(bed('walk damCrest','walk',[[1118,52,903],[1162,52,903]],false));
  // The dam's end abutments carry the crest walk to the valley sides (links the crest to its crossing of the river).
  const damAbut=solid('dam.abutments','abutment','stone','support',['walk damCrest'],'lakeside');
  for(const x of [1116,1164])wallToGround(damAbut,[x,52.01-.6,899],[x,52.01-.6,911],4,0,base);cuts.solids.push(damAbut);
  // Apron: a supported half-pipe slab on piers clear of the tailrace, with end abutments.
  const bowl=solid('dam.apron','halfPipe','apron','deck',['S1'],'notch'),apronH=(x:number)=>31+7*((x-1151)/16)**2;
  for(let i=0;i<16;i++){const x=1135+i*2,x2=x+2;slab(bowl,[x,apronH(x),935],[x2,apronH(x2),935],22,.6);}cuts.solids.push(bowl);
  const apronPiers=solid('dam.apron.supports','pier','stone','support',['S1','dam.apron'],'notch'),apronAbut=solid('dam.apron.abutments','abutment','stone','support',['S1','dam.apron'],'notch'),tail=laneGuard(cuts);
  for(const x of [1137,1141,1162,1166])for(const z of [926,935,944]){const xy:XY=[x,z];if(tail(xy,apronH(x),['S1','dam.apron.level'])==='RIVER_RUN')continue;pier(apronPiers,xy,Math.min(apronH(x-.5),apronH(x+.5))-.6,base,[1,1],[2.4,2.4]);}
  for(const x of [1135.3,1166.7])wallToGround(apronAbut,[x,apronH(x)-.6,924.2],[x,apronH(x)-.6,945.8],.6,0,base);
  // Spandrel walls under both long edges follow the curved underside in 1 eu bays, leaving the tailrace lane open.
  for(let x=1135;x<1167;x++)for(const z of [924.6,945.4]){if(tail([x+.5,z],apronH(x+.5),['S1','dam.apron.level'])==='RIVER_RUN')continue;wallToGround(apronAbut,[x,apronH(x)-.6,z],[x+1,apronH(x+1)-.6,z],.6,0,base);}
  cuts.solids.push(apronPiers,apronAbut);
  cuts.beds.push(bed('dam.apron.level','skateMain',[[1168,31,923],[1168,31,947]],false));
  // v1.9 (T3's layout): the gallery is an open stairwell in the east abutment south of the wall, never in Stillwater:
  // three flights in x-lanes 1166.5 / 1162.4 / 1170.6 (4.1 m pitch: each flight's bents clear its neighbours) between
  // z 910.75 and 922.75 (12 run, 7 rise, pitch 0.58), landings at z 909.5 (h 38) and 924 (h 45), the exit at h 52
  // through the north wall to the crest at [1162,52,903]. Walls to 46.05 (the 45 landing's parapet; the top flight
  // has its own rails), no roof: page F's eye stands 2.3 m west of the stairwell at 53.6.
  const lanes=[1166.5,1162.4,1170.6];
  for(let f=0;f<3;f++){const x=lanes[f]!,north=f%2===0,z0=north?922.75:910.75,z1=north?910.75:922.75;buildStair(`damGallery.flight.${f}`,[x,31+f*7,z0],[x,38+f*7,z1],3,cuts,base);}
  landing(cuts,'damGallery.landing.0',[1164.45,909.5],38,[7.1,2.5],base);landing(cuts,'damGallery.landing.1',[1166.5,924],45,[11.2,2.5],base);
  cuts.beds.push(bed('damGallery.exit','walk',[[1170.6,52,910.75],[1170.6,52,908],[1166,52,905],[1162,52,903]],false));
  {const well=solid('damGallery.walls','stairwell','stone','wall',['damGallery.exit'],'lakeside'),top=46.05,seat=51.65;
    box(well,[1160.3,916.75],top,[.6,16.5],base(1160.3,916.75)-FOOTING_SINK);
    // R2-108: under L01's slab (z 908-916) the east wall stands to the slab's underside; south of it, to the parapet.
    box(well,[1172.8,920.9],top,[.6,8.2],base(1172.8,920.9)-FOOTING_SINK);box(well,[1172.8,912.4],seat,[.6,8.8],base(1172.8,912.4)-FOOTING_SINK);
    // North wall with the exit door (x 1169-1172), south wall above the apron entry (h >= 34.4).
    box(well,[1164.2,908.2],top,[8.4,.6],base(1164.2,908.2)-FOOTING_SINK);box(well,[1166.5,925.6],top,[12.5,.6],34.4);cuts.solids.push(well);
    // R2-108: L01's 8 x 8 slab at 52 (place xy [1172,912], MANIFEST) lay over the top flight (0.9 eu over its last treads)
    // and on nothing (ground 34.2 in the well). It is re-laid as the stair head: the flight's own 3 m opening
    // (x 1169.1-1172.1, z > 910.75) is left open, the head strip (z 908-910.75) and the east part rest on the raised east
    // wall and the ground east of it, and one pier between the two lower flights carries the head strip's west end.
    const l01=cuts.solids.find(q=>q.id==='place.L01.slab');
    if(l01){l01.positions.length=0;l01.indices.length=0;l01.kind='roofDeck';box(l01,[1172,909.375],52,[8,2.75],seat);box(l01,[1174.05,913.375],52,[3.9,5.25],seat);}
    const l01s=solid('place.L01.supports','pier','stone','support',['place.L01'],'lakeside');pier(l01s,[1168.55,909.4],seat,base,[.5,.5],[1,1]);cuts.solids.push(l01s);}
  buildStair('damPortage',[1150,50,910],[1169,25,963],3,cuts,base);
  // Dry Wash bowl: the invert remains an ordinary ground line, with a bank on either side; its underside sits on the ground.
  const wash=solid('wash.bowl','bowl','ochre','deck',['S2'],'flats'),washH=heightOnBeds(cuts,[465,700],base);for(let i=-12;i<12;i++){const h=washH+5*(i/12)**2,h2=washH+5*((i+1)/12)**2;slabOnGrade(wash,[465+i,h,665],[466+i,h2,665],72,base);}cuts.solids.push(wash);
  // Runway and mooring foundations contain no lamps, windsock, hangar or balloon props in Pass 1.
  const strip=bed('strip','road',[[425,38,520],[445,38,860]]);strip.width=30;cuts.beds.push(strip);
  addFlatPad(cuts,'hangar','place',[455,600],38,[40,30]);addFlatPad(cuts,'windsock.footing','place',[440,500],38,[1,1]);addFlatPad(cuts,'balloon.footing','place',[520,470],base(520,470),[14,14]);
  Object.entries(M.structures.jetties).forEach(([id,p])=>dock(`jetty.${id}`,p as unknown as XY,id==='deep'?40.6:1,cuts,base));
  Object.entries(M.water_routes.FERRY.piers).forEach(([id,p])=>dock(`ferry.${id}`,p as unknown as XY,1,cuts,base,6,16));
  dock('floatplaneDock',M.structures.floatplaneDock as unknown as XY,1.2,cuts,base,8,20);
  dock('landingQuay',M.structures.landingQuay.xy as unknown as XY,3,cuts,base,8,32);
  const q=M.structures.townQuay;cuts.beds.push(bed('town quay','walk',[[...q.from.slice(0,1),3,q.from[1]!] as unknown as XYZ,[q.to[0]!,3,q.to[1]!]],false));
  const seaTop:XYZ=[1620,base(1620,760),760];buildStair('seaStair',[1705,1,775],seaTop,3,cuts,base);
  // v1.9 MANIFEST structures.<id>.kind "stair" (from/to plan points): a stair from a route's end down to a jetty or
  // landing; its top takes the route's height there, its foot the water surface + 0.6 (or the ground).
  for(const [id,st] of Object.entries(M.structures as unknown as Record<string,{kind?:string;from?:number[];to?:number[]}>)){
    if(!st||typeof st!=='object'||st.kind!=='stair'||!st.from||!st.to)continue;
    const from=st.from as unknown as XY,to=st.to as unknown as XY,top=heightOnBeds(cuts,from,base,6),foot=Math.max(1.2,Math.max(waterSurfaceNear(cuts,to,4)??base(...to),base(...to))+.6);
    buildStair(id,[from[0],top,from[1]],[to[0],foot,to[1]],3,cuts,base);
  }
  // Cable platforms: a raised deck on its tower (a footing, not a terrain mound); on-grade stations stay pads.
  for(const [id,xy,h]of [['gondolaBase',M.cable.G1.from,M.cable.G1.fromH],['gondolaTop',M.cable.G1.to,M.cable.G1.toH],['prowPlatform',M.cable.ZIP.from,M.cable.ZIP.fromH],['zipLanding',M.cable.ZIP.to,M.cable.ZIP.toH]] as const){
    const at=xy as unknown as XY,ground=Math.min(...[[-5,-4],[-5,4],[5,4],[5,-4],[0,0]].map(([x,z])=>base(at[0]+x!,at[1]+z!)));
    if(ground>=h-1){addFlatPad(cuts,`platform.${id}`,'landing',at,h,[10,8]);continue;}
    const deck=solid(`platform.${id}.slab`,'platform','stone','floor',[],districtAt(at[0],at[1]));box(deck,at,h,[10,8],h-.6);
    const supports=solid(`platform.${id}.supports`,'tower','stone','support',[],districtAt(at[0],at[1]));for(const x of [-4,4])for(const z of [-3,3])pier(supports,[at[0]+x,at[1]+z],h-.6,base,[.9,.9],[2.2,2.2]);
    const rails=solid(`platform.${id}.rails`,'handrail','metal','rail',[],deck.districtId),c=(x:number,z:number):XYZ=>[at[0]+x*5,h,at[1]+z*4];postedRail(rails,[c(-1,-1),c(1,-1),c(1,1),c(-1,1)],-.1);
    cuts.solids.push(deck,supports,rails);
  }
  buildStair('zipLanding.stair',[1130,12,1440],[1145,3,1460],3,cuts,base);
  const ramp=gradeRoute('zipLanding.ramp',[[1130,1440],[1090,1445],[1080,1470],[1145,1460]],()=>3,.08,[{xy:[1130,1440],height:12,reason:'deck'},{xy:[1145,1460],height:3,reason:'sand'}],cuts.diagnostics);
  {// v1.9 (W3-C A3, P12): the landing ramp is a timber trestle over the beach, not an earth dune: the sand, the
    // Town Weave and the dune walk run under it. Bents every sample (≤ 5 eu), none in a lower route's corridor.
    const rampBed=bed('zipLanding.ramp','walk',ramp,false);rampBed.maxGrade=.08;cuts.beds.push(rampBed);
    const trestle=solid('zipLanding.ramp.supports','trestle','timber','support',['zipLanding.ramp'],'landing'),rails=solid('zipLanding.ramp.rails','handrail','metal','rail',['zipLanding.ramp'],'landing'),guard=laneGuard(cuts);
    for(const p of ramp){const xy=plan(p);if(p[1]-base(...xy)<.9||guard(xy,p[1],['zipLanding.ramp','zipLanding.stair']))continue;pier(trestle,xy,p[1]-.35,base,[.45,.45],[1.1,1.1]);}
    for(const side of [-1,1])postedRail(rails,ramp,side*(rampBed.width/2-.05));
    cuts.solids.push(trestle,rails);
  }
  // Crown launch: the summit lookout's run-off deck at h 170 over [1305,482] (MANIFEST sky.launches.crown), on four columns, with a stair to the summit ground.
  const crown=M.sky.launches.crown,cxy=crown.xy as unknown as XY,ch=crown.h;
  landing(cuts,'crownLaunch',cxy,ch,[12,8],base);
  {// The stair lands on the Crown walk at the nearest point a ≤ 0.7 pitch reaches (the walk's own height, not the raw ground).
    const walk=cuts.beds.find(b=>b.id==='walk crown');let best:{from:XYZ;to:XYZ;run:number}|undefined;
    for(const p of walk?.points??[]){const dx=p[0]-cxy[0],dz=p[2]-cxy[1],d=Math.hypot(dx,dz)||1,u:XY=[dx/d,dz/d],edge=Math.min(Math.abs(6/u[0]||Infinity),Math.abs(4/u[1]||Infinity)),from:XYZ=[cxy[0]+u[0]*edge,ch,cxy[1]+u[1]*edge],run=d-edge;
      if(run>2&&(ch-p[1])/run<=.7&&(!best||run<best.run))best={from,to:p,run};}
    // R2-08: the flight meets the walk at ~20°, so its lower treads stood across the walk and closed it both ways. The flight
    // now runs down BESIDE the walk: its foot stands clear of the walk's edge (walk half-width + stair half-width + 0.2), at
    // the walk's height, and a level strip (the stair bed's last segment) steps across onto the walk's centreline.
    if(best){const w=walk!,i=w.points.indexOf(best.to),a=w.points[Math.max(0,i-1)]!,c=w.points[Math.min(w.points.length-1,i+1)]!,tl=Math.hypot(c[0]-a[0],c[2]-a[2])||1;
      let n:XY=[-(c[2]-a[2])/tl,(c[0]-a[0])/tl];if(n[0]*(best.from[0]-best.to[0])+n[1]*(best.from[2]-best.to[2])<0)n=[-n[0],-n[1]];
      const side=w.width/2+1.5+.2,foot:XYZ=[best.to[0]+n[0]*side,best.to[1],best.to[2]+n[1]*side];
      buildStair('crownLaunch.stair',best.from,foot,3,cuts,base);cuts.beds.find(b=>b.id==='crownLaunch.stair')?.points.push(best.to);}else conflict(cuts,'structures.crownLaunch.stair','crownLaunch: no point on the Crown walk within a 0.7 stair pitch of the lookout deck',cxy);}
  landing(cuts,'lampGallery',[540,1195],25,[10,8],base);
  const lampSupports=solid('lampGallery.supports','tower','stone','support',['lampGallery.ramp'],'offshore');
  const lampRamp:XYZ[]=Array.from({length:161},(_,i)=>{const t=i/160,a=Math.PI/2+t*5*Math.PI;return [540+30*Math.cos(a),1+t*24,1220+30*Math.sin(a)];});lampRamp.push([540,25,1195]);
  for(let i=0;i<lampRamp.length;i+=3){const p=lampRamp[i]!;pier(lampSupports,[p[0],p[2]],p[1]-.35,base,[.4,.4],[.9,.9]);}cuts.solids.push(lampSupports);
  const galleryBed=bed('lampGallery.ramp','walk',lampRamp,false);galleryBed.maxGrade=.08;cuts.beds.push(galleryBed);
  buildStair('lampGallery.stair',[540,1,1250],[540,25,1195],3,cuts,base);
}
