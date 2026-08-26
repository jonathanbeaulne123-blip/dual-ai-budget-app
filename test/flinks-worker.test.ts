import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";
import { digestFlinksId, handleFlinks } from "../workers/flinks.js";
import { resetChatRateMemory } from "../workers/herculesGuard.js";

const origin = "https://hearth-books.jonathan-beaulne123.workers.dev";

function createMockD1() {
  const connections = new Map();
  const sessions = new Map();
  return {
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => ({
          async first() {
            if (sql.includes("FROM flinks_connections")) {
              return connections.get(String(args[0])) ?? null;
            }
            if (sql.includes("FROM flinks_connect_sessions")) {
              return sessions.get(String(args[0])) ?? null;
            }
            return null;
          },
          async run() {
            if (sql.includes("INSERT INTO flinks_connections")) {
              connections.set(String(args[0]), {
                encrypted_blob: args[1],
                institution: args[2],
                account_label: args[3],
                account_last4: args[4],
                currency: args[5],
              });
            }
            if (sql.includes("INSERT INTO flinks_connect_sessions")) {
              sessions.set(String(args[0]), {
                member_key: args[1],
                state_nonce: args[2],
                iframe_origin: args[3],
                expires_at: args[4],
              });
            }
            if (sql.includes("DELETE FROM flinks_connections")) connections.delete(String(args[0]));
            if (sql.includes("DELETE FROM flinks_connect_sessions")) sessions.delete(String(args[0]));
            return { success: true };
          },
        }),
      };
    },
  };
}

function env(overrides: Record<string, unknown> = {}) {
  return {
    FLINKS_DB: createMockD1(),
    FLINKS_CUSTOMER_ID: "customer-id",
    FLINKS_API_KEY: "api-key",
    FLINKS_SECRET_KEY: "secret-key",
    FLINKS_CONNECTION_ENCRYPTION_KEY: "connection-encryption-key-123456",
    FLINKS_DIGEST_KEY: "digest-key-1234567890",
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    ASSETS: { fetch: vi.fn(async () => new Response("<html>Hearth</html>", { headers: { "Content-Type": "text/html" } })) },
    ...overrides,
  };
}

function request(path: string, init: RequestInit = {}, requestOrigin: string | null = origin) {
  const headers = new Headers(init.headers ?? {});
  if (requestOrigin) headers.set("Origin", requestOrigin);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  return new Request(`${origin}${path}`, { ...init, headers });
}

beforeEach(() => resetChatRateMemory());
afterEach(() => vi.unstubAllGlobals());

describe("secure flinks worker", () => {
  it("returns JSON for /bank/flinks/status instead of falling through to SPA assets", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "auth-user", email: "demo@example.com" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/rest/v1/continuity_memberships")) {
        return new Response(JSON.stringify([{ household_id: "HH-1", member_id: "MEM-002" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
    const response = await worker.fetch(
      request("/bank/flinks/status?environment=development&householdId=HH-1&memberId=MEM-002", {
        method: "GET",
        headers: { Authorization: "Bearer user-jwt" },
      }),
      env(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const body = await response.json() as { ok: boolean; configured: boolean; connected: boolean };
    expect(body.ok).toBe(true);
    expect(body.configured).toBe(true);
    expect(body.connected).toBe(false);
    expect(JSON.stringify(body)).not.toContain("<html");
  });

  it("retires /flinks/sync with 410", async () => {
    const response = await handleFlinks(request("/flinks/sync", { method: "POST", body: JSON.stringify({ loginId: "legacy" }) }), env());
    expect(response?.status).toBe(410);
    const payload = await response?.json() as { error: string };
    expect(payload.error).toMatch(/retired/i);
  });

  it("redacts provider ids with stable digests before browser return", async () => {
    const digest = await digestFlinksId(env(), "tx", "provider-tx-1");
    expect(digest.startsWith("flinks:tx:")).toBe(true);
    expect(digest).not.toContain("provider-tx-1");
  });
});
