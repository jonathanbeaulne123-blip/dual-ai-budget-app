import { isValidDateKey, type DateKey } from "../calendar.ts";
import { stableImportHash } from "./hash.ts";
import type { ImportReviewType, ImportedSourceRow, ParsedOfxAccount, ParsedOfxBatch } from "./types.ts";

export type FlinksTransaction = {
  Id?: string | null;
  Date?: string | null;
  Description?: string | null;
  Debit?: number | null;
  Credit?: number | null;
  Balance?: number | null;
  Code?: number | null;
};

export type FlinksAccount = {
  Id?: string | null;
  Title?: string | null;
  AccountNumber?: string | null;
  LastFourDigits?: string | null;
  TransitNumber?: string | null;
  InstitutionNumber?: string | null;
  Category?: string | null;
  Type?: string | null;
  Currency?: string | null;
  Balance?: {
    Available?: number | null;
    Current?: number | null;
    Limit?: number | null;
  } | null;
  Transactions?: FlinksTransaction[] | null;
};

export type FlinksAccountsPayload = {
  RequestId?: string | null;
  Institution?: string | null;
  Accounts?: FlinksAccount[] | null;
};

function cleanText(value: string, max = 240): string {
  return value.replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function dateFromFlinks(value: string): DateKey | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const key = trimmed.slice(0, 10);
    return isValidDateKey(key) ? key : null;
  }
  const digits = trimmed.replace(/[^0-9]/g, "").slice(0, 8);
  if (digits.length !== 8) return null;
  const key = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return isValidDateKey(key) ? key : null;
}

function centsFromAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function accountKind(account: FlinksAccount): "bank" | "credit-card" | "investment" | null {
  const type = cleanText(account.Type ?? "", 80).toLowerCase();
  const category = cleanText(account.Category ?? "", 80).toLowerCase();
  if (/credit|visa|mastercard|line of credit|loc/.test(type) || category === "credits") return "credit-card";
  if (/tfsa|rrsp|fhsa|resp|investment|broker|crypto/.test(type) || category === "products") return "investment";
  if (/chequing|checking|savings|operations|other/.test(type) || category === "operations" || category === "other") {
    return "bank";
  }
  if (type) return "bank";
  return null;
}

function accountLast4(account: FlinksAccount): string {
  const explicit = cleanText(account.LastFourDigits ?? "", 4).replace(/\D/g, "");
  if (explicit.length >= 4) return explicit.slice(-4);
  const number = cleanText(account.AccountNumber ?? "", 40).replace(/\s+/g, "");
  return number.slice(-4);
}

function accountRef(account: FlinksAccount): string {
  const id = cleanText(account.Id ?? "", 80);
  if (id) return `flinks:${id}`;
  const last4 = accountLast4(account);
  const institution = cleanText(account.InstitutionNumber ?? "", 20);
  const transit = cleanText(account.TransitNumber ?? "", 20);
  return cleanText([institution, transit, last4].filter(Boolean).join(":"), 100) || "flinks:unknown";
}

function signedCentsForTransaction(transaction: FlinksTransaction, kind: "bank" | "credit-card"): number | null {
  const debit = centsFromAmount(transaction.Debit);
  const credit = centsFromAmount(transaction.Credit);
  if (debit != null && debit > 0) return -debit;
  if (credit != null && credit > 0) return credit;
  if (debit === 0 && credit === 0) return 0;
  if (kind === "credit-card" && debit != null) return debit > 0 ? -debit : debit;
  return null;
}

function inferredType(description: string, signedAmountCents: number, kind: "bank" | "credit-card"): ImportReviewType {
  const haystack = ` ${description.toLowerCase()} `;
  if (/\b(transfer|payment|paid|contribution|move|moving)\b/.test(haystack)) return "transfer";
  if (kind === "credit-card" && signedAmountCents > 0 && /\b(payment|paid|thank you|merci)\b/.test(haystack)) {
    return "transfer";
  }
  if (signedAmountCents < 0) return "expense";
  if (signedAmountCents > 0) return "income";
  return "unknown";
}

