import {groundTerrainBeds} from '../../src/harbour/horizon/land/structures/groundBeds.ts';
import {settleFoundations} from '../../src/harbour/horizon/land/structures/foundations.ts';
import {baseHeight,buildTerrain,sampleTerrain} from '../../src/harbour/horizon/land/terrain/index.ts';
import {encodeTerrainAsset,decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';
import {buildLandCuts} from '../../src/harbour/horizon/land/beds/build.ts';
import {buildWaterCuts,buildSpringSolids} from '../../src/harbour/horizon/land/water/index.ts';
import {buildOffshoreSolids} from '../../src/harbour/horizon/land/offshore/index.ts';
import {buildCrossings} from '../../src/harbour/horizon/world/crossings.ts';
import {resolveComputedCrossings,settleBedEdges,openRetainingPassages} from '../../src/harbour/horizon/land/beds/junctions.ts';
import {settleCorridors} from '../../src/harbour/horizon/land/corridor/index.ts';
import {mountainSourceEnvironment} from '../../src/harbour/horizon/land/mountainV2/sourceEnvironment.ts';
import {buildWorldLines,corridorDestinations} from '../../src/harbour/horizon/world/build.ts';

/** The production source immediately before local Foot fitting.
 * Bake and geometry regressions must use this same ordered construction.
 * Ground is deliberately created before settleCorridors mutates cuts: returning
 * that exact closure preserves its original yield/mouth inputs. No fit, world
 * partition, LOD, output rounding, or artifact IO is performed here. */
export function buildHorizonPrejoinSource(){
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
  const {ground}=mountainSourceEnvironment(cuts,field);
  const {corridors}=settleCorridors(cuts,ground,{destinations:corridorDestinations(cuts)});
  return{cuts,buffer,field,ground,corridors,groundBeds,foundations};
}
