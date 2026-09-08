// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { FundBoard } from "../src/FundBoard.tsx";
import { FundStage } from "../src/FundStage.tsx";
import { LEVEL_PHONE_VIEW, LEVEL_VIEW, levelDrawing, levelX } from "../src/core/levelView.ts";
import { FUND_WIDGETS } from "../src/core/fundRail.ts";
import { FundLedge } from "../src/FundLedge.tsx";
import { fundLedgeReading, ledgeHeights, nearestLedgeDetent } from "../src/core/fundLedge.ts";
import { catalogHousehold, configureHouseholdFund, proposeHouseholdFundContribution, confirmHouseholdFundContribution, fundWalk } from "../src/core/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function fixture() {
  const configured = configureHouseholdFund(catalogHousehold(), {custodianMemberId:"MEM-001",openedOn:"2026-08-01",createdBy:"MEM-001"}).household;
  const proposal = proposeHouseholdFundContribution(configured,{memberId:"MEM-002",contributorMemberId:"MEM-002",amount:"1685",date:"2026-09-08"});
  return confirmHouseholdFundContribution(proposal.household,{memberId:"MEM-001",proposalEventId:proposal.postedIds[0]!}).household;
}
describe("Fund ledge at rest", () => {
  it("cycles the original detents without writing and restores focus on Escape", async () => {
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    const household=fixture(); const before=JSON.stringify(household);
    const host=document.createElement("div");document.body.append(host);const root=createRoot(host);let opens=0,writes=0;
    try {
      await act(async()=>root.render(createElement(FundLedge,{household,today:"2026-09-08",view:"personal",memberId:"MEM-002",busy:false,onOpen:()=>opens++,onKitchen:()=>writes++,onOpenAccount:()=>opens++})));
      const rest=host.querySelector<HTMLButtonElement>('.fund-ledge-grip')!;rest.focus();
      expect(rest.getAttribute("aria-expanded")).toBe("false");
      expect(rest.getAttribute("aria-label")).toContain("Shared money, from Personal");
      expect(host.querySelector('.fund-ledge-figure')?.textContent).toBe("$1,685.00");
      await act(async()=>rest.click());
      expect(document.querySelector('.fund-ledge-sheet')?.getAttribute('data-detent')).toBe('half');
      expect(document.querySelector<HTMLElement>('.fund-ledge-board')?.hidden).toBe(true);
      expect(host.hasAttribute('inert')).toBe(true);
      await act(async()=>document.querySelector<HTMLButtonElement>('.is-sheet-grip')!.click());
      expect(document.querySelector('.fund-ledge-sheet')?.getAttribute('data-detent')).toBe('full');
      expect([...document.querySelectorAll('.fund-board.is-phone [data-fund-widget]')].map(e=>e.getAttribute('data-fund-widget'))).toEqual(['level','contribute','waiting','ask','next-out','streams']);
      await act(async()=>document.querySelector<HTMLButtonElement>('[data-fund-widget="waiting"]')!.click());
      expect(opens).toBe(0);expect(writes).toBe(0);
      await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
      expect(document.querySelector('.fund-ledge-modal')).toBeNull();
      expect(host.hasAttribute('inert')).toBe(false);expect(document.activeElement).toBe(rest);
      expect(JSON.stringify(household)).toBe(before);
    } finally {await act(async()=>root.unmount());host.remove();}
  });
  it("collapses an open sheet on a scope change without carrying a draft or action", async () => {
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let writes=0;
    const props={household:fixture(),today:'2026-09-08',memberId:'MEM-002',busy:false,onOpen:()=>{},onKitchen:()=>writes++,onOpenAccount:()=>{}};
    try {
      await act(async()=>root.render(createElement(FundLedge,{...props,view:'household'})));
      await act(async()=>host.querySelector<HTMLButtonElement>('.fund-ledge-grip')!.click());
      expect(document.querySelector('.fund-ledge-modal')).not.toBeNull();
      await act(async()=>root.render(createElement(FundLedge,{...props,view:'personal'})));
      expect(document.querySelector('.fund-ledge-modal')).toBeNull();expect(writes).toBe(0);
    } finally {await act(async()=>root.unmount());host.remove();}
  });
  it("preserves all sixteen library entries and the same figures on either presentation", async()=>{
    const h=fixture(),before=JSON.stringify(h);let actions=0;
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    try {
      for(const id of FUND_WIDGETS){
        const texts=[];
        for(const presentation of ['phone','desk'] as const){
          await act(async()=>root.render(createElement(FundStage,{widgetId:id,household:h,memberId:'MEM-002',today:'2026-09-08',busy:false,presentation,onKitchen:()=>actions++,onOpenAccount:()=>actions++,onOpenDestination:()=>actions++})));
          texts.push(host.textContent);expect(host.textContent?.length).toBeGreaterThan(0);
        }
        expect(texts[0]).toBe(texts[1]);
      }
      for(const memberId of ['MEM-001','MEM-002'])for(const presentation of ['phone','desk'] as const){
        await act(async()=>root.render(createElement(FundBoard,{household:h,memberId,today:'2026-09-08',presentation,selected:'level',onSelect:()=>actions++})));
        expect(host.querySelectorAll('[role="tab"]')).toHaveLength(presentation==='phone'?6:8);
        expect(host.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
      }
      expect(actions).toBe(0);expect(JSON.stringify(h)).toBe(before);
    } finally {await act(async()=>root.unmount());host.remove();}
  });
  it("redraws the same steps, bands and marks with the whole month on the phone ruler",()=>{
    const walk=fundWalk(fixture(),'2026-09','2026-09-08');
    const before=JSON.stringify(walk),desk=levelDrawing(walk),phone=levelDrawing(walk,LEVEL_PHONE_VIEW);
    expect(levelX('2026-09-01','2026-09',LEVEL_PHONE_VIEW)).toBe(LEVEL_PHONE_VIEW.left);
    expect(levelX('2026-09-30','2026-09',LEVEL_PHONE_VIEW)).toBe(LEVEL_PHONE_VIEW.right);
    expect(phone.actualPath.split(' L ')).toHaveLength(desk.actualPath.split(' L ').length);
    expect(phone.projectedPath.split(' L ')).toHaveLength(desk.projectedPath.split(' L ').length);
    expect(phone.marks.map(m=>m.label)).toEqual(desk.marks.map(m=>m.label));
    expect(phone.presentation).toBe(desk.presentation);
    expect(phone.todayX).toBeLessThan(LEVEL_PHONE_VIEW.width);
    expect(desk.todayX).toBe(levelX(walk.today,walk.monthKey,LEVEL_VIEW));
    expect(JSON.stringify(walk)).toBe(before);
  });
  it("remembers the full stage across remounts and resets on the next civil date",async()=>{
    sessionStorage.clear();Object.defineProperty(window,'innerWidth',{value:390,configurable:true});
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    const props={household:fixture(),memberId:'MEM-002',view:'household' as const,busy:false,onOpen:()=>{},onKitchen:()=>{},onOpenAccount:()=>{}};
    const open=async()=>{await act(async()=>host.querySelector<HTMLButtonElement>('.fund-ledge-grip')!.click());await act(async()=>document.querySelector<HTMLButtonElement>('.is-sheet-grip')!.click());};
    try {
      await act(async()=>root.render(createElement(FundLedge,{...props,today:'2026-09-08'})));await open();
      await act(async()=>document.querySelector<HTMLButtonElement>('[data-fund-widget="waiting"]')!.click());
      await act(async()=>root.render(null));
      await act(async()=>root.render(createElement(FundLedge,{...props,today:'2026-09-08'})));await open();
      expect(document.querySelector('[aria-selected="true"]')?.textContent).toContain('Waiting');
      await act(async()=>root.render(createElement(FundLedge,{...props,today:'2026-09-09'})));await open();
      expect(document.querySelector('[aria-selected="true"]')?.textContent).toContain('Level');
    }finally{await act(async()=>root.unmount());host.remove();sessionStorage.clear();}
  });
  it("uses deterministic nearest detents with no overshoot", () => {
    const heights=ledgeHeights(568,76);
    expect(heights).toEqual({rest:84,half:312,full:492});
    expect(nearestLedgeDetent(-100,heights)).toBe('rest');
    expect(nearestLedgeDetent(310,heights)).toBe('half');
    expect(nearestLedgeDetent(700,heights)).toBe('full');
    expect(ledgeHeights(300,76,140)).toEqual({rest:140,half:165,full:224});
  });
  it("refuses to present an untied walk as a trustworthy balance", () => {
    const walk=fundWalk(fixture(),"2026-09","2026-09-08");
    expect(fundLedgeReading({...walk,tiesToProjection:false})).toEqual({figure:"—",sentence:"The Fund needs review. Open its record.",claimedPercent:0,refused:true});
  });
  it("uses the accepted household and explicitly enters Shared Fund when invoked from Personal", () => {
    const app=readFileSync("src/App.tsx","utf8");
    const mount=app.slice(app.indexOf('<FundLedge'),app.indexOf('<FundLedge')+650);
    expect(mount).toContain('household={household}');
    expect(mount).toContain('view: "household"');
    expect(mount).toContain('onOpen={openFundDestination}');
    const route=app.slice(app.indexOf('const openFundDestination'),app.indexOf('const openWallet'));
    expect(route).toContain('view: "household"');
    expect(route).toContain('"fund-register"');
    expect(route).toContain('goTab("ledger")');
    expect(mount).not.toContain('displayHousehold');
  });
});
