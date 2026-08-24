/**
 * Supabase Auth session sketch (D-123, Q1 A).
 * Do not put service-role keys here. Do not treat this module as live Auth
 * until migration 004 is applied and Google provider is configured in Supabase.
 *
 * Intended client flow after cutover:
 * 1. supabase.auth.signInWithOAuth({ provider: 'google', ... })
 * 2. Session JWT is sent as Authorization on PostgREST (replaces anon-as-user)
 * 3. Create → hearth_establish_owner_membership
 * 4. Join → hearth_redeem_invite (email or QR token)
 * 5. Owners → hearth_issue_invite / hearth_revoke_member
 *
 * GIS access tokens may remain for Calendar/Drive suite APIs; they are not the
 * books REST credential after cutover.
 */

export type HearthSupabaseSession = {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email: string;
  expiresAt: string;
};

export type HearthAuthConfig = {
  supabaseUrl: string;
  /** Publishable / anon key — never service_role */
  publishableKey: string;
};

export function assertPublishableKey(key: string): void {
  if (/service_role|secret/i.test(key)) {
    throw new Error("Service-role or secret keys must never ship in the kitchen client.");
  }
}

export function bearerHeaders(session: HearthSupabaseSession, publishableKey: string): HeadersInit {
  assertPublishableKey(publishableKey);
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };
}

/** Build the QR join URL path returned by hearth_issue_invite. */
export function joinUrlFromInviteToken(
  kitchenOrigin: string,
  inviteToken: string,
  environment: "development" | "production",
): string {
  const url = new URL("/join", kitchenOrigin);
  url.searchParams.set("invite", inviteToken);
  url.searchParams.set("env", environment);
  return url.toString();
}
