import { formatCad } from "../money.ts";
import { isVisibleInView } from "../visibility.ts";
import type { Household, LedgerView, Transaction } from "../types.ts";
import { stableImportHash } from "./hash.ts";
import type {
  ImportReconciliationReport,
  ImportReviewRow,
  ParsedOfxAccount,
  ReceiptNumbers,
  ReceiptPaymentCandidate,
  ReceiptReconciliationCheck,
  StatementBalanceCheck,
} from "./types.ts";

const MATCH_WINDOW_DAYS = 2;
const MAX_MATCH_PARTS = 4;
const MAX_MATCH_CANDIDATES = 18;

function safeCents(value: unknown): number | null {
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export function normalizeReceiptNumbers(value: ReceiptNumbers | null | undefined, fallbackTotalCents: number): ReceiptNumbers {
  const totalCents = safeCents(value?.totalCents) ?? fallbackTotalCents;
  return {
    lineAmountsCents: Array.isArray(value?.lineAmountsCents)
      ? value.lineAmountsCents.map(safeCents).filter((item): item is number => item !== null && item > 0).slice(0, 200)
      : [],
    subtotalCents: value?.subtotalCents == null ? null : safeCents(value.subtotalCents),
    discountCents: safeCents(value?.discountCents) ?? 0,
    taxCents: safeCents(value?.taxCents) ?? 0,
    tipCents: safeCents(value?.tipCents) ?? 0,
    feeCents: safeCents(value?.feeCents) ?? 0,
    totalCents: totalCents > 0 ? totalCents : fallbackTotalCents,
  };
}

function statementCheck(account: ParsedOfxAccount, rows: ImportReviewRow[]): StatementBalanceCheck {
  const transactionNetCents = rows
    .filter((row) => row.sourceHash === account.sourceHash && row.accountRef === account.accountRef)
    .reduce((sum, row) => sum + row.signedAmountCents, 0);
  const expectedClosingBalanceCents = account.openingBalanceCents == null
    ? null
    : account.openingBalanceCents + transactionNetCents;
  const differenceCents = expectedClosingBalanceCents == null || account.ledgerBalanceCents == null
    ? null
    : expectedClosingBalanceCents - account.ledgerBalanceCents;
  return {
    id: `statement:${stableImportHash(`${account.sourceHash}|${account.accountRef}`)}`,
    sourceName: account.sourceName,
    sourceHash: account.sourceHash,
    accountRef: account.accountRef,
    accountLast4: account.accountLast4,
    openingBalanceCents: account.openingBalanceCents,
    transactionNetCents,
    expectedClosingBalanceCents,
    closingBalanceCents: account.ledgerBalanceCents,
    differenceCents,
    status: differenceCents == null ? "skipped" : differenceCents === 0 ? "balanced" : "mismatch",
  };
}

function dayDistance(left: string, right: string): number {
  const leftTime = Date.parse(`${left}T00:00:00Z`);
  const rightTime = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((leftTime - rightTime) / 86_400_000));
}

function eligibleLedgerTransaction(transaction: Transaction): boolean {
  return !transaction.isDuplicate && transaction.type === "expense";
}

function paymentCandidates(input: {
  receipt: ImportReviewRow;
  rows: ImportReviewRow[];
  household: Household;
  memberId: string;
  view: LedgerView;
}): ReceiptPaymentCandidate[] {
  const batch: ReceiptPaymentCandidate[] = input.rows.flatMap((row) => {
    if (row.id === input.receipt.id || row.documentKind === "receipt" || row.documentKind === "bill") return [];
    if (row.resolution === "cancel-import") return [];
    if (row.type !== "expense") return [];
    if (row.signedAmountCents >= 0 || dayDistance(row.date, input.receipt.date) > MATCH_WINDOW_DAYS) return [];
    return [{
      id: `batch:${row.id}`,
      kind: "batch" as const,
      rowId: row.id,
      date: row.date,
      amountCents: row.amountCents,
      label: `${row.note || row.sourceName} · ${formatCad(row.amountCents)}`,
    }];
  });
  const ledger: ReceiptPaymentCandidate[] = input.household.transactions.flatMap((transaction) => {
    if (!eligibleLedgerTransaction(transaction)) return [];
    if (!isVisibleInView(transaction, input.memberId, input.view)) return [];
    if (dayDistance(transaction.date, input.receipt.date) > MATCH_WINDOW_DAYS) return [];
    return [{
      id: `ledger:${transaction.id}`,
      kind: "ledger" as const,
      transactionId: transaction.id,
      date: transaction.date,
      amountCents: transaction.amountCents,
      label: `${transaction.place || transaction.note || transaction.type} · ${formatCad(transaction.amountCents)}`,
    }];
  });
  return [...batch, ...ledger]
    .sort((left, right) => dayDistance(left.date, input.receipt.date) - dayDistance(right.date, input.receipt.date)
      || Math.abs(left.amountCents - input.receipt.amountCents) - Math.abs(right.amountCents - input.receipt.amountCents)
      || left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

function exactSubsets(candidates: ReceiptPaymentCandidate[], targetCents: number): { matches: string[][]; truncated: boolean } {
  const exactSingles = candidates.filter((candidate) => candidate.amountCents === targetCents).map((candidate) => [candidate.id]);
  if (candidates.length > MAX_MATCH_CANDIDATES) {
    return { matches: exactSingles.slice(0, 2), truncated: true };
  }
  const matches: string[][] = [];
  function walk(start: number, selected: string[], sum: number): void {
    if (sum === targetCents) {
      matches.push([...selected]);
      return;
    }
    if (sum > targetCents || selected.length >= MAX_MATCH_PARTS || matches.length > 1) return;
    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index]!;
      selected.push(candidate.id);
      walk(index + 1, selected, sum + candidate.amountCents);
      selected.pop();
      if (matches.length > 1) return;
    }
  }
  walk(0, [], 0);
  return { matches, truncated: false };
}

