import {SKILL_BRANCHES} from './surfaces.ts';
import {MOUNTAIN_ROAD,TOWN_RACE_ROAD,MOUNTAIN_VERSION,type Point3} from './definition.ts';
export type RaceGate={id:string;at:Point3;normal:readonly[number,number];halfWidth:number;halfHeight:number};
const descending=[...MOUNTAIN_ROAD].reverse();
export const MOUNTAIN_COURSE_POINTS:readonly Point3[]=[...descending,...TOWN_RACE_ROAD.slice(1,-3)];
export const MOUNTAIN_GATES:readonly RaceGate[]=MOUNTAIN_COURSE_POINTS.flatMap((at,i,all)=>{
  if(!(i%12===0||i===all.length-1)||SKILL_BRANCHES.some(b=>i>b.entry&&i<b.exit))return [];
  const next=all[Math.min(i+1,all.length-1)]!,prev=all[Math.max(0,i-1)]!,dx=next[0]-prev[0],dz=next[2]-prev[2],d=Math.hypot(dx,dz)||1;
  return [{id:`mountain-gate-${i}`,at,normal:[dx/d,dz/d] as const,halfWidth:5.2,halfHeight:2.4}];
});
export function crossesRaceGate(from:Point3,to:Point3,gate:RaceGate):boolean{
  const [nx,nz]=gate.normal,a=(from[0]-gate.at[0])*nx+(from[2]-gate.at[2])*nz,b=(to[0]-gate.at[0])*nx+(to[2]-gate.at[2])*nz;
  if(!(a<=0&&b>0))return false;
  const t=-a/(b-a),x=from[0]+(to[0]-from[0])*t-gate.at[0],z=from[2]+(to[2]-from[2])*t-gate.at[2],y=from[1]+(to[1]-from[1])*t;
  return Math.abs(x*nz-z*nx)<=gate.halfWidth&&Math.abs(y-gate.at[1])<=gate.halfHeight;
}
// Road and shortcut geometry participate even when a gate itself did not move.
const courseGeometry=JSON.stringify([MOUNTAIN_VERSION,MOUNTAIN_COURSE_POINTS,SKILL_BRANCHES.map(b=>[b.id,b.entry,b.exit,b.halfWidth,b.points])]);
let courseHash=2166136261;for(let i=0;i<courseGeometry.length;i++)courseHash=Math.imul(courseHash^courseGeometry.charCodeAt(i),16777619);
export const MOUNTAIN_RACE_REVISION=`${MOUNTAIN_VERSION}-${(courseHash>>>0).toString(16)}`;
export const MOUNTAIN_RACE={id:'mountain-descent',name:'Summit to sea',detail:'The long descent through the neighbourhood · aim for 60–120 seconds',revision:MOUNTAIN_RACE_REVISION,seconds:[75,95,120] as const,points:MOUNTAIN_GATES.map(g=>[g.at[0],g.at[2]] as const),gates:MOUNTAIN_GATES};
