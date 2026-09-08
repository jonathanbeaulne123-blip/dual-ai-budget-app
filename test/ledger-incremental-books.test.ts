import { expect, it } from 'vitest';
import { catalogHousehold, postEntry, seedDemoHousehold } from '../src/core/index.ts';
import { IncrementalBooksGuard, assertAcceptableBooks } from '../src/core/booksValidation.ts';
import { trialBalance, booksEquation } from '../src/core/journal.ts';
import { classifyCommandError } from '../src/core/commandOutcome.ts';
import { ledgerScaleFixture } from './fixtures/ledger-scale.ts';
const observe = (fn: () => ReturnType<typeof assertAcceptableBooks>) => {
  try { const books = fn(); return { ok: true, entries: books.entries, trial: trialBalance(books), equation: booksEquation(books) }; }
  catch (e) { return { ok: false, constructor: (e as Error).constructor.name, errorClass: classifyCommandError(e).errorClass, message: (e as Error).message }; }
};
it('matches full verdict, error class and exact books on 640 generated commands/corruptions', () => {
  const base = seedDemoHousehold({today:'2026-08-21'});
  let successes=0, failures=0, incremental=0;
  for (let i=0; i<640; i++) {
    const guard = new IncrementalBooksGuard(); guard.validate(base);
    const candidate = postEntry(base, {type:'expense', date:'2026-09-07', accountId:'ACC-VISA', subcategoryId:'SUB-FOOD-GROCERIES', amount:((i+101)/100).toFixed(2), note:`differential-${i}`, createdBy:'MEM-001', confirmDuplicate:true}).household;
    const row = candidate.transactions.at(-1)!;
    if (i>=320 && i<480) {
      switch(i%8) {
        case 0: row.splits[0]!.amountCents++; break;
        case 1: row.amountCents=1.5; break;
        case 2: row.amountCents=Infinity; break;
        case 3: row.amountCents=Number.MAX_SAFE_INTEGER+1; break;
        case 4: row.accountId='missing'; break;
        case 5: row.subcategoryId='missing'; break;
        case 6: row.splits[0]!.amountCents=Number.MAX_SAFE_INTEGER;row.amountCents=Number.MAX_SAFE_INTEGER;break;
        case 7: row.amountCents=NaN;break;
      }
    } else if(i>=480) {
      switch(i%8) {
        case 0: candidate.transactions[10]!.splits[0]!.amountCents++;break;
        case 1: candidate.transactions.splice(10,1);break;
        case 2: row.id=candidate.transactions[0]!.id;break;
        case 3: candidate.accounts[0]!.kind='credit';break;
        case 4: candidate.categories.splice(0,4);break;
        case 5: candidate.transactions[10]!.isDuplicate=true;break;
        case 6: row.reversalOfId=candidate.transactions[10]!.id;break;
        case 7: row.type='transfer';row.transferFromAccountId='ACC-VISA';row.transferToAccountId='missing';break;
      }
    }
    const expected=observe(()=>assertAcceptableBooks(candidate));
    expect(observe(()=>guard.validate(candidate)), `case ${i}`).toEqual(expected);
    if(expected.ok) successes++;else failures++;
    incremental+=guard.metrics.incremental;
  }
  expect(successes).toBeGreaterThanOrEqual(320);expect(failures).toBeGreaterThan(150);expect(incremental).toBeGreaterThanOrEqual(320);
},30000);
it('detects mutation of the original object and does not trust a mutated returned journal',()=>{
  const h=seedDemoHousehold({today:"2026-08-21"}), guard=new IncrementalBooksGuard();
  const result=guard.validate(h);expect(result.entries.length).toBeGreaterThan(0);result.entries[0]!.lines[0]!.debitCents++;
  const changed=postEntry(h,{type:'expense',date:'2026-09-07',amount:'1.01',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true}).household;
  expect(observe(()=>guard.validate(changed))).toEqual(observe(()=>assertAcceptableBooks(changed)));
  changed.transactions.at(-1)!.amountCents++;
  expect(observe(()=>guard.validate(changed))).toEqual(observe(()=>assertAcceptableBooks(changed)));
});
it('validates a 5056-row append by compiling only the new document',()=>{
  const h=ledgerScaleFixture();const guard=new IncrementalBooksGuard();guard.validate(h);
  const candidate=postEntry(h,{type:'expense',date:'2026-09-07',amount:'2.31',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true,note:'scale append'}).household;
  const start=performance.now();const actual=observe(()=>guard.validate(candidate));const elapsed=performance.now()-start;
  expect(actual).toEqual(observe(()=>assertAcceptableBooks(candidate)));
  expect(guard.metrics.incremental).toBe(1);expect(guard.metrics.compiledRows).toBe(5057);
  console.info(JSON.stringify({scenario:'5056 incremental append including result projection',elapsedMs:elapsed,metrics:guard.metrics}));
},30000);

it('distinguishes null from nonfinite corruption and preserves consecutive cache chains',()=>{
  let h=postEntry(catalogHousehold(),{type:'expense',date:'2026-09-07',amount:'1.01',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true}).household;
  (h.transactions[0] as any).amountCents=null;h.transactions[0]!.splits=[];
  const guard=new IncrementalBooksGuard();guard.validate(h);h.transactions[0]!.amountCents=NaN;
  expect(observe(()=>guard.validate(h))).toEqual(observe(()=>assertAcceptableBooks(h)));
  h=seedDemoHousehold({today:'2026-08-21'});guard.validate(h);
  for(let i=0;i<20;i++){
    h=postEntry(h,{type:'expense',date:'2026-09-07',amount:'1.01',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true,note:`chain-${i}`}).household;
    expect(observe(()=>guard.validate(h))).toEqual(observe(()=>assertAcceptableBooks(h)));
  }
  expect(guard.metrics.incremental).toBe(20);
});

it('keeps tentative indexes isolated and compiles Shared insertions before existing Personal rows',()=>{
  const h=seedDemoHousehold({today:'2026-08-21'}),guard=new IncrementalBooksGuard();guard.validate(h);
  const candidate=postEntry(h,{type:'expense',date:'2026-09-07',amount:'1.01',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true}).household;
  guard.fork().validate(candidate);expect(guard.metrics.incremental).toBe(0);
  const row=candidate.transactions.pop()!;candidate.transactions.splice(5,0,{...row,id:'TXN-server-canonical'});
  expect(observe(()=>guard.validate(candidate))).toEqual(observe(()=>assertAcceptableBooks(candidate)));
  expect(guard.metrics.incremental).toBe(1);expect(guard.metrics.compiledRows).toBe(h.transactions.length+1);
});
