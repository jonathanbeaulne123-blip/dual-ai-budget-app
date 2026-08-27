import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";
import { resetChatRateMemory } from "../workers/herculesGuard.js";

const origin = "https://hearth-books.jonathan-beaulne123.workers.dev";

function request(imageDataUrl = "data:image/jpeg;base64,AA==", requestOrigin: string | null = origin) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (requestOrigin) headers.set("Origin", requestOrigin);
  return new Request(`${origin}/documents/scan`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fileName: "receipt.jpg", mimeType: "image/jpeg", imageDataUrl }),
  });
}

beforeEach(() => resetChatRateMemory());
afterEach(() => vi.unstubAllGlobals());

describe("document detection Worker", () => {
  it("sends the selected image to the existing OpenAI vision provider and returns sanitized structured rows", async () => {
    const upstream = vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body)) as { messages: Array<{ content?: unknown }> };
      expect(JSON.stringify(sent.messages)).toContain("data:image/jpeg;base64,AA==");
      expect(JSON.stringify(sent.messages)).toContain("untrusted data");
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          documentKind: "RECEIPT",
          currency: "cad",
          accountLast4: "card 1234",
          receiptNumbers: {
            lineAmountsCents: [1000], subtotalCents: 1000, discountCents: 0,
            taxCents: 150, tipCents: 100, feeCents: 0, totalCents: 1250,
          },
          rows: [{
            date: "2026-08-24", amountCents: 1250, direction: "debit", typeHint: "expense",
            merchant: "Cafe", description: "Insulin · Paid with 4111 1111 1111 1111", reference: "Organic milk 1234567890123456", confidence: 96,
          }],
          warnings: ["Prescription item Account 987654321 was visible"],
        }) } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request(), {
      OPENAI_API_KEY: "test",
      HERCULES_ALLOW_PAID_PROVIDERS: "true",
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    const body = await response.json() as { ok: boolean; provider: string; result: { accountLast4: string; receiptNumbers: { lineAmountsCents: number[]; totalCents: number }; rows: Array<{ description: string; reference: string }>; warnings: string[] } };
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("openai");
    expect(body.result.accountLast4).toBe("1234");
    expect(body.result.rows).toHaveLength(1);
    expect(body.result.receiptNumbers).toEqual(expect.objectContaining({ lineAmountsCents: [1000], totalCents: 1250 }));
    expect(JSON.stringify((JSON.parse(String(upstream.mock.calls[0]?.[1]?.body)) as { messages: unknown }).messages)).toContain("never item names");
    expect(JSON.stringify(body.result)).not.toMatch(/4111 1111 1111 1111|1234567890123456|987654321/);
    expect(body.result.rows[0]?.description).toBe("Receipt total");
    expect(body.result.rows[0]?.reference).toBe("");
    expect(body.result.warnings).toEqual([]);
    expect(JSON.stringify(body.result)).not.toMatch(/Insulin|Organic milk|Prescription item/i);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("rejects missing/foreign origins and invalid images before any provider call", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect((await worker.fetch(request(undefined, null), { OPENAI_API_KEY: "test" })).status).toBe(403);
    expect((await worker.fetch(request(undefined, "https://evil.example"), { OPENAI_API_KEY: "test" })).status).toBe(403);
    expect((await worker.fetch(request("data:image/gif;base64,AA=="), { OPENAI_API_KEY: "test" })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("uses the existing Anthropic image fallback when OpenAI does not answer", async () => {
    const upstream = vi.fn(async (url: string) => {
      if (url.includes("openai.com")) return new Response("quiet", { status: 503 });
      return new Response(JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({
          documentKind: "bill",
          currency: "CAD",
          accountLast4: "",
          rows: [{
            date: "2026-08-25", amountCents: 8999, direction: "debit", typeHint: "expense",
            merchant: "Hydro", description: "Amount due", reference: "B-1", confidence: 94,
          }],
          warnings: [],
        }) }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request(), {
      OPENAI_API_KEY: "openai-test",
      ANTHROPIC_API_KEY: "anthropic-test",
      HERCULES_ALLOW_PAID_PROVIDERS: "true",
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(200);
    expect((await response.json() as { provider: string }).provider).toBe("anthropic");
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("uses the bound Workers AI vision model when third-party providers are unavailable", async () => {
    const run = vi.fn(async (_model: string, input: { image?: string; response_format?: unknown }) => {
      expect(input.image).toBe("data:image/jpeg;base64,AA==");
      expect(input.response_format).toEqual(expect.objectContaining({ type: "json_schema" }));
      return {
        response: {
          documentKind: "receipt",
          currency: "CAD",
          accountLast4: "4821",
          receiptNumbers: {
            lineAmountsCents: [], subtotalCents: null, discountCents: 0,
            taxCents: 0, tipCents: 0, feeCents: 0, totalCents: 903,
          },
          rows: [{
            date: "2026-08-25", amountCents: 903, direction: "debit", typeHint: "expense",
            merchant: "Maple Corner Market", description: "Receipt total", reference: "QA-1", confidence: 97,
          }],
          warnings: [],
        },
      };
    });
    const response = await worker.fetch(request(), { AI: { run }, ASSETS: { fetch: vi.fn() } });
    expect(response.status).toBe(200);
    const body = await response.json() as { provider: string; result: { rows: Array<{ amountCents: number }>; receiptNumbers: { subtotalCents: number | null } } };
    expect(body.provider).toBe("workers-ai");
    expect(body.result.rows[0]?.amountCents).toBe(903);
    expect(body.result.receiptNumbers.subtotalCents).toBeNull();
    expect(run).toHaveBeenCalledWith("@cf/google/gemma-4-26b-a4b-it", expect.any(Object));
  });

  it("fails honestly when no image-capable provider answers and never stores the image", async () => {
    const response = await worker.fetch(request(), { ASSETS: { fetch: vi.fn() } });
    expect(response.status).toBe(503);
    const body = await response.json() as { error: string };
    expect(body.error).toMatch(/not saved/i);
  });

  it("uses free Workers AI first and does not contact paid providers even when their keys exist", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const run = vi.fn(async () => ({ response: JSON.stringify({
      documentKind: "statement",
      currency: "CAD",
      accountLast4: "9988",
      rows: [{
        date: "2026-08-25", amountCents: 4200, direction: "debit", typeHint: "expense",
        merchant: "Fresh Market", description: "Groceries", reference: "FREE-1", confidence: 91,
      }],
      warnings: [],
    }) }));
    const response = await worker.fetch(request(), {
      AI: { run },
      OPENAI_API_KEY: "present-but-disabled",
      ANTHROPIC_API_KEY: "present-but-disabled",
      HERCULES_ALLOW_PAID_PROVIDERS: "false",
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(200);
    expect((await response.json() as { provider: string }).provider).toBe("workers-ai");
    expect(run).toHaveBeenCalledWith("@cf/google/gemma-4-26b-a4b-it", expect.any(Object));
    expect(upstream).not.toHaveBeenCalled();
  });

  it("fails closed instead of spending when only paid provider keys are available", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request(), {
      OPENAI_API_KEY: "present-but-disabled",
      ANTHROPIC_API_KEY: "present-but-disabled",
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("sanitizes shift-report drafts, drops OCR notes, and honors documentHint", async () => {
    const run = vi.fn(async (_model: string, input: { messages?: Array<{ content?: string }> }) => {
      expect(JSON.stringify(input.messages)).toMatch(/Prefer documentKind shift-report/i);
      expect(JSON.stringify(input.messages)).toMatch(/Shift → Today/i);
      expect(JSON.stringify(input.messages)).not.toMatch(/from Timesheet/i);
      return {
        response: {
          documentKind: "shift-report",
          currency: "CAD",
          accountLast4: "",
          rows: [{
            date: "2026-08-26", amountCents: 999, direction: "debit", typeHint: "expense",
            merchant: "Should drop", description: "ledger bait", reference: "X", confidence: 10,
          }],
          receiptNumbers: null,
          shiftDraft: {
            date: "2026-08-26",
            workedHours: 6.25,
            salesCents: 88_000,
            cashTipsCents: 2_500,
            cardTipsCents: 6_100,
            customersServed: 31,
            staffingCount: 3,
            eventTag: "short_staffed",
            note: "Covered for Jordan",
          },
          warnings: ["Pool line faint"],
        },
      };
    });
    const response = await worker.fetch(new Request(`${origin}/documents/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        fileName: "tips.jpg",
        mimeType: "image/jpeg",
        imageDataUrl: "data:image/jpeg;base64,AA==",
        documentHint: "shift-report",
      }),
    }), { AI: { run }, ASSETS: { fetch: vi.fn() } });
    expect(response.status).toBe(200);
    const body = await response.json() as {
      ok: boolean;
      result: {
        documentKind: string;
        rows: unknown[];
        shiftDraft?: Record<string, unknown>;
        warnings: string[];
      };
    };
    expect(body.ok).toBe(true);
    expect(body.result.documentKind).toBe("shift-report");
    expect(body.result.rows).toEqual([]);
    expect(body.result.shiftDraft).toEqual({
      date: "2026-08-26",
      workedHours: 6.25,
      salesCents: 88_000,
      cashTipsCents: 2_500,
      cardTipsCents: 6_100,
      customersServed: 31,
      staffingCount: 3,
      eventTag: "short_staffed",
    });
    expect(body.result.shiftDraft).not.toHaveProperty("note");
    expect(JSON.stringify(body.result)).not.toMatch(/Jordan|Should drop|ledger bait/i);
    expect(body.result.warnings[0]).toMatch(/Pool line faint/i);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
