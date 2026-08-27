/**
 * Authenticated invitation RPC client (D-123 / migration 006).
 * Tokens are one-time; only the raw token from issue is shown in UI.
 */
import type { Environment } from "../core/types.ts";
import type { GoogleIdentitySelector } from "../core/google.ts";
import type { ContinuityMembershipSummary, SupabaseConfig } from "./supabase.ts";
import { listActiveContinuityMemberships, readSupabaseConfig } from "./supabase.ts";

export type InviteKind = "email" | "qr";

export type IssueInviteResult =
  | {
    ok: true;
    id: string;
    kind: InviteKind;
    inviteToken: string;
    expiresAt: string;
    joinPath: string;
  }
  | { ok: false; reason: string };

export type RedeemInviteResult =
  | {
    ok: true;
    duplicate: boolean;
    role: "member";
    memberId?: string;
    householdId: string;
    environment: Environment;
  }
  | { ok: false; reason: string };

export type RevokeMemberResult = { ok: true } | { ok: false; reason: string };

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
      return "Continue with Google before redeeming an invite.";
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
    case "not-member":
      return "You are not an active member of that household.";
    case "delete-rpc-missing":
      return "Delete household needs migration 015 pasted in the Supabase SQL Editor.";
    case "reset-rpc-missing":
      return "Start from scratch needs migration 016 (or 015) pasted in the Supabase SQL Editor.";
    case "production-reset-blocked":
      return "Start from scratch is Development only. Production households stay."
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
  ttlHours?: number;
  config?: SupabaseConfig | null;
}): Promise<IssueInviteResult> {
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
    inviteToken: String(body.invite_token),
    expiresAt: String(body.expires_at),
    joinPath: String(body.join_path),
  };
}

export async function redeemHouseholdInvite(input: {
  inviteToken: string;
  displayName?: string;
  config?: SupabaseConfig | null;
}): Promise<RedeemInviteResult> {
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
    role: "member",
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

/** Leave a household as a member, or delete it entirely when owner (Development only). */
export async function leaveOrDeleteHousehold(input: {
  environment: Environment;
  householdId: string;
  role: "owner" | "member" | null;
  config?: SupabaseConfig | null;
}): Promise<LeaveHouseholdResult> {
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
  environment?: Environment | null;
  config?: SupabaseConfig | null;
}): Promise<BindMembershipsResult> {
  const config = input.config ?? readSupabaseConfig();
  if (!config?.accessToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  const result = await rpc(config, "hearth_bind_google_memberships", {
    p_environment: input.environment ?? null,
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
