import { describe, expect, it } from "vitest";
import {
  buildAutomatedWorkShiftInput,
  sevenShiftsAutomationEligibility,
  sevenShiftsAutomationJobKey,
  sevenShiftsEvidenceMaterialHash,
  type AutomationPolicy,
  type SevenShiftsEvidenceBundle,
} from "../src/core/index.ts";

function bundle(finality: "provisional" | "approved" = "approved"): SevenShiftsEvidenceBundle {
  const evidenceId = "evi_structured_punch_00000001";
  const row: SevenShiftsEvidenceBundle = {
    version: 1, provider: "7shifts", canonicalShiftKey: "shift:company-1:punch-7", providerSubjectKey: "subject:company-1:employee-9",
    environment: "development", householdId: "HH-TEST", memberId: "MEM-002", jobId: "JOB-CAFE",
    startedAt: "2026-08-28T21:00:00.000Z", endedAt: "2026-08-29T02:00:00.000Z", workedMinutes: 285, paidBreakMinutes: 15,
    revision: 3, state: "eligible",
    evidence: [{
      evidenceId, environment: "development", householdId: "HH-TEST", memberId: "MEM-002", sourceKind: "browser-structured",
      capturedAt: "2026-08-29T03:00:00.000Z", observedAt: "2026-08-29T02:05:00.000Z", providerResourceKind: "time-punch",
      providerResourceId: "punch-0007", providerRevision: "revision-3", parserVersion: "evidence-v1", schemaFingerprint: "schema-2025-03",
      rawDigest: "a".repeat(64), finality, supersedesEvidenceId: null,
    }],
    observations: [
      { evidenceId, field: "date", value: "2026-08-28", unit: "date", sourcePath: "punch.business_date", confidenceBps: 10_000, finality, extraction: "structured", conflict: "clear" },
      { evidenceId, field: "roleId", value: "ROLE-SERVER", unit: "identifier", sourcePath: "mapping.role", confidenceBps: 10_000, finality, extraction: "human", conflict: "clear" },
      { evidenceId, field: "workedMinutes", value: 285, unit: "minutes", sourcePath: "punch.worked", confidenceBps: 10_000, finality, extraction: "structured", conflict: "clear" },
      { evidenceId, field: "paidBreakMinutes", value: 15, unit: "minutes", sourcePath: "punch.breaks.paid", confidenceBps: 10_000, finality, extraction: "structured", conflict: "clear" },
      { evidenceId, field: "cashTipsCents", value: 4200, unit: "cad-cents", sourcePath: "tips.cash", confidenceBps: 10_000, finality, extraction: "structured", conflict: "clear" },
      { evidenceId, field: "cardTipsCents", value: 0, unit: "cad-cents", sourcePath: "tips.card", confidenceBps: 10_000, finality, extraction: "structured", conflict: "clear" },
      { evidenceId, field: "salesCents", value: 65000, unit: "cad-cents", sourcePath: "sales.total", confidenceBps: 10_000, finality, extraction: "structured", conflict: "clear" },
      { evidenceId, field: "customersServed", value: 40, unit: "count", sourcePath: "report.customers", confidenceBps: 10_000, finality, extraction: "structured", conflict: "clear" },
      { evidenceId, field: "staffingCount", value: 4, unit: "count", sourcePath: "report.staffing", confidenceBps: 10_000, finality, extraction: "structured", conflict: "clear" },
    ],
    authority: { workedMinutesEvidenceId: evidenceId, paidBreakMinutesEvidenceId: evidenceId, cashTipsEvidenceId: evidenceId, cardTipsEvidenceId: evidenceId, finalWagesEvidenceId: null },
    conflicts: [], materialHash: "",
  };
  row.materialHash = sevenShiftsEvidenceMaterialHash(row);
  return row;
}

