import {it,expect,vi} from 'vitest';
vi.mock('agents',()=>({Agent:class{},getAgentByName:vi.fn()}));
vi.mock('../workers/workspace/files.ts',()=>({importWorkspaceFile:vi.fn(),exportWorkspaceFile:vi.fn()}));
vi.mock('../workers/workspace/sandbox.ts',()=>({executeArtifactCode:vi.fn()}));
vi.mock('../workers/workspace/google.ts',()=>({googleWorkspaceChange:vi.fn()}));
import {HerculesWorkspace} from '../workers/workspace/service.ts';
import {googleWorkspaceChange} from '../workers/workspace/google.ts';
import {externalReviewDigest} from '../src/workspace/external.ts';
import {createWorkspaceProject,applyWorkspaceCommand} from '../src/workspace/contracts.ts';
const scope:any={environment:'development',householdId:'HH-TEST',memberId:'MEM-001',expires:Date.now()+100000};
function fixture(target='google'){
 let p:any=createWorkspaceProject('project','A project','MEM-001',new Date().toISOString());
 p.proposals.push({id:'proposal',revision:1,artifactVersionId:null,scope:'personal',target,actionId:target==='google'?'document':'add-account',values:{title:'Review me'},status:'draft',receiptId:null,reviewedRevision:null});
 const receipts=new Map<string,string>(),reviews=new Map<string,string>();
 const service:any=Object.create(HerculesWorkspace.prototype);
 service.authenticate=()=>{};service.getProject=()=>structuredClone(p);service.saveProject=(next:any)=>{p=structuredClone(next);};
 service.env={HERCULES_WORKSPACE_GOOGLE_WRITES:'true',LEDGER_ROOMS:{idFromName:()=>'',get:()=>({resolveReceipt:async()=>{throw new Error('RECEIPT_NOT_FOUND')}})}};
 service.ctx={storage:{transactionSync:(f:any)=>f()}};
 service.sql=(strings:TemplateStringsArray,...values:any[])=>{const q=strings.join('?');if(q.includes('INSERT INTO workspace_meta'))return[];if(q.includes('SELECT value FROM workspace_meta'))return[{value:'1'}];if(q.includes('SELECT v.data,r.data AS receipt'))return [...reviews].map(([id,data])=>({data,receipt:receipts.get(id)}));if(q.includes('INSERT INTO workspace_external_reviews')){reviews.set(values[0],values[1]);return[];}if(q.includes('SELECT id FROM workspace_projects'))return[{id:'project'}];if(q.includes('SELECT data FROM workspace_external_receipts'))return receipts.has(values[0])?[{data:receipts.get(values[0])}]:[];if(q.includes('INSERT INTO workspace_external_receipts')){receipts.set(values[0],values[1]);return[];}if(q.includes('UPDATE workspace_external_receipts')){receipts.set(values[1],values[0]);return[];}throw Error(q);};
 return {service,get:()=>p,set:(n:any)=>p=n};
}
it('does not dispatch a second external review ID for the same accepted proposal',async()=>{
 const f=fixture();let writes=0;vi.mocked(googleWorkspaceChange).mockImplementation(async(_e,_s,_t,_r,check,before)=>{if(check)return null;before();return{url:undefined,remoteId:'remote-'+(++writes)};});
 const review:any={id:crypto.randomUUID(),projectId:'project',proposalId:'proposal',action:'document',title:'Review me',content:'My reviewed content'};
 const first=await f.service.externalFor(scope,review,externalReviewDigest(review),'token');expect(first.status).toBe('accepted');
 const another={...review,id:crypto.randomUUID()};await expect(f.service.externalFor(scope,another,externalReviewDigest(another),'token')).rejects.toThrow(/PROPOSAL_CHANGED|PROPOSAL_SUBMISSION_EXISTS/);expect(writes).toBe(1);
});
it('blocks a workspace action once its source is steered after authorization but before ledger dispatch',async()=>{
 const f=fixture('hearth');const reviewed=await f.service.actionReviewFor(scope,'project','proposal');await f.service.authorizeActionFor(scope,reviewed.receiptId);
 f.set(applyWorkspaceCommand(f.get(),{type:'message',text:'Change this plan completely',id:'new-message'},f.get().revision,new Date().toISOString()));
 await expect(f.service.authorizeActionFor(scope,reviewed.receiptId)).rejects.toThrow('PROPOSAL_CHANGED');
});

it('replaced prepared reviews cannot restore a dead pending review after replacement acceptance',async()=>{
 const f=fixture();let write=false;vi.mocked(googleWorkspaceChange).mockImplementation(async(_e,_s,_t,_r,_check,before)=>{if(!write)throw Error('GOOGLE_CONNECTION_REQUIRED');before();return{url:undefined,remoteId:'saved'};});
 const review:any={id:crypto.randomUUID(),projectId:'project',proposalId:'proposal',action:'document',title:'Review me',content:'First content'};const first=await f.service.externalFor(scope,review,externalReviewDigest(review),'token');expect(first.status).toBe('prepared');
 write=true;const next={...review,id:crypto.randomUUID(),content:'Revised content'};expect((await f.service.externalFor(scope,next,externalReviewDigest(next),'token')).status).toBe('accepted');
 const snapshot=await f.service.snapshotFor(scope);expect(snapshot.externalReviews).toEqual([]);
});
it('a delayed superseded prepared request cannot write after its replacement claims the proposal',async()=>{
 const f=fixture();let resume!:()=>void;let calls=0,writes=0;vi.mocked(googleWorkspaceChange).mockImplementation(async(_e,_s,_t,_r,_check,before)=>{if(++calls===1)await new Promise<void>(r=>resume=r);before();writes++;return{url:undefined,remoteId:'saved'};});
 const review:any={id:crypto.randomUUID(),projectId:'project',proposalId:'proposal',action:'document',title:'Review me',content:'First content'};const first=f.service.externalFor(scope,review,externalReviewDigest(review),'token');
 const next={...review,id:crypto.randomUUID(),content:'Revised content'};expect((await f.service.externalFor(scope,next,externalReviewDigest(next),'token')).status).toBe('accepted');resume();await first;expect(writes).toBe(1);
});
