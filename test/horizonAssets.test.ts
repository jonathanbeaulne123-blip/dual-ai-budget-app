import {expect,it,vi} from 'vitest';
import {gzipSync,strToU8} from 'fflate';
import {parseHorizonDefinition,loadHorizonAssets} from '../src/house/world/horizonAssets.ts';
const definition={id:'horizon',geographyRevision:'horizon-geo-1',geometry:{solids:[]},collision:{beds:[]},pathGraph:{nodes:[],edges:[]}};
const bytes=(value:unknown)=>strToU8(JSON.stringify(value));
it('loads both raw gzip and HTTP-decompressed definitions',()=>{
 const plain=bytes(definition),gzip=gzipSync(plain);
 expect(parseHorizonDefinition(plain.buffer as ArrayBuffer)).toEqual(definition);
 expect(parseHorizonDefinition(gzip.buffer as ArrayBuffer)).toEqual(definition);
});
it('rejects stale geography and incomplete definitions',()=>{
 expect(()=>parseHorizonDefinition(bytes({...definition,geographyRevision:'horizon-geo-0'}).buffer as ArrayBuffer)).toThrow('revision');
 expect(()=>parseHorizonDefinition(bytes({...definition,geometry:null}).buffer as ArrayBuffer)).toThrow('incomplete');
});

it('reuses static terrain on a return from the Reading edition without another fetch',async()=>{
 const {encodeTerrainAsset}=await import('../src/harbour/horizon/land/terrain/asset.ts');
 const buffer=encodeTerrainAsset({revision:'horizon-geo-1',width:2000,depth:1800,step:5,columns:401,rows:361,heights:new Float32Array(401*361),surfaces:new Uint8Array(401*361)});
 const fetch=vi.fn(async(url:string)=>new Response(url.endsWith('.bin')?buffer:url.endsWith('cards.json')?'[]':JSON.stringify(definition)));
 vi.stubGlobal('fetch',fetch);
 try{const first=await loadHorizonAssets('full'),second=await loadHorizonAssets('full');expect(second).toBe(first);expect(fetch).toHaveBeenCalledTimes(3);}
 finally{vi.unstubAllGlobals();}
});
