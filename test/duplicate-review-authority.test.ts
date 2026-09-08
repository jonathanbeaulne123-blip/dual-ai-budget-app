import { describe, expect, it } from "vitest";
import { catalogHousehold, postEntry, splitForSync, type Household } from "../src/core/index.ts";
import { applyDuplicateReview } from "../src/core/duplicateReviewCommand.ts";
import { prepareDuplicateReview } from "../src/core/duplicateReview.ts";
import { capturedIntent, clearCapturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
import { executeIntent } from "../src/ledgerSync/registry.ts";
function state(h:Household):AuthorityState{const one=splitForSync(h,"MEM-001"),two=splitForSync(h,"MEM-002");return {sequence:h.revision,shared:one.shared,personal:new Map([["MEM-001",one.personal],["MEM-002",two.personal]])};}
async function fixture(){let h=catalogHousehold();for(const date of ["2026-09-07","2026-09-08"])h=postEntry(h,{date,note:"PRIVATE_COMPARISON_TEXT",type:"expense",amount:"47.23",accountId:"ACC-VISA",subcategoryId:"SUB-FOOD-GROCERIES",createdBy:"MEM-001",confirmDuplicate:true}).household;clearCapturedIntent(h);
 const scope:Scope={environment:h.environment,householdId:h.householdId,memberId:"MEM-001",subject:"test-one",role:"owner",expires:Date.now()+60000,aclEpoch:1};
 const review=prepareDuplicateReview(h,{environment:h.environment,householdId:h.householdId,memberId:"MEM-001",view:"household",targetId:h.transactions[0]!.id,isDuplicate:true,comparisonIds:h.transactions.map(tx=>tx.id)});if(review.kind!=="ready")throw Error(review.reason);
 const candidate=applyDuplicateReview(h,review),command=await commandFromCapture(capturedIntent(candidate.household)!,scope,crypto.randomUUID());return {h,scope,review,command};}
describe("Prise authoritative review",()=>{
 it("round trips canonical capture and accepted assembly without raw comparison facts in the command",async()=>{
  const f=await fixture();expect(f.command.steps).toHaveLength(1);expect(JSON.stringify(f.command)).not.toContain("PRIVATE_COMPARISON_TEXT");expect(f.command.steps[0]!.resources).toEqual([{key:"duplicate-review",hash:expect.any(String)}]);
  const accepted=await prepareCommand(state(f.h),f.command,f.scope,()=>{});expect(accepted.household.transactions.find(tx=>tx.id===f.review.target.id)!.isDuplicate).toBe(true);
 });
 it("rejects remote changes to comparison, incoming correction, protected source and closed month after local Confirm",async()=>{
  const f=await fixture();const variants:Household[]=[
   {...f.h,transactions:f.h.transactions.map((tx,i)=>i?{...tx,note:"Remote comparison"}:tx)},
   {...f.h,transactions:[...f.h.transactions,{...f.h.transactions[0]!,id:"incoming-correction",reversalOfId:f.review.target.id,source:"reversal"}]},
   {...f.h,claims:[{id:"claim",kind:"person",label:"Claim",appointmentId:null,expenseTransactionId:f.review.target.id,recoveryTransactionId:null,settleTransferIds:[],writeOffTransactionId:null,expectedCents:100,receivedCents:0,writtenOffCents:0,receivableAccountId:"ACC-RECEIVABLE",status:"pending",submittedAt:null,settledAt:null,craEligible:false,lines:[],createdAt:"2026-09-08T00:00:00Z",updatedAt:"2026-09-08T00:00:00Z"}]},
   {...f.h,kitchen:{...f.h.kitchen,books:{...f.h.kitchen.books,closedMonths:[{id:"close",monthKey:"2026-09",closedAt:"2026-10-01T00:00:00Z",closedBy:"MEM-001"}]}}},
  ];for(const h of variants)await expect(prepareCommand(state(h),f.command,f.scope,()=>{})).rejects.toThrow("BUSINESS_PRECONDITION_CHANGED");
 });
 it("accepts unrelated changes but actor spoofing, malformed review and target substitutions cannot dispatch",async()=>{
  const f=await fixture(),unrelated={...f.h,revision:f.h.revision+1,transactions:[...f.h.transactions,{...f.h.transactions[0]!,id:"unrelated",note:"Other entry"}]};
  await expect(prepareCommand(state(unrelated),f.command,f.scope,()=>{})).resolves.toBeDefined();const args=f.command.steps[0]!.args;
  expect(()=>executeIntent(f.h,"markDuplicate",args,"MEM-002",crypto.randomUUID())).toThrow("ACTOR_MISMATCH");
  for(const invalid of [[args[0],false,args[2]],[args[0],true,{request:{}}],["other",true,args[2]]])expect(()=>executeIntent(f.h,"markDuplicate",invalid,"MEM-001",crypto.randomUUID())).toThrow("INVALID_DUPLICATE_REVIEW");
 });
});
