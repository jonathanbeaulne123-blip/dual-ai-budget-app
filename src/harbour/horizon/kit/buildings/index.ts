/**
 * The building grammar (`kit/buildings`, The Water's Way PR 1): one plan per `BuildingKind`, from which the drawing,
 * the collision and the Journey shape all derive (horizon-create rule 1: one definition; "collision is what's drawn").
 *
 *  - `drawBuilding` paints a record into a `CardBuilder` in one dressing and tier (lite drops detail, never
 *    substitutes; lit windows go to the `glow` bucket so the runtime's night ramp lights them).
 *  - `buildingCollision` returns the same plan's solid parts in world space: boxes (turned, vertical) and prisms (a
 *    plan polygon whose planar top passes through each corner's y, extruded down to `bottom`). Open structures
 *    collide only where drawn (posts, decks, rails at their drawn height).
 *  - `buildingJourneyShape` gives the Journey map the footprint, eave height and roof top.
 *
 * Units and frames are the contract's (`neighbourhoods/types.ts`): eu, x east, z south, y up; local +z is the front.
 */
import type {CardBuilder} from '../../../art/cardScene.ts';
import type {StructureSolid} from '../../land/interfaces.ts';
import type {BuildingKind,BuildingRecord,DressingTheme} from '../../neighbourhoods/types.ts';
import {buildingPalette} from './palette.ts';
import {frameOf,groundUnder,hashOf,footprintOf,type DrawCtx,type KindDef,type Plan,type Vol} from './core.ts';
import {rowHouse,villa,palazzo,campanile,loggia,kiosk} from './harbour.ts';
import {croft,chapel,longhouse,barn,shieling,liftStation,liftTower} from './crown.ts';
import {kiln,cottage,studio,coveredBridge} from './hollow.ts';
import {library} from './library.ts';
import {boathouse,storefront,lifeguardTower,shack,ferrisWheel} from './landing.ts';
import {quonset,elevator,station,observatory,arch,hoodoo} from './flats.ts';
import {pavilion,hide,deck,platform,windpump,shed,gate,wall} from './shared.ts';

export {buildingPalette,BUILDING_STYLES,type BuildingPalette} from './palette.ts';

export type CollisionPart =
  | { kind: 'box'; centre: [number, number]; size: [number, number]; yaw: number; bottom: number; top: number; role: StructureSolid['role']; walkable: boolean; surface: string }
  | { kind: 'prism'; corners: [number, number, number][]; bottom: number; role: StructureSolid['role']; walkable: boolean; surface: string };

const KINDS:Record<BuildingKind,KindDef<Plan>>={
  rowHouse,villa,palazzo,campanile,loggia,kiosk,
  croft,chapel,longhouse,barn,shieling,liftStation,liftTower,
  kiln,cottage,studio,coveredBridge,
  library,
  boathouse,storefront,lifeguardTower,shack,ferrisWheel,
  quonset,elevator,station,observatory,arch,hoodoo,
  pavilion,hide,deck,platform,windpump,shed,gate,wall,
} as Record<BuildingKind,KindDef<Plan>>;
/**
 * Triangle budgets per kind, [full, lite], measured on the fixture in all three dressings (test/horizonKitBuildings).
 * A district may hold ~100 row houses: a row house stays ≤ 400 full. Lite drops detail; it never substitutes.
 */
export const BUILDING_TRI_BUDGET:Readonly<Record<BuildingKind,readonly [number,number]>>={
  rowHouse:[400,220],villa:[1060,370],palazzo:[930,430],campanile:[1120,340],loggia:[390,180],kiosk:[220,120],
  croft:[350,200],chapel:[580,350],longhouse:[350,180],barn:[230,100],shieling:[180,90],liftStation:[270,150],liftTower:[160,120],
  kiln:[280,150],cottage:[430,180],studio:[230,140],coveredBridge:[350,210],
  library:[1890,940],
  boathouse:[370,170],storefront:[320,230],lifeguardTower:[440,330],shack:[200,160],ferrisWheel:[1610,1420],
  quonset:[390,370],elevator:[500,370],station:[670,340],observatory:[470,260],arch:[620,410],hoodoo:[310,210],
  pavilion:[590,470],hide:[390,300],deck:[470,390],platform:[340,290],windpump:[690,370],shed:[140,90],gate:[130,90],wall:[150,140],
};
/** Every kind the grammar draws (the contract's `BuildingKind`, in contract order). */
export const BUILDING_KINDS=Object.keys(KINDS) as BuildingKind[];

const planCache=new WeakMap<BuildingRecord,Plan>();
/** The one plan for a record (memoised per record object; records are plain baked data and never mutated). */
export function buildingPlan(rec:BuildingRecord):Plan{
  let p=planCache.get(rec);if(p)return p;
  const def=KINDS[rec.kind];if(!def)throw new Error(`kit/buildings: unknown kind ${String(rec.kind)} (${rec.id})`);
  p=def.plan(rec);planCache.set(rec,p);return p;
}

