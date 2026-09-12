import type { Household } from "./types.ts";
import { addDays, isValidDateKey, weekdaySunday0, type DateKey } from "./calendar.ts";
import { parsePadDecimal } from "./cadPad.ts";
import { suggestCategory } from "./autoCode.ts";
import type { TaskCue, TaskRepeat } from "./tasks.ts";

/**
 * Natural-language capture with money. `pay hydro friday $140` becomes a title,
 * a do date, and an expected amount; `by friday` is a deadline; `after payday`
 * is a cue; `every 2 weeks` repeats; `@Bianca` or `for Bianca` assigns;
 * `#wedding` files it in a list; `private` keeps it to yourself.
 *
 * Presentation only: the parse never posts, and the category guess is a hint
 * the Add flow may use later.
 */
export type TaskCapture = {
  title: string;
  doDate: DateKey | null;
  dueDate: DateKey | null;
  expectedAmountCents: number | null;
  repeat: TaskRepeat;
  cue: TaskCue;
  assigneeId: string | null;
  listName: string | null;
  visibility: "household" | "personal";
  subcategoryId: string | null;
  /** What the parser understood, for the confirmation line under the capture bar. */
  understood: string[];
};
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function nextWeekday(today: DateKey, weekday: number, skipWeek: boolean): DateKey {
  const delta = ((weekday - weekdaySunday0(today)) + 7) % 7;
  return addDays(today, (delta === 0 ? 7 : delta) + (skipWeek ? 7 : 0));
}
function dayOfMonthOnOrAfter(today: DateKey, day: number, month?: number): DateKey {
  let year = Number(today.slice(0, 4)), m = month ?? Number(today.slice(5, 7));
  for (let i = 0; i < 24; i += 1) {
    const candidate = `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isValidDateKey(candidate) && candidate >= today) return candidate;
    if (month === undefined || (m === month && candidate < today)) { m += 1; if (m > 12) { m = 1; year += 1; } if (month !== undefined) { m = month; year += 1; } }
    else break;
  }
  return today;
}
type DateHit = { date: DateKey; text: string };
function findDate(lower: string, today: DateKey): DateHit | null {
  let m: RegExpMatchArray | null;
  if ((m = /\b(today|tonight)\b/.exec(lower))) return { date: today, text: m[0] };
  if ((m = /\btomorrow\b/.exec(lower))) return { date: addDays(today, 1), text: m[0] };
  if ((m = /\bnext week\b/.exec(lower))) return { date: nextWeekday(today, 1, false), text: m[0] };
  if ((m = /\bin (\d{1,2}) days?\b/.exec(lower))) return { date: addDays(today, Number(m[1])), text: m[0] };
  if ((m = /\b(next |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/.exec(lower))) {
    const word = m[2]!.slice(0, 3);
    const weekday = WEEKDAYS.findIndex((w) => w.startsWith(word)) >= 0 ? WEEKDAYS.findIndex((w) => w.startsWith(word)) : SHORT.indexOf(word);
    return { date: nextWeekday(today, weekday, m[1]?.trim() === "next"), text: m[0] };
  }
  if ((m = /\b(\d{4}-\d{2}-\d{2})\b/.exec(lower)) && isValidDateKey(m[1]!)) return { date: m[1]!, text: m[0] };
  if ((m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (\d{1,2})(?:st|nd|rd|th)?\b/.exec(lower))) return { date: dayOfMonthOnOrAfter(today, Number(m[2]), MONTHS.indexOf(m[1]!) + 1), text: m[0] };
  if ((m = /\b(\d{1,2})(?:st|nd|rd|th)? (?:of )?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.exec(lower))) return { date: dayOfMonthOnOrAfter(today, Number(m[1]), MONTHS.indexOf(m[2]!) + 1), text: m[0] };
  if ((m = /\b(?:on )?the (\d{1,2})(?:st|nd|rd|th)\b/.exec(lower))) return { date: dayOfMonthOnOrAfter(today, Number(m[1])), text: m[0] };
  return null;
}
function cut(text: string, fragment: string): string {
  const at = text.toLowerCase().indexOf(fragment.toLowerCase());
  return at < 0 ? text : `${text.slice(0, at)} ${text.slice(at + fragment.length)}`;
}

export function parseTaskCapture(text: string, context: { today: DateKey; household: Household; memberId: string }): TaskCapture {
  let rest = text.trim().replace(/\s+/g, " ");
  const understood: string[] = [];
  const out: TaskCapture = { title: "", doDate: null, dueDate: null, expectedAmountCents: null, repeat: "none", cue: "none", assigneeId: null, listName: null, visibility: "household", subcategoryId: null, understood };
  let m: RegExpMatchArray | null;
  // Money: $140, 140$, $1,240.50, CAD 140.
  if ((m = /(?:^|\s)(?:cad\s*)?\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?=\s|$)|(?:^|\s)(\d+(?:\.\d{1,2})?)\s?\$(?=\s|$)/i.exec(rest))) {
    const parsed = parsePadDecimal(m[1] ?? m[2] ?? "");
    if (!parsed.error && parsed.digits) { out.expectedAmountCents = Number(parsed.digits); understood.push(`$${(out.expectedAmountCents / 100).toFixed(2)}`); rest = cut(rest, m[0].trim()); }
  }
  if ((m = /\b(?:every|each) (day|week|2 weeks|two weeks|other week|month|year)\b|\b(daily|weekly|biweekly|fortnightly|monthly|yearly|annually)\b/i.exec(rest))) {
    const word = (m[1] ?? m[2] ?? "").toLowerCase();
    out.repeat = word.startsWith("day") || word === "daily" ? "daily" : /2 weeks|two weeks|other week|biweekly|fortnightly/.test(word) ? "biweekly" : word.startsWith("week") ? "weekly" : word.startsWith("month") ? "monthly" : "yearly";
    understood.push(`repeats ${out.repeat}`); rest = cut(rest, m[0]);
  }
  if ((m = /\b(after|once|when) (?:i'?m |we'?re |i get |we get )?(payday|paid)\b/i.exec(rest))) { out.cue = "after-payday"; understood.push("after payday"); rest = cut(rest, m[0]); }
  if ((m = /\b(private|just me|only me|for me only)\b/i.exec(rest))) { out.visibility = "personal"; understood.push("private"); rest = cut(rest, m[0]); }
  if ((m = /(?:^|\s)#([a-z0-9][a-z0-9_-]{0,40})/i.exec(rest))) { out.listName = m[1]!; understood.push(`list ${m[1]}`); rest = cut(rest, m[0].trim()); }
  const members = context.household.members.filter((member) => member.active);
  for (const member of members) {
    const name = member.name.split(" ")[0]!.toLowerCase();
    if (name.length < 2) continue;
    const re = new RegExp(`(?:^|\\s)(?:@|for )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i");
    if ((m = re.exec(rest))) { out.assigneeId = member.id; understood.push(`for ${member.name}`); rest = cut(rest, m[0].trim()); break; }
  }
  if ((m = /\b(by|before|due|deadline) /i.exec(rest))) {
    const hit = findDate(rest.slice(m.index! + m[0].length).toLowerCase(), context.today);
    if (hit) { out.dueDate = hit.date; understood.push(`due ${hit.date}`); rest = cut(rest, `${m[0]}${hit.text}`); }
  }
  const hit = findDate(rest.toLowerCase(), context.today);
  if (hit) { out.doDate = hit.date; understood.push(`on ${hit.date}`); rest = cut(rest, hit.text); rest = rest.replace(/\b(on|this|next)\s*$/i, ""); }
  if (out.doDate && out.dueDate && out.doDate > out.dueDate) out.doDate = out.dueDate;
  if (out.visibility === "personal" && out.assigneeId && out.assigneeId !== context.memberId) out.assigneeId = null;
  out.title = rest.replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();
  if (!out.title) out.title = text.trim();
  out.title = out.title.charAt(0).toUpperCase() + out.title.slice(1);
  if (out.expectedAmountCents !== null) { const guess = suggestCategory(context.household, out.title); if (guess && guess.confidence >= 0.5) out.subcategoryId = guess.subcategoryId; }
  return out;
}
