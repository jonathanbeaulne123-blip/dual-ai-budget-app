import { ensureSupabaseSession, type HearthSupabaseSession } from "../auth/supabaseSession.ts";
import type { Environment } from "../core/types.ts";
import type { FlinksInboxPayload } from "../core/importInbox/flinks.ts";

export const FLINKS_STATUS_PATH = "/bank/flinks/status";
const FLINKS_TOOLBOX_ORIGIN = "https://toolbox-iframe.private.fin.ag";
const FLINKS_DEVELOPMENT_CALLBACK_ORIGIN = "https://hearth-books.jonathan-beaulne123.workers.dev";
const LEGACY_LOGIN_KEYS = ["hearth.flinks.loginId", "flinksLoginId", "hearth.flinks.connect.loginId"];

/** One-time migration away from PR #160's raw browser-stored provider LoginId. */
export function clearLegacyFlinksLoginStorage(): void {
  try {
    for (const key of LEGACY_LOGIN_KEYS) localStorage.removeItem(key);
  } catch {
    /* Browser storage may be disabled; the secure flow never depends on it. */
  }
}

export type FlinksScope = {
  environment: Environment;
  householdId: string;
  memberId: string;
};

export type FlinksStatus = {
  ok: true;
  available: boolean;
  phase: "scaffold" | "sandbox-configured";
  environment: "development-only";
  providerCallsEnabled: boolean;
  productionAllowed: false;
  detail: string;
};

export type FlinksConnectSession = {
  connectionId: string;
  iframeUrl: string;
  messageOrigin: string;
  expiresAt: string;
};

export type FlinksPullResult =
  | { status: "pending"; connectionId: string; retryAfterMs: number }
  | { status: "ready"; connectionId: string; payload: FlinksInboxPayload };

export type FlinksConnectionSummary = {
  connectionId: string;
  state: string;
  updatedAt: string;
};

type SessionProvider = (environment: Environment) => Promise<HearthSupabaseSession | null>;

async function responseJson<T>(response: Response): Promise<T> {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`Flinks returned ${response.status}.`);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Flinks returned ${response.status}.`);
  return body;
}

function safeStatus(body: FlinksStatus): FlinksStatus {
  const inert = body.available === false && body.phase === "scaffold" && body.providerCallsEnabled === false;
  const active = body.available === true && body.phase === "sandbox-configured" && body.providerCallsEnabled === true;
  if (body.ok !== true || body.environment !== "development-only" || body.productionAllowed !== false || !body.detail || (!inert && !active)) {
    throw new Error("Flinks setup returned an unsafe or invalid status.");
  }
  return body;
}

export async function readFlinksStatus(fetcher: typeof fetch = fetch): Promise<FlinksStatus> {
  return safeStatus(await responseJson<FlinksStatus>(await fetcher(FLINKS_STATUS_PATH, { method: "GET", headers: { Accept: "application/json" } })));
}

/** Backward-compatible name for the inert Development launcher tests. */
export const readFlinksScaffoldStatus = readFlinksStatus;

async function authenticatedRequest<T>(
  path: string,
  scope: FlinksScope,
  init: RequestInit,
  fetcher: typeof fetch,
  sessionProvider: SessionProvider,
): Promise<T> {
  if (scope.environment !== "development") throw new Error("Flinks is Development-only.");
  const session = await sessionProvider(scope.environment);
  if (!session) throw new Error("Continue with Google before connecting a bank.");
  return responseJson<T>(await fetcher(path, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  }));
}

export async function startFlinksConnect(
  scope: FlinksScope,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<FlinksConnectSession> {
  const body = await authenticatedRequest<{ ok: true } & FlinksConnectSession>("/bank/flinks/sessions", scope, {
    method: "POST", signal, body: JSON.stringify(scope),
  }, fetcher, sessionProvider);
  const iframe = new URL(body.iframeUrl);
  if (iframe.protocol !== "https:" || iframe.origin !== body.messageOrigin || body.messageOrigin !== FLINKS_TOOLBOX_ORIGIN) {
    throw new Error("Flinks returned an unsafe Connect address.");
  }
  const redirect = new URL(iframe.searchParams.get("redirectUrl") || "about:blank");
  if (
    iframe.searchParams.get("demo") !== "true"
    || iframe.searchParams.get("jsRedirect") !== "true"
    || iframe.searchParams.get("accountSelectorEnable") !== "true"
    || iframe.searchParams.get("accountSelectorCurrency") !== "cad"
    || iframe.searchParams.get("fetchAllAccounts") !== "false"
    || !iframe.searchParams.get("authorizeToken")
    || redirect.origin !== FLINKS_DEVELOPMENT_CALLBACK_ORIGIN
    || redirect.pathname !== "/bank/flinks/callback"
    || !/^[A-Za-z0-9_-]{20,80}$/.test(redirect.searchParams.get("state") || "")
  ) throw new Error("Flinks returned an unsafe or incomplete Connect session.");
  if (!body.connectionId || !Number.isFinite(Date.parse(body.expiresAt))) throw new Error("Flinks returned an invalid Connect session.");
  return body;
}

export async function listFlinksConnections(
  scope: FlinksScope,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<FlinksConnectionSummary[]> {
  const query = new URLSearchParams(scope);
  const body = await authenticatedRequest<{ ok: true; connections: FlinksConnectionSummary[] }>(`/bank/flinks/connections?${query}`, scope, { method: "GET", signal }, fetcher, sessionProvider);
  if (!Array.isArray(body.connections)) throw new Error("Flinks returned an invalid connection list.");
  return body.connections.filter((row) => /^[A-Za-z0-9_-]{20,80}$/.test(row.connectionId));
}

export async function completeFlinksConnect(
  scope: FlinksScope,
  connectionId: string,
  redirectUrl: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<FlinksPullResult> {
  return authenticatedRequest<{ ok: true } & FlinksPullResult>(`/bank/flinks/sessions/${encodeURIComponent(connectionId)}/complete`, scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, redirectUrl }),
  }, fetcher, sessionProvider);
}

export async function pollFlinksPull(
  scope: FlinksScope,
  connectionId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<FlinksPullResult> {
  return authenticatedRequest<{ ok: true } & FlinksPullResult>(`/bank/flinks/sessions/${encodeURIComponent(connectionId)}/transactions`, scope, {
    method: "POST", signal, body: JSON.stringify(scope),
  }, fetcher, sessionProvider);
}

export async function revokeFlinksConnection(
  scope: FlinksScope,
  connectionId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<{ ok: true; revoked: true }> {
  const query = new URLSearchParams(scope);
  return authenticatedRequest(`/bank/flinks/sessions/${encodeURIComponent(connectionId)}?${query}`, scope, { method: "DELETE", signal }, fetcher, sessionProvider);
}
