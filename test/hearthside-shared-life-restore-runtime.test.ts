import {expect,it} from 'vitest';
import {sharedLifeRestoreHarness} from './fixtures/hearthsideSharedLifeRestoreRuntime.ts';
import {restoreBasis,type SharedLifeRestorePreview} from '../src/hearthside/sharedLifeRestoreContracts.ts';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
import type {SharedExperience} from '../src/hearthside/contracts.ts';
const experience:SharedExperience={version:1,id:'experience:one',revision:1,title:'An ordinary evening',intention:'A little time for us',state:'dreaming',horizon:'tonight',createdBy:'MEM-001',references:[]};
const targets=[{kind:'experience' as const,id:experience.id}];
async function prepare(app:Awaited<ReturnType<typeof sharedLifeRestoreHarness>>){
 expect(await app.submit({kind:'experience.save',expectedRevision:0,value:experience})).toMatchObject({type:'ack'});
 const response=await app.post('restore-test',{kind:'checkpoint'});expect(response.status,await response.clone().text()).toBe(200);const points=await response.json() as {id:string}[],id=points.at(-1)!.id;
 expect(await app.submit({kind:'experience.save',expectedRevision:1,value:{...experience,revision:2,title:'A changed evening',state:'lived'}})).toMatchObject({type:'ack'});
 const preview=async()=>{const r=await app.post('shared-life-restore',{pointId:id,selection:targets});expect(r.status,await r.clone().text()).toBe(200);return await r.json() as SharedLifeRestorePreview;};
 return {id,preview};
}
it('applies a paired reviewed restore through real Worker, WebSocket, SQLite and archived point authority; a lost ACK reuses one receipt',async()=>{
 const app=await sharedLifeRestoreHarness('HH-life-authority');
 try{
  const {id,preview}=await prepare(app),before=await app.household(),money=await financialAuditHash(before),review=await preview();expect(review.changes[0]!.fields).toContainEqual({label:'Name',before:'A changed evening',after:'An ordinary evening'});
  const propose=await app.restoreCommand({kind:'propose',id:'review:one',basis:restoreBasis(review)}),ack=await app.send(propose);expect(ack).toMatchObject({type:'ack'});expect(await app.send(propose)).toEqual(ack);
  expect(await app.restoreSubmit({kind:'apply',id:'review:one',reviewDigest:review.reviewDigest})).toMatchObject({type:'error',definitive:true});
  for(const actor of ['MEM-001','MEM-002'])expect(await app.restoreSubmit({kind:'approve',id:'review:one',reviewDigest:review.reviewDigest},actor)).toMatchObject({type:'ack'});
  const apply=await app.restoreCommand({kind:'apply',id:'review:one',reviewDigest:review.reviewDigest},'MEM-002'),applied=await app.send(apply,'MEM-002');expect(applied).toMatchObject({type:'ack'});expect(await app.send(apply,'MEM-002')).toEqual(applied);
  const after=await app.household();expect(after.hearthside!.experiences[0]).toMatchObject({revision:3,title:experience.title,state:'lived'});expect(after.hearthside!.restoreReviews).toHaveLength(1);expect(after.hearthside!.restoreReviews![0]!.state).toBe('applied');expect(await financialAuditHash(after)).toBe(money);
  expect(await app.restoreSubmit({kind:'apply',id:'review:one',reviewDigest:review.reviewDigest})).toMatchObject({type:'error',definitive:true});
  expect((await app.post('shared-life-restore',{pointId:id,selection:targets},'MEM-outsider')).status).not.toBe(200);
  const forged=structuredClone(propose);forged.id=crypto.randomUUID();expect(await app.send(forged,'MEM-002')).toMatchObject({type:'error',definitive:true});
 }finally{await app.dispose();}
},60_000);

