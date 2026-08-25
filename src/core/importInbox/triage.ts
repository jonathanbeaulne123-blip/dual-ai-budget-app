import { shouldPrefillCategory, suggestCategory } from "../autoCode.ts";
import { confidenceFromScore, duplicateKey, findSimilarTransactions, scoreSimilarity } from "../duplicate.ts";
import { isVisibleInView } from "../visibility.ts";
import type { Household, LedgerView, Transaction, TransactionType, Visibility } from "../types.ts";
import type {
  DuplicateTier,
  ImportDuplicateMatch,
  ImportedSourceRow,
  ImportResolution,
  ImportReviewRow,
} from "./types.ts";

export function duplicateTier(confidence: number): DuplicateTier {
  if (confidence > 90) return "confident";
  if (confidence >= 50) return "not-sure";
  return "probably-not";
}

export function defaultImportResolution(confidence: number): ImportResolution {
  if (confidence > 90) return "cancel-import";
  if (confidence >= 50) return "undecided";
  return "keep-import";
}

function activeDefaultCategory(household: Household, type: TransactionType, note: string, place: string): string {
  const categoryType = type === "refund" ? "expense" : type;
  if (categoryType === "expense") {
    const guess = suggestCategory(household, note, place);
    if (shouldPrefillCategory(guess)) return guess!.subcategoryId;
  }
  return household.categories.find((category) => (
    category.active && category.recordType === "category" && category.transactionType === categoryType
  ))?.id ?? "";
}

function mappedAccount(household: Household, last4: string): string {
  const eligible = household.accounts.filter((account) => account.active && account.kind !== "investment");
  const exact = last4 ? eligible.filter((account) => account.last4 === last4) : [];
  if (exact.length === 1) return exact[0]!.id;
  if (exact.length > 1) return "";
  return eligible.length === 1 ? eligible[0]!.id : "";
}

function asSyntheticTransaction(row: ImportReviewRow): Transaction | null {
  if (row.type === "unknown") return null;
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    amountCents: row.amountCents,
    currency: "CAD",
    accountId: row.accountId,
    categoryId: null,
    subcategoryId: row.subcategoryId || null,
    note: row.note,
    place: row.place,
    splits: [],
    source: "import",
    sourceId: row.provenanceId,
    duplicateKey: "",
    potentialDuplicate: false,
    isDuplicate: false,
    reviewed: false,
    createdBy: "import-inbox",
    visibility: row.visibility,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
}

function candidateFor(row: ImportReviewRow) {
  return {
    date: row.date,
    amountCents: row.amountCents,
    accountId: row.accountId,
    type: row.type as TransactionType,
    note: row.note,
    place: row.place,
    subcategoryId: row.subcategoryId || null,
    source: "import",
    sourceId: row.provenanceId,
  };
}

function topDuplicate(
  row: ImportReviewRow,
  ledger: Transaction[],
  priorRows: ImportReviewRow[],
): { confidence: number; reasons: string[]; match: ImportDuplicateMatch | null } {
  for (const transaction of ledger) {
    if (transaction.isDuplicate) continue;
    if (transaction.sourceId && transaction.sourceId === row.provenanceId) {
      return { confidence: 100, reasons: ["same bank/document transaction id"], match: { kind: "ledger", transactionId: transaction.id } };
    }
  }
  for (const prior of priorRows) {
    if (prior.resolution !== "cancel-import" && prior.provenanceId === row.provenanceId) {
      return { confidence: 100, reasons: ["same transaction appears twice in this batch"], match: { kind: "batch", rowId: prior.id } };
    }
  }
  if (row.type === "unknown" || !row.accountId || row.amountCents <= 0) {
    return { confidence: 0, reasons: ["Choose a transaction type and account before matching."], match: null };
  }
  const candidate = candidateFor(row);
  const candidateKey = duplicateKey(candidate);
  let best = { confidence: 0, reasons: ["No close transaction found in the current ledger."], match: null as ImportDuplicateMatch | null };

  for (const transaction of ledger) {
    if (transaction.isDuplicate) continue;
    if (transaction.duplicateKey && transaction.duplicateKey === candidateKey) {
      return { confidence: 100, reasons: ["exact date, amount, account, type, note, and place"], match: { kind: "ledger", transactionId: transaction.id } };
    }
  }
  const ledgerMatch = findSimilarTransactions(ledger.filter((transaction) => !transaction.isDuplicate), candidate)[0];
  if (ledgerMatch) {
    best = {
      confidence: confidenceFromScore(ledgerMatch.score),
      reasons: ledgerMatch.reasons,
      match: { kind: "ledger", transactionId: ledgerMatch.transaction.id },
    };
  }

  for (const prior of priorRows) {
    if (prior.resolution === "cancel-import") continue;
    const synthetic = asSyntheticTransaction(prior);
    if (!synthetic) continue;
    const match = scoreSimilarity(candidate, synthetic);
    if (!match) continue;
    const confidence = confidenceFromScore(match.score);
    if (confidence > best.confidence) {
      best = { confidence, reasons: match.reasons, match: { kind: "batch", rowId: prior.id } };
    }
  }
  return best;
}

export function prepareImportRows(input: {
  household: Household;
  memberId: string;
  view: LedgerView;
  rows: ImportedSourceRow[];
}): ImportReviewRow[] {
  const visibility: Visibility = input.view === "personal" ? "personal" : "household";
  const ledger = input.household.transactions.filter((transaction) => isVisibleInView(transaction, input.memberId, input.view));
  const output: ImportReviewRow[] = [];
  for (const source of input.rows) {
    const type = source.suggestedType;
    const row: ImportReviewRow = {
      ...source,
      type,
      accountId: mappedAccount(input.household, source.accountLast4),
      transferAccountId: "",
      subcategoryId: type !== "unknown" && type !== "transfer"
        ? activeDefaultCategory(input.household, type, source.note, source.place)
        : "",
      visibility,
      duplicateConfidence: 0,
      duplicateReasons: [],
      duplicateTier: "probably-not",
      duplicateMatch: null,
      resolution: "keep-import",
      resolutionTouched: false,
    };
    const duplicate = topDuplicate(row, ledger, output);
    row.duplicateConfidence = duplicate.confidence;
    row.duplicateReasons = duplicate.reasons;
    row.duplicateMatch = duplicate.match;
    row.duplicateTier = duplicateTier(duplicate.confidence);
    row.resolution = defaultImportResolution(duplicate.confidence);
    output.push(row);
  }
  return output;
}

export function refreshImportTriage(input: {
  household: Household;
  memberId: string;
  view: LedgerView;
  rows: ImportReviewRow[];
}): ImportReviewRow[] {
  const ledger = input.household.transactions.filter((transaction) => isVisibleInView(transaction, input.memberId, input.view));
  const output: ImportReviewRow[] = [];
  for (const current of input.rows) {
    const duplicate = topDuplicate(current, ledger, output);
    output.push({
      ...current,
      duplicateConfidence: duplicate.confidence,
      duplicateReasons: duplicate.reasons,
      duplicateMatch: duplicate.match,
      duplicateTier: duplicateTier(duplicate.confidence),
      resolution: current.resolutionTouched ? current.resolution : defaultImportResolution(duplicate.confidence),
    });
  }
  return output;
}
