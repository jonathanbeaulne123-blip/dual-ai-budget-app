import { describe, expect, it, vi } from 'vitest';
import {
  acceptHouseholdWrite, catalogHousehold, ensureHouseholdShape, postEntry,
  proposeHouseholdOnboarding, recordChapterAcknowledgement, splitForSync,
  type Household, type CommitResult,
} from '../src/core/index.ts';
import { acceptReviewedAccountHistory, prepareAccountHistoryReview } from '../src/core/accountHistory.ts';
import { capturedIntent, clearCapturedIntent } from '../src/ledgerSync/capture.ts';
import { commandFromCapture, type Scope } from '../src/ledgerSync/protocol.ts';
import { prepareCommand } from '../src/ledgerSync/authority.ts';
import { activeSetup } from './fixtures/onboarding-v2.ts';

const memberId='MEM-001';
const purchase=(h:Household)=>postEntry(h,{confirmDuplicate:true,createdBy:memberId,date:'2026-09-08',type:'expense',amount:'2.00',accountId:'ACC-CHEQUING',subcategoryId:'SUB-FOOD-GROCERIES'});
function adapters(){return {
  persist:vi.fn(async()=>{}),ingest:vi.fn(async()=>({ok:true})),
  validateCandidate:vi.fn(async()=>({ok:true})),transport:vi.fn(async()=>({ok:true as const})),
  repairIngest:vi.fn(async()=>({ok:true})),clearCandidate:vi.fn(async()=>{}),
  verifyBooks:vi.fn(async()=>({ok:true})),restoreIngest:vi.fn(async()=>{}),
};}
async function refused(previous:Household,result:CommitResult){
  const io=adapters();const before=structuredClone(previous);
  const outcome=await acceptHouseholdWrite({previous,candidate:result.household,commandKind:result.undo.commandKind,
    postedIds:result.postedIds,actingMemberId:memberId,confirmationId:crypto.randomUUID(),
    transportRequested:true,requireSynchronized:true,adapters:io});
  expect(outcome).toMatchObject({ok:false,postedNothing:true,errorClass:'validation-rejected'});
  expect(outcome.userMessage).toContain('current sync connection');
  for(const fn of Object.values(io))expect(fn).not.toHaveBeenCalled();
  expect(previous).toEqual(before);
}

describe('onboarding/history legacy transport compatibility',()=>{
  it('refuses starting curriculum v2 before staging, ingest, persistence or transport',async()=>{
    const h=catalogHousehold('development');
    await refused(h,proposeHouseholdOnboarding(h,{memberId}));
  });
  it('refuses a new Shared attestation and ordinary writes retaining new Shared facts',async()=>{
    const h=activeSetup();const result=recordChapterAcknowledgement(h,{memberId,createdBy:memberId,chapterId:'ch-01-meet'});
    await refused(h,result);
    await refused(result.household,purchase(result.household));
  });
  it('refuses newly confirmed history and subsequent ordinary writes against its metadata',async()=>{
    const h=catalogHousehold('development');
    const review=prepareAccountHistoryReview(h,{createdBy:memberId,visibility:'household',
      accounts:[{accountId:'ACC-CHEQUING',openingDate:'2026-09-01',openingBalanceCents:0,closingDate:'2026-09-08',closingBalanceCents:0}],rows:[]});
    const result=acceptReviewedAccountHistory(h,{createdBy:memberId,review,confirmationId:'history-compatibility'});
    await refused(h,result);
    await refused(result.household,purchase(result.household));
  });
  it('refuses legacy writes even when old-client shaping dropped the new metadata from its candidate',async()=>{
    const h=recordChapterAcknowledgement(activeSetup(),{memberId,createdBy:memberId,chapterId:'ch-01-meet'}).household;
    const result=purchase(h);delete result.household.onboardingAttestations;delete result.household.householdOnboarding;
    await refused(h,result);
  });
  it.each(['active','complete'] as const)('allows ordinary legacy writes against untouched raw v1 %s records',async state=>{
    const h=catalogHousehold('development');h.householdOnboarding={...activeSetup().householdOnboarding!,registryVersion:1,state,
      ...(state==='complete'?{completedAt:'2026-09-01T00:00:00Z',completionDigest:`ready-v1-${'a'.repeat(64)}`}:{})};
    expect(ensureHouseholdShape(h).householdOnboarding?.registryVersion).toBe(2);
    const result=purchase(h),io=adapters();
    const outcome=await acceptHouseholdWrite({previous:h,candidate:result.household,commandKind:result.undo.commandKind,
      postedIds:result.postedIds,actingMemberId:memberId,transportRequested:true,requireSynchronized:true,adapters:io});
    expect(outcome.ok,outcome.userMessage??undefined).toBe(true);
    expect(io.transport).toHaveBeenCalledOnce();expect(io.persist).toHaveBeenCalled();
    const shaped=outcome.household;const second=purchase(shaped);
    const next=await acceptHouseholdWrite({previous:shaped,candidate:second.household,commandKind:second.undo.commandKind,
      postedIds:second.postedIds,actingMemberId:memberId,transportRequested:true,adapters:adapters()});
    expect(next.ok,next.userMessage??undefined).toBe(true);
  });
  it('allows an already shaped completed v1 record without new metadata',async()=>{
    const raw=catalogHousehold('development');raw.householdOnboarding={...activeSetup().householdOnboarding!,registryVersion:1,state:'complete',completedAt:'2026-09-01T00:00:00Z',completionDigest:`ready-v1-${'a'.repeat(64)}`};
    const h=ensureHouseholdShape(raw),result=purchase(h),io=adapters();
    const outcome=await acceptHouseholdWrite({previous:h,candidate:result.household,commandKind:result.undo.commandKind,
      postedIds:result.postedIds,actingMemberId:memberId,transportRequested:true,adapters:io});
    expect(outcome.ok,outcome.userMessage??undefined).toBe(true);expect(io.transport).toHaveBeenCalledOnce();
  });
  it('keeps local acceptance and the real v2 authority available for the same acknowledgement',async()=>{
    const h=activeSetup();clearCapturedIntent(h);
    const result=recordChapterAcknowledgement(h,{memberId,createdBy:memberId,chapterId:'ch-01-meet'}),io=adapters();
    const local=await acceptHouseholdWrite({previous:h,candidate:result.household,commandKind:result.undo.commandKind,
      postedIds:result.postedIds,actingMemberId:memberId,adapters:io});
    expect(local.ok,local.userMessage??undefined).toBe(true);expect(io.transport).not.toHaveBeenCalled();
    const one=splitForSync(h,memberId),two=splitForSync(h,'MEM-002');
    const scope:Scope={environment:h.environment,householdId:h.householdId,memberId,subject:'actor',role:'owner',expires:Date.now()+60000,aclEpoch:1};
    const command=await commandFromCapture(capturedIntent(result.household)!,scope,crypto.randomUUID());
    const accepted=await prepareCommand({sequence:h.revision,shared:one.shared,personal:new Map([[memberId,one.personal],['MEM-002',two.personal]])},command,scope,()=>{});
    expect(accepted.shared.onboardingAttestations).toHaveLength(1);
  });
});
