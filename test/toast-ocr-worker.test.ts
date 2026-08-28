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
    expect(body.phases["4_merge"]).toBe("ready");
    expect(body.phases["5_export"]).toBe("ready");
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
    expect(response.headers.get("Content-Security-Policy")).toBe("frame-ancestors *");
    expect(response.headers.get("Permissions-Policy")).toBe("camera=(self)");
  });

  it("ships the embed loader and postMessage bridge in public assets", async () => {
    const { readFileSync } = await import("node:fs");
    const embed = readFileSync(new URL("../public/ocr/embed.js", import.meta.url), "utf8");
    expect(embed).toContain("ToastOcr");
    expect(embed).toContain("function mount");
    const app = readFileSync(new URL("../public/ocr/app.js", import.meta.url), "utf8");
    expect(app).toContain("toast-ocr:result");
    expect(app).toContain('params.get("embed")');
    expect(app).toContain("classList.add(\"embed\")");
  });

  it("serves embed.js and allows foreign sites to frame /ocr assets", async () => {
    const assets = {
      fetch: vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/ocr/embed.js") {
          return new Response("window.ToastOcr={mount(){}}", {
            status: 200,
            headers: { "Content-Type": "application/javascript" },
          });
        }
        return new Response(`asset:${path}`, { status: 200, headers: { "Content-Type": "text/html" } });
      }),
    };
    const js = await worker.fetch(new Request(`${origin}/ocr/embed.js`), { ASSETS: assets });
    expect(js.status).toBe(200);
    expect(await js.text()).toContain("ToastOcr");
    expect(js.headers.get("Content-Type")).toMatch(/javascript/);
    expect(js.headers.get("Content-Security-Policy")).toBe("frame-ancestors *");
    expect(js.headers.get("Permissions-Policy")).toBe("camera=(self)");

    const demo = await worker.fetch(new Request(`${origin}/ocr/embed-demo.html`), { ASSETS: assets });
    expect(demo.status).toBe(200);
    expect(await demo.text()).toBe("asset:/ocr/embed-demo.html");
    expect(demo.headers.get("Content-Security-Policy")).toBe("frame-ancestors *");
  });
});
