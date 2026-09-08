// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApronCard, useApronReceipt } from "../src/ApronCard.tsx";
import { APRON_WINDOW_MS, apronReceipt } from "../src/core/apronReceipt.ts";
import { phoneFoldOrder, phoneFoldCount } from "../src/core/officePhone.ts";
import { catalogHousehold, configureHouseholdFund, postWorkShift, shapeWorkJob, upsertWorkJob, reversePostedMoney, settleWorkReceivable, householdAsk, type WorkJob, type Household } from "../src/core/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NOW=Date.parse('2026-09-08T03:00:00Z');
function job(): WorkJob {
  return shapeWorkJob({
    id: "",
    memberId: "MEM-002",
    name: "Café Nola",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: true,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [
        { id: "RATE-OLD", effectiveDate: "2026-01-01", grossHourlyRateCents: 1800, takeHomeMode: "direct", takeHomeHourlyRateCents: 1500, deductions: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "RATE-NEW", effectiveDate: "2026-09-01", grossHourlyRateCents: 2000, takeHomeMode: "deductions", takeHomeHourlyRateCents: 0, deductions: [{ id: "TAX", label: "Tax", percent: 20 }], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [
      { id: "BAR", label: "Bar", basis: "total-sales", value: 1, roundingCents: 500, roundingMode: "up", timing: "immediate", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "FLOOR", label: "Floor", basis: "card-tips", value: 2, roundingCents: 1, roundingMode: "nearest", timing: "withheld", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    salesFields: [{ id: "FOOD", label: "Food", requirement: "required", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: "ACC-CASH", cardTipsDepositAccountId: "ACC-CASH" },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
}

function fixture(negativeCard = false) {
  vi.setSystemTime(NOW);
  const j=job();
  if (negativeCard) Object.assign(j.tipOutRules[1]!, { basis: "total-sales", value: 15 });
  j.tipOutRules.push({...j.tipOutRules[0]!,id:'DEFER',label:'Deferred',timing:'deferred',value:1,roundingCents:1});
  const configured=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-08-01',createdBy:'MEM-001'}).household;
  const saved=upsertWorkJob(configured,{job:j}).household;
  return postWorkShift(saved,{date:'2026-08-31',memberId:'MEM-002',jobId:saved.workJobs[0]!.id,roleId:'ROLE-SERVER',workedHours:4,paidBreakHours:0,salesByField:{FOOD:1000},cashTips:50,cardTips:100,customersServed:40,staffingCount:4,eventTag:'regular',createdBy:'MEM-002',confirmDuplicate:true}).household;
}
afterEach(()=>vi.useRealTimers());
describe('accepted apron receipt',()=>{
  it('keeps all three tip-out timings and historical cash/card facts after a payout',()=>{
    vi.useFakeTimers();const h=fixture(),before=JSON.stringify(h),shift=h.shifts.at(-1)!;
    const receipt=apronReceipt(h,'MEM-002',NOW)!;
    expect(receipt).toMatchObject({date:'2026-08-31',cashCents:5000,cardCents:9800,tipOutCents:2200,timing:{immediateCents:1000,withheldCents:200,deferredCents:1000}});
    const html=renderToStaticMarkup(createElement(ApronCard,{receipt,household:h,today:'2026-09-08'}));
    expect(html).toContain('At posting: cash received; card owed after withholding.');expect(html).toContain('Current Shared Ask');expect(html).not.toMatch(/fell|before.*Ask|Post the shift/);
    expect(JSON.stringify(h)).toBe(before);
    const paid=settleWorkReceivable(h,{jobId:shift.jobId!,kind:'card-tips',date:'2026-09-08',amount:98,accountId:'ACC-CASH',createdBy:'MEM-002'}).household;
    expect(apronReceipt(paid,'MEM-002',NOW)).toEqual(receipt);
    expect(householdAsk(paid,'2026-09-08').askCents).toBe(householdAsk(h,'2026-09-08').askCents);
  });
  it('preserves signed card-after-withholding and deferred tip-out from a real accepted shift',()=>{
    vi.useFakeTimers();const h=fixture(true),receipt=apronReceipt(h,'MEM-002',NOW)!;
    expect(receipt).toMatchObject({cardCents:-5000,tipOutCents:17000,timing:{immediateCents:1000,withheldCents:15000,deferredCents:1000}});
    const html=renderToStaticMarkup(createElement(ApronCard,{receipt,household:h,today:'2026-09-08'}));
    expect(html).toContain('withholding exceeded card tips');expect(html).not.toContain('timing was not recorded');
  });
  it('never selects a partner, custodian, inactive seat, or reversed shift',()=>{
    vi.useFakeTimers();const h=fixture(),own=h.shifts.at(-1)!;
    h.shifts.push({...own,id:'PARTNER',memberId:'MEM-001',cashTipsCents:99999999,createdAt:new Date(NOW+1).toISOString()});
    expect(apronReceipt(h,'MEM-002',NOW+2)?.shiftId).toBe(own.id);
    expect(apronReceipt(h,'MEM-001',NOW+2)).toBeNull();expect(apronReceipt(h,'UNKNOWN',NOW)).toBeNull();
    const inactive={...h,members:h.members.map(m=>m.id==='MEM-002'?{...m,active:false}:m)};
    expect(apronReceipt(inactive,'MEM-002',NOW)).toBeNull();
    const reversed=reversePostedMoney(h,own.transactionIds![0]!,{createdBy:'MEM-002'}).household;
    expect(apronReceipt(reversed,'MEM-002',NOW+2)).toBeNull();
  });
  it('expires exactly six hours after Confirm, without renewal by edits or backdated work dates',()=>{
    vi.useFakeTimers();const h=fixture(),shift=h.shifts.at(-1)!;
    expect(apronReceipt(h,'MEM-002',NOW)?.date).toBe('2026-08-31');
    shift.updatedAt=new Date(NOW+APRON_WINDOW_MS).toISOString();
    expect(apronReceipt(h,'MEM-002',NOW+APRON_WINDOW_MS-1)).not.toBeNull();
    expect(apronReceipt(h,'MEM-002',NOW+APRON_WINDOW_MS)).toBeNull();
    expect(apronReceipt(h,'MEM-002',NOW-1)).toBeNull();
    shift.createdAt='invalid';expect(apronReceipt(h,'MEM-002',NOW)).toBeNull();
  });
  it('does not infer received or owed timing for legacy receipts',()=>{
    vi.useFakeTimers();const h=fixture();delete h.shifts.at(-1)!.jobId;
    const receipt=apronReceipt(h,'MEM-002',NOW)!;expect(receipt.timing).toBeNull();expect(receipt.cardCents).toBe(10000);
    const html=renderToStaticMarkup(createElement(ApronCard,{receipt,household:h,today:'2026-09-08'}));
    expect(html).toContain('receipt timing was not recorded');expect(html).not.toContain('cash received');
  });
  it('occupies exactly one top fold slot while retaining urgent objects next',()=>{
    const items=phoneFoldOrder({stories:['wallet'],ownShift:true,health:true,overdue:true,needs:false,apron:true});
    expect(items.slice(0,4).map(x=>x.id)).toEqual(['apron','timesheet','lamp','mail']);
    expect(items[0]).toEqual({id:'apron',wide:true,slots:1});expect(phoneFoldCount(items)).toBe(4);
  });
  it('expires while mounted, wakes from suspension, and clears immediately on member scope change',async()=>{
    vi.useFakeTimers();const h=fixture(),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    function Mounted({household,memberId}:{household:Household;memberId:string}){const r=useApronReceipt(household,memberId);return r?createElement(ApronCard,{receipt:r,household,today:'2026-09-08'}):null;}
    const render=(memberId='MEM-002')=>act(async()=>root.render(createElement(Mounted,{household:h,memberId})));
    try {
      await render();expect(host.querySelector('.apron-card')).not.toBeNull();
      await render('MEM-001');expect(host.querySelector('.apron-card')).toBeNull();
      await render();await act(async()=>vi.advanceTimersByTime(APRON_WINDOW_MS));expect(host.querySelector('.apron-card')).toBeNull();
      await act(async()=>root.unmount());const root2=createRoot(host);
      vi.setSystemTime(NOW);await act(async()=>root2.render(createElement(Mounted,{household:h,memberId:'MEM-002'})));
      expect(host.querySelector('.apron-card')).not.toBeNull();
      vi.setSystemTime(NOW+APRON_WINDOW_MS+1);await act(async()=>window.dispatchEvent(new Event('pageshow')));
      expect(host.querySelector('.apron-card')).toBeNull();await act(async()=>root2.unmount());
    }finally{host.remove();}
  });
});
