import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('agents',()=>({Agent:class{},getAgentByName:vi.fn()}));
vi.mock('../workers/workspace/files.ts',()=>({importWorkspaceFile:vi.fn(),exportWorkspaceFile:vi.fn()}));
vi.mock('../workers/workspace/sandbox.ts',()=>({executeArtifactCode:vi.fn()}));
vi.mock('../workers/workspace/feedbackSheets.ts',()=>({submitFeedbackSheet:vi.fn(),retireFeedbackMetadata:vi.fn().mockResolvedValue(undefined)}));
import { HerculesWorkspace } from '../workers/workspace/service.ts';
import { submitFeedbackSheet, retireFeedbackMetadata } from '../workers/workspace/feedbackSheets.ts';
import { feedbackReviewDigest, normalizeFeedback, feedbackValues } from '../src/workspace/feedback.ts';
import { applyWorkspaceCommand, createWorkspaceProject } from '../src/workspace/contracts.ts';
const dbs:DatabaseSync[]=[];
afterEach(()=>{for(const db of dbs)db.close();dbs.length=0;vi.resetAllMocks();});
function fixture(){
 const db=new DatabaseSync(':memory:');dbs.push(db);
 const service:any=Object.create(HerculesWorkspace.prototype);
 service.sql=(strings:TemplateStringsArray,...values:any[])=>db.prepare(strings.join('?')).all(...values);
 // Nested saveProject transactions are synchronous and share one SQLite transaction in the real Agent.
 service.ctx={waitUntil:(p:Promise<unknown>)=>{void p;},storage:{transactionSync:(f:any)=>f()}};service.env={HERCULES_FEEDBACK_ENABLED:'true',HERCULES_FEEDBACK_SERVICE_ACCOUNT:'present'};service.onStart();
 const scope:any={environment:'development',householdId:'HH-TEST',memberId:'MEM-001',subject:'subject-1',expires:Date.now()+100000};
 const p=createWorkspaceProject('project','Report','MEM-001',new Date().toISOString());
 const draft=normalizeFeedback({page:'Hercules',feature:'Send',issue:'No reply',expected:'A reply',steps:'Open chat, send hello',owner:'Person',urgency:'5'});
 p.proposals.push({id:'proposal',revision:1,artifactVersionId:null,scope:'personal',target:'feedback',actionId:'report-bug',values:feedbackValues(draft),status:'draft',receiptId:null,reviewedRevision:null});service.saveProject(p);
 const review={id:crypto.randomUUID(),projectId:p.id,proposalId:'proposal',proposalRevision:1,instructionRevision:0,draft};
 return {service,scope,review,submit:(r=review,s=scope)=>service.feedbackFor(s,r,feedbackReviewDigest(r))};
}
it('authenticates the member workspace and rejects changed review before connector access',async()=>{
 const f=fixture();await f.service.snapshotFor(f.scope);
 await expect(f.submit(f.review,{...f.scope,subject:'different'})).rejects.toThrow('FORBIDDEN');
 await expect(f.submit(f.review,{...f.scope,expires:0})).rejects.toThrow('UNAUTHENTICATED');
 await expect(f.service.feedbackFor(f.scope,f.review,'not the reviewed text')).rejects.toThrow('FEEDBACK_REVIEW_CHANGED');
 expect(submitFeedbackSheet).not.toHaveBeenCalled();
});
it('persists receipt across replay and returns accepted result even after instruction changes or connector deactivation',async()=>{
 const f=fixture();vi.mocked(submitFeedbackSheet).mockImplementation(async(_e,_r,_d,_p,_check,before)=>{before();return{reportId:'H-1',url:'sheet'};});
 expect((await f.submit()).status).toBe('accepted');f.service.env.HERCULES_FEEDBACK_ENABLED='false';
 const p=f.service.getProject('project');f.service.saveProject(applyWorkspaceCommand(p,{type:'message',id:'later',text:'Change my report'},p.revision,new Date().toISOString()));
 expect((await f.submit()).status).toBe('accepted');expect(submitFeedbackSheet).toHaveBeenCalledOnce();
 expect((await f.service.snapshotFor(f.scope)).feedbackRecords[0].review.draft.issue).toBe('No reply');
});
it('checks an uncertain report only, and blocks new report identity in the same project',async()=>{
 const f=fixture();let writes=0;vi.mocked(submitFeedbackSheet).mockImplementation(async(_e,_r,_d,_p,check,before)=>{if(check)return null;before();writes++;throw Error('network lost');});
 expect((await f.submit()).status).toBe('uncertain');expect((await f.submit()).status).toBe('uncertain');expect(writes).toBe(1);
 const p=f.service.getProject('project');p.proposals.push({...p.proposals[0],id:'new-proposal',status:'draft',receiptId:null});f.service.saveProject(p);
 await expect(f.submit({...f.review,id:crypto.randomUUID(),proposalId:'new-proposal'})).rejects.toThrow('FEEDBACK_RECEIPT_PENDING');
});
it('cannot dispatch an old review after a concurrent manual edit during connector preparation',async()=>{
 const f=fixture();let resume!:()=>void;
 vi.mocked(submitFeedbackSheet).mockImplementation(async(_e,_r,_d,_p,_check,before)=>{await new Promise<void>(r=>resume=r);before();return{reportId:'bad',url:'bad'};});
 const request=f.submit();await Promise.resolve();
 const p=f.service.getProject('project');f.service.saveProject(applyWorkspaceCommand(p,{type:'edit-feedback',proposalId:'proposal',proposalRevision:1,values:feedbackValues({...f.review.draft,issue:'Corrected issue'})},p.revision,new Date().toISOString()));
 resume();const result=await request;expect(result.status).toBe('prepared');expect(result.error).toBe('FEEDBACK_CHANGED');
});
it('concurrent duplicate requests dispatch once and a late absent check cannot downgrade acceptance',async()=>{
 const f=fixture();let finish!:()=>void;
 vi.mocked(submitFeedbackSheet).mockImplementation(async(_e,_r,_d,_p,check,before)=>{if(check)return null;before();await new Promise<void>(r=>finish=r);return{reportId:'H-1',url:'sheet'};});
 const first=f.submit();await Promise.resolve();expect((await f.submit()).status).toBe('uncertain');finish();expect((await first).status).toBe('accepted');expect((await f.submit()).status).toBe('accepted');
});
it('retains progress with a missing connector and exposes no credential in the snapshot',async()=>{
 const f=fixture();vi.mocked(submitFeedbackSheet).mockRejectedValue(new Error('FEEDBACK_NOT_CONNECTED'));
 const result=await f.submit();expect(result.status).toBe('prepared');expect(result.error).toBe('FEEDBACK_NOT_CONNECTED');
 expect(JSON.stringify(await f.service.snapshotFor(f.scope))).not.toContain('SERVICE_ACCOUNT');
});

