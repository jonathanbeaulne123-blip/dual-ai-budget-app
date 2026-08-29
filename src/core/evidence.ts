import { dateKeyInZone, TIMEZONE } from "./calendar.ts";
import { stableImportHash } from "./importInbox/hash.ts";
import type { Environment } from "./types.ts";

export const EVIDENCE_SOURCE_KINDS = [
  "official-api",
  "browser-structured",
  "browser-dom",
  "selected-json",
  "selected-csv",
  "selected-ics",
  "calendar-sync",
  "email",
  "screenshot",
  "pdf",
  "ios-share",
  "local-ocr",
  "cloud-vision",
] as const;
export type EvidenceSourceKind = (typeof EVIDENCE_SOURCE_KINDS)[number];

export type EvidenceFinality = "outlook" | "provisional" | "approved" | "final";
export type EvidenceConflictState = "clear" | "corroborated" | "conflicted" | "unknown";

export type EvidenceObservation = {
  evidenceId: string;
  field: string;
  value: string | number | boolean | null;
  unit: "text" | "boolean" | "minutes" | "cad-cents" | "count" | "iso-time" | "date" | "identifier";
  sourcePath: string;
  confidenceBps: number;
  finality: EvidenceFinality;
  extraction: "provider" | "structured" | "calendar" | "email" | "local-ocr" | "cloud-vision" | "human";
  conflict: EvidenceConflictState;
};

/** Member-owned raw evidence reference. Object keys and encryption material remain Worker-only. */
export type EvidenceEnvelope = {
  evidenceId: string;
  environment: Environment;
  householdId: string;
  memberId: string;
  sourceKind: EvidenceSourceKind;
  capturedAt: string;
  observedAt: string | null;
  providerResourceKind: string;
  providerResourceId: string | null;
  providerRevision: string | null;
  parserVersion: string;
  schemaFingerprint: string;
  rawDigest: string;
  finality: EvidenceFinality;
  supersedesEvidenceId: string | null;
};

export type SevenShiftsAuthoritySelection = {
  workedMinutesEvidenceId: string;
  paidBreakMinutesEvidenceId: string | null;
  cashTipsEvidenceId: string | null;
  cardTipsEvidenceId: string | null;
  finalWagesEvidenceId: string | null;
};

export type SevenShiftsEvidenceBundle = {
  version: 1;
  provider: "7shifts";
  canonicalShiftKey: string;
  providerSubjectKey: string;
  environment: Environment;
  householdId: string;
  memberId: string;
  jobId: string;
  startedAt: string;
  endedAt: string;
  workedMinutes: number;
  paidBreakMinutes: number;
  revision: number;
  state: "eligible" | "quarantined" | "posted" | "superseded" | "correction-required";
  evidence: EvidenceEnvelope[];
  observations: EvidenceObservation[];
  authority: SevenShiftsAuthoritySelection;
  conflicts: string[];
  materialHash: string;
};

const MAX_EVIDENCE_REFS = 64;
const MAX_OBSERVATIONS = 512;
const MAX_TEXT = 240;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,159}$/;
const SAFE_DIGEST = /^[a-f0-9]{16,128}$/;

function cleanText(value: unknown, label: string, max = MAX_TEXT): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > max) throw new Error(`${label} is invalid.`);
  return clean;
}

