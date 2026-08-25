/**
 * Authenticated invitation RPC client (D-123 / migration 006).
 * Tokens are one-time; only the raw token from issue is shown in UI.
 */
import type { Environment } from "../core/types.ts";
import type { SupabaseConfig } from "./supabase.ts";
import { readSupabaseConfig } from "./supabase.ts";

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
