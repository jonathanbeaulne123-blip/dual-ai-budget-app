import { describe, expect, it } from 'vitest';
import { acceptReviewedAccountHistory, approveAccountHistoryReview, prepareAccountHistoryReview, type AccountHistoryInput } from '../src/core/accountHistory.ts';
import { catalogHousehold, postOpeningBalances, postTransfer, postEntry, acceptHouseholdWrite, splitForSync, assembleHousehold } from '../src/core/index.ts';
import { clearCapturedIntent } from '../src/ledgerSync/capture.ts';
const A='MEM-001',B='MEM-002';
function reviewFixture(){
 let h=catalogHousehold();h.transactions=[];h.commandReceipts=[];h.kitchen.books.closedMonths=[];
 h=postOpeningBalances(h,{createdBy:A,confirmationId:'legacy-open',asOfDate:'2026-08-31',lines:[{accountId:'ACC-CHEQUING',amountCents:10000},{accountId:'ACC-VISA',amountCents:3000}]}).household;
 const moved=postTransfer(h,{createdBy:A,visibility:'household',date:'2026-09-01',amount:10,fromAccountId:'ACC-CHEQUING',toAccountId:'ACC-VISA',note:'Earlier payment',confirmDuplicate:true});h=moved.household;
 const outgoing=h.transactions.find(t=>moved.postedIds.includes(t.id)&&t.accountId==='ACC-CHEQUING')!,incoming=h.transactions.find(t=>moved.postedIds.includes(t.id)&&t.accountId==='ACC-VISA')!;
 const input:AccountHistoryInput={createdBy:A,visibility:'household',accounts:[
  {accountId:'ACC-CHEQUING',openingDate:'2026-08-31',openingBalanceCents:10000,closingDate:'2026-09-30',closingBalanceCents:9000},
  {accountId:'ACC-VISA',openingDate:'2026-08-31',openingBalanceCents:-3000,closingDate:'2026-09-30',closingBalanceCents:-2000},
 ],rows:[{sourceIdentity:'outgoing-fitid',sourceHash:'chequing-file',accountId:'ACC-CHEQUING',toAccountId:'ACC-VISA',date:'2026-09-01',amountCents:1000,type:'transfer',note:'Earlier payment',decision:'retain',retainedTransactionId:outgoing.id,transferSources:[
  {accountId:'ACC-CHEQUING',sourceIdentity:'outgoing-fitid',sourceHash:'chequing-file'},
  {accountId:'ACC-VISA',sourceIdentity:'incoming-fitid',sourceHash:'visa-file'},
 ]}]};
 return {h,input,outgoing,incoming};
}
describe('retained canonical transfer source identities',()=>{
 it('attaches both bank-leg identities atomically at normal acceptance and blocks importing the incoming identity again',async()=>{
  const {h,input,outgoing,incoming}=reviewFixture(),review=prepareAccountHistoryReview(h,input);
  let approved=h;for(const createdBy of[A,B])approved=approveAccountHistoryReview(approved,{createdBy,review}).household;
  clearCapturedIntent(approved);
  const result=acceptReviewedAccountHistory(approved,{createdBy:A,review,confirmationId:'retain-pair'});
  const accepted=await acceptHouseholdWrite({previous:approved,candidate:result.household,commandKind:'acceptReviewedAccountHistory',confirmationId:'retain-pair',actingMemberId:A,postedIds:result.postedIds,adapters:{persist:async()=>{},ingest:async()=>({ok:true})}});
  expect(accepted.ok,accepted.userMessage??'').toBe(true);
  const shared=splitForSync(accepted.household,A).shared,peer=assembleHousehold(shared,splitForSync(accepted.household,B).personal);
  expect(peer.transactions.find(t=>t.id===outgoing.id)).toMatchObject({importSourceIdentity:'outgoing-fitid',importSourceHash:'chequing-file'});
  expect(peer.transactions.find(t=>t.id===incoming.id)).toMatchObject({importSourceIdentity:'incoming-fitid',importSourceHash:'visa-file'});
  expect(peer.transactions.filter(t=>t.type==='transfer').map(t=>t.id).sort()).toEqual([outgoing.id,incoming.id].sort());
  expect(()=>postEntry(peer,{date:'2026-09-01',type:'income',amount:10,accountId:'ACC-VISA',subcategoryId:'SUB-INCOME-WAGES',source:'import',sourceId:'incoming-fitid',createdBy:B,confirmDuplicate:true})).toThrow(/source identity is already accepted/);
  expect(acceptReviewedAccountHistory(accepted.household,{createdBy:A,review,confirmationId:'retain-pair'}).household.transactions).toEqual(accepted.household.transactions);
 });
 it.each(['reviewed','legacy'] as const)('refuses pairing a retained transfer with an incoming identity assigned to another %s accepted transaction',kind=>{
  const {h,input}=reviewFixture();
  const other=postEntry(h,{date:'2026-09-10',type:'income',amount:1,accountId:'ACC-VISA',subcategoryId:'SUB-INCOME-WAGES',createdBy:A,confirmDuplicate:true}).household;
  if(kind==='reviewed'){other.transactions.at(-1)!.importSourceIdentity='incoming-fitid';other.transactions.at(-1)!.importSourceHash='visa-file';}
  else{other.transactions.at(-1)!.source='import';other.transactions.at(-1)!.sourceId='incoming-fitid';}
  input.accounts[1]!.closingBalanceCents=-1900;
  expect(()=>prepareAccountHistoryReview(other,input)).toThrow(/source identity belongs to a different accepted transaction/);
 });
 it('refuses assigning paired provenance when the incoming transaction does not point back to the retained outgoing leg',()=>{
  const {h,input,incoming}=reviewFixture();incoming.transferPairId='unrelated-transaction';
  expect(()=>prepareAccountHistoryReview(h,input)).toThrow(/retained transfer pair no longer matches/);
 });
 it('refuses overwriting different accepted incoming provenance',()=>{
  const {h,input,incoming}=reviewFixture();incoming.importSourceIdentity='existing-incoming';incoming.importSourceHash='existing-file';
  expect(()=>prepareAccountHistoryReview(h,input)).toThrow(/already has different source provenance/);
 });
 it('requires the canonical outgoing identity to match the reviewed outgoing bank leg',()=>{
  const {h,input}=reviewFixture();input.rows[0]!.transferSources![0]!.sourceIdentity='different-outgoing';
  expect(()=>prepareAccountHistoryReview(h,input)).toThrow(/outgoing transfer source must match/);
 });
});
