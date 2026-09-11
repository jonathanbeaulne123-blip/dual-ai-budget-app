import { describe, expect, it } from "vitest";
import { catalogHousehold, postEntry, monthSummary, undoLedgerConfirm, configureHouseholdFund, HOUSEHOLD_FUND_ID, fundedMoneyUndoTargets, reversePostedMoney, addPotentialExpense, postPotentialExpense, splitForSync } from "../src/core/index.ts";
import { matchPlanEvidence } from "../src/core/planProjection.ts";
import { snapshotPnL } from "../src/core/journal.ts";
import { categorySplitAmounts, partitionCategoryOwnership } from "../src/core/categorySplit.ts";
import { capturedIntent, clearCapturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
const first = "SUB-FOOD-GROCERIES", second = "SUB-FOOD-COFFEE";
const entry = { date: "2026-09-11", type: "expense" as const, amount: "130.00", accountId: "ACC-VISA", subcategoryId: first,
  note: "Concert tickets and gift", createdBy: "MEM-001", visibility: "household" as const,
  categorySplit: { secondSubcategoryId: second, firstPercent: 50 } };

describe("two-category expense confirmation", () => {
  it("posts one atomic confirmation with exact category reports and one Undo", () => {
    const h = catalogHousehold(), result = postEntry(h, entry);
    expect(result.postedIds).toHaveLength(2);
    expect(result.household.transactions.every(t => !t.potentialDuplicate)).toBe(true);
    expect(result.household.activity).toHaveLength(h.activity.length + 1);
    const summary = monthSummary(result.household, "2026-09");
    expect(summary.categories.find(c => c.subcategoryId === first)?.actualCents).toBe(6500);
    expect(summary.categories.find(c => c.subcategoryId === second)?.actualCents).toBe(6500);
    expect(snapshotPnL(result.household).expenseCents).toBe(13000);
    expect(capturedIntent(result.household)?.steps).toHaveLength(1);
    expect(capturedIntent(result.household)?.steps[0]?.reviewed).toHaveLength(2);
    expect(undoLedgerConfirm(result.household, result.undo).household.transactions).toEqual(h.transactions);
  });
  it("conserves odd cents in both category and original member totals", () => {
    const splits = [{party:"MEM-001",amountCents:501},{party:"MEM-002",amountCents:500}];
    const result = postEntry(catalogHousehold(), {...entry, amount:"10.01", splits, categorySplit:{...entry.categorySplit,firstPercent:30}});
    expect(result.household.transactions.map(t=>t.amountCents)).toEqual([300,701]);
    for (const split of splits) expect(result.household.transactions.flatMap(t=>t.splits).filter(s=>s.party===split.party).reduce((n,s)=>n+s.amountCents,0)).toBe(split.amountCents);
    for (const total of [1,2,3,101,1001,13001]) for (const percent of [0,1,30,50,99,100]) {
      const amounts = categorySplitAmounts(first,{secondSubcategoryId:second,firstPercent:percent},total);
      const owned=[{party:"MEM-001",amountCents:Math.ceil(total/2)},{party:"MEM-002",amountCents:Math.floor(total/2)}];
      const parts=partitionCategoryOwnership(owned,amounts[0],total);
      expect(parts.map(rows=>rows.reduce((n,s)=>n+s.amountCents,0))).toEqual(amounts);
      expect(parts.flat().every(s=>s.amountCents>=0)).toBe(true);
    }
  });
  it.each([0,100])("keeps a %s percent endpoint as one nonzero row", firstPercent => {
    const result=postEntry(catalogHousehold(),{...entry,categorySplit:{...entry.categorySplit,firstPercent}});
    expect(result.household.transactions).toHaveLength(1); expect(result.household.transactions[0]!.amountCents).toBe(13000);
  });
  it("rejects invalid and stale categories without any partial mutation", () => {
    const h=catalogHousehold(),before=structuredClone(h);
    for(const categorySplit of [{secondSubcategoryId:first,firstPercent:50},{secondSubcategoryId:'missing',firstPercent:50},{secondSubcategoryId:second,firstPercent:NaN},{secondSubcategoryId:second,firstPercent:101}])
      expect(()=>postEntry(h,{...entry,categorySplit})).toThrow();
    expect(h).toEqual(before);
    h.categories.find(c=>c.id===second)!.active=false;
    expect(()=>postEntry(h,entry)).toThrow();
  });
  it("requires duplicate approval atomically even when only the second portion matches", () => {
    const h=postEntry(catalogHousehold(),{...entry,categorySplit:undefined,subcategoryId:second,amount:'65.00'}).household;
    const before=structuredClone(h);
    expect(()=>postEntry(h,entry)).toThrow(); expect(h).toEqual(before);
    const accepted=postEntry(h,{...entry,confirmDuplicate:true}); expect(accepted.postedIds).toHaveLength(2);
  });
  it("conserves partial Fund cents and reverses both categories", () => {
    const h=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-09-01',createdBy:'MEM-001'}).household;
    const result=postEntry(h,{...entry,amount:'10.01',funding:{fundId:HOUSEHOLD_FUND_ID,fundedCents:777,destinationAccountId:'ACC-VISA'}});
    expect(result.household.transactions.reduce((n,t)=>n+(t.funding?.fundedCents??0),0)).toBe(777);
    const ids=fundedMoneyUndoTargets(result.household,result.undo);expect(ids).toHaveLength(2);
    let undone=result.household; for(const id of ids) undone=reversePostedMoney(undone,id,{createdBy:'MEM-001'}).household;
    expect(snapshotPnL(undone).expenseCents).toBe(0);
  });
  it("posts a planned expense as both actual category rows and restores it on Undo",()=>{
    const h=addPotentialExpense(catalogHousehold(),{...entry,title:entry.note}).household,id=h.potentialExpenses[0]!.id;
    const result=postPotentialExpense(h,{...entry,id});
    expect(result.household.transactions).toHaveLength(2);expect(result.household.potentialExpenses[0]!.status).toBe('posted');
    const evidence=matchPlanEvidence(result.household,{id:'line',lens:'protect',kind:'obligation',labelSnapshot:'Tickets',amountCents:13000,cadence:'one-time',createdBy:'MEM-001',assumptionIds:[],sourceReference:{type:'potential-expense',id}},'2026-09','2026-09-30','MEM-001','household');
    expect(evidence.reduce((n,row)=>n+row.amountCents,0)).toBe(13000);
    const undone=undoLedgerConfirm(result.household,result.undo).household;
    expect(undone.transactions).toHaveLength(0);expect(undone.potentialExpenses[0]!.status).toBe('planned');
  });
  it("reverses both funded planned portions and removes their net Plan evidence",()=>{
    let h=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-09-01',createdBy:'MEM-001'}).household;
    h=addPotentialExpense(h,{...entry,title:entry.note}).household;
    const id=h.potentialExpenses[0]!.id;
    const result=postPotentialExpense(h,{...entry,id,funding:{fundId:HOUSEHOLD_FUND_ID,fundedCents:7001,destinationAccountId:'ACC-VISA'}});
    const ids=fundedMoneyUndoTargets(result.household,result.undo);expect(ids).toHaveLength(2);
    let undone=result.household;for(const tx of ids)undone=reversePostedMoney(undone,tx,{createdBy:'MEM-001'}).household;
    expect(snapshotPnL(undone).expenseCents).toBe(0);
    const evidence=matchPlanEvidence(undone,{id:'line',lens:'protect',kind:'obligation',labelSnapshot:'Tickets',amountCents:13000,cadence:'one-time',createdBy:'MEM-001',assumptionIds:[],sourceReference:{type:'potential-expense',id}},'2026-09','2026-09-30','MEM-001','household');
    expect(evidence.reduce((n,row)=>n+row.amountCents,0)).toBe(0);
  });
  it("keeps both Personal category portions out of Shared continuity",()=>{
    const h=catalogHousehold();const account=h.accounts.find(a=>a.id==='ACC-VISA')!;
    account.scope='personal';account.ownerMemberId='MEM-001';
    const result=postEntry(h,{...entry,visibility:'personal'});
    const separated=splitForSync(result.household,'MEM-001');
    expect(separated.shared.transactions).toHaveLength(0);
    expect(separated.personal.transactions).toHaveLength(2);
    expect(separated.personal.transactions.reduce((n,t)=>n+t.amountCents,0)).toBe(13000);
  });
  it("replays both reviewed categories in one authority command and refuses changed allocation",async()=>{
    const h=catalogHousehold(),one=splitForSync(h,'MEM-001'),two=splitForSync(h,'MEM-002');
    const state:AuthorityState={sequence:h.revision,shared:one.shared,personal:new Map([['MEM-001',one.personal],['MEM-002',two.personal]])};
    const scope:Scope={environment:h.environment,householdId:h.householdId,memberId:'MEM-001',subject:'synthetic',role:'owner',expires:Date.now()+60000,aclEpoch:1};
    clearCapturedIntent(h);
    const command=await commandFromCapture(capturedIntent(postEntry(h,entry).household)!,scope,crypto.randomUUID());
    const accepted=await prepareCommand(state,command,scope,()=>{});
    expect(accepted.household.transactions.map(t=>t.amountCents)).toEqual([6500,6500]);
    expect(accepted.receipt.postedIds).toHaveLength(2);
    const changed=structuredClone(command);(changed.steps[0]!.args[0] as typeof entry).categorySplit.firstPercent=30;
    await expect(prepareCommand(state,changed,scope,()=>{})).rejects.toThrow();
  });
});
