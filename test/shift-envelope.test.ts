import { describe, expect, it } from "vitest";
import {
  confirmShiftEnvelopeOutcome,
  appendShiftBibleWeather,
  assembleHousehold,
  refreshShiftEnvelopesFromEvidence,
  seedDemoHousehold,
  splitForSync,
  householdForAiDisclosure,
  postWorkShiftWithAttendanceReview,
  observeTipShifts,
  statusForEnvelopeAt,
  undoLedgerConfirm,
  beginShiftBibleCorrection,
  workShiftTransactionIds,
  type ShiftEnvelopeEvidenceProposal,
} from "../src/core/index.ts";
import { evidenceEnvelopeProposals } from "../src/imports/evidenceEnvelopeDraft.ts";

function proposal(overrides: Partial<ShiftEnvelopeEvidenceProposal> = {}): ShiftEnvelopeEvidenceProposal {
  return {
    canonicalShiftKey: `s7shift_${"a".repeat(64)}`,
    kind: "coworker-schedule",
    jobId: "",
    roleId: "",
    date: "2026-08-29",
    startedAt: "2026-08-29T20:30:00.000Z",
    endedAt: "2026-08-30T02:30:00.000Z",
    workedMinutes: null,
    paidBreakMinutes: null,
    unpaidBreakMinutes: null,
    observedAt: "2026-08-29T12:00:00.000Z",
    finality: "outlook",
    source: "seven_shifts_schedule",
    ...overrides,
  };
}

