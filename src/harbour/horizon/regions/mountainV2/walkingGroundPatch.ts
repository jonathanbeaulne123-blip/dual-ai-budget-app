/** Horizon-only shared ground. One native-coordinate Float32 mesh is the local
 * floor and drawing in both tiers; unchanged native defaults remain separate. */
import {capGroundMesh,type CapTriangle} from '../../../geometry/capGroundMesh.ts';
type P=readonly[number,number,number];
type Triple=readonly[number,number,number];
export type PatchBounds={x0:number;x1:number;z0:number;z1:number};
export type PatchLattice={positions:Float32Array;indices:Uint32Array;cols:number;rows:number;xs:Float32Array;zs:Float32Array};
export type PatchFloor={y:number;nx:number;ny:number;nz:number;slope:number;ids:Triple;weights:Triple};
export type GroundColorRecipe={vertex:number;source:'base'|'patch';ids:Triple;weights:Triple;patchBlend?:{ids:Triple;weights:Triple;amount:number}};
export type PatchPaintRecipe={vertex:number;ids:Triple;weights:Triple};
export type GroundBoundaryGap={x:number;z:number;base:number;patch:number;delta:number};
export type GroundCollarProof={width:number;triangles:number;refinementPasses:number;maxTargetError:number;maxPhysicalError:number;maxInheritedPhysicalError:number;maxWorseningBeyondInheritedOrSixCm:number;innerJoinSamples:number;outerJoinSamples:number;inheritedCoreBoundaryGaps:GroundBoundaryGap[];maxInheritedCoreBoundaryGap:number;sharedOuterEdges:number;exteriorBoundaryAddedTriangles:number;densityProof:{planStep:number;planOffsets:readonly number[];edgeStep:number;uniqueAnalyticGridSamples:number;gridProbeEvaluations:number;edgeProbeEvaluations:number;cacheBytes:number;finiteSampling:true};targetApproximation:{reference:number;facesAboveReference:number;acceptanceGate:false};refinementHistory:{pass:number;triangles:number;failingPhysicalFaces:number;maxTargetError:number;maxWorsening:number}[]};
export type GroundRender={positions:Float32Array;indices:Uint32Array;baseVertices:number;patchVertices:number;recipes:GroundColorRecipe[];patchIndexStart:number;patchIndexCount:number;seamTriangles:number;clippedBaseTriangles:number;boundaryGaps:GroundBoundaryGap[];maxBoundaryDrawnGap:number;collarProof?:GroundCollarProof};
export type GroundFaceWitness={index:number;degrees:number;baselineDegrees:number;introducedOrWorsened:boolean;points:readonly P[];baselinePoints:readonly P[]};
export type WalkingGroundPatch={lattice:PatchLattice;paintLattice:PatchLattice;paintRecipes:PatchPaintRecipe[];boundaryPoints:readonly P[];bounds:PatchBounds;floorAt(x:number,z:number):PatchFloor|null;height(x:number,z:number):number;baselineHeight(x:number,z:number):number;proof:{step:number;ceilingMargin:number;outerRing:number;bounds:PatchBounds;dimensions:readonly[number,number];triangles:number;changedVertices:number;maxLowering:number;maxBaselineQuantization:number;maxTopDegrees:number;maxBaselineTopDegrees:number;outerRingChanged:number;facesOverLimit:GroundFaceWitness[];boundarySamples:GroundBoundaryGap[];maxBoundaryPhysicalDelta:number;boundaryTolerance:number;boundaryRefinement:{addedVertices:number;refinedCells:number;maxDepth:number;sampledMaximum:number};fairing:{passes:number;changedVertices:number;maxAdditionalLowering:number;changes:{index:number;before:number;after:number;extraLowering:number}[]}}};
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
 return{lattice,paintLattice,paintRecipes,boundaryPoints,bounds,floorAt,height:(x,z)=>floorAt(x,z)?.y??baseline(x,z),baselineHeight:baseline,proof};
}

