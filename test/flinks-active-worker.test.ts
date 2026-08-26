import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";

const kitchen = "https://hearth-books.jonathan-beaulne123.workers.dev";
const loginId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

type Stored = Record<string, unknown>;

class FakeD1 {
  row: Stored | null = null;

  prepare(sql: string) {
    const db = this;
    return {
      bind(...values: unknown[]) {
        return {
          async first() {
            return sql.startsWith("SELECT") ? db.row : null;
          },
          async run() {
            if (sql.startsWith("INSERT")) {
              db.row = {
                connection_id: values[0], environment: values[1], auth_user_id: values[2], household_id: values[3], member_id: values[4],
                state: "authorizing", state_version: 1, key_version: 1,
                sealed_private: values[5], created_at: values[6], updated_at: values[7], expires_at: values[8], last_poll_at: null,
                poll_lease_id: null, poll_lease_until: null,
              };
            } else if (db.row && sql.includes("SET state = 'completing'")) {
              db.row.state = "completing";
              db.row.state_version = Number(db.row.state_version) + 1;
              db.row.sealed_private = values[0];
            } else if (db.row && sql.includes("SET state = 'polling'")) {
              db.row.state = "polling";
              db.row.state_version = Number(db.row.state_version) + 1;
              db.row.sealed_private = values[0];
              db.row.poll_lease_id = values[1];
              db.row.poll_lease_until = values[2];
              db.row.last_poll_at = values[3];
              db.row.updated_at = values[4];
              db.row.expires_at = values[5];
            } else if (db.row && sql.includes("SET state = 'ready'")) {
              db.row.state = "ready";
              db.row.state_version = Number(db.row.state_version) + 1;
              db.row.poll_lease_id = null;
              db.row.poll_lease_until = null;
            } else if (db.row && sql.includes("SET state = 'expired'")) {
              db.row.state = "expired";
              db.row.state_version = Number(db.row.state_version) + 1;
              db.row.sealed_private = null;
              db.row.updated_at = values[0];
            } else if (db.row && sql.includes("SET state = 'revoking'")) {
              db.row.state = "revoking";
            } else if (db.row && sql.includes("SET state = 'revoked'")) {
              db.row.state = "revoked";
              db.row.sealed_private = null;
              db.row.revoked_at = values[1];
            }
            return { meta: { changes: 1 } };
          },
          async all() {
            if (!sql.startsWith("SELECT") || !db.row || ["revoked", "expired"].includes(String(db.row.state))) return { results: [] };
            return { results: [{ connection_id: db.row.connection_id, state: db.row.state, updated_at: db.row.updated_at }] };
          },
        };
      },
    };
  }
}

function env(db: FakeD1) {
  return {
    FLINKS_ENABLED: "true",
    FLINKS_ALLOW_PRODUCTION: "false",
    FLINKS_API_BASE_URL: "https://toolbox-api.private.fin.ag",
    FLINKS_CONNECT_BASE_URL: "https://toolbox-iframe.private.fin.ag",
    FLINKS_REDIRECT_ORIGIN: "https://hearth-books.jonathan-beaulne123.workers.dev",
    FLINKS_CUSTOMER_ID: "43387ca6-0391-4c82-857d-70d95f087ecb",
    FLINKS_SECRET_KEY: "secret-key-".repeat(4),
    FLINKS_API_KEY: "api-key-".repeat(5),
    FLINKS_CONNECTION_ENCRYPTION_KEY: "encrypt-key-".repeat(4),
    FLINKS_DIGEST_KEY: "digest-key-".repeat(4),
    SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
    FLINKS_DB: db,
    ASSETS: { fetch: vi.fn() },
  };
}

