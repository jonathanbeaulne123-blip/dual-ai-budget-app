import {object,list,identifier,textValue,revisionValue,choice,decodeDesignReference,type DesignReference} from './contracts.ts';
import {furnitureDefinition,furnitureRoom,type FurnitureRoom} from './roomFurniture.ts';

export const SHARED_LIFE_RESTORE_LIMIT=100;
export type SharedLifeRestoreTarget={kind:'experience'|'note'|'occasion'|'memory'|'placement';id:string}|{kind:'furniture';room:FurnitureRoom;id:string};
export type SharedLifeRestoreAudience={environment:'development'|'production';householdId:string;memberIds:[string,string];aclEpoch:number};
export type SharedLifeRestoreBasis={pointId:string;sourceDigest:string;currentDigest:string;reviewDigest:string;audience:SharedLifeRestoreAudience;selection:SharedLifeRestoreTarget[]};
export type SharedLifeRestoreReview=SharedLifeRestoreBasis&{version:1;id:string;revision:number;createdBy:string;createdAt:string;state:'pending'|'applied'|'cancelled';approvals:string[];appliedAt:string|null;appliedRevision:number|null};
export type SharedLifeRestoreOperation={kind:'propose';id:string;basis:SharedLifeRestoreBasis}|{kind:'approve'|'cancel'|'apply';id:string;reviewDigest:string};
export type SharedLifeRestoreIntent={version:1;id:string;scope:{environment:'development'|'production';householdId:string;memberId:string};operation:SharedLifeRestoreOperation};
export type SharedLifeRestoreOption={target:SharedLifeRestoreTarget;label:string;status:'available'|'unchanged'|'unavailable'|'fresh-memory';reason:string};
export type SharedLifeRestoreChange={target:SharedLifeRestoreTarget;label:string;fields:{label:string;before:string;after:string}[];aftercare:string[];designs?:{before:DesignReference[];after:DesignReference[]}};
export type SharedLifeRestorePreview=SharedLifeRestoreBasis&{version:1;point:{id:string;label:string;createdAt:string;sourceRevision:number};catalogue:SharedLifeRestoreOption[];changes:SharedLifeRestoreChange[];blocked:SharedLifeRestoreOption[]};
export type SharedLifeRestorePointOption={id:string;label:string;createdAt:string;sourceRevision:number};
export const sharedLifeRestoreKey=(target:SharedLifeRestoreTarget)=>target.kind==='furniture'?`${target.kind}/${target.room}/${target.id}`:`${target.kind}/${target.id}`;
export function restoreDigest(value:unknown):string {if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw Error('SHARED_LIFE_RESTORE_INVALID_DIGEST');return value;}
export function decodeRestoreTarget(value:unknown):SharedLifeRestoreTarget {
 const r=object(value,['kind','room','id']);const kind=choice(r.kind,['experience','note','occasion','memory','placement','furniture'] as const);
 if(kind==='furniture'){const room=furnitureRoom(r.room);return {kind,room,id:furnitureDefinition(room,r.id).id};}
 if(r.room!==undefined)throw Error('SHARED_LIFE_RESTORE_INVALID_TARGET');return {kind,id:identifier(r.id)};
}
export function decodeRestoreSelection(value:unknown):SharedLifeRestoreTarget[]{
 const rows=list(value,decodeRestoreTarget,SHARED_LIFE_RESTORE_LIMIT).sort((a,b)=>sharedLifeRestoreKey(a)<sharedLifeRestoreKey(b)?-1:sharedLifeRestoreKey(a)>sharedLifeRestoreKey(b)?1:0);
 if(new Set(rows.map(sharedLifeRestoreKey)).size!==rows.length)throw Error('SHARED_LIFE_RESTORE_DUPLICATE_TARGET');return rows;
}
export function decodeRestoreAudience(value:unknown):SharedLifeRestoreAudience {
 const r=object(value,['environment','householdId','memberIds','aclEpoch']),members=list(r.memberIds,identifier,2).sort();
 if(members.length!==2||members[0]===members[1])throw Error('SHARED_LIFE_RESTORE_PAIR_REQUIRED');
 return {environment:choice(r.environment,['development','production']),householdId:identifier(r.householdId),memberIds:[members[0]!,members[1]!],aclEpoch:revisionValue(r.aclEpoch,1)};
}
export function decodeRestoreBasis(value:unknown):SharedLifeRestoreBasis {
 const r=object(value,['pointId','sourceDigest','currentDigest','reviewDigest','audience','selection']);
 return {pointId:identifier(r.pointId),sourceDigest:restoreDigest(r.sourceDigest),currentDigest:restoreDigest(r.currentDigest),reviewDigest:restoreDigest(r.reviewDigest),audience:decodeRestoreAudience(r.audience),selection:decodeRestoreSelection(r.selection)};
}
const dateTime=(value:unknown)=>{const s=textValue(value,40);if(!Number.isFinite(Date.parse(s)))throw Error('SHARED_LIFE_RESTORE_INVALID_TIME');return s;};
export function decodeRestorePointOptions(value:unknown):SharedLifeRestorePointOption[]{return list(value,value=>{const r=object(value,['id','label','createdAt','sourceRevision','createdByMemberId','sharedMoneyHash']);return {id:identifier(r.id),label:textValue(r.label,240),createdAt:dateTime(r.createdAt),sourceRevision:revisionValue(r.sourceRevision)};},40);}
export function decodeSharedLifeRestoreReview(value:unknown):SharedLifeRestoreReview {
 const r=object(value,['version','id','revision','createdBy','createdAt','state','approvals','appliedAt','appliedRevision','pointId','sourceDigest','currentDigest','reviewDigest','audience','selection']);
 if(r.version!==1)throw Error('SHARED_LIFE_RESTORE_VERSION');
 const basis=decodeRestoreBasis({pointId:r.pointId,sourceDigest:r.sourceDigest,currentDigest:r.currentDigest,reviewDigest:r.reviewDigest,audience:r.audience,selection:r.selection});
 const approvals=list(r.approvals,identifier,2).sort(),state=choice(r.state,['pending','applied','cancelled'] as const),createdBy=identifier(r.createdBy);
 if(!basis.selection.length||!basis.audience.memberIds.includes(createdBy)||new Set(approvals).size!==approvals.length||approvals.some(id=>!basis.audience.memberIds.includes(id)))throw Error('SHARED_LIFE_RESTORE_INVALID_APPROVAL');
 const appliedAt=r.appliedAt===null?null:dateTime(r.appliedAt),appliedRevision=r.appliedRevision===null?null:revisionValue(r.appliedRevision,1);
 if((state==='applied')!==(appliedAt!==null&&appliedRevision!==null)||state!=='applied'&&(appliedAt!==null||appliedRevision!==null)||state==='applied'&&approvals.length!==2)throw Error('SHARED_LIFE_RESTORE_INVALID_RECEIPT');
 return {...basis,version:1,id:identifier(r.id),revision:revisionValue(r.revision,1),createdBy,createdAt:dateTime(r.createdAt),state,approvals,appliedAt,appliedRevision};
}
export function decodeSharedLifeRestoreReviews(value:unknown):SharedLifeRestoreReview[]{
 const rows=list(value,decodeSharedLifeRestoreReview,200);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('SHARED_LIFE_RESTORE_ID_REUSED');return rows;
}
export function decodeSharedLifeRestoreOperation(value:unknown):SharedLifeRestoreOperation {
 const r=object(value,['kind','id','basis','reviewDigest']),kind=choice(r.kind,['propose','approve','cancel','apply'] as const),id=identifier(r.id);
 if(kind==='propose'){object(r,['kind','id','basis']);return {kind,id,basis:decodeRestoreBasis(r.basis)};}
 object(r,['kind','id','reviewDigest']);return {kind,id,reviewDigest:restoreDigest(r.reviewDigest)};
}
export function decodeSharedLifeRestoreIntent(value:unknown):SharedLifeRestoreIntent {
 const r=object(value,['version','id','scope','operation']),s=object(r.scope,['environment','householdId','memberId']);if(r.version!==1)throw Error('SHARED_LIFE_RESTORE_VERSION');
 return {version:1,id:identifier(r.id),scope:{environment:choice(s.environment,['development','production']),householdId:identifier(s.householdId),memberId:identifier(s.memberId)},operation:decodeSharedLifeRestoreOperation(r.operation)};
}
export function restoreBasis(preview:SharedLifeRestorePreview):SharedLifeRestoreBasis {
 return decodeRestoreBasis({pointId:preview.pointId,sourceDigest:preview.sourceDigest,currentDigest:preview.currentDigest,reviewDigest:preview.reviewDigest,audience:preview.audience,selection:preview.selection});
}
export function decodeSharedLifeRestorePreview(value:unknown):SharedLifeRestorePreview {
 const r=object(value,['version','pointId','sourceDigest','currentDigest','reviewDigest','audience','selection','point','catalogue','changes','blocked']);if(r.version!==1)throw Error('SHARED_LIFE_RESTORE_VERSION');
 const basis=decodeRestoreBasis({pointId:r.pointId,sourceDigest:r.sourceDigest,currentDigest:r.currentDigest,reviewDigest:r.reviewDigest,audience:r.audience,selection:r.selection});
 const p=object(r.point,['id','label','createdAt','sourceRevision']),point={id:identifier(p.id),label:textValue(p.label,240),createdAt:dateTime(p.createdAt),sourceRevision:revisionValue(p.sourceRevision)};
 if(point.id!==basis.pointId)throw Error('SHARED_LIFE_RESTORE_POINT_CHANGED');
 const option=(value:unknown):SharedLifeRestoreOption=>{const v=object(value,['target','label','status','reason']);return {target:decodeRestoreTarget(v.target),label:textValue(v.label,240),status:choice(v.status,['available','unchanged','unavailable','fresh-memory']),reason:textValue(v.reason,1000,true)};};
 const changes=list(r.changes,value=>{const v=object(value,['target','label','fields','aftercare','designs']);const d=v.designs===undefined?null:object(v.designs,['before','after']);return {...(d?{designs:{before:list(d.before,decodeDesignReference,20),after:list(d.after,decodeDesignReference,20)}}:{}),target:decodeRestoreTarget(v.target),label:textValue(v.label,240),fields:list(v.fields,value=>{const f=object(value,['label','before','after']);return {label:textValue(f.label,160),before:textValue(f.before,16000,true),after:textValue(f.after,16000,true)};},20),aftercare:list(v.aftercare,v=>textValue(v,500),10)};},SHARED_LIFE_RESTORE_LIMIT);
 return {...basis,version:1,point,catalogue:list(r.catalogue,option,10000),changes,blocked:list(r.blocked,option,SHARED_LIFE_RESTORE_LIMIT)};
}
