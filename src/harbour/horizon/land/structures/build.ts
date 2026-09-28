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
  // v2.0 (D-A1): the Bight Bridge reads MANIFEST structures.bightBridge (span 245, section −9 … +12.6, a 36 m steel
  // through-arch over s 98–134); `buildBightBridge` builds it, this row only carries the span to the bed solver.
  {id:'bightBridge',at:bightFrame().at(bightFrame().A/2,0),route:'V01',length:bightSpec().span,width:bightSpec().section[1]-bightSpec().section[0],height:bightSpec().h,clear:bightSpec().clear,abutments:true},
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
/** Bearings above this height stand on land beside the sea's boat lane, never in it (hull air draft + the 8 eu bridge
 * clearance). The river lane runs in valleys at every height, so it binds at any height. */
const WATER_LANE_TOP=16;
/** Lower routes and boat lanes a footing may not stand in. */
function laneGuard(cuts:LandCuts):(xy:XY,above:number,ownBeds:readonly string[])=>string|undefined {
  const lanes:{id:string;pts:XY[];half:number;top:number}[]=[{id:'FERRY',pts:sampleSpline(M.water_routes.FERRY.pts as unknown as XY[],4),half:7,top:WATER_LANE_TOP},{id:'RIVER_RUN',pts:sampleSpline(M.water_routes.RIVER_RUN.pts as unknown as XY[],4),half:4,top:Infinity}];
  const segDistance=(p:XY,a:XY,b:XY)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return distance(p,[a[0]+t*dx,a[1]+t*dz]);};
  return (xy,above,own)=>{
    // v2.0: a boat lane binds only bearings low enough to stand in its water (a cliff-top stair head 34 eu up is on land).
    for(const lane of lanes)if(above<lane.top)for(let i=1;i<lane.pts.length;i++)if(segDistance(xy,lane.pts[i-1]!,lane.pts[i]!)<lane.half)return lane.id;
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
/** v2.0 (D-A1): MANIFEST structures.bightBridge as numbers. s runs along the V01 axis from the west control point, o is
 * the offset from that axis, + toward the Bight (the lagoon). */
export interface BightSpec { west:XY; east:XY; span:number; h:number; clear:number; section:[number,number]; opening:[number,number]; clearWidth:number; clearUnder:number; westBents:number; eastBents:number; lookout:{from:number;to:number;inner:number;outer:number}; flyover:{from:XY;to:XY;h:number;clear:number}; beam:number; archRise:number }
export function bightSpec():BightSpec {
  const b=M.structures.bightBridge as unknown as {span_m:number;h_deck:number;clear_m:number;ends:{west:number[];east:number[]};section:{from_axis_m:number[]};opening:{at_s:number[];clear_eu:number;clearWidth_m:number};bents:{west:{count:number};east:{count:number}};lookout:{xy:number[];size_m:number[];from_s:number;to_s:number};s2Flyover:{from:number[];to:number[];h:number;clear_eu:number}};
  const f=frameOf(b.ends.west as unknown as XY,b.ends.east as unknown as XY),mid=f.so(b.lookout.xy as unknown as XY).o,half=b.lookout.size_m[1]!/2;
  return {west:b.ends.west as unknown as XY,east:b.ends.east as unknown as XY,span:b.span_m,h:b.h_deck,clear:b.clear_m,section:[b.section.from_axis_m[0]!,b.section.from_axis_m[1]!],opening:[b.opening.at_s[0]!,b.opening.at_s[1]!],clearWidth:b.opening.clearWidth_m,clearUnder:b.opening.clear_eu,westBents:b.bents.west.count,eastBents:b.bents.east.count,
    lookout:{from:b.lookout.from_s,to:b.lookout.to_s,inner:mid-half,outer:mid+half},flyover:{from:b.s2Flyover.from as unknown as XY,to:b.s2Flyover.to as unknown as XY,h:b.s2Flyover.h,clear:b.s2Flyover.clear_eu},
    beam:(M.water_routes.FERRY as unknown as {beam_m?:number}).beam_m??8,
    // Rise 15 over the deck (crown 27, MANIFEST: rise ≥ 10, crown ≥ 22): the portal struts at s 108/124 stand 5.6 over the flyover's deck.
    archRise:15};
}
/** A straight structure's own frame: `at(s,o)` plan point, `so(p)` back to (s, o); o is + to the right of west→east
 * (for the Bight Bridge, toward the lagoon). `rot` is the box rotation (degrees) that lays a box's x along s. */
function frameOf(west:XY,east:XY) {
  const A=distance(west,east),d:XY=[(east[0]-west[0])/A,(east[1]-west[1])/A],L:XY=[d[1],-d[0]];
  return {A,d,L,rot:Math.atan2(d[1],d[0])*180/Math.PI,at:(s:number,o:number):XY=>[west[0]+d[0]*s+L[0]*o,west[1]+d[1]*s+L[1]*o],
    so:(p:XY)=>({s:(p[0]-west[0])*d[0]+(p[1]-west[1])*d[1],o:(p[0]-west[0])*L[0]+(p[1]-west[1])*L[1]})};
}
export function bightFrame(){const b=M.structures.bightBridge.ends;return frameOf(b.west as unknown as XY,b.east as unknown as XY);}
export interface BightReport { bents:{s:number;side:'west'|'east'|'arch';columns:number;built:boolean}[]; arch:{s:number;rib:number}[]; ferryClearance:number; ferryAt:XY; deckProfile:{lane:string;o:number;points:[number,number][]}[] }
/** v2.0 (D-A1) The Bight Bridge: a 245 m timber viaduct on the V01 axis with a 36 m steel through-arch over the ferry
 * opening (s 98–134), the crown lookout bay, and S2 carried as its own ribbon (lagoon ramp → flyover over the road
 * under the arch crown → sea ramp). Every part lists its load path: deck → cap beam → timber bent → footing; in the
 * opening deck → hanger shoe → hanger → rib → arch pier → footing; ramps and flyover → posts over the cap beams or
 * hangers from the portal struts. Every deck edge is railed on posts ≤ 2 eu apart. No pad stands on the deck and no
 * bed raises the seabed under it. */
export function buildBightBridge(cuts:LandCuts,base:HeightQuery):BightReport {
  const B=bightSpec(),F=bightFrame(),H=B.h,T=.6,[o0,o1]=B.section,oc=(o0+o1)/2,width=o1-o0,[op0,op1]=B.opening,sc=(op0+op1)/2,halfOpen=(op1-op0)/2;
  const s0=F.A/2-B.span/2,s1=F.A/2+B.span/2,P=(s:number,o:number,h:number):XYZ=>{const p=F.at(s,o);return [p[0],h,p[1]];},axis=(a:number,b:number,o:number,h:number):[XYZ,XYZ]=>[P(a,o,h),P(b,o,h)];
  const route=cuts.beds.find(b=>b.id==='V01'),district=districtAt(...F.at(F.A/2,0)),ids=['V01','structure.bightBridge'],report:BightReport={bents:[],arch:[],ferryClearance:Infinity,ferryAt:[0,0],deckProfile:[]};
  const deck=solid('bightBridge.deck','bridge','boardwalk','deck',['V01'],district),caps=solid('bightBridge.caps','capBeam','timber','support',ids,district),bents=solid('bightBridge.supports','pier','timber','support',ids,district),bracing=solid('bightBridge.bracing','beam','timber','support',ids,district);
  const piers=solid('bightBridge.archPiers','pier','stone','support',ids,district),arch=solid('bightBridge.arch','arch','metal','support',ids,district),rails=solid('bightBridge.rails','deckParapet','metal','rail',['V01'],district),kerbs=solid('bightBridge.kerbRails','handrail','metal','rail',['S2'],district);
  // Bents: the west viaduct in equal bays from the abutment to the west arch pier, the east from the east arch pier to the abutment.
  const westS=Array.from({length:B.westBents},(_,k)=>op0*(k+1)/(B.westBents+1)),eastS=Array.from({length:B.eastBents},(_,k)=>op1+(F.A-op1)*(k+1)/(B.eastBents+1));
  const columns=[0,1,2,3].map(k=>mix(o0+.8,o1-.8,k/3)),guard=laneGuard(cuts),rib:[number,number]=[o0-.4,o1+.4],pierWidth=rib[1]-rib[0]+.8,pierMid=(rib[0]+rib[1])/2;
  const cap=H-T;
  for(const s of [...westS,...eastS]){
    const feet=columns.map(o=>F.at(s,o)),lane=feet.map(xy=>guard(xy,cap,['V01','S2','structure.bightBridge',...cuts.beds.filter(b=>b.id.startsWith('yearWalk')).map(b=>b.id)])).find(Boolean);
    if(lane){conflict(cuts,'structures.bightBridge.bentInLane',`bightBridge: the bent at s ${s.toFixed(1)} stands in ${lane}'s corridor; it is not built`,F.at(s,oc));report.bents.push({s,side:s<op0?'west':'east',columns:0,built:false});continue;}
    for(const xy of feet)pier(bents,xy,cap-.6,base,[.8,.8],[2.2,2.2]);
    const [a,b]=[P(s,o0-.2,cap),P(s,o1+.2,cap)];slab(caps,a,b,.9,.6);
    // X bracing between neighbouring columns from under the cap to 1 eu over the water (or the ground).
    for(let k=1;k<columns.length;k++){const lo=Math.max(1,base(...F.at(s,columns[k-1]!))+.5,base(...F.at(s,columns[k]!))+.5);if(cap-.6-lo<2)continue;
      slab(bracing,P(s,columns[k-1]!,cap-.6),P(s,columns[k]!,lo+.3),.25,.3);slab(bracing,P(s,columns[k-1]!,lo+.3),P(s,columns[k]!,cap-.6),.25,.3);}
    report.bents.push({s,side:s<op0?'west':'east',columns:columns.length,built:true});
  }
  // Arch piers: 2 eu thick along s, as wide as the ribs, from the deck's underside to their footings.
  for(const s of [op0,op1]){pier(piers,F.at(s,pierMid),cap,base,[2,pierWidth],[3.2,pierWidth+1.2],F.rot);report.bents.push({s,side:'arch',columns:1,built:true});}
  // Deck in bays between its bearings (bents, arch piers, hanger stations).
  const hangers=Array.from({length:7},(_,k)=>op0+(op1-op0)*(k+1)/8),stations=[s0,...westS,op0,...hangers,op1,...eastS,s1].sort((a,b)=>a-b);
  for(let i=1;i<stations.length;i++)slab(deck,P(stations[i-1]!,0,H),P(stations[i]!,0,H),width,T,-oc);
  // Crown lookout bay (MANIFEST bightBridge.lookout): the deck widened to its outer edge between s from and to, a deck part, not a pad.
  const lookout=solid('bightBridge.lookout','bridge','boardwalk','deck',['V01'],district);
  for(let i=1;i<stations.length;i++){const a=Math.max(stations[i-1]!,B.lookout.from),b=Math.min(stations[i]!,B.lookout.to);if(b-a>.01)slab(lookout,P(a,0,H),P(b,0,H),B.lookout.outer-o1,T,-(o1+B.lookout.outer)/2);}
  // Steel through-arch: two ribs springing from the arch piers at deck level, rise archRise, hangers every 4.5 eu to shoes at the deck edges.
  const ribY=(s:number)=>H+B.archRise*(1-((s-sc)/halfOpen)**2),N=16;
  for(const o of rib)for(let k=0;k<N;k++){const a=op0+(op1-op0)*k/N,b=op0+(op1-op0)*(k+1)/N;slab(arch,P(a,o,ribY(a)),P(b,o,ribY(b)),.8,1.2,0,0);}
  for(const s of hangers)for(const o of rib){box(arch,F.at(s,o),ribY(s)-1.1,[.25,.25],cap+.05,F.rot);box(arch,F.at(s,o+(o<0?.1:-.1)),H-.05,[.8,.8],cap+.05,F.rot);report.arch.push({s,rib:ribY(s)});}
  // Portal struts between the ribs (they carry the flyover's hangers).
  const struts=[108,116,124].map(s=>op0+(s-98)/36*(op1-op0));for(const s of struts)slab(arch,P(s,rib[0],ribY(s)),P(s,rib[1],ribY(s)),.6,.8);
  // S2 on the deck (MANIFEST skate.S2.deckLanes, bightBridge.s2Flyover): the lagoon ramp rises 12 → flyover height on its
  // lane, the flyover crosses the road and the Year Walk footways under the arch crown, the sea ramp comes back down.
  const fly=B.flyover,fa=F.so(fly.from),fb=F.so(fly.to),laneW=3.5,rampRise=fly.h-H,rampRun=rampRise/.08;
  const ramps:{id:string;o:number;from:number;to:number;h0:number;h1:number}[]=[{id:'lagoon',o:fa.o,from:fa.s-rampRun,to:fa.s,h0:H,h1:fly.h},{id:'sea',o:fb.o,from:fb.s,to:fb.s+rampRun,h0:fly.h,h1:H}];
  const s2Ids=['S2','structure.bightBridge'],bearingS=[...westS,op0,op1,...eastS];
  for(const r of ramps){
    const rd=solid(`bightBridge.s2Ramp.${r.id}.deck`,'skateRamp','paved','deck',['S2'],district),posts=solid(`bightBridge.s2Ramp.${r.id}.posts`,'post','timber','support',s2Ids,district),rr=solid(`bightBridge.s2Ramp.${r.id}.rails`,'handrail','metal','rail',['S2'],district);
    const hAt=(s:number)=>mix(r.h0,r.h1,(s-r.from)/(r.to-r.from)),cuts2=[r.from,...bearingS.filter(s=>s>r.from&&s<r.to),r.to],path=cuts2.map(s=>P(s,r.o,hAt(s)));
    for(let i=1;i<path.length;i++)slab(rd,path[i-1]!,path[i]!,laneW,.5);
    // Posts over the cap beams (and the arch pier) pass through the deck to bear on them: never on the deck's own planks.
    for(const s of bearingS.filter(s=>s>=r.from-.01&&s<=r.to+1.5)){const top=hAt(clamp(s,r.from,r.to))-.5;if(top-H<.3)continue;for(const side of [-1,1])box(posts,F.at(s,r.o+side*1.3),top,[.4,.4],cap,F.rot);}
    for(const side of [-1,1])postedRail(rr,path,-(side*(laneW/2-.05)));
    cuts.solids.push(rd,rr);if(posts.indices.length)cuts.solids.push(posts);
    const rb=bed(`structure.bightBridge.s2Ramp.${r.id}`,'skateMain',path,false);rb.width=laneW;rb.structureIds=['bightBridge'];cuts.beds.push(rb);
    report.deckProfile.push({lane:`S2 ${r.id} ramp`,o:r.o,points:path.map(p=>[Number(F.so([p[0],p[2]]).s.toFixed(2)),Number(p[1].toFixed(2))])});
  }
  {// The flyover: deck on the ramp ends' posts, hung between them from the portal struts (hangers to shoes at its edges).
    const fd=solid('bightBridge.s2Flyover.deck','skateFlyover','paved','deck',['S2'],district),fr=solid('bightBridge.s2Flyover.rails','handrail','metal','rail',['S2'],district),ends:[XYZ,XYZ]=[P(fa.s,fa.o,fly.h),P(fb.s,fb.o,fly.h)];
    // Integrator 3: the flyover is as wide as S2's own bed (4, profiles.skateMain) and follows S2's own line between its ends
    // (S2's spline bends through the crown up to 1.9 m off the straight chord): its rails stand at the bed's edges (P09 read
    // S2's edge outboard of 3.5 m straight-chord rails at 5.6 over the deck); the deck lanes keep 3.5 (the 21.6 m section).
    const s2bed=cuts.beds.find(b=>b.id==='S2'),flyW=Math.max(laneW,s2bed?.width??laneW);
    const flyPath:XYZ[]=[ends[0],...(s2bed?.points??[]).filter(p=>{const q=F.so(plan(p));return q.s>fa.s+.5&&q.s<fb.s-.5&&Math.abs(q.o-(fa.o+(fb.o-fa.o)*(q.s-fa.s)/(fb.s-fa.s)))<4;}).map(p=>[p[0],fly.h,p[2]] as XYZ),ends[1]];
    for(let i=1;i<flyPath.length;i++)slab(fd,flyPath[i-1]!,flyPath[i]!,flyW,T);for(const side of [-1,1])postedRail(fr,flyPath,side*(flyW/2-.05));
    const edge=flyW/2+.25,flyS=flyPath.map(p=>F.so(plan(p)).s);
    for(const s of struts){const i=flyS.findIndex((v,k)=>k>0&&flyS[k-1]!<=s&&v>=s);if(i<1)continue;
      const a=flyPath[i-1]!,b=flyPath[i]!,t=(s-flyS[i-1]!)/((flyS[i]!-flyS[i-1]!)||1),c:XY=[mix(a[0],b[0],t),mix(a[2],b[2],t)],l=distance(plan(a),plan(b))||1,n:XY=[-(b[2]-a[2])/l,(b[0]-a[0])/l];
      for(const side of [-1,1]){const xy:XY=[c[0]+n[0]*side*edge,c[1]+n[1]*side*edge];box(arch,xy,ribY(F.so(xy).s)-.7,[.25,.25],fly.h-.55,F.rot);box(arch,xy,fly.h-.05,[.6,.6],fly.h-.55,F.rot);}}
    cuts.solids.push(fd,fr);const fb2=bed('structure.bightBridge.s2Flyover','skateMain',flyPath,false);fb2.width=flyW;fb2.structureIds=['bightBridge'];cuts.beds.push(fb2);
    report.deckProfile.push({lane:'S2 flyover',o:(fa.o+fb.o)/2,points:[[Number(fa.s.toFixed(2)),fly.h],[Number(fb.s.toFixed(2)),fly.h]]});
    const road=fly.h-T-H;cuts.diagnostics.push({id:'structures.bightBridge.s2Flyover.clear',severity:road<fly.clear-.01?'conflict':'info',message:`bightBridge: the S2 flyover's underside stands ${road.toFixed(2)} eu over the road deck (need ${fly.clear})`,at:F.at((fa.s+fb.s)/2,0),measured:road,required:fly.clear});
  }
  // Rails: both deck edges the whole length (the lagoon edge opens onto the lookout), the lookout's three open sides,
  // and kerb rails between each S2 lane and the footway beside it where S2 rides the deck at deck level. A rail run on
  // the axis takes offset −o (postedRail's offset, like slab's, is along the path's left normal, −o here).
  // The deck-edge parapets are kind deckParapet: nothing walks beyond a deck edge, so a route's corridor clearance
  // (junctions.ts clearRouteCorridors: S2's sea lane reaches 0.25 past the edge) never cuts them; the kerb rails can be.
  const edgeRail=(a:number,b:number,o:number,into:StructureSolid=rails)=>postedRail(into,axis(a,b,0,H),-o);
  edgeRail(s0,s1,o0+.05);edgeRail(s0,B.lookout.from,o1-.05);edgeRail(B.lookout.to,s1,o1-.05);edgeRail(B.lookout.from,B.lookout.to,B.lookout.outer-.05);
  for(const s of [B.lookout.from,B.lookout.to])postedRail(rails,[P(s,o1,H),P(s,B.lookout.outer,H)],0);
  // Wave 6: a kerb rail opens where S2 itself crosses its line (S2 comes off the Wash ramp onto the west deck end across the
  // kerb's line: candidate 4's body stopped on a post at [469.2,12,1025.6]) — as landings open their rails where a route joins.
  const kerbRun=(a:number,b:number,o:number)=>{const s2=cuts.beds.find(q=>q.id==='S2'),gaps:[number,number][]=[];
    if(s2)for(let i=1;i<s2.points.length;i++){const p0=F.so(plan(s2.points[i-1]!)),p1=F.so(plan(s2.points[i]!));if((p0.o-o)*(p1.o-o)>0||p0.o===p1.o)continue;
      const t=(o-p0.o)/(p1.o-p0.o),sx=mix(p0.s,p1.s,t),y=mix(s2.points[i-1]![1],s2.points[i]![1],t);if(sx<a-3||sx>b+3||Math.abs(y-H)>1.5)continue;
      const len=Math.hypot(p1.s-p0.s,p1.o-p0.o)||1,sin=Math.max(.25,Math.abs(p1.o-p0.o)/len),half=Math.min(12,(Math.max(laneW,s2.width??laneW)/2+.6)/sin);gaps.push([sx-half,sx+half]);}
    let from=a;for(const [g0,g1] of gaps.sort((m,n)=>m[0]-n[0])){if(g0-from>.5)edgeRail(from,Math.min(g0,b),o,kerbs);from=Math.max(from,g1);}
    if(b-from>.5)edgeRail(from,b,o,kerbs);
    if(gaps.length)cuts.diagnostics.push({id:'structures.bightBridge.kerbGap',severity:'info',message:`bightBridge: the kerb rail at o ${o.toFixed(2)} opens for S2 at s ${gaps.map(g=>`${g[0].toFixed(1)}–${g[1].toFixed(1)}`).join(', ')}`,at:F.at((gaps[0]![0]+gaps[0]![1])/2,o),measured:gaps[0]![1]-gaps[0]![0],required:laneW});};
  kerbRun(s0,ramps[0]!.from,ramps[0]!.o-laneW/2-.1);kerbRun(ramps[1]!.to,s1,ramps[1]!.o+laneW/2+.1);
  cuts.solids.push(deck,lookout,caps,bents,piers,arch,rails,kerbs);if(bracing.indices.length)cuts.solids.push(bracing);
  // Abutments: a masonry block under each deck end down to the ground, then the V01 approach walled down to grade.
  const abut=solid('bightBridge.abutments','abutment','stone','support',ids,district);
  for(const [end,out] of [[s0,-1],[s1,1]] as const)wallToGround(abut,P(end-out*1.5,0,cap),P(end+out*2,0,cap),width+1,-oc,base);
  if(route){const total=planLength(route.points);
    for(const [end,out] of [[s0,-1],[s1,1]] as const){const e=nearestOnPath(F.at(end,0),route.points).along,dir=nearestOnPath(F.at(end+out*10,0),route.points).along>e?1:-1;let dry=false;
      for(let k=0;k<12;k++){const a=clamp(e+dir*k*2,0,total),b=clamp(e+dir*(k+1)*2,0,total);if(Math.abs(b-a)<.5)break;const p0=along(route.points,a).p,p1=along(route.points,b).p,g=Math.min(base(p0[0],p0[2]),base(p1[0],p1[2]));
        if(g>=-.5)dry=true;if(dry&&Math.max(p0[1],p1[1])-.6-g<=.3)break;wallToGround(abut,[p0[0],p0[1]-.6,p0[2]],[p1[0],p1[1]-.6,p1[2]],width-4,0,base);}
      if(!dry)conflict(cuts,'structures.bightBridge.abutment',`bightBridge: no dry bank within 24 eu of the ${out<0?'west':'east'} deck end (the embankment is terrain's); the abutment stands on the seabed, the channel is not filled`,F.at(end,0));}}
  cuts.solids.push(abut);
  // The ferry's hull (MANIFEST water_routes.FERRY.beam_m) against every pier and bent in the water.
  {const ferry=sampleSpline(M.water_routes.FERRY.pts as unknown as XY[],1);let worst=Infinity,at:XY=[0,0];
    const obstacles:{s:[number,number];o:[number,number]}[]=[...[op0,op1].map(s=>({s:[s-1,s+1] as [number,number],o:[pierMid-pierWidth/2,pierMid+pierWidth/2] as [number,number]})),...report.bents.filter(b=>b.built&&b.side!=='arch').flatMap(b=>columns.map(o=>({s:[b.s-1.1,b.s+1.1] as [number,number],o:[o-1.1,o+1.1] as [number,number]})))];
    for(const p of ferry){const q=F.so(p);if(q.s<-20||q.s>F.A+20||Math.abs(q.o)>60)continue;for(const r of obstacles){const ds=Math.max(r.s[0]-q.s,0,q.s-r.s[1]),dO=Math.max(r.o[0]-q.o,0,q.o-r.o[1]),c=Math.hypot(ds,dO)-B.beam/2;if(c<worst){worst=c;at=p;}}}
    report.ferryClearance=worst;report.ferryAt=at;
    cuts.diagnostics.push({id:'structures.bightBridge.ferryHull',severity:worst<0?'conflict':'info',message:`bightBridge: an ${B.beam} m ferry hull on the FERRY line passes ${worst.toFixed(2)} eu clear of the nearest arch pier or bent footing (the opening s ${op0}–${op1} is centred on s ${sc}; the ferry crosses the deck edges at s ≈ 113–131)`,at:[Number(at[0].toFixed(2)),Number(at[1].toFixed(2))],measured:worst,required:0});}
  report.deckProfile.unshift({lane:'deck (V01, Year Walk footways, S2 at deck level)',o:oc,points:[[Number(s0.toFixed(2)),H],[Number(s1.toFixed(2)),H]]});
  // Beds: the structural deck (so the junction solver never re-bridges it) and the source routes marked as carried.
  const deckBed=bed('structure.bightBridge','road',axis(s0,s1,oc,H),false);deckBed.width=width;deckBed.structureIds=['bightBridge'];cuts.beds.push(deckBed);
  const lookBed=bed('structure.bightBridge.lookout','walk',axis(B.lookout.from,B.lookout.to,(o1+B.lookout.outer)/2,H),false);lookBed.width=B.lookout.outer-o1;lookBed.structureIds=['bightBridge'];cuts.beds.push(lookBed);
  if(route)route.structureIds.push('bightBridge');const s2=cuts.beds.find(b=>b.id==='S2');if(s2&&!s2.structureIds.includes('bightBridge'))s2.structureIds.push('bightBridge');
  cuts.diagnostics.push({id:'structures.bightBridge.summary',severity:'info',message:`bightBridge: ${B.span} eu deck at ${H}, ${report.bents.filter(b=>b.side!=='arch'&&b.built).length} timber bents + 2 arch piers, arch crown ${(H+B.archRise).toFixed(1)}, opening ${op1-op0-2} eu clear × ${cap} eu under the deck`,at:F.at(sc,0),measured:op1-op0-2,required:B.clearWidth});
  return report;
}
/** A closed perimeter rail (posts ≤ 2 eu, bars between kept posts) left open for 1.8 eu either side of each gap point. */
function perimeterRail(rails:StructureSolid,loop:readonly XYZ[],gaps:readonly XY[],inset=.1,gapHalf=1.8):void {
  for(let i=0;i<loop.length;i++){const a=loop[i]!,b=loop[(i+1)%loop.length]!,len=distance(plan(a),plan(b)),n=Math.max(1,Math.ceil(len/2)),dir:XY=[(b[0]-a[0])/(len||1),(b[2]-a[2])/(len||1)];let prev:XYZ|undefined;
    for(let k=0;k<=n;k++){const t=k/n,p:XYZ=[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)],xy:XY=[p[0]-dir[1]*-inset,p[2]+dir[0]*-inset];
      if(gaps.some(g=>distance(g,plan(p))<gapHalf)){prev=undefined;continue;}
      box(rails,xy,p[1]+1.05,[.1,.1],p[1]-.35);if(prev)slab(rails,prev,p,.09,.09,-inset,1.05);prev=p;}}
}
/** Railed decks whose rails wait for every route to exist: a gap is left wherever a route at the deck's level crosses its edge. */
const pendingRails:{rails:StructureSolid;loop:XYZ[];own:string[]}[]=[];
function railLater(rails:StructureSolid,loop:XYZ[],own:string[]):void {pendingRails.push({rails,loop,own});}
function exitsThrough(cuts:LandCuts,loop:readonly XYZ[],own:readonly string[]):XY[] {
  const out:XY[]=[],h=loop[0]![1],cross=(p:XY,q:XY,a:XY,b:XY):number|undefined=>{const r:XY=[q[0]-p[0],q[1]-p[1]],s:XY=[b[0]-a[0],b[1]-a[1]],d=r[0]*s[1]-r[1]*s[0];if(Math.abs(d)<1e-9)return undefined;const t=((a[0]-p[0])*s[1]-(a[1]-p[1])*s[0])/d,u=((a[0]-p[0])*r[1]-(a[1]-p[1])*r[0])/d;return t>=0&&t<=1&&u>=0&&u<=1?t:undefined;};
  for(const b of cuts.beds){if(!['walk','trail','stair','road','boardwalk','skate'].includes(b.kind)||own.includes(b.id))continue;
    for(let i=1;i<b.points.length;i++){const p=b.points[i-1]!,q=b.points[i]!;
      for(let j=0;j<loop.length;j++){const a=loop[j]!,c=loop[(j+1)%loop.length]!,t=cross(plan(p),plan(q),plan(a),plan(c));if(t===undefined)continue;const y=mix(p[1],q[1],t);if(Math.abs(y-h)<1.6)out.push([mix(p[0],q[0],t),mix(p[2],q[2],t)]);}}
    // A route that ends on the edge (a stair's head) without crossing it.
    for(const e of [b.points[0]!,b.points.at(-1)!])if(Math.abs(e[1]-h)<1.6)for(let j=0;j<loop.length;j++){const a=loop[j]!,c=loop[(j+1)%loop.length]!,hit=nearestOnPath(plan(e),[a,c]);if(hit.distance<1.6)out.push(plan(hit.at));}
  }
  return out;
}
/** Wave 7 (A1.3 kerb gaps): open rail lines (a span's parapet, a deck edge) drawn once every route exists, broken for
 * `gapHalf` eu either side of each place a foot, skate or road route at the line's height (±1.6) crosses it at ≥ 25° —
 * a route joining the deck through its edge (the dam portage onto the apron bridge) — or ends on it. `draw` draws a
 * run a→b of the rail. */
