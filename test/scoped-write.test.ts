import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { createWriteQueue } from "../src/core/writeQueue.ts";
import { enqueueScopedWrite, type WriteScope } from "../src/core/scopedWrite.ts";
import { catalogHousehold, configureHouseholdFund, proposeHouseholdFundContribution, confirmHouseholdFundContribution, confirmHouseholdFundSettlement, postEntry, HOUSEHOLD_FUND_ID, setFundRailSlot } from "../src/core/index.ts";
function fixture(id: string) {
  let h = configureHouseholdFund({...catalogHousehold(), householdId: id}, {custodianMemberId:"MEM-001",openedOn:"2026-08-01",createdBy:"MEM-001"}).household;
  const p = proposeHouseholdFundContribution(h,{memberId:"MEM-002",contributorMemberId:"MEM-002",amount:"100",date:"2026-09-08"});
  h = confirmHouseholdFundContribution(p.household,{memberId:"MEM-001",proposalEventId:p.postedIds[0]!}).household;
  return postEntry(h,{date:"2026-09-08",type:"expense",amount:"50",accountId:"ACC-VISA",subcategoryId:"SUB-HOUSING-ELECTRIC",note:"Fictional scope fixture",createdBy:"MEM-001",visibility:"household",confirmDuplicate:true,funding:{fundId:HOUSEHOLD_FUND_ID,fundedCents:5000,destinationAccountId:"ACC-VISA"}}).household;
}
const reviewed: WriteScope = {generation:1,environment:"development",householdId:"HH-A",memberId:"MEM-001",view:"household"};
describe("reviewed kitchen scope", () => {
  it("wires view transitions to the same generation fence as member and household transitions",()=>{
    const app=readFileSync("src/App.tsx","utf8");
    const transition=app.slice(app.indexOf("function rememberSession"),app.indexOf("async function switchLedger"));
    expect(transition).toMatch(/previous\?\.view !== remembered\.view\s*\) \{\s*replicaScopeGenerationRef\.current \+= 1;/);
    const kitchen=app.slice(app.indexOf("const reviewedKitchenScope"),app.indexOf("function requestClearThisPhone"));
    expect(kitchen).toContain("enqueueScopedWrite(enqueueWrite, reviewedKitchenScope");
    expect(kitchen).toContain("sessionRef.current?.memberId");
  });
  for (const mutation of ["household", "member", "environment", "view", "roundtrip"] as const) {
    for (const command of ["settlement", "preference"] as const) it(`refuses queued ${command} after ${mutation} changes`, async () => {
      const enqueue = createWriteQueue(); let release!:()=>void;
      const barrier = enqueue(() => new Promise<void>(resolve => {release=resolve;}));
      await Promise.resolve();
      let current=fixture("HH-A"); let scope={...reviewed}; let calls=0,refusals=0;
      const pending=enqueueScopedWrite(enqueue,reviewed,()=>scope,async()=>{
        calls++;
        current=command==="settlement" ? confirmHouseholdFundSettlement(current,{memberId:"MEM-001",amount:"25",destinationAccountId:"ACC-VISA",date:"2026-09-08"}).household
          : setFundRailSlot(current,{memberId:"MEM-001",createdBy:"MEM-001",slot:2,widgetId:"shape"}).household;
        return current;
      },()=>refusals++);
      if(mutation==="household"){current=fixture("HH-B");scope.householdId="HH-B";}
      if(mutation==="member")scope.memberId="MEM-002";
      if(mutation==="environment")scope.environment="production";
      if(mutation==="view")scope.view="personal";
      if(mutation==="roundtrip")scope.generation+=2;
      const before=JSON.stringify(current);release();await barrier;
      expect(await pending).toBeNull();expect(calls).toBe(0);expect(refusals).toBe(1);expect(JSON.stringify(current)).toBe(before);
    });
  }
  it("refuses a stale rendered callback before queueing",async()=>{
    let queued=0,ran=0;
    await enqueueScopedWrite(async work=>{queued++;return work();},reviewed,()=>({...reviewed,generation:3}),async()=>++ran,()=>{});
    expect(queued).toBe(0);expect(ran).toBe(0);
  });
  it("uses the latest accepted revision in the same desk",async()=>{
    const enqueue=createWriteQueue();let current=fixture("HH-A");
    let release!:()=>void;
    const first=enqueue(async()=>{ await new Promise<void>(resolve=>{release=resolve;}); current=confirmHouseholdFundSettlement(current,{memberId:"MEM-001",amount:"25",destinationAccountId:"ACC-VISA",date:"2026-09-08"}).household; });
    await Promise.resolve();
    const pending=enqueueScopedWrite(enqueue,reviewed,()=>reviewed,async()=>{
      current=confirmHouseholdFundSettlement(current,{memberId:"MEM-001",amount:"25",destinationAccountId:"ACC-VISA",date:"2026-09-08"}).household;
      return current;
    },()=>{throw new Error("Unexpected refusal");});
    release(); await first; await pending;
    expect(current.fundEvents?.filter(event=>event.kind==="settlement-confirmed")).toHaveLength(2);
  });
});
