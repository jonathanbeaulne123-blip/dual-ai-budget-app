import {groundTerrainBeds} from '../../src/harbour/horizon/land/structures/groundBeds.ts';
import {settleFoundations} from '../../src/harbour/horizon/land/structures/foundations.ts';
import {prepareLiteWorld} from '../../src/harbour/horizon/world/lite.ts';
import {baseHeight,buildTerrain,sampleTerrain} from '../../src/harbour/horizon/land/terrain/index.ts';
import {encodeTerrainAsset,decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';
import {buildLandCuts} from '../../src/harbour/horizon/land/beds/build.ts';
import {buildWaterCuts,buildSpringSolids} from '../../src/harbour/horizon/land/water/index.ts';
import {buildOffshoreSolids} from '../../src/harbour/horizon/land/offshore/index.ts';
import {buildCrossings} from '../../src/harbour/horizon/world/crossings.ts';
import {resolveComputedCrossings,settleBedEdges,openRetainingPassages} from '../../src/harbour/horizon/land/beds/junctions.ts';
import {createLandWorld,buildWorldLines} from '../../src/harbour/horizon/world/build.ts';
import {settleCorridors} from '../../src/harbour/horizon/land/corridor/index.ts';
import {createMountainV2Region,terraceBedExclusion} from '../../src/harbour/horizon/regions/mountainV2/index.ts';
import {buildHorizonCards} from '../../src/harbour/horizon/sky/horizonCards.ts';
import {parseHorizonIndex} from '../../src/house/world/horizonAssets.ts';
import {extractJourneyLand} from '../../src/journey/land/extract.ts';
import {encodeJourneyLandSlim,type JourneyLandSlim,type JourneyLandSlimSource} from '../../src/journey/land/slim.ts';
export async function bake(){
  const cuts=buildLandCuts(baseHeight);
  const waters=buildWaterCuts(),waterIds=new Set(waters.map(w=>w.id));cuts.waters=[...waters,...cuts.waters.filter(w=>!waterIds.has(w.id))];cuts.solids.push(...buildOffshoreSolids());
  const crossings=buildCrossings(cuts,buildWorldLines(cuts)).proofs;
  resolveComputedCrossings(cuts,crossings,baseHeight);
  const built=buildTerrain(cuts,{step:5});
  const buffer=encodeTerrainAsset(built, { waters: cuts.waters, beds: cuts.beds }),field=decodeTerrainAsset(buffer,'full');
  cuts.solids.push(...buildSpringSolids((x,z)=>sampleTerrain(field,x,z)));
  settleBedEdges(cuts,(x,z)=>sampleTerrain(field,x,z));
  openRetainingPassages(cuts,crossings);
  const groundBeds=groundTerrainBeds(cuts,(x,z)=>sampleTerrain(field,x,z));
  const foundations=settleFoundations(cuts,(x,z)=>sampleTerrain(field,x,z));
  // Road main (ROAD.md §1): the corridors, last, against the final ground and the final bed points; their solids replace
  // the road beds' old strips and edges, their sidewalk beds join the path graph, and the world carries them.
  // The ground a rider meets: Mountain v2's own ground inside its footprint (lowered under the Horizon decks it yields to,
  // exactly as the runtime and the road audit load it), Horizon terrain elsewhere.
  const terrainAt=(x:number,z:number)=>sampleTerrain(field,x,z),region=createMountainV2Region({horizonGround:terrainAt,yield:terraceBedExclusion(cuts.beds),terrainStep:field.step});
  const {corridors}=settleCorridors(cuts,(x,z)=>region.provider.owns(x,z)?region.provider.ground(x,z):terrainAt(x,z));
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
