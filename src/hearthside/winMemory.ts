import type {Household} from '../core/types.ts';
import type {Win} from '../core/chapters.ts';
import {sha256String} from '../core/synchronousHash.ts';
import {canonical} from '../ledgerSync/patch.ts';
import {decodeHearthside,decodeMemory,type MemoryComposition} from './contracts.ts';
import {decodeWinProvenance} from './winMemoryProvenance.ts';
import {vaultAssert,vaultObject} from './vaultContracts.ts';
export type AdoptWinMemoryOperation={kind:'memory.adopt-win';winId:string;memoryId:string;expectedWinDigest:string};
type SourceHousehold=Pick<Household,'environment'|'householdId'|'members'|'wins'|'hearthside'>;
export function winMemoryId(scope:Pick<Household,'environment'|'householdId'>,winId:string):string{
 vaultAssert(['development','production'].includes(scope.environment)&&typeof scope.householdId==='string'&&scope.householdId.length>0&&typeof winId==='string'&&winId.length>0&&winId.length<=1000,'INVALID_WIN_PROVENANCE');
 return `win-memory-${sha256String(canonical({version:1,environment:scope.environment,householdId:scope.householdId,winId}))}`;
}
export function winSourceDigest(win:Win):string{
 vaultAssert(win.version===1&&typeof win.title==='string'&&Array.isArray(win.evidenceRefs)&&Array.isArray(win.keptByMemberIds)&&typeof win.authoredNote==='string'&&typeof win.hideAmounts==='boolean','INVALID_WIN_PROVENANCE');
 return sha256String(canonical({version:win.version,id:win.id,chapterId:win.chapterId,level:win.level,title:win.title,evidenceRefs:win.evidenceRefs,shownAt:win.shownAt,fadedAt:win.fadedAt,keptByMemberIds:[...win.keptByMemberIds].sort(),authoredNote:win.authoredNote,hideAmounts:win.hideAmounts,updatedAt:win.updatedAt}));
}
export function winAdoptionOperation(h:Pick<Household,'environment'|'householdId'>,win:Win):AdoptWinMemoryOperation{return{kind:'memory.adopt-win',winId:win.id,memoryId:winMemoryId(h,win.id),expectedWinDigest:winSourceDigest(win)};}
/** Pure synchronous authority transition: callers commit the returned memory atomically with its command receipt. */
export function adoptWinMemory(h:SourceHousehold,actor:string,input:unknown):MemoryComposition{
 const op=vaultObject(input,['kind','winId','memoryId','expectedWinDigest']);vaultAssert(op.kind==='memory.adopt-win'&&typeof op.winId==='string'&&typeof op.expectedWinDigest==='string'&&/^[a-f0-9]{64}$/.test(op.expectedWinDigest),'INVALID_WIN_ADOPTION');
 vaultAssert(h.members.some(m=>m.id===actor&&m.active),'HEARTHSIDE_MEMBER_REQUIRED');const id=winMemoryId(h,op.winId);vaultAssert(op.memoryId===id,'HEARTHSIDE_WIN_IDENTITY_CHANGED');
 const memories=decodeHearthside(h.hearthside).memories,existing=memories.find(m=>m.id===id||m.legacySource?.winId===op.winId);
 // An accepted adoption remains one identity even after a Win is dismissed/restored/deleted,
 // the memory is edited, or its publication is withdrawn. Retry never resurrects anything.
 if(existing){vaultAssert(existing.id===id&&existing.legacySource?.winId===op.winId&&existing.legacySource.sourceDigest===op.expectedWinDigest,'HEARTHSIDE_WIN_ALREADY_ADOPTED');return existing;}
 const win=h.wins?.find(w=>w.id===op.winId);vaultAssert(win&&win.level!=='acknowledgment','HEARTHSIDE_WIN_MISSING');vaultAssert(winSourceDigest(win)===op.expectedWinDigest,'HEARTHSIDE_WIN_CHANGED');
 vaultAssert(Number.isFinite(Date.parse(win.shownAt)),'INVALID_WIN_PROVENANCE');
 const source=decodeWinProvenance({version:1,kind:'win',winId:win.id,sourceDigest:op.expectedWinDigest,recordedAt:new Date(win.shownAt).toISOString(),level:win.level,unattributedCaption:win.authoredNote,historicalKeptMemberIds:win.keptByMemberIds});
 return decodeMemory({version:1,id,revision:1,title:win.title,date:source.recordedAt==='1970-01-01T00:00:00.000Z'?null:source.recordedAt.slice(0,10),experienceId:null,media:[],designs:[],recollections:[],hideAmounts:true,approvals:[],withdrawn:false,legacySource:source});
}
/** Generic composition cannot forge or remove historical adoption provenance. */
export function requireStableWinProvenance(previous:MemoryComposition|undefined,next:MemoryComposition):void{
 if(!previous&&(next.legacySource||next.id.startsWith('win-memory-')))throw Error('HEARTHSIDE_WIN_ADOPTION_REQUIRED');
 if(canonical(previous?.legacySource??null)!==canonical(next.legacySource??null))throw Error('HEARTHSIDE_WIN_PROVENANCE_IMMUTABLE');
}
export function assertLegacyWinWriteAllowed(h:Pick<Household,'hearthside'>):void{
 if(h.hearthside!==undefined)throw Error('HEARTHSIDE_UPDATE_REQUIRED: Review this Win as a Hearthside memory.');
}

/** New authority admissions cannot use the retired publication path; historical replay remains readable. */
export function rejectLegacyWinPublication(steps:readonly {kind:string}[]):void{if(steps.some(step=>step.kind==='keepWinAsMemory'))throw Error('HEARTHSIDE_UPDATE_REQUIRED: Review this Win as a Hearthside memory.');}
