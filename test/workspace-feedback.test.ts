import { beforeAll, afterEach, it, expect, vi } from 'vitest';
import { FEEDBACK_HEADERS, FEEDBACK_SHEET_ID, FEEDBACK_TAB_ID, feedbackContext, normalizeFeedback, feedbackReviewDigest, feedbackValues, missingFeedback, publishFeedbackProposal, isBugReportIntent } from '../src/workspace/feedback.ts';
import { feedbackRow, submitFeedbackSheet } from '../workers/workspace/feedbackSheets.ts';
import { createWorkspaceProject, applyWorkspaceCommand } from '../src/workspace/contracts.ts';
import { executeWorkspaceTool } from '../workers/workspace/tools.ts';
import { projectContext } from '../src/workspace/runtime.ts';
const now = new Date().toISOString();
const draft = () => normalizeFeedback({ page:'Hercules', feature:'Send', issue:'It stopped responding', expected:'An answer', steps:'Open Hercules and send hello', owner:'Jonathan Beaulne', urgency:'5', context:{page:'hercules',scope:'personal',theme:'classic',environment:'development',observedAt:now} });
const review = () => ({id:crypto.randomUUID(),projectId:'p',proposalId:'proposal',proposalRevision:1,instructionRevision:0,draft:draft()});
let env:any;
beforeAll(async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pem=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8',keys.privateKey))));
 env={HERCULES_FEEDBACK_SERVICE_ACCOUNT:JSON.stringify({type:'service_account',client_email:'feedback@test.iam.gserviceaccount.com',private_key:`-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`})};
});
afterEach(()=>vi.unstubAllGlobals());
it('only carries whitelisted diagnostic values, never a household, URL, token, or raw error',()=>{
 const safe=feedbackContext({page:'plan',scope:'personal',theme:'classic',scene:'fearless',viewport:'390 × 844',browser:'Safari',build:'a0d76e99',environment:'development',online:'online',observedAt:now,url:'https://app/#access_token=SECRET',error:'ACCOUNT CANARY',household:{balance:100},token:'SECRET'});
 expect(safe).toEqual({page:'plan',scope:'personal',theme:'classic',scene:'fearless',viewport:'390 × 844',browser:'Safari',build:'a0d76e99',environment:'development',online:'online',observedAt:now});
 expect(JSON.stringify(feedbackContext({page:'SECRET / account',browser:'SECRET',build:'SECRET',observedAt:'SECRET'}))).toBe('{}');
});
it('prepares partial reports, asks what is missing and keeps answers through corrections without calling external tools',async()=>{
 const p=createWorkspaceProject('p','Bug','MEM-001',now);p.appContext={page:'plan',scope:'personal'};
 const c={project:p,id:'first',now,read:vi.fn(),search:vi.fn(),execute:vi.fn()};
 const first=await executeWorkspaceTool('prepare_bug_report',{page:'General UX',feature:'Plan tab',issue:'Blank page',owner:'Person'},c);
 expect(first.result.missing).toEqual(['What should have happened?','How can we reproduce it?','Urgency (1–10)']);
 p.proposals.push(first.effect!.proposal!);
 const next=await executeWorkspaceTool('prepare_bug_report',{expected:'My plan',steps:'Not sure',urgency:'7'}, {...c,id:'second'});
 expect(next.result.missing).toEqual([]);expect(next.effect!.proposal!.values.issue).toBe('Blank page');
 expect(c.read).not.toHaveBeenCalled();expect(c.search).not.toHaveBeenCalled();expect(c.execute).not.toHaveBeenCalled();
 expect(JSON.parse(projectContext(p)).appContext).toEqual(p.appContext);
});
it('manual edits become model context, remove diagnostic fields, and supersede old runs/reviews',()=>{
 let p=createWorkspaceProject('p','Bug','MEM-001',now);
 p.proposals.push({id:'proposal',revision:1,artifactVersionId:null,scope:'personal',target:'feedback',actionId:'report-bug',values:feedbackValues(draft()),status:'draft',receiptId:null,reviewedRevision:null});
 const edited={...draft(),issue:'Actually it is the Cancel button',context:{}};
 p=applyWorkspaceCommand(p,{type:'edit-feedback',proposalId:'proposal',proposalRevision:1,values:feedbackValues(edited)},0,now);
 expect(p.instructionRevision).toBe(1);expect(p.proposals[0]!.revision).toBe(2);expect(p.proposals[0]!.status).toBe('draft');
 expect(projectContext(p)).toContain('Actually it is the Cancel button');expect(p.proposals[0]!.values.contextJson).toBe('{}');
 expect(()=>applyWorkspaceCommand(p,{type:'edit-feedback',proposalId:'proposal',proposalRevision:1,values:feedbackValues(edited)},p.revision,now)).toThrow('FEEDBACK_CHANGED');
});
it('requires complete review and binds every edit to the review digest',()=>{
 const r=review(), digest=feedbackReviewDigest(r);
 expect(feedbackReviewDigest({...r,draft:{...r.draft,issue:'Changed'}})).not.toBe(digest);
 expect(()=>feedbackReviewDigest({...r,draft:{...r.draft,urgency:''}})).toThrow('FEEDBACK_DETAILS_REQUIRED');
 expect(()=>normalizeFeedback({...r.draft,urgency:'11'})).toThrow('INVALID_FEEDBACK_URGENCY');
 expect(missingFeedback(normalizeFeedback({}))).toHaveLength(7);
 expect(isBugReportIntent('I want to report a bug in the plan')).toBe(true);
 expect(isBugReportIntent('Can you explain debugging?')).toBe(false);
});
it('maps columns by header and writes formula-shaped input as literal cells, leaving triage fields blank',()=>{
 const r=review();r.draft.issue='=IMPORTXML("https://example.invalid", "//x")';
 const names=[...FEEDBACK_HEADERS].reverse(), row=feedbackRow(r,names);
 expect(row[names.indexOf('Issue/Suggestion')]!.userEnteredValue).toEqual({stringValue:r.draft.issue});
 expect(row[names.indexOf('Done')]!.userEnteredValue).toEqual({boolValue:false});
 expect(row[names.indexOf('Status')]!.userEnteredValue).toEqual({stringValue:'Not started'});
 expect(row[names.indexOf('Priority')]!.userEnteredValue).toEqual({stringValue:''});
 expect(row[names.indexOf('Solved - AI Review (1-10)')]!.userEnteredValue).toEqual({stringValue:''});
 expect(row[names.indexOf('Example')]!.userEnteredValue).toHaveProperty('stringValue',expect.stringContaining('Expected: An answer'));
});
function sheetMock(options:{lost?:boolean;schema?:string[];badValidation?:boolean}={}) {
 const metadata=new Map<number,any>();const batches:any[]=[];
 const fn=vi.fn(async(input:any,init:any)=>{
  const url=String(input);
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'server-only-token'});
  expect(url).toContain(`/spreadsheets/${FEEDBACK_SHEET_ID}`);
  if(url.includes('/developerMetadata/')){const id=Number(url.split('/').at(-1));return metadata.has(id)?Response.json(metadata.get(id)):new Response('',{status:404});}
  if(url.includes('fields=sheets.properties'))return Response.json({sheets:[{properties:{sheetId:FEEDBACK_TAB_ID,title:"FeedBack Sheet",gridProperties:{columnCount:26}}}]});
  if(url.includes('ranges=')){
   const query=new URL(url).searchParams, template=query.get('ranges')!.endsWith('A2:Z2');
   if(template)expect(query.get('fields')).not.toContain('userEnteredValue');
   else expect(query.get('ranges')).toBe("'FeedBack Sheet'!A1:Z1");
   const values=template?(options.badValidation?[{}, {dataValidation:{strict:true,condition:{type:'ONE_OF_LIST',values:[{userEnteredValue:'Other'}]}}}]:[]):(options.schema??FEEDBACK_HEADERS).map(h=>({userEnteredValue:{stringValue:h}}));
   return Response.json({sheets:[{data:[{rowData:[{values}]}]}]});
  }
  if(url.endsWith(':batchUpdate')){
   const body=JSON.parse(init.body);batches.push(body);const m=body.requests[0].createDeveloperMetadata.developerMetadata;metadata.set(m.metadataId,m);
   if(options.lost)throw Error('lost acknowledgement');return Response.json({replies:[{},{}]});
  }
  throw Error('unexpected URL');
 });vi.stubGlobal('fetch',fn);return {metadata,batches,fn};
}
it('writes one atomic metadata receipt + fixed-sheet row, recovering a lost acknowledgement without another append',async()=>{
 const f=sheetMock({lost:true}),r=review(),digest=feedbackReviewDigest(r),before=vi.fn();
 await expect(submitFeedbackSheet(env,r,digest,'member',false,before)).rejects.toThrow('lost acknowledgement');
 expect(before).toHaveBeenCalledOnce();expect(f.batches).toHaveLength(1);
 expect(f.batches[0].requests[1].appendCells.sheetId).toBe(FEEDBACK_TAB_ID);
 const recovered=await submitFeedbackSheet(env,r,digest,'member',true,before);
 expect(recovered?.reportId).toBe(`H-${r.id}`);expect(f.batches).toHaveLength(1);expect(before).toHaveBeenCalledOnce();
 expect(JSON.stringify(f.batches)).not.toContain('server-only-token');
});
it('never writes on absent uncertain receipt, changed headers or unavailable credentials',async()=>{
 const r=review(),before=vi.fn();const f=sheetMock();
 expect(await submitFeedbackSheet(env,r,feedbackReviewDigest(r),'member',true,before)).toBeNull();expect(f.batches).toHaveLength(0);
 sheetMock({schema:['Changed']});await expect(submitFeedbackSheet(env,r,feedbackReviewDigest(r),'member',false,before)).rejects.toThrow('FEEDBACK_SCHEMA_CHANGED');
 sheetMock({badValidation:true});await expect(submitFeedbackSheet(env,r,feedbackReviewDigest(r),'member',false,before)).rejects.toThrow('FEEDBACK_SCHEMA_CHANGED');
 await expect(submitFeedbackSheet({} as any,r,feedbackReviewDigest(r),'member',false,before)).rejects.toThrow('FEEDBACK_NOT_CONNECTED');expect(before).not.toHaveBeenCalled();
});
it('does not accept a metadata collision as a submission receipt',async()=>{
 const f=sheetMock(),r=review(),digest=feedbackReviewDigest(r);await submitFeedbackSheet(env,r,digest,'member',false,()=>{});
 const meta=[...f.metadata.values()][0];meta.metadataValue='different';
 await expect(submitFeedbackSheet(env,r,digest,'member',true,()=>{})).rejects.toThrow('FEEDBACK_RECEIPT_COLLISION');expect(f.batches).toHaveLength(1);
});

it('late model proposals cannot overwrite a submitted report or a newer revision',()=>{
 const p=createWorkspaceProject('p','Bug','MEM-001',now),base:any={id:'proposal',revision:1,target:'feedback',status:'submitting',receiptId:'receipt',values:feedbackValues(draft())};p.proposals.push(base);
 expect(publishFeedbackProposal(p,{...base,revision:2,status:'draft',receiptId:null})).toBe(false);expect(p.proposals[0]!.receiptId).toBe('receipt');
 p.proposals[0]={...base,revision:3,status:'draft',receiptId:null};expect(publishFeedbackProposal(p,{...base,revision:2,status:'draft',receiptId:null})).toBe(false);
});