const pendingLines:{line:XYZ[];own:string[];gapHalf:number;draw:(run:XYZ[])=>void}[]=[];
function railLineLater(line:XYZ[],own:string[],draw:(run:XYZ[])=>void,gapHalf=1.8):void {pendingLines.push({line,own,gapHalf,draw});}
/** Wave 7 (A1.2): a posted rail along a deck edge wherever the ground 1 eu outside the edge (`outward`, a plan unit
 * normal) lies more than BODY_DROP below the deck, with kerb gaps where a route joins through the edge. */
const BODY_DROP=1.25;
function guardEdgeLater(rails:StructureSolid,line:XYZ[],outward:XY,own:string[],base:HeightQuery):void {
  const drop=(p:XYZ)=>p[1]-base(p[0]+outward[0],p[2]+outward[1])>BODY_DROP;
  railLineLater(line,own,run=>{let cur:XYZ[]=[];const flush=()=>{if(cur.length>1)postedRail(rails,cur,0);cur=[];};
    const mid=(a:XYZ,b:XYZ):XYZ=>[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
    for(let i=0;i<run.length;i++){const p=run[i]!;if(drop(p)||i+1<run.length&&drop(mid(p,run[i+1]!))||i>0&&drop(mid(run[i-1]!,p)))cur.push(p);else flush();}flush();});
}
/** A route crossing a rail line up to this far above the deck is landing on it through the rail (the dam portage's
 * treads pass the apron bridge's west parapet line 2.4 over the deck and land between the parapets). */
const LANDING_OVER=3.5;
function lineGaps(cuts:LandCuts,line:readonly XYZ[],own:readonly string[]):number[] {
  const out:number[]=[],arc=[0];for(let i=1;i<line.length;i++)arc.push(arc[i-1]!+distance(plan(line[i-1]!),plan(line[i]!)));
  for(const b of cuts.beds){if(!['walk','trail','stair','road','boardwalk','skate'].includes(b.kind)||own.includes(b.id))continue;
    for(let i=1;i<b.points.length;i++){const p=b.points[i-1]!,q=b.points[i]!,pl=distance(plan(p),plan(q));if(pl<1e-6)continue;
      for(let j=1;j<line.length;j++){const a=line[j-1]!,c=line[j]!,al=distance(plan(a),plan(c));if(al<1e-6)continue;
        const r:XY=[q[0]-p[0],q[2]-p[2]],s:XY=[c[0]-a[0],c[2]-a[2]],d=r[0]*s[1]-r[1]*s[0];if(Math.abs(d)<1e-9)continue;
        const t=((a[0]-p[0])*s[1]-(a[2]-p[2])*s[0])/d,u=((a[0]-p[0])*r[1]-(a[2]-p[2])*r[0])/d;if(t<0||t>1||u<0||u>1)continue;
        const sin=Math.abs(d)/(pl*al),y=mix(p[1],q[1],t),h=mix(a[1],c[1],u);if(sin<Math.sin(25*Math.PI/180)||y-h< -1.6||y-h>LANDING_OVER)continue;out.push(arc[j-1]!+u*al);}}
    for(const e of [b.points[0]!,b.points.at(-1)!]){const hit=nearestOnPath(plan(e),line);if(hit.distance<1.2&&Math.abs(e[1]-hit.at[1])<1.6)out.push(hit.along);}
  }
  return out;
}
function flushLines(cuts:LandCuts):void {
  for(const r of pendingLines.splice(0)){const gaps=lineGaps(cuts,r.line,r.own).sort((a,b)=>a-b),total=planLength(r.line);let from=0;
    const run=(a:number,b:number)=>{if(b-a<.5)return;const n=Math.max(1,Math.ceil((b-a)/2)),pts:XYZ[]=[];for(let k=0;k<=n;k++)pts.push(along(r.line,a+(b-a)*k/n).p);r.draw(pts);};
    for(const g of gaps){run(from,Math.min(g-r.gapHalf,total));from=Math.max(from,g+r.gapHalf);}run(from,total);}
}
/** A polyline moved `offset` along its left normal (per segment, the joints averaged). */
function offsetLine(path:readonly XYZ[],offset:number):XYZ[] {
  return path.map((p,i)=>{const a=path[Math.max(0,i-1)]!,b=path[Math.min(path.length-1,i+1)]!,l=distance(plan(a),plan(b))||1,n:XY=[-(b[2]-a[2])/l,(b[0]-a[0])/l];return [p[0]+n[0]*offset,p[1],p[2]+n[1]*offset] as XYZ;});
}
function flushRails(cuts:LandCuts):void {for(const r of pendingRails.splice(0))perimeterRail(r.rails,r.loop,exitsThrough(cuts,r.loop,r.own));flushLines(cuts);}
/** v2.0 (D-A3): a cable tower on a footing to the ground: four legs, cross bracing and a head frame at the cable. W5-A's
 * tower solve (beds/build.ts) supplies the top; a top above the sky ceiling is the solver's failure to report, not clamped here. */
export function cableTower(out:StructureSolid,bracing:StructureSolid,at:XY,top:number,base:HeightQuery,spread=2):void {
  const ground=Math.min(...[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>base(at[0]+x!*spread,at[1]+z!*spread))),legs=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z]):XY=>[at[0]+x!*spread,at[1]+z!*spread]);
  for(const xy of legs)pier(out,xy,top-1,base,[.6,.6],[1.6,1.6]);
  box(out,at,top,[2*spread+1,2*spread+1],top-1);
  for(let y=ground+6;y<top-4;y+=8)for(let i=0;i<4;i++){const a=legs[i]!,b=legs[(i+1)%4]!;slab(bracing,[a[0],y,a[1]],[b[0],Math.min(y+8,top-1),b[1]],.2,.25);slab(bracing,[a[0],Math.min(y+8,top-1),a[1]],[b[0],y,b[1]],.2,.25);}
}
/** v2.0 named structures carried on a route's own graded points (MANIFEST structures.<id> with from/to and length_m):
 * deck → cap beam → bents (`bentOffsets` across the deck) every ≤ `spacing` eu → footings to the ground. A bent never
 * stands in a lower corridor (the lane guard, plus `avoid` for a route's own lower pass): it moves along the deck up to
 * 3 eu or is refused and reported; a bay over 12 eu (timber) is a conflict. Rails on posts on both edges. */
