import {projectedExpenseEffect,transactionProjection} from './budget.ts';
import type {Household,CommitResult} from './types.ts';
import type {CompanionScope} from './herculesCompanionContracts.ts';
import {companionFor} from './herculesCompanion.ts';
import {captureCommand} from '../ledgerSync/capture.ts';
import {matchPlanEvidence} from './planProjection.ts';
import {currentPlanVersion} from './planSystem.ts';
import {kittyBanksInView} from './kittyBanks.ts';
import {todayKey} from './calendar.ts';
import {validatePlayEnvelope,decodePlayOperation,decodePlayRoom,decodePlayPrivate,decodePlayDecor,decodePortrait,decodePlayPlacement,PLAY_SLOTS,PLAY_DISCOVERIES,PLAY_REWARDS,PLAY_THEMES,type PlayOperation,type PlayReward,type PlayAward} from './playContracts.ts';
export const hasPlayData=(h:Household)=>Boolean(h.playRoom||h.companionProfile?.play||h.companionProfile?.wornLook.value?.portrait||h.companionProfile?.savedLooks.some(l=>l.value?.portrait)||h.companionGallery?.some(g=>g.value?.look.portrait));
export function isPlayStep(step:{kind:string;args:unknown[]}):boolean {
 if(step.kind==='commitCompanionPlay')return true;
 if(step.kind!=='commitCompanion')return false;
 const operation=(step.args[0] as {operation?:{kind?:string;look?:{portrait?:unknown}}}|undefined)?.operation;
 return Boolean(operation?.kind?.startsWith('look.')&&operation.look?.portrait!==undefined);
}
export const playRoomFor=(h:Household)=>decodePlayRoom(h.playRoom);
export const playPrivateFor=(h:Household,memberId:string)=>decodePlayPrivate(companionFor(h,memberId).play);
function acceptedBankBacking(h:Household,goalId:string,memberId:string,asOf:string) {
 const evidence=matchPlanEvidence(h,{sourceReference:{type:'goal',id:goalId}},asOf.slice(0,7),asOf,memberId,'household');
 const fundIds=new Set((h.fundKittyAllocations??[]).filter(a=>a.goalId===goalId).map(a=>a.id));
 return {vaultCents:evidence.filter(e=>!fundIds.has(e.id)).reduce((sum,e)=>sum+(e.reserveCents??0),0),fundCents:evidence.filter(e=>fundIds.has(e.id)).reduce((sum,e)=>sum+(e.reserveCents??0),0)};
}
export function playBankFacts(h:Household,goalId:string,memberId:string){
 const goal=kittyBanksInView(h,'household',memberId).find(g=>g.id===goalId);if(!goal)return null;
 try {const asOf=todayKey(),backing=acceptedBankBacking(h,goalId,memberId,asOf);
 const plan=currentPlanVersion(h,'household',asOf.slice(0,7));
 const plannedCents=plan?.lines.filter(l=>l.sourceReference?.type==='goal'&&l.sourceReference.id===goalId).reduce((sum,l)=>sum+(l.decision?.contributionSchedule??[]).filter(c=>c.date>=asOf).reduce((n,c)=>n+c.amountCents,0),0)??0;
 return {goal,...backing,backingCents:backing.vaultCents+backing.fundCents,lifetimeCents:goal.savedCents,plannedCents};}catch{return null;}
}
export function rewardEvidence(h:Household,memberId:string,reward:PlayReward,goalId?:string):string|null{
 const gallery=(h.companionGallery??[]).filter(g=>g.value),room=playRoomFor(h);
 if(reward==='camera'){const seen=new Set<string>();const looks=gallery.filter(g=>g.creatorMemberId===memberId).filter(g=>{const key=JSON.stringify(Object.entries(g.value!.look.selections).sort());if(seen.has(key))return false;seen.add(key);return true;});return looks.length>=3?'gallery:'+looks.slice(0,3).map(g=>g.id).join(',').slice(0,180):null;}
 if(reward==='theatre'){const ids=[...new Set(room.slots.filter(s=>s.value?.kind==='portrait'&&gallery.some(g=>g.id===s.value!.id)).map(s=>s.value!.id))];return ids.length>=4?'exhibition:'+ids.slice(0,4).join(',').slice(0,180):null;}
 if(reward==='key')return playPrivateFor(h,memberId).discoveries.length>=6?'discoveries:six':null;
 if(reward==='orrery'){const session=h.sitDownSessions.find(s=>s.status==='closed');return session?'sitdown:'+session.id:null;}
 const goals=h.goals.filter(g=>g.shared&&(!goalId||g.id===goalId));
 if(reward==='lantern'){const dates=[...new Set([todayKey(),...h.goalContributions.map(c=>c.date),...(h.fundEvents??[]).map(e=>e.date)])].filter(d=>d<=todayKey()).sort();for(const goal of goals){if(goal.targetCents<=0)continue;for(const date of dates){try{const backing=acceptedBankBacking(h,goal.id,memberId,date);if(backing.vaultCents+backing.fundCents>=goal.targetCents)return 'funded:'+goal.id+':'+date;}catch{/* Invalid historical evidence cannot qualify. */}}}return null;}
 if(reward==='projector'){
  const byId=new Map(h.transactions.map(t=>[t.id,t]));const effects=new Map<string,number>();
  for(const transaction of h.transactions){const root=transactionProjection(transaction,byId).root.id;effects.set(root,(effects.get(root)??0)+projectedExpenseEffect(transaction,byId));}
  const purchase=h.goalPurchases.find(p=>goals.some(g=>g.id===p.goalId)&&p.spentCents>0&&p.transactionIds.length>0&&p.transactionIds.every(id=>byId.has(id))&&p.transactionIds.reduce((sum,id)=>sum+(effects.get(id)??0),0)>0);
  return purchase?'purchase:'+purchase.id:null;
 }
 return null;
}
function revision(actual:number,expected:number){if(!Number.isSafeInteger(expected)||actual!==expected)throw Error('PLAY_CHANGED: Someone changed this display. Your preview is kept; review the current room.');}
export type PlayIntent={version:1;id:string;scope:CompanionScope;operation:PlayOperation};
export const commitCompanionPlay=captureCommand('commitCompanionPlay',(h:Household,input:PlayIntent):CommitResult=>{
 validatePlayEnvelope(input);
 if(input.version!==1||!input.id||input.scope.environment!==h.environment||input.scope.householdId!==h.householdId||!h.members.some(m=>m.id===input.scope.memberId&&m.active))throw Error('PLAY_SCOPE_MISMATCH');
 const memberId=input.scope.memberId,room=playRoomFor(h),profile=companionFor(h,memberId),personal=decodePlayPrivate(profile.play),op=decodePlayOperation(input.operation);
 let shared=false;
 if(op.kind==='slot'){
  if(!PLAY_SLOTS.includes(op.slotId))throw Error('PLAY_SLOT_UNKNOWN');
  const old=room.slots.find(s=>s.id===op.slotId);revision(old?.revision??0,op.expectedRevision);const value=decodePlayPlacement(op.value);
  if(value){if(!op.slotId.startsWith(value.kind+'-'))throw Error('PLAY_SLOT_MISMATCH');
   if(value.kind==='portrait'&&!h.companionGallery?.some(g=>g.id===value.id&&g.value))throw Error('SHARED_PORTRAIT_REQUIRED');
   if(value.kind==='bank'&&!kittyBanksInView(h,'household',memberId).some(g=>g.id===value.id))throw Error('SHARED_BANK_REQUIRED');
   if(value.kind==='toy'&&!room.awards.some(a=>a.id===value.id))throw Error('SHARED_REWARD_REQUIRED');
  }
  room.slots=[...room.slots.filter(s=>s.id!==op.slotId),{id:op.slotId,revision:op.expectedRevision+1,value}];shared=true;
 }else if(op.kind==='decor'){revision(room.decor.revision,op.expectedRevision);room.decor={revision:op.expectedRevision+1,value:decodePlayDecor(op.value)};shared=true;
 }else if(op.kind==='private'){revision(personal.revision,op.expectedRevision);if(typeof op.sound!=='boolean'||typeof op.paused!=='boolean')throw Error('PLAY_INVALID_SETTINGS');personal.portrait=decodePortrait(op.portrait);personal.sound=op.sound;personal.paused=op.paused;personal.revision++;
 }else if(op.kind==='discover'){
  if(!PLAY_DISCOVERIES.includes(op.discovery)||!PLAY_THEMES.includes(op.theme))throw Error('PLAY_DISCOVERY_UNKNOWN');
  const needed:Record<string,string>={latch:'classic',tea:'classic',paper:'taylor',ribbon:'taylor',lighthouse:'newfoundland',boat:'newfoundland'};
  if(needed[op.discovery]&&needed[op.discovery]!==op.theme)throw Error('PLAY_DISCOVERY_THEME');
  if(op.discovery==='portrait'&&!h.companionGallery?.some(g=>g.id===op.galleryId&&g.value))throw Error('SHARED_PORTRAIT_REQUIRED');
  if(op.discovery==='mirror'&&!profile.wornLook.value?.selections.eyewear)throw Error('WEAR_GLASSES_TO_DISCOVER');
  if(!personal.discoveries.includes(op.discovery)){personal.discoveries.push(op.discovery);personal.revision++;}
 }else if(op.kind==='claim'){
  if(!PLAY_REWARDS.includes(op.reward))throw Error('PLAY_REWARD_UNKNOWN');
  const creative=['camera','key'].includes(op.reward),old=(creative?personal.awards:room.awards).find(a=>a.id===op.reward);
  const evidence=old?.evidence??rewardEvidence(h,memberId,op.reward,op.goalId);if(!evidence)throw Error('PLAY_MILESTONE_NOT_REACHED');
  const award:PlayAward=old??{id:op.reward,ruleVersion:1,evidence,claimedBy:memberId};
  if(creative){if(!old){personal.awards.push(award);personal.revision++;}if(op.share&&!room.awards.some(a=>a.id===op.reward)){room.awards.push({...award});shared=true;}}
  else {if(!old)room.awards.push(award);shared=true;}
 }else if(op.kind==='pin'){
  if(typeof op.pinned!=='boolean'||!kittyBanksInView(h,'household',memberId).some(g=>g.id===op.goalId))throw Error('SHARED_BANK_REQUIRED');
  room.pinnedGoals=room.pinnedGoals.filter(id=>id!==op.goalId);if(op.pinned){if(room.pinnedGoals.length>=3)throw Error('THREE_PINNED_BANKS');room.pinnedGoals.push(op.goalId);}shared=true;
 }else throw Error('PLAY_OPERATION_UNKNOWN');
 const next:Household={...h,...(shared?{playRoom:decodePlayRoom(room)}:{}),companionProfile:{...profile,play:decodePlayPrivate(personal)}};
 return {household:next,warnings:[],postedIds:[],...(!shared?{persistenceScope:'member-personal' as const,personalMemberId:memberId}:{}),undo:{id:input.id,label:'Hercules Play',snapshot:h,postedIds:[],commandKind:'hercules-play'}};
});
