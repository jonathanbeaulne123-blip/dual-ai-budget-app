import { describe, expect, it, vi } from "vitest";
import { visionDocumentRows, type VisionDocumentResult } from "../src/core/index.ts";
import { scanFinancialDocument } from "../src/imports/documentScanner.ts";
import { workShiftDraftFromVision, scanShiftReportFile } from "../src/imports/shiftReportDraft.ts";

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
    })).toThrow(/Shift → Today/i);
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

  it("scanShiftReportFile keeps documentHint shift-report and still omits OCR notes", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { documentHint?: string };
      expect(body.documentHint).toBe("shift-report");
      expect(init?.signal).toBe(controller.signal);
      return new Response(JSON.stringify({ ok: true, result: shiftResult }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const file = new File([new Uint8Array([1, 2, 3])], "tips.jpg", { type: "image/jpeg" });
    const mapped = await scanShiftReportFile(file, fetcher as typeof fetch, controller.signal);
    expect(mapped.draft).not.toHaveProperty("note");
    expect(JSON.stringify(mapped)).not.toMatch(/Alex|Priya/i);
  });

  it("forwards an explicit vision provider and omits auto from the request body", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { documentHint?: string; provider?: string };
      expect(body.documentHint).toBe("shift-report");
      expect(body.provider).toBe("openai");
      return new Response(JSON.stringify({ ok: true, provider: "openai", result: shiftResult }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const file = new File([new Uint8Array([4, 5, 6])], "tips.jpg", { type: "image/jpeg" });
    const mapped = await scanShiftReportFile(file, fetcher as typeof fetch, undefined, "openai");
    expect(mapped.provider).toBe("openai");
    expect(mapped.draft?.sales).toBe(1245);

    const autoFetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { provider?: string };
      expect(body.provider).toBeUndefined();
      return new Response(JSON.stringify({ ok: true, provider: "workers-ai", result: shiftResult }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    await scanShiftReportFile(file, autoFetcher as typeof fetch, undefined, "auto");
  });

  it("maps Toast Employee Shift Report food/alcohol classes into Confirm salesByField", () => {
    const mapped = workShiftDraftFromVision({
      documentKind: "shift-report",
      currency: "CAD",
      accountLast4: "",
      rows: [],
      shiftDraft: {
        date: "2026-08-20",
        workedHours: 2.05,
        salesCents: 58_601,
        foodSalesCents: 48_601,
        alcoholSalesCents: 10_000,
        cashTipsCents: 0,
        cardTipsCents: 13_102,
        customersServed: 17,
      },
      warnings: [],
    });
    expect(mapped.draft).toEqual({
      date: "2026-08-20",
      workedHours: 2.05,
      sales: 586.01,
      cashTips: 0,
      cardTips: 131.02,
      customersServed: 17,
      salesByField: { Food: 486.01, Alcohol: 100 },
    });
  });
});