function parseAccount(input: {
  account: FlinksAccount;
  institution: string;
  sourceHash: string;
  rowOffset: number;
}): { account: ParsedOfxAccount | null; rows: ImportedSourceRow[]; warnings: string[] } {
  const kind = accountKind(input.account);
  const warnings: string[] = [];
  if (!kind) {
    warnings.push(`Skipped an account Flinks did not classify.`);
    return { account: null, rows: [], warnings };
  }
  if (kind === "investment") {
    warnings.push(`Skipped ${cleanText(input.account.Title ?? "investment account", 80)}: investment trades are not imported yet.`);
    return { account: null, rows: [], warnings };
  }
  const ref = accountRef(input.account);
  const last4 = accountLast4(input.account);
  const currency = cleanText(input.account.Currency ?? "CAD", 8).toUpperCase() || "CAD";
  const currentBalance = centsFromAmount(input.account.Balance?.Current ?? input.account.Balance?.Available);
  const rows: ImportedSourceRow[] = [];
  const transactions = input.account.Transactions ?? [];
  transactions.forEach((transaction, index) => {
    const date = transaction.Date ? dateFromFlinks(transaction.Date) : null;
    const signedAmountCents = signedCentsForTransaction(transaction, kind);
    if (!date || signedAmountCents == null || signedAmountCents === 0) {
      warnings.push(`Skipped transaction ${input.rowOffset + index + 1}: invalid date or zero/invalid amount.`);
      return;
    }
    const description = cleanText(transaction.Description ?? "", 240);
    const fitId = cleanText(transaction.Id ?? "", 120);
    const rowFingerprint = stableImportHash([ref, date, signedAmountCents, description, index].join("|"));
    const provenanceId = `flinks:${ref}:${fitId || rowFingerprint}`;
    rows.push({
      id: `IMP-${stableImportHash(`${input.sourceHash}|${provenanceId}|${index}`)}`,
      sourceKind: "flinks",
      sourceName: cleanText(input.institution || "Flinks", 160),
      sourceHash: input.sourceHash,
      provenanceId,
      documentKind: kind === "credit-card" ? "credit-card-statement" : "bank-statement",
      accountRef: ref,
      accountLast4: last4,
      currency,
      date,
      amountCents: Math.abs(signedAmountCents),
      signedAmountCents,
      suggestedType: inferredType(description, signedAmountCents, kind),
      bankType: signedAmountCents < 0 ? "DEBIT" : "CREDIT",
      note: description,
      place: cleanText(description.split(/\s+/).slice(0, 3).join(" "), 100),
      fitId,
      extractionConfidence: null,
    });
  });
  return {
    account: {
      sourceName: cleanText(input.institution || "Flinks", 160),
      sourceHash: input.sourceHash,
      accountRef: ref,
      accountLast4: last4,
      kind,
      currency,
      openingBalanceCents: null,
      ledgerBalanceCents: currentBalance,
      ledgerBalanceDate: null,
    },
    rows,
    warnings,
  };
}

export function parseFlinks(payload: FlinksAccountsPayload, sourceName = "Flinks"): ParsedOfxBatch {
  const accounts = payload.Accounts ?? [];
  if (!accounts.length) throw new Error("Flinks returned no linked accounts.");
  const institution = cleanText(payload.Institution ?? sourceName, 160) || "Flinks";
  const sourceHash = stableImportHash(JSON.stringify({
    requestId: payload.RequestId ?? "",
    institution,
    accounts: accounts.map((account) => ({
      id: account.Id ?? "",
      last4: accountLast4(account),
      type: account.Type ?? "",
      txCount: account.Transactions?.length ?? 0,
    })),
  }));
  const parsedAccounts: ParsedOfxAccount[] = [];
  const rows: ImportedSourceRow[] = [];
  const warnings: string[] = [];
  for (const account of accounts) {
    const parsed = parseAccount({
      account,
      institution,
      sourceHash,
      rowOffset: rows.length,
    });
    if (parsed.account) parsedAccounts.push(parsed.account);
    rows.push(...parsed.rows);
    warnings.push(...parsed.warnings);
  }
  if (!rows.length) throw new Error("Flinks returned no usable non-zero transactions.");
  return {
    sourceName: institution,
    sourceKind: "ofx",
    sourceHash,
    accounts: parsedAccounts,
    rows: rows.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)),
    warnings,
  };
}