function iso(value: unknown, label: string, nullable = false): string | null {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  const clean = cleanText(value, label, 48);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(clean)) {
    throw new Error(`${label} must include an explicit timezone.`);
  }
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is invalid.`);
  return parsed.toISOString();
}

function boundedInteger(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }
  return Number(value);
}

function optionalKey(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const clean = cleanText(value, label, 160);
  if (!SAFE_KEY.test(clean)) throw new Error(`${label} is invalid.`);
  return clean;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]));
  }
  return value;
}

function materialFacts(bundle: SevenShiftsEvidenceBundle): Omit<SevenShiftsEvidenceBundle, "materialHash"> {
  const { materialHash: _materialHash, ...facts } = bundle;
  return {
    ...facts,
    evidence: [...facts.evidence].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    observations: [...facts.observations].sort((left, right) => left.field.localeCompare(right.field) || left.evidenceId.localeCompare(right.evidenceId) || left.sourcePath.localeCompare(right.sourcePath)),
    conflicts: [...facts.conflicts].sort(),
  };
}

export function sevenShiftsEvidenceMaterialHash(bundle: SevenShiftsEvidenceBundle): string {
  return stableImportHash(JSON.stringify(stable(materialFacts(bundle))));
}

function shapeEnvelope(value: unknown, bundle: Pick<SevenShiftsEvidenceBundle, "environment" | "householdId" | "memberId">): EvidenceEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Evidence reference must be an object.");
  const row = value as EvidenceEnvelope;
  const sourceKind = EVIDENCE_SOURCE_KINDS.includes(row.sourceKind) ? row.sourceKind : null;
  if (!sourceKind) throw new Error("Evidence source kind is not supported.");
  if (row.environment !== bundle.environment || row.householdId !== bundle.householdId || row.memberId !== bundle.memberId) {
    throw new Error("Every evidence reference must belong to the same Hearth member scope.");
  }
  const finality = ["outlook", "provisional", "approved", "final"].includes(row.finality) ? row.finality : null;
  if (!finality) throw new Error("Evidence finality is invalid.");
  const rawDigest = cleanText(row.rawDigest, "Evidence digest", 128);
  if (!SAFE_DIGEST.test(rawDigest)) throw new Error("Evidence digest is invalid.");
  return {
    evidenceId: cleanText(row.evidenceId, "Evidence id", 160),
    environment: row.environment,
    householdId: cleanText(row.householdId, "Evidence household", 120),
    memberId: cleanText(row.memberId, "Evidence member", 120),
    sourceKind,
    capturedAt: iso(row.capturedAt, "Evidence capture time")!,
    observedAt: iso(row.observedAt, "Evidence observation time", true),
    providerResourceKind: cleanText(row.providerResourceKind, "Provider resource kind", 80),
    providerResourceId: optionalKey(row.providerResourceId, "Provider resource id"),
    providerRevision: optionalKey(row.providerRevision, "Provider revision"),
    parserVersion: cleanText(row.parserVersion, "Parser version", 40),
    schemaFingerprint: cleanText(row.schemaFingerprint, "Schema fingerprint", 128),
    rawDigest,
    finality,
    supersedesEvidenceId: optionalKey(row.supersedesEvidenceId, "Superseded evidence id"),
  };
}

function shapeObservation(value: unknown, evidenceIds: Set<string>): EvidenceObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Evidence observation must be an object.");
  const row = value as EvidenceObservation;
  if (!["text", "boolean", "minutes", "cad-cents", "count", "iso-time", "date", "identifier"].includes(row.unit)) throw new Error("Evidence observation unit is invalid.");
  if (!["outlook", "provisional", "approved", "final"].includes(row.finality)) throw new Error("Evidence observation finality is invalid.");
  if (!["provider", "structured", "calendar", "email", "local-ocr", "cloud-vision", "human"].includes(row.extraction)) throw new Error("Evidence extraction method is invalid.");
  if (!["clear", "corroborated", "conflicted", "unknown"].includes(row.conflict)) throw new Error("Evidence conflict state is invalid.");
  if (!["string", "number", "boolean"].includes(typeof row.value) && row.value !== null) throw new Error("Evidence observation value is invalid.");
  if (typeof row.value === "number" && !Number.isSafeInteger(row.value)) throw new Error("Numeric evidence values must be safe integers.");
  if (typeof row.value === "string" && row.value.length > 500) throw new Error("Evidence observation text is too long.");
  return {
    evidenceId: authorityId(row.evidenceId, evidenceIds, "Observation evidence", false)!,
    field: cleanText(row.field, "Evidence field", 100),
    value: row.value,
    unit: row.unit,
    sourcePath: cleanText(row.sourcePath, "Evidence source path", 160),
    confidenceBps: boundedInteger(row.confidenceBps, "Evidence confidence", 0, 10_000),
    finality: row.finality,
    extraction: row.extraction,
    conflict: row.conflict,
  };
}

function authorityId(value: unknown, ids: Set<string>, label: string, nullable: boolean): string | null {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  const id = cleanText(value, label, 160);
  if (!ids.has(id)) throw new Error(`${label} must reference evidence in this bundle.`);
  return id;
}

export function shapeSevenShiftsEvidenceBundle(value: unknown): SevenShiftsEvidenceBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("7shifts evidence bundle must be an object.");
  const row = value as SevenShiftsEvidenceBundle;
  if (row.version !== 1 || row.provider !== "7shifts") throw new Error("7shifts evidence bundle version is not supported.");
  if (row.environment !== "development" && row.environment !== "production") throw new Error("7shifts evidence environment is invalid.");
  if (!["eligible", "quarantined", "posted", "superseded", "correction-required"].includes(row.state)) throw new Error("7shifts evidence state is invalid.");
  const startedAt = iso(row.startedAt, "7shifts shift start")!;
  const endedAt = iso(row.endedAt, "7shifts shift end")!;
  const elapsedMinutes = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000);
  if (elapsedMinutes <= 0 || elapsedMinutes > 36 * 60) throw new Error("7shifts evidence shift duration is invalid.");
  const workedMinutes = boundedInteger(row.workedMinutes, "Worked minutes", 0, elapsedMinutes);
  const paidBreakMinutes = boundedInteger(row.paidBreakMinutes, "Paid-break minutes", 0, elapsedMinutes);
  if (workedMinutes + paidBreakMinutes > elapsedMinutes) throw new Error("7shifts evidence minutes exceed the shift window.");
  if (!Array.isArray(row.evidence) || !row.evidence.length || row.evidence.length > MAX_EVIDENCE_REFS) throw new Error("7shifts evidence bundle must contain 1 to 64 references.");
  if (!Array.isArray(row.observations) || row.observations.length > MAX_OBSERVATIONS) throw new Error("7shifts evidence bundle has too many observations.");
  const scope = {
    environment: row.environment,
    householdId: cleanText(row.householdId, "Evidence household", 120),
    memberId: cleanText(row.memberId, "Evidence member", 120),
  };
  const evidence = row.evidence.map((item) => shapeEnvelope(item, scope)).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const ids = new Set(evidence.map((item) => item.evidenceId));
  if (ids.size !== evidence.length) throw new Error("7shifts evidence bundle repeats an evidence id.");
  const observations = row.observations.map((item) => shapeObservation(item, ids)).sort((left, right) => left.field.localeCompare(right.field) || left.evidenceId.localeCompare(right.evidenceId) || left.sourcePath.localeCompare(right.sourcePath));
  const conflicts = (Array.isArray(row.conflicts) ? row.conflicts : []).map((item) => cleanText(item, "Evidence conflict", 240)).sort();
  const result: SevenShiftsEvidenceBundle = {
    version: 1,
    provider: "7shifts",
    canonicalShiftKey: cleanText(row.canonicalShiftKey, "Canonical 7shifts shift key", 160),
    providerSubjectKey: cleanText(row.providerSubjectKey, "7shifts provider subject", 160),
    ...scope,
    jobId: cleanText(row.jobId, "Evidence job", 120),
    startedAt,
    endedAt,
    workedMinutes,
    paidBreakMinutes,
    revision: boundedInteger(row.revision, "Evidence revision", 1, 1_000_000_000),
    state: row.state,
    evidence,
    observations,
    authority: {
      workedMinutesEvidenceId: authorityId(row.authority?.workedMinutesEvidenceId, ids, "Worked-minutes authority", false)!,
      paidBreakMinutesEvidenceId: authorityId(row.authority?.paidBreakMinutesEvidenceId, ids, "Paid-break authority", true),
      cashTipsEvidenceId: authorityId(row.authority?.cashTipsEvidenceId, ids, "Cash-tip authority", true),
      cardTipsEvidenceId: authorityId(row.authority?.cardTipsEvidenceId, ids, "Card-tip authority", true),
      finalWagesEvidenceId: authorityId(row.authority?.finalWagesEvidenceId, ids, "Final-wages authority", true),
    },
    conflicts,
    materialHash: "",
  };
  if (!SAFE_KEY.test(result.canonicalShiftKey) || !SAFE_KEY.test(result.providerSubjectKey)) throw new Error("7shifts evidence identity is invalid.");
  result.materialHash = sevenShiftsEvidenceMaterialHash(result);
  if (row.materialHash !== result.materialHash) throw new Error("7shifts evidence material hash does not match its facts.");
  return result;
}

export function assertSevenShiftsBundleMatchesShift(input: {
  bundle: SevenShiftsEvidenceBundle;
  environment: Environment;
  householdId: string;
  memberId: string;
  jobId: string;
  date: string;
  startedAt?: string | null;
  endedAt?: string | null;
  workedHours: number;
  paidBreakHours: number;
  roleId: string;
  salesCents: number;
  cashTipsCents: number;
  cardTipsCents: number;
  calculatedWagesCents: number;
  requireTipAuthority: boolean;
  requireSalesAuthority: boolean;
  requireTippedCovariateAuthority: boolean;
  customersServed?: number;
  staffingCount?: number;
  eventTag?: string;
  weatherGlass?: string;
}): SevenShiftsEvidenceBundle {
  const bundle = shapeSevenShiftsEvidenceBundle(input.bundle);
  if (bundle.state !== "eligible") throw new Error("Only eligible 7shifts evidence may post automatically or through Confirm.");
  if (bundle.conflicts.length) throw new Error("Conflicted 7shifts evidence must be resolved before posting.");
  if (bundle.environment !== input.environment || bundle.householdId !== input.householdId || bundle.memberId !== input.memberId || bundle.jobId !== input.jobId) {
    throw new Error("7shifts evidence does not match this Hearth member and job.");
  }
  if (dateKeyInZone(new Date(bundle.startedAt), TIMEZONE) !== input.date) throw new Error("7shifts evidence does not match the Toronto shift date.");
  if (input.startedAt && new Date(input.startedAt).toISOString() !== bundle.startedAt) throw new Error("7shifts evidence start time changed after capture.");
  if (input.endedAt && new Date(input.endedAt).toISOString() !== bundle.endedAt) throw new Error("7shifts evidence end time changed after capture.");
  if (Math.round(input.workedHours * 60) !== bundle.workedMinutes || Math.round(input.paidBreakHours * 60) !== bundle.paidBreakMinutes) {
    throw new Error("7shifts evidence minutes changed after capture.");
  }
  const exactObservation = (
    field: string,
    expected: string | number | undefined,
    evidenceId?: string | null,
    required = false,
  ) => {
    if (required && !evidenceId && ["workedMinutes", "paidBreakMinutes", "cashTipsCents", "cardTipsCents"].includes(field)) {
      throw new Error(`7shifts ${field} requires an explicit evidence authority, including for zero.`);
    }
    const rows = bundle.observations.filter((row) => row.field === field && (!evidenceId || row.evidenceId === evidenceId));
    if (!rows.length) {
      if (evidenceId || required) throw new Error(`7shifts ${field} authority has no matching observation.`);
      return;
    }
    if (expected === undefined || rows.some((row) => row.conflict === "conflicted" || row.value !== expected)) {
      throw new Error(`7shifts ${field} changed after evidence authority was selected.`);
    }
  };
  exactObservation("workedMinutes", bundle.workedMinutes, bundle.authority.workedMinutesEvidenceId, true);
  exactObservation("paidBreakMinutes", bundle.paidBreakMinutes, bundle.authority.paidBreakMinutesEvidenceId, true);
  exactObservation("roleId", input.roleId, undefined, true);
  exactObservation("salesCents", input.salesCents, undefined, input.requireSalesAuthority);
  exactObservation("cashTipsCents", input.cashTipsCents, bundle.authority.cashTipsEvidenceId, input.requireTipAuthority);
  exactObservation("cardTipsCents", input.cardTipsCents, bundle.authority.cardTipsEvidenceId, input.requireTipAuthority);
  exactObservation("finalWagesCents", input.calculatedWagesCents, bundle.authority.finalWagesEvidenceId);
  exactObservation("customersServed", input.customersServed, undefined, input.requireTippedCovariateAuthority);
  exactObservation("staffingCount", input.staffingCount, undefined, input.requireTippedCovariateAuthority);
  exactObservation("eventTag", input.eventTag);
  exactObservation("weatherGlass", input.weatherGlass);
  return bundle;
}
