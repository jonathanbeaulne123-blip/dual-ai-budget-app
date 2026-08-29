import { ensureSupabaseSession, type HearthSupabaseSession } from "../auth/supabaseSession.ts";
import type { Environment } from "../core/types.ts";
import type { AutomationPolicy, AutomationReceipt } from "../core/sevenShiftsAutomation.ts";
import type { SevenShiftsEvidenceBundle } from "../core/evidence.ts";

export const EVIDENCE_STATUS_PATH = "/work/evidence/status";

export type EvidenceScope = { environment: Environment; householdId: string; memberId: string };
export type EvidenceCaptureSummary = {
  evidenceId: string;
  captureKind: string;
  state: string;
  contentType: string;
  byteLength: number;
  revision: number;
  capturedAt: string;
  updatedAt?: string;
  duplicate?: boolean;
};
export type EvidenceBundleSummary = { bundleId: string; state: string; bundle: SevenShiftsEvidenceBundle; updatedAt: string };
export type EvidenceCompanionRegistration = {
  registrationId: string;
  origin: string;
  label: string;
  active?: boolean;
  expiresAt: string;
  lastUsedAt?: string | null;
  createdAt?: string;
  revokedAt?: string | null;
};
export type EvidenceDerivedDetail = {
  evidenceId: string;
  revision: number;
  state: string;
  parserVersion: string | null;
  schemaFingerprint: string | null;
  derivatives: Array<{
    canonicalShiftKey: string;
    parserVersion: string;
    schemaFingerprint: string;
    facts: unknown;
    createdAt: string;
  }>;
  observations: Array<{
    observationId: string;
    canonicalShiftKey: string;
    field: string;
    value: unknown;
    unit: string;
    sourceLocation: string;
    confidenceBps: number;
    finality: string;
    extractionMethod: string;
    conflictState: string;
    createdAt: string;
  }>;
  schemaDrift: Array<{
    driftId: string;
    canonicalShiftKey: string | null;
    fieldPath: string;
    value: unknown;
    valueType: string;
    valueDigest: string;
    createdAt: string;
  }>;
};
export type EvidenceAutomationJob = {
  jobKey: string;
  actionKind: "post" | "reconcile_week" | "variance";
  leaseId: string;
  leaseExpiresAt: string;
  bundle: SevenShiftsEvidenceBundle;
  policy: AutomationPolicy;
};

type SessionProvider = (environment: Environment) => Promise<HearthSupabaseSession | null>;

