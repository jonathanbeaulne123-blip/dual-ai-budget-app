import { booksEquation, compileHousehold, trialBalance, type CompiledBooks } from "./journal.ts";
import { BooksRejectedError } from "./commandOutcome.ts";
import type { Household } from "./types.ts";

export function assertAcceptableBooks(household: Household, compiled = compileHousehold(household)): CompiledBooks {
  for (const entry of compiled.entries) {
    const debit = entry.lines.reduce((sum, line) => sum + line.debitCents, 0);
    const credit = entry.lines.reduce((sum, line) => sum + line.creditCents, 0);
    if (debit !== credit) {
      throw new BooksRejectedError(
        `Journal ${entry.id} is unbalanced (${debit} debit / ${credit} credit). Nothing was posted.`,
        "unbalanced-journal",
      );
    }
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)
      || entry.lines.some(line => !Number.isSafeInteger(line.debitCents) || !Number.isSafeInteger(line.creditCents))) {
      throw new BooksRejectedError("Books only accept integer CAD cents. Nothing was posted.", "validation-rejected");
    }
  }
  // Bound cumulative arithmetic before Number can silently discard a cent.
  let totalDebit = 0n, totalCredit = 0n;
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  for (const entry of compiled.entries) for (const line of entry.lines) {
    totalDebit += BigInt(Math.abs(line.debitCents));
    totalCredit += BigInt(Math.abs(line.creditCents));
    if (totalDebit > limit || totalCredit > limit) throw new BooksRejectedError("The ledger exceeds exact CAD-cent arithmetic limits. Nothing was posted.", "validation-rejected");
  }
  const tb = trialBalance(compiled);
  const equation = booksEquation(compiled);
  if (!tb.inBalance) {
    throw new BooksRejectedError("The trial balance does not hold. Nothing was posted.", "unbalanced-journal");
  }
  if (!equation.holds) {
    throw new BooksRejectedError("The accounting equation does not hold. Nothing was posted.", "unbalanced-journal");
  }
  return compiled;
}


type Index = {
  scope: string;
  dependencies: string;
  signatures: string[];
  ids: Set<string>;
  references: Set<string>;
  books: CompiledBooks;
  absoluteDebit: bigint;
  absoluteCredit: bigint;
  totals: Map<string, { debit: number; credit: number }>;
};
const scopeKey = (h: Household) => JSON.stringify([h.environment, h.householdId]);
// potentialDuplicate is a review hint; compilation reads isDuplicate instead.
const fingerprint = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => {
  if (typeof item === "number" && !Number.isFinite(item)) return `\u0000number:${String(item)}`;
  if (typeof item === "string") return `\u0000string:${item}`;
  return item;
});
const signature = (row: Household['transactions'][number]) => fingerprint({ ...row, potentialDuplicate: undefined });
const dependencies = (h: Household) => fingerprint([h.accounts, h.categories]);

/** A bounded, per-scope cache. No caller-supplied delta or postedIds is trusted.
 * Current domain commands clone rows, so eligibility still scans O(n) facts.
 * Only independent append rows avoid compilation; every other shape uses the
 * unchanged full guard. Cached entries are privately cloned and immutable.
 */
