import type { PostWorkShiftInput } from "./commands.ts";
import { addDays, weekdaySunday0, type DateKey } from "./calendar.ts";
import { shapeSevenShiftsEvidenceBundle, type EvidenceObservation, type SevenShiftsEvidenceBundle } from "./evidence.ts";
import type { Environment, ShiftEventTag, Visibility, WorkJob } from "./types.ts";

export const AUTOMATION_EVIDENCE_FIELDS = [
  "date", "roleId", "workedMinutes", "paidBreakMinutes", "salesCents",
  "cashTipsCents", "cardTipsCents", "customersServed", "staffingCount",
] as const;
export type AutomationEvidenceField = (typeof AUTOMATION_EVIDENCE_FIELDS)[number];

export type AutomationPolicy = {
  version: 1;
  environment: Environment;
  householdId: string;
  memberId: string;
  jobId: string;
  enabled: boolean;
  requiredEvidenceFields: AutomationEvidenceField[];
  stableWindowHours: number;
  payrollWeekStarts: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  correctionHorizonDays: number;
  closedPeriodAction: "variance";
  wagesVisibility?: Visibility;
  cashTipsVisibility?: Visibility;
  cardTipsVisibility?: Visibility;
  tipOutVisibility?: Visibility;
  updatedAt: string;
};

export function automationRequiredEvidenceFieldsForJob(job: WorkJob): AutomationEvidenceField[] {
  void job;
  // The Evidence Worker cannot trust a client-authored description of the job.
  // Automatic claiming therefore uses one conservative provider-neutral minimum;
  // partial/non-tipped evidence remains available through ordinary Shift review.
  return [...AUTOMATION_EVIDENCE_FIELDS];
}

export type AutomationActionKind = "post" | "reconcile_week" | "variance";

export type AutomationReceipt = {
  jobKey: string;
  bundleRevision: number;
  commandEventId: string;
  confirmationId: string;
  resultRevision: number;
  identityHash: string;
  auditHash: string;
  reversalIds: string[];
  replacementShiftIds: string[];
  acknowledgedAt: string;
};

export type AutomationEligibility = {
  eligible: boolean;
  eligibleAt: string | null;
  reason: string;
  tier: "structured-approved" | "structured-stable" | "cross-checked-screen" | "blocked";
};

