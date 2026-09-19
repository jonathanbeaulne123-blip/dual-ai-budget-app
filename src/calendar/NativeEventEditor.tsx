import {useEffect,useRef,useState} from 'react';
import {saveNativeEvent,validateNativeEvent,type NativeEvent,type NativeEventInput} from '../core/nativeEvents.ts';
import type {Household} from '../core/types.ts';
import type {KitchenCommand} from '../kitchenCommand.ts';
import type {KittySubmissionReader} from '../kitty/KittyBankRoom.tsx';
type Review={id:string;input:NativeEventInput;attempted:boolean};
export function NativeEventEditor(props:{event:NativeEvent;household:Household;memberId:string;identity:string;busy:boolean;onCommand:KitchenCommand;onReadSubmission?:KittySubmissionReader;onClose:()=>void}){
  return <EventEditor key={`${props.identity}:${props.event.id}`} {...props}/>;
}
function EventEditor({event,household,memberId,identity,busy,onCommand,onReadSubmission,onClose}:Parameters<typeof NativeEventEditor>[0]){
  const key=`hearth:calendar:event-draft:${identity}:${event.id}`;
  function inputFor(row:NativeEvent):NativeEventInput{const {version:_v,id,revision,createdBy:_b,createdAt:_c,updatedAt:_u,...value}=row;return {id,memberId,expectedRevision:revision,event:value};}
  function checkDraft(value:NativeEventInput){
    if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['id','memberId','expectedRevision','event'].includes(k))||value.id!==event.id||value.memberId!==memberId||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<1||!value.event||typeof value.event!=='object')throw Error();
    const shape=inputFor(event).event;
    if(Object.keys(value.event).some(k=>!Object.hasOwn(shape,k))||Object.entries(shape).some(([key,entry])=>key==='until'?![null,'string'].includes(value.event.until===null?null:typeof value.event.until):key==='exceptions'?(!value.event.exceptions||typeof value.event.exceptions!=='object'||Array.isArray(value.event.exceptions)):typeof value.event[key as keyof typeof shape]!==typeof entry))throw Error();
    if(value.event.visibility!==event.visibility)throw Error();return value;
  }
  const [recovery]=useState(()=>{try{const raw=sessionStorage.getItem(key);if(!raw)return {input:inputFor(event),review:null as Review|null,error:''};if(raw.length>128*1024)throw Error();const value=JSON.parse(raw) as {input:NativeEventInput;review:Review|null};checkDraft(value.input);if(value.review){checkDraft(value.review.input);if(typeof value.review.attempted!=='boolean'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.review.id))throw Error();}return {...value,error:''};}catch{return {input:inputFor(event),review:null as Review|null,error:'The saved device draft could not be read. It is retained for recovery.'};}});
  const [input,setInput]=useState(recovery.input),[review,setReview]=useState(recovery.review),[message,setMessage]=useState(recovery.error),[working,setWorking]=useState(false),[resetExceptions,setResetExceptions]=useState(false);
  const live=useRef(false),lock=useRef(false),heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{live.current=true;heading.current?.focus();return()=>{live.current=false;};},[]);
  useEffect(()=>{if(recovery.error)return;try{sessionStorage.setItem(key,JSON.stringify({input,review}));}catch{setMessage('This device cannot keep the unfinished date after closing.');}},[input,review]);
  const editable=!working&&!review?.attempted&&!recovery.error;
  function change<K extends keyof NativeEventInput['event']>(field:K,value:NativeEventInput['event'][K]){setInput({...input,event:{...input.event,[field]:value}});setReview(null);}
  function prepare(){try{
    const next={...input,event:{...input.event,exceptions:resetExceptions?{}:input.event.exceptions}};
    validateNativeEvent({...next.event,version:1,id:event.id,revision:next.expectedRevision+1,createdBy:event.createdBy,createdAt:event.createdAt,updatedAt:event.updatedAt});
    setReview({id:crypto.randomUUID(),input:next,attempted:false});setMessage('');
  }catch(error){setMessage(error instanceof Error?error.message:'Check the date details.');}}
  async function confirm(){
    if(!review||lock.current||!live.current||busy)return;lock.current=true;setWorking(true);
    const request=structuredClone(review);let rejected=false,recovered=false;
    try{
      if(request.attempted&&onReadSubmission){const status=await onReadSubmission(request.id);if(!live.current)return;if(status==='accepted'){sessionStorage.removeItem(key);onClose();return;}if(status==='pending'){setMessage('This date is still waiting for its receipt. Check again after reconnecting.');return;}if(status==='rejected'){setReview(null);setMessage('This change was rejected. Your draft is kept; review the current date.');return;}}
      const retained={...request,attempted:true};sessionStorage.setItem(key,JSON.stringify({input,review:retained}));setReview(retained);
      const outcome=await onCommand(current=>{if(!live.current||current.environment!==household.environment||current.householdId!==household.householdId)throw Error('SCOPE_CLOSED');return saveNativeEvent(current,request.input);},{confirmationId:request.id,recoverConfirmation:request.attempted,onRecoveredConfirmation:()=>{recovered=true;},onDefinitiveRejected:()=>{rejected=true;}});
      if(!live.current)return;
      if(recovered||outcome?.ok){sessionStorage.removeItem(key);onClose();}else if(rejected||outcome?.ok===false){setReview(null);setMessage('This date changed elsewhere. Your draft is kept.');}else setMessage('Not confirmed yet. Keep this exact review and check the same receipt.');
    }catch(error){if(live.current)setMessage(error instanceof Error?error.message:'Not confirmed yet. Your exact review is kept.');}finally{if(live.current){lock.current=false;setWorking(false);}}
  }
  const draft=input.event,exceptions=Object.keys(draft.exceptions).length;
  return <section className="native-event-editor" aria-labelledby="native-event-editor-title"><header><h2 ref={heading} id="native-event-editor-title" tabIndex={-1}>A date in our life</h2><button disabled={working} onClick={onClose}>Close, keeping my draft</button></header><form onSubmit={e=>{e.preventDefault();prepare();}}>
    {event.revision!==input.expectedRevision&&<aside><p>The current event is version {event.revision}: {event.title}, {event.start} to {event.end}, {event.timezone}, repeating {event.repeat}. {event.location} {event.notes}</p><button type="button" disabled={!editable} onClick={()=>{setInput({...input,expectedRevision:event.revision});setReview(null);}}>Keep my draft against this version</button></aside>}
    <label>Event title<input required maxLength={160} disabled={!editable} value={draft.title} onChange={e=>change('title',e.target.value)}/></label><label>Starts<input required disabled={!editable} type={draft.allDay?'date':'datetime-local'} value={draft.start} onChange={e=>change('start',e.target.value)}/></label><label>Ends<input required disabled={!editable} type={draft.allDay?'date':'datetime-local'} value={draft.end} onChange={e=>change('end',e.target.value)}/></label><label>Timezone<input required disabled={!editable} value={draft.timezone} onChange={e=>change('timezone',e.target.value)}/></label>
    {!draft.allDay&&<label>When the clocks repeat this time<select disabled={!editable} value={draft.fold} onChange={e=>change('fold',e.target.value as 'earlier'|'later')}><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option></select></label>}
    <label>Repeat<select disabled={!editable} value={draft.repeat} onChange={e=>change('repeat',e.target.value as NativeEvent['repeat'])}>{['none','daily','weekly','monthly','yearly'].map(r=><option key={r} value={r}>{r==='none'?'Once':r}</option>)}</select></label>{draft.repeat!=='none'&&<label>Repeat until, if useful<input type="date" disabled={!editable} value={draft.until??''} onChange={e=>change('until',e.target.value||null)}/></label>}
    <label>Location<input maxLength={240} disabled={!editable} value={draft.location} onChange={e=>change('location',e.target.value)}/></label><label>Notes<textarea maxLength={2000} disabled={!editable} value={draft.notes} onChange={e=>change('notes',e.target.value)}/></label>
    {exceptions>0&&<label><input type="checkbox" disabled={!editable} checked={resetExceptions} onChange={e=>{setResetExceptions(e.target.checked);setReview(null);}}/>Reset the {exceptions} previously changed or skipped occurrences when saving this series</label>}
    <p>This changes this same Calendar event. Linked intentions keep their connection.</p><button disabled={!editable||busy}>Review this date</button>
    </form>{review&&<section className="native-event-review" aria-label="Review Calendar change"><h3>{review.input.event.title}</h3><p>{review.input.event.start} to {review.input.event.end} · {review.input.event.timezone}</p><p>{review.input.event.repeat==='none'?'This one event':`The ${review.input.event.repeat} series`} · {Object.keys(review.input.event.exceptions).length} changed or skipped occurrences retained.</p><button disabled={working||busy} onClick={()=>void confirm()}>{review.attempted?'Check this same receipt':'Save this exact date'}</button>{!review.attempted&&<button disabled={working} onClick={()=>setReview(null)}>Back to details</button>}</section>}{message&&<p role="status">{message}</p>}</section>;
}
