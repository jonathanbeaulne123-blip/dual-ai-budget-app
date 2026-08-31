import { describe, expect, it, vi } from "vitest";
import {
  authInviteFromLocation,
  authInviteTokenFromText,
  isAuthInviteToken,
  savePendingAuthInvite,
  loadPendingAuthInvite,
  clearPendingAuthInvite,
} from "../src/core/authInvite.ts";
import {
  authInviteIssueGate,
  inviteReasonMessage,
  issueHouseholdInvite,
  redeemHouseholdInvite,
  bindGoogleMemberships,
  leaveOrDeleteHousehold,
  resetDevelopmentHouseholds,
} from "../src/ledger/householdInvites.ts";
import type { SupabaseConfig } from "../src/ledger/supabase.ts";
import { readFileSync } from "node:fs";
import { renderSVG } from "uqr";

const HEX64 = "a".repeat(64);

describe("Auth invite URL parsing", () => {
  it("recognizes 64-char hex tokens without phrase mangling", () => {
    expect(isAuthInviteToken(HEX64)).toBe(true);
    expect(isAuthInviteToken("cedar-lantern-maple")).toBe(false);
    expect(authInviteTokenFromText(HEX64)).toBe(HEX64);
  });

  it("reads /join?invite=&env= without collapsing hex digits", () => {
    const found = authInviteFromLocation(
      `https://hearth-books.example.workers.dev/join?invite=${HEX64}&env=development`,
    );
    expect(found).toEqual({ token: HEX64, environment: "development" });
    expect(authInviteFromLocation("https://hearth.example/?join=cedar-lantern-maple")).toBeNull();
  });

  it("extracts the token from a pasted absolute join URL", () => {
    expect(authInviteTokenFromText(
      `https://kitchen.example/join?invite=${HEX64.toUpperCase()}&env=production`,
    )).toBe(HEX64);
  });
});

describe("household invite RPC client", () => {
  const config: SupabaseConfig = {
    url: "https://example.supabase.co",
    key: "sb_publishable_test",
    accessToken: "jwt-test",
    authUserId: "user-1",
  };

  it("maps issue success and owner failure", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      id: "inv-1",
      kind: "qr",
      invite_token: HEX64,
      expires_at: "2026-09-01T00:00:00.000Z",
      join_path: `/join?invite=${HEX64}&env=development`,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ok = await issueHouseholdInvite({
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-001",
      kind: "qr",
      config,
    });
    expect(ok).toMatchObject({ ok: true, inviteToken: HEX64, kind: "qr" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/hearth_issue_invite",
      expect.objectContaining({ method: "POST" }),
    );

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      reason: "not-owner",
    }), { status: 200 })));
    const denied = await issueHouseholdInvite({
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-001",
      kind: "email",
      invitedEmail: "partner@gmail.com",
      config,
    });
    expect(denied).toEqual({ ok: false, reason: "not-owner" });
    expect(inviteReasonMessage("not-owner")).toMatch(/owner/i);
    vi.unstubAllGlobals();
  });

  it("holds Auth invites until the household finishes sharing", () => {
    expect(authInviteIssueGate({ syncState: "syncing" })).toEqual({
      ready: false,
      message: "Wait until this household finishes sharing before sending an invite.",
    });
    expect(authInviteIssueGate({ syncState: "error", sharingMode: "pending-transport" }).ready).toBe(false);
    expect(authInviteIssueGate({ syncState: "synced" }).ready).toBe(true);
    expect(authInviteIssueGate({ syncState: "idle" }).ready).toBe(true);
    expect(authInviteIssueGate({ syncState: "error" }).ready).toBe(true);
  });

  it("maps redeem email-mismatch and success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      reason: "email-mismatch",
    }), { status: 200 })));
    const mismatch = await redeemHouseholdInvite({ environment: "development", inviteToken: HEX64, config });
    expect(mismatch).toEqual({ ok: false, reason: "email-mismatch" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      duplicate: false,
      role: "member",
      member_id: "MEM-001",
      household_id: "HH-1",
      environment: "development",
    }), { status: 200 })));
    const ok = await redeemHouseholdInvite({ environment: "development", inviteToken: HEX64, config });
    expect(ok).toEqual({
      ok: true,
      duplicate: false,
      role: "member",
      memberId: "MEM-001",
      householdId: "HH-1",
      environment: "development",
    });
    vi.unstubAllGlobals();
  });

  it("refuses RPC without a JWT", async () => {
    const result = await issueHouseholdInvite({
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-001",
      kind: "qr",
      config: { url: "https://example.supabase.co", key: "sb_publishable_test" },
    });
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("maps bind Google memberships success and missing-RPC", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      bound: 1,
      google_subject: "sub-1",
      google_email: "j@example.com",
    }), { status: 200 })));
    const ok = await bindGoogleMemberships({
      environment: "development",
      config,
    });
    expect(ok).toEqual({
      ok: true,
      bound: 1,
      googleSubject: "sub-1",
      googleEmail: "j@example.com",
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      message: "Could not find the function public.hearth_bind_google_memberships",
      code: "PGRST202",
    }), { status: 404 })));
    const missing = await bindGoogleMemberships({ environment: "development", config });
    expect(missing).toEqual({ ok: false, reason: "bind-rpc-missing" });
    vi.unstubAllGlobals();
  });

  it("maps leave and delete household RPC success", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (body.p_household_id === "HH-1") {
        return new Response(JSON.stringify({ ok: true, mode: "delete", household_id: "HH-1" }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, mode: "leave" }), { status: 200 });
    }));
    const deleted = await leaveOrDeleteHousehold({
      environment: "development",
      householdId: "HH-1",
      role: "owner",
      config,
    });
    expect(deleted).toEqual({ ok: true, mode: "delete", householdId: "HH-1" });
    const left = await leaveOrDeleteHousehold({
      environment: "development",
      householdId: "HH-2",
      role: "member",
      config,
    });
    expect(left).toEqual({ ok: true, mode: "leave", householdId: "HH-2" });
    vi.unstubAllGlobals();
  });

  it("resets Development households through the bulk RPC", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      expect(String(input)).toMatch(/hearth_reset_development_households$/);
      return new Response(JSON.stringify({
        ok: true,
        mode: "reset",
        deleted: ["HH-1", "HH-2"],
        left: ["HH-3"],
      }), { status: 200 });
    }));
    const result = await resetDevelopmentHouseholds({
      environment: "development",
      identity: { email: "j@example.com", subject: "sub-1" },
      config,
    });
    expect(result).toEqual({
      ok: true,
      deleted: ["HH-1", "HH-2"],
      left: ["HH-3"],
    });
    vi.unstubAllGlobals();
  });

  it("refuses Production start-from-scratch without calling hosted RPC", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await resetDevelopmentHouseholds({
      environment: "production",
      identity: { email: "j@example.com", subject: "sub-1" },
      config,
    });
    expect(result).toEqual({ ok: false, reason: "production-reset-blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inviteReasonMessage("production-reset-blocked")).toMatch(/Development only/i);
    vi.unstubAllGlobals();
  });

  it("falls back to per-household 015 delete when 016 is missing", async () => {
    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes("hearth_reset_development_households")) {
        return new Response(JSON.stringify({
          message: "Could not find the function public.hearth_reset_development_households",
          code: "PGRST202",
        }), { status: 404 });
      }
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.includes("hearth_delete_development_household")) {
        return new Response(JSON.stringify({
          ok: true,
          mode: "delete",
          household_id: body.p_household_id,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, mode: "leave" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await resetDevelopmentHouseholds({
      environment: "development",
      identity: { email: "j@example.com", subject: "sub-1" },
      known: [
        { householdId: "HH-OWN", memberId: "MEM-001", role: "owner" },
        { householdId: "HH-JOIN", memberId: "MEM-002", role: "member" },
      ],
      config,
    });
    expect(result).toEqual({
      ok: true,
      deleted: ["HH-OWN"],
      left: ["HH-JOIN"],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/hearth_delete_development_household",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });

  it("maps missing 016 and 015 to reset-rpc-missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      message: "Could not find the function",
      code: "PGRST202",
    }), { status: 404 })));
    const result = await resetDevelopmentHouseholds({
      environment: "development",
      identity: { email: "j@example.com", subject: "sub-1" },
      known: [{ householdId: "HH-OWN", memberId: "MEM-001", role: "owner" }],
      config,
    });
    expect(result).toEqual({ ok: false, reason: "reset-rpc-missing" });
    expect(inviteReasonMessage("reset-rpc-missing")).toMatch(/016/);
    vi.unstubAllGlobals();
  });

  it("refuses reset without a JWT", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await resetDevelopmentHouseholds({
      environment: "development",
      identity: { email: "j@example.com", subject: "sub-1" },
      config: { url: "https://example.supabase.co", key: "sb_publishable_test" },
    });
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inviteReasonMessage("unauthenticated")).toMatch(/Continue with Google/i);
    expect(inviteReasonMessage("reset-failed")).toMatch(/Nothing was cleared/i);
    vi.unstubAllGlobals();
  });
});

