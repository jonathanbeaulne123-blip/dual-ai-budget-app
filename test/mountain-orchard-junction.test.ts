import {describe,it,expect} from 'vitest';
import data from '../src/harbour/mountain/orchardJunction.generated.json';
import {ORCHARD_LANE_AUTHORED_CENTRE,ORCHARD_LANE_CENTRE} from '../src/harbour/mountain/roadLine.ts';
import {MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,GORGE_BRIDGES} from '../src/harbour/mountain/roads.ts';
import {BRIDGE_SPANS} from '../src/harbour/mountain/bridges.ts';
import {orchardJunctionAt,ORCHARD_JUNCTION_POINTS,ORCHARD_JUNCTION_TRIANGLES,capOrchardGroundLattice} from '../src/harbour/mountain/orchardJunction.ts';
import {drawnRoadFloor} from '../src/harbour/horizon/regions/mountainV2/drawnRoadFloor.ts';
import {WORLD_SURFACES,worldDeckAt} from '../src/harbour/mountain/surfaces.ts';
import {checkGround} from './orchard-ground-witnesses.mjs';

describe('chosen shared Orchard approach and bounded b0 fairing',()=>{
 it('retains every lane XY, b0 span/width, and all lane XYZ from row26 onward',()=>{
  expect(ORCHARD_LANE_CENTRE).toHaveLength(ORCHARD_LANE_AUTHORED_CENTRE.length);
  ORCHARD_LANE_CENTRE.forEach((p,i)=>{
   const old=ORCHARD_LANE_AUTHORED_CENTRE[i]!;expect([p[0],p[2]]).toEqual([old[0],old[2]]);
   if(i>=26)expect(p).toEqual(old);
  });
  const b0=BRIDGE_SPANS.find(b=>b.id==='b0')!;expect([b0.i0,b0.i1]).toEqual([9,47]);
  expect(GORGE_BRIDGES.find(b=>b.id==='b0')!.deckThickness).toBe(1.6);
  expect(ORCHARD_LANE_LINE.samples.every(s=>s.halfWidth===3.2)).toBe(true);
  // The import-only expected data is the original source, not the proposed field.
  data.expectedLane.forEach((p,i)=>expect(ORCHARD_LANE_AUTHORED_CENTRE[i]).toEqual(p.at));
  for(const pair of data.expectedRoad){const [i,p]=pair as unknown as [number,typeof data.expectedLane[number]];const actual=MOUNTAIN_ROAD_LINE.samples[i]!;expect({at:actual.at,normal:actual.normal,halfWidth:actual.halfWidth}).toEqual(p);}
 });
 it('uses the unchanged actual main triangles throughout the geometric overlap',()=>{
  const rows=MOUNTAIN_ROAD_LINE.samples.map(s=>[-s.halfWidth,-s.halfWidth+.55,-.45,.45,s.halfWidth-.55,s.halfWidth].map(w=>[s.at[0]+s.normal[0]*w,s.at[1],s.at[2]+s.normal[2]*w] as const));
  const main=drawnRoadFloor(rows),lane=WORLD_SURFACES.find(s=>s.id==='orchard-lane')!;
  ORCHARD_JUNCTION_TRIANGLES.forEach((ids,i)=>{
   const pts=ids.map(k=>ORCHARD_JUNCTION_POINTS[k]!);
   for(const weights of [[1,0,0],[0,1,0],[0,0,1],[1/3,1/3,1/3]]){
    const p=[0,1,2].map(k=>pts.reduce((n,q,j)=>n+q[k]!*weights[j]!,0)),hit=orchardJunctionAt(p[0]!,p[2]!)!;
    expect(hit).not.toBeNull();expect(Math.abs(hit.y-p[1]!)).toBeLessThan(1e-7);
    expect(Math.abs(worldDeckAt(lane,p[0]!,p[2]!)!.point[1]-p[1]!)).toBeLessThan(1e-7);
    if(data.ownership[i]==='overlap')expect(Math.abs(main(p[0]!,p[2]!)!.y-p[1]!)).toBeLessThan(1e-7);
   }
  });
 });
 it('keeps every new longitudinal triangle direction at12% or less, without waiving original main geometry',()=>{
  ORCHARD_JUNCTION_TRIANGLES.forEach((ids,i)=>{
   if(data.ownership[i]==='overlap')return;
   const [a,b,c]=ids.map(k=>ORCHARD_JUNCTION_POINTS[k]!),ux=b![0]-a![0],uz=b![2]-a![2],vx=c![0]-a![0],vz=c![2]-a![2],det=ux*vz-uz*vx;
   const gx=((b![1]-a![1])*vz-(c![1]-a![1])*uz)/det,gz=(ux*(c![1]-a![1])-vx*(b![1]-a![1]))/det;
   const band=data.bands[i]!,sa=ORCHARD_LANE_LINE.samples[band-1]!,sb=ORCHARD_LANE_LINE.samples[band]!;
   for(const w of [-3.2,-2,0,2,3.2]){
    const dx=sb.at[0]+sb.normal[0]*w-sa.at[0]-sa.normal[0]*w,dz=sb.at[2]+sb.normal[2]*w-sa.at[2]-sa.normal[2]*w;
    expect(Math.abs((gx*dx+gz*dz)/Math.hypot(dx,dz))).toBeLessThanOrEqual(.12);
   }
  });
 });
 it('preserves flat masonry cross-sections and limits the b0 lowering to the proposed36.2cm',()=>{
  for(let i=8;i<=26;i++){
   const s=ORCHARD_LANE_LINE.samples[i]!,delta=s.at[1]-ORCHARD_LANE_AUTHORED_CENTRE[i]![1];expect(delta).toBeGreaterThanOrEqual(-.362);expect(delta).toBeLessThanOrEqual(1e-12);
   for(const w of [-3.2,-2,0,2,3.2])expect(Math.abs(orchardJunctionAt(s.at[0]+s.normal[0]*w,s.at[2]+s.normal[2]*w)!.y-s.at[1])).toBeLessThan(1e-7);
  }
 });
 it('clips coarse drawn ground below the real deck between vertices, verified independently',()=>{
  // A deliberately high two-triangle terrain cell crosses many small deck triangles.
  // Its corners alone do not characterize any of those road/ground intersections.
  const positions=new Float32Array([10,30,-105,25,30,-105,25,30,-90,10,30,-90]),indices=new Uint32Array([0,1,2,0,2,3]),original=positions.slice();
  capOrchardGroundLattice({positions,indices});
  const proof=checkGround(positions,indices,ORCHARD_JUNCTION_POINTS,ORCHARD_JUNCTION_TRIANGLES);
  expect(proof.witnesses).toBeGreaterThan(100);expect(proof.pass).toBe(true);
  for(let i=0;i<positions.length;i++)if(i%3!==1)expect(positions[i]).toBe(original[i]);else expect(positions[i]!).toBeLessThanOrEqual(original[i]!);
  expect(Array.from(indices)).toEqual([0,1,2,0,2,3]);
 });
});