function carriedDeck(id:string,route:BedCut,path:XYZ[],width:number,cuts:LandCuts,base:HeightQuery,o:{spacing?:number;bentOffsets?:number[];avoid?:(xy:XY)=>string|undefined;kind?:string;bedProfile?:string}={}):{bents:number[];refused:number[]} {
  const district=districtAt(...plan(path[Math.floor(path.length/2)]!)),ids=[route.id,`structure.${id}`],guard=laneGuard(cuts),length=planLength(path),spacing=o.spacing??6,offsets=o.bentOffsets??[-(width/2-.6),width/2-.6];
  const deck=solid(`${id}.deck`,o.kind??'trestle','boardwalk','deck',[route.id],district),supports=solid(`${id}.supports`,'trestle','timber','support',ids,district),caps=solid(`${id}.caps`,'capBeam','timber','support',ids,district),rails=solid(`${id}.rails`,'handrail','metal','rail',[route.id],district);
  for(let i=1;i<path.length;i++)slab(deck,path[i-1]!,path[i]!,width,.6);
  const feetAt=(s:number)=>{const {p,dir}=along(path,s);return {p,feet:offsets.map(off=>[p[0]-dir[1]*off,p[2]+dir[0]*off] as XY)};},bents:number[]=[],refused:number[]=[],refusedWhy=new Map<number,string>();
  const blocked=(s:number)=>{const {p,feet}=feetAt(s);return feet.map(xy=>guard(xy,p[1]-.6,ids)??o.avoid?.(xy)).find(Boolean);};
  const n=Math.max(1,Math.ceil(length/spacing));
  for(let k=0;k<=n;k++){const s0=length*k/n;let s:number|undefined;
    for(const shift of [0,.5,-.5,1,-1,1.5,-1.5,2,-2,2.5,-2.5,3,-3,3.5,-3.5,4,-4,4.5,-4.5,5,-5]){const v=clamp(s0+shift,0,length);if(!blocked(v)){s=v;break;}}
    // Always drawn (the offline ground is not the final terrain: S1's lower pass cuts the hill under its upper pass);
    // settleFoundations carries each footing down to the final ground.
    // Wave 7 (A1.1): a refused bent is reported once the bays are known: a conflict only if no girder carries its bay.
    if(s===undefined){refused.push(s0);refusedWhy.set(s0,`${blocked(s0)}`);continue;}
    const at=feetAt(s);for(const xy of at.feet)pier(supports,xy,at.p[1]-1.2,base,[.5,.5],[1.4,1.4]);
    const e0=at.feet[0]!,e1=at.feet.at(-1)!,d=distance(e0,e1)||1,ex=.45/d;slab(caps,[e0[0]-(e1[0]-e0[0])*ex,at.p[1]-.6,e0[1]-(e1[1]-e0[1])*ex],[e1[0]+(e1[0]-e0[0])*ex,at.p[1]-.6,e1[1]+(e1[1]-e0[1])*ex],.6,.6);bents.push(s);}
  bents.sort((a,b)=>a-b);
  // A bay over 12 eu (a refused bent over a lower route) is carried by steel girders under both deck edges, bearing on the
  // cap beams either side (≤ 24 eu, reported as information); longer is a conflict.
  const girders=solid(`${id}.girders`,'truss','metal','support',ids,district);
  for(let i=1;i<bents.length;i++){const bay=bents[i]!-bents[i-1]!,at=plan(along(path,(bents[i]!+bents[i-1]!)/2).p);if(bay<=12.01)continue;
    if(bay>24.01){conflict(cuts,`structures.${id}.bay`,`${id}: a ${bay.toFixed(1)} eu bay exceeds the 24 eu girder limit`,at,bay,24);continue;}
    const a=along(path,bents[i-1]!).p,b=along(path,bents[i]!).p;for(const side of [-1,1])slab(girders,[a[0],a[1]-.6,a[2]],[b[0],b[1]-.6,b[2]],.4,.9,side*(width/2-.4));
    cuts.diagnostics.push({id:`structures.${id}.girderSpan`,severity:'info',message:`${id}: steel girders carry a ${bay.toFixed(1)} eu bay over a lower route`,at,measured:bay,required:24});}
  if(girders.indices.length)cuts.solids.push(girders);
  for(const r of refused){const i=bents.findIndex(b=>b>r),bay=i>0?bents[i]!-bents[i-1]!:Infinity,at=plan(along(path,r).p);
    if(bay<=24.01)cuts.diagnostics.push({id:`structures.${id}.bentOmitted`,severity:'info',message:`${id}: no bent at ${r.toFixed(1)} eu (it would stand in ${refusedWhy.get(r)}'s corridor); the ${bay.toFixed(1)} eu bay ${bay>12.01?'is carried by steel girders under both deck edges bearing on the cap beams at':'spans between the bents at'} ${bents[i-1]!.toFixed(1)} and ${bents[i]!.toFixed(1)} eu`,at,measured:bay,required:24});
    else conflict(cuts,`structures.${id}.bentInLane`,`${id}: the bent at ${r.toFixed(1)} eu stands in ${refusedWhy.get(r)}'s corridor (and 5 eu either way); it is not built and no girder carries its ${Number.isFinite(bay)?bay.toFixed(1)+' eu ':''}bay`,at,bay,24);}
  for(const side of [-1,1])postedRail(rails,path,side*(width/2-.05));
  cuts.solids.push(deck,rails);if(supports.indices.length)cuts.solids.push(supports,caps);
  const b=bed(`structure.${id}`,o.bedProfile??'walk',path,false);b.width=width;b.structureIds=[id];cuts.beds.push(b);route.structureIds.push(id);
  return {bents,refused};
}
/** A route's own points between two plan points (ends interpolated), taking the higher pass where the route crosses itself. */
function stretchBetween(route:BedCut,from:XY,to:XY,reach=4):XYZ[] {
  const pick=(q:XY)=>{const d=route.points.map(p=>distance(plan(p),q)),near=d.map((_,i)=>i).filter(i=>d[i]!<=reach);
    if(!near.length)return d.indexOf(Math.min(...d));const top=Math.max(...near.map(i=>route.points[i]![1]));return near.filter(i=>route.points[i]![1]>top-.5).sort((a,b)=>d[a]!-d[b]!)[0]!;};
  let i0=pick(from),i1=pick(to);const flip=i0>i1;if(flip)[i0,i1]=[i1,i0];
  const out=route.points.slice(i0,i1+1).map(p=>[p[0],p[1],p[2]] as XYZ);return flip?out.reverse():out;
}
/** v2.0 kinds with length_m (not the generic span_m footbridge): D-C15 skateFlyover, D-C9 trestle, D-C14 cliff-stair. */
export function buildNamedKinds(cuts:LandCuts,base:HeightQuery):void {
  const S=M.structures as unknown as Record<string,{kind?:string;from?:number[];to?:number[];from_h?:number;to_h?:number;width_m?:number;over?:string;carries?:string}>;
  {// D-C15 S1 flyover: the upper pass on S1's own grade; bents outside the lower pass's corridor (its centreline ± 3).
    const f=S.s1Flyover,s1=cuts.beds.find(b=>b.id==='S1');
    if(f&&s1&&f.from&&f.to){const path=stretchBetween(s1,f.from as unknown as XY,f.to as unknown as XY),top=Math.min(...path.map(p=>p[1])),mid=planLength(path)/2,cross=along(path,mid).p;
      const lower=s1.points.filter(p=>p[1]<top-5&&distance(plan(p),plan(cross))<40),avoid=(xy:XY)=>lower.length>1&&nearestOnPath(xy,lower).distance<3?'S1 (lower pass)':undefined;
      const r=carriedDeck('s1Flyover',s1,path,f.width_m??4,cuts,base,{kind:'skateFlyover',bedProfile:'skateMain',avoid,bentOffsets:[-1.4,1.4]});
      const under=lower.length>1?Math.min(...path.map(p=>{const h=nearestOnPath(plan(p),lower);return h.distance<3?p[1]-.6-h.at[1]:Infinity;})):Infinity;
      cuts.diagnostics.push({id:'structures.s1Flyover.clear',severity:under<2.4?'conflict':'info',message:`s1Flyover: ${r.bents.length} bents, ${r.refused.length} refused; the deck's underside clears S1's lower pass by ${under.toFixed(2)} eu`,at:plan(cross),measured:under,required:2.4});}}
  {// D-C9 VBS trestle: bents on the west edge and the centreline only; the S4-side (east) edge cantilevers.
    const f=S.bightSpurTrestle,vbs=cuts.beds.find(b=>b.id==='spur VBS'||b.id==='VBS');
    if(f&&vbs&&f.from&&f.to){const path=stretchBetween(vbs,f.from as unknown as XY,f.to as unknown as XY),w=f.width_m??5,{dir}=along(path,planLength(path)/2),west=-dir[1]<0?1:-1;
      carriedDeck('bightSpurTrestle',vbs,path,w,cuts,base,{bentOffsets:[0,west*(w/2-.6)],bedProfile:'road'});}}
  {// v2.4 (integrator 4): the Year Walk's November loop over its own lower lane at the Prow — the upper pass on the Year Walk's
    // own grade; bents outside the lower lane's corridor (its centreline ± 4.5: 5.2 walk + shoulders).
    const f=S.prowLoopFootbridge,yw=cuts.beds.find(b=>b.id==='yearWalk');
    if(f&&yw&&f.from&&f.to){const path=stretchBetween(yw,f.from as unknown as XY,f.to as unknown as XY),top=Math.min(...path.map(p=>p[1])),mid=planLength(path)/2,cross=along(path,mid).p;
      const lower=yw.points.filter(p=>p[1]<top-3&&distance(plan(p),plan(cross))<30),avoid=(xy:XY)=>lower.length>1&&nearestOnPath(xy,lower).distance<4.5?'yearWalk (the lower lane)':undefined;
      const r=carriedDeck('prowLoopFootbridge',yw,path,f.width_m??6,cuts,base,{kind:'footbridge',avoid});
      const under=lower.length>1?Math.min(...path.map(p=>{const h=nearestOnPath(plan(p),lower);return h.distance<3?p[1]-.6-h.at[1]:Infinity;})):Infinity;
      cuts.diagnostics.push({id:'structures.prowLoopFootbridge.clear',severity:under<2.4?'conflict':'info',message:`prowLoopFootbridge: ${r.bents.length} bents, ${r.refused.length} refused; the deck's underside clears the Year Walk's lower lane by ${under.toFixed(2)} eu`,at:plan(cross),measured:under,required:2.4});}}
  {// D-C14 Scholars Cove cliff stair: two flights along the face with a landing at mid-height, a posted parapet on the sea side.
    // The foot lands on the Scholars Cove ferry dock's deck (built at the water + 0.6 = 1.0; MANIFEST to_h says 1.8: a 0.8 lip).
    const f=S.coveStair,dockDeck=cuts.beds.find(b=>b.id==='ferry.scholarsCove')?.points[0]?.[1];
    if(f&&f.from&&f.to){const top:XYZ=[f.from[0]!,f.from_h??34.1,f.from[1]!],foot:XYZ=[f.to[0]!,dockDeck??f.to_h??1.8,f.to[1]!],mid=(top[1]+foot[1])/2;
      // The face runs from the cove walk's end toward [604,252] (MANIFEST coveStair.along); the sea is on its north side.
      const far:XY=[604,252],u:XY=(()=>{const d=distance(plan(top),far);return [(far[0]-top[0])/d,(far[1]-top[2])/d];})(),nA:XY=[u[1],-u[0]],seaN:XY=nA[1]<0?nA:[-nA[0],-nA[1]];
      const run=distance(plan(top),far)-2,b1:XYZ=[top[0]+u[0]*run,mid,top[2]+u[1]*run],b2:XYZ=[b1[0]+seaN[0]*3.5,mid,b1[2]+seaN[1]*3.5];
      // The Scholars Cove ferry dock (16 eu along z on the pier point) reaches under the cliff top: the stair lands on it, it is not a lane under it.
      const dock=['ferry.scholarsCove'];buildStair('coveStair.flight.0',top,b1,3,cuts,base,dock);buildStair('coveStair.flight.1',b2,foot,3,cuts,base,dock);
      const c:XY=[b1[0]+u[0]*1.5+seaN[0]*1.75,b1[2]+u[1]*1.5+seaN[1]*1.75],rot=Math.atan2(u[1],u[0])*180/Math.PI,district=districtAt(...c);
      const slabS=solid('coveStair.landing.slab','landing','stone','floor',['coveStair.landing'],district),cols=solid('coveStair.landing.columns','tower','stone','support',['coveStair.landing'],district),lr=solid('coveStair.landing.rails','handrail','metal','rail',['coveStair.landing'],district);
      box(slabS,c,mid,[3,6.5],mid-.6,rot);const q=(x:number,z:number):XY=>[c[0]+u[0]*x+seaN[0]*z,c[1]+u[1]*x+seaN[1]*z];
      for(const [x,z] of [[-1,-1],[-1,1],[1,-1],[1,1]] as const)pier(cols,q(x*1,z*2.75),mid-.6,base,[.6,.6],[1.4,1.4]);
      const Q=(x:number,z:number):XYZ=>{const p=q(x,z);return [p[0],mid,p[1]];};
      postedRail(lr,[Q(-1.5,3.25),Q(1.5,3.25),Q(1.5,-3.25)],0);cuts.solids.push(slabS,cols,lr);
      const lb=bed('coveStair.landing','walk',[b1,Q(0,0),b2],false);lb.width=3;cuts.beds.push(lb);
      cuts.diagnostics.push({id:'structures.coveStair.terrainBench',severity:'info',message:`coveStair: two flights ${top[1]} → ${mid.toFixed(2)} → ${foot[1]} along the cove face; the terrain bench under them is terrain's (W5-T request)`,at:plan(b1),measured:mid,required:mid});}}
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
  // Wave 7 (A1.3): the parapets wait for every route: a kerb gap opens where a route joins the deck through its edge
  // (S1 × the dam portage on the apron bridge, [1160.8,940.1]).
  for(const side of [-1,1])railLineLater(offsetLine(path,side*(spec.width/2-.125)),[spec.route,`structure.${spec.id}`],run=>{for(let i=1;i<run.length;i++){slab(rails,run[i-1]!,run[i]!,.25,1,0,1);slab(rails,run[i-1]!,run[i]!,.4,.15,0,1.15);}});
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
export interface TunnelOptions { bedIds?:string[]; base?:HeightQuery; /** v2.0 (D-A4) gallery: the side (±1 along the path's left normal) left open to the view: no wall, a colonnade of
 * columns on footings carries the roof's edge and a posted parapet guards the carriageway. */ openSide?:number; columnSpacing?:number }
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
      if(side!==options.openSide)slab(walls,a,b,.6,clear+.6,side*(width/2+.3),clear);
      // Below the floor slab the wall continues as a footing strip to the ground wherever the ground falls away.
      if(base)wallToGround(footings,[a[0],a[1]-.6,a[2]],[b[0],b[1]-.6,b[2]],.6,side*(width/2+.3),base,.3);
    }
  }
  cuts.solids.push(floor,walls,roof);if(footings.indices.length)cuts.solids.push(footings);
  if(options.openSide&&base){
    // The open side: columns every ≤ columnSpacing eu from the roof's underside to footings on the ground, and a parapet
    // on posts along the carriageway's open edge (the drop to the sea side is guarded wherever it is).
    const side=options.openSide,colonnade=solid(`${id}.colonnade`,'column','stone','support',bedIds,district),parapet=solid(`${id}.parapet`,'parapet','metal','rail',bedIds,district),length=planLength(points),n=Math.max(1,Math.ceil(length/(options.columnSpacing??6)));
    for(let k=0;k<=n;k++){const {p,dir}=along(points,length*k/n),o=side*(width/2+.3);pier(colonnade,[p[0]-dir[1]*o,p[2]+dir[0]*o],p[1]+clear,base,[.7,.7],[1.8,1.8]);}
    postedRail(parapet,points,side*(width/2-.1));cuts.solids.push(colonnade,parapet);
  }
}
/** v2.0 (D-A4): eu a gallery's roof stands over its stated headroom at the road's centreline (the verges' cross-fall). */
export const GALLERY_MARGIN=.4;
/** The side (±1 along the path's left normal) whose ground stands lower beside the road: a gallery's open (sea) side. */
function gallerySeaSide(points:readonly XYZ[],base:HeightQuery):number {
  const length=planLength(points);let left=0;
  for(let k=1;k<10;k++){const {p,dir}=along(points,length*k/10);for(const side of [-1,1]){const o=side*14;left+=side*base(p[0]-dir[1]*o,p[2]+dir[0]*o);}}
  return left<0?1:-1;
}
/** The gallery's headroom over every route bed under its roof (V01 and the Year Walk verges), measured. */
function galleryHeadroom(id:string,points:readonly XYZ[],width:number,clear:number,cuts:LandCuts):void {
  let worst=Infinity,at:XY=[0,0],bedId='';const length=planLength(points);
  for(const b of cuts.beds){if(!['road','walk','skate','trail'].includes(b.kind)||b.id===id||b.id.startsWith('structure.'))continue;
    for(let i=1;i<b.points.length;i++){const a=b.points[i-1]!,c=b.points[i]!,n=Math.max(1,Math.ceil(distance(plan(a),plan(c))));
      for(let k=0;k<=n;k++){const q:XYZ=[mix(a[0],c[0],k/n),mix(a[1],c[1],k/n),mix(a[2],c[2],k/n)],hit=nearestOnPath(plan(q),points);if(hit.distance>width/2-.3||hit.along<1||hit.along>length-1)continue;
        const room=hit.at[1]+clear-q[1];if(room<worst){worst=room;at=plan(q);bedId=b.id;}}}}
  if(Number.isFinite(worst))cuts.diagnostics.push({id:`structures.${id}.headroom`,severity:worst<clear-GALLERY_MARGIN-.001?'conflict':'info',message:`${id}: the lowest headroom under the gallery roof is ${worst.toFixed(2)} eu over ${bedId}`,at:[Number(at[0].toFixed(2)),Number(at[1].toFixed(2))],measured:worst,required:clear-GALLERY_MARGIN});
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
export function buildStair(id:string,from:XYZ,to:XYZ,width:number,cuts:LandCuts,base:HeightQuery=baseHeight,landsOn:readonly string[]=[]):void {
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
  const free=(t:number)=>[-1,1].every(side=>!guard(sideXY(t,side),under(t),[id,...landsOn]));
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
    if(guard(sideXY((t0+t1)/2,side),under((t0+t1)/2),[id,...landsOn]))continue;
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
  // Posted all round, left open where a stair or walk leaves the deck (Wave 4: the crown launch rail closed its own stair).
  railLater(rails,[c(-1,-1),c(1,-1),c(1,1),c(-1,1)],[id]);
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
/** Wave 7 (A1 item 7, RECONCILE regression 3): S1's quay finish was an 8 m jetty on piles at 3 with rails down both
 * sides, set into the islet (the ground rises to 4.5–5.5 past z 1338): a railed channel where every 50–60° powerslide
 * met a rail within 0.8 s, ending in a bank. The islet is dry (the Reach channels run 35–50 eu away), so the finish is a
 * paved quay on grade: QUAY_FINISH.width wide (profiles.skateMain surface 3–4 m plus a slide either side), level at the
 * authored MANIFEST structures.landingQuay.finish_h (v2.4: 4.7, the islet's natural ground; v2.3: 3 dug a 1.7 eu pit) from where S1 reaches it (z 1328) to 6 eu past the finish, then an uphill run-out on grade that brings the total run-out to
 * profiles.skateMain.runout_m (25). A terrain pad grades the level part (never a jetty over dry land); the run-out's slab
 * follows the ground. Rails stand only where an edge drops more than body height (none on the islet today), with gaps
 * where S1 comes on. */
export const QUAY_FINISH={width:14,from:1328,level:1336,to:1356} as const;
function landingQuayFinish(cuts:LandCuts,base:HeightQuery):void {
  const xy=M.structures.landingQuay.xy as unknown as XY,h=M.structures.landingQuay.finish_h,{width,from,level,to}=QUAY_FINISH,x=xy[0],district=districtAt(...xy);
  const runH=Math.max(h,Math.min(h+(to-level)*.12,base(x,to)));
  addFlatPad(cuts,'landingQuay.finish','landing',[x,(from+level)/2],h,[width,level-from]);
  const deck=solid('landingQuay.deck','quay','paved','deck',['landingQuay','S1'],district),rails=solid('landingQuay.rails','deckParapet','metal','rail',['landingQuay'],district);
  slabOnGrade(deck,[x,h,from],[x,h,level],width,base);slabOnGrade(deck,[x,h,level],[x,runH,to],width,base);
  const w=width/2-.1,P=(dx:number,z:number,y:number):XYZ=>[x+dx,y,z];
  guardEdgeLater(rails,[P(-w,from,h),P(-w,level,h),P(-w,to,runH)],[-1,0],['landingQuay'],base);
  guardEdgeLater(rails,[P(w,from,h),P(w,level,h),P(w,to,runH)],[1,0],['landingQuay'],base);
  guardEdgeLater(rails,[P(-w,from,h),P(w,from,h)],[0,-1],['landingQuay'],base);guardEdgeLater(rails,[P(-w,to,runH),P(w,to,runH)],[0,1],['landingQuay'],base);
  cuts.solids.push(deck,rails);
  const b=bed('landingQuay','walk',[[x,h,from],[x,h,level],[x,runH,to]],false);b.width=width;b.structureIds=['landingQuay'];cuts.beds.push(b);
  cuts.diagnostics.push({id:'structures.landingQuay.finish',severity:'info',message:`landingQuay: S1's finish is a ${width} eu paved quay on grade at ${h} (z ${from}–${level}) with a run-out climbing to ${runH.toFixed(2)} at z ${to}: ${(to-xy[1]).toFixed(0)} eu of run-out past the finish`,at:xy,measured:to-xy[1],required:M.profiles.skateMain.runout_m});
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
/** Wave 7 (station head frames, R3-113/R3-126): eu above its station deck at which a cable's rope ends (beds' CABLE_HEAD:
 * the rope's solid spans h + 2.51 … h + 2.60 within 16 eu of each station). */
export const ROPE_END=2.6;
/** Half the gondola head frames' leg spacing (eu, either side of the rope's line): the station's walk passes between the legs. */
export const HEAD_FRAME_LEG_SPAN=3.2;
/** A station's head frame: the rope ends in a horizontal bullwheel (radius 1.5, h + 2.3 … 2.85, around the rope's end),
 * hung from an arm that cantilevers forward from a two-legged portal standing on the station deck behind the station
 * point (away from the rope). The legs close the gap from the deck to the rope; the station point itself stays clear
 * for boarding / launching (nothing under h + 2.3 within 1.9 eu of it). Load path: wheel → hanger → arm → cross-head →
 * legs → footings (the legs are piers through the deck; the upper frame, kind headFrame, is hung and never settled). The solids are
 * named platform.<id>.headFrame so the cable layer draws them with the station's own anchor solids. */
function headFrame(cuts:LandCuts,id:string,at:XY,h:number,toward:XY,onDeck:(xy:XY)=>boolean,base:HeightQuery):void {
  const l=distance(at,toward)||1,d:XY=[(toward[0]-at[0])/l,(toward[1]-at[1])/l],n:XY=[-d[1],d[0]],rot=Math.atan2(d[1],d[0])*180/Math.PI,district=districtAt(at[0],at[1]);
  const frame=solid(`platform.${id}.headFrame`,'headFrame','metal','support',[`platform.${id}`],district);
  const P=(s:number,o:number):XY=>[at[0]+d[0]*s+n[0]*o,at[1]+d[1]*s+n[1]*o];
  // The portal stands as far behind the station point as the deck allows (2.6 … 1.9 eu). Integrator 4 (Wave 7): at the gondola
  // stations its legs stand HEAD_FRAME_LEG_SPAN either side of the rope's line, so the station's walk leaves between them under
  // the cross-head (h + 4.1): at ±1.3 the legs stood in walk crownFromGondola (top) and town.upperStreetWalk (base) and the
  // summit journey lost its path. The zip stations keep ±1.3: the Prow's glider run-off passes behind that frame and a wide
  // cross-head at h + 4.1 took the flight camera (a 7.5 eu pull-in, FLIGHT §4).
  const span=id.startsWith('gondola')?HEAD_FRAME_LEG_SPAN:1.3;
  let back=2.6;while(back>1.9&&![-1.3,1.3].every(o=>onDeck(P(-back,o))))back-=.1;
  const top=h+ROPE_END+1.5;
  // The legs are columns through the station deck to their own footings (P11: a load path that reaches the ground, not a
  // frame resting on a slab); `platform.<id>.headFrame.legs` settles to the final ground like any pier.
  const legs=solid(`platform.${id}.headFrame.legs`,'pier','metal','support',[`platform.${id}`],district);
  for(const o of [-span,span])pier(legs,P(-back,o),top,base,[.45,.45],[1.2,1.2],rot);         // legs, footing → cross-head
  box(frame,P(-back,0),top+.5,[.5,2*span+.5],top-.1,rot);                                     // cross-head
  {const b0=P(-back,0),f=P(1.7,0);slab(frame,[b0[0],top+.4,b0[1]],[f[0],top+.4,f[1]],.45,.5);}   // arm
  box(frame,at,top,[.3,.3],h+2.85,rot);                                                        // hanger
  for(const r of [0,45])box(frame,at,h+2.85,[2.7,2.7],h+2.3,rot+r);                         // bullwheel (octagon of two squares)
  box(frame,P(-.9,0),h+2.8,[1.8,.5],h+2.35,rot);                                              // rope anchor: the rope's end clamped into the wheel's back
  cuts.solids.push(frame,legs);
  cuts.diagnostics.push({id:`structures.platform.${id}.headFrame`,severity:'info',message:`platform.${id}: the rope ends in the head frame's bullwheel at ${(h+ROPE_END).toFixed(2)} (deck ${h}); portal ${back.toFixed(1)} eu behind the station point`,at,measured:back,required:1.9});
}
/** The last Bight Bridge build's bent / arch table and deck profile (for the handoff and the tests). */
export let bightReport:BightReport|undefined;
export function buildStructures(cuts:LandCuts,base:HeightQuery):void {
  SPANS.forEach(s=>{if(s.id==='bightBridge')bightReport=buildBightBridge(cuts,base);else buildSpan(s,cuts,base);});
  highSpanLevels(cuts,base);
  // Road tunnels follow their road's graded profile; the section carries the road and the Year Walk footway (+6.5 eu).
  // v2.0 (D-A4): MANIFEST kind "gallery" (the Prow) is a covered road on the hillside: the hill side keeps its lined
  // wall, the sea side is a colonnade; length_m and the headroom come from the manifest.
  for(const [id,route,length0,width,clear0] of [['prowTunnel','V01',90,17,5],['shoulderTunnel','V02',110,17,5],['duneCulvert','S4',32,5,3]] as const){
    const s=M.structures[id]! as unknown as {xy:number[];kind?:string;length_m?:number;section?:{headroom_eu?:number}},xy=s.xy as unknown as XY,b=cuts.beds.find(p=>p.id===route)!,isGallery=s.kind==='gallery',length=s.length_m??length0;
    // A gallery's roof follows the road's own points: GALLERY_MARGIN over the stated headroom covers the verges' cross-fall.
    const clear=isGallery?(s.section?.headroom_eu??clear0)+GALLERY_MARGIN:clear0,points=routeStretch(b,xy,length);
    const openSide=isGallery?gallerySeaSide(points,base):undefined;
    tunnel(id,points,width,clear,cuts,districtAt(...xy),{base,...(openSide?{openSide}:{})});
    if(isGallery)galleryHeadroom(id,points,width,clear,cuts);
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
    if(isGallery)cuts.diagnostics.push({id:`structures.${id}.cover`,severity:'info',message:`${id}: a gallery (D-A4) needs no cover; the ground over its lined roof is ${cover.toFixed(1)} eu at its lowest (reported, not faked: no fill)`,at,measured:cover,required:0});
    else if(cover<(id==='duneCulvert'?0:2))conflict(cuts,`structures.${id}.cover`,`${id}: ${id==='duneCulvert'?'the V01 deck clears the culvert roof by':'rock cover over the lined roof is'} ${cover.toFixed(1)} eu; the tube stands on its own wall footings where the ground falls away`,at,cover,2);
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
  // Wave 7 (A1.2, R3-36): a quarter-pipe, not a half-pipe: the apron rises to 38 at the dam-abutment (west) end and runs
  // level at 31 east of its low line (x 1151), so S1 comes onto it flush from the east at 31 (the 7 eu east lip and its
  // abutment wall stood across S1's line at x 1166.7 and left 6.6 / 7.4 eu drops beside S1 and dam.apron.level).
  const bowl=solid('dam.apron','halfPipe','apron','deck',['S1'],'notch'),apronH=(x:number)=>x<1151?31+7*((x-1151)/16)**2:31;
  for(let i=0;i<16;i++){const x=1135+i*2,x2=x+2;slab(bowl,[x,apronH(x),935],[x2,apronH(x2),935],22,.6);}
  // Wave 7: dam.apron.level (x 1166–1170, z 923–947, the lane S1 comes onto the apron by) is the apron's level east bay, a
  // deck on the apron's piers, not a bed over nothing.
  slab(bowl,[1167,31,935],[1170.2,31,935],24,.6);cuts.solids.push(bowl);
  const apronPiers=solid('dam.apron.supports','pier','stone','support',['S1','dam.apron'],'notch'),apronAbut=solid('dam.apron.abutments','abutment','stone','support',['S1','dam.apron'],'notch'),tail=laneGuard(cuts);
  {// Rails on the apron's open edges wherever the ground falls more than body height (the west lip at 38, the south edge
    // over the tailrace bank, the east bay's edge): kerb gaps where S1, the portage and the gallery join.
    const apronRails=solid('dam.apron.rails','deckParapet','metal','rail',['S1','dam.apron.level'],'notch'),own=['dam.apron.level'];
    guardEdgeLater(apronRails,[[1135.1,38,923.9],[1135.1,38,946.1]],[-1,0],own,base);
    guardEdgeLater(apronRails,[[1135,apronH(1135),946.1],...Array.from({length:17},(_,k):XYZ=>[1136+k*2,apronH(1136+k*2),946.1]),[1170.1,31,946.9]],[0,1],own,base);
    guardEdgeLater(apronRails,[[1170.1,31,946.9],[1170.1,31,923.1]],[1,0],own,base);
    guardEdgeLater(apronRails,[[1170.1,31,923.1],[1166,31,923.1],...Array.from({length:16},(_,k):XYZ=>[1165-k*2,apronH(1165-k*2),923.9]),[1135,apronH(1135),923.9]],[0,-1],own,base);
    cuts.solids.push(apronRails);}
  for(const x of [1137,1141,1162,1166,1169.4])for(const z of [926,935,944]){const xy:XY=[x,z];if(tail(xy,apronH(x),['S1','dam.apron.level'])==='RIVER_RUN')continue;pier(apronPiers,xy,Math.min(apronH(x-.5),apronH(x+.5))-.6,base,[1,1],[2.4,2.4]);}
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
    // Integrator 3 (W5-T request, D-C2 on page A's phone): the east wall's south part (z 916.8-925, to the 45 landing's
    // parapet at 46.05, free-standing on ground at 17.8) took 2 of the dam face's portrait rays; like the south wall it is an
    // open railed parapet now (the landing's posted rail and flight 2's own rails). The north part carries L01's slab.
    box(well,[1172.8,912.4],seat,[.6,8.8],base(1172.8,912.4)-FOOTING_SINK);
    // North wall with the exit door (x 1169-1172), south wall above the apron entry (h >= 34.4).
    // D-C2 (v2.0): the south side is an open, railed parapet (the 45 landing's posted rail and the flights' own rails): the
    // solid south wall (34.4 → 46.05 at z 925.6) hid the dam's face from page A's phone frame.
    box(well,[1164.2,908.2],top,[8.4,.6],base(1164.2,908.2)-FOOTING_SINK);cuts.solids.push(well);
    // R2-108: L01's 8 x 8 slab at 52 (place xy [1172,912], MANIFEST) lay over the top flight (0.9 eu over its last treads)
    // and on nothing (ground 34.2 in the well). It is re-laid as the stair head: the flight's own 3 m opening
    // (x 1169.1-1172.1, z > 910.75) is left open, the head strip (z 908-910.75) and the east part rest on the raised east
    // wall and the ground east of it, and one pier between the two lower flights carries the head strip's west end.
    const l01=cuts.solids.find(q=>q.id==='place.L01.slab');
    if(l01){l01.positions.length=0;l01.indices.length=0;l01.kind='roofDeck';box(l01,[1172,909.375],52,[8,2.75],seat);box(l01,[1174.05,913.375],52,[3.9,5.25],seat);}
    const l01s=solid('place.L01.supports','pier','stone','support',['place.L01'],'lakeside');pier(l01s,[1168.55,909.4],seat,base,[.5,.5],[1,1]);cuts.solids.push(l01s);}
  // Integrator 3 (D-A7, S1 × dam portage flush, register [1160.8,940.1]): the portage's upper flight lands on the apron
  // bridge at the apron's 31 (it crossed at 35.8); the lower flight leaves the apron's far edge for the tailrace put-in at 25.
  buildStair('damPortage',[1150,50,910],[1160.8,31,940.1],3,cuts,base);buildStair('damPortage.lower',[1162.9,31,946.0],[1169,25,963],3,cuts,base);
  // Dry Wash bowl: the invert remains an ordinary ground line, with a bank on either side; its underside sits on the ground.
  const wash=solid('wash.bowl','bowl','ochre','deck',['S2'],'flats'),washH=heightOnBeds(cuts,[465,700],base);for(let i=-12;i<12;i++){const h=washH+5*(i/12)**2,h2=washH+5*((i+1)/12)**2;slabOnGrade(wash,[465+i,h,665],[466+i,h2,665],72,base);}cuts.solids.push(wash);
  // Runway and mooring foundations contain no lamps, windsock, hangar or balloon props in Pass 1.
  const strip=bed('strip','road',[[425,38,520],[445,38,860]]);strip.width=30;cuts.beds.push(strip);
  addFlatPad(cuts,'hangar','place',[455,600],38,[40,30]);addFlatPad(cuts,'windsock.footing','place',[440,500],38,[1,1]);addFlatPad(cuts,'balloon.footing','place',[520,470],base(520,470),[14,14]);
  Object.entries(M.structures.jetties).forEach(([id,p])=>dock(`jetty.${id}`,p as unknown as XY,id==='deep'?40.6:1,cuts,base));
  Object.entries(M.water_routes.FERRY.piers).forEach(([id,p])=>dock(`ferry.${id}`,p as unknown as XY,1,cuts,base,6,16));
  dock('floatplaneDock',M.structures.floatplaneDock as unknown as XY,1.2,cuts,base,8,20);
  landingQuayFinish(cuts,base);
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
  // Wave 7 (station head frames): each station carries the head frame its rope ends in (`headFrame`), toward = the rope's
  // next anchor (the first / last G1 tower, the zip's other end).
  const g1=M.cable.G1,zipC=M.cable.ZIP;
  for(const [id,xy,h,toward]of [['gondolaBase',g1.from,g1.fromH,g1.towers[0]!],['gondolaTop',g1.to,g1.toH,g1.towers.at(-1)!],['prowPlatform',zipC.from,zipC.fromH,zipC.to],['zipLanding',zipC.to,zipC.toH,zipC.from]] as const){
    const at=xy as unknown as XY,ground=Math.min(...[[-5,-4],[-5,4],[5,4],[5,-4],[0,0]].map(([x,z])=>base(at[0]+x!,at[1]+z!)));
    if(ground>=h-1){addFlatPad(cuts,`platform.${id}`,'landing',at,h,[10,8]);headFrame(cuts,id,at,h,toward as unknown as XY,()=>true,base);continue;}
    // Wave 6: a platform never overhangs a lower route with less than body height + 0.3 under its slab (candidate 4, lite: the
    // square walk climbs past the gondola base's east edge at 16.0–16.5 under a 17.4 underside; the body stopped). The slab's
    // side over such a route is trimmed back to clear the route's corridor by 0.3; the station point stays ≥ 2 inside it.
    const ext={x0:-5,x1:5,z0:-4,z1:4},under=h-.6-(1.25+.3);
    for(const b of cuts.beds){if(['cave','rail','cable','water'].includes(b.kind)||b.id.startsWith(`platform.${id}`)||b.id===`${id}.walk`)continue;const half=(b.width??3)/2+.3;
      for(let i=1;i<b.points.length;i++){const p0=b.points[i-1]!,p1=b.points[i]!,n=Math.max(1,Math.ceil(distance(plan(p0),plan(p1))/.5));
        for(let k=0;k<=n;k++){const t=k/n,x=mix(p0[0],p1[0],t)-at[0],z=mix(p0[2],p1[2],t)-at[1],y=mix(p0[1],p1[1],t);
          // A route at the deck's level joins it; one whose body (with the lite tier's coarser ground, up to +0.6) reaches the underside is trimmed.
          if(y>=h-.5||y+.6<=under||x+half<=ext.x0||x-half>=ext.x1||z+half<=ext.z0||z-half>=ext.z1)continue;
          const cut=[['x1',x-half,ext.x1-(x-half)],['x0',x+half,(x+half)-ext.x0],['z1',z-half,ext.z1-(z-half)],['z0',z+half,(z+half)-ext.z0]] as const,ok=cut.filter(([side,v])=>side.endsWith('1')?v>=2:v<=-2).sort((m,q)=>m[2]-q[2])[0];
          if(ok)ext[ok[0]]=ok[1];}}}
    const size:XY=[ext.x1-ext.x0,ext.z1-ext.z0],centre:XY=[at[0]+(ext.x0+ext.x1)/2,at[1]+(ext.z0+ext.z1)/2];
    if(size[0]<10||size[1]<8)cuts.diagnostics.push({id:`structures.platform.${id}.trim`,severity:'info',message:`platform.${id}: slab trimmed to x ${ext.x0.toFixed(2)}…${ext.x1.toFixed(2)}, z ${ext.z0.toFixed(2)}…${ext.z1.toFixed(2)} of the station point to clear a route passing under it`,at,measured:size[0]*size[1],required:80});
    const deck=solid(`platform.${id}.slab`,'platform','stone','floor',[],districtAt(at[0],at[1]));box(deck,centre,h,size,h-.6);
    const supports=solid(`platform.${id}.supports`,'tower','stone','support',[],districtAt(at[0],at[1]));for(const x of [ext.x0+1,ext.x1-1])for(const z of [ext.z0+1,ext.z1-1])pier(supports,[at[0]+x,at[1]+z],h-.6,base,[.9,.9],[2.2,2.2]);
    const rails=solid(`platform.${id}.rails`,'handrail','metal','rail',[],deck.districtId),c=(x:number,z:number):XYZ=>[at[0]+x,h,at[1]+z];railLater(rails,[c(ext.x0,ext.z0),c(ext.x1,ext.z0),c(ext.x1,ext.z1),c(ext.x0,ext.z1)],[`platform.${id}`]);
    cuts.solids.push(deck,supports,rails);
    headFrame(cuts,id,at,h,toward as unknown as XY,xy=>xy[0]-at[0]>ext.x0+.3&&xy[0]-at[0]<ext.x1-.3&&xy[1]-at[1]>ext.z0+.3&&xy[1]-at[1]<ext.z1-.3,base);
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
  // Wave 6: the ramp ends where its spiral meets the landing's north edge ([540,25,1190]; its deck overlaps the landing's edge,
  // whose slab is the ground beside it, so that side takes no rail) and the stair at the landing's south edge; they no longer
  // run on to the landing's centre, where their edges crossed it and closed page B's pose (walking out blocked at z 1191.3).
  const lampRamp:XYZ[]=Array.from({length:161},(_,i)=>{const t=i/160,a=Math.PI/2+t*5*Math.PI;return [540+30*Math.cos(a),1+t*24,1220+30*Math.sin(a)];});
  for(let i=0;i<lampRamp.length;i+=3){const p=lampRamp[i]!;pier(lampSupports,[p[0],p[2]],p[1]-.35,base,[.4,.4],[.9,.9]);}cuts.solids.push(lampSupports);
  const galleryBed=bed('lampGallery.ramp','walk',lampRamp,false);galleryBed.maxGrade=.08;cuts.beds.push(galleryBed);
  buildStair('lampGallery.stair',[540,1,1250],[540,25,1198.5],3,cuts,base);
  buildNamedKinds(cuts,base);
  flushRails(cuts);
}
