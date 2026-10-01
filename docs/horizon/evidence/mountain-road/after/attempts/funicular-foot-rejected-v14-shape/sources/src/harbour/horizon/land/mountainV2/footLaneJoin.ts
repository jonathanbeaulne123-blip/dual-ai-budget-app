/** The existing Foot route is seven metres wide, but the carried S1 strip and
 * crossing Year Walk shoulders did not form a continuous surface across it.
 * This final Horizon-only join uses the emitted host triangles and real ground;
 * native Mountain vertices and route centreline metadata remain untouched. */
import type {HeightQuery,LandCuts,StructureSolid,XYZ} from '../interfaces';
import {mitredSlab,nearestOnPath,solid} from '../structures/mesh';
import {mountainJoinRoadTop} from './joins';
import V2 from './v2-data.json';
import {funicularFootStationTop,funicularFootStationSupportTop} from './funicularFootStation.ts';

const FOOT='mountainV2.footLane', STEP=1;
const vertex=(positions:readonly number[],i:number):XYZ=>[positions[i*3]!,positions[i*3+1]!,positions[i*3+2]!];
// The actual first road edge, including its authored transverse frames. A gentle
// visible approach starts before that oblique edge, rather than dropping abruptly
// wherever a lane vertex first happens to enter a native top triangle.
const roadEdges:[XYZ,XYZ][]=[];
const nativeFootTriangles:Triangle[]=[];
const roadRow=(s:typeof V2.road.samples[number]):XYZ[]=>[-s.hw,-s.hw+.55,-.45,.45,s.hw-.55,s.hw].map(w=>[s.at[0]!+s.normal[0]!*w,s.at[1]!,s.at[2]!+s.normal[2]!*w]);
let roadLength=0;
const edge=(s:typeof V2.road.samples[number],sign:number):XYZ=>[s.at[0]!+s.normal[0]!*s.hw*sign,s.at[1]!,s.at[2]!+s.normal[2]!*s.hw*sign];
roadEdges.push([edge(V2.road.samples[0]!,-1),edge(V2.road.samples[0]!,1)]);
for(let i=1;i<V2.road.samples.length&&roadLength<40;i++){
 const a=V2.road.samples[i-1]!,b=V2.road.samples[i]!;
 roadLength+=Math.hypot(b.at[0]!-a.at[0]!,b.at[2]!-a.at[2]!);
 for(const side of[-1,1])roadEdges.push([edge(a,side),edge(b,side)]);
 const A=roadRow(a),B=roadRow(b);for(let k=1;k<A.length;k++)nativeFootTriangles.push([A[k-1]!,B[k-1]!,B[k]!],[A[k-1]!,B[k]!,A[k]!]);
}
function nativeApproachTop(x:number,z:number):number{
 // Minimise y(t) + grade * planDistance(point, edge(t)) over every real edge.
 // The continuous segment minimum closes the oblique native end cap between
 // its vertices. A vertex-only cone can leave a proud triangle across that cap.
 // Every distance cone is 10%-Lipschitz, so their lower envelope has that bound.
 const grade=.1;let top=Infinity;
 for(const [a,b] of roadEdges){
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
  if(length<1e-9){top=Math.min(top,a[1]-.005+Math.hypot(x-a[0],z-a[2])*grade);continue;}
  const along=((x-a[0])*dx+(z-a[2])*dz)/length;
  const away=Math.abs((x-a[0])*dz-(z-a[2])*dx)/length,slope=(b[1]-a[1])/length;
  const t=slope>=grade?0:slope<=-grade?1:Math.max(0,Math.min(1,(along-slope*away/Math.sqrt(grade*grade-slope*slope))/length));
  top=Math.min(top,a[1]+(b[1]-a[1])*t-.005+Math.hypot(along-length*t,away)*grade);
 }
 return top;
}
type Triangle=readonly [XYZ,XYZ,XYZ];
function floorTriangles(solids:readonly StructureSolid[]):Triangle[]{
  const out:Triangle[]=[];
  for(const s of solids)for(let i=0;i<s.indices.length;i+=3){
    const [a,b,c]=[0,1,2].map(k=>vertex(s.positions,s.indices[i+k]!)) as [XYZ,XYZ,XYZ];
    const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(ny>1e-8)out.push([a,b,c]);
  }
  return out;
}
function floorAt(tris:readonly Triangle[],x:number,z:number,ceiling:number):number|null{
  let h=-Infinity;
  for(const [a,b,c] of tris){
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if(u< -1e-7||v< -1e-7||u+v>1+1e-7)continue;
    const y=u*a[1]+v*b[1]+(1-u-v)*c[1];if(y<=ceiling)h=Math.max(h,y);
  }
  return Number.isFinite(h)?h:null;
}
/** Clipping adjacent triangles independently gives mathematically identical
 * knots different last bits and can stop one edge halfway along its neighbour.
 * Reconcile only roundoff-equivalent knots, split those edges, then close the
 * real perimeter. No floor is sampled again and no floor height is adjusted. */
