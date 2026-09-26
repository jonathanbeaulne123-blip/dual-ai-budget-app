import {gunzipSync} from 'fflate';
import type {WorldDefinition} from '../../harbour/horizon/world/definition.ts';
import type {LandCuts, TerrainField} from '../../harbour/horizon/land/interfaces.ts';
import {decodeTerrainAsset} from '../../harbour/horizon/land/terrain/asset.ts';
import {HORIZON_GEOGRAPHY} from '../../worldGeography.ts';
export type HorizonAssets={world:WorldDefinition;field:TerrainField;journey:TerrainField;cuts:LandCuts;bytes:number;horizonCards:import('../../harbour/horizon/sky/horizonCards.ts').HorizonCard[]};
type LoadedWorld=WorldDefinition&{geometry:NonNullable<WorldDefinition['geometry']>;collision:NonNullable<WorldDefinition['collision']>;pathGraph:NonNullable<WorldDefinition['pathGraph']>};
export function parseHorizonDefinition(bytes:ArrayBuffer):LoadedWorld{
  // Vite serves .gz with Content-Encoding, while static hosts may serve the raw bytes.
  const encoded=new Uint8Array(bytes),definition=encoded[0]===0x1f&&encoded[1]===0x8b?gunzipSync(encoded):encoded;
  const world=JSON.parse(new TextDecoder().decode(definition)) as WorldDefinition;
  if(world.id!=='horizon'||world.geographyRevision!==HORIZON_GEOGRAPHY||!world.geometry||!world.collision||!world.pathGraph)throw new Error('The Horizon definition is incomplete or has a different geography revision.');
  return world as LoadedWorld;
}
const loaded=new Map<'full'|'lite',HorizonAssets>();
export async function loadHorizonAssets(tier:'full'|'lite',signal?:AbortSignal):Promise<HorizonAssets>{
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const cached=loaded.get(tier);if(cached)return cached;
  const [response,terrain,cards]=await Promise.all([fetch('/horizon/world/horizon-geo-1.json.gz',{signal}),fetch('/horizon/terrain/horizon-geo-1.bin',{signal}),fetch('/horizon/world/horizon-cards.json',{signal})]);
  if(!response.ok||!terrain.ok||!cards.ok)throw new Error('The Horizon land asset is unavailable. Run the land bake before opening the review.');
  const [compressed,buffer]=await Promise.all([response.arrayBuffer(),terrain.arrayBuffer()]);
  const world=parseHorizonDefinition(compressed);
  if(buffer.byteLength>2_500_000)throw new Error('The Horizon terrain exceeds its 2.5 MB budget.');
  const field=decodeTerrainAsset(buffer,tier),journey=decodeTerrainAsset(buffer,'journey');
  const result:HorizonAssets={world,field,journey,horizonCards:await cards.json(),cuts:{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]},bytes:buffer.byteLength};
  loaded.set(tier,result);return result;
}
