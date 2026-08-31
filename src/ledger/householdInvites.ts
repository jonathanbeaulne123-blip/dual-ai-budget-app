/**
 * Authenticated invitation RPC client (D-123 / migration 006).
 * Tokens are one-time; only the raw token from issue is shown in UI.
 */
import type { Environment } from "../core/types.ts";
import type { GoogleIdentitySelector } from "../core/google.ts";
import { hostedContinuityAllowed } from "./continuityPolicy.ts";
import type { ContinuityMembershipSummary, SupabaseConfig } from "./supabase.ts";
import { listActiveContinuityMemberships, readSupabaseConfig } from "./supabase.ts";

export type InviteKind = "email" | "qr";
export type MembershipRole = "owner" | "member";

export type IssueInviteResult =
  | {
    ok: true;
    id: string;
    kind: InviteKind;
    role: MembershipRole;
    inviteToken: string;
    expiresAt: string;
    joinPath: string;
  }
  | { ok: false; reason: string };

export type RedeemInviteResult =
  | {
    ok: true;
    duplicate: boolean;
    role: MembershipRole;
    memberId?: string;
    householdId: string;
    environment: Environment;
  }
  | { ok: false; reason: string };

export type RevokeMemberResult = { ok: true } | { ok: false; reason: string };

export type HouseholdAccessMember = {
  memberId: string;
  displayName: string;
  role: MembershipRole;
};

export type HouseholdAccessDevice = {
  memberId: string;
  /** Opaque server-issued registration id; never the client device id. */
  accessId: string;
  deviceLabel: string;
  registeredAt: string;
  lastSeenAt: string;
  current: boolean;
};

export type HouseholdIdentityAuditEvent = {
  action: string;
  actorMemberId?: string;
  targetMemberId?: string;
  targetDeviceId?: string;
  occurredAt: string;
};

export type HouseholdAccess = {
  currentMemberId: string;
  currentRole: MembershipRole;
  members: HouseholdAccessMember[];
  devices: HouseholdAccessDevice[];
  audit: HouseholdIdentityAuditEvent[];
};

export type HouseholdAccessResult =
  | { ok: true; access: HouseholdAccess }
  | { ok: false; reason: string };

export type RegisterDeviceResult =
  | { ok: true; registered: number }
  | { ok: false; reason: string };

export type LeaveHouseholdResult =
  | { ok: true; mode: "leave" | "delete"; householdId: string }
  | { ok: false; reason: string };

export type BindMembershipsResult =
  | { ok: true; bound: number; googleSubject: string; googleEmail: string }
  | { ok: false; reason: string };

export type ResetDevelopmentHouseholdsResult =
  | { ok: true; deleted: string[]; left: string[] }
  | { ok: false; reason: string };

type RpcBody = Record<string, unknown>;

function messageOf(body: unknown): string {
  if (!body || typeof body !== "object") return "Cloud invite call failed.";
  const row = body as { message?: string; error?: string; hint?: string };
  return row.message || row.error || row.hint || "Cloud invite call failed.";
}

async function rpc(
  config: SupabaseConfig,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.accessToken || config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  return { ok: response.ok, status: response.status, body };
}

function asObject(body: unknown): RpcBody | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as RpcBody;
}

export type ContinuitySyncUiState = "idle" | "syncing" | "synced" | "error";

/** Chrome-only: do not Issue while this phone is still trying to share. The invite RPC stays owner-gated. */
export function authInviteIssueGate(input: {
  syncState: ContinuitySyncUiState;
  sharingMode?: string | null;
}): {
  ready: boolean;
  message: string | null;
} {
  if (input.syncState === "syncing" || input.sharingMode === "pending-transport") {
    return {
      ready: false,
      message: "Wait until this household finishes sharing before sending an invite.",
    };
  }
  return { ready: true, message: null };
}

