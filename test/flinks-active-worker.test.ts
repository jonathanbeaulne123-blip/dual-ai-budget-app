import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";
import { resetChatRateMemory } from "../workers/herculesGuard.js";

const origin = "https://hearth-books.jonathan-beaulne123.workers.dev";

beforeEach(() => resetChatRateMemory());
afterEach(() => vi.unstubAllGlobals());

describe("active flinks worker routing", () => {
  it("handles /bank/flinks before asset fallback and rejects missing auth", async () => {
    const response = await worker.fetch(new Request(`${origin}/bank/flinks/status`, {
      method: "GET",
      headers: { Origin: origin },
    }), {
      FLINKS_DB: { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({ success: true }) }) }) },
      ASSETS: { fetch: vi.fn(async () => new Response("<html>Hearth</html>", { headers: { "Content-Type": "text/html" } })) },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const text = await response.text();
    expect(text).not.toContain("<html");
  });
});
