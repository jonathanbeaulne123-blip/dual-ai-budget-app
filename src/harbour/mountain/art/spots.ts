/**
 * Finding level, clear ground for furniture: the lowest ground under a footprint, the
 * clearance from every walked corridor (road, lane, paths, stairs, town lanes, buildings,
 * the river) and a search for an authored spot near a preferred bearing.
 * A leaf module (no life/placement imports), so the interaction data can use it.
 */
import {landHeight as groundHeightAt} from './land.ts';
import {MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,RIVER,type Point3} from '../definition.ts';
import {PATH_EDGES} from '../pathGraph.ts';
import {HARBOUR_LANES,distanceToTrail} from '../../village/world.ts';
import {VILLAGE_SITES} from '../../village/layout.ts';
import {TRANSPORT_LINES} from '../transport.ts';

/** Lowest and highest ground under a turned footprint (corners, edge midpoints and centre). */
export function footGround(x:number,z:number,yaw:number,hx:number,hz:number):{min:number;max:number}{
  const c=Math.cos(yaw),s=Math.sin(yaw);let min=Infinity,max=-Infinity;
  for(const lx of [-hx,0,hx])for(const lz of [-hz,0,hz]){const y=groundHeightAt(x+lx*c+lz*s,z+lz*c-lx*s);if(y<min)min=y;if(y>max)max=y;}
  return {min,max};
}
type Line={samples:readonly {at:Point3;halfWidth:number}[]};
/** Horizontal distance past the edge of the nearest road, lane, path, stair, platform, town lane or building. */
export function corridorClearance(x:number,z:number):number{
  let best=Infinity;
  for(const line of [MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE] as Line[])for(let i=0;i<line.samples.length;i+=2){const s=line.samples[i]!,d=Math.hypot(x-s.at[0],z-s.at[2])-s.halfWidth;if(d<best)best=d;}
  for(const e of PATH_EDGES)for(let i=1;i<e.points.length;i++){const a=e.points[i-1]!,b=e.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/l)),d=Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t)-e.halfWidth;if(d<best)best=d;}
  for(const line of Object.values(TRANSPORT_LINES))for(const st of line.stations){const p=st.platform.at,d=Math.hypot(x-p[0],z-p[2])-Math.hypot(...st.platform.half)-.5;if(d<best)best=d;}
  if(z>-60)for(const lane of HARBOUR_LANES)best=Math.min(best,distanceToTrail(x,z,lane.points)-1.3);
  for(const site of Object.values(VILLAGE_SITES))best=Math.min(best,Math.hypot(x-site.spot[0],z-site.spot[1])-Math.hypot(...site.half)-1);
  return best;
}
export function riverClearance(x:number,z:number):number{let best=Infinity;for(let i=1;i<RIVER.length;i++){const a=RIVER[i-1]!,b=RIVER[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/l));best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t));}return best;}
/** Downhill bearing at a point (the way a view opens), as a yaw. */
export function downhillYaw(x:number,z:number):number{const gx=groundHeightAt(x+1.5,z)-groundHeightAt(x-1.5,z),gz=groundHeightAt(x,z+1.5)-groundHeightAt(x,z-1.5);return Math.atan2(-gx,-gz);}

/**
 * The nearest level, clear spot around a centre, searching outward from a preferred
 * bearing and radius. `near` (optional) asks for a spot within that distance of a corridor
 * edge (a gate beside a path, a bench at a verge).
 */
export function findSpot(cx:number,cz:number,angle:number,radius:number,half:number,opts:{near?:number;level?:number;clear?:number}={}):[number,number]{
  const level=opts.level??.55,clear=opts.clear??half+.35;
  let best:[number,number]|null=null,score=Infinity;
  for(let ring=0;ring<14;ring++)for(let k=0;k<24;k++){
    const a=angle+(k%2?1:-1)*Math.ceil(k/2)*.19,r=Math.max(1.5,radius+(ring%2?1:-1)*Math.ceil(ring/2)*1.6),x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;
    const g=footGround(x,z,0,half,half);if(g.max-g.min>level)continue;
    const c=corridorClearance(x,z);if(c<clear||riverClearance(x,z)<half+3.2)continue;
    if(opts.near!==undefined&&c>clear+opts.near)continue;
    const s=Math.abs(r-radius)*.4+Math.abs(k)*.15+(g.max-g.min);if(s<score){score=s;best=[x,z];}
    if(best&&ring>2)return best;
  }
  return best??[cx+Math.sin(angle)*radius,cz+Math.cos(angle)*radius];
}
