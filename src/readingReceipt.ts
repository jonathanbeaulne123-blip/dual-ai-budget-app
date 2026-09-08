import { booksPresentationFloor, compileHousehold, type Household, type LedgerView, type Transaction } from "./core/index.ts";
import type { CompiledBooks } from "./core/journal.ts";

export type ReadingReceipt = { kind: "unavailable"; reason: string } | {
  kind: "ready"; revision: number; date: string; view: LedgerView; transactionId: string;
  source: Transaction["source"]; sourceId?: string; journalId: string; recognized: boolean;
  reversalOfId?: string; reversedByIds: string[];
};

/** One lazy compiler per accepted, privacy-scoped snapshot; never compile a displayed subset. */
export function createReadingReceiptReader(accepted: Household, memberId: string, view: LedgerView) {
  const scoped = booksPresentationFloor(accepted, memberId, view);
  const rows = new Map(scoped.transactions.map(row => [row.id, row]));
  let books: CompiledBooks | null | undefined;
  return (displayed: Transaction): ReadingReceipt => {
    const unavailable = (reason = "The accepted source is unavailable or has changed. Refresh Books to review it."): ReadingReceipt => ({ kind: "unavailable", reason });
    const row = rows.get(displayed.id);
    if (!accepted.members.some(member => member.id === memberId && member.active)
      || !row || JSON.stringify(row) !== JSON.stringify(displayed)) return unavailable();
    const seen = new Set<string>();
    let ancestor: Transaction | undefined = row;
    while (ancestor) {
      if (seen.has(ancestor.id)) return unavailable("The reversal history is incomplete. Review the raw Books entries.");
      seen.add(ancestor.id);
      if (ancestor.type === "transfer") {
        const pair = ancestor.transferPairId ? rows.get(ancestor.transferPairId) : undefined;
        if (!pair || pair.id === ancestor.id || pair.type !== "transfer" || pair.transferPairId !== ancestor.id
          || pair.amountCents !== ancestor.amountCents || pair.date !== ancestor.date || pair.currency !== ancestor.currency
          || pair.transferFromAccountId !== ancestor.transferFromAccountId || pair.transferToAccountId !== ancestor.transferToAccountId
          || !ancestor.transferFromAccountId || !ancestor.transferToAccountId
          || ancestor.transferFromAccountId === ancestor.transferToAccountId
          || new Set([ancestor.accountId, pair.accountId]).size !== 2
          || ![ancestor.accountId, pair.accountId].includes(ancestor.transferFromAccountId)
          || ![ancestor.accountId, pair.accountId].includes(ancestor.transferToAccountId)) {
          return unavailable("The transfer pair is incomplete. Review the raw Books entries.");
        }
      }
      if (!ancestor.reversalOfId) break;
      ancestor = rows.get(ancestor.reversalOfId);
      if (!ancestor) return unavailable("The reversal source is unavailable in these Books.");
    }
    if (books === undefined) {
      try { books = compileHousehold(scoped); } catch { books = null; }
    }
    if (!books) return unavailable("These Books cannot currently establish journal provenance.");
    const matches = books.entries.filter(entry => entry.originTransactionIds.includes(row.id));
    if (matches.length !== 1 || matches[0]!.date !== row.date) return unavailable();
    const entry = matches[0]!;
    return { kind: "ready", revision: scoped.revision, date: row.date, view, transactionId: row.id,
      source: row.source, sourceId: row.sourceId, journalId: entry.id, recognized: entry.recognized,
      reversalOfId: row.reversalOfId,
      reversedByIds: scoped.transactions.filter(candidate => candidate.reversalOfId && entry.originTransactionIds.includes(candidate.reversalOfId)).map(candidate => candidate.id),
    };
  };
}
