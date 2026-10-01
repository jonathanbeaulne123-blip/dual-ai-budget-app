/** Horizon-only shared ground. One native-coordinate Float32 mesh is the local
 * floor and drawing in both tiers; unchanged native defaults remain separate. */
import {capGroundMesh,type CapTriangle} from '../../../geometry/capGroundMesh.ts';
type P=readonly[number,number,number];
type Triple=readonly[number,number,number];
export type PatchBounds={x0:number;x1:number;z0:number;z1:number};
export type PatchLattice={positions:Float32Array;indices:Uint32Array;cols:number;rows:number;xs:Float32Array;zs:Float32Array};
export type PatchFloor={y:number;nx:number;ny:number;nz:number;slope:number;ids:Triple;weights:Triple};
export type GroundColorRecipe={vertex:number;source:'base'|'patch';ids:Triple;weights:Triple};
export type PatchPaintRecipe={vertex:number;ids:Triple;weights:Triple};
export type GroundBoundaryGap={x:number;z:number;base:number;patch:number;delta:number};
export type GroundRender={positions:Float32Array;indices:Uint32Array;baseVertices:number;patchVertices:number;recipes:GroundColorRecipe[];patchIndexStart:number;patchIndexCount:number;seamTriangles:number;clippedBaseTriangles:number;boundaryGaps:GroundBoundaryGap[];maxBoundaryDrawnGap:number};
export type GroundFaceWitness={index:number;degrees:number;baselineDegrees:number;introducedOrWorsened:boolean;points:readonly P[];baselinePoints:readonly P[]};
export type WalkingGroundPatch={lattice:PatchLattice;paintLattice:PatchLattice;paintRecipes:PatchPaintRecipe[];boundaryPoints:readonly P[];bounds:PatchBounds;floorAt(x:number,z:number):PatchFloor|null;height(x:number,z:number):number;proof:{step:number;ceilingMargin:number;outerRing:number;bounds:PatchBounds;dimensions:readonly[number,number];triangles:number;changedVertices:number;maxLowering:number;maxBaselineQuantization:number;maxTopDegrees:number;maxBaselineTopDegrees:number;outerRingChanged:number;facesOverLimit:GroundFaceWitness[];boundarySamples:GroundBoundaryGap[];maxBoundaryPhysicalDelta:number;boundaryTolerance:number;boundaryRefinement:{addedVertices:number;refinedCells:number;maxDepth:number;sampledMaximum:number};fairing:{passes:number;changedVertices:number;maxAdditionalLowering:number;changes:{index:number;before:number;after:number;extraLowering:number}[]}}};
const STEP=.5,CEILING_MARGIN=1.5,OUTER_RING=2,BOUNDARY_TOLERANCE=.02,BOUNDARY_REFINE=.005,MAX_BOUNDARY_DEPTH=9,MAX_FAIR_PASSES=32,MAX_FAIR_LOWERING=.03;
const point=(p:Float32Array,i:number):P=>[p[i*3]!,p[i*3+1]!,p[i*3+2]!];
const bary=(a:P,b:P,c:P,x:number,z:number):Triple=>{const D=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);return[((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/D,((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/D,0];};
const weighted=(p:readonly P[],w:Triple):P=>[0,1,2].map(j=>p[0]![j]!*w[0]+p[1]![j]!*w[1]+p[2]![j]!*w[2]) as unknown as P;
const normal=(a:P,b:P,c:P)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,L=Math.hypot(nx,ny,nz);return{nx:nx/L,ny:ny/L,nz:nz/L,slope:Math.atan2(Math.hypot(nx,nz),ny)*180/Math.PI,L};};
export function paintWalkingGroundPatch(out:Float32Array,base:Float32Array,patch:WalkingGroundPatch){out.set(base);for(const r of patch.paintRecipes)for(let j=0;j<3;j++)out[r.vertex*3+j]=r.ids.reduce((sum,id,k)=>sum+base[id*3+j]!*r.weights[k]!,0);}
export function createWalkingGroundPatch(triangles:readonly CapTriangle[],baseline:(x:number,z:number)=>number,ceiling:(x:number,z:number)=>number|null,owns:(x:number,z:number)=>boolean):WalkingGroundPatch{
 if(!triangles.length)throw new Error('A walking ground patch requires its actual apron triangles');
 const raw={x0:Math.min(...triangles.flatMap(t=>t.map(p=>p[0]))),x1:Math.max(...triangles.flatMap(t=>t.map(p=>p[0]))),z0:Math.min(...triangles.flatMap(t=>t.map(p=>p[2]))),z1:Math.max(...triangles.flatMap(t=>t.map(p=>p[2])))};
 const impact={x0:raw.x0-CEILING_MARGIN,x1:raw.x1+CEILING_MARGIN,z0:raw.z0-CEILING_MARGIN,z1:raw.z1+CEILING_MARGIN};
 const bounds={x0:Math.floor((impact.x0-OUTER_RING)/STEP)*STEP,x1:Math.ceil((impact.x1+OUTER_RING)/STEP)*STEP,z0:Math.floor((impact.z0-OUTER_RING)/STEP)*STEP,z1:Math.ceil((impact.z1+OUTER_RING)/STEP)*STEP};
 const cols=Math.round((bounds.x1-bounds.x0)/STEP),rows=Math.round((bounds.z1-bounds.z0)/STEP),gridVertices=(cols+1)*(rows+1);
 if(cols*rows>12000)throw new Error('Walking ground exceeds its bounded12000-cell local allocation: '+JSON.stringify(bounds));
 const xs=Float32Array.from({length:cols+1},(_,i)=>bounds.x0+i*STEP),zs=Float32Array.from({length:rows+1},(_,i)=>bounds.z0+i*STEP),P:number[]=[],B:number[]=[],baseIndices:number[]=[],paintRecipes:PatchPaintRecipe[]=[];
 let maxBaselineQuantization=0;
 for(let iz=0;iz<=rows;iz++)for(let ix=0;ix<=cols;ix++){const x=xs[ix]!,z=zs[iz]!,g=baseline(x,z),cap=ceiling(x,z);
  if(!Number.isFinite(g)||!owns(x,z))throw new Error('Walking ground crosses an unowned/nonfinite native floor at '+JSON.stringify([x,z]));
  const old=Math.fround(g),y=Math.fround(cap===null?g:Math.min(g,cap));maxBaselineQuantization=Math.max(maxBaselineQuantization,Math.abs(old-g));P.push(x,y,z);B.push(old);
  if((x<impact.x0||x>impact.x1||z<impact.z0||z>impact.z1)&&old!==y)throw Object.assign(new Error('Walking ceiling reached its fixed outer ring'),{proof:{bounds,at:[x,y,z],baseline:old}});
 }
 for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++){const a=iz*(cols+1)+ix,b=a+1,c=a+cols+1,d=c+1,ad=Math.abs(P[a*3+1]!-P[d*3+1]!),bc=Math.abs(P[b*3+1]!-P[c*3+1]!);baseIndices.push(...(ad<=bc?[a,c,d,a,d,b]:[a,c,b,b,c,d]));}
 const at=(i:number):P=>[P[i*3]!,P[i*3+1]!,P[i*3+2]!];
 const appended=new Map<string,number>();let refinedCells=0,maxBoundaryDepth=0,sampledMaximum=0;
 const add=(x:number,z:number,ids:Triple,weights:Triple)=>{x=Math.fround(x);z=Math.fround(z);const key=x+':'+z,hit=appended.get(key);if(hit!==undefined)return hit;const g=baseline(x,z),y=Math.fround(g),id=P.length/3;if(id-gridVertices>=2048)throw new Error('Boundary refinement exceeded its2048-vertex local allocation');if(!Number.isFinite(g)||!owns(x,z))throw new Error('Boundary knot crosses unowned/nonfinite ground');maxBaselineQuantization=Math.max(maxBaselineQuantization,Math.abs(y-g));P.push(x,y,z);B.push(y);paintRecipes.push({vertex:id,ids,weights});appended.set(key,id);return id;};
 // Only cells touching the fixed outer perimeter receive new vertices. Native
 // curve probes choose boundary knots; no global lattice refinement occurs.
 const boundaryEdge=(a:number,b:number,baseA=a,baseB=b,ta=0,tb=1,depth=0):number[]=>{
  const A=at(a),C=at(b),gaps=[.125,.25,.375,.5,.625,.75,.875].map(t=>{const x=A[0]+(C[0]-A[0])*t,z=A[2]+(C[2]-A[2])*t;return{t,x,z,gap:Math.abs(baseline(x,z)-(A[1]+(C[1]-A[1])*t))};}),worst=gaps.reduce((a,b)=>a.gap>b.gap?a:b);
  if(worst.gap<=BOUNDARY_REFINE){sampledMaximum=Math.max(sampledMaximum,worst.gap);return[a,b];}
  if(depth>=MAX_BOUNDARY_DEPTH)throw Object.assign(new Error('Boundary curve cannot meet fixed local refinement bound'),{proof:{bounds,a:A,b:C,worst,depth,boundaryTolerance:BOUNDARY_TOLERANCE}});
  const t=(ta+tb)/2,m=add((A[0]+C[0])/2,(A[2]+C[2])/2,[baseA,baseB,baseB],[1-t,t,0]);maxBoundaryDepth=Math.max(maxBoundaryDepth,depth+1);
  return[...boundaryEdge(a,m,baseA,baseB,ta,t,depth+1).slice(0,-1),...boundaryEdge(m,b,baseA,baseB,t,tb,depth+1)];
 };
 const I:number[]=[],cellStarts:number[]=[];
 for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++){
  cellStarts.push(I.length);const cell=iz*cols+ix,a=iz*(cols+1)+ix,b=a+1,c=a+cols+1,d=c+1,original=baseIndices.slice(cell*6,cell*6+6),corners=[a,c,d,b],poly:number[]=[];
  for(let j=0;j<4;j++){const from=corners[j]!,to=corners[(j+1)%4]!,A=at(from),C=at(to),boundary=(A[0]===C[0]&&(A[0]===bounds.x0||A[0]===bounds.x1))||(A[2]===C[2]&&(A[2]===bounds.z0||A[2]===bounds.z1));poly.push(...(boundary?boundaryEdge(from,to):[from,to]).slice(0,-1));}
  if(poly.length===4){I.push(...original);continue;}
  refinedCells++;const ids=original.slice(0,3) as unknown as Triple,T=ids.map(at) as [P,P,P],x=(xs[ix]!+xs[ix+1]!)/2,z=(zs[iz]!+zs[iz+1]!)/2,q=bary(...T,x,z),mid=add(x,z,ids,[q[0],q[1],1-q[0]-q[1]]);
  for(let j=0;j<poly.length;j++)I.push(mid,poly[j]!,poly[(j+1)%poly.length]!);
 }
 cellStarts.push(I.length);
 if(P.length/3-gridVertices>2048)throw new Error('Boundary refinement exceeded its2048-vertex local allocation');
 const positions=new Float32Array(P),old=new Float32Array(B),indices=new Uint32Array(I),lattice={positions,indices,cols,rows,xs,zs};
 const beforeFace=(k:number)=>[indices[k]!,indices[k+1]!,indices[k+2]!].map(i=>[positions[i*3]!,old[i]!,positions[i*3+2]!] as P) as [P,P,P];
 const baselineGrades=Array.from({length:indices.length/3},(_,i)=>{const n=normal(...beforeFace(i*3));return Math.hypot(n.nx,n.nz)/n.ny;});
 capGroundMesh(lattice,triangles,.02);const capped=positions.slice();
 // Project only violating face heights downward. First choose the smallest
 // one-vertex reduction that reaches its original/40-degree slope cone. A
 // uniform contraction toward the lowest vertex handles a cone requiring two
 // reductions. Shared-neighbour constraints are rechecked; no raising occurs.
 let passes=0;
 for(;passes<MAX_FAIR_PASSES;passes++){
  let violations=0;
  for(let k=0;k<indices.length;k+=3){const ids=[indices[k]!,indices[k+1]!,indices[k+2]!] as const,T=ids.map(i=>point(positions,i)) as [P,P,P],n=normal(...T),g=[-n.nx/n.ny,-n.nz/n.ny] as const,grade=Math.hypot(...g),limit=Math.max(Math.tan(40*Math.PI/180),baselineGrades[k/3]!);
   if(grade<=limit+1e-9)continue;violations++;const target=limit-1e-6,D=(T[1][0]-T[0][0])*(T[2][2]-T[0][2])-(T[2][0]-T[0][0])*(T[1][2]-T[0][2]);
   const coefficients=[[T[1][2]-T[2][2],T[2][0]-T[1][0]],[T[2][2]-T[0][2],T[0][0]-T[2][0]],[T[0][2]-T[1][2],T[1][0]-T[0][0]]].map(v=>[v[0]!/D,v[1]!/D] as const);
   let best:{j:number;delta:number}|undefined;for(let j=0;j<3;j++){const a=coefficients[j]!,A=a[0]*a[0]+a[1]*a[1],b=g[0]*a[0]+g[1]*a[1],C=grade*grade-target*target,disc=b*b-A*C;if(b<=0||disc<0)continue;const delta=C/(b+Math.sqrt(disc));if(delta>0&&(!best||delta<best.delta))best={j,delta};}
   if(best){const id=ids[best.j]!;positions[id*3+1]=positions[id*3+1]!-best.delta-1e-6;}
   else{const low=Math.min(...T.map(p=>p[1])),ratio=target/grade;ids.forEach((id,j)=>{if(T[j]![1]>low)positions[id*3+1]=low+(T[j]![1]-low)*ratio-1e-6;});}
   for(const id of ids)if(capped[id*3+1]!-positions[id*3+1]!>MAX_FAIR_LOWERING)throw Object.assign(new Error('Lower-only ground fairing exceeded its3cm local bound'),{proof:{bounds,face:k/3,id,before:capped[id*3+1],after:positions[id*3+1],passes}});
  }
  if(!violations)break;
 }
 const changes:{index:number;before:number;after:number;extraLowering:number}[]=[];for(let i=0;i<old.length;i++)if(positions[i*3+1]!==capped[i*3+1])changes.push({index:i,before:capped[i*3+1]!,after:positions[i*3+1]!,extraLowering:capped[i*3+1]!-positions[i*3+1]!});
 let changedVertices=0,maxLowering=0,maxTopDegrees=0,maxBaselineTopDegrees=0,outerRingChanged=0;const facesOverLimit:GroundFaceWitness[]=[];
 for(let i=0;i<old.length;i++){const x=positions[i*3]!,z=positions[i*3+2]!,delta=positions[i*3+1]!-old[i]!;if(delta>0)throw new Error('Walking ground unexpectedly raises baseline');if(delta!==0){changedVertices++;maxLowering=Math.max(maxLowering,-delta);if(x<impact.x0||x>impact.x1||z<impact.z0||z>impact.z1)outerRingChanged++;}}
 for(let k=0;k<indices.length;k+=3){const T=[indices[k]!,indices[k+1]!,indices[k+2]!].map(i=>point(positions,i)) as [P,P,P],n=normal(...T),before=beforeFace(k),bn=normal(...before);if(!Number.isFinite(n.L)||n.L<=1e-8||n.ny<=0)throw new Error('Invalid canonical ground face '+k/3);maxTopDegrees=Math.max(maxTopDegrees,n.slope);maxBaselineTopDegrees=Math.max(maxBaselineTopDegrees,bn.slope);
  if(n.slope>40+1e-7)facesOverLimit.push({index:k/3,degrees:n.slope,baselineDegrees:bn.slope,introducedOrWorsened:bn.slope<=40+1e-7||n.slope>bn.slope+1e-7,points:T,baselinePoints:before});
  for(const w of[[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5]] as const){const q=weighted(T,w);if(!owns(q[0],q[2]))throw new Error('Walking ground face crosses native ownership at '+JSON.stringify(q));}
 }
 const proof={step:STEP,ceilingMargin:CEILING_MARGIN,outerRing:OUTER_RING,bounds,dimensions:[bounds.x1-bounds.x0,bounds.z1-bounds.z0] as const,triangles:indices.length/3,changedVertices,maxLowering,maxBaselineQuantization,maxTopDegrees,maxBaselineTopDegrees,outerRingChanged,facesOverLimit,boundarySamples:[] as GroundBoundaryGap[],maxBoundaryPhysicalDelta:0,boundaryTolerance:BOUNDARY_TOLERANCE,boundaryRefinement:{addedVertices:positions.length/3-gridVertices,refinedCells,maxDepth:maxBoundaryDepth,sampledMaximum},fairing:{passes,changedVertices:changes.length,maxAdditionalLowering:Math.max(0,...changes.map(c=>c.extraLowering)),changes}};
 const floorAt=(x:number,z:number):PatchFloor|null=>{
  if(x<bounds.x0||x>bounds.x1||z<bounds.z0||z>bounds.z1)return null;
  const ix=Math.min(cols-1,Math.floor((x-bounds.x0)/STEP)),iz=Math.min(rows-1,Math.floor((z-bounds.z0)/STEP)),cell=iz*cols+ix;
  for(let k=cellStarts[cell]!;k<cellStarts[cell+1]!;k+=3){const ids=[indices[k]!,indices[k+1]!,indices[k+2]!] as const,T=ids.map(i=>point(positions,i)) as [P,P,P],q=bary(...T,x,z),w=[q[0],q[1],1-q[0]-q[1]] as const;
   if(w.some(v=>v< -1e-12))continue;const n=normal(...T);return{y:weighted(T,w)[1],nx:n.nx,ny:n.ny,nz:n.nz,slope:n.slope,ids,weights:w};}
  return null;
 };
 // Independent <=2cm spacing across the full perimeter, in addition to the
 // seven adaptive probes per retained segment. This is finite evidence, not
 // an assertion of exact equality to a nonlinear analytical field.
 for(const axis of[0,2] as const)for(const fixed of axis===0?[bounds.x0,bounds.x1]:[bounds.z0,bounds.z1]){
  const lo=axis===0?bounds.z0:bounds.x0,hi=axis===0?bounds.z1:bounds.x1,count=Math.ceil((hi-lo)/.02);
  for(let i=0;i<=count;i++){const t=lo+(hi-lo)*i/count,x=axis===0?fixed:t,z=axis===0?t:fixed,f=floorAt(x,z);if(!f)throw new Error('Missing actual boundary triangle');const base=baseline(x,z),delta=f.y-base;proof.boundarySamples.push({x,z,base,patch:f.y,delta});proof.maxBoundaryPhysicalDelta=Math.max(proof.maxBoundaryPhysicalDelta,Math.abs(delta));}
 }
 if(outerRingChanged)throw Object.assign(new Error('Walking cap/fairing reached its fixed outer ring; no automatic expansion'),{proof});
 if(facesOverLimit.some(f=>f.introducedOrWorsened)||passes>=MAX_FAIR_PASSES)throw Object.assign(new Error('New or worsened ground face exceeds its original/40-degree limit'),{proof});
 if(proof.maxBoundaryPhysicalDelta>BOUNDARY_TOLERANCE)throw Object.assign(new Error('Sampled canonical boundary exceeds unchanged2cm closure bound'),{proof});
 const paintLattice={positions:positions.slice(0,gridVertices*3),indices:new Uint32Array(baseIndices),cols,rows,xs,zs};
 const boundaryPoints=Array.from({length:positions.length/3},(_,i)=>point(positions,i)).filter(p=>p[0]===bounds.x0||p[0]===bounds.x1||p[2]===bounds.z0||p[2]===bounds.z1);
 return{lattice,paintLattice,paintRecipes,boundaryPoints,bounds,floorAt,height:(x,z)=>floorAt(x,z)?.y??baseline(x,z),proof};
}

