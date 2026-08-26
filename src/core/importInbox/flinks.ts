import { isValidDateKey, type DateKey } from "../calendar.ts";
import { stableImportHash } from "./hash.ts";
import type { ImportReviewType, ImportedSourceRow, ParsedOfxAccount, ParsedOfxBatch } from "./types.ts";

export type FlinksInboxAccount = {
  accountRef: string;
  accountLast4: string;
  title: string;
  type: string;
  category: string;
  currency: string;
  balanceCents: number | null;
};

export type FlinksInboxTransaction = {
  accountRef: string;
  provenanceId: string;
  date: string;
  description: string;
  debitCents: number | null;
  creditCents: number | null;
};

export type FlinksInboxPayload = {
  institution: string;
  sourceHash: string;
  accounts: FlinksInboxAccount[];
  transactions: FlinksInboxTransaction[];
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

function accountKind(account: FlinksInboxAccount): "bank" | "credit-card" | "investment" | null {
  const type = cleanText(account.type, 80).toLowerCase();
  const category = cleanText(account.category, 80).toLowerCase();
  if (/credit|visa|mastercard|line of credit|loc/.test(type) || category === "credits") return "credit-card";
  if (/tfsa|rrsp|fhsa|resp|investment|broker|crypto/.test(type) || category === "products") return "investment";
  if (/chequing|checking|savings|operations|other/.test(type) || category === "operations" || category === "other") return "bank";
  if (type) return "bank";
  return null;
}

function signedCentsForTransaction(transaction: FlinksInboxTransaction, kind: "bank" | "credit-card"): number | null {
  const debit = transaction.debitCents;
  const credit = transaction.creditCents;
  if (debit != null && debit > 0) return -debit;
  if (credit != null && credit > 0) return credit;
  if (debit === 0 && credit === 0) return 0;
  if (kind === "credit-card" && debit != null) return debit > 0 ? -debit : debit;
  return null;
}

function inferredType(description: string, signedAmountCents: number, kind: "bank" | "credit-card"): ImportReviewType {
  const haystack = ` ${description.toLowerCase()} `;
  if (/\b(transfer|payment|paid|contribution|move|moving)\b/.test(haystack)) return "transfer";
  if (kind === "credit-card" && signedAmountCents > 0 && /\b(payment|paid|thank you|merci)\b/.test(haystack)) return "transfer";
  if (signedAmountCents < 0) return "expense";
  if (signedAmountCents > 0) return "income";
  return "unknown";
}

function parseAccount(input: {
  account: FlinksInboxAccount;
  institution: string;
  sourceHash: string;
  rowOffset: number;
  transactionsForAccount: (accountRef: string) => FlinksInboxTransaction[];
}): { account: ParsedOfxAccount | null; rows: ImportedSourceRow[]; warnings: string[] } {
  const kind = accountKind(input.account);
  const warnings: string[] = [];
  if (!kind) {
    warnings.push("Skipped an account Flinks did not classify.");
    return { account: null, rows: [], warnings };
  }
  if (kind === "investment") {
    warnings.push(`Skipped ${cleanText(input.account.title, 80)}: investment trades are not imported yet.`);
    return { account: null, rows: [], warnings };
  }
  const ref = cleanText(input.account.accountRef, 120);
  const last4 = cleanText(input.account.accountLast4, 4).replace(/\D/g, "").slice(-4);
  const currency = cleanText(input.account.currency || "CAD", 8).toUpperCase() || "CAD";
  const rows: ImportedSourceRow[] = [];
  const transactions = input.transactionsForAccount(ref);
  transactions.forEach((transaction, index) => {
    const date = dateFromFlinks(transaction.date);
    const signedAmountCents = signedCentsForTransaction(transaction, kind);
    if (!date || signedAmountCents == null || signedAmountCents === 0) {
      warnings.push(`Skipped transaction ${input.rowOffset + index + 1}: invalid date or zero/invalid amount.`);
      return;
    }
    const description = cleanText(transaction.description, 240);
    const provenanceId = cleanText(transaction.provenanceId, 160);
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
      fitId: provenanceId,
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
      ledgerBalanceCents: input.account.balanceCents,
      ledgerBalanceDate: null,
    },
    rows,
    warnings,
  };
}

export function parseFlinksInbox(payload: FlinksInboxPayload): ParsedOfxBatch {
  const accounts = payload.accounts ?? [];
  if (!accounts.length) throw new Error("Flinks returned no linked accounts.");
  const institution = cleanText(payload.institution ?? "Flinks", 160) || "Flinks";
  const sourceHash = cleanText(payload.sourceHash, 120) || stableImportHash(JSON.stringify({ institution, accounts: accounts.map((account) => account.accountRef) }));
  const transactionsByAccount = new Map<string, FlinksInboxTransaction[]>();
  for (const transaction of payload.transactions ?? []) {
    const key = cleanText(transaction.accountRef, 120);
    const bucket = transactionsByAccount.get(key) ?? [];
    bucket.push(transaction);
    transactionsByAccount.set(key, bucket);
  }
  const parsedAccounts: ParsedOfxAccount[] = [];
  const rows: ImportedSourceRow[] = [];
  const warnings: string[] = [];
  for (const account of accounts) {
    const parsed = parseAccount({
      account,
      institution,
      sourceHash,
      rowOffset: rows.length,
      transactionsForAccount: (accountRef) => transactionsByAccount.get(accountRef) ?? [],
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

/** @deprecated Use parseFlinksInbox with Worker-redacted inbox payloads. */
export function parseFlinks(payload: { RequestId?: string | null; Institution?: string | null; Accounts?: Array<Record<string, unknown>> | null }, sourceName = "Flinks"): ParsedOfxBatch {
  const inbox: FlinksInboxPayload = {
    institution: cleanText(payload.Institution ?? sourceName, 160) || "Flinks",
    sourceHash: stableImportHash(JSON.stringify({
      requestId: payload.RequestId ?? "",
      institution: payload.Institution ?? sourceName,
      accounts: (payload.Accounts ?? []).map((account) => ({
        id: String(account?.Id ?? ""),
        last4: String(account?.LastFourDigits ?? account?.AccountNumber ?? "").slice(-4),
      })),
    })),
    accounts: (payload.Accounts ?? []).map((account) => ({
      accountRef: `flinks:${String(account?.Id ?? "unknown")}`,
      accountLast4: String(account?.LastFourDigits ?? account?.AccountNumber ?? "").replace(/\D/g, "").slice(-4),
      title: cleanText(String(account?.Title ?? "Linked account"), 120),
      type: cleanText(String(account?.Type ?? ""), 80),
      category: cleanText(String(account?.Category ?? ""), 80),
      currency: cleanText(String(account?.Currency ?? "CAD"), 8).toUpperCase() || "CAD",
      balanceCents: null,
    })),
    transactions: (payload.Accounts ?? []).flatMap((account, accountIndex) => {
      const accountRef = `flinks:${String(account?.Id ?? accountIndex)}`;
      return (Array.isArray(account?.Transactions) ? account.Transactions : []).map((transaction, index) => ({
        accountRef,
        provenanceId: `flinks:${accountRef}:${String((transaction as { Id?: string })?.Id ?? index)}`,
        date: String((transaction as { Date?: string })?.Date ?? ""),
        description: String((transaction as { Description?: string })?.Description ?? ""),
        debitCents: (transaction as { Debit?: number | null })?.Debit == null ? null : Math.round(Number((transaction as { Debit?: number }).Debit) * 100),
        creditCents: (transaction as { Credit?: number | null })?.Credit == null ? null : Math.round(Number((transaction as { Credit?: number }).Credit) * 100),
      }));
    }),
  };
  return parseFlinksInbox(inbox);
}
