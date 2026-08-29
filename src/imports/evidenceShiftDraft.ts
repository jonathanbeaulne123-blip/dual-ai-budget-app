import type { WorkShiftDraft } from "../WorkShiftFlow.tsx";
import type { EvidenceDerivedDetail } from "./evidenceClient.ts";

const APPROVED_FINALITY = new Set(["approved", "final"]);

export type ApprovedPunchShiftDraft = {
  canonicalShiftKey: string;
  finality: "approved" | "final";
  draft: WorkShiftDraft;
  missingPaidBreak: boolean;
};

export type ApprovedPunchJobBinding = {
  jobId: string;
  activeRoleIds: readonly string[];
};

type MappedDerivativeFacts = {
  mappingState?: unknown;
  bundleFacts?: {
    canonicalShiftKey?: unknown;
    providerSubjectKey?: unknown;
    providerResourceKind?: unknown;
    jobId?: unknown;
    startedAt?: unknown;
    endedAt?: unknown;
    workedMinutes?: unknown;
    paidBreakMinutes?: unknown;
    finality?: unknown;
  };
};

function stableValue(values: unknown[]): unknown | undefined {
  if (!values.length) return undefined;
  const encoded = new Set(values.map((value) => JSON.stringify(value)));
  return encoded.size === 1 ? values[0] : undefined;
}

function valueFor(
  detail: EvidenceDerivedDetail,
  canonicalShiftKey: string,
  field: string,
): unknown | undefined {
  return stableValue(detail.observations
    .filter((row) => row.canonicalShiftKey === canonicalShiftKey
      && row.field === field
      && row.conflictState === "clear"
      && APPROVED_FINALITY.has(row.finality))
    .map((row) => row.value));
}

function wholeMinutes(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function exactHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Shapes only clear, approved/final worked observations into an editable draft.
 * It deliberately ignores every money observation. This function cannot post.
 */
export function approvedPunchShiftDrafts(
  detail: EvidenceDerivedDetail | null | undefined,
  jobBindings: readonly ApprovedPunchJobBinding[],
): ApprovedPunchShiftDraft[] {
  if (!detail || !jobBindings.length) return [];
  const jobs = new Map(jobBindings.map((binding) => [binding.jobId, binding]));
  const keys = [...new Set(detail.observations.map((row) => row.canonicalShiftKey))].sort();
  const candidates: ApprovedPunchShiftDraft[] = [];
  for (const canonicalShiftKey of keys) {
    const criticalFields = new Set(["approved", "deleted", "date", "startedAt", "endedAt", "workedMinutes", "paidBreakMinutes"]);
    if (detail.observations.some((row) => row.canonicalShiftKey === canonicalShiftKey && criticalFields.has(row.field) && row.conflictState !== "clear")) continue;
    const approved = valueFor(detail, canonicalShiftKey, "approved");
    const deleted = valueFor(detail, canonicalShiftKey, "deleted");
    const date = valueFor(detail, canonicalShiftKey, "date");
    const startedAt = valueFor(detail, canonicalShiftKey, "startedAt");
    const endedAt = valueFor(detail, canonicalShiftKey, "endedAt");
    const workedMinutes = wholeMinutes(valueFor(detail, canonicalShiftKey, "workedMinutes"), 1, 36 * 60);
    const paidBreakValue = valueFor(detail, canonicalShiftKey, "paidBreakMinutes");
    const paidBreakMinutes = paidBreakValue === undefined ? null : wholeMinutes(paidBreakValue, 0, 24 * 60);
    const approvalRows = detail.observations.filter((row) => row.canonicalShiftKey === canonicalShiftKey && row.field === "approved" && row.value === true && row.conflictState === "clear" && APPROVED_FINALITY.has(row.finality));
    const finality = approvalRows.some((row) => row.finality === "final") ? "final" : "approved";
    if (approved !== true || deleted === true || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (typeof startedAt !== "string" || typeof endedAt !== "string" || workedMinutes === null) continue;
    const startMs = Date.parse(startedAt);
    const endMs = Date.parse(endedAt);
    const elapsedMinutes = Math.round((endMs - startMs) / 60_000);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || elapsedMinutes <= 0 || elapsedMinutes > 36 * 60) continue;
    if (paidBreakValue !== undefined && paidBreakMinutes === null) continue;
    if (paidBreakMinutes !== null && workedMinutes + paidBreakMinutes > elapsedMinutes) continue;
    const derivatives = detail.derivatives.filter((row) => row.canonicalShiftKey === canonicalShiftKey);
    if (derivatives.length !== 1) continue;
    const facts = derivatives[0]!.facts && typeof derivatives[0]!.facts === "object"
      ? derivatives[0]!.facts as MappedDerivativeFacts
      : {};
    const bundle = facts.bundleFacts;
    const providerSubjectKey = bundle?.providerSubjectKey;
    const jobId = bundle?.jobId;
    const job = typeof jobId === "string" ? jobs.get(jobId) : undefined;
    if (facts.mappingState !== "mapped"
      || bundle?.canonicalShiftKey !== canonicalShiftKey
      || bundle?.providerResourceKind !== "worked-shift"
      || typeof providerSubjectKey !== "string"
      || !/^s7subject_[A-Za-z0-9_-]{20,112}$/.test(providerSubjectKey)
      || providerSubjectKey.startsWith("s7subject_unbound_")
      || !job
      || bundle?.startedAt !== startedAt
      || bundle?.endedAt !== endedAt
      || bundle?.workedMinutes !== workedMinutes
      || bundle?.paidBreakMinutes !== (paidBreakMinutes ?? null)
      || bundle?.finality !== finality) continue;
    const roleId = valueFor(detail, canonicalShiftKey, "roleId");
    candidates.push({
      canonicalShiftKey,
      finality,
      missingPaidBreak: paidBreakMinutes === null,
      draft: {
        sourceKind: "seven-shifts-approved-punch",
        sourceLabel: `${finality} 7shifts punch`,
        date,
        jobId: job.jobId,
        ...(typeof roleId === "string" && job.activeRoleIds.includes(roleId) ? { roleId } : {}),
        startedAt: new Date(startMs).toISOString(),
        endedAt: new Date(endMs).toISOString(),
        workedHours: exactHours(workedMinutes),
        ...(paidBreakMinutes === null ? {} : { paidBreakHours: exactHours(paidBreakMinutes) }),
      },
    });
  }
  return candidates;
}