type V={p:P;weights:Triple};
const area=(p:readonly V[])=>{let a=0;for(let i=1;i<p.length-1;i++){const p0=p[0]!.p,p1=p[i]!.p,p2=p[i+1]!.p;a+=(p1[0]-p0[0])*(p2[2]-p0[2])-(p1[2]-p0[2])*(p2[0]-p0[0]);}return a;};
const clean=(p:V[])=>p.filter((v,i)=>i===0||v.p.some((x,j)=>x!==p[i-1]!.p[j])).filter((v,i,all)=>i!==all.length-1||all.length<2||v.p.some((x,j)=>x!==all[0]!.p[j]));
function split(poly:V[],axis:0|2,at:number,sign:number):[V[],V[]]{const inside:V[]=[],outside:V[]=[];for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,da=(a.p[axis]-at)*sign,db=(b.p[axis]-at)*sign,ia=da>=0,ib=db>=0;(ia?inside:outside).push(a);if(ia!==ib){const t=da/(da-db),p=a.p.map((x,j)=>j===axis?at:x+(b.p[j]!-x)*t) as unknown as P,weights=a.weights.map((x,j)=>x+(b.weights[j]!-x)*t) as unknown as Triple,q={p,weights};inside.push(q);outside.push(q);}}return[clean(inside),clean(outside)];}
/** Clip only final rendered triangles, after the original masks/paint exist.
 * Uncut base indices/vertices are retained verbatim. The patch top is copied
 * verbatim; added boundary curtains have zero plan area and no floor query. */
