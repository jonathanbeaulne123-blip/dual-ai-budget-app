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
  inviteReasonMessage,
  issueHouseholdInvite,
  redeemHouseholdInvite,
  bindGoogleMemberships,
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

  it("maps redeem email-mismatch and success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      reason: "email-mismatch",
    }), { status: 200 })));
    const mismatch = await redeemHouseholdInvite({ inviteToken: HEX64, config });
    expect(mismatch).toEqual({ ok: false, reason: "email-mismatch" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      duplicate: false,
      role: "member",
      member_id: "MEM-001",
      household_id: "HH-1",
      environment: "development",
    }), { status: 200 })));
    const ok = await redeemHouseholdInvite({ inviteToken: HEX64, config });
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
    const missing = await bindGoogleMemberships({ config });
    expect(missing).toEqual({ ok: false, reason: "bind-rpc-missing" });
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
});
