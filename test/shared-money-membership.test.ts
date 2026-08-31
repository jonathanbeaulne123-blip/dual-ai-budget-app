import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEAVE_HOUSEHOLD_CONSEQUENCE,
  membershipActionDecision,
} from "../src/core/membershipAccess.ts";
import {
  issueHouseholdInvite,
  leaveHousehold,
  listHouseholdAccess,
  registerCurrentHouseholdDevice,
  revokeHouseholdDevice,
} from "../src/ledger/householdInvites.ts";
import type { SupabaseConfig } from "../src/ledger/supabase.ts";

const config: SupabaseConfig = {
  url: "https://sf02.example.supabase.co",
  key: "sb_publishable_sf02",
  accessToken: "member-jwt",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("SF-02 membership state model", () => {
  it("protects equal co-owners and the last owner while permitting safe leave", () => {
    expect(membershipActionDecision({
      action: "revoke-member",
      actorRole: "owner",
      actorMemberId: "MEM-A",
      targetRole: "owner",
      targetMemberId: "MEM-B",
      activeOwnerCount: 2,
    })).toEqual({ allowed: false, reason: "co-owner-protected" });

    expect(membershipActionDecision({
      action: "leave",
      actorRole: "owner",
      actorMemberId: "MEM-A",
      activeOwnerCount: 1,
    })).toEqual({ allowed: false, reason: "last-owner" });

    expect(membershipActionDecision({
      action: "leave",
      actorRole: "owner",
      actorMemberId: "MEM-A",
      activeOwnerCount: 2,
    }).allowed).toBe(true);
    expect(LEAVE_HOUSEHOLD_CONSEQUENCE).toMatch(/Queued changes.*will not replay/i);
    expect(LEAVE_HOUSEHOLD_CONSEQUENCE).toMatch(/fresh invite/i);
  });

  it("lets members revoke only their own device", () => {
    expect(membershipActionDecision({
      action: "revoke-device",
      actorRole: "member",
      actorMemberId: "MEM-A",
      targetMemberId: "MEM-A",
      activeOwnerCount: 1,
    }).allowed).toBe(true);
    expect(membershipActionDecision({
      action: "revoke-device",
      actorRole: "member",
      actorMemberId: "MEM-A",
      targetMemberId: "MEM-B",
      activeOwnerCount: 1,
    })).toEqual({ allowed: false, reason: "not-self" });
  });
});

describe("SF-02 authenticated access client", () => {
  it("issues co-owner access by default and preserves explicit ordinary-member access", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const args = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return response({
        ok: true,
        id: "invite-1",
        kind: args.p_kind,
        role: args.p_role,
        invite_token: "a".repeat(64),
        expires_at: "2026-09-01T00:00:00Z",
        join_path: "/join",
      });
    });
    vi.stubGlobal("fetch", fetch);
    await expect(issueHouseholdInvite({
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-2",
      kind: "email",
      invitedEmail: "partner@example.com",
      config,
    })).resolves.toMatchObject({ ok: true, role: "owner" });
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({ p_role: "owner" });

    await issueHouseholdInvite({
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-3",
      kind: "qr",
      role: "member",
      config,
    });
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toMatchObject({ p_role: "member" });
  });

  it("registers, lists only sanitized access metadata, revokes a device, and leaves explicitly", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/hearth_register_current_device")) return response({ ok: true, registered: 1 });
      if (url.endsWith("/hearth_list_household_access")) return response({
        ok: true,
        current_member_id: "MEM-1",
        current_role: "owner",
        members: [{ member_id: "MEM-1", display_name: "Jonathan", role: "owner" }],
        devices: [{
          member_id: "MEM-1",
          access_id: "11111111-1111-4111-8111-111111111111",
          device_label: "Chrome on Windows",
          registered_at: "2026-08-30T10:00:00Z",
          last_seen_at: "2026-08-30T11:00:00Z",
          current: true,
        }],
        audit: [{ action: "device-registered", occurred_at: "2026-08-30T10:00:00Z" }],
        email: "must-not-be-consumed@example.com",
        access_token: "must-not-be-consumed",
      });
      if (url.endsWith("/hearth_revoke_device")) return response({ ok: true });
      if (url.endsWith("/hearth_leave_household")) return response({ ok: true, mode: "leave", household_id: "HH-1" });
      return response({ message: "unexpected" }, 404);
    });
    vi.stubGlobal("fetch", fetch);

    await expect(registerCurrentHouseholdDevice({
      environment: "development",
      deviceId: "DEV-0123456789ABCDEF",
      deviceLabel: "Chrome on Windows",
      config,
    })).resolves.toEqual({ ok: true, registered: 1 });

    const listed = await listHouseholdAccess({ environment: "development", householdId: "HH-1", config });
    expect(listed).toMatchObject({
      ok: true,
      access: {
        currentMemberId: "MEM-1",
        currentRole: "owner",
        members: [{ memberId: "MEM-1", role: "owner" }],
        devices: [{ accessId: "11111111-1111-4111-8111-111111111111", current: true }],
      },
    });
    expect(JSON.stringify(listed)).not.toMatch(/must-not-be-consumed|access_token|email/i);
    await expect(revokeHouseholdDevice({
      environment: "development", householdId: "HH-1", accessId: "11111111-1111-4111-8111-111111111111", config,
    })).resolves.toEqual({ ok: true });
    await expect(leaveHousehold({ environment: "development", householdId: "HH-1", config }))
      .resolves.toEqual({ ok: true, mode: "leave", householdId: "HH-1" });
  });

  it("maps a missing migration to an explicit release gate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({
      code: "PGRST202",
      message: "Could not find the function public.hearth_list_household_access in the schema cache",
    }, 404)));
    await expect(listHouseholdAccess({ environment: "development", householdId: "HH-1", config }))
      .resolves.toEqual({ ok: false, reason: "access-rpc-missing" });
  });
});

