import type {HeightGrid} from '../terrainBase.ts';
/** IEEE-754 bytes preserve the authored terrain exactly; no terrain calculation at entry. */
export function decodeGrid(g:Omit<HeightGrid,'data'>&{data:string}):HeightGrid{
 const bytes=Uint8Array.from(atob(g.data),c=>c.charCodeAt(0));
 return {...g,data:new Float32Array(bytes.buffer)};
}