export class IncrementalBooksGuard {
  private index?: Index;
  readonly metrics = { full: 0, incremental: 0, compiledRows: 0 };
  /** Tentative validation must not replace the accepted replica's index. */
  fork(): IncrementalBooksGuard { const fork=new IncrementalBooksGuard();fork.index=this.index;return fork; }
  validate(h: Household): CompiledBooks {
    const prior = this.index;
    try {
      const facts=prior ? h.transactions.map(signature) : [];
      const oldFacts=prior ? facts.filter((_fact,i)=>prior.ids.has(h.transactions[i]!.id)) : [];
      if (prior && prior.scope === scopeKey(h) && prior.dependencies === dependencies(h)
        && oldFacts.length === prior.signatures.length
        && prior.signatures.every((value, i) => value === oldFacts[i])) {
        // Shared additions can precede the trailing Personal envelope. The
        // relative order and facts of all existing rows must still match.
        const added = h.transactions.filter(row=>!prior.ids.has(row.id));
        const ids = new Set(prior.ids);
        if (added.every(row => {
          if (ids.has(row.id) || prior.references.has(row.id) || row.reversalOfId || row.transferPairId
            || !["expense", "income", "refund"].includes(row.type)) return false;
          ids.add(row.id); return true;
        })) {
          const delta = assertAcceptableBooks({ ...h, transactions: added });
          const totals = new Map([...prior.totals].map(([id, value]) => [id, { ...value }]));
          let debit = prior.absoluteDebit, credit = prior.absoluteCredit;
          for (const entry of delta.entries) for (const line of entry.lines) {
            debit += BigInt(Math.abs(line.debitCents)); credit += BigInt(Math.abs(line.creditCents));
            if (entry.recognized) {
              const total = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
              total.debit += line.debitCents; total.credit += line.creditCents;
              totals.set(line.accountId, total);
            }
          }
          if (debit > BigInt(Number.MAX_SAFE_INTEGER) || credit > BigInt(Number.MAX_SAFE_INTEGER))
            throw new BooksRejectedError("Cumulative arithmetic limit", "validation-rejected");
          // Reuse the full trial/equation algorithm on exact per-account totals.
          // The separate gross bound above includes unrecognized entries too.
          const aggregate = { ...delta, entries: [{ id: "incremental-totals", recognized: true,
            lines: [...totals].map(([accountId, value]) => ({ accountId, debitCents: value.debit, creditCents: value.credit })) }] } as CompiledBooks;
          assertAcceptableBooks(h, aggregate);
          const entries = [...prior.books.entries, ...delta.entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
          const books = { ...delta, entries };
          this.index = { ...prior, ids, signatures: facts,
            books: this.immutableBooks(books), totals, absoluteDebit: debit, absoluteCredit: credit };
          this.metrics.incremental++; this.metrics.compiledRows += added.length;
          return books;
        }
      }
    } catch {
      // Preserve the full guard's verdict AND error precedence/class, including
      // candidates with multiple simultaneous corruptions. Never bless a miss.
    }
    const books = assertAcceptableBooks(h);
    const totals = new Map<string, { debit: number; credit: number }>();
    let absoluteDebit = 0n, absoluteCredit = 0n;
    for (const entry of books.entries) for (const line of entry.lines) {
      absoluteDebit += BigInt(Math.abs(line.debitCents)); absoluteCredit += BigInt(Math.abs(line.creditCents));
      if (entry.recognized) {
        const value = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
        value.debit += line.debitCents; value.credit += line.creditCents; totals.set(line.accountId, value);
      }
    }
    const ids = new Set(h.transactions.map(row => row.id));
    // Duplicate IDs are legal to the old compiler's seen-map semantics but
    // cannot seed an append proof.
    try { this.index = ids.size === h.transactions.length ? {
      scope: scopeKey(h), dependencies: dependencies(h), signatures: h.transactions.map(signature), ids,
      references: new Set(h.transactions.flatMap(row => [row.reversalOfId, row.transferPairId].filter((id): id is string => Boolean(id)))),
      books: this.immutableBooks(books), totals, absoluteDebit, absoluteCredit,
    } : undefined; } catch { this.index=undefined; }
    this.metrics.full++; this.metrics.compiledRows += h.transactions.length;
    return books;
  }
  private immutableBooks(books: CompiledBooks): CompiledBooks {
    const entries = books.entries.map(entry => {
      if (Object.isFrozen(entry)) return entry;
      return Object.freeze({ ...entry, originTransactionIds: Object.freeze([...entry.originTransactionIds]),
        lines: Object.freeze(entry.lines.map(line => Object.freeze({ ...line }))) });
    });
    return { ...books, entries: Object.freeze(entries) } as unknown as CompiledBooks;
  }
}
