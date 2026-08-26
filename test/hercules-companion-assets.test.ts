import { describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";

function assetEnvironment(body = "public companion asset") {
  return {
    ASSETS: {
      fetch: vi.fn(async () => new Response(body, {
        headers: { "Content-Type": "application/octet-stream" },
      })),
    },
  };
}

describe("Hercules Pro companion assets", () => {
  it.each([
    "/hercules-pro/companion.v1.js",
    "/hercules-pro/hercules.pro.v1.glb",
    "/hercules-mark.svg",
  ])("exposes %s to the ChatGPT sandbox without buffering it", async (pathname) => {
    const env = assetEnvironment();
    const response = await worker.fetch(new Request(`https://hearth.example${pathname}`), env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("public companion asset");
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
  });

  it("does not broaden cross-origin access to unrelated site assets", async () => {
    const env = assetEnvironment();
    const response = await worker.fetch(new Request("https://hearth.example/assets/app.js"), env);

    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    expect(response.headers.has("Cross-Origin-Resource-Policy")).toBe(false);
  });
});