export function inviteReasonMessage(reason: string): string {
  switch (reason) {
    case "not-owner":
      return "Only the household owner can send an invite.";
    case "email-required":
      return "Email invites need the other person's Google email.";
    case "member-not-in-household":
      return "That person is not on this household roster.";
    case "member-already-bound":
      return "That person already has a Google account on this household.";
    case "unauthenticated":
      return "Continue with Google first.";
    case "google-identity-required":
      return "Sign in with Google (not email/password alone) to join.";
    case "not-found":
      return "That invite link is unknown or already used.";
    case "not-pending":
      return "That invite is no longer open.";
    case "expired":
      return "That invite expired. Ask the owner for a new one.";
    case "email-mismatch":
      return "Sign in with the Google account that matches the invited email.";
    case "already-member":
      return "You already belong to this household as someone else.";
    case "target-unavailable":
      return "That seat is already taken.";
    case "not-found-owner-or-self":
      return "Could not revoke that member.";
    case "bad-kind":
      return "Invite must be email or QR.";
    case "production-blocked":
      return "Production households cannot be deleted from the kitchen.";
    case "continuity-disabled":
      return "Production cloud continuity is unavailable in this Development pilot.";
    case "not-member":
      return "You are not an active member of that household.";
    case "session-not-live":
      return "This Google session is no longer active. Continue with Google again.";
    case "device-revoked":
      return "This signed-in device was removed from the household. Continue with Google again to request fresh access.";
    case "device-not-found":
      return "That device no longer has active household access.";
    case "bad-device":
      return "This phone could not establish a valid device identity.";
    case "bad-role":
      return "Choose co-owner or member access.";
    case "co-owner-protected":
      return "A co-owner cannot silently remove another co-owner.";
    case "last-owner":
      return "Add another co-owner before the last owner leaves.";
    case "rejoin-email-required":
      return "Rejoining a former member seat needs an email invite to the same Google identity.";
    case "rejoin-identity-mismatch":
      return "That former member seat can only be restored by its original Google identity.";
    case "access-rpc-missing":
      return "Household access management needs unapplied migration 017.";
    case "delete-rpc-missing":
      return "Delete household needs migration 015 pasted in the Supabase SQL Editor.";
    case "reset-rpc-missing":
      return "Start from scratch needs migration 016 (or 015) pasted in the Supabase SQL Editor.";
    case "production-reset-blocked":
      return "Start from scratch is Development only. Production households stay.";
    case "reset-failed":
      return "The cloud could not reset Development households. Nothing was cleared on this phone.";
    default:
      return reason ? `Invite failed (${reason}).` : "Invite failed.";
  }
}

export async function issueHouseholdInvite(input: {
  environment: Environment;
  householdId: string;
  targetMemberId: string;
  kind: InviteKind;
  invitedEmail?: string | null;
  role?: MembershipRole;
  ttlHours?: number;
  config?: SupabaseConfig | null;
}): Promise<IssueInviteResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  const result = await rpc(config, "hearth_issue_invite", {
    p_environment: input.environment,
    p_household_id: input.householdId,
    p_member_id: input.targetMemberId,
    p_kind: input.kind,
    p_invited_email: input.kind === "email" ? (input.invitedEmail ?? null) : null,
    p_ttl_hours: input.ttlHours ?? 168,
    p_role: input.role ?? "owner",
  });
  if (!result.ok) {
    return { ok: false, reason: messageOf(result.body) };
  }
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) {
    return { ok: false, reason: String(body.reason || "issue-failed") };
  }
  return {
    ok: true,
    id: String(body.id),
    kind: body.kind === "email" ? "email" : "qr",
    role: body.role === "member" ? "member" : "owner",
    inviteToken: String(body.invite_token),
    expiresAt: String(body.expires_at),
    joinPath: String(body.join_path),
  };
}

export async function redeemHouseholdInvite(input: {
  environment: Environment;
  inviteToken: string;
  displayName?: string;
  config?: SupabaseConfig | null;
}): Promise<RedeemInviteResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  const result = await rpc(config, "hearth_redeem_invite", {
    p_invite_token: input.inviteToken,
    p_display_name: input.displayName ?? "",
  });
  if (!result.ok) {
    return { ok: false, reason: messageOf(result.body) };
  }
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) {
    return { ok: false, reason: String(body.reason || "redeem-failed") };
  }
  const environment = body.environment === "production" ? "production" : "development";
  return {
    ok: true,
    duplicate: body.duplicate === true,
    role: body.role === "owner" ? "owner" : "member",
    memberId: body.member_id ? String(body.member_id) : undefined,
    householdId: String(body.household_id),
    environment,
  };
}