async function bodyJson<T>(response: Response): Promise<T> {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`Evidence Mesh returned ${response.status}.`);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Evidence Mesh returned ${response.status}.`);
  return body;
}

async function session(scope: EvidenceScope, provider: SessionProvider): Promise<HearthSupabaseSession> {
  if (scope.environment !== "development" && scope.environment !== "production") throw new Error("Evidence Mesh environment is invalid.");
  const value = await provider(scope.environment);
  if (!value) throw new Error("Continue with Google before using Evidence Mesh.");
  return value;
}

function query(scope: EvidenceScope): string {
  return new URLSearchParams(scope).toString();
}

async function jsonRequest<T>(path: string, scope: EvidenceScope, init: RequestInit, fetcher: typeof fetch, provider: SessionProvider): Promise<T> {
  const auth = await session(scope, provider);
  return bodyJson<T>(await fetcher(path, {
    ...init,
    headers: { Accept: "application/json", Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json", ...init.headers },
  }));
}

export async function readEvidenceStatus(fetcher: typeof fetch = fetch) {
  const body = await bodyJson<{ ok: true; available: boolean; environment: "development-only" | "development-and-production"; productionAllowed: boolean; detail?: string; environments?: Record<string, { available: boolean; detail?: string }> }>(
    await fetcher(EVIDENCE_STATUS_PATH, { headers: { Accept: "application/json" } }),
  );
  const coherent = (body.environment === "development-only" && body.productionAllowed === false)
    || (body.environment === "development-and-production" && body.productionAllowed === true);
  if (body.ok !== true || !coherent) throw new Error("Evidence Mesh returned an unsafe status.");
  return body;
}

export async function uploadEvidence(
  scope: EvidenceScope,
  bytes: Blob | ArrayBuffer | Uint8Array,
  input: { captureKind: string; contentType: string },
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<EvidenceCaptureSummary> {
  const auth = await session(scope, provider);
  const body: BodyInit = bytes instanceof Blob
    ? bytes
    : new Blob([bytes instanceof Uint8Array ? bytes.slice().buffer as ArrayBuffer : bytes], { type: input.contentType });
  const response = await fetcher(`/work/evidence/captures?${query(scope)}`, {
    method: "POST",
    signal,
    body,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": input.contentType,
      "X-Evidence-Capture-Kind": input.captureKind,
    },
  });
  const result = await bodyJson<{ ok: true; capture: EvidenceCaptureSummary }>(response);
  if (!/^evi_[A-Za-z0-9_-]{20,80}$/.test(result.capture?.evidenceId || "")) throw new Error("Evidence Mesh returned an invalid capture id.");
  return result.capture;
}

export async function listEvidence(
  scope: EvidenceScope,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<EvidenceCaptureSummary[]> {
  const result = await jsonRequest<{ ok: true; captures: EvidenceCaptureSummary[] }>(`/work/evidence/captures?${query(scope)}`, scope, { method: "GET", signal }, fetcher, provider);
  return Array.isArray(result.captures) ? result.captures : [];
}

export async function readEvidenceRaw(
  scope: EvidenceScope,
  evidenceId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<Blob> {
  const auth = await session(scope, provider);
  const response = await fetcher(`/work/evidence/captures/${encodeURIComponent(evidenceId)}/raw?${query(scope)}`, {
    method: "GET", signal, headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!response.ok) {
    if ((response.headers.get("content-type") || "").includes("json")) await bodyJson(response);
    throw new Error(`Evidence Mesh returned ${response.status}.`);
  }
  return response.blob();
}

export async function readEvidenceDerived(
  scope: EvidenceScope,
  evidenceId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<EvidenceDerivedDetail> {
  const result = await jsonRequest<{ ok: true; derived: EvidenceDerivedDetail }>(
    `/work/evidence/captures/${encodeURIComponent(evidenceId)}/derived?${query(scope)}`,
    scope,
    { method: "GET", signal },
    fetcher,
    provider,
  );
  return result.derived;
}

export async function deleteEvidence(
  scope: EvidenceScope,
  evidenceId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
) {
  return jsonRequest<{ ok: true; deleted: true }>(`/work/evidence/captures/${encodeURIComponent(evidenceId)}?${query(scope)}`, scope, { method: "DELETE", signal }, fetcher, provider);
}

export async function readSevenShiftsCalendarEvidence(
  scope: EvidenceScope,
  privateUrl: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<string> {
  const result = await jsonRequest<{ ok: true; source: string }>("/work/evidence/calendar/read", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, url: privateUrl }),
  }, fetcher, provider);
  if (!result.source.includes("BEGIN:VCALENDAR")) throw new Error("Evidence Mesh returned an invalid calendar.");
  return result.source;
}

export async function provisionEvidenceMailbox(
  scope: EvidenceScope,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<{ address: string; createdAt: string }> {
  const result = await jsonRequest<{ ok: true; address: string; createdAt: string }>("/work/evidence/email/alias", scope, {
    method: "POST", signal, body: JSON.stringify(scope),
  }, fetcher, provider);
  if (!/^h-[A-Za-z0-9_-]{32}@[a-z0-9.-]+$/i.test(result.address)) throw new Error("Evidence Mesh returned an invalid forwarding alias.");
  return { address: result.address, createdAt: result.createdAt };
}

export async function mintEvidenceCaptureCapability(
  scope: EvidenceScope,
  input: { channel: "extension" | "ios"; origin: string; byteLimit?: number },
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<{ capability: string; channel: string; origin: string; byteLimit: number; expiresAt: string }> {
  return jsonRequest("/work/evidence/capabilities", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, ...input }),
  }, fetcher, provider);
}

export async function registerEvidenceCompanion(
  scope: EvidenceScope,
  input: { origin: string; label?: string },
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<EvidenceCompanionRegistration & { token: string; authority: "capture-only" }> {
  const result = await jsonRequest<{ ok: true; registration: EvidenceCompanionRegistration & { token: string; authority: "capture-only" } }>("/work/evidence/companion/registrations", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, ...input }),
  }, fetcher, provider);
  return result.registration;
}

export async function listEvidenceCompanions(scope: EvidenceScope, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession): Promise<EvidenceCompanionRegistration[]> {
  const result = await jsonRequest<{ ok: true; registrations: Array<Record<string, unknown>> }>(`/work/evidence/companion/registrations?${query(scope)}`, scope, { method: "GET", signal }, fetcher, provider);
  return (result.registrations ?? []).map((row) => ({
    registrationId: String(row.registration_id ?? row.registrationId ?? ""),
    origin: String(row.origin ?? ""),
    label: String(row.label ?? ""),
    active: row.active === 1 || row.active === true,
    expiresAt: String(row.expires_at ?? row.expiresAt ?? ""),
    lastUsedAt: row.last_used_at == null ? null : String(row.last_used_at),
    createdAt: String(row.created_at ?? ""),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
  })).filter((row) => row.registrationId && row.origin && row.expiresAt);
}

export async function revokeEvidenceCompanion(scope: EvidenceScope, registrationId: string, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession) {
  return jsonRequest(`/work/evidence/companion/registrations/${encodeURIComponent(registrationId)}?${query(scope)}`, scope, { method: "DELETE", signal }, fetcher, provider);
}

export async function sealShiftBibleEvidence(scope: EvidenceScope, input: { bibleId: string; canonicalShiftKey: string; confirmedAt: string }, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession) {
  return jsonRequest<{ ok: true; retention: { bibleId: string; canonicalShiftKey: string; purgeAfter: string; sourceCount: number } }>("/work/evidence/retention/seal", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, ...input }),
  }, fetcher, provider);
}

export async function mapEvidenceOwnerJob(scope: EvidenceScope, input: { jobId: string; roleId: string; evidenceId: string; canonicalShiftKey: string }, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession) {
  const result = await jsonRequest<{ ok: true; mapping: { mappingId: string; jobId: string; roleId: string; state: "active" } }>("/work/evidence/mappings/owner", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, ...input }),
  }, fetcher, provider);
  return result.mapping;
}

export async function putEvidenceAutomationPolicy(
  scope: EvidenceScope,
  policy: AutomationPolicy,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
): Promise<AutomationPolicy> {
  const result = await jsonRequest<{ ok: true; policy: AutomationPolicy }>("/work/evidence/automation/policies", scope, {
    method: "PUT", signal, body: JSON.stringify({ ...scope, policy }),
  }, fetcher, provider);
  return result.policy;
}

export async function listEvidenceAutomationPolicies(scope: EvidenceScope, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession) {
  const result = await jsonRequest<{ ok: true; policies: AutomationPolicy[] }>(`/work/evidence/automation/policies?${query(scope)}`, scope, { method: "GET", signal }, fetcher, provider);
  return result.policies ?? [];
}

export async function stageEvidenceBundle(
  scope: EvidenceScope,
  bundle: SevenShiftsEvidenceBundle,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  provider: SessionProvider = ensureSupabaseSession,
) {
  return jsonRequest<{ ok: true; bundleId: string; state: string; bundle: SevenShiftsEvidenceBundle; automation: { jobKey: string | null } }>("/work/evidence/bundles", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, bundle }),
  }, fetcher, provider);
}

export async function listEvidenceBundles(scope: EvidenceScope, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession): Promise<EvidenceBundleSummary[]> {
  const result = await jsonRequest<{ ok: true; bundles: EvidenceBundleSummary[] }>(`/work/evidence/bundles?${query(scope)}`, scope, { method: "GET", signal }, fetcher, provider);
  return result.bundles ?? [];
}

export async function claimEvidenceAutomationJob(scope: EvidenceScope, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession): Promise<EvidenceAutomationJob | null> {
  const result = await jsonRequest<{ ok: true; job: EvidenceAutomationJob | null }>("/work/evidence/automation/jobs/claim", scope, {
    method: "POST", signal, body: JSON.stringify(scope),
  }, fetcher, provider);
  return result.job;
}

export async function acknowledgeEvidenceAutomationJob(scope: EvidenceScope, job: Pick<EvidenceAutomationJob, "jobKey" | "leaseId">, receipt: AutomationReceipt, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession) {
  return jsonRequest("/work/evidence/automation/jobs/ack", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, ...job, receipt }),
  }, fetcher, provider);
}

export async function validateEvidenceAutomationJob(scope: EvidenceScope, job: Pick<EvidenceAutomationJob, "jobKey" | "leaseId">, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession) {
  return jsonRequest<{ ok: true; valid: true; jobKey: string; actionKind: EvidenceAutomationJob["actionKind"]; materialHash: string; checkedAt: string }>("/work/evidence/automation/jobs/validate", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, ...job }),
  }, fetcher, provider);
}

export async function failEvidenceAutomationJob(scope: EvidenceScope, job: Pick<EvidenceAutomationJob, "jobKey" | "leaseId">, errorCode: string, quarantine = false, signal?: AbortSignal, fetcher: typeof fetch = fetch, provider: SessionProvider = ensureSupabaseSession) {
  return jsonRequest("/work/evidence/automation/jobs/fail", scope, {
    method: "POST", signal, body: JSON.stringify({ ...scope, ...job, errorCode, quarantine }),
  }, fetcher, provider);
}
