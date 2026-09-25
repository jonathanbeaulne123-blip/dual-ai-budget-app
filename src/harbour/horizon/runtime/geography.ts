import type {BedCut, LandCuts, StructureSolid, TerrainField, XYZ} from '../land/interfaces.ts';
import {sampleTerrain, terrainNormal, terrainTriangleVisible} from '../land/terrain/index.ts';

/** Keep the existing body contract: steeper faces are rock, never climbable. */
export const HORIZON_WALKABLE_DEGREES = 40;
export const HORIZON_BODY_HEIGHT = 1.25;
type Triangle = {a:XYZ;b:XYZ;c:XYZ;normal:XYZ;solid:StructureSolid};
export type HorizonSurface = {id:string;y:number;nx:number;ny:number;nz:number;material:string;slope:number};
const CELL=24;
const key=(x:number,z:number)=>`${Math.floor(x/CELL)}:${Math.floor(z/CELL)}`;
function projection(t:Triangle,x:number,z:number):number|null {
  const {a,b,c}=t,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(det)<1e-8)return null;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
  return u>=-1e-6&&v>=-1e-6&&u+v<=1.000001?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;
}
function distanceSegment(x:number,z:number,a:XYZ,b:XYZ){
  const dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz,t=d?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/d)):0;
  return Math.hypot(x-a[0]-t*dx,z-a[2]-t*dz);
}
function atHeight(t:Triangle,y:number):XYZ[]{
  const result:XYZ[]=[];
  for(const [a,b] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]] as const){
    if((y-a[1])*(y-b[1])>0||Math.abs(b[1]-a[1])<1e-8)continue;
    const f=(y-a[1])/(b[1]-a[1]);result.push([a[0]+f*(b[0]-a[0]),y,a[2]+f*(b[2]-a[2])]);
  }
  return result;
}
export function createHorizonGeography(field:TerrainField,cuts:LandCuts){
  const cells=new Map<string,Triangle[]>();
  for(const solid of cuts.solids){
    if(solid.role==='marker')continue;
    const p=solid.positions;
    for(let i=0;i<solid.indices.length;i+=3){
      const vertex=(n:number):XYZ=>{const j=solid.indices[i+n]!*3;return[p[j]!,p[j+1]!,p[j+2]!];};
      const a=vertex(0),b=vertex(1),c=vertex(2),u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      const nx=u[1]!*v[2]!-u[2]!*v[1]!,ny=u[2]!*v[0]!-u[0]!*v[2]!,nz=u[0]!*v[1]!-u[1]!*v[0]!,len=Math.hypot(nx,ny,nz);
      if(len<1e-8)continue;
      const t:Triangle={a,b,c,normal:[nx/len,ny/len,nz/len],solid};
      for(let x=Math.floor(Math.min(a[0],b[0],c[0])/CELL);x<=Math.floor(Math.max(a[0],b[0],c[0])/CELL);x++)
        for(let z=Math.floor(Math.min(a[2],b[2],c[2])/CELL);z<=Math.floor(Math.max(a[2],b[2],c[2])/CELL);z++){
          const k=`${x}:${z}`,bucket=cells.get(k)??[];bucket.push(t);cells.set(k,bucket);
        }
    }
  }
  const nearby=(x:number,z:number)=>cells.get(key(x,z))??[];
  function surface(x:number,z:number,y?:number,step=.48):HorizonSurface|null {
    if(x<0||z<0||x>field.width||z>field.depth)return null;
    const g=sampleTerrain(field,x,z),normal=terrainNormal(field,x,z);
    const n=Array.isArray(normal)?normal:[0,1,0];
    let best:HorizonSurface|null=terrainTriangleVisible(x,z,cuts)&&(y===undefined||g<=y+step)?{id:'terrain',y:g,nx:n[0]!,ny:n[1]!,nz:n[2]!,material:'grass',slope:Math.acos(Math.min(1,n[1]!))*180/Math.PI}:null;
    for(const t of nearby(x,z)){
      if(t.normal[1]<=.001||!t.solid.walkable)continue;
      const h=projection(t,x,z);if(h===null||(y!==undefined&&h>y+step)||(best&&h<best.y))continue;
      best={id:t.solid.id,y:h,nx:t.normal[0],ny:t.normal[1],nz:t.normal[2],material:t.solid.surface,slope:Math.acos(t.normal[1])*180/Math.PI};
    }
    return best;
  }
  function ceiling(x:number,z:number,y:number){
    let value=Infinity;
    for(const t of nearby(x,z)){if(t.normal[1]>=-.001)continue;const h=projection(t,x,z);if(h!==null&&h>y+.1)value=Math.min(value,h);}
    return value;
  }
  function blocked(x:number,z:number,y:number,radius=.3){
    if(x<radius||z<radius||x>field.width-radius||z>field.depth-radius)return true;
    const all=new Set<Triangle>();
    for(const dx of [-radius,0,radius])for(const dz of [-radius,0,radius])for(const t of nearby(x+dx,z+dz))all.add(t);
    for(const t of all){
      if(Math.abs(t.normal[1])>.95)continue;
      if(Math.max(t.a[1],t.b[1],t.c[1])<y+.15||Math.min(t.a[1],t.b[1],t.c[1])>y+HORIZON_BODY_HEIGHT)continue;
      for(const h of [y+.2,y+.65,y+HORIZON_BODY_HEIGHT]){const span=atHeight(t,h);if(span.length>=2&&distanceSegment(x,z,span[0]!,span[1]!)<radius)return true;}
    }
    return ceiling(x,z,y)<y+HORIZON_BODY_HEIGHT;
  }
  function cameraBlocked(from:XYZ,to:XYZ){
    const length=Math.hypot(to[0]-from[0],to[1]-from[1],to[2]-from[2]),steps=Math.ceil(length/.75);
    for(let i=1;i<=steps;i++){
      const f=i/steps,x=from[0]+(to[0]-from[0])*f,y=from[1]+(to[1]-from[1])*f,z=from[2]+(to[2]-from[2])*f;
      // From an underground origin the cave's explicit walls/roof own obstruction.
      if(from[1]>=sampleTerrain(field,from[0],from[2])-.3&&sampleTerrain(field,x,z)>y-.15)return true;
      if(blocked(x,z,y-.3,.18))return true;
    }
    return false;
  }
  return {surface,ceiling,blocked,cameraBlocked,ground:(x:number,z:number)=>sampleTerrain(field,x,z)};
}
export function nearestBedPoint(beds:readonly BedCut[],x:number,z:number):XYZ {
  let best:XYZ=[x,0,z],distance=Infinity;
  for(const bed of beds){if(['cave','rail','cable'].includes(bed.kind))continue;
    for(let i=1;i<bed.points.length;i++){const a=bed.points[i-1]!,b=bed.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz,f=d?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/d)):0;
      const p:XYZ=[a[0]+dx*f,a[1]+(b[1]-a[1])*f,a[2]+dz*f],n=Math.hypot(p[0]-x,p[2]-z);if(n<distance){best=p;distance=n;}}
  }return best;
}
