/**
 * Summit to Sea: the course as named segments in the plan's order, upright gates at the
 * features, three architectural skill branches that are shorter than the road they bypass,
 * the town lane draped on town ground across a real canal bridge, and a quay finish with a
 * long run-out along the waterfront.
 */
import {MOUNTAIN_ROAD_LINE} from './roads.ts';
import {roadTagS} from './roadLine.ts';
import {islandHeight} from './islandShape.ts';
import {DAM,GEOGRAPHY_REVISION,MOUNTAIN_VERSION} from './places.ts';
import {arcLengths,authorCurve,mix,type Point3} from './math.ts';

/** Legacy uphill polyline of the mountain road (every third 1-unit sample, ends included). */
export const MOUNTAIN_ROAD:readonly Point3[]=(()=>{const S=MOUNTAIN_ROAD_LINE.samples,out:Point3[]=[];for(let i=0;i<S.length;i+=3)out.push(S[i]!.at);if(out[out.length-1]!==S[S.length-1]!.at)out.push(S[S.length-1]!.at);return out;})();
const ROAD_PLAN_S=arcLengths(MOUNTAIN_ROAD,true);

/** The town lane: from the road foot, past the bank's east side, over the canal, onto the quay. */
/** Down the west side of town, over the canal, east along the quay (finish), and a long run-out. */
const TOWN_LANE_PLAN:readonly(readonly[number,number])[]=[[-26.5,-34],[-26.5,-22],[-26,-10],[-24.5,2],[-21,13],[-14.5,20],[-7,22.5],[0.5,25.5],[7,31],[12,38],[16,44.5],[22,48.2],[30,50.4],[38,52.2],[45,53.6]];
export const TOWN_LANE_HALF_WIDTH=3.5;
/** The town lane's canal bridge (the lane deck spans the plaza channel). */
export const CANAL_BRIDGE={id:'canal-bridge',name:'Canal bridge',type:'masonry' as const,at:[-6.9,-1,22.5] as Point3,span:9,halfWidth:TOWN_LANE_HALF_WIDTH};
export const TOWN_RACE_ROAD:readonly Point3[]=(()=>{
  const foot=MOUNTAIN_ROAD[0]!,plan:[number,number,number][]=[[foot[0],foot[1],foot[2]],...TOWN_LANE_PLAN.map(([x,z])=>[x,islandHeight(x,z)+.06,z] as [number,number,number])];
  const curve=authorCurve(plan,1.5,0).points;
  // Draped exactly on the town ground: the lane is paving, not a slab (a skater crosses its edges
  // without meeting a kerb). Only the canal bridge is a deck, flush with the banks it joins.
  return curve.map((p,i)=>i===0?foot:[p[0],islandHeight(p[0],p[2]),p[2]] as Point3);
})();
/** The part of the town lane that is a deck: the canal bridge over the town channel. */
export const TOWN_LANE_DECK:readonly Point3[]=TOWN_RACE_ROAD.filter(p=>Math.hypot(p[0]-CANAL_BRIDGE.at[0],p[2]-CANAL_BRIDGE.at[2])<=CANAL_BRIDGE.span/2+1.5);
const finishIndex=TOWN_RACE_ROAD.findIndex(p=>p[0]>=20);
/** The finish gate on the quay; the lane runs on eastward along the waterfront as the braking run-out. */
export const RACE_FINISH=(()=>{
  const at=TOWN_RACE_ROAD[finishIndex]!,next=TOWN_RACE_ROAD[finishIndex+1]!,dx=next[0]-at[0],dz=next[2]-at[2],l=Math.hypot(dx,dz)||1,heading=[dx/l,dz/l] as const;
  // Distance along the heading before the shoreline clamp (radius 73.2) would bite.
  const b=at[0]*heading[0]+at[2]*heading[1],c=at[0]*at[0]+at[2]*at[2]-73.2*73.2,runout=-b+Math.sqrt(b*b-c);
  return {at,heading,runout,laneRunout:arcLengths(TOWN_RACE_ROAD.slice(finishIndex)).at(-1)!};
})();

