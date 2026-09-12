import {useEffect,useRef,useState} from 'react';
import type {Household} from '../core/types.ts';
import type {KitchenCommand} from '../kitchenCommand.ts';
import type {KittySubmissionReader} from '../kitty/KittyBankRoom.tsx';
import {capturedIntent,type CapturedIntent} from '../ledgerSync/capture.ts';
import {playBankFacts} from '../core/herculesPlay.ts';
import {kittyBankBackingStep} from '../core/kittyBanks.ts';
import {todayKey} from '../core/calendar.ts';
import type {NativeFundingIntent,NativeReceiptUpdate} from './NativeSceneSurface.tsx';

/** Classify the captured command after exact review, never an animation or a button label. */
export function nativeReceiptKind(capture:CapturedIntent|undefined,bankId:string):NativeReceiptUpdate['kind']|null {
  if(capture?.steps.length!==1)return null;
  const step=capture.steps[0]!,input=step.args[0] as {goalId?:string;allocations?:Array<{goalId:string}>}|undefined;
  if(step.kind==='contributeToGoal'&&step.args[0]===bankId)return 'contribution';
  if(step.kind==='allocateHouseholdFundSurplus'&&input?.allocations?.some(row=>row.goalId===bankId))return 'earmark';
  if(input?.goalId!==bankId)return null;
  if(step.kind==='fundGoal')return 'contribution';
  if(step.kind==='releaseHouseholdFundKitty'||step.kind==='purchaseGoal')return 'release';
  if(step.kind==='saveGoalEnvelope')return 'target-change';
  return null;
}
export function useNativeFundingReview(household:Household,memberId:string,onCommand:KitchenCommand,onReadSubmission:KittySubmissionReader|undefined,onReadAcceptedHousehold:((id:string)=>Promise<Household|null>)|undefined){
  const current=useRef(household);current.current=household;
  const pending=useRef<{intent:NativeFundingIntent;bankId:string}|null>(null),proofs=useRef(new Map<string,NativeReceiptUpdate['kind']>()),alive=useRef(false);
  const [receipt,setReceipt]=useState<NativeReceiptUpdate>(),[message,setMessage]=useState('');
  const recovering=useRef(new Set<string>());
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current=null;proofs.current.clear();};},[]);
  function begin(intent:NativeFundingIntent):string|null {
    const identity=intent.identity,h=current.current;
    if(identity.environment!==h.environment||identity.householdId!==h.householdId||identity.memberId!==memberId||!h.members.some(m=>m.id===memberId&&m.active))return null;
    const goal=h.goals.find(g=>g.shared&&g.envelope?.designRef?.designId===identity.designId);
    if(!goal){setMessage('This piece is here for its own sake. Link a bank deliberately before reviewing money for it.');return null;}
    pending.current={intent,bankId:goal.id};proofs.current.clear();setReceipt(undefined);setMessage('Choose the backing action and review its exact details in your bank.');return goal.id;
  }
  function accept(id:string,h:Household){
    const selected=pending.current,kind=proofs.current.get(id);if(!alive.current||!selected||!kind)return;
    const identity=selected.intent.identity;if(h.householdId!==identity.householdId||h.environment!==identity.environment)return;
    const goal=h.goals.find(g=>g.id===selected.bankId&&g.shared&&g.envelope?.designRef?.designId===identity.designId);if(!goal)return;
    const facts=playBankFacts(h,goal.id,memberId);
    setReceipt({identity,receiptId:id,kind,status:'accepted',backing:facts?{status:'available',step:kittyBankBackingStep(h,goal,todayKey())}:{status:'unavailable'}});
    recovering.current.delete(id);
  }
  async function recover(id:string){const h=await onReadAcceptedHousehold?.(id);if(h)accept(id,h);else if(alive.current)setMessage('The receipt is accepted. Current backing is still arriving before AR can update.');}
  useEffect(()=>{for(const id of recovering.current)void recover(id).catch(()=>{});},[household.revision]);
  const command:KitchenCommand=async(fn,options)=>{
    const result=await onCommand(h=>{
      const outcome=fn(h),selected=pending.current,id=options?.confirmationId;
      if(selected&&id){const kind=nativeReceiptKind(capturedIntent(outcome.household),selected.bankId);if(kind)proofs.current.set(id,kind);}
      return outcome;
    },options);
    if(result?.kind==='synchronized'&&result.ok&&options?.confirmationId)accept(options.confirmationId,result.household);
    return result;
  };
  const read:KittySubmissionReader|undefined=onReadSubmission?async id=>{const status=await onReadSubmission(id);if(status==='accepted'&&proofs.current.has(id)){recovering.current.add(id);await recover(id);}return status;}:undefined;
  return {begin,command,read,receipt,message};
}
