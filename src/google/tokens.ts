import type { Environment } from "../core/types.ts";
import { CALENDAR_GOOGLE_SCOPES } from "./scopes.ts";

export const GOOGLE_TOKEN_PREFIX = "hearth:v1:";
export const GOOGLE_TOKEN_KIND = "google";
export const LEGACY_GCAL_KIND = "gcal";
const GOOGLE_CREDENTIAL_EPOCH_KIND = "google-credential-epoch";

export type GoogleIdentityProfile = {
  email: string;
  subject: string;
  displayName: string;
  picture?: string;
};

export type GoogleSession = {
  memberId: string;
  /** Household-local direct Google-suite scope. Welcome sessions omit it. */
  householdId?: string;
  accessToken: string;
  expiresAt: number;
  grantedScopes: string[];
  identity: GoogleIdentityProfile;
  calendarId?: string;
};

type TokenStore = {
  readonly length?: number;
  getItem(key: string): string | null;
  key?(index: number): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

let storeOverride: TokenStore | null = null;

export function googleTokenKey(environment: Environment, memberId: string, householdId?: string): string {
  const scope = householdId ? `${encodeURIComponent(householdId)}:` : "";
  return `${GOOGLE_TOKEN_PREFIX}${environment}:${GOOGLE_TOKEN_KIND}:${scope}${memberId}`;
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
    get length() {
      return map.size;
    },
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
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

function credentialEpochKey(environment: Environment): string {
  return `${GOOGLE_TOKEN_PREFIX}${environment}:${GOOGLE_CREDENTIAL_EPOCH_KIND}`;
}

export function googleCredentialEpoch(environment: Environment): number {
  const value = Number(store()?.getItem(credentialEpochKey(environment)) ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function bumpGoogleCredentialEpoch(environment: Environment): void {
  const memory = store();
  if (!memory) return;
  memory.setItem(credentialEpochKey(environment), String(googleCredentialEpoch(environment) + 1));
}

function storedKeys(memory: TokenStore): string[] {
  if (!memory.key || typeof memory.length !== "number") return [];
  const keys: string[] = [];
  for (let index = 0; index < memory.length; index += 1) {
    const key = memory.key(index);
    if (key) keys.push(key);
  }
  return keys;
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
export function continuityIdentityFromGoogle(session: unknown): { email: string; subject: string } | null {
  if (!session || typeof session !== "object") return null;
  const identity = (session as { identity?: { email?: string; subject?: string } | null }).identity;
  const email = typeof identity?.email === "string" ? identity.email.trim() : "";
  const subject = typeof identity?.subject === "string" ? identity.subject.trim() : "";
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

export function loadGoogleSession(
  environment: Environment,
  memberId: string,
  expectedHouseholdId?: string,
): GoogleSession | null {
  const memory = store();
  if (!memory) return null;
  try {
    const fresh = memory.getItem(googleTokenKey(environment, memberId, expectedHouseholdId));
    if (expectedHouseholdId) {
      // Pre-household-scoping tokens are ambiguous. Remove them and require an explicit reconnect.
      memory.removeItem(googleTokenKey(environment, memberId));
      memory.removeItem(legacyGcalKey(environment, memberId));
    }
    if (fresh) {
      const parsed = JSON.parse(fresh) as unknown;
      if (!isSession(parsed)) return null;
      if (expectedHouseholdId && parsed.householdId !== expectedHouseholdId) return null;
      return parsed;
    }
    if (expectedHouseholdId) return null;
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
  store()?.setItem(googleTokenKey(environment, session.memberId, session.householdId), JSON.stringify(session));
}

export function clearGoogleSession(environment: Environment, memberId: string, expectedHouseholdId?: string): void {
  const memory = store();
  if (!memory) return;
  bumpGoogleCredentialEpoch(environment);
  if (expectedHouseholdId) {
    memory.removeItem(googleTokenKey(environment, memberId, expectedHouseholdId));
    memory.removeItem(googleTokenKey(environment, memberId));
    memory.removeItem(legacyGcalKey(environment, memberId));
    return;
  }
  memory.removeItem(googleTokenKey(environment, memberId));
  memory.removeItem(legacyGcalKey(environment, memberId));
  const prefix = `${GOOGLE_TOKEN_PREFIX}${environment}:${GOOGLE_TOKEN_KIND}:`;
  const suffix = `:${memberId}`;
  storedKeys(memory)
    .filter((key) => key.startsWith(prefix) && key.endsWith(suffix))
    .forEach((key) => memory.removeItem(key));
}

/** Sign-out boundary: remove every direct-suite bearer for this environment/device. */
export function clearGoogleSessions(environment: Environment): void {
  const memory = store();
  if (!memory) return;
  bumpGoogleCredentialEpoch(environment);
  const directPrefix = `${GOOGLE_TOKEN_PREFIX}${environment}:${GOOGLE_TOKEN_KIND}:`;
  const legacyPrefix = `${GOOGLE_TOKEN_PREFIX}${environment}:${LEGACY_GCAL_KIND}:`;
  storedKeys(memory)
    .filter((key) => key.startsWith(directPrefix) || key.startsWith(legacyPrefix))
    .forEach((key) => memory.removeItem(key));
}

export function adoptGoogleSession(
  environment: Environment,
  fromMemberId: string,
  toMemberId: string,
  targetHouseholdId?: string,
  sourceHouseholdId?: string,
): GoogleSession | null {
  const session = loadGoogleSession(environment, fromMemberId, sourceHouseholdId);
  if (!session) return null;
  const next = { ...session, memberId: toMemberId, householdId: targetHouseholdId };
  saveGoogleSession(environment, next);
  if (fromMemberId !== toMemberId || sourceHouseholdId !== targetHouseholdId) {
    clearGoogleSession(environment, fromMemberId, sourceHouseholdId);
  }
  return next;
}

export function tokenFresh(session: Pick<GoogleSession, "accessToken" | "expiresAt">, now = Date.now()): boolean {
  return Boolean(session.accessToken) && session.expiresAt - 60_000 > now;
}