type V={p:P;weights:Triple};
const area=(p:readonly V[])=>{let a=0;for(let i=1;i<p.length-1;i++){const p0=p[0]!.p,p1=p[i]!.p,p2=p[i+1]!.p;a+=(p1[0]-p0[0])*(p2[2]-p0[2])-(p1[2]-p0[2])*(p2[0]-p0[0]);}return a;};
const clean=(p:V[])=>p.filter((v,i)=>i===0||v.p.some((x,j)=>x!==p[i-1]!.p[j])).filter((v,i,all)=>i!==all.length-1||all.length<2||v.p.some((x,j)=>x!==all[0]!.p[j]));
function split(poly:V[],axis:0|2,at:number,sign:number):[V[],V[]]{const inside:V[]=[],outside:V[]=[];for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,da=(a.p[axis]-at)*sign,db=(b.p[axis]-at)*sign,ia=da>=0,ib=db>=0;(ia?inside:outside).push(a);if(ia!==ib){const t=da/(da-db),p=a.p.map((x,j)=>j===axis?at:x+(b.p[j]!-x)*t) as unknown as P,weights=a.weights.map((x,j)=>x+(b.weights[j]!-x)*t) as unknown as Triple,q={p,weights};inside.push(q);outside.push(q);}}return[clean(inside),clean(outside)];}
/** The physical core is copied verbatim. A bounded exterior drawing collar joins
 * it continuously to each original tier mesh. Outside physics stays analytic;
 * the collar moves drawing toward that same baseline, never supplies a floor.
 * All original vertices and all faces wholly outside the collar stay unchanged. */
