import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {DueRecurrencePreviewRow} from './core/recurrencePreview.ts';
import {dueOccurrenceReview,hideDueOccurrence,type DueOccurrenceRequest,type DueOccurrenceReview} from './core/dueOccurrenceReview.ts';
import type {Household} from './core/types.ts';
import {RowReveal} from './RowReveal.tsx';
import {formatCad} from './core/money.ts';
import {billConfirmLabel,billSlipName,civilDateWords,type AddBillSlip} from './addSlideshow.ts';
export type ReadyDueReview=Extract<DueOccurrenceReview,{kind:'ready'}>;
/** Inline occurrence review. Motion only discloses; the named button posts. */
export function DuePreviewSheet({rows,household,memberId,view,today,busy,isCurrent,onDismiss,onPost,onReviewActiveChange}:{rows:DueRecurrencePreviewRow[];household:Household;memberId:string;view:'household'|'personal';today:string;busy:boolean;isCurrent:()=>boolean;onDismiss:()=>void;onPost:(review:ReadyDueReview)=>Promise<boolean>;onReviewActiveChange?:(active:boolean)=>void}){
 const [hidden,setHidden]=useState<string[]>([]),[accepted,setAccepted]=useState<string[]>([]);
 const activeReviews=useRef(new Set<string>()),reviewObserver=useRef(onReviewActiveChange);reviewObserver.current=onReviewActiveChange;
 const reportReview=(id:string,active:boolean)=>{if(active)activeReviews.current.add(id);else activeReviews.current.delete(id);reviewObserver.current?.(activeReviews.current.size>0);};
 useLayoutEffect(()=>()=>{activeReviews.current.clear();reviewObserver.current?.(false);},[]);
 const live=useRef({isCurrent,household});live.current={isCurrent,household};
 const request=(row:DueRecurrencePreviewRow):DueOccurrenceRequest=>({environment:household.environment,householdId:household.householdId,memberId,view,today,recurrenceId:row.recurrenceId,occurrenceDate:row.nextDate});
 const root=useRef<HTMLElement>(null),priorCount=useRef(rows.length);
 const visible=rows.filter(row=>!hidden.includes(row.recurrenceId)&&!accepted.includes(row.recurrenceId));
 useEffect(()=>{if(visible.length<priorCount.current&&document.activeElement===document.body)(root.current?.querySelector<HTMLElement>('.row-reveal-handle')??root.current?.querySelector<HTMLElement>('h2'))?.focus();priorCount.current=visible.length;},[visible.length]);
 return <section ref={root} className='due-preview-inline' id='due-reminders' aria-label='Due repeating items'>
  <h2 tabIndex={-1}>{visible.length?`${visible.length===1?'One':visible.length} repeating ${visible.length===1?'item is':'items are'} due`:'Due reminders are clear'}</h2>
  <p className='muted'>Review each occurrence here. Nothing posts until you press its named Confirm.</p>
  {!isCurrent()&&<p role='status'>The ledger view changed. Close these reminders and review Calendar.</p>}
  <div className='due-preview-list'>{visible.map(row=><DueRow key={`${row.recurrenceId}:${row.nextDate}`} row={row} request={request(row)} household={household} busy={busy} isCurrent={()=>live.current.isCurrent()} onReviewActiveChange={active=>reportReview(`${row.recurrenceId}:${row.nextDate}`,active)} onPost={onPost} onAccepted={()=>setAccepted(ids=>[...ids,row.recurrenceId])} onHide={()=>{if(!live.current.isCurrent())return;hideDueOccurrence(request(row));setHidden(ids=>[...ids,row.recurrenceId]);}}/>)}</div>
  {!!accepted.length&&<p role='status'>{accepted.length} {accepted.length===1?'occurrence posted':'occurrences posted'}.</p>}
  <button className='ghost' type='button' disabled={busy} onClick={onDismiss}>Close reminders</button>
 </section>;
}
function DueRow({row,request,household,busy,isCurrent,onPost,onAccepted,onHide,onReviewActiveChange}:{row:DueRecurrencePreviewRow;request:DueOccurrenceRequest;household:Household;busy:boolean;isCurrent:()=>boolean;onPost:(review:ReadyDueReview)=>Promise<boolean>;onAccepted:()=>void;onHide:()=>void;onReviewActiveChange:(active:boolean)=>void}){
 const [review,setReview]=useState(()=>dueOccurrenceReview(household,request)),[version,setVersion]=useState(0),[pending,setPending]=useState(false),[notice,setNotice]=useState('');
 const [reviewOpen,setReviewOpen]=useState(false),reviewObserver=useRef(onReviewActiveChange);reviewObserver.current=onReviewActiveChange;
 useLayoutEffect(()=>{reviewObserver.current(reviewOpen||pending);},[reviewOpen,pending]);
 useLayoutEffect(()=>()=>{reviewObserver.current(false);},[]);
 const live=useRef({household,isCurrent});live.current={household,isCurrent};
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const fresh=dueOccurrenceReview(household,request),matches=isCurrent()&&review.kind==='ready'&&fresh.kind==='ready'&&review.basis===fresh.basis;
 const invalid=useRef(false);if(!matches&&!pending)invalid.current=true;const valid=matches&&!invalid.current;
 const post=async()=>{if(!valid||pending||busy||review.kind!=='ready'||!live.current.isCurrent())return;const latest=dueOccurrenceReview(live.current.household,request);if(latest.kind!=='ready'||latest.basis!==review.basis){setNotice('This occurrence changed. Review it again.');return;}setPending(true);setNotice('');try{const ok=await onPost(review);if(!mounted.current||!live.current.isCurrent())return;if(ok)onAccepted();else setNotice('Not yet accepted. Keep this occurrence here and retry when ready.');}catch(e){if(live.current.isCurrent())setNotice(e instanceof Error?e.message:String(e));}finally{if(mounted.current&&live.current.isCurrent())setPending(false);}};
 const label=review.kind==='ready'?review.title:row.title;
 return <RowReveal key={version} focusOnMount={version>0} label={label} busy={busy||pending||!isCurrent()} onRevealChange={side=>setReviewOpen(side==='right')} right={<>
   <p>{review.kind==='ready'?review.detail:review.reason}</p>
   {review.kind==='ready'&&!valid&&<p role='status'>This occurrence changed. Review its current details.</p>}
   {notice&&<p role='status'>{notice}</p>}
   {!valid?<button type='button' className='ghost' disabled={busy||pending||!isCurrent()} onClick={()=>{invalid.current=false;setReview(dueOccurrenceReview(live.current.household,request));setVersion(v=>v+1);setNotice('');}}>Review current details</button>:<button type='button' className='primary' disabled={busy||pending} onClick={()=>void post()}>Confirm {review.kind==='ready'&&review.type==='transfer'?'transfer':review.kind==='ready'&&review.type==='income'?'income':'payment'} · {label}</button>}
   {pending&&<p role='status' data-row-status tabIndex={0}>Waiting for acceptance…</p>}
  </>} left={<><p>Hide only this occurrence’s reminder for you on this device today. Its schedule and Books stay as they are.</p><button type='button' className='ghost' disabled={busy||pending} onClick={onHide}>Hide this reminder</button></>}>
  <strong>{label}</strong><div className='muted'>{review.kind==='ready'?review.detail.split('\n')[0]:`${row.summary} · ${row.nextDate}`}</div>
 </RowReveal>;
}

