import {describe,it,expect} from 'vitest';
import {groundMasks,type Lattice,type GroundMasks} from '../src/harbour/scene/groundPaint.ts';
import type {RenderTier} from '../src/harbour/scene/quality.ts';

function lattice(xs:number[],height:(x:number,z:number)=>number):Lattice{
 const zs=[-40,-39],positions=Float32Array.from(zs.flatMap(z=>xs.flatMap(x=>[x,height(x,z),z])));
 return {positions,indices:new Uint32Array(),cols:xs.length-1,rows:1,xs:Float32Array.from(xs),zs:Float32Array.from(zs)};
}
describe('placed ground generations cannot reuse another landscape paint mask',()=>{
 it('isolates different same-tier grids and height fields from the native default cache',()=>{
  const nativeHeight=()=>1,placedHeight=(x:number)=>2+x*.25;
  const native=lattice([-30,-29],nativeHeight),placed=lattice([-30,-29,-28],placedHeight);
  const original=groundMasks(native,'lite',nativeHeight),nativeSlopes=original.slope.slice();
  const firstCache=new Map<RenderTier,GroundMasks>(),secondCache=new Map<RenderTier,GroundMasks>();
  const first=groundMasks(placed,'lite',placedHeight,firstCache),second=groundMasks(native,'lite',nativeHeight,secondCache);
  expect(first.n).toBe(6);expect(second.n).toBe(4);
  expect(Array.from(first.slope)).toEqual(Array(6).fill(.25));
  expect(Array.from(second.slope)).toEqual(Array(4).fill(0));
  expect(first).not.toBe(original);expect(second).not.toBe(original);expect(second).not.toBe(first);
  expect(groundMasks(placed,'lite',placedHeight,firstCache)).toBe(first);
  expect(groundMasks(native,'lite',nativeHeight)).toBe(original);
  expect(original.slope).toEqual(nativeSlopes);
 });
});
