// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
const stored=vi.hoisted(()=>({draft:null as unknown}));
vi.mock('../src/imports/statementSetup/drafts.ts',async importOriginal=>({...await importOriginal<typeof import('../src/imports/statementSetup/drafts.ts')>(),loadStatementDraft:async()=>stored.draft,saveStatementDraft:vi.fn(async()=>{})}));
import { StatementSetup } from '../src/StatementSetup.tsx';
import { catalogHousehold } from '../src/core/index.ts';
import { emptyStatementDraft, saveStatementDraft } from '../src/imports/statementSetup/drafts.ts';
import { newStatementSource, prepareStatementRows, mergeStatementSource, statementAmountCents } from '../src/imports/statementSetup/intake.ts';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined;let host:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());host?.remove();root=undefined;});
async function setup(){
 const h=catalogHousehold(),scope={environment:h.environment,householdId:h.householdId,memberId:'MEM-001',authUserId:'auth-one',view:'household' as const};
 const account=h.accounts.find(a=>a.active&&a.scope!=='personal')!;
 const source=newStatementSource('a'.repeat(64),'July credit union.pdf','pdf',1);
 source.pages[0]={page:1,status:'scanned',reviewed:true,omissionReason:'',warnings:[]};source.reviewed=true;
 source.checkpoints=[{accountRef:'src',accountLast4:'7654',kind:'opening',date:'2026-06-30',signedBalanceCents:20000,page:1,sourceHash:source.hash}];
 const rows=prepareStatementRows(h,scope,[{id:'row1',sourceKind:'camera',sourceName:source.name,sourceHash:source.hash,provenanceId:'row1',documentKind:'bank-statement',accountRef:'src',accountLast4:'7654',currency:'CAD',date:'2026-07-03',amountCents:1200,signedAmountCents:-1200,suggestedType:'expense',bankType:'debit',note:'Move savings',place:'',fitId:'',extractionConfidence:90}],1);
 rows[0]!.type='transfer';stored.draft=mergeStatementSource(emptyStatementDraft(scope),source,rows);(stored.draft as ReturnType<typeof emptyStatementDraft>).accounts[0]!.accountId=account.id;
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(createElement(StatementSetup,{household:h,memberId:scope.memberId,authUserId:scope.authUserId,view:scope.view,onReviewHistory:vi.fn()})));
 return {account};
}
async function change(element:HTMLInputElement|HTMLSelectElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLInputElement?'input':'change',{bubbles:true}));});}
it('keeps cleared and incomplete decimal text editable, blocks review until valid, and preserves exact cents',async()=>{
 await setup();const amount=host.querySelector('.statement-setup__row input[inputmode="decimal"]') as HTMLInputElement;
 const review=[...host.querySelectorAll('button')].find(button=>button.textContent==='Review account history')!;
 await change(amount,'');expect(amount.value).toBe('');expect(review.disabled).toBe(true);
 await change(amount,'12.');expect(amount.value).toBe('12.');expect(amount.getAttribute('aria-invalid')).toBe('true');expect(review.disabled).toBe(true);
 await change(amount,'12.34');expect(amount.value).toBe('12.34');expect(review.disabled).toBe(false);expect(vi.mocked(saveStatementDraft).mock.calls.at(-1)![0].rows[0]!.amountCents).toBe(1234);
 expect(statementAmountCents('12.34')).toBe(1234);for(const text of ['','12.','-2','0','1.234','1e3'])expect(statementAmountCents(text)).toBeNull();
});
it('identifies original and mapped accounts and offers both transfer directions',async()=>{
 const {account}=await setup();expect(host.querySelector('.statement-setup__checkpoints legend')!.textContent).toContain('July credit union.pdf · account ending 7654');
 expect(host.querySelector('.statement-setup__row header')!.textContent).toContain(`Source account: ${account.name}`);
 const direction=host.querySelector('select[aria-label^="Transfer direction"]') as HTMLSelectElement;
 expect(direction.value).toBe('out');await change(direction,'in');expect(direction.value).toBe('in');expect(vi.mocked(saveStatementDraft).mock.calls.at(-1)![0].rows[0]!.signedAmountCents).toBe(1200);await change(direction,'out');expect(direction.value).toBe('out');
});