/**
 * Bill paid, step one (Tool Atlas §3.3): the next due bills as slips — name,
 * amount, date, pot. Pick one; nothing is recorded here. Bills that are not
 * due yet are listed for context and are not offered: the reviewed path
 * records only a due occurrence. "Post all due" stays in the Cellar.
 */
export function BillPaidSlips({due,upcoming,selectedId,busy,onPick}:{due:readonly AddBillSlip[];upcoming:readonly AddBillSlip[];selectedId:string|null;busy:boolean;onPick:(recurrenceId:string)=>void}){
 return <div className='bill-slips' data-bill-slips>
  {due.length?<ul className='bill-slips__list' aria-label='Bills due'>{due.map(slip=><li key={`${slip.recurrenceId}:${slip.date}`}>
   <button type='button' className={`bill-slip${selectedId===slip.recurrenceId?' selected':''}`} aria-pressed={selectedId===slip.recurrenceId} aria-label={billSlipName(slip)} disabled={busy} data-bill-slip={slip.recurrenceId} onClick={()=>onPick(slip.recurrenceId)}>
    <span className='bill-slip__name'>{slip.name}</span>
    <span className='bill-slip__amount'>{formatCad(slip.amountCents)}</span>
    <span className='bill-slip__date'>{civilDateWords(slip.date)}</span>
    {slip.pot&&<span className='bill-slip__pot'>{slip.pot}</span>}
   </button>
  </li>)}</ul>:<p role='status' className='bill-slips__empty'>No bill is due today.{upcoming[0]?` The next one is ${upcoming[0].name}, ${formatCad(upcoming[0].amountCents)}, on ${civilDateWords(upcoming[0].date)}.`:''}</p>}
  {upcoming.length>0&&<section className='bill-slips__later' aria-label='Not due yet'>
   <h2 className='muted'>Not due yet</h2>
   <ul>{upcoming.map(slip=><li key={`${slip.recurrenceId}:${slip.date}`} className='muted'>{slip.name} · {formatCad(slip.amountCents)} · {civilDateWords(slip.date)}{slip.pot?` · ${slip.pot}`:''}</li>)}</ul>
  </section>}
 </div>;
}

