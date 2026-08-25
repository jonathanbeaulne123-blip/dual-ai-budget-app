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
          documentKind: "receipt",
          currency: "cad",
          accountLast4: "card 1234",
          rows: [{
            date: "2026-08-24", amountCents: 1250, direction: "debit", typeHint: "expense",
            merchant: "Cafe", description: "Lunch", reference: "R-1", confidence: 96,
          }],
          warnings: [],
        }) } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request(), { OPENAI_API_KEY: "test", ASSETS: { fetch: vi.fn() } });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    const body = await response.json() as { ok: boolean; provider: string; result: { accountLast4: string; rows: unknown[] } };
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("openai");
    expect(body.result.accountLast4).toBe("1234");
    expect(body.result.rows).toHaveLength(1);
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
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(200);
    expect((await response.json() as { provider: string }).provider).toBe("anthropic");
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("fails honestly when no image-capable provider answers and never stores the image", async () => {
    const response = await worker.fetch(request(), { ASSETS: { fetch: vi.fn() } });
    expect(response.status).toBe(503);
    const body = await response.json() as { error: string };
    expect(body.error).toMatch(/not saved/i);
  });
});
