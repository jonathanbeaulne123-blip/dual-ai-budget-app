import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  anonMayAccessHouseholdRest,
  claimLegacyOwner,
  createHouseholdOwner,
  issueInvitation,
  mayAccessResource,
  mayInviteOrRevoke,
  qrJoinPath,
  redeemInvitation,
  type AuthInvitation,
  type AuthMembership,
  type AuthPrincipal,
} from "../src/ledger/authRlsPolicy.ts";

const owner: AuthPrincipal = { authUserId: "auth-owner", email: "jonathan@example.com" };
const joiner: AuthPrincipal = { authUserId: "auth-joiner", email: "bianca@example.com" };
const outsider: AuthPrincipal = { authUserId: "auth-outsider", email: "other@example.com" };

const ownerMembership: AuthMembership = {
  environment: "development",
  householdId: "HH-1",
  memberId: "MEM-001",
  authUserId: owner.authUserId,
  role: "owner",
  active: true,
  revokedAt: null,
  googleSubject: "sub-j",
  googleEmail: owner.email,
};

describe("Auth/RLS policy matrix (D-123)", () => {
  it("denies all household REST to anon", () => {
    expect(anonMayAccessHouseholdRest()).toBe(false);
    expect(mayAccessResource({
      principal: null,
      memberships: [ownerMembership],
      resource: "household_snapshots",
      action: "select",
      householdId: "HH-1",
      environment: "development",
    })).toBe(false);
  });

  it("lets the bounded Create RPC establish an owner only for a new household", () => {
    const created = createHouseholdOwner({
      principal: owner,
      environment: "development",
      householdId: "HH-NEW",
      memberId: "MEM-001",
      googleSubject: "sub-j",
      householdExists: false,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("expected owner creation");
    expect(created.membership.role).toBe("owner");
    expect(createHouseholdOwner({
      principal: outsider,
      environment: "development",
      householdId: "HH-1",
      memberId: "MEM-X",
      googleSubject: "sub-x",
      householdExists: true,
    })).toMatchObject({ ok: false, reason: "household-already-exists" });
    expect(mayAccessResource({
      principal: owner,
      memberships: [created.membership],
      resource: "households",
      action: "delete",
      householdId: "HH-NEW",
      environment: "development",
    })).toBe(false);
  });

  it("never lets an outsider self-promote into an existing legacy household", () => {
    expect(claimLegacyOwner({
      principal: outsider,
      memberships: [{ ...ownerMembership, role: "member" }],
      environment: "development",
      householdId: "HH-1",
      memberId: "MEM-001",
      googleSubject: "sub-x",
    })).toMatchObject({ ok: false, reason: "membership-not-bound-to-caller" });
    expect(claimLegacyOwner({
      principal: owner,
      memberships: [ownerMembership],
      environment: "development",
      householdId: "HH-1",
      memberId: "MEM-001",
      googleSubject: "sub-j",
    })).toMatchObject({ ok: false, reason: "owner-exists" });
  });

  it("allows only owners to issue email or QR invites", () => {
    const memberOnly: AuthMembership = { ...ownerMembership, role: "member", authUserId: joiner.authUserId, memberId: "MEM-002" };
    expect(mayInviteOrRevoke({
      principal: owner,
      memberships: [ownerMembership],
      householdId: "HH-1",
      environment: "development",
    })).toBe(true);
    expect(issueInvitation({
      principal: joiner,
      memberships: [ownerMembership, memberOnly],
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-002",
      kind: "qr",
      inviteToken: "tok",
      expiresAt: "2026-09-01T00:00:00.000Z",
      id: "inv-1",
    }).ok).toBe(false);

    const email = issueInvitation({
      principal: owner,
      memberships: [ownerMembership],
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-002",
      kind: "email",
      invitedEmail: "bianca@example.com",
      inviteToken: "email-tok",
      expiresAt: "2026-09-01T00:00:00.000Z",
      id: "inv-email",
    });
    expect(email.ok).toBe(true);
    if (!email.ok) throw new Error("expected email invite");
    expect(email.invitation.kind).toBe("email");

    const qr = issueInvitation({
      principal: owner,
      memberships: [ownerMembership],
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-002",
      kind: "qr",
      inviteToken: "qr-tok",
      expiresAt: "2026-09-01T00:00:00.000Z",
      id: "inv-qr",
    });
    expect(qr.ok).toBe(true);
    if (!qr.ok) throw new Error("expected qr invite");
    expect(qrJoinPath(qr.invitation.inviteToken, "development")).toBe("/join?invite=qr-tok&env=development");
  });

  it("redeems email invites only for the matching signed-in email", () => {
    const invite: AuthInvitation = {
      id: "inv-email",
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-002",
      kind: "email",
      inviteToken: "email-tok",
      invitedEmail: "bianca@example.com",
      createdByAuthUserId: owner.authUserId,
      status: "pending",
      expiresAt: "2026-09-01T00:00:00.000Z",
      acceptedAt: null,
      acceptedByAuthUserId: null,
      revokedAt: null,
    };
    expect(redeemInvitation({
      principal: outsider,
      invitation: invite,
      memberships: [ownerMembership],
      googleSubject: "sub-x",
      nowIso: "2026-08-24T12:00:00.000Z",
    })).toMatchObject({ ok: false, reason: "email-mismatch" });

    const ok = redeemInvitation({
      principal: joiner,
      invitation: invite,
      memberships: [ownerMembership],
      googleSubject: "sub-b",
      nowIso: "2026-08-24T12:00:00.000Z",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) throw new Error("expected redeem");
    expect(ok.membership.role).toBe("member");
  });

  it("redeems QR invites for any signed-in user and rejects expired tokens", () => {
    const invite: AuthInvitation = {
      id: "inv-qr",
      environment: "development",
      householdId: "HH-1",
      targetMemberId: "MEM-002",
      kind: "qr",
      inviteToken: "qr-tok",
      invitedEmail: null,
      createdByAuthUserId: owner.authUserId,
      status: "pending",
      expiresAt: "2026-08-20T00:00:00.000Z",
      acceptedAt: null,
      acceptedByAuthUserId: null,
      revokedAt: null,
    };
    expect(redeemInvitation({
      principal: joiner,
      invitation: invite,
      memberships: [ownerMembership],
      googleSubject: "sub-b",
      nowIso: "2026-08-24T12:00:00.000Z",
    })).toMatchObject({ ok: false, reason: "expired" });

    const live = { ...invite, expiresAt: "2026-09-01T00:00:00.000Z" };
    const ok = redeemInvitation({
      principal: joiner,
      invitation: live,
      memberships: [ownerMembership],
      googleSubject: "sub-b",
      nowIso: "2026-08-24T12:00:00.000Z",
    });
    expect(ok.ok).toBe(true);
  });

  it("keeps personal snapshots to the signed-in member only and isolates environments", () => {
    const member: AuthMembership = {
      ...ownerMembership,
      authUserId: joiner.authUserId,
      memberId: "MEM-002",
      role: "member",
      googleEmail: joiner.email,
    };
    expect(mayAccessResource({
      principal: joiner,
      memberships: [ownerMembership, member],
      resource: "continuity_personal_snapshots",
      action: "select",
      householdId: "HH-1",
      environment: "development",
      personalMemberId: "MEM-002",
    })).toBe(true);
    expect(mayAccessResource({
      principal: joiner,
      memberships: [ownerMembership, member],
      resource: "continuity_personal_snapshots",
      action: "select",
      householdId: "HH-1",
      environment: "development",
      personalMemberId: "MEM-001",
    })).toBe(false);
    expect(mayAccessResource({
      principal: joiner,
      memberships: [ownerMembership, member],
      resource: "household_snapshots",
      action: "select",
      householdId: "HH-1",
      environment: "production",
    })).toBe(false);
  });

  it("denies direct shared, membership, and invite mutations even to owners", () => {
    for (const resource of ["households", "household_snapshots", "continuity_memberships", "household_invitations"] as const) {
      expect(mayAccessResource({
        principal: owner,
        memberships: [ownerMembership],
        resource,
        action: "update",
        householdId: "HH-1",
        environment: "development",
        invitation: resource === "household_invitations" ? {
          id: "inv", environment: "development", householdId: "HH-1", targetMemberId: "MEM-002",
          kind: "qr", inviteToken: "tok", invitedEmail: null, createdByAuthUserId: owner.authUserId,
          status: "pending", expiresAt: "2026-09-01T00:00:00.000Z", acceptedAt: null,
          acceptedByAuthUserId: null, revokedAt: null,
        } : undefined,
      })).toBe(false);
    }
  });

  it("denies a Development member from reading the same household id in Production", () => {
    expect(mayAccessResource({
      principal: owner,
      memberships: [ownerMembership],
      resource: "household_snapshots",
      action: "select",
      householdId: "HH-1",
      environment: "production",
    })).toBe(false);
    expect(mayAccessResource({
      principal: owner,
      memberships: [{ ...ownerMembership, environment: "production" }],
      resource: "household_snapshots",
      action: "select",
      householdId: "HH-1",
      environment: "development",
    })).toBe(false);
  });
});

describe("Auth/RLS migration packet files", () => {
  const prepare = readFileSync("supabase/migrations/004_auth_rls_prepare.sql", "utf8");
  const migration = readFileSync("supabase/migrations/006_auth_rls_cutover.sql", "utf8");
  const design = readFileSync("docs/AUTH_RLS_CUTOVER.md", "utf8");

  it("is do-not-apply and encodes Jonathan's locked product choices", () => {
    expect(prepare).toMatch(/DO NOT APPLY/i);
    expect(migration).toMatch(/DO NOT APPLY/i);
    expect(migration).toMatch(/hearth_issue_invite/);
    expect(prepare).toMatch(/kind TEXT NOT NULL CHECK \(kind IN \('email', 'qr'\)\)/);
    expect(migration).toMatch(/REVOKE ALL PRIVILEGES ON TABLE[\s\S]+public\.households[\s\S]+FROM anon, authenticated/i);
    expect(prepare).toMatch(/role IN \('owner', 'member'\)/);
    expect(prepare).not.toMatch(/REVOKE ALL PRIVILEGES ON TABLE/i);
    expect(migration).not.toMatch(/CREATE POLICY \S+ ON public\.continuity_memberships[\s\S]{0,160}FOR (INSERT|UPDATE)/i);
    expect(migration).toMatch(/CREATE POLICY hearth_memberships_select ON public\.continuity_memberships\s+FOR SELECT/i);
    expect(design).toMatch(/\*\*Q1\*\*.*\*\*A —/);
    expect(design).toMatch(/email invite or QR invite/i);
    expect(design).toMatch(/no household REST for anon/i);
  });
});
