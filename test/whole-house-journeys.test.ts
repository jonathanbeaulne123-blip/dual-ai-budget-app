import {describe,expect,it} from 'vitest';
import {
  addGoal,
  catalogHousehold,
  financialAuditHash,
  fundGoal,
  saveTask,
  type Household,
} from '../src/core/index.ts';
import {assembleHousehold,splitForSync} from '../src/core/sync.ts';
import {commitHearthside,type HearthsideOperation} from '../src/hearthside/commands.ts';
import {emptyHearthside,memoryKeptByEveryone,type MemoryComposition,type SharedExperience} from '../src/hearthside/contracts.ts';
import {acceptKittyDesignOperation,createKittyDesignDocument} from '../src/hearthside/design.ts';
import {applyAcceptedDesignReference} from '../src/hearthside/designProjection.ts';
import {
  commitPersonalLife,
  personalLifeShareReviewDigest,
  preparePersonalLifeShareReview,
  type PersonalLifeOperation,
} from '../src/hearthside/personalLifeCommands.ts';
import type {PersonalLifeExperience,PersonalLifeMemory,PersonalLifeWish} from '../src/hearthside/personalLifeContracts.ts';
import {planLifeFixture} from './fixtures/plan-life.ts';

const A='MEM-001', B='MEM-002';

function shared(h:Household,operation:HearthsideOperation,memberId=A):Household {
  return commitHearthside(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId},operation}).household;
}

function personal(h:Household,operation:PersonalLifeOperation,id=crypto.randomUUID()):Household {
  return commitPersonalLife(h,{version:1,id,scope:{environment:h.environment,householdId:h.householdId,memberId:A},operation}).household;
}

const sharedExperience=(patch:Partial<SharedExperience>={}):SharedExperience=>({
  version:1,id:'EXP-shore-weekend',revision:1,title:'Our slow weekend',intention:'Have time by the water together',
  state:'preparing',horizon:'season',createdBy:A,references:[],...patch,
});

const sharedMemory=(patch:Partial<MemoryComposition>={}):MemoryComposition=>({
  version:1,id:'MEMORY-shore-weekend',revision:1,title:'Wind off the lake',date:'2026-09-19',
  experienceId:'EXP-shore-weekend',media:[],designs:[],recollections:[{memberId:A,text:'I remember the last warm coffee.'}],
  hideAmounts:true,approvals:[],withdrawn:false,...patch,
});

