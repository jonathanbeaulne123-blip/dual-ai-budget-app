import type { Environment } from "./types.ts";

export type LifecycleAction =
  | "create-household"
  | "delete-household"
  | "issue-invite"
  | "revoke-invite"
  | "redeem-invite"
  | "leave-household"
  | "remove-member"
  | "transfer-owner"
  | "revoke-device"
  | "request-recovery"
  | "complete-recovery";

export type CloudReplicaOperation = "push" | "pull";

export type MembershipAuthority = {
  environment: Environment;
  householdId: string;
  memberId: string;
  authUserId: string | null;
  googleSubject: string;
  googleEmail: string;
  role: "owner" | "member";
  active: boolean;
  revokedAt: string | null;
};

/** Hosted session/device authority, not the soft-presence HouseholdDevice snapshot field. */
export type HouseholdDeviceAuthority = {
  id: string;
  environment: Environment;
  householdId: string;
  memberId: string;
  authUserId: string;
  active: boolean;
  revokedAt: string | null;
};

export type LifecycleInvitationAuthority = {
  id: string;
  environment: Environment;
  householdId: string;
  targetMemberId: string;
  targetRole: "owner" | "member";
  kind: "email" | "qr";
  invitedEmail: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  acceptedByAuthUserId: string | null;
};

/** Opaque server-issued recovery authority; callers never search membership rows. */
export type LifecycleRecoveryAuthority = {
  id: string;
  environment: Environment;
  householdId: string;
  memberId: string;
  authUserId: string;
  googleSubject: string;
  status: "requested" | "approved" | "completed" | "revoked";
};

export type LifecycleDenialCode =
  | "authentication-required"
  | "create-scope-invalid"
  | "membership-required"
  | "owner-required"
  | "target-required"
  | "target-unavailable"
  | "co-owner-protected"
  | "last-owner"
  | "device-revoked"
  | "device-not-authorized"
  | "invitation-unavailable"
  | "recovery-unavailable"
  | "deletion-refused"
  | "approval-required";

export type LifecycleVerdict =
  | { allowed: true; actorMemberId: string; reason: string }
  | { allowed: false; code: LifecycleDenialCode; message: string };

type ActorScopeInput = {
  environment: Environment;
  authUserId: string;
  authGoogleSubject: string;
  authEmail: string;
  householdId: string | null;
  actorMemberId: string | null;
  actorDeviceId: string | null;
  memberships: MembershipAuthority[];
  devices: HouseholdDeviceAuthority[];
};

export type LifecycleAuthorityInput = ActorScopeInput & {
  action: LifecycleAction;
  now: string;
  targetId?: string;
  invitationRequest?: {
    kind: "email" | "qr";
    invitedEmail: string | null;
    targetRole: "owner" | "member";
  };
  deletionApproved?: boolean;
  invitations?: LifecycleInvitationAuthority[];
  recoveries?: LifecycleRecoveryAuthority[];
};

export type CloudReplicaAuthorityInput = ActorScopeInput & {
  operation: CloudReplicaOperation;
};

export const DEVICE_REVOCATION_BOUNDARY =
  "Revocation ends hosted push and pull immediately. It cannot remotely erase household data already cached on that device.";

const INVITATION_UNAVAILABLE = "That invitation is unavailable.";
const RECOVERY_UNAVAILABLE = "Recovery is unavailable. Start again from the signed-in recovery screen.";

function denied(code: LifecycleDenialCode, message: string): LifecycleVerdict {
  return { allowed: false, code, message };
}

