import { dateKeyInZone } from "../core/calendar.ts";
import type { ShiftEnvelopeEvidenceProposal, ShiftSourceFinality } from "../core/shiftEnvelope.ts";
import type { EvidenceDerivedDetail } from "./evidenceClient.ts";
import type { WorkJob } from "../core/types.ts";

type DerivativeFacts = { mappingState?: unknown; bundleFacts?: Record<string, unknown> };
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,180}$/;
function iso(value: unknown): string | null { return typeof value === "string" && ISO.test(value) && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null; }
function integer(value: unknown, max: number): number | null { return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max ? Number(value) : null; }
function finality(value: unknown): ShiftSourceFinality { return ["outlook", "provisional", "approved", "final"].includes(String(value)) ? value as ShiftSourceFinality : "provisional"; }

function label(value: unknown): string { return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-CA").replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim(); }

/** Convert only server-mapped, immutable derived facts into nonfinancial Shift-mail proposals. */
export function evidenceEnvelopeProposals(details: EvidenceDerivedDetail[], jobs: WorkJob[] = []): ShiftEnvelopeEvidenceProposal[] {
  const proposals = new Map<string, ShiftEnvelopeEvidenceProposal>();
  for (const detail of details) for (const derivative of detail.derivatives) {
    const facts = derivative.facts as DerivativeFacts;
    const bundle = facts?.bundleFacts ?? {};
    const kind = bundle?.providerResourceKind;
    if (facts?.mappingState !== "mapped" || (kind !== "coworker-schedule" && kind !== "worked-shift" && kind !== "schedule-window")) continue;
    const canonicalShiftKey = String(bundle.canonicalShiftKey || derivative.canonicalShiftKey || "");
    const jobId = String(bundle.jobId || "");
    const startedAt = iso(bundle.startedAt);
    const endedAt = iso(bundle.endedAt);
    const observedAt = iso(bundle.observedAt) ?? iso(derivative.createdAt);
    const role = detail.observations.find((row) => row.canonicalShiftKey === canonicalShiftKey && row.field === "roleId");
    const roleId = String(role?.value || "");
    const mappedJob = jobs.find((row) => row.id === jobId);
    const mappedRole = mappedJob?.roles.find((row) => row.id === roleId && row.active);
    const observedRole = detail.observations.find((row) => row.canonicalShiftKey === canonicalShiftKey && row.field === "observedRole")?.value;
    const observedLocation = detail.observations.find((row) => row.canonicalShiftKey === canonicalShiftKey && row.field === "observedLocation")?.value;
    if (jobs.length && kind !== "schedule-window" && (!mappedJob || !mappedRole || !observedRole || label(observedRole) !== label(mappedRole.name))) continue;
    if (jobs.length && observedLocation && mappedJob && label(observedLocation) !== label(mappedJob.locationName)) continue;
    if (!SAFE_ID.test(canonicalShiftKey) || !SAFE_ID.test(jobId) || !SAFE_ID.test(roleId) || !startedAt || !endedAt || !observedAt || endedAt <= startedAt) continue;
    const statusValue = detail.observations.find((row) => row.canonicalShiftKey === canonicalShiftKey && row.field === "scheduleOutcome")?.value;
    const proposal: ShiftEnvelopeEvidenceProposal = {
      canonicalShiftKey, kind, jobId, roleId, date: dateKeyInZone(new Date(startedAt)), startedAt, endedAt,
      workedMinutes: integer(bundle.workedMinutes, 2_880), paidBreakMinutes: integer(bundle.paidBreakMinutes, 1_440),
      unpaidBreakMinutes: integer(detail.observations.find((row) => row.canonicalShiftKey === canonicalShiftKey && row.field === "unpaidBreakMinutes")?.value, 1_440),
      observedAt, finality: finality(bundle.finality),
      source: bundle.sourceKind === "gmail-7shifts-email" || bundle.sourceKind === "email" ? "seven_shifts_email" : kind === "worked-shift" ? "seven_shifts_timesheet" : "seven_shifts_schedule",
      statusHint: ["picked_up", "traded_away", "cut", "called_off"].includes(String(statusValue)) ? statusValue as ShiftEnvelopeEvidenceProposal["statusHint"] : null,
      completeRange: kind === "schedule-window" ? {
        startDate: String(detail.observations.find((row) => row.canonicalShiftKey === canonicalShiftKey && row.field === "completeRangeStart")?.value || ""),
        endDate: String(detail.observations.find((row) => row.canonicalShiftKey === canonicalShiftKey && row.field === "completeRangeEnd")?.value || ""),
      } : null,
    };
    const key = `${kind}:${canonicalShiftKey}`;
    const existing = proposals.get(key);
    if (!existing || existing.observedAt < proposal.observedAt) proposals.set(key, proposal);
  }
  return [...proposals.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}
