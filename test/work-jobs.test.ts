import { describe, expect, it } from "vitest";
import {
  assembleHousehold,
  calculateWorkShift,
  catalogHousehold,
  compileHousehold,
  booksEquation,
  bookBalanceAsOf,
  buildMonthBoard,
  postWorkShift,
  runHealthCheck,
  reversePostedMoney,
  reconcileWorkWeekFromEvidence,
  settleWorkReceivable,
  payDeferredWorkTipOut,
  workOwedFacts,
  workReportFacts,
  shapeWorkJob,
  splitForSync,
  takeHomeHourlyRateCents,
  trialBalance,
  upsertWorkJob,
  workJobFingerprint,
  workRateForDate,
  workShiftIsReversed,
  financialAuditFacts,
  prepareHerculesProShift,
  acceptPreparedHerculesProShift,
  commandIdentityFacts,
  sevenShiftsEvidenceMaterialHash,
  shapeSevenShiftsEvidenceBundle,
  type SevenShiftsEvidenceBundle,
  type WorkJob,
} from "../src/core/index.ts";
import { booksIntegrityFacts } from "../src/ledger/index.ts";

function job(): WorkJob {
  return shapeWorkJob({
    id: "",
    memberId: "MEM-002",
    name: "Café Nola",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: true,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [
        { id: "RATE-OLD", effectiveDate: "2026-01-01", grossHourlyRateCents: 1800, takeHomeMode: "direct", takeHomeHourlyRateCents: 1500, deductions: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "RATE-NEW", effectiveDate: "2026-09-01", grossHourlyRateCents: 2000, takeHomeMode: "deductions", takeHomeHourlyRateCents: 0, deductions: [{ id: "TAX", label: "Tax", percent: 20 }], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [
      { id: "BAR", label: "Bar", basis: "total-sales", value: 1, roundingCents: 500, roundingMode: "up", timing: "immediate", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "FLOOR", label: "Floor", basis: "card-tips", value: 2, roundingCents: 1, roundingMode: "nearest", timing: "withheld", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    salesFields: [{ id: "FOOD", label: "Food", requirement: "required", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: "ACC-CASH", cardTipsDepositAccountId: "ACC-CASH" },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
}

function evidenceBundle(householdId: string, jobId: string, revision = 1, marker = "first"): SevenShiftsEvidenceBundle {
  const evidenceId = "evi_structured_authorized_capture_0001";
  const bundle: SevenShiftsEvidenceBundle = {
    version: 1,
    provider: "7shifts",
    canonicalShiftKey: "s7shift:company-worker-punch-0001",
    providerSubjectKey: "s7subject:company-worker-0001",
    environment: "development",
    householdId,
    memberId: "MEM-002",
    jobId,
    startedAt: "2026-08-31T13:00:00.000Z",
    endedAt: "2026-08-31T17:30:00.000Z",
    workedMinutes: 240,
    paidBreakMinutes: 30,
    revision,
    state: "eligible",
    evidence: [{
      evidenceId,
      environment: "development",
      householdId,
      memberId: "MEM-002",
      sourceKind: "selected-json",
      capturedAt: "2026-09-01T00:00:00.000Z",
      observedAt: "2026-08-31T17:30:00.000Z",
      providerResourceKind: "time_punch",
      providerResourceId: "provider-punch-0001",
      providerRevision: `provider-revision-${revision}`,
      parserVersion: "d156-v1",
      schemaFingerprint: "time-punch-schema-v1",
      rawDigest: "a".repeat(64),
      finality: "approved",
      supersedesEvidenceId: null,
    }],
    observations: [
      { evidenceId, field: "date", value: "2026-08-31", unit: "date", sourcePath: "data[0].clocked_in", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "workedMinutes", value: 240, unit: "minutes", sourcePath: "data[0].worked_minutes", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "paidBreakMinutes", value: 30, unit: "minutes", sourcePath: "data[0].paid_break_minutes", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "roleId", value: "ROLE-SERVER", unit: "identifier", sourcePath: "mapping.role", confidenceBps: 10_000, finality: "approved", extraction: "human", conflict: "clear" },
      { evidenceId, field: "salesCents", value: 100_000, unit: "cad-cents", sourcePath: "report.sales", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "cashTipsCents", value: 5_000, unit: "cad-cents", sourcePath: "report.tips.cash", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "cardTipsCents", value: 10_000, unit: "cad-cents", sourcePath: "report.tips.card", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "customersServed", value: 40, unit: "count", sourcePath: "report.customers", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "staffingCount", value: 4, unit: "count", sourcePath: "report.staffing", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "captureMarker", value: marker, unit: "text", sourcePath: "schema.marker", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
    ],
    authority: {
      workedMinutesEvidenceId: evidenceId,
      paidBreakMinutesEvidenceId: evidenceId,
      cashTipsEvidenceId: evidenceId,
      cardTipsEvidenceId: evidenceId,
      finalWagesEvidenceId: null,
    },
    conflicts: [],
    materialHash: "",
  };
  bundle.materialHash = sevenShiftsEvidenceMaterialHash(bundle);
  return shapeSevenShiftsEvidenceBundle(bundle);
}

describe("job-based shift foundation", () => {
  it("prepares then accepts an eligible Hercules shift through ordinary work books, while refusing email outlook", async () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const bundle = evidenceBundle(saved.householdId, savedJob.id);
    const prepared = await prepareHerculesProShift(saved, "MEM-002", bundle, {
      salesByFieldCents: { FOOD: 100_000 },
      cashTipsCents: 5_000,
      cardTipsCents: 10_000,
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    expect(saved.shifts).toHaveLength(0);
    expect(prepared.candidate.shifts).toHaveLength(1);
    expect(prepared.preview).toMatchObject({ workedMinutes: 240, paidBreakMinutes: 30, job: "Café Nola", role: "Server" });
    expect(prepared.requiresPersonalWrite).toBe(true);
    const accepted = await acceptPreparedHerculesProShift(saved, prepared, "MEM-002", "gmail-shift-confirmation-001", "2026-09-01T01:00:00.000Z");
    expect(accepted.accepted.commandReceipts.at(-1)).toMatchObject({ commandKind: "hercules-pro-shift", confirmationId: "gmail-shift-confirmation-001" });
    expect(accepted.personalProjection?.shifts).toHaveLength(1);
    expect(accepted.accepted.booksAcceptedHash).toBeTruthy();
    expect(trialBalance(compileHousehold(accepted.accepted)).inBalance).toBe(true);

    const outlook = structuredClone(bundle);
    outlook.evidence[0]!.sourceKind = "email";
    outlook.evidence[0]!.finality = "outlook";
    outlook.observations = outlook.observations.map((row) => ({ ...row, finality: "outlook", extraction: "email" as const }));
    outlook.materialHash = sevenShiftsEvidenceMaterialHash(outlook);
    await expect(prepareHerculesProShift(saved, "MEM-002", outlook, {})).rejects.toThrow(/cannot establish worked time or money/i);
  });

  it("rejects separate legacy 7shifts punch and screenshot evidence at the money boundary", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    expect(() => postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0.5, salesByField: { FOOD: 1000 }, cashTips: 50, cardTips: 100,
      customersServed: 40, staffingCount: 4, eventTag: "regular", createdBy: "MEM-002",
      sevenShiftsEvidence: { provenanceId: "legacy-punch" },
      sevenShiftsScreenEvidence: { sourceHash: "legacy-screen" },
    })).toThrow(/cannot attach separate 7shifts punch and screenshot evidence/i);
  });

  it("binds one multi-source evidence bundle to the exact shift and all integrity surfaces", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const bundle = evidenceBundle(saved.householdId, savedJob.id);
    const input = {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0.5, startedAt: bundle.startedAt, endedAt: bundle.endedAt,
      salesByField: { FOOD: 1000 }, cashTips: 50, cardTips: 100, customersServed: 40,
      staffingCount: 4, eventTag: "regular", createdBy: "MEM-002", confirmDuplicate: true,
      sevenShiftsEvidenceBundle: bundle,
    } as const;
    const posted = postWorkShift(saved, input);
    const shift = posted.household.shifts.at(-1)!;
    expect(shift.sevenShiftsEvidenceBundle).toEqual(bundle);
    expect(JSON.stringify(financialAuditFacts(posted.household))).toContain(bundle.materialHash);
    expect(JSON.stringify(commandIdentityFacts(saved, posted.household, posted.postedIds))).toContain(bundle.materialHash);
    expect(JSON.stringify(booksIntegrityFacts(posted.household))).toContain(bundle.materialHash);
    expect(() => postWorkShift(posted.household, input)).toThrow(/already on the books/i);
    expect(() => postWorkShift(posted.household, {
      ...input,
      sevenShiftsEvidenceBundle: evidenceBundle(saved.householdId, savedJob.id, 2, "changed"),
    })).toThrow(/changed after posting/i);
    expect(() => postWorkShift(saved, { ...input, workedHours: 3.5 })).toThrow(/minutes changed after capture/i);
    const moneyAuthority = evidenceBundle(saved.householdId, savedJob.id);
    moneyAuthority.observations = moneyAuthority.observations.map((row) => row.field === "cashTipsCents" ? { ...row, value: 4200 } : row);
    moneyAuthority.materialHash = sevenShiftsEvidenceMaterialHash(moneyAuthority);
    expect(() => postWorkShift(saved, { ...input, cashTips: 420, sevenShiftsEvidenceBundle: moneyAuthority })).toThrow(/cashTipsCents changed/i);
  });

  it("requires explicit zero authority instead of turning missing evidence into zero", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const bundle = evidenceBundle(saved.householdId, savedJob.id);
    const input = {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0.5, startedAt: bundle.startedAt, endedAt: bundle.endedAt,
      salesByField: { FOOD: 1000 }, cashTips: 50, cardTips: 100, customersServed: 40,
      staffingCount: 4, eventTag: "regular", createdBy: "MEM-002", confirmDuplicate: true,
      sevenShiftsEvidenceBundle: bundle,
    } as const;
    const missingCard = structuredClone(bundle);
    missingCard.observations = missingCard.observations.filter((row) => row.field !== "cardTipsCents");
    missingCard.authority.cardTipsEvidenceId = null;
    missingCard.materialHash = sevenShiftsEvidenceMaterialHash(missingCard);
    expect(() => postWorkShift(saved, { ...input, cardTips: 0, sevenShiftsEvidenceBundle: missingCard })).toThrow(/cardTipsCents requires an explicit evidence authority/i);

    const missingBreak = structuredClone(bundle);
    missingBreak.observations = missingBreak.observations.filter((row) => row.field !== "paidBreakMinutes");
    missingBreak.authority.paidBreakMinutesEvidenceId = null;
    missingBreak.paidBreakMinutes = 0;
    missingBreak.materialHash = sevenShiftsEvidenceMaterialHash(missingBreak);
    expect(() => postWorkShift(saved, { ...input, paidBreakHours: 0, sevenShiftsEvidenceBundle: missingBreak })).toThrow(/paidBreakMinutes requires an explicit evidence authority/i);
  });

  it("requires explicit break, sales, and tip zeroes at the ordinary work boundary", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const base = {
      date: "2026-08-30", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0, salesByField: { FOOD: 0 }, cashTips: 0, cardTips: 0,
      customersServed: 0, staffingCount: 4, eventTag: "regular", createdBy: "MEM-002", confirmDuplicate: true,
    };
    expect(() => postWorkShift(saved, { ...base, paidBreakHours: undefined })).toThrow(/paid-break hours, including 0/i);
    expect(() => postWorkShift(saved, { ...base, salesByField: {} })).toThrow(/Food, including 0/i);
    expect(() => postWorkShift(saved, { ...base, cashTips: undefined })).toThrow(/cash tips, including 0/i);
    expect(() => postWorkShift(saved, { ...base, cardTips: undefined })).toThrow(/card tips, including 0/i);
    const posted = postWorkShift(saved, base);
    expect(posted.household.shifts.at(-1)).toMatchObject({ salesCents: 0, cashTipsCents: 0, ccTipsCents: 0, paidBreakHours: 0 });
  });

  it("reconciles an evidence revision as one balanced payroll-week correction", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const first = evidenceBundle(saved.householdId, savedJob.id);
    const posted = postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0.5, startedAt: first.startedAt, endedAt: first.endedAt,
      salesByField: { FOOD: 1000 }, cashTips: 50, cardTips: 100, customersServed: 40,
      staffingCount: 4, eventTag: "regular", createdBy: "MEM-002", confirmDuplicate: true,
      sevenShiftsEvidenceBundle: first,
    }).household;
    const original = posted.shifts.at(-1)!;
    const revised = evidenceBundle(saved.householdId, savedJob.id, 2, "provider-correction");
    const corrected = reconcileWorkWeekFromEvidence(posted, {
      memberId: "MEM-002", jobId: savedJob.id, payrollWeekStarts: 1, createdBy: "MEM-002",
      replacements: [{
        date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
        workedHours: 4, paidBreakHours: 0.5, startedAt: revised.startedAt, endedAt: revised.endedAt,
        salesByField: { FOOD: 1000 }, cashTips: 50, cardTips: 100, customersServed: 40,
        staffingCount: 4, eventTag: "regular", createdBy: "MEM-002", sevenShiftsEvidenceBundle: revised,
      }],
    });
    const replacement = corrected.household.shifts.find((shift) => shift.correctionOfShiftId === original.id)!;
    expect(replacement.sevenShiftsEvidenceBundle?.revision).toBe(2);
    expect(corrected.household.shifts.find((shift) => shift.id === original.id)?.correctedByShiftId).toBe(replacement.id);
    expect(workShiftIsReversed(corrected.household, original)).toBe(true);
    const correctionIdentity = JSON.stringify(commandIdentityFacts(posted, corrected.household, corrected.postedIds));
    expect(correctionIdentity).toContain(original.id);
    expect(correctionIdentity).toContain(replacement.id);
    expect(JSON.stringify(booksIntegrityFacts(corrected.household))).toContain(`"correctedByShiftId":"${replacement.id}"`);
    expect(trialBalance(compileHousehold(corrected.household)).inBalance).toBe(true);
    expect(booksEquation(compileHousehold(corrected.household)).holds).toBe(true);

    const duplicateReversal = structuredClone(corrected.household);
    const firstReversal = duplicateReversal.transactions.find((tx) => tx.reversalOfId === original.transactionIds?.[0])!;
    duplicateReversal.transactions.push({ ...firstReversal, id: `${firstReversal.id}-DUP` });
    expect(workShiftIsReversed(duplicateReversal, original)).toBe(false);
  });

  it("routes a correction to variance review after wages or card tips have been settled", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const first = evidenceBundle(saved.householdId, savedJob.id);
    const posted = postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0.5, startedAt: first.startedAt, endedAt: first.endedAt,
      salesByField: { FOOD: 1000 }, cashTips: 50, cardTips: 100, customersServed: 40,
      staffingCount: 4, eventTag: "regular", createdBy: "MEM-002", confirmDuplicate: true, sevenShiftsEvidenceBundle: first,
    }).household;
    const settled = settleWorkReceivable(posted, {
      jobId: savedJob.id, kind: "wages", date: "2026-08-31", amount: 60, accountId: "ACC-CHEQUING", createdBy: "MEM-002",
    }).household;
    const revised = evidenceBundle(saved.householdId, savedJob.id, 2, "settled-provider-correction");
    expect(() => reconcileWorkWeekFromEvidence(settled, {
      memberId: "MEM-002", jobId: savedJob.id, payrollWeekStarts: 1, createdBy: "MEM-002",
      replacements: [{
        date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
        workedHours: 4, paidBreakHours: 0.5, startedAt: revised.startedAt, endedAt: revised.endedAt,
        salesByField: { FOOD: 1000 }, cashTips: 50, cardTips: 100, customersServed: 40,
        staffingCount: 4, eventTag: "regular", createdBy: "MEM-002", sevenShiftsEvidenceBundle: revised,
      }],
    })).toThrow(/settled wage or card-tip receivable.*variance/i);
  });
  it("keeps dated role rates and calculates direct or deduction-based take-home", () => {
    const role = job().roles[0]!;
    expect(workRateForDate(role, "2026-08-31").id).toBe("RATE-OLD");
    expect(takeHomeHourlyRateCents(workRateForDate(role, "2026-08-31"))).toBe(1500);
    expect(workRateForDate(role, "2026-09-01").id).toBe("RATE-NEW");
    expect(takeHomeHourlyRateCents(workRateForDate(role, "2026-09-01"))).toBe(1600);
    expect(workJobFingerprint(job(), role.id, "2026-08-31")).not.toBe(workJobFingerprint(job(), role.id, "2026-09-01"));
  });

  it("separates paid-break income, overtime, immediate bar cash and withheld envelope tip-outs", () => {
    const result = calculateWorkShift(job(), "ROLE-SERVER", {
      date: "2026-08-31",
      workedHours: 3,
      paidBreakHours: 0.5,
      previousWeekHours: 43,
      salesCents: 100_000,
      cashTipsCents: 5_000,
      cardTipsCents: 10_000,
    });
    expect(result.regularHours).toBe(1);
    expect(result.overtimeHours).toBe(2);
    expect(result.paidBreakIncomeCents).toBe(750);
    expect(result.takeHomeWagesCents).toBe(6_750);
    expect(result.grossWagesCents).toBe(8_100);
    expect(result.immediateTipOutCents).toBe(1_000);
    expect(result.withheldTipOutCents).toBe(200);
    expect(result.cardTipsAfterTipOutCents).toBe(9_800);
    expect(result.netTipsCents).toBe(13_800);
  });

  it("adds employer-specific owed accounts without posting money and survives cloud envelope shaping", () => {
    const household = catalogHousehold();
    const beforeTransactions = household.transactions.length;
    const saved = upsertWorkJob(household, { job: job() });
    expect(saved.household.transactions).toHaveLength(beforeTransactions);
    expect(saved.household.workJobs).toHaveLength(1);
    const savedJob = saved.household.workJobs[0]!;
    expect(savedJob.wagesReceivableAccountId).toBeTruthy();
    expect(savedJob.cardTipsReceivableAccountId).toBeTruthy();
    expect(saved.household.accounts.find((account) => account.id === savedJob.wagesReceivableAccountId)?.kind).toBe("receivable");
    expect(saved.household.accounts.find((account) => account.id === savedJob.cardTipsReceivableAccountId)?.kind).toBe("receivable");

    const envelopes = splitForSync(saved.household, "MEM-002");
    const assembled = assembleHousehold(envelopes.shared, envelopes.personal);
    expect(assembled.workJobs[0]?.name).toBe("Café Nola");
    expect(assembled.workJobs[0]?.roles[0]?.rates).toHaveLength(2);
  });

  it("confirms one job shift into separate owed, cash-tip, card-tip, paid-break, and tip-out entries", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-08-31",
      memberId: "MEM-002",
      jobId: savedJob.id,
      roleId: "ROLE-SERVER",
      workedHours: 3,
      paidBreakHours: 0.5,
      salesByField: { FOOD: 1000 },
      cashTips: 50,
      cardTips: 100,
      cashTipsAccountId: "ACC-CASH",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    const shift = posted.household.shifts.at(-1)!;
    expect(shift.jobId).toBe(savedJob.id);
    expect(shift.grossWagesCents).toBe(6_300);
    expect(shift.wagesCents).toBe(5_250);
    expect(shift.transactionIds).toHaveLength(6);
    expect(posted.household.transactions.find((tx) => tx.id === shift.cashTipsTransactionId)?.accountId).toBe("ACC-CASH");
    expect(posted.household.transactions.find((tx) => tx.id === shift.cardTipsTransactionId)?.accountId).toBe(savedJob.cardTipsReceivableAccountId);
    expect(posted.household.transactions.find((tx) => tx.id === shift.paidBreakTransactionId)?.subcategoryId).toBe("SUB-INCOME-PAID-BREAKS");
    expect(shift.tipOutTransactionIds).toHaveLength(2);
    const books = compileHousehold(posted.household);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(booksEquation(books).holds).toBe(true);
    expect(runHealthCheck(posted.household)).toEqual([]);
  });

  it("stamps optional location and occurredAt onto every work-shift money row", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const occurredAt = "2026-08-31T17:15:00-04:00";
    const posted = postWorkShift(saved, {
      date: "2026-08-31",
      memberId: "MEM-002",
      jobId: savedJob.id,
      roleId: "ROLE-SERVER",
      workedHours: 5,
      paidBreakHours: 0,
      salesByField: { FOOD: 800 },
      cashTips: 40,
      cardTips: 90,
      cashTipsAccountId: "ACC-CASH",
      occurredAt,
      location: {
        latitude: 43.6408,
        longitude: -79.3771,
        accuracyMeters: 12,
        capturedAt: "2026-08-31T21:15:00.000Z",
        label: "Harbourfront Centre, Toronto",
      },
      confirmDuplicate: true,
      createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    const shift = posted.household.shifts.at(-1)!;
    const stamped = posted.household.transactions.filter((tx) => shift.transactionIds?.includes(tx.id));
    expect(stamped.length).toBeGreaterThan(0);
    expect(stamped.every((tx) => tx.location?.label === "Harbourfront Centre, Toronto")).toBe(true);
    expect(stamped.every((tx) => tx.occurredAt === new Date(occurredAt).toISOString())).toBe(true);
  });

  it("corrects a job shift by reversing every component instead of deleting the shift", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0, salesByField: { FOOD: 500 }, cashTips: 25, cardTips: 75,
      cashTipsAccountId: "ACC-CASH", confirmDuplicate: true, createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    const shift = posted.household.shifts.at(-1)!;
    const reversed = reversePostedMoney(posted.household, shift.transactionIds![0]!, { createdBy: "MEM-002" });
    expect(reversed.household.shifts.some((row) => row.id === shift.id)).toBe(true);
    for (const id of shift.transactionIds!) expect(reversed.household.transactions.some((tx) => tx.reversalOfId === id)).toBe(true);
    const books = compileHousehold(reversed.household);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(booksEquation(books).holds).toBe(true);
    expect(workReportFacts(reversed.household, "MEM-002", "2026-08-01", "2026-08-31").count).toBe(0);
    expect(buildMonthBoard(reversed.household, "2026-08", "2026-08-31").days.flatMap((day) => day.items).some((item) => item.id === `shift:${shift.id}`)).toBe(false);
  });

  it("projects owed pay on Calendar and settles it as a transfer without recognizing income twice", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0, salesByField: { FOOD: 500 }, cashTips: 25, cardTips: 75,
      cashTipsAccountId: "ACC-CASH", confirmDuplicate: true, createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    }).household;
    const facts = workOwedFacts(posted, "2026-08-31", "MEM-002");
    const wages = facts.find((fact) => fact.kind === "wages")!;
    const board = buildMonthBoard(posted, wages.date.slice(0, 7), "2026-08-31");
    expect(board.days.flatMap((day) => day.items).some((item) => item.id === wages.id && item.kind === "work-pay")).toBe(true);
    const incomeBefore = booksEquation(compileHousehold(posted)).incomeCents;
    const settled = settleWorkReceivable(posted, {
      jobId: savedJob.id, kind: "wages", date: "2026-08-31", amount: wages.amountCents / 100,
      accountId: "ACC-CHEQUING", createdBy: "MEM-002",
    }).household;
    expect(bookBalanceAsOf(settled, savedJob.wagesReceivableAccountId, "2026-08-31")).toBe(0);
    expect(booksEquation(compileHousehold(settled)).incomeCents).toBe(incomeBefore);
  });

  it("keeps deferred tip-outs open until a worker confirms payment", () => {
    const deferredJob = job();
    deferredJob.tipOutRules = deferredJob.tipOutRules.map((rule) => rule.id === "BAR" ? { ...rule, timing: "deferred" } : rule);
    const saved = upsertWorkJob(catalogHousehold(), { job: deferredJob }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, paidBreakHours: 0, salesByField: { FOOD: 500 }, cashTips: 25, cardTips: 75,
      cashTipsAccountId: "ACC-CASH", confirmDuplicate: true, createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    }).household;
    const waiting = workOwedFacts(posted, "2026-08-31", "MEM-002").find((fact) => fact.kind === "deferred-tipout")!;
    expect(waiting.amountCents).toBe(500);
    const reversed = reversePostedMoney(posted, posted.shifts.at(-1)!.transactionIds![0]!, { createdBy: "MEM-002" }).household;
    expect(workOwedFacts(reversed, "2026-08-31", "MEM-002").some((fact) => fact.kind === "deferred-tipout")).toBe(false);
    const paid = payDeferredWorkTipOut(posted, {
      jobId: savedJob.id, date: "2026-08-31", amount: 5, accountId: "ACC-CASH", createdBy: "MEM-002",
    }).household;
    expect(workOwedFacts(paid, "2026-08-31", "MEM-002").some((fact) => fact.kind === "deferred-tipout")).toBe(false);
    expect(paid.shifts.at(-1)?.deferredTipOutPaidCents).toBe(500);
    expect(runHealthCheck(paid)).toEqual([]);
  });
});
