import { assertAcceptableBooks } from '../core/commandRuntime.ts';
import type { Household } from '../core/types.ts';
import type { BooksStatus } from '../ledger/engine.ts';

/**
 * Validate canonical scoped books before publishing readiness. SQLite is the
 * durable authority; browser SQL is not an additional commit acknowledgement.
 * This deliberately retains the full guard until incremental equivalence is proven.
 */
export function validatedLedgerBooksStatus(household: Household): BooksStatus {
  const compiled = assertAcceptableBooks(household);
  return { ok: true, engine: 'ledger-sync-v2', entryCount: compiled.entries.length,
    inBalance: true, equationHolds: true };
}