function sealFootJoin(mesh:StructureSolid,ground:HeightQuery,weldEpsilon=1e-9):void{
  type Knot=[number,number,number,number]; // x, top y, z, bottom y
  type Face=[number,number,number];
  const EPS=weldEpsilon,knots:Knot[]=[],buckets=new Map<string,number[]>(),faces:Face[]=[];
  const knot=(v:Knot):number=>{
    const bx=Math.floor(v[0]/EPS),bz=Math.floor(v[2]/EPS);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const i of buckets.get(`${bx+dx}:${bz+dz}`)??[]){
      if(knots[i]!.slice(0,3).every((c,j)=>Math.abs(c-v[j]!)<=EPS)){
        // Different source prisms may clamp their hidden bottoms differently.
        // One shared top edge must not retain an internal wall for that reason.
        knots[i]![3]=Math.min(knots[i]![3],v[3]);return i;
      }
    }
    const i=knots.length,key=`${bx}:${bz}`;knots.push(v);const bucket=buckets.get(key)??[];bucket.push(i);buckets.set(key,bucket);return i;
  };
  const area=(a:Knot,b:Knot,c:Knot)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
  for(let i=0;i<mesh.indices.length;i+=3){
    const ids=mesh.indices.slice(i,i+3),p=ids.map(j=>[mesh.positions[j*3]!,mesh.positions[j*3+1]!,mesh.positions[j*3+2]!,mesh.positions[(j+1)*3+1]!] as Knot);
    if(area(p[0]!,p[1]!,p[2]!)>=-1e-9)continue;
    const mapped=p.map(knot) as Face;if(new Set(mapped).size===3)faces.push(mapped);
  }
  const refined:Face[]=[],count=knots.length;
  for(const face of faces){
    const boundary:number[]=[];
    for(let k=0;k<3;k++){
      const a=face[k]!,b=face[(k+1)%3]!,A=knots[a]!,B=knots[b]!,dx=B[0]-A[0],dz=B[2]-A[2],length2=dx*dx+dz*dz;
      const split:{t:number;i:number}[]=[{t:0,i:a}];
      if(length2>EPS*EPS)for(let i=0;i<count;i++){
        if(i===a||i===b)continue;const v=knots[i]!;
        if(v[0]<Math.min(A[0],B[0])-EPS||v[0]>Math.max(A[0],B[0])+EPS||v[2]<Math.min(A[2],B[2])-EPS||v[2]>Math.max(A[2],B[2])+EPS)continue;
        const t=((v[0]-A[0])*dx+(v[2]-A[2])*dz)/length2;if(t<=1e-9||t>=1-1e-9)continue;
        if(v.slice(0,3).every((c,j)=>Math.abs(c-(A[j]!+t*(B[j]!-A[j]!)))<=EPS))split.push({t,i});
      }
      split.sort((a,b)=>a.t-b.t);boundary.push(...split.map(p=>p.i));
    }
    if(boundary.length===3)refined.push(face);
    else{
      // The existing triangle's barycentre preserves its exact top plane
      // and the shared buried bottom while retaining every new boundary knot (no degenerate fan).
      const centre=knots.length;knots.push([0,1,2,3].map(j=>face.reduce((sum,i)=>sum+knots[i]![j]!,0)/3) as Knot);
      for(let k=0;k<boundary.length;k++)refined.push([centre,boundary[k]!,boundary[(k+1)%boundary.length]!]);
    }
  }
  const top=refined.filter(f=>area(knots[f[0]]!,knots[f[1]]!,knots[f[2]]!)<-1e-9);
  // Two closed regions may meet at one geometric knot after subtraction. Give
  // each incident face fan its own coincident vertex pair, rather than joining
  // their vertical edges into a four-face nonmanifold edge.
  const incident=new Map<number,number[]>();
  for(let i=0;i<top.length;i++)for(const v of top[i]!){const list=incident.get(v)??[];list.push(i);incident.set(v,list);}
  for(const [v,list]of incident){
    const pending=new Set(list);let first=true;
    while(pending.size){
      const seed=pending.values().next().value as number,group:number[]=[],queue=[seed];pending.delete(seed);
      while(queue.length){const f=queue.pop()!;group.push(f);const neighbours=top[f]!.filter(i=>i!==v);
        for(const other of pending)if(top[other]!.some(i=>i!==v&&neighbours.includes(i))){pending.delete(other);queue.push(other);}
      }
      if(first){first=false;continue;}const copy=knots.length;knots.push([...knots[v]!] as Knot);
      for(const f of group)top[f]=top[f]!.map(i=>i===v?copy:i) as Face;
    }
  }
  const edges=new Map<string,{a:number;b:number;count:number}>();mesh.positions=[];mesh.indices=[];
  for(const p of knots)mesh.positions.push(p[0],p[1],p[2],p[0],Math.min(p[3],p[1]-.1,ground(p[0],p[2])-.1),p[2]);
  for(const f of top){const [a,b,c]=f.map(i=>i*2) as Face;mesh.indices.push(a,b,c,a+1,c+1,b+1);
    for(let k=0;k<3;k++){const a=f[k]!*2,b=f[(k+1)%3]!*2,key=a<b?`${a}:${b}`:`${b}:${a}`,old=edges.get(key);if(old)old.count++;else edges.set(key,{a,b,count:1});}
  }
  for(const{a,b,count}of edges.values()){
    if(count>2)throw new Error(`Nonmanifold Foot top edge: ${mesh.id}`);
    if(count===1)mesh.indices.push(a,a+1,b+1,a,b+1,b);
  }
}


/** A bounded interior retriangulation, with no vertex or perimeter movement.
 * Fixed station edges are constraints even when they lie inside the fill.
 * Every changed top has its paired bottom changed identically, so the closed
 * mesh and its minimum thickness survive the operation. Failure stays explicit. */
