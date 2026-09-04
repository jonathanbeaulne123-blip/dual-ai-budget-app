import { parseDateKey, type DateKey } from "../calendar.ts";
import type { Household, WorkPaySchedule } from "../types.ts";
import { shapeWorkSchedule, workPayScheduleIsValid } from "../work.ts";

export type OnboardingCadenceProbe = {
  complete: boolean;
  memberId: string;
  schedule: WorkPaySchedule | null;
  sourceId: string | null;
  observedAt: string | null;
  detailSkippedAt: string | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function ordinal(day: number): string {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${day}th`;
  return `${day}${day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th"}`;
}

function weekdayForAnchor(anchorDate: DateKey): string {
  const parsed = parseDateKey(anchorDate);
  return WEEKDAYS[new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()]!;
}

/** One calm household sentence. It deliberately carries timing and no amount. */
export function onboardingCadenceSentence(name: string, schedule: WorkPaySchedule): string {
  if (schedule.cadence === "irregular") return `${name} doesn't have a fixed payday.`;
  if (schedule.cadence === "weekly") return `${name} is paid every ${weekdayForAnchor(schedule.anchorDate)}.`;
  if (schedule.cadence === "biweekly") return `${name} is paid every second ${weekdayForAnchor(schedule.anchorDate)}.`;
  if (schedule.cadence === "twice-monthly") {
    const days = [...new Set(schedule.monthDays)].sort((left, right) => left - right).map(ordinal);
    return `${name} is paid on the ${days.join(" and ")} of each month.`;
  }
  return `${name} is paid on dates they choose.`;
}

/**
 * Chapter 8 is self-owned: the viewer's public timing can satisfy only that
 * viewer's probe. Existing member-owned job schedules count without copying
 * any employer, rate, account, note, or shift detail into the evidence card.
 */
export function onboardingCadenceProbe(household: Household, memberId: string): OnboardingCadenceProbe {
  const member = household.members.find((row) => row.active && row.id === memberId);
  if (!member) return { complete: false, memberId, schedule: null, sourceId: null, observedAt: null, detailSkippedAt: null };

  if (workPayScheduleIsValid(member.earningCadence) && member.earningCadenceUpdatedAt) {
    const schedule = shapeWorkSchedule(member.earningCadence, member.earningCadence.anchorDate);
    if (!Number.isNaN(Date.parse(member.earningCadenceUpdatedAt))) {
      return {
        complete: true,
        memberId,
        schedule,
        sourceId: `earning-cadence:${member.id}`,
        observedAt: new Date(member.earningCadenceUpdatedAt).toISOString(),
        detailSkippedAt: member.earningDetailSkippedAt ?? null,
      };
    }
  }

  const job = (household.workJobs ?? [])
    .filter((row) => row.active && row.memberId === member.id && workPayScheduleIsValid(row.paySchedule))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))[0];
  if (!job || Number.isNaN(Date.parse(job.updatedAt))) {
    return { complete: false, memberId, schedule: null, sourceId: null, observedAt: null, detailSkippedAt: null };
  }
  return {
    complete: true,
    memberId,
    schedule: shapeWorkSchedule(job.paySchedule, job.paySchedule.anchorDate),
    sourceId: job.id,
    observedAt: new Date(job.updatedAt).toISOString(),
    detailSkippedAt: null,
  };
}
