import {baseHeight,buildTerrain} from '../../src/harbour/horizon/land/terrain/index.ts';
import {encodeTerrainAsset,decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';
import {buildLandCuts} from '../../src/harbour/horizon/land/beds/build.ts';
import {buildWaterCuts} from '../../src/harbour/horizon/land/water/index.ts';
import {buildOffshoreSolids} from '../../src/harbour/horizon/land/offshore/index.ts';
import {createLandWorld} from '../../src/harbour/horizon/world/build.ts';
import {buildHorizonCards} from '../../src/harbour/horizon/sky/horizonCards.ts';
export function bake(){
  const cuts=buildLandCuts(baseHeight);
  const waters=buildWaterCuts(),waterIds=new Set(waters.map(w=>w.id));cuts.waters=[...waters,...cuts.waters.filter(w=>!waterIds.has(w.id))];cuts.solids.push(...buildOffshoreSolids());
  const built=buildTerrain(cuts,{step:5});
  const buffer=encodeTerrainAsset(built),field=decodeTerrainAsset(buffer,'full');
  const world=createLandWorld(field,cuts,{terrainAsset:{url:'/horizon/terrain/horizon-geo-1.bin',bytes:buffer.byteLength,step:field.step}});
  return{buffer,world,horizonCards:buildHorizonCards()};
}
