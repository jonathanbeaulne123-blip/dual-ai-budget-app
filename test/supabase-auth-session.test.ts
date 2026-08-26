import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertPublishableKey,
  authenticatedSupabaseConfig,
  bearerHeaders,
  buildSupabaseGoogleAuthorizeUrl,
  clearSupabaseSession,
  consumeSupabaseAuthRedirect,
  joinUrlFromInviteToken,
  loadSupabaseSession,
  readHearthAuthConfig,
  refreshSupabaseSession,
  saveSupabaseSession,
  setSupabaseSessionStore,
  supabaseAuthEnabled,
  supabaseSessionFresh,
  type HearthSupabaseSession,
} from "../src/auth/supabaseSession.ts";

function jwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `eyJhbGciOiJub25lIn0.${encoded}.signature`;
}

function memoryStore(): Storage {
  const rows = new Map<string, string>();
  return {
    get length() { return rows.size; },
    clear: () => rows.clear(),
    getItem: (key) => rows.get(key) ?? null,
    key: (index) => [...rows.keys()][index] ?? null,
    removeItem: (key) => { rows.delete(key); },
    setItem: (key, value) => { rows.set(key, value); },
  };
}

const config = { supabaseUrl: "https://example.supabase.co", publishableKey: "sb_publishable_test" };

afterEach(() => {
  setSupabaseSessionStore(null);
  vi.unstubAllEnvs();
});

describe("Supabase Auth browser session", () => {
  it("falls back to the bundled kitchen project when Auth is on and VITE URL/key are empty", () => {
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(supabaseAuthEnabled()).toBe(true);
    expect(readHearthAuthConfig()).toEqual({
      supabaseUrl: "https://tykhocwacaxwquhynkok.supabase.co",
      publishableKey: "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS",
    });
  });
  it("builds a Google authorize URL with an environment-bound return", () => {
    const url = new URL(buildSupabaseGoogleAuthorizeUrl(config, "development", "https://kitchen.example/welcome?from=home"));
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("scopes")).toBe("https://www.googleapis.com/auth/drive.file");
    const redirect = new URL(url.searchParams.get("redirect_to")!);
    expect(redirect.searchParams.get("hearthAuthEnv")).toBe("development");
    expect(redirect.searchParams.get("from")).toBe("home");
  });

  it("consumes an OAuth hash, stores the verified identity, and keeps environments separate", () => {
    setSupabaseSessionStore(memoryStore());
    const accessToken = jwt({
      sub: "auth-user-1",
      email: "JONATHAN@example.com",
      exp: 2_000_000_000,
      user_metadata: { provider_id: "google-sub-1", full_name: "Jonathan" },
    });
    const url = `https://kitchen.example/?hearthAuthEnv=development#access_token=${accessToken}&refresh_token=refresh-1&expires_in=3600`;
    const session = consumeSupabaseAuthRedirect(url);
    expect(session).toMatchObject({
      userId: "auth-user-1",
      email: "jonathan@example.com",
      googleSubject: "google-sub-1",
      displayName: "Jonathan",
    });
    expect(loadSupabaseSession("development")?.accessToken).toBe(accessToken);
    expect(loadSupabaseSession("production")).toBeNull();
    clearSupabaseSession("development");
    expect(loadSupabaseSession("development")).toBeNull();
  });

  it("refreshes an expired session and clears it when refresh is refused", async () => {
    setSupabaseSessionStore(memoryStore());
    const old: HearthSupabaseSession = {
      accessToken: jwt({ sub: "old", email: "old@example.com", exp: 1 }),
      refreshToken: "refresh-old",
      userId: "old",
      email: "old@example.com",
      googleSubject: "sub-old",
      displayName: "Old",
      expiresAt: 1_000,
    };
    saveSupabaseSession("development", old);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      access_token: jwt({ sub: "auth-user-1", email: "new@example.com", exp: 2_000_000_000 }),
      refresh_token: "refresh-new",
      user: { id: "auth-user-1", email: "new@example.com", user_metadata: { provider_id: "google-sub-1" } },
    }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    const refreshed = await refreshSupabaseSession("development", old, config, fetcher);
    expect(refreshed.refreshToken).toBe("refresh-new");
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("grant_type=refresh_token"), expect.objectContaining({ method: "POST" }));
    expect(supabaseSessionFresh(refreshed, 1_000)).toBe(true);

    await expect(refreshSupabaseSession(
      "development",
      refreshed,
      config,
      vi.fn(async () => new Response("no", { status: 401 })) as typeof fetch,
    )).rejects.toThrow(/session expired/i);
    expect(loadSupabaseSession("development")).toBeNull();
  });

  it("uses the user JWT for REST and refuses secret/service-role keys", () => {
    const session: HearthSupabaseSession = {
      accessToken: "user-jwt",
      refreshToken: "refresh",
      userId: "auth-1",
      email: "a@example.com",
      googleSubject: "sub-1",
      displayName: "A",
      expiresAt: Date.now() + 60_000,
    };
    expect(authenticatedSupabaseConfig({ url: "https://example.test", key: "anon" }, session)).toMatchObject({
      accessToken: "user-jwt",
      authUserId: "auth-1",
    });
    expect(bearerHeaders(session, "publishable")).toMatchObject({ Authorization: "Bearer user-jwt" });
    expect(() => assertPublishableKey("service_role-secret")).toThrow(/must never ship/i);
    expect(joinUrlFromInviteToken("https://kitchen.example", "raw-token", "development"))
      .toBe("https://kitchen.example/join?invite=raw-token&env=development");
  });
});
