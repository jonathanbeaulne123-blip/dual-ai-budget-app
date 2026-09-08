// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { LedgerPage } from "../src/Ledger.tsx";
import { catalogHousehold, postEntry } from "../src/core/index.ts";
it("opens the existing amount, refreshes provenance with accepted data, closes to exact focus and never writes", async () => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  const h=postEntry(catalogHousehold(),{date:'2026-09-08',type:'expense',amount:'12.34',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',visibility:'household'}).household;
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const forbidden=()=>{throw Error('read must not write')};
  const props={household:h,writeHousehold:h,memberId:'MEM-001',view:'household' as const,sourceFocus:null,onClearSource:forbidden,onChange:forbidden,onRemove:forbidden};
  try{
    await act(async()=>root.render(createElement(LedgerPage,props)));
    const amount=host.querySelector('.ledger-source-amount') as HTMLButtonElement;amount.focus();
    await act(async()=>amount.click());
    expect(host.querySelector('.reading-receipt')?.textContent).toContain(`Shared · Books revision ${h.revision}`);
    expect(host.querySelector('.reading-receipt')?.textContent).toContain('2026-09-08');
    expect(host.querySelector('.reading-receipt')?.textContent).not.toContain('$12.34');
    await act(async()=>root.render(createElement(LedgerPage,{...props,writeHousehold:{...h,revision:h.revision+1,transactions:[]}})));
    expect(host.querySelector('.reading-receipt')?.textContent).toContain('unavailable');
    await act(async()=>(host.querySelector('.reading-receipt button') as HTMLButtonElement).click());
    expect(host.querySelector('.reading-receipt')).toBeNull();expect(document.activeElement).toBe(amount);
    await act(async()=>amount.click());
    await act(async()=>root.render(createElement(LedgerPage,{...props,view:'personal'})));
    expect(host.querySelector('.reading-receipt')).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();}
});
