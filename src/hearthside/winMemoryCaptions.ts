import type {MemoryComposition} from './contracts.ts';
import {winPublicCaption} from './winMemoryProvenance.ts';
export function memoryCaptionRows(memory:MemoryComposition,label:(memberId:string)=>string):{memberId:string|null;label:string;text:string}[]{
 const rows:{memberId:string|null;label:string;text:string}[]=memory.recollections.map(r=>({...r,label:label(r.memberId)}));
 const earlier=winPublicCaption(memory.legacySource);if(earlier)rows.push({memberId:null,...earlier});return rows;
}
export function memoryForStoryFile(memory:MemoryComposition){const {legacySource,...composition}=memory;const earlier=winPublicCaption(legacySource);return{...composition,...(earlier?{earlierNote:earlier}:{})};}
