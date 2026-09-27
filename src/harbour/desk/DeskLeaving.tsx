import { useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { engravedCents } from "./engraved.ts";
import { JAR_STATE_WORDS, readLeaving, type LeavingJar, type LeavingNext, type LeavingRail, type LeavingSpoken, type LeavingTable } from "./leavingModel.ts";
import { shortDate } from "../nav/doorSigns.ts";
import type { DeskPageProps } from "./types.ts";
import "./desk-leaving.css";

/**
 * Leaving — what is leaving the Fund, and when (SIMPLE_VIEW_DESK S3 §2). The
 * next outflow and the spoken-for read lead; the next-out table beneath; the
 * month's calendar-weight rail (ink posted, copper scheduled, square-root
 * scale) with a press on any day; and the bill jars in the Cellar's own
 * states. Every figure is a selector's figure and nothing here moves money.
 */
export function DeskLeaving({ household, memberId, scope, today, reading, onOpen }: DeskPageProps) {
  const leaving = useMemo(() => readLeaving(household, memberId, scope, today, reading), [household, memberId, scope, today, reading]);
  const ids = useId();
  const personal = scope === "personal";
  return <div className="desk-leaving" data-desk-leaving={leaving.fund ? "fund" : "calendar"}>
    {/* Two columns on a wide desk (the reading column, the rail column); on a phone they dissolve into one ordered stack. */}
    <div className="desk-leaving__col desk-leaving__col--read">
    <NextCard known={leaving.table.available} next={leaving.next} fund={leaving.fund} personal={personal} />
    <SpokenCard spoken={leaving.spoken} personal={personal} />

    <section className="desk-card desk-leaving__table" aria-labelledby={`${ids}-table`}>
      <h2 className="desk-card__kicker" id={`${ids}-table`}>{leaving.fund ? "Leaving next · the rest of the month" : "Leaving · the rest of the month"}</h2>
      <OutTable table={leaving.table} personal={personal} />
    </section>
    </div>

    <div className="desk-leaving__col desk-leaving__col--rail">
    <section className="desk-card desk-leaving__rail" aria-labelledby={`${ids}-rail`}>
      <h2 className="desk-card__kicker" id={`${ids}-rail`}>What leaves, day by day</h2>
      <Rail rail={leaving.rail} />
    </section>

    <section className="desk-card desk-leaving__jars" aria-labelledby={`${ids}-jars`}>
      <h2 className="desk-card__kicker" id={`${ids}-jars`}>The bill jars</h2>
      <Jars jars={leaving.jars} onOpen={onOpen} />
    </section>
    </div>

    <nav className="desk-leaving__doors" aria-label="Leaving doors">
      {!personal && <button type="button" className="desk-door" data-desk-door="cellar-bills" onClick={() => onOpen("cellar-bills")}>Read the bill jars</button>}
      <button type="button" className="desk-door" data-desk-door="calendar" onClick={() => onOpen("calendar")}>Unfold the Calendar</button>
    </nav>
  </div>;
}

function when(daysAhead: number) {
  return daysAhead === 0 ? "today" : daysAhead === 1 ? "tomorrow" : `in ${daysAhead} days`;
}

function NextCard({ known, next, fund, personal }: { known:boolean; next: LeavingNext | null; fund: boolean; personal: boolean }) {
  const kicker = fund ? "Next to leave the Fund" : personal ? "Next to leave · your Calendar" : "Next to leave · the Calendar";
  const warning = next?.breaks ? "The Fund runs short here." : next?.underBuffer ? "It leaves the Fund under its buffer." : null;
  return <section className="desk-card desk-leaving__next" data-desk-next={!known ? "unknown" : next ? "dated" : "clear"}
    aria-label={next ? `${kicker}: ${next.label}, ${engravedCents(next.amountCents)}, ${shortDate(next.date)}, ${when(next.daysAhead)}.${warning ? ` ${warning}` : ""}` : !known ? `${kicker}: checking the books.` : `${kicker}: nothing dated for the rest of the month.`}>
    <p className="desk-card__kicker">{kicker}</p>
    {next ? <>
      <strong className="desk-leaving__next-label">{next.label}</strong>
      <strong className="desk-figure desk-leaving__next-figure">{engravedCents(next.amountCents)}</strong>
      <span className="desk-card__line"><time dateTime={next.date}>{shortDate(next.date)}</time> · {when(next.daysAhead)}</span>
      {warning && <span className="desk-leaving__warning">{warning}</span>}
    </> : <>
      <strong className="desk-leaving__next-label">{known ? "Nothing dated" : "Checking next payments"}</strong>
      <span className="desk-card__line">{!known ? "The next payment cannot be read yet. Open Calendar to review." : fund ? "Nothing else leaves the Fund this month." : "Nothing scheduled leaves for the rest of the month."}</span>
    </>}
  </section>;
}

function throughWords(spoken: LeavingSpoken) {
  const date = shortDate(spoken.throughDate);
  return spoken.throughConfidence === "observed" ? `Through ${date}, before an observed contribution — not confirmed.`
    : spoken.throughConfidence === "confirmed" ? `Through ${date}, before the next confirmed money in.`
      : `Through ${date}, at month end.`;
}

function SpokenCard({ spoken, personal }: { spoken: LeavingSpoken | null; personal: boolean }) {
  if (!spoken) {
    return <section className="desk-card desk-leaving__spoken" data-desk-spoken="none">
      <p className="desk-card__kicker">Spoken for</p>
      <strong className="desk-figure" aria-hidden="true">—</strong>
      <span className="desk-card__line">{personal
        ? "Spoken for reads the shared Fund’s pool. Your own ledger has no pool to claim against — switch to Shared to read it."
        : "The shared Fund’s month is not available yet. Open the Fund to review its setup and records."}</span>
    </section>;
  }
  const over = spoken.overCents > 0;
  const pct = Math.round(spoken.claimedShare * 100);
  return <section className="desk-card desk-leaving__spoken" data-desk-spoken={over ? "over" : "free"}>
    <p className="desk-card__kicker">Spoken for</p>
    <strong className="desk-figure">{over ? `${engravedCents(spoken.overCents)} over` : `${engravedCents(spoken.freeCents)} free`}</strong>
    <span className="desk-card__line">{over
      ? `Claims of ${engravedCents(spoken.claimedCents)} sit against ${engravedCents(spoken.poolCents)} in the pool.`
      : `${engravedCents(spoken.claimedCents)} of ${engravedCents(spoken.poolCents)} is already claimed.`} {throughWords(spoken)}</span>
    <span className={`desk-leaving__bar${over ? " is-over" : ""}`} role="img" aria-label={`${engravedCents(spoken.claimedCents)} claimed of ${engravedCents(spoken.poolCents)} in the pool`}>
      <span className="desk-leaving__bar-fill" style={{ width: `${pct}%` }} />
    </span>
    <span className="desk-leaving__bar-ends" aria-hidden="true"><span>Claimed</span><span>Pool {engravedCents(spoken.poolCents)}</span></span>
  </section>;
}

function OutTable({ table, personal }: { table: LeavingTable; personal: boolean }) {
  if (!table.available) return <p className="desk-card__line">The scheduled payments are not available yet. Open Calendar to review.</p>;
  if (table.rows.length === 0) {
    return <p className="desk-card__line desk-leaving__empty">{table.source === "fund" ? "Nothing owed for the rest of the month." : personal ? "Nothing on your Calendar is leaving for the rest of the month." : "Nothing is leaving for the rest of the month."}</p>;
  }
  const fund = table.source === "fund";
  return <>
    <table className="desk-leaving__out">
      <thead><tr><th scope="col">Date</th><th scope="col">What</th><th scope="col" className="is-num">Amount</th>{fund && <th scope="col" className="is-num">Leaves</th>}</tr></thead>
      <tbody>
        {table.rows.map(row => <tr key={row.id} data-desk-out-row={row.id} className={row.breaks ? "is-break" : row.underBuffer ? "is-under" : undefined}>
          <td className="is-date"><time dateTime={row.date}>{shortDate(row.date)}</time></td>
          <td className="is-label">{row.label}</td>
          <td className="is-num">{engravedCents(row.amountCents)}</td>
          {fund && <td className="is-num">{engravedCents(row.leavesCents)}</td>}
        </tr>)}
      </tbody>
      <tfoot><tr><th scope="row" colSpan={2}>Still to leave</th><td className="is-num">{engravedCents(table.totalCents)}</td>{fund && <td />}</tr></tfoot>
    </table>
    {table.breakRow && <p className="desk-leaving__warning">{table.breakRow.label} is the one that breaks it.</p>}
    {fund && table.rows.some(row => row.underBuffer) && <p className="desk-card__line desk-leaving__foot">Copper rows leave the Fund under its buffer.</p>}
  </>;
}

const DAY_LABEL = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "long", day: "numeric", month: "long" });
const dayLabel = (date: string) => DAY_LABEL.format(new Date(`${date}T12:00:00Z`));

