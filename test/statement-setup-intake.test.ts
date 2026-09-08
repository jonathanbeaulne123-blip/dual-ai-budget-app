import { describe, expect, it, vi } from 'vitest';
import { catalogHousehold, postEntry } from '../src/core/index.ts';
import { emptyStatementDraft, statementScopeKey, validateStoredStatementDraft } from '../src/imports/statementSetup/drafts.ts';
import { assertStatementPdfLimits, selectedStatementPages } from '../src/imports/statementSetup/pdf.ts';
import { mergeStatementSource, newStatementSource, parseStatementExport, prepareStatementRows, scanStatementPages, statementFileHash, statementHistoryInput, verifyStatementAttachment } from '../src/imports/statementSetup/intake.ts';
import { statementSetupSuggestions } from '../src/imports/statementSetup/suggestions.ts';
import type { StatementDraftScope } from '../src/imports/statementSetup/types.ts';
import type { VisionDocumentResult } from '../src/core/importInbox/types.ts';
import { readFileSync } from 'node:fs';

const scope: StatementDraftScope = { environment: 'development', householdId: 'HH-TEST', memberId: 'MEM-001', authUserId: 'auth-one', view: 'household' };
const h = { ...catalogHousehold(), householdId: scope.householdId };
const hash = 'a'.repeat(64);
function vision(page = 1): VisionDocumentResult {
  return { documentKind: 'bank-statement', currency: 'CAD', accountLast4: '1234', rows: [{ date: '2026-07-03', amountCents: 1200, direction: 'debit', typeHint: 'expense', merchant: 'Unknown shop', description: 'Payment', reference: '', confidence: 95 }], warnings: [], statement: { periodStart: '2026-07-01', periodEnd: '2026-07-31', openingDate: page === 1 ? '2026-06-30' : null, openingBalanceCents: page === 1 ? 3000 : null, closingDate: page === 2 ? '2026-07-31' : null, closingBalanceCents: page === 2 ? 600 : null, complete: true, omittedRows: 0 } };
}

describe('statement file evidence and PDF boundaries', () => {
  it('refuses empty, oversized and over-page-limit PDFs instead of truncating', () => {
    expect(() => assertStatementPdfLimits(0)).toThrow(/empty/);
    expect(() => assertStatementPdfLimits(20*1024*1024+1)).toThrow(/20 MB/);
    expect(() => assertStatementPdfLimits(100,51)).toThrow(/1–50/);
    expect(() => assertStatementPdfLimits(20*1024*1024,50)).not.toThrow();
    expect(selectedStatementPages('3, 1-2, 2',5)).toEqual([1,2,3]);
    expect(() => selectedStatementPages('1-7',5)).toThrow(/between/);
    expect(() => selectedStatementPages('1,garbage',5)).toThrow(/page numbers/);
  });
  it('requires the exact original bytes on reattachment', async () => {
    const file = new File(['original'], 'statement.pdf');
    const digest = await statementFileHash(file);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    await expect(verifyStatementAttachment(new File(['original'], 'renamed.pdf'),digest)).resolves.toBeUndefined();
    await expect(verifyStatementAttachment(new File(['changed'], 'statement.pdf'),digest)).rejects.toThrow(/different file/);
  });
  it('scans every selected page sequentially and keeps identical rows on different pages distinguishable', async () => {
    let active = 0, maximum = 0, page = 0;
    const scan = vi.fn(async () => { active += 1; maximum = Math.max(active,maximum); await Promise.resolve(); active -= 1; return { result: vision(++page), sourceHash: 'compressed-hash' }; });
    const pdf = { pageCount: 3, renderPage: vi.fn(async (number: number) => new File(['p'+number], 'page.jpg', {type:'image/jpeg'})), close: vi.fn() };
    const result = await scanStatementPages({ file:new File(['pdf'],'source.pdf'),source:newStatementSource(hash,'source.pdf','pdf',3),selectedPages:[1,2], household:h, scope, pdf, scan });
    expect(maximum).toBe(1); expect(scan).toHaveBeenCalledTimes(2);
    expect(result.rows).toHaveLength(2); expect(new Set(result.rows.map(row=>row.sourceIdentity)).size).toBe(2);
    expect(result.source.pages.map(p=>p.status)).toEqual(['scanned','scanned','omitted']);
    expect(result.source.pages.every(p=>!p.reviewed)).toBe(true);
    expect(result.source.checkpoints).toHaveLength(4);
  });
  it('keeps failure and incomplete extraction visible; no partial source can bypass review', async () => {
    let n=0;
    const scan = vi.fn(async () => { if (++n===2) throw new Error('Page unreadable'); const result=vision(); result.statement!.complete=false;result.statement!.omittedRows=2;return {result,sourceHash:hash}; });
    const pdf = {pageCount:2,renderPage:async()=>new File(['p'],'p.jpg'),close:async()=>{}};
    const result=await scanStatementPages({file:new File(['p'],'p.pdf'),source:newStatementSource(hash,'p.pdf','pdf',2),selectedPages:[1,2],household:h,scope,pdf,scan});
    expect(result.source.pages[0]!.warnings.join(' ')).toContain('2 known omitted');
    expect(result.source.pages[1]!.status).toBe('failed');
    const draft=mergeStatementSource(emptyStatementDraft(scope),result.source,result.rows);
    expect(()=>statementHistoryInput(draft)).toThrow(/Review every source/);
  });
  it('cancellation stops before starting another page', async () => {
    const controller=new AbortController();
    const scan=vi.fn(async()=>{controller.abort();return {result:vision(),sourceHash:hash};});
    await expect(scanStatementPages({file:new File(['p'],'p.pdf'),source:newStatementSource(hash,'p.pdf','pdf',2),selectedPages:[1,2],household:h,scope,signal:controller.signal,scan})).rejects.toThrow();
    expect(scan).toHaveBeenCalledTimes(1);
  });
  it('local export parsing preserves OFX transaction identity but does not retain full account references', async () => {
    const file=new File([readFileSync('test/fixtures/batch-import-demo.ofx')],'statement.ofx');
    const result=await parseStatementExport(file,h,scope);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every(row=>row.accountRef.startsWith('account:')&&row.sourceHash===result.source.hash)).toBe(true);
    const again=await parseStatementExport(file,h,scope);
    expect(again.rows.map(row=>row.sourceIdentity)).toEqual(result.rows.map(row=>row.sourceIdentity));
    const changed=await parseStatementExport(new File([readFileSync('test/fixtures/batch-import-demo.ofx'),'\n'],'next.ofx'),h,scope);
    expect(changed.rows[0]!.accountRef).not.toBe(result.rows[0]!.accountRef);
    expect(changed.rows.filter(row=>row.fitId).map(row=>row.sourceIdentity)).toEqual(result.rows.filter(row=>row.fitId).map(row=>row.sourceIdentity));
  });
});

