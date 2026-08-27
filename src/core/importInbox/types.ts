import type { DateKey } from "../calendar.ts";
import type { TransactionType, Visibility } from "../types.ts";

export type ImportSourceKind = "ofx" | "qfx" | "camera" | "flinks";
export type ImportDocumentKind = "bank-statement" | "credit-card-statement" | "bill" | "receipt" | "shift-report" | "unknown";
export type ImportReviewType = TransactionType | "unknown";
export type DuplicateTier = "confident" | "not-sure" | "probably-not";
export type ImportResolution = "cancel-import" | "keep-import" | "exclude-ledger" | "undecided";

export type ReceiptNumbers = {
  /** Item amounts only. Item names are deliberately never requested or retained. */
  lineAmountsCents: number[];
  subtotalCents: number | null;
  discountCents: number;
  taxCents: number;
  tipCents: number;
  feeCents: number;
  totalCents: number;
};

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
  receiptNumbers?: ReceiptNumbers | null;
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
  sourceName: string;
  sourceHash: string;
  accountRef: string;
  accountLast4: string;
  kind: "bank" | "credit-card";
  currency: string;
  openingBalanceCents: number | null;
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
  receiptNumbers?: ReceiptNumbers | null;
  shiftDraft?: {
    date?: string;
    workedHours?: number;
    salesCents?: number;
    cashTipsCents?: number;
    cardTipsCents?: number;
    customersServed?: number;
    staffingCount?: number;
    eventTag?: string;
  } | null;
  warnings: string[];
};

export type ImportBalanceStatus = "balanced" | "mismatch" | "skipped";

export type StatementBalanceCheck = {
  id: string;
  sourceName: string;
  sourceHash: string;
  accountRef: string;
  accountLast4: string;
  openingBalanceCents: number | null;
  transactionNetCents: number;
  expectedClosingBalanceCents: number | null;
  closingBalanceCents: number | null;
  differenceCents: number | null;
  status: ImportBalanceStatus;
};

export type ReceiptPaymentCandidate = {
  id: string;
  kind: "batch" | "ledger";
  rowId?: string;
  transactionId?: string;
  date: DateKey;
  amountCents: number;
  label: string;
};

export type ReceiptReconciliationCheck = {
  id: string;
  rowId: string;
  sourceName: string;
  sourceHash: string;
  totalCents: number;
  lineSumCents: number | null;
  componentSumCents: number | null;
  lineStatus: ImportBalanceStatus;
  componentStatus: ImportBalanceStatus;
  rowTotalStatus: ImportBalanceStatus;
  matchSearchStatus: "complete" | "truncated";
  paymentAssignmentConflict: boolean;
  candidates: ReceiptPaymentCandidate[];
  suggestedMatchIds: string[];
};

export type ImportReconciliationReport = {
  statements: StatementBalanceCheck[];
  receipts: ReceiptReconciliationCheck[];
};
