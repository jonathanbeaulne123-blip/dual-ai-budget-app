import {useEffect,useRef,useState} from 'react';
import {addGoal} from '../core/commands.ts';
import type {CommitResult,Household,LedgerView} from '../core/types.ts';
import {parseAmount} from '../core/catalog.ts';
import {formatCad} from '../core/money.ts';
import {fillDraftCents} from '../GoalFill.tsx';
import {ConfirmSheet} from '../Confirm.tsx';
import {KittyStage} from '../kitty/KittyStage.tsx';
import type {KittyCommandOptions,KittySubmissionReader} from '../kitty/KittyBankRoom.tsx';
import {acceptedCreatedBank,type BankScope,type KittyAcceptedCommandReader} from './bankReceipt.ts';
import {bankCreationKey,newBankEnvelope,readBankCreation,saveBankCreation,type BankCreationContext,type BankCreationReview} from './bankCreation.ts';

/** A transport acknowledgement may be lost. Keep the exact request, and let the person check it. */
export async function boundedBankSubmission<T>(promise:Promise<T>,signal:AbortSignal,ms=5000):Promise<T|undefined>{
 let timer:ReturnType<typeof setTimeout>|undefined;let abort:()=>void=()=>{};
 try{return await Promise.race([promise,new Promise<undefined>(resolve=>{abort=()=>resolve(undefined);signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>resolve(undefined),ms);if(signal.aborted)resolve(undefined);})]);}
 finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
