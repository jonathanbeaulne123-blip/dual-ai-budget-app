import {gunzipSync} from 'fflate';
import type {WorldDefinition} from '../../harbour/horizon/world/definition.ts';
import type {LandCuts, StructureSolid, TerrainField} from '../../harbour/horizon/land/interfaces.ts';
import {decodeTerrainAsset} from '../../harbour/horizon/land/terrain/asset.ts';
import {HORIZON_GEOGRAPHY} from '../../worldGeography.ts';
/**
 * R1-72 / R2-72: the definition is served as a small INDEX (every whole-island thing: districts, beds and collision
 * routes, path graph, views, crossings, sky, journeys, diagnostics — `geometry.solids` empty) plus one CHUNK per district
 * (that district's solids: render and collision geometry), keyed by the geography revision
 * (`/horizon/world/<revision>.index.json.gz`, `/horizon/world/<revision>/<district>.json.gz`, bake-terrain.mjs).
 * The loader fetches the index, the terrain and the cards; the runtime then loads the chunk under the entry body
 * before the first frame and streams the rest by district residency (`HorizonChunkLoader`). No whole-island geometry
 * JSON is parsed on the main thread. `?horizon-monolith` (or HORIZON_CHUNKED false) keeps the one-file definition.
 */
export const HORIZON_CHUNKED=true;
export const HORIZON_INDEX_URL=`/horizon/world/${HORIZON_GEOGRAPHY}.index.json.gz`,HORIZON_MONOLITH_URL=`/horizon/world/${HORIZON_GEOGRAPHY}.json.gz`;
export interface HorizonChunkRef{districtId:string;url:string;bytes:number;sha256:string;solids:number;/** Wave 6: plan-view cells (flattened [cx,cz,…] at `cell` eu) the chunk's solids touch (artifacts.mjs chunkFootprint). */footprint?:{cell:number;cells:number[]}}
export interface HorizonChunkLoader{
  refs:readonly HorizonChunkRef[];
  /** True once this district's solids are in `world.geometry.solids` (a district with no chunk is always ready). */
  ready(districtId:string):boolean;
  /** Fetch, decode and append one district's solids (once); resolves with the solids added. */
  load(districtId:string,signal?:AbortSignal):Promise<StructureSolid[]>;
  /** Called after each chunk's solids are appended (the runtime adds them to the collision index and builds cards). */
  onLoad(listener:(districtId:string,solids:StructureSolid[])=>void):()=>void;
  /** Bytes fetched so far for the definition (index + chunks, as delivered to script: gzip or raw). */
  bytes():number;
  /** Wave 6: network only — fetch a chunk's bytes without parsing them (`load`/`loadSync` parse and append later). */
  prefetch(districtId:string,signal?:AbortSignal):Promise<void>;
  /** Wave 6: append a chunk NOW if its bytes are here; with `blocking` (the review-only simulation), fetch it synchronously
   * first. Returns whether the chunk is resident afterwards. */
  loadSync(districtId:string,blocking?:boolean):boolean;
  /** Wave 6: the chunks whose footprint touches the disc (x, z, radius); null when the index carries no footprints (a stale bake). */
  covering(x:number,z:number,radius:number):string[]|null;
}
export type HorizonAssets={world:WorldDefinition;field:TerrainField;journey:TerrainField;cuts:LandCuts;bytes:number;horizonCards:import('../../harbour/horizon/sky/horizonCards.ts').HorizonCard[];chunks?:HorizonChunkLoader;definitionBytes:number};
type LoadedWorld=WorldDefinition&{geometry:NonNullable<WorldDefinition['geometry']>;collision:NonNullable<WorldDefinition['collision']>;pathGraph:NonNullable<WorldDefinition['pathGraph']>;chunks?:HorizonChunkRef[]};
// Vite serves .gz with Content-Encoding, while static hosts may serve the raw bytes.
const decodeJson=(bytes:ArrayBuffer):unknown=>{const encoded=new Uint8Array(bytes);return JSON.parse(new TextDecoder().decode(encoded[0]===0x1f&&encoded[1]===0x8b?gunzipSync(encoded):encoded));};
export function parseHorizonDefinition(bytes:ArrayBuffer):LoadedWorld{
  const world=decodeJson(bytes) as WorldDefinition;
  if(world.id!=='horizon'||world.geographyRevision!==HORIZON_GEOGRAPHY||!world.geometry||!world.collision||!world.pathGraph)throw new Error('The Horizon definition is incomplete or has a different geography revision.');
  return world as LoadedWorld;
}
/** The index is a definition whose solids live in `chunks` (one per district, same revision). A definition without
 * `chunks` is a monolith and loads as one. */
