import {useEffect,useRef,useState} from 'react';
import type {KitchenCommand} from '../kitchenCommand.ts';
import {commitSharedLifeRestore} from './sharedLifeRestore.ts';
import {decodeSharedLifeRestoreIntent,type SharedLifeRestoreIntent,type SharedLifeRestoreOperation} from './sharedLifeRestoreContracts.ts';

/** Only compact command identity/basis is stored locally; historical copy text is not. */
export function useSharedLifeRestore(scope:SharedLifeRestoreIntent['scope'],identity:string,connected:boolean,onCommand:KitchenCommand){
 const key=`hearth:shared-life-restore-pending:${JSON.stringify([identity,scope.environment,scope.householdId,scope.memberId])}`;
 const [pending,setPending]=useState(false),[retry,setRetry]=useState<SharedLifeRestoreIntent|null>(null),[message,setMessage]=useState('');
 const generation=useRef(0),alive=useRef(false),lock=useRef(false);
 useEffect(()=>{generation.current++;alive.current=true;lock.current=false;setPending(false);setRetry(null);setMessage('');
  try{const raw=localStorage.getItem(key);if(raw){if(raw.length>32*1024)throw Error('Too large');const saved=decodeSharedLifeRestoreIntent(JSON.parse(raw));if(JSON.stringify(saved.scope)!==JSON.stringify(scope))throw Error('Scope changed');setRetry(saved);}}
  catch{setMessage('This device’s unfinished restore request cannot be read. Review the current shared requests before starting again.');}
  return()=>{alive.current=false;generation.current++;};
 },[key]);
 async function submit(operation:SharedLifeRestoreOperation,recovered?:SharedLifeRestoreIntent):Promise<boolean>{
  if(!alive.current||lock.current||!connected||retry&&!recovered)return false;
  const epoch=generation.current,intent=recovered??{version:1 as const,id:crypto.randomUUID(),scope,operation};
  try{localStorage.setItem(key,JSON.stringify(intent));}catch{setMessage('This device cannot keep the exact retry. Your review is still open.');return false;}
  lock.current=true;setPending(true);setRetry(intent);setMessage('Checking this exact review with your shared home…');let acknowledged=false,rejected=false;
  try{
   const result=await onCommand(h=>commitSharedLifeRestore(h,intent),{confirmationId:intent.id,recoverConfirmation:Boolean(recovered),onRecoveredConfirmation:()=>{acknowledged=true;},onDefinitiveRejected:()=>{rejected=true;}});
   if(!alive.current||epoch!==generation.current)return false;
   if(acknowledged||result?.kind==='synchronized'&&result.ok||rejected){localStorage.removeItem(key);setRetry(null);setMessage(rejected?'This review changed. Refresh it and make a new choice.':'Your exact choice is saved in the shared home.');return !rejected;}
   setMessage('The reply is uncertain. Check and retry this same request.');return false;
  }catch{if(alive.current&&epoch===generation.current)setMessage('The reply is uncertain. Check and retry this same request; a saved choice is never applied twice.');return false;}
  finally{if(alive.current&&epoch===generation.current){lock.current=false;setPending(false);}}
 }
 return {pending,retry,message,canStart:connected&&!pending&&!retry,submit,retryNow:()=>retry?submit(retry.operation,retry):Promise.resolve(false)};
}
