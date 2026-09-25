import {RIVER} from './places.ts';
import {smooth,type Point3} from './math.ts';
import {TOWN_STOREFRONT_APRONS} from './townSquare.ts';
import {HARBOUR_LANES,distanceToTrail} from '../village/world.ts';
import {VILLAGE_SITES,VILLAGE_WATERFRONT} from '../village/layout.ts';

// Only lane segments beside the channel need causeway checks during ground sampling.
/** Horizontal distance to the town water line (the channel is short; a plain scan is cheap). */
function nearestOnRoute(x:number,z:number,points:readonly Point3[]){let best=Infinity,py=0;for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(l||1))),d=Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);if(d<best){best=d;py=a[1]+(b[1]-a[1])*t;}}return {distance:best,point:[0,py,0] as Point3};}
const crossings=HARBOUR_LANES.flatMap(lane=>lane.points.slice(1).flatMap((b,i)=>{
  const a=lane.points[i]!;if(a[1]<-48&&b[1]<-48)return [];
  const distance=Math.min(nearestOnRoute(a[0],a[1],RIVER).distance,nearestOnRoute(b[0],b[1],RIVER).distance);
  return distance<7?[[a,b] as const]:[];
}));
const aprons=[...Object.values(VILLAGE_SITES).filter(s=>s.spot[1]>-48).map(s=>({x:s.spot[0],z:s.spot[1],radius:Math.hypot(...s.half)+2})),
  {x:VILLAGE_WATERFRONT.spot[0],z:VILLAGE_WATERFRONT.spot[1],radius:6.5},
  ...TOWN_STOREFRONT_APRONS];

/** Unsupported village lanes remain dry causeways; existing room aprons never move. */
export function townChannelProtection(x:number,z:number):number{
  let keep=0;
  for(const a of aprons)keep=Math.max(keep,1-smooth((Math.hypot(x-a.x,z-a.z)-a.radius)/1.2));
  for(const points of crossings)keep=Math.max(keep,1-smooth((distanceToTrail(x,z,points)-1.25)/1.1));
  return keep;
}

/** Physical ground and the rendered terrain share this shallow, walkable channel cut. */
export function townChannelHeight(x:number,z:number,base:number):number{
  if(z<=-48||z>74)return base;
  const river=nearestOnRoute(x,z,RIVER);if(river.distance>=5.8)return base;
  const cut=(1-smooth((river.distance-2.7)/3.1))*smooth((z+48)/4)*(1-townChannelProtection(x,z));
  // A shallow bed stays below the authored water while retaining easy bank slopes.
  const bed=Math.min(base,river.point[1]-.48);
  return base+(bed-base)*cut;
}
