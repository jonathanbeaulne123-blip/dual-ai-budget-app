import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography';
import {createMountainV2Region,mouthExclusion,terraceBedExclusion} from '../src/harbour/horizon/regions/mountainV2';
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const world=parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz')));
const field=decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')),'full');

describe('Horizon Year Walk visible Foot footprint',()=>{
  it('keeps the existing walking slab above the yielded native lawn at the inherited Foot stall',()=>{
    const yieldToWalk=terraceBedExclusion(world.collision.beds);
    const geography=createHorizonGeography(field,{...world.collision,solids:world.geometry.solids,diagnostics:[]});
    geography.addDynamic(createMountainV2Region({walkingJoinSolids:world.geometry.solids,horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:yieldToWalk,exclude:mouthExclusion(world.collision.mouths),terrainStep:field.step}).provider);
    // Real extracted walking move() stopped on 43.18-degree native lawn here,
    // 5cm above a physically drawn 1.76-degree Year Walk slab.
    for(const [x,z] of [[1284.9959206721012,735.1861162216874],[1284.980624,735.149156]]){
      const floor=geography.surface(x!,z!,55.371869,.5)!;
      expect(floor.id).toMatch(/^yearWalk\.bed\./);
      expect(floor.slope).toBeLessThan(5);
      expect(yieldToWalk.ceiling!(x!,z!)).toBeLessThan(floor.y);
      expect(geography.blocker(x!,z!,floor.y,.3)).toBeNull();
    }
  });
  it('never creates a yield chord across a carried walking section or onto the massif',()=>{
    const points:[number,number,number][]=[[1290,55,730],[1290,55,750],[1290,55,780],[1290,55,800]];
    const foot=terraceBedExclusion([{id:'yearWalk',points,width:5.2,shoulder:1.2,carried:[[[1290,750],[1290,780]]]}]);
    expect(foot(1290,740)).toBe(true);expect(foot(1290,790)).toBe(true);
    expect(foot(1290,765)).toBe(false);expect(foot.ceiling!(1290,765)).toBeNull();
    const january=terraceBedExclusion([{id:'yearWalk',points:[[1330,70,670],[1340,72,690]],width:5.2,shoulder:1.2}]);
    expect(january(1335,680)).toBe(false);expect(january.ceiling!(1335,680)).toBeNull();
  });
});
