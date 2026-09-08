import { describe, expect, it } from "vitest";
import { abandonOpenShift, catalogHousehold, clockInShift, clockOutShift, chooseOpenShiftTimeline, endShiftBreak, startShiftBreak } from "../src/core/index.ts";
import { openShiftReview, runReviewedOpenShift, runReviewedShiftChoice, runReviewedShiftDiscard } from "../src/openShiftReview.ts";
import { createWriteQueue } from "../src/core/writeQueue.ts";
import { enqueueScopedWrite, type WriteScope } from "../src/core/scopedWrite.ts";
const member="MEM-002";
const fixture=()=>clockInShift(catalogHousehold(),{memberId:member}).household;
describe("reviewed Punch timeline",()=>{
  it("starts and ends a reviewed break then clocks out to confirming without posting money",()=>{
    let h=fixture();const tx=JSON.stringify(h.transactions),shifts=JSON.stringify(h.shifts);
    h=runReviewedOpenShift(h,member,openShiftReview(h,member),current=>startShiftBreak(current,{memberId:member,kind:"paid"})).household;
    h=runReviewedOpenShift(h,member,openShiftReview(h,member),current=>endShiftBreak(current,{memberId:member})).household;
    const result=runReviewedOpenShift(h,member,openShiftReview(h,member),current=>clockOutShift(current,{memberId:member}));
    expect(result.postedIds).toEqual([]);expect(result.household.kitchen.openShifts[0]!.status).toBe("confirming");
    expect(JSON.stringify(result.household.transactions)).toBe(tx);expect(JSON.stringify(result.household.shifts)).toBe(shifts);
  });
  it("refuses End break when another break has replaced the reviewed one",()=>{
    const before=startShiftBreak(fixture(),{memberId:member,kind:"paid"}).household,review=openShiftReview(before,member);
    const next=startShiftBreak(endShiftBreak(before,{memberId:member}).household,{memberId:member,kind:"unpaid"}).household;
    expect(()=>runReviewedOpenShift(next,member,review,h=>endShiftBreak(h,{memberId:member}))).toThrow(/timeline changed/);
    expect(next.kitchen.openShifts[0]!.breaks.at(-1)!.endedAt).toBeNull();
  });
  it("refuses a replaced shift or a newly arrived conflict, including conflict already in the reading",()=>{
    const before=fixture(),review=openShiftReview(before,member);
    const next=clockInShift(abandonOpenShift(before,{memberId:member}).household,{memberId:member}).household;
    const conflict={...before,kitchen:{...before.kitchen,openShifts:[...before.kitchen.openShifts,{...before.kitchen.openShifts[0]!,id:"other-device"}]}};
    for(const [h,r] of [[next,review],[conflict,review],[conflict,openShiftReview(conflict,member)]] as const) expect(()=>runReviewedOpenShift(h,member,r,current=>clockOutShift(current,{memberId:member}))).toThrow(/timeline changed/);
  });
  it("allows explicit discard while confirming, but refuses a replaced confirming timeline",()=>{
    const h=clockOutShift(fixture(),{memberId:member}).household,review=openShiftReview(h,member);
    expect(()=>runReviewedOpenShift(h,member,review,current=>current)).toThrow();
    const result=runReviewedShiftDiscard(h,member,review,current=>abandonOpenShift(current,{memberId:member}));
    expect(result.household.kitchen.openShifts[0]!.status).toBe("cleared");expect(result.postedIds).toEqual([]);
    const replaced=clockInShift(result.household,{memberId:member}).household;
    expect(()=>runReviewedShiftDiscard(replaced,member,review,current=>abandonOpenShift(current,{memberId:member}))).toThrow(/timeline changed/);
  });
  it("requires the complete reviewed conflict set before choosing a device timeline",()=>{
    const h=fixture(),row=h.kitchen.openShifts[0]!;
    const two={...h,kitchen:{...h.kitchen,openShifts:[row,{...row,id:"device-two"}]}};
    const review=openShiftReview(two,member),three={...two,kitchen:{...two.kitchen,openShifts:[...two.kitchen.openShifts,{...row,id:"device-three"}]}};
    expect(()=>runReviewedShiftChoice(three,member,review,row.id,current=>chooseOpenShiftTimeline(current,{memberId:member,keepId:row.id}))).toThrow(/timelines changed/);
    expect(()=>runReviewedShiftChoice(two,member,review,"missing",current=>current)).toThrow();
    const chosen=runReviewedShiftChoice(two,member,review,row.id,current=>chooseOpenShiftTimeline(current,{memberId:member,keepId:row.id}));
    expect(chosen.postedIds).toEqual([]);expect(chosen.household.kitchen.openShifts.filter(r=>r.status!=="cleared")).toHaveLength(1);
  });
  it("preserves unrelated accepted changes but refuses queued room changes",async()=>{
    let h=fixture();const review=openShiftReview(h,member);h={...h,revision:h.revision+1};expect(()=>runReviewedOpenShift(h,member,review,current=>clockOutShift(current,{memberId:member}))).not.toThrow();
    const scope:WriteScope={generation:1,environment:h.environment,householdId:h.householdId,memberId:member,view:"household"};let current={...scope},calls=0;
    const queue=createWriteQueue();let release!:()=>void;const first=queue(()=>new Promise<void>(r=>release=r));await Promise.resolve();
    const pending=enqueueScopedWrite(queue,scope,()=>current,async()=>{calls++;return runReviewedOpenShift(h,member,review,value=>clockOutShift(value,{memberId:member}));},()=>{});
    current={...scope,view:"personal",generation:2};release();await first;expect(await pending).toBeNull();expect(calls).toBe(0);
  });
});
