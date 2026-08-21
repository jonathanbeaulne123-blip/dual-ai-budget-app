/** America/Toronto is the only calendar the household uses. Never use the runtime's local midnight. */

export const TIMEZONE = "America/Toronto" as const;

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export type DateKey = string; // YYYY-MM-DD
export type MonthKey = string; // YYYY-MM

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return MONTH_LENGTHS[month - 1] ?? 0;
}

export function daysInMonthKey(monthKey: MonthKey): number {
  const parsed = parseMonthKey(monthKey);
  return daysInMonth(parsed.year, parsed.month);
}

export function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function parseDateKey(value: string): { year: number; month: number; day: number } {
  if (!isValidDateKey(value)) throw new Error("Date must be a valid Toronto calendar date in YYYY-MM-DD format.");
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) };
}

export function parseMonthKey(value: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("Month must use YYYY-MM format.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("Month must use YYYY-MM format.");
  return { year, month };
}

export function dateKeyInZone(date: Date, timeZone = TIMEZONE): DateKey {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  if (!isValidDateKey(formatted)) {
    throw new Error(`Could not derive a Toronto calendar date from ${date.toISOString()}.`);
  }
  return formatted;
}

export function todayKey(now = new Date(), timeZone = TIMEZONE): DateKey {
  return dateKeyInZone(now, timeZone);
}

export function monthKeyFromDateKey(dateKey: DateKey): MonthKey {
  parseDateKey(dateKey);
  return dateKey.slice(0, 7);
}

export function shiftMonthKey(monthKey: MonthKey, delta: number): MonthKey {
  const { year, month } = parseMonthKey(monthKey);
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function monthStartKey(monthKey: MonthKey): DateKey {
  parseMonthKey(monthKey);
  return `${monthKey}-01`;
}

export function monthEndKey(monthKey: MonthKey): DateKey {
  const { year, month } = parseMonthKey(monthKey);
  return `${monthKey}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
}

export function addDays(dateKey: DateKey, days: number): DateKey {
  const { year, month, day } = parseDateKey(dateKey);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

/** Sunday = 0, matching the existing household week. Computed from the civil date, not local midnight. */
export function weekdaySunday0(dateKey: DateKey): number {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function weekBounds(today: DateKey): { start: DateKey; end: DateKey } {
  const start = addDays(today, -weekdaySunday0(today));
  return { start, end: addDays(start, 6) };
}

export function lastWeekBounds(today: DateKey): { start: DateKey; end: DateKey } {
  const thisWeek = weekBounds(today);
  return { start: addDays(thisWeek.start, -7), end: addDays(thisWeek.start, -1) };
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Signed civil-day distance from `from` to `to`. 2026-08-18 vs 2026-08-13 is +5. */
export function calendarDaysBetween(from: DateKey, to: DateKey): number {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  const ms = Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day);
  return Math.round(ms / 86400000);
}

export function inInclusiveRange(dateKey: DateKey, start: DateKey, end: DateKey): boolean {
  return dateKey >= start && dateKey <= end;
}

export function formatDateLabel(dateKey: DateKey): string {
  const { year, month, day } = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function formatMonthLabel(monthKey: MonthKey): string {
  const { year, month } = parseMonthKey(monthKey);
  return new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatDayLabel(dateKey: DateKey): string {
  const { year, month, day } = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function relativeTimeAgo(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((now.getTime() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins === 1 ? "1 min ago" : `${mins} mins ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