describe('owner-scoped normalized drafts and cautious suggestions', () => {
  it('refuses another identity, household, environment or view when restoring a draft', () => {
    const draft=emptyStatementDraft(scope);
    expect(validateStoredStatementDraft(draft,scope)).toEqual(draft);
    for(const other of [{authUserId:'other'},{memberId:'other'},{householdId:'other'},{environment:'production' as const},{view:'personal' as const}]) expect(validateStoredStatementDraft(draft,{...scope,...other})).toBeNull();
    expect(()=>statementScopeKey({...scope,authUserId:''})).toThrow(/Sign in/);
  });
  it('never supplies the first active category for an unknown merchant', async () => {
    const rows=(await scanStatementPages({file:new File(['p'],'p.jpg'),source:newStatementSource(hash,'p.jpg','image',1),selectedPages:[1],household:h,scope,scan:async()=>({result:vision(),sourceHash:hash})})).rows;
    expect(rows[0]!.subcategoryId).toBe('');
    expect(prepareStatementRows(h,scope,rows,1)[0]!.subcategoryId).toBe('');
  });
  it('requires actual accepted full-month coverage; a statement draft alone does not manufacture estimates', () => {
    const draft=emptyStatementDraft(scope);
    const report=statementSetupSuggestions({household:h,scope,draft,today:'2026-09-08'});
    expect(report.suggestions.filter(s=>s.kind==='estimate')).toEqual([]);
    expect(report.estimateStatus).toContain('Not enough accepted history');
  });
  it('uses only the latest three complete calendar months and excludes the partial current month', () => {
    const account=h.accounts.find(a=>a.active&&a.scope!=='personal')!;
    const category=h.categories.find(c=>c.active&&c.recordType==='category'&&c.transactionType==='expense')!;
    let household=h;
    for(const date of ['2026-05-03','2026-06-03','2026-07-03','2026-08-03','2026-09-03']) household=postEntry(household,{date,amount:30,type:'expense',accountId:account.id,subcategoryId:category.id,note:'test',createdBy:scope.memberId,visibility:'household',confirmDuplicate:true}).household;
    const report=statementSetupSuggestions({household,scope,draft:emptyStatementDraft(scope),today:'2026-09-08',acceptedCoverage:household.accounts.filter(a=>a.active&&a.scope!=='personal'&&a.kind!=='investment').map(a=>({accountId:a.id,from:'2026-05-01',through:'2026-09-08',sourceIds:['accepted']}))});
    const estimate=report.suggestions.find(s=>s.kind==='estimate')!;
    expect(estimate.amountCents).toBe(3000);expect(estimate.sampleSize).toBe(3);
    expect(estimate.reason).toContain('2026-06, 2026-07, 2026-08');expect(estimate.sourceIds).toHaveLength(3);
  });
});

