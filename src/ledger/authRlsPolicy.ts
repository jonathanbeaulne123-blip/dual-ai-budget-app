/**
 * Pure Auth/RLS policy + invite contract (D-123).
 * Mirrors supabase/migrations/004_auth_rls_cutover.sql for deterministic tests
 * without contacting the household project or applying SQL.
 */

export type AuthRole = "owner" | "member";
export type InviteKind = "email" | "qr";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";
export type EnvironmentName = "development" | "production";

export type AuthMembership = {
  environment: EnvironmentName;
  householdId: string;
  memberId: string;
  authUserId: string;
  role: AuthRole;
  active: boolean;
  revokedAt: string | null;
  googleSubject: string;
  googleEmail: string;
};

export type AuthInvitation = {
  id: string;
  environment: EnvironmentName;
  householdId: string;
  kind: InviteKind;
  inviteToken: string;
  invitedEmail: string | null;
  createdByAuthUserId: string;
  status: InviteStatus;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByAuthUserId: string | null;
  revokedAt: string | null;
};

export type AuthPrincipal = {
  /** Supabase auth.uid() */
  authUserId: string;
  /** Lowercased email from Google / JWT — required for email invite redeem */
  email: string;
};

export type PolicyAction = "select" | "insert" | "update" | "delete";
export type PolicyResource =
  | "households"
  | "household_snapshots"
  | "continuity_memberships"
  | "continuity_personal_snapshots"
  | "household_invitations";

function activeMembership(
  rows: AuthMembership[],
  principal: AuthPrincipal | null,
  householdId: string,
  environment: EnvironmentName,
): AuthMembership | null {
  if (!principal) return null;
  return rows.find((row) => (
    row.authUserId === principal.authUserId
    && row.householdId === householdId
    && row.environment === environment
    && row.active
    && !row.revokedAt
  )) ?? null;
}

/** Table-level REST: anon has zero household access (Q4). */
export function anonMayAccessHouseholdRest(): boolean {
  return false;
}

export function mayAccessResource(input: {
  principal: AuthPrincipal | null;
  memberships: AuthMembership[];
  resource: PolicyResource;
  action: PolicyAction;
  householdId: string;
  environment: EnvironmentName;
  /** For personal snapshots: the row's member_id */
  personalMemberId?: string;
  /** For invitation rows: created_by or invited email match */
  invitation?: AuthInvitation;
}): boolean {
  if (!input.principal) return false;
  if (input.action === "delete") return false;

  const membership = activeMembership(
    input.memberships,
    input.principal,
    input.householdId,
    input.environment,
  );

  if (input.resource === "household_invitations") {
    const invite = input.invitation;
    if (!invite || invite.householdId !== input.householdId || invite.environment !== input.environment) {
      return false;
    }
    if (input.action === "select") {
      if (membership?.role === "owner") return true;
      if (invite.kind === "email" && invite.invitedEmail === input.principal.email) return true;
      return false;
    }
    // insert/update invites: owners only
    return membership?.role === "owner";
  }

  if (!membership) return false;

  if (input.resource === "continuity_personal_snapshots") {
    if (!input.personalMemberId) return false;
    return input.personalMemberId === membership.memberId;
  }

  // households, snapshots, continuity_memberships: any active member of that env/household
  if (input.resource === "continuity_memberships" && input.action === "update") {
    // Members may not change roles / revoke; owners may update membership rows in-household
    return membership.role === "owner";
  }

  return true;
}

export function mayInviteOrRevoke(input: {
  principal: AuthPrincipal | null;
  memberships: AuthMembership[];
  householdId: string;
  environment: EnvironmentName;
}): boolean {
  const membership = activeMembership(
    input.memberships,
    input.principal,
    input.householdId,
    input.environment,
  );
  return membership?.role === "owner";
}

export type RedeemResult =
  | { ok: true; membership: AuthMembership }
  | { ok: false; reason: "unauthenticated" | "expired" | "not-pending" | "email-mismatch" | "already-member" | "not-found" };

export function redeemInvitation(input: {
  principal: AuthPrincipal | null;
  invitation: AuthInvitation | null;
  memberships: AuthMembership[];
  memberId: string;
  googleSubject: string;
  nowIso: string;
}): RedeemResult {
  if (!input.principal) return { ok: false, reason: "unauthenticated" };
  if (!input.invitation) return { ok: false, reason: "not-found" };
  const invite = input.invitation;
  if (invite.status !== "pending") return { ok: false, reason: "not-pending" };
  if (Date.parse(invite.expiresAt) <= Date.parse(input.nowIso)) {
    return { ok: false, reason: "expired" };
  }
  if (invite.kind === "email") {
    const expected = (invite.invitedEmail ?? "").trim().toLowerCase();
    if (!expected || expected !== input.principal.email.trim().toLowerCase()) {
      return { ok: false, reason: "email-mismatch" };
    }
  }
  const already = input.memberships.some((row) => (
    row.authUserId === input.principal!.authUserId
    && row.householdId === invite.householdId
    && row.environment === invite.environment
    && row.active
    && !row.revokedAt
  ));
  if (already) return { ok: false, reason: "already-member" };

  const membership: AuthMembership = {
    environment: invite.environment,
    householdId: invite.householdId,
    memberId: input.memberId,
    authUserId: input.principal.authUserId,
    role: "member",
    active: true,
    revokedAt: null,
    googleSubject: input.googleSubject,
    googleEmail: input.principal.email.trim().toLowerCase(),
  };
  return { ok: true, membership };
}

/** Create household: caller becomes owner (Welcome Create). */
export function establishOwnerMembership(input: {
  principal: AuthPrincipal;
  environment: EnvironmentName;
  householdId: string;
  memberId: string;
  googleSubject: string;
}): AuthMembership {
  return {
    environment: input.environment,
    householdId: input.householdId,
    memberId: input.memberId,
    authUserId: input.principal.authUserId,
    role: "owner",
    active: true,
    revokedAt: null,
    googleSubject: input.googleSubject,
    googleEmail: input.principal.email.trim().toLowerCase(),
  };
}

export function issueInvitation(input: {
  principal: AuthPrincipal;
  memberships: AuthMembership[];
  environment: EnvironmentName;
  householdId: string;
  kind: InviteKind;
  invitedEmail?: string | null;
  inviteToken: string;
  expiresAt: string;
  id: string;
}): { ok: true; invitation: AuthInvitation } | { ok: false; reason: "not-owner" | "email-required" } {
  if (!mayInviteOrRevoke({
    principal: input.principal,
    memberships: input.memberships,
    householdId: input.householdId,
    environment: input.environment,
  })) {
    return { ok: false, reason: "not-owner" };
  }
  if (input.kind === "email") {
    const email = (input.invitedEmail ?? "").trim().toLowerCase();
    if (!email) return { ok: false, reason: "email-required" };
  }
  return {
    ok: true,
    invitation: {
      id: input.id,
      environment: input.environment,
      householdId: input.householdId,
      kind: input.kind,
      inviteToken: input.inviteToken,
      invitedEmail: input.kind === "email" ? (input.invitedEmail ?? "").trim().toLowerCase() : null,
      createdByAuthUserId: input.principal.authUserId,
      status: "pending",
      expiresAt: input.expiresAt,
      acceptedAt: null,
      acceptedByAuthUserId: null,
      revokedAt: null,
    },
  };
}

/** QR join URL payload — token only; redeem still requires signed-in Supabase session. */
export function qrJoinPath(inviteToken: string, environment: EnvironmentName): string {
  const params = new URLSearchParams({ invite: inviteToken, env: environment });
  return `/join?${params.toString()}`;
}
