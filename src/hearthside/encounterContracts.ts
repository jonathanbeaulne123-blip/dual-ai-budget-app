import { vaultAssert, vaultDigest, vaultInteger, vaultObject } from './vaultContracts.ts';
import { encounterPack } from './encounterPacks.ts';
export const encounterId = (v: unknown): string => { vaultAssert(typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(v), 'INVALID_ENCOUNTER'); return v; };
export const encounterText = (v: unknown, max = 1000): string => { vaultAssert(typeof v === 'string' && v.length <= max, 'INVALID_ENCOUNTER'); return v; };
const hash = (v: unknown): string => { vaultAssert(typeof v === 'string' && /^[a-f0-9]{64}$/.test(v), 'INVALID_ENCOUNTER'); return v; };
const list = <T>(v: unknown, decode: (item: unknown) => T, max = 20): T[] => { vaultAssert(Array.isArray(v) && v.length <= max, 'INVALID_ENCOUNTER'); return v.map(decode); };
export const encounterMembers = (v: unknown): string[] => { const rows = list(v, encounterId, 2); vaultAssert(new Set(rows).size === rows.length, 'INVALID_ENCOUNTER'); return rows.sort(); };
export type EncounterRevealBinding = { version: 1; id: string; encounterId: string; packId: string; generation: number; digest: string };
export function decodeEncounterRevealBinding(input: unknown): EncounterRevealBinding {
  const v = vaultObject(input, ['version','id','encounterId','packId','generation','digest']); vaultAssert(v.version === 1, 'INVALID_ENCOUNTER');
  return {version:1,id:encounterId(v.id),encounterId:encounterId(v.encounterId),packId:encounterPack(encounterId(v.packId)).id,generation:vaultInteger(v.generation,1),digest:hash(v.digest)};
}
export type EncounterChoice = { memberId: string; revision: number; colourId: string; order: string[]; words: string; drawing: {x:number;y:number}[]; wardrobeId: string | null };
export function decodeEncounterChoice(input: unknown): EncounterChoice {
  const v = vaultObject(input,['memberId','revision','colourId','order','words','drawing','wardrobeId']);
  const order = list(v.order,encounterId,3); vaultAssert(order.length===3 && new Set(order).size===3,'INVALID_ENCOUNTER');
  return {memberId:encounterId(v.memberId),revision:vaultInteger(v.revision,1),colourId:encounterId(v.colourId),order,words:encounterText(v.words,500),
    drawing:list(v.drawing,item=>{const p=vaultObject(item,['x','y']); vaultAssert(typeof p.x==='number'&&Number.isFinite(p.x)&&p.x>=0&&p.x<=1&&typeof p.y==='number'&&Number.isFinite(p.y)&&p.y>=0&&p.y<=1,'INVALID_ENCOUNTER');return{x:p.x,y:p.y};},128),
    wardrobeId:v.wardrobeId===null?null:encounterId(v.wardrobeId)};
}
export type EncounterOutcome = { kind:'design'|'memory'; id:string; revision:number; designId?:string; recipeDigest:string };
export function decodeEncounterOutcome(input: unknown): EncounterOutcome {
  const v=vaultObject(input,['kind','id','revision','designId','recipeDigest']); vaultAssert(v.kind==='design'||v.kind==='memory','INVALID_ENCOUNTER');
  vaultAssert((v.kind==='design')===(typeof v.designId==='string'),'INVALID_ENCOUNTER');
  return {kind:v.kind,id:encounterId(v.id),revision:vaultInteger(v.revision,1),...(v.kind==='design'?{designId:encounterId(v.designId)}:{}),recipeDigest:hash(v.recipeDigest)};
}
export type SharedEncounter = {version:1;id:string;packId:string;packVersion:1;revision:number;compositionRevision:number;createdBy:string;participantMemberIds:string[];
  experienceId:string|null;reveal:EncounterRevealBinding|null;choices:EncounterChoice[];keptMemberIds:string[];pausedMemberIds:string[];outcomes:EncounterOutcome[]};
