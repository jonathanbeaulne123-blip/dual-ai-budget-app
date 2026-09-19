import {useMemo,useState} from 'react';
import type {KittyPart,KittyStrokeV1} from '../core/types.ts';
import type {HearthsideDesignClient} from './designClient.ts';
import {KeyboardStrokeDraftStore,type KeyboardStrokeDraft} from './keyboardStrokeDraft.ts';
export function KeyboardPaint({client,designId,pieceId,part,style,epoch,surfaceRevision,u,v,enabled,onU,onV}:{
 client:HearthsideDesignClient;designId:string;pieceId:string;part:KittyPart;style:Omit<KittyStrokeV1,'part'|'pts'>;epoch:number;surfaceRevision:number;u:number;v:number;enabled:boolean;onU:(n:number)=>void;onV:(n:number)=>void;
}){
 const key=JSON.stringify([client.options.identity,client.options.environment,client.options.householdId,client.options.memberId,designId,pieceId]);
 return <KeyboardLine key={key} {...{client,designId,pieceId,part,style,epoch,surfaceRevision,u,v,enabled,onU,onV}}/>;
}
function KeyboardLine({client,designId,pieceId,part,style,epoch,surfaceRevision,u,v,enabled,onU,onV}:Parameters<typeof KeyboardPaint>[0]){
 const store=useMemo(()=>{try{return new KeyboardStrokeDraftStore(sessionStorage,{...client.options,designId,pieceId});}catch{return null;}},[client,designId,pieceId]);
 const [initial]=useState(()=>{try{if(!store)throw Error('storage unavailable');return {draft:store.read(),error:''};}catch{return {draft:null,error:'The retained brush line could not be read. It has been left on this device.'};}});
 const [draft,setDraft]=useState(initial.draft),[error,setError]=useState(initial.error),[working,setWorking]=useState(false),[readBlocked,setReadBlocked]=useState(Boolean(initial.error));
 function add(){try{if(!store)throw Error("This device cannot retain brush points.");const next:KeyboardStrokeDraft=draft?{...draft,stroke:{...draft.stroke,pts:[...draft.stroke.pts,u,v]}}:{stroke:{...style,part,pts:[u,v]},expectedEditEpoch:epoch,surfaceRevision};setDraft(store.save(next));setError('');}catch(e){setError(e instanceof Error?e.message:'This device could not retain this point.');}}
 async function finish(){if(!draft||!enabled||working||!store)return;const original=draft,id='OP-'+crypto.randomUUID();setWorking(true);try{
  const accepted=await client.enqueue({version:1,kind:'operate',operation:{version:1,id,gestureId:'GESTURE-'+crypto.randomUUID(),designId,pieceId,kind:'append-stroke',...original}});
  // A durable pending request owns recovery after enqueue. Storage failure leaves the editable line intact.
  if(accepted||client.pending.some(row=>row.id===id)){store.clearIf(original);setDraft(store.read());}
 }catch(e){setError(e instanceof Error?e.message:'The line is retained for another try.');}finally{setWorking(false);}}
 function clear(){try{if(!store)throw Error('Storage unavailable');store.clear();setDraft(null);setReadBlocked(false);setError('');}catch{setError('The retained line could not be cleared.');}}
 return <details><summary>Paint with the keyboard</summary><p>Choose points, then finish your line. Each line is one gesture you can undo.</p>{draft&&<p role="status">Your {draft.stroke.pts.length/2}-point line on {draft.stroke.part} is retained with its original colour and surface.</p>}
  <label>Across<input aria-label="Across" type="range" min="0" max="1" step="0.02" value={u} onChange={e=>onU(Number(e.target.value))}/></label><label>Up<input aria-label="Up" type="range" min="0" max="1" step="0.02" value={v} onChange={e=>onV(Number(e.target.value))}/></label>
  <button disabled={!enabled||working||readBlocked} onClick={add}>Add point at {Math.round(u*100)}%, {Math.round(v*100)}%</button><button disabled={!enabled||working||!draft} onClick={()=>void finish()}>Finish my {(draft?.stroke.pts.length??0)/2}-point line</button><button disabled={working||!draft&&!readBlocked} onClick={clear}>Clear unfinished line</button>{error&&<p role="status">{error}</p>}
 </details>;
}