it('rejects changed current content, a changed archive, actual ACL revocation and replacement-member source access',async()=>{
 const app=await sharedLifeRestoreHarness('HH-life-invalidation');
 try{
  const {id,preview}=await prepare(app),review=await preview();expect(await app.restoreSubmit({kind:'propose',id:'review:one',basis:restoreBasis(review)})).toMatchObject({type:'ack'});
  expect(await app.restoreSubmit({kind:'approve',id:'review:one',reviewDigest:review.reviewDigest})).toMatchObject({type:'ack'});
  expect(await app.submit({kind:'experience.save',expectedRevision:2,value:{...experience,revision:3,title:'Changed while reviewing',state:'lived'}},'MEM-002')).toMatchObject({type:'ack'});
  expect(await app.restoreSubmit({kind:'approve',id:'review:one',reviewDigest:review.reviewDigest},'MEM-002')).toMatchObject({type:'error',definitive:true});
  const fresh=await preview();expect(await app.restoreSubmit({kind:'propose',id:'review:two',basis:restoreBasis(fresh)})).toMatchObject({type:'ack'});
  expect((await app.post('restore-test',{kind:'epoch'})).status).toBe(200);app.disconnect();
  expect(await app.restoreSubmit({kind:'approve',id:'review:two',reviewDigest:fresh.reviewDigest},'MEM-002')).toMatchObject({type:'error',definitive:true});
  const bucket=await app.bucket(),key=encodeURIComponent('development/HH-life-invalidation')+'/restore/'+id,body=await (await bucket.get(key))!.text();await bucket.put(key,'{}');
  expect((await app.post('shared-life-restore',{pointId:id,selection:targets})).status).not.toBe(200);await bucket.put(key,body);
  const h=await app.household(),members=h.members.map(m=>({id:m.id,name:m.name,active:m.active}));members[1]={id:'MEM-replacement',name:'Replacement',active:true};
  expect((await app.post('restore-test',{kind:'members',members})).status).toBe(200);
  const denied=await app.post('shared-life-restore',{pointId:id,selection:targets});expect(denied.status).not.toBe(200);expect(await denied.text()).not.toContain('An ordinary evening');
 }finally{await app.dispose();}
},60_000);

it('keeps terminal memory, note, recorded-room and Workspace copy withdrawals through actual restore apply',async()=>{
 const app=await sharedLifeRestoreHarness('HH-life-withdrawals',{workspaceCopies:true});
 try{
  const {captureRoom}=await import('../src/hearthside/roomHistory.ts'),{preparedExperienceArtifact,artifactPublication}=await import('../src/hearthside/workspacePublication.ts');
  expect(await app.submit({kind:'experience.save',expectedRevision:0,value:experience})).toMatchObject({type:'ack'});
  const note={version:1 as const,id:'note:gone',revision:1,authorId:'MEM-001',text:'Words later withdrawn',room:'common' as const,experienceId:experience.id,archived:false};
  expect(await app.submit({kind:'note.save',expectedRevision:0,value:note})).toMatchObject({type:'ack'});
  expect(await app.submit({kind:'memory.compose',expectedRevision:0,value:{version:1,id:'memory:gone',revision:1,title:'Earlier memory',date:null,experienceId:experience.id,media:[],designs:[],recollections:[{memberId:'MEM-001',text:'My exact words'}],hideAmounts:true,approvals:[],withdrawn:false}})).toMatchObject({type:'ack'});
  const copy=preparedExperienceArtifact({version:1,id:'copy-gone',projectId:'private-project',artifactVersionId:'private-version',experienceId:experience.id,experienceRevision:1,title:'Shared preparation',format:'markdown',content:'Private-source copy later withdrawn.'},'MEM-001'),publication=artifactPublication(copy);
  const call=(body:object)=>app.post('workspace-copy-test',body);
  expect((await call({kind:'prepare',copy})).status).toBe(200);const accepted=await call({kind:'accept',publication});expect(accepted.status).toBe(200);const receipt=await accepted.json();expect((await call({kind:'activate',id:copy.id,receipt})).status).toBe(200);
  const frame=captureRoom(await app.household(),{id:'room:gone',title:'An earlier room',room:'common'},'MEM-001');expect(await app.submit({kind:'room.capture',expectedRevision:0,value:frame})).toMatchObject({type:'ack'});
  const points=await (await app.post('restore-test',{kind:'checkpoint'})).json() as {id:string}[],pointId=points.at(-1)!.id;
  expect((await call({kind:'revoke',id:copy.id})).status).toBe(200);expect((await call({kind:'withdraw',publication:{...publication,state:'withdrawn'}})).status).toBe(200);
  expect(await app.submit({kind:'note.save',expectedRevision:1,value:{...note,revision:2,archived:true}})).toMatchObject({type:'ack'});
  expect(await app.submit({kind:'memory.withdraw',id:'memory:gone',expectedRevision:1},'MEM-002')).toMatchObject({type:'ack'});
  expect(await app.submit({kind:'room.withdraw',id:'room:gone',expectedRevision:1},'MEM-002')).toMatchObject({type:'ack'});
  let h=await app.household(),e=h.hearthside!.experiences[0]!;expect(await app.submit({kind:'experience.save',expectedRevision:e.revision,value:{...e,revision:e.revision+1,title:'Changed today'}})).toMatchObject({type:'ack'});
  expect(await app.submit({kind:'experience.save',expectedRevision:0,value:{...experience,id:'experience:later',title:'A later identity'}})).toMatchObject({type:'ack'});
  h=await app.household();const response=await app.post('shared-life-restore',{pointId,selection:targets});expect(response.status,await response.clone().text()).toBe(200);const preview=await response.json() as SharedLifeRestorePreview;
  expect(preview.catalogue.find(o=>o.target.id==='memory:gone')!.status).toBe('unavailable');expect(preview.catalogue.find(o=>o.target.id===note.id)!.status).toBe('unavailable');expect(JSON.stringify(preview)).not.toContain('Words later withdrawn');
  expect(await app.restoreSubmit({kind:'propose',id:'review:withdrawals',basis:restoreBasis(preview)})).toMatchObject({type:'ack'});
  for(const actor of ['MEM-001','MEM-002'])expect(await app.restoreSubmit({kind:'approve',id:'review:withdrawals',reviewDigest:preview.reviewDigest},actor)).toMatchObject({type:'ack'});
  expect(await app.restoreSubmit({kind:'apply',id:'review:withdrawals',reviewDigest:preview.reviewDigest})).toMatchObject({type:'ack'});
  const after=await app.household();for(const field of ['memories','notes','roomHistory','artifactPublications'] as const)expect(after.hearthside![field]).toEqual(h.hearthside![field]);
  expect(after.hearthside!.experiences.find(e=>e.id===experience.id)!.references).toEqual([]);expect(after.hearthside!.experiences.find(e=>e.id==='experience:later')).toBeTruthy();
  expect((await call({kind:'activate',id:copy.id,receipt})).status).toBe(409);expect(await (await call({kind:'list',experienceId:experience.id})).json()).toEqual([]);expect(await financialAuditHash(after)).toBe(await financialAuditHash(h));
 }finally{await app.dispose();}
},60_000);

