import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2';

const buffer=(path:string)=>{const b=readFileSync(path);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const world=parseHorizonDefinition(buffer('public/horizon/world/horizon-geo-1.json.gz'));
const field=decodeTerrainAsset(buffer('public/horizon/terrain/horizon-geo-1.bin'),'full');
const yielded=terraceBedExclusion(world.collision.beds);
const region=createMountainV2Region({horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:yielded,exclude:mouthExclusion(world.collision.mouths),terrainStep:field.step});
const geography=createHorizonGeography(field,{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]});
geography.addDynamic(region.provider);

describe('Mountain Road physical handovers',()=>{
  it('keeps the drawn native road under wheels at the S1/Foot overlap',()=>{
    // The before audit stalls here: a blanket yield hid both the native road and the baked terrain.
    const x=1281.47,z=717.04,y=54.87;
    expect(yielded(x,z)).toBe(true);
    const hit=geography.surface(x,z,y,.1);
    expect(hit?.id).toBe('mountainV2:mountain-road');
    expect(hit?.y).toBeCloseTo(54.872007,5);
  });
  it('has continuous physical support across the return-lane slab edge',()=>{
    // Fifteen actual failed-driver footprint samples; no invented flat test world or support snap.
    for(const x of [1279.45,1279.6,1279.75,1279.9,1280.05])for(const z of [736.65,736.8,736.95]){
      const hit=geography.surface(x,z,55.3,.1);
      expect(hit,`return-lane support at ${x},${z}`).not.toBeNull();
      expect(Math.abs(hit!.y-55.3)).toBeLessThan(.08);
    }
  });
  it('keeps yielded lawn below the real approach deck instead of filling over it',()=>{
    for(const [x,z] of [[1320,755],[1310,752],[1280,737]]){
      const ceiling=yielded.ceiling?.(x!,z!);
      if(ceiling==null)throw new Error('expected a measured terrace yield sample');
      expect(region.provider.ground(x!,z!)).toBeLessThanOrEqual(ceiling+1e-8);
    }
  });
  it('keeps the visible road edge across the production South Portal terrain exclusion',()=>{
    const x=1349.26168049,z=685.51831384;
    expect(mouthExclusion(world.collision.mouths)(x,z)).toBe(true);
    expect(region.contains(x,z)).toBe(false);
    expect(region.requiresScene(x,z)).toBe(true);
    expect(region.providerWhileDrawn(()=>false).surface(x,z,67.05,.48)).toBeNull();
    expect(region.providerWhileDrawn(()=>true).surface(x,z,67.05,.48)?.id).toBe('mountainV2:mountain-road');
    const hit=geography.surface(x,z,67.05,.48);
    expect(hit?.id).toBe('mountainV2:mountain-road');
    expect(hit!.y).toBeGreaterThan(66.98);
    expect(hit!.y).toBeLessThan(67.08);
    expect(hit!.ny).toBeGreaterThan(.99);
    expect(geography.contact(x,z,hit!.y,.3)).toBeNull();
    expect(geography.ceiling(x,z,hit!.y)-hit!.y).toBeGreaterThan(1.6);
  });
  it('follows the drawn swept triangles continuously through the outside of the lower hairpin',()=>{
    let previous:number|undefined;
    for(let d=-.5;d<=.5;d+=.025){
      const x=1331.5692970518444-d*.775,z=669.6777273465635-d*.633;
      const hit=geography.surface(x,z,70,.48);
      expect(hit?.id).toBe('mountainV2:mountain-road');
      if(previous!==undefined)expect(Math.abs(hit!.y-previous)).toBeLessThan(.012);
      previous=hit!.y;
    }
  });
});
