import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import {emitBedGeometry,hostSurface} from '../src/harbour/horizon/land/beds/profiles.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2/index.ts';
import type {LandCuts} from '../src/harbour/horizon/land/interfaces.ts';
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const world=parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),field=decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')),'full');
const source=structuredClone(world.collision),year=source.beds.find(b=>b.id==='yearWalk')!,cuts:LandCuts&{floorSource:LandCuts['solids']}={...source,solids:[],diagnostics:[],floorSource:world.geometry.solids};
// Regenerate the real source emitter's visible/collision ribbon, never a height-query override.
emitBedGeometry(year,cuts,(x,z)=>sampleTerrain(field,x,z));
const ids=/^yearWalk\.(bed|surface|shoulders)(\.|$)/,solids=[...world.geometry.solids.filter(s=>!ids.test(s.id)),...cuts.solids.filter(s=>ids.test(s.id))];
const geography=createHorizonGeography(field,{...world.collision,solids,diagnostics:[]});geography.addDynamic(createMountainV2Region({walkingJoinSolids:solids,horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:terraceBedExclusion(world.collision.beds),exclude:mouthExclusion(world.collision.mouths),terrainStep:field.step}).provider);
describe('Year Walk Foot joins use the source host surfaces',()=>{
  it('removes the second Year Walk ribbon roof above the Stillwater Foot approach',()=>{
    for(let d=0;d<=1;d+=.05){const x=1276.427372984+d*.767,z=724.660498914-d*.642,floor=geography.surface(x,z,54.568422079,.48)!;
      expect(floor).not.toBeNull();expect(Math.abs(floor.y-54.568422079)).toBeLessThan(.1);
      expect(geography.ceiling(x,z,floor.y)-floor.y).toBeGreaterThan(1.55);expect(geography.contact(x,z,floor.y,0)).toBeNull();}
  });
  it('keeps the drawn Foot lane joining shoulder within the bicycle wheel step limit',()=>{
    const x=1280.5119618770732,z=737.6626101887928,heading=2.718028284125579,hx=Math.sin(heading),hz=Math.cos(heading),floor=geography.surface(x,z,55.25,.48)!;
    for(const along of [-.525,0,.525])for(const side of [-.25,0,.25]){const wheel=geography.surface(x+hx*along+hz*side,z+hz*along-hx*side,55.25,.5)!;expect(wheel).not.toBeNull();expect(wheel.y-floor.y).toBeLessThanOrEqual(.1);}
  });
  it('preserves the ordinary 0.6m host acceptance outside the named Year Walk Foot join',()=>{
    const corner:[number,number,number]=[1276.3118342,55.193270561,723.729200276];
    expect(hostSurface(year,cuts)!(corner)).toBeLessThan(54.7);
    expect(hostSurface({...year,id:'ordinaryWalk'},cuts)!(corner)).toBe(corner[1]);
  });
});
