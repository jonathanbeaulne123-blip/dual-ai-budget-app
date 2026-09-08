import { assertAcceptableBooks, type IncrementalBooksGuard } from '../core/booksValidation.ts';
import type { Household } from '../core/types.ts';
import type { BooksStatus } from '../ledger/engine.ts';

/**
 * Validate canonical scoped books before publishing readiness. SQLite is the
 * durable authority; browser SQL is not an additional commit acknowledgement.
 * Scoped incremental indexes retain the full guard for every unproven shape.
 */
export function validatedLedgerBooksStatus(household: Household, guard?: IncrementalBooksGuard): BooksStatus {
  const compiled = guard ? guard.validate(household) : assertAcceptableBooks(household);
  return { ok: true, engine: 'ledger-sync-v2', entryCount: compiled.entries.length,
    inBalance: true, equationHolds: true };
}
