import { addDays, calendarDaysBetween, dateKeyInZone, daysInMonth, formatMonthLabel, parseDateKey, weekdaySunday0, type DateKey } from "./calendar.ts";
import { projectedExpenseEffect, transactionProjection } from "./budget.ts";
import { formatCad, roundToCents } from "./money.ts";
import { COMPANION, JOINT, ValidationError, type Appointment, type AppointmentCadence, type AppointmentCoverage, type AppointmentKind, type AppointmentSensitivity, type BillLine, type Claim, type ClaimKind, type ClaimStatus, type Household } from "./types.ts";

export const DEFAULT_RECEIVABLE_ID = "ACC-CLAIMS";
export const HEALTH_GROUP_ID = "CAT-HEALTH";
/** CRA 2026 METC cap: lesser of 3% of net income or $2,890. We do not know line 23600. */
export const CRA_METC_CAP_CENTS_2026 = 289000;
export const HOSTED_DISCLOSURE =
  "Appointment notes travel with the household snapshot. Hosted copies are readable with the site key until Auth exists. A quiet label hides the title from Hercules, not from this ledger.";

export const APPOINTMENT_KINDS: { id: AppointmentKind; label: string }[] = [
  { id: "dentist", label: "Dentist" },
  { id: "doctor", label: "Doctor" },
  { id: "therapy", label: "Therapy" },
  { id: "optometrist", label: "Optometrist" },
  { id: "physio", label: "Physio / RMT" },
  { id: "vet", label: "Vet" },
  { id: "spa", label: "Spa / barber" },
  { id: "other", label: "Other" },
];

export const CLAIM_KINDS: { id: ClaimKind; label: string }[] = [
  { id: "insurance", label: "Insurance" },
  { id: "employer", label: "Employer" },
  { id: "person", label: "A person" },
  { id: "tax", label: "Tax" },
  { id: "other", label: "Other" },
];

const MEDICAL_KINDS = new Set<AppointmentKind>(["dentist", "doctor", "therapy", "optometrist", "physio"]);

export function defaultCraEligible(kind: AppointmentKind): boolean {
  return MEDICAL_KINDS.has(kind);
}