/** Downhill course: summit to the road foot, then the town lane to the finish gate. */
export const MOUNTAIN_COURSE_POINTS:readonly Point3[]=[...[...MOUNTAIN_ROAD].reverse(),...TOWN_RACE_ROAD.slice(1,finishIndex+1)];
const COURSE_S=arcLengths(MOUNTAIN_COURSE_POINTS);
export const MOUNTAIN_COURSE_LENGTH=COURSE_S[COURSE_S.length-1]!;
const roadCount=MOUNTAIN_ROAD.length;
/** Course index of an uphill plan arc length on the mountain road. */
export const courseIndexAt=(uphillPlanS:number)=>{let best=0,d=Infinity;ROAD_PLAN_S.forEach((s,i)=>{const e=Math.abs(s-uphillPlanS);if(e<d){d=e;best=i;}});return roadCount-1-best;};
const townIndex=(x:number,z:number)=>{let best=roadCount,d=Infinity;for(let i=roadCount;i<MOUNTAIN_COURSE_POINTS.length;i++){const p=MOUNTAIN_COURSE_POINTS[i]!,e=Math.hypot(p[0]-x,p[2]-z);if(e<d){d=e;best=i;}}return best;};

// ——— Skill branches ————————————————————————————————————————————————————————————
export type BranchSegment={kind:'ramp'|'deck'|'rail'|'landing';points:readonly Point3[]};
export type SkillBranch={id:string;name:string;kind:'rail'|'balcony'|'awning';entry:number;exit:number;halfWidth:number;material:'wood'|'metal';
  points:readonly Point3[];segments:readonly BranchSegment[];branchLength:number;roadLength:number};
function branch(id:string,name:string,kind:SkillBranch['kind'],material:'wood'|'metal',halfWidth:number,entry:number,exit:number,
  parts:readonly {kind:BranchSegment['kind'];via:readonly Point3[]}[]):SkillBranch{
  const a=MOUNTAIN_COURSE_POINTS[entry]!,b=MOUNTAIN_COURSE_POINTS[exit]!;
  const way:Point3[]=[a,...parts.flatMap(p=>p.via),b];
  const pts=authorCurve(way,1,6).points;pts[0]=a as [number,number,number];pts[pts.length-1]=b as [number,number,number];
  // Segment boundaries at the authored via points.
  const segments:BranchSegment[]=[];let cursor=0;
  for(const part of parts){const end=part.via[part.via.length-1]!;let j=cursor;let best=Infinity;for(let k=cursor;k<pts.length;k++){const e=Math.hypot(pts[k]![0]-end[0],pts[k]![2]-end[2]);if(e<best){best=e;j=k;}}segments.push({kind:part.kind,points:pts.slice(cursor,j+1)});cursor=j;}
  segments.push({kind:'landing',points:pts.slice(cursor)});
  const points:Point3[]=pts.map(p=>[p[0],p[1],p[2]] as Point3);points[0]=a;points[points.length-1]=b;
  return {id,name,kind,entry,exit,halfWidth,material,points,segments,branchLength:arcLengths(points).at(-1)!,roadLength:COURSE_S[exit]!-COURSE_S[entry]!};
}
const damArc=(from:number,to:number,y0:number,y1:number,radius:number,n=8):Point3[]=>Array.from({length:n},(_,k)=>{const t=(k+.5)/n,a=mix(from,to,t);return [DAM.centre[0]+Math.sin(a)*radius,mix(y0,y1,t),DAM.centre[2]+Math.cos(a)*radius];});
export const SKILL_BRANCHES:readonly SkillBranch[]=[
  // Dam maintenance rail: off Reservoir Heights, down the glass face's downstream rail, landing on the west abutment apron.
  branch('dam-promenade','Dam maintenance rail','rail','metal',1.7,courseIndexAt(roadTagS('reservoir')+13),courseIndexAt(roadTagS('b3-west')-4),[
    {kind:'ramp',via:[[44,90.4,-248],[37,89.4,-240.5]]},
    {kind:'rail',via:damArc(DAM.halfAngle*.92,-DAM.halfAngle*.92,87.6,73.4,DAM.radius+2.2,10)},
    {kind:'deck',via:[[-18,72.2,-230],[-22,71,-226.6]]},
  ]),
  // Library roof line: off the woodland bridge onto the reading-room roof and balcony, down to the east bend.
  branch('library-balcony','Library roof and balcony','balcony','wood',1.6,courseIndexAt(roadTagS('b2-east')-1),courseIndexAt(roadTagS('library')-44),[
    {kind:'ramp',via:[[37,41.2,-181.6]]},
    {kind:'deck',via:[[45,41.35,-181.4],[56,41.1,-180.4]]},
    {kind:'deck',via:[[63,40,-176.5]]},
    {kind:'ramp',via:[[74,36.6,-169.5],[86,33.2,-167.6]]},
  ]),
  // Neighbourhood awnings: across the inside of the second hairpin on awnings and a ramp, back onto the leg above town.
  branch('hearth-awning','Neighbourhood awnings','awning','wood',1.5,courseIndexAt(roadTagS('hearth')-16),courseIndexAt(roadTagS('hairpin-2')-16),[
    {kind:'deck',via:[[35,17.9,-96.6]]},
    {kind:'rail',via:[[33,17.1,-93.4]]},
    {kind:'deck',via:[[33.6,16,-90]]},
    {kind:'ramp',via:[[36.6,14.4,-86.4]]},
  ]),
];

