import {describe,it,expect} from 'vitest';
import {REGION_ORCHARD,REGION_ROAD,createRegionGeography} from '../src/harbour/horizon/regions/mountainV2/geography.ts';
import {drawnRoadFloor} from '../src/harbour/horizon/regions/mountainV2/drawnRoadFloor.ts';
import {WORLD_SURFACES,worldDeckAt} from '../src/harbour/mountain/surfaces.ts';
import {ORCHARD_LANE_LINE} from '../src/harbour/mountain/roads.ts';

describe('Orchard uses its drawn footprint in Horizon',()=>{
 it('does not extend a phantom endpoint cap into the main road bicycle wheel',()=>{
  const x=18.830966672260956,z=-93.64012470208559;
  const old=worldDeckAt(WORLD_SURFACES.find(s=>s.id==='orchard-lane')!,x,z)!;
  expect(old.t).toBe(0); // This legacy native query is retained; it is not the drawn footprint.
  const lane=drawnRoadFloor(REGION_ORCHARD.landingRows!),road=drawnRoadFloor(REGION_ROAD.landingRows!);
  expect(lane(x,z)).toBeNull();const drawn=road(x,z)!;
  expect(old.point[1]-drawn.y).toBeGreaterThan(.10);
  const hit=createRegionGeography().provider.surface(x+1308,z+764,69.736842444,.5)!;
  expect(hit.id).toBe('mountainV2:mountain-road');expect(hit.y).toBeCloseTo(drawn.y+54,8);
 });
 it('retains support on the actual interior orchard triangles',()=>{
  const sample=ORCHARD_LANE_LINE.samples[10]!,floor=drawnRoadFloor(REGION_ORCHARD.landingRows!);
  expect(floor(sample.at[0],sample.at[2])!.y).toBeCloseTo(sample.at[1],8);
  expect(worldDeckAt(REGION_ORCHARD,sample.at[0],sample.at[2])!.point[1]).toBeCloseTo(sample.at[1],8);
 });
});