export function defaultClaimKind(kind: AppointmentKind): ClaimKind {
  return kind === "spa" || kind === "other" ? "other" : kind === "vet" ? "other" : "insurance";
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function shapeCadence(raw: unknown): AppointmentCadence {
  if (!raw || typeof raw !== "object") return { kind: "once" };
  const row = raw as AppointmentCadence;
  if (row.kind === "weekly") return { kind: "weekly", interval: Math.max(1, Math.min(52, asInt(row.interval, 1))) };
  if (row.kind === "monthly") return { kind: "monthly", interval: Math.max(1, Math.min(36, asInt(row.interval, 1))) };
  if (row.kind === "days") return { kind: "days", interval: Math.max(1, Math.min(730, asInt(row.interval, 1))) };
  if (row.kind === "nthWeekday") {
    const weekday = Math.min(6, Math.max(0, asInt(row.weekday, 2)));
    const nth = row.nth === -1 ? -1 : Math.min(4, Math.max(1, asInt(row.nth, 1)));
    return { kind: "nthWeekday", weekday, nth, intervalMonths: Math.max(1, Math.min(18, asInt(row.intervalMonths, 1))) };
  }
  return { kind: "once" };
}

export function formatAppointmentCadence(cadence: AppointmentCadence): string {
  if (cadence.kind === "once") return "office calls you";
  if (cadence.kind === "weekly") return cadence.interval === 1 ? "weekly" : `every ${cadence.interval} weeks`;
  if (cadence.kind === "monthly") return cadence.interval === 1 ? "monthly" : `every ${cadence.interval} months`;
  if (cadence.kind === "days") return cadence.interval === 1 ? "daily" : `every ${cadence.interval} days`;
  const weeks = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const nth = cadence.nth === -1 ? "last" : cadence.nth === 1 ? "1st" : cadence.nth === 2 ? "2nd" : cadence.nth === 3 ? "3rd" : "4th";
  const every = cadence.intervalMonths === 1 ? "" : ` every ${cadence.intervalMonths} months`;
  return `${nth} ${weeks[cadence.weekday]}${every}`;
}

export function suggestedAppointmentCadence(kind: AppointmentKind): AppointmentCadence {
  if (kind === "therapy") return { kind: "weekly", interval: 2 };
  if (kind === "dentist") return { kind: "monthly", interval: 6 };
  if (kind === "physio") return { kind: "weekly", interval: 1 };
  if (kind === "spa") return { kind: "weekly", interval: 8 };
  if (kind === "optometrist" || kind === "vet") return { kind: "monthly", interval: 12 };
  return { kind: "once" };
}

export function suggestedAppointmentSensitivity(kind: AppointmentKind): AppointmentSensitivity {
  return kind === "therapy" ? "quiet" : "household";
}

export function formatCoverage(coverage: AppointmentCoverage): string {
  if (coverage === "ohip") return "OHIP";
  if (coverage === "none") return "No coverage";
  return "Private plan";
}

export function formatClaimStatus(status: ClaimStatus): string {
  if (status === "pending") return "Waiting";
  if (status === "submitted") return "Submitted";
  if (status === "settled") return "Landed";
  if (status === "short") return "Paid short";
  return "Denied";
}

export type AgingBucket = "current" | "1-7" | "8-30" | "31+";

export function formatAgingBucket(bucket: AgingBucket): string {
  if (bucket === "current") return "Today";
  if (bucket === "1-7") return "1–7 days";
  if (bucket === "8-30") return "8–30 days";
  return "31+ days";
}

export function pickVisitSubcategory(household: Household, kind: string, fallback: string): string {
  const preferredId = kind === "vet" ? "SUB-HEALTH-VET" : kind === "therapy" ? "SUB-HEALTH-THERAPY" : kind === "dentist" ? "SUB-HEALTH-DENTAL" : "";
  if (preferredId && household.categories.some((item) => item.id === preferredId && item.active)) return preferredId;
  const needle = kind === "vet" ? "vet" : kind === "therapy" ? "therapy" : kind === "dentist" ? "dental" : "";
  if (needle) {
    const named = household.categories.find((item) => (
      item.recordType === "category"
      && item.transactionType === "expense"
      && item.active
      && item.name.toLowerCase().includes(needle)
    ));
    if (named) return named.id;
  }
  return fallback;
}

export function pickVisitMember(household: Household, kind: string, actorId: string): string {
  if (kind === "vet") return COMPANION;
  if (kind === "therapy") {
    const bianca = household.members.find((member) => member.active && member.id === "MEM-001")
      ?? household.members.find((member) => member.active && /bianca/i.test(member.name));
    return bianca?.id ?? actorId;
  }
  return JOINT;
}

export function pickVisitAccountId(household: Household): string {
  return household.accounts.find((item) => item.id === "ACC-VISA" && item.active)?.id
    ?? household.accounts.find((item) => item.active && item.kind !== "receivable")?.id
    ?? "";
}

function nthWeekdayInMonth(year: number, month: number, weekday: number, nth: number): DateKey {
  const dim = daysInMonth(year, month);
  if (nth === -1) {
    for (let day = dim; day >= 1; day -= 1) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (weekdaySunday0(key) === weekday) return key;
    }
  }
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const delta = (weekday - weekdaySunday0(first) + 7) % 7;
  const day = 1 + delta + (nth - 1) * 7;
  if (day > dim) return nthWeekdayInMonth(year, month, weekday, -1);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addMonthsClamped(date: DateKey, months: number): DateKey {
  const { year, month, day } = parseDateKey(date);
  const utc = new Date(Date.UTC(year, month - 1 + months, day));
  return utc.toISOString().slice(0, 10);
}

export function advanceAppointmentCadence(date: DateKey, cadence: AppointmentCadence): DateKey {
  if (cadence.kind === "once") return date;
  if (cadence.kind === "weekly") return addDays(date, 7 * cadence.interval);
  if (cadence.kind === "days") return addDays(date, cadence.interval);
  if (cadence.kind === "monthly") return addMonthsClamped(date, cadence.interval);
  const shifted = addMonthsClamped(`${date.slice(0, 7)}-01`, cadence.intervalMonths);
  const { year, month } = parseDateKey(shifted);
  return nthWeekdayInMonth(year, month, cadence.weekday, cadence.nth);
}

export function projectAppointmentDates(start: DateKey, cadence: AppointmentCadence, from: DateKey, to: DateKey): DateKey[] {
  if (cadence.kind === "once") {
    return start >= from && start <= to ? [start] : [];
  }
  let cursor = start;
  for (let i = 0; i < 48 && cursor < from; i += 1) {
    const next = advanceAppointmentCadence(cursor, cadence);
    if (next <= cursor) break;
    cursor = next;
  }
  const dates: DateKey[] = [];
  while (cursor <= to && dates.length < 24) {
    if (cursor >= from) dates.push(cursor);
    const next = advanceAppointmentCadence(cursor, cadence);
    if (next <= cursor) break;
    cursor = next;
  }
  return dates;
}

export function shapeBillLines(raw: unknown): BillLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is BillLine => Boolean(row) && typeof row === "object")
    .map((row, index) => ({
      id: typeof row.id === "string" && row.id ? row.id : `LINE-${index + 1}`,
      code: typeof row.code === "string" ? row.code.trim().slice(0, 24) : "",
      description: typeof row.description === "string" && row.description.trim() ? row.description.trim().slice(0, 80) : "Item",
      amountCents: Math.max(0, asInt(row.amountCents, 0)),
    }))
    .filter((row) => row.amountCents > 0)
    .slice(0, 24);
}

