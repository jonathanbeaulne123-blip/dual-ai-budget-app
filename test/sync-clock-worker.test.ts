import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";

const kitchen = "https://hearth-books.jonathan-beaulne123.workers.dev";
const scope = { environment: "development", householdId: "HH-CLOCK", memberId: "MEM-001" };
const workerEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  ASSETS: { fetch: vi.fn() },
};

function clockRequest(input: Record<string, unknown> = scope, options: { origin?: string; authorization?: string; method?: string } = {}) {
  const method = options.method ?? "POST";
  return new Request(`${kitchen}/sync/clock`, {
    method,
    headers: {
      Origin: options.origin ?? kitchen,
      ...(options.authorization === undefined ? { Authorization: "Bearer test-access-token" } : options.authorization ? { Authorization: options.authorization } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(input) } : {}),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("authenticated Development sync clock", () => {
  it("returns only NTP-style cloud timestamps after exact member verification", async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) return Response.json({ id: "auth-user-1" });
      if (url.includes("/rest/v1/continuity_memberships?")) {
        return Response.json([{
          environment: "development",
          household_id: scope.householdId,
          member_id: scope.memberId,
          auth_user_id: "auth-user-1",
        }]);
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", upstream);

    const response = await worker.fetch(clockRequest(), workerEnv);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      ok: true,
      source: "authenticated-cloud-clock",
      serverReceivedAtMs: expect.any(Number),
      serverSentAtMs: expect.any(Number),
    });
    expect(Number(body.serverSentAtMs)).toBeGreaterThanOrEqual(Number(body.serverReceivedAtMs));
    expect(JSON.stringify(body)).not.toMatch(/auth-user|HH-CLOCK|MEM-001|token/i);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("refuses anonymous, foreign-origin, Production, and wrong-membership requests", async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/auth/v1/user")) return Response.json({ id: "auth-user-1" });
      return Response.json([]);
    });
    vi.stubGlobal("fetch", upstream);

    expect((await worker.fetch(clockRequest(scope, { authorization: "" }), workerEnv)).status).toBe(401);
    expect((await worker.fetch(clockRequest(scope, { origin: "https://evil.example" }), workerEnv)).status).toBe(403);
    expect((await worker.fetch(clockRequest({ ...scope, environment: "production" }), workerEnv)).status).toBe(409);
    expect((await worker.fetch(clockRequest(), workerEnv)).status).toBe(403);
  });

  it("answers preflight narrowly and never falls through to static assets", async () => {
    const response = await worker.fetch(clockRequest({}, { method: "OPTIONS" }), workerEnv);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Accept, Authorization, Content-Type");
    expect(workerEnv.ASSETS.fetch).not.toHaveBeenCalled();
  });
});
