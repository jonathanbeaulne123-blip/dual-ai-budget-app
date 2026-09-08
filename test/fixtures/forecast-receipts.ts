import { addAccount, addRecurrence, catalogHousehold, configureHouseholdFund, postWorkShiftWithAttendanceReview, refreshShiftEnvelopesFromEvidence, shapeWorkJob, upsertWorkJob, type Household, type WorkJob, type ShiftEnvelopeEvidenceProposal } from "../../src/core/index.ts";
const MEMBER = "MEM-002";
/** Fictional permanent receipts built through the real attendance/posting commands. */
export function forecastJob(accountId: string): WorkJob {
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
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: accountId, cardTipsDepositAccountId: accountId },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
}
export function postForecastFixtureShift(h: Household, jobId: string, date: string, index: number, channel: "cash" | "card" | "mixed") {
  const j = h.workJobs.find(row => row.id === jobId)!;
  const proposal: ShiftEnvelopeEvidenceProposal = {canonicalShiftKey: `s7shift_${index.toString(16).padStart(64,"0")}`, kind: "worked-shift", jobId, roleId: "ROLE-SERVER", date, startedAt: `${date}T20:00:00.000Z`, endedAt: `${date}T23:00:00.000Z`, workedMinutes: 180, paidBreakMinutes: 0, unpaidBreakMinutes: 0, observedAt: `${date}T23:30:00.000Z`, finality: "approved", source: "seven_shifts_timesheet"};
  const mail = refreshShiftEnvelopesFromEvidence(h, {memberId: MEMBER, createdBy: MEMBER, proposals: [proposal]}).household;
  const envelope = mail.shiftEnvelopes!.find(row => row.canonicalShiftKey === proposal.canonicalShiftKey)!;
  return postWorkShiftWithAttendanceReview(mail, {date, memberId: MEMBER, jobId, roleId: "ROLE-SERVER", workedHours: "3", paidBreakHours: "0", startedAt: envelope.actualStart!, endedAt: envelope.actualEnd!, shiftEnvelopeId: envelope.id, shiftBibleDraft: {envelopeId: envelope.id, unpaidBreakMinutes: 0, approvalState: "approved", authority: envelope.authority}, confirmationId: `forecast-fixture-${index}`, sales: "1000", salesByField: {FOOD: "1000"}, cashTips: channel === "card" ? "0" : String(100 + index*4), cardTips: channel === "cash" ? "0" : String(index === 1 ? 184 : 180 + index*5), customersServed: 40, staffingCount: 4, eventTag: "regular", cashTipsAccountId: j.defaults.cashTipsAccountId, wagesDepositAccountId: j.defaults.wagesDepositAccountId, cardTipsDepositAccountId: j.defaults.cardTipsDepositAccountId, createdBy: MEMBER}, null).household;
}
export function forecastReceiptHousehold(channel: "cash" | "card" = "cash", count = 8) {
  const configured = configureHouseholdFund(catalogHousehold(), {custodianMemberId: "MEM-001", openedOn: "2026-01-01", createdBy: "MEM-001"}).household;
  const added = addAccount(configured, {name: "Own cash", kind: "other", scope: "personal", ownerMemberId: MEMBER});
  const j = forecastJob(added.postedIds[0]!);
  j.tipOutRules = channel === "cash" ? [j.tipOutRules[0]!] : [{...j.tipOutRules[1]!, value: 15}];
  let h = upsertWorkJob(added.household, {job: j}).household;
  h = addRecurrence(h, {cadence: "monthly", nextDate: "2026-09-30", type: "expense", amount: "500", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", fundingDefault: {fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA"}}).household;
  const dates = ["2026-08-07", "2026-08-08", "2026-08-14", "2026-08-15", "2026-08-21", "2026-08-22", "2026-08-28", "2026-08-29"];
  for (let index = 0; index < count; index++) h = postForecastFixtureShift(h, h.workJobs[0]!.id, dates[index]!, index + 1, channel);
  return h;
}
