import {GEOGRAPHY_REVISION} from './places.ts';
import type {HeightGrid} from './terrainBase.ts';

export const terrainAssetUrl=`/mountain/terrain/${GEOGRAPHY_REVISION}.bin`;
type TerrainAsset={revision:string;base:HeightGrid;ground:HeightGrid;conflicts:number;conflictCells:number[]};
type GridMeta=Omit<HeightGrid,'data'>;
type Header={revision:string;base:GridMeta;ground:GridMeta;conflicts:number;conflictCells:number[]};
let pending:Promise<TerrainAsset>|undefined;

function grid(meta:GridMeta,bytes:ArrayBuffer,offset:number):HeightGrid{
  const size=meta.cols*meta.rows*4;
  if(!Number.isInteger(meta.cols)||!Number.isInteger(meta.rows)||size<=0||offset+size>bytes.byteLength)throw new Error('Invalid mountain terrain grid');
  const copy=bytes.slice(offset,offset+size);
  return {...meta,data:new Float32Array(copy)};
}

export function decodeTerrainAsset(bytes:ArrayBuffer,revision:string=GEOGRAPHY_REVISION):TerrainAsset{
  const data=new DataView(bytes);
  if(bytes.byteLength<4)throw new Error('Invalid mountain terrain asset');
  const headerLength=data.getUint32(0,true);
  if(headerLength<8||headerLength>bytes.byteLength-4)throw new Error('Invalid mountain terrain header');
  const header=JSON.parse(new TextDecoder().decode(bytes.slice(4,4+headerLength))) as Header;
  if(header.revision!==revision)throw new Error(`Stale mountain terrain asset: ${header.revision}`);
  const baseOffset=4+headerLength;
  const groundOffset=baseOffset+header.base.cols*header.base.rows*4;
  const end=groundOffset+header.ground.cols*header.ground.rows*4;
  if(end!==bytes.byteLength||!Array.isArray(header.conflictCells)||!Number.isInteger(header.conflicts))throw new Error('Invalid mountain terrain length');
  return {revision,base:grid(header.base,bytes,baseOffset),ground:grid(header.ground,bytes,groundOffset),conflicts:header.conflicts,conflictCells:header.conflictCells};
}

/** Shared asynchronous load; the main thread never regenerates or decodes terrain at import. */
export function loadTerrainAsset():Promise<TerrainAsset>{
  return pending??=(async()=>{
    let bytes:ArrayBuffer;
    if(typeof process!=='undefined'&&Boolean(process.versions?.node)){
      const {readFile}=await import('node:fs/promises');
      const buffer=await readFile(`${process.cwd()}/public/mountain/terrain/${GEOGRAPHY_REVISION}.bin`);
      bytes=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength) as ArrayBuffer;
    }else{
      const response=await fetch(terrainAssetUrl);
      if(!response.ok)throw new Error(`Mountain terrain unavailable: ${response.status}`);
      bytes=await response.arrayBuffer();
    }
    return decodeTerrainAsset(bytes);
  })();
}