function iso(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function evidenceFor(bundle: SevenShiftsEvidenceBundle, evidenceId: string | null) {
  return evidenceId ? bundle.evidence.find((item) => item.evidenceId === evidenceId) ?? null : null;
}

function observation(bundle: SevenShiftsEvidenceBundle, field: string, evidenceId?: string | null): EvidenceObservation | null {
  return bundle.observations.find((item) => item.field === field && (!evidenceId || item.evidenceId === evidenceId)) ?? null;
}

function matchingIndependentExtraction(bundle: SevenShiftsEvidenceBundle, field: string): boolean {
  const rows = bundle.observations.filter((item) => item.field === field && item.conflict !== "conflicted");
  const local = rows.find((item) => item.extraction === "local-ocr");
  const cloud = rows.find((item) => item.extraction === "cloud-vision");
  return Boolean(local && cloud && local.value === cloud.value && local.confidenceBps >= 9_000 && cloud.confidenceBps >= 9_000);
}

export function automationPolicyMatchesBundle(policy: AutomationPolicy, bundle: SevenShiftsEvidenceBundle): boolean {
  return policy.version === 1
    && policy.environment === bundle.environment
    && policy.householdId === bundle.householdId
    && policy.memberId === bundle.memberId
    && policy.jobId === bundle.jobId;
}

export function sevenShiftsAutomationEligibility(
  rawBundle: SevenShiftsEvidenceBundle,
  policy: AutomationPolicy,
  now = new Date(),
): AutomationEligibility {
  let bundle: SevenShiftsEvidenceBundle;
  try { bundle = shapeSevenShiftsEvidenceBundle(rawBundle); } catch (error) {
    return { eligible: false, eligibleAt: null, reason: error instanceof Error ? error.message : "Evidence is invalid.", tier: "blocked" };
  }
  if (!policy.enabled || !automationPolicyMatchesBundle(policy, bundle)) {
    return { eligible: false, eligibleAt: null, reason: "Automation is not enabled for this exact member and job.", tier: "blocked" };
  }
  if (bundle.state !== "eligible" || bundle.conflicts.length || bundle.observations.some((item) => item.conflict === "conflicted")) {
    return { eligible: false, eligibleAt: null, reason: "Evidence is quarantined or conflicted.", tier: "blocked" };
  }
  const requiredFields = Array.isArray(policy.requiredEvidenceFields) ? policy.requiredEvidenceFields : [];
  if (!AUTOMATION_EVIDENCE_FIELDS.every((field) => requiredFields.includes(field)) || requiredFields.some((field) => !AUTOMATION_EVIDENCE_FIELDS.includes(field))) {
    return { eligible: false, eligibleAt: null, reason: "Automation policy needs a fresh job-specific evidence authority review.", tier: "blocked" };
  }
  const authorityFor = (field: AutomationEvidenceField): string | null | undefined => ({
    workedMinutes: bundle.authority.workedMinutesEvidenceId,
    paidBreakMinutes: bundle.authority.paidBreakMinutesEvidenceId,
    cashTipsCents: bundle.authority.cashTipsEvidenceId,
    cardTipsCents: bundle.authority.cardTipsEvidenceId,
  } as Partial<Record<AutomationEvidenceField, string | null>>)[field];
  const missingFields = requiredFields.filter((field) => {
    const authorityId = authorityFor(field);
    if (["workedMinutes", "paidBreakMinutes", "cashTipsCents", "cardTipsCents"].includes(field) && !authorityId) return true;
    return !bundle.observations.some((item) => item.field === field && (!authorityId || item.evidenceId === authorityId) && item.conflict !== "conflicted");
  });
  if (missingFields.length) {
    return { eligible: false, eligibleAt: null, reason: `Evidence still needs authoritative ${missingFields.join(", ")}.`, tier: "blocked" };
  }
  const authority = evidenceFor(bundle, bundle.authority.workedMinutesEvidenceId);
  if (!authority || ["calendar-sync", "selected-ics", "email"].includes(authority.sourceKind)) {
    return { eligible: false, eligibleAt: null, reason: "Schedules and notification email cannot establish worked time.", tier: "blocked" };
  }
  if (authority.sourceKind === "screenshot" || authority.sourceKind === "pdf" || authority.sourceKind === "ios-share") {
    const required = ["date", "startedAt", "endedAt", "workedMinutes"];
    const moneyFields = ["cashTipsCents", "cardTipsCents", "finalWagesCents"].filter((field) => bundle.observations.some((item) => item.field === field));
    if (![...required, ...moneyFields].every((field) => matchingIndependentExtraction(bundle, field))) {
      return { eligible: false, eligibleAt: null, reason: "Screenshot evidence needs matching high-confidence local and cloud extraction for every material field.", tier: "blocked" };
    }
    return { eligible: true, eligibleAt: now.toISOString(), reason: "Independent screenshot extractions agree.", tier: "cross-checked-screen" };
  }
  if (authority.finality === "approved" || authority.finality === "final") {
    return { eligible: true, eligibleAt: now.toISOString(), reason: "Structured worked-time evidence is approved or final.", tier: "structured-approved" };
  }
  if (authority.finality !== "provisional") {
    return { eligible: false, eligibleAt: null, reason: "Worked-time evidence is outlook-only.", tier: "blocked" };
  }
  const observed = iso(authority.observedAt || authority.capturedAt);
  const eligibleAtMs = observed + Math.max(1, Math.min(168, policy.stableWindowHours)) * 3_600_000;
  if (now.getTime() < eligibleAtMs) {
    return { eligible: false, eligibleAt: new Date(eligibleAtMs).toISOString(), reason: "Structured punch is still inside its stability window.", tier: "structured-stable" };
  }
  return { eligible: true, eligibleAt: new Date(eligibleAtMs).toISOString(), reason: "Structured punch stayed materially unchanged through its stability window.", tier: "structured-stable" };
}

function centsAsDollars(row: EvidenceObservation | null): number | undefined {
  return row?.unit === "cad-cents" && typeof row.value === "number" ? row.value / 100 : undefined;
}

function integerValue(row: EvidenceObservation | null): number | undefined {
  return typeof row?.value === "number" && Number.isSafeInteger(row.value) ? row.value : undefined;
}

export function buildAutomatedWorkShiftInput(
  rawBundle: SevenShiftsEvidenceBundle,
  policy: AutomationPolicy,
  createdBy: string,
): PostWorkShiftInput {
  const bundle = shapeSevenShiftsEvidenceBundle(rawBundle);
  if (!automationPolicyMatchesBundle(policy, bundle) || !policy.enabled) throw new Error("Automation policy does not match this evidence bundle.");
  const date = observation(bundle, "date")?.value;
  if (typeof date !== "string") throw new Error("Automated evidence is missing its Toronto date.");
  const cashTips = centsAsDollars(observation(bundle, "cashTipsCents", bundle.authority.cashTipsEvidenceId));
  const cardTips = centsAsDollars(observation(bundle, "cardTipsCents", bundle.authority.cardTipsEvidenceId));
  const sales = centsAsDollars(observation(bundle, "salesCents"));
  const customersServed = integerValue(observation(bundle, "customersServed"));
  const staffingCount = integerValue(observation(bundle, "staffingCount"));
  const eventValue = observation(bundle, "eventTag")?.value;
  const weatherValue = observation(bundle, "weatherGlass")?.value;
  const roleValue = observation(bundle, "roleId")?.value;
  if (typeof roleValue !== "string" || !roleValue) throw new Error("Automated evidence has no exact Hearth role mapping.");
  return {
    date,
    memberId: bundle.memberId,
    jobId: bundle.jobId,
    roleId: roleValue,
    workedHours: bundle.workedMinutes / 60,
    paidBreakHours: bundle.paidBreakMinutes / 60,
    startedAt: bundle.startedAt,
    endedAt: bundle.endedAt,
    createdBy,
    ...(cashTips !== undefined ? { cashTips } : {}),
    ...(cardTips !== undefined ? { cardTips } : {}),
    ...(sales !== undefined ? { sales } : {}),
    ...(customersServed !== undefined ? { customersServed } : {}),
    ...(staffingCount !== undefined ? { staffingCount } : {}),
    ...(typeof eventValue === "string" ? { eventTag: eventValue as ShiftEventTag } : {}),
    ...(typeof weatherValue === "string" ? { weatherGlass: weatherValue } : {}),
    ...(policy.wagesVisibility ? { wagesVisibility: policy.wagesVisibility } : {}),
    ...(policy.cashTipsVisibility ? { cashTipsVisibility: policy.cashTipsVisibility } : {}),
    ...(policy.cardTipsVisibility ? { cardTipsVisibility: policy.cardTipsVisibility } : {}),
    ...(policy.tipOutVisibility ? { tipOutVisibility: policy.tipOutVisibility } : {}),
    sevenShiftsEvidenceBundle: bundle,
  };
}

export function sevenShiftsAutomationJobKey(bundle: SevenShiftsEvidenceBundle, action: AutomationActionKind): string {
  const shaped = shapeSevenShiftsEvidenceBundle(bundle);
  return `s7:${stableKey(shaped.memberId)}:${stableKey(shaped.canonicalShiftKey)}:${shaped.revision}:${action}:${shaped.materialHash}`;
}

export function automationPayrollWeekStart(date: DateKey, startsOn: AutomationPolicy["payrollWeekStarts"]): DateKey {
  const offset = (weekdaySunday0(date) - startsOn + 7) % 7;
  return addDays(date, -offset);
}

function stableKey(value: string): string {
  return value.replace(/[^A-Za-z0-9:_-]/g, "-").slice(0, 100);
}
