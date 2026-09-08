// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { RecoverableWorkShiftFlow } from "../src/RecoverableWorkShiftFlow.tsx";
import { WorkShiftFlow, type WorkShiftDraft } from "../src/WorkShiftFlow.tsx";
import { countDraftKey, newCountDraft, readCountDraft, saveCountDraft, clearAcceptedCountDraft } from "../src/workCountDraft.ts";
import { catalogHousehold, shapeWorkJob, upsertWorkJob, postWorkShiftWithAttendanceReview, type Household } from "../src/core/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function household(householdId: string, memberId: string): Household {
  const base = { ...catalogHousehold("development"), householdId };
  const job = shapeWorkJob({
    id: "JOB-SHARED",
    memberId,
    name: "Harbour",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: false,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [{
        id: "RATE-1",
        effectiveDate: "2026-01-01",
        grossHourlyRateCents: 1800,
        takeHomeMode: "direct",
        takeHomeHourlyRateCents: 1500,
        deductions: [],
        createdAt: "",
        updatedAt: "",
      }],
      createdAt: "",
      updatedAt: "",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: false,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [],
    salesFields: [],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "personal",
      cashTipsVisibility: "personal",
      cardTipsVisibility: "personal",
      tipOutVisibility: "personal",
      wagesDepositAccountId: "ACC-CHEQUING",
      cashTipsAccountId: "ACC-CASH",
      cardTipsDepositAccountId: "ACC-CASH",
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
  return upsertWorkJob(base, { job }).household;
}

let root: Root, host: HTMLDivElement;
const key=countDraftKey({environment:"development",householdId:"HH-COUNT",memberId:"MEM-002"});
let h:Household;
const draft=():WorkShiftDraft=>({date:"2026-09-08",jobId:h.workJobs[0]!.id,roleId:"ROLE-SERVER",workedHours:6.02,paidBreakHours:0,cashTips:12.34,cardTips:100,customersServed:40,staffingCount:2,eventTag:"regular",note:"Fictional source retained",startedAt:"2026-09-08T15:00:00.000Z",endedAt:"2026-09-08T21:01:00.000Z"});
const baseProps=()=>({household:h,memberId:"MEM-002",fundCustodianMemberId:"MEM-001",today:"2026-09-08",punch:null,busy:false});
const button=(name:string)=>Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(b=>b.textContent===name)!;
function render(extra:Partial<Parameters<typeof RecoverableWorkShiftFlow>[0]>={}){act(()=>root.render(createElement(RecoverableWorkShiftFlow,{...baseProps(),initialDraft:draft(),onConfirm:vi.fn(),...extra})));}
function remount(extra:Partial<Parameters<typeof RecoverableWorkShiftFlow>[0]>={}){act(()=>root.unmount());root=createRoot(host);render(extra);}
function review(){act(()=>button("Next").click());act(()=>button("Next").click());expect(button("Confirm shift")).toBeTruthy();}

beforeEach(()=>{sessionStorage.clear();h=household("HH-COUNT","MEM-002");Object.defineProperty(window,"innerWidth",{value:390,configurable:true});host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});

describe("Count recovery and exact submission",()=>{
 it("restores complete figures and source after the source prop and component are gone",()=>{
   render();const first=readCountDraft(sessionStorage,key)!;
   expect(first.form!.hoursDigits).toBe("602");expect(first.form!.paidBreakDigits).toBe("0");expect(first.form!.money).toMatchObject({cashTips:"1234",cardTips:"10000"});
   const form={...first.form!,note:"Private edited note",cashVisibility:"both" as const,cashAccountId:"ACC-CHEQUING",surpriseHelpers:["Fictional Helper"],attendance:{"COW-1":"user-confirmed-absent" as const},step:2};
   act(()=>root.unmount());saveCountDraft(sessionStorage,key,first,form);root=createRoot(host);render({initialDraft:null});
   expect(readCountDraft(sessionStorage,key)!.form).toEqual(form);
   expect(readCountDraft(sessionStorage,key)!.source.initialDraft?.startedAt).toBe(draft().startedAt);
   expect(host.textContent).toContain("Check destinations");
 });
 it("preserves blank versus explicit zero on recovery",()=>{
   render({initialDraft:{...draft(),cashTips:undefined,cardTips:0}});remount({initialDraft:null});
   expect(readCountDraft(sessionStorage,key)!.form!.money).toMatchObject({cashTips:"",cardTips:"0"});
   expect(host.textContent).toContain("Not entered");
 });
 it("freezes a submitted command through remount, retries the same identity, and retires every copy after a late ACK",async()=>{
   const onConfirm=vi.fn();render({onConfirm});review();act(()=>button("Confirm shift").click());
   const [posted,attendance,callbacks]=onConfirm.mock.calls[0]!;
   expect(posted).toMatchObject({workedHours:"6.02",cashTips:"12.34",cardTips:"100.00",note:"Fictional source retained"});expect(attendance).toMatchObject({surpriseHelpers:[]});
   expect(readCountDraft(sessionStorage,key)!.submission!.confirmationId).toBe(posted.confirmationId);
   remount({initialDraft:null,onConfirm});expect(host.querySelector("fieldset")?.disabled).toBe(true);
   await act(async()=>button("Retry Confirm").click());expect(onConfirm.mock.calls[1]!.slice(0,2)).toEqual([posted,attendance]);
   act(()=>callbacks.onAccepted());expect(host.textContent).toContain("Shift accepted.");expect(host.querySelector(".work-shift-flow")).toBeNull();expect(readCountDraft(sessionStorage,key)).toBeNull();
   remount({onConfirm});expect(host.textContent).toContain("Shift accepted.");expect(onConfirm).toHaveBeenCalledTimes(2);
 });
 it("recovers acceptance from an existing authoritative receipt after reload without posting again",async()=>{
   const onConfirm=vi.fn();render({onConfirm});review();act(()=>button("Confirm shift").click());const id=onConfirm.mock.calls[0]![0].confirmationId;
   remount({initialDraft:null,onConfirm,readSubmissionStatus:async received=>received===id?"accepted":"missing"});
   await act(async()=>{});
   expect(host.textContent).toContain("Shift accepted.");expect(onConfirm).toHaveBeenCalledTimes(1);expect(readCountDraft(sessionStorage,key)).toBeNull();
 });
 it("retains figures after rejected Confirm and unlocks review",()=>{
   const onConfirm=vi.fn();render({onConfirm});review();act(()=>button("Confirm shift").click());
   act(()=>onConfirm.mock.calls[0]![2].onRejected());expect(readCountDraft(sessionStorage,key)!.submission).toBeUndefined();expect(host.querySelector("fieldset")?.disabled).toBe(false);expect(readCountDraft(sessionStorage,key)!.form!.money.cashTips).toBe("1234");
 });
 it("broadcasts a definitive rejection after remount and prevents an old editor from overwriting a submission",()=>{
   const onConfirm=vi.fn();render({onConfirm});review();const old=readCountDraft(sessionStorage,key)!;act(()=>button("Confirm shift").click());
   expect(()=>saveCountDraft(sessionStorage,key,old,{...old.form!,note:"Stale edit"})).toThrow(/another open form/);
   remount({initialDraft:null,onConfirm});act(()=>onConfirm.mock.calls[0]![2].onRejected());
   expect(host.querySelector("fieldset")?.disabled).toBe(false);expect(readCountDraft(sessionStorage,key)!.form!.money.cashTips).toBe("1234");
 });
 it("keeps uncertain transport outcomes frozen without recomputing or posting the command",async()=>{
   const onConfirm=vi.fn();render({onConfirm});review();act(()=>button("Confirm shift").click());const original=readCountDraft(sessionStorage,key)!.submission;
   remount({initialDraft:null,onConfirm,readSubmissionStatus:async()=>{throw new Error("DISCONNECTED");}});
   await act(async()=>button("Retry Confirm").click());expect(onConfirm).toHaveBeenCalledTimes(1);expect(readCountDraft(sessionStorage,key)!.submission).toEqual(original);expect(host.querySelector("fieldset")?.disabled).toBe(true);
 });
 it("does not clear a later revision, overwrite another form, or resurrect a retired ID",()=>{
   render();const first=readCountDraft(sessionStorage,key)!;const changed=saveCountDraft(sessionStorage,key,first,{...first.form!,note:"Newer edit"});
   expect(()=>saveCountDraft(sessionStorage,key,first,{...first.form!,note:"Stale edit"})).toThrow(/another open form/);
   expect(clearAcceptedCountDraft(sessionStorage,{key,id:first.id,revision:first.revision})).toBe(false);
   expect(clearAcceptedCountDraft(sessionStorage,{key,id:changed.id,revision:changed.revision})).toBe(true);
   expect(()=>saveCountDraft(sessionStorage,key,changed,changed.form!)).toThrow(/another open form/);
   const otherKey=countDraftKey({environment:"development",householdId:"HH-OTHER",memberId:"MEM-002"});
   const other=newCountDraft(first.source);saveCountDraft(sessionStorage,otherKey,other,first.form!);expect(readCountDraft(sessionStorage,otherKey)!.form).toEqual(first.form);
 });
 it("retains saved money until a changed source is explicitly adopted",()=>{
   render();const saved=readCountDraft(sessionStorage,key)!;render({initialDraft:{...draft(),workedHours:7,cashTips:undefined}});
   expect(host.textContent).toContain("The source changed");expect(readCountDraft(sessionStorage,key)!.form).toEqual(saved.form);
   act(()=>button("Use new source").click());expect(readCountDraft(sessionStorage,key)!.form!.hoursDigits).toBe("700");expect(readCountDraft(sessionStorage,key)!.form!.money.cashTips).toBe("");
 });
 it("refuses stale source replacement after another form submits",()=>{
   render();const old=readCountDraft(sessionStorage,key)!;
   const newer={...old,revision:old.revision+1,submission:{confirmationId:"other-submission",input:{memberId:"MEM-002",confirmationId:"other-submission"}}};sessionStorage.setItem(key,JSON.stringify(newer));
   render({initialDraft:{...draft(),workedHours:7}});act(()=>button("Use new source").click());
   expect(readCountDraft(sessionStorage,key)).toEqual(newer);expect(host.textContent).toContain("another open form");
 });
 it("requires current rules review after restored job settings change, keeping entered money",()=>{
   render();review();h={...h,workJobs:h.workJobs.map(job=>({...job,roles:job.roles.map(role=>({...role,rates:role.rates.map(rate=>({...rate,grossHourlyRateCents:2500}))}))}))};
   const onConfirm=vi.fn();remount({initialDraft:null,onConfirm});act(()=>button("Confirm shift").click());expect(onConfirm).not.toHaveBeenCalled();expect(host.textContent).toContain("The job rules or attendance changed");expect(readCountDraft(sessionStorage,key)!.form!.money.cashTips).toBe("1234");
 });
 it("includes paid-break income exactly once in the Count and accepted wages",()=>{
   let accepted:Household|undefined;render({initialDraft:{...draft(),paidBreakHours:1},onConfirm:(posted,attendance)=>{accepted=postWorkShiftWithAttendanceReview(h,posted,attendance).household;}});
   expect(host.querySelector(".count-total")?.textContent).toBe("$217.64");review();act(()=>button("Confirm shift").click());
   expect(accepted!.shifts[0]!.wagesCents).toBe(10530);expect(accepted!.shifts[0]!.paidBreakIncomeCents).toBe(1500);
 });
 it("hands the real posting command the reviewed cents and attendance only at Confirm",()=>{
   const before=JSON.stringify(h);let accepted:Household|undefined;
   render({onConfirm:(posted,attendance,callbacks)=>{accepted=postWorkShiftWithAttendanceReview(h,posted,attendance).household;callbacks?.onAccepted();}});
   review();expect(JSON.stringify(h)).toBe(before);act(()=>button("Confirm shift").click());expect(accepted!.shifts).toHaveLength(1);expect(accepted!.shifts[0]).toMatchObject({cashTipsCents:1234,ccTipsCents:10000,hours:6.02});
 });
 for(const [member,custodian,phone,tipped,shown] of [["MEM-002","MEM-001",true,true,true],["MEM-002","MEM-002",true,true,false],["MEM-002",undefined,true,true,false],["MEM-002","MEM-001",false,true,false],["MEM-002","MEM-001",true,false,false]] as const)it(`Count eligibility ${custodian}/${phone}/${tipped}`,()=>{
   Object.defineProperty(window,"innerWidth",{value:phone?390:1100,configurable:true});h={...h,workJobs:h.workJobs.map(job=>({...job,roles:job.roles.map(role=>({...role,tipped}))}))};
   act(()=>root.render(createElement(WorkShiftFlow,{...baseProps(),memberId:member,fundCustodianMemberId:custodian,initialDraft:draft(),onConfirm:vi.fn()})));
   expect(Boolean(host.querySelector(".shift-count"))).toBe(shown);
 });
});
