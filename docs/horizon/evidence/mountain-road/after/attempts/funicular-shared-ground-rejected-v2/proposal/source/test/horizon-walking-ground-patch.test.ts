import {describe,it,expect} from 'vitest';
import {createWalkingGroundPatch,composeWalkingGround,composeGroundColors,paintWalkingGroundPatch,type PatchLattice} from '../src/harbour/horizon/regions/mountainV2/walkingGroundPatch.ts';
import type {CapTriangle} from '../src/harbour/geometry/capGroundMesh.ts';
const deck:CapTriangle[]=[[[0,.9,0],[0,.9,1],[1,.9,1]],[[0,.9,0],[1,.9,1],[1,.9,0]]];
const baseline=(x:number,z:number)=>1+x*.02+z*.01;
const ceiling=(x:number,z:number)=>x>=-.5&&x<=1.5&&z>=-.5&&z<=1.5?.87:null;
const patch=()=>createWalkingGroundPatch(deck,baseline,ceiling,()=>true);
function grid(step:number):Pick<PatchLattice,'positions'|'indices'>{
 const p:number[]=[],i:number[]=[],n=Math.round(12/step);
 for(let z=0;z<=n;z++)for(let x=0;x<=n;x++)p.push(-5+x*step,baseline(-5+x*step,-5+z*step),-5+z*step);
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;i.push(a,c,d,a,d,b);}
 return{positions:new Float32Array(p),indices:new Uint32Array(i)};
}
describe('one physical and drawn local ground patch',()=>{
 it('queries the exact final Float32 face height and normal, not the analytic input',()=>{
  const p=patch();let changed=0;
  for(let k=0;k<p.lattice.indices.length;k+=3){
   const t=Array.from(p.lattice.indices.slice(k,k+3),i=>Array.from(p.lattice.positions.slice(i*3,i*3+3))),[a,b,c]=t;
   const x=(a![0]!+b![0]!+c![0]!)/3,z=(a![2]!+b![2]!+c![2]!)/3,f=p.floorAt(x,z)!;
   expect(f.y).toBeCloseTo((a![1]!+b![1]!+c![1]!)/3,12);
   const u=b!.map((v,j)=>v-a![j]!),v=c!.map((v,j)=>v-a![j]!),n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!],len=Math.hypot(...n);
   expect(f.nx).toBeCloseTo(n[0]!/len,12);expect(f.ny).toBeCloseTo(n[1]!/len,12);expect(f.nz).toBeCloseTo(n[2]!/len,12);
   if(Math.abs(f.y-baseline(x,z))>.01)changed++;
  }
  expect(changed).toBeGreaterThan(0);expect(p.proof.maxTopDegrees).toBeLessThanOrEqual(40);
  expect(p.floorAt(p.bounds.x1+.0001,0)).toBeNull();
 });
 it('uses identical canonical top triangles in two different existing render grids',()=>{
  const p=patch(),outputs=[.8,1.5].map(step=>composeWalkingGround(grid(step),p));
  for(const r of outputs){expect(r.positions.slice(r.baseVertices*3,(r.baseVertices+r.patchVertices)*3)).toEqual(p.lattice.positions);
   expect(Array.from(r.indices.slice(r.patchIndexStart,r.patchIndexStart+r.patchIndexCount),i=>i-r.baseVertices)).toEqual(Array.from(p.lattice.indices));}
  expect(outputs[0]!.clippedBaseTriangles).toBeGreaterThan(0);expect(outputs[1]!.clippedBaseTriangles).toBeGreaterThan(0);
 });
 it('retains original outside grid vertices and original wholly outside faces',()=>{
  const p=patch(),base=grid(.8),positions=base.positions.slice(),indices=base.indices.slice(),r=composeWalkingGround(base,p);
  expect(base.positions).toEqual(positions);expect(base.indices).toEqual(indices);expect(r.positions.slice(0,positions.length)).toEqual(positions);
  const triples=new Set(Array.from({length:r.indices.length/3},(_,k)=>Array.from(r.indices.slice(k*3,k*3+3)).join(',')));
  for(let k=0;k<base.indices.length;k+=3){const ids=Array.from(base.indices.slice(k,k+3)),x=ids.map(i=>base.positions[3*i]!),z=ids.map(i=>base.positions[3*i+2]!);
   if(Math.max(...x)<p.bounds.x0||Math.min(...x)>p.bounds.x1||Math.max(...z)<p.bounds.z0||Math.min(...z)>p.bounds.z1)expect(triples.has(ids.join(','))).toBe(true);}
 });
 it('restores baseline bitwise through the finite outer ring and rejects an escaping cut',()=>{
  const p=patch();expect(p.proof.outerRingChanged).toBe(0);expect(p.proof.outerRing).toBe(2);
  for(let k=0;k<p.lattice.positions.length;k+=3){const[x,y,z]=p.lattice.positions.slice(k,k+3);if(x!< -1.5||x!>2.5||z!< -1.5||z!>2.5)expect(y).toBe(Math.fround(baseline(x!,z!)));}
  expect(()=>createWalkingGroundPatch(deck,baseline,()=>.87,()=>true)).toThrow(/outer ring/);
  expect(()=>createWalkingGroundPatch(deck,baseline,ceiling,(x)=>x<2)).toThrow(/unowned/);
 });
 it('preserves original paint and applies the exact source interpolation to clipped vertices',()=>{
  const p=patch(),base=grid(.8),r=composeWalkingGround(base,p),baseColors=Float32Array.from(base.positions,(_,i)=>(i%17)/17),patchColors=Float32Array.from(p.lattice.positions,(_,i)=>(i%11)/11),out=new Float32Array(r.positions.length);
  composeGroundColors(out,baseColors,patchColors,r);expect(out.slice(0,baseColors.length)).toEqual(baseColors);expect(out.slice(baseColors.length,baseColors.length+patchColors.length)).toEqual(patchColors);
  expect(r.recipes.length).toBeGreaterThan(0);for(const q of r.recipes)for(let c=0;c<3;c++){const src=q.source==='base'?baseColors:patchColors;expect(out[q.vertex*3+c]).toBe(Math.fround(q.ids.reduce((sum,id,k)=>sum+src[id*3+c]!*q.weights[k]!,0)));}
 });
 it('refines only perimeter cells and queries every added face with complete stamped-paint interpolation',()=>{
  const curved=(x:number,z:number)=>1+.1*Math.sin(x*4),high:CapTriangle[]=[[[0,10,0],[0,10,1],[1,10,1]],[[0,10,0],[1,10,1],[1,10,0]]];
  const p=createWalkingGroundPatch(high,curved,()=>null,()=>true);
  expect(p.proof.boundaryRefinement.addedVertices).toBeGreaterThan(0);expect(p.proof.maxBoundaryPhysicalDelta).toBeLessThanOrEqual(.02);
  expect(p.paintLattice.positions.length/3).toBe((p.paintLattice.cols+1)*(p.paintLattice.rows+1));
  expect(p.paintRecipes.length).toBe(p.lattice.positions.length/3-p.paintLattice.positions.length/3);
  for(const recipe of p.paintRecipes){const x=p.lattice.positions[recipe.vertex*3]!,z=p.lattice.positions[recipe.vertex*3+2]!;expect(Math.min(x-p.bounds.x0,p.bounds.x1-x,z-p.bounds.z0,p.bounds.z1-z)).toBeLessThanOrEqual(.5);}
  const source=new Float32Array(p.paintLattice.positions.length).fill(.37),colors=new Float32Array(p.lattice.positions.length);
  paintWalkingGroundPatch(colors,source,p);expect(Array.from(colors).every(v=>Math.abs(v-.37)<1e-7)).toBe(true);
  for(let k=0;k<p.lattice.indices.length;k+=3){const ids=Array.from(p.lattice.indices.slice(k,k+3)),q=[0,1,2].map(c=>ids.reduce((n,id)=>n+p.lattice.positions[id*3+c]!,0)/3),f=p.floorAt(q[0]!,q[2]!);expect(f).not.toBeNull();expect(f!.y).toBeCloseTo(q[1]!,10);}
 });

});