function fairFootJoinDiagonals(mesh:StructureSolid,protectedTop:readonly Triangle[]){
 type Face=[number,number,number];
 const point=(i:number)=>vertex(mesh.positions,i);
 const normal=(f:Face)=>{const [a,b,c]=f.map(point) as [XYZ,XYZ,XYZ],u=b.map((v,j)=>v-a[j]!),v=c.map((w,j)=>w-a[j]!);return[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!] as XYZ;};
 const grade=(f:Face)=>{const n=normal(f);return Math.atan2(Math.hypot(n[0],n[2]),n[1])*180/Math.PI;};
 const score=(f:Face)=>Math.max(grade(f)/40,1e-8/normal(f)[1]);
 const key=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
 const protectedEdges=new Map<string,{a:XYZ;b:XYZ;count:number}>();
 for(const tri of protectedTop)for(let i=0;i<3;i++){const a=tri[i]!,b=tri[(i+1)%3]!,A=a.join(','),B=b.join(','),k=A<B?`${A}:${B}`:`${B}:${A}`,old=protectedEdges.get(k);if(old)old.count++;else protectedEdges.set(k,{a,b,count:1});}
 const boundaries=[...protectedEdges.values()].filter(e=>e.count===1);
 const on=(p:XYZ,a:XYZ,b:XYZ)=>{const dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);if(l<1e-12)return false;const t=((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(l*l);return t>=-1e-6/l&&t<=1+1e-6/l&&Math.abs((p[0]-a[0])*dz-(p[2]-a[2])*dx)/l<=1e-6;};
 const locked=(a:number,b:number)=>boundaries.some(e=>on(point(a),e.a,e.b)&&on(point(b),e.a,e.b));
 const faces:{at:number;v:Face}[]=[];
 for(let at=0;at<mesh.indices.length;at+=3){const v=mesh.indices.slice(at,at+3) as Face;if(normal(v)[1]<=1e-9)continue;
  if(mesh.indices[at+3]!==v[0]+1||mesh.indices[at+4]!==v[2]+1||mesh.indices[at+5]!==v[1]+1)throw new Error('Walking top/bottom pair lost before fairing');faces.push({at,v});}
 const flips:{oldFaces:Face[];newFaces:Face[];oldDegrees:number;newDegrees:number;crossingHeightChange:number}[]=[];
 for(let pass=0;pass<100;pass++){
  const bad=faces.map((f,i)=>(grade(f.v)>40||normal(f.v)[1]<1e-8)?i:-1).filter(i=>i>=0);if(!bad.length)return{flips,maxDegrees:Math.max(...faces.map(f=>grade(f.v)))};
  const edges=new Map<string,number[]>();for(let i=0;i<faces.length;i++)for(let k=0;k<3;k++){const f=faces[i]!.v,K=key(f[k]!,f[(k+1)%3]!),list=edges.get(K)??[];list.push(i);edges.set(K,list);}
  let best:{gain:number;i:number;j:number;n1:Face;n2:Face;old:number;next:number;dy:number}|undefined;
  for(const i of bad){const f=faces[i]!.v;for(let k=0;k<3;k++){
   const a=f[k]!,b=f[(k+1)%3]!,inc=edges.get(key(a,b))!;if(inc.length!==2||locked(a,b))continue;
   const j=inc.find(v=>v!==i)!,g=faces[j]!.v,c=f.find(v=>v!==a&&v!==b)!,d=g.find(v=>v!==a&&v!==b)!;
   if(c===d||edges.has(key(c,d)))continue;
   const n1:Face=[c,d,b],n2:Face=[d,c,a];if(normal(n1)[1]<=1e-9||normal(n2)[1]<=1e-9)continue;
   const old=Math.max(grade(f),grade(g)),next=Math.max(grade(n1),grade(n2)),gain=Math.max(score(f),score(g))-Math.max(score(n1),score(n2));if(gain<=1e-8)continue;
   const [A,B,C,D]=[a,b,c,d].map(point) as [XYZ,XYZ,XYZ,XYZ],ux=B[0]-A[0],uz=B[2]-A[2],vx=D[0]-C[0],vz=D[2]-C[2],det=ux*vz-uz*vx;
   if(Math.abs(det)<1e-12)continue;const t=((C[0]-A[0])*vz-(C[2]-A[2])*vx)/det,u=((C[0]-A[0])*uz-(C[2]-A[2])*ux)/det;
   if(t<=0||t>=1||u<=0||u>=1)continue;
   const dy=C[1]+(D[1]-C[1])*u-A[1]-(B[1]-A[1])*t;
   if(!best||gain>best.gain)best={gain,i,j,n1,n2,old,next,dy};
  }}
  if(!best)throw new Error(`Walking constrained triangulation stuck: ${bad.length} steep faces, maximum ${Math.max(...bad.map(i=>grade(faces[i]!.v)))} degrees`);
  const {i,j,n1,n2,old,next,dy}=best;flips.push({oldFaces:[faces[i]!.v,faces[j]!.v],newFaces:[n1,n2],oldDegrees:old,newDegrees:next,crossingHeightChange:dy});
  for(const [index,v]of [[i,n1],[j,n2]] as const){const f=faces[index]!;f.v=v;mesh.indices.splice(f.at,6,...v,v[0]+1,v[2]+1,v[1]+1);}
 }
 throw new Error('Walking constrained triangulation exceeded 100 flips');
}

/** End Horizon's local join on the actual native floor boundary. Keeping a
 * second coarse triangle over that boundary can put its interior above native
 * even when all of its vertices were below the sampled native top. */
function clipFootJoinToNative(source:StructureSolid,ground:HeightQuery,hostTriangles:readonly Triangle[]=nativeFootTriangles,approach:(x:number,z:number)=>number=nativeApproachTop,clearance=.005,projectInserted=false,projectBoundaries:readonly Triangle[]=[],weldEpsilon=1e-9,higherHostTriangles:readonly Triangle[]=[]):void{
  type Vertex={x:number;y:number;z:number;bottom:number};
  const area=(p:readonly Vertex[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length]!;return s+a.x*b.z-b.x*a.z;},0);
  const faces=[...hostTriangles.map(t=>({t,higherOnly:false})),...higherHostTriangles.map(t=>({t,higherOnly:true}))].map(({t,higherOnly})=>({t,higherOnly,x0:Math.min(...t.map(p=>p[0])),x1:Math.max(...t.map(p=>p[0])),z0:Math.min(...t.map(p=>p[2])),z1:Math.max(...t.map(p=>p[2]))}));
  const out:StructureSolid={...source,positions:[],indices:[]},vertices=new Map<string,number>(),edges=new Map<string,{a:number;b:number;count:number}>();
  const vertex=(v:Vertex)=>{
    const bottom=Math.min(v.bottom,v.y-.1,ground(v.x,v.z)-.1),key=[v.x,v.y,v.z,bottom].join(',');let i=vertices.get(key);
    if(i===undefined){i=out.positions.length/3;vertices.set(key,i);out.positions.push(v.x,v.y,v.z,v.x,bottom,v.z);}return i;
  };
  const append=(p:Vertex[])=>{
    if(p.length<3||Math.abs(area(p))<1e-9)return;
    // Clipping also inserts knots on extended triangle lines. Those knots
    // must obey the same continuous approach envelope before triangulation;
    // interpolating the coarse pre-cut face can otherwise recreate a proud lip.
    for(const v of p)v.y=projectInserted?approach(v.x,v.z):Math.min(v.y,approach(v.x,v.z));
    const ids=p.map(vertex);
    for(let i=1;i<ids.length-1;i++){const a=ids[0]!,b=ids[i]!,c=ids[i+1]!;out.indices.push(a,b,c,a+1,c+1,b+1);}
    for(let i=0;i<ids.length;i++){const a=ids[i]!,b=ids[(i+1)%ids.length]!,key=a<b?`${a}:${b}`:`${b}:${a}`,old=edges.get(key);if(old)old.count++;else edges.set(key,{a,b,count:1});}
  };
  const subtract=(poly:Vertex[],tri:Triangle,higherOnly=false):Vertex[][]=>{
    const [a,b,c]=tri,det=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]),sign=Math.sign(det);
    if(Math.abs(det)<1e-10)return[poly];
    const insideTriangle=(v:Vertex)=>{
      const u=((v.x-a[0])*(c[2]-a[2])-(v.z-a[2])*(c[0]-a[0]))/det;
      const w=((b[0]-a[0])*(v.z-a[2])-(b[2]-a[2])*(v.x-a[0]))/det;
      return u>=-1e-8&&w>=-1e-8&&u+w<=1+1e-8? a[1]+u*(b[1]-a[1])+w*(c[1]-a[1]):null;
    };
    let left=poly;const outside:Vertex[][]=[];
    for(let edge=0;edge<3&&left.length>=3;edge++){
      const p=tri[edge]!,q=tri[(edge+1)%3]!,distance=(v:Vertex)=>sign*((q[0]-p[0])*(v.z-p[2])-(q[2]-p[2])*(v.x-p[0]));
      const kept:Vertex[]=[],removed:Vertex[]=[];
      for(let i=0;i<left.length;i++){
        const A=left[i]!,B=left[(i+1)%left.length]!,da=distance(A),db=distance(B),ia=da>=0,ib=db>=0;
        (ia?kept:removed).push(A);
        if(ia!==ib){const t=da/(da-db),v:Vertex={x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t,z:A.z+(B.z-A.z)*t,bottom:A.bottom+(B.bottom-A.bottom)*t};kept.push(v);removed.push(v);}
      }
      if(removed.length>=3)outside.push(removed);left=kept;
    }
    if(left.length<3||Math.abs(area(left))<1e-9)return[poly];
    if(higherOnly){
      // Retain the exact part of the overlap where this existing drawn host
      // lies below the proposed face. Remove only its higher planar portion.
      const plane=(v:Vertex)=>{const u=((v.x-a[0])*(c[2]-a[2])-(v.z-a[2])*(c[0]-a[0]))/det,w=((b[0]-a[0])*(v.z-a[2])-(b[2]-a[2])*(v.x-a[0]))/det;return a[1]+u*(b[1]-a[1])+w*(c[1]-a[1])-v.y;};
      const lower:Vertex[]=[];for(let i=0;i<left.length;i++){const A=left[i]!,B=left[(i+1)%left.length]!,da=plane(A),db=plane(B),ia=da<0,ib=db<0;if(ia)lower.push(A);if(ia!==ib){const t=da/(da-db);lower.push({x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t,z:A.z+(B.z-A.z)*t,bottom:A.bottom+(B.bottom-A.bottom)*t});}}
      if(lower.length>=3)outside.push(lower);
    }
    // Only true triangle-boundary vertices lower to the road. Intersections on
    // an extended clipping line outside the native triangle retain their height.
    for(const polygon of outside)for(const v of polygon){const y=insideTriangle(v);if(y!==null)v.y=Math.min(v.y,y-clearance);}
    return outside;
  };
  const projectionEdgeCounts=new Map<string,{a:XYZ;b:XYZ;count:number}>();
  for(const tri of projectBoundaries)for(let i=0;i<3;i++){
    const a=tri[i]!,b=tri[(i+1)%3]!,A=a.join(','),B=b.join(','),key=A<B?`${A}:${B}`:`${B}:${A}`,old=projectionEdgeCounts.get(key);
    if(old)old.count++;else projectionEdgeCounts.set(key,{a,b,count:1});
  }
  const projectionEdges=[...projectionEdgeCounts.values()].filter(e=>e.count===1);
  // Local fitted grids store top/bottom vertex pairs. Only upward faces become
  // the new top; rebuild their closed boundary after subtracting the road.
  for(let i=0;i<source.indices.length;i+=3){
    const ids=source.indices.slice(i,i+3),p=ids.map(j=>({x:source.positions[j*3]!,y:source.positions[j*3+1]!,z:source.positions[j*3+2]!,bottom:source.positions[(j+1)*3+1]!}));
    if(area(p)>=-1e-9)continue;
    let pieces=[p];const x0=Math.min(...p.map(v=>v.x)),x1=Math.max(...p.map(v=>v.x)),z0=Math.min(...p.map(v=>v.z)),z1=Math.max(...p.map(v=>v.z));
    for(const f of faces){if(f.x1<x0||f.x0>x1||f.z1<z0||f.z0>z1)continue;pieces=pieces.flatMap(poly=>subtract(poly,f.t,f.higherOnly));if(!pieces.length)break;}

    // The unchanged station picture is a fixed rectangular host, including its
    // 5cm plank fringe. Split crossing cells on that actual boundary before
    // projecting, so no face interpolates a slope across its flat top.
    // Only the perimeter of a flat host changes its ownership. Propagating
    // every fan diagonal across cells adds no physical boundary and multiplies
    // fragments; keep exact perimeter knots local to the cells they cross.
    for(const {a,b}of projectionEdges){
      const tx0=Math.min(a[0],b[0]),tx1=Math.max(a[0],b[0]),tz0=Math.min(a[2],b[2]),tz1=Math.max(a[2],b[2]);
      pieces=pieces.flatMap(poly=>{
        if(Math.max(...poly.map(v=>v.x))<tx0||Math.min(...poly.map(v=>v.x))>tx1||Math.max(...poly.map(v=>v.z))<tz0||Math.min(...poly.map(v=>v.z))>tz1)return[poly];
        const distance=(v:Vertex)=>(b[0]-a[0])*(v.z-a[2])-(b[2]-a[2])*(v.x-a[0]);
        const left:Vertex[]=[],right:Vertex[]=[];for(let j=0;j<poly.length;j++){
          const A=poly[j]!,B=poly[(j+1)%poly.length]!,da=distance(A),db=distance(B),ia=da>=0,ib=db>=0;(ia?left:right).push(A);
          if(ia!==ib){const t=da/(da-db),v:Vertex={x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t,z:A.z+(B.z-A.z)*t,bottom:A.bottom+(B.bottom-A.bottom)*t};left.push(v);right.push(v);}
        }return[left,right].filter(p=>p.length>=3&&Math.abs(area(p))>=1e-9);
      });
    }
    for(const poly of pieces)append(poly);
  }
  sealFootJoin(out,ground,weldEpsilon);
  source.positions=out.positions;source.indices=out.indices;
}

