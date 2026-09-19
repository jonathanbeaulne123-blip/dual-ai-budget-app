import {describe,expect,it} from 'vitest';
import {catalogHousehold} from '../src/core/index.ts';
import type {Household} from '../src/core/types.ts';
import type {PlanVersion} from '../src/core/planSystem.ts';
import {assembleHousehold,splitForSync} from '../src/core/sync.ts';
import {saveTask,type TaskInput} from '../src/core/tasks.ts';
import {householdForAiDisclosure,householdForView} from '../src/core/visibility.ts';
import {capturedIntent} from '../src/ledgerSync/capture.ts';
import {prepareCommand,type AuthorityState} from '../src/ledgerSync/authority.ts';
import {commandFromCapture,ledgerCommandIdForIntent,parseCommand,type Scope} from '../src/ledgerSync/protocol.ts';
import {encodeMessage,MessageReader} from '../src/ledgerSync/wire.ts';
import {emptyHearthside} from '../src/hearthside/contracts.ts';
import {commitHearthside} from '../src/hearthside/commands.ts';
import {
  commitPersonalLife,
  personalLifeShareReviewDigest,
  preparePersonalLifeShareReview,
  type PersonalLifeOperation,
} from '../src/hearthside/personalLifeCommands.ts';
import {emptyPersonalLife,type PersonalLifeExperience,type PersonalLifeMemory,type PersonalLifeWish} from '../src/hearthside/personalLifeContracts.ts';
import {personalWorkspaceExperienceContext,workspaceExperienceProjectId} from '../src/hearthside/workspaceContext.ts';

const A='MEM-001', B='MEM-002';
const experience=(patch:Partial<PersonalLifeExperience>={}):PersonalLifeExperience=>({
  version:1,id:'PRIVATE-experience',revision:1,title:'A quiet train trip',intention:'See the coast slowly',state:'dreaming',horizon:'season',createdBy:A,wishId:'PRIVATE-wish',livedOn:null,references:[],...patch,
});
const wish=(patch:Partial<PersonalLifeWish>={}):PersonalLifeWish=>({version:1,id:'PRIVATE-wish',revision:1,title:'See the coast',intention:'Take the slow train',horizon:'season',createdBy:A,archived:false,references:[],...patch});
const memory=(patch:Partial<PersonalLifeMemory>={}):PersonalLifeMemory=>({
  version:1,id:'PRIVATE-memory',revision:1,title:'The train home',date:'2026-09-18',experienceId:'PRIVATE-experience',createdBy:A,
  recollection:'Rain on the glass',designs:[],hideAmounts:true,keptRevision:null,withdrawn:false,...patch,
});
function run(h:Household,operation:PersonalLifeOperation,id=crypto.randomUUID()) {
  return commitPersonalLife(h,{version:1,id,scope:{environment:h.environment,householdId:h.householdId,memberId:A},operation}).household;
}
function withExperience(){let h:Household={...catalogHousehold(),hearthside:emptyHearthside()};h=run(h,{kind:'wish.save',expectedRevision:0,value:wish()});return run(h,{kind:'experience.save',expectedRevision:0,value:experience()});}