export function assertLinesSum(lines: BillLine[], totalCents: number): void {
  if (!lines.length) return;
  const sum = lines.reduce((acc, line) => acc + line.amountCents, 0);
  if (sum !== totalCents) {
    throw new ValidationError(`Itemized lines add to $${(sum / 100).toFixed(2)}, not the posted $${(totalCents / 100).toFixed(2)}.`);
  }
}

const KINDS = new Set<AppointmentKind>(APPOINTMENT_KINDS.map((item) => item.id));
const CLAIM_KIND_SET = new Set<ClaimKind>(CLAIM_KINDS.map((item) => item.id));

export function shapeAppointment(item: Appointment, fallbackIso: string): Appointment {
  const createdAt = item.createdAt || fallbackIso;
  const kind = KINDS.has(item.kind) ? item.kind : "other";
  const sensitivity: AppointmentSensitivity = item.sensitivity === "quiet" ? "quiet" : "household";
  return {
    ...item,
    title: String(item.title || "Visit").trim().slice(0, 80) || "Visit",
    kind,
    memberId: item.memberId || JOINT,
    place: typeof item.place === "string" ? item.place.trim().slice(0, 80) : "",
    practitioner: typeof item.practitioner === "string" ? item.practitioner.trim().slice(0, 80) : "",
    sensitivity,
    coverage: item.coverage === "ohip" || item.coverage === "private" || item.coverage === "none" ? item.coverage : "private",
    cadence: shapeCadence(item.cadence),
    typicalCostCents: Math.max(0, asInt(item.typicalCostCents, 0)),
    typicalRecoveryCents: Math.max(0, asInt(item.typicalRecoveryCents, 0)),
    lastVisitDate: item.lastVisitDate || null,
    lastPostedTransactionId: item.lastPostedTransactionId || null,
    savingGoalId: item.savingGoalId || null,
    active: item.active !== false,
    createdAt,
    updatedAt: item.updatedAt || createdAt,
  };
}

export function deriveClaimStatus(claim: Pick<Claim, "expectedCents" | "receivedCents" | "writtenOffCents" | "submittedAt" | "status">): ClaimStatus {
  if (claim.status === "denied") return "denied";
  const remaining = claim.expectedCents - claim.receivedCents - claim.writtenOffCents;
  if (remaining <= 0 && claim.writtenOffCents > 0 && claim.receivedCents <= 0) return "denied";
  if (remaining <= 0 && claim.writtenOffCents > 0) return "short";
  if (remaining <= 0) return "settled";
  if (claim.submittedAt) return "submitted";
  return "pending";
}

export function shapeClaim(item: Claim, fallbackIso: string): Claim {
  const createdAt = item.createdAt || fallbackIso;
  const expectedCents = Math.max(0, asInt(item.expectedCents, 0));
  const receivedCents = Math.max(0, asInt(item.receivedCents, 0));
  const writtenOffCents = Math.max(0, asInt(item.writtenOffCents, 0));
  const draft: Claim = {
    ...item,
    kind: CLAIM_KIND_SET.has(item.kind) ? item.kind : "other",
    label: String(item.label || "Claim").trim().slice(0, 80) || "Claim",
    appointmentId: item.appointmentId || null,
    recoveryTransactionId: item.recoveryTransactionId || null,
    settleTransferIds: Array.isArray(item.settleTransferIds) ? item.settleTransferIds : [],
    writeOffTransactionId: item.writeOffTransactionId || null,
    expectedCents,
    receivedCents,
    writtenOffCents,
    submittedAt: item.submittedAt || null,
    settledAt: item.settledAt || null,
    craEligible: item.craEligible === true,
    lines: shapeBillLines(item.lines),
    createdAt,
    updatedAt: item.updatedAt || createdAt,
    status: "pending",
  };
  draft.status = deriveClaimStatus(draft);
  return draft;
}