export function BankCreationSurface({scope,household,view,busy,context,onCommand,onReadSubmission,onReadAcceptedCommand,onCreated,onCancel}:{scope:BankScope;household:Household;view:LedgerView;busy:boolean;context?:BankCreationContext;onCommand:(fn:(h:Household)=>CommitResult,options?:KittyCommandOptions)=>unknown;onReadSubmission?:KittySubmissionReader;onReadAcceptedCommand?:KittyAcceptedCommandReader;onCreated:(value:{confirmationId:string;goalId:string})=>void|Promise<void>;onCancel?:()=>void}){
 const [restored]=useState(()=>{try{const review=readBankCreation(localStorage,scope,context);if(review&&review.input.shared!==(view==='household'))throw Error('BANK_REVIEW_SCOPE_MISMATCH');return{review,error:''};}catch{return{review:null,error:'This saved bank review could not be read. Keep it for recovery before starting another bank.'};}});
 const [review,setReview]=useState(restored.review),[name,setName]=useState(restored.review?.input.name??context?.name??''),[target,setTarget]=useState(String(restored.review?.input.target??'')),[envelope,setEnvelope]=useState(()=>restored.review?.input.envelope??newBankEnvelope(context?.purpose)),[saving,setSaving]=useState(false),[notice,setNotice]=useState(restored.error),[rejected,setRejected]=useState(false);
 const scopeKey=JSON.stringify(scope),live=useRef<{key:string;abort:AbortController}>({key:scopeKey,abort:new AbortController()}),lock=useRef(false);
 if(live.current.key!==scopeKey){live.current.abort.abort();live.current={key:scopeKey,abort:new AbortController()};}
 useEffect(()=>{if(live.current.abort.signal.aborted)live.current={key:scopeKey,abort:new AbortController()};return()=>live.current.abort.abort();},[scopeKey]);
 const current=()=>!live.current.abort.signal.aborted&&live.current.key===scopeKey;
 function openReview(){try{const input={name,target,shared:view==='household',ownerMemberId:view==='household'?null:scope.memberId,envelope};addGoal(household,input);const next:BankCreationReview={version:1,scope,context:context??null,confirmationId:crypto.randomUUID(),input,attempted:false};saveBankCreation(localStorage,next);setReview(next);setRejected(false);setNotice('');}catch(error){setNotice(error instanceof Error?error.message:'This bank needs another look.');}}
 async function confirm(){
  if(!review||busy||lock.current||!onReadAcceptedCommand||!current())return;const generation=live.current,signal=generation.abort.signal,isCurrent=()=>live.current===generation&&!signal.aborted;lock.current=true;setSaving(true);setNotice('Checking this bank’s receipt…');
  try{
   let accepted=review.attempted?await onReadAcceptedCommand(review.confirmationId,signal):null;if(!isCurrent())return;
   if(!accepted){
    const status=review.attempted&&onReadSubmission?await onReadSubmission(review.confirmationId):'missing';if(!isCurrent())return;
    if(status==='rejected'){setRejected(true);throw Error('This creation was rejected. Review the current bank details before a new confirmation.');}
    if(status==='accepted'||status==='pending'){setNotice('The original creation is still catching up. Check its receipt again; no second bank will be submitted.');return;}
    const attempted={...review,attempted:true};saveBankCreation(localStorage,attempted);setReview(attempted);let definite=false;
    await boundedBankSubmission(Promise.resolve(onCommand(h=>{if(!isCurrent()||h.environment!==scope.environment||h.householdId!==scope.householdId)throw Error('SCOPE_CLOSED');return addGoal(h,review.input);},{confirmationId:review.confirmationId,recoverConfirmation:review.attempted,suppressUndo:true,onDefinitiveRejected:()=>{definite=true;if(isCurrent())setRejected(true);}})),signal);
    if(!isCurrent())return;
    accepted=await onReadAcceptedCommand(review.confirmationId,signal);if(!isCurrent())return;
    if(!accepted){if(definite)setRejected(true);setNotice(definite?'This creation was rejected. Review the current bank details.':'Acceptance is not confirmed. Keep this exact review and check its receipt again.');return;}
   }
   const goal=acceptedCreatedBank(accepted,review.confirmationId,scope,view);
   await onCreated({confirmationId:review.confirmationId,goalId:goal.id});
   localStorage.removeItem(bankCreationKey(scope,context));if(!isCurrent())return;setNotice('The accepted bank is ready.');
  }catch(error){if(isCurrent())setNotice(error instanceof Error?error.message:'The receipt is unavailable. Keep this review and try again.');}
  finally{if(isCurrent()){lock.current=false;setSaving(false);}}
 }
 function edit(){if(review?.attempted&&!rejected)return;try{localStorage.removeItem(bankCreationKey(scope,context));setReview(null);setRejected(false);setNotice('');}catch{setNotice('The saved review could not be cleared. Try again.');}}
 return <div className="kitty-room-spread">
  <KittyStage piece={envelope.studio?.draft??null} glaze={envelope.glaze} open name="New bank"/>
  <form className="kitty-folio" onSubmit={event=>{event.preventDefault();openReview();}}>
   <span className="kitty-eyebrow">{context?'A bank for this intention':'The first page'}</span><h2>What are we making room for?</h2><p>{context?`For “${context.name}”. Review the bank first, then review its connection to your intention.`:'Two things to start. Everything else can wait, or never happen at all.'}</p>
   <label>Bank name<input required maxLength={100} value={name} disabled={Boolean(review)} onChange={e=>setName(e.target.value)} placeholder="A slower week away"/></label>
   <label>How much (CAD)<input required inputMode="decimal" value={target} disabled={Boolean(review)} onChange={e=>setTarget(e.target.value)} placeholder="2,000"/></label>
   <details className="kitty-optional" open={Boolean(context)}><summary>Say more (optional)</summary><label>Why this one<textarea maxLength={1000} value={envelope.purpose} disabled={Boolean(review)} onChange={e=>setEnvelope({...envelope,purpose:e.target.value})}/></label><label>Belongs in<select value={envelope.kind} disabled={Boolean(review)} onChange={e=>setEnvelope({...envelope,kind:e.target.value as typeof envelope.kind})}><option value="build">Build · a future we choose</option><option value="protect">Protect · a promise or cushion</option><option value="prepare">Prepare · a cost that comes around</option></select></label></details>
   <div className="kitty-actions"><button className="kitty-primary" disabled={busy||saving||Boolean(review)||Boolean(restored.error)||!onReadAcceptedCommand||!name.trim()||!fillDraftCents(target)}>Review {view==='personal'?'personal':'shared'} bank</button>{onCancel&&<button type="button" onClick={onCancel}>{review?.attempted?'Return with review saved':'Cancel'}</button>}</div>
   <small>This makes a bank and clay to shape. It does not assign, contribute or move money.</small>{!onReadAcceptedCommand&&<p role="status">Connect to the current household’s receipt service to create a bank.</p>}{notice&&<p role="status">{notice}</p>}
  </form>
  {review&&<ConfirmSheet key={review.confirmationId} title="Review this bank" body={`${review.input.name} · ${formatCad(parseAmount(review.input.target,'Target'))} target · ${view==='household'?'Shared':'Personal'}`} extra={`${review.input.envelope?.purpose||'No purpose note.'} ${context?'Its connection to the intention has a separate review. ':''}No money will be moved.`} notice={notice||undefined} content={review.attempted?<button type="button" onClick={onCancel??(()=>{})}>Return with review saved</button>:undefined} confirmLabel={review.attempted?'Check saved creation':'Final Confirm'} confirmDisabled={rejected||!onReadAcceptedCommand} cancelDisabled={review.attempted&&!rejected} busy={busy||saving} onConfirm={()=>void confirm()} onCancel={edit}/>}
 </div>;
}