const palettes=new Map<string,ReturnType<typeof buildingPalette>>();
/** Draw one building into `b` in a dressing and tier. Deterministic: the same record draws the same triangles. */
export function drawBuilding(b:CardBuilder,rec:BuildingRecord,theme:DressingTheme,ground:(x:number,z:number)=>number,tier:'full'|'lite'):void{
  const def=KINDS[rec.kind];if(!def)throw new Error(`kit/buildings: unknown kind ${String(rec.kind)} (${rec.id})`);
  const key=`${theme}|${rec.style}`;let pal=palettes.get(key);if(!pal){pal=buildingPalette(theme,rec.style);palettes.set(key,pal);}
  const c:DrawCtx={b,rec,pal,ground,tier,full:tier==='full',theme,F:frameOf(rec.at[0],rec.at[2],rec.yaw),floor:rec.at[1],h:salt=>hashOf(rec.id,salt)};
  def.draw(c,buildingPlan(rec));
}

/** The record's solid parts in world space (the bake turns them into `StructureSolid`s of kind `dressing`). */
export function buildingCollision(rec:BuildingRecord,ground:(x:number,z:number)=>number):CollisionPart[]{
  if(!rec.collide)return [];
  const F=frameOf(rec.at[0],rec.at[2],rec.yaw),floor=rec.at[1],out:CollisionPart[]=[];
  const sunk=(v:Vol)=>{
    if(v.y0!=='ground')return floor+v.y0;
    if(v.t==='box')return groundUnder(ground,F,v.x,v.z,v.hx,v.hz,0).min-.35;
    let m=Infinity;for(const [x,z] of v.pts){const [wx,wz]=F.P(x,z);m=Math.min(m,ground(wx,wz));}return m-.35;
  };
  for(const v of buildingPlan(rec).vols){
    const bottom=sunk(v);
    if(v.t==='box'){const [x,z]=F.P(v.x,v.z),top=typeof v.y1==='number'?floor+v.y1:groundUnder(ground,F,v.x,v.z,v.hx,v.hz,0).max+v.y1.g;if(top-bottom<1e-3)continue;out.push({kind:'box',centre:[x,z],size:[v.hx*2,v.hz*2],yaw:rec.yaw+(v.yaw??0),bottom,top,role:v.role,walkable:!!v.walk,surface:v.surf});}
    else out.push({kind:'prism',corners:v.pts.map(([x,z,y])=>{const [wx,wz]=F.P(x,z);return [wx,(v.gTop?ground(wx,wz):floor)+y,wz] as [number,number,number];}),bottom,role:v.role,walkable:!!v.walk,surface:v.surf});
  }
  return out;
}

/** Footprint (world plan rectangle of `size.w × size.d`), eave height above the floor and roof top above the floor. */
export function buildingJourneyShape(rec:BuildingRecord):{footprint:[number,number][];height:number;roofHeight:number}{
  const p=buildingPlan(rec);return {footprint:footprintOf(rec),height:p.eave,roofHeight:Math.max(p.eave,p.top)};
}

/**
 * Closed indexed geometry for one collision part (outward faces, sides and underside), for the bake's
 * `StructureSolid.positions/indices`. Boxes: 8 corners; prisms: the top polygon (fan) over the bottom polygon.
 */
export function collisionPartMesh(part:CollisionPart):{positions:number[];indices:number[]}{
  const top:[number,number,number][]=[],bot:[number,number,number][]=[];
  if(part.kind==='box'){const c=Math.cos(part.yaw),s=Math.sin(part.yaw),hx=part.size[0]/2,hz=part.size[1]/2;
    for(const [lx,lz] of [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]] as const){const x=part.centre[0]+lx*c+lz*s,z=part.centre[1]+lz*c-lx*s;top.push([x,part.top,z]);bot.push([x,part.bottom,z]);}}
  else for(const [x,y,z] of part.corners){top.push([x,y,z]);bot.push([x,part.bottom,z]);}
  // Wind the plan counter-clockwise seen from above (+y): signed area in (x, z) negative → CCW from above.
  let area=0;for(let i=0;i<top.length;i++){const a=top[i]!,b=top[(i+1)%top.length]!;area+=a[0]*b[2]-b[0]*a[2];}
  if(area>0){top.reverse();bot.reverse();}
  const n=top.length,positions=[...top.flat(),...bot.flat()],indices:number[]=[];
  for(let i=1;i<n-1;i++){indices.push(0,i,i+1);indices.push(n,n+i+1,n+i);}
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,n+i,n+j,i,n+j,j);}
  return {positions,indices};
}