export function shapeAppointments(list: Appointment[] | undefined, fallbackIso: string): Appointment[] {
  return (list ?? []).map((item) => shapeAppointment(item, fallbackIso));
}

export function shapeClaims(list: Claim[] | undefined, fallbackIso: string): Claim[] {
  return (list ?? []).map((item) => shapeClaim(item, fallbackIso));
}

export function claimRemainingCents(claim: Claim): number {
  return Math.max(0, claim.expectedCents - claim.receivedCents - claim.writtenOffCents);
}

export function outstandingClaims(household: Household): Claim[] {
  return (household.claims ?? []).filter((claim) => claimRemainingCents(claim) > 0);
}

/**
 * Projection of when owed-to-us should land. Never a post.
 * Submitted insurance ~14 days; employer ~7; others ~10 from created/submitted.
 */
export function claimExpectedLandingDate(claim: Claim): DateKey | null {
  if (claimRemainingCents(claim) <= 0) return null;
  if (claim.status === "settled" || claim.status === "denied") return null;
  const iso = claim.submittedAt || claim.createdAt;
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = dateKeyInZone(parsed);
  const lag = claim.kind === "insurance" ? 14 : claim.kind === "employer" ? 7 : 10;
  return addDays(start, lag);
}

export function weekdayWord(date: DateKey): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekdaySunday0(date)] ?? "week";
}

/** Calendar cards use the title they typed. Hercules and pulses use this for quiet rows. */
export function appointmentPublicTitle(appointment: Appointment, surface: "card" | "hercules"): string {
  if (surface === "card" || appointment.sensitivity !== "quiet") return appointment.title;
  return `the ${weekdayWord(appointment.nextDate)} visit`;
}

/** Storage defaults for visit rows. Quiet titles stay off the journal note (D-060). */
export function visitPostedDefaults(
  appointment: Appointment | undefined,
  input: { note?: string; place?: string; claimLabel?: string },
): { note: string; place: string; claimLabel: string } {
  const note = input.note?.trim()
    ? input.note.trim()
    : appointment?.sensitivity === "quiet"
      ? appointmentPublicTitle(appointment, "hercules")
      : (appointment?.title?.trim() || "Visit");
  const place = input.place != null
    ? input.place
    : appointment?.sensitivity === "quiet"
      ? ""
      : (appointment?.place ?? "");
  const claimLabel = input.claimLabel?.trim()
    ? input.claimLabel.trim()
    : appointment?.sensitivity === "quiet"
      ? appointmentPublicTitle(appointment, "hercules")
      : (appointment?.title?.trim() || note);
  return { note, place, claimLabel };
}

export function claimPublicLabel(household: Household, claim: Claim, surface: "card" | "hercules"): string {
  if (claim.appointmentId) {
    const appointment = household.appointments.find((item) => item.id === claim.appointmentId);
    if (appointment) return appointmentPublicTitle(appointment, surface);
  }
  return claim.label;
}

export function defaultReceivableAccountId(household: Household): string {
  const named = household.accounts.find((account) => account.id === DEFAULT_RECEIVABLE_ID && account.active);
  if (named) return named.id;
  const receivable = household.accounts.find((account) => account.kind === "receivable" && account.active);
  if (receivable) return receivable.id;
  throw new ValidationError("Open an Owed-to-us account before booking a claim. Settlement is a transfer into the bank that received the money.");
}

export function estimateRecoveryCents(household: Household, appointment: Appointment): number {
  if (appointment.typicalRecoveryCents > 0) return Math.min(appointment.typicalRecoveryCents, appointment.typicalCostCents || appointment.typicalRecoveryCents);
  const history = (household.claims ?? []).filter((claim) => claim.appointmentId === appointment.id && claim.receivedCents > 0);
  if (!history.length) return 0;
  const sorted = history.map((claim) => claim.receivedCents).sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  return Math.min(median, appointment.typicalCostCents || median);
}

