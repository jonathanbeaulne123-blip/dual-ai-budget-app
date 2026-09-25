import type {WorldDefinition} from '../../harbour/horizon/world/definition.ts';
import type {LandCuts, TerrainField} from '../../harbour/horizon/land/interfaces.ts';
import {decodeTerrainAsset} from '../../harbour/horizon/land/terrain/asset.ts';
import {HORIZON_GEOGRAPHY} from '../../worldGeography.ts';
export type HorizonAssets={world:WorldDefinition;field:TerrainField;journey:TerrainField;cuts:LandCuts;bytes:number;horizonCards:import('../../harbour/horizon/sky/horizonCards.ts').HorizonCard[]};
export async function loadHorizonAssets(tier:'full'|'lite',signal?:AbortSignal):Promise<HorizonAssets>{
  const [response,terrain,cards]=await Promise.all([fetch('/horizon/world/horizon-geo-1.json',{signal}),fetch('/horizon/terrain/horizon-geo-1.bin',{signal}),fetch('/horizon/world/horizon-cards.json',{signal})]);
  if(!response.ok||!terrain.ok||!cards.ok)throw new Error('The Horizon land asset is unavailable. Run the land bake before opening the review.');
  const [world,buffer]=await Promise.all([response.json() as Promise<WorldDefinition>,terrain.arrayBuffer()]);
  if(world.id!=='horizon'||world.geographyRevision!==HORIZON_GEOGRAPHY||!world.geometry||!world.collision||!world.pathGraph)throw new Error('The Horizon definition is incomplete or has a different geography revision.');
  if(buffer.byteLength>2_500_000)throw new Error('The Horizon terrain exceeds its 2.5 MB budget.');
  const field=decodeTerrainAsset(buffer,tier),journey=decodeTerrainAsset(buffer,'journey');
  return {world,field,journey,horizonCards:await cards.json(),cuts:{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]},bytes:buffer.byteLength};
}