describe("pending Auth invite storage", () => {
  it("round-trips an invite through sessionStorage across OAuth", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
    savePendingAuthInvite({ token: HEX64, environment: "development" });
    expect(loadPendingAuthInvite()).toEqual({ token: HEX64, environment: "development" });
    clearPendingAuthInvite();
    expect(loadPendingAuthInvite()).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("Auth join QR", () => {
  it("renders SVG for a kitchen join URL", () => {
    const joinUrl = `https://hearth-books.example.workers.dev/join?invite=${HEX64}&env=development`;
    const svg = renderSVG(joinUrl, { ecc: "M", border: 2 });
    expect(svg).toMatch(/<svg/i);
    expect(svg.length).toBeGreaterThan(100);
  });

  it("ships migration 010 bind RPC", () => {
    const migration = readFileSync("supabase/migrations/010_bind_google_memberships.sql", "utf8");
    expect(migration).toMatch(/hearth_bind_google_memberships/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.hearth_bind_google_memberships/);
    expect(migration).toMatch(/VALUES \(10,/);
  });

  it("ships migration 015 delete/leave RPC", () => {
    const migration = readFileSync("supabase/migrations/015_delete_development_household.sql", "utf8");
    expect(migration).toMatch(/hearth_delete_development_household/);
    expect(migration).toMatch(/hearth_leave_household/);
    expect(migration).toMatch(/VALUES \(15,/);
  });

  it("ships migration 016 Development reset RPC", () => {
    const migration = readFileSync("supabase/migrations/016_reset_development_households.sql", "utf8");
    expect(migration).toMatch(/hearth_reset_development_households/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.hearth_reset_development_households/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.hearth_reset_development_households\(\) FROM PUBLIC, anon/);
    expect(migration).toMatch(/VALUES \(16,/);
    expect(migration).toMatch(/DELETE FROM public\.households\s+WHERE environment = 'development'/);
    expect(migration).toMatch(/auth\.uid\(\)/);
    expect(migration).not.toMatch(/service_role/);
    expect(migration).not.toMatch(/DELETE FROM public\.households\s+WHERE environment = 'production'/);
  });
});
