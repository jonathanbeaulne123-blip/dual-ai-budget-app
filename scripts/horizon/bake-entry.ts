import {fitFootLaneJoin} from '../../src/harbour/horizon/land/mountainV2/footLaneJoin.ts';
import {buildHorizonPrejoinSource} from './bake-source.ts';
import {prepareLiteWorld} from '../../src/harbour/horizon/world/lite.ts';
import {decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';
import {createLandWorld} from '../../src/harbour/horizon/world/build.ts';
import {buildHorizonCards} from '../../src/harbour/horizon/sky/horizonCards.ts';
import {parseHorizonIndex} from '../../src/house/world/horizonAssets.ts';
import {extractJourneyLand} from '../../src/journey/land/extract.ts';
import {encodeJourneyLandSlim,type JourneyLandSlim,type JourneyLandSlimSource} from '../../src/journey/land/slim.ts';
import {NEIGHBOURHOOD_MODULES} from '../../src/harbour/horizon/neighbourhoods/index.ts';
import {bakeNeighbourhoodDressing} from './bake-dressing.ts';
import type {District,WorldDefinition} from '../../src/harbour/horizon/world/definition.ts';
/** D-WW182: a district whose final land (after the lite pass) plus its dressing passes CONTRACT §6 is fitted (records thinned in
 * place, the world's dressing is the same object), its triangles re-totalled and the budget diagnostics re-issued. */
function fitDressingBudgets(world:WorldDefinition,fit:(id:string,room:{full:number;lite:number})=>NonNullable<District['dressing']>):WorldDefinition{
  const over=(t:{full:number;lite:number})=>t.full>150000||t.lite>60000;
  const districts=world.districts.map(d=>{
    if(!d.dressing||!d.triangles||!over(d.triangles))return d;
    const land={full:d.triangles.full-d.dressing.full.triangles,lite:d.triangles.lite-d.dressing.lite.triangles};
    const b=fit(d.id,{full:150000-land.full,lite:60000-land.lite});
    return{...d,dressing:b,triangles:{full:land.full+b.full.triangles,lite:land.lite+b.lite.triangles},drawCalls:(d.drawCalls??0)-d.dressing.full.drawCalls+b.full.drawCalls};
  });
  const diagnostics=(world.diagnostics??[]).filter(g=>!g.id.startsWith('budget.'));
  for(const d of districts.flatMap(d=>[d,...(d.children??[])]))if(d.triangles&&over(d.triangles))diagnostics.push({id:`budget.${d.id}`,severity:'conflict',message:`District triangle budget exceeded: full ${d.triangles.full}, lite ${d.triangles.lite}.`});
  return{...world,districts,diagnostics};
}
export async function bake(){
  const {cuts,buffer,field,ground,corridors,groundBeds,foundations}=buildHorizonPrejoinSource();
  fitFootLaneJoin(cuts,ground);
  // The Water's Way: every neighbourhood module against this same world; its colliders join the solids, its records the world.
  const dressing=await bakeNeighbourhoodDressing(NEIGHBOURHOOD_MODULES,cuts,ground);
  let world=createLandWorld(field,cuts,{terrainAsset:{url:'/horizon/terrain/horizon-geo-1.bin',bytes:buffer.byteLength,step:field.step},corridors,...(dressing?{extraSolids:dressing.solids,dressing}:{})});
  world=await prepareLiteWorld(world,cuts.solids);
  if(dressing)world=fitDressingBudgets(world,dressing.fit);
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
