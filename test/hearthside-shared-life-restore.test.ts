import {expect,it} from 'vitest';
import {catalogHousehold} from '../src/core/index.ts';
import {splitForSync} from '../src/core/sync.ts';
import type {Household,RestorePoint} from '../src/core/types.ts';
import {emptyHearthside,type MemoryComposition} from '../src/hearthside/contracts.ts';
import {previewSharedLifeRestore,applySharedLifeRestoreIntent,readSharedLifeRestorePreview} from '../src/hearthside/sharedLifeRestore.ts';
import {restoreBasis,decodeSharedLifeRestoreIntent,type SharedLifeRestoreIntent,type SharedLifeRestoreTarget} from '../src/hearthside/sharedLifeRestoreContracts.ts';
const scope={environment:'development' as const,householdId:'HH-life-restore',memberId:'MEM-001',aclEpoch:1};
const memory=(id:string,title:string):MemoryComposition=>({version:1,id,revision:1,title,date:null,experienceId:'experience:one',media:[],designs:[],recollections:[{memberId:'MEM-001',text:'My earlier words'},{memberId:'MEM-002',text:'Their earlier words'}],hideAmounts:true,approvals:[],withdrawn:false});
function fixture(){
 let h:Household={...catalogHousehold(),householdId:scope.householdId,hearthside:emptyHearthside()};
 h.hearthside!.experiences=[{version:1,id:'experience:one',revision:1,title:'An evening',intention:'Make room for us',state:'dreaming',horizon:'tonight',createdBy:'MEM-001',references:[]}];
 h.hearthside!.notes=[{version:1,id:'note:one',revision:1,authorId:'MEM-002',text:'I left the kettle on',room:'common',experienceId:'experience:one',archived:false}];
 h.hearthside!.memories=[memory('memory:one','At home')];
 h.hearthside!.occasions=[{version:1,id:'occasion:one',revision:1,title:'A day for us',monthDay:'09-12',leapDay:'february-28',occurrences:[]}];
 h.hearthside!.furniture=[{room:'common',furnitureId:'sofa',revision:1,x:.3,y:.4}];
 const point:RestorePoint={id:'RP-one',label:'Before we changed the room',createdAt:'2026-09-12T12:00:00.000Z',sourceRevision:h.revision,createdByMemberId:'MEM-001',sharedMoneyHash:'a'.repeat(64),shared:structuredClone(splitForSync(h,'MEM-001').shared)};
 h=structuredClone(h);h.hearthside!.experiences[0]={...h.hearthside!.experiences[0]!,revision:4,title:'A weekend',intention:'Current intention',state:'lived',horizon:'someday',references:[]};
 h.hearthside!.notes[0]={...h.hearthside!.notes[0]!,revision:3,text:'Current words',room:'studio'};
 h.hearthside!.memories[0]={...h.hearthside!.memories[0]!,revision:5,title:'A later title',recollections:[{memberId:'MEM-001',text:'My newer words'},{memberId:'MEM-002',text:'Their newer words'}],approvals:[{memberId:'MEM-001',revision:5},{memberId:'MEM-002',revision:5}]};
 h.hearthside!.furniture[0]={room:'common',furnitureId:'sofa',revision:7,x:.7,y:.8};
 h.hearthside!.occasions[0]={...h.hearthside!.occasions[0]!,revision:3,title:'Today’s name',occurrences:[{id:'occasion:one:2026',year:2026,date:'2026-09-12',experienceId:'experience:one',memoryIds:['memory:one']}]};
 return {h,point};
}
function intent(operation:SharedLifeRestoreIntent['operation'],memberId='MEM-001'):SharedLifeRestoreIntent{return {version:1,id:crypto.randomUUID(),scope:{environment:scope.environment,householdId:scope.householdId,memberId},operation};}
async function transition(h:Household,point:RestorePoint,input:SharedLifeRestoreIntent,extra:Record<string,unknown>={}){return (await applySharedLifeRestoreIntent(h,input,{scope:{...scope,memberId:input.scope.memberId},point:async()=>point,assertCurrent(){},designAccess:()=>true,...extra})).household;}

