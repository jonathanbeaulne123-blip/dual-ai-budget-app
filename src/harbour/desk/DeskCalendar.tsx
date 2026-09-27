import { useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { WEEKDAY_SHORT, formatDayLabel, formatMonthLabel, monthKeyFromDateKey, shiftMonthKey, type MonthKey } from "../../core/calendar.ts";
import { CHIP_MARKS, readMonth, readWeek, type DeskMonthDay, type DeskWeek, type DeskWeekChip } from "./calendarModel.ts";
import { engravedCents } from "./engraved.ts";
import type { DeskPageProps } from "./types.ts";
import "./desk-calendar.css";

/**
 * Calendar — the Desk's light calendar (SIMPLE_VIEW_DESK S4 §4). This week as
 * seven days of chips (due, posted, payday, shift, sit-down), then this month
 * as a small grid: the Calendar's own copper heat on the heavy days and each
 * kind's glyph; press a day for its short list. One door unfolds the full
 * Calendar. It is a reading, not the calendar: nothing here schedules, moves
 * or posts anything.
 */
export function DeskCalendar({ household, memberId, scope, today, onOpen }: DeskPageProps) {
  const week = useMemo(() => readWeek(household, memberId, scope, today), [household, memberId, scope, today]);
  // K2 (Tool Atlas §7): the Time Machine screen is retired; the Desk's Calendar reads any month with the
  // Calendar's own controls (‹ Previous month · Next month › · This month). Reading only.
  const thisMonth = monthKeyFromDateKey(today);
  const [monthKey, setMonthKey] = useState<MonthKey>(thisMonth);
  const month = useMemo(() => readMonth(household, memberId, scope, today, monthKey), [household, memberId, scope, today, monthKey]);
  const ids = useId();
  return <div className="desk-calendar" data-desk-calendar={scope}>
    <WeekStrip week={week} headingId={`${ids}-week`} />
    <div className="desk-month__picker" role="group" aria-label="Month" data-desk-month-picker="">
      <button type="button" className="chip" aria-label="Previous month" onClick={() => setMonthKey(current => shiftMonthKey(current, -1))}>‹</button>
      <strong>{formatMonthLabel(monthKey)}</strong>
      <button type="button" className="chip" aria-label="Next month" onClick={() => setMonthKey(current => shiftMonthKey(current, 1))}>›</button>
      {monthKey !== thisMonth && <button type="button" className="chip quiet" onClick={() => setMonthKey(thisMonth)}>This month</button>}
    </div>
    <MiniMonth key={month.monthKey} days={month.days} lead={month.lead} label={month.monthLabel} kinds={month.kinds} today={today} baseId={ids} personal={scope === "personal"} />
    <div className="desk-calendar__doors">
      <button type="button" className="desk-door desk-door--unfold" data-desk-door="calendar" onClick={() => onOpen("calendar")}>
        <span aria-hidden="true">▦</span> Unfold the Calendar
      </button>
    </div>
  </div>;
}

function chipWords(chip: DeskWeekChip): string {
  return chip.amountCents === null ? chip.text : `${chip.text} · ${engravedCents(chip.amountCents)}`;
}

function WeekStrip({ week, headingId }: { week: DeskWeek; headingId: string }) {
  const first = week.days[0], last = week.days[week.days.length - 1];
  const range = first && last ? `${formatDayLabel(first.date)} – ${formatDayLabel(last.date)}` : "";
  const busy = week.days.some(day => day.chips.length > 0);
  const line = week.source === "fund"
    ? week.outCents === null ? "The shared Fund’s week could not be read." : `${week.outCents > 0 ? `${engravedCents(week.outCents)} leaves the Fund` : "Nothing leaves the Fund"}${week.inCents ? ` · ${engravedCents(week.inCents)} landed` : ""}`
    : busy ? "Your own calendar, these seven days" : "Nothing on your calendar these seven days";
  return <section className="desk-card desk-week" data-desk-week={week.source} aria-labelledby={headingId}>
    <header className="desk-week__head">
      <h2 className="desk-card__kicker" id={headingId}>This week · {range}</h2>
      <p className="desk-card__line">{line}</p>
    </header>
    <ol className="desk-week__days">
      {week.days.map(day => <li key={day.date} className="desk-week__day" data-desk-week-day={day.date} data-today={day.isToday || undefined}
        aria-current={day.isToday ? "date" : undefined}>
        <p className="desk-week__date">
          <span className="desk-week__weekday">{WEEKDAY_SHORT[day.weekday]}</span>
          <span className="desk-week__number">{Number(day.date.slice(8, 10))}</span>
          {day.isToday && <span className="desk-week__today">today</span>}
        </p>
        {day.chips.length > 0
          ? <ul className="desk-week__chips">
            {day.chips.map((chip, i) => <li key={`${chip.kind}-${i}`} className="desk-week-chip" data-chip-kind={chip.kind}>
              <span className="desk-week-chip__glyph" aria-hidden="true">{CHIP_MARKS[chip.kind].glyph}</span>
              <span className="sr-only">{CHIP_MARKS[chip.kind].word}: </span>
              <span className="desk-week-chip__text">{chipWords(chip)}</span>
            </li>)}
          </ul>
          : <p className="desk-week__quiet">quiet</p>}
      </li>)}
    </ol>
    <p className="desk-week__key" aria-hidden="true">
      {(["due", "posted", "payday", "shift", "sitdown"] as const).map(kind => <span key={kind} data-chip-kind={kind}><b>{CHIP_MARKS[kind].glyph}</b> {CHIP_MARKS[kind].word}</span>)}
    </p>
  </section>;
}

function dayName(date: string): string {
  return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function MiniMonth({ days, lead, label, kinds, today, baseId, personal }: {
  days: DeskMonthDay[]; lead: number; label: string; kinds: { glyph: string; word: string }[]; today: string; baseId: string; personal: boolean;
}) {
  const [selected, setSelected] = useState(() => days.find(day => day.date === today)?.date ?? days[0]?.date ?? today);
  const grid = useRef<HTMLDivElement>(null);
  const detailId = `${baseId}-day`;
  const index = Math.max(0, days.findIndex(day => day.date === selected));
  const day = days[index];

  function move(event: ReactKeyboardEvent<HTMLButtonElement>, at: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? 7 : event.key === "ArrowUp" ? -7
      : event.key === "Home" ? -((at + lead) % 7) : event.key === "End" ? 6 - ((at + lead) % 7) : null;
    if (step === null) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(days.length - 1, at + step));
    setSelected(days[next]!.date);
    grid.current?.querySelectorAll<HTMLButtonElement>("[data-desk-day]")[next]?.focus();
  }

  return <section className="desk-card desk-month" aria-labelledby={`${baseId}-month`}>
    <h2 className="desk-card__kicker" id={`${baseId}-month`}>{label} · {personal ? "your calendar" : "the shared calendar"}</h2>
    <div className="desk-month__weekdays" aria-hidden="true">{WEEKDAY_SHORT.map(name => <span key={name}>{name.slice(0, 1)}</span>)}</div>
    <div className="desk-month__grid" ref={grid} role="group" aria-label={`${label}, day by day. Arrow keys move between days.`}>
      {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} className="desk-month__blank" aria-hidden="true" />)}
      {days.map((entry, i) => {
        const heat = entry.heat > 0 ? entry.heavy ? "hot" : "warm" : undefined;
        const words = entry.items.length ? ` · ${entry.items.length === 1 ? "1 thing" : `${entry.items.length} things`}: ${entry.items.map(item => item.title).join("; ")}` : " · nothing on the calendar";
        return <button key={entry.date} type="button" className="desk-month__day" data-desk-day={entry.date} data-desk-heat={heat}
          data-today={entry.isToday || undefined} style={entry.heat > 0 ? { ["--desk-heat" as string]: String(Math.round((0.08 + entry.heat * 0.3) * 100) / 100) } : undefined}
          tabIndex={entry.date === selected ? 0 : -1} aria-pressed={entry.date === selected} aria-current={entry.isToday ? "date" : undefined} aria-controls={detailId}
          aria-label={`${dayName(entry.date)}${entry.isToday ? " · today" : ""}${entry.heavy ? " · heavy day" : ""}${words}`}
          onClick={() => setSelected(entry.date)} onKeyDown={event => move(event, i)}>
          <span className="desk-month__num">{entry.day}</span>
          {entry.glyphs.length > 0 && <span className="desk-month__glyphs" aria-hidden="true">{entry.glyphs.join("")}</span>}
        </button>;
      })}
    </div>
    {kinds.length > 0 && <p className="desk-month__legend">{kinds.map(kind => <span key={`${kind.glyph}${kind.word}`}><b aria-hidden="true">{kind.glyph}</b> {kind.word}</span>)}<span><i className="desk-month__heat-key" aria-hidden="true" /> heavy day</span></p>}
    <div className="desk-month__detail" id={detailId} data-desk-day-detail={day?.date} aria-live="polite">
      {day && <>
        <h3 className="desk-month__detail-title">{formatDayLabel(day.date)}{day.isToday ? " · today" : ""}{day.heavy ? <span className="desk-month__heavy"> · heavy day</span> : null}</h3>
        {day.items.length === 0
          ? <p className="desk-card__line">Nothing on this day.</p>
          : <ul className="desk-month__items">
            {day.items.map(item => <li key={item.id} className="desk-month__item" data-desk-day-item={item.id}>
              <span className="desk-month__item-glyph" aria-hidden="true">{item.glyph}</span>
              <span className="desk-month__item-words">
                <span className="desk-month__item-title"><span className="sr-only">{item.word}: </span>{item.title}</span>
                <span className="desk-month__item-owner">{item.owner} · {item.statusLabel}</span>
              </span>
              {item.amountCents !== null && <span className={`desk-month__item-amount${item.direction === "in" ? " is-in" : ""}`}>{item.direction === "in" ? "+" : ""}{engravedCents(item.amountCents)}</span>}
            </li>)}
          </ul>}
      </>}
    </div>
  </section>;
}
