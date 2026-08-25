import type { Environment } from "./types.ts";

/** Raw token from hearth_issue_invite — two UUID hexes concatenated (64 chars). */
const AUTH_INVITE_TOKEN = /^[0-9a-f]{64}$/i;

export type AuthInviteLocation = {
  token: string;
  environment: Environment | null;
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

function environmentFromParam(value: string | null): Environment | null {
  if (value === "development" || value === "production") return value;
  return null;
}
