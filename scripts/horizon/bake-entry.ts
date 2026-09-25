import {settleFoundations} from '../../src/harbour/horizon/land/structures/foundations.ts';
import {prepareLiteWorld} from '../../src/harbour/horizon/world/lite.ts';
import {baseHeight,buildTerrain,sampleTerrain} from '../../src/harbour/horizon/land/terrain/index.ts';
import {encodeTerrainAsset,decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';
import {buildLandCuts} from '../../src/harbour/horizon/land/beds/build.ts';
import {buildWaterCuts} from '../../src/harbour/horizon/land/water/index.ts';
import {buildOffshoreSolids} from '../../src/harbour/horizon/land/offshore/index.ts';
import {buildCrossings} from '../../src/harbour/horizon/world/crossings.ts';
import {resolveComputedCrossings} from '../../src/harbour/horizon/land/beds/junctions.ts';
import {createLandWorld,buildWorldLines} from '../../src/harbour/horizon/world/build.ts';
import {buildHorizonCards} from '../../src/harbour/horizon/sky/horizonCards.ts';
export async function bake(){
  const cuts=buildLandCuts(baseHeight);
  const waters=buildWaterCuts(),waterIds=new Set(waters.map(w=>w.id));cuts.waters=[...waters,...cuts.waters.filter(w=>!waterIds.has(w.id))];cuts.solids.push(...buildOffshoreSolids());
  resolveComputedCrossings(cuts,buildCrossings(cuts,buildWorldLines(cuts)).proofs,baseHeight);
  const built=buildTerrain(cuts,{step:5});
  const buffer=encodeTerrainAsset(built, { waters: cuts.waters, beds: cuts.beds }),field=decodeTerrainAsset(buffer,'full');
  const foundations=settleFoundations(cuts,(x,z)=>sampleTerrain(field,x,z));
  let world=createLandWorld(field,cuts,{terrainAsset:{url:'/horizon/terrain/horizon-geo-1.bin',bytes:buffer.byteLength,step:field.step}});
  world=await prepareLiteWorld(world,cuts.solids);
  return{buffer,world,foundations,horizonCards:buildHorizonCards(field,cuts.solids)};
}