it('does not treat one covered account or older covered months as whole-ledger recent history',()=>{
 const draft=emptyStatementDraft(scope),accounts=h.accounts.filter(a=>a.active&&a.scope!=='personal'&&a.kind!=='investment');
 const partial=statementSetupSuggestions({household:h,scope,draft,today:'2026-09-08',acceptedCoverage:[{accountId:accounts[0]!.id,from:'2026-06-01',through:'2026-08-31',sourceIds:['a']}]});
 if(accounts.length>1)expect(partial.estimateStatus).toContain('Not enough');
 const older=statementSetupSuggestions({household:h,scope,draft,today:'2026-09-08',acceptedCoverage:accounts.map(a=>({accountId:a.id,from:'2026-01-01',through:'2026-03-31',sourceIds:['a']}))});
 expect(older.estimateStatus).toContain('Not enough');
});
it('source merging fills a later-page closing checkpoint without mutating the prior draft',()=>{
 const first=newStatementSource(hash,'s.pdf','pdf',2);first.checkpoints=[{accountRef:'a',accountLast4:'1234',kind:'opening',date:'2026-06-30',signedBalanceCents:20000,page:1,sourceHash:hash}];
 const draft=mergeStatementSource(emptyStatementDraft(scope),first,[]),before=JSON.stringify(draft);
 const later=structuredClone(first);later.checkpoints.push({accountRef:'a',accountLast4:'1234',kind:'closing',date:'2026-07-31',signedBalanceCents:0,page:2,sourceHash:hash});
 const merged=mergeStatementSource(draft,later,[]);expect(merged.accounts[0]!.closingBalance).toBe('0.00');expect(JSON.stringify(draft)).toBe(before);
});

it('preserves two reviewed transfer source identities as one posting and keeps account coverage separate', async()=>{
 const scanned=await scanStatementPages({file:new File(['p'],'p.jpg'),source:newStatementSource(hash,'p.jpg','image',1),selectedPages:[1],household:h,scope,scan:async()=>({result:vision(),sourceHash:hash})});
 const source=scanned.source;source.reviewed=true;source.pages.forEach(page=>page.reviewed=true);
 source.checkpoints=[{accountRef:'out',accountLast4:'1111',kind:'opening',date:'2026-06-30',signedBalanceCents:2000,page:1,sourceHash:hash,periodStart:'2026-07-01',periodEnd:'2026-07-31'}, {accountRef:'in',accountLast4:'2222',kind:'closing',date:'2026-07-31',signedBalanceCents:2000,page:1,sourceHash:hash,periodStart:'2026-07-15',periodEnd:'2026-07-31'}];
 const draft=emptyStatementDraft(scope);draft.sources=[source];
 draft.accounts=[{accountRef:'out',accountId:'A',openingDate:'2026-06-30',openingBalance:'20',closingDate:'2026-07-31',closingBalance:'8'},{accountRef:'in',accountId:'B',openingDate:'2026-07-14',openingBalance:'8',closingDate:'2026-07-31',closingBalance:'20'}];
 const base=scanned.rows[0]!;
 draft.rows=[{...base,id:'out',sourceIdentity:'out-id',accountRef:'out',type:'transfer',signedAmountCents:-1200,transferAccountId:'B',transferPairRowId:'in'}, {...base,id:'in',sourceIdentity:'in-id',accountRef:'in',type:'transfer',signedAmountCents:1200,transferAccountId:'A',transferPairRowId:'out'}];
 const input=statementHistoryInput(draft);
 expect(input.rows).toHaveLength(1);expect(input.rows[0]!.transferSources?.map(row=>row.sourceIdentity)).toEqual(['out-id','in-id']);
 expect(input.accounts[0]!.coverage).toEqual([{start:'2026-07-01',end:'2026-07-31'}]);
 expect(input.accounts[1]!.coverage).toEqual([{start:'2026-07-15',end:'2026-07-31'}]);
 draft.rows[1]!.signedAmountCents=-1200;expect(()=>statementHistoryInput(draft)).toThrow(/opposite legs/);
});
