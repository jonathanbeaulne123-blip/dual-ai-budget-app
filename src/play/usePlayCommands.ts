import {useEffect,useRef,useState} from 'react';
import {commitCompanionPlay,type PlayIntent} from '../core/herculesPlay.ts';
import type {PlayOperation} from '../core/playContracts.ts';
import type {CompanionScope} from '../core/herculesCompanionContracts.ts';
import type {KitchenCommand} from '../kitchenCommand.ts';
export function usePlayCommands(scope:CompanionScope,connected:boolean,onCommand:KitchenCommand){
 const key=`hearth:play-request:${scope.environment}:${scope.householdId}:${scope.memberId}`;
 const read=():PlayIntent|null=>{try{const r=JSON.parse(localStorage.getItem(key)??'null');return r?.version===1&&r?.scope?.memberId===scope.memberId&&r.scope.householdId===scope.householdId&&r.scope.environment===scope.environment?r:null;}catch{return null;}};
 const [retry,setRetry]=useState<PlayIntent|null>(read),[pending,setPending]=useState(false),[message,setMessage]=useState('');const lock=useRef(false),epoch=useRef(0);
 useEffect(()=>{epoch.current++;setRetry(read());return()=>{epoch.current++;};},[key]);
 function remember(r:PlayIntent|null){setRetry(r);try{if(r)localStorage.setItem(key,JSON.stringify(r));else localStorage.removeItem(key);}catch{/* Exact pending request remains in this mounted view. */}}
 async function submit(operation:PlayOperation,request?:PlayIntent){if(lock.current||!connected||retry&&!request)return false;const intent=request??{version:1 as const,id:crypto.randomUUID(),scope,operation:structuredClone(operation)},generation=epoch.current;lock.current=true;setPending(true);remember(intent);setMessage('Saving…');let recovered=false,rejected=false;
 try{const outcome=await onCommand(h=>commitCompanionPlay(h,intent),{confirmationId:intent.id,recoverConfirmation:Boolean(request),onRecoveredConfirmation:()=>{recovered=true;},onDefinitiveRejected:()=>{rejected=true;}});if(generation!==epoch.current)return false;if(recovered||outcome?.kind==='synchronized'&&outcome.ok){remember(null);setMessage('Saved to your household account.');return true;}if(rejected){remember(null);setMessage('This changed elsewhere. Your preview is kept. Review the current display and apply again.');}else setMessage('Not confirmed yet. Reconnect and retry the same request.');return false;
 }catch(error){if(generation===epoch.current)setMessage(error instanceof Error?error.message:'Not confirmed. Your preview is kept.');return false;}finally{if(generation===epoch.current){lock.current=false;setPending(false);}}}
 return {submit,pending,retry,message,canStart:connected&&!pending&&!retry,retryNow:()=>retry?submit(retry.operation,retry):Promise.resolve(false)};
}