export function composeWalkingGround(base:Pick<PatchLattice,'positions'|'indices'>,patch:WalkingGroundPatch):GroundRender{
 const B=patch.bounds,WIDTH=1.5,outer={x0:B.x0-WIDTH,x1:B.x1+WIDTH,z0:B.z0-WIDTH,z1:B.z1+WIDTH},MAX_PASSES=10,MAX_FACES=8192,TARGET_ERROR=.002,ROUNDING=1e-7;
 const baseVertices=base.positions.length/3,patchVertices=patch.lattice.positions.length/3,positions=[...base.positions,...patch.lattice.positions],indices:number[]=[],recipes:GroundColorRecipe[]=[],boundaryGaps:GroundBoundaryGap[]=[],inheritedCoreBoundaryGaps:GroundBoundaryGap[]=[];
 type Face={ids:[number,number,number];source:Triple};type Node={index:number;point:P};
 const faces:Face[]=[],exteriorFaces:Face[]=[],originalOuterNodes=new Map<string,number>(),nodes=new Map<string,Node>(),coreNodes=new Map<string,number>();
 for(let i=0;i<patchVertices;i++){const p=point(patch.lattice.positions,i);if(p[0]===B.x0||p[0]===B.x1||p[2]===B.z0||p[2]===B.z1)coreNodes.set(p[0]+':'+p[2],baseVertices+i);}
 let clippedBaseTriangles=0,maxBoundaryDrawnGap=0,maxInheritedCoreBoundaryGap=0,innerJoinSamples=0,outerJoinSamples=0;
 const get=(id:number):P=>[positions[id*3]!,positions[id*3+1]!,positions[id*3+2]!];
 const planes=(box:PatchBounds):[0|2,number,number][]=>[[0,box.x0,1],[0,box.x1,-1],[2,box.z0,1],[2,box.z1,-1]];
 const onSide=(a:P,b:P,box:PatchBounds,axis:0|2,fixed:number)=>{const other=axis===0?2:0,lo=other===0?box.x0:box.z0,hi=other===0?box.x1:box.z1;return a[axis]===fixed&&b[axis]===fixed&&a[other]>=lo&&a[other]<=hi&&b[other]>=lo&&b[other]<=hi;};
 for(let i=0;i<baseVertices;i++){const p=point(base.positions,i);if(planes(outer).some(([axis,fixed])=>onSide(p,p,outer,axis,fixed)))originalOuterNodes.set(p[0]+':'+p[2],i);}
 const overlapsSide=(a:P,b:P,box:PatchBounds,axis:0|2,fixed:number)=>{const other=axis===0?2:0,lo=other===0?box.x0:box.z0,hi=other===0?box.x1:box.z1;return a[axis]===fixed&&b[axis]===fixed&&Math.min(a[other],b[other])<=hi&&Math.max(a[other],b[other])>=lo;};
 const sourceAt=(ids:Triple,x:number,z:number)=>{const T=ids.map(i=>point(base.positions,i)) as [P,P,P],q=bary(...T,x,z),weights=[q[0],q[1],1-q[0]-q[1]] as const;return{y:weighted(T,weights)[1],weights};};
 const target=(ids:Triple,x:number,z:number)=>{
  const original=sourceAt(ids,x,z),d=Math.max(0,B.x0-x,x-B.x1,B.z0-z,z-B.z1),amount=Math.max(0,Math.min(1,1-d/WIDTH));
  const cx=Math.max(B.x0,Math.min(B.x1,x)),cz=Math.max(B.z0,Math.min(B.z1,z)),edge=patch.floorAt(cx,cz);if(!edge)throw new Error('Missing common core edge in render collar');
  const physical=patch.baselineHeight(x,z),edgeError=edge.y-patch.baselineHeight(cx,cz),y=original.y+amount*(physical-original.y+edgeError);
  return{...original,physical,y,amount,edge};
 };
 const node=(ids:Triple,x:number,z:number):number=>{
  x=Math.fround(x);z=Math.fround(z);const key=x+':'+z,old=nodes.get(key);if(old)return old.index;
  const t=target(ids,x,z),shared=coreNodes.get(key)??originalOuterNodes.get(key),index=shared??positions.length/3;
  if(shared===undefined){positions.push(x,Math.fround(t.y),z);recipes.push({vertex:index,source:'base',ids,weights:t.weights,patchBlend:{ids:t.edge.ids,weights:t.edge.weights,amount:t.amount}});}
  nodes.set(key,{index,point:get(index)});return index;
 };
 const addFace=(out:Face[],a:number,b:number,c:number,source:Triple)=>{
  const A=get(a),C=get(b),D=get(c),ny=(C[2]-A[2])*(D[0]-A[0])-(C[0]-A[0])*(D[2]-A[2]);
  if(a===b||a===c||b===c||ny===0)return;if(ny<0)throw new Error('Render collar face inverted after Float32 conversion');out.push({ids:[a,b,c],source});
 };
 const appendBase=(p:V[],ids:Triple)=>{
  const mapped=p.map(v=>{if(planes(outer).some(([axis,fixed])=>onSide(v.p,v.p,outer,axis,fixed)))return node(ids,v.p[0],v.p[2]);for(const id of ids){const old=point(base.positions,id);if(old.every((n,k)=>n===v.p[k]))return id;}
   const index=positions.length/3;positions.push(...v.p.map(Math.fround));recipes.push({vertex:index,source:'base',ids,weights:v.weights});return index;});
  for(let j=1;j<p.length-1;j++){const A=get(mapped[0]!),C=get(mapped[j]!),D=get(mapped[j+1]!),ny=(C[2]-A[2])*(D[0]-A[0])-(C[0]-A[0])*(D[2]-A[2]);if(ny>0)exteriorFaces.push({ids:[mapped[0]!,mapped[j]!,mapped[j+1]!],source:ids});else if(ny<0)throw new Error('Original exterior clipping inverted a face');}
 };
 const collarPolygon=(poly:V[],source:Triple)=>{
  const boundary:number[]=[];
  for(let j=0;j<poly.length;j++){
   const a=poly[j]!.p,b=poly[(j+1)%poly.length]!.p;boundary.push(node(source,a[0],a[2]));
   for(const[axis,fixed]of planes(B))if(a[axis]===fixed&&b[axis]===fixed){const other=axis===0?2:0,delta=b[other]-a[other];if(Math.abs(delta)<1e-12)continue;
    const knots=patch.boundaryPoints.filter(p=>p[axis]===fixed).map(p=>({p,t:(p[other]-a[other])/delta})).filter(q=>q.t>1e-12&&q.t<1-1e-12).sort((a,b)=>a.t-b.t);
    for(const q of knots)boundary.push(node(source,q.p[0],q.p[2]));}
  }
  const unique=boundary.filter((id,j)=>id!==boundary[(j+boundary.length-1)%boundary.length]);if(unique.length<3)return;
  const centre=node(source,unique.reduce((sum,id)=>sum+get(id)[0],0)/unique.length,unique.reduce((sum,id)=>sum+get(id)[2],0)/unique.length);
  for(let j=0;j<unique.length;j++)addFace(faces,centre,unique[j]!,unique[(j+1)%unique.length]!,source);
 };
 for(let k=0;k<base.indices.length;k+=3){const ids=[base.indices[k]!,base.indices[k+1]!,base.indices[k+2]!] as const,tri=ids.map((i,j)=>({p:point(base.positions,i),weights:[+(j===0),+(j===1),+(j===2)] as Triple}));
  if(Math.max(...tri.map(v=>v.p[0]))<=outer.x0||Math.min(...tri.map(v=>v.p[0]))>=outer.x1||Math.max(...tri.map(v=>v.p[2]))<=outer.z0||Math.min(...tri.map(v=>v.p[2]))>=outer.z1){exteriorFaces.push({ids:[...ids],source:ids});continue;}
  let kept=tri;const outside:V[][]=[];
  for(const[axis,at,sign]of planes(outer)){const pair=split(kept,axis,at,sign);if(pair[1].length>=3&&Math.abs(area(pair[1]))>1e-12)outside.push(pair[1]);kept=pair[0];if(kept.length<3)break;}
  if(kept.length<3||Math.abs(area(kept))<=1e-12){exteriorFaces.push({ids:[...ids],source:ids});continue;}
  clippedBaseTriangles++;for(const p of outside)appendBase(p,ids);
  for(const[axis,at,sign]of planes(B)){const pair=split(kept,axis,at,sign);if(pair[1].length>=3&&Math.abs(area(pair[1]))>1e-12)collarPolygon(pair[1],ids);kept=pair[0];if(kept.length<3)break;}
 }
 // Rectangle subtraction can leave a corner knot on a neighbouring polygon's
 // longer edge. Split both sides at every existing collinear seed vertex before
 // adaptive refinement, so their nonplanar target heights cannot make a T-junction.
 const seedNodes=[...nodes.values()],conforming:Face[]=[];
 for(const f of faces){const polygon:number[]=[];let splitEdge=false;
  for(let j=0;j<3;j++){const a=f.ids[j]!,b=f.ids[(j+1)%3]!,A=get(a),C=get(b),dx=C[0]-A[0],dz=C[2]-A[2],length2=dx*dx+dz*dz;polygon.push(a);const between:{index:number;t:number}[]=[];
   for(const n of seedNodes){if(n.index===a||n.index===b)continue;const q=n.point,t=((q[0]-A[0])*dx+(q[2]-A[2])*dz)/length2;if(t<=1e-8||t>=1-1e-8)continue;const distance=Math.abs((q[0]-A[0])*dz-(q[2]-A[2])*dx)/Math.sqrt(length2);if(distance<=1e-7)between.push({index:n.index,t});}
   between.sort((a,b)=>a.t-b.t);for(const n of between)polygon.push(n.index);if(between.length)splitEdge=true;
  }
  if(!splitEdge){conforming.push(f);continue;}const c=node(f.source,polygon.reduce((sum,id)=>sum+get(id)[0],0)/polygon.length,polygon.reduce((sum,id)=>sum+get(id)[2],0)/polygon.length);
  for(let j=0;j<polygon.length;j++)addFace(conforming,c,polygon[j]!,polygon[(j+1)%polygon.length]!,f.source);
 }
 const weights:Triple[]=[[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]];
 // V6's seven barycentric probes missed narrow inherited-bank transitions.
 // Acceptance probes use a fixed native-coordinate density independent of the
 // source triangulation and of saved failure locations. The shifted grid also
 // checks between primary grid rows. Only analytic values are cached; every
 // candidate face is checked against its own actual Float32 plane.
 const DENSITY=.02,offsets=[0,DENSITY/2] as const;
 const analyticGrids=offsets.map(offset=>{const ix0=Math.floor((outer.x0-offset)/DENSITY)-1,ix1=Math.ceil((outer.x1-offset)/DENSITY)+1,iz0=Math.floor((outer.z0-offset)/DENSITY)-1,iz1=Math.ceil((outer.z1-offset)/DENSITY)+1,cols=ix1-ix0+1,values=new Float64Array(cols*(iz1-iz0+1));values.fill(NaN);return{offset,ix0,ix1,iz0,iz1,cols,values};});
 let uniqueAnalyticGridSamples=0,gridProbeEvaluations=0,edgeProbeEvaluations=0;
 type Assessment={maxTargetError:number;maxPhysicalError:number;maxInheritedPhysicalError:number;maxWorsening:number;bad:boolean};
 const assessmentCache=new WeakMap<Face,Assessment>();
 const assess=(f:Face):Assessment=>{const cached=assessmentCache.get(f);if(cached)return cached;const T=f.ids.map(get) as [P,P,P];let maxTargetError=0,maxPhysicalError=0,maxInheritedPhysicalError=0,maxWorsening=0;
  const original=f.source.map(i=>point(base.positions,i)) as [P,P,P];
  const evaluate=(x:number,z:number,y:number,physical:number)=>{const q=bary(...original,x,z),oldY=weighted(original,[q[0],q[1],1-q[0]-q[1]])[1],error=Math.abs(y-physical),old=Math.abs(oldY-physical);maxPhysicalError=Math.max(maxPhysicalError,error);maxInheritedPhysicalError=Math.max(maxInheritedPhysicalError,old);maxWorsening=Math.max(maxWorsening,error-Math.max(.06,old));};
  for(const w of weights){const q=weighted(T,w),t=target(f.source,q[0],q[2]);maxTargetError=Math.max(maxTargetError,Math.abs(q[1]-t.y));evaluate(q[0],q[2],q[1],t.physical);}
  const minX=Math.min(...T.map(p=>p[0])),maxX=Math.max(...T.map(p=>p[0])),minZ=Math.min(...T.map(p=>p[2])),maxZ=Math.max(...T.map(p=>p[2]));
  for(const g of analyticGrids){const x0=Math.max(g.ix0,Math.ceil((minX-g.offset)/DENSITY-1e-8)),x1=Math.min(g.ix1,Math.floor((maxX-g.offset)/DENSITY+1e-8)),z0=Math.max(g.iz0,Math.ceil((minZ-g.offset)/DENSITY-1e-8)),z1=Math.min(g.iz1,Math.floor((maxZ-g.offset)/DENSITY+1e-8));
   for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){const x=ix*DENSITY+g.offset,z=iz*DENSITY+g.offset,q=bary(...T,x,z),w=[q[0],q[1],1-q[0]-q[1]] as const;if(w.some(v=>v< -1e-10))continue;
    const key=(iz-g.iz0)*g.cols+ix-g.ix0;let physical=g.values[key]!;if(Number.isNaN(physical)){physical=patch.baselineHeight(x,z);g.values[key]=physical;uniqueAnalyticGridSamples++;}
    if(!Number.isFinite(physical))throw new Error('Nonfinite physical collar density sample');evaluate(x,z,weighted(T,w)[1],physical);gridProbeEvaluations++;
   }
  }
  for(let j=0;j<3;j++){const a=T[j]!,b=T[(j+1)%3]!,n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/DENSITY));for(let k=0;k<=n;k++){const t=k/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;evaluate(x,z,a[1]+(b[1]-a[1])*t,patch.baselineHeight(x,z));edgeProbeEvaluations++;}}
  const result={maxTargetError,maxPhysicalError,maxInheritedPhysicalError,maxWorsening,bad:maxWorsening>ROUNDING};assessmentCache.set(f,result);return result;
 };
 // V3's2mm target heuristic over-refined inherited banks and exhausted8192
 // faces. It is retained as a diagnostic, not substituted for acceptance.
 // Refine only actual introduced/worsened physical-to-drawn errors. Exact
 // shared edges, the same6cm usable threshold and the allocation stay fixed.
 let current=conforming,refinementPasses=0;const refinementHistory:GroundCollarProof['refinementHistory']=[];
 const edgeKey=(a:number,b:number)=>a<b?a+':'+b:b+':'+a;
 for(;refinementPasses<MAX_PASSES;refinementPasses++){
  const splitEdges=new Map<string,{a:number;b:number;source:Triple}>(),checks=current.map(assess);
  refinementHistory.push({pass:refinementPasses,triangles:current.length,failingPhysicalFaces:checks.filter(q=>q.bad).length,maxTargetError:Math.max(0,...checks.map(q=>q.maxTargetError)),maxWorsening:Math.max(0,...checks.map(q=>q.maxWorsening))});
  for(let fi=0;fi<current.length;fi++){const f=current[fi]!;if(!checks[fi]!.bad)continue;let selected:{a:number;b:number;length:number}|undefined;for(let j=0;j<3;j++){const a=f.ids[j]!,b=f.ids[(j+1)%3]!,A=get(a),C=get(b),length=Math.hypot(A[0]-C[0],A[2]-C[2]);if(!selected||length>selected.length)selected={a,b,length};}const e=selected!;splitEdges.set(edgeKey(e.a,e.b),{a:e.a,b:e.b,source:f.source});}
  if(!splitEdges.size)break;
  const mids=new Map<string,number>();for(const[key,e]of splitEdges){const a=get(e.a),b=get(e.b),mid=node(e.source,(a[0]+b[0])/2,(a[2]+b[2])/2);if(mid===e.a||mid===e.b)throw new Error('Collar refinement reached Float32 plan resolution');mids.set(key,mid);}
  const next:Face[]=[];
  for(const f of current){const[A,C,D]=f.ids,m=[mids.get(edgeKey(A,C)),mids.get(edgeKey(C,D)),mids.get(edgeKey(D,A))],count=m.filter(q=>q!==undefined).length;
   if(!count){next.push(f);continue;}
   if(count===3){addFace(next,A,m[0]!,m[2]!,f.source);addFace(next,m[0]!,C,m[1]!,f.source);addFace(next,m[2]!,m[1]!,D,f.source);addFace(next,m[0]!,m[1]!,m[2]!,f.source);continue;}
   if(count===1){const j=m.findIndex(q=>q!==undefined),a=f.ids[j]!,b=f.ids[(j+1)%3]!,c=f.ids[(j+2)%3]!,v=m[j]!;addFace(next,a,v,c,f.source);addFace(next,v,b,c,f.source);continue;}
   const j=m.findIndex((q,k)=>q!==undefined&&m[(k+1)%3]!==undefined),a=f.ids[j]!,b=f.ids[(j+1)%3]!,c=f.ids[(j+2)%3]!,u=m[j]!,v=m[(j+1)%3]!;
   addFace(next,a,u,c,f.source);addFace(next,u,v,c,f.source);addFace(next,u,b,v,f.source);
  }
  if(next.length>MAX_FACES)throw Object.assign(new Error('Render collar exceeded its bounded8192-face allocation'),{proof:{refinementPasses,triangles:next.length,outer,refinementHistory}});current=next;
 }
 const assessments=current.map(assess),failed=assessments.map((a,i)=>({...a,index:i})).filter(a=>a.bad);
 if(failed.length)throw Object.assign(new Error('Render collar failed unchanged no-worsened inherited-or6cm physical error bound'),{proof:{outer,refinementPasses,triangles:current.length,refinementHistory,failures:failed.slice(0,30)}});
 // Share every final collar boundary node with the exterior triangle that
 // touches it. Collinear subdivision preserves that original exterior plane;
 // strictly exterior faces remain verbatim. This also covers native grid
 // edges that happen to coincide with the collar's outer rectangle.
 const actualOuterIds=new Set<number>();for(const f of current)for(let j=0;j<3;j++){const a=f.ids[j]!,b=f.ids[(j+1)%3]!;if(planes(outer).some(([axis,fixed])=>onSide(get(a),get(b),outer,axis,fixed))){actualOuterIds.add(a);actualOuterIds.add(b);}}
 const outerNodes=[...actualOuterIds].map(index=>({index,point:get(index)})),exterior:Face[]=[];
 for(const f of exteriorFaces){const polygon:number[]=[];let changed=false;
  for(let j=0;j<3;j++){const a=f.ids[j]!,b=f.ids[(j+1)%3]!,A=get(a),C=get(b);polygon.push(a);// An unchanged grid edge can extend beyond an outer corner; its overlapping
   // interval still needs the actual collar corner and subdivision knots.
   if(!planes(outer).some(([axis,fixed])=>overlapsSide(A,C,outer,axis,fixed)))continue;
   const dx=C[0]-A[0],dz=C[2]-A[2],length2=dx*dx+dz*dz,between=outerNodes.map(n=>({index:n.index,t:((n.point[0]-A[0])*dx+(n.point[2]-A[2])*dz)/length2})).filter(q=>q.t>1e-8&&q.t<1-1e-8&&Math.abs((get(q.index)[0]-A[0])*dz-(get(q.index)[2]-A[2])*dx)<1e-10).sort((a,b)=>a.t-b.t);
   for(const q of between)polygon.push(q.index);if(between.length)changed=true;
  }
  if(!changed){exterior.push(f);continue;}
  const cx=polygon.reduce((sum,id)=>sum+get(id)[0],0)/polygon.length,cz=polygon.reduce((sum,id)=>sum+get(id)[2],0)/polygon.length,index=node(f.source,cx,cz);
  for(let j=0;j<polygon.length;j++)addFace(exterior,index,polygon[j]!,polygon[(j+1)%polygon.length]!,f.source);
 }
 const exteriorBoundaryAddedTriangles=exterior.length-exteriorFaces.length;
 if(current.length+exteriorBoundaryAddedTriangles>MAX_FACES)throw Object.assign(new Error('Collar and shared exterior subdivisions exceed unchanged8192-face bound'),{proof:{collarTriangles:current.length,exteriorBoundaryAddedTriangles,refinementHistory}});
 const exteriorEdges=new Map<string,number>();for(const f of exterior)for(let j=0;j<3;j++){const key=edgeKey(f.ids[j]!,f.ids[(j+1)%3]!);exteriorEdges.set(key,(exteriorEdges.get(key)??0)+1);}
 let sharedOuterEdges=0;for(const f of current)for(let j=0;j<3;j++){const a=f.ids[j]!,b=f.ids[(j+1)%3]!,A=get(a),C=get(b);if(planes(outer).some(([axis,fixed])=>onSide(A,C,outer,axis,fixed))){const count=exteriorEdges.get(edgeKey(a,b))??0;if(count!==1)throw Object.assign(new Error('Collar outer edge does not share exactly one actual exterior edge'),{proof:{a:A,b:C,count}});sharedOuterEdges++;}}
 const edgeCounts=new Map<string,{a:number;b:number;count:number}>();for(const f of current)for(let j=0;j<3;j++){const a=f.ids[j]!,b=f.ids[(j+1)%3]!,key=edgeKey(a,b),old=edgeCounts.get(key);if(old)old.count++;else edgeCounts.set(key,{a,b,count:1});}
 const badEdges=[...edgeCounts.values()].filter(e=>{if(e.count===2)return false;if(e.count!==1)return true;const a=get(e.a),b=get(e.b);return![B,outer].some(box=>planes(box).some(([axis,fixed])=>onSide(a,b,box,axis,fixed)));});
 if(badEdges.length)throw Object.assign(new Error('Render collar has an unmatched or nonmanifold interior edge'),{proof:{count:badEdges.length,edges:badEdges.slice(0,30).map(e=>({...e,a:get(e.a),b:get(e.b)})),triangles:current.length}});
 // Source-face ownership is preserved through refinement. Thus each measured
 // join segment is linear on both sides; endpoints plus interior probes retain
 // the actual Float32 residual rather than claiming mathematical zero.
 for(const f of current)for(let j=0;j<3;j++){
  const a=get(f.ids[j]!),b=get(f.ids[(j+1)%3]!);
  for(const[box,inner]of[[B,true],[outer,false]] as const)for(const[axis,fixed]of planes(box))if(onSide(a,b,box,axis,fixed)){
   for(const u of[0,.25,.5,.75,1]){const q=a.map((v,k)=>v+(b[k]!-v)*u) as unknown as P,expected=inner?patch.floorAt(q[0],q[2])?.y:sourceAt(f.source,q[0],q[2]).y;if(expected===undefined)throw new Error('Missing shared core floor at actual collar join');const delta=q[1]-expected;boundaryGaps.push({x:q[0],z:q[2],base:expected,patch:q[1],delta});maxBoundaryDrawnGap=Math.max(maxBoundaryDrawnGap,Math.abs(delta));if(inner){innerJoinSamples++;const old=sourceAt(f.source,q[0],q[2]).y,difference=expected-old;inheritedCoreBoundaryGaps.push({x:q[0],z:q[2],base:old,patch:expected,delta:difference});maxInheritedCoreBoundaryGap=Math.max(maxInheritedCoreBoundaryGap,Math.abs(difference));}else outerJoinSamples++;}
  }
 }
 if(!innerJoinSamples||!outerJoinSamples||maxBoundaryDrawnGap>1e-6)throw Object.assign(new Error('Render collar does not close both actual Float32 edges'),{proof:{innerJoinSamples,outerJoinSamples,maxBoundaryDrawnGap,outer}});
 for(const f of exterior)indices.push(...f.ids);
 for(const f of current)indices.push(...f.ids);
 const patchIndexStart=indices.length;for(const i of patch.lattice.indices)indices.push(baseVertices+i);const patchIndexCount=indices.length-patchIndexStart;
 const collarProof:GroundCollarProof={width:WIDTH,triangles:current.length,refinementPasses,maxTargetError:Math.max(0,...assessments.map(a=>a.maxTargetError)),maxPhysicalError:Math.max(0,...assessments.map(a=>a.maxPhysicalError)),maxInheritedPhysicalError:Math.max(0,...assessments.map(a=>a.maxInheritedPhysicalError)),maxWorseningBeyondInheritedOrSixCm:Math.max(0,...assessments.map(a=>a.maxWorsening)),innerJoinSamples,outerJoinSamples,inheritedCoreBoundaryGaps,maxInheritedCoreBoundaryGap,sharedOuterEdges,exteriorBoundaryAddedTriangles,densityProof:{planStep:DENSITY,planOffsets:offsets,edgeStep:DENSITY,uniqueAnalyticGridSamples,gridProbeEvaluations,edgeProbeEvaluations,cacheBytes:analyticGrids.reduce((n,g)=>n+g.values.byteLength,0),finiteSampling:true},targetApproximation:{reference:TARGET_ERROR,facesAboveReference:assessments.filter(a=>a.maxTargetError>TARGET_ERROR).length,acceptanceGate:false},refinementHistory};
 return{positions:new Float32Array(positions),indices:new Uint32Array(indices),baseVertices,patchVertices,recipes,patchIndexStart,patchIndexCount,seamTriangles:0,clippedBaseTriangles,boundaryGaps,maxBoundaryDrawnGap,collarProof};
}
export function composeGroundColors(out:Float32Array,base:Float32Array,patch:Float32Array,render:GroundRender){out.set(base);out.set(patch,render.baseVertices*3);for(const r of render.recipes){const source=r.source==='base'?base:patch;for(let j=0;j<3;j++){let value=r.ids.reduce((sum,id,k)=>sum+source[id*3+j]!*r.weights[k]!,0);if(r.patchBlend){const b=r.patchBlend,to=b.ids.reduce((sum,id,k)=>sum+patch[id*3+j]!*b.weights[k]!,0);value+=(to-value)*b.amount;}out[r.vertex*3+j]=value;}}}
