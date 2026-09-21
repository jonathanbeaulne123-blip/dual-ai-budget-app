import { describe, expect, it } from 'vitest';
import { ledgerScaleFixture } from './fixtures/ledger-scale.ts';
import { assertAcceptableBooks, assertHouseholdFundIntegrity, financialAuditHash, splitForSync } from '../src/core/index.ts';
import { validatedLedgerBooksStatus } from '../src/ledgerSync/validatedBooks.ts';
import { runHealthCheck } from '../src/core/health.ts';
import { accountRows } from '../src/core/accountsWidget.ts';

/**
 * Absolute budgets at the 5,056-row fixture. This file already measured these
 * numbers and asserted none of them, so a 10x regression could land unnoticed.
 *
 * They are set roughly 6x above what the work actually takes on a warm
 * container, which is deliberate: CI here runs the PGlite suites in a serial
 * lane beside a TypeScript pass that has twice consumed ~8 minutes under
 * contention (docs/worksessions/2026-09-03-fund-next-out-consequence.md:81),
 * and a flaky budget gets deleted rather than fixed. They are ceilings that
 * catch an order-of-magnitude mistake — reintroducing a quadratic scan, or
 * losing a cache — not fine-grained performance gates. Scale-invariant cache
 * behaviour is asserted by ratio below, which no machine speed can flake.
 */
const BUDGET_MS = {
  construct: 5_000,
  guard: 1_500,
  hash: 1_500,
  project: 1_500,
  health: 1_500,
} as const;

/**
 * Every command uploads this many bytes of UNCOMPRESSED shared snapshot
 * (src/ledger/snapshotPayload.ts:151 returns plain JSON so migration 006's
 * `payload_is_shared` check can read the body). At the 5,056-row fixture it is
 * ~2.98 MB. This ceiling is not a performance budget so much as a tripwire: if
 * it fires, the ledger has grown to the point where the full-snapshot upload
 * needs to become a compressed or delta payload.
 */
const SHARED_PAYLOAD_CEILING_BYTES = 4_000_000;

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

    // The measurements above are now budgeted rather than only logged.
    expect({ stage: 'construct', ms: constructMs < BUDGET_MS.construct }).toEqual({ stage: 'construct', ms: true });
    expect({ stage: 'guard', ms: guardMs < BUDGET_MS.guard }).toEqual({ stage: 'guard', ms: true });
    expect({ stage: 'hash', ms: hashMs < BUDGET_MS.hash }).toEqual({ stage: 'hash', ms: true });
    expect({ stage: 'project', ms: projectMs < BUDGET_MS.project }).toEqual({ stage: 'project', ms: true });
    expect(new TextEncoder().encode(JSON.stringify(shared)).length).toBeLessThan(SHARED_PAYLOAD_CEILING_BYTES);
  });
  it('keeps the integrity scan off a quadratic curve', () => {
    // runHealthCheck sits inside the `experience` memo, so it runs on every
    // snapshot change. It indexes its collections once; the transfer-pair check
    // used to scan the whole transaction list per transfer row, which is the
    // regression this budget exists to catch.
    const household = ledgerScaleFixture();
    runHealthCheck(household);
    const started = performance.now();
    runHealthCheck(household);
    const healthMs = performance.now() - started;
    console.log(JSON.stringify({ fixture: 'seed-row-clone', rows: household.transactions.length, healthMs }));
    expect(healthMs).toBeLessThan(BUDGET_MS.health);
  }, 120_000);

  it('compiles the ledger once per snapshot, not once per account', () => {
    // accountRows calls two balance readers per account, and each reader used
    // to build its own compileHousehold and throw it away — so the whole ledger
    // was compiled up to 2A times per call. The reader is memoised per snapshot
    // OBJECT now, which makes this a ratio test: whatever the machine speed,
    // the calls after the first must not be paying to recompile.
    const household = ledgerScaleFixture();
    const memberId = household.members[0]!.id;
    const today = '2026-09-20' as never;

    const coldAt = performance.now();
    const rows = accountRows(household, memberId, today);
    const coldMs = performance.now() - coldAt;

    const warmAt = performance.now();
    for (let i = 0; i < 8; i++) accountRows(household, memberId, today);
    const warmMs = (performance.now() - warmAt) / 8;

    console.log(JSON.stringify({ accounts: rows.length, coldMs, warmMs }));
    expect(rows.length).toBeGreaterThan(0);
    // Eight further calls must together cost less than the first one did.
    expect(warmMs * 8).toBeLessThan(coldMs);
    // And a warm call must be a small fraction of a cold one.
    expect(warmMs).toBeLessThan(coldMs / 4);
  }, 120_000);

  it('retains the full guard refusal before canonical readiness', () => {
    const h = ledgerScaleFixture(1);
    h.transactions[0]!.amountCents = 1.5;
    let expected: unknown;
    try { assertAcceptableBooks(h); } catch(error) { expected = error; }
    expect(expected).toBeDefined();
    expect(() => validatedLedgerBooksStatus(h)).toThrow((expected as Error).message);
  });
});
