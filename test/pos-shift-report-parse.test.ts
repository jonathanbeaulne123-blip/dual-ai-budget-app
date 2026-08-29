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

  it("keeps card tips blank when only a total is labeled", () => {
    const parsed = parsePosEmployeeShiftReport(`
EMPLOYEE SHIFT REPORT
Clock In: 08/20/2026 04:17PM
Clock Out: 08/20/2026 06:21PM
Total Paid Hours 2.05 HR
TIP SUMMARY
Total Tips 7 $131.02
`);
    expect(parsed.draft).not.toHaveProperty("cashTipsCents");
    expect(parsed.draft).not.toHaveProperty("cardTipsCents");
    expect(parsed.warnings).toContain("Total Tips was visible but Card Tips was not separately labeled; left card tips blank.");
  });

  it("does not calculate card tips from total minus cash or Merchant Owes Employee", () => {
    const parsed = parsePosEmployeeShiftReport(`
EMPLOYEE SHIFT REPORT
Clock In: 08/20/2026 04:17PM
Clock Out: 08/20/2026 06:21PM
Total Paid Hours 2.05 HR
TIP SUMMARY
Cash Tips 1 $20.00
Total Tips 7 $131.02
EMPLOYEE BANK SUMMARY
Merchant Owes Employee $111.02
`);
    expect(parsed.draft?.cashTipsCents).toBe(2_000);
    expect(parsed.draft).not.toHaveProperty("cardTipsCents");
    expect(parsed.warnings).toContain("Total Tips was visible but Card Tips was not separately labeled; left card tips blank.");
    expect(parsed.warnings).toContain("Merchant Owes Employee was visible but is not a labeled Card Tips amount; left card tips blank.");
  });

  it("removes model-invented tip sides when labeled OCR does not contain them", () => {
    const merged = mergeShiftDraftFromOcr({ cashTipsCents: 999, cardTipsCents: 13_102, staffingCount: 4 }, `
EMPLOYEE SHIFT REPORT
Clock In: 08/20/2026 04:17PM
Clock Out: 08/20/2026 06:21PM
Total Paid Hours 2.05 HR
TIP SUMMARY
Total Tips 7 $131.02
`);
    expect(merged.draft).not.toHaveProperty("cashTipsCents");
    expect(merged.draft).not.toHaveProperty("cardTipsCents");
    expect(merged.draft?.staffingCount).toBe(4);
  });

  it("overrides wrong model money fields from strong OCR without wiping model-only keys", () => {
    const merged = mergeShiftDraftFromOcr({
      date: "2026-01-01",
      workedHours: 9.99,
      salesCents: 12,
      cashTipsCents: 999,
      cardTipsCents: 1,
      customersServed: 2,
      staffingCount: 4,
      eventTag: "sports",
    }, TOAST_OCR);
    expect(merged.source).toBe("pos-parser+model");
    expect(merged.draft?.salesCents).toBe(58_601);
    expect(merged.draft?.cardTipsCents).toBe(13_102);
    expect(merged.draft?.customersServed).toBe(17);
    expect(merged.draft?.staffingCount).toBe(4);
    expect(merged.draft?.eventTag).toBe("sports");
  });
});

describe("document scan cost-aware tip sheets", () => {
  it("uses free Workers AI on Auto when the Toast transcript drafts enough totals", async () => {
    const run = vi.fn(async () => ({
      response: {
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
      },
    }));
    const upstream = vi.fn(async () => {
      throw new Error("paid vision should not run when Workers AI is enough");
    });
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
    expect(body.provider).toBe("workers-ai");
    expect(body.result.shiftDraft.salesCents).toBe(58_601);
    expect(body.result.shiftDraft.cardTipsCents).toBe(13_102);
    expect(run).toHaveBeenCalledTimes(1);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("falls back to OpenAI on Auto only when Workers AI returns a weak tip-sheet draft", async () => {
    const run = vi.fn(async () => ({
      response: {
        documentKind: "receipt",
        currency: "CAD",
        accountLast4: "",
        rows: [],
        receiptNumbers: null,
        ocrText: "blurry",
        shiftDraft: null,
        warnings: [],
      },
    }));
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
    expect(run).toHaveBeenCalledTimes(1);
    expect(upstream).toHaveBeenCalledTimes(1);
    const firstCall = upstream.mock.calls.at(0) as [string, RequestInit] | undefined;
    const sent = JSON.parse(String(firstCall?.[1]?.body));
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.max_tokens).toBe(2800);
  });
});
