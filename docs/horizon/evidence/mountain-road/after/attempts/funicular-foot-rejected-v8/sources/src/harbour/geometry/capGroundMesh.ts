/** Lower-only portable terrain cap. Supplied physical deck triangles are the
 * authority. Every terrain/deck overlap is a convex polygon; their height
 * difference is linear, so its maximum occurs at an intersection vertex. */
export type CapPoint=readonly[number,number,number];
export type CapTriangle=readonly[CapPoint,CapPoint,CapPoint];
type Face={p:CapPoint;q:CapPoint;r:CapPoint;det:number;gx:number;gz:number};
export function capGroundMesh(lattice:{positions:Float32Array;indices:Uint32Array},triangles:readonly CapTriangle[],clearance:number){
 const size=2,cells=new Map<string,Face[]>();
 for(const[p,q,r]of triangles){const ux=q[0]-p[0],uz=q[2]-p[2],vx=r[0]-p[0],vz=r[2]-p[2],det=ux*vz-uz*vx;if(Math.abs(det)<1e-12)continue;
  const f={p,q,r,det,gx:((q[1]-p[1])*vz-(r[1]-p[1])*uz)/det,gz:(ux*(r[1]-p[1])-vx*(q[1]-p[1]))/det};
  for(let x=Math.floor(Math.min(p[0],q[0],r[0])/size);x<=Math.floor(Math.max(p[0],q[0],r[0])/size);x++)for(let z=Math.floor(Math.min(p[2],q[2],r[2])/size);z<=Math.floor(Math.max(p[2],q[2],r[2])/size);z++){const key=`${x}:${z}`,a=cells.get(key)??[];a.push(f);cells.set(key,a);}
 }
 const P=lattice.positions,I=lattice.indices,original=P.slice(),affected=new Set<number>(),point=(i:number):CapPoint=>[P[i*3]!,P[i*3+1]!,P[i*3+2]!];
 const clip=(poly:CapPoint[],a:CapPoint,b:CapPoint,sign:number)=>{const out:CapPoint[]=[];for(let i=0;i<poly.length;i++){
  const p=poly[i]!,q=poly[(i+1)%poly.length]!,cross=(v:CapPoint)=>sign*((b[0]-a[0])*(v[2]-a[2])-(b[2]-a[2])*(v[0]-a[0])),u=cross(p),v=cross(q);
  if(u>=-1e-10)out.push(p);if((u>=0)!==(v>=0)){const t=u/(u-v);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t]);}
 }return out;};
 for(let i=0;i<I.length;i+=3){const ids=[I[i]!,I[i+1]!,I[i+2]!],initial=ids.map(point),near=new Set<Face>();
  for(let x=Math.floor(Math.min(...initial.map(p=>p[0]))/size);x<=Math.floor(Math.max(...initial.map(p=>p[0]))/size);x++)for(let z=Math.floor(Math.min(...initial.map(p=>p[2]))/size);z<=Math.floor(Math.max(...initial.map(p=>p[2]))/size);z++)for(const f of cells.get(`${x}:${z}`)??[])near.add(f);
  for(const f of near){let poly=ids.map(point);for(const[a,b]of[[f.p,f.q],[f.q,f.r],[f.r,f.p]]){poly=clip(poly,a!,b!,Math.sign(f.det));if(!poly.length)break;}
   let excess=0;for(const p of poly)excess=Math.max(excess,p[1]-(f.p[1]+f.gx*(p[0]-f.p[0])+f.gz*(p[2]-f.p[2])-clearance));
   // Native-space heights use Float32. Padding exceeds their ULP without
   // changing the deck, support tolerances, or visible cap clearance.
   if(excess>0)for(const id of ids){P[id*3+1]=P[id*3+1]!-excess-1e-5;affected.add(id);}
  }
 }
 return [...affected].map(i=>({index:i,at:point(i),delta:P[i*3+1]!-original[i*3+1]!}));
}
