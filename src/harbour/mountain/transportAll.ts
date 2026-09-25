import {DISTRICTS} from './places.ts';
import {mountainGround} from './mountainGround.ts';
import {islandHeight} from './islandShape.ts';
import {mix,type Point3} from './math.ts';
import {TRANSPORT_STOPS as mountainStops,transportPoint as mountainPoint,type TransportKind as MountainTransportKind} from './transport.ts';
const mountainBaseHeight=(x:number,z:number)=>Math.max(islandHeight(x,z),mountainGround(x,z));
const catmull=(a:number,b:number,c:number,d:number,t:number)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
export const MONORAIL_STOPS=[
  {id:'quay',name:'Waterfront',at:[0,.57,58] as Point3},
  {id:'studio',name:'Pottery Studio',at:[20,1.31,20] as Point3},
  {id:'boathouse',name:'Boathouse',at:[54,1.31,-40] as Point3},
  {id:'bank',name:'Fund bank',at:[7,1.31,-14] as Point3},
  {id:'town',name:'Town square',at:[-20,1.31,-37] as Point3},
  {id:'hearth',name:'Hearth Terrace',at:[112,20,-101] as Point3},
  {id:'orchard',name:'Orchard Hollow',at:[-121,34,-137] as Point3},
  {id:'library',name:'Library Woods',at:[106,51,-190] as Point3},
  {id:'glasshouse',name:'Glasshouse Meadows',at:[-87,66,-208] as Point3},
  {id:'reservoir',name:'Reservoir Heights',at:[47,83,-240] as Point3},
  {id:'summit',name:'Summit Commons',at:[-7,110,-277] as Point3},
].map(s=>{const district=DISTRICTS.find(d=>d.id===s.id);return district?{...s,at:[district.at[0]-7,district.at[1],district.at[2]+8] as Point3}:s;});

export type TransportKind=MountainTransportKind|'monorail';
export const TRANSPORT_STOPS={...mountainStops,monorail:MONORAIL_STOPS};
export function transportPoint(kind:TransportKind,from:number,to:number,t:number):Point3{
if(t<=0)return TRANSPORT_STOPS[kind][from]!.at;if(t>=1)return TRANSPORT_STOPS[kind][to]!.at;
  if(kind==='monorail'){
    const stops=MONORAIL_STOPS,v=from+(to-from)*t,i=Math.min(stops.length-2,Math.floor(v)),u=v-i;
    const before=stops[Math.max(0,i-1)]!.at,a=stops[i]!.at,b=stops[i+1]!.at,after=stops[Math.min(stops.length-1,i+2)]!.at;
    const x=catmull(before[0],a[0],b[0],after[0],u),z=catmull(before[2],a[2],b[2],after[2],u);
    const y=Math.max(mix(a[1],b[1],u),mountainBaseHeight(x,z))+Math.sin(Math.PI*u)*7;
    return [x,y,z];
  }
return mountainPoint(kind,from,to,t);
}
