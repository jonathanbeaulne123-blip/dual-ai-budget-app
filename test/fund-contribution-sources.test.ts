import { describe, it, expect } from 'vitest';
import { addAccount, catalogHousehold, configureHouseholdFund, proposeHouseholdFundContribution, confirmHouseholdFundContribution, withdrawHouseholdFundContribution, recordHouseholdFundReconciliation, postEntry, reversePostedMoney, splitForSync, assembleHousehold, projectHouseholdFund, type Household } from '../src/core/index.ts';
import { assertFundSourceTransition, fundContributionReviewDigest, validateFundSourceClaim } from '../src/core/fundContributionSources.ts';
import { clearCapturedIntent, capturedIntent } from '../src/ledgerSync/capture.ts';
import { commandFromCapture, type Scope } from '../src/ledgerSync/protocol.ts';
import { prepareCommand, type AuthorityState } from '../src/ledgerSync/authority.ts';

const one='MEM-001',two='MEM-002',date='2026-09-01';
const manual={version:1 as const,kind:'external-received' as const,explanation:'Sent from my separate savings.'};
const fixture=()=>configureHouseholdFund(catalogHousehold(),{custodianMemberId:one,createdBy:one,openedOn:date}).household;
function propose(h:Household,amount='200',memberId=two) {return proposeHouseholdFundContribution(h,{memberId,contributorMemberId:memberId,amount,date,source:manual});}
function confirm(h:Household,id:string) {return confirmHouseholdFundContribution(h,{memberId:one,proposalEventId:id,received:true,expectedProposalDigest:fundContributionReviewDigest(h,id)});}
function linkedFixture(){let h=addAccount(fixture(),{name:'Private source savings',kind:'savings',scope:'personal',ownerMemberId:two}).household;
 const account=h.accounts.find(a=>a.name==='Private source savings')!;
 const incoming=postEntry(h,{createdBy:two,visibility:'personal',type:'income',date,amount:'300',accountId:account.id,subcategoryId:'SUB-INCOME-WAGES',note:'PRIVATE SENTINEL'});
 h=incoming.household;return {h,txId:incoming.postedIds[0]!,accountId:account.id};}
