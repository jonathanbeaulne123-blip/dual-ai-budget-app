import { describe, expect, it, vi } from "vitest";
import {
  authInviteFromLocation,
  authInviteTokenFromText,
  isAuthInviteToken,
} from "../src/core/authInvite.ts";
import {
  inviteReasonMessage,
  issueHouseholdInvite,
  redeemHouseholdInvite,
} from "../src/ledger/householdInvites.ts";
import type { SupabaseConfig } from "../src/ledger/supabase.ts";

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
});