export async function revokeHouseholdMember(input: {
  environment: Environment;
  householdId: string;
  memberId: string;
  config?: SupabaseConfig | null;
}): Promise<RevokeMemberResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  const result = await rpc(config, "hearth_revoke_member", {
    p_environment: input.environment,
    p_household_id: input.householdId,
    p_member_id: input.memberId,
  });
  if (!result.ok) {
    return { ok: false, reason: messageOf(result.body) };
  }
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) {
    return { ok: false, reason: String(body.reason || "revoke-failed") };
  }
  return { ok: true };
}

function missingRpc(message: string): boolean {
  return /could not find|schema cache|404|PGRST202/i.test(message);
}

/** Register this JWT session/device across the caller's active memberships. */
export async function registerCurrentHouseholdDevice(input: {
  environment: Environment;
  deviceId: string;
  deviceLabel: string;
  config?: SupabaseConfig | null;
}): Promise<RegisterDeviceResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) return { ok: false, reason: "unauthenticated" };
  const result = await rpc(config, "hearth_register_current_device", {
    p_environment: input.environment,
    p_device_id: input.deviceId,
    p_device_label: input.deviceLabel,
  });
  if (!result.ok) {
    const message = messageOf(result.body);
    return { ok: false, reason: missingRpc(message) ? "access-rpc-missing" : message };
  }
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) return { ok: false, reason: String(body.reason || "register-failed") };
  return { ok: true, registered: Number(body.registered || 0) };
}

function accessMembers(value: unknown): HouseholdAccessMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asObject(item);
    if (!row?.member_id) return [];
    return [{
      memberId: String(row.member_id),
      displayName: String(row.display_name || "Household member"),
      role: row.role === "owner" ? "owner" as const : "member" as const,
    }];
  });
}

function accessDevices(value: unknown): HouseholdAccessDevice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asObject(item);
    if (!row?.member_id || !row.access_id) return [];
    return [{
      memberId: String(row.member_id),
      accessId: String(row.access_id),
      deviceLabel: String(row.device_label || "Device"),
      registeredAt: String(row.registered_at || ""),
      lastSeenAt: String(row.last_seen_at || ""),
      current: row.current === true,
    }];
  });
}

function accessAudit(value: unknown): HouseholdIdentityAuditEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asObject(item);
    if (!row?.action || !row.occurred_at) return [];
    return [{
      action: String(row.action),
      actorMemberId: row.actor_member_id ? String(row.actor_member_id) : undefined,
      targetMemberId: row.target_member_id ? String(row.target_member_id) : undefined,
      targetDeviceId: row.target_device_id ? String(row.target_device_id) : undefined,
      occurredAt: String(row.occurred_at),
    }];
  });
}

export async function listHouseholdAccess(input: {
  environment: Environment;
  householdId: string;
  config?: SupabaseConfig | null;
}): Promise<HouseholdAccessResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) return { ok: false, reason: "unauthenticated" };
  const result = await rpc(config, "hearth_list_household_access", {
    p_environment: input.environment,
    p_household_id: input.householdId,
  });
  if (!result.ok) {
    const message = messageOf(result.body);
    return { ok: false, reason: missingRpc(message) ? "access-rpc-missing" : message };
  }
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) return { ok: false, reason: String(body.reason || "access-failed") };
  return {
    ok: true,
    access: {
      currentMemberId: String(body.current_member_id || ""),
      currentRole: body.current_role === "owner" ? "owner" : "member",
      members: accessMembers(body.members),
      devices: accessDevices(body.devices),
      audit: accessAudit(body.audit),
    },
  };
}

export async function revokeHouseholdDevice(input: {
  environment: Environment;
  householdId: string;
  accessId: string;
  config?: SupabaseConfig | null;
}): Promise<RevokeMemberResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) return { ok: false, reason: "unauthenticated" };
  const result = await rpc(config, "hearth_revoke_device", {
    p_environment: input.environment,
    p_household_id: input.householdId,
    p_access_id: input.accessId,
  });
  if (!result.ok) {
    const message = messageOf(result.body);
    return { ok: false, reason: missingRpc(message) ? "access-rpc-missing" : message };
  }
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) return { ok: false, reason: String(body.reason || "revoke-failed") };
  return { ok: true };
}

/** Voluntary leave. It never aliases Development household deletion. */
export async function leaveHousehold(input: {
  environment: Environment;
  householdId: string;
  config?: SupabaseConfig | null;
}): Promise<LeaveHouseholdResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) return { ok: false, reason: "unauthenticated" };
  const result = await rpc(config, "hearth_leave_household", {
    p_environment: input.environment,
    p_household_id: input.householdId,
  });
  if (!result.ok) return { ok: false, reason: messageOf(result.body) };
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) return { ok: false, reason: String(body.reason || "leave-failed") };
  return { ok: true, mode: "leave", householdId: String(body.household_id || input.householdId) };
}

