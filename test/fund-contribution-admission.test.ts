import { describe, it, expect } from 'vitest';
import { catalogHousehold, configureHouseholdFund, proposeHouseholdFundContribution, recordHouseholdFundReconciliation } from '../src/core/index.ts';

const fixture = () => configureHouseholdFund(catalogHousehold(), {custodianMemberId:'MEM-001',createdBy:'MEM-001',openedOn:'2026-09-01'}).household;
describe('Fund contribution source and reconciliation admission', () => {
  it('refuses a new contribution with no source declaration', () => {
    expect(() => proposeHouseholdFundContribution(fixture(), {memberId:'MEM-002',contributorMemberId:'MEM-002',amount:'200',date:'2026-09-01'})).toThrow(/source/i);
  });
  it('refuses a custodian attributing a proposal to the other member', () => {
    expect(() => proposeHouseholdFundContribution(fixture(), {memberId:'MEM-001',contributorMemberId:'MEM-002',amount:'200',date:'2026-09-01',source:{version:1,kind:'external-received',explanation:'Transferred from my untracked savings.'}})).toThrow(/own/i);
  });
  it('does not call a derived remainder independently reconciled', () => {
    const h = recordHouseholdFundReconciliation(fixture(), {memberId:'MEM-001',date:'2026-09-01',bankTotal:'1000'}).household;
    expect(h.fundEvents?.at(-1)?.reconciliationTied).toBeNull();
  });
});

