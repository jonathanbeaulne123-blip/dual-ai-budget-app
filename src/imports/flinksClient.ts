import { parseFlinksInbox, type FlinksInboxPayload, type ParsedOfxBatch } from "../core/index.ts";
import { ensureSupabaseSession, type HearthSupabaseSession } from "../auth/supabaseSession.ts";
import type { Environment } from "../core/types.ts";

export const FLINKS_BASE_PATH = "/bank/flinks";
export const LEGACY_FLINKS_LOGIN_STORAGE_KEY = "hearth.flinks.loginId";

const LEGACY_LOGIN_KEYS = [
  LEGACY_FLINKS_LOGIN_STORAGE_KEY,
  "flinksLoginId",
  "hearth.flinks.connect.loginId",
];

export type FlinksConnectionStatus = {
  ok: boolean;
  configured: boolean;
  connected: boolean;
  institution: string | null;
  accountLabel: string | null;
  accountLast4: string | null;
  currency: string;
  error?: string;
};

export type FlinksConnectStart = {
  ok: boolean;
  sessionId: string;
  stateNonce: string;
  iframeOrigin: string;
  iframeUrl: string;
  redirectUrl: string;
  expiresAt: number;
  error?: string;
};

export type FlinksRedirectMessage = {
  step?: string;
  loginId?: string;
  LoginId?: string;
  requestId?: string;
  institution?: string;
  accountId?: string;
  accountTitle?: string;
  accountLast4?: string;
};

/** One-time migration: clear any PR #160 LoginId persisted in browser storage. */
export function clearLegacyFlinksLoginStorage(): void {
  try {
    for (const key of LEGACY_LOGIN_KEYS) localStorage.removeItem(key);
  } catch {
    /* ignore quota / private mode */
  }
}

function authHeaders(session: HearthSupabaseSession): HeadersInit {
  return {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };
}

function scopeBody(environment: Environment, householdId: string, memberId: string) {
  return { environment, householdId, memberId };
}

async function flinksJson<T>(path: string, init: RequestInit, fetcher: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(`${FLINKS_BASE_PATH}${path}`, init);
  } catch (caught) {
    throw new Error(caught instanceof Error ? caught.message : String(caught));
  }
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`Flinks returned ${response.status}.`);
  const data = await response.json() as T & { ok?: boolean; error?: string };
  if (!response.ok || data.ok === false) throw new Error(data.error || `Flinks returned ${response.status}.`);
  return data;
}

export async function fetchFlinksStatus(input: {
  environment: Environment;
  householdId: string;
  memberId: string;
  session: HearthSupabaseSession;
}, fetcher: typeof fetch = fetch): Promise<FlinksConnectionStatus> {
  const query = new URLSearchParams(scopeBody(input.environment, input.householdId, input.memberId));
  return flinksJson(`/status?${query.toString()}`, { method: "GET", headers: authHeaders(input.session) }, fetcher);
}

export async function startFlinksConnect(input: {
  environment: Environment;
  householdId: string;
  memberId: string;
  session: HearthSupabaseSession;
}, fetcher: typeof fetch = fetch): Promise<FlinksConnectStart> {
  return flinksJson("/connect/start", {
    method: "POST",
    headers: authHeaders(input.session),
    body: JSON.stringify(scopeBody(input.environment, input.householdId, input.memberId)),
  }, fetcher);
}

export async function completeFlinksConnect(input: {
  environment: Environment;
  householdId: string;
  memberId: string;
  session: HearthSupabaseSession;
  sessionId: string;
  stateNonce: string;
  iframeOrigin: string;
  message: FlinksRedirectMessage;
}, fetcher: typeof fetch = fetch): Promise<FlinksConnectionStatus> {
  const loginId = String(input.message.loginId ?? input.message.LoginId ?? "").trim();
  if (!loginId) throw new Error("Flinks Connect did not return a connection.");
  return flinksJson("/connect/complete", {
    method: "POST",
    headers: authHeaders(input.session),
    body: JSON.stringify({
      ...scopeBody(input.environment, input.householdId, input.memberId),
      sessionId: input.sessionId,
      stateNonce: input.stateNonce,
      iframeOrigin: input.iframeOrigin,
      loginId,
      institution: input.message.institution,
      accountId: input.message.accountId,
      accountLabel: input.message.accountTitle,
      accountLast4: input.message.accountLast4,
    }),
  }, fetcher);
}

export async function importFlinksInbox(input: {
  environment: Environment;
  householdId: string;
  memberId: string;
  session: HearthSupabaseSession;
}, fetcher: typeof fetch = fetch): Promise<{ batch: ParsedOfxBatch; inbox: FlinksInboxPayload }> {
  const data = await flinksJson<{ ok: boolean; inbox: FlinksInboxPayload }>("/import", {
    method: "POST",
    headers: authHeaders(input.session),
    body: JSON.stringify(scopeBody(input.environment, input.householdId, input.memberId)),
  }, fetcher);
  const batch = parseFlinksInbox(data.inbox);
  return { batch, inbox: data.inbox };
}

export async function disconnectFlinks(input: {
  environment: Environment;
  householdId: string;
  memberId: string;
  session: HearthSupabaseSession;
}, fetcher: typeof fetch = fetch): Promise<FlinksConnectionStatus> {
  return flinksJson("/disconnect", {
    method: "POST",
    headers: authHeaders(input.session),
    body: JSON.stringify(scopeBody(input.environment, input.householdId, input.memberId)),
  }, fetcher);
}

export function isFlinksRedirectMessage(value: unknown, expectedOrigin: string, eventOrigin: string): value is FlinksRedirectMessage {
  if (!value || typeof value !== "object") return false;
  if (eventOrigin !== expectedOrigin) return false;
  const message = value as FlinksRedirectMessage;
  return message.step === "REDIRECT" || Boolean(message.loginId || message.LoginId);
}

export async function resolveFlinksSession(environment: Environment): Promise<HearthSupabaseSession> {
  const session = await ensureSupabaseSession(environment);
  if (!session) throw new Error("Continue with Google in Hearth before using Flinks.");
  return session;
}