function policy(): AutomationPolicy {
  return { version: 1, environment: "development", householdId: "HH-TEST", memberId: "MEM-002", jobId: "JOB-CAFE", enabled: true, requiredEvidenceFields: ["date", "roleId", "workedMinutes", "paidBreakMinutes", "salesCents", "cashTipsCents", "cardTipsCents", "customersServed", "staffingCount"], stableWindowHours: 24, payrollWeekStarts: 1, correctionHorizonDays: 60, closedPeriodAction: "variance", updatedAt: "2026-08-29T03:00:00.000Z" };
}

describe("D-159 deterministic automation", () => {
  it("makes approved structured evidence eligible and builds the ordinary work command", () => {
    expect(sevenShiftsAutomationEligibility(bundle(), policy(), new Date("2026-08-29T03:00:00.000Z"))).toMatchObject({ eligible: true, tier: "structured-approved" });
    const input = buildAutomatedWorkShiftInput(bundle(), policy(), "MEM-002");
    expect(input).toMatchObject({ memberId: "MEM-002", jobId: "JOB-CAFE", roleId: "ROLE-SERVER", date: "2026-08-28", workedHours: 4.75, paidBreakHours: 0.25, cashTips: 42 });
    expect(input.sevenShiftsEvidenceBundle?.materialHash).toBe(bundle().materialHash);
  });

  it("holds provisional rows through the stability window and keys retries by material revision", () => {
    expect(sevenShiftsAutomationEligibility(bundle("provisional"), policy(), new Date("2026-08-29T12:00:00.000Z"))).toMatchObject({ eligible: false, tier: "structured-stable" });
    expect(sevenShiftsAutomationEligibility(bundle("provisional"), policy(), new Date("2026-08-30T03:00:00.000Z"))).toMatchObject({ eligible: true, tier: "structured-stable" });
    const key = sevenShiftsAutomationJobKey(bundle(), "post");
    expect(key).toMatch(/^s7:MEM-002:shift:company-1:punch-7:3:post:/);
    const changed = bundle(); changed.revision = 4; changed.materialHash = sevenShiftsEvidenceMaterialHash(changed);
    expect(sevenShiftsAutomationJobKey(changed, "post")).not.toBe(key);
  });

  it("blocks schedules, conflicts, disabled policies, and uncorroborated screens", () => {
    const scheduled = bundle(); scheduled.evidence[0]!.sourceKind = "calendar-sync"; scheduled.evidence[0]!.finality = "outlook"; scheduled.materialHash = sevenShiftsEvidenceMaterialHash(scheduled);
    expect(sevenShiftsAutomationEligibility(scheduled, policy()).eligible).toBe(false);
    const conflicted = bundle(); conflicted.conflicts = ["workedMinutes"]; conflicted.materialHash = sevenShiftsEvidenceMaterialHash(conflicted);
    expect(sevenShiftsAutomationEligibility(conflicted, policy()).eligible).toBe(false);
    expect(sevenShiftsAutomationEligibility(bundle(), { ...policy(), enabled: false }).eligible).toBe(false);
    const screen = bundle(); screen.evidence[0]!.sourceKind = "screenshot"; screen.materialHash = sevenShiftsEvidenceMaterialHash(screen);
    expect(sevenShiftsAutomationEligibility(screen, policy())).toMatchObject({ eligible: false, tier: "blocked" });
  });

  it("blocks an incomplete bundle before an automation job can be claimed", () => {
    const incomplete = bundle();
    incomplete.observations = incomplete.observations.filter((row) => row.field !== "cardTipsCents");
    incomplete.authority.cardTipsEvidenceId = null;
    incomplete.materialHash = sevenShiftsEvidenceMaterialHash(incomplete);
    expect(sevenShiftsAutomationEligibility(incomplete, policy())).toMatchObject({ eligible: false, tier: "blocked" });
    expect(sevenShiftsAutomationEligibility(bundle(), { ...policy(), requiredEvidenceFields: ["date", "roleId", "workedMinutes", "paidBreakMinutes"] })).toMatchObject({ eligible: false, tier: "blocked" });
  });
});