describe('Personal Together life authority',()=>{
  it('partitions the owner document, reloads it, and never gives it to Shared or a partner',()=>{
    const h=withExperience();
    const mine=splitForSync(h,A), partner=splitForSync(h,B);
    expect(mine.personal.personalLife?.wishes.map(row=>row.id)).toEqual(['PRIVATE-wish']);
    expect(mine.personal.personalLife?.experiences.map(row=>row.id)).toEqual(['PRIVATE-experience']);
    expect((mine.shared as unknown as Record<string,unknown>).personalLife).toBeUndefined();
    expect(partner.personal.personalLife).toBeUndefined();
    expect(JSON.stringify(mine.shared)).not.toContain('PRIVATE-wish');
    expect(JSON.stringify(partner.personal)).not.toContain('PRIVATE-wish');
    expect(assembleHousehold(mine.shared,mine.personal).personalLife).toEqual(h.personalLife);
    expect(householdForView(h,A,'household').personalLife).toBeUndefined();
    expect(householdForView(h,A,'personal').personalLife?.ownerMemberId).toBe(A);
    expect(householdForView(h,B,'personal').personalLife).toBeUndefined();
    expect(householdForAiDisclosure(h,A,{view:'personal'}).personalLife).toBeUndefined();
  });

  it('requires exact revisions, records a civil lived date, and keeps private memory composition explicitly',()=>{
    let h=withExperience();
    expect(()=>run(h,{kind:'experience.save',expectedRevision:0,value:{...experience(),revision:2,title:'stale'}})).toThrow('PERSONAL_LIFE_CHANGED');
    h=run(h,{kind:'experience.mark-lived',id:'PRIVATE-experience',expectedRevision:1,livedOn:'2026-09-19'});
    expect(h.personalLife!.experiences[0]).toMatchObject({revision:2,state:'lived',livedOn:'2026-09-19'});
    h=run(h,{kind:'memory.save',expectedRevision:0,value:memory()});
    h=run(h,{kind:'memory.keep',id:'PRIVATE-memory',expectedRevision:1});
    expect(h.personalLife!.memories[0]).toMatchObject({revision:1,keptRevision:1});
    expect(()=>run(h,{kind:'memory.keep',id:'PRIVATE-memory',expectedRevision:0})).toThrow('PERSONAL_LIFE_CHANGED');
  });

  it('invalidates a reviewed copy after any source edit and stores private provenance only in the owner receipt',()=>{
    let h=withExperience();
    const review=preparePersonalLifeShareReview(h.personalLife!,{id:'REVIEW-one',sourceKind:'wish',sourceId:'PRIVATE-wish',sharedId:'EXP-shared'});
    const digest=personalLifeShareReviewDigest(review);
    h=run(h,{kind:'wish.save',expectedRevision:1,value:wish({revision:2,title:'A changed train trip'})});
    expect(()=>run(h,{kind:'share.copy',review,expectedDigest:digest})).toThrow('PERSONAL_LIFE_SHARE_SOURCE_CHANGED');

    const fresh=preparePersonalLifeShareReview(h.personalLife!,{id:'REVIEW-two',sourceKind:'wish',sourceId:'PRIVATE-wish',sharedId:'EXP-shared'});
    const op:PersonalLifeOperation={kind:'share.copy',review:fresh,expectedDigest:personalLifeShareReviewDigest(fresh)};
    h=run(h,op,'11111111-1111-4111-8111-111111111111');
    const retry=run(h,op,'22222222-2222-4222-8222-222222222222');
    expect(retry.hearthside!.experiences.map(row=>row.id)).toEqual(['EXP-shared']);
    expect(retry.personalLife!.shareReceipts[0]).toMatchObject({sourceId:'PRIVATE-wish',sharedId:'EXP-shared'});
    expect(JSON.stringify(splitForSync(retry,A).shared)).not.toContain('PRIVATE-wish');
    expect(JSON.stringify(splitForSync(retry,A).shared)).not.toContain(fresh.sourceDigest);
  });

  it('routes private saves through the Personal checkpoint and reviewed copies through shared authority',()=>{
    const h=withExperience();
    const saved=commitPersonalLife(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId:A},operation:{
      kind:'wish.save',expectedRevision:1,value:wish({revision:2,title:'A private change'}),
    }});
    expect(saved).toMatchObject({persistenceScope:'member-personal',personalMemberId:A,undo:{commandKind:'personal-life'}});

    const review=preparePersonalLifeShareReview(h.personalLife!,{id:'REVIEW-route',sourceKind:'wish',sourceId:'PRIVATE-wish',sharedId:'EXP-reviewed-route'});
    const shared=commitPersonalLife(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId:A},operation:{
      kind:'share.copy',review,expectedDigest:personalLifeShareReviewDigest(review),
    }});
    expect(shared.persistenceScope).toBeUndefined();
    expect(shared.personalMemberId).toBeUndefined();
    expect(shared.undo.commandKind).toBe('personal-life');
    expect(shared.household.hearthside?.experiences.some(row=>row.id==='EXP-reviewed-route')).toBe(true);
    expect(shared.household.personalLife?.shareReceipts.some(row=>row.id==='REVIEW-route')).toBe(true);
  });

  it('requires the Personal capability at the serialized authority and survives authority reassembly',async()=>{
    const base={...catalogHousehold(),hearthside:emptyHearthside()};
    const initial=run(base,{kind:'wish.save',expectedRevision:0,value:wish()}), mine=splitForSync(initial,A), partner=splitForSync(initial,B);
    const state:AuthorityState={sequence:initial.revision,shared:mine.shared,personal:new Map([[A,mine.personal],[B,partner.personal]])};
    const preview=run(assembleHousehold(mine.shared,mine.personal),{kind:'experience.save',expectedRevision:0,value:experience()});
    const scope:Scope={environment:initial.environment,householdId:initial.householdId,memberId:A,subject:'synthetic-a',role:'owner',expires:Date.now()+60_000,aclEpoch:1};
    const command=await commandFromCapture(capturedIntent(preview)!,scope,crypto.randomUUID());
    expect(command.personalLifeVersion).toBe(1);
    const old={...command};delete (old as {personalLifeVersion?:1}).personalLifeVersion;
    await expect(prepareCommand(state,old,scope,()=>{})).rejects.toThrow('CLIENT_RELOAD_REQUIRED');
    const accepted=await prepareCommand(state,command,scope,()=>{});
    expect(accepted.personal.personalLife?.experiences[0]?.id).toBe('PRIVATE-experience');
    expect((accepted.shared as unknown as Record<string,unknown>).personalLife).toBeUndefined();
    expect(assembleHousehold(accepted.shared,accepted.personal).personalLife).toEqual(accepted.household.personalLife);
  });

  it('maps a retained prefixed Personal intent to one UUID through the actual wire decoder',async()=>{
    const base={...catalogHousehold(),hearthside:emptyHearthside()},initial=run(base,{kind:'wish.save',expectedRevision:0,value:wish()});
    const pair=splitForSync(initial,A),current=assembleHousehold(pair.shared,pair.personal),state:AuthorityState={sequence:initial.revision,shared:pair.shared,personal:new Map([[A,pair.personal]])};
    const scope:Scope={environment:initial.environment,householdId:initial.householdId,memberId:A,subject:'synthetic-a',role:'owner',expires:Date.now()+60_000,aclEpoch:1};
    const intentId=`PERSONAL-LIFE-${crypto.randomUUID()}`,candidate=commitPersonalLife(current,{version:1,id:intentId,scope:{environment:initial.environment,householdId:initial.householdId,memberId:A},operation:{kind:'wish.save',expectedRevision:1,value:wish({revision:2,title:'A retained private change'})}}).household;
    const commandId=ledgerCommandIdForIntent(intentId),retryId=ledgerCommandIdForIntent(intentId);
    expect(commandId).toBe(retryId);
    expect(commandId).toMatch(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
    expect(commandId).not.toBe(intentId);
    const command=await commandFromCapture(capturedIntent(candidate)!,{environment:initial.environment,householdId:initial.householdId},commandId);
    const reader=new MessageReader();let decoded:unknown;
    for(const frame of await encodeMessage({type:'command',command}))decoded=await reader.accept(frame)??decoded;
    const wire=decoded as {type:string;command:unknown};
    expect(wire.type).toBe('command');
    expect(parseCommand(wire.command).id).toBe(commandId);
    const accepted=await prepareCommand(state,wire.command,scope,()=>{});
    expect(accepted.personal.personalLife?.wishes[0]).toMatchObject({revision:2,title:'A retained private change'});
    await expect(commandFromCapture(capturedIntent(candidate)!,scope,intentId)).rejects.toThrow('INVALID_COMMAND');
  });

  it('binds Workspace context to a private audience and Personal tasks only to their owner Plan',()=>{
    const e=experience();
    const context=personalWorkspaceExperienceContext(e,A);
    expect(context).toMatchObject({version:2,audience:'personal',ownerMemberId:A,id:e.id});
    const scope={environment:'development' as const,householdId:'HH-one',memberId:A};
    expect(workspaceExperienceProjectId(scope,e.id,'personal')).not.toBe(workspaceExperienceProjectId(scope,e.id));

    const line={id:'LINE-private',lens:'prepare' as const,kind:'reserve' as const,labelSnapshot:'Train',amountCents:0,cadence:'one-time' as const,assumptionIds:[],createdBy:A};
    const personalPlan={id:'PLAN-private',scope:'personal',ownerMemberId:A,monthKey:'2026-09',sequence:1,lines:[line],assumptions:[],reason:'Trip',digest:'',state:'active',createdBy:A,createdAt:'2026-09-01T00:00:00.000Z'} satisfies PlanVersion;
    const household={...catalogHousehold(),planVersions:[personalPlan]};
    const task:TaskInput={memberId:A,id:'TASK-private-plan',expectedRevision:0,task:{visibility:'personal',title:'Choose the train',notes:'',listId:null,parentId:null,doDate:null,dueDate:null,repeat:'none',cue:'none',assigneeId:A,backupId:null,chapterId:null,planReference:{planVersionId:personalPlan.id,planLineId:line.id},moneyLink:null,expectedAmountCents:null,deleted:false}};
    expect(saveTask(household,task).household.tasks?.at(-1)?.planReference).toEqual(task.task.planReference);
    expect(()=>saveTask(household,{...task,id:'TASK-shared-plan',task:{...task.task,visibility:'household'}})).toThrow('Shared Plan');
  });

  it('strictly rejects extra fields and owner mismatches in private documents',()=>{
    const doc=emptyPersonalLife(A);
    expect(()=>run({...catalogHousehold(),personalLife:{...doc,ownerMemberId:B}},{kind:'experience.save',expectedRevision:0,value:experience()})).toThrow('PERSONAL_LIFE_OWNER_MISMATCH');
    expect(()=>run({...catalogHousehold(),personalLife:{...doc,extra:true} as never},{kind:'experience.save',expectedRevision:0,value:experience()})).toThrow('HEARTHSIDE_INVALID_OBJECT');
  });

  it('adds an explicit revision-checked lived date to shared experiences without rejecting legacy lived rows',()=>{
    const base={...catalogHousehold(),hearthside:emptyHearthside()};
    const shared={version:1 as const,id:'EXP-household',revision:1,title:'Our walk',intention:'Take the long way',state:'preparing' as const,horizon:'tonight' as const,createdBy:A,references:[]};
    let h=commitHearthside(base,{version:1,id:crypto.randomUUID(),scope:{environment:base.environment,householdId:base.householdId,memberId:A},operation:{kind:'experience.save',expectedRevision:0,value:shared}}).household;
    h=commitHearthside(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId:A},operation:{kind:'experience.mark-lived',id:shared.id,expectedRevision:1,livedOn:'2026-09-19'}}).household;
    expect(h.hearthside!.experiences[0]).toMatchObject({revision:2,state:'lived',livedOn:'2026-09-19'});
    expect(()=>commitHearthside(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId:A},operation:{kind:'experience.mark-lived',id:shared.id,expectedRevision:1,livedOn:'2026-09-20'}})).toThrow('HEARTHSIDE_CHANGED');
    expect(()=>splitForSync({...h,hearthside:{...h.hearthside!,experiences:[{...shared,state:'lived'}]}} as Household,A)).not.toThrow();
  });
});