describe("D-172 autonomous Shift envelope", () => {
  it("creates schedule mail, advances to awaiting punch, and overlays approved worked facts without posting money", () => {
    const base = seedDemoHousehold({ today: "2026-08-29", environment: "development" });
    const job = base.workJobs.find((row) => row.memberId === "MEM-002")!;
    const scheduled = refreshShiftEnvelopesFromEvidence(base, {
      memberId: "MEM-002", createdBy: "MEM-002",
      proposals: [proposal({ jobId: job.id, roleId: job.roles[0]!.id })],
    });
    expect(scheduled.household.transactions).toEqual(base.transactions);
    expect(scheduled.household.shiftEnvelopes).toMatchObject([{ status: "upcoming", actualStart: null, workedMinutes: null }]);
    expect(splitForSync(scheduled.household, "MEM-002").personal.shiftEnvelopes).toHaveLength(1);
    expect("shiftEnvelopes" in splitForSync(scheduled.household, "MEM-002").shared).toBe(false);
    expect(householdForAiDisclosure(scheduled.household, "MEM-002").shiftEnvelopes).toEqual([]);
    expect(statusForEnvelopeAt(scheduled.household.shiftEnvelopes![0]!, new Date("2026-08-30T03:00:00.000Z"))).toBe("awaiting_punch");

    const worked = refreshShiftEnvelopesFromEvidence(scheduled.household, {
      memberId: "MEM-002", createdBy: "MEM-002",
      proposals: [proposal({
        canonicalShiftKey: `s7shift_${"b".repeat(64)}`, kind: "worked-shift", jobId: job.id, roleId: job.roles[0]!.id,
        startedAt: "2026-08-29T20:37:00.000Z", endedAt: "2026-08-30T02:22:00.000Z", workedMinutes: 330,
        paidBreakMinutes: 15, unpaidBreakMinutes: 0, observedAt: "2026-08-30T03:10:00.000Z", finality: "approved", source: "seven_shifts_timesheet",
      })],
    });
    expect(worked.household.transactions).toEqual(base.transactions);
    expect(worked.household.shiftEnvelopes).toMatchObject([{ status: "worked_ready", workedMinutes: 330, paidBreakMinutes: 15, unpaidBreakMinutes: 0, approvalState: "approved" }]);
    expect(worked.household.shiftEnvelopes![0]!.authority).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "paidBreakMinutes", presence: "present" }),
      expect.objectContaining({ field: "unpaidBreakMinutes", presence: "explicit_zero" }),
    ]));
  });

  it("treats an omission from an explicit complete website week as cut and confirms it without journal money", () => {
    const base = seedDemoHousehold({ today: "2026-08-29", environment: "development" });
    const job = base.workJobs.find((row) => row.memberId === "MEM-002")!;
    const first = refreshShiftEnvelopesFromEvidence(base, { memberId: "MEM-002", createdBy: "MEM-002", proposals: [proposal({ jobId: job.id, roleId: job.roles[0]!.id })] });
    const cut = refreshShiftEnvelopesFromEvidence(first.household, {
      memberId: "MEM-002", createdBy: "MEM-002",
      proposals: [proposal({
        canonicalShiftKey: `s7shift_${"c".repeat(64)}`, kind: "schedule-window", jobId: job.id, roleId: job.roles[0]!.id,
        observedAt: "2026-08-29T13:00:00.000Z", completeRange: { startDate: "2026-08-24", endDate: "2026-08-30" },
      })],
    });
    expect(cut.household.shiftEnvelopes![0]!.status).toBe("cut");
    const confirmed = confirmShiftEnvelopeOutcome(cut.household, {
      memberId: "MEM-002", envelopeId: cut.household.shiftEnvelopes![0]!.id, outcome: "cut",
      confirmationId: "confirm-shift-outcome-0001", createdBy: "MEM-002",
    });
    expect(confirmed.household.transactions).toEqual(base.transactions);
    expect(confirmed.household.shiftBibles).toMatchObject([{ outcome: "cut", linkedShiftId: null, workedMinutes: null }]);
  });

  it("accepts only server-mapped derivatives and preserves explicit zero versus missing break facts", () => {
    const details = [{
      evidenceId: "evi_test_00000000000000000000", revision: 1, state: "ready_to_review", parserVersion: "evidence-v1", schemaFingerprint: "x",
      derivatives: [{ canonicalShiftKey: `s7shift_${"d".repeat(64)}`, parserVersion: "evidence-v1", schemaFingerprint: "x", createdAt: "2026-08-30T03:00:00.000Z", facts: { mappingState: "mapped", bundleFacts: {
        canonicalShiftKey: `s7shift_${"d".repeat(64)}`, jobId: "JOB-001", startedAt: "2026-08-29T20:30:00.000Z", endedAt: "2026-08-30T02:30:00.000Z",
        workedMinutes: 345, paidBreakMinutes: null, observedAt: "2026-08-30T03:00:00.000Z", providerResourceKind: "worked-shift", sourceKind: "browser-structured", finality: "approved",
      } } }],
      observations: [
        { observationId: "o1", canonicalShiftKey: `s7shift_${"d".repeat(64)}`, field: "roleId", value: "ROLE-001", unit: "identifier", sourceLocation: "mapping", confidenceBps: 10000, finality: "approved", extractionMethod: "human", conflictState: "clear", createdAt: "2026-08-30T03:00:00.000Z" },
        { observationId: "o2", canonicalShiftKey: `s7shift_${"d".repeat(64)}`, field: "unpaidBreakMinutes", value: 0, unit: "minutes", sourceLocation: "breaks", confidenceBps: 10000, finality: "approved", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-30T03:00:00.000Z" },
      ], schemaDrift: [],
    }];
    expect(evidenceEnvelopeProposals(details)).toMatchObject([{ paidBreakMinutes: null, unpaidBreakMinutes: 0, finality: "approved" }]);
    expect(evidenceEnvelopeProposals([{ ...details[0]!, derivatives: details[0]!.derivatives.map((row) => ({ ...row, facts: { ...(row.facts as object), mappingState: "unmapped" } })) }])).toEqual([]);
  });

  it("seals the permanent worked Bible only through the ordinary visible Shift command and feeds Tip Science from it", () => {
    const base = seedDemoHousehold({ today: "2026-08-29", environment: "development" });
    const job = base.workJobs.find((row) => row.memberId === "MEM-001" && row.active)!;
    const role = job.roles.find((row) => row.active)!;
    const mail = refreshShiftEnvelopesFromEvidence(base, { memberId: "MEM-001", createdBy: "MEM-001", proposals: [proposal({
      canonicalShiftKey: `s7shift_${"e".repeat(64)}`, kind: "worked-shift", jobId: job.id, roleId: role.id,
      startedAt: "2026-08-29T20:30:00.000Z", endedAt: "2026-08-30T02:30:00.000Z", workedMinutes: 345,
      paidBreakMinutes: 15, unpaidBreakMinutes: 0, observedAt: "2026-08-30T03:00:00.000Z", finality: "approved", source: "seven_shifts_timesheet",
    })] });
    const envelope = mail.household.shiftEnvelopes![0]!;
    const posted = postWorkShiftWithAttendanceReview(mail.household, {
      date: "2026-08-29", memberId: "MEM-001", jobId: job.id, roleId: role.id, workedHours: "5.75", paidBreakHours: "0.25",
      startedAt: envelope.actualStart!, endedAt: envelope.actualEnd!, shiftEnvelopeId: envelope.id,
      shiftBibleDraft: { envelopeId: envelope.id, unpaidBreakMinutes: 0, approvalState: "approved", authority: envelope.authority },
      confirmationId: "confirm-shift-bible-0001", sales: "250", salesByField: { [job.salesFields[0]!.id]: "250" },
      cashTips: "40", cardTips: "55", customersServed: 28, staffingCount: 4, eventTag: "regular",
      cashTipsAccountId: job.defaults.cashTipsAccountId, wagesDepositAccountId: job.defaults.wagesDepositAccountId,
      cardTipsDepositAccountId: job.defaults.cardTipsDepositAccountId, createdBy: "MEM-001",
      wagesVisibility: "household",
    }, null);
    const shift = posted.household.shifts.find((row) => row.shiftBible?.envelopeId === envelope.id)!;
    expect(shift.shiftBible).toMatchObject({ outcome: "worked", workedMinutes: 345, paidBreakMinutes: 15, unpaidBreakMinutes: 0, cashTipsCents: 4000, cardTipsCents: 5500, linkedShiftId: shift.id });
    expect(shift.shiftBible?.materialHash).toMatch(/^bible_/);
    expect(posted.household.shiftEnvelopes![0]).toMatchObject({ status: "confirmed", confirmedBibleId: shift.shiftBible!.id });
    expect(observeTipShifts(posted.household, "MEM-001").find((row) => row.shiftId === shift.id)).toMatchObject({ hours: 5.75, salesCents: 25000, customersServed: 28, staffingCount: 4 });
    const weathered = appendShiftBibleWeather(posted.household, { memberId: "MEM-001", bibleId: shift.shiftBible!.id, createdBy: "MEM-001", weather: {
      state: "complete", source: "open-meteo-historical", latitudeRounded: 43.65, longitudeRounded: -79.38,
      intervalStartedAt: shift.shiftBible!.actualStart!, intervalEndedAt: shift.shiftBible!.actualEnd!, midpointTemperatureCelsius: 21,
      apparentTemperatureCelsius: 22, precipitationMm: 0, weatherCode: 1, windKph: 9, fetchedAt: "2026-08-30T04:00:00.000Z",
    } });
    const revisedBible = weathered.household.shifts.find((row) => row.id === shift.id)!.shiftBible!;
    expect(revisedBible).toMatchObject({ revision: 2, revisionHistory: [{ revision: 1, materialHash: shift.shiftBible!.materialHash }] });
    const replicas = splitForSync(weathered.household, "MEM-001");
    expect(replicas.shared.shifts.find((row) => row.id === shift.id)?.shiftBible).toBeUndefined();
    expect(replicas.personal.shiftBibles).toEqual(expect.arrayContaining([expect.objectContaining({ id: shift.shiftBible!.id })]));
    expect(assembleHousehold(replicas.shared, replicas.personal).shifts.find((row) => row.id === shift.id)?.shiftBible?.id).toBe(shift.shiftBible!.id);
    const undone = undoLedgerConfirm(weathered.household, posted.undo);
    expect(undone.household.shifts.some((row) => row.id === shift.id)).toBe(false);
    expect(undone.household.shiftEnvelopes?.find((row) => row.id === envelope.id)).toMatchObject({ status: "worked_ready", confirmedBibleId: null });
    const correctedEvidence = refreshShiftEnvelopesFromEvidence(weathered.household, { memberId: "MEM-001", createdBy: "MEM-001", proposals: [proposal({
      canonicalShiftKey: envelope.canonicalShiftKey, kind: "worked-shift", jobId: job.id, roleId: role.id,
      startedAt: envelope.actualStart!, endedAt: "2026-08-30T02:45:00.000Z", workedMinutes: 360,
      paidBreakMinutes: 15, unpaidBreakMinutes: 0, observedAt: "2026-08-31T03:00:00.000Z", finality: "final", source: "seven_shifts_timesheet",
    })] });
    expect(correctedEvidence.household.shiftEnvelopes![0]).toMatchObject({ status: "needs_review", confirmedBibleId: shift.shiftBible!.id });
    expect(() => postWorkShiftWithAttendanceReview(correctedEvidence.household, {
      date: "2026-08-29", memberId: "MEM-001", jobId: job.id, roleId: role.id, workedHours: "6", paidBreakHours: "0.25",
      startedAt: envelope.actualStart!, endedAt: "2026-08-30T02:45:00.000Z", shiftEnvelopeId: envelope.id,
      shiftBibleDraft: { envelopeId: envelope.id, unpaidBreakMinutes: 0 }, confirmationId: "confirm-must-correct-0001",
      sales: "250", cashTips: "40", cardTips: "55", customersServed: 28, staffingCount: 4, eventTag: "regular",
      confirmDuplicate: true, createdBy: "MEM-001",
    }, null)).toThrow(/worked-ready/i);
    const correction = beginShiftBibleCorrection(correctedEvidence.household, workShiftTransactionIds(shift)[0]!, { createdBy: "MEM-001" });
    const reopened = correction.household.shiftEnvelopes!.find((row) => row.id === envelope.id)!;
    expect(reopened).toMatchObject({ status: "worked_ready", confirmedBibleId: shift.shiftBible!.id });
    const replacement = postWorkShiftWithAttendanceReview(correction.household, {
      date: "2026-08-29", memberId: "MEM-001", jobId: job.id, roleId: role.id, workedHours: "6", paidBreakHours: "0.25",
      startedAt: reopened.actualStart!, endedAt: reopened.actualEnd!, shiftEnvelopeId: reopened.id,
      shiftBibleDraft: { envelopeId: reopened.id, unpaidBreakMinutes: 0, correctionOfBibleId: shift.shiftBible!.id, authority: reopened.authority },
      confirmationId: "confirm-corrected-bible-0001", sales: "260", salesByField: { [job.salesFields[0]!.id]: "260" },
      cashTips: "42", cardTips: "57", customersServed: 30, staffingCount: 4, eventTag: "regular", confirmDuplicate: true,
      cashTipsAccountId: job.defaults.cashTipsAccountId, wagesDepositAccountId: job.defaults.wagesDepositAccountId,
      cardTipsDepositAccountId: job.defaults.cardTipsDepositAccountId, createdBy: "MEM-001",
    }, null);
    const old = replacement.household.shifts.find((row) => row.id === shift.id)!;
    const nextShift = replacement.household.shifts.find((row) => row.correctionOfShiftId === shift.id)!;
    expect(old.shiftBible?.correctedByBibleId).toBe(nextShift.shiftBible?.id);
    expect(nextShift.shiftBible?.correctionOfBibleId).toBe(shift.shiftBible!.id);
  });

  it("quarantines provisional worked facts and preserves missing financial fields instead of turning them into zero", () => {
    const base = seedDemoHousehold({ today: "2026-08-29", environment: "development" });
    const jobIndex = base.workJobs.findIndex((row) => row.memberId === "MEM-001" && row.active);
    const roleId = base.workJobs[jobIndex]!.roles.find((row) => row.active)!.id;
    base.workJobs[jobIndex] = { ...base.workJobs[jobIndex]!, roles: base.workJobs[jobIndex]!.roles.map((role) => role.id === roleId ? { ...role, tipped: false } : role) };
    const job = base.workJobs[jobIndex]!;
    const provisional = refreshShiftEnvelopesFromEvidence(base, { memberId: "MEM-001", createdBy: "MEM-001", proposals: [proposal({
      canonicalShiftKey: `s7shift_${"f".repeat(64)}`, kind: "worked-shift", jobId: job.id, roleId,
      date: "2026-09-01", startedAt: "2026-09-01T20:00:00.000Z", endedAt: "2026-09-02T01:00:00.000Z",
      workedMinutes: 300, paidBreakMinutes: 0, unpaidBreakMinutes: 0, finality: "provisional", source: "seven_shifts_punch",
    })] });
    expect(provisional.household.shiftEnvelopes![0]!.status).toBe("needs_review");
    const final = refreshShiftEnvelopesFromEvidence(provisional.household, { memberId: "MEM-001", createdBy: "MEM-001", proposals: [proposal({
      canonicalShiftKey: `s7shift_${"f".repeat(64)}`, kind: "worked-shift", jobId: job.id, roleId,
      date: "2026-09-01", startedAt: "2026-09-01T20:00:00.000Z", endedAt: "2026-09-02T01:00:00.000Z",
      workedMinutes: 300, paidBreakMinutes: 0, unpaidBreakMinutes: 0, observedAt: "2026-09-02T02:00:00.000Z", finality: "approved", source: "seven_shifts_timesheet",
    })] });
    const envelope = final.household.shiftEnvelopes![0]!;
    const posted = postWorkShiftWithAttendanceReview(final.household, {
      date: "2026-09-01", memberId: "MEM-001", jobId: job.id, roleId, workedHours: "5", paidBreakHours: "0",
      startedAt: envelope.actualStart!, endedAt: envelope.actualEnd!, shiftEnvelopeId: envelope.id,
      shiftBibleDraft: { envelopeId: envelope.id, unpaidBreakMinutes: 0, authority: envelope.authority }, confirmationId: "confirm-missing-fields-0001",
      wagesDepositAccountId: job.defaults.wagesDepositAccountId, createdBy: "MEM-001",
    }, null);
    const bible = posted.household.shifts.find((row) => row.shiftBible?.envelopeId === envelope.id)!.shiftBible!;
    expect(bible).toMatchObject({ cashTipsCents: null, cardTipsCents: null, salesCents: null, customersServed: null, staffingCount: null });
    expect(bible.authority).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "salesCents", presence: "missing" }),
      expect.objectContaining({ field: "cashTipsCents", presence: "missing" }),
    ]));
  });
});
