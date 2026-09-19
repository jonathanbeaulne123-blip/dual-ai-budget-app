import {vaultAssert,vaultObject} from './vaultContracts.ts';
export type LegacyWinProvenance={version:1;kind:'win';winId:string;sourceDigest:string;recordedAt:string;level:'shared-win'|'first'|'graduation';unattributedCaption:string;historicalKeptMemberIds:string[]};
function text(raw:unknown,max:number,empty=false):string{vaultAssert(typeof raw==='string'&&raw.length<=max&&(empty||raw.trim().length>0)&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw),'INVALID_WIN_PROVENANCE');return raw;}
export function decodeWinProvenance(raw:unknown):LegacyWinProvenance{
 const r=vaultObject(raw,['version','kind','winId','sourceDigest','recordedAt','level','unattributedCaption','historicalKeptMemberIds']);
 vaultAssert(r.version===1&&r.kind==='win'&&typeof r.sourceDigest==='string'&&/^[a-f0-9]{64}$/.test(r.sourceDigest)&&typeof r.recordedAt==='string'&&Number.isFinite(Date.parse(r.recordedAt))&&new Date(r.recordedAt).toISOString()===r.recordedAt&&['shared-win','first','graduation'].includes(String(r.level)),'INVALID_WIN_PROVENANCE');
 vaultAssert(Array.isArray(r.historicalKeptMemberIds)&&r.historicalKeptMemberIds.length<=20,'INVALID_WIN_PROVENANCE');
 vaultAssert(Object.getPrototypeOf(r.historicalKeptMemberIds)===Array.prototype&&Reflect.ownKeys(r.historicalKeptMemberIds).every(k=>typeof k==='string'&&(k==='length'||/^(0|[1-9]\d*)$/.test(k))),'INVALID_WIN_PROVENANCE');
 const memberIds:string[]=[];for(let i=0;i<r.historicalKeptMemberIds.length;i++){const d=Object.getOwnPropertyDescriptor(r.historicalKeptMemberIds,String(i));vaultAssert(d&&'value' in d,'INVALID_WIN_PROVENANCE');memberIds.push(text(d.value,300));}vaultAssert(new Set(memberIds).size===memberIds.length,'INVALID_WIN_PROVENANCE');
 return{version:1,kind:'win',winId:text(r.winId,1000),sourceDigest:r.sourceDigest,recordedAt:r.recordedAt,level:r.level as LegacyWinProvenance['level'],unattributedCaption:text(r.unattributedCaption,6000,true),historicalKeptMemberIds:memberIds.sort()};
}
export const LEGACY_WIN_CAPTION_LABEL='Earlier note · author not recorded';
/** Deliberate guest/projector copies contain reviewed words only, never source IDs or historical approvers. */
export function winPublicCaption(source:LegacyWinProvenance|undefined):{label:string;text:string}|null{
 if(!source)return null;const exact=decodeWinProvenance(source);return exact.unattributedCaption?{label:LEGACY_WIN_CAPTION_LABEL,text:exact.unattributedCaption}:null;
}
