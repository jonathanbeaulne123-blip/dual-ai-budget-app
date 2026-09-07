import { describe, expect, it } from 'vitest';
import { ledgerScaleFixture } from './fixtures/ledger-scale.ts';
import { assertAcceptableBooks, assertHouseholdFundIntegrity, financialAuditHash, splitForSync } from '../src/core/index.ts';
import { validatedLedgerBooksStatus } from '../src/ledgerSync/validatedBooks.ts';

describe('commission scale fixture and canonical readiness', () => {
  it('constructs at least 5000 distinct valid transactions without a posting loop', async () => {
    const start = performance.now();
    const household = ledgerScaleFixture();
    const constructMs = performance.now() - start;
    const guardAt = performance.now();
    const compiled = assertAcceptableBooks(household);
    assertHouseholdFundIntegrity(household);
    const guardMs = performance.now() - guardAt;
    const hashAt = performance.now();
    await financialAuditHash(household);
    const hashMs = performance.now() - hashAt;
    const projectAt = performance.now();
    const shared = splitForSync(household, 'MEM-001').shared;
    const projectMs = performance.now() - projectAt;
    console.log(JSON.stringify({fixture: 'seed-row-clone', rows: household.transactions.length, constructMs, guardMs, hashMs, projectMs, sharedBytes: new TextEncoder().encode(JSON.stringify(shared)).length}));
    expect(household.transactions.length).toBeGreaterThanOrEqual(5000);
    expect(new Set(household.transactions.map(row => row.id)).size).toBe(household.transactions.length);
    expect(validatedLedgerBooksStatus(household)).toMatchObject({ok: true, engine: 'ledger-sync-v2', entryCount: compiled.entries.length});
  });
  it('retains the full guard refusal before canonical readiness', () => {
    const h = ledgerScaleFixture(1);
    h.transactions[0]!.amountCents = 1.5;
    let expected: unknown;
    try { assertAcceptableBooks(h); } catch(error) { expected = error; }
    expect(expected).toBeDefined();
    expect(() => validatedLedgerBooksStatus(h)).toThrow((expected as Error).message);
  });
});
