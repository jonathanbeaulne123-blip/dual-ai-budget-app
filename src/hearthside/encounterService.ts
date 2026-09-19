import {sha256String} from '../core/synchronousHash.ts';
/** Pure canonical transition seam. Root supplies trusted evidence before calling it. */
import {vaultAssert} from './vaultContracts.ts';
import {decodeEncounterCommand,decodeSharedEncounter,encounterComposition,type EncounterRevealBinding,type SharedEncounter,type EncounterOutcome} from './encounterContracts.ts';
export type EncounterAuthority = {actorId:string;memberIds:string[];experienceIds:string[];wardrobeIds:string[];
  revealEvidence?:EncounterRevealBinding;outcomeEvidence?:EncounterOutcome};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export async function applyEncounterCommand(current:SharedEncounter|null,input:unknown,authority:EncounterAuthority):Promise<SharedEncounter>{return applyEncounterTransition(current,input,authority);}
export function applyEncounterTransition(current:SharedEncounter|null,input:unknown,authority:EncounterAuthority):SharedEncounter{
  const op=decodeEncounterCommand(input),members=[...authority.memberIds].sort();
  vaultAssert(members.length===2&&new Set(members).size===2&&members.includes(authority.actorId),'ENCOUNTER_SCOPE_CHANGED');
  if(op.kind==='encounter.start'){
    vaultAssert(!current&&same(op.participantMemberIds,members)&&(!op.experienceId||authority.experienceIds.includes(op.experienceId)),'ENCOUNTER_CHANGED');
    return decodeSharedEncounter({version:1,id:op.id,packId:op.packId,packVersion:1,revision:1,compositionRevision:1,createdBy:authority.actorId,participantMemberIds:members,experienceId:op.experienceId,reveal:null,choices:[],keptMemberIds:[],pausedMemberIds:[],outcomes:[]});
  }
  vaultAssert(current&&current.id===op.id,'ENCOUNTER_NOT_FOUND');const next=structuredClone(decodeSharedEncounter(current));
  vaultAssert(same(next.participantMemberIds,members),'ENCOUNTER_SCOPE_CHANGED');
  const material=()=>{next.compositionRevision++;next.keptMemberIds=[];};
  if(op.kind==='encounter.pause'||op.kind==='encounter.resume'){
    const paused=new Set(next.pausedMemberIds);if(op.kind==='encounter.pause'){paused.add(authority.actorId);next.keptMemberIds=next.keptMemberIds.filter(id=>id!==authority.actorId);}else paused.delete(authority.actorId);
    next.pausedMemberIds=[...paused].sort();
  }else{
    vaultAssert(!next.pausedMemberIds.includes(authority.actorId),'ENCOUNTER_PAUSED');
    if(['encounter.choose','encounter.keep','encounter.outcome'].includes(op.kind))vaultAssert(next.reveal&&same(next.reveal,authority.revealEvidence),'REVEAL_REQUIRED');
    switch(op.kind){
      case 'encounter.create-piece':throw Error('ENCOUNTER_DESIGN_AUTHORITY_REQUIRED');
      case 'encounter.choose':{
        vaultAssert(next.reveal&&op.choice.memberId===authority.actorId,'REVEAL_REQUIRED');
        const previous=next.choices.find(c=>c.memberId===authority.actorId);
        vaultAssert((previous?.revision??0)===op.expectedChoiceRevision&&op.choice.revision===op.expectedChoiceRevision+1,'ENCOUNTER_CHANGED');
        vaultAssert(!op.choice.wardrobeId||authority.wardrobeIds.includes(op.choice.wardrobeId),'WARDROBE_UNAVAILABLE');
        next.choices=[...next.choices.filter(c=>c.memberId!==authority.actorId),op.choice];material();break;
      }
      case 'encounter.reveal':
        vaultAssert(next.revision===op.expectedRevision&&same(op.binding,authority.revealEvidence)&&op.binding.encounterId===next.id&&op.binding.packId===next.packId,'REVEAL_REQUIRED');
        vaultAssert(!next.reveal||op.binding.generation>next.reveal.generation,'ENCOUNTER_CHANGED');next.reveal=op.binding;next.choices=[];material();break;
      case 'encounter.link':vaultAssert(next.revision===op.expectedRevision&&(!op.experienceId||authority.experienceIds.includes(op.experienceId)),'ENCOUNTER_CHANGED');next.experienceId=op.experienceId;material();break;
      case 'encounter.keep':vaultAssert(next.reveal&&next.choices.length===2&&next.pausedMemberIds.length===0&&op.digest===sha256String(JSON.stringify(encounterComposition(next))),'ENCOUNTER_CHANGED');next.keptMemberIds=[...new Set([...next.keptMemberIds,authority.actorId])].sort();break;
      case 'encounter.outcome':vaultAssert(op.digest===sha256String(JSON.stringify(encounterComposition(next)))&&op.outcome.recipeDigest===op.digest&&next.keptMemberIds.length===2&&next.pausedMemberIds.length===0&&same(op.outcome,authority.outcomeEvidence),'OUTCOME_REVIEW_REQUIRED');
        if(!next.outcomes.some(o=>same(o,op.outcome)))next.outcomes.push(op.outcome);break;
    }
  }
  if(same(next,current))return current;next.revision++;return decodeSharedEncounter(next);
}
