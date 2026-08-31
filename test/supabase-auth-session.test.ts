import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertPublishableKey,
  authenticatedSupabaseConfig,
  bearerHeaders,
  buildSupabaseGoogleAuthorizeUrl,
  clearSupabaseSession,
  consumeSupabaseAuthRedirect,
  ensureSupabaseSession,
  joinUrlFromInviteToken,
  loadSupabaseSession,
  readHearthAuthConfig,
  resetSupabaseAuthConcurrencyForTests,
  refreshSupabaseSession,
  saveSupabaseSession,
  setSupabaseSessionStore,
  startSupabaseGoogleSignIn,
  supabaseAuthEnabled,
  supabaseSessionMatchesGoogleIdentity,
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
  resetSupabaseAuthConcurrencyForTests();
  vi.useRealTimers();
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
      session_id: "11111111-1111-4111-8111-111111111111",
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
      sessionId: "22222222-2222-4222-8222-222222222222",
      email: "old@example.com",
      googleSubject: "sub-old",
      displayName: "Old",
      expiresAt: 1_000,
    };
    saveSupabaseSession("development", old);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      access_token: jwt({ sub: "auth-user-1", session_id: "33333333-3333-4333-8333-333333333333", email: "new@example.com", exp: 2_000_000_000 }),
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

  it("shares one expired-session refresh across concurrent background callers", async () => {
    setSupabaseSessionStore(memoryStore());
    const old: HearthSupabaseSession = {
      accessToken: jwt({ sub: "old", session_id: "11111111-1111-4111-8111-111111111111", email: "old@example.com", exp: 1 }),
      refreshToken: "refresh-old",
      userId: "old",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: "old@example.com",
      googleSubject: "sub-old",
      displayName: "Old",
      expiresAt: 1_000,
    };
    saveSupabaseSession("development", old);
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const fetcher = vi.fn(() => pending) as unknown as typeof fetch;

    const first = ensureSupabaseSession("development", config, fetcher);
    const second = ensureSupabaseSession("development", config, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    release(new Response(JSON.stringify({
      access_token: jwt({ sub: "auth-user-1", session_id: "22222222-2222-4222-8222-222222222222", email: "new@example.com", exp: 2_000_000_000 }),
      refresh_token: "refresh-new",
      user: { id: "auth-user-1", email: "new@example.com" },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const [left, right] = await Promise.all([first, second]);
    expect(left?.refreshToken).toBe("refresh-new");
    expect(right?.refreshToken).toBe("refresh-new");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not resurrect a session that was cleared while refresh was in flight", async () => {
    setSupabaseSessionStore(memoryStore());
    const old: HearthSupabaseSession = {
      accessToken: jwt({ sub: "old", session_id: "11111111-1111-4111-8111-111111111111", email: "old@example.com", exp: 1 }),
      refreshToken: "refresh-old",
      userId: "old",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: "old@example.com",
      googleSubject: "sub-old",
      displayName: "Old",
      expiresAt: 1_000,
    };
    saveSupabaseSession("development", old);
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const refreshing = refreshSupabaseSession(
      "development",
      old,
      config,
      vi.fn(() => pending) as unknown as typeof fetch,
    );
    clearSupabaseSession("development");
    release(new Response(JSON.stringify({
      access_token: jwt({ sub: "auth-user-1", session_id: "22222222-2222-4222-8222-222222222222", email: "new@example.com", exp: 2_000_000_000 }),
      refresh_token: "refresh-new",
      user: { id: "auth-user-1", email: "new@example.com" },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(refreshing).rejects.toThrow(/session changed/i);
    expect(loadSupabaseSession("development")).toBeNull();
  });

  it.each(["server", "network"] as const)("keeps a newer session when an older refresh loses by %s", async (failure) => {
    setSupabaseSessionStore(memoryStore());
    const old: HearthSupabaseSession = {
      accessToken: "access-old",
      refreshToken: "refresh-old",
      userId: "old",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: "old@example.com",
      googleSubject: "sub-old",
      displayName: "Old",
      expiresAt: 1_000,
    };
    const newer = { ...old, accessToken: "access-new", refreshToken: "refresh-new", expiresAt: Date.now() + 3_600_000 };
    saveSupabaseSession("development", old);
    let release!: (response: Response) => void;
    let fail!: (reason: Error) => void;
    const pending = new Promise<Response>((resolve, reject) => { release = resolve; fail = reject; });
    const refreshing = refreshSupabaseSession(
      "development",
      old,
      config,
      vi.fn(() => pending) as unknown as typeof fetch,
    );
    saveSupabaseSession("development", newer);
    if (failure === "server") release(new Response("expired old refresh", { status: 401 }));
    else fail(new Error("network left"));

    await expect(refreshing).resolves.toEqual(newer);
    expect(loadSupabaseSession("development")).toEqual(newer);
  });

  it("allows only one Supabase Google redirect per page and releases its latch", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    expect(startSupabaseGoogleSignIn("development", "https://kitchen.example", config, navigate)).toBe(true);
    expect(startSupabaseGoogleSignIn("development", "https://kitchen.example", config, navigate)).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(new URL(String(navigate.mock.calls[0]?.[0])).searchParams.has("prompt")).toBe(false);
    await vi.advanceTimersByTimeAsync(15_001);
    expect(startSupabaseGoogleSignIn("development", "https://kitchen.example", config, navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it("forces the Google account chooser for QR invitation entry", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();

    expect(startSupabaseGoogleSignIn(
      "development",
      "https://kitchen.example/",
      config,
      navigate,
      { selectAccount: true },
    )).toBe(true);

    const authorize = new URL(String(navigate.mock.calls[0]?.[0]));
    expect(authorize.pathname).toBe("/auth/v1/authorize");
    expect(authorize.searchParams.get("provider")).toBe("google");
    expect(authorize.searchParams.get("prompt")).toBe("select_account");
  });

  it("uses the user JWT for REST and refuses secret/service-role keys", () => {
    const session: HearthSupabaseSession = {
      accessToken: "user-jwt",
      refreshToken: "refresh",
      userId: "auth-1",
      sessionId: "44444444-4444-4444-8444-444444444444",
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
    expect(supabaseSessionMatchesGoogleIdentity(session, { subject: "sub-1", email: "a@example.com" })).toBe(true);
    expect(supabaseSessionMatchesGoogleIdentity(session, { subject: "different-subject", email: "a@example.com" })).toBe(false);
  });
});
