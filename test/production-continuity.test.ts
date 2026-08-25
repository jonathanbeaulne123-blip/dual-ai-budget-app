import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "../src/core/index.ts";
import type { Household } from "../src/core/types.ts";
import { pushSupabaseHousehold } from "../src/ledger/supabase.ts";
import { readFileSync } from "node:fs";

const config = { url: "https://continuity.example.supabase.co", key: "sb_publishable_test" };
const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function productionHousehold(): Household {
  return linkGoogleIdentity(catalogHousehold("production"), {
    memberId: "MEM-001",
    email: identity.email,
    subject: identity.subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Production continuity safety", () => {
  it("skips Production cloud writes when the continuity flag is off", async () => {
    vi.stubEnv("VITE_PRODUCTION_CONTINUITY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await pushSupabaseHousehold(
      { ...productionHousehold(), revision: 2, baseRevision: 1 },
      config,
      { expectedRevision: 1, continuityIdentity: identity },
    );
    expect(result.skipped).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses Production membership minting and posts only the projected shared payload on legacy CAS", async () => {
    vi.stubEnv("VITE_PRODUCTION_CONTINUITY", "1");
    const base = productionHousehold();
    const withPersonal = postEntry(base, {
      date: "2026-08-25",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Partner must not see this in shared",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const snapshot = { ...withPersonal, revision: 2, baseRevision: 1, linked: true };
    const posts: Array<{ url: string; body: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot") || url.includes("rpc/hearth_create_household")) {
        return response({ code: "PGRST202", message: "missing rpc" }, 404);
      }
      if (url.includes("household_snapshots?household_id")) {
        return response([{ payload: JSON.stringify({ ...base, revision: 1 }) }]);
      }
      if (url.includes("continuity_memberships?") && (init?.method ?? "GET") === "GET") {
        if (url.includes("select=household_id&limit=1")) return response([]);
        return response([{
          household_id: snapshot.householdId,
          member_id: "MEM-001",
          google_subject: identity.subject,
          google_email: identity.email,
        }]);
      }
      if (init?.method === "POST") {
        posts.push({ url, body: String(init.body ?? "") });
        return response(null, 201);
      }
      return response([]);
    }));

    const result = await pushSupabaseHousehold(snapshot, config, {
      expectedRevision: 1,
      continuityIdentity: identity,
    });
    expect(result.conflict).toBeFalsy();
    expect(result.usedCasRpc).toBe(false);
    expect(posts.some((item) => item.url.includes("continuity_memberships?on_conflict"))).toBe(false);
    const personalPost = posts.find((item) => item.url.includes("continuity_personal_snapshots"));
    expect(personalPost).toBeTruthy();
    const sharedPost = posts.find((item) => item.url.includes("household_snapshots?on_conflict"));
    expect(sharedPost).toBeTruthy();
    const sharedPayload = JSON.parse(JSON.parse(sharedPost!.body).payload) as Household;
    expect(sharedPayload.transactions.some((row) => row.visibility === "personal")).toBe(false);
    expect(sharedPayload.transactions.some((row) => row.note === "Partner must not see this in shared")).toBe(false);
  });

  it("ships SELECT-only Production bridge SQL and keeps open INSERT out of Production policies", () => {
    const sql = readFileSync("supabase/migrations/008_production_continuity_select.sql", "utf8");
    expect(sql).toMatch(/DO NOT APPLY/i);
    expect(sql).toContain("FOR SELECT");
    expect(sql).toContain("environment = 'production'");
    expect(sql).not.toMatch(/WITH CHECK \(environment = 'production'\)/);
    expect(sql).toContain("schema_migrations");
    expect(sql).toContain("009_rollback_006.sql");
  });
});
