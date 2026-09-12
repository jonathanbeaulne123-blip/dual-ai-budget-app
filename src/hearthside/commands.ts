import {adoptWinMemory,requireStableWinProvenance,type AdoptWinMemoryOperation} from './winMemory.ts';
import {applyFurnitureMove,type FurnitureMove} from './roomFurniture.ts';
import {applyEncounterTransition} from './encounterService.ts';
import {decodeEncounterCommand,type EncounterCommand} from './encounterContracts.ts';
import {ENCOUNTER_WARDROBE} from './encounterWardrobe.ts';
import {validateRoomCapture,roomHistoryItemAvailable,type RecordedRoom} from './roomHistory.ts';
import {decodeStudioHandoff,type StudioHandoff} from "./studioHandoff.ts";
import type { Household, CommitResult } from '../core/types.ts';
import { captureCommand } from '../ledgerSync/capture.ts';
import {saveTask,type TaskInput} from '../core/tasks.ts';
import {saveNativeEvent,type NativeEventInput} from '../core/nativeEvents.ts';
import { canonical } from '../ledgerSync/patch.ts';
import { decodeHearthside, decodeExperience, decodeNote, decodeMemory, decodeOccasion, decodePlacement, occasionDate, identifier, object, revisionValue, memoryKeptByEveryone, type SharedExperience, type PlacedNote, type MemoryComposition, type PersonalOccasion, type RoomPlacement, type SharedReference } from './contracts.ts';

export type HearthsideOperation = EncounterCommand | AdoptWinMemoryOperation
  | {kind:'furniture.save';value:FurnitureMove}
  | {kind:'room.capture';expectedRevision:0;value:RecordedRoom}
  | {kind:'room.keep'|'room.withdraw';expectedRevision:number;id:string}
  | {kind:'studio.handoff';expectedRevision:number;value:StudioHandoff}
  | {kind:'experience.add-task';id:string;expectedRevision:number;task:TaskInput}
  | {kind:'experience.schedule';id:string;expectedRevision:number;event:NativeEventInput}
  | { kind: 'experience.save'; expectedRevision: number; value: SharedExperience }
  | { kind: 'note.save'; expectedRevision: number; value: PlacedNote }
  | { kind: 'memory.compose'; expectedRevision: number; value: MemoryComposition }
  | { kind: 'memory.keep' | 'memory.withdraw'; expectedRevision: number; id: string }
  | {kind:'occasion.prepare';expectedRevision:number;id:string;year:number;experience:SharedExperience}
  | { kind: 'occasion.save'; expectedRevision: number; value: PersonalOccasion }
  | { kind: 'placement.save'; expectedRevision: number; value: RoomPlacement };
