import type { Environment } from "../core/types.ts";
import { CALENDAR_GOOGLE_SCOPES } from "./scopes.ts";

export const GOOGLE_TOKEN_PREFIX = "hearth:v1:";
export const GOOGLE_TOKEN_KIND = "google";
export const LEGACY_GCAL_KIND = "gcal";

export type GoogleIdentityProfile = {
  email: string;
  subject: string;
  displayName: string;
  picture?: string;
};

export type GoogleSession = {
  memberId: string;
  accessToken: string;
  expiresAt: number;
  grantedScopes: string[];
  identity: GoogleIdentityProfile;
  calendarId?: string;
};

type TokenStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

let storeOverride: TokenStore | null = null;

export function googleTokenKey(environment: Environment, memberId: string): string {
  return `${GOOGLE_TOKEN_PREFIX}${environment}:${GOOGLE_TOKEN_KIND}:${memberId}`;
}

export function legacyGcalKey(environment: Environment, memberId: string): string {
  return `${GOOGLE_TOKEN_PREFIX}${environment}:${LEGACY_GCAL_KIND}:${memberId}`;
}

export function setGoogleTokenStore(store: TokenStore | null): void {
  storeOverride = store;
}

export function createMemoryTokenStore(): TokenStore & { snapshot(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    snapshot() {
      return Object.fromEntries(map.entries());
    },
  };
}

function store(): TokenStore | null {
  if (storeOverride) return storeOverride;
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isSession(value: unknown): value is GoogleSession {
  if (!value || typeof value !== "object") return false;
  const session = value as GoogleSession;
  if (!session.accessToken || !session.memberId) return false;
  const identity = session.identity;
  if (!identity || typeof identity !== "object") return false;
  return typeof identity.email === "string" || typeof identity.subject === "string";
}

/** Continuity identity from a GIS session. Missing `identity` must not throw — welcome has no session, kitchen does. */
export function continuityIdentityFromGoogle(
  session: { identity?: { email?: string; subject?: string } | null } | null | undefined,
): { email: string; subject: string } | null {
  const email = typeof session?.identity?.email === "string" ? session.identity.email.trim() : "";
  const subject = typeof session?.identity?.subject === "string" ? session.identity.subject.trim() : "";
  if (!email && !subject) return null;
  return { email, subject };
}

function fromLegacy(raw: unknown, memberId: string): GoogleSession | null {
  if (!raw || typeof raw !== "object") return null;
  const account = raw as {
    memberId?: string;
    email?: string;
    calendarId?: string;
    accessToken?: string;
    expiresAt?: number;
  };
  if (!account.accessToken) return null;
  return {
    memberId: account.memberId || memberId,
    accessToken: account.accessToken,
    expiresAt: Number(account.expiresAt) || 0,
    grantedScopes: [...CALENDAR_GOOGLE_SCOPES],
    identity: {
      email: (account.email ?? "").trim(),
      subject: "",
      displayName: "",
    },
    calendarId: account.calendarId,
  };
}

export function loadGoogleSession(environment: Environment, memberId: string): GoogleSession | null {
  const memory = store();
  if (!memory) return null;
  try {
    const fresh = memory.getItem(googleTokenKey(environment, memberId));
    if (fresh) {
      const parsed = JSON.parse(fresh) as unknown;
      return isSession(parsed) ? parsed : null;
    }
    const legacyRaw = memory.getItem(legacyGcalKey(environment, memberId));
    if (!legacyRaw) return null;
    const migrated = fromLegacy(JSON.parse(legacyRaw) as unknown, memberId);
    if (!migrated) return null;
    saveGoogleSession(environment, migrated);
    memory.removeItem(legacyGcalKey(environment, memberId));
    return migrated;
  } catch {
    return null;
  }
}

export function saveGoogleSession(environment: Environment, session: GoogleSession): void {
  store()?.setItem(googleTokenKey(environment, session.memberId), JSON.stringify(session));
}

export function clearGoogleSession(environment: Environment, memberId: string): void {
  const memory = store();
  if (!memory) return;
  memory.removeItem(googleTokenKey(environment, memberId));
  memory.removeItem(legacyGcalKey(environment, memberId));
}

export function adoptGoogleSession(environment: Environment, fromMemberId: string, toMemberId: string): GoogleSession | null {
  const session = loadGoogleSession(environment, fromMemberId);
  if (!session) return null;
  const next = { ...session, memberId: toMemberId };
  saveGoogleSession(environment, next);
  if (fromMemberId !== toMemberId) clearGoogleSession(environment, fromMemberId);
  return next;
}

export function tokenFresh(session: Pick<GoogleSession, "accessToken" | "expiresAt">, now = Date.now()): boolean {
  return Boolean(session.accessToken) && session.expiresAt - 60_000 > now;
}