it('confirmed atomic rejection returns to an editable draft and can retry after repair',async()=>{
 const f=fixture();vi.mocked(submitFeedbackSheet).mockImplementation(async(_e,_r,_d,_p,_c,before)=>{before();throw new Error('FEEDBACK_SUBMISSION_REJECTED');});
 const rejected=await f.submit();expect(rejected.status).toBe('prepared');expect(f.service.getProject('project').proposals[0].receiptId).toBeNull();
 vi.mocked(submitFeedbackSheet).mockImplementation(async(_e,_r,_d,_p,_c,before)=>{before();return{reportId:'H-1',url:'sheet'};});
 expect((await f.submit()).status).toBe('accepted');
});
it('retires metadata only after durable acceptance and leaves uncertain markers recoverable',async()=>{
 const f=fixture();vi.mocked(submitFeedbackSheet).mockImplementation(async(_e,_r,_d,_p,_c,before)=>{before();throw Error('lost');});
 await f.submit();expect(retireFeedbackMetadata).not.toHaveBeenCalled();
 vi.mocked(submitFeedbackSheet).mockResolvedValue({reportId:'H-1',url:'sheet'});
 vi.mocked(retireFeedbackMetadata).mockImplementation(async()=>{expect((await f.service.snapshotFor(f.scope)).feedbackRecords[0].receipt.status).toBe('accepted');});
 expect((await f.submit()).status).toBe('accepted');expect(retireFeedbackMetadata).toHaveBeenCalledOnce();
});

it('does not evict uncertain receipt recovery behind a long history of accepted reports',async()=>{
 const f=fixture();vi.mocked(submitFeedbackSheet).mockImplementation(async(_e,_r,_d,_p,_c,before)=>{before();throw Error('lost');});await f.submit();
 for(let i=0;i<105;i++){const id='old-'+i;f.service.sql`INSERT INTO workspace_feedback_v1 VALUES (${id},${'2099-01-01'},${JSON.stringify({review:{...f.review,id},receipt:{id,status:'accepted',digest:'test'}})})`;}
 const records=(await f.service.snapshotFor(f.scope)).feedbackRecords;expect(records.filter((r:any)=>r.receipt.status==='accepted')).toHaveLength(100);expect(records.some((r:any)=>r.review.id===f.review.id&&r.receipt.status==='uncertain')).toBe(true);
});