/**
 * The rail: one bar per day, drawn in HTML so it scales cleanly. The bars are
 * the picture and the control: the rail is one slider — a press picks the day
 * under it, a drag walks the month, the arrow keys (and Page Up/Down, Home,
 * End) step, and the two 44px step buttons beside it are the fine touch. The chosen day's figure and
 * items are read in the slip beneath. Nothing here writes.
 */
function Rail({ rail }: { rail: LeavingRail | null }) {
  const [picked, setPicked] = useState<number | null>(null);
  const drag = useRef<number | null>(null);
  const slip = useId();
  if (!rail) return <p className="desk-card__line desk-leaving__empty">The day-by-day rail could not be read yet.</p>;
  const index = Math.max(0, Math.min(rail.days.length - 1, picked ?? rail.todayIndex));
  const day = rail.days[index]!;
  const quiet = rail.postedOutCents === 0 && rail.outstandingOutCents === 0;
  const valueText = `${dayLabel(day.date)}: ${engravedCents(day.postedOutCents)} posted out, ${engravedCents(day.outstandingOutCents)} scheduled out.`;
  const last = rail.days.length - 1;
  const pick = (next: number) => setPicked(Math.max(0, Math.min(last, next)));
  const step = (by: number) => pick(index + by);
  // The rail is the Calendar's own scrub: a press picks the day under it, a drag walks the month.
  function dayAt(event: ReactPointerEvent<HTMLDivElement>) {
    const bars = event.currentTarget.firstElementChild as HTMLElement | null;
    const box = (bars ?? event.currentTarget).getBoundingClientRect();
    if (!(box.width > 8)) return null;
    return Math.floor(((event.clientX - box.left - 4) / (box.width - 8)) * rail!.days.length);
  }
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // The rail owns a horizontal drag; the Desk's page swipe must not hear it.
    event.stopPropagation();
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const at = dayAt(event); if (at !== null) pick(at);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current !== event.pointerId) return;
    const at = dayAt(event); if (at !== null) pick(at);
  }
  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (drag.current !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function onKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -7, PageUp: 7, Home: -Infinity, End: Infinity };
    const by = moves[event.key];
    if (by === undefined) return;
    event.preventDefault();
    pick(by === -Infinity ? 0 : by === Infinity ? last : index + by);
  }
  return <div className="desk-rail" data-desk-rail="">
    <div className="desk-rail__stage" role="slider" tabIndex={0} aria-label="What leaves, day by day — choose a day"
      aria-valuemin={1} aria-valuemax={rail.days.length} aria-valuenow={index + 1} aria-valuetext={valueText} aria-controls={slip}
      onKeyDown={onKey} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
      <div className="desk-rail__bars" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${rail.days.length}, minmax(0, 1fr))` }}>
        {rail.days.map((d, i) => <span key={d.date} className={`desk-rail__day${i === index ? " is-picked" : ""}${d.today ? " is-today" : ""}`} data-rail-date={d.date}
          data-rail-posted={d.postedOutCents > 0 || undefined} data-rail-scheduled={d.outstandingOutCents > 0 || undefined}>
          <span className="desk-rail__stack">
            {d.outstandingOutCents > 0 && <i className="desk-rail__seg desk-rail__seg--scheduled" style={{ height: `${(d.scheduledHeight * 100).toFixed(2)}%` }} />}
            {d.postedOutCents > 0 && <i className="desk-rail__seg desk-rail__seg--posted" style={{ height: `${(d.postedHeight * 100).toFixed(2)}%` }} />}
          </span>
        </span>)}
      </div>
    </div>
    <div className="desk-rail__axis" aria-hidden="true"><span>{shortDate(rail.days[0]!.date)}</span><span>√ scale · cash leaving</span><span>{shortDate(rail.days.at(-1)!.date)}</span></div>
    <div className="desk-rail__controls">
      <button type="button" className="desk-rail__step" aria-label="Previous day" disabled={index === 0} onClick={() => step(-1)}>‹</button>
      <p className="desk-rail__legend"><span><i className="desk-rail__key desk-rail__key--posted" aria-hidden="true" />Ink · posted</span><span><i className="desk-rail__key desk-rail__key--scheduled" aria-hidden="true" />Copper · scheduled</span></p>
      <button type="button" className="desk-rail__step" aria-label="Next day" disabled={index === rail.days.length - 1} onClick={() => step(1)}>›</button>
    </div>
    <div className="desk-rail__slip" id={slip} aria-live="polite" data-rail-slip={day.date}>
      <p className="desk-rail__slip-date"><time dateTime={day.date}>{dayLabel(day.date)}</time>{day.today && <span className="desk-rail__today-tag">Today</span>}</p>
      <p className="desk-rail__slip-figure"><strong className="desk-figure desk-figure--inline">{engravedCents(day.weightCents)}</strong> leaving</p>
      <p className="desk-card__line">
        <span className="desk-rail__word desk-rail__word--posted">{engravedCents(day.postedOutCents)} posted</span> · <span className="desk-rail__word desk-rail__word--scheduled">{engravedCents(day.outstandingOutCents)} scheduled</span>
        {day.postedInCents > 0 && <> · {engravedCents(day.postedInCents)} in or returned, separately</>}
      </p>
      {day.needsReview && <p className="desk-card__line">Some payment status needs review; those amounts are not on the rail.</p>}
      {day.items.length === 0
        ? <p className="desk-card__line desk-rail__none">Nothing on this day.</p>
        : <ul className="desk-rail__items">
          {day.items.map(item => <li key={item.id} className={`desk-rail__item is-${item.kind}`} data-rail-item={item.kind}>
            <span className="desk-rail__item-title">{item.title}</span>
            <strong className="desk-rail__item-cents">{engravedCents(item.cents)}</strong>
            <span className="desk-rail__item-note">{item.note}</span>
          </li>)}
        </ul>}
    </div>
    {quiet && <p className="desk-card__line desk-rail__quiet">No cash has left this month yet and none is scheduled to.</p>}
    <p className="desk-card__line desk-rail__through">This month: {engravedCents(rail.postedOutCents)} posted out · {engravedCents(rail.outstandingOutCents)} scheduled out.</p>
  </div>;
}

function jarWords(jar: LeavingJar) {
  return `${JAR_STATE_WORDS[jar.state]}${jar.missing ? " · missing a payment" : ""}`;
}

function Jars({ jars, onOpen }: { jars: LeavingJar[] | null | undefined; onOpen: (target: string, object?: string) => void }) {
  if (jars === undefined) return <p className="desk-card__line">The bill jars are not available yet. Open the Cellar to review.</p>;
  if (jars === null) return <p className="desk-card__line desk-leaving__empty">The bill jars stand in the shared Fund’s cellar. Switch to Shared to read them.</p>;
  if (jars.length === 0) return <p className="desk-card__line desk-leaving__empty">No bills on the rail yet.</p>;
  return <ul className="desk-jars">
    {jars.map(jar => <li key={jar.key}>
      <button type="button" className="desk-jar" data-jar-state={jar.state} data-jar-missing={jar.missing || undefined} onClick={() => onOpen("cellar-bills", `jar/${jar.key}`)}
        aria-label={`${jar.label}, ${engravedCents(jar.amountCents)}, ${jarWords(jar).toLowerCase()}${jar.due ? `, due ${shortDate(jar.due)}` : ""}. Open the Cellar at this jar.`}>
        <span className="desk-jar__glass" aria-hidden="true" />
        <span className="desk-jar__words">
          <span className="desk-jar__label">{jar.label}</span>
          <span className="desk-jar__due">{jar.due ? `Due ${shortDate(jar.due)}` : "No date"}</span>
        </span>
        <strong className="desk-jar__cents">{engravedCents(jar.amountCents)}</strong>
        <span className="desk-jar__state">{JAR_STATE_WORDS[jar.state]}</span>
        {jar.missing && <span className="desk-jar__missing">Missing a payment</span>}
      </button>
    </li>)}
  </ul>;
}