function allowed(memberId: string, reason: string): LifecycleVerdict {
  return { allowed: true, actorMemberId: memberId, reason };
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function sameScope(
  row: { environment: Environment; householdId: string },
  input: Pick<ActorScopeInput, "environment" | "householdId">,
): boolean {
  return input.householdId !== null
    && row.environment === input.environment
    && row.householdId === input.householdId;
}

function activeMembership(input: ActorScopeInput): MembershipAuthority | null {
  if (!input.householdId || !input.actorMemberId) return null;
  return input.memberships.find((row) => (
    sameScope(row, input)
    && row.memberId === input.actorMemberId
    && row.authUserId === input.authUserId
    && row.googleSubject === input.authGoogleSubject
    && row.active
    && row.revokedAt === null
  )) ?? null;
}

function membershipTarget(input: LifecycleAuthorityInput): MembershipAuthority | null {
  if (!input.targetId) return null;
  return input.memberships.find((row) => sameScope(row, input) && row.memberId === input.targetId) ?? null;
}

/** Mirrors migration 017: bootstrap is allowed only until any seat session row exists. */
function actorDeviceDenial(input: ActorScopeInput, actor: MembershipAuthority): LifecycleVerdict | null {
  const registered = input.devices.filter((row) => (
    sameScope(row, input)
    && row.memberId === actor.memberId
  ));
  if (registered.length === 0) return null;
  if (!input.actorDeviceId) {
    return denied("device-not-authorized", "This signed-in device has no active household access.");
  }
  const device = registered.find((row) => (
    row.id === input.actorDeviceId && row.authUserId === input.authUserId
  ));
  if (!device) {
    return denied("device-not-authorized", "This signed-in device has no active household access.");
  }
  if (!device.active || device.revokedAt !== null) {
    return denied("device-revoked", "This signed-in device was removed from the household.");
  }
  return null;
}

function invitationFor(input: LifecycleAuthorityInput): LifecycleInvitationAuthority | null {
  if (!input.targetId) return null;
  return input.invitations?.find((row) => sameScope(row, input) && row.id === input.targetId) ?? null;
}

function recoveryFor(input: LifecycleAuthorityInput): LifecycleRecoveryAuthority | null {
  if (!input.targetId || !input.actorMemberId) return null;
  return input.recoveries?.find((row) => (
    sameScope(row, input)
    && row.id === input.targetId
    && row.memberId === input.actorMemberId
    && row.authUserId === input.authUserId
    && row.googleSubject === input.authGoogleSubject
  )) ?? null;
}

/**
 * Pure mirror of the household lifecycle policy. It grants no server access and
 * performs no I/O. Hosted RPC/RLS remains authoritative at the cloud boundary.
 */
export function lifecycleVerdict(input: LifecycleAuthorityInput): LifecycleVerdict {
  if (!input.authUserId.trim() || !input.authGoogleSubject.trim()) {
    return denied("authentication-required", "Continue with Google first.");
  }

  if (input.action === "create-household") {
    if (input.householdId !== null || !input.actorMemberId?.trim()) {
      return denied("create-scope-invalid", "Create must begin outside an existing household scope.");
    }
    return allowed(input.actorMemberId, "The bounded Create path may establish this caller as the first owner.");
  }

  if (input.action === "redeem-invite") {
    const invitation = invitationFor(input);
    if (!invitation || !input.actorMemberId || invitation.targetMemberId !== input.actorMemberId) {
      return denied("invitation-unavailable", INVITATION_UNAVAILABLE);
    }
    if (invitation.status === "accepted" && invitation.acceptedByAuthUserId === input.authUserId) {
      return allowed(invitation.targetMemberId, "The same caller may safely replay its accepted invitation.");
    }
    const expiresAt = Date.parse(invitation.expiresAt);
    const now = Date.parse(input.now);
    if (invitation.status !== "pending" || !Number.isFinite(expiresAt) || !Number.isFinite(now) || expiresAt <= now) {
      return denied("invitation-unavailable", INVITATION_UNAVAILABLE);
    }
    if (invitation.kind === "email"
      && normalizedEmail(invitation.invitedEmail ?? "") !== normalizedEmail(input.authEmail)) {
      return denied("invitation-unavailable", INVITATION_UNAVAILABLE);
    }
    const alreadyBoundElsewhere = input.memberships.some((row) => (
      sameScope(row, input)
      && row.authUserId === input.authUserId
      && row.active
      && row.revokedAt === null
      && row.memberId !== invitation.targetMemberId
    ));
    const seat = input.memberships.find((row) => sameScope(row, input) && row.memberId === invitation.targetMemberId);
    if (alreadyBoundElsewhere || !seat || seat.active || seat.authUserId !== null || seat.role !== invitation.targetRole) {
      return denied("invitation-unavailable", INVITATION_UNAVAILABLE);
    }
    if (seat.googleSubject !== "" && seat.googleSubject !== input.authGoogleSubject) {
      return denied("invitation-unavailable", INVITATION_UNAVAILABLE);
    }
    return allowed(invitation.targetMemberId, "A live invitation may bind only its exact retained-identity seat.");
  }

  if (input.action === "request-recovery" || input.action === "complete-recovery") {
    const recovery = recoveryFor(input);
    const expected = input.action === "request-recovery" ? "requested" : "approved";
    if (!recovery || recovery.status !== expected) {
      return denied("recovery-unavailable", RECOVERY_UNAVAILABLE);
    }
    return allowed(recovery.memberId, input.action === "request-recovery"
      ? "An opaque exact-identity recovery request may proceed."
      : "Only an approved exact-identity recovery may complete.");
  }

  const actor = activeMembership(input);
  if (!actor) {
    return denied("membership-required", "You do not have active access to this household.");
  }
  const deviceDenial = actorDeviceDenial(input, actor);
  if (deviceDenial) return deviceDenial;

  switch (input.action) {
    case "delete-household":
      if (input.environment === "production") {
        return denied("deletion-refused", "Household deletion is unavailable in Production.");
      }
      if (actor.role !== "owner") return denied("owner-required", "Only a household owner can delete it.");
      if (!input.deletionApproved) return denied("approval-required", "Confirm the Development household deletion first.");
      return allowed(actor.memberId, "An explicitly approved Development-only household deletion may proceed.");
    case "issue-invite": {
      if (actor.role !== "owner") return denied("owner-required", "Only a household owner can issue invitations.");
      const target = membershipTarget(input);
      const request = input.invitationRequest;
      if (!target || !request || target.memberId === actor.memberId || target.active || target.authUserId !== null) {
        return denied("target-unavailable", "That member seat is unavailable for invitation.");
      }
      if (request.kind === "email" && normalizedEmail(request.invitedEmail ?? "") === "") {
        return denied("target-unavailable", "A valid email is required for an email invitation.");
      }
      if (target.googleSubject !== "" && request.kind !== "email") {
        return denied("target-unavailable", "A former member seat requires its retained email identity.");
      }
      if (target.googleSubject !== ""
        && normalizedEmail(request.invitedEmail ?? "") !== normalizedEmail(target.googleEmail)) {
        return denied("target-unavailable", "That member seat is unavailable for invitation.");
      }
      return allowed(actor.memberId, "An owner may issue an invitation for this exact available seat.");
    }
    case "revoke-invite": {
      if (actor.role !== "owner") return denied("owner-required", "Only a household owner can revoke invitations.");
      const invitation = invitationFor(input);
      if (!invitation || invitation.status !== "pending") {
        return denied("invitation-unavailable", INVITATION_UNAVAILABLE);
      }
      return allowed(actor.memberId, "An owner may revoke this pending household invitation.");
    }
    case "leave-household": {
      const ownerCount = input.memberships.filter((row) => (
        sameScope(row, input) && row.active && row.revokedAt === null && row.role === "owner"
      )).length;
      if (actor.role === "owner" && ownerCount <= 1) {
        return denied("last-owner", "Transfer ownership or complete an approved Development deletion before the last owner leaves.");
      }
      return allowed(actor.memberId, "An active member may leave when household ownership remains.");
    }
    case "remove-member": {
      if (actor.role !== "owner") return denied("owner-required", "Only a household owner can remove a member.");
      const target = membershipTarget(input);
      if (!target || !target.active || target.revokedAt !== null || target.memberId === actor.memberId) {
        return denied("target-unavailable", "That member is unavailable for removal.");
      }
      if (target.role === "owner") {
        return denied("co-owner-protected", "A co-owner cannot remove another owner through the member-removal path.");
      }
      return allowed(actor.memberId, "An owner may remove this active non-owner member.");
    }
    case "transfer-owner": {
      if (actor.role !== "owner") return denied("owner-required", "Only an owner can transfer ownership.");
      const target = membershipTarget(input);
      if (!target || !target.active || target.revokedAt !== null || target.memberId === actor.memberId || target.role !== "member") {
        return denied("target-unavailable", "Ownership can transfer only to a different active member.");
      }
      return allowed(actor.memberId, "This owner may transfer ownership to the named active member.");
    }
    case "revoke-device": {
      if (!input.targetId) return denied("target-required", "Choose the exact device access record to revoke.");
      const target = input.devices.find((row) => sameScope(row, input) && row.id === input.targetId);
      if (!target || !target.active || target.revokedAt !== null) {
        return denied("device-not-authorized", "That device has no active household access.");
      }
      if (actor.role !== "owner" && target.memberId !== actor.memberId) {
        return denied("device-not-authorized", "Members can revoke only their own device.");
      }
      return allowed(actor.memberId, "The exact active device access record may be revoked.");
    }
    default:
      return denied("membership-required", "You do not have active access to this household.");
  }
}

/** Pure preflight for the cloud snapshot boundary; the server still decides. */
export function cloudReplicaVerdict(input: CloudReplicaAuthorityInput): LifecycleVerdict {
  if (!input.authUserId.trim() || !input.authGoogleSubject.trim()) {
    return denied("authentication-required", "Continue with Google first.");
  }
  const actor = activeMembership(input);
  if (!actor) return denied("membership-required", "You do not have active access to this household.");
  const deviceDenial = actorDeviceDenial(input, actor);
  if (deviceDenial) return deviceDenial;
  return allowed(actor.memberId, `This active hosted session may ${input.operation} the household replica.`);
}
