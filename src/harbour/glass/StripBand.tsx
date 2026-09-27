import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { monthKeyFromDateKey, shiftMonthKey, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { WORDS, dayName, monthWord } from "./copy.ts";
import { dayMarkers, type DayLedger, type LedgerDay } from "./dayLedger.ts";
import { Marker, TodayMark } from "./Markers.tsx";
import { stripKey } from "./stripKeys.ts";

export type StripBandProps = {
  /** The day ledger for the month on show (`stripLedger`). */
  ledger: DayLedger;
  /** Open the Calendar sheet at this day's week. The band's one tap target. */
  onOpenCalendar: (date: DateKey) => void;
  /** Enter on the Sitdown's flagstone. Without it, Enter opens that day in the Calendar. */
  onOpenSitdown?: (date: DateKey) => void;
  /** "‹ August": one month back. */
  onMonthBack: () => void;
  /** "September ›": one month on, never past the current month. */
  onMonthForward: () => void;
  /** Optional: jump straight to a month (Home from two months back). Otherwise the band steps with back/forward. */
  onMonth?: (month: MonthKey) => void;
  /** Desktop (≥ 1100 px) may keep per-day hits, each ≥ 24 px. On the phone the whole band is one target. */
  perDayHits?: boolean;
};

const cellId = (base: string, date: DateKey) => `${base}-${date}`;

/**
 * The strip band (Tool Atlas §4.1, §6): 40 px — the month as a progress line,
 * today's diamond, the next seven days' markers as small silhouettes,
 * "Covered to …", and the visible "‹ August" tab. At rest it is ONE tap
 * target (→ the Calendar at this week) and ONE Tab stop: a grid whose focus
 * roves across the stones with `aria-activedescendant` (keys in
 * `stripKeys.ts`). The month tabs are pointer targets that keyboard users
 * reach with PgUp / PgDn from inside the band, so the strip stays one stop.
 *
 * No handler here calls `preventDefault`: the band owns no scrolling and no
 * gesture, and the browser's zoom keeps working over it.
 */
export function StripBand({ ledger, onOpenCalendar, onOpenSitdown, onMonthBack, onMonthForward, onMonth, perDayHits = false }: StripBandProps) {
  const base = useId().replace(/:/g, "");
  const helpId = `${base}-help`;
  const inRange = (date: DateKey) => date >= ledger.from && date <= ledger.to;
  const home = inRange(ledger.today) ? ledger.today : ledger.from;
  const [focused, setFocused] = useState<DateKey>(home);
  const [pending, setPending] = useState<DateKey | null>(null);
  const [active, setActive] = useState(false);
  const grid = useRef<HTMLDivElement>(null);

  // A new month arrived: land on the day the keys asked for, or on today / the 1st.
  useEffect(() => {
    if (pending && monthKeyFromDateKey(pending) === ledger.monthKey) {
      setFocused(inRange(pending) ? pending : pending < ledger.from ? ledger.from : ledger.to);
      setPending(null);
    } else if (!inRange(focused)) {
      setFocused(home);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.monthKey, ledger.from, ledger.to]);

  const current = monthKeyFromDateKey(ledger.today);
  const back = shiftMonthKey(ledger.monthKey, -1);
  const forward = ledger.monthKey < current ? shiftMonthKey(ledger.monthKey, 1) : null;
  const weights = useMemo(() => ledger.days.map(day => (day.inWeek ? 4 : 1)), [ledger.days]);
  const progress = useMemo(() => {
    const monthDays = ledger.days.filter(day => day.monthKey === ledger.monthKey);
    if (ledger.monthKey < current) return 1;
    const done = monthDays.filter(day => day.relation !== "future").length;
    return monthDays.length ? done / monthDays.length : 0;
  }, [ledger.days, ledger.monthKey, current]);

  const goMonth = (month: MonthKey) => {
    if (onMonth) { onMonth(month); return; }
    let steps = 0;
    for (let cursor = ledger.monthKey; cursor !== month && steps < 24; cursor = month < cursor ? shiftMonthKey(cursor, -1) : shiftMonthKey(cursor, 1)) {
      if (month < cursor) onMonthBack(); else onMonthForward();
      steps += 1;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = stripKey({ key: event.key, shiftKey: event.shiftKey }, focused, ledger);
    if (!move) return;
    if (move.kind === "focus") setFocused(move.date);
    else if (move.kind === "month") { setPending(move.date); goMonth(move.month); }
    else if (move.kind === "sitdown" && onOpenSitdown) onOpenSitdown(move.date);
    else onOpenCalendar(move.date);
  };

  /** A pointer tap: this week on the phone; the tapped day where per-day hits are on. */
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (perDayHits) {
      const cell = (event.target as Element).closest<HTMLElement>("[data-strip-day]");
      const date = cell?.dataset.stripDay;
      if (date) { setFocused(date); onOpenCalendar(date); return; }
    }
    onOpenCalendar(home);
  };

  const covered = ledger.coveredTo ? WORDS.coveredTo(ledger.coveredTo.date) : null;
  return <section className="glass-strip" aria-label={WORDS.stripRegion} data-strip="" data-strip-month={ledger.monthKey} data-per-day={perDayHits || undefined}>
    <button type="button" className="glass-strip__tab glass-strip__tab--back" tabIndex={-1} onClick={onMonthBack} data-strip-tab="back">
      <span aria-hidden="true">‹ </span>{monthWord(back)}<span className="glass-sr">, one month back</span>
    </button>
    <div className="glass-strip__band">
      <div className="glass-strip__head" aria-hidden="true">
        <span className="glass-strip__month">{monthWord(ledger.monthKey)}</span>
        {covered && <span className="glass-strip__covered">{covered}</span>}
      </div>
      <div ref={grid} className="glass-strip__grid" role="grid" tabIndex={0}
        aria-label={WORDS.stripName(ledger.monthKey)} aria-describedby={helpId} aria-readonly="true"
        aria-activedescendant={inRange(focused) ? cellId(base, focused) : undefined}
        onKeyDown={onKeyDown} onClick={onClick} onFocus={() => setActive(true)} onBlur={() => setActive(false)}
        data-focused={active || undefined}>
        <div className="glass-strip__line" aria-hidden="true">
          <span className="glass-strip__progress" style={{ inlineSize: `${Math.round(progress * 1000) / 10}%` }} />
        </div>
        <div role="row" className="glass-strip__days" style={{ gridTemplateColumns: weights.map(w => `minmax(0, ${w}fr)`).join(" ") }}>
          {ledger.days.map(day => <Stone key={day.date} id={cellId(base, day.date)} day={day} active={day.date === focused} />)}
        </div>
      </div>
      <span id={helpId} className="glass-sr">Arrow keys move a day, Shift with an arrow a week, Page Up and Page Down a month. Home is today.</span>
      {covered && <span className="glass-sr">{covered}</span>}
    </div>
    {forward && <button type="button" className="glass-strip__tab glass-strip__tab--forward" tabIndex={-1} onClick={onMonthForward} data-strip-tab="forward">
      {monthWord(forward)}<span className="glass-sr">, one month on</span><span aria-hidden="true"> ›</span>
    </button>}
  </section>;
}

/** One stone: a tick on the line, today's diamond, and — this week — its first marker, with a dot when there are more. */
function Stone({ id, day, active }: { id: string; day: LedgerDay; active: boolean }) {
  const markers = dayMarkers(day);
  // Past days keep their coins; the next seven days carry everything; the station's gate always stands.
  const shown = day.inWeek ? markers : day.relation === "past" ? markers.filter(kind => kind === "coin") : markers.filter(kind => kind === "gate");
  const first = shown[0];
  return <div role="gridcell" id={id} aria-label={dayName(day)} aria-selected={active}
    className="glass-strip__stone" data-strip-day={day.date} data-relation={day.relation}
    data-in-week={day.inWeek || undefined} data-flagstone={day.flagstone || undefined} data-station={day.station || undefined}
    data-markers={markers.join(" ") || undefined} data-active={active || undefined}>
    <span className="glass-strip__tick" aria-hidden="true" />
    {day.relation === "today" && <TodayMark />}
    {first && day.relation !== "today" && <Marker kind={first} />}
    {day.relation === "today" && first && <Marker kind={first} className="glass-mark--beside" />}
    {shown.length > 1 && <span className="glass-strip__more" aria-hidden="true" />}
  </div>;
}
