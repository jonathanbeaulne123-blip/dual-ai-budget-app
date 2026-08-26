import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { catalogHousehold, linkGoogleIdentity } from "../src/core/index.ts";
import { pushSupabaseHousehold, bundledSupabaseConfig } from "../src/ledger/supabase.ts";
import { vi, afterEach } from "vitest";

const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("D-143 Auth membership continuity authority", () => {
  it("publishes with continuity identity even when linked is false", async () => {
    const base = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identity.email,
      subject: identity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const household = { ...base, linked: false, revision: 1, baseRevision: 0 };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.includes("rpc/hearth_create_household") || url.includes("rpc/publish_household_snapshot")) {
        return new Response(JSON.stringify({ ok: true, conflict: false, duplicate: false, revision: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("continuity_")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }));
    const result = await pushSupabaseHousehold(household, bundledSupabaseConfig(), {
      expectedRevision: 0,
      continuityIdentity: identity,
    });
    expect(result.skipped).toBe(false);
    expect(result.usedCasRpc).toBe(true);
  });

  it("keeps App commit path free of unprojected linked transport", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    expect(app).toContain("const transportRequested = hostedContinuityAllowed(environment) && automaticContinuity;");
    expect(app).not.toMatch(/unprojectedHostedTransportAllowed\(environment\) && hostedTransportAllowed/);
  });

  it("documents live 010 bind RPC in the migration packet", () => {
    const sql = readFileSync(new URL("../supabase/migrations/010_bind_google_memberships.sql", import.meta.url), "utf8");
    expect(sql).toContain("hearth_bind_google_memberships");
    expect(sql).toMatch(/VALUES\s*\(\s*10\s*,/);
  });

  it("does not fall through to legacy upsert when continuity identity is present and CAS RPC is missing", async () => {
    const base = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identity.email,
      subject: identity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const household = { ...base, linked: true, revision: 2, baseRevision: 1 };
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: household.householdId }]), { status: 200 });
      }
      if (url.includes("rpc/publish_household_snapshot") || url.includes("rpc/hearth_create_household")) {
        return new Response(JSON.stringify({
          code: "PGRST202",
          message: "Could not find the function",
        }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("continuity_")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    const result = await pushSupabaseHousehold(household, { ...bundledSupabaseConfig(), authUserId: "auth-user-1" }, {
      expectedRevision: 1,
      continuityIdentity: identity,
    });
    expect(result.skipped).toBe(true);
    expect(result.error).toMatch(/CAS RPC is unavailable/);
    expect(result.usedCasRpc).toBe(false);
    const urls = fetch.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("household_snapshots?on_conflict"))).toBe(false);
  });
});
