import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";

const kitchen = "https://hearth-books.jonathan-beaulne123.workers.dev";
const activeEnv = {
  FLINKS_ENABLED: "true",
  FLINKS_ALLOW_PRODUCTION: "false",
  FLINKS_API_BASE_URL: "https://toolbox-api.private.fin.ag",
  FLINKS_CONNECT_BASE_URL: "https://toolbox-iframe.private.fin.ag",
  FLINKS_REDIRECT_ORIGIN: "https://hearth-books.jonathan-beaulne123.workers.dev",
  FLINKS_CUSTOMER_ID: "43387ca6-0391-4c82-857d-70d95f087ecb",
  FLINKS_SECRET_KEY: "s".repeat(32),
  FLINKS_API_KEY: "a".repeat(32),
  FLINKS_CONNECTION_ENCRYPTION_KEY: "e".repeat(32),
  FLINKS_DIGEST_KEY: "d".repeat(32),
  SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  FLINKS_DB: { prepare: vi.fn(() => ({ first: vi.fn(async () => null) })) },
  ASSETS: { fetch: vi.fn() },
};

function request(path = "/bank/flinks/status", method = "GET", origin: string | null = kitchen): Request {
  const headers = new Headers();
  if (origin) headers.set("Origin", origin);
  return new Request(`${kitchen}${path}`, { method, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("Flinks Worker scaffold", () => {
  it("reports an inert Development scaffold and never contacts a provider", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request(), {
      FLINKS_ENABLED: "false",
      FLINKS_ALLOW_PRODUCTION: "false",
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(kitchen);
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: true,
      available: false,
      phase: "scaffold",
      environment: "development-only",
      providerCallsEnabled: false,
      productionAllowed: false,
    }));
    expect(upstream).not.toHaveBeenCalled();
  });

  it("stays locked even if the public flag is flipped before the security boundary exists", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request(), {
      FLINKS_ENABLED: "true",
      FLINKS_ALLOW_PRODUCTION: "true",
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { available: boolean; providerCallsEnabled: boolean; productionAllowed: boolean; detail: string };
    expect(body.available).toBe(false);
    expect(body.providerCallsEnabled).toBe(false);
    expect(body.productionAllowed).toBe(false);
    expect(body.detail).toMatch(/No bank was contacted/i);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("locks every unfinished bank route and rejects a foreign browser origin", async () => {
    expect((await worker.fetch(request("/bank/flinks/connect", "POST"), { ASSETS: { fetch: vi.fn() } })).status).toBe(503);
    expect((await worker.fetch(request("/bank/flinks/status", "GET", "https://evil.example"), { ASSETS: { fetch: vi.fn() } })).status).toBe(403);
  });

  it("retires the raw LoginId sync route before static assets can answer", async () => {
    const assets = { fetch: vi.fn() };
    const response = await worker.fetch(request("/flinks/sync", "POST"), { ASSETS: assets });
    expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(expect.objectContaining({ error: expect.stringMatching(/legacy .* retired/i) }));
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("allows same-origin status without an Origin header and answers preflight narrowly", async () => {
    expect((await worker.fetch(request("/bank/flinks/status", "GET", null), { ASSETS: { fetch: vi.fn() } })).status).toBe(200);
    const preflight = await worker.fetch(request("/bank/flinks/status", "OPTIONS"), { ASSETS: { fetch: vi.fn() } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
    expect(preflight.headers.get("Access-Control-Allow-Headers")).not.toMatch(/Authorization/i);
  });

  it("advertises the sandbox only when every locked binding is present, without contacting Flinks", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request(), activeEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      available: true,
      phase: "sandbox-configured",
      providerCallsEnabled: true,
      productionAllowed: false,
    }));
    expect(upstream).not.toHaveBeenCalled();
  });

  it("requires an exact browser Origin and bearer before D1 or provider access", async () => {
    activeEnv.FLINKS_DB.prepare.mockClear();
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request(`${kitchen}/bank/flinks/sessions`, {
      method: "POST",
      headers: { Origin: kitchen, "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001" }),
    }), activeEnv);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(expect.objectContaining({ error: expect.stringMatching(/Continue with Google/) }));
    expect(activeEnv.FLINKS_DB.prepare).not.toHaveBeenCalled();
    expect(upstream).not.toHaveBeenCalled();
    const preflight = await worker.fetch(request("/bank/flinks/sessions", "OPTIONS"), activeEnv);
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toBe("Accept, Authorization, Content-Type");
  });

  it("accepts only a browser-declared same-origin GET when Origin is omitted", async () => {
    const denied = await worker.fetch(new Request(`${kitchen}/bank/flinks/connections?environment=development&householdId=HH-TEST&memberId=MEM-001`), activeEnv);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ ok: false, error: "origin" });

    const sameOrigin = await worker.fetch(new Request(`${kitchen}/bank/flinks/connections?environment=development&householdId=HH-TEST&memberId=MEM-001`, {
      headers: { "Sec-Fetch-Site": "same-origin", Authorization: "Bearer invalid" },
    }), activeEnv);
    expect(sameOrigin.status).toBe(401);
    expect(await sameOrigin.json()).toEqual(expect.objectContaining({ error: "Hearth could not verify this Google session." }));
  });
});
