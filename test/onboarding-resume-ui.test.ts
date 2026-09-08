// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { HerculesPresence } from "../src/Hercules.tsx";
import { saveReturnMessage, clearReturnMessage } from "../src/core/onboarding/returnMessage.ts";
import { throughSittingOne } from "./fixtures/onboardingReturnHousehold.ts";
it("resumes through the exact chapter room handler, refuses a replaced bookmark, and retires a foreign identity", async () => {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.stubGlobal('innerWidth',390);
  vi.stubGlobal('matchMedia',vi.fn((query:string)=>({matches:query.includes('max-width'),addEventListener(){},removeEventListener(){}})));
  const h=throughSittingOne(),onOpenAccounts=vi.fn(),onGo=vi.fn(),onLedger=vi.fn();
  const record={environment:h.environment,householdId:h.householdId,memberId:'MEM-001',chapterId:'ch-04-accounts',tab:'ledger' as const,setAt:'2026-09-08T17:00:00Z'};
  saveReturnMessage(record);
  const host=document.createElement('div');host.className='app';document.body.append(host);const root=createRoot(host);
  const props={household:h,today:'2026-09-08',tab:'home' as const,adding:false,memberId:'MEM-001',view:'household' as const,onOpenAdd:vi.fn(),onGo,onLedger,onOpenSource:vi.fn(),onOpenAccounts};
  try{
    await act(async()=>root.render(createElement(HerculesPresence,props)));
    const resume=host.querySelector('.onboarding-resume') as HTMLButtonElement;
    expect(resume?.textContent).toBe('Resume');
    const before=JSON.stringify(h);
    await act(async()=>resume.click());expect(onOpenAccounts).toHaveBeenCalledOnce();expect(onGo).not.toHaveBeenCalled();expect(onLedger).not.toHaveBeenCalled();expect(JSON.stringify(h)).toBe(before);
    await act(async()=>resume.click());expect(onOpenAccounts).toHaveBeenCalledTimes(2);
    saveReturnMessage({...record,setAt:'2026-09-08T17:01:00Z'});
    await act(async()=>resume.click());expect(onOpenAccounts).toHaveBeenCalledTimes(2);
    await act(async()=>root.render(createElement(HerculesPresence,{...props,memberId:'MEM-002'})));
    expect(host.querySelector('.onboarding-resume')).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();clearReturnMessage(h.environment,h.householdId,'MEM-001');vi.unstubAllGlobals();}
});
