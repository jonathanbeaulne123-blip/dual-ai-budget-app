// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLegacyFlinksLoginStorage,
  completeFlinksConnect,
  disconnectFlinks,
  fetchFlinksStatus,
  importFlinksInbox,
  isFlinksRedirectMessage,
  startFlinksConnect,
  LEGACY_FLINKS_LOGIN_STORAGE_KEY,
} from "../src/imports/flinksClient.ts";
import type { HearthSupabaseSession } from "../src/auth/supabaseSession.ts";

const session: HearthSupabaseSession = {
  accessToken: "user-jwt",
  refreshToken: "refresh",
  userId: "auth-user",
  email: "demo@example.com",
  googleSubject: "google-subject",
  displayName: "Demo",
  expiresAt: Date.now() + 60_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
  clearLegacyFlinksLoginStorage();
});

describe("flinks client", () => {
  it("clears legacy LoginId storage once", () => {
    localStorage.setItem(LEGACY_FLINKS_LOGIN_STORAGE_KEY, "legacy-login");
    clearLegacyFlinksLoginStorage();
    expect(localStorage.getItem(LEGACY_FLINKS_LOGIN_STORAGE_KEY)).toBeNull();
  });

  it("accepts REDIRECT messages only from the expected iframe origin", () => {
    expect(isFlinksRedirectMessage(
      { step: "REDIRECT", loginId: "secret" },
      "https://toolbox-iframe.private.fin.ag",
      "https://toolbox-iframe.private.fin.ag",
    )).toBe(true);
    expect(isFlinksRedirectMessage(
      { step: "REDIRECT", loginId: "secret" },
      "https://toolbox-iframe.private.fin.ag",
      "https://evil.example",
    )).toBe(false);
  });

  it("sends bearer auth and member scope to the secure Worker routes", async () => {
    const fetcher = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/bank/flinks/status?environment=development&householdId=HH-1&memberId=MEM-002")) {
        return new Response(JSON.stringify({
          ok: true,
          configured: true,
          connected: true,
          institution: "TD Demo",
          accountLabel: "Chequing",
          accountLast4: "4821",
          currency: "CAD",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/bank/flinks/import")) {
        return new Response(JSON.stringify({
          ok: true,
          inbox: {
            institution: "TD Demo",
            sourceHash: "digest-batch",
            accounts: [{
              accountRef: "flinks:account:abc",
              accountLast4: "4821",
              title: "Chequing",
              type: "Chequing",
              category: "Operations",
              currency: "CAD",
              balanceCents: 100,
            }],
            transactions: [{
              accountRef: "flinks:account:abc",
              provenanceId: "flinks:tx:1",
              date: "2026-08-20",
              description: "NO FRILLS",
              debitCents: 100,
              creditCents: null,
            }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    const status = await fetchFlinksStatus({
      environment: "development",
      householdId: "HH-1",
      memberId: "MEM-002",
      session,
    }, fetcher as typeof fetch);
    expect(status.connected).toBe(true);
    const imported = await importFlinksInbox({
      environment: "development",
      householdId: "HH-1",
      memberId: "MEM-002",
      session,
    }, fetcher as typeof fetch);
    expect(imported.batch.rows).toHaveLength(1);
    expect(JSON.stringify(imported.inbox)).not.toMatch(/LoginId|RequestId/i);
  });

  it("completes connect without persisting provider ids locally", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo) => new Response(JSON.stringify({
      ok: true,
      sessionId: "sess-1",
      stateNonce: "nonce-1",
      iframeOrigin: "https://toolbox-iframe.private.fin.ag",
      iframeUrl: "https://toolbox-iframe.private.fin.ag/?demo=true",
      redirectUrl: "https://localhost/import/flinks/callback",
      expiresAt: 9999999999,
      connected: true,
      institution: "TD Demo",
      accountLabel: "Chequing",
      accountLast4: "4821",
      currency: "CAD",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const started = await startFlinksConnect({
      environment: "development",
      householdId: "HH-1",
      memberId: "MEM-002",
      session,
    }, fetcher as typeof fetch);
    expect(started.sessionId).toBe("sess-1");
    const completed = await completeFlinksConnect({
      environment: "development",
      householdId: "HH-1",
      memberId: "MEM-002",
      session,
      sessionId: started.sessionId,
      stateNonce: started.stateNonce,
      iframeOrigin: started.iframeOrigin,
      message: { step: "REDIRECT", loginId: "provider-login", institution: "TD Demo", accountLast4: "4821" },
    }, fetcher as typeof fetch);
    expect(completed.connected).toBe(true);
    expect(localStorage.getItem(LEGACY_FLINKS_LOGIN_STORAGE_KEY)).toBeNull();
    await disconnectFlinks({
      environment: "development",
      householdId: "HH-1",
      memberId: "MEM-002",
      session,
    }, fetcher as typeof fetch);
    expect(fetcher).toHaveBeenCalled();
  });
});