// ——— Gates ——————————————————————————————————————————————————————————————————————
export type RaceGate={id:string;at:Point3;normal:readonly[number,number];halfWidth:number;halfHeight:number;name?:string;segment?:string;height?:number};
export type RaceSegment={id:string;name:string;i0:number;i1:number;s0:number;s1:number};
const gateAt=(index:number,id:string,name:string,segment:string,halfWidth=5.3):RaceGate=>{
  const all=MOUNTAIN_COURSE_POINTS,at=all[index]!,next=all[Math.min(index+1,all.length-1)]!,prev=all[Math.max(0,index-1)]!,dx=next[0]-prev[0],dz=next[2]-prev[2],d=Math.hypot(dx,dz)||1;
  return {id,at,normal:[dx/d,dz/d] as const,halfWidth,halfHeight:2.4,name,segment,height:4.4};
};
const G=(uphill:number)=>courseIndexAt(uphill);
const GATE_PLAN:readonly [index:number,id:string,name:string,segment:string,halfWidth?:number][]=[
  [0,'start','Summit start','summit-start'],
  [G(roadTagS('summit')-60),'alpine-1','Alpine bends · crown','alpine-bends'],
  [G(roadTagS('high-terrace')),'alpine-2','Alpine bends · high terrace','alpine-bends'],
  [G(roadTagS('reservoir')+36),'alpine-3','Alpine bends · Reservoir Heights','alpine-bends'],
  [G(roadTagS('reservoir')+21),'dam-overlook','Dam overlook','dam-overlook'],
  [G(roadTagS('b3-west')-14),'meadow-1','Meadow sweep · upper terrace','meadow-sweep'],
  [G(roadTagS('clearing')+14),'meadow-2','Meadow sweep · the turn','meadow-sweep'],
  [G(roadTagS('clearing')-40),'meadow-3','Meadow sweep · lower terrace','meadow-sweep'],
  [G((roadTagS('b2-east')+roadTagS('b2-west'))/2),'woodland-bridge','Woodland bridge','woodland-bridges'],
  [G(roadTagS('library')-52),'library','Library Woods','library-balcony'],
  [G(roadTagS('shelf')+14),'east-arm','East arm sweep','neighbourhood-switchbacks'],
  [G(roadTagS('hearth')+10),'hearth','Hearth Terrace','neighbourhood-switchbacks'],
  [G(roadTagS('hairpin-2')-24),'switchback-2','Second switchback','neighbourhood-switchbacks'],
  [G(roadTagS('hairpin-1')-6),'switchback-1','First switchback','neighbourhood-switchbacks'],
  [roadCount-1,'road-foot','Road foot','town-canal-crossing',4.4],
  [townIndex(CANAL_BRIDGE.at[0],CANAL_BRIDGE.at[2]),'canal','Canal bridge','town-canal-crossing',4.4],
  [MOUNTAIN_COURSE_POINTS.length-1,'finish','Quay finish','waterfront-finish',4.6],
];
export const MOUNTAIN_GATES:readonly RaceGate[]=GATE_PLAN.map(([i,id,name,segment,hw])=>gateAt(i,`mountain-gate-${id}`,name,segment,hw));
export const MOUNTAIN_RACE_SEGMENTS:readonly RaceSegment[]=(()=>{
  const order=['summit-start','alpine-bends','dam-overlook','meadow-sweep','woodland-bridges','library-balcony','neighbourhood-switchbacks','town-canal-crossing','waterfront-finish'] as const;
  const names:Record<typeof order[number],string>={'summit-start':'Summit start','alpine-bends':'Alpine bends','dam-overlook':'Dam overlook','meadow-sweep':'Meadow sweep','woodland-bridges':'Woodland bridges','library-balcony':'Library balcony','neighbourhood-switchbacks':'Neighbourhood switchbacks','town-canal-crossing':'Town canal crossing','waterfront-finish':'Waterfront finish'};
  // A segment begins midway between the previous segment's last gate and its own first gate.
  const gates=(seg:string)=>GATE_PLAN.filter(g=>g[3]===seg).map(g=>g[0]);
  const starts=order.map((id,k)=>k===0?0:Math.round((Math.max(...gates(order[k-1]!))+Math.min(...gates(id)))/2));
  return order.map((id,k)=>{const i0=starts[k]!,i1=k===order.length-1?MOUNTAIN_COURSE_POINTS.length-1:starts[k+1]!;return {id,name:names[id],i0,i1,s0:COURSE_S[i0]!,s1:COURSE_S[i1]!};});
})();

