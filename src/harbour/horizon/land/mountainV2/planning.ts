/** Exact native planning inventory, generated offline; never imports native terrain or scene modules. */
import V2 from './v2-data.json';
import {nearestOnPath} from '../structures/mesh';
import {pointInPolygon} from '../../world/geometry';
import type {Point2,Point3} from '../../world/definition';
const N=V2.nativePlanning;
const reservoirOutline=N.reservoir.outline.map((p):Point2=>[p[0]!,p[1]!]);
const path=(p:readonly number[][])=>p as unknown as readonly Point3[];
export const nativeWalks=N.walks.map(w=>({...w,points:path(w.points)}));
/** Height of the rendered native water at x,z, null on dry land. */
export function nativeWaterLevel(x:number,z:number,ground:(x:number,z:number)=>number):number|null{
  const r=N.reservoir,g=ground(x,z);
  if(g<r.level&&pointInPolygon(x,z,reservoirOutline))return r.level;
  const q=nearestOnPath([x,z],path(V2.river.points));
  return q.distance<=V2.river.halfWidth&&g<q.at[1]?q.at[1]:null;
}
/** A candidate's full crown/footprint, not only its centre. Height overlaps allow real stacked surfaces. */
export function nativeOccupied(x:number,z:number,ground:(x:number,z:number)=>number,radius=0,height=6,ignoreWalk?:string):boolean{
  const y=ground(x,z),grow=radius+.3;
  if(N.buildings.some(b=>{const dx=x-b.at[0]!,dz=z-b.at[1]!,c=Math.cos(b.yaw),s=Math.sin(b.yaw);return Math.abs(dx*c-dz*s)<b.half[0]!+grow&&Math.abs(dx*s+dz*c)<b.half[1]!+grow;}))return true;
  if(Math.hypot(x-V2.observatory.at[0]!,z-V2.observatory.at[2]!)<V2.observatory.radius+grow)return true;
  if(N.solids.some(b=>x>b.min[0]!-grow&&x<b.max[0]!+grow&&z>b.min[2]!-grow&&z<b.max[2]!+grow&&b.max[1]!>y-.5&&b.min[1]!<y+height))return true;
  if(V2.reservedPlots.some(b=>Math.abs(x-b.at[0]!)<b.half[0]!+grow&&Math.abs(z-b.at[2]!)<b.half[1]!+grow))return true;
  for(const w of [...N.walks,...N.surfaces]){if(w.id===ignoreWalk||ignoreWalk==='*'&&N.walks.some(p=>p.id===w.id))continue;const q=nearestOnPath([x,z],path(w.points));if(q.distance<w.halfWidth+grow&&q.at[1]>y-.5&&q.at[1]<y+height)return true;}
  return N.trees.some(t=>Math.hypot(x-t.at[0]!,z-t.at[2]!)<t.radius+grow&&t.at[1]!+t.top>y&&t.at[1]!+t.base<y+height);
}