export function composeWalkingGround(base:Pick<PatchLattice,'positions'|'indices'>,patch:WalkingGroundPatch):GroundRender{
 const B=patch.bounds,baseVertices=base.positions.length/3,patchVertices=patch.lattice.positions.length/3,positions=[...base.positions,...patch.lattice.positions],indices:number[]=[],recipes:GroundColorRecipe[]=[],seams:{ids:Triple;a:V;b:V;axis:0|2;fixed:number}[]=[],planes:[[0|2,number,number],[0|2,number,number],[0|2,number,number],[0|2,number,number]]=[[0,B.x0,1],[0,B.x1,-1],[2,B.z0,1],[2,B.z1,-1]];
 let clippedBaseTriangles=0;const boundaryGaps:GroundBoundaryGap[]=[];let maxBoundaryDrawnGap=0;
 const append=(p:P,source:'base'|'patch',ids:Triple,weights:Triple)=>{const i=positions.length/3;positions.push(...p.map(Math.fround));recipes.push({vertex:i,source,ids,weights});return i;};
 for(let k=0;k<base.indices.length;k+=3){const ids=[base.indices[k]!,base.indices[k+1]!,base.indices[k+2]!] as const,tri=ids.map((i,j)=>({p:point(base.positions,i),weights:[+(j===0),+(j===1),+(j===2)] as Triple}));
  if(Math.max(...tri.map(v=>v.p[0]))<=B.x0||Math.min(...tri.map(v=>v.p[0]))>=B.x1||Math.max(...tri.map(v=>v.p[2]))<=B.z0||Math.min(...tri.map(v=>v.p[2]))>=B.z1){indices.push(...ids);continue;}
  let kept=tri;const out:V[][]=[];for(const[axis,at,sign]of planes){const pair=split(kept,axis,at,sign);if(pair[1].length>=3&&Math.abs(area(pair[1]))>1e-12)out.push(pair[1]);kept=pair[0];if(kept.length<3)break;}
  if(kept.length<3||Math.abs(area(kept))<=1e-12){indices.push(...ids);continue;}
  clippedBaseTriangles++;
  for(const p of out){const mapped=p.map(v=>append(v.p,'base',ids,v.weights));for(let i=1;i<p.length-1;i++)if(Math.abs(area([p[0]!,p[i]!,p[i+1]!]))>1e-12)indices.push(mapped[0]!,mapped[i]!,mapped[i+1]!);
   for(let i=0;i<p.length;i++){const a=p[i]!,b=p[(i+1)%p.length]!;for(const[axis,fixed]of planes)if(a.p[axis]===fixed&&b.p[axis]===fixed)seams.push({ids,a,b,axis,fixed});}
  }
 }
 const patchIndexStart=indices.length;for(const i of patch.lattice.indices)indices.push(baseVertices+i);const patchIndexCount=indices.length-patchIndexStart;let seamTriangles=0;
 for(const{ids,a,b,axis,fixed}of seams){const other=axis===0?2:0,from=a.p[other],to=b.p[other],d=to-from;if(Math.abs(d)<1e-12)continue;const lo=other===0?B.x0:B.z0,hi=other===0?B.x1:B.z1;
  const t0=Math.max(0,Math.min((lo-from)/d,(hi-from)/d)),t1=Math.min(1,Math.max((lo-from)/d,(hi-from)/d));if(t1-t0<1e-12)continue;
  const knots=[t0,t1];for(const p of patch.boundaryPoints){if(p[axis]!==fixed)continue;const t=(p[other]-from)/d;if(t>t0&&t<t1)knots.push(t);}knots.sort((a,b)=>a-b);
  for(let j=1;j<knots.length;j++){const ends=[knots[j-1]!,knots[j]!].map(t=>{const p=a.p.map((v,k)=>k===axis?fixed:v+(b.p[k]!-v)*t) as unknown as P,w=a.weights.map((v,k)=>v+(b.weights[k]!-v)*t) as unknown as Triple,f=patch.floorAt(p[0],p[2]);if(!f)throw new Error('Missing canonical boundary floor');const delta=f.y-p[1];boundaryGaps.push({x:p[0],z:p[2],base:p[1],patch:f.y,delta});maxBoundaryDrawnGap=Math.max(maxBoundaryDrawnGap,Math.abs(delta));return{p,w,f};});
   const A=ends[0]!,C=ends[1]!,q=[A.p,C.p,[C.p[0],C.f.y,C.p[2]] as P,[A.p[0],A.f.y,A.p[2]] as P],v=[append(q[0]!,'base',ids,A.w),append(q[1]!,'base',ids,C.w),append(q[2]!,'patch',C.f.ids,C.f.weights),append(q[3]!,'patch',A.f.ids,A.f.weights)];
   for(const t of[[0,1,2],[0,2,3]]){const p=t.map(i=>[positions[v[i]!*3]!,positions[v[i]!*3+1]!,positions[v[i]!*3+2]!] as P) as [P,P,P],n=normal(...p);if(n.L<=1e-12)continue;if(Math.abs(n.ny)>1e-8)throw new Error('Boundary curtain became an upward floor');indices.push(v[t[0]!]!,v[t[1]!]!,v[t[2]!]!);seamTriangles++;}
  }
 }
 return{positions:new Float32Array(positions),indices:new Uint32Array(indices),baseVertices,patchVertices,recipes,patchIndexStart,patchIndexCount,seamTriangles,clippedBaseTriangles,boundaryGaps,maxBoundaryDrawnGap};
}
export function composeGroundColors(out:Float32Array,base:Float32Array,patch:Float32Array,render:GroundRender){out.set(base);out.set(patch,render.baseVertices*3);for(const r of render.recipes){const source=r.source==='base'?base:patch;for(let j=0;j<3;j++)out[r.vertex*3+j]=r.ids.reduce((sum,id,k)=>sum+source[id*3+j]!*r.weights[k]!,0);}}
