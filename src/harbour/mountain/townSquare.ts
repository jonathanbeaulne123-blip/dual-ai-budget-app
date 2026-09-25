/**
 * The town square recomposed (placement only; the art track dresses it): a pedestrian square
 * beside a visible water channel, culverts and bridges where lanes cross it, the two
 * storefronts facing the square across the channel, the four sites vacated by the moved
 * buildings put to new use, the road tapering from mountain width to a town lane, and
 * sheltered arrival points.
 */
import {HARBOUR_LANES} from '../village/world.ts';
import {RIVER} from './places.ts';
import {MOUNTAIN_ROAD_LINE} from './roads.ts';
import {TOWN_RACE_ROAD,TOWN_LANE_HALF_WIDTH,CANAL_BRIDGE,RACE_FINISH} from './course.ts';
import {FUNICULAR_LINE,GONDOLA_LINE} from './transport.ts';
import type {Point3} from './math.ts';

type P2=readonly[number,number];
const TOWN_RIVER=RIVER.filter(p=>p[2]>-40);
function crossing(a:P2,b:P2,c:readonly[number,number,number],d:readonly[number,number,number]):P2|null{
  const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[2]-c[2]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-9)return null;
  const t=((c[0]-a[0])*s[1]-(c[2]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[2]-a[1])*r[0])/den;
  return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+r[0]*t,a[1]+r[1]*t]:null;
}
const faceSquare=(x:number,z:number)=>Math.atan2(-x,-z);
/** Channel crossings: every village lane that meets the town channel crosses it on a culvert. */
const laneCrossings=HARBOUR_LANES.flatMap(lane=>{
  const out:{id:string;at:P2;kind:'culvert'|'footbridge'|'bridge';span:number;carries:string}[]=[];
  for(let i=1;i<lane.points.length;i++)for(let k=1;k<TOWN_RIVER.length;k++){
    const hit=crossing(lane.points[i-1]!,lane.points[i]!,TOWN_RIVER[k-1]!,TOWN_RIVER[k]!);
    if(hit&&!out.some(o=>Math.hypot(o.at[0]-hit[0],o.at[1]-hit[1])<3))out.push({id:`culvert:${lane.id}:${out.length}`,at:hit,kind:'culvert',span:5,carries:lane.id});
  }
  return out;
});
export const TOWN_SQUARE={
  /** The pedestrian square around the fountain; skating lines keep outside it. */
  plaza:{centre:[0,0] as P2,radius:12},
  /** The visible financial/natural channel through town (surface water line). */
  channels:[{id:'town-channel',points:TOWN_RIVER,halfWidth:2.2}],
  crossings:[
    ...laneCrossings,
    {id:CANAL_BRIDGE.id,at:[CANAL_BRIDGE.at[0],CANAL_BRIDGE.at[2]] as P2,kind:'bridge' as const,span:CANAL_BRIDGE.span,carries:'town-race-road'},
    {id:'footbridge:outfitters',at:[-8,-5] as P2,kind:'footbridge' as const,span:5,carries:'path'},
    {id:'footbridge:potters-supply',at:[-8,7.5] as P2,kind:'footbridge' as const,span:5,carries:'path'},
  ],
  /** The two small storefronts face the square across the channel. */
  storefronts:[
    {id:'outfitters',name:'Outfitters',at:[-15,-6] as P2,yaw:faceSquare(-15,-6),half:[2.6,2] as const,door:[0,2.05] as const,opens:'appearance'},
    {id:'potters-supply',name:'Potter’s Supply',at:[-15,8.5] as P2,yaw:faceSquare(-15,8.5),half:[2.6,2] as const,door:[0,2.05] as const,opens:'pottery'},
  ],
  /** The four sites the moved buildings left, re-used. */
  vacated:[
    {id:'old-home',at:[-24,26] as P2,was:'home',use:'garden' as const,half:[6,5] as const},
    {id:'old-library',at:[-28,-18] as P2,was:'library',use:'lane-garden' as const,half:[6,5] as const},
    {id:'old-glasshouse',at:[-43,6] as P2,was:'glasshouse',use:'orchard-edge' as const,half:[7,6] as const},
    {id:'old-cottage',at:[17,35] as P2,was:'cottage',use:'quay-widening' as const,half:[8,6] as const},
  ],
  /** The mountain road narrows to a town lane over its first samples, then the lane continues on town ground. */
  roadTaper:{points:MOUNTAIN_ROAD_LINE.samples.slice(0,19).map(s=>s.at),halfWidths:MOUNTAIN_ROAD_LINE.samples.slice(0,19).map(s=>s.halfWidth),lane:TOWN_RACE_ROAD,laneHalfWidth:TOWN_LANE_HALF_WIDTH},
  /** Sheltered arrival points (a canopy or porch over each). */
  arrivals:[
    {id:'arrival:road-foot',at:[-20,-38] as P2,facing:faceSquare(-20,-38),label:'Mountain road gate'},
    {id:'arrival:funicular',at:[FUNICULAR_LINE.stations[0]!.platform.at[0],FUNICULAR_LINE.stations[0]!.platform.at[2]] as P2,facing:faceSquare(FUNICULAR_LINE.stations[0]!.platform.at[0],FUNICULAR_LINE.stations[0]!.platform.at[2]),label:'Funicular'},
    {id:'arrival:gondola',at:[GONDOLA_LINE.stations[0]!.platform.at[0],GONDOLA_LINE.stations[0]!.platform.at[2]] as P2,facing:faceSquare(GONDOLA_LINE.stations[0]!.platform.at[0],GONDOLA_LINE.stations[0]!.platform.at[2]),label:'Gondola'},
    {id:'arrival:finish',at:[RACE_FINISH.at[0]+2,RACE_FINISH.at[2]-7] as P2,facing:faceSquare(RACE_FINISH.at[0]+2,RACE_FINISH.at[2]-7),label:'Quay finish'},
  ],
};
/** Storefront volumes for collision (oriented boxes). */
export const STOREFRONT_SOLIDS=TOWN_SQUARE.storefronts.map(s=>({kind:'obox' as const,id:`storefront:${s.id}`,x:s.at[0],z:s.at[1],halfX:s.half[0],halfZ:s.half[1],yaw:s.yaw,bottom:-1,top:4.4}));
export const TOWN_STOREFRONT_APRONS:readonly {x:number;z:number;radius:number}[]=TOWN_SQUARE.storefronts.map(s=>{const c=Math.cos(s.yaw),n=Math.sin(s.yaw);return {x:s.at[0]+s.door[1]*n,z:s.at[1]+s.door[1]*c,radius:4.5};});
export type TownSquare=typeof TOWN_SQUARE;
export const townPoint=(p:P2,y=0):Point3=>[p[0],y,p[1]];
