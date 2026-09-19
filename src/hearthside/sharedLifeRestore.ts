import type {Household,RestorePoint,CommitResult} from '../core/types.ts';
import type {Scope} from '../ledgerSync/protocol.ts';
import {canonical} from '../ledgerSync/patch.ts';
import {sha256String} from '../core/synchronousHash.ts';
import {captureCommand} from '../ledgerSync/capture.ts';
import {decodeHearthside,decodeMemory,memoryKeptByEveryone,type HearthsideState,type DesignReference,type MemoryComposition,object,identifier} from './contracts.ts';
import {captureRoomFurniture,FURNITURE_ROOMS,roomFurnitureCatalogue,type FurniturePlacement} from './roomFurniture.ts';
import {decodeRestoreAudience,decodeRestoreSelection,decodeSharedLifeRestoreIntent,decodeSharedLifeRestoreReviews,decodeSharedLifeRestorePreview,restoreBasis,sharedLifeRestoreKey,
 type SharedLifeRestoreAudience,type SharedLifeRestoreTarget,type SharedLifeRestoreIntent,type SharedLifeRestorePreview,type SharedLifeRestoreOption,type SharedLifeRestoreChange,type SharedLifeRestoreReview} from './sharedLifeRestoreContracts.ts';

export type SharedLifeRestoreScope=Pick<Scope,'environment'|'householdId'|'memberId'|'aclEpoch'>;
/** This synchronous lookup comes only from the current canonical design store. */
export type RestoreDesignAccess=(reference:DesignReference)=>boolean;
const hash=(value:unknown)=>sha256String(canonical(value));
function assert(value:unknown,code:string):asserts value {if(!value)throw Error(code);}
const activeMembers=(h:Pick<Household,'members'>)=>h.members.filter(m=>m.active).map(m=>m.id).sort();
export function sharedLifeRestoreAudience(h:Household,scope:SharedLifeRestoreScope):SharedLifeRestoreAudience {
 assert(h.environment===scope.environment&&h.householdId===scope.householdId&&activeMembers(h).includes(scope.memberId),'SHARED_LIFE_RESTORE_SCOPE_CHANGED');
 return decodeRestoreAudience({environment:h.environment,householdId:h.householdId,memberIds:activeMembers(h),aclEpoch:scope.aclEpoch});
}
export function assertRestorePointAudience(h:Household,point:RestorePoint,scope:SharedLifeRestoreScope):void {
 const audience=sharedLifeRestoreAudience(h,scope);
 assert(point.shared.householdId===scope.householdId&&point.shared.environment===scope.environment,'SHARED_LIFE_RESTORE_SCOPE_CHANGED');
 assert(canonical(point.shared.members.filter(m=>m.active).map(m=>m.id).sort())===canonical(audience.memberIds),'SHARED_LIFE_RESTORE_SOURCE_AUDIENCE_CHANGED');
 assert(point.shared.hearthside!==undefined,'SHARED_LIFE_RESTORE_NO_STORY');
}
type Evaluation={option:SharedLifeRestoreOption;change:SharedLifeRestoreChange|null;current:unknown;dependencies:unknown;apply:(state:HearthsideState)=>void};
const none=()=>{};
function label(text:string){return text.length>160?text.slice(0,157)+'…':text;}
const field=(name:string,before:unknown,after:unknown)=>({label:name,before:typeof before==='string'?before:before===null?'Not set':canonical(before),after:typeof after==='string'?after:after===null?'Not set':canonical(after)});
function evaluate(h:Household,source:HearthsideState,target:SharedLifeRestoreTarget,designAccess:RestoreDesignAccess,current:HearthsideState):Evaluation {
 const members=activeMembers(h),key=sharedLifeRestoreKey(target);
 const unavailable=(title:string,reason:string,value:unknown=null):Evaluation=>({option:{target,label:title,status:'unavailable',reason},change:null,current:value,dependencies:null,apply:none});
 function result(title:string,before:unknown,after:unknown,fields:SharedLifeRestoreChange['fields'],apply:Evaluation['apply'],aftercare:string[]=[],dependencies:unknown=null):Evaluation {
  const changed=fields.filter(f=>f.before!==f.after),status=changed.length?'available':'unchanged';
  return {option:{target,label:label(title),status,reason:changed.length?'':'These selected fields already match.'},change:changed.length?{target,label:label(title),fields:changed,aftercare}:null,current:before,dependencies:{evidence:dependencies,restored:after},apply};
 }
 if(target.kind==='furniture'){
  const before=captureRoomFurniture(target.room,current.furniture).placements.find(p=>p.furnitureId===target.id)!,old=captureRoomFurniture(target.room,source.furniture).placements.find(p=>p.furnitureId===target.id)!;
  const after: FurniturePlacement={...before,revision:before.revision+1,x:old.x,y:old.y};
  return result(roomFurnitureCatalogue(target.room).find(d=>d.id===target.id)!.label,before,after,[field('Across the room',before.x,after.x),field('Depth in the room',before.y,after.y)],s=>{s.furniture=[...(s.furniture??[]).filter(p=>p.room!==target.room||p.furnitureId!==target.id),after];});
 }
 if(target.kind==='experience'){
  const before=current.experiences.find(e=>e.id===target.id),old=source.experiences.find(e=>e.id===target.id);
  if(!before||!old||before.state==='archived'||old.state==='archived')return unavailable('An unavailable intention','Archived or missing intentions are not brought back.',before);
  const after={...before,revision:before.revision+1,title:old.title,intention:old.intention,horizon:old.horizon};
  return result(before.title,before,after,[field('Name',before.title,after.title),field('Why it matters',before.intention,after.intention),field('Horizon',before.horizon,after.horizon)],s=>{s.experiences=s.experiences.map(e=>e.id===target.id?after:e);},['Its current state, links, tasks, dates and funding stay current.']);
 }
 if(target.kind==='note'){
  const before=current.notes.find(n=>n.id===target.id),old=source.notes.find(n=>n.id===target.id);
  if(!before||!old||before.archived||old.archived||before.authorId!==old.authorId||!members.includes(before.authorId))return unavailable('An unavailable note','Archived notes and words from a former household member are not brought back.',before);
  const after={...before,revision:before.revision+1,text:old.text,room:old.room};
  return result(before.text,before,after,[field('Words',before.text,after.text),field('Room',before.room,after.room)],s=>{s.notes=s.notes.map(n=>n.id===target.id?after:n);},['The original author and current intention link remain. Both of you approve the restored wording.']);
 }
 if(target.kind==='occasion'){
  const before=current.occasions.find(o=>o.id===target.id),old=source.occasions.find(o=>o.id===target.id);
  if(!before||!old)return unavailable('An earlier occasion','Missing occasions are not recreated.',before);
  const after={...before,revision:before.revision+1,title:old.title,monthDay:old.monthDay,leapDay:old.leapDay};
  return result(before.title,before,after,[field('Name',before.title,after.title),field('Annual date',before.monthDay,after.monthDay),field('Leap-day choice',before.leapDay,after.leapDay)],s=>{s.occasions=s.occasions.map(o=>o.id===target.id?after:o);},['Every prepared occurrence, date, intention and memory link remains current.']);
 }
 if(target.kind==='memory'){
  const before=current.memories.find(m=>m.id===target.id),old=source.memories.find(m=>m.id===target.id);
  if(!before||!old||before.withdrawn||old.withdrawn)return unavailable('An unavailable memory','Withdrawn or missing memories are never brought back.',before);
  if([...before.recollections,...old.recollections].some(r=>!members.includes(r.memberId)))return unavailable('An unavailable memory','A former member’s recollection is not part of this pair’s restore review.',before);
  // Never read a historical media capability or republish it through restoration.
  if(before.media.length||old.media.length||before.publication||old.publication)return {option:{target,label:label(before.title),status:'fresh-memory',reason:'This memory uses private media. Open its normal editor, choose the content again, publish a fresh composition, and each choose Keep.'},change:null,current:before,dependencies:null,apply:none};
  if([...old.designs,...before.designs].some(ref=>!designAccess(ref)))return unavailable('An unavailable memory','A saved design revision is no longer shared or its piece is archived.',before);
  // Spread current to reserve immutable provenance, including a legacy Win source.
  const after:MemoryComposition=decodeMemory({...before,revision:before.revision+1,title:old.title,date:old.date,recollections:old.recollections,designs:old.designs,hideAmounts:old.hideAmounts,approvals:[]});
  const fields=[field('Name',before.title,after.title),field('Date',before.date,after.date),field('Hide amounts',before.hideAmounts,after.hideAmounts),...members.map(id=>field(`${h.members.find(m=>m.id===id)?.name??'Member'} remembers`,before.recollections.find(r=>r.memberId===id)?.text??'',after.recollections.find(r=>r.memberId===id)?.text??'')),field('Saved design revisions',before.designs,after.designs)];
  const restored=result(before.title,before,after,fields,s=>{s.memories=s.memories.map(m=>m.id===target.id?after:m);},['This creates a new composition revision. Each of you chooses Keep again before it returns to the display.','Its current intention link and original Win provenance remain.'],{designs:[...old.designs,...before.designs].map(ref=>({reference:ref,available:designAccess(ref)}))});
  if(restored.change)restored.change.designs={before:before.designs,after:after.designs};return restored;
 }
 const before=current.placements.find(p=>p.id===target.id),old=source.placements.find(p=>p.id===target.id);
 if(!before||!old||before.room!==old.room||canonical(before.object)!==canonical(old.object))return unavailable('An earlier room placement','Missing or changed object identities are not recreated.',before);
 const ref=before.object;
 let dependency:unknown=null,visible=false,title='Room object';
 if(ref.kind==='experience'){const e=current.experiences.find(e=>e.id===ref.id);dependency=e;visible=!!e&&e.state!=='archived';title=e?.title??title;}
 else if(ref.kind==='note'){const n=current.notes.find(n=>n.id===ref.id);dependency=n;visible=!!n&&!n.archived;title=n?.text??title;}
 else if(ref.kind==='memory'){const m=current.memories.find(m=>m.id===ref.id);dependency=m;visible=!!m&&memoryKeptByEveryone(m,members);title=m?.title??title;}
 else if(ref.kind==='piece'){const d=current.designs.find(d=>d.designId===ref.designId&&d.pieceIds.includes(ref.id));dependency=d?{documentId:d.designId,pieceId:ref.id,revision:d.revision}:null;visible=!!d&&designAccess({version:1,documentId:d.designId,pieceId:ref.id,revision:d.revision});title='Our Studio piece';}
 if(!visible)return unavailable('An unavailable room object','Only objects still shared and available in today’s room can be rearranged.',before);
 const after={...before,revision:before.revision+1,x:old.x,y:old.y};
 return result(title,before,after,[field('Across the room',before.x,after.x),field('Depth in the room',before.y,after.y)],s=>{s.placements=s.placements.map(p=>p.id===target.id?after:p);},['The current object, room and source identity stay the same.'],{key,object:dependency});
}
function targetCatalogue(source:HearthsideState):SharedLifeRestoreTarget[]{
 const targets:SharedLifeRestoreTarget[]=[];
 for(const [kind,rows] of [['experience',source.experiences],['note',source.notes],['occasion',source.occasions],['memory',source.memories],['placement',source.placements]] as const)for(const row of rows)targets.push({kind,id:row.id});
 for(const room of FURNITURE_ROOMS)for(const piece of roomFurnitureCatalogue(room))targets.push({kind:'furniture',room,id:piece.id});
 return targets;
}
function withdrawalGuard(s:HearthsideState){
 return {memories:s.memories.map(m=>[m.id,m.withdrawn,m.publication??null]),notes:s.notes.map(n=>[n.id,n.archived]),experiences:s.experiences.map(e=>[e.id,e.state==='archived']),publications:s.publications,artifacts:s.artifactPublications??[],roomHistory:(s.roomHistory??[]).map(r=>[r.id,r.withdrawn]),handoffs:(s.handoffs??[]).map(r=>[r.id,r.withdrawn]),encounters:s.encounters??[]};
}
/** Pure projection of a server-loaded, checksum-verified same-scope point. No source snapshot enters an intent. */
export function previewSharedLifeRestore(h:Household,point:RestorePoint,rawSelection:unknown,scope:SharedLifeRestoreScope,designAccess:RestoreDesignAccess):SharedLifeRestorePreview {
 assertRestorePointAudience(h,point,scope);const audience=sharedLifeRestoreAudience(h,scope),selection=decodeRestoreSelection(rawSelection),source=decodeHearthside(point.shared.hearthside),current=decodeHearthside(h.hearthside);
 const checked=new Map<string,boolean>(),available:RestoreDesignAccess=ref=>{const key=canonical(ref);if(!checked.has(key))checked.set(key,designAccess(ref));return checked.get(key)!;};
 const catalogue=targetCatalogue(source).map(target=>evaluate(h,source,target,available,current).option),selected=selection.map(target=>evaluate(h,source,target,available,current));
 const sourceDigest=hash(point.shared),currentDigest=hash({selected:selection.map((target,i)=>({target,current:selected[i]!.current,dependencies:selected[i]!.dependencies})),withdrawals:withdrawalGuard(current)});
 const changes=selected.flatMap(e=>e.change?[e.change]:[]),blocked=selected.filter(e=>e.option.status!=='available').map(e=>e.option);
 const pointView={id:point.id,label:point.label,createdAt:point.createdAt,sourceRevision:point.sourceRevision};
 const basis={pointId:point.id,sourceDigest,currentDigest,audience,selection};
 const reviewDigest=hash({version:1,...basis,point:pointView,changes,blocked});
 const preview=decodeSharedLifeRestorePreview({version:1,...basis,reviewDigest,point:pointView,catalogue,changes,blocked});
 assert(new TextEncoder().encode(JSON.stringify(preview)).length<=2*1024*1024,'SHARED_LIFE_RESTORE_REVIEW_TOO_LARGE');return preview;
}
/** Reads are bracketed by live Auth/ACL and same-pair checks, including after the R2 await. */
export async function readSharedLifeRestorePreview(input:unknown,ports:{scope:SharedLifeRestoreScope;current:()=>Household;assertCurrent:()=>void;point:(id:string)=>Promise<RestorePoint>;designAccess:RestoreDesignAccess;audienceEpoch?:()=>number}):Promise<SharedLifeRestorePreview>{
 const r=object(input,['pointId','selection']),pointId=identifier(r.pointId),selection=decodeRestoreSelection(r.selection);
 const scope=()=>({...ports.scope,aclEpoch:ports.audienceEpoch?.()??ports.scope.aclEpoch});
 ports.assertCurrent();const before=sharedLifeRestoreAudience(ports.current(),scope());
 const point=await ports.point(pointId);ports.assertCurrent();const current=ports.current();
 assert(canonical(sharedLifeRestoreAudience(current,scope()))===canonical(before),'SHARED_LIFE_RESTORE_AUDIENCE_CHANGED');
 const preview=previewSharedLifeRestore(current,point,selection,scope(),ports.designAccess);ports.assertCurrent();return preview;
}
function commitResult(h:Household,next:Household,intent:SharedLifeRestoreIntent):CommitResult{return {household:next,postedIds:[],warnings:[],undo:{id:intent.id,label:'Reviewed shared-life restore',snapshot:h,postedIds:[],actorMemberId:intent.scope.memberId,commandKind:'shared-life-restore'}};}
/** Client captures only reviewed identifiers/digests. The actual transition is authority-only. */
export const commitSharedLifeRestore=captureCommand('commitSharedLifeRestore',(h:Household,input:SharedLifeRestoreIntent):CommitResult=>{
 const intent=decodeSharedLifeRestoreIntent(input);assert(intent.scope.environment===h.environment&&intent.scope.householdId===h.householdId&&activeMembers(h).includes(intent.scope.memberId),'SHARED_LIFE_RESTORE_SCOPE_CHANGED');
 return commitResult(h,{...h},intent);
});
/** Canonical prepareCommand calls this with an authority-supplied preview for every material operation. */
export async function applySharedLifeRestoreIntent(h:Household,input:unknown,ports:{scope:SharedLifeRestoreScope;assertCurrent:()=>void;point:(id:string)=>Promise<RestorePoint>;designAccess:RestoreDesignAccess;audienceEpoch?:()=>number;now?:string}):Promise<CommitResult>{
 const intent=decodeSharedLifeRestoreIntent(input),actor=ports.scope.memberId;assert(canonical(intent.scope)===canonical({environment:ports.scope.environment,householdId:ports.scope.householdId,memberId:actor}),'SHARED_LIFE_RESTORE_SCOPE_CHANGED');
 const scope=()=>({...ports.scope,aclEpoch:ports.audienceEpoch?.()??ports.scope.aclEpoch});
 ports.assertCurrent();const audience=sharedLifeRestoreAudience(h,scope()),s=decodeHearthside(h.hearthside),reviews=decodeSharedLifeRestoreReviews(s.restoreReviews??[]),op=intent.operation,existing=reviews.find(r=>r.id===op.id),now=ports.now??new Date().toISOString();
 let nextReview:SharedLifeRestoreReview;
 if(op.kind==='cancel'){
  assert(existing&&existing.state==='pending'&&existing.reviewDigest===op.reviewDigest,'SHARED_LIFE_RESTORE_REVIEW_CHANGED');
  assert(canonical(existing.audience)===canonical(audience),'SHARED_LIFE_RESTORE_AUDIENCE_CHANGED');
  nextReview={...existing,revision:existing.revision+1,state:'cancelled',approvals:[]};
 }else{
  const basis=op.kind==='propose'?op.basis:existing;
  assert(basis,'SHARED_LIFE_RESTORE_REVIEW_MISSING');
  assert(canonical(basis.audience)===canonical(audience),'SHARED_LIFE_RESTORE_AUDIENCE_CHANGED');
  if(op.kind==='propose')assert(!existing,'SHARED_LIFE_RESTORE_ID_REUSED');
  else assert(existing?.state==='pending'&&op.reviewDigest===existing.reviewDigest,'SHARED_LIFE_RESTORE_REVIEW_CHANGED');
  const point=await ports.point(basis.pointId);ports.assertCurrent();assert(canonical(sharedLifeRestoreAudience(h,scope()))===canonical(audience),'SHARED_LIFE_RESTORE_AUDIENCE_CHANGED');
  const preview=previewSharedLifeRestore(h,point,basis.selection,scope(),ports.designAccess);ports.assertCurrent();
  assert(canonical(restoreBasis(preview))===canonical({pointId:basis.pointId,sourceDigest:basis.sourceDigest,currentDigest:basis.currentDigest,reviewDigest:basis.reviewDigest,audience:basis.audience,selection:basis.selection}),'SHARED_LIFE_RESTORE_REVIEW_CHANGED');
  assert(preview.selection.length>0&&preview.blocked.length===0&&preview.changes.length===preview.selection.length,'SHARED_LIFE_RESTORE_MATERIAL_REVIEW_REQUIRED');
  if(op.kind==='propose')nextReview={...restoreBasis(preview),version:1,id:op.id,revision:1,createdBy:actor,createdAt:now,state:'pending',approvals:[],appliedAt:null,appliedRevision:null};
  else if(op.kind==='approve')nextReview={...existing!,revision:existing!.revision+1,approvals:[...new Set([...existing!.approvals,actor])].sort()};
  else {
   assert(existing!.approvals.length===2&&audience.memberIds.every(id=>existing!.approvals.includes(id)),'SHARED_LIFE_RESTORE_BOTH_APPROVALS_REQUIRED');
   const source=decodeHearthside(point.shared.hearthside),current=decodeHearthside(h.hearthside);
   for(const target of preview.selection)evaluate(h,source,target,ports.designAccess,current).apply(s);
   nextReview={...existing!,revision:existing!.revision+1,state:'applied',appliedAt:now,appliedRevision:h.revision+1};
  }
 }
 s.restoreReviews=[...reviews.filter(r=>r.id!==nextReview.id),nextReview];ports.assertCurrent();
 return commitResult(h,{...h,hearthside:decodeHearthside(s)},intent);
}
