import { shouldPrefillCategory, suggestCategory } from "../autoCode.ts";
import {
  confidenceFromScore,
  contextTokens,
  duplicateKey,
  findSimilarTransactions,
  normalizeNote,
  scoreSimilarity,
} from "../duplicate.ts";
import { isVisibleInView } from "../visibility.ts";
import type { Account, Household, LedgerView, Transaction, TransactionType, Visibility } from "../types.ts";
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

function normalizedWords(value: string): string {
  return normalizeNote(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function directlyNamedCategory(household: Household, type: TransactionType, note: string, place: string): string {
  const categoryType = type === "refund" ? "expense" : type;
  const haystack = ` ${normalizedWords(`${note} ${place}`)} `;
  const haystackTokens = contextTokens(note, place);
  const matches = household.categories.flatMap((category) => {
    if (!category.active || category.recordType !== "category" || category.transactionType !== categoryType) return [];
    const name = normalizedWords(category.name);
    const tokens = [...contextTokens(category.name)];
    if (!name || !tokens.length) return [];
    const phraseMatch = haystack.includes(` ${name} `);
    const tokenMatch = tokens.every((token) => haystackTokens.has(token));
    return phraseMatch || tokenMatch ? [{ id: category.id, score: phraseMatch ? 100 + tokens.length : tokens.length }] : [];
  }).sort((left, right) => right.score - left.score);
  if (!matches.length || (matches[1] && matches[1].score === matches[0]!.score)) return "";
  return matches[0]!.id;
}

function activeDefaultCategory(
  household: Household,
  visibleLedger: Transaction[],
  type: TransactionType,
  note: string,
  place: string,
): string {
  const categoryType = type === "refund" ? "expense" : type;
  const named = directlyNamedCategory(household, type, note, place);
  if (named) return named;
  if (categoryType === "expense") {
    const guess = suggestCategory({ ...household, transactions: visibleLedger }, note, place);
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

const ACCOUNT_KIND_ALIASES: Partial<Record<Account["kind"], string[]>> = {
  chequing: ["chequing", "checking"],
  savings: ["savings", "saving"],
  credit: ["credit card", "creditcard", "card"],
  investment: ["investment", "investments"],
  receivable: ["receivable"],
};

function accountContextScore(account: Account, note: string, place: string, allowKindMatch: boolean): number {
  const haystack = ` ${normalizedWords(`${note} ${place}`)} `;
  if (account.last4 && haystack.includes(` ${account.last4} `)) return 200;
  const name = normalizedWords(account.name);
  const nameTokens = [...contextTokens(account.name)];
  if (!name || !nameTokens.length) return 0;
  if (haystack.includes(` ${name} `)) return 100 + nameTokens.length;
  const haystackTokens = contextTokens(note, place);
  if (nameTokens.every((token) => haystackTokens.has(token))) return nameTokens.length;
  if (!allowKindMatch) return 0;
  return (ACCOUNT_KIND_ALIASES[account.kind] ?? []).some((alias) => haystack.includes(` ${alias} `)) ? 1 : 0;
}

function directlyNamedOtherAccount(
  household: Household,
  sourceAccountId: string,
  note: string,
  place: string,
  allowAccountKind: boolean,
): string {
  const sourceAccount = household.accounts.find((account) => account.id === sourceAccountId);
  const matches = household.accounts
    .filter((account) => account.active && account.id !== sourceAccountId)
    .map((account) => ({
      id: account.id,
      score: accountContextScore(
        account,
        note,
        place,
        Boolean(allowAccountKind && sourceAccount && sourceAccount.kind !== account.kind),
      ),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);
  if (!matches.length || (matches[1] && matches[1].score === matches[0]!.score)) return "";
  return matches[0]!.id;
}

const GENERIC_TRANSFER_TOKENS = new Set([
  "automatic",
  "daily",
  "monthly",
  "move",
  "moving",
  "online",
  "paid",
  "payment",
  "transfer",
  "weekly",
]);

function transferContextTokens(note: string, place: string): Set<string> {
  return new Set([...contextTokens(note, place)].filter((token) => !GENERIC_TRANSFER_TOKENS.has(token)));
}

function historicalOtherAccount(
  household: Household,
  visibleLedger: Transaction[],
  sourceAccountId: string,
  note: string,
  place: string,
): string {
  if (!sourceAccountId) return "";
  const incomingTokens = transferContextTokens(note, place);
  const incomingPhrase = normalizedWords(`${note} ${place}`);
  if (!incomingPhrase) return "";
  const activeIds = new Set(household.accounts.filter((account) => account.active).map((account) => account.id));
  const votes = new Map<string, number>();
  const seenPairs = new Set<string>();
  for (const transaction of visibleLedger) {
    if (transaction.isDuplicate || transaction.type !== "transfer") continue;
    const fromId = transaction.transferFromAccountId;
    const toId = transaction.transferToAccountId;
    if (!fromId || !toId || (fromId !== sourceAccountId && toId !== sourceAccountId)) continue;
    const pairKey = [transaction.id, transaction.transferPairId ?? transaction.id].sort().join("|");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const priorTokens = transferContextTokens(transaction.note, transaction.place);
    const hasSpecificOverlap = [...priorTokens].some((token) => incomingTokens.has(token));
    const sameGenericPhrase = !incomingTokens.size
      && incomingPhrase === normalizedWords(`${transaction.note} ${transaction.place}`);
    if (!hasSpecificOverlap && !sameGenericPhrase) continue;
    const otherId = fromId === sourceAccountId ? toId : fromId;
    if (!activeIds.has(otherId)) continue;
    votes.set(otherId, (votes.get(otherId) ?? 0) + 1);
  }
  const ranked = [...votes.entries()].sort((left, right) => right[1] - left[1]);
  if (!ranked.length || ranked[0]![1] < 2 || (ranked[1] && ranked[1][1] === ranked[0]![1])) return "";
  return ranked[0]![0];
}

function hasInternalTransferCue(note: string, place: string): boolean {
  const tokens = contextTokens(note, place);
  return ["transfer", "payment", "paid", "move", "moving", "contribution"].some((token) => tokens.has(token));
}

function namesExternalTransferRail(note: string, place: string): boolean {
  const words = normalizedWords(`${note} ${place}`);
  const tokens = contextTokens(note, place);
  return tokens.has("interac") || tokens.has("etransfer") || words.includes("e transfer");
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
    const accountId = mappedAccount(input.household, source.accountLast4);
    const externalTransferRail = namesExternalTransferRail(source.note, source.place);
    const directlyNamedAccountId = directlyNamedOtherAccount(
      input.household,
      accountId,
      source.note,
      source.place,
      !externalTransferRail,
    );
    const otherAccountId = directlyNamedAccountId || (externalTransferRail
      ? ""
      : historicalOtherAccount(input.household, ledger, accountId, source.note, source.place));
    const type = source.suggestedType === "transfer"
      || (source.suggestedType !== "refund" && otherAccountId && hasInternalTransferCue(source.note, source.place))
      ? "transfer"
      : source.suggestedType;
    const row: ImportReviewRow = {
      ...source,
      type,
      accountId,
      transferAccountId: type === "transfer" ? otherAccountId : "",
      subcategoryId: type !== "unknown" && type !== "transfer"
        ? activeDefaultCategory(input.household, ledger, type, source.note, source.place)
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