describe("migration 017 security contract", () => {
  const sql = readFileSync("supabase/migrations/017_shared_money_membership_sessions.sql", "utf8").replace(/\r\n/g, "\n");

  it("uses the Supabase session row plus a non-revivable device tombstone", () => {
    expect(sql).toMatch(/auth\.jwt\(\) ->> 'session_id'/);
    expect(sql).toMatch(/FROM auth\.sessions AS session/);
    expect(sql).toMatch(/registered\.revoked_at IS NULL/);
    expect(sql).toMatch(/RETURN jsonb_build_object\('ok', false, 'reason', 'device-revoked'\)/);
    expect(sql).toMatch(/ON CONFLICT \(environment, household_id, session_id\) DO UPDATE[\s\S]*WHERE public\.hearth_member_sessions\.revoked_at IS NULL/);
  });

  it("keeps access tables RPC-only and never stores financial or identity-provider payloads", () => {
    expect(sql).toMatch(/ALTER TABLE public\.hearth_member_sessions ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL PRIVILEGES ON TABLE public\.hearth_member_sessions FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/GRANT SELECT ON TABLE public\.hearth_member_sessions/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION hearth_private\.identity_audit\(text, text, text, text, text, text\)[\s\S]*FROM authenticated/);
    const auditTable = sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS public.hearth_identity_audit_events"), sql.indexOf("CREATE INDEX IF NOT EXISTS hearth_identity_audit_household_recent"));
    expect(auditTable).not.toMatch(/email|google_subject|access_token|refresh_token|payload|amount|balance|transaction/i);
  });

  it("protects wrong-household, former-member, revoked-device, co-owner, and last-owner boundaries", () => {
    expect(sql).toMatch(/hearth_private\.is_active_member\(p_household_id, p_environment\)/);
    expect(sql).toMatch(/membership\.active IS TRUE[\s\S]*membership\.revoked_at IS NULL/);
    expect(sql).toMatch(/registered\.session_id = hearth_private\.current_session_id\(\)[\s\S]*registered\.revoked_at IS NULL/);
    expect(sql).toMatch(/'co-owner-protected'/);
    expect(sql).toMatch(/caller_role = 'owner' AND owner_count <= 1[\s\S]*'last-owner'/);
    const leaveRpc = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_leave_household"));
    expect(leaveRpc).toMatch(/pg_advisory_xact_lock[\s\S]*owner_count/);
    expect(sql).toMatch(/UPDATE public\.hearth_member_sessions SET revoked_at = now\(\)[\s\S]*revoke_reason = 'member-left'/);
    expect(sql).toMatch(/auth_user_id = NULL/);
    expect(sql).toMatch(/target_subject <> '' AND target_subject IS DISTINCT FROM resolved_subject/);
    expect(sql).toMatch(/'rejoin-email-required'/);
    expect(sql).toMatch(/'rejoin-identity-mismatch'/);
    expect(sql).toMatch(/member_name, false[\s\S]*ON CONFLICT \(environment, household_id, member_id\) DO UPDATE[\s\S]*active = false/);
    const issueRpc = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_issue_invite(\n  p_environment"), sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_redeem_invite"));
    expect(issueRpc).toMatch(/pg_advisory_xact_lock/);
    expect(issueRpc).toMatch(/SET status = 'revoked', revoked_at = now\(\)[\s\S]*target_member_id = p_member_id AND status = 'pending'/);
    expect(sql).toMatch(/WITH ranked_pending AS[\s\S]*pending_rank > 1/);
    expect(sql).toMatch(/UPDATE public\.continuity_memberships AS membership[\s\S]*invitation\.status = 'pending'[\s\S]*membership\.auth_user_id IS NULL/);
    expect(sql).toMatch(/Compatibility for pre-SF-02 clients[\s\S]*SELECT public\.hearth_issue_invite\([\s\S]*p_ttl_hours, 'member'/);
    const redeemRpc = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_redeem_invite"), sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_revoke_member"));
    expect(redeemRpc).toMatch(/SELECT environment, household_id[\s\S]*pg_advisory_xact_lock[\s\S]*SELECT \* INTO invite/);
    expect(redeemRpc).toMatch(/target_user IS NOT NULL OR target_active IS TRUE OR target_role IS DISTINCT FROM invite\.target_role/);
    expect(sql).toMatch(/access_id UUID NOT NULL DEFAULT gen_random_uuid\(\) UNIQUE/);
    const revokeDeviceRpc = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_revoke_device"), sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_issue_invite"));
    expect(revokeDeviceRpc).toMatch(/p_access_id UUID/);
    expect(revokeDeviceRpc).toMatch(/access_id = p_access_id/);
    expect(revokeDeviceRpc).not.toMatch(/WHERE[\s\S]*device_id = p_device_id/);
    const resetRpc = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_reset_development_households"));
    expect(resetRpc).toMatch(/hearth_private\.session_is_live\(\)/);
    expect(resetRpc).toMatch(/hearth_private\.is_active_member\(membership\.household_id, 'development'\)/);
    expect(resetRpc).toMatch(/PERFORM public\.hearth_leave_household\('development', target_household\)/);
  });

  it("does not expose private books through access inventory", () => {
    const listRpc = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_list_household_access"), sql.indexOf("CREATE OR REPLACE FUNCTION public.hearth_revoke_device"));
    expect(listRpc).not.toMatch(/household_snapshots|continuity_personal_snapshots|journal|transaction|balance|payload|google_email|google_subject|auth_user_id/);
    expect(listRpc).toMatch(/'members'/);
    expect(listRpc).toMatch(/'devices'/);
    expect(listRpc).toMatch(/'audit'/);
  });

  it("records the migration without claiming it is applied", () => {
    expect(sql).toMatch(/VALUES \(17, now\(\)::text\)/);
    expect(sql).toMatch(/LOCAL RELEASE PACKET ONLY/);
    expect(sql).not.toMatch(/service_role/);
  });
});

describe("Auth identity lock source contract", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const pairing = readFileSync("src/Pairing.tsx", "utf8");

  it("removes partner switching from Auth-enabled phone identity", () => {
    expect(app).toMatch(/Google Auth locks this phone to that member/);
    expect(app).toMatch(/To use a different member identity, sign out/);
    expect(app).toMatch(/supabaseAuthEnabled\(\) \? \([\s\S]*To use a different member identity[\s\S]*\) : \([\s\S]*<label>This phone is<\/label>/);
  });

  it("states the offline limit and separates Auth from soft presence", () => {
    expect(pairing).toMatch(/Authenticated access only/);
    expect(pairing).toMatch(/cannot erase books already cached while a device is offline/);
    expect(pairing).toMatch(/onCurrentDeviceRevoked\?\.\(\)/);
    expect(pairing).toMatch(/Recent access activity/);
    expect(pairing).toMatch(/Soft presence from phones that touched the shared snapshot\. Not Auth/);
  });
});
