import {useRef} from 'react';
import type {Household} from '../core/types.ts';
import type {LedgerSyncClient} from '../ledgerSync/client.ts';
import {TheatreProjector} from './TheatreProjector.tsx';
import {useHearthsideVault} from './VaultProvider.tsx';
import {useDesignClient} from './DesignProvider.tsx';
import {snapshotKittyDesignRevision} from './design.ts';
import {decodeHearthside,memoryKeptByEveryone,type MemoryComposition} from './contracts.ts';
import {checkProjectorProof} from './projectorAuthority.ts';
import {paintedSnapshot} from './paintedSnapshot.tsx';
import type {ProjectorLoadScope} from './projectorTypes.ts';

export function ProjectorEntry({household,memberId,identity,source,theme,onClose,onReviewMemory}:{household:Household;memberId:string;identity:string;source?:()=>LedgerSyncClient|null;theme:'classic'|'taylor'|'newfoundland';onClose:()=>void;onReviewMemory:(id:string)=>void}){
  const vault=useHearthsideVault().connection,designs=useDesignClient(),current=useRef({household,source,identity});current.current={household,source,identity};
  function assertCurrent(signal:AbortSignal){if(signal.aborted||current.current.identity!==identity)throw Error('SCOPE_CLOSED');}
  async function fresh(signal:AbortSignal){
    assertCurrent(signal);const authority=current.current.source?.();
    if(!authority||authority.options.scope.environment!==household.environment||authority.options.scope.householdId!==household.householdId||authority.options.scope.memberId!==memberId)throw Error('HEARTHSIDE_CONTENT_UNAVAILABLE');
    const snapshot=await authority.hearthsideContent(signal);assertCurrent(signal);return snapshot;
  }
  async function currentMemory(scope:ProjectorLoadScope):Promise<MemoryComposition>{
    if(scope.scopeKey!==identity)throw Error('SCOPE_CLOSED');const snapshot=await fresh(scope.signal),memory=snapshot.state.memories.find(m=>m.id===scope.memoryId);
    if(!memory||memory.revision!==scope.memoryRevision||!memoryKeptByEveryone(memory,snapshot.memberIds))throw Error('MEMORY_CHANGED');return memory;
  }
  const state=decodeHearthside(household.hearthside);
  return <TheatreProjector memories={state.memories} activeMemberIds={household.members.filter(m=>m.active).map(m=>m.id)} theme={theme} scopeKey={identity}
    publicationEpoch={JSON.stringify([state.memories,household.members.filter(m=>m.active).map(m=>m.id)])}
    authorLabels={Object.fromEntries(household.members.map(member=>[member.id,member.name]))} onClose={onClose} onReviewMemory={onReviewMemory}
    resolveMedia={async(reference,scope)=>{
      const memory=await currentMemory(scope),binding=memory.publication;
      if(!vault||vault.identity!==identity||!binding||!memory.media.some(m=>JSON.stringify(m)===JSON.stringify(reference)))return {status:'unavailable'};
      const blob=await vault.client.media(reference.contentId,binding.publicationId);assertCurrent(scope.signal);
      return {status:'available',reference,blob,publication:{id:binding.publicationId,revision:binding.memoryRevision,manifestDigest:binding.publicationDigest}};
    }}
    loadDesignSnapshot={async(reference,scope)=>{
      const memory=await currentMemory(scope);if(!memory.designs.some(ref=>JSON.stringify(ref)===JSON.stringify(reference)))return {status:'withdrawn'};
      const document=await designs?.load(reference.documentId,reference.revision);assertCurrent(scope.signal);
      if(!document||document.scope.ownerMemberId!==null||document.scope.environment!==household.environment||document.scope.householdId!==household.householdId)return {status:'unavailable'};
      const snapshot=snapshotKittyDesignRevision(document,reference.pieceId,reference.revision),blob=await paintedSnapshot(snapshot.piece,scope.signal,snapshot.appearance);
      return {status:'available',reference,blob,rendering:'authored-flat'};
    }}
    validateDownload={async(proof,context)=>{
      if(context.scopeKey!==identity)return false;
      const snapshot=await fresh(context.signal);
      return checkProjectorProof(proof,snapshot,context.signal,async(memory,asset,signal)=>{
        if('contentId' in asset.reference){
          const binding=memory.publication;if(!vault||vault.identity!==identity||!binding)return false;
          if(asset.status==='available'&&(!asset.publication||asset.publication.id!==binding.publicationId||asset.publication.revision!==binding.memoryRevision||asset.publication.manifestDigest!==binding.publicationDigest))return false;
          const blob=await vault.client.media(asset.reference.contentId,binding.publicationId);assertCurrent(signal);
          if(asset.status==='available'){const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());assertCurrent(signal);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')===asset.sha256;}
          return true;
        }
        const document=await designs?.load(asset.reference.documentId,asset.reference.revision);assertCurrent(signal);
        if(!document||document.scope.ownerMemberId!==null)return false;
        snapshotKittyDesignRevision(document,asset.reference.pieceId,asset.reference.revision);return true;
      });
    }}/>;
}
