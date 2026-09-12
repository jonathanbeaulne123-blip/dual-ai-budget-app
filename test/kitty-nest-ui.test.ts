// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("../src/kitty/KittyStage.tsx",()=>({KittyStage:({name}: {name:string})=>createElement('div',{'data-stage-name':name})}));
import { KittyBankRoom } from "../src/kitty/KittyBankRoom.tsx";
import { KittyNest } from "../src/kitty/KittyNest.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { financialAuditHash, recordBillPayment, type Household, type CommitResult } from "../src/core/index.ts";
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const buttons=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].filter(row=>row.textContent?.trim()===text || row.getAttribute('aria-label')===text || row.matches('.studio-benches button') && row.querySelector('span')?.textContent===text);
async function click(text:string,last=false){const found=buttons(text);const target=last?found.at(-1):found[0];expect(target,text).toBeTruthy();await act(async()=>target!.click());}
async function fixture(bankId:string){let h=planLifeFixture('household'),calls=0,fail=false;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=()=>root.render(createElement(KittyBankRoom,{household:h,view:'household',memberId:'MEM-001',identity:'nest-ui',initialBankId:bankId==='bill'?`recurrence:${h.recurrences[0]!.id}:2026-09-20`:bankId,onClose:()=>{},onCommand:async(fn:(h:Household)=>CommitResult)=>{calls++;if(fail)return {ok:false,userMessage:'Try again. Your design is still here.'};const result=fn(h);h=result.household;render();return {ok:true,household:h};}}));await act(async()=>render());
 return {get h(){return h;},get calls(){return calls;},set fail(value:boolean){fail=value;},close:async()=>{await act(async()=>root.unmount());host.remove();sessionStorage.clear();}};
}
describe('Nest gallery modes',()=>{
 it('includes each visible bank amount, target and paid status in its accessible name',async()=>{
  let h=planLifeFixture('household');const bill=h.recurrences[0]!;
  h=recordBillPayment(h,{recurrenceId:bill.id,occurrenceDate:bill.nextDate,paymentDate:'2026-09-19',amount:'900',accountId:bill.accountId,createdBy:'MEM-001'}).household;
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{await act(async()=>root.render(createElement(KittyNest,{household:h,memberId:'MEM-001',view:'household',today:'2026-09-21',onSelect:()=>{}})));
   for(const door of host.querySelectorAll('.nest-bank')){
    const name=door.getAttribute('aria-label');expect(name).toContain(door.querySelector('.nest-bank__name')!.textContent);expect(name).toContain(door.querySelector('.nest-bank__amount')!.textContent);
    const detail=door.querySelector('small');if(detail)expect(name).toContain(detail.textContent);
   }
   expect(host.querySelector('.nest-history .nest-bank')?.getAttribute('aria-label')).toContain('Paid');
   expect(host.querySelector<HTMLDetailsElement>('.nest-history')?.open).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();}
 });
 it('builds, keeps and fires the King through its own cosmetic command and completes the optional chapter',async()=>{
  const f=await fixture('king');try{const before=await financialAuditHash(f.h),goals=structuredClone(f.h.goals);expect(document.querySelector('[data-stage-name="Our King"]')).toBeTruthy();expect(document.body.textContent).toContain('Make the bank that holds your whole nest');
   await click('Throw a piece');await click('pear');await click('Keep the clay');expect(f.h.kittyNestDesigns?.[0]?.studio?.draft?.sculpt.body).toBe('pear');expect(f.h.goals).toEqual(goals);
   await click('Kiln');await click('Fire it');expect(f.calls).toBe(1);await click('Fire it',true);expect(f.h.kittyNestDesigns?.[0]?.studio?.fired).toHaveLength(1);await click('Skip');await click('Finish the King chapter');expect(f.h.kittyNestDesigns?.[0]?.setupCompletedAt).toBeTruthy();expect(await financialAuditHash(f.h)).toBe(before);
  }finally{await f.close();}
 });
 it('keeps category editing light and preserves an unsuccessful choice for retry',async()=>{
  const f=await fixture('plan:protect');try{expect(document.querySelector('[data-studio-mode="plan"]')).toBeTruthy();expect(document.querySelector('.studio-benches')).toBeNull();await click('Choose pot & glaze');await click('loaf');await click('midnight glaze');f.fail=true;await click('Save this design');expect(document.body.textContent).toContain('Your design is still here');expect(buttons('loaf')[0]?.getAttribute('aria-pressed')).toBe('true');expect(f.h.kittyNestDesigns??[]).toHaveLength(0);f.fail=false;await click('Save this design');expect(f.h.kittyNestDesigns?.[0]?.studio?.fired[0]?.sculpt.body).toBe('loaf');expect(f.h.kittyNestDesigns?.[0]?.studio?.fired[0]?.paint.base).toBe('#41546b');
  }finally{await f.close();}
 });
 it('opens an automatic bill directly and archives/restores its bank without touching the bill',async()=>{
  const f=await fixture('bill');try{const before=structuredClone(f.h.recurrences);expect(document.querySelector('[data-studio-mode="bill"]')).toBeTruthy();expect(document.querySelector('.studio-benches')).toBeNull();await click('Edit this little bank');await click('Save this design');await click('Archive bank');expect(document.body.textContent).toContain('Restore bank');await click('Restore bank');expect(f.h.recurrences).toEqual(before);}finally{await f.close();}
  const h=planLifeFixture('household');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let selected='';await act(async()=>root.render(createElement(KittyNest,{household:h,memberId:'MEM-001',view:'household',today:'2026-09-12',onSelect:bank=>{selected=bank.id;}})));
  const door=document.querySelector<HTMLButtonElement>(`[data-bank-id="recurrence:${h.recurrences[0]!.id}:2026-09-20"]`)!;expect(door).toBeTruthy();await act(async()=>door.click());expect(selected).toBe(`recurrence:${h.recurrences[0]!.id}:2026-09-20`);await act(async()=>root.unmount());host.remove();
 });
});