export function parseHorizonIndex(bytes:ArrayBuffer):LoadedWorld{
  const world=parseHorizonDefinition(bytes);
  if(world.chunks&&(!Array.isArray(world.chunks)||world.chunks.some(c=>!c.url.includes(`/${world.geographyRevision}/`))))throw new Error('The Horizon index lists a chunk from a different geography revision.');
  return world;
}
export function parseHorizonChunk(bytes:ArrayBuffer,ref:HorizonChunkRef):StructureSolid[]{
  const chunk=decodeJson(bytes) as {id?:string;geographyRevision?:string;districtId?:string;solids?:StructureSolid[]};
  if(chunk.id!=='horizon-chunk'||chunk.geographyRevision!==HORIZON_GEOGRAPHY||chunk.districtId!==ref.districtId||!Array.isArray(chunk.solids)||chunk.solids.length!==ref.solids)throw new Error(`The Horizon chunk ${ref.districtId} is stale or incomplete.`);
  return chunk.solids;
}
export function createHorizonChunkLoader(world:LoadedWorld,counter:{bytes:number}={bytes:0}):HorizonChunkLoader|undefined{
  const refs=world.chunks??[];if(!refs.length)return undefined;
  const done=new Set<string>(),pending=new Map<string,Promise<StructureSolid[]>>(),raw=new Map<string,ArrayBuffer>(),fetching=new Map<string,Promise<ArrayBuffer>>(),listeners=new Set<(id:string,solids:StructureSolid[])=>void>(),byId=new Map(refs.map(r=>[r.districtId,r]));
  // Footprint cells → chunk ids (Wave 6 chunk gate). A stale index without footprints leaves `covering` null.
  const withFootprint=refs.every(r=>r.footprint&&Array.isArray(r.footprint.cells)),cellSize=withFootprint?refs[0]!.footprint!.cell:0,byCell=new Map<string,string[]>();
  if(withFootprint)for(const r of refs){const c=r.footprint!.cells;for(let i=0;i+1<c.length;i+=2){const k=`${c[i]}:${c[i+1]}`,list=byCell.get(k);if(list)list.push(r.districtId);else byCell.set(k,[r.districtId]);}}
  function append(id:string,buffer:ArrayBuffer):StructureSolid[]{
    if(done.has(id))return [];
    const solids=parseHorizonChunk(buffer,byId.get(id)!);world.geometry.solids.push(...solids);done.add(id);raw.delete(id);
    for(const listener of listeners)listener(id,solids);return solids;
  }
  function fetchBytes(id:string,signal?:AbortSignal):Promise<ArrayBuffer>{
    const have=raw.get(id);if(have)return Promise.resolve(have);
    let job=fetching.get(id);
    if(!job){const ref=byId.get(id)!;job=(async()=>{const response=await fetch(ref.url,{signal});if(!response.ok)throw new Error(`The Horizon chunk ${id} is unavailable.`);const buffer=await response.arrayBuffer();counter.bytes+=buffer.byteLength;if(!done.has(id))raw.set(id,buffer);fetching.delete(id);return buffer;})();job.catch(()=>fetching.delete(id));fetching.set(id,job);}
    return job;
  }
  return{refs,
    ready:id=>done.has(id)||!byId.has(id),
    load(id,signal){
      if(!byId.has(id)||done.has(id))return Promise.resolve([]);
      let job=pending.get(id);
      if(!job){job=(async()=>{const buffer=await fetchBytes(id,signal);const solids=append(id,buffer);pending.delete(id);return solids;})();job.catch(()=>pending.delete(id));pending.set(id,job);}
      return job;
    },
    async prefetch(id,signal){if(!byId.has(id)||done.has(id))return;await fetchBytes(id,signal);},
    loadSync(id,blocking=false){
      if(!byId.has(id)||done.has(id))return true;
      let buffer=raw.get(id);
      if(!buffer&&blocking&&typeof XMLHttpRequest!=='undefined'){
        // Review-only simulation (`simulateWalk`): the walker "waits in place" for the chunk; the synchronous run cannot
        // yield to the network, so the wait is taken here, synchronously (binary via x-user-defined; gzip or raw).
        const request=new XMLHttpRequest();request.open('GET',byId.get(id)!.url,false);request.overrideMimeType('text/plain; charset=x-user-defined');request.send();
        if(request.status>=200&&request.status<300){const text=request.responseText,bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i)&255;buffer=bytes.buffer;counter.bytes+=bytes.byteLength;}
      }
      if(!buffer)return false;
      append(id,buffer);return true;
    },
    covering(x,z,radius){
      if(!withFootprint)return null;
      const out=new Set<string>();
      for(let cx=Math.floor((x-radius)/cellSize);cx<=Math.floor((x+radius)/cellSize);cx++)for(let cz=Math.floor((z-radius)/cellSize);cz<=Math.floor((z+radius)/cellSize);cz++)for(const id of byCell.get(`${cx}:${cz}`)??[])out.add(id);
      return [...out];
    },
    onLoad(listener){listeners.add(listener);return()=>{listeners.delete(listener);};},
    bytes:()=>counter.bytes,
  };
}
const loaded=new Map<'full'|'lite',HorizonAssets>();
export function horizonChunked():boolean{return HORIZON_CHUNKED&&!(typeof location!=='undefined'&&/[?&]horizon-monolith\b/.test(location.search));}
export async function loadHorizonAssets(tier:'full'|'lite',signal?:AbortSignal):Promise<HorizonAssets>{
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const cached=loaded.get(tier);if(cached)return cached;
  let chunked=horizonChunked();
  let [response,terrain,cards]=await Promise.all([fetch(chunked?HORIZON_INDEX_URL:HORIZON_MONOLITH_URL,{signal}),fetch('/horizon/terrain/horizon-geo-1.bin',{signal}),fetch('/horizon/world/horizon-cards.json',{signal})]);
  // A bake from before the split has no index (a 404, or a dev server's HTML fallback): load its one-file definition.
  if(chunked&&(!response.ok||/text\/html/.test(response.headers.get('content-type')??''))){chunked=false;response=await fetch(HORIZON_MONOLITH_URL,{signal});}
  if(!response.ok||!terrain.ok||!cards.ok)throw new Error('The Horizon land asset is unavailable. Run the land bake before opening the review.');
  const [compressed,buffer]=await Promise.all([response.arrayBuffer(),terrain.arrayBuffer()]);
  const world=chunked?parseHorizonIndex(compressed):parseHorizonDefinition(compressed),counter={bytes:compressed.byteLength};
  if(buffer.byteLength>2_500_000)throw new Error('The Horizon terrain exceeds its 2.5 MB budget.');
  const field=decodeTerrainAsset(buffer,tier),journey=decodeTerrainAsset(buffer,'journey');
  const result:HorizonAssets={world,field,journey,horizonCards:await cards.json(),cuts:{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]},bytes:buffer.byteLength,chunks:createHorizonChunkLoader(world,counter),definitionBytes:compressed.byteLength};
  loaded.set(tier,result);return result;
}
