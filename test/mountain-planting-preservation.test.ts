import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {mountainPlanting,plantingClearance} from '../src/harbour/mountain/planting.ts';
import {SKILL_BRANCHES} from '../src/harbour/mountain/course.ts';
import {keepAuthoredPlant,PLANTING_LANDING_OMISSIONS} from '../src/harbour/mountain/plantingLandingOmissions.ts';
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
// Exported from exact baseline 1cf76c5. Hash each complete JSON record, in order,
// before hashing the ordered digest list. Omit only two proven Library records and
// three proven Awning return intersections; exact source-face witnesses are retained.
const EXPECTED={
  "full.trees": {
    "count": 864,
    "orderedItemHashesSha256": "433f1e25263b27af56eff33fc438a4f5eb167a67adcce98dc1ee16434bf2c474"
  },
  "full.shrubs": {
    "count": 1148,
    "orderedItemHashesSha256": "66af425ef6605058278b5839c3ad9432d8f543f49b3d2bd818629174d979124b"
  },
  "full.flowers": {
    "count": 68,
    "orderedItemHashesSha256": "552f7757f95949cf99b682312137a148e36364a54cffb1d5fb15e840f1ec5806"
  },
  "full.tufts": {
    "count": 371,
    "orderedItemHashesSha256": "b036ed99f6b449f00181de88394d01e6438f209bbc8e3b30ed2be183ded5b628"
  },
  "lite.trees": {
    "count": 368,
    "orderedItemHashesSha256": "559978657ef58ce83e935d6b33f166662d913649e8b9d9b2feac6fea9ac6b16b"
  },
  "lite.shrubs": {
    "count": 495,
    "orderedItemHashesSha256": "8cf40e47c2dd2a69d10c6cb6731ff18fbe78fa803c6f4db0cbc233dc9b4f6fd4"
  },
  "lite.flowers": {
    "count": 44,
    "orderedItemHashesSha256": "942fcde0b7b3d26f9372004d692eee411d9aabe80eb900b5e3c694502fe6b21c"
  },
  "lite.tufts": {
    "count": 158,
    "orderedItemHashesSha256": "28d3bdcc5391680283edaaa93fcf7359c30008ca52e833e32c35350a986757c9"
  }
} as const;
describe('authored Mountain planting survives shared landing repairs',()=>{
 for(const tier of ['full','lite'] as const)for(const kind of ['trees','shrubs','flowers','tufts'] as const)it(`${tier} ${kind} retains every unchanged attribute and order`,()=>{
  const items=mountainPlanting(tier)[kind],expected=EXPECTED[`${tier}.${kind}`];
  expect(items.length).toBe(expected.count);
  expect(digest(items.map(item=>digest(JSON.stringify(item))).join('\n'))).toBe(expected.orderedItemHashesSha256);
 });
 it('public clearance still follows all actual repaired branch corridors',()=>{
  for(const branch of SKILL_BRANCHES)for(let i=0;i<branch.points.length;i+=2){const p=branch.points[i]!;expect(plantingClearance(p[0],p[2])).toBeLessThanOrEqual(-branch.halfWidth-1+1e-10);}
 });
 it('exceptions match full records after generation, never index or location alone',()=>{
  for(const record of PLANTING_LANDING_OMISSIONS){expect(keepAuthoredPlant(record.tier,record.kind,record.item)).toBe(false);expect(keepAuthoredPlant('lite',record.kind,record.item)).toBe(true);expect(keepAuthoredPlant(record.tier,record.kind,{...record.item,size:record.item.size+.001})).toBe(true);}
 });
});
