import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "../src/core/index.ts";
import { personalReplicaForMember } from "../src/core/sync.ts";
import { pushSupabaseHousehold, bundledSupabaseConfig } from "../src/ledger/supabase.ts";
import { vi, afterEach } from "vitest";

const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };
const authConfig = {
  ...bundledSupabaseConfig(),
  authUserId: "auth-user-jonathan",
  accessToken: "jwt-test-token",
};

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
      if (url.includes("rpc/hearth_create_household") || url.includes("rpc/publish_continuity_snapshot")) {
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
    const result = await pushSupabaseHousehold(household, authConfig, {
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
      if (url.includes("rpc/publish_continuity_snapshot") || url.includes("rpc/hearth_create_household")) {
        return new Response(JSON.stringify({
          code: "PGRST202",
          message: "Could not find the function public.publish_continuity_snapshot",
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
    expect(result.error).toMatch(/continuity RPC is unavailable/);
    expect(result.usedCasRpc).toBe(false);
    const urls = fetch.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("household_snapshots?on_conflict"))).toBe(false);
  });

  it("T1-S2: Auth continuity uses one atomic RPC (no separate Personal POST)", async () => {
    const base = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identity.email,
      subject: identity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const household = { ...base, linked: true, revision: 2, baseRevision: 1 };
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: household.householdId }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("rpc/publish_continuity_snapshot")) {
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        expect(body.p_member_id).toBe("MEM-001");
        expect(typeof body.p_personal_payload).toBe("string");
        return new Response(JSON.stringify({ ok: true, conflict: false, duplicate: false, revision: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("continuity_personal_snapshots?on_conflict")) {
        throw new Error("Personal must not POST separately on Auth atomic path");
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const result = await pushSupabaseHousehold(household, authConfig, {
      expectedRevision: 1,
      continuityIdentity: identity,
    });
    expect(result.skipped).toBe(false);
    expect(result.usedCasRpc).toBe(true);
    expect(calls.some((url) => url.includes("rpc/publish_continuity_snapshot"))).toBe(true);
    expect(calls.some((url) => url.includes("rpc/publish_household_snapshot"))).toBe(false);
    expect(calls.some((url) => url.includes("continuity_personal_snapshots?on_conflict"))).toBe(false);
  });

  it("T1-S2 G6: large personal envelope stays plain JSON for Migration 012 SQL", async () => {
    let base = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identity.email,
      subject: identity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    for (let i = 0; i < 12; i += 1) {
      base = postEntry(base, {
        date: "2026-08-24",
        type: "expense",
        amount: "15.00",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: `G6 personal envelope stress ${i} xxxxxxxxxxxxxxxxxxxxxxxx`,
        createdBy: "MEM-001",
        visibility: "personal",
        confirmDuplicate: true,
      }).household;
    }
    const household = { ...base, linked: true, revision: 2, baseRevision: 1 };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: household.householdId }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("rpc/publish_continuity_snapshot")) {
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        const personal = JSON.parse(String(body.p_personal_payload)) as ReturnType<typeof personalReplicaForMember>;
        expect(personal.kind).toBe("personal");
        expect(personal.memberId).toBe("MEM-001");
        expect(personal.transactions.length).toBeGreaterThanOrEqual(10);
        expect(JSON.stringify(personal)).not.toMatch(/hearthPayload/);
        return new Response(JSON.stringify({ ok: true, conflict: false, duplicate: false, revision: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const result = await pushSupabaseHousehold(household, authConfig, {
      expectedRevision: 1,
      continuityIdentity: identity,
    });
    expect(result.skipped).toBe(false);
    expect(result.usedCasRpc).toBe(true);
  });

  it("retries first-create CAS from the hosted revision, not from 0", async () => {
    const base = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identity.email,
      subject: identity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const remote = { ...base, linked: true, revision: 1, baseRevision: 0 };
    const local = { ...base, linked: true, revision: 3, baseRevision: 0 };
    const expectedRevisions: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: local.householdId }]), { status: 200 });
      }
      if (url.includes("rpc/hearth_create_household")) {
        return new Response(JSON.stringify({
          ok: false,
          conflict: true,
          reason: "household-already-exists",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("household_snapshots?") && (init?.method || "GET") === "GET") {
        return new Response(JSON.stringify([{ payload: JSON.stringify(remote) }]), { status: 200 });
      }
      if (url.includes("rpc/publish_continuity_snapshot")) {
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        expectedRevisions.push(Number(body.p_expected_revision));
        expect(body.p_revision).toBe(3);
        return new Response(JSON.stringify({
          ok: true,
          conflict: false,
          duplicate: false,
          revision: 3,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("rpc/append_continuity_command")) {
        throw new Error("append must not run on the first-create retry");
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const result = await pushSupabaseHousehold(local, authConfig, {
      expectedRevision: 0,
      continuityIdentity: identity,
    });
    expect(result.conflict).toBeFalsy();
    expect(result.skipped).toBe(false);
    expect(result.error).toBeUndefined();
    expect(expectedRevisions).toEqual([1]);
  });

  it("still conflicts when the hosted household is actually newer", async () => {
    const base = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identity.email,
      subject: identity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const remote = { ...base, linked: true, revision: 4, baseRevision: 3 };
    const local = { ...base, linked: true, revision: 2, baseRevision: 0 };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: local.householdId }]), { status: 200 });
      }
      if (url.includes("rpc/hearth_create_household")) {
        return new Response(JSON.stringify({
          ok: false,
          conflict: true,
          reason: "household-already-exists",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("household_snapshots?")) {
        return new Response(JSON.stringify([{ payload: JSON.stringify(remote) }]), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    }));
    const result = await pushSupabaseHousehold(local, authConfig, {
      expectedRevision: 0,
      continuityIdentity: identity,
    });
    expect(result.conflict).toBe(true);
    expect(result.remote?.revision).toBe(4);
    expect(result.error).toMatch(/Another phone posted a newer household snapshot/);
  });

  it("treats this phone's own same-revision retry as a duplicate, not another phone", async () => {
    const base = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identity.email,
      subject: identity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const hosted = { ...base, linked: true, revision: 7, baseRevision: 0 };
    const expectedRevisions: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: hosted.householdId }]), { status: 200 });
      }
      if (url.includes("rpc/hearth_create_household")) {
        return new Response(JSON.stringify({
          ok: false,
          conflict: true,
          reason: "household-already-exists",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("household_snapshots?") && (init?.method || "GET") === "GET") {
        return new Response(JSON.stringify([{ payload: JSON.stringify(hosted) }]), { status: 200 });
      }
      if (url.includes("rpc/publish_continuity_snapshot")) {
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        expectedRevisions.push(Number(body.p_expected_revision));
        expect(body.p_revision).toBe(7);
        return new Response(JSON.stringify({
          ok: true,
          conflict: false,
          duplicate: true,
          revision: 7,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const result = await pushSupabaseHousehold(hosted, authConfig, {
      expectedRevision: 0,
      continuityIdentity: identity,
    });
    expect(result.conflict).toBeFalsy();
    expect(result.duplicate).toBe(true);
    expect(result.error).toBeUndefined();
    expect(expectedRevisions).toEqual([7]);
  });

  it("does not blame another phone when the hosted snapshot cannot be read after create", async () => {
    const base = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: identity.email,
      subject: identity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const local = { ...base, linked: true, revision: 7, baseRevision: 0 };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: local.householdId }]), { status: 200 });
      }
      if (url.includes("rpc/hearth_create_household")) {
        return new Response(JSON.stringify({
          ok: false,
          conflict: true,
          reason: "household-already-exists",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("household_snapshots?")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("rpc/publish_continuity_snapshot")) {
        throw new Error("CAS from expected 0 would recreate the false another-phone warning");
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const result = await pushSupabaseHousehold(local, authConfig, {
      expectedRevision: 0,
      continuityIdentity: identity,
    });
    expect(result.conflict).toBeFalsy();
    expect(result.skipped).toBe(true);
    expect(result.error).toMatch(/books snapshot is missing/);
    expect(result.error).not.toMatch(/Another phone/);
  });
});