it('restores only exact selected fields as new revisions after both approvals, preserving current identities and operational/history records',async()=>{
 const f=fixture(),selection:SharedLifeRestoreTarget[]=[{kind:'experience',id:'experience:one'},{kind:'note',id:'note:one'},{kind:'memory',id:'memory:one'},{kind:'occasion',id:'occasion:one'},{kind:'furniture',room:'common',id:'sofa'}];
 const later={...f.h.hearthside!.experiences[0]!,id:'experience:later',title:'Created later'};f.h.hearthside!.experiences.push(later);
 const preview=previewSharedLifeRestore(f.h,f.point,selection,scope,()=>true);expect(preview.changes).toHaveLength(5);expect(preview.blocked).toEqual([]);
 let h=await transition(f.h,f.point,intent({kind:'propose',id:'review:one',basis:restoreBasis(preview)}));
 await expect(transition(h,f.point,intent({kind:'apply',id:'review:one',reviewDigest:preview.reviewDigest}))).rejects.toThrow('BOTH_APPROVALS');
 for(const memberId of ['MEM-001','MEM-002'])h=await transition(h,f.point,intent({kind:'approve',id:'review:one',reviewDigest:preview.reviewDigest},memberId));
 h=await transition(h,f.point,intent({kind:'apply',id:'review:one',reviewDigest:preview.reviewDigest}));
 expect(h.hearthside!.experiences[0]).toMatchObject({revision:5,title:'An evening',intention:'Make room for us',horizon:'tonight',state:'lived'});expect(h.hearthside!.experiences[1]).toEqual(later);
 expect(h.hearthside!.notes[0]).toMatchObject({revision:4,text:'I left the kettle on',authorId:'MEM-002',room:'common'});
 expect(h.hearthside!.memories[0]).toMatchObject({revision:6,title:'At home',approvals:[],experienceId:'experience:one'});
 expect(h.hearthside!.occasions[0]).toMatchObject({revision:4,title:'A day for us',occurrences:f.h.hearthside!.occasions[0]!.occurrences});
 expect(h.hearthside!.furniture).toEqual([{room:'common',furnitureId:'sofa',revision:8,x:.3,y:.4}]);
 expect({...h,hearthside:null}).toEqual({...f.h,hearthside:null});expect(h.hearthside!.restoreReviews![0]).toMatchObject({state:'applied',approvals:['MEM-001','MEM-002']});
});

it('invalidates approvals for changed selected content, source, pair or canonical ACL floor while allowing request authentication renewal',async()=>{
 const {h:before,point}=fixture(),preview=previewSharedLifeRestore(before,point,[{kind:'experience',id:'experience:one'}],scope,()=>true);
 const h=await transition(before,point,intent({kind:'propose',id:'review:one',basis:restoreBasis(preview)})),approve=intent({kind:'approve',id:'review:one',reviewDigest:preview.reviewDigest},'MEM-002');
 const changed=structuredClone(h);changed.hearthside!.experiences[0]!.intention='Different current words';await expect(transition(changed,point,approve)).rejects.toThrow('REVIEW_CHANGED');
 const source=structuredClone(point);source.shared.hearthside!.experiences[0]!.title='Different source';await expect(transition(h,source,approve)).rejects.toThrow('REVIEW_CHANGED');
 await expect(transition(h,point,approve,{audienceEpoch:()=>2})).rejects.toThrow('AUDIENCE_CHANGED');
 expect((await transition(h,point,approve,{scope:{...scope,memberId:'MEM-002',aclEpoch:Date.now()},audienceEpoch:()=>1})).hearthside!.restoreReviews![0]!.approvals).toEqual(['MEM-002']);
 const replacement=structuredClone(h);replacement.members[1]!.id='MEM-replacement';await expect(transition(replacement,point,intent(approve.operation))).rejects.toThrow('AUDIENCE_CHANGED');
});

