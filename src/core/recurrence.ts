import { addDays, parseDateKey, weekdaySunday0, type DateKey } from "./calendar.ts";
import type { HouseholdCalendar, Recurrence, RecurrenceCadence, RecurrenceKind } from "./types.ts";

export const DEFAULT_REMINDER_HOURS_BEFORE = 24;
export const HEARTH_REMINDER_HOUR = 9;
export const EMPTY_CALENDAR: HouseholdCalendar = { dismissedRhythmKeys: [], dismissedNoticeKeys: [] };

const WEEKDAY_ICAL = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** Same month-add the household already posts with. Jan 31 becomes a March date when February is short. */
export function advanceCadence(date: DateKey, cadence: RecurrenceCadence): DateKey {
  const { year, month, day } = parseDateKey(date);
  if (cadence === "weekly") return addDays(date, 7);
  if (cadence === "biweekly") return addDays(date, 14);
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function nextOnOrAfter(start: DateKey, cadence: RecurrenceCadence, today: DateKey): DateKey {
  let cursor = start;
  for (let i = 0; i < 48 && cursor < today; i += 1) {
    cursor = advanceCadence(cursor, cadence);
  }
  return cursor;
}

export function projectCadence(start: DateKey, cadence: RecurrenceCadence, from: DateKey, to: DateKey): DateKey[] {
  let cursor = start;
  for (let i = 0; i < 48 && cursor < from; i += 1) {
    cursor = advanceCadence(cursor, cadence);
  }
  const dates: DateKey[] = [];
  while (cursor <= to && dates.length < 24) {
    if (cursor >= from) dates.push(cursor);
    cursor = advanceCadence(cursor, cadence);
  }
  return dates;
}

export function googleRrule(nextDate: DateKey, cadence: RecurrenceCadence): string {
  const byDay = WEEKDAY_ICAL[weekdaySunday0(nextDate)];
  if (cadence === "weekly") return `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
  if (cadence === "biweekly") return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${byDay}`;
  return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${parseDateKey(nextDate).day}`;
}

export function inferRecurrenceKind(input: {
  type: "expense" | "income";
  note: string;
  subcategoryName?: string;
}): RecurrenceKind {
  if (input.type === "income") return "paycheck";
  const hay = `${input.note} ${input.subcategoryName ?? ""}`.toLowerCase();
  if (/\b(netflix|spotify|disney|prime|apple|phone|phones|gym|membership|subscription|icloud|crave)\b/.test(hay)) {
    return "subscription";
  }
  if (/\b(rent|hydro|electric|gas|insurance|property tax|utility|water|internet|heat)\b/.test(hay)) {
    return "bill";
  }
  return "bill";
}

export function shapeRecurrence(item: Recurrence, fallbackIso: string): Recurrence {
  const createdAt = item.createdAt || fallbackIso;
  const type = item.type === "income" || item.type === "transfer" ? item.type : "expense";
  return {
    ...item,
    type,
    transferToAccountId: typeof item.transferToAccountId === "string" && item.transferToAccountId
      ? item.transferToAccountId
      : null,
    goalId: typeof item.goalId === "string" && item.goalId ? item.goalId : null,
    kind: item.kind ?? (type === "transfer"
      ? "other"
      : inferRecurrenceKind({ type, note: item.note })),
    origin: item.origin ?? "manual",
    reminderHoursBefore: item.reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE,
    googleSync: item.googleSync ?? {},
    createdAt,
    updatedAt: item.updatedAt || createdAt,
    autoPost: item.autoPost === true,
    active: item.active !== false,
  };
}

export function shapeCalendar(calendar: HouseholdCalendar | undefined): HouseholdCalendar {
  return {
    dismissedRhythmKeys: [...new Set(calendar?.dismissedRhythmKeys ?? [])].sort(),
    dismissedNoticeKeys: [...new Set(calendar?.dismissedNoticeKeys ?? [])].sort(),
  };
}

export function mergeCalendars(left?: HouseholdCalendar, right?: HouseholdCalendar): HouseholdCalendar {
  return shapeCalendar({
    dismissedRhythmKeys: [...(left?.dismissedRhythmKeys ?? []), ...(right?.dismissedRhythmKeys ?? [])],
    dismissedNoticeKeys: [...(left?.dismissedNoticeKeys ?? []), ...(right?.dismissedNoticeKeys ?? [])],
  });
}
