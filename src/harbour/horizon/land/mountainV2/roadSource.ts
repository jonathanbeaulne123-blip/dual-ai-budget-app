/** Offline access to the carried road's authored transverse frames. The source
 * is lazy: importing the terrain sampler must not build a road index at runtime. */
import V2 from './v2-data.json';
import {drawnRoadFloor} from '../../regions/mountainV2/drawnRoadFloor';
import {drawnRoadGroundCeiling} from '../../regions/mountainV2/drawnRoadGround';

function source(){
  const samples=V2.road.samples;
  const rows=samples.map(s=>[-s.hw,-s.hw+.55,-.45,.45,s.hw-.55,s.hw].map(w=>
    [s.at[0]!+s.normal[0]!*w,s.at[1]!,s.at[2]!+s.normal[2]!*w] as [number,number,number]));
  const points=samples.map(s=>s.at as [number,number,number]),floor=drawnRoadFloor(rows);
  const groundCeiling=drawnRoadGroundCeiling({id:'mountain-road',kind:'road',points,walkable:true,halfWidth:Math.max(...samples.map(s=>s.hw)),widths:samples.map(s=>s.hw),landingRows:rows,material:'path'});
  return {samples,rows,points,floor,groundCeiling};
}
let cached:ReturnType<typeof source>|undefined;
export const mountainRoadSource=()=>cached??=source();
/** Physical top; the five-centimetre paint lift is decorative, not another floor. */
export const mountainJoinRoadTop=(x:number,z:number,ceiling=Infinity):number|null=>mountainRoadSource().floor(x,z,ceiling)?.y??null;
