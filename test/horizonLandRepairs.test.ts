import { describe, expect, it } from 'vitest';
import { gradePadApproaches } from '../src/harbour/horizon/land/beds/padApproaches';
import { addFlatPad, batteredWall, bed, emitBedGeometry } from '../src/harbour/horizon/land/beds/profiles';
import { openRetainingPassages, settleBedEdges } from '../src/harbour/horizon/land/beds/junctions';
import { box, maxGrade, solid } from '../src/harbour/horizon/land/structures/mesh';
import { createHorizonGeography } from '../src/harbour/horizon/runtime/geography';
import { solidVerticalRangeAt } from '../src/harbour/horizon/world/geometry';
import type { LandCuts, TerrainField } from '../src/harbour/horizon/land/interfaces';

const empty = (): LandCuts => ({ beds: [], pads: [], solids: [], mouths: [], waters: [], diagnostics: [] });
it('walks onto a wide junction without hitting its raised edge, with real collision retained', () => {
  const cuts = empty(), route = bed('approach', 'walk', [[0, 0, 50], [50, 4, 50], [100, 8, 50]]);
  cuts.beds.push(route); addFlatPad(cuts, 'junction', 'threshold', [100, 50], 8, [10, 10]);
  gradePadApproaches(cuts); emitBedGeometry(route, cuts, () => 0, [[100, 50]]);
  expect(maxGrade(route.points)).toBeLessThanOrEqual(.120001);
  expect(route.points[0]).toEqual([0, 0, 50]); expect(route.points.at(-1)).toEqual([100, 8, 50]);
  const field: TerrainField = { revision: 'horizon-geo-1', width: 200, depth: 200, step: 10, columns: 21, rows: 21, heights: new Float32Array(441), surfaces: new Uint8Array(441) };
  const geography = createHorizonGeography(field, cuts);
  let y = geography.surface(85, 50)!.y;
  for (let x = 85.1; x <= 100; x += .1) {
    const floor = geography.surface(x, 50, y)!;
    expect(floor, `ground at ${x}`).not.toBeNull();
    expect(geography.blocker(x, 50, Math.max(y, floor.y), .3, [.1, 0]), `edge at ${x}`).toBeNull();
    y = floor.y;
  }
  expect(y).toBeCloseTo(8);
  // The fix is geometry, not a permissive body step or removed slab.
  expect(cuts.solids.some(s => s.id === 'junction.slab')).toBe(true);
});

it.each([true, false])('builds a closed retaining wall with a genuine 1:6 batter (cut=%s)', cut => {
  const wall = solid('wall', 'retainingWall', 'rock', 'wall');
  batteredWall(wall, [0, 6, 0], [10, 6, 0], 5, 1, 0, 6, cut);
  expect(wall.indices).toHaveLength(36);
  for (let i = 0; i < 4; i++) expect(Math.abs(wall.positions[i * 3 + 2]! - wall.positions[(i + 4) * 3 + 2]!)).toBeCloseTo(1);
  expect(Math.min(...wall.positions.filter((_, i) => i % 3 === 1))).toBe(0);
  expect(Math.max(...wall.positions.filter((_, i) => i % 3 === 1))).toBe(6);
});

it('rebuilds visible retaining walls from final ground instead of obsolete terrain', () => {
  const cuts = empty(), route = bed('road', 'road', [[0, 10, 50], [20, 10, 50]]);
  cuts.beds.push(route); emitBedGeometry(route, cuts, () => 100);
  const tops = () => cuts.solids.filter(s => s.kind === 'retainingWall').flatMap(s => s.positions.filter((_, i) => i % 3 === 1));
  expect(Math.max(...tops())).toBeGreaterThan(90);
  settleBedEdges(cuts, () => 0);
  expect(Math.max(...tops())).toBeCloseTo(10);
  expect(cuts.solids.some(s => s.kind === 'parapet')).toBe(true);
});

it('opens a lower route through retaining masonry while preserving the lintel and side walls',()=>{
 const cuts=empty(),upper=bed('upper','road',[[0,8,50],[100,8,50]]),lower=bed('lower','walk',[[50,0,20],[50,0,80]]);
 const wall=solid('upper.retaining','retainingWall','stone','wall',['upper']);box(wall,[50,45],8,[50,.5],-1);cuts.beds.push(upper,lower);cuts.solids.push(wall);
 const field:TerrainField={revision:'horizon-geo-1',width:100,depth:100,step:10,columns:11,rows:11,heights:new Float32Array(121),surfaces:new Uint8Array(121)};
 expect(createHorizonGeography(field,cuts).blocker(50,45,0)).not.toBeNull();
 openRetainingPassages(cuts,[{id:'join',a:'upper',b:'lower',at:[50,50],heightA:8,heightB:0,resolution:'over',requiredClearance:2.4}]);
 const geography=createHorizonGeography(field,cuts);
 expect(geography.blocker(50,45,0)).toBeNull();expect(geography.ceiling(50,45,0)).toBeGreaterThanOrEqual(2.4);
 expect(geography.blocker(30,45,0)).not.toBeNull();expect(geography.blocker(50,45,7)).not.toBeNull();
});

