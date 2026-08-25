import { isValidDateKey, type DateKey } from "../calendar.ts";
import { stableImportHash } from "./hash.ts";
import type { ImportedSourceRow, ImportReviewType, VisionDocumentResult } from "./types.ts";

function safeText(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeType(value: unknown): ImportReviewType {
  return ["expense", "income", "refund", "transfer"].includes(String(value))
    ? value as ImportReviewType
    : "unknown";
}

export function visionDocumentRows(input: {
  result: VisionDocumentResult;
  sourceName: string;
  sourceHash: string;
}): { rows: ImportedSourceRow[]; warnings: string[] } {
  const warnings = [...(Array.isArray(input.result.warnings) ? input.result.warnings.map((item) => safeText(item, 180)) : [])];
  const rows: ImportedSourceRow[] = [];
  const currency = safeText(input.result.currency || "CAD", 8).toUpperCase();
  const accountLast4 = safeText(input.result.accountLast4, 4);
  const accountRef = `camera:${accountLast4 || "unknown"}`;
  for (const [index, item] of (Array.isArray(input.result.rows) ? input.result.rows : []).entries()) {
    const date = safeText(item.date, 10);
    const amountCents = Number(item.amountCents);
    if (!isValidDateKey(date) || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      warnings.push(`Skipped detected row ${index + 1}: date or amount needs a clearer image.`);
      continue;
    }
    const direction = item.direction === "debit" || item.direction === "credit" ? item.direction : "unknown";
    let suggestedType = safeType(item.typeHint);
    if (suggestedType === "unknown") {
      if (input.result.documentKind === "receipt" || input.result.documentKind === "bill") suggestedType = "expense";
      else if (direction === "debit") suggestedType = "expense";
      else if (direction === "credit") suggestedType = "income";
    }
    const merchant = safeText(item.merchant, 100);
    const description = safeText(item.description, 180);
    const reference = safeText(item.reference, 80);
    const rowFingerprint = stableImportHash([date, amountCents, merchant, description, reference, index].join("|"));
    const provenanceId = `vision:${input.sourceHash}:${reference || rowFingerprint}`;
    const confidence = Math.max(0, Math.min(100, Math.round(Number(item.confidence) || 0)));
    rows.push({
      id: `IMP-${stableImportHash(`${input.sourceHash}|${provenanceId}|${index}`)}`,
      sourceKind: "camera",
      sourceName: safeText(input.sourceName, 160),
      sourceHash: input.sourceHash,
      provenanceId,
      documentKind: input.result.documentKind,
      accountRef,
      accountLast4,
      currency,
      date: date as DateKey,
      amountCents,
      signedAmountCents: direction === "debit" ? -amountCents : direction === "credit" ? amountCents : amountCents,
      suggestedType,
      bankType: safeText(item.typeHint, 30).toUpperCase() || "VISION",
      note: safeText([merchant, description].filter(Boolean).join(" · "), 240),
      place: merchant,
      fitId: reference,
      extractionConfidence: confidence,
    });
  }
  if (!rows.length) throw new Error("No usable transaction date and amount were detected. Retake the photo straight-on with the total visible.");
  return { rows, warnings };
}
