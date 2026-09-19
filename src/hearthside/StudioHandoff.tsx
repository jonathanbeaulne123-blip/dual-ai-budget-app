import {useEffect,useState,useRef} from 'react';
import type {Household} from '../core/types.ts';
import type {HearthsideOperation} from './commands.ts';
import {SavedPiecePreview} from './MemoryArtwork.tsx';
import type {DesignReference} from './contracts.ts';
export function StudioHandoff(props:{household:Household;memberId:string;identity:string;design:DesignReference;canSave:boolean;submit:(operation:HearthsideOperation)=>Promise<boolean>}){
 return <Handoff key={JSON.stringify([props.identity,props.design.documentId,props.design.pieceId])} {...props}/>;
}
function Handoff({household,memberId,identity,design,canSave,submit}:Parameters<typeof StudioHandoff>[0]){
 const rows=household.hearthside?.handoffs?.filter(r=>r.design.documentId===design.documentId&&r.design.pieceId===design.pieceId)??[],own=rows.find(r=>r.authorId===memberId),key=`hearth:studio-handoff:${JSON.stringify([identity,design.documentId,design.pieceId])}`;
 const [text,setText]=useState(()=>{try{return sessionStorage.getItem(key)??own?.text??'';}catch{return own?.text??'';}}),[open,setOpen]=useState(false),[error,setError]=useState('');
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const recipient=household.members.find(m=>m.active&&m.id!==memberId);
 useEffect(()=>{if(!open)return;try{sessionStorage.setItem(key,text);}catch{setError('This device cannot retain the note after closing. Keep this page open.');}},[key,text,open]);
 async function save(withdrawn=false){
  if(!recipient||!canSave)return;
  const value=withdrawn&&own?{...own,revision:own.revision+1,withdrawn:true}:{version:1 as const,id:own?.id??`HANDOFF-${crypto.randomUUID()}`,revision:(own?.revision??0)+1,authorId:memberId,recipientId:recipient.id,design,text,withdrawn};
  const ok=await submit({kind:'studio.handoff',expectedRevision:own?.revision??0,value});if(ok){if(alive.current)setOpen(false);try{sessionStorage.removeItem(key);}catch{/* Shared receipt remains authoritative. */}}
 }
 return <section className="studio-handoff" aria-label="Leave the making table for each other"><h3>A little space for your turn</h3>
  {rows.filter(r=>!r.withdrawn).map(row=><article key={row.id}><p>{household.members.find(m=>m.id===row.authorId)?.name??'Your partner'} left this piece for {household.members.find(m=>m.id===row.recipientId)?.name??'their partner'}.</p><blockquote>{row.text||'Pick it up whenever you feel like making.'}</blockquote><details><summary>See the piece they left · revision {row.design.revision}</summary><SavedPiecePreview reference={row.design}/></details>{row.authorId===memberId&&<button disabled={!canSave} onClick={()=>void save(true)}>Withdraw my invitation</button>}</article>)}
  {recipient&&<button disabled={!canSave} aria-expanded={open} onClick={()=>setOpen(!open)}>{own&&!own.withdrawn?'Change my invitation':`Leave the piece for ${recipient.name}`}</button>}
  {open&&<div><label>A shared note for this piece<textarea aria-label="A shared note for this piece" value={text} maxLength={2000} onChange={e=>setText(e.target.value)}/></label><p>The invitation keeps revision {design.revision}. Both of you can see this note and continue the same piece whenever you want.</p><button disabled={!canSave} onClick={()=>void save()}>Leave this invitation</button><button onClick={()=>setOpen(false)}>Keep drafting</button></div>}{error&&<p role="status">{error}</p>}
 </section>;
}
