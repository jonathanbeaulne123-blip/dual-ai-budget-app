import {useEffect,useRef,useState} from 'react';
import type {DueRecurrencePreviewRow} from './core/recurrencePreview.ts';
import {dueOccurrenceReview,hideDueOccurrence,type DueOccurrenceRequest,type DueOccurrenceReview} from './core/dueOccurrenceReview.ts';
import type {Household} from './core/types.ts';
import {RowReveal} from './RowReveal.tsx';
export type ReadyDueReview=Extract<DueOccurrenceReview,{kind:'ready'}>;
/** Inline occurrence review. Motion only discloses; the named button posts. */
export function DuePreviewSheet({rows,household,memberId,view,today,busy,isCurrent,onDismiss,onPost}:{rows:DueRecurrencePreviewRow[];household:Household;memberId:string;view:'household'|'personal';today:string;busy:boolean;isCurrent:()=>boolean;onDismiss:()=>void;onPost:(review:ReadyDueReview)=>Promise<boolean>}){
 const [hidden,setHidden]=useState<string[]>([]),[accepted,setAccepted]=useState<string[]>([]);
 const live=useRef({isCurrent,household});live.current={isCurrent,household};
 const request=(row:DueRecurrencePreviewRow):DueOccurrenceRequest=>({environment:household.environment,householdId:household.householdId,memberId,view,today,recurrenceId:row.recurrenceId,occurrenceDate:row.nextDate});
 const root=useRef<HTMLElement>(null),priorCount=useRef(rows.length);
 const visible=rows.filter(row=>!hidden.includes(row.recurrenceId)&&!accepted.includes(row.recurrenceId));
 useEffect(()=>{if(visible.length<priorCount.current&&document.activeElement===document.body)(root.current?.querySelector<HTMLElement>('.row-reveal-handle')??root.current?.querySelector<HTMLElement>('h2'))?.focus();priorCount.current=visible.length;},[visible.length]);
 return <section ref={root} className='due-preview-inline' id='due-reminders' aria-label='Due repeating items'>
  <h2 tabIndex={-1}>{visible.length?`${visible.length===1?'One':visible.length} repeating ${visible.length===1?'item is':'items are'} due`:'Due reminders are clear'}</h2>
  <p className='muted'>Review each occurrence here. Nothing posts until you press its named Confirm.</p>
  {!isCurrent()&&<p role='status'>The ledger view changed. Close these reminders and review Calendar.</p>}
  <div className='due-preview-list'>{visible.map(row=><DueRow key={`${row.recurrenceId}:${row.nextDate}`} row={row} request={request(row)} household={household} busy={busy} isCurrent={()=>live.current.isCurrent()} onPost={onPost} onAccepted={()=>setAccepted(ids=>[...ids,row.recurrenceId])} onHide={()=>{if(!live.current.isCurrent())return;hideDueOccurrence(request(row));setHidden(ids=>[...ids,row.recurrenceId]);}}/>)}</div>
  {!!accepted.length&&<p role='status'>{accepted.length} {accepted.length===1?'occurrence posted':'occurrences posted'}.</p>}
  <button className='ghost' type='button' disabled={busy} onClick={onDismiss}>Close reminders</button>
 </section>;
}
function DueRow({row,request,household,busy,isCurrent,onPost,onAccepted,onHide}:{row:DueRecurrencePreviewRow;request:DueOccurrenceRequest;household:Household;busy:boolean;isCurrent:()=>boolean;onPost:(review:ReadyDueReview)=>Promise<boolean>;onAccepted:()=>void;onHide:()=>void}){
 const [review,setReview]=useState(()=>dueOccurrenceReview(household,request)),[version,setVersion]=useState(0),[pending,setPending]=useState(false),[notice,setNotice]=useState('');
 const live=useRef({household,isCurrent});live.current={household,isCurrent};
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const fresh=dueOccurrenceReview(household,request),matches=isCurrent()&&review.kind==='ready'&&fresh.kind==='ready'&&review.basis===fresh.basis;
 const invalid=useRef(false);if(!matches&&!pending)invalid.current=true;const valid=matches&&!invalid.current;
 const post=async()=>{if(!valid||pending||busy||review.kind!=='ready'||!live.current.isCurrent())return;const latest=dueOccurrenceReview(live.current.household,request);if(latest.kind!=='ready'||latest.basis!==review.basis){setNotice('This occurrence changed. Review it again.');return;}setPending(true);setNotice('');try{const ok=await onPost(review);if(!mounted.current||!live.current.isCurrent())return;if(ok)onAccepted();else setNotice('Not yet accepted. Keep this occurrence here and retry when ready.');}catch(e){if(live.current.isCurrent())setNotice(e instanceof Error?e.message:String(e));}finally{if(mounted.current&&live.current.isCurrent())setPending(false);}};
 const label=review.kind==='ready'?review.title:row.title;
 return <RowReveal key={version} focusOnMount={version>0} label={label} busy={busy||pending||!isCurrent()} right={<>
   <p>{review.kind==='ready'?review.detail:review.reason}</p>
   {review.kind==='ready'&&!valid&&<p role='status'>This occurrence changed. Review its current details.</p>}
   {notice&&<p role='status'>{notice}</p>}
   {!valid?<button type='button' className='ghost' disabled={busy||pending||!isCurrent()} onClick={()=>{invalid.current=false;setReview(dueOccurrenceReview(live.current.household,request));setVersion(v=>v+1);setNotice('');}}>Review current details</button>:<button type='button' className='primary' disabled={busy||pending} onClick={()=>void post()}>Confirm {review.kind==='ready'&&review.type==='transfer'?'transfer':review.kind==='ready'&&review.type==='income'?'income':'payment'} · {label}</button>}
   {pending&&<p role='status' data-row-status tabIndex={0}>Waiting for acceptance…</p>}
  </>} left={<><p>Hide only this occurrence’s reminder for you on this device today. Its schedule and Books stay as they are.</p><button type='button' className='ghost' disabled={busy||pending} onClick={onHide}>Hide this reminder</button></>}>
  <strong>{label}</strong><div className='muted'>{review.kind==='ready'?review.detail.split('\n')[0]:`${row.summary} · ${row.nextDate}`}</div>
 </RowReveal>;
}
