import { describe, expect, it, vi } from "vitest";
import { visionDocumentRows, type VisionDocumentResult } from "../src/core/index.ts";
import { scanFinancialDocument } from "../src/imports/documentScanner.ts";
import { workShiftDraftFromVision } from "../src/imports/shiftReportDraft.ts";

const shiftResult = {
  documentKind: "shift-report" as const,
  currency: "CAD",
  accountLast4: "",
  rows: [],
  shiftDraft: {
    date: "2026-08-26",
    workedHours: 7.5,
    salesCents: 124_500,
    cashTipsCents: 4_200,
    cardTipsCents: 8_800,
    customersServed: 42,
    staffingCount: 4,
    eventTag: "sports",
    // Simulate a model that still emits note; mapper + Worker must drop it.
    note: "Worked with Alex and Priya",
  },
  warnings: ["Tip pool line was blurry"],
} as VisionDocumentResult;

describe("shift-report Confirm draft mapping", () => {
  it("maps sanitized vision fields into a Confirm draft and never copies OCR note", () => {
    const mapped = workShiftDraftFromVision(shiftResult);
    expect(mapped.error).toBeUndefined();
    expect(mapped.draft).toEqual({
      date: "2026-08-26",
      workedHours: 7.5,
      sales: 1245,
      cashTips: 42,
      cardTips: 88,
      customersServed: 42,
      staffingCount: 4,
      eventTag: "sports",
    });
    expect(mapped.draft).not.toHaveProperty("note");
    expect(JSON.stringify(mapped)).not.toMatch(/Alex|Priya/i);
    expect(mapped.warnings[0]).toMatch(/blurry/i);
  });

  it("rejects non-shift documents and empty drafts without inventing totals", () => {
    expect(workShiftDraftFromVision({
      ...shiftResult,
      documentKind: "receipt",
      shiftDraft: null,
    }).error).toMatch(/shift report/i);

    expect(workShiftDraftFromVision({
      ...shiftResult,
      // Model may still emit note; typed result forbids it — cast only for this rejection fixture.
      shiftDraft: { note: "only a name" } as VisionDocumentResult["shiftDraft"],
    }).draft).toBeNull();

    expect(workShiftDraftFromVision({
      ...shiftResult,
      shiftDraft: {
        workedHours: 99,
        salesCents: -1,
        customersServed: 9000,
        staffingCount: 0,
        eventTag: "not-a-tag",
      },
    }).draft).toBeNull();
  });

  it("refuses to import shift-report photos as BatchImport ledger rows", () => {
    expect(() => visionDocumentRows({
      result: shiftResult,
      sourceName: "tips.jpg",
      sourceHash: "tips-hash",
    })).toThrow(/Timesheet → Scan shift report/i);
  });

  it("sends documentHint shift-report on the shared camera scan path", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { documentHint?: string };
      expect(body.documentHint).toBe("shift-report");
      return new Response(JSON.stringify({ ok: true, result: shiftResult }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const file = new File([new Uint8Array([9, 8, 7])], "tip-sheet.jpg", { type: "image/jpeg" });
    const scanned = await scanFinancialDocument(file, fetcher as typeof fetch, { documentHint: "shift-report" });
    expect(scanned.result.documentKind).toBe("shift-report");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