/** Leave a household as a member, or delete it entirely when owner (Development only). */
export async function leaveOrDeleteHousehold(input: {
  environment: Environment;
  householdId: string;
  role: "owner" | "member" | null;
  config?: SupabaseConfig | null;
}): Promise<LeaveHouseholdResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  if (!input.role) {
    return { ok: false, reason: "not-member" };
  }
  const rpcName = input.role === "owner" && input.environment === "development"
    ? "hearth_delete_development_household"
    : "hearth_leave_household";
  const args = rpcName === "hearth_delete_development_household"
    ? { p_household_id: input.householdId }
    : { p_environment: input.environment, p_household_id: input.householdId };
  const result = await rpc(config, rpcName, args);
  if (!result.ok) {
    const message = messageOf(result.body);
    if (/could not find|schema cache|404|PGRST202/i.test(message)) {
      return { ok: false, reason: "delete-rpc-missing" };
    }
    return { ok: false, reason: message };
  }
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) {
    return { ok: false, reason: String(body.reason || "delete-failed") };
  }
  const mode = body.mode === "delete" ? "delete" : "leave";
  return {
    ok: true,
    mode,
    householdId: String(body.household_id || input.householdId),
  };
}

function asStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

/** Delete owned Development households and leave member seats. Production is refused. */
export async function resetDevelopmentHouseholds(input: {
  environment: Environment;
  identity: GoogleIdentitySelector;
  known?: ContinuityMembershipSummary[];
  config?: SupabaseConfig | null;
}): Promise<ResetDevelopmentHouseholdsResult> {
  if (input.environment !== "development") {
    return { ok: false, reason: "production-reset-blocked" };
  }
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  const bulk = await rpc(config, "hearth_reset_development_households", {});
  if (bulk.ok) {
    const body = asObject(bulk.body);
    if (!body) return { ok: false, reason: "invalid-response" };
    if (body.ok !== true) {
      return { ok: false, reason: String(body.reason || "reset-failed") };
    }
    return {
      ok: true,
      deleted: asStringIds(body.deleted),
      left: asStringIds(body.left),
    };
  }
  const message = messageOf(bulk.body);
  if (!/could not find|schema cache|404|PGRST202/i.test(message)) {
    return { ok: false, reason: message };
  }

  const listed = input.known?.length
    ? input.known
    : await listActiveContinuityMemberships({
      identity: input.identity,
      environment: "development",
      config,
    });
  const deleted: string[] = [];
  const left: string[] = [];
  for (const row of listed) {
    const result = await leaveOrDeleteHousehold({
      environment: "development",
      householdId: row.householdId,
      role: row.role,
      config,
    });
    if (!result.ok) {
      if (result.reason === "delete-rpc-missing") {
        return { ok: false, reason: "reset-rpc-missing" };
      }
      return { ok: false, reason: result.reason };
    }
    if (result.mode === "delete") deleted.push(result.householdId);
    else left.push(result.householdId);
  }
  return { ok: true, deleted, left };
}

/** Bind caller's Google identity onto matching continuity_memberships (migration 010). */
export async function bindGoogleMemberships(input: {
  environment: Environment;
  config?: SupabaseConfig | null;
}): Promise<BindMembershipsResult> {
  if (!hostedContinuityAllowed(input.environment)) return { ok: false, reason: "continuity-disabled" };
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  const result = await rpc(config, "hearth_bind_google_memberships", {
    p_environment: input.environment,
  });
  if (!result.ok) {
    const message = messageOf(result.body);
    if (/could not find|schema cache|404|PGRST202/i.test(message)) {
      return { ok: false, reason: "bind-rpc-missing" };
    }
    return { ok: false, reason: message };
  }
  const body = asObject(result.body);
  if (!body) return { ok: false, reason: "invalid-response" };
  if (body.ok !== true) {
    return { ok: false, reason: String(body.reason || "bind-failed") };
  }
  return {
    ok: true,
    bound: Number(body.bound || 0),
    googleSubject: String(body.google_subject || ""),
    googleEmail: String(body.google_email || ""),
  };
}
