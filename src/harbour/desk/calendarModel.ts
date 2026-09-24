/**
 * The Desk's Calendar page, read (SIMPLE_VIEW_DESK S4 §4). Pure functions over
 * shipped selectors only — nothing here posts, schedules or moves money, and
 * nothing here adds up a day a second way:
 *
 * - the week strip, Shared: `fundWeek(h, today)` — the Fund's own Monday-to-
 *   Sunday read (due, posted, payday, shift, sit-down), exactly what the
 *   Fund's Week stage draws;
 * - the week strip, Personal: the Fund's week is a household-Fund read, so
 *   Personal reads the same seven days off the member's own calendar board
 *   (`calendarPresentation` → `buildMonthBoard` → `calendarDisplayDays`, the
 *   Calendar page's own pipeline), sorted into the same chip words;
 * - the mini month: the Calendar page's own board and heat (`day.heat`, the
 *   day's scheduled outflow against the month's heaviest day), with each
 *   item's kind glyph from `KIND_REGISTRY` and its owner/status from
 *   `calendarItemReading` — so a day that reads heavy here reads heavy when
 *   the Calendar is unfolded.
 *
 * A member the ledger does not know reads an empty week and an empty month,
 * never a throw.
 */
import { addDays, formatMonthLabel, monthKeyFromDateKey, weekdaySunday0, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { buildMonthBoard, type BoardDay } from "../../core/board.ts";
import { fundWeek, type WeekEntryKind } from "../../core/fundWeek.ts";
import { calendarPresentation } from "../../core/ledgerExperience.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import { calendarDisplayDays, calendarItemReading, type CalendarDisplayItem } from "../../calendar/presentation.ts";
import { KIND_REGISTRY, kindEntry, kindsPresent } from "../../calendar/semantics.ts";

/** The week's chip words: the Fund week's five, plus `event` for a Personal day's plain calendar thing. */
export type DeskChipKind = WeekEntryKind | "event";

export type DeskWeekChip = {
  kind: DeskChipKind;
  /** The words on the chip, amount excluded. */
  text: string;
  /** Null when the chip carries no amount (a shift, a sit-down, an expected payday). */
  amountCents: number | null;
};

export type DeskWeekDay = { date: DateKey; weekday: number; isToday: boolean; chips: DeskWeekChip[] };

export type DeskWeek = {
  days: DeskWeekDay[];
  /** Which read drew the strip: the shared Fund's week, or the member's own calendar. */
  source: "fund" | "calendar";
  /** Fund only: what leaves and lands this calendar week. Null in Personal and when unread. */
  outCents: number | null;
  inCents: number | null;
};

/** Every chip kind's glyph and word. Glyphs come from `KIND_REGISTRY` where the calendar already has one. */
export const CHIP_MARKS: Readonly<Record<DeskChipKind, { glyph: string; word: string }>> = Object.freeze({
  due: { glyph: KIND_REGISTRY.bill.glyph, word: "Due" },
  posted: { glyph: "✓", word: "Posted" },
  payday: { glyph: KIND_REGISTRY.paycheck.glyph, word: "Payday" },
  shift: { glyph: KIND_REGISTRY.shift.glyph, word: "Shift" },
  sitdown: { glyph: KIND_REGISTRY.event.glyph, word: "Sit down" },
  event: { glyph: KIND_REGISTRY.other.glyph, word: "On the calendar" },
});

function memberActive(household: Household, memberId: string): boolean {
  return household.members.some(member => member.id === memberId && member.active);
}

function nameOf(household: Household, id: string | null | undefined): string {
  return household.members.find(member => member.id === id)?.name ?? "A member";
}

/** Monday of the calendar week containing `date` — the Fund week's own anchor. */
function mondayOf(date: DateKey): DateKey {
  return addDays(date, -((weekdaySunday0(date) + 6) % 7));
}

function emptyWeek(today: DateKey, source: DeskWeek["source"]): DeskWeek {
  const start = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => { const date = addDays(start, i); return { date, weekday: weekdaySunday0(date), isToday: date === today, chips: [] }; });
  return { days, source, outCents: null, inCents: null };
}

/** The Calendar page's own household for a scope: scoped facts plus every account the member may plan with. */
function calendarHousehold(household: Household, memberId: string, scope: LedgerView): Household | null {
  if (!memberActive(household, memberId)) return null;
  try { return calendarPresentation(household, memberId, scope); } catch { return null; }
}

/** The Calendar page's board for a month, with completed occurrences folded in as the page shows them. */
function displayMonth(scoped: Household, monthKey: MonthKey, today: DateKey) {
  const board = buildMonthBoard(scoped, monthKey, today);
  return { board, days: calendarDisplayDays(board.days, scoped) };
}

/** A Personal calendar item, sorted into the week's chip words. */
function chipForItem(item: CalendarDisplayItem, scoped: Household): DeskWeekChip {
  const money = item.direction === "in" || item.direction === "out" ? item.amountCents : null;
  if (item.kind === "shift" || item.source === "shift") return { kind: "shift", text: `${nameOf(scoped, item.memberId)} · shift`, amountCents: null };
  if (item.completed) return { kind: "posted", text: item.title, amountCents: money };
  if (item.direction === "in") return { kind: "payday", text: item.title, amountCents: money };
  if (item.direction === "out") return { kind: "due", text: item.title, amountCents: money };
  return { kind: "event", text: item.title, amountCents: null };
}

/**
 * The seven days, Monday through Sunday. Shared reads the Fund's week; Personal
 * reads the member's own calendar for the same seven days.
 */