it('checks the exact shared design snapshot and current nonarchived piece at every approval without changing the design journal',async()=>{
 const app=await sharedLifeRestoreHarness('HH-life-design');
 try{
  const design=async(body:object)=>{const r=await app.post('design',{version:1,...body});expect(r.status,await r.clone().text()).toBe(200);return await r.json();};
  await design({kind:'create',designId:'DESIGN-one',bankId:null});await design({kind:'operate',operation:{version:1,id:'OP-create',gestureId:'GESTURE-create',designId:'DESIGN-one',pieceId:'PIECE-one',kind:'create-piece',base:'cream'}});
  const memory={version:1 as const,id:'MEMORY-piece',revision:1,title:'Our first piece',date:null,experienceId:null,media:[],designs:[{version:1 as const,documentId:'DESIGN-one',pieceId:'PIECE-one',revision:1}],recollections:[{memberId:'MEM-001',text:'An evening painting'}],hideAmounts:true,approvals:[],withdrawn:false};
  expect(await app.submit({kind:'memory.compose',expectedRevision:0,value:memory})).toMatchObject({type:'ack'});
  const points=await (await app.post('restore-test',{kind:'checkpoint'})).json() as {id:string}[],pointId=points.at(-1)!.id;
  expect(await app.submit({kind:'memory.compose',expectedRevision:1,value:{...memory,revision:2,title:'A later name'}})).toMatchObject({type:'ack'});
  const input={pointId,selection:[{kind:'memory',id:memory.id}]};const r=await app.post('shared-life-restore',input);expect(r.status).toBe(200);const preview=await r.json() as SharedLifeRestorePreview;expect(preview.changes).toHaveLength(1);expect(preview.changes[0]!.designs!.after).toEqual(memory.designs);
  expect(await app.restoreSubmit({kind:'propose',id:'review:piece',basis:restoreBasis(preview)})).toMatchObject({type:'ack'});
  expect(await app.restoreSubmit({kind:'approve',id:'review:piece',reviewDigest:preview.reviewDigest})).toMatchObject({type:'ack'});
  await design({kind:'operate',operation:{version:1,id:'OP-archive',gestureId:'GESTURE-archive',designId:'DESIGN-one',pieceId:'PIECE-one',kind:'archive-piece',expectedRevision:1}});
  const journal=await design({kind:'read',designId:'DESIGN-one'});
  expect(await app.restoreSubmit({kind:'approve',id:'review:piece',reviewDigest:preview.reviewDigest},'MEM-002')).toMatchObject({type:'error',definitive:true});
  const blocked=await (await app.post('shared-life-restore',input)).json() as SharedLifeRestorePreview;expect(blocked.blocked[0]!.status).toBe('unavailable');expect(JSON.stringify(blocked)).not.toContain('An evening painting');
  expect(await design({kind:'read',designId:'DESIGN-one'})).toEqual(journal);expect((await app.household()).hearthside!.memories[0]!.title).toBe('A later name');
 }finally{await app.dispose();}
},60000);
