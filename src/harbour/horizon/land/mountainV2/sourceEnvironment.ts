/** The pre-join physical ground used by the final bake and source fixtures.
 * Call before fitting the walking join: including that join here would feed
 * its own ground cut back into its construction. Native defaults are untouched. */
import type {HeightQuery,LandCuts,TerrainField} from '../interfaces.ts';
import {sampleTerrain} from '../terrain/index.ts';
import {createMountainV2Region,mouthExclusion,terraceBedExclusion} from '../../regions/mountainV2/index.ts';

export function mountainSourceEnvironment(cuts:Pick<LandCuts,'beds'|'mouths'>,field:TerrainField){
 const terrainAt:HeightQuery=(x,z)=>sampleTerrain(field,x,z);
 const region=createMountainV2Region({horizonGround:terrainAt,yield:terraceBedExclusion(cuts.beds),exclude:mouthExclusion(cuts.mouths),terrainStep:field.step});
 const ground:HeightQuery=(x,z)=>region.provider.owns(x,z)?region.provider.ground(x,z):terrainAt(x,z);
 return{terrainAt,region,ground};
}
