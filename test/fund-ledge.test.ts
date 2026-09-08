// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { FundLedge } from "../src/FundLedge.tsx";
import { fundLedgeReading } from "../src/core/fundLedge.ts";
import { catalogHousehold, configureHouseholdFund, proposeHouseholdFundContribution, confirmHouseholdFundContribution, fundWalk } from "../src/core/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function fixture() {
  const configured = configureHouseholdFund(catalogHousehold(), {custodianMemberId:"MEM-001",openedOn:"2026-08-01",createdBy:"MEM-001"}).household;
  const proposal = proposeHouseholdFundContribution(configured,{memberId:"MEM-002",contributorMemberId:"MEM-002",amount:"1685",date:"2026-09-08"});
  return confirmHouseholdFundContribution(proposal.household,{memberId:"MEM-001",proposalEventId:proposal.postedIds[0]!}).household;
}
describe("Fund ledge at rest", () => {
  it("reads the accepted Fund unchanged in either room; opening is one explicit action", async () => {
    const household=fixture(); const before=JSON.stringify(household);
    const host=document.createElement("div");document.body.append(host);const root=createRoot(host);let opens=0;
    try {
      for (const view of ["household","personal"] as const) {
        await act(async()=>root.render(createElement(FundLedge,{household,today:"2026-09-08",view,onOpen:()=>opens++})));
        const button=host.querySelector("button")!;
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(button.getAttribute("aria-label")).toContain("Shared money");
        expect(host.querySelector('.fund-ledge-figure')?.textContent).toBe("$1,685.00");
        expect(host.textContent).toContain(view==="personal"?"from Personal":"Shared");
        expect(opens).toBe(view==="personal"?1:0);
        await act(async()=>button.click());
      }
      expect(opens).toBe(2);expect(JSON.stringify(household)).toBe(before);
    } finally {await act(async()=>root.unmount());host.remove();}
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
    expect(mount).toContain('setBooksPaneRequest("fund-register")');
    expect(mount).toContain('goTab("ledger")');
    expect(mount).not.toContain('displayHousehold');
  });
});