function api(path: string, init: RequestInit): Request {
  return new Request(`${kitchen}${path}`, {
    ...init,
    headers: { Origin: kitchen, Authorization: "Bearer signed-user-jwt", Accept: "application/json", ...(init.headers || {}) },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("authenticated Flinks Toolbox Worker", () => {
  it("expires abandoned pre-login sessions instead of blocking the next connection", async () => {
    const db = new FakeD1();
    db.row = {
      connection_id: "connection_12345678901234567890",
      environment: "development",
      auth_user_id: "auth-user-1",
      household_id: "HH-TEST",
      member_id: "MEM-001",
      state: "authorizing",
      state_version: 1,
      sealed_private: "encrypted-pre-login-state",
      updated_at: "2026-08-26T16:00:00.000Z",
      expires_at: "2026-08-26T16:15:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) return json({ id: "auth-user-1", email: "member@example.com" });
      if (url.includes("/rest/v1/continuity_memberships?")) return json([{ household_id: "HH-TEST", member_id: "MEM-001", auth_user_id: "auth-user-1", role: "owner" }]);
      throw new Error(`Unexpected upstream ${url}`);
    }));

    const response = await worker.fetch(api(`/bank/flinks/connections?${new URLSearchParams({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001" })}`, { method: "GET" }), env(db));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, connections: [] });
    expect(db.row.state).toBe("expired");
    expect(db.row.sealed_private).toBeNull();
  });

  it("seals the reusable login, returns only digested posted-CAD proposals, and revokes provider access", async () => {
    const db = new FakeD1();
    let tokenCount = 0;
    const selectedAccountId = "7a6af481-e70d-4cc6-8dc7-79c3817fc469";
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) return json({ id: "auth-user-1", email: "member@example.com" });
      if (url.includes("/rest/v1/continuity_memberships?")) return json([{ household_id: "HH-TEST", member_id: "MEM-001", auth_user_id: "auth-user-1", role: "owner" }]);
      if (url.endsWith("/GenerateAuthorizeToken")) {
        expect(init?.redirect).toBe("manual");
        return json({ HttpStatusCode: 200, Token: `one-use-token-${++tokenCount}-long-enough` });
      }
      if (url.endsWith("/Authorize")) {
        expect(init?.headers).toEqual(expect.objectContaining({ "flinks-auth-key": "one-use-token-2-long-enough" }));
        expect(String(init?.body)).toContain(loginId);
        return json({ HttpStatusCode: 200, RequestId: requestId });
      }
      if (url.endsWith("/GetAccountsDetail")) {
        expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
          AccountsFilter: [selectedAccountId],
          WithAccountIdentity: false,
          WithKYC: false,
          WithTransactions: true,
        }));
        return json({
        HttpStatusCode: 200,
        RequestId: requestId,
        InstitutionName: "FlinksCapital",
        Accounts: [{
          Id: "raw-account-id",
          AccountNumber: "1234567890",
          Type: "Chequing",
          Currency: "CAD",
          Transactions: [
            { Id: "raw-transaction-id", Date: "2026-08-25", Debit: 12.34, Credit: null, Code: "DEBIT", Description: "Test groceries" },
            { Id: "raw-pending-id", Date: "2026-08-26", Debit: 3.21, Credit: null, Code: 1, Description: "Pending coffee" },
          ],
        }],
        });
      }
      if (url.includes("/DeleteCard/")) {
        expect(url).toContain(loginId);
        expect(init?.method).toBe("DELETE");
        return json({ StatusCode: 200, Message: "Card deleted" });
      }
      throw new Error(`Unexpected upstream ${url}`);
    });
    vi.stubGlobal("fetch", upstream);

    const scope = { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" };
    const started = await worker.fetch(api("/bank/flinks/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scope) }), env(db));
    expect(started.status).toBe(201);
    const startBody = await started.json() as { connectionId: string; iframeUrl: string; messageOrigin: string };
    expect(startBody.messageOrigin).toBe("https://toolbox-iframe.private.fin.ag");
    expect(startBody.iframeUrl).toContain("authorizeToken=one-use-token-1-long-enough");
    expect(new URL(startBody.iframeUrl).searchParams.get("accountSelectorCurrency")).toBe("cad");
    expect(new URL(startBody.iframeUrl).searchParams.get("fetchAllAccounts")).toBe("false");
    expect(String(db.row?.sealed_private)).toMatch(/^v1\.1\./);
    const redirect = new URL(new URL(startBody.iframeUrl).searchParams.get("redirectUrl")!);
    expect(redirect.origin).toBe(kitchen);
    expect(redirect.pathname).toBe("/bank/flinks/callback");
    expect(redirect.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{20,80}$/);

    const completed = await worker.fetch(api(`/bank/flinks/sessions/${startBody.connectionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, redirectUrl: `${redirect.toString()}&loginId=${loginId}&accountId=${selectedAccountId}` }),
    }), env(db));
    expect(completed.status).toBe(200);
    const completeText = await completed.text();
    expect(completeText).not.toContain(loginId);
    expect(completeText).not.toContain("raw-account-id");
    expect(completeText).not.toContain("raw-transaction-id");
    expect(completeText).not.toContain("raw-pending-id");
    const completeBody = JSON.parse(completeText);
    expect(completeBody).toEqual(expect.objectContaining({ status: "ready", connectionId: startBody.connectionId }));
    expect(completeBody.payload.transactions[0]).toEqual(expect.objectContaining({
      status: "posted",
      currency: "CAD",
      debit: "12.34",
      credit: null,
      accountRef: expect.stringMatching(/^fac_[a-f0-9]{64}$/),
      stableTransactionId: expect.stringMatching(/^ftx_[a-f0-9]{64}$/),
    }));
    expect(completeBody.payload.transactions[1]).toEqual(expect.objectContaining({
      status: "pending",
      currency: "CAD",
      stableTransactionId: expect.stringMatching(/^ftx_[a-f0-9]{64}$/),
    }));
    expect(String(db.row?.sealed_private)).toMatch(/^v1\.1\./);
    expect(String(db.row?.sealed_private)).not.toContain(loginId);

    const revoked = await worker.fetch(api(`/bank/flinks/sessions/${startBody.connectionId}?${new URLSearchParams(scope)}`, { method: "DELETE" }), env(db));
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toEqual({ ok: true, revoked: true });
    expect(db.row?.state).toBe("revoked");
    expect(db.row?.sealed_private).toBeNull();
  });

  it.each([
    ["callback state mismatch", (url: URL) => { url.searchParams.set("state", "wrong-state-value-that-is-long-enough"); url.searchParams.set("loginId", loginId); url.searchParams.set("accountId", "7a6af481-e70d-4cc6-8dc7-79c3817fc469"); }],
    ["missing account selection", (url: URL) => { url.searchParams.set("loginId", loginId); }],
  ])("rejects %s before provider authorization", async (_label, alter) => {
    const db = new FakeD1();
    const upstream = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) return json({ id: "auth-user-1" });
      if (url.includes("/rest/v1/continuity_memberships?")) return json([{ household_id: "HH-TEST", member_id: "MEM-001", auth_user_id: "auth-user-1", role: "owner" }]);
      if (url.endsWith("/GenerateAuthorizeToken")) return json({ HttpStatusCode: 200, Token: "one-use-token-long-enough" });
      throw new Error(`Provider authorization must not run for an invalid completion: ${url}`);
    });
    vi.stubGlobal("fetch", upstream);
    const scope = { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" };
    const started = await worker.fetch(api("/bank/flinks/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scope) }), env(db));
    const startBody = await started.json() as { connectionId: string; iframeUrl: string };
    const redirect = new URL(new URL(startBody.iframeUrl).searchParams.get("redirectUrl")!);
    alter(redirect);

    const completed = await worker.fetch(api(`/bank/flinks/sessions/${startBody.connectionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, redirectUrl: redirect.toString() }),
    }), env(db));

    expect(completed.status).toBeGreaterThanOrEqual(400);
    expect(upstream.mock.calls.some(([input]) => String(input).endsWith("/Authorize"))).toBe(false);
  });
});
