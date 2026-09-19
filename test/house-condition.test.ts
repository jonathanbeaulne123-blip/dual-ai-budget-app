import { describe, expect, it } from 'vitest';
import { deriveHouseCondition, houseConditionFromDays } from '../src/core/houseCondition.ts';
import { financialAuditHash, postEntry, recordHouseholdFundReconciliation, HOUSEHOLD_FUND_ID } from '../src/core/index.ts';
import { fundedHousehold, ALEX, TODAY } from './fixtures/fund-model.ts';

describe('living house presentation over accepted shared facts', () => {
  it('requires sustained deficits and returns to settled when the recorded shortage is covered', () => {
    const read = (days: number, certain = true) => houseConditionFromDays({ certain, growing: false, deficitsNewestFirst: Array.from({length:days}, () => true) });
    expect(read(6).state).toBe('settled'); expect(read(7).state).toBe('wilting'); expect(read(30).state).toBe('weathered');
    expect(read(30, false).state).toBe('checking');
    expect(houseConditionFromDays({ certain:true, growing:false, deficitsNewestFirst:[false,...Array(30).fill(true)] }).state).toBe('settled');
  });
  it('uses dated recorded purchases rather than future promises or expected income', async () => {
    let h = fundedHousehold('1000');
    h = postEntry(h, { type:'expense', date:'2026-09-02', amount:'1100', accountId:'ACC-VISA', subcategoryId:'SUB-FOOD-GROCERIES', createdBy:ALEX, visibility:'household', funding:{ fundId:HOUSEHOLD_FUND_ID, fundedCents:110000, destinationAccountId:'ACC-VISA' } }).household;
    h = recordHouseholdFundReconciliation(h, { memberId:ALEX, date:TODAY, bankTotal:'1000', personalRemainder:'0', note:'Fictional reconciled balance' }).household;
    const before = await financialAuditHash(h);
    const input = { memberId:ALEX, today:TODAY, freshness:'current' as const };
    expect(deriveHouseCondition(h, input).state).toBe('wilting');
    expect(deriveHouseCondition(h, { ...input, freshness:'offline' }).state).toBe('checking');
    expect(deriveHouseCondition(h, { ...input, backingAvailable:false }).state).toBe('checking');
    expect(await financialAuditHash(h)).toBe(before);
  });
});
