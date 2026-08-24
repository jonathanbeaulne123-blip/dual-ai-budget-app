import { describe, expect, it, vi, afterEach } from "vitest";
import { catalogHousehold, postEntry } from "../src/core/index.ts";
import { bundledSupabaseConfig, pushSupabaseHousehold } from "../src/ledger/supabase.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("hosted compare-and-swap", () => {
  it("rejects a stale linked write without posting the snapshot", async () => {
    const local = {
      ...postEntry(catalogHousehold(), {
        date: "2026-08-24",
        type: "expense",
        amount: "6.00",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "Stale coffee",
        createdBy: "MEM-001",
        confirmDuplicate: true,
      }).household,
      linked: true,
      revision: 5,
      baseRevision: 3,
    };
    const remote = { ...catalogHousehold(), linked: true, revision: 4 };
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("households?select=id")) {
        return response([]);
      }
      if (url.includes("rpc/publish_household_snapshot")) {
        return response({
          code: "PGRST202",
          message: "Could not find the function public.publish_household_snapshot",
        }, 404);
      }
      if (url.includes("household_snapshots?")) {
        return response([{ payload: JSON.stringify(remote) }]);
      }
      return response(null, 201);
    }));
    const result = await pushSupabaseHousehold(local, bundledSupabaseConfig(), { expectedRevision: 3 });
    expect(result.conflict).toBe(true);
    expect(result.remote?.revision).toBe(4);
    expect(result.usedCasRpc).toBe(false);
    expect(calls.some((call) => call.startsWith("POST") && call.includes("household_snapshots"))).toBe(false);
  });

  it("rejects a hosted snapshot from the other environment without posting", async () => {
    const local = {
      ...catalogHousehold("development"),
      linked: true,
      revision: 2,
      baseRevision: 2,
    };
    const remote = { ...catalogHousehold("production"), linked: true, revision: 2 };
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("rpc/publish_household_snapshot")) {
        return response({
          code: "PGRST202",
          message: "Could not find the function public.publish_household_snapshot",
        }, 404);
      }
      if (url.includes("household_snapshots?")) {
        return response([{ payload: JSON.stringify(remote) }]);
      }
      return response(null, 201);
    }));
    const result = await pushSupabaseHousehold(local, bundledSupabaseConfig(), { expectedRevision: 2 });
    expect(result.conflict).toBe(true);
    expect(result.usedCasRpc).toBe(false);
    expect(calls.some((call) => /POST/i.test(call) && call.includes("household_snapshots"))).toBe(false);
  });

  it("uses the CAS RPC when present and does not fall back to LWW upsert", async () => {
    const local = {
      ...postEntry(catalogHousehold(), {
        date: "2026-08-24",
        type: "expense",
        amount: "6.00",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "CAS coffee",
        createdBy: "MEM-001",
        confirmDuplicate: true,
      }).household,
      linked: true,
      revision: 2,
      baseRevision: 1,
    };
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot")) {
        return response({ ok: true, conflict: false, duplicate: false, revision: 2 });
      }
      return response(null, 201);
    }));
    const result = await pushSupabaseHousehold(local, bundledSupabaseConfig(), { expectedRevision: 1 });
    expect(result.conflict).toBeFalsy();
    expect(result.usedCasRpc).toBe(true);
    expect(calls.some((call) => call.includes("rpc/publish_household_snapshot"))).toBe(true);
    expect(calls.some((call) => /POST/i.test(call) && call.includes("household_snapshots?on_conflict"))).toBe(false);
  });
});
