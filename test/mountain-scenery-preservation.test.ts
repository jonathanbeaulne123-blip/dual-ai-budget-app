import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {mountainStrata} from '../src/harbour/mountain/art/rockArt.ts';
import {DISTRICT_FIXTURES} from '../src/harbour/mountain/artGeometry.ts';
// Exact baseline 1cf76c5 values. Numeric bytes avoid decimal-printer differences;
// array order and every object field remain part of the assertion. JSON exports
// normalize -0 to 0; canonicalize only that sign bit, preserving all other bits.
// Baseline strata contain zero y from ceil(negative)*interval and zero normals
// from -gradient/g. Restoring those signs exactly reproduces the failed hashes.
function encode(value:unknown):string{
 if(typeof value==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(value===0?0:value);return 'n'+b.toString('hex');}
 if(Array.isArray(value))return '['+value.map(encode).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+encode((value as Record<string,unknown>)[key])).join(',')+'}';
 return JSON.stringify(value)??'undefined';
}
const digest=(value:unknown)=>createHash('sha256').update(encode(value)).digest('hex');
const BASELINE={
  "full": {
    "count": 16569,
    "hash": "37764c26199b76b10f93164f469ee76909cd97db065c885c34d0d7f6dbf25c08"
  },
  "lite": {
    "count": 5618,
    "hash": "b443eaef2b988c0c2881baf4d8ddcc5327fea07441b73604aea4b172b4b0c48b"
  },
  "fixtures": {
    "count": 31,
    "hash": "56d9b0c0daf033c1a383edecd02b38df168ef5e0a3f2a9e9298af5a8e7180718"
  }
} as const;
describe('Mountain source scenery survives shared landing repairs',()=>{
 for(const tier of ['full','lite'] as const)it(`${tier} strata retain every authored field and sequence`,()=>{const data=mountainStrata(tier);expect(data.length).toBe(BASELINE[tier].count);expect(digest(data)).toBe(BASELINE[tier].hash);});
 it('keeps all 31 original fixtures without adding furniture in the vacated Library corridor',()=>{expect(DISTRICT_FIXTURES.length).toBe(BASELINE.fixtures.count);expect(digest(DISTRICT_FIXTURES)).toBe(BASELINE.fixtures.hash);expect(DISTRICT_FIXTURES.some(x=>x.id==='district-art:library:3')).toBe(false);});
});
