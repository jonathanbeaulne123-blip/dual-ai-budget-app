import {useEffect,useRef,type ReactNode} from 'react';
import type {Household} from '../core/types.ts';
import type {LedgerSyncClient} from '../ledgerSync/client.ts';
import {decodeHearthside,type MemoryComposition} from './contracts.ts';
import type {useHearthsideCommands} from './useHearthsideCommands.ts';
import type {HearthsideOperation} from './commands.ts';
import {memoryCompositionDigest,type MemoryPublicationBinding} from './memoryPublication.ts';
import {MemoryPublication} from './MemoryPublication.tsx';
import {useHearthsideVault} from './VaultProvider.tsx';
import {HEARTHSIDE_FLAGS} from './flags.ts';

type Props={household:Household;memberId:string;identity:string;connected:boolean;candidate:MemoryComposition;editable?:boolean;
  commands:ReturnType<typeof useHearthsideCommands>;source?:()=>LedgerSyncClient|null;theme:'classic'|'taylor'|'newfoundland';artwork:ReactNode;artworkReady:boolean;
  onChange:(value:MemoryComposition)=>void;onComposed:(value:MemoryComposition)=>void;onWithdrawn:()=>void};
export const sameMemoryBinding=(a:MemoryPublicationBinding|undefined,b:MemoryPublicationBinding)=>Boolean(a&&a.publicationId===b.publicationId&&a.publicationDigest===b.publicationDigest&&a.memoryId===b.memoryId&&a.memoryRevision===b.memoryRevision&&a.compositionDigest===b.compositionDigest);
export async function memoryReviewAlreadyAccepted(current:MemoryComposition|undefined,operation:HearthsideOperation,binding:MemoryPublicationBinding,memberId:string){
  if(!current||!sameMemoryBinding(current.publication,binding))return false;
  if(operation.kind==='memory.withdraw')return current.withdrawn;
  if(current.withdrawn||current.revision!==binding.memoryRevision||await memoryCompositionDigest(current)!==binding.compositionDigest)return false;
  return operation.kind==='memory.compose'||operation.kind==='memory.keep'&&current.approvals.some(a=>a.memberId===memberId&&a.revision===current.revision);
}
export function MemoryPublicationEntry(props:Props){
  const {connection,error}=useHearthsideVault(),latest=useRef(props);latest.current=props;
  const live=useRef(false);useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  if(!connection||connection.identity!==props.identity||connection.scope.memberId!==props.memberId||connection.scope.householdId!==props.household.householdId||connection.scope.environment!==props.household.environment)return <p role="status">{error||'Opening the private memory review…'}</p>;
  async function submit(operation:HearthsideOperation,binding:MemoryPublicationBinding){
    const p=latest.current,authority=p.source?.();
    if(!live.current||!authority||authority.options.scope.subject!==connection!.scope.subject||authority.options.scope.householdId!==p.household.householdId||authority.options.scope.memberId!==p.memberId||authority.options.scope.environment!==p.household.environment)throw Error('SCOPE_CHANGED');
    const snapshot=await authority.hearthsideContent();
    if(!live.current)throw Error('SCOPE_CHANGED');
    const commands=latest.current.commands,pending=commands.retry;
    // The original command identity is retained even when its acknowledgement was lost.
    if(pending&&JSON.stringify(pending.operation)===JSON.stringify(operation))return commands.retryNow();
    if(await memoryReviewAlreadyAccepted(decodeHearthside(snapshot.state).memories.find(m=>m.id===binding.memoryId),operation,binding,p.memberId))return true;
    if(pending)return false;
    return commands.submit(operation);
  }
  return <MemoryPublication client={connection.client} scope={connection.scope} theme={props.theme} candidate={props.candidate}
    roster={props.household.members.map(m=>({memberId:m.id,name:m.name,active:m.active}))} editable={props.editable}
    enabled={HEARTHSIDE_FLAGS.vaultPublication&&props.connected&&props.artworkReady&&!props.commands.pending} artwork={props.artwork} onChange={props.onChange}
    compose={async candidate=>{if(!candidate.publication)throw Error('MEMORY_REVIEW_REQUIRED');const ok=await submit({kind:'memory.compose',value:candidate,expectedRevision:candidate.revision-1},candidate.publication);if(ok&&live.current)latest.current.onComposed(candidate);return ok;}}
    keep={binding=>submit({kind:'memory.keep',id:binding.memoryId,expectedRevision:binding.memoryRevision},binding)}
    withdraw={async binding=>{const ok=await submit({kind:'memory.withdraw',id:binding.memoryId,expectedRevision:binding.memoryRevision},binding);if(ok&&live.current)latest.current.onWithdrawn();return ok;}}/>;
}
