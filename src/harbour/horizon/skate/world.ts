/** The native skate's authored park over the surfaces the Horizon actually draws. */
import type {SurfaceKind, SurfaceSample} from '../../skate/contract.ts';
import type {SkateDriverWorld} from '../../skate/driver.ts';
import {skateDressingSolids} from '../../skate/world/dressingSolids.ts';
import type {SkateWorldField} from '../../skate/world/field.ts';
import {HARBOUR_LAND} from '../../village/world.ts';
import type {TerrainField} from '../land/interfaces.ts';
import {TERRAIN_SURFACE_PALETTE,terrainPaintGround,WALKABLE_DEGREES} from '../land/terrain/index.ts';
import type {createHorizonGeography} from '../runtime/geography.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../regions/mountainV2/placement.ts';

export type HorizonSkateGeography=Pick<ReturnType<typeof createHorizonGeography>,'surface'|'ground'|'ceiling'|'contact'|'submerged'|'blocked'>;
/** Why the board cannot be put down at a point (null: it can). */
export type SkateStartRefusal='unsupported'|'steep'|'water'|'blocked';
/** The Horizon's surface vocabulary (MANIFEST `surfaces`, solid materials, terrain paint) in the old skate's seven kinds. */
export function skateKindOf(material:string):SurfaceKind{
  switch(material){
    case 'boardwalk':case 'wood':case 'timber':case 'planks':return 'wood';
    case 'metal':return 'metal';
    case 'grass':case 'bankedTurf':case 'duff':case 'scree':case 'snow':return 'grass';
    case 'sand':return 'sand';
    case 'stone':case 'cobble':case 'rock':return 'cobble';
    case 'concrete':case 'apron':case 'plaza':return 'concrete';
    default:return material.startsWith('rock.')?'cobble':'path';
  }
}
/** The baked terrain paint under (hx, hz), Horizon space: the nearest lattice vertex's ground palette entry. */
export function terrainPaintKind(field:Pick<TerrainField,'step'|'columns'|'rows'|'surfaces'>):(hx:number,hz:number)=>SurfaceKind|null{
  const ids=TERRAIN_SURFACE_PALETTE.map(p=>p.id as string);
  return (hx,hz)=>{
    const i=Math.round(hx/field.step),j=Math.round(hz/field.step);
    if(!(i>=0&&j>=0&&i<field.columns&&j<field.rows))return null;
    const byte=field.surfaces[j*field.columns+i];if(byte===undefined)return null;
    const id=ids[terrainPaintGround(byte)];return id?skateKindOf(id):null;
  };
}

export function createHorizonSkateWorld(geography:HorizonSkateGeography,park:SkateWorldField,options:{
  /** Horizon terrain paint as a skate kind (sand beaches, paved and plaza paint). Omitted: terrain rides as grass. */
  terrainKind?:(hx:number,hz:number)=>SurfaceKind|null;
}={}){
  /**
   * Terrain answers 'grass' from the Horizon geography everywhere. The old skate read its island's own ground as cobble on
   * the terrace, path on the lanes, grass on the lawn and sand at the shore (`skate/world/field.ts openKind`); on Mountain v2's
   * town island (native ground raised by the offset) the native field still says which. Elsewhere the baked paint does.
   */
  function terrainKind(x:number,z:number):SurfaceKind{
    if(Math.hypot(x,z)<=HARBOUR_LAND.radius)return park.sample(x,z).kind;
    return options.terrainKind?.(x+O.x,z+O.z)??'grass';
  }
  function sample(x:number,z:number,y?:number):SurfaceSample {
    const surface=geography.surface(x+O.x,z+O.z,y===undefined?undefined:y+O.y,.48);
    const authored=park.samplePark(x,z);
    // Only authored park geometry competes here. Native terrain and omitted native decks never do.
    if(authored&&(y===undefined||authored.y<=y+.48)&&(!surface||authored.y+O.y>=surface.y-1e-6))return authored;
    if(surface)return {y:surface.y-O.y,nx:surface.nx,ny:surface.ny,nz:surface.nz,kind:surface.id==='terrain'?terrainKind(x,z):skateKindOf(surface.material),feature:surface.id,lip:null};
    return {supported:false,y:y??0,nx:0,ny:1,nz:0,kind:'grass',feature:null,lip:null};
  }
  const field:SkateWorldField={...park,
    ground:(x,z)=>geography.ground(x+O.x,z+O.z)-O.y,
    sample,
    sampleInto:(x,z,out)=>{const at=sample(x,z);return Object.assign(out,at,{supported:at.supported!==false});},
    heightAt:(x,z)=>sample(x,z).y,
    ceilingAt:(x,z,feet)=>geography.ceiling(x+O.x,z+O.z,feet+O.y)-O.y,
  };
  const physics:NonNullable<SkateDriverWorld['physics']>={
    shore:null,
    // Park art registers dressing against the original field, not this composed object. Read at mount.
    get extraSolids(){return skateDressingSolids(park);},
    contact(x,z,feet,radius,travel){
      // A zero vector is an occupancy check, not permission to ignore every wall.
      return geography.contact(x+O.x,z+O.z,feet+O.y,radius,travel[0]||travel[1]?travel:undefined,false,1.08);
    },
    submerged:(x,z,feet)=>geography.submerged(x+O.x,z+O.z,feet+O.y),
  };
  /** Why the board cannot go down at (hx, hz) on feet at hy (Horizon space), or null where it can: any dry, open, walkable floor. */
  function startRefusal(hx:number,hz:number,hy?:number):SkateStartRefusal|null {
    const at=sample(hx-O.x,hz-O.z,hy===undefined?undefined:hy-O.y);
    if(at.supported===false||hy!==undefined&&Math.abs(at.y+O.y-hy)>.5)return 'unsupported';
    // The Horizon's one walkable limit (MANIFEST profiles.walkable, 40°): where the walker stands, the board can go down.
    if(at.ny<Math.cos(WALKABLE_DEGREES*Math.PI/180)-1e-9)return 'steep';
    if(geography.submerged(hx,hz,at.y+O.y))return 'water';
    return geography.contact(hx,hz,at.y+O.y,.3)?'blocked':null;
  }
  const canStart=(hx:number,hz:number,hy?:number)=>startRefusal(hx,hz,hy)===null;
  return {field,physics,canStart,startRefusal};
}
