import {useEffect,useRef,useState} from 'react';
import type {Household} from '../core/types.ts';
import type {Win} from '../core/chapters.ts';
import type {MemoryComposition} from './contracts.ts';
import {winAdoptionOperation,winMemoryId,type AdoptWinMemoryOperation} from './winMemory.ts';
export function WinMemoryReview({household,win,memory,busy,onAdopt,onOpen}:{household:Pick<Household,'environment'|'householdId'>;win:Win;memory:MemoryComposition|undefined;busy:boolean;onAdopt:(operation:AdoptWinMemoryOperation,id:string,recover:boolean)=>Promise<unknown>;onOpen:(memoryId:string)=>void}){
 const live=useRef(true),request=useRef<{operation:AdoptWinMemoryOperation;id:string}|null>(null),[waiting,setWaiting]=useState(false),[pending,setPending]=useState(false),[notice,setNotice]=useState('');
 const id=winMemoryId(household,win.id);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{if(waiting&&memory?.id===id&&memory.legacySource?.winId===win.id){setWaiting(false);setPending(false);onOpen(id);}},[waiting,memory,id,win.id,onOpen]);
 async function adopt(){
  if(memory){onOpen(memory.id);return;}const recover=Boolean(request.current);request.current??={operation:winAdoptionOperation(household,win),id:crypto.randomUUID()};
  setWaiting(true);setPending(true);setNotice('Saving this invitation to remember…');
  try{await onAdopt(request.current.operation,request.current.id,recover);if(live.current)setNotice('Waiting for the accepted memory. You can retry this same request.');}
  catch{if(live.current)setNotice('This Win could not be adopted yet. Review the current record or retry the same request.');}
  finally{if(live.current)setPending(false);}
 }
 return <div className="chapter-actions"><p className="muted">{win.keptByMemberIds.length?'This moment was kept in the earlier records. ':''}A Hearthside memory needs both of us to review its exact composition.</p><button type="button" disabled={busy||pending} onClick={()=>void adopt()}>{memory?(memory.withdrawn?'View withdrawn memory':'Review this memory'):request.current?'Retry opening the memory':'Review as a memory'}</button>{notice&&<p role="status">{notice}</p>}{request.current&&!memory&&!pending&&<button type="button" onClick={()=>{request.current=null;setWaiting(false);setNotice('Ready to review the current Win.');}}>Review the current Win again</button>}</div>;
}
