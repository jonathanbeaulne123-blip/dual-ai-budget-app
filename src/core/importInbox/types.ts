import type { DateKey } from "../calendar.ts";
import type { TransactionType, Visibility } from "../types.ts";

export type ImportSourceKind = "ofx" | "qfx" | "camera";
export type ImportDocumentKind = "bank-statement" | "credit-card-statement" | "bill" | "receipt" | "unknown";
export type ImportReviewType = TransactionType | "unknown";
export type DuplicateTier = "confident" | "not-sure" | "probably-not";
export type ImportResolution = "cancel-import" | "keep-import" | "exclude-ledger" | "undecided";

export type ImportedSourceRow = {
  id: string;
  sourceKind: ImportSourceKind;
  sourceName: string;
  sourceHash: string;
  provenanceId: string;
  documentKind: ImportDocumentKind;
  accountRef: string;
  accountLast4: string;
  currency: string;
  date: DateKey;
  amountCents: number;
  signedAmountCents: number;
  suggestedType: ImportReviewType;
  bankType: string;
  note: string;
  place: string;
  fitId: string;
  extractionConfidence: number | null;
};

export type ImportDuplicateMatch =
  | { kind: "ledger"; transactionId: string }
  | { kind: "batch"; rowId: string };

export type ImportReviewRow = ImportedSourceRow & {
  type: ImportReviewType;
  accountId: string;
  transferAccountId: string;
  subcategoryId: string;
  visibility: Visibility;
  duplicateConfidence: number;
  duplicateReasons: string[];
  duplicateTier: DuplicateTier;
  duplicateMatch: ImportDuplicateMatch | null;
  resolution: ImportResolution;
  resolutionTouched: boolean;
};

export type ParsedOfxAccount = {
  accountRef: string;
  accountLast4: string;
  kind: "bank" | "credit-card";
  currency: string;
  ledgerBalanceCents: number | null;
  ledgerBalanceDate: DateKey | null;
};

export type ParsedOfxBatch = {
  sourceName: string;
  sourceKind: "ofx" | "qfx";
  sourceHash: string;
  accounts: ParsedOfxAccount[];
  rows: ImportedSourceRow[];
  warnings: string[];
};

export type VisionDocumentResult = {
  documentKind: ImportDocumentKind;
  currency: string;
  accountLast4: string;
  rows: Array<{
    date: string;
    amountCents: number;
    direction: "debit" | "credit" | "unknown";
    typeHint: ImportReviewType;
    merchant: string;
    description: string;
    reference: string;
    confidence: number;
  }>;
  warnings: string[];
};
