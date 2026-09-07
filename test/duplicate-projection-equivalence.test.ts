import { expect, it } from 'vitest';
import { catalogHousehold, postEntry } from '../src/core/index.ts';
import { refreshDuplicateFlags, scoreSimilarity } from '../src/core/duplicate.ts';
import type { Transaction } from '../src/core/types.ts';

// The pre-change algorithm is deliberately retained as an independent oracle.
function original(transactions: Transaction[]) {
  const flags = transactions.map(() => false);
  for (let i = 0; i < transactions.length; i++) for (let j = i + 1; j < transactions.length; j++) {
    const a = transactions[i]!, b = transactions[j]!;
    if (scoreSimilarity(a,b) || scoreSimilarity(b,a)) { flags[i] = true; flags[j] = true; }
  }
  return transactions.map((row,i) => ({...row,potentialDuplicate: flags[i]}));
}
it('matches the original duplicate projection across 500 generated row sets', () => {
  const seed = postEntry(catalogHousehold(), {date:'2026-09-07',type:'expense',amount:'1.00',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true}).household.transactions[0]!;
  let state = 7719;
  const random = (max: number) => {state = (Math.imul(state,1664525)+1013904223) >>> 0; return state % max;};
  const notes = ['', 'Milk at store', 'milk', '  MILK  ', 'fuel', 'the and', 'coffee café', 'unrelated'];
  for (let trial = 0; trial < 500; trial++) {
    const rows = Array.from({length: 25}, (_, i) => ({...seed,id:`row-${i}`,date:`2026-09-${String(1+random(28)).padStart(2,'0')}`,amountCents:100+random(3),note:notes[random(notes.length)]!,place:notes[random(notes.length)]!,subcategoryId:random(2)?'SUB-FOOD-GROCERIES':null,sourceId:random(2)?'same-source':undefined,potentialDuplicate:Boolean(random(2))}));
    expect(refreshDuplicateFlags(rows)).toEqual(original(rows));
  }
});
