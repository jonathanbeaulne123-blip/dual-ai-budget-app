import {describe,it,expect} from 'vitest';
import {catalogHousehold} from '../src/core/index.ts';
import {companionFor,commitCompanion} from '../src/core/herculesCompanion.ts';
import {prepareAction,type ActionContext} from '../src/core/herculesActions.ts';
import {executeHerculesAction} from '../src/core/herculesExecution.ts';
import {companionActionEffect} from '../src/core/herculesCompanionActions.ts';
import {COZY_LOOK} from '../src/wardrobe/catalogue.ts';
import {capturedIntent} from '../src/ledgerSync/capture.ts';
import {commandFromCapture,type Scope} from '../src/ledgerSync/protocol.ts';
import {prepareCommand} from '../src/ledgerSync/authority.ts';
import {splitForSync} from '../src/core/sync.ts';
function fixture(){const h=catalogHousehold();h.companionProfile=companionFor(h,'MEM-001');h.companionProfile.savedLooks=[{id:COZY_LOOK.id,revision:1,value:COZY_LOOK}];return h;}
function claim(actionId:string,values:Record<string,string>){const h=fixture(),c:ActionContext={household:h,memberId:'MEM-001',view:'personal',today:'2026-09-10'},submissionId=crypto.randomUUID(),review=prepareAction(c,actionId,values);const claimed=commitCompanion(h,{version:1,id:crypto.randomUUID(),scope:companionFor(h,c.memberId).scope,operation:{kind:'workflow.set',workflowId:'task-personal',expectedRevision:0,view:c.view,generation:0,value:{version:1,actionId,values:review.values,view:c.view,generation:0,updatedAt:new Date().toISOString(),submission:{id:submissionId,review:JSON.stringify(review)}}}}).household;return{h,claimed,input:{memberId:c.memberId,view:c.view,today:c.today,submissionId,review}};}
describe('confirmed companion actions',()=>{
 it.each(['wear-saved-look','publish-saved-look'])('executes %s through authority with wardrobe negotiation and original private claim',async action=>{
  const {h,claimed,input}=claim(action,{lookId:COZY_LOOK.id});
  expect(h.companionGallery??[]).toEqual([]);expect(h.companionProfile!.wornLook.value).toBeNull();
  const scope:Scope={environment:h.environment,householdId:h.householdId,memberId:'MEM-001',subject:'synthetic',role:'owner',expires:Date.now()+60000,aclEpoch:1};
  const pair=splitForSync(claimed,'MEM-001'),state={sequence:claimed.revision,shared:pair.shared,personal:new Map([['MEM-001',pair.personal],['MEM-002',splitForSync(claimed,'MEM-002').personal]])};
  const candidate=executeHerculesAction(structuredClone(claimed),input),command=await commandFromCapture(capturedIntent(candidate.household)!,scope,input.submissionId);
  const accepted=await prepareCommand(state,command,scope,()=>{});
  expect(accepted.personal.companionProfile?.workflows?.[0]?.value).toBeNull();expect(accepted.shared.transactions).toEqual(pair.shared.transactions);
  if(action==='wear-saved-look'){expect(accepted.personal.companionProfile?.wornLook.value).toEqual(COZY_LOOK);expect(accepted.shared.companionGallery??[]).toEqual([]);}
  else{expect(accepted.shared.companionGallery).toHaveLength(1);expect(JSON.stringify(accepted.shared.companionGallery)).not.toContain('workflows');}
  await expect(prepareCommand(state,{...command,companionWardrobeVersion:undefined},scope,()=>{})).rejects.toThrow(/RELOAD/);
  await expect(prepareCommand(state,{...command,steps:[...command.steps,...command.steps]},scope,()=>{})).rejects.toThrow(/SINGLE_OPERATION/);
 });
 it('rejects invented authorization classifications and stale private looks',()=>{
  expect(companionActionEffect({kind:'executeHerculesAction',args:[{review:{actionId:'expense'},permission:'private-wardrobe'}]})).toBeNull();
  const {claimed,input}=claim('wear-saved-look',{lookId:COZY_LOOK.id});claimed.companionProfile!.savedLooks[0]!.revision++;
  expect(()=>executeHerculesAction(claimed,input)).toThrow(/changed/);
 });
 it('clears a conversation without resuming a queued task or changing the books',()=>{
  const {h,claimed,input}=claim('clear-conversation',{});claimed.companionProfile!.workflows![0]!.value!.queue=[{actionId:'expense',values:{}}];
  const result=executeHerculesAction(claimed,input).household;
  expect(result.companionProfile!.conversations.find(r=>r.view==='personal')!.generation).toBe(1);
  expect(result.companionProfile!.workflows![0]!.value).toBeNull();expect(result.transactions).toEqual(h.transactions);
 });
 it('expires ordinary private drafts with deletion revisions but keeps unresolved identities',()=>{
  const {claimed,input}=claim('remembering',{enabled:'false'});const profile=claimed.companionProfile!;
  profile.workflows![0]!.value!.updatedAt='2020-01-01T00:00:00.000Z';
  profile.workflows!.push({id:'task-household',revision:4,value:{...profile.workflows![0]!.value!,view:'household',submission:null}});
  const result=commitCompanion(claimed,{version:1,id:crypto.randomUUID(),scope:profile.scope,operation:{kind:'remembering.set',enabled:false,expectedRevision:profile.remembering.revision}}).household;
  expect(result.companionProfile!.workflows!.find(r=>r.id==='task-household')).toMatchObject({revision:5,value:null});
  expect(result.companionProfile!.workflows!.find(r=>r.id==='task-personal')!.value!.submission!.id).toBe(input.submissionId);
 });
});
