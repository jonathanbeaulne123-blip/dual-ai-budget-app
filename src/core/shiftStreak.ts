import { addDays, type DateKey } from "./calendar.ts";
import { formatCad } from "./money.ts";
import type { Household } from "./types.ts";

export type ShiftStreak = {
  /** Consecutive posted shift *dates*, walking back from the latest shift — not from today. A Monday off does not break Friday–Sunday. */
  count: number;
  lastDate: DateKey | null;
  /** Latest shift is today or yesterday. Hercules may jump. */
  fresh: boolean;
  /** They have posted shifts, but the latest is older than two days. Prompt, never punish. */
  waiting: boolean;
  spoken: string;
  lesson: string;
};

function uniqueShiftDates(household: Household): DateKey[] {
  const dates = new Set<DateKey>();
  for (const shift of household.shifts) {
    if (shift.date) dates.add(shift.date);
  }
  return [...dates].sort();
}

function consecutiveEndingAt(sorted: DateKey[], end: DateKey): number {
  let streak = 0;
  let cursor = end;
  const set = new Set(sorted);
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function shiftPostingStreak(household: Household, today: DateKey): ShiftStreak {
  const dates = uniqueShiftDates(household);
  const lastDate = dates[dates.length - 1] ?? null;
  if (!lastDate) {
    return {
      count: 0,
      lastDate: null,
      fresh: false,
      waiting: false,
      spoken: "If you worked, post the shift. I'll do the math with you.",
      lesson: "Tips are income. Guessing is not.",
    };
  }
  const count = consecutiveEndingAt(dates, lastDate);
  const yesterday = addDays(today, -1);
  const fresh = lastDate === today || lastDate === yesterday;
  const waiting = lastDate < addDays(today, -2);
  const tips = household.shifts
    .filter((shift) => shift.date === lastDate)
    .reduce((sum, shift) => sum + shift.netTipsCents, 0);
  if (fresh && count >= 2) {
    return {
      count,
      lastDate,
      fresh,
      waiting: false,
      spoken: `${count} shifts on the counter. Tips in the journal.`,
      lesson: "A streak is posted shifts, not opening the app. Vacation does not kill me.",
    };
  }
  if (fresh) {
    return {
      count,
      lastDate,
      fresh,
      waiting: false,
      spoken: lastDate === today
        ? `Shift's in. Net tips ${formatCad(tips)}.`
        : "Yesterday's shift is in the books. I loaf.",
      lesson: "I jump when tips land. I don't guilt a day off.",
    };
  }
  if (waiting) {
    return {
      count,
      lastDate,
      fresh: false,
      waiting: true,
      spoken: "If you worked, the tips are still in your pocket.",
      lesson: "Log the shift when you're home. I will not fake a missed day.",
    };
  }
  return {
    count,
    lastDate,
    fresh,
    waiting: false,
    spoken: "Shifts live in the journal when you post them.",
    lesson: "I don't keep a hunger meter for a day off.",
  };
}
