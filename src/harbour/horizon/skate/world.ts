/** The native skate's authored park over the surfaces the Horizon actually draws. */
import type {SurfaceKind, SurfaceSample} from '../../skate/contract.ts';
import type {SkateDriverWorld} from '../../skate/driver.ts';
import {skateDressingSolids} from '../../skate/world/dressingSolids.ts';
import type {SkateWorldField} from '../../skate/world/field.ts';
import type {createHorizonGeography} from '../runtime/geography.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../regions/mountainV2/placement.ts';

export type HorizonSkateGeography=Pick<ReturnType<typeof createHorizonGeography>,'surface'|'ground'|'ceiling'|'contact'|'submerged'|'blocked'>;
const kindOf=(material:string):SurfaceKind=>material==='boardwalk'||material==='wood'?'wood':material==='metal'?'metal':material==='grass'?'grass':material==='sand'?'sand':material==='stone'||material==='cobble'?'cobble':material==='concrete'?'concrete':'path';

export function createHorizonSkateWorld(geography:HorizonSkateGeography,park:SkateWorldField){
  function sample(x:number,z:number,y?:number):SurfaceSample {
    const surface=geography.surface(x+O.x,z+O.z,y===undefined?undefined:y+O.y,.48);
    const authored=park.samplePark(x,z);
    // Only authored park geometry competes here. Native terrain and omitted native decks never do.
    if(authored&&(y===undefined||authored.y<=y+.48)&&(!surface||authored.y+O.y>=surface.y-1e-6))return authored;
    if(surface)return {y:surface.y-O.y,nx:surface.nx,ny:surface.ny,nz:surface.nz,kind:kindOf(surface.material),feature:surface.id,lip:null};
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
  function canStart(hx:number,hz:number,hy?:number):boolean {
    const at=sample(hx-O.x,hz-O.z,hy===undefined?undefined:hy-O.y);
    if(at.supported===false||at.ny<Math.cos(40*Math.PI/180)||hy!==undefined&&Math.abs(at.y+O.y-hy)>.5)return false;
    return !geography.submerged(hx,hz,at.y+O.y)&&!geography.contact(hx,hz,at.y+O.y,.3);
  }
  return {field,physics,canStart};
}
