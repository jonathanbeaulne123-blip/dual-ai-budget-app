import { describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";

const origin = "https://hearth-books.jonathan-beaulne123.workers.dev";

describe("toast OCR mount at /ocr", () => {
  it("redirects /ocr to /ocr/ and serves health JSON without touching Hearth chat", async () => {
    const assets = { fetch: vi.fn() };
    const redirected = await worker.fetch(new Request(`${origin}/ocr`), { ASSETS: assets });
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get("Location")).toBe(`${origin}/ocr/`);
    expect(assets.fetch).not.toHaveBeenCalled();

    const health = await worker.fetch(new Request(`${origin}/ocr/health`), { ASSETS: assets });
    expect(health.status).toBe(200);
    const body = await health.json();
    expect(body.status).toBe("ok");
    expect(body.engine).toBe("browser");
    expect(body.phases["1_quality"]).toBe("ready");
    expect(body.phases["2_slice"]).toBe("ready");
    expect(body.phases["3_ocr"]).toBe("ready");
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("forwards /ocr/ to the OCR shell asset", async () => {
    const assets = {
      fetch: vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname;
        return new Response(`asset:${path}`, { status: 200, headers: { "Content-Type": "text/html" } });
      }),
    };
    const response = await worker.fetch(new Request(`${origin}/ocr/`), { ASSETS: assets });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset:/ocr/shell.html");
  });
});
