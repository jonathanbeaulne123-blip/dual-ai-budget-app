import {useEffect,useState} from 'react';
import type {Household} from '../core/types.ts';
import type {HearthsideRoom,RoomPlacement} from './contracts.ts';
import type {HearthsideOperation} from './commands.ts';
import {captureRoom,decodeRecordedRoom,recordedRoomKept,roomHistoryItemAvailable,roomObjectIdentity,type RecordedRoom,type RoomHorizon} from './roomHistory.ts';
import {RoomScene} from './RoomScene.tsx';
import {SavedPiecePreview} from './MemoryArtwork.tsx';
import {ROOMS} from './catalogue.ts';
import './roomHistory.css';

export function RoomHistory({household,memberId,identity,room,horizon,theme,canSave,submit,onCurrent}:{
 household:Household;memberId:string;identity:string;room:HearthsideRoom;horizon?:RoomHorizon;theme:'classic'|'taylor'|'newfoundland';canSave:boolean;
 submit:(operation:HearthsideOperation)=>Promise<boolean>;onCurrent:(target:RoomPlacement['object'])=>void;
}){
 const rows=household.hearthside?.roomHistory??[],members=household.members.filter(m=>m.active).map(m=>m.id);
 const draftKey=`hearth:recorded-room-draft:${JSON.stringify([identity,household.householdId,memberId])}`;
 const [draft,setDraft]=useState<RecordedRoom|null>(()=>{try{const raw=sessionStorage.getItem(draftKey);return raw?decodeRecordedRoom(JSON.parse(raw)):null;}catch{return null;}}),[selected,setSelected]=useState<string|null>(null),[objectId,setObjectId]=useState<string|null>(null),[error,setError]=useState('');
 useEffect(()=>{try{if(draft)sessionStorage.setItem(draftKey,JSON.stringify(draft));else sessionStorage.removeItem(draftKey);}catch{setError('This device cannot keep the unfinished view after closing.');}},[draft,draftKey]);
 useEffect(()=>{if(draft&&rows.some(r=>r.id===draft.id)){setSelected(draft.id);setDraft(null);}},[rows,draft]);
 const frame=draft??rows.find(r=>r.id===selected&&!r.withdrawn)??null;
 const available=frame?.items.filter(item=>roomHistoryItemAvailable(household,item))??[];
 const item=available.find(i=>roomObjectIdentity(i.object)===objectId),kept=frame&&recordedRoomKept(frame,members);
 function take(){try{setDraft(captureRoom(household,{id:'ROOM-VIEW-'+crypto.randomUUID(),title:'How our room felt',room,...(room==='conservatory'&&horizon?{horizon}:{})},memberId));setObjectId(null);setError('');}catch{setError('This room has too many objects for one saved view. Your room remains available.');}}
 async function save(){if(!draft||!canSave)return;const id=draft.id;if(await submit({kind:'room.capture',expectedRevision:0,value:draft})){setDraft(null);setSelected(id);}}
 return <section className="room-history" data-theme={theme} aria-labelledby="room-history-title">
  <header><p className="room-history-eyebrow">The room remembers what you choose</p><h2 id="room-history-title">Our room, as it was</h2><p>Save the objects, words, and arrangement of a room. Each piece keeps its own design revision. You both choose whether to keep the view.</p></header>
  <div className="room-history-controls"><button disabled={!canSave||Boolean(draft)} onClick={take}>Record this {ROOMS[room].name.toLowerCase()}</button><label>Visit a saved view<select aria-label="Visit a saved view" value={selected??''} onChange={e=>{setSelected(e.target.value||null);setDraft(null);setObjectId(null);}}><option value="">Choose a room view</option>{rows.filter(r=>!r.withdrawn).map((r,i)=><option key={r.id} value={r.id}>{i+1} · {r.title}{recordedRoomKept(r,members)?'':' · awaiting our choice'}</option>)}</select></label></div>
  {!rows.some(r=>!r.withdrawn)&&!draft&&<p className="room-history-empty">The first view can be an ordinary room, even before you have made anything.</p>}
  {frame&&<article className="room-history-frame">
   <div className="room-history-frame-caption"><p>{draft?'Review this room view':kept?'A recorded room we both kept':'An invitation to keep this room view'} · {ROOMS[frame.room].name}</p>{draft?<label>Name this view<input aria-label="Name this view" maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>:<h3>{frame.title}</h3>}<p>This is recorded history. Opening an object here shows its saved words and design.</p></div>
   <RoomScene furniture={frame.furniture} room={frame.room} theme={theme} illustrated paused objects={available.map(i=>({id:roomObjectIdentity(i.object),kind:i.object.kind,label:i.label,detail:i.detail,x:i.x??undefined,y:i.y??undefined,preview:i.design?<SavedPiecePreview reference={i.design}/>:undefined,onActivate:()=>setObjectId(roomObjectIdentity(i.object))}))}/>
   {available.length<frame.items.length&&<p role="status">Some objects are no longer shared. They are hidden from this view.</p>}
   {item&&<aside className="room-history-object" aria-label="Saved object"><h4>{item.label}</h4><p>{item.detail}</p>{item.design&&<SavedPiecePreview reference={item.design}/>}<p>Saved revision {item.sourceRevision}</p><button onClick={()=>onCurrent(item.object)}>Open this object in today’s room</button></aside>}
   <div className="room-history-controls">{draft?<><button disabled={!canSave||!draft.title.trim()} onClick={()=>void save()}>Invite us to keep this view</button><button onClick={take} disabled={!canSave}>Retake the room view</button><button onClick={()=>setDraft(null)}>Discard this view</button></>:<><button disabled={!canSave||frame.approvals.some(a=>a.memberId===memberId&&a.revision===frame.revision)||available.length!==frame.items.length} onClick={()=>void submit({kind:'room.keep',id:frame.id,expectedRevision:frame.revision})}>{frame.approvals.some(a=>a.memberId===memberId&&a.revision===frame.revision)?'I chose to keep this view':'Keep this exact view'}</button><button disabled={!canSave} onClick={()=>void submit({kind:'room.withdraw',id:frame.id,expectedRevision:frame.revision})}>Withdraw this view</button></>}</div>
  </article>}{error&&<p role="status">{error}</p>}
 </section>;
}
