import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {WORLD_SURFACES,worldDeckAt} from '../src/harbour/mountain/surfaces.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {REGION_ROAD} from '../src/harbour/horizon/regions/mountainV2/geography.ts';
import {SKATE_TUNING} from '../src/harbour/skate/sim/tuning.ts';

describe('library entry actual road edge',()=>{
 it('preserves the roof and clears native ground without a board-stopping road lip',()=>{
  const deck=WORLD_SURFACES.find(s=>s.id==='library-balcony')!,road=WORLD_SURFACES.find(s=>s.id==='mountain-road')!,rows=deck.landingRows!;
  expect(createHash('sha256').update(JSON.stringify(rows.slice(12,28))).digest('hex')).toBe('6ffd4d9e3f33bc220ab39f4e2220693017b3cd35f410c04ed3d8747a4272d78f');
  let clearance=Infinity,rise=0,horizonRise=0,edgeSamples=0,horizonSamples=0;
  for(let i=1;i<=12;i++)for(let k=1;k<5;k++){
   const a=rows[i-1]![k-1]!,b=rows[i]![k-1]!,c=rows[i]![k]!,d=rows[i-1]![k]!;
   for(const[p,q,r]of[[a,b,c],[a,c,d]]){
    const n=Math.ceil(Math.max(Math.hypot(q![0]-p![0],q![2]-p![2]),Math.hypot(r![0]-p![0],r![2]-p![2]))/.02);
    for(let u=0;u<=n;u++)for(let v=0;v<=n-u;v++){
     const x=p![0]+(q![0]-p![0])*u/n+(r![0]-p![0])*v/n,z=p![2]+(q![2]-p![2])*u/n+(r![2]-p![2])*v/n,y=p![1]+(q![1]-p![1])*u/n+(r![1]-p![1])*v/n,host=worldDeckAt(road,x,z)!;
     if(host.distance>host.halfWidth)clearance=Math.min(clearance,y-groundHeightAt(x,z));
     // Include both sides of the actual ownership boundary, not the fine design line.
     if(Math.abs(host.distance-host.halfWidth)<.5){
      const drawn=worldDeckAt(REGION_ROAD,x,z);
      if(drawn&&Math.abs(drawn.distance-drawn.halfWidth)<.04){horizonSamples++;horizonRise=Math.max(horizonRise,Math.abs(y-drawn.point[1]));}
     }
     if(Math.abs(host.distance-host.halfWidth)<.04){edgeSamples++;rise=Math.max(rise,Math.abs(y-host.point[1]));}
    }
   }
  }
  expect(horizonSamples).toBeGreaterThan(100);expect(horizonRise).toBeLessThanOrEqual(SKATE_TUNING.WALL_STEP);
  expect(edgeSamples).toBeGreaterThan(100);expect(clearance).toBeGreaterThanOrEqual(0);expect(rise).toBeLessThanOrEqual(SKATE_TUNING.WALL_STEP);
 });
});
