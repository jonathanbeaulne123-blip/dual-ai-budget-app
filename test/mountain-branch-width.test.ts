import {describe,expect,it} from 'vitest';
import awning from '../src/harbour/mountain/generated/awning-landing.json';
import {landingHalfWidthAt,landingPointAt,landingSample,type LandingRows} from '../src/harbour/mountain/branchLandings.ts';

const rows=awning.rows as unknown as LandingRows;
describe('explicit branch width and triangle stations',()=>{
 it('uses the rendered diagonal on a non-planar cell, rather than bilinear height',()=>{
  const cell:LandingRows=[[[0,0,0],[2,4,0]],[[0,2,2],[2,10,2]]];
  expect(landingPointAt(cell,1,.75,.25)).toEqual([.5,3.5,1.5]);
  expect(landingPointAt(cell,1,.25,.75)).toEqual([1.5,4.5,.5]);
  expect(landingSample(cell,.5,1.5)?.y).toBe(3.5);
  expect(landingSample(cell,1.5,.5)?.y).toBe(4.5);
 });
 it('reports the retained rail width and actual approved taper, including its interpolated rows',()=>{
  expect(awning.lockedRows).toBe(9);
  for(let row=0;row<9;row++)expect(landingHalfWidthAt(rows,Math.max(1,row),row===0?0:1)).toBeCloseTo(1.5,10);
  // Original coarse taper rows are 1.425,1.35,1.275,1.2; inserted rows interpolate
  // the edge positions, so rotating frames need not retain the mean scalar width.
  for(const [row,width] of [[10,1.425],[12,1.35],[14,1.275],[16,1.2],[34,1.2]] as const)expect(landingHalfWidthAt(rows,row,1)).toBeCloseTo(width,10);
  expect(landingHalfWidthAt(rows,9,1)).toBeCloseTo(1.3709341597170752,10);
  expect(landingHalfWidthAt(rows,17,1)).toBeCloseTo(1.1992777993598196,10);
 });
 it('keeps a former constant-width witness outside the deck while supporting its actual edge station',()=>{
  // This is the retained failed witness; correcting metadata must not invent a
  // floor outside the generated polygon to satisfy the old 1.5m capsule.
  expect(landingSample(rows,34.193965060209344,-92.8575444452353)).toBeNull();
  const [x,y,z]=landingPointAt(rows,9,.5,.975);
  expect(landingSample(rows,x,z)?.y).toBeCloseTo(y,10);
 });
});
