/** One explicit Horizon walking replacement owns this ground cut. Native ground
 * functions/data remain unchanged. Both render tiers use the actual apron top. */
import type {StructureSolid} from '../../land/interfaces.ts';
import {capGroundMesh,type CapPoint,type CapTriangle} from '../../../geometry/capGroundMesh.ts';
import {MOUNTAIN_V2_OFFSET as O} from './placement.ts';
export function walkingJoinGround(solids:readonly StructureSolid[]=[]){
 const triangles:CapTriangle[]=[],edgeCounts=new Map<string,{a:CapPoint;b:CapPoint;count:number}>();
 for(const s of solids){if((s.sourceId??s.id.split('@')[0])!=='mountainV2.funicularFoot.apron')continue;
  for(let k=0;k<s.indices.length;k+=3){const ids=s.indices.slice(k,k+3),p=ids.map(i=>[s.positions[i*3]!-O.x,s.positions[i*3+1]!-O.y,s.positions[i*3+2]!-O.z] as CapPoint) as [CapPoint,CapPoint,CapPoint];
   const[a,b,c]=p,ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(ny<=1e-9)continue;triangles.push(p);
   for(let i=0;i<3;i++){const a=p[i]!,b=p[(i+1)%3]!,A=a.join(','),B=b.join(','),key=A<B?`${A}:${B}`:`${B}:${A}`,old=edgeCounts.get(key);if(old)old.count++;else edgeCounts.set(key,{a,b,count:1});}
  }
 }
 if(!triangles.length)return null;const boundary=[...edgeCounts.values()].filter(e=>e.count===1),clearance=.02;
 const bounds={x0:Math.min(...triangles.flatMap(t=>t.map(p=>p[0])))-1.5,x1:Math.max(...triangles.flatMap(t=>t.map(p=>p[0])))+1.5,z0:Math.min(...triangles.flatMap(t=>t.map(p=>p[2])))-1.5,z1:Math.max(...triangles.flatMap(t=>t.map(p=>p[2])))+1.5};
 // Preserve source order and the existing barycentric predicate. The padded
 // plan bounds include its 1e-8 barycentric fringe, even for a skinny triangle;
 // this index only excludes triangles which cannot satisfy that predicate.
 const cell=1,cells=new Map<string,CapTriangle[]>();
 for(const t of triangles){
  const xs=t.map(p=>p[0]),zs=t.map(p=>p[2]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
  const padX=(x1-x0)*4e-8+1e-9,padZ=(z1-z0)*4e-8+1e-9;
  for(let x=Math.floor((x0-padX)/cell);x<=Math.floor((x1+padX)/cell);x++)for(let z=Math.floor((z0-padZ)/cell);z<=Math.floor((z1+padZ)/cell);z++){
   const key=`${x}:${z}`,list=cells.get(key)??[];list.push(t);cells.set(key,list);
  }
 }
 // Boundary cones keep their full original definition. A local seed gives a
 // finite upper bound, and min endpoint Y bounds every segment from below.
 // Only segments provably unable to improve that bound can be omitted.
 const edgeCells=new Map<string,number[]>(),edgeMinY=Math.min(...boundary.flatMap(e=>[e.a[1],e.b[1]]));
 const edgeGrid={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity};
 for(let i=0;i<boundary.length;i++){const{a,b}=boundary[i]!,x0=Math.floor(Math.min(a[0],b[0])-1e-9),x1=Math.floor(Math.max(a[0],b[0])+1e-9),z0=Math.floor(Math.min(a[2],b[2])-1e-9),z1=Math.floor(Math.max(a[2],b[2])+1e-9);
  edgeGrid.x0=Math.min(edgeGrid.x0,x0);edgeGrid.x1=Math.max(edgeGrid.x1,x1);edgeGrid.z0=Math.min(edgeGrid.z0,z0);edgeGrid.z1=Math.max(edgeGrid.z1,z1);
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=`${x}:${z}`,list=edgeCells.get(key)??[];list.push(i);edgeCells.set(key,list);}
 }
 const edgeCandidates=(x:number,z:number,radius:number):number[]=>{
  const found=new Set<number>();for(let cx=Math.max(edgeGrid.x0,Math.floor(x-radius-1e-9));cx<=Math.min(edgeGrid.x1,Math.floor(x+radius+1e-9));cx++)for(let cz=Math.max(edgeGrid.z0,Math.floor(z-radius-1e-9));cz<=Math.min(edgeGrid.z1,Math.floor(z+radius+1e-9));cz++)for(const i of edgeCells.get(`${cx}:${cz}`)??[])found.add(i);
  return[...found].sort((a,b)=>a-b);
 };
 const ceiling=(hx:number,hz:number):number|null=>{
  const x=hx-O.x,z=hz-O.z;if(x<bounds.x0||x>bounds.x1||z<bounds.z0||z>bounds.z1)return null;let top=-Infinity;
  for(const[a,b,c]of cells.get(`${Math.floor(x/cell)}:${Math.floor(z/cell)}`)??[]){const D=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(D)<1e-12)continue;
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/D,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/D;
   if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)top=Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  if(Number.isFinite(top))return top+O.y-clearance;
  // This local walking join needs a continuous outer shoulder ceiling.
  // Nearest-edge ownership switched edge heights across Voronoi seams and
  // made four previously gentle samples >40deg in v8. Minimise the complete
  // segment cone instead; the unrelated authored terrace2:1 stays unchanged.
  const grade=.7;
  const evaluate=(i:number)=>{const{a,b}=boundary[i]!;const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);if(length<1e-9)return null;
   const along=((x-a[0])*dx+(z-a[2])*dz)/length,away=Math.abs((x-a[0])*dz-(z-a[2])*dx)/length,slope=(b[1]-a[1])/length;
   const t=slope>=grade?0:slope<=-grade?1:Math.max(0,Math.min(1,(along-slope*away/Math.sqrt(grade*grade-slope*slope))/length));
   return {distance:Math.hypot(away,along-Math.max(0,Math.min(length,along))),y:a[1]+(b[1]-a[1])*t+grade*Math.hypot(away,along-length*t)};
  };
  let best=Infinity,distance=Infinity;
  const seeds=edgeCandidates(x,z,1.5);for(const i of seeds){const value=evaluate(i);if(value){best=Math.min(best,value.y);distance=Math.min(distance,value.distance);}}
  if(distance>1.5)return null;
  // Every cone is >= edgeMinY + grade * distance-to-segment. Outside
  // this radius it cannot beat best. Padding is conservative roundoff only;
  // the original arithmetic and source evaluation order remain unchanged.
  const radius=Math.max(0,(best-edgeMinY)/grade)+1e-8;
  const candidates=[...new Set([...seeds,...edgeCandidates(x,z,radius)])].sort((a,b)=>a-b);let y=Infinity;
  for(const i of candidates){const value=evaluate(i);if(value)y=Math.min(y,value.y);}
  return distance<=1.5?y+O.y-clearance:null;
 };
 return{ceiling,triangles,capLattice:(lattice:{positions:Float32Array;indices:Uint32Array})=>capGroundMesh(lattice,triangles,clearance)};
}