/** Dense closed quad using shared top/bottom vertices. Only perimeter faces are
 * emitted: internal vertical prism walls would waste geometry and contacts. */
function fittedQuad(out:StructureSolid,q:XYZ[],bottom:number[],top:(p:XYZ)=>number,ground:HeightQuery,step=STEP):void{
  const distance=(a:XYZ,b:XYZ)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
  const cols=Math.max(1,Math.ceil(Math.max(distance(q[0]!,q[1]!),distance(q[3]!,q[2]!))/step));
  const rows=Math.max(1,Math.ceil(Math.max(distance(q[0]!,q[3]!),distance(q[1]!,q[2]!))/step));
  const bilinear=(values:number[],u:number,v:number)=>(values[0]!*(1-u)+values[1]!*u)*(1-v)+(values[3]!*(1-u)+values[2]!*u)*v;
  const start=out.positions.length/3;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows,p:XYZ=[bilinear(q.map(p=>p[0]),u,v),bilinear(q.map(p=>p[1]),u,v),bilinear(q.map(p=>p[2]),u,v)],y=top(p);
    out.positions.push(p[0],y,p[2],p[0],Math.min(bilinear(bottom,u,v),y-.1,ground(p[0],p[2])-.1),p[2]);
  }
  const at=(i:number,j:number)=>start+2*(j*(cols+1)+i);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);
    out.indices.push(a,b,c,a,c,d,a+1,c+1,b+1,a+1,d+1,c+1);
  }
  const side=(a:number,b:number)=>out.indices.push(a,a+1,b+1,a,b+1,b);
  for(let i=0;i<cols;i++){side(at(i,0),at(i+1,0));side(at(i+1,rows),at(i,rows));}
  for(let j=0;j<rows;j++){side(at(0,j+1),at(0,j));side(at(cols,j),at(cols,j+1));}
}
export function fitFootLaneJoin(cuts:LandCuts,ground:HeightQuery):void{
  const lane=cuts.beds.find(b=>b.id===FOOT);if(!lane||cuts.solids.some(s=>s.id===`${FOOT}.apron`))return;
  // A fitted cell has two edges no longer than STEP. Keep its entire
  // possible diagonal outside the usable lane before feathering source beds;
  // otherwise an outside raised vertex tilts a top triangle across the road.
  const margin=lane.width/2+2*STEP+1,x0=Math.min(...lane.points.map(p=>p[0]))-margin,x1=Math.max(...lane.points.map(p=>p[0]))+margin,z0=Math.min(...lane.points.map(p=>p[2]))-2*STEP-1,z1=Math.max(...lane.points.map(p=>p[2]))+2*STEP+1;
  const near=(q:XYZ[])=>Math.max(...q.map(p=>p[0]))>=x0&&Math.min(...q.map(p=>p[0]))<=x1&&Math.max(...q.map(p=>p[2]))>=z0&&Math.min(...q.map(p=>p[2]))<=z1;
  // Read the final V03 entrance surface, including its real transverse grade.
  const hosts=floorTriangles(cuts.solids.filter(s=>s.walkable&&s.bedIds.includes('V03')&&s.id.includes('.corridor.deck'))).filter(t=>near([...t]));
  // Depart continuously from the actual V03 deck boundary, including its bank.
  // A per-point host hit/fallback jumps at the last host triangle. This lower
  // extension descends at at most 8% from every point on the real host edges.
  const hostApproach=(x:number,z:number):number=>{
    const grade=.08;let top=-Infinity;
    for(const tri of hosts)for(let k=0;k<3;k++){
      const a=tri[k]!,b=tri[(k+1)%3]!,dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
      if(length<1e-9){top=Math.max(top,a[1]-grade*Math.hypot(x-a[0],z-a[2]));continue;}
      const along=((x-a[0])*dx+(z-a[2])*dz)/length,away=Math.abs((x-a[0])*dz-(z-a[2])*dx)/length,slope=(b[1]-a[1])/length;
      const t=slope>=grade?1:slope<=-grade?0:Math.max(0,Math.min(1,(along+slope*away/Math.sqrt(grade*grade-slope*slope))/length));
      top=Math.max(top,a[1]+(b[1]-a[1])*t-grade*Math.hypot(along-length*t,away));
    }
    return top;
  };
  const height=(p:XYZ,apron=false):number=>{
    const n=nearestOnPath([p[0],p[2]],lane.points),a=lane.points[n.segment]!,b=lane.points[n.segment+1]!;
    const dx=b[0]-a[0],dz=b[2]-a[2],t=((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz);
    const longitudinal=t<0?n.segment===0?Math.max(0,Math.min(1,1+2*STEP+t*Math.hypot(dx,dz))):1:t>1&&n.segment===lane.points.length-2?Math.max(0,Math.min(1,1+2*STEP-(t-1)*Math.hypot(dx,dz))):1;
    const weight=apron?1:Math.min(1,Math.max(0,margin-n.distance))*longitudinal;
    // The final blend must also respect the continuous native edge envelope.
    // Otherwise a fading source vertex stays proud beside a clipped boundary,
    // producing a steep sliver even when every native overlap was removed.
    const approach=nativeApproachTop(p[0],p[2]);
    if(!weight)return Math.min(p[1],approach);
    let y=Math.min(Math.max(floorAt(hosts,p[0],p[2],n.at[1]+.8)??-Infinity,n.at[1],hostApproach(p[0],p[2])),approach);
    // Leave the unmodified native top highest at every physical overlap.
    const native=mountainJoinRoadTop(p[0],p[2],n.at[1]+.8);if(native!==null)y=Math.min(y,native-.005);
    return Math.min(p[1]+(y-p[1])*weight,approach);
  };
  const localJoins:StructureSolid[]=[];
  for(const piece of cuts.solids){
    if(!/^(yearWalk|S1)\.(bed|surface|shoulders|batter)(\.|$)/.test(piece.id))continue;
    if(piece.positions.length%24)throw new Error(`Foot fairing needs source prisms before world compaction: ${piece.id}`);
    // Preserve the untouched prism-only solid: mixing one grid into it would disable
    // prism-chain LOD for every distant run sharing this source id.
    const kept:StructureSolid={...piece,positions:[],indices:[]};
    const fitted:StructureSolid={...piece,id:`${piece.id}.footJoin`,positions:[],indices:[]};let changed=false;
    for(let v=0;v<piece.positions.length/3;v+=8){
      const q=[4,5,6,7].map(k=>vertex(piece.positions,v+k));
      if(!near(q)){
        const offset=kept.positions.length/3;kept.positions.push(...piece.positions.slice(v*3,(v+8)*3));
        kept.indices.push(...piece.indices.slice(v/8*36,v/8*36+36).map(i=>i-v+offset));continue;
      }
      changed=true;fittedQuad(fitted,q,[0,1,2,3].map(k=>piece.positions[(v+k)*3+1]!),p=>height(p),ground);
    }
    if(changed){piece.positions=kept.positions;piece.indices=kept.indices;clipFootJoinToNative(fitted,ground);localJoins.push(fitted);}
  }
  cuts.solids=cuts.solids.filter(s=>s.indices.length>0);cuts.solids.push(...localJoins);
  const template=solid(`${FOOT}.apron`,'landing','paved','deck',[FOOT],'lakeside');
  for(let i=1;i<lane.points.length;i++)mitredSlab(template,lane.points,i,lane.width,.2);
  const apron:StructureSolid={...template,positions:[],indices:[]};
  for(let v=0;v<template.positions.length/3;v+=8){
    const q=[4,5,6,7].map(k=>vertex(template.positions,v+k));
    fittedQuad(apron,q,[0,1,2,3].map(k=>template.positions[(v+k)*3+1]!),p=>height(p,true),ground);
  }
  clipFootJoinToNative(apron,ground);cuts.solids.push(apron);lane.structureIds.push(apron.id);
  fitFunicularFootJoin(cuts,ground);
}

/** The unchanged native ground path meets a newly lowered Horizon bank here.
 * A short source-owned walking join reaches from the real station slab edge to
 * the actual Foot apron edge. Its local side fairing meets the existing Year
 * Walk/S1 surfaces; neither source route nor the through-road is moved. */
export function fitFunicularFootJoin(cuts:LandCuts,ground:HeightQuery):void{
 const id='mountainV2.funicularFoot.apron';if(cuts.solids.some(s=>s.id===id))return;
 const path=V2.nativePlanning.walks.find(p=>p.id==='path:station:funicular:town~road:foot');if(!path)throw new Error('Missing native funicular Foot path');
 const A=path.points[0]!,B=path.points[path.points.length-1]!,length=Math.hypot(B[0]!-A[0]!,B[2]!-A[2]!),tx=(B[0]!-A[0]!)/length,tz=(B[2]!-A[2]!)/length,half=path.halfWidth;
 const station=floorTriangles(cuts.solids.filter(s=>(s.sourceId??s.id.split('@')[0])==='threshold.funicular.town.to.hearth.slab'));
 const road=floorTriangles(cuts.solids.filter(s=>(s.sourceId??s.id.split('@')[0])===`${FOOT}.apron`));
 if(!station.length||!road.length)throw new Error('Funicular Foot join requires final station and Foot source triangles');
 const coordinate=(p:XYZ):[number,number]=>[(p[0]-A[0]!)*tx+(p[2]-A[2]!)*tz,-(p[0]-A[0]!)*tz+(p[2]-A[2]!)*tx];
 const at=(s:number,u:number,y=0):XYZ=>[A[0]!+s*tx-u*tz,y,A[2]!+s*tz+u*tx];
 const interval=(tri:Triangle,u:number):[number,number]|null=>{
  const q=tri.map(coordinate),hits:number[]=[];
  for(let i=0;i<3;i++){const a=q[i]!,b=q[(i+1)%3]!;if(Math.abs(u-a[1])<1e-8)hits.push(a[0]);if((a[1]<u&&u<b[1])||(b[1]<u&&u<a[1]))hits.push(a[0]+(b[0]-a[0])*(u-a[1])/(b[1]-a[1]));}
  if(hits.length<2)return null;const lo=Math.min(...hits),hi=Math.max(...hits);return hi-lo>1e-8?[lo,hi]:null;
 };
 const nativeStation=V2.nativePlanning.surfaces.find(s=>s.id==='station:funicular:town');if(!nativeStation)throw new Error('Missing native station host');
 const capsuleEnd=(u:number)=>{let end=-Infinity;for(const q of nativeStation.points){const [s,v]=coordinate(q as XYZ),r2=nativeStation.halfWidth**2-(u-v)**2;if(r2>=0)end=Math.max(end,s+Math.sqrt(r2));}return end;};
 const stationDraw=funicularFootStationTop(),stationSupport=funicularFootStationSupportTop();
 const spans=new Map<number,{start:number;end:number;y0:number;y1:number}>();
 const span=(offset:number)=>{
  const u=Math.max(-half,Math.min(half,offset)),cached=spans.get(u);if(cached)return cached;
  const beginnings=station.map(t=>interval(t,u)).filter((v):v is [number,number]=>v!==null);
  if(!beginnings.length)throw new Error(`Missing station support across full native path: ${u}`);
  const drawnBeginnings=stationDraw.map(t=>interval(t,u)).filter((v):v is [number,number]=>v!==null);
  const start=Math.max(...beginnings.map(v=>v[1]),...drawnBeginnings.map(v=>v[1]),capsuleEnd(u)),ends=road.map(t=>interval(t,u)).filter((v):v is [number,number]=>v!==null&&v[1]>start+1e-6&&v[0]<length+5);
  if(!ends.length)throw new Error(`Missing Foot road support across full native path: ${u}`);
  const end=Math.min(...ends.map(v=>Math.max(start,v[0]))),p=at(start,u),q=at(end,u),y0=Math.max(floorAt(station,p[0],p[2],58)??-Infinity,nativeStation.points[0]![1]!),y1=floorAt(road,q[0],q[2],58);
  if(y0===null||y1===null||end-start<.1)throw new Error('Invalid exact walking host boundary');
  const value={start,end,y0,y1};spans.set(u,value);return value;
 };
 // The actual existing physical host is also the local side boundary. Keep a
 // graded walking shoulder at the Year Walk crossing; do not put the ordinary
 // steep earth batter across its usable walking width.
 const nearby=floorTriangles(cuts.solids.filter(s=>s.walkable&&s.positions.some((x,i)=>i%3===0&&x>1280&&x<1296&&s.positions[i+2]!>717&&s.positions[i+2]!<733)));
 // The fill perimeter meets actual ground. Existing decks are handled by
 // exact planar subtraction below: sampling max(ground, deck) here created
 // discontinuous root brackets and straight chords across missing support.
 const base=(x:number,z:number)=>ground(x,z);
 const fairing=2,limit=Math.max(...[-half,0,half].map(u=>span(u).end))+fairing;
 // Both sides of an exact host boundary need a continuous extension. An
 // upper envelope alone leaves the last outside vertex BELOW its host and
 // creates a steep positive-area sliver at a clipping knot. The 35% walking
 // envelope is not a road-grade allowance; the through-road is unchanged.
 const upperHosts=[...road,...nativeFootTriangles];
 // Do not grow a shoulder along every remote road host. Only fixed road faces
 // meeting this source join neighbourhood contribute its lower extension.
 // Station hosts remain complete: omitting a threshold edge created the real
 // 88-degree triangle at H[1288.210325,55.250690,730.612550].
 // The existing Foot source is deliberately recessed5mm below native.
 // Do not put the overlapping higher native plane into the lower extension:
 // it conflicts with the exact visible recessed source at the road mouth.
 // Native remains unchanged and is still upper/clipping authority.
 const localRoad=road.filter(tri=>{const q=tri.map(coordinate);return Math.max(...q.map(p=>p[0]))>=-1&&Math.min(...q.map(p=>p[0]))<=limit+1&&Math.max(...q.map(p=>p[1]))>=-half-fairing-1&&Math.min(...q.map(p=>p[1]))<=half+fairing+1;});
 const lowerHosts=[...localRoad,...station,...stationDraw,...stationSupport];
 // The crossing Year Walk has a real raised shoulder edge. Only its and S1
 // source surfaces need this extension. A long Stillwater deck triangle
 // touches this neighbourhood but continues ten metres away; extending that
 // entire unrelated host created the rejected v9 remote fill.
 // The crossing Year Walk has a real raised shoulder edge. Extend its exact
 // top into this fill before blending: floorAt alone drops to terrain as soon
 // as a point leaves that triangle, creating the v8 face6230 discontinuity.
 const crossingHosts=floorTriangles(cuts.solids.filter(s=>/^(yearWalk|S1)\.(bed|surface|shoulders|batter)(\.|$)/.test(s.sourceId??s.id.split('@')[0]!)));
 const sideHosts=crossingHosts.filter(tri=>{const q=tri.map(coordinate);return Math.max(...q.map(p=>p[0]))>=-1&&Math.min(...q.map(p=>p[0]))<=limit+1&&Math.max(...q.map(p=>p[1]))>=-half-fairing-1&&Math.min(...q.map(p=>p[1]))<=half+fairing+1;});
 const envelope=(x:number,z:number,lower:boolean,hosts:readonly Triangle[]=lower?lowerHosts:upperHosts)=>{let y=lower?-Infinity:Infinity;const grade=.35;
  for(const tri of hosts)for(let i=0;i<3;i++){
   const a=tri[i]!,b=tri[(i+1)%3]!,dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);if(length<1e-9)continue;
   const along=((x-a[0])*dx+(z-a[2])*dz)/length,away=Math.abs((x-a[0])*dz-(z-a[2])*dx)/length,slope=(b[1]-a[1])/length;
   const t=lower?(slope>=grade?1:slope<=-grade?0:Math.max(0,Math.min(1,(along+slope*away/Math.sqrt(grade*grade-slope*slope))/length))):(slope>=grade?0:slope<=-grade?1:Math.max(0,Math.min(1,(along-slope*away/Math.sqrt(grade*grade-slope*slope))/length)));
   const h=a[1]+(b[1]-a[1])*t+(lower?-grade:grade)*Math.hypot(along-length*t,away);y=lower?Math.max(y,h):Math.min(y,h);
  }return y;
 };
 const heightCache=new Map<string,number>();
 const height=(x:number,z:number)=>{
  const key=`${x},${z}`,cached=heightCache.get(key);if(cached!==undefined)return cached;
  const [s,u]=coordinate([x,0,z]),host=span(u),t=Math.max(0,Math.min(1,(s-host.start)/(host.end-host.start))),target=host.y0+(host.y1-host.y0)*t;
  // Only the graded fixed-host field defines the walking top. Blending with
  // the existing2:1 ground bank copied55--63degree slopes into v8/v9 faces.
  // Ground and other existing supports determine the physical perimeter below.
  const shoulder=target-.35*Math.max(0,Math.abs(u)-half)-.35*Math.max(0,-s,s-host.end);
  const lower=Math.max(envelope(x,z,true),floorAt(stationDraw,x,z,58)??-Infinity,floorAt(stationSupport,x,z,58)??-Infinity),upper=envelope(x,z,false);
  if(lower>upper+1e-6)throw new Error(`Incompatible fixed walking hosts ${x},${z}: ${lower}>${upper}`);
  const y=Math.min(Math.max(shoulder,envelope(x,z,true,sideHosts),lower),upper);heightCache.set(key,y);return y;
 };
 // A fixed rectangle truncated a still-raised lower envelope at the old
 // +/-3.8m sides and at s=0, creating new 0.15--0.42m walking steps. Extend
 // the physical footprint until its entire perimeter meets existing support.
 // The bounded limit is a fail-fast locality guard, never a geometry crop.
 let sMin=0,sMax=limit,uMin=-half-fairing,uMax=half+fairing;
 const maxExtension=6,step=.5,edgeStep=.125;
 const raised=(s:number,u:number)=>{const p=at(s,u);return height(p[0],p[2])-base(p[0],p[2])>1e-6;};
 const edgeRaised=(a:number,b:number,sample:(t:number)=>boolean)=>{const n=Math.max(1,Math.ceil((b-a)/edgeStep));for(let i=0;i<=n;i++)if(sample(a+(b-a)*i/n))return true;return false;};
 let closed=false;
 for(let pass=0;pass<2*maxExtension/step+4;pass++){
  const front=edgeRaised(uMin,uMax,u=>raised(sMin,u)),back=edgeRaised(uMin,uMax,u=>raised(sMax,u)),left=edgeRaised(sMin,sMax,s=>raised(s,uMin)),right=edgeRaised(sMin,sMax,s=>raised(s,uMax));
  if(!front&&!back&&!left&&!right){closed=true;break;}
  if(front)sMin-=step;if(back)sMax+=step;if(left)uMin-=step;if(right)uMax+=step;
  if(sMin < -maxExtension||sMax>limit+maxExtension||uMin< -half-fairing-maxExtension||uMax>half+fairing+maxExtension)throw new Error(`Walking join cannot meet support within local extension: ${sMin},${sMax},${uMin},${uMax}`);
 }
 if(!closed)throw new Error('Walking join support boundary did not converge');
 const out=solid(id,'landing','paved','deck',[FOOT,'yearWalk'],'lakeside');
 // Intersect the graded fill with its existing support instead of copying a
 // steep support sample into the top. Each inserted boundary knot solves the
 // actual source height difference; native/deck ownership is then clipped by
 // the exact host triangles below. The new slab remains closed and grounded.
 const appendFill=(triangle:XYZ[])=>{
  const delta=(p:XYZ)=>height(p[0],p[2])-base(p[0],p[2]);
  const poly:XYZ[]=[];
  for(let i=0;i<triangle.length;i++){
   const A=triangle[i]!,B=triangle[(i+1)%triangle.length]!,da=delta(A),db=delta(B),insideA=da>=0,insideB=db>=0;
   if(insideA)poly.push([A[0],height(A[0],A[2]),A[2]]);
   if(insideA!==insideB){let lo=0,hi=1;
    for(let n=0;n<40;n++){const t=(lo+hi)/2,p:XYZ=[A[0]+(B[0]-A[0])*t,0,A[2]+(B[2]-A[2])*t];if((delta(p)>=0)===insideA)lo=t;else hi=t;}
    const t=(lo+hi)/2,x=A[0]+(B[0]-A[0])*t,z=A[2]+(B[2]-A[2])*t;poly.push([x,height(x,z),z]);
   }
  }
  if(poly.length<3)return;const start=out.positions.length/3;
  for(const p of poly)out.positions.push(...p,p[0],Math.min(p[1]-.1,ground(p[0],p[2])-.1),p[2]);
  for(let i=1;i<poly.length-1;i++){const a=start,b=start+i*2,c=start+(i+1)*2;out.indices.push(a,b,c,a+1,c+1,b+1);}
 };

 const across=new Set<number>([uMin,-half,half,uMax]);
 for(let u=uMin;u<uMax;u+=step)across.add(u);
 for(const tri of [...station,...stationDraw,...road])for(const p of tri){const [s,u]=coordinate(p);if(u>uMin&&u<uMax&&s>=sMin&&s<=sMax)across.add(u);}
 const columns=[...across].sort((a,b)=>a-b),rows=Math.ceil((sMax-sMin)/step);
 const sourceTriangles:Triangle[]=[];
 for(let j=0;j<rows;j++)for(let i=1;i<columns.length;i++){
  const s0=sMin+j/rows*(sMax-sMin),s1=sMin+(j+1)/rows*(sMax-sMin),u0=columns[i-1]!,u1=columns[i]!;
  const q=[at(s0,u0),at(s1,u0),at(s1,u1),at(s0,u1)];
  const signed=(q[1]![0]-q[0]![0])*(q[2]![2]-q[0]![2])-(q[1]![2]-q[0]![2])*(q[2]![0]-q[0]![0]);if(signed>0)q.reverse();
  if(q.every(p=>height(p[0],p[2])-base(p[0],p[2])<1e-6))continue;
  sourceTriangles.push([q[0]!,q[1]!,q[2]!],[q[0]!,q[2]!,q[3]!]);
 }
 // The unchanged station and through-road remain the sole physical owners at
 // overlap. This is actual polygon subtraction, never a surface-query filter.
 // Every inserted knot samples the same final field, not a minimum with a
 // stale pre-clipping interpolation. Existing native/Foot callers retain the
 // original lower-only projection through the default false option.
 // Keep the fixed host boundaries and all sampled vertices. Choose a better
 // diagonal only inside an existing convex pair; copying a nonlinear field
 // onto a skinny first-vertex fan can otherwise amplify its slope.
 for(const triangle of sourceTriangles)appendFill([...triangle]);
 clipFootJoinToNative(out,ground,[...station,...stationDraw,...road,...nativeFootTriangles],height,0,true,[...stationDraw,...stationSupport],1e-6,nearby);
 fairFootJoinDiagonals(out,[...stationDraw,...stationSupport]);
 cuts.solids.push(out);cuts.beds.find(b=>b.id===FOOT)!.structureIds.push(id);
}
