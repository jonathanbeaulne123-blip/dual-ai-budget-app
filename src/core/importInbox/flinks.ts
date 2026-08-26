import { isValidDateKey, type DateKey } from "../calendar.ts";
import { stableImportHash } from "./hash.ts";
import type { ImportReviewType, ImportedSourceRow } from "./types.ts";

const MAX_ROWS = 10_000;
const TRANSFER_CODES = new Set(["TRANSFER", "XFER"]);
const ACCOUNT_KINDS = new Set(["bank", "credit-card", "unknown"]);

export type FlinksInboxTransaction = {
  /** Server-issued stable digest. Never a login id, account id, or raw provider credential. */
  stableTransactionId: string;
  status: "posted" | "pending";
  accountRef: string;
  accountLast4: string;
  accountKind: "bank" | "credit-card" | "unknown";
  currency: string;
  date: string;
  debit: string | number | null;
  credit: string | number | null;
  code?: string | null;
  description?: string | null;
  merchant?: string | null;
};

export type FlinksInboxPayload = {
  provider: "flinks";
  /** Bounded display label returned by Hearth's authenticated Worker. */
  sourceName: string;
  /** Server-issued digest for this pull. It must contain no bank credential or raw account number. */
  sourceHash: string;
  transactions: FlinksInboxTransaction[];
};

export type ParsedFlinksBatch = {
  sourceName: string;
  sourceKind: "flinks";
  sourceHash: string;
  rows: ImportedSourceRow[];
  warnings: string[];
};

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function opaqueDigest(value: unknown, label: string, prefix: "fpull_" | "ftx_" | "fac_"): string {
  const cleaned = cleanText(value, 160);
  const digest = cleaned.slice(prefix.length);
  if (!cleaned.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`Flinks returned an invalid ${label}.`);
  }
  return cleaned;
}

function decimalToCents(value: string | number | null): number {
  if (value == null || value === "") return 0;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Flinks returned an amount that is not exact to CAD cents.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Flinks returned an amount outside Hearth's safe range.");
  return cents;
}

function suggestedType(
  code: string,
  signedAmountCents: number,
  accountKind: FlinksInboxTransaction["accountKind"],
): ImportReviewType {
  if (TRANSFER_CODES.has(code)) return "transfer";
  if (code === "PAYMENT") return accountKind === "credit-card" ? "transfer" : "unknown";
  if (signedAmountCents < 0) return "expense";
  if (signedAmountCents > 0) return "income";
  return "unknown";
}

function normalizedLast4(value: unknown): string {
  const digits = cleanText(value, 16).replace(/\D/g, "");
  return digits.slice(-4);
}

/**
 * Normalize the deliberately bounded response from Hearth's future authenticated
 * Flinks Worker facade. This function does not accept raw Flinks login/account
 * payloads and never writes money; its rows still pass through Import review and
 * the existing final Confirm command.
 */
export function parseFlinksInbox(payload: FlinksInboxPayload): ParsedFlinksBatch {
  if (!payload || payload.provider !== "flinks" || !Array.isArray(payload.transactions)) {
    throw new Error("Flinks returned an invalid Bank Inbox response.");
  }
  if (payload.transactions.length > MAX_ROWS) {
    throw new Error("Flinks returned more than 10,000 rows. Pull a smaller date range.");
  }
  const sourceName = cleanText(payload.sourceName, 100) || "Flinks bank connection";
  const sourceHash = opaqueDigest(payload.sourceHash, "pull digest", "fpull_");
  const warnings: string[] = [];
  const rows: ImportedSourceRow[] = [];
  let pending = 0;

  payload.transactions.forEach((transaction, index) => {
    if (transaction.status === "pending") {
      pending += 1;
      return;
    }
    if (transaction.status !== "posted") throw new Error(`Flinks row ${index + 1} has an invalid status.`);
    const currency = cleanText(transaction.currency, 8).toUpperCase();
    if (currency !== "CAD") {
      throw new Error(`Flinks row ${index + 1} uses ${currency || "an unknown currency"}. Hearth imports CAD only.`);
    }
    const date = cleanText(transaction.date, 10);
    if (!isValidDateKey(date)) throw new Error(`Flinks row ${index + 1} has an invalid posting date.`);
    const debitCents = decimalToCents(transaction.debit);
    const creditCents = decimalToCents(transaction.credit);
    if ((debitCents > 0 && creditCents > 0) || (debitCents === 0 && creditCents === 0)) {
      throw new Error(`Flinks row ${index + 1} must contain exactly one non-zero debit or credit.`);
    }
    const stableTransactionId = opaqueDigest(transaction.stableTransactionId, "transaction digest", "ftx_");
    const accountRef = opaqueDigest(transaction.accountRef, "account digest", "fac_");
    if (!ACCOUNT_KINDS.has(transaction.accountKind)) throw new Error(`Flinks row ${index + 1} has an invalid account kind.`);
    const accountLast4 = normalizedLast4(transaction.accountLast4);
    const signedAmountCents = creditCents - debitCents;
    const code = cleanText(transaction.code, 40).toUpperCase() || "OTHER";
    const note = cleanText(transaction.description, 240);
    const place = cleanText(transaction.merchant, 100);
    const provenanceId = `flinks:${accountRef}:${stableTransactionId}`;
    rows.push({
      id: `IMP-${stableImportHash(provenanceId)}`,
      sourceKind: "flinks",
      sourceName,
      sourceHash,
      provenanceId,
      documentKind: transaction.accountKind === "credit-card" ? "credit-card-statement" : "bank-statement",
      accountRef,
      accountLast4,
      currency,
      date: date as DateKey,
      amountCents: Math.abs(signedAmountCents),
      signedAmountCents,
      suggestedType: suggestedType(code, signedAmountCents, transaction.accountKind),
      bankType: code,
      note,
      place: place || note.slice(0, 100),
      fitId: stableTransactionId,
      extractionConfidence: null,
    });
  });

  if (pending) warnings.push(`${pending} pending Flinks transaction${pending === 1 ? " was" : "s were"} left out until posted.`);
  if (!rows.length) throw new Error(pending
    ? "Flinks returned only pending transactions. Nothing was staged."
    : "Flinks returned no posted transactions to stage.");

  return {
    sourceName,
    sourceKind: "flinks",
    sourceHash,
    rows: rows.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)),
    warnings,
  };
}