/**
 * Bill paid, step two: the chosen bill read back as text, then its named
 * Confirm ("Record Hydro, $142.00, paid from Prepare"). The review is re-read
 * at the press; if the bill changed underneath, nothing is sent and the
 * current details are shown instead. The App posts through `postOneRecurrence`.
 */
export function BillPaidConfirm({slip,household,ledger,busy,onConfirm}:{slip:AddBillSlip;household:Household;ledger?:'household'|'personal';busy:boolean;onConfirm:(review:ReadyDueReview)=>void}){
 const [notice,setNotice]=useState('');
 const [basis,setBasis]=useState(()=>slip.review.kind==='ready'?slip.review.basis:null);
 const fresh=dueOccurrenceReview(household,slip.request);
 const stale=fresh.kind==='ready'&&basis!==null&&fresh.basis!==basis;
 const label=billConfirmLabel(slip);
 const press=()=>{const latest=dueOccurrenceReview(household,slip.request);if(latest.kind!=='ready'){setNotice(latest.reason);return;}if(latest.basis!==basis){setNotice('This bill changed. Read its current details, then confirm again.');setBasis(latest.basis);return;}setNotice('');onConfirm(latest);};
 return <section className='bill-confirm preview add-confirm-summary' aria-label='Bill to record' data-bill-confirm={slip.recurrenceId}>
  <div className='row'><span>Bill</span><span>{slip.name}</span></div>
  <div className='row'><span>Amount</span><span>{formatCad(slip.amountCents)}</span></div>
  <div className='row'><span>Account</span><span>{slip.accountName||'—'}</span></div>
  <div className='row'><span>Category</span><span>{slip.categoryName||'—'}</span></div>
  <div className='row'><span>Date</span><span>{civilDateWords(slip.date)}</span></div>
  {slip.pot&&<div className='row'><span>Pot</span><span>{slip.pot}</span></div>}
  {ledger&&<div className='row'><span>Into</span><span>{ledger==='household'?'Ours':'Mine'}</span></div>}
  {fresh.kind==='ready'?<p className='muted bill-confirm__detail'>{fresh.detail.split('\n').slice(1).join(' · ')}</p>:<p role='status'>{fresh.reason}</p>}
  {stale&&<p role='status'>This bill changed. Read its current details, then confirm again.</p>}
  {notice&&<p role='status'>{notice}</p>}
  {fresh.kind==='ready'&&<button type='button' className='primary post-big' disabled={busy} onClick={press} data-add-confirm-bill>{label}</button>}
 </section>;
}