export type HearthsideIntent = {
  version: 1; id: string;
  scope: { environment: Household['environment']; householdId: string; memberId: string };
  operation: HearthsideOperation;
};
export const hasHearthsideData = (h: Pick<Household, 'hearthside'>) => h.hearthside !== undefined;
export function hearthsideOperationalCollection(operation:unknown):'tasks'|'nativeEvents'|null {
  const property=operation&&typeof operation==='object'?Object.getOwnPropertyDescriptor(operation,'kind'):undefined;
  const kind=property&&'value' in property?property.value:undefined;
  return kind==='experience.add-task'?'tasks':kind==='experience.schedule'?'nativeEvents':null;
}
function expectRevision(actual: number, expected: number, next?: number) {
  revisionValue(expected);
  if (actual !== expected || next !== undefined && next !== expected + 1) throw Error('HEARTHSIDE_CHANGED: This has changed. Your draft is kept; review the current version.');
}
/** Resolve new links against shared, canonical records; a private id never becomes a shared link. */
export function sharedReferenceExists(h: Household, reference: SharedReference): boolean {
  const s = decodeHearthside(h.hearthside);
  switch (reference.kind) {
    case 'chapter': return Boolean(h.chapters?.some(r => r.id === reference.id));
    case 'bank': return h.goals.some(r => r.id === reference.id && r.shared);
    case 'task': return Boolean(h.tasks?.some(r => r.id === reference.id && r.visibility === 'household' && !r.deleted));
    case 'calendar-event': return Boolean(h.nativeEvents?.some(r => r.id === reference.id && r.visibility === 'household' && !r.deleted));
    case 'plan-line': return Boolean(h.planVersions?.some(p => p.id === reference.planVersionId && p.scope === 'household' && p.lines.some(r => r.id === reference.id)));
    case 'memory': return s.memories.some(r => r.id === reference.id && !r.withdrawn);
    case 'occasion': return s.occasions.some(r => r.id === reference.id);
    // Designs and reviewed Workspace copies are accepted through their dedicated authorities.
    // A string supplied by a client cannot certify a private document as shared.
    case 'piece': return s.designs.some(d=>d.designId===reference.designId&&d.pieceIds.includes(reference.id)&& (reference.revision===undefined||reference.revision<=d.revision));
    case 'artifact': return false;
  }
}
export function validateMemoryCandidate(h:Household,actor:string,input:unknown,expectedRevision:number):MemoryComposition {
  if(!h.members.some(m=>m.id===actor&&m.active))throw Error('HEARTHSIDE_MEMBER_REQUIRED');
  const s=decodeHearthside(h.hearthside),value=decodeMemory(input),old=s.memories.find(m=>m.id===value.id);
    expectRevision(old?.revision ?? 0, expectedRevision, value.revision);
  if(value.experienceId!==null&&!s.experiences.some(e=>e.id===value.experienceId))throw Error('HEARTHSIDE_EXPERIENCE_MISSING');
    if (value.approvals.length || value.withdrawn) throw Error('HEARTHSIDE_MEMORY_REVIEW_REQUIRED');
    if (old?.withdrawn) throw Error('HEARTHSIDE_MEMORY_WITHDRAWN');
    // Only the speaker can author their recollection. Editing shared presentation
    // clears every approval, including when the edit merely hides an amount.
    const other = (rows: MemoryComposition['recollections']) => rows.filter(r => r.memberId !== actor).sort((a, b) => a.memberId.localeCompare(b.memberId));
    if (canonical(other(value.recollections)) !== canonical(other(old?.recollections ?? []))) throw Error('HEARTHSIDE_RECOLLECTION_AUTHOR_REQUIRED');
    if (value.recollections.some(r => !h.members.some(m => m.id === r.memberId))) throw Error('HEARTHSIDE_MEMBER_REQUIRED');
    for(const ref of value.designs)if(!s.designs.some(d=>d.designId===ref.documentId&&d.pieceIds.includes(ref.pieceId)&&d.revision>=ref.revision))throw Error('HEARTHSIDE_SHARED_DESIGN_REQUIRED');
  requireStableWinProvenance(old,value);
  return value;
}
export const commitHearthside = captureCommand('commitHearthside', (h: Household, input: HearthsideIntent): CommitResult => {
  object(input, ['version', 'id', 'scope', 'operation']); identifier(input.id);
  object(input.scope, ['environment', 'householdId', 'memberId']);
  const actor = identifier(input.scope.memberId);
  if (input.version !== 1 || input.scope.householdId !== h.householdId || input.scope.environment !== h.environment || !h.members.some(m => m.id === actor && m.active)) throw Error('HEARTHSIDE_SCOPE_MISMATCH');
  const s = decodeHearthside(h.hearthside);
  const operationKind=Object.getOwnPropertyDescriptor(input.operation??{},'kind');
  if(!operationKind||!('value' in operationKind))throw Error('HEARTHSIDE_INVALID_OBJECT');
  if(typeof input.operation?.kind==='string'&&input.operation.kind.startsWith('encounter.')){
    const op=decodeEncounterCommand(input.operation),current=s.encounters?.find(e=>e.id===op.id)??null;
    const outcome=op.kind==='encounter.outcome'?op.outcome:undefined;
    if(outcome&&!sharedReferenceExists(h,outcome.kind==='memory'?{kind:'memory',id:outcome.id,revision:outcome.revision}:{kind:'piece',id:outcome.id,designId:outcome.designId,revision:outcome.revision}))throw Error('OUTCOME_REVIEW_REQUIRED');
    const next=applyEncounterTransition(current,op,{actorId:actor,memberIds:h.members.filter(m=>m.active).map(m=>m.id),experienceIds:s.experiences.filter(e=>e.state!=='archived').map(e=>e.id),wardrobeIds:ENCOUNTER_WARDROBE.map(w=>w.id),
      revealEvidence:op.kind==='encounter.reveal'?op.binding:current?.reveal??undefined,outcomeEvidence:outcome});
    s.encounters=[...(s.encounters??[]).filter(e=>e.id!==next.id),next];
    return {household:{...h,hearthside:decodeHearthside(s)},postedIds:[],warnings:[],undo:{id:input.id,label:'Shared encounter',snapshot:h,postedIds:[],actorMemberId:actor,commandKind:'hearthside'}};
  }
  const op=input.operation as Exclude<HearthsideOperation,EncounterCommand>;
  let working=h;
  if(op.kind==='memory.adopt-win'){
    const memory=adoptWinMemory(h,actor,op);s.memories=[...s.memories.filter(m=>m.id!==memory.id),memory];
    return {household:{...h,hearthside:decodeHearthside(s)},postedIds:[],warnings:[],undo:{id:input.id,label:'Review an earlier Win as a memory',snapshot:h,postedIds:[],actorMemberId:actor,commandKind:'hearthside'}};
  }
  object(op, ['kind', 'expectedRevision', 'id', 'value', 'year', 'experience','task','event']);
  object(op, op.kind==='furniture.save'?['kind','value']:op.kind==='experience.add-task'?['kind','expectedRevision','id','task']:op.kind==='experience.schedule'?['kind','expectedRevision','id','event']:op.kind==='occasion.prepare'?['kind','expectedRevision','id','year','experience']:['memory.keep','memory.withdraw','room.keep','room.withdraw'].includes(op.kind) ? ['kind', 'expectedRevision', 'id'] : ['kind', 'expectedRevision', 'value']);
  const experienceExists = (id: string | null) => { if (id !== null && !s.experiences.some(e => e.id === id)) throw Error('HEARTHSIDE_EXPERIENCE_MISSING'); };
  if(op.kind==='experience.add-task'||op.kind==='experience.schedule'){
    const experience=s.experiences.find(e=>e.id===identifier(op.id));if(!experience||experience.state==='archived')throw Error('HEARTHSIDE_EXPERIENCE_MISSING');
    expectRevision(experience.revision,op.expectedRevision);
    if(op.kind==='experience.add-task'){
      if(op.task.memberId!==actor||op.task.expectedRevision!==0||op.task.task.visibility!=='household'||op.task.task.deleted||op.task.task.moneyLink!==null||op.task.task.expectedAmountCents!==null)throw Error('HEARTHSIDE_PRACTICAL_TASK_REQUIRED');
      working=saveTask(h,op.task).household;experience.references.push({kind:'task',id:op.task.id});
    }else{
      if(op.event.memberId!==actor||op.event.expectedRevision!==0||op.event.event.visibility!=='household'||op.event.event.deleted)throw Error('HEARTHSIDE_SHARED_DATE_REQUIRED');
      working=saveNativeEvent(h,op.event).household;experience.references.push({kind:'calendar-event',id:op.event.id});
    }
    experience.revision++;
  } else if (op.kind === 'experience.save') {
    const value = decodeExperience(op.value), old = s.experiences.find(e => e.id === value.id);
    expectRevision(old?.revision ?? 0, op.expectedRevision, value.revision);
    if (value.createdBy !== (old?.createdBy ?? actor)) throw Error('HEARTHSIDE_AUTHOR_MISMATCH');
    for (const ref of value.references) if (!old?.references.some(r => canonical(r) === canonical(ref)) && !sharedReferenceExists(h, ref)) throw Error('HEARTHSIDE_SHARED_REFERENCE_REQUIRED');
    s.experiences = [...s.experiences.filter(e => e.id !== value.id), value];
  } else if(op.kind==='room.capture'){
    if(op.expectedRevision!==0)throw Error('HEARTHSIDE_CHANGED');
    const frame=validateRoomCapture(h,op.value,actor);s.roomHistory=[...(s.roomHistory??[]),frame];
  } else if(op.kind==='room.keep'||op.kind==='room.withdraw'){
    const frame=s.roomHistory?.find(row=>row.id===identifier(op.id));if(!frame)throw Error('HEARTHSIDE_ROOM_HISTORY_MISSING');
    expectRevision(frame.revision,op.expectedRevision);
    if(op.kind==='room.keep'){
      if(frame.withdrawn||frame.items.some(item=>!roomHistoryItemAvailable(h,item)))throw Error('HEARTHSIDE_ROOM_HISTORY_UNAVAILABLE');
      if(!frame.approvals.some(a=>a.memberId===actor&&a.revision===frame.revision))frame.approvals.push({memberId:actor,revision:frame.revision});
    }else{frame.withdrawn=true;frame.approvals=[];frame.revision++;}
  } else if(op.kind==='studio.handoff'){
    const value=decodeStudioHandoff(op.value),old=s.handoffs?.find(row=>row.id===value.id);
    expectRevision(old?.revision??0,op.expectedRevision,value.revision);
    if(value.authorId!==actor||old&&old.authorId!==actor||value.recipientId===actor||!h.members.some(m=>m.active&&m.id===value.recipientId))throw Error('HEARTHSIDE_HANDOFF_AUTHOR_REQUIRED');
    if(old&&(old.design.documentId!==value.design.documentId||old.design.pieceId!==value.design.pieceId))throw Error('HEARTHSIDE_HANDOFF_IDENTITY_CHANGED');
    if(s.handoffs?.some(row=>row.id!==value.id&&row.authorId===actor&&row.design.documentId===value.design.documentId&&row.design.pieceId===value.design.pieceId))throw Error('HEARTHSIDE_HANDOFF_ALREADY_EXISTS');
    if(!s.designs.some(d=>d.designId===value.design.documentId&&d.pieceIds.includes(value.design.pieceId)&&d.revision>=value.design.revision))throw Error('HEARTHSIDE_SHARED_DESIGN_REQUIRED');
    s.handoffs=[...(s.handoffs??[]).filter(row=>row.id!==value.id),value];
  } else if (op.kind === 'note.save') {
    const value = decodeNote(op.value), old = s.notes.find(n => n.id === value.id);
    expectRevision(old?.revision ?? 0, op.expectedRevision, value.revision);
    if (value.authorId !== actor || old && old.authorId !== actor) throw Error('HEARTHSIDE_AUTHOR_REQUIRED');
    experienceExists(value.experienceId);
    s.notes = [...s.notes.filter(n => n.id !== value.id), value];
  } else if (op.kind === 'memory.compose') {
    const value=validateMemoryCandidate(h,actor,op.value,op.expectedRevision);
    const binding=value.publication;
    if(value.media.length&&(!binding||binding.memoryId!==value.id||binding.memoryRevision!==value.revision))throw Error('HEARTHSIDE_CONTENT_PUBLICATION_REQUIRED');
    if(!value.media.length&&binding)throw Error('HEARTHSIDE_MEMORY_BINDING_UNEXPECTED');
    s.memories = [...s.memories.filter(m => m.id !== value.id), value];
  } else if (op.kind === 'memory.keep' || op.kind === 'memory.withdraw') {
    const memory = s.memories.find(m => m.id === identifier(op.id));
    if (!memory) throw Error('HEARTHSIDE_MEMORY_MISSING');
    expectRevision(memory.revision, op.expectedRevision);
    if (op.kind === 'memory.keep') {
      if (memory.withdrawn) throw Error('HEARTHSIDE_MEMORY_WITHDRAWN');
      if(!memory.approvals.some(a=>a.memberId===actor&&a.revision===memory.revision))memory.approvals.push({memberId:actor,revision:memory.revision});
    } else {
      memory.withdrawn = true; memory.approvals = []; memory.revision++;
      // Access revocation is handled before this command by the publication service.
      if (s.publications.some(p => p.sourceId === memory.id && p.state !== 'withdrawn')) throw Error('HEARTHSIDE_REVOKE_ACCESS_FIRST');
    }
  } else if (op.kind === 'occasion.save') {
    const value = decodeOccasion(op.value), old = s.occasions.find(o => o.id === value.id);
    expectRevision(old?.revision ?? 0, op.expectedRevision, value.revision);
    for (const occurrence of value.occurrences) {
      if (occurrence.id !== `${value.id}:${occurrence.year}`) throw Error('HEARTHSIDE_OCCURRENCE_ID');
      experienceExists(occurrence.experienceId);
      if (occurrence.memoryIds.some(id => !s.memories.some(m => m.id === id))) throw Error('HEARTHSIDE_MEMORY_MISSING');
    }
    // Past occurrences and their links are historical records, never recycled for another year.
    if (old?.occurrences.some(o => !value.occurrences.some(n => n.id === o.id && n.year === o.year && n.date === o.date && (!o.experienceId || n.experienceId === o.experienceId) && o.memoryIds.every(id => n.memoryIds.includes(id))))) throw Error('HEARTHSIDE_OCCURRENCE_HISTORY_REQUIRED');
    s.occasions = [...s.occasions.filter(o => o.id !== value.id), value];
  } else if(op.kind==='occasion.prepare'){
    const occasion=s.occasions.find(o=>o.id===identifier(op.id));if(!occasion)throw Error('HEARTHSIDE_OCCASION_MISSING');
    expectRevision(occasion.revision,op.expectedRevision);const date=occasionDate(occasion,op.year),id=`${occasion.id}:${op.year}`;
    if(occasion.occurrences.some(o=>o.id===id&&o.experienceId))throw Error('HEARTHSIDE_OCCASION_ALREADY_PREPARED');
    const experience=decodeExperience(op.experience);
    if(experience.id!==`EXP-occasion:${id}`||experience.createdBy!==actor||experience.revision!==1||s.experiences.some(e=>e.id===experience.id)||canonical(experience.references)!==canonical([{kind:'occasion',id:occasion.id}]))throw Error('HEARTHSIDE_OCCASION_PREPARATION_CHANGED');
    s.experiences.push(experience);
    const old=occasion.occurrences.find(o=>o.id===id);
    occasion.occurrences=[...occasion.occurrences.filter(o=>o.id!==id),{id,year:op.year,date:old?.date??date,experienceId:experience.id,memoryIds:old?.memoryIds??[]}];occasion.revision++;
  } else if(op.kind==='furniture.save'){
    s.furniture=applyFurnitureMove(s.furniture??[],op.value);
  } else if (op.kind === 'placement.save') {
    const value = decodePlacement(op.value), old = s.placements.find(p => p.id === value.id);
    expectRevision(old?.revision ?? 0, op.expectedRevision, value.revision);
    if(old&&(old.room!==value.room||canonical(old.object)!==canonical(value.object)))throw Error('HEARTHSIDE_PLACEMENT_IDENTITY_CHANGED');
    if(s.placements.some(p=>p.id!==value.id&&p.room===value.room&&canonical(p.object)===canonical(value.object)))throw Error('HEARTHSIDE_PLACEMENT_ALREADY_EXISTS');
    const target = value.object;
    const exists = target.kind === 'experience' ? s.experiences.some(e => e.id === target.id) : target.kind === 'note' ? s.notes.some(n => n.id === target.id && !n.archived) : target.kind === 'memory' ? s.memories.some(m => m.id === target.id && memoryKeptByEveryone(m, h.members.filter(m => m.active).map(m => m.id))) : target.kind==='piece'&&s.designs.some(d=>d.designId===target.designId&&d.pieceIds.includes(target.id));
    if (!exists) throw Error('HEARTHSIDE_DISPLAY_REFERENCE_REQUIRED');
    s.placements = [...s.placements.filter(p => p.id !== value.id), value];
  } else throw Error('HEARTHSIDE_OPERATION_UNKNOWN');
  return { household: { ...working, hearthside: decodeHearthside(s) }, postedIds: [], warnings: [], undo: { id: input.id, label: 'Hearthside', snapshot: h, postedIds: [], actorMemberId: actor, commandKind: 'hearthside' } };
});
