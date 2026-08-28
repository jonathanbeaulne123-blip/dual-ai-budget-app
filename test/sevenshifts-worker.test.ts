import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";

const kitchen = "https://hearth-books.jonathan-beaulne123.workers.dev";
const token = "seven-shifts-access-token-harbour-dev-0001";

type Stored = Record<string, unknown>;

class FakeD1 {
  rows: Stored[] = [];
  preparedSql: string[] = [];

  prepare(sql: string) {
    const db = this;
    db.preparedSql.push(sql);
    return {
      async first() {
        if (sql.includes("SELECT 1 AS ok")) return { ok: 1 };
        return null;
      },
      bind(...values: unknown[]) {
        return {
          async first() {
            if (sql.includes("SELECT 1 AS ok")) return { ok: 1 };
            if (sql.startsWith("SELECT *")) {
              return db.rows.find((row) => (
                row.connection_id === values[0]
                && row.environment === values[1]
                && row.auth_user_id === values[2]
                && row.household_id === values[3]
                && row.member_id === values[4]
                && row.state === "ready"
              )) ?? null;
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
              const row = db.rows.find((item) => (
                item.connection_id === values[2]
                && item.environment === values[3]
                && item.auth_user_id === values[4]
                && item.household_id === values[5]
                && item.member_id === values[6]
              ));
              if (row) {
                row.last_pull_at = values[0];
                row.updated_at = values[1];
              }
            } else if (sql.includes("SET state = 'revoked'")) {
              const row = db.rows.find((item) => (
                item.connection_id === values[2]
                && item.environment === values[3]
                && item.auth_user_id === values[4]
                && item.household_id === values[5]
                && item.member_id === values[6]
              ));
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
                .filter((row) => (
                  row.environment === values[0]
                  && row.auth_user_id === values[1]
                  && row.household_id === values[2]
                  && row.member_id === values[3]
                  && row.state === "ready"
                ))
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

function sevenShiftsUpstream(options: {
  shiftsStatus?: number;
  punchesStatus?: number;
  rolesStatus?: number;
  membershipRows?: Array<Record<string, unknown>>;
  companyName?: string;
  roleName?: string;
  locationName?: string;
  environment?: "development" | "production";
} = {}) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return json({ id: "auth-user-1", email: "member@example.com" });
    if (url.includes("/rest/v1/continuity_memberships?")) {
      return json(options.membershipRows ?? [{
        environment: options.environment ?? "development",
        household_id: "HH-TEST",
        member_id: "MEM-001",
        auth_user_id: "auth-user-1",
        role: "owner",
      }]);
    }
    if (url.startsWith("https://api.7shifts.com/v2/companies")) {
      return json({ data: [{ id: 1234, name: options.companyName ?? "Harbour" }] });
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
      if (options.punchesStatus) return json({ error: "required punch call failed" }, options.punchesStatus);
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
      if (options.shiftsStatus) return json({ error: "provider plan details must stay private" }, options.shiftsStatus);
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
    if (url.includes("/roles?")) {
      if (options.rolesStatus) return json({ error: "required role call failed" }, options.rolesStatus);
      return json({ data: [{ id: 2583, name: options.roleName ?? "Server" }, { id: 9, name: "Host" }] });
    }
    if (url.includes("/locations?")) return json({ data: [{ id: 4569, name: options.locationName ?? "Harbour" }] });
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

  it("reports Production unavailable until its separate database and keys are configured", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(request("/work/7shifts/status"), env(new FakeD1(), {
      SEVENSHIFTS_ALLOW_PRODUCTION: "true",
    }));
    expect(await response.json()).toEqual(expect.objectContaining({
      available: true,
      providerCallsEnabled: true,
      productionAllowed: true,
      environment: "development-and-production",
      environments: expect.objectContaining({ production: expect.objectContaining({ available: false }) }),
    }));
    expect(upstream).not.toHaveBeenCalled();
  });

  it("uses exact Production membership and stores a Production connection only in the Production database", async () => {
    const developmentDb = new FakeD1();
    const productionDb = new FakeD1();
    const upstream = sevenShiftsUpstream({ environment: "production" });
    vi.stubGlobal("fetch", upstream);
    const bindings = env(developmentDb, {
      SEVENSHIFTS_ALLOW_PRODUCTION: "true",
      SEVENSHIFTS_PRODUCTION_DB: productionDb,
      SEVENSHIFTS_PRODUCTION_CONNECTION_ENCRYPTION_KEY: "production-encrypt-key-".repeat(2),
      SEVENSHIFTS_PRODUCTION_DIGEST_KEY: "production-digest-key-".repeat(2),
    });
    const scope = { environment: "production", householdId: "HH-TEST", memberId: "MEM-001" };
    const probed = await worker.fetch(api("/work/7shifts/probe", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scope, accessToken: token }),
    }), bindings);
    expect(probed.status).toBe(200);
    const probe = await probed.json() as { users: Array<{ userDigest: string }> };
    const connected = await worker.fetch(api("/work/7shifts/connections", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scope, accessToken: token, userDigest: probe.users[0]!.userDigest, jobId: "JOB-HARBOUR" }),
    }), bindings);
    expect(connected.status).toBe(201);
    expect(productionDb.rows).toHaveLength(1);
    expect(productionDb.rows[0]).toMatchObject({ environment: "production" });
    expect(developmentDb.rows).toHaveLength(0);
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

  it("denies authenticated non-members before any connection D1 or provider call", async () => {
    const membershipCases = [
      [],
      [{
        environment: "development",
        household_id: "HH-OTHER",
        member_id: "MEM-999",
        auth_user_id: "auth-user-1",
        role: "owner",
      }],
    ];
    for (const membershipRows of membershipCases) {
      for (const route of ["probe", "list"] as const) {
        const db = new FakeD1();
        const upstream = sevenShiftsUpstream({ membershipRows });
        vi.stubGlobal("fetch", upstream);
        const scope = { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" };
        const response = route === "probe"
          ? await worker.fetch(api("/work/7shifts/probe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...scope, accessToken: token }),
            }), env(db))
          : await worker.fetch(api(`/work/7shifts/connections?${new URLSearchParams(scope)}`, { method: "GET" }), env(db));
        expect(response.status).toBe(401);
        expect(db.preparedSql).toEqual([]);
        expect(upstream.mock.calls.some(([input]) => String(input).startsWith("https://api.7shifts.com"))).toBe(false);
      }
    }
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
    const pullBody = await pulled.json() as {
      payload: { punches: Array<Record<string, unknown>>; coworkers: Array<Record<string, unknown>> };
    };
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
    const providerCalls = upstream.mock.calls.filter(([input]) => String(input).startsWith("https://api.7shifts.com"));
    expect(providerCalls.length).toBeGreaterThan(0);
    for (const [, init] of providerCalls) {
      expect(new Headers((init as RequestInit | undefined)?.headers).get("x-api-version")).toBe("2026-01-01");
    }

    const revoked = await worker.fetch(api(`/work/7shifts/connections/${connection.connectionId}?${new URLSearchParams(scope)}`, { method: "DELETE" }), env(db));
    expect(revoked.status).toBe(200);
    expect(db.rows[0]?.sealed_private).toBeNull();
    expect(db.rows[0]?.state).toBe("revoked");

    const reconnected = await worker.fetch(api("/work/7shifts/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, accessToken: token, userDigest: probeBody.users[0]!.userDigest, jobId: "JOB-HARBOUR" }),
    }), env(db));
    expect(reconnected.status).toBe(201);
    const secondConnection = await reconnected.json() as { connectionId: string };
    expect(secondConnection.connectionId).not.toBe(connection.connectionId);
    const repulled = await worker.fetch(api(`/work/7shifts/connections/${secondConnection.connectionId}/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope),
    }), env(db));
    const secondPull = await repulled.json() as { payload: { punches: Array<Record<string, unknown>> } };
    expect(secondPull.payload.punches[0]?.stablePunchId).toBe(pullBody.payload.punches[0]?.stablePunchId);
  });

  it("keeps money punches available when scheduled-shift enrichment is unavailable", async () => {
    const db = new FakeD1();
    const upstream = sevenShiftsUpstream({ shiftsStatus: 403 });
    vi.stubGlobal("fetch", upstream);
    const scope = { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" };
    const probed = await worker.fetch(api("/work/7shifts/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, accessToken: token }),
    }), env(db));
    const probeBody = await probed.json() as { users: Array<{ userDigest: string }> };
    const connected = await worker.fetch(api("/work/7shifts/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, accessToken: token, userDigest: probeBody.users[0]!.userDigest, jobId: "JOB-HARBOUR" }),
    }), env(db));
    const connection = await connected.json() as { connectionId: string };
    const pulled = await worker.fetch(api(`/work/7shifts/connections/${connection.connectionId}/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope),
    }), env(db));
    expect(pulled.status).toBe(200);
    const body = await pulled.json() as {
      payload: { punches: Array<Record<string, unknown>>; coworkers: Array<Record<string, unknown>>; warningCodes: string[] };
    };
    expect(body.payload.punches).toHaveLength(1);
    expect(body.payload.punches[0]).toEqual(expect.objectContaining({ tipsOmitted: true, roleName: "Server" }));
    expect(body.payload.coworkers).toEqual([]);
    expect(body.payload.warningCodes).toEqual(["coworker-roster-incomplete"]);
    expect(JSON.stringify(body)).not.toContain("provider plan details");
  });

  it("fails closed when required punch or role data is unavailable", async () => {
    for (const options of [{ punchesStatus: 403 }, { rolesStatus: 403 }]) {
      const db = new FakeD1();
      const upstream = sevenShiftsUpstream(options);
      vi.stubGlobal("fetch", upstream);
      const scope = { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" };
      const probed = await worker.fetch(api("/work/7shifts/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scope, accessToken: token }),
      }), env(db));
      const probeBody = await probed.json() as { users: Array<{ userDigest: string }> };
      const connected = await worker.fetch(api("/work/7shifts/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scope, accessToken: token, userDigest: probeBody.users[0]!.userDigest, jobId: "JOB-HARBOUR" }),
      }), env(db));
      const connection = await connected.json() as { connectionId: string };
      const pulled = await worker.fetch(api(`/work/7shifts/connections/${connection.connectionId}/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope),
      }), env(db));
      expect(pulled.ok).toBe(false);
      const body = await pulled.json() as Record<string, unknown>;
      expect(body).not.toHaveProperty("payload");
      expect(JSON.stringify(body)).not.toMatch(/required punch call failed|required role call failed/);
    }
  });

  it("replaces unsafe provider labels before they reach the browser", async () => {
    const db = new FakeD1();
    const upstream = sevenShiftsUpstream({
      companyName: "harbour@example.com",
      roleName: "Call (416) 555-1212",
      locationName: "dock@example.com",
    });
    vi.stubGlobal("fetch", upstream);
    const scope = { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" };
    const probed = await worker.fetch(api("/work/7shifts/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, accessToken: token }),
    }), env(db));
    const probeBody = await probed.json() as { companyName: string; users: Array<{ userDigest: string }> };
    expect(probeBody.companyName).toBe("7shifts");
    const connected = await worker.fetch(api("/work/7shifts/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, accessToken: token, userDigest: probeBody.users[0]!.userDigest, jobId: "JOB-HARBOUR" }),
    }), env(db));
    const connection = await connected.json() as { connectionId: string };
    const pulled = await worker.fetch(api(`/work/7shifts/connections/${connection.connectionId}/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope),
    }), env(db));
    const body = await pulled.json() as { payload: { sourceName: string; punches: Array<Record<string, unknown>> } };
    expect(body.payload.sourceName).toBe("7shifts");
    expect(body.payload.punches[0]).toEqual(expect.objectContaining({ roleName: "Role", locationName: "" }));
    const visibleLabels = [
      body.payload.sourceName,
      body.payload.punches[0]?.roleName,
      body.payload.punches[0]?.locationName,
    ];
    expect(JSON.stringify(visibleLabels)).not.toMatch(/@|416|555|1212/);
  });
});