export function decodeSharedEncounter(input: unknown): SharedEncounter {
  const v=vaultObject(input,['version','id','packId','packVersion','revision','compositionRevision','createdBy','participantMemberIds','experienceId','reveal','choices','keptMemberIds','pausedMemberIds','outcomes']);
  vaultAssert(v.version===1&&v.packVersion===1,'INVALID_ENCOUNTER'); const pack=encounterPack(encounterId(v.packId));
  const members=encounterMembers(v.participantMemberIds), choices=list(v.choices,decodeEncounterChoice,2), id=encounterId(v.id), reveal=v.reveal===null?null:decodeEncounterRevealBinding(v.reveal);
  const kept=encounterMembers(v.keptMemberIds), paused=encounterMembers(v.pausedMemberIds),createdBy=encounterId(v.createdBy);
  vaultAssert(members.length===2&&members.includes(createdBy)&&new Set(choices.map(c=>c.memberId)).size===choices.length&&[...kept,...paused,...choices.map(c=>c.memberId)].every(m=>members.includes(m)),'INVALID_ENCOUNTER');
  vaultAssert(!reveal||(reveal.encounterId===id&&reveal.packId===pack.id),'INVALID_ENCOUNTER');
  for(const c of choices) vaultAssert((pack.mechanic!=='incise'||c.words.length<=16)&&(pack.mechanic!=='mummers'||(c.words.trim().length>0&&c.wardrobeId!==null))&&pack.make.colours.some(p=>p.id===c.colourId)&&c.order.every(i=>pack.make.items.some(p=>p.id===i))&&(pack.mechanic==='mummers'||c.wardrobeId===null),'INVALID_ENCOUNTER');
  vaultAssert(kept.length===0||(reveal&&choices.length===2),'INVALID_ENCOUNTER');
  return {version:1,id,packId:pack.id,packVersion:1,revision:vaultInteger(v.revision,1),compositionRevision:vaultInteger(v.compositionRevision,1),createdBy,participantMemberIds:members,
    experienceId:v.experienceId===null?null:encounterId(v.experienceId),reveal,choices:choices.sort((a,b)=>a.memberId.localeCompare(b.memberId)),keptMemberIds:kept,pausedMemberIds:paused,outcomes:list(v.outcomes,decodeEncounterOutcome,20)};
}
export function encounterComposition(e: SharedEncounter) {
  return {version:1,id:e.id,packId:e.packId,packVersion:e.packVersion,compositionRevision:e.compositionRevision,participantMemberIds:e.participantMemberIds,
    experienceId:e.experienceId,reveal:e.reveal,choices:e.choices};
}
export const encounterCompositionDigest = (e: SharedEncounter) => vaultDigest(encounterComposition(e));
export type EncounterCommand =
  | {kind:'encounter.start';id:string;packId:string;participantMemberIds:string[];experienceId:string|null}
  | {kind:'encounter.choose';id:string;expectedChoiceRevision:number;choice:EncounterChoice}
  | {kind:'encounter.reveal';id:string;expectedRevision:number;binding:EncounterRevealBinding}
  | {kind:'encounter.keep'|'encounter.create-piece';id:string;digest:string}
  | {kind:'encounter.pause'|'encounter.resume';id:string}
  | {kind:'encounter.link';id:string;expectedRevision:number;experienceId:string|null}
  | {kind:'encounter.outcome';id:string;digest:string;outcome:EncounterOutcome};
export function decodeEncounterCommand(input: unknown): EncounterCommand {
  const v=vaultObject(input,['kind','id','packId','participantMemberIds','experienceId','expectedChoiceRevision','choice','expectedRevision','binding','digest','outcome']);const id=encounterId(v.id);
  const exact=(keys:string[])=>vaultObject(input,['kind','id',...keys]);
  switch(v.kind){
    case 'encounter.start':exact(['packId','participantMemberIds','experienceId']);return{kind:v.kind,id,packId:encounterPack(encounterId(v.packId)).id,participantMemberIds:encounterMembers(v.participantMemberIds),experienceId:v.experienceId===null?null:encounterId(v.experienceId)};
    case 'encounter.choose':exact(['expectedChoiceRevision','choice']);return{kind:v.kind,id,expectedChoiceRevision:vaultInteger(v.expectedChoiceRevision),choice:decodeEncounterChoice(v.choice)};
    case 'encounter.reveal':exact(['expectedRevision','binding']);return{kind:v.kind,id,expectedRevision:vaultInteger(v.expectedRevision,1),binding:decodeEncounterRevealBinding(v.binding)};
    case 'encounter.create-piece':case 'encounter.keep':exact(['digest']);return{kind:v.kind,id,digest:hash(v.digest)};
    case 'encounter.pause':case 'encounter.resume':exact([]);return{kind:v.kind,id};
    case 'encounter.link':exact(['expectedRevision','experienceId']);return{kind:v.kind,id,expectedRevision:vaultInteger(v.expectedRevision,1),experienceId:v.experienceId===null?null:encounterId(v.experienceId)};
    case 'encounter.outcome':exact(['digest','outcome']);return{kind:v.kind,id,digest:hash(v.digest),outcome:decodeEncounterOutcome(v.outcome)};
    default:throw new Error('INVALID_ENCOUNTER_COMMAND');
  }
}