export function crossesRaceGate(from:Point3,to:Point3,gate:RaceGate):boolean{
  const [nx,nz]=gate.normal,a=(from[0]-gate.at[0])*nx+(from[2]-gate.at[2])*nz,b=(to[0]-gate.at[0])*nx+(to[2]-gate.at[2])*nz;
  if(!(a<=0&&b>0))return false;
  const t=-a/(b-a),x=from[0]+(to[0]-from[0])*t-gate.at[0],z=from[2]+(to[2]-from[2])*t-gate.at[2],y=from[1]+(to[1]-from[1])*t;
  return Math.abs(x*nz-z*nx)<=gate.halfWidth&&Math.abs(y-gate.at[1])<=gate.halfHeight;
}
// Road and shortcut geometry participate even when a gate itself did not move.
const courseGeometry=JSON.stringify([MOUNTAIN_VERSION,GEOGRAPHY_REVISION,MOUNTAIN_COURSE_POINTS,SKILL_BRANCHES.map(b=>[b.id,b.entry,b.exit,b.halfWidth,b.points])]);
let courseHash=2166136261;for(let i=0;i<courseGeometry.length;i++)courseHash=Math.imul(courseHash^courseGeometry.charCodeAt(i),16777619);
export const MOUNTAIN_RACE_REVISION=`${MOUNTAIN_VERSION}-${(courseHash>>>0).toString(16)}`;
export const MOUNTAIN_RACE={id:'mountain-descent',name:'Summit to sea',detail:'Summit start, alpine bends, the dam, the meadows, the woodland bridge, the Library, the switchbacks, the canal and the quay · aim for 60–120 seconds',revision:MOUNTAIN_RACE_REVISION,seconds:[75,95,120] as const,points:MOUNTAIN_GATES.map(g=>[g.at[0],g.at[2]] as const),gates:MOUNTAIN_GATES};
