import { describe, expect, it, vi } from "vitest";
import { clearLegacyFlinksLoginStorage, readFlinksScaffoldStatus, startFlinksConnect } from "../src/imports/flinksClient.ts";

function response(overrides: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({
    ok: true,
    available: false,
    phase: "scaffold",
    environment: "development-only",
    providerCallsEnabled: false,
    productionAllowed: false,
    detail: "No bank was contacted.",
    ...overrides,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("Flinks scaffold client", () => {
  it("removes every legacy raw LoginId key from browser storage", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
    });
    localStorage.setItem("hearth.flinks.loginId", "raw-login-id");
    localStorage.setItem("flinksLoginId", "raw-login-id");
    localStorage.setItem("hearth.flinks.connect.loginId", "raw-login-id");
    clearLegacyFlinksLoginStorage();
    expect(localStorage.getItem("hearth.flinks.loginId")).toBeNull();
    expect(localStorage.getItem("flinksLoginId")).toBeNull();
    expect(localStorage.getItem("hearth.flinks.connect.loginId")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("accepts only the exact inert Development status", async () => {
    const fetcher = vi.fn(async () => response());
    await expect(readFlinksScaffoldStatus(fetcher)).resolves.toEqual(expect.objectContaining({
      ok: true,
      available: false,
      environment: "development-only",
      providerCallsEnabled: false,
      productionAllowed: false,
    }));
  });

  it.each([
    ["unsuccessful", { ok: false }],
    ["wrong environment", { environment: "production" }],
    ["provider enabled", { providerCallsEnabled: true }],
    ["Production allowed", { productionAllowed: true }],
  ])("rejects an unsafe %s response", async (_label, override) => {
    await expect(readFlinksScaffoldStatus(async () => response(override))).rejects.toThrow(/unsafe or invalid status/);
  });

  it("requires a Development Google session before creating a Connect session", async () => {
    const fetcher = vi.fn();
    await expect(startFlinksConnect({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001" }, undefined, fetcher, async () => null))
      .rejects.toThrow(/Continue with Google/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts only the exact Toolbox iframe origin and sends the bearer server-side", async () => {
    const callback = `https://hearth-books.jonathan-beaulne123.workers.dev/bank/flinks/callback?state=${"s".repeat(32)}`;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      connectionId: "connection_12345678901234567890",
      iframeUrl: `https://toolbox-iframe.private.fin.ag/v2/?demo=true&jsRedirect=true&accountSelectorEnable=true&accountSelectorCurrency=cad&fetchAllAccounts=false&authorizeToken=one-use&redirectUrl=${encodeURIComponent(callback)}`,
      messageOrigin: "https://toolbox-iframe.private.fin.ag",
      expiresAt: "2026-08-26T18:00:00.000Z",
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    await expect(startFlinksConnect(
      { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" },
      undefined,
      fetcher,
      async () => ({ accessToken: "jwt", refreshToken: "refresh", userId: "user", email: "test@example.com", googleSubject: "google", displayName: "Test", expiresAt: Date.now() + 60_000 }),
    )).resolves.toEqual(expect.objectContaining({ connectionId: "connection_12345678901234567890" }));
    expect(fetcher).toHaveBeenCalledWith("/bank/flinks/sessions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
    }));
  });
});
