import { ensureSupabaseSession, type HearthSupabaseSession } from "../auth/supabaseSession.ts";
import type { Environment } from "../core/types.ts";
import type { SevenShiftsInboxPayload } from "../core/importInbox/sevenshifts.ts";

export const SEVENSHIFTS_STATUS_PATH = "/work/7shifts/status";

export type SevenShiftsScope = {
  environment: Environment;
  householdId: string;
  memberId: string;
};

export type SevenShiftsStatus = {
  ok: true;
  available: boolean;
  phase: "scaffold" | "sandbox-configured";
  environment: "development-only";
  providerCallsEnabled: boolean;
  productionAllowed: false;
  detail: string;
};

export type SevenShiftsProbeUser = {
  userDigest: string;
  displayName: string;
};

export type SevenShiftsProbe = {
  companyName: string;
  users: SevenShiftsProbeUser[];
};

export type SevenShiftsConnectionSummary = {
  connectionId: string;
  state: string;
  jobId: string;
  companyName: string;
  updatedAt: string;
  lastPullAt: string | null;
};

export type SevenShiftsPullResult = {
  connectionId: string;
  payload: SevenShiftsInboxPayload;
};

type SessionProvider = (environment: Environment) => Promise<HearthSupabaseSession | null>;

async function responseJson<T>(response: Response): Promise<T> {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`7shifts returned ${response.status}.`);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `7shifts returned ${response.status}.`);
  return body;
}

function safeStatus(body: SevenShiftsStatus): SevenShiftsStatus {
  const inert = body.available === false && body.phase === "scaffold" && body.providerCallsEnabled === false;
  const active = body.available === true && body.phase === "sandbox-configured" && body.providerCallsEnabled === true;
  if (body.ok !== true || body.environment !== "development-only" || body.productionAllowed !== false || !body.detail || (!inert && !active)) {
    throw new Error("7shifts setup returned an unsafe or invalid status.");
  }
  return body;
}

export async function readSevenShiftsStatus(fetcher: typeof fetch = fetch): Promise<SevenShiftsStatus> {
  return safeStatus(await responseJson<SevenShiftsStatus>(await fetcher(SEVENSHIFTS_STATUS_PATH, { method: "GET", headers: { Accept: "application/json" } })));
}

async function authenticatedRequest<T>(
  path: string,
  scope: SevenShiftsScope,
  init: RequestInit,
  fetcher: typeof fetch,
  sessionProvider: SessionProvider,
): Promise<T> {
  if (scope.environment !== "development") throw new Error("7shifts is Development-only.");
  const session = await sessionProvider(scope.environment);
  if (!session) throw new Error("Continue with Google before connecting 7shifts.");
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

export async function probeSevenShifts(
  scope: SevenShiftsScope,
  accessToken: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<SevenShiftsProbe> {
  const body = await authenticatedRequest<{ ok: true } & SevenShiftsProbe>("/work/7shifts/probe", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, accessToken }),
  }, fetcher, sessionProvider);
  if (!body.companyName || !Array.isArray(body.users) || !body.users.length) throw new Error("7shifts did not return a company profile.");
  const users = body.users.filter((user) => /^s7user_[a-f0-9]{64}$/.test(user.userDigest) && user.displayName && !user.displayName.includes("@"));
  if (!users.length) throw new Error("7shifts did not return a safe profile list.");
  return { companyName: body.companyName.slice(0, 80), users };
}

export async function connectSevenShifts(
  scope: SevenShiftsScope,
  input: { accessToken: string; userDigest: string; jobId: string },
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<SevenShiftsConnectionSummary> {
  const body = await authenticatedRequest<{ ok: true; connectionId: string; companyName: string; jobId: string; state: string }>(
    "/work/7shifts/connections",
    scope,
    { method: "POST", signal, body: JSON.stringify({ ...scope, ...input }) },
    fetcher,
    sessionProvider,
  );
  if (!/^s7c_[A-Za-z0-9_-]{20,80}$/.test(body.connectionId) && !/^[A-Za-z0-9_-]{20,80}$/.test(body.connectionId)) {
    throw new Error("7shifts returned an invalid connection.");
  }
  return {
    connectionId: body.connectionId,
    state: body.state || "ready",
    jobId: body.jobId,
    companyName: body.companyName,
    updatedAt: new Date().toISOString(),
    lastPullAt: null,
  };
}

export async function listSevenShiftsConnections(
  scope: SevenShiftsScope,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<SevenShiftsConnectionSummary[]> {
  const query = new URLSearchParams(scope);
  const body = await authenticatedRequest<{ ok: true; connections: SevenShiftsConnectionSummary[] }>(
    `/work/7shifts/connections?${query}`,
    scope,
    { method: "GET", signal },
    fetcher,
    sessionProvider,
  );
  if (!Array.isArray(body.connections)) throw new Error("7shifts returned an invalid connection list.");
  return body.connections.filter((row) => /^[A-Za-z0-9_-]{20,80}$/.test(row.connectionId));
}

export async function pullSevenShiftsPunches(
  scope: SevenShiftsScope,
  connectionId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<SevenShiftsPullResult> {
  const body = await authenticatedRequest<{ ok: true } & SevenShiftsPullResult>(
    `/work/7shifts/connections/${encodeURIComponent(connectionId)}/pull`,
    scope,
    { method: "POST", signal, body: JSON.stringify(scope) },
    fetcher,
    sessionProvider,
  );
  if (body.payload?.provider !== "7shifts" || !Array.isArray(body.payload.punches)) {
    throw new Error("7shifts returned an invalid Timesheet inbox.");
  }
  return { connectionId: body.connectionId, payload: body.payload };
}

export async function revokeSevenShiftsConnection(
  scope: SevenShiftsScope,
  connectionId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  sessionProvider: SessionProvider = ensureSupabaseSession,
): Promise<{ ok: true; revoked: true }> {
  const query = new URLSearchParams(scope);
  return authenticatedRequest(`/work/7shifts/connections/${encodeURIComponent(connectionId)}?${query}`, scope, {
    method: "DELETE", signal,
  }, fetcher, sessionProvider);
}