describe('whole-house semantic journeys through the durable authorities',()=>{
  it('keeps a funded Shared experience linked, explicitly lived, and approved as one exact two-person memory',async()=>{
    let h=addGoal(catalogHousehold(),{name:'Our slow weekend',target:'120',shared:true,ownerMemberId:null}).household;
    const bankId=h.goals.at(-1)!.id;
    h=fundGoal(h,{goalId:bankId,amount:'120',fromAccountId:'ACC-CHEQUING',date:'2026-09-12',createdBy:A}).household;
    const acceptedMoney=await financialAuditHash(h),acceptedTransactions=structuredClone(h.transactions),acceptedContributions=structuredClone(h.goalContributions);

    h=shared(h,{kind:'experience.save',expectedRevision:0,value:sharedExperience({references:[{kind:'bank',id:bankId}]})});
    h=shared(h,{kind:'experience.add-task',id:'EXP-shore-weekend',expectedRevision:1,task:{memberId:A,id:'TASK-shore-books',expectedRevision:0,task:{
      visibility:'household',title:'Pick up the library books',notes:'For the drive',listId:null,parentId:null,doDate:'2026-09-18',dueDate:null,
      repeat:'none',cue:'none',assigneeId:A,backupId:null,chapterId:null,planReference:null,moneyLink:null,expectedAmountCents:null,deleted:false,
    }}});
    h=shared(h,{kind:'experience.schedule',id:'EXP-shore-weekend',expectedRevision:2,event:{memberId:A,id:'EVENT-shore-weekend',expectedRevision:0,event:{
      visibility:'household',title:'Our slow weekend',start:'2026-09-19',end:'2026-09-20',allDay:true,timezone:'America/Toronto',fold:'earlier',
      repeat:'none',until:null,location:'By the lake',notes:'Time together',exceptions:{},deleted:false,
    }}});
    const linked=h.hearthside!.experiences.find(row=>row.id==='EXP-shore-weekend')!;
    expect(linked.references).toEqual([
      {kind:'bank',id:bankId},
      {kind:'task',id:'TASK-shore-books'},
      {kind:'calendar-event',id:'EVENT-shore-weekend'},
    ]);
    expect(()=>shared(h,{kind:'experience.save',expectedRevision:3,value:{...linked,revision:4,state:'lived',livedOn:'2026-09-19'}})).toThrow('HEARTHSIDE_EXPLICIT_LIVED_REQUIRED');
    h=shared(h,{kind:'experience.mark-lived',id:linked.id,expectedRevision:3,livedOn:'2026-09-19'});
    expect(h.hearthside!.experiences.find(row=>row.id===linked.id)).toMatchObject({revision:4,state:'lived',livedOn:'2026-09-19'});

    h=shared(h,{kind:'memory.compose',expectedRevision:0,value:sharedMemory()});
    h=shared(h,{kind:'memory.compose',expectedRevision:1,value:sharedMemory({revision:2,recollections:[
      {memberId:A,text:'I remember the last warm coffee.'},
      {memberId:B,text:'I remember how loud the water sounded.'},
    ]})},B);
    h=shared(h,{kind:'memory.keep',expectedRevision:2,id:'MEMORY-shore-weekend'},A);
    h=shared(h,{kind:'memory.keep',expectedRevision:2,id:'MEMORY-shore-weekend'},B);
    expect(memoryKeptByEveryone(h.hearthside!.memories[0]!,[A,B])).toBe(true);

    const kept=h.hearthside!.memories[0]!;
    h=shared(h,{kind:'memory.compose',expectedRevision:2,value:{...kept,revision:3,title:'Wind, coffee, and the lake',approvals:[]}},A);
    expect(memoryKeptByEveryone(h.hearthside!.memories[0]!,[A,B])).toBe(false);
    expect(()=>shared(h,{kind:'memory.keep',expectedRevision:2,id:kept.id},B)).toThrow('HEARTHSIDE_CHANGED');
    h=shared(h,{kind:'memory.keep',expectedRevision:3,id:kept.id},A);
    h=shared(h,{kind:'memory.keep',expectedRevision:3,id:kept.id},B);

    const final=h.hearthside!.memories[0]!;
    expect(final.experienceId).toBe('EXP-shore-weekend');
    expect(final.recollections).toEqual([
      {memberId:A,text:'I remember the last warm coffee.'},
      {memberId:B,text:'I remember how loud the water sounded.'},
    ]);
    expect(memoryKeptByEveryone(final,[A,B])).toBe(true);
    expect(h.transactions).toEqual(acceptedTransactions);
    expect(h.goalContributions).toEqual(acceptedContributions);
    expect(await financialAuditHash(h)).toBe(acceptedMoney);
  });

  it('lets a free evening become lived and remembered without inventing any financial row',async()=>{
    let h:Household={...catalogHousehold(),hearthside:emptyHearthside()};
    const beforeHash=await financialAuditHash(h);
    const before=Object.fromEntries(['transactions','goals','goalContributions','goalPurchases','fundEvents','fundKittyAllocations'].map(key=>[key,structuredClone((h as unknown as Record<string,unknown>)[key]??[])]));
    const free=sharedExperience({id:'EXP-free-evening',title:'Pancakes and a record',intention:'Stay in while the rain falls',state:'dreaming',horizon:'tonight'});
    h=shared(h,{kind:'experience.save',expectedRevision:0,value:free});
    h=shared(h,{kind:'experience.mark-lived',id:free.id,expectedRevision:1,livedOn:'2026-09-19'});
    h=shared(h,{kind:'memory.compose',expectedRevision:0,value:sharedMemory({id:'MEMORY-free-evening',title:'The uneven pancakes',experienceId:free.id,recollections:[{memberId:A,text:'The first pancake looked like a cloud.'}]})});
    expect(h.hearthside!.experiences[0]).toMatchObject({state:'lived',livedOn:'2026-09-19'});
    expect(h.hearthside!.memories[0]?.experienceId).toBe(free.id);
    expect(await financialAuditHash(h)).toBe(beforeHash);
    for(const [key,value] of Object.entries(before))expect((h as unknown as Record<string,unknown>)[key]??[]).toEqual(value);
  });

  it('reloads one owner-only life with Plan, Task, piece and memory, then shares reviewed copies without private provenance',()=>{
    let h:Household={...planLifeFixture('personal'),hearthside:emptyHearthside()};
    const plan=h.planVersions!.find(row=>row.scope==='personal'&&row.ownerMemberId===A&&row.state==='active')!;
    const line=plan.lines.find(row=>row.id==='life-trip')!;
    h=saveTask(h,{memberId:A,id:'TASK-private-coast',expectedRevision:0,task:{
      visibility:'personal',title:'Choose a quiet train',notes:'Compare the slow route',listId:null,parentId:null,doDate:'2026-09-21',dueDate:null,
      repeat:'none',cue:'none',assigneeId:A,backupId:null,chapterId:null,planReference:{planVersionId:plan.id,planLineId:line.id},
      moneyLink:null,expectedAmountCents:null,deleted:false,
    }}).household;
    const wish:PersonalLifeWish={version:1,id:'PRIVATE-wish-coast',revision:1,title:'See the coast slowly',intention:'Take the train and leave room to wander',
      horizon:'season',createdBy:A,archived:false,references:[{audience:'personal',kind:'plan-line',id:line.id,planVersionId:plan.id}]};
    h=personal(h,{kind:'wish.save',expectedRevision:0,value:wish});
    const experience:PersonalLifeExperience={version:1,id:'PRIVATE-experience-coast',revision:1,title:'A quiet train trip',intention:'Watch the coast arrive slowly',
      state:'preparing',horizon:'season',createdBy:A,wishId:wish.id,livedOn:null,references:[
        {audience:'personal',kind:'task',id:'TASK-private-coast'},
        {audience:'personal',kind:'plan-line',id:line.id,planVersionId:plan.id},
      ]};
    h=personal(h,{kind:'experience.save',expectedRevision:0,value:experience});
    expect(()=>personal(h,{kind:'experience.save',expectedRevision:1,value:{...experience,revision:2,state:'lived',livedOn:'2026-09-19'}})).toThrow('PERSONAL_LIFE_EXPLICIT_LIVED_REQUIRED');
    h=personal(h,{kind:'experience.mark-lived',id:experience.id,expectedRevision:1,livedOn:'2026-09-19'});

    let design=createKittyDesignDocument('PRIVATE-design-coast',{environment:h.environment,householdId:h.householdId,ownerMemberId:A});
    design=acceptKittyDesignOperation(design,{version:1,id:'PRIVATE-op-piece',designId:design.id,pieceId:'PRIVATE-piece-coast',gestureId:'PRIVATE-gesture-piece',kind:'create-piece',base:'cream'},
      {environment:h.environment,householdId:h.householdId,actorId:A,order:1,acceptedAt:'2026-09-19T12:00:00.000Z'}).document;
    h=applyAcceptedDesignReference(h,design,null,'2026-09-19T12:00:00.000Z');
    const memory:PersonalLifeMemory={version:1,id:'PRIVATE-memory-coast',revision:1,title:'The coast from the train',date:'2026-09-19',
      experienceId:experience.id,createdBy:A,recollection:'Rain on the glass and one bright red boat.',
      designs:[{version:1,documentId:design.id,pieceId:'PRIVATE-piece-coast',revision:design.revision}],hideAmounts:true,keptRevision:null,withdrawn:false};
    h=personal(h,{kind:'memory.save',expectedRevision:0,value:memory});
    h=personal(h,{kind:'memory.keep',id:memory.id,expectedRevision:1});

    const owner=splitForSync(h,A),partner=splitForSync(h,B);
    const serialized={shared:JSON.parse(JSON.stringify(owner.shared)),personal:JSON.parse(JSON.stringify(owner.personal))};
    let reloaded=assembleHousehold(serialized.shared,serialized.personal);
    expect(reloaded.personalLife).toMatchObject({ownerMemberId:A,designs:[{designId:design.id,pieceIds:['PRIVATE-piece-coast']} ]});
    expect(reloaded.tasks?.find(row=>row.id==='TASK-private-coast')?.planReference).toEqual({planVersionId:plan.id,planLineId:line.id});
    expect(partner.personal.personalLife).toBeUndefined();
    for(const canary of [wish.id,experience.id,memory.id,design.id,'PRIVATE-piece-coast','TASK-private-coast']){
      expect(JSON.stringify(owner.shared)).not.toContain(canary);
      expect(JSON.stringify(partner.personal)).not.toContain(canary);
    }

    const experienceReview=preparePersonalLifeShareReview(reloaded.personalLife!,{id:'REVIEW-shared-coast',sourceKind:'experience',sourceId:experience.id,sharedId:'EXP-shared-coast'});
    expect(experienceReview.copy.kind).toBe('experience');
    if(experienceReview.copy.kind==='experience')expect(experienceReview.copy.value.references).toEqual([]);
    reloaded=personal(reloaded,{kind:'share.copy',review:experienceReview,expectedDigest:personalLifeShareReviewDigest(experienceReview)},'11111111-1111-4111-8111-111111111111');
    const memoryReview=preparePersonalLifeShareReview(reloaded.personalLife!,{id:'REVIEW-shared-coast-memory',sourceKind:'memory',sourceId:memory.id,sharedId:'MEMORY-shared-coast',sharedExperienceId:'EXP-shared-coast'});
    reloaded=personal(reloaded,{kind:'share.copy',review:memoryReview,expectedDigest:personalLifeShareReviewDigest(memoryReview)},'22222222-2222-4222-8222-222222222222');

    const after=splitForSync(reloaded,A),sharedJson=JSON.stringify(after.shared);
    expect(after.shared.hearthside?.experiences.find(row=>row.id==='EXP-shared-coast')).toMatchObject({state:'lived',livedOn:'2026-09-19',references:[]});
    expect(after.shared.hearthside?.memories.find(row=>row.id==='MEMORY-shared-coast')).toMatchObject({experienceId:'EXP-shared-coast',designs:[]});
    for(const canary of [wish.id,experience.id,memory.id,design.id,'PRIVATE-piece-coast','TASK-private-coast',experienceReview.sourceDigest,memoryReview.sourceDigest])expect(sharedJson).not.toContain(canary);
    expect(after.personal.personalLife?.shareReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({sourceId:experience.id,sharedId:'EXP-shared-coast'}),
      expect.objectContaining({sourceId:memory.id,sharedId:'MEMORY-shared-coast'}),
    ]));
  });
});
