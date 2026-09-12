import { afterEach, describe, expect, it, vi } from "vitest";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { acceptHouseholdWrite, addPotentialExpense, postPotentialExpense, removePotentialExpense, addAppointment, postVisit, postEntry, assembleHousehold, catalogHousehold, financialAuditHash, householdForView, recordBillPayment, reversePostedMoney, splitForSync, type Household, type LedgerView } from "../src/core/index.ts";
import { saveTask } from "../src/core/tasks.ts";
import { allocateNestTotal, nestCategoryFor, projectKittyNest } from "../src/core/kittyNest.ts";
import { assertKittyNestTransition, nestDesignId, saveKittyNestDesign } from "../src/core/kittyNestDesigns.ts";
import { newKittyPiece, reopenKittyPiece } from "../src/core/kittyStudio.ts";
import { projectHouseholdFund } from "../src/core/householdFund.ts";
import { memberProgress } from "../src/core/onboarding/progress.ts";
import { chapterById, requiredHouseholdChapters } from "../src/core/onboarding/registry.ts";
import { skipPersonalStep } from "../src/core/commands.ts";
import { compactedCommandPayload, primaryCommandRef, receiptToCommandRef } from "../src/ledger/continuityCommandLog.ts";
import { applyCommandEventLocally, extractMaterializationFacts, materializedHashMatchesSnapshot, type ContinuityCommandEvent } from "../src/ledger/materializeSnapshotFromEvents.ts";
import { commandMaterializationFacts, sha256Hex } from "../src/core/commandIdentity.ts";
import { capturedIntent, clearCapturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand } from "../src/ledgerSync/authority.ts";
const memberId="MEM-001",today="2026-09-21";
const nest=(h:Household,view:LedgerView="household")=>projectKittyNest(h,memberId,view,today);
const banks=(h:Household,view:LedgerView="household")=>nest(h,view).categories.flatMap(row=>row.children);
function save(h:Household,bankKey="king",view:LedgerView="household",name="Our handmade King") {
  return saveKittyNestDesign(h,{memberId,view,bankKey,expectedRevision:h.kittyNestDesigns?.find(row=>row.id===nestDesignId(view,memberId,bankKey))?.revision??0,name,glaze:"rose"});
}
afterEach(()=>vi.useRealTimers());
describe("Four tiers of nesting banks",()=>{
 it("projects a clean household without creating a goal or changing the books",async()=>{
  const h=catalogHousehold(),before=await financialAuditHash(h),result=nest(h);
  expect(result.king.id).toBe("king");expect(result.categories.map(r=>r.category)).toEqual(["protect","everyday","build","prepare"]);
  expect(await financialAuditHash(h)).toBe(before);expect(h.kittyNestDesigns??[]).toEqual([]);
  for(const total of [0,1,100,10001,-1,-73591,Number.MAX_SAFE_INTEGER]) {const a=allocateNestTotal(total,{build:750,protect:10000,prepare:331});expect(Object.values(a).reduce((s,n)=>s+n,0)).toBe(total);}
 });
 it("uses the entire Fund, preserves every legacy goal identity and conserves the King to the cent",()=>{
  const h=planLifeFixture("household"),result=nest(h),fund=projectHouseholdFund(h,today);
  expect(result.king.amountCents).toBe(fund.operatingBalanceCents+fund.kittyCents);
  expect(result.categories.reduce((s,r)=>s+r.amountCents,0)).toBe(result.king.amountCents);
  expect(result.king.targetCents).toBe(result.categories.reduce((sum,row)=>sum+row.targetCents,0));
  expect(banks(h).filter(row=>row.goal).map(row=>row.goal!.id).sort()).toEqual(h.goals.map(row=>row.id).sort());
  expect(nestCategoryFor("Summer vacation")).toBe("build");expect(nestCategoryFor("Unknown purpose")).toBe("everyday");expect(nestCategoryFor("Summer vacation","protect")).toBe("protect");
 });
 it("breaks the paid occurrence, automatically shows the next, and restores reversed debt without duplicating either",()=>{
  let h=planLifeFixture("household");const r=h.recurrences[0]!;
  const paid=recordBillPayment(h,{recurrenceId:r.id,occurrenceDate:r.nextDate,paymentDate:"2026-09-19",amount:"900",accountId:r.accountId,createdBy:memberId});h=paid.household;
  expect(nest(h).history.filter(row=>row.designKey===`recurrence:${r.id}`).map(row=>row.date)).toEqual(["2026-09-20"]);
  expect(banks(h).filter(row=>row.designKey===`recurrence:${r.id}`).map(row=>row.date)).toEqual(["2026-10-20"]);
  h=reversePostedMoney(h,paid.postedIds[0]!,{createdBy:memberId,reversalDate:"2026-09-21"}).household;
  expect(nest(h).history.filter(row=>row.designKey===`recurrence:${r.id}`)).toHaveLength(0);
  expect(banks(h).filter(row=>row.designKey===`recurrence:${r.id}`).map(row=>row.date).sort()).toEqual(["2026-09-20","2026-10-20"]);
 });
 it("keeps paid pottery appearance when future pots are redecorated",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));let h=planLifeFixture("household");const r=h.recurrences[0]!;h=save(h,`recurrence:${r.id}`,"household","Old rose rent").household;
  vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));h=recordBillPayment(h,{recurrenceId:r.id,occurrenceDate:r.nextDate,paymentDate:"2026-09-19",amount:"900",accountId:r.accountId,createdBy:memberId}).household;
  vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));h=save(h,`recurrence:${r.id}`,"household","New rent pot").household;
  expect(nest(h).history.find(row=>row.designKey===`recurrence:${r.id}`)?.name).toBe("Old rose rent");
  expect(banks(h).find(row=>row.designKey===`recurrence:${r.id}`)?.name).toBe("New rent pot");
 });
 it("automatically nests costs sharing a calendar context without mistaking them for duplicate money",()=>{
  let h=planLifeFixture("household");for(const title of ["Wedding travel","Wedding gift"]) h=addPotentialExpense(h,{date:"2026-09-29",title,amount:"100",accountId:"ACC-CHEQUING",subcategoryId:"SUB-LIFE-FUN",createdBy:memberId,visibility:"household"}).household;
  h.potentialExpenses=h.potentialExpenses.map(row=>({...row,linkedCalendarItemId:"same-event"}));
  expect(banks(h).filter(row=>row.designKey.startsWith("potential:"))).toHaveLength(2);
 });
 it.each(["household", "personal"] as const)("retains a both-visible paid expense's old appearance in %s", view=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));
  let h=addPotentialExpense(planLifeFixture(view),{date:"2026-09-19",title:"Wedding gift",amount:"10",accountId:"ACC-CHEQUING",subcategoryId:"SUB-LIFE-FUN",createdBy:memberId,visibility:view==="personal"?"personal":"both"}).household;
  const expense=h.potentialExpenses.at(-1)!,key=`potential:${expense.id}`;
  h=save(h,key,view,"Our rose keepsake").household;
  vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));
  h=postPotentialExpense(h,{id:expense.id,createdBy:view==="household"?"MEM-002":memberId}).household;
  // Current Personal writes are Personal-only; imported legacy receipts may be Both.
  if(view==="personal") {const receiptId=h.potentialExpenses.find(row=>row.id===expense.id)!.transactionId;h={...h,potentialExpenses:h.potentialExpenses.map(row=>row.id===expense.id?{...row,visibility:"both"}:row),transactions:h.transactions.map(row=>row.id===receiptId?{...row,visibility:"both"}:row)};}
  const paid=h;
  vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
  h=saveKittyNestDesign(h,{memberId,view,bankKey:key,expectedRevision:1,name:"Future cream pot",glaze:"cream"}).household;
  expect(nest(h,view).history.find(row=>row.designKey===key)).toMatchObject({name:"Our rose keepsake",design:{glaze:"rose"}});
  expect(()=>assertKittyNestTransition(paid,h,memberId,"saveKittyNestDesign")).not.toThrow();
  const rewritten=structuredClone(h);rewritten.kittyNestDesigns![0]!.history=[];
  expect(()=>assertKittyNestTransition(paid,rewritten,memberId,"saveKittyNestDesign")).toThrow(/broken pot/);
 });
 it("does not use another member's both-visible receipt for Personal appearance history",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));
  let h=addPotentialExpense(planLifeFixture("personal"),{date:"2026-09-19",title:"Private gift",amount:"10",accountId:"ACC-CHEQUING",subcategoryId:"SUB-LIFE-FUN",createdBy:memberId,visibility:"personal"}).household;
  const expense=h.potentialExpenses.at(-1)!,key=`potential:${expense.id}`;h=save(h,key,"personal").household;
  vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));h=postPotentialExpense(h,{id:expense.id,createdBy:memberId}).household;
  const receiptId=h.potentialExpenses.find(row=>row.id===expense.id)!.transactionId;
  h={...h,transactions:h.transactions.map(row=>row.id===receiptId?{...row,createdBy:"MEM-002",visibility:"both"}:row)};
  vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));h=save(h,key,"personal","My future pot").household;
  expect(h.kittyNestDesigns![0]!.history??[]).toEqual([]);
 });
 it("rejects a captured design save after another device removes its potential expense",async()=>{
  let h=addPotentialExpense(planLifeFixture("household"),{date:"2026-09-29",title:"Wedding gift",amount:"10",accountId:"ACC-CHEQUING",subcategoryId:"SUB-LIFE-FUN",createdBy:memberId,visibility:"household"}).household;
  const expense=h.potentialExpenses.at(-1)!,key=`potential:${expense.id}`;h=save(h,key).household;
  const scope:Scope={environment:h.environment,householdId:h.householdId,memberId,subject:"synthetic-one",role:"owner",expires:Date.now()+60000,aclEpoch:1};
  clearCapturedIntent(h);
  const stale=save(h,key,"household","Open editor draft").household;
  const command=await commandFromCapture(capturedIntent(stale)!,scope,crypto.randomUUID());
  expect(command.steps).toHaveLength(1);
  const removed=removePotentialExpense(h,{id:expense.id,createdBy:memberId}).household;
  expect(banks(removed).some(row=>row.designKey===key)).toBe(false);
  expect(()=>save(removed,key)).toThrow(/no longer available/);
  expect(()=>assertKittyNestTransition(removed,{...removed,kittyNestDesigns:stale.kittyNestDesigns},memberId,"saveKittyNestDesign")).toThrow(/own space/);
  const one=splitForSync(removed,memberId),two=splitForSync(removed,"MEM-002");
  await expect(prepareCommand({sequence:removed.revision,shared:one.shared,personal:new Map([[memberId,one.personal],["MEM-002",two.personal]])},command,scope,()=>{})).rejects.toThrow(/no longer available/);
 });
 it.each(["deleted","no cost","linked cost"])("rejects a stale cost-task pot after the source becomes %s",change=>{
  let h=saveTask(planLifeFixture("personal"),{memberId,id:"TASK-cost",expectedRevision:0,task:{visibility:"personal",title:"New tires",notes:"",listId:null,parentId:null,doDate:null,dueDate:null,repeat:"none",cue:"none",assigneeId:null,backupId:null,chapterId:null,planReference:null,moneyLink:null,expectedAmountCents:50000,deleted:false}}).household;
  const key="task:TASK-cost";h=save(h,key,"personal").household;
  const task=h.tasks!.find(row=>row.id==="TASK-cost")!;
  h=saveTask(h,{memberId,id:task.id,expectedRevision:task.revision,task:{...task,...(change==="deleted"?{deleted:true}:change==="no cost"?{expectedAmountCents:0}:{moneyLink:{kind:"recurrence" as const,recurrenceId:h.recurrences[0]!.id,date:h.recurrences[0]!.nextDate}})}}).household;
  expect(banks(h,"personal").some(row=>row.designKey===key)).toBe(false);
  expect(()=>save(h,key,"personal")).toThrow(/no longer available/);
 });
 it("retains an undecorated paid source name and supports years of edits and archive cycles",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));
  let h=addPotentialExpense(planLifeFixture("household"),{date:"2026-09-19",title:"Wedding gift",amount:"10",accountId:"ACC-CHEQUING",subcategoryId:"SUB-LIFE-FUN",createdBy:memberId,visibility:"household"}).household;
  const expense=h.potentialExpenses.at(-1)!;
  h=postPotentialExpense(h,{id:expense.id,createdBy:memberId}).household;
  const key=`potential:${expense.id}`;
  for(let i=0;i<300;i++){vi.setSystemTime(new Date(Date.UTC(2026,8,20,12,0,i)));h=save(h,key,"household",`Future gift ${i}`).household;}
  expect(nest(h).history.find(row=>row.designKey===key)?.name).toBe("Wedding gift");
  expect(h.kittyNestDesigns![0]!.history??[]).toHaveLength(0);
  h=saveKittyNestDesign(h,{memberId,view:"household",bankKey:key,expectedRevision:300,name:"Future gift",glaze:"cream",archived:true}).household;
  expect(h.kittyNestDesigns![0]!.archivedAt).toBeTruthy();
 });
 it("includes appointments, undated cost tasks and unlinked active Plan costs",()=>{
  let h=planLifeFixture("personal");
  h=addAppointment(h,{title:"Dental visit",memberId,nextDate:"2026-09-23",cadence:"monthly",typicalCost:100,subcategoryId:"SUB-HEALTH-DENTAL",accountId:"ACC-CHEQUING",sensitivity:"quiet"}).household;
  const appointmentId=h.appointments.at(-1)!.id;
  h=saveTask(h,{memberId,id:"TASK-new-tires",expectedRevision:0,task:{visibility:"personal",title:"New tires",notes:"",listId:null,parentId:null,doDate:null,dueDate:null,repeat:"none",cue:"none",assigneeId:null,backupId:null,chapterId:null,planReference:null,moneyLink:null,expectedAmountCents:50000,deleted:false}}).household;
  const plan=h.planVersions!.find(row=>row.state==="active")!;plan.lines.push({...plan.lines[0]!,id:"unlinked-cost",sourceReference:undefined,labelSnapshot:"School supplies",amountCents:2500});
  expect(banks(h,"personal").map(row=>row.designKey)).toEqual(expect.arrayContaining([`appointment:${appointmentId}`,"task:TASK-new-tires","plan-line:unlinked-cost"]));
  h=postVisit(h,{appointmentId,date:"2026-09-21",amount:100,createdBy:memberId,visibility:"personal"}).household;
  expect(nest(h,"personal").history.some(row=>row.designKey===`appointment:${appointmentId}`)).toBe(true);
 });
 it("never lets unrelated private expenses affect a shared pot's design history",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));let h=planLifeFixture("household");const key=`recurrence:${h.recurrences[0]!.id}`;h=save(h,key).household;
  h.accounts=h.accounts.map(row=>row.id==="ACC-CHEQUING"?{...row,scope:"personal",ownerMemberId:memberId}:row);
  vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));h=postEntry(h,{type:"expense",date:"2026-09-19",amount:10,accountId:"ACC-CHEQUING",subcategoryId:"SUB-LIFE-FUN",createdBy:memberId,visibility:"personal"}).household;
  vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));h=save(h,key).household;
  expect(h.kittyNestDesigns![0]!.history??[]).toEqual([]);
  const next=saveKittyNestDesign(h,{memberId:"MEM-002",view:"household",bankKey:key,expectedRevision:2,name:"Our future pot",glaze:"cream"}).household;
  expect(()=>assertKittyNestTransition(h,next,"MEM-002","saveKittyNestDesign")).not.toThrow();
 });
 it("keeps parents cosmetic, rejects stale edits and cross-category parent reassignments",async()=>{
  const h=planLifeFixture("household"),changed=save(h).household;
  expect(changed.goals).toEqual(h.goals);expect(await financialAuditHash(changed)).toBe(await financialAuditHash(h));
  expect(()=>saveKittyNestDesign(changed,{memberId,view:"household",bankKey:"king",expectedRevision:0,name:"Stale",glaze:"cream"})).toThrow(/changed/);
  expect(()=>saveKittyNestDesign(changed,{memberId,view:"household",bankKey:"plan:protect",expectedRevision:0,name:"Protect",glaze:"cream",category:"build"})).toThrow();
  expect(()=>assertKittyNestTransition(changed,{...changed,kittyNestDesigns:[]})).toThrow(/disappear/);
 });
 it("separates private Kings and private sources on both sync and UI projections",()=>{
  let h=planLifeFixture("personal");h=save(h,"king","household","Shared crown").household;h=save(h,"king","personal","Private initials").household;
  const split=splitForSync(h,memberId);expect(JSON.stringify(split.shared)).not.toContain("Private initials");expect(JSON.stringify(split.personal)).toContain("Private initials");
  expect(householdForView(h,"MEM-002","personal").kittyNestDesigns??[]).toHaveLength(0);
  const restored=assembleHousehold(split.shared,split.personal);expect(nest(restored,"personal").king.name).toBe("Private initials");
  const privateBill=h.recurrences[0]!;expect(()=>saveKittyNestDesign(h,{memberId:"MEM-002",view:"personal",bankKey:`recurrence:${privateBill.id}`,expectedRevision:0,name:"Peeking",glaze:"cream"})).toThrow(/space/);
 });
 it("makes the King chapter optional, resumable and sticky after repainting",()=>{
  let h=catalogHousehold();expect(chapterById("ch-13-king")?.skip).toBe("member-skippable");expect(requiredHouseholdChapters().some(row=>row.id==="ch-13-king")).toBe(false);
  h=skipPersonalStep(h,{memberId,createdBy:memberId,chapterId:"ch-13-king"}).household;expect(memberProgress(h,memberId).rows.find(row=>row.chapterId==="ch-13-king")?.skippedAt).toBeTruthy();
  h=saveKittyNestDesign(h,{memberId,view:"household",bankKey:"king",expectedRevision:0,name:"King",glaze:"rose",studio:{version:1,draft:newKittyPiece("king-piece",new Date().toISOString()),fired:[]},fire:true,completeSetup:true}).household;
  const design=h.kittyNestDesigns![0]!;h=saveKittyNestDesign(h,{memberId,view:"household",bankKey:"king",expectedRevision:1,name:"King",glaze:"rose",studio:reopenKittyPiece(design.studio!,"king-piece")}).household;
  expect(h.kittyNestDesigns![0]!.setupCompletedAt).toBe(design.setupCompletedAt);
 });
});
async function acceptedDesign(previous:Household,bankKey="king") {
 const committed=save(previous,bankKey),confirmationId=crypto.randomUUID();
 const accepted=await acceptHouseholdWrite({previous,candidate:committed.household,postedIds:committed.postedIds,confirmationId,commandKind:"saveKittyNestDesign",actingMemberId:memberId,adapters:{persist:async()=>{},ingest:async()=>({ok:true})}});
 expect(accepted.ok,JSON.stringify(accepted)).toBe(true);const receipt=accepted.household.commandReceipts.find(row=>row.confirmationId===confirmationId)!;
 const ref=receiptToCommandRef({household:accepted.household,receipt,baseRevision:previous.revision});
 const event:ContinuityCommandEvent={id:confirmationId,environment:previous.environment,household_id:previous.householdId,member_id:memberId,idempotency_key:confirmationId,confirmation_id:confirmationId,identity_hash:receipt.identityHash,base_revision:previous.revision,result_revision:accepted.household.revision,ledger_scope:ref.ledgerScope,command_type:ref.commandType,payload_json:{...ref.commandPayload,materializationFacts:extractMaterializationFacts(accepted.household,receipt.postedIds)},created_at:receipt.acceptedAt};
 return {h:accepted.household,event,ref};
}
describe("Nest continuity admission",()=>{
 it("replays the accepted cosmetic design and rejects a tampered appearance even with a recomputed aggregate hash",async()=>{
  const h=catalogHousehold(),a=await acceptedDesign(h);const result=await applyCommandEventLocally({local:h,event:a.event,memberId});expect(result.ok).toBe(true);if(result.ok)expect(result.household.kittyNestDesigns).toEqual(a.h.kittyNestDesigns);
  const event=structuredClone(a.event);event.payload_json.materializationFacts!.kittyNestDesigns![0]!.name="Changed after acceptance";event.payload_json.materializationHash=await sha256Hex(commandMaterializationFacts(event.payload_json.materializationFacts!));
  expect((await applyCommandEventLocally({local:h,event,memberId})).ok).toBe(false);
 });
 it("preserves styles when legacy event reconstruction lacks them",async()=>{
  const h=catalogHousehold(),a=await acceptedDesign(h);expect(await materializedHashMatchesSnapshot({materialized:h,snapshotTip:a.h,memberId,project:h=>h})).toBe(false);
 });
 it("replays compacted edits to the same bank using its latest receipt",async()=>{
  const h=catalogHousehold(),a=await acceptedDesign(h),b=await acceptedDesign(a.h);const refs=[a.ref,b.ref];const primary=primaryCommandRef(refs)!;
  const event={...b.event,base_revision:h.revision,payload_json:await compactedCommandPayload({confirmationIds:refs.map(r=>r.confirmationId),commandRefs:refs},primary,b.h,memberId) as unknown as ContinuityCommandEvent["payload_json"]};
  const result=await applyCommandEventLocally({local:h,event,memberId});expect(result.ok,JSON.stringify(result)).toBe(true);if(result.ok)expect(result.household.kittyNestDesigns).toEqual(b.h.kittyNestDesigns);
 });
 it("rejects a compacted event whose primary receipt and design were omitted",async()=>{
  const h=catalogHousehold(),a=await acceptedDesign(h),b=await acceptedDesign(a.h,"plan:protect"),refs=[a.ref,b.ref];
  const payload=await compactedCommandPayload({confirmationIds:refs.map(r=>r.confirmationId),commandRefs:refs},primaryCommandRef(refs)!,b.h,memberId) as unknown as ContinuityCommandEvent["payload_json"];
  const event={...b.event,base_revision:h.revision,payload_json:payload};
  expect((await applyCommandEventLocally({local:h,event,memberId})).ok).toBe(true);
  payload.compactedCommands=payload.compactedCommands!.filter(row=>row.confirmationId!==event.confirmation_id);
  payload.compactedConfirmationIds=payload.compactedConfirmationIds!.filter(id=>id!==event.confirmation_id);
  payload.materializationFacts!.kittyNestDesigns=payload.materializationFacts!.kittyNestDesigns!.filter(row=>row.bankKey==="king");
  payload.postedIds=payload.materializationFacts!.kittyNestDesigns.map(row=>row.id);
  payload.materializationHash=await sha256Hex(commandMaterializationFacts(payload.materializationFacts!));
  expect((await applyCommandEventLocally({local:h,event,memberId})).ok).toBe(false);
 });
});
