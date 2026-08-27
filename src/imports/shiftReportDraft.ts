import { isShiftEventTag, type ShiftEventTag, type VisionDocumentResult } from "../core/index.ts";
import { scanFinancialDocument } from "./documentScanner.ts";
import type { DocumentVisionProvider } from "./documentScanProvider.ts";
import type { WorkShiftDraft } from "../WorkShiftFlow.tsx";

/**
 * Map a vision shift-report result into a Confirm draft.
 * Invent-nothing: only copies fields the Worker sanitized as readable.
 * Never posts money. OCR notes are omitted (free text can carry names).
 */
export function workShiftDraftFromVision(
  result: VisionDocumentResult,
): { draft: WorkShiftDraft | null; warnings: string[]; error?: string } {
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.map((item) => String(item).replace(/\s+/g, " ").trim().slice(0, 180)).filter(Boolean).slice(0, 12)
    : [];

  if (result.documentKind !== "shift-report") {
    return {
      draft: null,
      warnings,
      error: "That photo did not look like a shift report. Use Shift → Today, or retake a clearer tip sheet.",
    };
  }

  const raw = result.shiftDraft;
  if (!raw || typeof raw !== "object") {
    return {
      draft: null,
      warnings,
      error: "No readable shift totals were detected. Retake straight-on with hours, sales, and tips visible.",
    };
  }

  const draft: WorkShiftDraft = {};
  if (typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) draft.date = raw.date;
  if (typeof raw.workedHours === "number" && Number.isFinite(raw.workedHours) && raw.workedHours > 0 && raw.workedHours <= 24) {
    draft.workedHours = Math.round(raw.workedHours * 100) / 100;
  }
  if (typeof raw.salesCents === "number" && Number.isInteger(raw.salesCents) && raw.salesCents >= 0) {
    draft.sales = raw.salesCents / 100;
  }
  if (typeof raw.cashTipsCents === "number" && Number.isInteger(raw.cashTipsCents) && raw.cashTipsCents >= 0) {
    draft.cashTips = raw.cashTipsCents / 100;
  }
  if (typeof raw.cardTipsCents === "number" && Number.isInteger(raw.cardTipsCents) && raw.cardTipsCents >= 0) {
    draft.cardTips = raw.cardTipsCents / 100;
  }
  if (typeof raw.customersServed === "number" && Number.isInteger(raw.customersServed) && raw.customersServed >= 0 && raw.customersServed <= 5000) {
    draft.customersServed = raw.customersServed;
  }
  if (typeof raw.staffingCount === "number" && Number.isInteger(raw.staffingCount) && raw.staffingCount >= 1 && raw.staffingCount <= 200) {
    draft.staffingCount = raw.staffingCount;
  }
  if (isShiftEventTag(raw.eventTag)) draft.eventTag = raw.eventTag as ShiftEventTag;

  const salesByField: Record<string, number> = {};
  if (typeof raw.foodSalesCents === "number" && Number.isInteger(raw.foodSalesCents) && raw.foodSalesCents >= 0) {
    salesByField.Food = raw.foodSalesCents / 100;
  }
  if (typeof raw.alcoholSalesCents === "number" && Number.isInteger(raw.alcoholSalesCents) && raw.alcoholSalesCents >= 0) {
    salesByField.Alcohol = raw.alcoholSalesCents / 100;
  }
  if (Object.keys(salesByField).length) draft.salesByField = salesByField;
  // Deliberately omit OCR note — free text can leak coworker names into Shared sync.

  if (!Object.keys(draft).length) {
    return {
      draft: null,
      warnings,
      error: "No usable shift fields were readable. Retake with the totals in frame — Confirm still needs your review.",
    };
  }

  if (warnings.length === 0) {
    warnings.push("Draft from camera — review every figure before Confirm. Nothing posts until you Confirm.");
  }
  return { draft, warnings };
}

export async function scanShiftReportFile(
  file: File,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  provider: DocumentVisionProvider = "auto",
): Promise<{ draft: WorkShiftDraft | null; warnings: string[]; error?: string; provider?: string }> {
  const scanned = await scanFinancialDocument(file, fetcher, {
    documentHint: "shift-report",
    provider,
    signal,
  });
  return { ...workShiftDraftFromVision(scanned.result), provider: scanned.provider };
}
