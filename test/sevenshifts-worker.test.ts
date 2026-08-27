import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";

const kitchen = "https://hearth-books.jonathan-beaulne123.workers.dev";
const token = "seven-shifts-access-token-harbour-dev-0001";

type Stored = Record<string, unknown>;

class FakeD1 {
  rows: Stored[] = [];

  prepare(sql: string) {
    const db = this;
    return {
      bind(...values: unknown[]) {
        return {
          async first() {
            if (sql.includes("SELECT 1 AS ok")) return { ok: 1 };
            if (sql.startsWith("SELECT *")) {
              return db.rows.find((row) => row.connection_id === values[0] && row.state === "ready") ?? null;
            }
            return db.rows[0] ?? null;
          },
          async run() {
            if (sql.startsWith("INSERT")) {
              db.rows.push({
                connection_id: values[0],
                environment: values[1],
                auth_user_id: values[2],
                household_id: values[3],
                member_id: values[4],
                job_id: values[5],
                state: "ready",
                state_version: 1,
                sealed_private: values[6],
                key_version: 1,
                company_label: values[7],
                created_at: values[8],
                updated_at: values[9],
                last_pull_at: null,
              });
            } else if (sql.includes("SET last_pull_at")) {
              const row = db.rows.find((item) => item.connection_id === values[2]);
              if (row) {
                row.last_pull_at = values[0];
                row.updated_at = values[1];
              }
            } else if (sql.includes("SET state = 'revoked'")) {
              const row = db.rows.find((item) => item.connection_id === values[2]);
              if (row) {
                row.state = "revoked";
                row.sealed_private = null;
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            }
            return { meta: { changes: 1 } };
          },
          async all() {
            return {
              results: db.rows
                .filter((row) => row.state === "ready")
                .map((row) => ({
                  connection_id: row.connection_id,
                  state: row.state,
                  job_id: row.job_id,
                  company_label: row.company_label,
                  updated_at: row.updated_at,
                  last_pull_at: row.last_pull_at,
                })),
            };
          },
        };
      },
    };
  }
}

function env(db: FakeD1, overrides: Record<string, unknown> = {}) {
  return {
    SEVENSHIFTS_ENABLED: "true",
    SEVENSHIFTS_ALLOW_PRODUCTION: "false",
    SEVENSHIFTS_API_BASE_URL: "https://api.7shifts.com",
    SEVENSHIFTS_CONNECTION_ENCRYPTION_KEY: "seven-encrypt-key-".repeat(2),
    SEVENSHIFTS_DIGEST_KEY: "seven-digest-key-".repeat(2),
    SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
    FLINKS_DB: db,
    ASSETS: { fetch: vi.fn() },
    ...overrides,
  };
}

function request(path: string, method = "GET", origin: string | null = kitchen, body?: unknown): Request {
  const headers = new Headers();
  if (origin) headers.set("Origin", origin);
  if (body) headers.set("Content-Type", "application/json");
  return new Request(`${kitchen}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
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

function sevenShiftsUpstream() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return json({ id: "auth-user-1", email: "member@example.com" });
    if (url.includes("/rest/v1/continuity_memberships?")) {
      return json([{ household_id: "HH-TEST", member_id: "MEM-001", auth_user_id: "auth-user-1", role: "owner" }]);
    }
    if (url.startsWith("https://api.7shifts.com/v2/companies")) {
      return json({ data: [{ id: 1234, name: "Harbour" }] });
    }
    if (url.startsWith("https://api.7shifts.com/v2/whoami")) {
      return json({
        data: {
          users: [{
            id: 555,
            company_id: 1234,
            first_name: "Jonathan",
            last_name: "Harbour",
            preferred_first_name: "Jonathan",
            email: "jonathan@example.com",
            mobile_number: "5555551234",
            birth_date: "1990-01-01",
            active: true,
          }, {
            id: 556,
            company_id: 1234,
            first_name: "alex@example.com",
            last_name: "Park",
            active: true,
          }],
        },
      });
    }
    if (url.includes("/time_punches")) {
      return json({
        data: [{
          id: 85452022,
          user_id: 555,
          role_id: 2583,
          location_id: 4569,
          hourly_wage: 1550,
          tips: 4800,
          clocked_in: "2026-08-26T15:12:00+00:00",
          clocked_out: "2026-08-26T20:47:00+00:00",
          deleted: false,
          breaks: [{ in: "2026-08-26T18:00:00+00:00", out: "2026-08-26T18:30:00+00:00", paid: true }],
        }],
      });
    }
    if (url.includes("/shifts?")) {
      return json({
        data: [{
          id: 1,
          user_id: 777,
          role_id: 9,
          start: "2026-08-26T15:00:00Z",
          end: "2026-08-26T21:00:00Z",
          hourly_wage: 1600,
        }],
      });
    }
    if (url.includes("/roles?")) return json({ data: [{ id: 2583, name: "Server" }, { id: 9, name: "Host" }] });
    if (url.includes("/locations?")) return json({ data: [{ id: 4569, name: "Harbour" }] });
    if (url.includes("/users?")) {
      return json({
        data: [
          { id: 555, first_name: "Jonathan", last_name: "Harbour", email: "jonathan@example.com" },
          { id: 777, first_name: "Alex", last_name: "Park", email: "alex@example.com" },
        ],
      });
    }
    throw new Error(`Unexpected upstream ${url}`);
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("7shifts Worker scaffold", () => {
  it("reports an inert Development scaffold and never contacts 7shifts", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request("/work/7shifts/status"), {
      SEVENSHIFTS_ENABLED: "false",
      SEVENSHIFTS_ALLOW_PRODUCTION: "false",
      ASSETS: { fetch: vi.fn() },
    });
    expect(response.status).toBe(200);
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

  it("stays locked even if Production is flipped on", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request("/work/7shifts/status"), env(new FakeD1(), {
      SEVENSHIFTS_ALLOW_PRODUCTION: "true",
    }));
    expect(await response.json()).toEqual(expect.objectContaining({
      available: false,
      providerCallsEnabled: false,
      productionAllowed: false,
    }));
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a foreign origin and requires a bearer before D1 or 7shifts", async () => {
    const db = new FakeD1();
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect((await worker.fetch(request("/work/7shifts/status", "GET", "https://evil.example"), env(db))).status).toBe(403);
    const denied = await worker.fetch(request("/work/7shifts/connections", "POST", kitchen, {
      environment: "development", householdId: "HH-TEST", memberId: "MEM-001",
    }), env(db));
    expect(denied.status).toBe(401);
    expect(db.rows).toHaveLength(0);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe("authenticated 7shifts Worker", () => {
  it("probes a company without storing the token, then seals a connection and returns tip-free punches", async () => {
    const db = new FakeD1();
    const upstream = sevenShiftsUpstream();
    vi.stubGlobal("fetch", upstream);
    const scope = { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" };

    const probed = await worker.fetch(api("/work/7shifts/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, accessToken: token }),
    }), env(db));
    expect(probed.status).toBe(200);
    const probeBody = await probed.json() as { companyName: string; users: Array<{ userDigest: string; displayName: string }> };
    expect(probeBody.companyName).toBe("Harbour");
    expect(probeBody.users[0]?.displayName).toBe("Jonathan H.");
    expect(probeBody.users.some((user) => user.displayName === "Coworker")).toBe(true);
    expect(JSON.stringify(probeBody)).not.toMatch(/example\.com|5555551234|1990-01-01|hourly_wage|accessToken|seven-shifts-access/);
    expect(db.rows).toHaveLength(0);

    const connected = await worker.fetch(api("/work/7shifts/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, accessToken: token, userDigest: probeBody.users[0]!.userDigest, jobId: "JOB-HARBOUR" }),
    }), env(db));
    expect(connected.status).toBe(201);
    const connection = await connected.json() as { connectionId: string };
    expect(String(db.rows[0]?.sealed_private)).toMatch(/^v1\.1\./);
    expect(JSON.stringify(db.rows[0])).not.toContain(token);

    const pulled = await worker.fetch(api(`/work/7shifts/connections/${connection.connectionId}/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope),
    }), env(db));
    expect(pulled.status).toBe(200);
    const pullBody = await pulled.json() as { payload: { punches: Array<Record<string, unknown>>; coworkers: Array<Record<string, unknown>> } };
    expect(pullBody.payload.punches[0]).toEqual(expect.objectContaining({
      tipsOmitted: true,
      roleName: "Server",
      open: false,
    }));
    expect(pullBody.payload.punches[0]?.workedHours).toBeGreaterThan(4);
    expect(pullBody.payload.coworkers[0]).toEqual(expect.objectContaining({
      displayName: "Alex P.",
      roleName: "Host",
      status: "scheduled",
    }));
    const serialized = JSON.stringify(pullBody);
    expect(serialized).not.toMatch(/hourly_wage|"tips"|example\.com|seven-shifts-access|1550|4800/);
    expect(serialized).not.toContain(token);

    const revoked = await worker.fetch(api(`/work/7shifts/connections/${connection.connectionId}?${new URLSearchParams(scope)}`, { method: "DELETE" }), env(db));
    expect(revoked.status).toBe(200);
    expect(db.rows[0]?.sealed_private).toBeNull();
    expect(db.rows[0]?.state).toBe("revoked");
  });
});
