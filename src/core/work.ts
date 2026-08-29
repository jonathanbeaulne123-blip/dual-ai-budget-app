import { isValidDateKey, TIMEZONE, type DateKey } from "./calendar.ts";
import { roundToCents } from "./money.ts";
import type {
  WorkDeductionRule,
  WorkJob,
  WorkPaySchedule,
  WorkRatePeriod,
  WorkRole,
  WorkSalesField,
  WorkTipOutRule,
  Household,
  Shift,
  Transaction,
  Visibility,
} from "./types.ts";
import { ValidationError } from "./types.ts";

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const EPOCH_DATE = "1970-01-01" as DateKey;

function finite(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cents(value: unknown, fallback = 0): number {
  return Math.max(0, Math.round(finite(value, fallback)));
}

function percentage(value: unknown, fallback = 0): number {
  return Math.min(100, Math.max(0, Math.round(finite(value, fallback) * 100) / 100));
}

function visibility(value: unknown, fallback: Visibility): Visibility {
  return value === "personal" || value === "both" || value === "household" ? value : fallback;
}

export function defaultWorkSchedule(anchorDate: DateKey = EPOCH_DATE): WorkPaySchedule {
  return {
    cadence: "biweekly",
    anchorDate,
    weekday: 5,
    monthDays: [15, 30],
    customDates: [],
    reminderTime: "09:00",
  };
}

function shapeSchedule(input: Partial<WorkPaySchedule> | null | undefined, fallbackDate: DateKey): WorkPaySchedule {
  const cadence = input?.cadence === "weekly" || input?.cadence === "twice-monthly" || input?.cadence === "custom"
    ? input.cadence
    : "biweekly";
  const anchorDate = input?.anchorDate && isValidDateKey(input.anchorDate) ? input.anchorDate : fallbackDate;
  const monthDays = [...new Set((input?.monthDays ?? [15, 30]).map((day) => Math.min(31, Math.max(1, Math.round(day)))))]
    .sort((left, right) => left - right)
    .slice(0, 4);
  const customDates = [...new Set((input?.customDates ?? []).filter(isValidDateKey))].sort();
  const reminderTime = /^\d{2}:\d{2}$/.test(input?.reminderTime ?? "") ? input!.reminderTime : "09:00";
  return {
    cadence,
    anchorDate,
    weekday: Math.min(6, Math.max(0, Math.round(finite(input?.weekday, 5)))),
    monthDays: monthDays.length ? monthDays : [15, 30],
    customDates,
    reminderTime: reminderTime || "09:00",
  };
}

function shapeDeductions(list: WorkDeductionRule[] | null | undefined): WorkDeductionRule[] {
  const byId = new Map<string, WorkDeductionRule>();
  for (const [index, row] of (list ?? []).entries()) {
    const label = String(row?.label || "Deduction").trim().slice(0, 40) || "Deduction";
    const id = String(row?.id || `DEDUCTION-${index + 1}`);
    byId.set(id, { id, label, percent: percentage(row?.percent) });
  }
  return [...byId.values()].slice(0, 12);
}

function shapeRates(list: WorkRatePeriod[] | null | undefined, fallbackIso: string): WorkRatePeriod[] {
  const byDate = new Map<string, WorkRatePeriod>();
  for (const [index, row] of (list ?? []).entries()) {
    const effectiveDate = row?.effectiveDate && isValidDateKey(row.effectiveDate) ? row.effectiveDate : EPOCH_DATE;
    const createdAt = row?.createdAt || fallbackIso;
    const shaped: WorkRatePeriod = {
      id: String(row?.id || `RATE-${effectiveDate}-${index + 1}`),
      effectiveDate,
      grossHourlyRateCents: cents(row?.grossHourlyRateCents),
      takeHomeMode: row?.takeHomeMode === "deductions" ? "deductions" : "direct",
      takeHomeHourlyRateCents: cents(row?.takeHomeHourlyRateCents),
      deductions: shapeDeductions(row?.deductions),
      createdAt,
      updatedAt: row?.updatedAt || createdAt,
    };
    const existing = byDate.get(effectiveDate);
    if (!existing || shaped.updatedAt >= existing.updatedAt) byDate.set(effectiveDate, shaped);
  }
  return [...byDate.values()].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
}

function shapeRoles(list: WorkRole[] | null | undefined, fallbackIso: string): WorkRole[] {
  const byId = new Map<string, WorkRole>();
  for (const [index, row] of (list ?? []).entries()) {
    const id = String(row?.id || `ROLE-${index + 1}`);
    const createdAt = row?.createdAt || fallbackIso;
    const rates = shapeRates(row?.rates, fallbackIso);
    byId.set(id, {
      id,
      name: String(row?.name || "Role").trim().slice(0, 40) || "Role",
      tipped: row?.tipped !== false,
      active: row?.active !== false,
      rates: rates.length ? rates : shapeRates([{
        id: `RATE-${id}-LEGACY`,
        effectiveDate: EPOCH_DATE,
        grossHourlyRateCents: 0,
        takeHomeMode: "direct",
        takeHomeHourlyRateCents: 0,
        deductions: [],
        createdAt,
        updatedAt: createdAt,
      }], fallbackIso),
      createdAt,
      updatedAt: row?.updatedAt || createdAt,
    });
  }
  return [...byId.values()];
}

function shapeTipOutRules(list: WorkTipOutRule[] | null | undefined, fallbackIso: string): WorkTipOutRule[] {
  const byId = new Map<string, WorkTipOutRule>();
  const bases = new Set(["total-sales", "card-tips", "all-tips", "fixed-shift", "fixed-hour", "manual"]);
  for (const [index, row] of (list ?? []).entries()) {
    const id = String(row?.id || `TIPOUT-${index + 1}`);
    const createdAt = row?.createdAt || fallbackIso;
    byId.set(id, {
      id,
      label: String(row?.label || "Tip-out").trim().slice(0, 40) || "Tip-out",
      basis: bases.has(row?.basis) ? row.basis : "total-sales",
      value: Math.max(0, finite(row?.value, 0)),
      roundingCents: cents(row?.roundingCents),
      roundingMode: row?.roundingMode === "up" || row?.roundingMode === "down" ? row.roundingMode : "nearest",
      timing: row?.timing === "immediate" || row?.timing === "deferred" ? row.timing : "withheld",
      active: row?.active !== false,
      createdAt,
      updatedAt: row?.updatedAt || createdAt,
    });
  }
  return [...byId.values()];
}

function shapeSalesFields(list: WorkSalesField[] | null | undefined, fallbackIso: string): WorkSalesField[] {
  const byId = new Map<string, WorkSalesField>();
  for (const [index, row] of (list ?? []).entries()) {
    const id = String(row?.id || `SALES-${index + 1}`);
    const createdAt = row?.createdAt || fallbackIso;
    byId.set(id, {
      id,
      label: String(row?.label || "Sales").trim().slice(0, 40) || "Sales",
      requirement: row?.requirement === "required" || row?.requirement === "optional" ? row.requirement : "off",
      createdAt,
      updatedAt: row?.updatedAt || createdAt,
    });
  }
  return [...byId.values()];
}

export function shapeWorkJob(input: WorkJob, fallbackIso = EPOCH_ISO): WorkJob {
  const createdAt = input?.createdAt || fallbackIso;
  const roles = shapeRoles(input?.roles, fallbackIso);
  const anchor = roles.flatMap((role) => role.rates).map((rate) => rate.effectiveDate).sort()[0] ?? EPOCH_DATE;
  return {
    id: String(input?.id || "JOB-1"),
    memberId: String(input?.memberId || ""),
    name: String(input?.name || "Job").trim().slice(0, 60) || "Job",
    color: /^#[0-9a-f]{6}$/i.test(input?.color || "") ? input.color : "#a85a3d",
    active: input?.active !== false,
    timezone: String(input?.timezone || TIMEZONE).slice(0, 64),
    locationName: String(input?.locationName || "").trim().slice(0, 80),
    gpsEnabled: Boolean(input?.gpsEnabled),
    locationLatitude: typeof input?.locationLatitude === "number" && Number.isFinite(input.locationLatitude) && input.locationLatitude >= -90 && input.locationLatitude <= 90
      ? Math.round(input.locationLatitude * 100) / 100
      : null,
    locationLongitude: typeof input?.locationLongitude === "number" && Number.isFinite(input.locationLongitude) && input.locationLongitude >= -180 && input.locationLongitude <= 180
      ? Math.round(input.locationLongitude * 100) / 100
      : null,
    roles,
    paidBreakRate: input?.paidBreakRate === "custom" ? "custom" : "role",
    paidBreakHourlyRateCents: cents(input?.paidBreakHourlyRateCents),
    overtimeEnabled: input?.overtimeEnabled !== false,
    overtimeWeeklyThresholdHours: Math.min(168, Math.max(1, finite(input?.overtimeWeeklyThresholdHours, 44))),
    overtimeMultiplier: Math.min(5, Math.max(1, finite(input?.overtimeMultiplier, 1.5))),
    tipOutRules: shapeTipOutRules(input?.tipOutRules, fallbackIso),
    salesFields: shapeSalesFields(input?.salesFields, fallbackIso),
    paySchedule: shapeSchedule(input?.paySchedule, anchor),
    tipSchedule: shapeSchedule(input?.tipSchedule, anchor),
    tipWeekStartsOn: Math.min(6, Math.max(0, Math.round(finite(input?.tipWeekStartsOn, 1)))),
    defaults: {
      wagesVisibility: visibility(input?.defaults?.wagesVisibility, "personal"),
      cashTipsVisibility: visibility(input?.defaults?.cashTipsVisibility, "personal"),
      cardTipsVisibility: visibility(input?.defaults?.cardTipsVisibility, "personal"),
      tipOutVisibility: visibility(input?.defaults?.tipOutVisibility, "personal"),
      wagesDepositAccountId: String(input?.defaults?.wagesDepositAccountId || ""),
      cashTipsAccountId: String(input?.defaults?.cashTipsAccountId || ""),
      cardTipsDepositAccountId: String(input?.defaults?.cardTipsDepositAccountId || ""),
    },
    wagesReceivableAccountId: String(input?.wagesReceivableAccountId || ""),
    cardTipsReceivableAccountId: String(input?.cardTipsReceivableAccountId || ""),
    note: String(input?.note || "").trim().slice(0, 500),
    createdAt,
    updatedAt: input?.updatedAt || createdAt,
  };
}

export function shapeWorkJobs(list: WorkJob[] | null | undefined, fallbackIso = EPOCH_ISO): WorkJob[] {
  const byId = new Map<string, WorkJob>();
  for (const row of list ?? []) {
    if (!row || typeof row !== "object" || !row.id) continue;
    const shaped = shapeWorkJob(row, fallbackIso);
    const existing = byId.get(shaped.id);
    if (!existing || shaped.updatedAt >= existing.updatedAt) byId.set(shaped.id, shaped);
  }
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function workRateForDate(role: WorkRole, date: DateKey): WorkRatePeriod {
  const eligible = shapeRates(role.rates, role.createdAt || EPOCH_ISO).filter((rate) => rate.effectiveDate <= date);
  const rate = eligible.at(-1) ?? shapeRates(role.rates, role.createdAt || EPOCH_ISO)[0];
  if (!rate) throw new ValidationError(`Add a dated wage rate for ${role.name}.`);
  return rate;
}

export function takeHomeHourlyRateCents(rate: WorkRatePeriod): number {
  if (rate.takeHomeMode === "direct") return rate.takeHomeHourlyRateCents;
  const totalPct = Math.min(100, rate.deductions.reduce((sum, rule) => sum + rule.percent, 0));
  return roundToCents((rate.grossHourlyRateCents / 100) * (1 - totalPct / 100));
}

function roundedRuleCents(rawCents: number, rule: WorkTipOutRule): number {
  const increment = Math.max(0, Math.round(rule.roundingCents));
  if (!increment) return Math.round(rawCents);
  const scaled = rawCents / increment;
  const units = rule.roundingMode === "up" ? Math.ceil(scaled - 1e-9) : rule.roundingMode === "down" ? Math.floor(scaled + 1e-9) : Math.round(scaled);
  return Math.max(0, units * increment);
}

export type WorkShiftCalculationInput = {
  date: DateKey;
  workedHours: number;
  paidBreakHours: number;
  previousWeekHours: number;
  salesCents: number;
  cashTipsCents: number;
  cardTipsCents: number;
  manualTipOutCents?: Record<string, number>;
};

export type WorkShiftCalculation = {
  grossWagesCents: number;
  takeHomeWagesCents: number;
  regularHours: number;
  overtimeHours: number;
  paidBreakHours: number;
  paidBreakIncomeCents: number;
  tipsBeforeTipOutCents: number;
  immediateTipOutCents: number;
  withheldTipOutCents: number;
  deferredTipOutCents: number;
  cardTipsAfterTipOutCents: number;
  netTipsCents: number;
  tipOuts: Array<{ ruleId: string; label: string; timing: WorkTipOutRule["timing"]; amountCents: number }>;
};

export function workWeekStart(date: DateKey): DateKey {
  const noon = new Date(`${date}T12:00:00.000Z`);
  const offset = (noon.getUTCDay() + 6) % 7;
  noon.setUTCDate(noon.getUTCDate() - offset);
  return noon.toISOString().slice(0, 10) as DateKey;
}

export function workShiftTransactionIds(shift: Shift): string[] {
  return shift.transactionIds?.length
    ? shift.transactionIds
    : [shift.wagesTransactionId, shift.tipsTransactionId].filter(Boolean);
}

function sortedSplitFacts(transaction: Transaction): Array<{ party: string; amountCents: number }> {
  return transaction.splits
    .map((split) => ({ party: split.party, amountCents: split.amountCents }))
    .sort((left, right) => left.party.localeCompare(right.party) || left.amountCents - right.amountCents);
}

function isBalancedTransactionReversal(original: Transaction, reversal: Transaction): boolean {
  return reversal.source === "reversal"
    && reversal.reversalOfId === original.id
    && reversal.type === original.type
    && reversal.amountCents === original.amountCents
    && reversal.accountId === original.accountId
    && (reversal.categoryId ?? null) === (original.categoryId ?? null)
    && (reversal.subcategoryId ?? null) === (original.subcategoryId ?? null)
    && reversal.visibility === original.visibility
    && JSON.stringify(sortedSplitFacts(reversal)) === JSON.stringify(sortedSplitFacts(original));
}

/** A corrected shift stays in the audit trail, but no longer drives pay, overtime, reports, or Calendar. */
export function workShiftIsReversed(household: Household, shift: Shift): boolean {
  const ids = workShiftTransactionIds(shift);
  return ids.length > 0 && ids.every((id) => {
    const original = household.transactions.find((transaction) => transaction.id === id);
    if (!original) return false;
    const reversals = household.transactions.filter((transaction) => transaction.reversalOfId === id);
    return reversals.length === 1 && isBalancedTransactionReversal(original, reversals[0]!);
  });
}

/** Hours already confirmed for this worker/job in the Toronto payroll week. */
export function previousWorkWeekHours(household: Household, jobId: string, memberId: string, date: DateKey): number {
  const start = workWeekStart(date);
  return household.shifts
    .filter((shift) => shift.memberId === memberId && shift.jobId === jobId && shift.date >= start && shift.date <= date && !workShiftIsReversed(household, shift))
    .reduce((sum, shift) => sum + shift.hours + (shift.paidBreakHours ?? 0), 0);
}

export function calculateWorkShift(job: WorkJob, roleId: string, input: WorkShiftCalculationInput): WorkShiftCalculation {
  if (!isValidDateKey(input.date)) throw new ValidationError("Shift date must be a valid calendar date.");
  const role = job.roles.find((candidate) => candidate.id === roleId && candidate.active);
  if (!role) throw new ValidationError("Choose an active role for this job.");
  const rate = workRateForDate(role, input.date);
  const workedHours = Math.round(Math.max(0, finite(input.workedHours, 0)) * 100) / 100;
  const paidBreakHours = Math.round(Math.max(0, finite(input.paidBreakHours, 0)) * 100) / 100;
  if (workedHours + paidBreakHours <= 0 || workedHours + paidBreakHours > 24) {
    throw new ValidationError("Worked and paid-break hours must total more than zero and no more than 24 hours.");
  }
  const previous = Math.max(0, finite(input.previousWeekHours, 0));
  const thresholdLeft = job.overtimeEnabled ? Math.max(0, job.overtimeWeeklyThresholdHours - previous) : workedHours;
  const regularHours = Math.min(workedHours, thresholdLeft);
  const overtimeHours = job.overtimeEnabled ? Math.max(0, workedHours - regularHours) : 0;
  const netRate = takeHomeHourlyRateCents(rate);
  const regularNet = roundToCents((regularHours * netRate) / 100);
  const overtimeNet = roundToCents((overtimeHours * netRate * job.overtimeMultiplier) / 100);
  const regularGross = roundToCents((regularHours * rate.grossHourlyRateCents) / 100);
  const overtimeGross = roundToCents((overtimeHours * rate.grossHourlyRateCents * job.overtimeMultiplier) / 100);
  const breakRate = job.paidBreakRate === "custom" ? job.paidBreakHourlyRateCents : netRate;
  const breakGrossRate = job.paidBreakRate === "custom" ? job.paidBreakHourlyRateCents : rate.grossHourlyRateCents;
  const paidBreakIncomeCents = roundToCents((paidBreakHours * breakRate) / 100);
  const paidBreakGrossCents = roundToCents((paidBreakHours * breakGrossRate) / 100);

  const sales = Math.max(0, Math.round(input.salesCents));
  const cashTips = Math.max(0, Math.round(input.cashTipsCents));
  const cardTips = Math.max(0, Math.round(input.cardTipsCents));
  const allTips = cashTips + cardTips;
  const tipOuts = job.tipOutRules.filter((rule) => rule.active).map((rule) => {
    let raw = 0;
    if (rule.basis === "total-sales") raw = sales * rule.value / 100;
    else if (rule.basis === "card-tips") raw = cardTips * rule.value / 100;
    else if (rule.basis === "all-tips") raw = allTips * rule.value / 100;
    else if (rule.basis === "fixed-shift") raw = rule.value;
    else if (rule.basis === "fixed-hour") raw = rule.value * (workedHours + paidBreakHours);
    else raw = input.manualTipOutCents?.[rule.id] ?? rule.value;
    return { ruleId: rule.id, label: rule.label, timing: rule.timing, amountCents: roundedRuleCents(raw, rule) };
  });
  const immediateTipOutCents = tipOuts.filter((row) => row.timing === "immediate").reduce((sum, row) => sum + row.amountCents, 0);
  const withheldTipOutCents = tipOuts.filter((row) => row.timing === "withheld").reduce((sum, row) => sum + row.amountCents, 0);
  const deferredTipOutCents = tipOuts.filter((row) => row.timing === "deferred").reduce((sum, row) => sum + row.amountCents, 0);

  return {
    grossWagesCents: regularGross + overtimeGross + paidBreakGrossCents,
    takeHomeWagesCents: regularNet + overtimeNet + paidBreakIncomeCents,
    regularHours,
    overtimeHours,
    paidBreakHours,
    paidBreakIncomeCents,
    tipsBeforeTipOutCents: allTips,
    immediateTipOutCents,
    withheldTipOutCents,
    deferredTipOutCents,
    cardTipsAfterTipOutCents: cardTips - withheldTipOutCents,
    netTipsCents: allTips - immediateTipOutCents - withheldTipOutCents - deferredTipOutCents,
    tipOuts,
  };
}

export function workJobFingerprint(job: WorkJob, roleId: string, date: DateKey): string {
  const role = job.roles.find((candidate) => candidate.id === roleId);
  if (!role) throw new ValidationError("Choose a role before previewing this shift.");
  const rate = workRateForDate(role, date);
  return JSON.stringify({
    v: 1,
    jobId: job.id,
    roleId,
    rate,
    paidBreakRate: job.paidBreakRate,
    paidBreakHourlyRateCents: job.paidBreakHourlyRateCents,
    overtimeEnabled: job.overtimeEnabled,
    overtimeWeeklyThresholdHours: job.overtimeWeeklyThresholdHours,
    overtimeMultiplier: job.overtimeMultiplier,
    tipOutRules: job.tipOutRules.filter((rule) => rule.active),
  });
}
