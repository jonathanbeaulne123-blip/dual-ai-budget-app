import type { Environment } from "./types.ts";

/** Raw token from hearth_issue_invite — two UUID hexes concatenated (64 chars). */
const AUTH_INVITE_TOKEN = /^[0-9a-f]{64}$/i;
const PENDING_INVITE_KEY = "hearth:v1:pending-auth-invite";

export type AuthInviteLocation = {
  token: string;
  environment: Environment | null;
};

export type PendingAuthInvite = {
  token: string;
  environment: Environment;
};

export function isAuthInviteToken(value: string | undefined | null): boolean {
  return AUTH_INVITE_TOKEN.test(String(value ?? "").trim());
}

/**
 * Parse Auth/RLS invite URLs without running hex through inviteFromText
 * (phrase parsing would mangle digits).
 *
 * Accepts `/join?invite=<64hex>&env=development|production`.
 */
export function authInviteFromLocation(href: string): AuthInviteLocation | null {
  try {
    const url = new URL(href);
    const fromQuery = url.searchParams.get("invite");
    if (isAuthInviteToken(fromQuery)) {
      return {
        token: String(fromQuery).trim().toLowerCase(),
        environment: environmentFromParam(url.searchParams.get("env")),
      };
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "join" && isAuthInviteToken(parts[1])) {
      return {
        token: parts[1]!.toLowerCase(),
        environment: environmentFromParam(url.searchParams.get("env")),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function authInviteTokenFromText(value: string | undefined | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (isAuthInviteToken(raw)) return raw.toLowerCase();
  if (/^https?:\/\//i.test(raw) || raw.includes("invite=") || raw.includes("/join")) {
    const found = authInviteFromLocation(raw);
    if (found) return found.token;
  }
  return "";
}

/** Survive full-page Google OAuth so camera QR / deep-link join still redeems. */
export function savePendingAuthInvite(invite: PendingAuthInvite): void {
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(invite));
  } catch {
    // Private mode / blocked storage — caller still keeps React state for same-tab paths.
  }
}

export function loadPendingAuthInvite(): PendingAuthInvite | null {
  try {
    const raw = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as Partial<PendingAuthInvite>;
    if (!isAuthInviteToken(row.token)) return null;
    if (row.environment !== "development" && row.environment !== "production") return null;
    return { token: String(row.token).toLowerCase(), environment: row.environment };
  } catch {
    return null;
  }
}

export function clearPendingAuthInvite(): void {
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // ignore
  }
}

function environmentFromParam(value: string | null): Environment | null {
  if (value === "development" || value === "production") return value;
  return null;
}