it('never brings back withdrawn content or media capabilities and rechecks exact design access',()=>{
 const {h,point}=fixture();h.hearthside!.memories[0]!.withdrawn=true;
 let p=previewSharedLifeRestore(h,point,[{kind:'memory',id:'memory:one'}],scope,()=>true);expect(p.blocked[0]!.status).toBe('unavailable');expect(JSON.stringify(p)).not.toContain('My earlier words');
 h.hearthside!.memories[0]!.withdrawn=false;point.shared.hearthside!.memories[0]!.media=[{version:1,contentId:'private-old-capability',revision:1,kind:'image',alt:'Earlier photo'}];
 p=previewSharedLifeRestore(h,point,[{kind:'memory',id:'memory:one'}],scope,()=>true);expect(p.blocked[0]!.status).toBe('fresh-memory');expect(JSON.stringify(p)).not.toContain('private-old-capability');
 point.shared.hearthside!.memories[0]!.media=[];point.shared.hearthside!.memories[0]!.designs=[{version:1,documentId:'design:shared',pieceId:'piece:one',revision:2}];
 p=previewSharedLifeRestore(h,point,[{kind:'memory',id:'memory:one'}],scope,()=>false);expect(p.blocked[0]!.reason).toContain('no longer shared');
});

it('reserves current legacy Win provenance and all publication/withdrawal records during a words-only memory restore',async()=>{
 const {h:before,point}=fixture();
 const provenance={version:1 as const,kind:'win' as const,winId:'WIN-existing',sourceDigest:'c'.repeat(64),recordedAt:'2026-09-12T12:00:00.000Z',level:'shared-win' as const,unattributedCaption:'The original note, without invented authorship',historicalKeptMemberIds:['MEM-001']};
 before.hearthside!.memories[0]!.legacySource=provenance;
 before.hearthside!.publications=[{version:1,id:'guest:withdrawn',revision:3,kind:'guest',sourceId:'room:one',sourceRevision:1,manifestDigest:'d'.repeat(64),state:'withdrawn'}];
 before.hearthside!.artifactPublications=[{version:1,id:'artifact-withdrawn',revision:1,experienceId:'experience:one',experienceRevision:1,title:'Withdrawn copy',format:'markdown',contentDigest:'e'.repeat(64),sharedBy:'MEM-001',state:'withdrawn'}];
 const preview=previewSharedLifeRestore(before,point,[{kind:'memory',id:'memory:one'}],scope,()=>true);
 let h=await transition(before,point,intent({kind:'propose',id:'review:memory',basis:restoreBasis(preview)}));
 for(const actor of ['MEM-001','MEM-002'])h=await transition(h,point,intent({kind:'approve',id:'review:memory',reviewDigest:preview.reviewDigest},actor));
 h=await transition(h,point,intent({kind:'apply',id:'review:memory',reviewDigest:preview.reviewDigest}));
 expect(h.hearthside!.memories[0]!.legacySource).toEqual(provenance);expect(h.hearthside!.publications).toEqual(before.hearthside!.publications);expect(h.hearthside!.artifactPublications).toEqual(before.hearthside!.artifactPublications);expect(h.wins).toEqual(before.wins);
});

it('brackets async source reads with scope and canonical epoch checks and rejects another household or historical pair',async()=>{
 const {h,point}=fixture();let epoch=1;
 await expect(readSharedLifeRestorePreview({pointId:point.id,selection:[]},{scope,current:()=>h,assertCurrent(){},audienceEpoch:()=>epoch,point:async()=>{epoch=2;return point;},designAccess:()=>true})).rejects.toThrow('AUDIENCE_CHANGED');
 const wrong=structuredClone(point);wrong.shared.householdId='HH-other';expect(()=>previewSharedLifeRestore(h,wrong,[],scope,()=>true)).toThrow('SCOPE_CHANGED');
 wrong.shared.householdId=h.householdId;wrong.shared.members[1]!.id='MEM-former';expect(()=>previewSharedLifeRestore(h,wrong,[],scope,()=>true)).toThrow('SOURCE_AUDIENCE_CHANGED');
});

it('rejects forged approvals, arbitrary snapshot input and accessor-bearing operations without executing them',()=>{
 const base=intent({kind:'approve',id:'review:one',reviewDigest:'a'.repeat(64)});
 expect(()=>decodeSharedLifeRestoreIntent({...base,household:{}})).toThrow();expect(()=>decodeSharedLifeRestoreIntent({...base,operation:{...base.operation,approvals:['MEM-002']}})).toThrow();
 let reads=0;const operation=Object.defineProperty({},'kind',{get(){reads++;return 'apply';},enumerable:true});expect(()=>decodeSharedLifeRestoreIntent({...base,operation})).toThrow();expect(reads).toBe(0);
});
