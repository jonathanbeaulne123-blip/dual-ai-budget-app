import { addDays, inInclusiveRange, type DateKey } from "./calendar.ts";
import { bookBalanceAsOf } from "./statements.ts";
import type { Household, WorkPaySchedule } from "./types.ts";
import { workShiftIsReversed } from "./work.ts";

function distanceDays(left: DateKey, right: DateKey): number {
  return Math.round((Date.parse(`${right}T12:00:00.000Z`) - Date.parse(`${left}T12:00:00.000Z`)) / 86_400_000);
}

export function workScheduleMatches(schedule: WorkPaySchedule, date: DateKey): boolean {
  if (schedule.cadence === "custom") return schedule.customDates.includes(date);
  if (schedule.cadence === "twice-monthly") return schedule.monthDays.includes(Number(date.slice(8)));
  const days = distanceDays(schedule.anchorDate, date);
  const interval = schedule.cadence === "weekly" ? 7 : 14;
  return days >= 0 && days % interval === 0;
}

export function nextWorkScheduleDate(schedule: WorkPaySchedule, onOrAfter: DateKey): DateKey | null {
  for (let offset = 0; offset <= 400; offset += 1) {
    const date = addDays(onOrAfter, offset);
    if (workScheduleMatches(schedule, date)) return date;
  }
  return null;
}

export type WorkOwedFact = {
  id: string;
  jobId: string;
  memberId: string;
  kind: "wages" | "card-tips" | "deferred-tipout";
  title: string;
  amountCents: number;
  date: DateKey;
  due: boolean;
  accountId: string;
  destinationAccountId: string;
  color: string;
};

export function workOwedFacts(household: Household, today: DateKey, memberId?: string): WorkOwedFact[] {
  const facts: WorkOwedFact[] = [];
  for (const job of (household.workJobs ?? []).filter((row) => row.active && (!memberId || row.memberId === memberId))) {
    const shifts = household.shifts.filter((shift) => shift.jobId === job.id && shift.memberId === job.memberId && !workShiftIsReversed(household, shift));
    const latestShiftDate = shifts.map((shift) => shift.date).sort().at(-1) ?? today;
    const wagesOwed = job.wagesReceivableAccountId ? Math.max(0, bookBalanceAsOf(household, job.wagesReceivableAccountId, today)) : 0;
    if (wagesOwed > 0) {
      const scheduled = nextWorkScheduleDate(job.paySchedule, latestShiftDate) ?? today;
      const date = scheduled <= today ? today : scheduled;
      facts.push({
        id: `work-pay:${job.id}:${date}`, jobId: job.id, memberId: job.memberId, kind: "wages",
        title: `${job.name} · confirm paycheck`, amountCents: wagesOwed, date, due: scheduled <= today,
        accountId: job.wagesReceivableAccountId, destinationAccountId: job.defaults.wagesDepositAccountId, color: job.color,
      });
    }
    const tipsOwed = job.cardTipsReceivableAccountId ? Math.max(0, bookBalanceAsOf(household, job.cardTipsReceivableAccountId, today)) : 0;
    if (tipsOwed > 0) {
      const scheduled = nextWorkScheduleDate(job.tipSchedule, latestShiftDate) ?? today;
      const date = scheduled <= today ? today : scheduled;
      facts.push({
        id: `work-tips:${job.id}:${date}`, jobId: job.id, memberId: job.memberId, kind: "card-tips",
        title: `${job.name} · confirm tip envelope`, amountCents: tipsOwed, date, due: scheduled <= today,
        accountId: job.cardTipsReceivableAccountId, destinationAccountId: job.defaults.cardTipsDepositAccountId, color: job.color,
      });
    }
    const deferred = shifts.reduce((sum, shift) => sum + Math.max(0, (shift.deferredTipOutCents ?? 0) - (shift.deferredTipOutPaidCents ?? 0)), 0);
    if (deferred > 0) {
      facts.push({
        id: `work-deferred:${job.id}:${today}`, jobId: job.id, memberId: job.memberId, kind: "deferred-tipout",
        title: `${job.name} · deferred tip-out`, amountCents: deferred, date: today, due: true,
        accountId: job.defaults.cashTipsAccountId, destinationAccountId: "", color: job.color,
      });
    }
  }
  return facts;
}

export function workOwedFactsInRange(household: Household, today: DateKey, from: DateKey, to: DateKey): WorkOwedFact[] {
  return workOwedFacts(household, today).filter((fact) => inInclusiveRange(fact.date, from, to));
}

export function workReportFacts(household: Household, memberId: string, from: DateKey, to: DateKey) {
  const shifts = household.shifts.filter((shift) => shift.memberId === memberId && shift.date >= from && shift.date <= to && shift.jobId && !workShiftIsReversed(household, shift));
  return {
    count: shifts.length,
    hours: shifts.reduce((sum, shift) => sum + shift.hours, 0),
    paidBreakHours: shifts.reduce((sum, shift) => sum + (shift.paidBreakHours ?? 0), 0),
    grossWagesCents: shifts.reduce((sum, shift) => sum + (shift.grossWagesCents ?? shift.wagesCents), 0),
    takeHomeWagesCents: shifts.reduce((sum, shift) => sum + shift.wagesCents, 0),
    grossTipsCents: shifts.reduce((sum, shift) => sum + shift.cashTipsCents + shift.ccTipsCents, 0),
    tipOutCents: shifts.reduce((sum, shift) => sum + (shift.immediateTipOutCents ?? 0) + (shift.withheldTipOutCents ?? 0) + (shift.deferredTipOutCents ?? 0), 0),
    netTipsCents: shifts.reduce((sum, shift) => sum + shift.netTipsCents, 0),
    byJob: (household.workJobs ?? []).map((job) => {
      const rows = shifts.filter((shift) => shift.jobId === job.id);
      return { job, shifts: rows.length, cents: rows.reduce((sum, shift) => sum + shift.wagesCents + shift.netTipsCents, 0), hours: rows.reduce((sum, shift) => sum + shift.hours, 0) };
    }).filter((row) => row.shifts > 0),
  };
}
