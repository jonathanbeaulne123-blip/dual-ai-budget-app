/**
 * Authored places: districts, reserved plots, building sites, the plateaus they stand on,
 * the gorge water line and the glass dam with its reservoir. Pure data; no terrain.
 */
import type {Point3} from './math.ts';

export const MOUNTAIN_VERSION = 'hearth-mountain-1';
/** Geography revision (the wire/presence version above is unchanged; saved mountain poses from
 * revision 1 must be re-validated against the new ground — see CONTRACT.md). */
export const GEOGRAPHY_REVISION = 'hearth-mountain-geo-2';
export const WORLD_BOUNDS = {minX:-180,maxX:180,minZ:-310,maxZ:84,minY:-8,maxY:150} as const;

export type Biome='garden'|'orchard'|'woods'|'meadow'|'alpine'|'summit';
export type District={id:string;name:string;at:Point3;radius:number;biome:Biome;destination:string;words:string};
/** Uphill order. Plateaus alternate across the gorge: east, west, east, west, east, crown. */
export const DISTRICTS: readonly District[] = [
  {id:'hearth',name:'Hearth Terrace',at:[56,19.2,-114],radius:14,biome:'garden',destination:'kitchen',words:'A sheltered front garden above the harbour. Come home by the long way.'},
  {id:'orchard',name:'Orchard Hollow',at:[-68,28,-124],radius:18,biome:'orchard',destination:'cottage',words:'Apple blossom, clover and a sunny doorstep for Hercules, tucked into a hollow.'},
  {id:'library',name:'Library Woods',at:[48,37,-176],radius:14,biome:'woods',destination:'library',words:'A reading courtyard among the birches, with a balcony over the gorge.'},
  {id:'glasshouse',name:'Glasshouse Meadows',at:[-72,62,-214],radius:20,biome:'meadow',destination:'glasshouse',words:'Broad flowering terraces. Plans take root beside the water.'},
  {id:'reservoir',name:'Reservoir Heights',at:[54,90,-244],radius:15,biome:'alpine',destination:'loft-banks',words:'Exposed stone beside the glass dam, which holds a visible picture of the shared Fund.'},
  {id:'summit',name:'Summit Commons',at:[2,107,-294],radius:15,biome:'summit',destination:'journey',words:'A windswept crown. The whole neighbourhood below, and a new way down ahead.'},
];
export type ReservedPlot={id:string;name:string;at:Point3;half:readonly[number,number];words:string;biome:Biome;envelope:{half:readonly[number,number];height:number};gate:Point3};
export const RESERVED_PLOTS:readonly ReservedPlot[] = [
  {id:'woodland-clearing',name:'Woodland clearing',at:[-104,54,-196],half:[10,8],biome:'woods',envelope:{half:[7,5.5],height:9},gate:[-96,54,-190],words:'An open woodland plot, held for a future idea.'},
  {id:'sunny-shelf',name:'Sunny meadow shelf',at:[102,26,-134],half:[10,9],biome:'meadow',envelope:{half:[7,6],height:8},gate:[96,26,-128],words:'A sunny terrace with room to grow.'},
  {id:'high-terrace',name:'High rocky terrace',at:[78,100,-274],half:[9,8],biome:'alpine',envelope:{half:[6.5,5.5],height:8},gate:[72,100,-268],words:'A quiet high plot; its view and access are reserved.'},
];
/** Building centres. Buildings face the town square (yaw = atan2(-x,-z)), as they always have. */
export const BUILDING_SITES = {home:[58,-119],cottage:[-70,-128],library:[47,-178],glasshouse:[-74,-219]} as const;
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
export const SUMMIT_OBSERVATORY_SITE={at:[-2,107,-298] as Point3,radius:4.7};
export const GOAL_PAVILION_SITE={at:[44,90,-246] as Point3,half:[3.5,3] as const};

/** Plateau primitives: a level ellipse with a soft bank; `bank` is the bank's horizontal width. */
export type Terrace={id:string;at:Point3;radii:readonly[number,number];yaw:number;level:number;bank:number};
const terrace=(id:string,at:Point3,radii:readonly[number,number],yaw=0,bank=14):Terrace=>({id,at,radii,yaw,level:at[1],bank});
export const TERRACES:readonly Terrace[]=[
  ...DISTRICTS.map(d=>terrace(`district:${d.id}`,d.at,[d.radius,d.radius*.78],0,d.id==='summit'?10:14)),
  ...RESERVED_PLOTS.map(p=>terrace(`plot:${p.id}`,p.at,[p.half[0]+3,p.half[1]+3],0,10)),
  // Glasshouse Meadows: broad steps below and above the main plateau.
  terrace('meadow-step-low',[-58,57,-200],[18,8],-.3,8),
  terrace('meadow-step-high',[-86,66,-230],[20,8],-.3,8),
];

/** Gorge water line (surface y), dam foot to town, with its wall steepness. [x, y, z, wall] */
export const GORGE_POINTS:readonly (readonly [number,number,number,number])[]=[
  [8,36,-236,1.3],[8,33,-222,1.6],[6,26,-210,1.6],[3,20,-198,1.6],[-1,16,-186,1.6],[-4,13.5,-174,1.6],[-3,11.8,-160,1.55],
  [1,10.5,-146,1.5],[4,9.4,-132,1.4],[4,8.4,-118,1.3],[1,7.3,-104,1.15],[-3,6,-90,1],[-5,4.6,-78,.8],[-5,3.2,-66,.6],[-2,2,-56,.45],[1,1.1,-47,.4],[3,.18,-34,.35],
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