it('cuts junction openings at the foot of a battered wall rather than only at its distant top edge',()=>{
 // Openings follow the joining route's corridor (never a circle round the pad): a walk comes in.
 const cuts=empty(),wall=solid('bank.wall','retainingWall','rock','wall');batteredWall(wall,[0,0,50],[100,0,50],5,1,0,60,true);cuts.solids.push(wall);addFlatPad(cuts,'join','threshold',[50,55],0,[4,4]);cuts.beds.push(bed('approach','walk',[[50,0,50],[50,0,75]],false));
 const field:TerrainField={revision:'horizon-geo-1',width:200,depth:200,step:10,columns:21,rows:21,heights:new Float32Array(441),surfaces:new Uint8Array(441)};
 expect(createHorizonGeography(field,cuts).blocker(50,55,0)).not.toBeNull();settleBedEdges(cuts,()=>0);
 expect(createHorizonGeography(field,cuts).blocker(50,55,0)).toBeNull();expect(cuts.solids.find(s=>s.id==='bank.wall')!.indices.length).toBeGreaterThan(0);
});

it('opens the connected approach through a neighbouring cut before the junction pad',()=>{
 const cuts=empty(),walk=bed('approach','walk',[[50,0,30],[50,0,70]],false);cuts.beds.push(walk);addFlatPad(cuts,'join','threshold',[50,50],0,[4,4]);
 const wall=solid('offset-cut','retainingWall','rock','wall',['other']);box(wall,[50,60],10,[40,.5],-1);cuts.solids.push(wall);
 const field:TerrainField={revision:'horizon-geo-1',width:100,depth:100,step:10,columns:11,rows:11,heights:new Float32Array(121),surfaces:new Uint8Array(121)};
 expect(createHorizonGeography(field,cuts).blocker(50,60,0)).not.toBeNull();settleBedEdges(cuts,()=>0);
 const geography=createHorizonGeography(field,cuts);expect(geography.blocker(50,60,0)).toBeNull();expect(geography.blocker(65,60,0)).not.toBeNull();
});

it('opens rails inside the shared Garden and Year Walk corridor while retaining the outside edge',()=>{
 const cuts=empty(),garden=bed('walk garden','walk',[[50,10,0],[50,10,100]],false),year=bed('yearWalk','walk',[[47,10,0],[47,10,100]],false);
 cuts.beds.push(garden,year);const rail=solid('shared.rail','handrail','metal','rail',['yearWalk']);box(rail,[50,50],11.05,[.1,80],10.96);box(rail,[44,50],11.05,[.1,80],10.96);cuts.solids.push(rail);
 expect(solidVerticalRangeAt(rail,50,50)).not.toBeNull();settleBedEdges(cuts,()=>0);
 expect(solidVerticalRangeAt(rail,50,50)).toBeNull();expect(solidVerticalRangeAt(rail,44,50)).not.toBeNull();
});
describe('A1.1 unsupported beds fail the bake (W5-A)',()=>{
  it('reserves only the Hollow neck (D-C10) and names an owner for every open void',async()=>{
    const {RESERVED_VOIDS,OPEN_VOIDS,RESIDUAL_LIMIT,residualBakeErrors}=await import('../src/harbour/horizon/land/structures/groundBeds');
    expect(RESIDUAL_LIMIT).toBe(1.25);
    expect(RESERVED_VOIDS.map(v=>v.decision)).toEqual(['D-C10']);
    expect(OPEN_VOIDS.every(v=>!!v.owner&&v.why.length>20&&v.r<=36)).toBe(true);
    const c=(bed:string,at:[number,number],depth:number)=>({bed,at,depth,reason:'lower route x'});
    // A new void over 1.25 anywhere else fails; one at or under 1.25 does not; the reserved neck does not.
    expect(residualBakeErrors([c('S3',[1318,1376],3.25)]).length).toBe(1);
    expect(residualBakeErrors([c('S3',[1318,1376],1.2)]).length).toBe(0);
    expect(residualBakeErrors([c('walk garden',[897.8,624.5],8.31),c('walk garden',[883.8,581.4],1.83)]).length).toBe(0);
    expect(residualBakeErrors([c('V01',[1605,690],6.8)]).length).toBe(1); // an open allowance is per bed
  });
});
it('decides a long bed edge\'s guard every 2.5 eu and posts every rail run at both ends (W5-A, R2-05)', () => {
  // A 60 eu single-segment walk whose east side drops 3 eu only over its middle third: one mid-segment test used to decide it all.
  const cuts = empty(), b = bed('long', 'walk', [[0, 10, 0], [0, 10, 60]]);
  const ground = (x: number, z: number) => (x < -1.5 && z > 20 && z < 40 ? 7 : 10);
  emitBedGeometry(b, cuts, ground);
  const rails = cuts.solids.filter(s => s.id.startsWith('long.edges'));
  const zs: number[] = []; for (const s of rails) for (let i = 0; i < s.positions.length; i += 3) zs.push(s.positions[i + 2]!);
  expect(rails.length).toBeGreaterThan(0); expect(Math.min(...zs)).toBeGreaterThanOrEqual(17.4); expect(Math.max(...zs)).toBeLessThanOrEqual(42.6);
  // Posts (0.12 × 0.12) at the run's start and end.
  const posts: number[] = []; for (const s of rails) for (let o = 0; o + 23 < s.positions.length; o += 24) { const xs = [0, 1, 2, 3].map(k => s.positions[o + k * 3]!); if (Math.max(...xs) - Math.min(...xs) < .13 && s.positions[o + 13]! - s.positions[o + 1]! > 1) posts.push(s.positions[o + 2]!); }
  expect(Math.min(...posts)).toBeLessThan(21); expect(Math.max(...posts)).toBeGreaterThan(39);
});
