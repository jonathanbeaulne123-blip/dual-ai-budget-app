import {decodeMemory,memoryKeptByEveryone,type HearthsideContentSnapshot,type MemoryComposition} from './contracts.ts';
import type {ProjectorAsset,ProjectorDownloadProof} from './projectorTypes.ts';

export async function projectorMemoryHash(memory:MemoryComposition){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(decodeMemory(memory))));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
/** Fresh authority metadata is mandatory, including for a film containing only words. */
export async function checkProjectorProof(proof:ProjectorDownloadProof,snapshot:HearthsideContentSnapshot,signal:AbortSignal,
  checkAsset:(memory:MemoryComposition,asset:Omit<ProjectorAsset,'blob'>,signal:AbortSignal)=>Promise<boolean>):Promise<boolean>{
  if(signal.aborted||proof.version!==1||!proof.memories.length||proof.memories.length>4000||new Set(proof.memories.map(m=>m.id)).size!==proof.memories.length)return false;
  let at=0;
  for(const selected of proof.memories){
    const memory=snapshot.state.memories.find(m=>m.id===selected.id);
    if(!memory||memory.revision!==selected.revision||!memoryKeptByEveryone(memory,snapshot.memberIds)||await projectorMemoryHash(memory)!==selected.sha256||signal.aborted)return false;
    for(const reference of [...memory.media,...memory.designs]){
      const asset=proof.assets[at++],kind='contentId' in reference?reference.kind:'design';
      if(!asset||asset.memoryId!==memory.id||asset.memoryRevision!==memory.revision||asset.kind!==kind||JSON.stringify(asset.reference)!==JSON.stringify(reference)||!await checkAsset(memory,asset,signal)||signal.aborted)return false;
    }
  }
  return at===proof.assets.length&&!signal.aborted;
}