function receiptCheck(input: {
  receipt: ImportReviewRow;
  rows: ImportReviewRow[];
  household: Household;
  memberId: string;
  view: LedgerView;
}): ReceiptReconciliationCheck {
  const numbers = normalizeReceiptNumbers(input.receipt.receiptNumbers, input.receipt.amountCents);
  const lineSumCents = numbers.lineAmountsCents.length
    ? numbers.lineAmountsCents.reduce((sum, cents) => sum + cents, 0)
    : null;
  const subtotalForComponents = numbers.subtotalCents ?? lineSumCents;
  const componentSumCents = subtotalForComponents == null
    ? null
    : subtotalForComponents - numbers.discountCents + numbers.taxCents + numbers.tipCents + numbers.feeCents;
  const candidates = paymentCandidates(input);
  const subsets = exactSubsets(candidates, numbers.totalCents);
  return {
    id: `receipt:${input.receipt.sourceHash}`,
    rowId: input.receipt.id,
    sourceName: input.receipt.sourceName,
    sourceHash: input.receipt.sourceHash,
    totalCents: numbers.totalCents,
    lineSumCents,
    componentSumCents,
    lineStatus: lineSumCents == null || numbers.subtotalCents == null
      ? "skipped"
      : lineSumCents === numbers.subtotalCents ? "balanced" : "mismatch",
    componentStatus: componentSumCents == null
      ? "skipped"
      : componentSumCents === numbers.totalCents ? "balanced" : "mismatch",
    rowTotalStatus: input.receipt.amountCents === numbers.totalCents ? "balanced" : "mismatch",
    matchSearchStatus: subsets.truncated ? "truncated" : "complete",
    paymentAssignmentConflict: false,
    candidates,
    suggestedMatchIds: !subsets.truncated && subsets.matches.length === 1 ? subsets.matches[0]! : [],
  };
}

export function reconcileImportSources(input: {
  household: Household;
  memberId: string;
  view: LedgerView;
  rows: ImportReviewRow[];
  accounts: ParsedOfxAccount[];
}): ImportReconciliationReport {
  const receipts = input.rows
    .filter((row) => row.documentKind === "receipt" && (row.resolution !== "cancel-import" || !row.resolutionTouched))
    .map((receipt) => receiptCheck({ ...input, receipt }));
  const suggestedClaims = new Map<string, number>();
  receipts.forEach((check) => check.suggestedMatchIds.forEach((id) => suggestedClaims.set(id, (suggestedClaims.get(id) ?? 0) + 1)));
  return {
    statements: input.accounts.map((account) => statementCheck(account, input.rows)),
    receipts: receipts.map((check) => check.suggestedMatchIds.some((id) => (suggestedClaims.get(id) ?? 0) > 1)
      ? { ...check, suggestedMatchIds: [], paymentAssignmentConflict: true }
      : check),
  };
}

export function conflictingReceiptSources(
  receipts: ReceiptReconciliationCheck[],
  selectedIdsFor: (check: ReceiptReconciliationCheck) => Iterable<string>,
): Set<string> {
  const claims = new Map<string, string[]>();
  receipts.forEach((check) => {
    for (const paymentId of new Set(selectedIdsFor(check))) {
      claims.set(paymentId, [...(claims.get(paymentId) ?? []), check.sourceHash]);
    }
  });
  const conflicts = new Set<string>();
  claims.forEach((sourceHashes) => {
    if (sourceHashes.length > 1) sourceHashes.forEach((sourceHash) => conflicts.add(sourceHash));
  });
  return conflicts;
}

export function selectedPaymentTotal(check: ReceiptReconciliationCheck, selectedIds: Iterable<string>): number {
  const selected = new Set(selectedIds);
  return check.candidates.reduce((sum, candidate) => selected.has(candidate.id) ? sum + candidate.amountCents : sum, 0);
}

export function receiptMathBlocks(check: ReceiptReconciliationCheck): boolean {
  return check.lineStatus === "mismatch" || check.componentStatus === "mismatch" || check.rowTotalStatus === "mismatch";
}
