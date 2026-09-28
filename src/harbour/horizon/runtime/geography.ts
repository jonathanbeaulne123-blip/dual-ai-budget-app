import {waterHeightAt} from '../land/water/index.ts';
import type {BedCut, LandCuts, StructureSolid, TerrainField, XYZ} from '../land/interfaces.ts';
import {sampleTerrain, terrainNormal, terrainTriangleVisible, WALKABLE_DEGREES} from '../land/terrain/index.ts';

/** Keep the existing body contract: steeper faces are rock, never climbable. The one number
 * is MANIFEST `profiles.walkable.slope_max_deg`, read once in land/terrain (bake and paint share it). */
export const HORIZON_WALKABLE_DEGREES = WALKABLE_DEGREES;
export const HORIZON_BODY_HEIGHT = 1.25;
export const HORIZON_STEP_HEIGHT = .48;
/** One gravity for the walker, the ground kernel and the wings (RIDE D40). */
export const HORIZON_G = 12;
type MutableXYZ=[number,number,number];
type Triangle = {a:MutableXYZ;b:MutableXYZ;c:MutableXYZ;normal:MutableXYZ;solid:StructureSolid};
export type HorizonSurface = {id:string;y:number;nx:number;ny:number;nz:number;material:string;slope:number};
export interface DynamicGeography {
 surface(x:number,z:number,y?:number,step?:number):HorizonSurface|null;
 ceiling(x:number,z:number,y:number):number;
 contact(x:number,z:number,y:number,radius?:number):{id:string;nx:number;nz:number}|null;
 /** Pass 5 (a placed region): the provider OWNS the ground at (x, z) — the baked terrain is then no candidate for `surface`,
  * and `ground` / the camera's terrain test read the provider's `ground` instead. Static solids still count. */
 owns?(x:number,z:number):boolean;
 ground?(x:number,z:number):number;
}
const CELL=24;
const key=(x:number,z:number)=>`${Math.floor(x/CELL)}:${Math.floor(z/CELL)}`;
function projection(t:Triangle,x:number,z:number):number|null {
  const {a,b,c}=t,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(det)<1e-8)return null;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
  return u>=-1e-6&&v>=-1e-6&&u+v<=1.000001?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;
}
/** Scratch intersection coordinates stay within a query; no per-face arrays. */
function touchesAtHeight(t:Triangle,y:number,x:number,z:number,radius:number):boolean {
  let count=0,ax=0,az=0,bx=0,bz=0;
  for(let i=0;i<3;i++){
    const a=i===0?t.a:i===1?t.b:t.c,b=i===0?t.b:i===1?t.c:t.a;
    if((y-a[1])*(y-b[1])>0||Math.abs(b[1]-a[1])<1e-8)continue;
    const f=(y-a[1])/(b[1]-a[1]),px=a[0]+f*(b[0]-a[0]),pz=a[2]+f*(b[2]-a[2]);
    if(count++===0){ax=px;az=pz;}else{bx=px;bz=pz;break;}
  }
  if(count<2)return false;
  const dx=bx-ax,dz=bz-az,d=dx*dx+dz*dz,f=d?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/d)):0;
  return Math.hypot(x-ax-f*dx,z-az-f*dz)<radius;
}
export function createHorizonGeography(field:TerrainField,cuts:LandCuts){
  // Keep one compact reference per indexed face, not four duplicate JS arrays per face.
  // Rendering and collision still read the exact same serialized vertices and indices.
  // R1-72: the index is built per district chunk as it arrives (`addSolids`), never for the whole island at once;
  // the typed arrays grow by doubling.
  const dynamic=new Set<DynamicGeography>();
  const solids:StructureSolid[]=[],cells=new Map<string,number[]>();
  let owners=new Uint32Array(1024),offsets=new Uint32Array(1024),normals=new Float32Array(1024*3),count=0,chunks=0;
  function grow(need:number){if(need<=owners.length)return;let size=owners.length;while(size<need)size*=2;const o=new Uint32Array(size),f=new Uint32Array(size),n=new Float32Array(size*3);o.set(owners);f.set(offsets);n.set(normals);owners=o;offsets=f;normals=n;}
  function addSolids(list:readonly StructureSolid[]){
    const kept=list.filter(s=>s.role!=='marker');if(!kept.length)return;chunks++;
    grow(count+kept.reduce((n,s)=>n+s.indices.length/3,0));
    for(const solid of kept){
      const owner=solids.push(solid)-1,p=solid.positions;
      for(let i=0;i<solid.indices.length;i+=3){
        const vertex=(n:number):XYZ=>{const j=solid.indices[i+n]!*3;return[p[j]!,p[j+1]!,p[j+2]!];};
        const a=vertex(0),b=vertex(1),c=vertex(2),u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
        const nx=u[1]!*v[2]!-u[2]!*v[1]!,ny=u[2]!*v[0]!-u[0]!*v[2]!,nz=u[0]!*v[1]!-u[1]!*v[0]!,len=Math.hypot(nx,ny,nz);
        if(len<1e-8)continue;
        const id=count++;owners[id]=owner;offsets[id]=i;normals.set([nx/len,ny/len,nz/len],id*3);
        for(let x=Math.floor(Math.min(a[0],b[0],c[0])/CELL);x<=Math.floor(Math.max(a[0],b[0],c[0])/CELL);x++)
          for(let z=Math.floor(Math.min(a[2],b[2],c[2])/CELL);z<=Math.floor(Math.max(a[2],b[2],c[2])/CELL);z++){
            const k=`${x}:${z}`,bucket=cells.get(k)??[];bucket.push(id);cells.set(k,bucket);
          }
      }
    }
  }
  addSolids(cuts.solids);
  const nearby=(x:number,z:number)=>cells.get(key(x,z))??[];
  // Query-local scratch is never returned. Dynamic providers are called outside
  // static face loops, so a provider can query this geography without corrupting it.
  const face:Triangle={a:[0,0,0],b:[0,0,0],c:[0,0,0],normal:[0,0,0],solid:solids[0]!};
  function triangle(id:number):Triangle{
    const solid=solids[owners[id]!]!,offset=offsets[id]!,p=solid.positions;
    for(let n=0;n<3;n++){const j=solid.indices[offset+n]!*3,v=n===0?face.a:n===1?face.b:face.c;v[0]=p[j]!;v[1]=p[j+1]!;v[2]=p[j+2]!;face.normal[n]=normals[id*3+n]!;}
    face.solid=solid;return face;
  }
  const contactFaces=new Set<number>();
  /** The dynamic provider that owns the ground here (a placed region), if any. */
  function owner(x:number,z:number):DynamicGeography|null{for(const d of dynamic)if(d.owns?.(x,z))return d;return null;}
  /** Terrain height: the owning provider's ground, else the baked field. */
  function groundAt(x:number,z:number):number{const o=owner(x,z);return o?.ground?o.ground(x,z):sampleTerrain(field,x,z);}
  function surface(x:number,z:number,y?:number,step=.48,staticOnly=false):HorizonSurface|null {
    if(x<0||z<0||x>field.width||z>field.depth)return null;
    let best:HorizonSurface|null=null;
    if(staticOnly||!owner(x,z)){
      const g=sampleTerrain(field,x,z),normal=terrainNormal(field,x,z);
      const n=Array.isArray(normal)?normal:[0,1,0];
      best=terrainTriangleVisible(x,z,cuts)&&(y===undefined||g<=y+step)?{id:'terrain',y:g,nx:n[0]!,ny:n[1]!,nz:n[2]!,material:'grass',slope:Math.acos(Math.min(1,n[1]!))*180/Math.PI}:null;
    }
    for(const id of nearby(x,z)){
      if(normals[id*3+1]!<=.001||!solids[owners[id]!]!.walkable)continue;const t=triangle(id);
      const h=projection(t,x,z);if(h===null||(y!==undefined&&h>y+step)||(best&&h<best.y))continue;
      best={id:t.solid.id,y:h,nx:t.normal[0],ny:t.normal[1],nz:t.normal[2],material:t.solid.surface,slope:Math.acos(Math.min(1,t.normal[1]))*180/Math.PI};
    }
    if(!staticOnly)for(const d of dynamic){const h=d.surface(x,z,y,step);if(h&&(!best||h.y>best.y))best=h;}
    return best;
  }
  function ceiling(x:number,z:number,y:number,staticOnly=false){
    let value=Infinity;
    for(const id of nearby(x,z)){if(normals[id*3+1]!>=-.001)continue;const t=triangle(id);const h=projection(t,x,z);if(h!==null&&h>y+.1)value=Math.min(value,h);}
    if(!staticOnly)for(const d of dynamic)value=Math.min(value,d.ceiling(x,z,y));
    return value;
  }
  function contact(x:number,z:number,y:number,radius=.3,travel?:readonly [number,number],ignoreDynamic=false):{id:string;nx:number;nz:number}|null{
    if(x<radius||z<radius||x>field.width-radius||z>field.depth-radius){const nx=x<radius?1:x>field.width-radius?-1:0,nz=z<radius?1:z>field.depth-radius?-1:0,n=Math.hypot(nx,nz);return {id:'world-boundary',nx:nx/n,nz:nz/n};}
    if(!ignoreDynamic)for(const d of dynamic){const h=d.contact(x,z,y,radius);if(h)return h;}
    const all=contactFaces;all.clear();
    for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++)for(const t of nearby(x+ix*radius,z+iz*radius))all.add(t);
    for(const id of all){if(Math.abs(normals[id*3+1]!)>.95)continue;const t=triangle(id);
      // A body already overlapping a lip can leave it; only an approaching side blocks motion.
      if(travel&&t.normal[0]*travel[0]+t.normal[2]*travel[1]>=-1e-8)continue;
      if(Math.max(t.a[1],t.b[1],t.c[1])<=y+HORIZON_STEP_HEIGHT||Math.min(t.a[1],t.b[1],t.c[1])>y+HORIZON_BODY_HEIGHT)continue;
      for(let level=0;level<3;level++){const h=y+(level===0?.2:level===1?.65:HORIZON_BODY_HEIGHT);if(touchesAtHeight(t,h,x,z,radius)){const length=Math.hypot(t.normal[0],t.normal[2]);return {id:t.solid.id,nx:t.normal[0]/length,nz:t.normal[2]/length};}}
    }
    for(const id of nearby(x,z)){if(normals[id*3+1]!>=-.001)continue;const t=triangle(id);const h=projection(t,x,z);if(h!==null&&h>y+.1&&h<y+HORIZON_BODY_HEIGHT)return {id:t.solid.id,nx:0,nz:0};}
    return null;
  }
  const blocker=(x:number,z:number,y:number,radius=.3,travel?:readonly [number,number],ignoreDynamic=false)=>contact(x,z,y,radius,travel,ignoreDynamic)?.id??null;
  const blocked=(x:number,z:number,y:number,radius=.3)=>blocker(x,z,y,radius)!==null;
  /** Hulls query exposed water. A pedestrian supplies feet height so the Deep is
   * wet without treating a lake in an overhead room as water on a dry floor. */
  function waterLevel(x:number,z:number,feet?:number):number|null {
    let level:number|null=null,underground=false;
    for(const w of cuts.waters){
      if(w.kind==='dry')continue;
      const h=waterHeightAt(w,x,z);if(h===null)continue;
      if(w.underground){underground=true;if(feet===undefined||feet>h+1)continue;}
      if(feet!==undefined&&h-feet>w.depth+HORIZON_BODY_HEIGHT)continue;
      // Stacked pools may have overlapping depth ranges: feet select the nearest
      // eligible surface, while a hull still selects the highest exposed water.
      if(level===null||(feet===undefined?h>level:Math.abs(h-feet)<Math.abs(level-feet)||Math.abs(h-feet)===Math.abs(level-feet)&&h>level))level=h;
    }
    return level??(sampleTerrain(field,x,z)<-.2&&(feet===undefined||!underground)?0:null);
  }
  function submerged(x:number,z:number,feet:number){
    // Visible water owns the walking boundary, including high-altitude lakes and underground water.
    // An overhead water surface in a separate room must not block its dry floor.
    return cuts.waters.some(w=>{
      if(w.kind==='dry'||w.underground&&feet>w.level+1)return false;
      const level=waterHeightAt(w,x,z);
      return level!==null&&level-feet>.35&&level-feet<=w.depth+HORIZON_BODY_HEIGHT;
    })||(feet<-.65&&!cuts.waters.some(w=>w.underground&&waterHeightAt(w,x,z)!==null));
  }
  function cameraBlocked(from:XYZ,to:XYZ,ignoreDynamic=false){
    const length=Math.hypot(to[0]-from[0],to[1]-from[1],to[2]-from[2]),steps=Math.ceil(length/.75);
    for(let i=1;i<=steps;i++){
      const f=i/steps,x=from[0]+(to[0]-from[0])*f,y=from[1]+(to[1]-from[1])*f,z=from[2]+(to[2]-from[2])*f;
      // From an underground origin the cave's explicit walls/roof own obstruction.
      if(from[1]>=groundAt(from[0],from[2])-.3&&groundAt(x,z)>y-.15)return true;
      if(blocker(x,z,y-.3,.18,undefined,ignoreDynamic))return true;
    }
    return false;
  }
  const staticOnly={surface:(x:number,z:number,y?:number,step?:number)=>surface(x,z,y,step,true),ceiling:(x:number,z:number,y:number)=>ceiling(x,z,y,true),blocked:(x:number,z:number,y:number,radius=.3)=>blocker(x,z,y,radius,undefined,true)!==null};
  return {staticOnly,addDynamic(provider:DynamicGeography){dynamic.add(provider);return()=>dynamic.delete(provider);},surface,ceiling,blocked,blocker,contact,waterLevel,submerged,cameraBlocked,get indexStats(){return{triangles:count,referenceBytes:(owners.byteLength+offsets.byteLength+normals.byteLength)*count/Math.max(1,owners.length),cells:cells.size,chunks};},addSolids,ground:groundAt};
}
export function nearestBedPoint(beds:readonly BedCut[],x:number,z:number):XYZ {
  let best:XYZ=[x,0,z],distance=Infinity;
  for(const bed of beds){if(['cave','rail','cable'].includes(bed.kind))continue;
    for(let i=1;i<bed.points.length;i++){const a=bed.points[i-1]!,b=bed.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz,f=d?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/d)):0;
      const p:XYZ=[a[0]+dx*f,a[1]+(b[1]-a[1])*f,a[2]+dz*f],n=Math.hypot(p[0]-x,p[2]-z);if(n<distance){best=p;distance=n;}}
  }return best;
}