export function learnedVisitIntervalDays(household: Household, appointment: Appointment): number | null {
  const dates = postedVisitsFor(household, appointment.id).map((visit) => visit.date);
  if (appointment.lastVisitDate) dates.push(appointment.lastVisitDate);
  const unique = [...new Set(dates)].sort();
  if (unique.length < 2) return null;
  const gaps = unique.slice(1).map((date, index) => calendarDaysBetween(unique[index]!, date)).filter((gap) => gap > 0);
  if (!gaps.length) return null;
  const sorted = [...gaps].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function visitDriftSentence(household: Household, appointment: Appointment): string | null {
  const learned = learnedVisitIntervalDays(household, appointment);
  const claimed = claimedIntervalDays(appointment.cadence);
  if (learned && claimed && Math.abs(learned - claimed) / claimed > 0.3) {
    return `You call it ${formatAppointmentCadence(appointment.cadence)}. The books say about every ${learned} days.`;
  }
  return null;
}

export function visitCadenceCompare(household: Household, appointment: Appointment): {
  claimed: string;
  learnedDays: number | null;
  sentence: string;
} {
  const claimed = formatAppointmentCadence(appointment.cadence);
  const learnedDays = learnedVisitIntervalDays(household, appointment);
  const drift = visitDriftSentence(household, appointment);
  if (drift) return { claimed, learnedDays, sentence: drift };
  if (learnedDays) {
    return {
      claimed,
      learnedDays,
      sentence: `You call it ${claimed}. The books say about every ${learnedDays} days.`,
    };
  }
  return {
    claimed,
    learnedDays: null,
    sentence: `You call it ${claimed}. Two posted visits and the books can check the drift.`,
  };
}

export function claimedIntervalDays(cadence: AppointmentCadence): number | null {
  if (cadence.kind === "once") return null;
  if (cadence.kind === "days") return cadence.interval;
  if (cadence.kind === "weekly") return 7 * cadence.interval;
  if (cadence.kind === "monthly") return 30 * cadence.interval;
  return 30 * cadence.intervalMonths;
}

export type VisitGoalProposal = {
  appointmentId: string;
  title: string;
  targetCents: number;
  weeklyCents: number;
  weeks: number;
  nextDate: DateKey;
  netCents: number;
  drift: string | null;
  hercules: string;
};

export function proposeVisitGoal(household: Household, appointmentId: string, today: DateKey): VisitGoalProposal | null {
  const appointment = household.appointments.find((item) => item.id === appointmentId && item.active);
  if (!appointment) return null;
  if (appointment.savingGoalId) return null;
  const cost = appointment.typicalCostCents;
  if (cost <= 0) return null;
  const recovery = estimateRecoveryCents(household, appointment);
  const netCents = Math.max(0, cost - recovery);
  if (netCents <= 0) return null;
  const nextDate = appointment.nextDate < today ? today : appointment.nextDate;
  const days = Math.max(1, calendarDaysBetween(today, nextDate));
  const weeks = Math.max(1, Math.ceil(days / 7));
  const weeklyCents = Math.ceil(netCents / weeks);
  const drift = visitDriftSentence(household, appointment);
  const publicTitle = appointmentPublicTitle(appointment, "hercules");
  const hercules = appointment.memberId === COMPANION
    ? `I have a date ${nextDate >= today ? `on ${nextDate}` : "that's overdue"}. ${formatCad(weeklyCents)} a week and I do not feel it.`
    : `${publicTitle} is ${nextDate >= today ? nextDate : "overdue"}. ${formatCad(weeklyCents)} a week into a jar. You tap Start. I don't.`;
  return {
    appointmentId: appointment.id,
    title: appointment.memberId === COMPANION ? "Hercules · vet" : `${publicTitle} fund`,
    targetCents: netCents,
    weeklyCents,
    weeks,
    nextDate,
    netCents,
    drift,
    hercules,
  };
}

export function upcomingVisitProposals(household: Household, today: DateKey): VisitGoalProposal[] {
  return (household.appointments ?? [])
    .filter((item) => item.active && !item.savingGoalId)
    .map((item) => proposeVisitGoal(household, item.id, today))
    .filter((item): item is VisitGoalProposal => Boolean(item))
    .sort((left, right) => left.nextDate.localeCompare(right.nextDate));
}

export type CraMedicalLogRow = {
  date: DateKey;
  label: string;
  expenseCents: number;
  receivedCents: number;
  remainingCents: number;
  eligibleCents: number;
  lines: BillLine[];
  claimId: string | null;
  appointmentId: string | null;
};

export type CraOmittedRow = {
  date: DateKey;
  label: string;
  expenseCents: number;
  reason: string;
};

export type CraMedicalLog = {
  year: number;
  eligibleCents: number;
  reimbursedCents: number;
  outstandingCents: number;
  capCents: number;
  hercules: string;
  rows: CraMedicalLogRow[];
  omitted: CraOmittedRow[];
};

export function craMedicalLog(household: Household, asOf: DateKey): CraMedicalLog {
  const year = parseDateKey(asOf).year;
  const start = `${year}-01-01`;
  const end = asOf;
  let eligibleCents = 0;
  let reimbursedCents = 0;
  let outstandingCents = 0;
  const rows: CraMedicalLogRow[] = [];
  const omitted: CraOmittedRow[] = [];
  const seenExpenseIds = new Set<string>();
  const transactionById = new Map(household.transactions.map((tx) => [tx.id, tx]));
  const projectedExpenseByRootId = new Map<string, number>();
  for (const tx of household.transactions) {
    if (tx.date > end) continue;
    const rootId = transactionProjection(tx, transactionById).root.id;
    projectedExpenseByRootId.set(
      rootId,
      (projectedExpenseByRootId.get(rootId) ?? 0) + projectedExpenseEffect(tx, transactionById),
    );
  }
  for (const claim of household.claims ?? []) {
    const expense = household.transactions.find((tx) => tx.id === claim.expenseTransactionId);
    if (!expense || expense.date < start || expense.date > end) continue;
    seenExpenseIds.add(expense.id);
    const expenseCents = Math.max(0, projectedExpenseByRootId.get(expense.id) ?? 0);
    if (!expenseCents) continue;
    const appointment = claim.appointmentId
      ? household.appointments.find((item) => item.id === claim.appointmentId)
      : undefined;
    if (!claim.craEligible) {
      if (appointment?.kind === "vet") {
        omitted.push({
          date: expense.date,
          label: claimPublicLabel(household, claim, "card"),
          expenseCents,
          reason: "Vet bills are not METC.",
        });
      }
      continue;
    }
    const received = Math.min(claim.receivedCents, expenseCents);
    const remaining = Math.min(claimRemainingCents(claim), Math.max(0, expenseCents - received));
    // Net of reimbursements received *and* still expected — do not count a pending Sun Life cheque as METC.
    const eligible = Math.max(0, expenseCents - received - remaining);
    eligibleCents += eligible;
    reimbursedCents += received;
    outstandingCents += remaining;
    rows.push({
      date: expense.date,
      label: claimPublicLabel(household, claim, "card"),
      expenseCents,
      receivedCents: received,
      remainingCents: remaining,
      eligibleCents: eligible,
      lines: claim.lines,
      claimId: claim.id,
      appointmentId: claim.appointmentId,
    });
  }
  for (const tx of household.transactions) {
    if (tx.type !== "expense" || tx.source !== "visit") continue;
    if (tx.date < start || tx.date > end) continue;
    if (seenExpenseIds.has(tx.id)) continue;
    const expenseCents = Math.max(0, projectedExpenseByRootId.get(tx.id) ?? 0);
    if (!expenseCents) continue;
    const appointment = household.appointments.find((item) => item.id === tx.sourceId);
    if (appointment?.kind === "vet") {
      omitted.push({
        date: tx.date,
        label: appointmentPublicTitle(appointment, "card"),
        expenseCents,
        reason: "Vet bills are not METC.",
      });
      continue;
    }
    if (!appointment || !defaultCraEligible(appointment.kind)) continue;
    eligibleCents += expenseCents;
    rows.push({
      date: tx.date,
      label: appointmentPublicTitle(appointment, "card"),
      expenseCents,
      receivedCents: 0,
      remainingCents: 0,
      eligibleCents: expenseCents,
      lines: [],
      claimId: null,
      appointmentId: appointment.id,
    });
  }
  rows.sort((left, right) => left.date.localeCompare(right.date) || left.label.localeCompare(right.label));
  omitted.sort((left, right) => left.date.localeCompare(right.date));
  return {
    year,
    eligibleCents,
    reimbursedCents,
    outstandingCents,
    capCents: CRA_METC_CAP_CENTS_2026,
    rows,
    omitted,
    hercules: eligibleCents
      ? `${year} medical after reimbursements: ${formatCad(eligibleCents)}. CRA keeps the lesser of 3% of net income or ${formatCad(CRA_METC_CAP_CENTS_2026)}. Pending claims stay out of that number. I don't file taxes.`
      : `No CRA-eligible medical in ${year} yet. Vet bills stay off this list.`,
  };
}

export type AgedReceivable = {
  claim: Claim;
  remainingCents: number;
  daysOutstanding: number;
  bucket: AgingBucket;
};

export function agedReceivables(household: Household, today: DateKey): AgedReceivable[] {
  return outstandingClaims(household).map((claim) => {
    const expense = household.transactions.find((tx) => tx.id === claim.expenseTransactionId);
    const start = expense?.date ?? claim.createdAt.slice(0, 10);
    const daysOutstanding = Math.max(0, calendarDaysBetween(start, today));
    const bucket: AgedReceivable["bucket"] = daysOutstanding <= 0 ? "current" : daysOutstanding <= 7 ? "1-7" : daysOutstanding <= 30 ? "8-30" : "31+";
    return { claim, remainingCents: claimRemainingCents(claim), daysOutstanding, bucket };
  }).sort((left, right) => right.daysOutstanding - left.daysOutstanding);
}

export function claimsTraySentence(household: Household, today: DateKey): string {
  const aged = agedReceivables(household, today);
  if (!aged.length) return "Nothing owed to this household right now.";
  const total = aged.reduce((sum, row) => sum + row.remainingCents, 0);
  const oldest = aged[0]!;
  const label = claimPublicLabel(household, oldest.claim, "hercules");
  return `${formatCad(total)} outstanding. Oldest: ${label} · ${oldest.daysOutstanding}d.`;
}

export function groupAgedReceivables(rows: AgedReceivable[]): { status: ClaimStatus; label: string; rows: AgedReceivable[] }[] {
  const order: ClaimStatus[] = ["pending", "submitted", "short", "denied", "settled"];
  return order
    .map((status) => ({
      status,
      label: formatClaimStatus(status),
      rows: rows.filter((row) => row.claim.status === status),
    }))
    .filter((group) => group.rows.length);
}

export type PostedVisit = {
  date: DateKey;
  expenseId: string;
  amountCents: number;
  expectedCents: number;
  receivedCents: number;
  writtenOffCents: number;
  remainingCents: number;
  lines: BillLine[];
  claim: Claim | null;
  place: string;
  note: string;
};

export function postedVisitsFor(household: Household, appointmentId: string): PostedVisit[] {
  const seen = new Set<string>();
  const visits: PostedVisit[] = [];
  for (const claim of household.claims ?? []) {
    if (claim.appointmentId !== appointmentId) continue;
    const expense = household.transactions.find((tx) => tx.id === claim.expenseTransactionId);
    if (!expense) continue;
    seen.add(expense.id);
    visits.push({
      date: expense.date,
      expenseId: expense.id,
      amountCents: expense.amountCents,
      expectedCents: claim.expectedCents,
      receivedCents: claim.receivedCents,
      writtenOffCents: claim.writtenOffCents,
      remainingCents: claimRemainingCents(claim),
      lines: claim.lines,
      claim,
      place: expense.place,
      note: expense.note,
    });
  }
  for (const tx of household.transactions) {
    if (tx.type !== "expense" || tx.source !== "visit") continue;
    if (seen.has(tx.id)) continue;
    if (tx.sourceId !== appointmentId) continue;
    visits.push({
      date: tx.date,
      expenseId: tx.id,
      amountCents: tx.amountCents,
      expectedCents: 0,
      receivedCents: 0,
      writtenOffCents: 0,
      remainingCents: 0,
      lines: [],
      claim: null,
      place: tx.place,
      note: tx.note,
    });
  }
  return visits.sort((left, right) => right.date.localeCompare(left.date) || right.expenseId.localeCompare(left.expenseId));
}

export type UpcomingVisitRow = {
  appointmentId: string;
  date: DateKey;
  overdue: boolean;
  title: string;
  kind: AppointmentKind;
  typicalCostCents: number;
  typicalRecoveryCents: number;
  estimatedRecoveryCents: number;
  monthKey: string;
};

export function upcomingVisitBoard(household: Household, today: DateKey, horizonDays = 90): UpcomingVisitRow[] {
  const horizon = addDays(today, horizonDays);
  const rows: UpcomingVisitRow[] = [];
  for (const appointment of household.appointments ?? []) {
    if (!appointment.active) continue;
    const recovery = estimateRecoveryCents(household, appointment);
    const push = (date: DateKey, overdue: boolean) => {
      rows.push({
        appointmentId: appointment.id,
        date,
        overdue,
        title: appointmentPublicTitle(appointment, "card"),
        kind: appointment.kind,
        typicalCostCents: appointment.typicalCostCents,
        typicalRecoveryCents: appointment.typicalRecoveryCents,
        estimatedRecoveryCents: recovery,
        monthKey: date.slice(0, 7),
      });
    };
    if (appointment.nextDate < today) {
      push(appointment.nextDate, true);
      if (appointment.cadence.kind !== "once") {
        const resumed = advanceAppointmentCadence(appointment.nextDate, appointment.cadence);
        for (const date of projectAppointmentDates(resumed, appointment.cadence, today, horizon)) {
          push(date, false);
        }
      }
    } else {
      for (const date of projectAppointmentDates(appointment.nextDate, appointment.cadence, today, horizon)) {
        push(date, false);
      }
    }
  }
  return rows.sort((left, right) => {
    if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
    return left.date.localeCompare(right.date) || left.title.localeCompare(right.title);
  });
}

export type UpcomingVisitGroup = {
  monthKey: string;
  monthLabel: string;
  rows: UpcomingVisitRow[];
};

export function groupUpcomingVisits(rows: UpcomingVisitRow[]): UpcomingVisitGroup[] {
  const groups: UpcomingVisitGroup[] = [];
  const overdue = rows.filter((row) => row.overdue);
  if (overdue.length) groups.push({ monthKey: "overdue", monthLabel: "Overdue", rows: overdue });
  const rest = rows.filter((row) => !row.overdue);
  const byMonth = new Map<string, UpcomingVisitRow[]>();
  for (const row of rest) {
    const list = byMonth.get(row.monthKey) ?? [];
    list.push(row);
    byMonth.set(row.monthKey, list);
  }
  for (const monthKey of [...byMonth.keys()].sort()) {
    groups.push({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      rows: byMonth.get(monthKey)!,
    });
  }
  return groups;
}

export type VisitDraftLine = {
  code: string;
  description: string;
  amount: string;
};

export type VisitPostDraft = {
  appointmentId: string;
  date: string;
  amount: string;
  expectedRecovery: string;
  lines: VisitDraftLine[];
};

export function typicalVisitDraft(appointment: Appointment, date: DateKey, household?: Household): VisitPostDraft {
  const recovery = household ? estimateRecoveryCents(household, appointment) : appointment.typicalRecoveryCents;
  return {
    appointmentId: appointment.id,
    date,
    amount: appointment.typicalCostCents ? (appointment.typicalCostCents / 100).toFixed(2) : "",
    expectedRecovery: recovery ? (recovery / 100).toFixed(2) : "0",
    lines: [],
  };
}

export function sumDraftLineCents(lines: VisitDraftLine[]): number {
  return lines.reduce((sum, line) => {
    const raw = String(line.amount ?? "").replace(/[$,]/g, "").trim();
    if (!raw) return sum;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return sum;
    return sum + roundToCents(n);
  }, 0);
}

export function visitPostSummary(appointment: Appointment, draft: VisitPostDraft): string {
  const lineCount = draft.lines.filter((line) => String(line.amount ?? "").trim()).length;
  const itemized = lineCount ? ` ${lineCount} itemized ${lineCount === 1 ? "line" : "lines"}.` : "";
  const back = Number(draft.expectedRecovery);
  const backBit = Number.isFinite(back) && back > 0
    ? ` Expected recovery ${formatCad(roundToCents(back))} parks as money owed to us.`
    : " No expected recovery.";
  return `This posts ${draft.amount ? formatCad(roundToCents(Number(draft.amount) || 0)) : "the visit"} for ${appointmentPublicTitle(appointment, "card")} on ${draft.date}.${backBit}${itemized}`;
}
