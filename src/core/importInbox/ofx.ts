import { isValidDateKey, type DateKey } from "../calendar.ts";
import { stableImportHash } from "./hash.ts";
import type { ImportReviewType, ImportedSourceRow, ParsedOfxAccount, ParsedOfxBatch } from "./types.ts";

const MAX_SOURCE_CHARS = 50_000_000;
const TRANSFER_TYPES = new Set(["XFER"]);
const CREDIT_TYPES = new Set(["CREDIT", "DEP", "DIRECTDEP", "INT"]);

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function cleanText(value: string, max = 240): string {
  return decodeEntities(value).replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function tagValue(source: string, tag: string): string {
  const match = source.match(new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*([^<\\r\\n]*)`, "i"));
  return cleanText(match?.[1] ?? "");
}

function tagBlocks(source: string, tag: string): string[] {
  return [...source.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((match) => match[1] ?? "");
}

function ofxBody(source: string): string {
  const start = source.search(/<OFX(?:\s|>)/i);
  if (start < 0) throw new Error("This file does not contain an OFX data block.");
  return source.slice(start);
}

function dateFromOfx(value: string): DateKey | null {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 8);
  if (digits.length !== 8) return null;
  const key = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return isValidDateKey(key) ? key : null;
}

function centsFromOfx(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^[+-]?\d+(?:\.\d{1,6})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function accountRef(block: string, kind: "bank" | "credit-card"): { ref: string; last4: string } {
  const id = tagValue(block, "ACCTID") || tagValue(block, "ACCTKEY") || "unknown";
  const routing = kind === "bank" ? tagValue(block, "BANKID") : "";
  const ref = cleanText([routing, id].filter(Boolean).join(":"), 100) || "unknown";
  return { ref, last4: id.replace(/\s+/g, "").slice(-4) };
}

function inferredType(bankType: string, signedAmountCents: number, accountKind: "bank" | "credit-card"): ImportReviewType {
  if (TRANSFER_TYPES.has(bankType)) return "transfer";
  if (bankType === "PAYMENT") return accountKind === "credit-card" ? "transfer" : "unknown";
  if (signedAmountCents < 0) return "expense";
  if (signedAmountCents > 0 || CREDIT_TYPES.has(bankType)) return "income";
  return "unknown";
}

function parseAccountBlock(input: {
  block: string;
  kind: "bank" | "credit-card";
  sourceKind: "ofx" | "qfx";
  sourceName: string;
  sourceHash: string;
  fallbackCurrency: string;
  rowOffset: number;
}): { account: ParsedOfxAccount; rows: ImportedSourceRow[]; warnings: string[] } {
  const { ref, last4 } = accountRef(input.block, input.kind);
  const currency = tagValue(input.block, "CURDEF") || input.fallbackCurrency || "CAD";
  const ledgerBalanceCents = centsFromOfx(tagValue(input.block, "BALAMT"));
  const ledgerBalanceDate = dateFromOfx(tagValue(input.block, "DTASOF"));
  const warnings: string[] = [];
  const rows: ImportedSourceRow[] = [];
  const transactionBlocks = tagBlocks(input.block, "STMTTRN");

  transactionBlocks.forEach((block, index) => {
    const date = dateFromOfx(tagValue(block, "DTPOSTED") || tagValue(block, "DTUSER"));
    const signedAmountCents = centsFromOfx(tagValue(block, "TRNAMT"));
    if (!date || signedAmountCents == null || signedAmountCents === 0) {
      warnings.push(`Skipped transaction ${input.rowOffset + index + 1}: invalid date or zero/invalid amount.`);
      return;
    }
    const bankType = (tagValue(block, "TRNTYPE") || "OTHER").toUpperCase();
    const fitId = tagValue(block, "FITID");
    const name = tagValue(block, "NAME") || tagValue(block, "PAYEEID");
    const memo = tagValue(block, "MEMO");
    const reference = tagValue(block, "CHECKNUM") || tagValue(block, "REFNUM");
    const rowFingerprint = stableImportHash([ref, date, signedAmountCents, name, memo, reference, index].join("|"));
    const provenanceId = `ofx:${ref}:${fitId || rowFingerprint}`;
    rows.push({
      id: `IMP-${stableImportHash(`${input.sourceHash}|${provenanceId}|${index}`)}`,
      sourceKind: input.sourceKind,
      sourceName: input.sourceName,
      sourceHash: input.sourceHash,
      provenanceId,
      documentKind: input.kind === "credit-card" ? "credit-card-statement" : "bank-statement",
      accountRef: ref,
      accountLast4: last4,
      currency: currency.toUpperCase(),
      date,
      amountCents: Math.abs(signedAmountCents),
      signedAmountCents,
      suggestedType: inferredType(bankType, signedAmountCents, input.kind),
      bankType,
      note: cleanText([name, memo].filter(Boolean).join(" · "), 240),
      place: cleanText(name, 100),
      fitId,
      extractionConfidence: null,
    });
  });

  return {
    account: {
      accountRef: ref,
      accountLast4: last4,
      kind: input.kind,
      currency: currency.toUpperCase(),
      ledgerBalanceCents,
      ledgerBalanceDate,
    },
    rows,
    warnings,
  };
}

export function parseOfx(source: string, sourceName = "bank.ofx"): ParsedOfxBatch {
  if (!source.trim()) throw new Error("That bank export is empty.");
  if (source.length > MAX_SOURCE_CHARS) throw new Error("That bank export is larger than 50 MB. Split it into smaller date ranges.");
  const body = ofxBody(source.replace(/^\uFEFF/, ""));
  const sourceHash = stableImportHash(body.replace(/\r\n/g, "\n"));
  const sourceKind = sourceName.toLowerCase().endsWith(".qfx") ? "qfx" : "ofx";
  const fallbackCurrency = tagValue(body, "CURDEF") || "CAD";
  const accountInputs = [
    ...tagBlocks(body, "STMTRS").map((block) => ({ block, kind: "bank" as const })),
    ...tagBlocks(body, "CCSTMTRS").map((block) => ({ block, kind: "credit-card" as const })),
  ];
  if (!accountInputs.length) {
    const hasTransactions = tagBlocks(body, "STMTTRN").length > 0;
    if (hasTransactions) accountInputs.push({ block: body, kind: tagValue(body, "CCACCTFROM") ? "credit-card" : "bank" });
  }
  if (!accountInputs.length) throw new Error("No bank or credit-card statement transactions were found in this OFX/QFX file.");

  const accounts: ParsedOfxAccount[] = [];
  const rows: ImportedSourceRow[] = [];
  const warnings: string[] = [];
  for (const input of accountInputs) {
    const parsed = parseAccountBlock({
      ...input,
      sourceKind,
      sourceName: cleanText(sourceName, 160),
      sourceHash,
      fallbackCurrency,
      rowOffset: rows.length,
    });
    accounts.push(parsed.account);
    rows.push(...parsed.rows);
    warnings.push(...parsed.warnings);
  }
  if (!rows.length) throw new Error("The statement contained no usable non-zero transactions.");
  if (tagBlocks(body, "INVSTMTRS").length) warnings.push("Investment trades are not imported yet; only bank and credit-card statement rows were staged.");
  return {
    sourceName: cleanText(sourceName, 160),
    sourceKind,
    sourceHash,
    accounts,
    rows: rows.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)),
    warnings,
  };
}
