// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FundLedge } from "../src/FundLedge.tsx";
import { PhoneSpread } from "../src/PhoneSpread.tsx";
import { PHONE_CHAPTERS, ownPhoneTipSpark } from "../src/core/phoneSpread.ts";
import { catalogHousehold, configureHouseholdFund, seedDemoHousehold, reversePostedMoney, workShiftIsReversed, addGoal, addRecurrence } from "../src/core/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const fixture=()=>configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-08-01',createdBy:'MEM-001'}).household;
describe('Claude chapter spread',()=>{
  it('keeps the original page order and privacy-safe tip source',()=>{
    expect(PHONE_CHAPTERS.in.pages).toEqual(['streams','paydays','members','tips']);
    expect(PHONE_CHAPTERS.out.pages).toEqual(['shape','next-out','week','categories']);
    expect(PHONE_CHAPTERS.leftover.pages).toEqual(['ask','shelf','deferral']);
    const h=seedDemoHousehold({environment:'development',today:'2026-09-08'});
    expect(h.shifts.length).toBeGreaterThan(0);
    h.shifts=[{...h.shifts[0]!,memberId:'MEM-002',date:'2026-09-08',netTipsCents:12345},{...h.shifts[0]!,memberId:'MEM-001',date:'2026-09-08',netTipsCents:98765}];
    const own=ownPhoneTipSpark(h,'MEM-002','2026-09-08');
    expect(own?.reduce((sum,row)=>sum+row.cents,0)).toBe(12345);
    const poisoned={...h,shifts:h.shifts.map(s=>s.memberId==='MEM-001'?{...s,netTipsCents:999999999,hours:999999}:s)};
    expect(ownPhoneTipSpark(poisoned,'MEM-002','2026-09-08')).toEqual(own);
    expect(ownPhoneTipSpark(fixture(),'MEM-001','2026-09-08')).toBeNull();
    expect(ownPhoneTipSpark(h,'UNKNOWN','2026-09-08')).toBeNull();
  });
  it('excludes a real reversed posted shift retained in the audit trail',()=>{
    let h=seedDemoHousehold({environment:'development',today:'2026-09-08'});
    const shift=h.shifts.filter(row=>row.memberId==='MEM-002' && row.date>='2026-08-12').at(-1)!;expect(shift).toBeDefined();
    h={...h,shifts:[shift]};
    expect(ownPhoneTipSpark(h,'MEM-002','2026-09-08')?.length).toBeGreaterThan(0);
    const reversed=reversePostedMoney(h,shift.transactionIds?.[0] ?? shift.tipsTransactionId,{createdBy:'MEM-002'}).household;
    expect(reversed.shifts).toHaveLength(1);expect(workShiftIsReversed(reversed,shift)).toBe(true);
    expect(ownPhoneTipSpark(reversed,'MEM-002','2026-09-08')).toEqual([]);
  });
  it('keeps an inner Ask cancellation inside the chapter and drops its draft on page change',async()=>{
    const goal=addGoal(fixture(),{name:'Fictional trip',target:'300',shared:true,ownerMemberId:'MEM-001'});
    const h=addRecurrence(goal.household,{cadence:'monthly',nextDate:'2026-09-30',type:'transfer',amount:'300',accountId:'ACC-CHEQUING',transferToAccountId:'ACC-GOALS',goalId:goal.postedIds[0]!,note:'Fictional goal claim'}).household;
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let closes=0,writes=0;
    try{
      await act(async()=>root.render(createElement(PhoneSpread,{chapter:'leftover',household:h,memberId:'MEM-002',view:'personal',today:'2026-09-08',busy:false,onClose:()=>closes++,onKitchen:()=>writes++,onOpen:()=>{}})));
      const raise=host.querySelector<HTMLButtonElement>('[data-ask-raise]')!;expect(raise).not.toBeNull();
      await act(async()=>raise.click());expect(host.querySelector('[data-ask-confirm]')).not.toBeNull();
      await act(async()=>host.querySelector('[data-ask-confirm-move]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
      expect(closes).toBe(0);expect(host.querySelector('[data-ask-confirm]')).toBeNull();
      await act(async()=>raise.click());
      await act(async()=>host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!.click());
      await act(async()=>host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0]!.click());
      expect(host.querySelector('[data-ask-confirm]')).toBeNull();expect(writes).toBe(0);
      Object.defineProperty(window,'innerWidth',{value:390,configurable:true});
      await act(async()=>root.render(createElement(FundLedge,{household:h,memberId:'MEM-002',view:'personal',today:'2026-09-08',busy:false,onKitchen:()=>writes++,onOpen:()=>{},onOpenAccount:()=>{}})));
      await act(async()=>host.querySelector<HTMLButtonElement>('.fund-ledge-grip')!.click());
      await act(async()=>document.querySelector<HTMLButtonElement>('[data-ask-raise]')!.click());
      await act(async()=>document.querySelector('[data-ask-confirm-move]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
      expect(document.querySelector('[data-ask-confirm]')).toBeNull();
      expect(document.querySelector('.fund-ledge-modal')).not.toBeNull();expect(writes).toBe(0);
    }finally{await act(async()=>root.unmount());host.remove();}
  });
  it('navigates all pages with real index buttons without writing or adding rails',async()=>{
    const h=fixture(),before=JSON.stringify(h),host=document.createElement('div');document.body.append(host);const root=createRoot(host);let writes=0,opens=0;
    try {
      for(const chapter of ['in','out','leftover'] as const){
        await act(async()=>root.render(createElement(PhoneSpread,{chapter,household:h,memberId:'MEM-002',view:'personal',today:'2026-09-08',busy:false,onClose:()=>{},onKitchen:()=>writes++,onOpen:()=>opens++})));
        const tabs=[...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];expect(tabs).toHaveLength(PHONE_CHAPTERS[chapter].pages.length);
        for(const tab of tabs){await act(async()=>tab.click());expect(host.querySelector('[role="tabpanel"]')?.textContent?.length).toBeGreaterThan(0);expect(host.querySelector('input[type="range"],[role="slider"],.fund-board')).toBeNull();}
      }
      expect(writes).toBe(0);expect(opens).toBe(0);expect(JSON.stringify(h)).toBe(before);
    }finally{await act(async()=>root.unmount());host.remove();}
  });
  it('resets a page on scope change and preserves custodian refusal',async()=>{
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const h=fixture();
    const props={chapter:'leftover' as const,household:h,memberId:'MEM-002',view:'personal' as const,today:'2026-09-08',busy:false,onClose:()=>{},onKitchen:()=>{},onOpen:()=>{}};
    try {
      await act(async()=>root.render(createElement(PhoneSpread,props)));
      await act(async()=>host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2]!.click());
      await act(async()=>root.render(createElement(PhoneSpread,{...props,memberId:'MEM-001',view:'household'})));
      expect(host.querySelector('[aria-selected="true"]')?.getAttribute('aria-label')).toContain('1 of 3');
      expect(host.textContent).toContain('not available on this desk');
      expect(host.textContent).not.toContain('hours');
    }finally{await act(async()=>root.unmount());host.remove();}
  });
  it('keeps full accepted books separate from the active-view household passed to existing widgets',()=>{
    const office=readFileSync('src/Office.tsx','utf8');
    expect(office).toContain('household={household} booksHousehold={booksHousehold} view={view} onOpenFundDestination={onOpenFundDestination} dashboard={dashboard}');
    const phone=readFileSync('src/OfficePhone.tsx','utf8');
    expect(phone).toContain('chapter={chapter} household={booksHousehold}');
    expect(phone).toContain('<TimesheetGlance household={household}');
  });
});
