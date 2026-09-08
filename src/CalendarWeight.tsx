import { useRef, type ReactNode, type PointerEvent } from "react";
import { formatCad } from "./core/money.ts";
import { cashFlowDelta, type CashFlowRow } from "./core/cashFlowRows.ts";
import type { WeightDay, WeightItem } from "./core/calendarWeight.ts";
import "./calendar-weight.css";

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
}
function reading(day: WeightDay) {
  return `${dayLabel(day.date)}. ${formatCad(day.postedOutCents)} posted cash out; ${formatCad(day.outstandingOutCents)} scheduled cash out; ${formatCad(day.postedInCents)} cash in or returned. ${day.scheduled.filter(row => !row.allowPost).length ? "Some payment status needs review and is not plotted. " : ""}${[...day.posted.map(row => row.title), ...day.scheduled.map(row => row.item.title)].join("; ") || "Nothing on this day."}`;
}
function postedLabel(row: CashFlowRow) {
  const delta = cashFlowDelta(row);
  if (delta < 0) return `${row.transactionId !== row.rootId ? "Correction · " : ""}Posted cash out`;
  if (delta > 0) return `${row.transactionId !== row.rootId ? "Correction · " : ""}Posted cash in or returned`;
  return row.component === "cardSpendCents" ? "Posted card activity · not cash leaving" : "Posted transfer · within cash or non-cash accounts";
}

export function CalendarWeight({ days, selected, onSelect, renderItem }: {
  days: WeightDay[]; selected: string; onSelect: (date: string) => void; renderItem: (row: WeightItem) => ReactNode;
}) {
  const chosen = days.find(day => day.date === selected) ?? days[0]!;
  const index = days.indexOf(chosen);
  const drag = useRef<{ id: number; start: string; target: HTMLInputElement } | null>(null);
  const canceled = useRef(false);
  const finish = (restore: boolean, pointerId?: number) => {
    const prior = drag.current;
    if (!prior || (pointerId !== undefined && pointerId !== prior.id)) return;
    drag.current = null;
    if (restore) { canceled.current = true; onSelect(prior.start); }
    if (prior.target.hasPointerCapture?.(prior.id)) prior.target.releasePointerCapture(prior.id);
  };
  const cancel = (event: PointerEvent<HTMLInputElement>) => finish(true, event.pointerId);
  const max = Math.max(1, ...days.map(day => day.weightCents));
  const slot = 312 / days.length;
  const through = days.slice(0, index + 1);
  return <div className="weight" aria-label="What leaves, day by day">
    <p className="weight-heading">What leaves, day by day</p>
    <svg className="weight-rail" viewBox="0 0 320 74" role="img" aria-label={`Cash leaving across the month, square-root scale. ${reading(chosen)}`}>
      <line x1="4" y1="66" x2="316" y2="66" className="weight-base" />
      {days.map((day, i) => {
        const height = day.weightCents ? Math.max(2, 60 * Math.sqrt(day.weightCents / max)) : 0;
        const postedHeight = day.weightCents ? height * day.postedOutCents / day.weightCents : 0;
        const dueHeight = height - postedHeight, x = 4 + i * slot + 1, width = Math.max(1, slot - 2);
        return <g key={day.date} data-weight-date={day.date}>
          {day.postedOutCents > 0 && <rect x={x} y={66 - postedHeight} width={width} height={postedHeight} className="weight-bar posted" />}
          {day.outstandingOutCents > 0 && <rect x={x} y={66 - height} width={width} height={dueHeight} className="weight-bar due" />}
          {day.date === chosen.date && <line x1={x + width / 2} x2={x + width / 2} y1="2" y2="71" className="weight-head" />}
        </g>;
      })}
    </svg>
    <input className="weight-range" type="range" min="1" max={days.length} step="1" value={index + 1}
      aria-label="Day of the month" aria-valuetext={reading(chosen)}
      onChange={event => { if (!canceled.current) onSelect(days[Number(event.currentTarget.value) - 1]!.date); }}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0 || drag.current) return; canceled.current = false; drag.current = { id: event.pointerId, start: chosen.date, target: event.currentTarget }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerUp={event => finish(false, event.pointerId)}
      onPointerCancel={cancel} onLostPointerCapture={cancel}
      onKeyDown={event => { if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); finish(true); } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) canceled.current = false; }} />
    <div className="weight-ends"><span>{days[0]!.date.slice(5)}</span><span>√ scale · cash leaving</span><span>{days.at(-1)!.date.slice(5)}</span></div>
    <p className="weight-legend"><span>Ink · posted</span><span>Copper · scheduled</span></p>
    <section className="weight-day" aria-label={dayLabel(chosen.date)}>
      <p className="weight-heading"><time dateTime={chosen.date}>{dayLabel(chosen.date)}</time></p>
      <p className="weight-figure">{chosen.weightCents ? "−" : ""}{formatCad(chosen.weightCents)}</p>
      <p className="weight-note">{formatCad(chosen.postedOutCents)} posted · {formatCad(chosen.outstandingOutCents)} scheduled{chosen.postedInCents ? ` · ${formatCad(chosen.postedInCents)} in or returned separately` : ""}</p>
      {chosen.scheduled.some(row => !row.allowPost) && <p className="weight-note">Payment status needs review. Unresolved amounts are not included in the rail.</p>}
      <div className="weight-items">
        {chosen.posted.map(row => <div className="weight-item posted" key={row.transactionId} data-receipt-id={row.transactionId}>
          <div className="weight-item-reading"><span>{row.title}</span><strong>{formatCad(cashFlowDelta(row) || row.amountCents)}</strong></div>
          <p className="weight-note">{postedLabel(row)}</p>
        </div>)}
        {chosen.scheduled.map(row => <div className={`weight-item${row.outstandingOutCents ? " due" : ""}`} key={row.item.id}>
          {renderItem(row)}<p className="weight-note">{row.note}</p>
        </div>)}
        {!chosen.posted.length && !chosen.scheduled.length && <p className="weight-note">Nothing on this day.</p>}
      </div>
    </section>
    <p className="weight-note">Through {chosen.date.slice(5)}: {formatCad(through.reduce((sum, day) => sum + day.postedOutCents, 0))} posted out · {formatCad(through.reduce((sum, day) => sum + day.outstandingOutCents, 0))} scheduled out.</p>
    <details className="weight-list"><summary>Choose a day from the list</summary>
      <label>Day<select aria-label="Choose a day" value={chosen.date} onChange={event => onSelect(event.currentTarget.value)}>
        {days.map(day => <option key={day.date} value={day.date}>{reading(day)}</option>)}
      </select></label>
    </details>
  </div>;
}