export function readWeek(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskWeek {
  if (scope === "household") {
    if (!memberActive(household, memberId)) return emptyWeek(today, "fund");
    try {
      const week = fundWeek(household, today);
      return {
        source: "fund",
        outCents: week.outCents,
        inCents: week.inCents,
        days: week.days.map(day => ({
          date: day.date, weekday: day.weekday, isToday: day.isToday,
          chips: day.entries.map((entry): DeskWeekChip => {
            if (entry.kind === "shift") return { kind: "shift", text: `${nameOf(household, entry.memberId)} · shift`, amountCents: null };
            if (entry.kind === "sitdown") return { kind: "sitdown", text: "Sit down", amountCents: null };
            if (entry.kind === "payday") return { kind: "payday", text: `${nameOf(household, entry.memberId)} paid`, amountCents: entry.amountCents };
            return { kind: entry.kind, text: entry.label, amountCents: entry.amountCents };
          }),
        })),
      };
    } catch { return emptyWeek(today, "fund"); }
  }
  const scoped = calendarHousehold(household, memberId, scope);
  if (!scoped) return emptyWeek(today, "calendar");
  try {
    const week = emptyWeek(today, "calendar");
    const months = new Map<MonthKey, ReturnType<typeof displayMonth>["days"]>();
    for (const day of week.days) {
      const monthKey = monthKeyFromDateKey(day.date);
      if (!months.has(monthKey)) months.set(monthKey, displayMonth(scoped, monthKey, today).days);
      const shown = months.get(monthKey)!.find(row => row.date === day.date);
      day.chips = (shown?.items ?? []).map(item => chipForItem(item, scoped));
    }
    return week;
  } catch { return emptyWeek(today, "calendar"); }
}

export type DeskMonthItem = {
  id: string;
  glyph: string;
  /** The calendar's own word for the kind ("Bill", "Pay", "Shift"…). */
  word: string;
  title: string;
  owner: string;
  statusLabel: string;
  /** Money in or out; null for a shift, an event or a plan with no figure. */
  amountCents: number | null;
  direction: CalendarDisplayItem["direction"];
};

export type DeskMonthDay = {
  date: DateKey;
  day: number;
  isToday: boolean;
  /** 0..1 — the Calendar page's own `day.heat`. */
  heat: number;
  /** The Calendar page's "heavy day" line: heat above 0.55. */
  heavy: boolean;
  /** Distinct kind glyphs on the day, registry order, at most three. */
  glyphs: string[];
  items: DeskMonthItem[];
};

export type DeskMonth = {
  monthKey: MonthKey;
  monthLabel: string;
  /** Leading blank cells before the 1st, Sunday-first like the Calendar grid. */
  lead: number;
  days: DeskMonthDay[];
  /** The kinds on the month, glyph and word, for the legend. */
  kinds: { glyph: string; word: string }[];
};

/** The Calendar page's "heavy day" threshold, kept in one place. */
export const HEAVY_DAY = 0.55;

function monthItem(item: CalendarDisplayItem, scoped: Household): DeskMonthItem {
  const entry = kindEntry(item.kind);
  const reading = calendarItemReading(item, scoped);
  const money = (item.direction === "in" || item.direction === "out") && item.amountCents > 0 ? item.amountCents : null;
  return { id: item.id, glyph: entry.glyph, word: entry.word, title: item.title, owner: reading.owner, statusLabel: reading.statusLabel, amountCents: money, direction: item.direction };
}

/** The mini month: this month's days with the Calendar page's heat, glyphs and day lists. */
export function readMonth(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskMonth {
  const monthKey = monthKeyFromDateKey(today);
  const monthLabel = formatMonthLabel(monthKey).replace(/\s\d{4}$/, "");
  const lead = weekdaySunday0(`${monthKey}-01`);
  const scoped = calendarHousehold(household, memberId, scope);
  const blank = (days: BoardDay[]): DeskMonth => ({
    monthKey, monthLabel, lead, kinds: [],
    days: days.map(day => ({ date: day.date, day: Number(day.date.slice(8)), isToday: day.isToday, heat: 0, heavy: false, glyphs: [], items: [] })),
  });
  if (!scoped) return blank(monthDays(monthKey, today));
  try {
    const { days } = displayMonth(scoped, monthKey, today);
    const inMonth = days.filter(day => day.inMonth);
    return {
      monthKey, monthLabel, lead,
      kinds: kindsPresent(inMonth.flatMap(day => day.items)).map(kind => ({ glyph: KIND_REGISTRY[kind].glyph, word: KIND_REGISTRY[kind].word }))
        .filter((kind, i, all) => all.findIndex(other => other.glyph === kind.glyph && other.word === kind.word) === i),
      days: inMonth.map(day => {
        const heat = Number.isFinite(day.heat) ? Math.max(0, Math.min(1, day.heat)) : 0;
        return {
          date: day.date, day: Number(day.date.slice(8)), isToday: day.isToday, heat, heavy: heat > HEAVY_DAY,
          glyphs: [...new Set(kindsPresent(day.items).map(kind => KIND_REGISTRY[kind].glyph))].slice(0, 3),
          items: day.items.map(item => monthItem(item, scoped)),
        };
      }),
    };
  } catch { return blank(monthDays(monthKey, today)); }
}

/** Bare days for a month, for the empty read. */
function monthDays(monthKey: MonthKey, today: DateKey): BoardDay[] {
  const out: BoardDay[] = [];
  for (let date = `${monthKey}-01`; monthKeyFromDateKey(date) === monthKey; date = addDays(date, 1)) {
    out.push({ date, inMonth: true, isToday: date === today, isWeekend: false, items: [], outCents: 0, inCents: 0, heat: 0 });
  }
  return out;
}
