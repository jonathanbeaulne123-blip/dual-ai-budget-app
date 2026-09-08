import { applyDuplicateReview } from "../src/core/duplicateReviewCommand.ts";
import { describe, expect, it } from "vitest";
import { addGoal, catalogHousehold, fundGoal, markDuplicate, postEntry, postTransfer, reversePostedMoney, undo, type Household } from "../src/core/index.ts";
import { prepareDuplicateReview, type DuplicateReviewRequest } from "../src/core/duplicateReview.ts";
function fixture(){let h=catalogHousehold();for(const [date,note] of [["2026-09-07","Groceries"],["2026-09-08","Groceries · imported"]])h=postEntry(h,{date:date!,note:note!,type:"expense",amount:"47.23",accountId:"ACC-VISA",subcategoryId:"SUB-FOOD-GROCERIES",createdBy:"MEM-001",confirmDuplicate:true}).household;return h;}
function request(h:Household,id=h.transactions.at(-1)!.id,isDuplicate=true,comparisonIds=h.transactions.map(tx=>tx.id)):DuplicateReviewRequest{return {environment:h.environment,householdId:h.householdId,memberId:"MEM-001",view:"household",targetId:id,isDuplicate,comparisonIds};}
function ready(h:Household,r=request(h)){const review=prepareDuplicateReview(h,r);if(review.kind!=="ready")throw Error(review.reason);return review;}
describe("Prise recognition review",()=>{
 it("previews without changing facts, applies only the chosen flag, and retains ordinary Undo",()=>{
  const h=fixture(),before=JSON.stringify(h),review=ready(h);expect(review.changes).toHaveLength(1);expect(JSON.stringify(h)).toBe(before);
  const result=applyDuplicateReview(h,review);expect(result.household.transactions.at(-1)!.isDuplicate).toBe(true);expect(result.household.transactions[0]!.isDuplicate).toBe(false);expect(result.household.transactions).toHaveLength(h.transactions.length);
  const restored=undo(result.household,result.undo);expect(restored.transactions.at(-1)!.isDuplicate).toBe(false);
  const include=ready(result.household,request(result.household,review.target.id,false));expect(include.targetWillCount).toBe(true);expect(applyDuplicateReview(result.household,include).household.transactions.at(-1)!.isDuplicate).toBe(false);
 });
 it("explains both transfer legs and an inclusion still blocked by the other leg",()=>{
  const transfer=postTransfer(catalogHousehold(),{date:"2026-09-08",amount:25,fromAccountId:"ACC-CHEQUING",toAccountId:"ACC-CASH",createdBy:"MEM-001",confirmDuplicate:true});
  const [left,right]=transfer.postedIds,review=ready(transfer.household,request(transfer.household,left,true,[]));expect(review.changes).toHaveLength(2);
  const excluded=applyDuplicateReview(transfer.household,review).household,both=markDuplicate(excluded,right!,true).household;
  const include=ready(both,request(both,left,false,[]));expect(include.changes).toEqual([]);expect(include.targetWillCount).toBe(false);
 });
 it("refuses reciprocal but inconsistent transfer pairs without forbidding different exclusion flags",()=>{
  const h=postTransfer(catalogHousehold(),{date:"2026-09-08",amount:25,fromAccountId:"ACC-CHEQUING",toAccountId:"ACC-CASH",createdBy:"MEM-001",confirmDuplicate:true}).household;
  for(const patch of [{type:"expense" as const},{amountCents:2501},{date:"2026-09-07"},{transferToAccountId:"missing"},{accountId:h.transactions[0]!.accountId}]){
    const broken={...h,transactions:h.transactions.map((tx,i)=>i?{...tx,...patch}:tx)};expect(prepareDuplicateReview(broken,request(broken,h.transactions[0]!.id,true,[])).kind).toBe("unavailable");
  }
 });
 it("shows reversal descendants and refuses changes reaching a closed month",()=>{
  const h=fixture(),reversed=reversePostedMoney(h,h.transactions[0]!.id,{createdBy:"MEM-001",reversalDate:"2026-09-08"}).household;
  const review=ready(reversed,request(reversed,h.transactions[0]!.id,true,[]));expect(review.changes).toHaveLength(2);
  const closed={...reversed,kitchen:{...reversed.kitchen,books:{...reversed.kitchen.books,closedMonths:[{id:"CLOSE-2026-09",monthKey:"2026-09",closedAt:"2026-10-01T00:00:00Z",closedBy:"MEM-001"}]}}};
  expect(prepareDuplicateReview(closed,review.request)).toMatchObject({kind:"unavailable",reason:expect.stringContaining("closed month")});expect(()=>applyDuplicateReview(closed,review)).toThrow();
 });
 it("refuses changed comparison evidence and new incoming linked rows, but accepts unrelated revisions",()=>{
  const h=fixture(),review=ready(h);expect(()=>applyDuplicateReview({...h,revision:h.revision+1},review)).not.toThrow();
  const changed={...h,transactions:h.transactions.map((tx,i)=>i?tx:{...tx,note:"Changed comparison"})};expect(()=>applyDuplicateReview(changed,review)).toThrow(/changed/);
  const incoming={...h,transactions:[...h.transactions,{...h.transactions[0]!,id:"new-reversal",reversalOfId:review.target.id,source:"reversal" as const}]};expect(()=>applyDuplicateReview(incoming,review)).toThrow(/changed/);
 });
 it("protects Fund, Work, claim and goal auxiliary facts without blocking an ordinary imported copy of a protected comparison",()=>{
  const h=fixture(),id=h.transactions[0]!.id;
  const work={...h,transactions:h.transactions.map((tx,i)=>i?tx:{...tx,source:"shift" as const})};expect(prepareDuplicateReview(work,request(work,id,true,[]))).toMatchObject({kind:"unavailable",reason:expect.stringContaining("Work")});expect(prepareDuplicateReview(work,request(work,h.transactions[1]!.id,true,[id])).kind).toBe("ready");
  const fund={...h,transactions:h.transactions.map((tx,i)=>i?tx:{...tx,funding:{fundId:"FUND",fundedCents:100,destinationAccountId:"ACC-VISA"}})};expect(prepareDuplicateReview(fund,request(fund,id,true,[]))).toMatchObject({kind:"unavailable",reason:expect.stringContaining("Fund")});
  const claim={...h,claims:[{id:"claim",kind:"person" as const,label:"Claim",appointmentId:null,expenseTransactionId:id,recoveryTransactionId:null,settleTransferIds:[],writeOffTransactionId:null,expectedCents:100,receivedCents:0,writtenOffCents:0,receivableAccountId:"ACC-RECEIVABLE",status:"pending" as const,submittedAt:null,settledAt:null,craEligible:false,lines:[],createdAt:"2026-09-08T00:00:00Z",updatedAt:"2026-09-08T00:00:00Z"}]};expect(prepareDuplicateReview(claim,request(claim,id,true,[]))).toMatchObject({kind:"unavailable",reason:expect.stringContaining("claim")});
  const goal=addGoal(catalogHousehold(),{name:"Newfoundland",target:3000,shared:true}).household,funded=fundGoal(goal,{goalId:goal.goals[0]!.id,amount:25,fromAccountId:"ACC-CHEQUING",date:"2026-09-08",createdBy:"MEM-001"}).household;
  expect(prepareDuplicateReview(funded,request(funded,funded.transactions[0]!.id,true,[]))).toMatchObject({kind:"unavailable",reason:expect.stringContaining("goal")});
 });
 it("keeps pending/missing and partner-private sources unavailable, including hidden incoming links",()=>{
  const h=fixture(),review=ready(h),privateRow={...h.transactions[0]!,id:"private",note:"PARTNER_PRIVATE_CANARY",createdBy:"MEM-002",visibility:"personal" as const,reversalOfId:review.target.id};
  const hidden={...h,transactions:[...h.transactions,privateRow]};const refusal=prepareDuplicateReview(hidden,review.request);expect(refusal.kind).toBe("unavailable");expect(JSON.stringify(refusal)).not.toContain("CANARY");
  expect(prepareDuplicateReview(h,request(h,"pending",true,[])).kind).toBe("unavailable");expect(prepareDuplicateReview(h,{...review.request,householdId:"other"}).kind).toBe("unavailable");
  const missing={...h,transactions:h.transactions.map(tx=>tx.id===review.target.id?{...tx,reversalOfId:"missing"}:tx)};expect(prepareDuplicateReview(missing,review.request).kind).toBe("unavailable");
 });
});
