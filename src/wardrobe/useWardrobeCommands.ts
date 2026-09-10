import {useEffect,useRef,useState} from 'react';
import type {KitchenCommand} from '../kitchenCommand.ts';
import {commitCompanion} from '../core/herculesCompanion.ts';
import {commitCompanionGallery} from '../core/herculesWardrobe.ts';
import {decodeCompanionIntent,decodeCompanionGalleryIntent,type CompanionOperation,type CompanionGalleryIntentV1,type CompanionScope} from '../core/herculesCompanionContracts.ts';
import {FITTING_MANIFEST} from './catalogue.ts';
type Request={id:string;operation:CompanionOperation|CompanionGalleryIntentV1['operation']};
export function useWardrobeCommands(scope:CompanionScope,connected:boolean,onCommand?:KitchenCommand){
 const key=`hearth:wardrobe-receipt:${scope.environment}:${scope.householdId}:${scope.memberId}`;
 function read():Request|null{try{const value=JSON.parse(localStorage.getItem(key)??'null') as Request|null;if(!value)return null;const intent={version:1,id:value.id,scope,operation:value.operation};if(value.operation.kind.startsWith('gallery.'))decodeCompanionGalleryIntent(intent,scope);else decodeCompanionIntent(intent,scope,FITTING_MANIFEST);return value;}catch{return null;}}
 const [retry,setRetry]=useState<Request|null>(read),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 const busy=useRef(false),epoch=useRef(0);useEffect(()=>{epoch.current++;return()=>{epoch.current++;};},[key]);
 function remember(value:Request|null){setRetry(value);try{if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);}catch{/* The current dialog still retains the exact retry. */}}
 async function submit(operation:Request['operation'],id:string=crypto.randomUUID()){
  if(!connected||!onCommand||busy.current)return;const generation=epoch.current,request={operation:structuredClone(operation),id};busy.current=true;setPending(true);remember(request);setMessage('Waiting for your household to confirm…');let definitive=false,recovered=false;
  try{const outcome=await onCommand(current=>{const intent={version:1 as const,id,scope,operation:request.operation};return request.operation.kind.startsWith('gallery.')?commitCompanionGallery(current,intent as CompanionGalleryIntentV1):commitCompanion(current,intent as Parameters<typeof commitCompanion>[1]);},{confirmationId:id,recoverConfirmation:retry?.id===id,onRecoveredConfirmation:()=>{recovered=true;},onDefinitiveRejected:()=>{definitive=true;}});
   if(epoch.current!==generation)return;
   if(recovered){remember(null);setMessage('Earlier request confirmed. Your latest account look is kept.');}
   else if(outcome?.kind==='synchronized'&&outcome.ok){remember(null);setMessage(operation.kind==='look.wear'?'Wearing this look. Confirmed for your account.':operation.kind==='look.save'?'Look saved for you.':operation.kind==='gallery.publish'?'Shared to your household.':operation.kind==='gallery.rename'?'Shared look renamed.':operation.kind==='gallery.remove'?'Removed from the household gallery.':'Personal look removed.');}
   else if(definitive){remember(null);setMessage('Not saved. Review the latest look or gallery before trying again; your preview is still here.');}
   else setMessage('Not confirmed yet. Your preview is kept. Reconnect and retry this same request.');
  }catch{if(epoch.current===generation)setMessage('Not confirmed yet. Reconnect and retry this same request.');}
  finally{if(epoch.current===generation){busy.current=false;setPending(false);}}
 }
 return {pending,retry,message,submit,canStart:connected&&Boolean(onCommand)&&!pending&&!retry,retryNow:()=>retry&&submit(retry.operation,retry.id)};
}