import { acceptHouseholdWrite, confirmHouseholdFundContribution } from '../src/core/index.ts';
import { fundContributionReviewDigest } from '../src/core/fundContributionSources.ts';
import { addAccount, postEntry, reversePostedMoney, splitForSync, assembleHousehold } from '../src/core/index.ts';
import { capturedIntent, clearCapturedIntent } from '../src/ledgerSync/capture.ts';
import { commandFromCapture, type Scope } from '../src/ledgerSync/protocol.ts';
import { prepareCommand, type AuthorityState } from '../src/ledgerSync/authority.ts';
const a='MEM-001',b='MEM-002';
function principalFixture(){const h=configureHouseholdFund(catalogHousehold(),{custodianMemberId:a,createdBy:a,openedOn:'2026-09-01'}).household;const p=proposeHouseholdFundContribution(h,{memberId:b,contributorMemberId:b,amount:'10',date:'2026-09-01',source:{version:1,kind:'external-received',explanation:'External savings'}});return {h,p};}
const adapters={persist:async()=>{},ingest:async()=>({ok:true})};
it('rejects a new source declaration without an acting principal at acceptance',async()=>{const {h,p}=principalFixture();const out=await acceptHouseholdWrite({previous:h,candidate:p.household,commandKind:'proposeHouseholdFundContribution',postedIds:p.postedIds,adapters});expect(out.ok,out.userMessage??'accepted missing principal').toBe(false);});
it('rejects a receipt without an acting principal at acceptance',async()=>{const {p}=principalFixture();const id=p.postedIds[0]!;const c=confirmHouseholdFundContribution(p.household,{memberId:a,proposalEventId:id,received:true,expectedProposalDigest:fundContributionReviewDigest(p.household,id)});const out=await acceptHouseholdWrite({previous:p.household,candidate:c.household,commandKind:'confirmHouseholdFundContribution',postedIds:c.postedIds,adapters});expect(out.ok,out.userMessage??'accepted missing principal').toBe(false);});
it('rejects a concurrent claim that would overallocate the same owner source after the first claim commits',async()=>{
 let h=addAccount(principalFixture().h,{name:'Audit private source',kind:'savings',scope:'personal',ownerMemberId:b}).household;
 const account=h.accounts.find(x=>x.name==='Audit private source')!;
 const money=postEntry(h,{createdBy:b,visibility:'personal',type:'income',date:'2026-09-01',amount:'300',accountId:account.id,subcategoryId:'SUB-INCOME-WAGES'});h=money.household;
 const state:AuthorityState={sequence:h.revision,shared:splitForSync(h,a).shared,personal:new Map([[a,splitForSync(h,a).personal],[b,splitForSync(h,b).personal]])};
 const scope:Scope={environment:h.environment,householdId:h.householdId,memberId:b,subject:'audit-b',role:'owner',expires:Date.now()+60000,aclEpoch:1};
 async function captured(){const replica=assembleHousehold(state.shared,state.personal.get(b)!,{linked:true});clearCapturedIntent(replica);const p=proposeHouseholdFundContribution(replica,{memberId:b,contributorMemberId:b,amount:'200',date:'2026-09-01',source:{version:1,kind:'recorded-movement',explanation:'My accepted receipt',sourceTransactionId:money.postedIds[0]!}});return commandFromCapture(capturedIntent(p.household)!,scope,crypto.randomUUID());}
 const first=await captured(),second=await captured();const accepted=await prepareCommand(state,first,scope,()=>{});
 const next:AuthorityState={sequence:accepted.event.sequence,shared:accepted.shared,personal:new Map(state.personal)};next.personal.set(b,accepted.personal);
 await expect(prepareCommand(next,second,scope,()=>{})).rejects.toThrow(/PRECONDITION|allocated/i);
 expect(accepted.personal.fundContributionSourceClaims).toHaveLength(1);
});
it('rejects a queued peer receipt after the owner accepts a source reversal on their separate replica',async()=>{
 let h=addAccount(principalFixture().h,{name:'Race private source',kind:'savings',scope:'personal',ownerMemberId:b}).household;const account=h.accounts.find(x=>x.name==='Race private source')!;
 const money=postEntry(h,{createdBy:b,visibility:'personal',type:'income',date:'2026-09-01',amount:'300',accountId:account.id,subcategoryId:'SUB-INCOME-WAGES'});h=money.household;
 let state:AuthorityState={sequence:h.revision,shared:splitForSync(h,a).shared,personal:new Map([[a,splitForSync(h,a).personal],[b,splitForSync(h,b).personal]])};
 const owner:Scope={environment:h.environment,householdId:h.householdId,memberId:b,subject:'audit-b',role:'owner',expires:Date.now()+60000,aclEpoch:1},custodian={...owner,memberId:a,subject:'audit-a'};
 const own=assembleHousehold(state.shared,state.personal.get(b)!,{linked:true});clearCapturedIntent(own);const p=proposeHouseholdFundContribution(own,{memberId:b,contributorMemberId:b,amount:'200',date:'2026-09-01',source:{version:1,kind:'recorded-movement',explanation:'My accepted receipt',sourceTransactionId:money.postedIds[0]!}});
 const posted=await prepareCommand(state,await commandFromCapture(capturedIntent(p.household)!,owner,crypto.randomUUID()),owner,()=>{});state={sequence:posted.event.sequence,shared:posted.shared,personal:new Map(state.personal)};state.personal.set(b,posted.personal);
 const peer=assembleHousehold(state.shared,state.personal.get(a)!,{linked:true});clearCapturedIntent(peer);const id=peer.fundEvents!.find(e=>e.kind==='contribution-proposed')!.id;
 const receipt=confirmHouseholdFundContribution(peer,{memberId:a,proposalEventId:id,received:true,expectedProposalDigest:fundContributionReviewDigest(peer,id)});const queued=await commandFromCapture(capturedIntent(receipt.household)!,custodian,crypto.randomUUID());
 const refreshed=assembleHousehold(state.shared,state.personal.get(b)!,{linked:true});clearCapturedIntent(refreshed);const correction=reversePostedMoney(refreshed,money.postedIds[0]!,{createdBy:b,reversalDate:'2026-09-02'});
 const corrected=await prepareCommand(state,await commandFromCapture(capturedIntent(correction.household)!,owner,crypto.randomUUID()),owner,()=>{});const after:AuthorityState={sequence:corrected.event.sequence,shared:corrected.shared,personal:new Map(state.personal)};after.personal.set(b,corrected.personal);
 await expect(prepareCommand(after,queued,custodian,()=>{})).rejects.toThrow(/current accepted|changed/i);
 expect(JSON.stringify(corrected.shared)).not.toContain(money.postedIds[0]!);
});
