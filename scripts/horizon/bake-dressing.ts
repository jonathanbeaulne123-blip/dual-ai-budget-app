import type {LandCuts} from '../../src/harbour/horizon/land/interfaces.ts';
import type {District} from '../../src/harbour/horizon/world/definition.ts';
import type {NeighbourhoodModule} from '../../src/harbour/horizon/neighbourhoods/types.ts';
import {bakeDressings,createDressingContext,type DressingBake} from '../../src/harbour/horizon/neighbourhoods/bake.ts';
import {buildHosts} from '../../src/harbour/horizon/world/build.ts';
import {districtAt} from '../../src/harbour/horizon/world/districts.ts';
import {protectedGreenOutline} from '../../src/harbour/horizon/world/views.ts';
// A static import: bundled into the bake's ESM, the dynamic `await import()` of the runtime layer never settled (a top-level-
// await init cycle in the bundle; the bake exited 13 "unsettled top-level await" as soon as a module dressed anything).
import {measureDistrictDressing} from '../../src/harbour/horizon/runtime/dressingLayer.ts';

/**
 * The Water's Way bake step (neighbourhoods/bake.ts) against the bake's own world: the final ground, beds, pads, water,
 * baked solids, hosts and the protected Green. Returns null when no module dresses anything (the bake is then unchanged,
 * byte for byte). Each dressed district's art budget is measured with the runtime layer's own builder.
 */
export async function bakeNeighbourhoodDressing(modules:readonly NeighbourhoodModule[],cuts:LandCuts,ground:(x:number,z:number)=>number):Promise<(DressingBake&{budget:Record<string,NonNullable<District['dressing']>>})|null>{
  if(!modules.length)return null;
  const ctx=createDressingContext({ground,beds:cuts.beds,pads:cuts.pads,waters:cuts.waters,solids:cuts.solids,
    hosts:buildHosts(cuts).map(h=>({id:h.id,footprint:h.footprint,door:'xy'in h.door?{xy:h.door.xy}:{},height:h.height})),
    protectedAreas:[{id:'green',outline:protectedGreenOutline()}],districtAt:(x,z)=>districtAt(x,z)});
  const baked=bakeDressings(modules,ctx);
  if(!baked.dressing)return null;
  const budget:Record<string,NonNullable<District['dressing']>>={};
  for(const d of baked.dressing.districts)budget[d.districtId]={full:measureDistrictDressing(d,ground,'full'),lite:measureDistrictDressing(d,ground,'lite')};
  return {...baked,budget};
}
