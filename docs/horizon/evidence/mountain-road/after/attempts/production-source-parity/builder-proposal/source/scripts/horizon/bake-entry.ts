import {fitFootLaneJoin} from '../../src/harbour/horizon/land/mountainV2/footLaneJoin.ts';
import {buildHorizonPrejoinSource} from './bake-source.ts';
import {prepareLiteWorld} from '../../src/harbour/horizon/world/lite.ts';
import {decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';
import {createLandWorld} from '../../src/harbour/horizon/world/build.ts';
import {buildHorizonCards} from '../../src/harbour/horizon/sky/horizonCards.ts';
import {parseHorizonIndex} from '../../src/house/world/horizonAssets.ts';
import {extractJourneyLand} from '../../src/journey/land/extract.ts';
import {encodeJourneyLandSlim,type JourneyLandSlim,type JourneyLandSlimSource} from '../../src/journey/land/slim.ts';
export async function bake(){
  const {cuts,buffer,field,ground,corridors,groundBeds,foundations}=buildHorizonPrejoinSource();
  fitFootLaneJoin(cuts,ground);
  let world=createLandWorld(field,cuts,{terrainAsset:{url:'/horizon/terrain/horizon-geo-1.bin',bytes:buffer.byteLength,step:field.step},corridors});
  world=await prepareLiteWorld(world,cuts.solids);
  return{buffer,world,foundations,groundBeds,horizonCards:buildHorizonCards(field,cuts.solids)};
}
/**
 * REVIEW M2: the slim Journey land, extracted from the SERVED index bytes (exactly what the index path parses at
 * runtime) and the terrain asset's `journey` LOD, by the same `extractJourneyLand` the loader's fallback runs.
 */
export function bakeJourneyLand(indexJson:Uint8Array,terrain:ArrayBuffer,source:JourneyLandSlimSource):JourneyLandSlim{
  const bytes=indexJson.buffer.slice(indexJson.byteOffset,indexJson.byteOffset+indexJson.byteLength) as ArrayBuffer;
  return encodeJourneyLandSlim(extractJourneyLand(parseHorizonIndex(bytes),decodeTerrainAsset(terrain,'journey')),source);
}