function linked(h:Household,txId:string,amount='200'){return proposeHouseholdFundContribution(h,{memberId:two,contributorMemberId:two,amount,date,source:{version:1,kind:'recorded-movement',explanation:'My recorded receipt.',sourceTransactionId:txId}});}
function state(h:Household):AuthorityState{return {sequence:h.revision,shared:splitForSync(h,one).shared,personal:new Map([[one,splitForSync(h,one).personal],[two,splitForSync(h,two).personal]])};}
describe('reviewed Fund sources',()=>{
 it('requires separate receipt declaration and binds the exact proposal',()=>{const p=propose(fixture());const id=p.postedIds[0]!;
  expect(()=>confirmHouseholdFundContribution(p.household,{memberId:one,proposalEventId:id})).toThrow(/received/i);
  const digest=fundContributionReviewDigest(p.household,id),changed=structuredClone(p.household);changed.fundEvents![0]!.sourceDeclaration!.explanation='Changed source';
  expect(()=>confirmHouseholdFundContribution(changed,{memberId:one,proposalEventId:id,received:true,expectedProposalDigest:digest})).toThrow(/changed/i);
  const accepted=confirm(p.household,id);expect(projectHouseholdFund(accepted.household,date).operatingBalanceCents).toBe(20000);expect(accepted.household.transactions).toEqual(p.household.transactions);
 });
 it('allows an explicit custodian receipt of their own proposal',()=>{const p=propose(fixture(),'25',one);expect(confirm(p.household,p.postedIds[0]!).household.fundEvents?.at(-1)?.confirmedByMemberId).toBe(one);});
 it('grandfathers accepted legacy contributions but refuses pending legacy proposals',()=>{const p=propose(fixture());const accepted=confirm(p.household,p.postedIds[0]!).household;for(const e of accepted.fundEvents??[])delete e.sourceDeclaration;
  expect(projectHouseholdFund(accepted,date).operatingBalanceCents).toBe(20000);expect(()=>assertFundSourceTransition(accepted,structuredClone(accepted))).not.toThrow();
  const pending=structuredClone(p.household);delete pending.fundEvents![0]!.sourceDeclaration;expect(()=>confirm(pending,p.postedIds[0]!)).toThrow(/older proposal/i);
 });
 it('reserves exact linked capacity and releases a withdrawn reservation',()=>{const {h,txId}=linkedFixture();const p=linked(h,txId);
  expect(()=>linked(p.household,txId,'101')).toThrow(/allocated/i);expect(()=>linked(p.household,txId,'100')).not.toThrow();
  const released=withdrawHouseholdFundContribution(p.household,{memberId:two,proposalEventId:p.postedIds[0]!}).household;expect(()=>linked(released,txId,'300')).not.toThrow();
 });
 it('keeps source references solely in their owner envelope and refuses claim editing',()=>{const {h,txId,accountId}=linkedFixture();const p=linked(h,txId);const owner=splitForSync(p.household,two),peer=splitForSync(p.household,one);
  expect(JSON.stringify(owner.shared)).not.toContain(txId);expect(JSON.stringify(owner.shared)).not.toContain(accountId);expect(JSON.stringify(owner.shared)).not.toContain('PRIVATE SENTINEL');expect(peer.personal.fundContributionSourceClaims).toEqual([]);expect(owner.personal.fundContributionSourceClaims).toHaveLength(1);
  const forged=structuredClone(p.household);forged.fundContributionSourceClaims=[];expect(()=>assertFundSourceTransition(p.household,forged)).toThrow(/removed or edited/i);
 });
 it('refuses substituting a manual source for a linked receipt',()=>{const {h,txId}=linkedFixture();const p=linked(h,txId);const receipt=confirm(p.household,p.postedIds[0]!).household;
  receipt.fundEvents!.at(-1)!.sourceDeclaration={...receipt.fundEvents!.at(-1)!.sourceDeclaration!,...manual,declaredByMemberId:two};expect(()=>assertFundSourceTransition(p.household,receipt,undefined,one)).toThrow(/differs/i);
 });
 it('invalidates an unconfirmed linked receipt after source reversal',()=>{const {h,txId}=linkedFixture();const p=linked(h,txId);const changed=reversePostedMoney(p.household,txId,{createdBy:two,reversalDate:'2026-09-02'}).household;
  expect(()=>validateFundSourceClaim(changed,p.household.fundEvents!.at(-1)!)).toThrow(/current accepted/i);
 });
 it('binds manual proposals and receipts to the acting principal',()=>{const h=fixture(),p=propose(h);expect(()=>assertFundSourceTransition(h,p.household,undefined,one)).toThrow(/acting member/i);const c=confirm(p.household,p.postedIds[0]!);expect(()=>assertFundSourceTransition(p.household,c.household,undefined,two)).toThrow(/acting member/i);});
 it('accepts and reloads the linked proposal through authority before peer receipt',async()=>{
  const {h,txId}=linkedFixture();const proposer:Scope={environment:h.environment,householdId:h.householdId,memberId:two,subject:'synthetic-two',role:'owner',expires:Date.now()+60000,aclEpoch:1};
  const replica=assembleHousehold(splitForSync(h,two).shared,splitForSync(h,two).personal,{linked:true});clearCapturedIntent(replica);
  const preview=linked(replica,txId);const cmd=await commandFromCapture(capturedIntent(preview.household)!,proposer,crypto.randomUUID());
  const accepted=await prepareCommand(state(h),cmd,proposer,()=>{});
  const current:AuthorityState={sequence:accepted.event.sequence,shared:accepted.shared,personal:new Map(state(h).personal)};current.personal.set(two,accepted.personal);
  const own=assembleHousehold(current.shared,current.personal.get(two)!,{linked:true});expect(own.fundContributionSourceClaims).toHaveLength(1);
  const id=own.fundEvents!.find(e=>e.kind==='contribution-proposed')!.id;validateFundSourceClaim(own,own.fundEvents!.find(e=>e.id===id)!);
  const peer=assembleHousehold(current.shared,current.personal.get(one)!,{linked:true});clearCapturedIntent(peer);const receipt=confirm(peer,id);
  const receiver={...proposer,memberId:one,subject:'synthetic-one'};const receiptCmd=await commandFromCapture(capturedIntent(receipt.household)!,receiver,crypto.randomUUID());
  const result=await prepareCommand(current,receiptCmd,{...proposer,memberId:one,subject:'synthetic-one'},()=>{});
  expect(projectHouseholdFund(result.household,date).operatingBalanceCents).toBe(20000);expect(JSON.stringify(result.shared)).not.toContain(txId);
 });
 it('checks a peer Personal source at server authority without disclosing it',async()=>{const {h,txId}=linkedFixture();const p=linked(h,txId);const scope:Scope={environment:h.environment,householdId:h.householdId,memberId:one,subject:'synthetic-one',role:'owner',expires:Date.now()+60000,aclEpoch:1};
  const replica=assembleHousehold(splitForSync(p.household,one).shared,splitForSync(p.household,one).personal,{linked:true});clearCapturedIntent(replica);
  const result=confirm(replica,p.postedIds[0]!);const command=await commandFromCapture(capturedIntent(result.household)!,scope,crypto.randomUUID());
  const accepted=await prepareCommand(state(p.household),command,scope,()=>{});expect(accepted.household.transactions.some(t=>t.id===txId)).toBe(false);expect(accepted.household.fundContributionSourceClaims).toEqual([]);
  const changed=state(p.household);changed.personal.get(two)!.transactions.find(t=>t.id===txId)!.isDuplicate=true;
  await expect(prepareCommand(changed,command,scope,()=>{})).rejects.toThrow(/current accepted/i);
  const after:AuthorityState={sequence:accepted.event.sequence,shared:accepted.shared,personal:new Map(changed.personal)};after.personal.set(one,accepted.personal);
  await expect(prepareCommand(after,{...command,id:crypto.randomUUID()},scope,()=>{})).rejects.toThrow(/PRECONDITION|already/i);
 });
 it('distinguishes checked, unchecked, negative and mismatched reconciliation',()=>{let h=fixture();const p=propose(h,'200');h=confirm(p.household,p.postedIds[0]!).household;
  const check=(bankTotal:string,personalRemainder?:string)=>recordHouseholdFundReconciliation(h,{memberId:one,date,bankTotal,personalRemainder}).household.fundEvents!.at(-1)!.reconciliationTied;
  expect(check('300')).toBeNull();expect(check('300','100')).toBe(true);expect(check('100')).toBe(false);expect(check('100','-100')).toBe(false);expect(check('300','50')).toBe(false);
 });
});
