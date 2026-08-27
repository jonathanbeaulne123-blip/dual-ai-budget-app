import { describe, expect, it, vi } from "vitest";
import { mergeShiftDraftFromOcr, parsePosEmployeeShiftReport } from "../workers/shiftReportParse.js";
import worker from "../workers/site.js";

const TOAST_OCR = `
EMPLOYEE SHIFT REPORT
Clock In: 08/20/2026 04:17PM
Clock Out: 08/20/2026 06:21PM
Total Paid Hours 2.05 HR
BUSINESS TRENDS
Headcount 17
Avg. Head $34.47
Closed Tickets 7
SALES SUMMARY
Gross Sales $586.01
Net Sales $586.01
SALES BY REVENUE CLASS
Food 17 $486.01
Liquor 3 $48.00
Beverage 5 $33.00
Wine 1 $19.00
Non-Sales Revenue 1 $0.00
Total Sales 27 $586.01
CREDIT CARD PAYMENTS
Total Tips $91.74
TIP SUMMARY
Debit Tips 3 $39.28
Amex Tips 1 $28.68
Visa Tips 2 $36.50
Mastercard Tips 1 $26.56
Cash Tips 0 $0.00
Total Tips 7 $131.02
EMPLOYEE BANK SUMMARY
Merchant Owes Employee $131.02
`;

describe("Toast Employee Shift Report parser", () => {
  it("reads labeled tip-sheet totals without inventing staffing", () => {
    const parsed = parsePosEmployeeShiftReport(TOAST_OCR);
    expect(parsed.confidence).toBe("high");
    expect(parsed.draft).toEqual({
      date: "2026-08-20",
      workedHours: 2.05,
      salesCents: 58_601,
      foodSalesCents: 48_601,
      alcoholSalesCents: 10_000,
      cashTipsCents: 0,
      cardTipsCents: 13_102,
      customersServed: 17,
    });
    expect(parsed.draft).not.toHaveProperty("staffingCount");
  });

  it("prefers Tip Summary over incomplete Credit Card Payments tip total", () => {
    const parsed = parsePosEmployeeShiftReport(TOAST_OCR);
    expect(parsed.draft?.cardTipsCents).toBe(13_102);
    expect(parsed.draft?.cardTipsCents).not.toBe(9_174);
  });

  it("overrides a wrong model draft when OCR text is strong", () => {
    const merged = mergeShiftDraftFromOcr({
      date: "2026-01-01",
      workedHours: 9.99,
      salesCents: 12,
      cashTipsCents: 999,
      cardTipsCents: 1,
      customersServed: 2,
    }, TOAST_OCR);
    expect(merged.source).toBe("pos-parser");
    expect(merged.draft?.salesCents).toBe(58_601);
    expect(merged.draft?.cardTipsCents).toBe(13_102);
    expect(merged.draft?.customersServed).toBe(17);
  });
});

describe("document scan prefers paid vision for shift reports", () => {
  it("calls OpenAI before Workers AI when DOCUMENT_SCAN_ALLOW_PAID is on", async () => {
    const run = vi.fn(async () => {
      throw new Error("workers-ai should not win first");
    });
    const upstream = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        documentKind: "shift-report",
        currency: "CAD",
        accountLast4: "",
        rows: [],
        receiptNumbers: null,
        ocrText: TOAST_OCR,
        shiftDraft: {
          date: "2026-08-20",
          workedHours: 2.05,
          salesCents: 58601,
          foodSalesCents: 48601,
          alcoholSalesCents: 10000,
          cashTipsCents: 0,
          cardTipsCents: 13102,
          customersServed: 17,
        },
        warnings: [],
      }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", upstream);
    const origin = "https://hearth-books.jonathan-beaulne123.workers.dev";
    const response = await worker.fetch(new Request(`${origin}/documents/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        fileName: "tips.jpg",
        mimeType: "image/jpeg",
        imageDataUrl: "data:image/jpeg;base64,AA==",
        documentHint: "shift-report",
      }),
    }), {
      AI: { run },
      OPENAI_API_KEY: "scan-key",
      DOCUMENT_SCAN_ALLOW_PAID: "true",
      DOCUMENT_SCAN_OPENAI_MODEL: "gpt-4o",
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { provider: string; result: { shiftDraft: Record<string, number> } };
    expect(body.provider).toBe("openai");
    expect(body.result.shiftDraft.salesCents).toBe(58_601);
    expect(body.result.shiftDraft.cardTipsCents).toBe(13_102);
    expect(body.result.shiftDraft.customersServed).toBe(17);
    expect(run).not.toHaveBeenCalled();
    const sent = JSON.parse(String(upstream.mock.calls[0]?.[1]?.body));
    expect(sent.model).toBe("gpt-4o");
  });
});
