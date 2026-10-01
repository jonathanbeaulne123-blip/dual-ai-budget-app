/** Exact top of the unchanged native town station plank picture. This is only
 * used by the explicitly owned Horizon path repair; native defaults retain the
 * existing station/query/art. The 5cm visible plank fringe needs real support. */
import {FUNICULAR_LINE} from '../../../mountain/transport.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../../regions/mountainV2/placement.ts';
import type {XYZ} from '../interfaces.ts';
const station=()=>{const st=FUNICULAR_LINE.stations.find(s=>s.id==='town');if(!st)throw new Error('Missing native town station');return st.platform;};
/** Same source plan/frame/dimensions used by transportArt.station's plank box. */
export function funicularFootStationTop():[XYZ,XYZ,XYZ][]{
 const p=station(),c=Math.cos(p.yaw),s=Math.sin(p.yaw),[hl,hw]=p.half;
 const W=(along:number,across:number):XYZ=>[p.at[0]+O.x+s*along+c*across,p.at[1]+O.y,p.at[2]+O.z+c*along-s*across];
 const q=[W(-hl-.05,-hw-.05),W(hl+.05,-hw-.05),W(hl+.05,hw+.05),W(-hl-.05,hw+.05)];
 return[[q[0]!,q[1]!,q[2]!],[q[0]!,q[2]!,q[3]!]];
}
/** Exact already-drawn plank top, activated only by the placed Horizon join. */
export function funicularFootStationFloor(x:number,z:number):number|null{
 const p=station(),c=Math.cos(p.yaw),s=Math.sin(p.yaw),dx=x-O.x-p.at[0],dz=z-O.z-p.at[2],along=dx*s+dz*c,across=dx*c-dz*s;
 return Math.abs(along)<=p.half[0]+.05&&Math.abs(across)<=p.half[1]+.05?p.at[1]+O.y:null;
}
/** Horizon fill beneath the unchanged native platform capsule. The native
 * rectangle and query remain authored. Sixty-four tangent sides enclose the
 * existing 1.6m circular ends, exceeding them by at most1.930mm in plan.
 * The new fill therefore has an actual flat triangle beneath every existing
 * physical station point; it is not a floor-selector exception. */
export function funicularFootStationSupportTop():[XYZ,XYZ,XYZ][]{
 const p=station(),tx=Math.sin(p.yaw),tz=Math.cos(p.yaw),nx=-tz,nz=tx;
 const a:XYZ=[p.at[0]+O.x-tx*p.half[0],p.at[1]+O.y,p.at[2]+O.z-tz*p.half[0]],b:XYZ=[p.at[0]+O.x+tx*p.half[0],p.at[1]+O.y,p.at[2]+O.z+tz*p.half[0]];
 const sides=64,r=p.half[1]/Math.cos(Math.PI/sides),ring:XYZ[]=[];
 // Semicircles are circumscribed about each exact source endpoint. Using
 // half-angle vertices makes the connecting side lines tangent at +/-r*cos.
 for(const [p,start]of [[b,-Math.PI/2],[a,Math.PI/2]] as const)for(let i=0;i<sides/2;i++){
  const angle=start+(i+.5)*2*Math.PI/sides;
  ring.push([p[0]!+r*(tx*Math.cos(angle)+nx*Math.sin(angle)),p[1]!,p[2]!+r*(tz*Math.cos(angle)+nz*Math.sin(angle))]);
 }
 const out:[XYZ,XYZ,XYZ][]=[];for(let i=1;i<ring.length-1;i++)out.push([ring[0]!,ring[i]!,ring[i+1]!]);return out;
}
