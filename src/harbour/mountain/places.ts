/**
 * Authored places: districts, reserved plots, building sites, the plateaus they stand on,
 * the gorge water line and the glass dam with its reservoir. Pure data; no terrain.
 */
import type {Point3} from './math.ts';
import {DISTRICTS,type Biome} from '../worldDistricts.ts';
export {DISTRICTS} from '../worldDistricts.ts';
export type {Biome,District} from '../worldDistricts.ts';

export const MOUNTAIN_VERSION = 'hearth-mountain-2';
/** Saved positions and live presence share this geography revision. */
export {CURRENT_WORLD_GEOGRAPHY as GEOGRAPHY_REVISION} from '../../worldGeography.ts';
export const WORLD_BOUNDS = {minX:-180,maxX:180,minZ:-310,maxZ:84,minY:-8,maxY:150} as const;

export type ReservedPlot={id:string;name:string;at:Point3;half:readonly[number,number];words:string;biome:Biome;envelope:{half:readonly[number,number];height:number};gate:Point3};
export const RESERVED_PLOTS:readonly ReservedPlot[] = [
  {id:'woodland-clearing',name:'Woodland clearing',at:[-104,54,-196],half:[10,8],biome:'woods',envelope:{half:[7,5.5],height:9},gate:[-96,54,-190],words:'An open woodland plot, held for a future idea.'},
  {id:'sunny-shelf',name:'Sunny meadow shelf',at:[102,26,-134],half:[10,9],biome:'meadow',envelope:{half:[7,6],height:8},gate:[96,26,-128],words:'A sunny terrace with room to grow.'},
  {id:'high-terrace',name:'High rocky terrace',at:[80,97,-266],half:[9,8],biome:'alpine',envelope:{half:[6.5,5.5],height:8},gate:[76,97,-272],words:'A quiet high plot; its view and access are reserved.'},
];
/** Building centres. Buildings face the town square (yaw = atan2(-x,-z)), as they always have. */
export const BUILDING_SITES = {home:[58,-119],cottage:[-70,-128],library:[50,-181],glasshouse:[-76,-223]} as const;
/** Footprint half-extents and door offsets (building-local, +z is the front facing the town). */
export const BUILDING_FORMS = {
  home:{half:[4.5,3.5],door:[1.6,3.15]},library:{half:[4.4,3.4],door:[1.8,3.15]},
  glasshouse:{half:[4,3],door:[1.7,2.8]},cottage:{half:[3.2,2.6],door:[1.75,2.45]},
} as const;
export type MountainBuilding=keyof typeof BUILDING_SITES;
export const buildingYaw=(spot:readonly[number,number])=>Math.atan2(-spot[0],-spot[1]);
/** World door point and outward facing (unit, toward the town square). */
export function buildingDoor(id:MountainBuilding){
  const spot=BUILDING_SITES[id],yaw=buildingYaw(spot),[lx,lz]=BUILDING_FORMS[id].door,c=Math.cos(yaw),s=Math.sin(yaw);
  return {at:[spot[0]+lx*c+lz*s,spot[1]+lz*c-lx*s] as const,facing:[s,c] as const,yaw};
}
/** The observatory crowning Summit Commons and the goal pavilion beside the dam. */
export const SUMMIT_OBSERVATORY_SITE={at:[-2,104,-298] as Point3,radius:4.7};
export const GOAL_PAVILION_SITE={at:[44,90,-246] as Point3,half:[3.5,3] as const};

/** Plateau primitives: a level ellipse with a soft bank; `bank` is the bank's horizontal width. */
export type Terrace={id:string;at:Point3;radii:readonly[number,number];yaw:number;level:number;bank:number};
const terrace=(id:string,at:Point3,radii:readonly[number,number],yaw=0,bank=14):Terrace=>({id,at,radii,yaw,level:at[1],bank});
export const TERRACES:readonly Terrace[]=[
  ...DISTRICTS.map(d=>terrace(`district:${d.id}`,d.at,[d.radius,d.radius*.78],0,d.id==='summit'?10:d.id==='orchard'?9:14)),
  ...RESERVED_PLOTS.map(p=>terrace(`plot:${p.id}`,p.at,[p.half[0]+3,p.half[1]+3],0,10)),
  // Glasshouse Meadows: broad steps below and above the main plateau.
  terrace('meadow-step-low',[-58,57,-200],[18,8],-.3,8),
  terrace('meadow-step-high',[-86,66,-230],[20,8],-.3,8),
];

/** Gorge water line (surface y), dam foot to town, with its wall steepness. [x, y, z, wall] */
/** River bed sits this far under the water line (a shallow stream: never more than 0.3). */
export const RIVER_BED_DEPTH=.28;
export const GORGE_POINTS:readonly (readonly [number,number,number,number])[]=[
  [8,36,-236,1.3],[8,33,-222,1.7],[6,24.5,-210,1.7],[3,16,-198,1.7],[-1,14,-186,1.7],[-4,12,-174,1.65],[-3,10.6,-160,1.6],
  [1,9.6,-146,1.55],[4,8.8,-132,1.45],[4,8.1,-118,1.3],[1,6.8,-104,1.15],[-3,4.8,-90,1],[-5,2.9,-78,.8],[-5,2.1,-66,.6],[-2,1.5,-56,.45],[1,.9,-47,.4],[3,.18,-34,.35],
];
/** The river water line used by everything that draws or reads the river. */
export const RIVER:readonly Point3[]=[...GORGE_POINTS.slice(1).map(p=>[p[0],p[1],p[2]] as Point3),[-8,.18,-15],[-8,.18,20],[12,.05,48],[9,-.1,69]];
export const RIVER_HALF_WIDTH=2.2;

/** The glass dam: a curved wall across the gorge, convex toward town, crest road + promenade. */
export const DAM={
  centre:[8,60,-250] as Point3,radius:24,halfAngle:1.05,crest:88,foot:33,
  face:[0,1] as const,
} as const;
/** Legacy circle description (arc centre and radius of the dam; water cylinder base/top). */
export const BASIN = {x:DAM.centre[0],z:DAM.centre[2],bottom:52,top:DAM.crest,radius:DAM.radius,angle:DAM.halfAngle*2} as const;
export const RESERVOIR_BOWL={at:[6,-256] as const,radii:[24,20] as const,floor:52,rise:44};
export const RESERVOIR_LEVEL_MAX=86;
