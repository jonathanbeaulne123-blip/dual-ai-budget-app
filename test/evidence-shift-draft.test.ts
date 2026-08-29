import { describe, expect, it } from "vitest";
import { approvedPunchShiftDrafts } from "../src/imports/evidenceShiftDraft.ts";
import type { EvidenceDerivedDetail } from "../src/imports/evidenceClient.ts";

function detail(overrides: Array<{ field: string; value: unknown; finality?: string; conflictState?: string }> = []): EvidenceDerivedDetail {
  const facts = [
    { field: "approved", value: true },
    { field: "date", value: "2026-08-15" },
    { field: "startedAt", value: "2026-08-15T20:30:00.000Z" },
    { field: "endedAt", value: "2026-08-16T02:31:00.000Z" },
    { field: "workedMinutes", value: 361 },
    ...overrides,
  ];
  return {
    evidenceId: "evi_approved_punch_1234567890",
    revision: 1,
    state: "ready_to_review",
    parserVersion: "hearth-s7-extract-v2",
    schemaFingerprint: "fixture",
    derivatives: [{
      canonicalShiftKey: "s7shift_approved",
      parserVersion: "hearth-s7-extract-v2",
      schemaFingerprint: "fixture",
      facts: {
        version: 1,
        mappingState: "mapped",
        bundleFacts: {
          canonicalShiftKey: "s7shift_approved",
          providerSubjectKey: "s7subject_abcdefghijklmnopqrstuvwxyz",
          providerResourceKind: "worked-shift",
          jobId: "JOB-CAFE",
          startedAt: "2026-08-15T20:30:00.000Z",
          endedAt: "2026-08-16T02:31:00.000Z",
          workedMinutes: 361,
          paidBreakMinutes: overrides.find((row) => row.field === "paidBreakMinutes")?.value ?? null,
          finality: "final",
        },
      },
      createdAt: "2026-08-29T01:18:34.956Z",
    }],
    observations: facts.map((row, index) => ({
      observationId: `obs-${index}`,
      canonicalShiftKey: "s7shift_approved",
      field: row.field,
      value: row.value,
      unit: row.field.includes("Minutes") ? "minutes" : "value",
      sourceLocation: `timesheet.${row.field}`,
      confidenceBps: 10_000,
      finality: row.finality ?? "final",
      extractionMethod: "structured",
      conflictState: row.conflictState ?? "clear",
      createdAt: "2026-08-29T01:18:34.956Z",
    })),
    schemaDrift: [],
  };
}

describe("approved Evidence punch Shift drafts", () => {
  const jobs = [{ jobId: "JOB-CAFE", activeRoleIds: ["ROLE-SERVER"] }];

  it("prefills only worked time and preserves a missing paid break", () => {
    const [candidate] = approvedPunchShiftDrafts(detail([
      { field: "cashTipsCents", value: 5000 },
      { field: "cardTipsCents", value: 9000 },
    ]), jobs);
    expect(candidate).toMatchObject({ finality: "final", missingPaidBreak: true });
    expect(candidate?.draft).toMatchObject({
      sourceKind: "seven-shifts-approved-punch",
      date: "2026-08-15",
      startedAt: "2026-08-15T20:30:00.000Z",
      endedAt: "2026-08-16T02:31:00.000Z",
      workedHours: 6.02,
      jobId: "JOB-CAFE",
    });
    expect(candidate?.draft).not.toHaveProperty("paidBreakHours");
    expect(candidate?.draft).not.toHaveProperty("cashTips");
    expect(candidate?.draft).not.toHaveProperty("cardTips");
  });

  it("preserves an explicit zero break and refuses conflicts or unapproved rows", () => {
    expect(approvedPunchShiftDrafts(detail([{ field: "paidBreakMinutes", value: 0 }]), jobs)[0]?.draft.paidBreakHours).toBe(0);
    expect(approvedPunchShiftDrafts(detail([{ field: "workedMinutes", value: 360, conflictState: "conflicted" }]), jobs)).toEqual([]);
    const unapproved = detail();
    unapproved.observations.find((row) => row.field === "approved")!.value = false;
    expect(approvedPunchShiftDrafts(unapproved, jobs)).toEqual([]);
  });

  it("refuses unbound, wrong-job, ambiguous, or materially mismatched derivatives", () => {
    const unbound = detail();
    (unbound.derivatives[0]!.facts as any).bundleFacts.providerSubjectKey = "s7subject_unbound_abcdefghijklmnopqrstuvwxyz";
    expect(approvedPunchShiftDrafts(unbound, jobs)).toEqual([]);

    const wrongJob = detail();
    (wrongJob.derivatives[0]!.facts as any).bundleFacts.jobId = "JOB-PARTNER";
    expect(approvedPunchShiftDrafts(wrongJob, jobs)).toEqual([]);

    const ambiguous = detail();
    ambiguous.derivatives.push({ ...ambiguous.derivatives[0]! });
    expect(approvedPunchShiftDrafts(ambiguous, jobs)).toEqual([]);

    const drifted = detail();
    (drifted.derivatives[0]!.facts as any).bundleFacts.workedMinutes = 999;
    expect(approvedPunchShiftDrafts(drifted, jobs)).toEqual([]);
  });
});
