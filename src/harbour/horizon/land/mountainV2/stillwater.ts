/** Stillwater's second mountain entrance. One bed feeds terrain, collision, corridors and Journey.
 * Coordinates are Horizon space; Mountain v2 remains authored in its native space. */
import { authorCurve, arcLengths, pointAt } from '../../../mountain/math';
import type { BedCut, HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { bed } from '../beds/profiles';
import { distance, districtAt, nearestOnPath, plan, solid, mitredSlab } from '../structures/mesh';
import { FLOOR_LAP, PORTAL_APRON, PORTAL_MOUTH_OUT, portalMouth, tunnel } from '../structures/build';
import { wallToGround } from '../structures/foundations';

export const STILLWATER_ROAD_ID = 'spur stillwater';
export const STILLWATER_TUNNEL_ID = 'stillwaterTunnel';
export const STILLWATER_SECTION = { road: 8, shoulder: 1, tunnel: 12, clear: 5.4, roof: .6 } as const;
/** Stations on the descent only. Survey: one continuous covered reach, not a masked open trench. */
export const STILLWATER_TUNNEL_STATIONS = [28,132] as const;
const JOIN: XY = [1166.573518534, 727.220350127];
const GREEN_JOIN: XY = [980,700];
const CONTROL: XY[] = [[1144,704],[1120,699],[1090,695],[1060,688],[1034,682],[1010,685],[1000,695],[990,700]];
const required = (beds: readonly BedCut[], id: string): BedCut => {
  const value = beds.find(b => b.id === id);
  if (!value) throw new Error(`Stillwater link needs ${id}`);
  return value;
};
export function stillwaterSlice(points: readonly XYZ[], from: number, to: number): XYZ[] {
  const s = arcLengths(points, true), reverse = to < from, lo = Math.min(from,to), hi = Math.max(from,to);
  const out: XYZ[] = [pointAt(points,s,lo), ...points.filter((_,i) => s[i]! > lo + 1e-6 && s[i]! < hi - 1e-6), pointAt(points,s,hi)];
  return reverse ? out.reverse() : out;
}
/** Exact grade integral: 25 m entry, 12 m vertical easements, 10 m level exit. */
function descentHeights(path: readonly XYZ[], start:number, end:number, walk:BedCut): XYZ[] {
  const arcs=arcLengths(path,true),length=arcs.at(-1)!,exit=10,ease=12;
  // Hold the complete road/shoulder against the complete walking section before beginning the descent.
  // Centreline crossing pins alone leave the upper walking edge hanging into the descending carriageway.
  const margin=STILLWATER_SECTION.road/2+STILLWATER_SECTION.shoulder+walk.width/2+walk.shoulder+.3;
  const pins=[{s:0,y:start}];
  for(let i=1;i<path.length;i++){
    const hit=nearestOnPath(plan(path[i]!),walk.points);
    if(hit.distance>margin)break;
    pins.push({s:arcs[i]!,y:hit.at[1]});
  }
  const entry=Math.max(25,pins.at(-1)!.s+8);
  const top=pins.at(-1)!.y; pins.push({s:entry,y:top});
  const run=length-entry-exit,g=(top-end)/(run-ease);
  if(Math.abs(g)>.099)throw new Error(`Stillwater descent lacks grade margin: ${(g*100).toFixed(3)}%`);
  const down=(s:number)=>{
    const t=s-entry;
    if(t<=0)return 0;if(t>=run)return g*(run-ease);
    if(t<ease)return g*(t/2-ease/(2*Math.PI)*Math.sin(Math.PI*t/ease));
    if(t>run-ease){const u=run-t;return g*(run-ease)-g*(u/2-ease/(2*Math.PI)*Math.sin(Math.PI*u/ease));}
    return g*(t-ease/2);
  };
  return path.map((p,i):XYZ=>{
    const s=arcs[i]!;
    if(s>=entry)return[p[0],top-down(s),p[2]];
    let k=1;while(k<pins.length-1&&pins[k]!.s<s)k++;
    const a=pins[k-1]!,b=pins[k]!,t=(s-a.s)/(b.s-a.s||1);
    return[p[0],a.y+(b.y-a.y)*t,p[2]];
  });
}
export function buildStillwaterProfile(beds:readonly BedCut[]) {
  const mountain=required(beds,'mountainV2.road'),rim=required(beds,'walk lakerim'),green=required(beds,'VG'),year=required(beds,'yearWalk');
  const foot=mountain.points[0]!,rimHit=nearestOnPath(plan(foot),rim.points),departure=nearestOnPath(JOIN,rim.points),finish=nearestOnPath(GREEN_JOIN,green.points);
  const shared=stillwaterSlice(rim.points,rimHit.along,departure.along),gap=distance(plan(foot),plan(rimHit.at)),n=Math.ceil(gap);
  const approach:XYZ[]=Array.from({length:n+1},(_,i)=>{const t=i/n;return[foot[0]+(rimHit.at[0]-foot[0])*t,foot[1]+(rimHit.at[1]-foot[1])*t,foot[2]+(rimHit.at[2]-foot[2])*t];});
  const horizontal=authorCurve([departure.at,...CONTROL.map(([x,z]):XYZ=>[x,0,z]),finish.at],1,0).points;
  const descent=descentHeights(horizontal,departure.at[1],finish.at[1],year),points=[...approach,...shared.slice(1),...descent.slice(1)];
  const descentStart=arcLengths([...approach,...shared.slice(1)],true).at(-1)!;
  const tunnelPoints=stillwaterSlice(descent,...STILLWATER_TUNNEL_STATIONS);
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!,run=distance(plan(a),plan(b));
    if(run>1e-7&&Math.abs(b[1]-a[1])/run>.100001)throw new Error(`Stillwater profile exceeds 10% at sample ${i}`);
  }
  return{points,approach,shared,descent,descentStart,tunnelPoints};
}
function carrySharedWalk(walk:BedCut,road:BedCut):void {
  // Preserve every original path point. Only suppress duplicate geometry where its WHOLE width sits on the road.
  let run:XY[]=[];
  const flush=()=>{if(run.length>1)(walk.carried??=[]).push(run);run=[];};
  for(const p of walk.points){const n=nearestOnPath(plan(p),road.points);
    if(n.distance+walk.width/2<=road.width/2&&Math.abs(n.at[1]-p[1])<.02)run.push(plan(p));else flush();}
  flush();
  const shared=walk.points.filter(p=>{const n=nearestOnPath(plan(p),road.points);return n.distance<road.width/2+walk.width/2&&Math.abs(n.at[1]-p[1])<.05;}).map(plan);
  if(shared.length>1){(walk.sharedEdges??=[]).push({other:road.id,at:shared});(road.sharedEdges??=[]).push({other:walk.id,at:shared});}
}
/** Run after the existing Year Walk shares settle, before emitBedGeometry. */
export function buildStillwaterLink(cuts:LandCuts,base:HeightQuery):void {
  if(cuts.beds.some(b=>b.id===STILLWATER_ROAD_ID))throw new Error('Stillwater link built twice');
  const profile=buildStillwaterProfile(cuts.beds),road=bed(STILLWATER_ROAD_ID,'road',profile.points),id=STILLWATER_TUNNEL_ID;
  road.width=STILLWATER_SECTION.road;road.shoulder=STILLWATER_SECTION.shoulder;road.maxGrade=.1;
  road.structureIds=[id];cuts.beds.push(road);
  for(const walk of cuts.beds.filter(b=>b.id==='walk lakerim'||b.id==='yearWalk'))carrySharedWalk(walk,road);
  const [from,to]=STILLWATER_TUNNEL_STATIONS,width=STILLWATER_SECTION.tunnel,clear=STILLWATER_SECTION.clear;
  const tube=profile.tunnelPoints,arcs=arcLengths(profile.descent,true),tubeArcs=arcLengths(tube,true),length=tubeArcs.at(-1)!;
  // Union of short exclusions follows the actual curved tube. Keep the natural roof only after the portal's cut inset.
  // A 6 m radius is the tube half-width. Its end caps stop 3 m INSIDE the portal faces.
  const radius=width/2,first=from+3+radius,last=to-3-radius;
  for(let s=first;s<=last;s+=1){const p=pointAt(profile.descent,arcs,s);(road.terrainExclusions??=[]).push({at:plan(p),radius});}
  const lastCover=pointAt(profile.descent,arcs,last);(road.terrainExclusions??=[]).push({at:plan(lastCover),radius});
  const fullArcs=arcLengths(road.points,true),a=profile.descentStart+from,b=profile.descentStart+to;
  const carried=stillwaterSlice(road.points,a-PORTAL_APRON,b+PORTAL_APRON);
  (road.carried??=[]).push(carried.map(plan));
  tunnel(id,tube,width,clear,cuts,districtAt(tube[0]![0],tube[0]![2]),{bedIds:[road.id],base});
  // The generic tube laps its floor but uses rectangular roof/wall pieces. This curved tube needs shared joints:
  // use the same mesh helper as road decks so collision and all three theme renderers see closed lining.
  const roof=cuts.solids.find(s=>s.id===`${id}.roof`)!,walls=cuts.solids.find(s=>s.id===`${id}.walls`)!;
  roof.positions.length=0;roof.indices.length=0;walls.positions.length=0;walls.indices.length=0;
  for(let i=1;i<tube.length;i++){
    mitredSlab(roof,tube,i,width+1.2,.6,0,clear+.6);
    for(const side of [-1,1])mitredSlab(walls,tube,i,.6,clear+.6,side*(width/2+.3),clear);
  }
  const apron=solid(`${id}.apron`,'tunnel','stone','floor',[road.id],districtAt(tube[0]![0],tube[0]![2]));
  // The carried-bed predicate owns one metre past its polyline endpoint and corridor
  // stations sample that boundary. A physical 2 m lap covers that ownership transition;
  // its floor follows the very same road profile, so rendering and collision stay flush.
  const outerLap=2;
  for(const [lo,hi]of [[a-PORTAL_APRON-outerLap,a+FLOOR_LAP],[b-FLOOR_LAP,b+PORTAL_APRON+outerLap]] as const){
    const run=stillwaterSlice(road.points,lo,hi);
    for(let i=1;i<run.length;i++){
      const p=run[i-1]!,q=run[i]!;mitredSlab(apron,run,i,width+2,.6);
      for(const side of [-1,1])wallToGround(apron,[p[0],p[1]-.6,p[2]],[q[0],q[1]-.6,q[2]],.6,side*(width/2+.7),base,.3);
    }
  }
  cuts.solids.push(apron);
  for(const [index,end,neighbor]of [[0,tube[0]!,tube[1]!],[1,tube.at(-1)!,tube.at(-2)!]] as const){
    const d=distance(plan(end),plan(neighbor)),outward:XY=[(end[0]-neighbor[0])/d,(end[2]-neighbor[2])/d];
    cuts.mouths.push(portalMouth(`${id}.portal.${index}`,end,outward,width,clear,PORTAL_MOUTH_OUT));
  }
  // Fail visibly if later terrain changes remove the tube's cover; geometry is not granted a silent exception.
  let cover=Infinity;for(let s=8;s<length-8;s+=1){const p=pointAt(tube,tubeArcs,s);cover=Math.min(cover,base(p[0],p[2])-p[1]-clear-STILLWATER_SECTION.roof);}
  cuts.diagnostics.push({id:'stillwater.cover',severity:cover<0?'conflict':'info',message:`Stillwater tube roof cover ${cover.toFixed(2)} m; verify full-width baked clearance`,measured:cover,required:0});
  cuts.diagnostics.push({id:'stillwater.connection',severity:'info',message:'Mountain foot → shared Stillwater rim → lined tunnel → Green Road; original walking routes retained',measured:fullArcs.at(-1),required:.1});
}
