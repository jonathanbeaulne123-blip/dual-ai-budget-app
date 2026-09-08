import { useEffect, useId, useRef, useState } from "react";
import { formatCad } from "./core/money.ts";
import { listTipShifts } from "./core/tipScience.ts";
import type { calculateWorkShift } from "./core/work.ts";
import type { Household } from "./core/types.ts";
import "./shift-count.css";

type CountField = "hours" | "cash" | "card";
type Reading = { value: number | null; label: string; max: number; step: number; locked?: boolean };

/** Three facts about one shift. Every change remains an unposted form edit. */
export function ShiftCount({ household, memberId, jobId, hours, cash, card, hoursLocked, calculation, completeReading, onChange, onActive, onCancel }: {
  household: Household; memberId: string; jobId: string; hours: number | null; cash: number | null; card: number | null;
  hoursLocked: boolean; completeReading: boolean; calculation: ReturnType<typeof calculateWorkShift> | null;
  onChange: (field: CountField, value: number | null) => void;
  onActive: (active: boolean) => void;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [editing, setEditing] = useState<CountField | null>(null);
  const [dragging, setDragging] = useState<CountField | null>(null);
  const start = useRef<{ field: CountField; value: number | null; id: number; target: HTMLInputElement; changed: boolean; max: number; x: number; y: number } | null>(null);
  useEffect(() => () => {
    const original = start.current; start.current = null;
    if (original) { onChange(original.field, original.value); onCancel(); }
    onActive(false);
  }, [onActive]);
  const history = listTipShifts(household, { memberId, jobId, limit: 8 }).rows;
  const readings: Record<CountField, Reading> = {
    hours: { value: hours, label: "Worked hours", max: Math.max(12, hours ?? 0), step: .25, locked: hoursLocked },
    cash: { value: cash, label: "Cash tips · received", max: Math.max(30000, cash ?? 0), step: 100 },
    card: { value: card, label: "Card tips · owed", max: Math.max(30000, card ?? 0, ...history.map(row => row.cardTipsCents)), step: 100 },
  };
  if (start.current) readings[start.current.field].max = start.current.max;
  const cancel = () => {
    const original = start.current;
    start.current = null; setDragging(null);
    if (original) { onChange(original.field, original.value); if (original.target.hasPointerCapture(original.id)) original.target.releasePointerCapture(original.id); }
    onCancel(); onActive(false);
  };
  const complete = (field: CountField, id: number, value: number) => {
    const original = start.current;
    if (!original || original.id !== id || original.field !== field) return;
    start.current = null;
    onChange(field, original.changed || original.value === null ? value : original.value);
    if (original.target.hasPointerCapture(id)) original.target.releasePointerCapture(id);
    setDragging(null); onActive(false);
  };
  const buckets = Array.from({ length: 15 }, () => 0);
  for (const row of history) buckets[Math.min(14, Math.floor(row.cardTipsCents / readings.card.max * 15))]!++;
  const largestBucket = Math.max(1, ...buckets);
  const tipsOut = calculation ? calculation.immediateTipOutCents + calculation.withheldTipOutCents + calculation.deferredTipOutCents : null;
  const wholeReading = calculation && completeReading ? `Draft take-home ${formatCad(calculation.takeHomeWagesCents + calculation.netTipsCents)}; tip-out ${formatCad(tipsOut!)}.` : "Enter the remaining figures to read the draft take-home.";
  return <section className="shift-count" aria-label="The Count">
    <div className="count-reading">
      <p className="count-heading">Take-home from this shift</p>
      <p className="count-total">{calculation && completeReading && cash !== null && card !== null ? formatCad(calculation.takeHomeWagesCents + calculation.netTipsCents) : "Not entered"}</p>
      <p className="count-components">{calculation && completeReading ? <>Wages {formatCad(calculation.takeHomeWagesCents)} · cash {cash === null ? "—" : formatCad(cash)} · card {card === null ? "—" : formatCad(card)} · <span>tip-out −{formatCad(tipsOut!)}</span></> : "Enter the shift figures to read the take-home."}</p>
    </div>
    {(["hours", "cash", "card"] as const).map(field => {
      const reading = readings[field];
      return <div className="count-rail" key={field}>
        <div className="count-rail-head"><label htmlFor={`${prefix}-${field}`}>{reading.label}</label>
          {editing === field ? <input data-dialog-escape-boundary className="count-exact" aria-label={`${reading.label}, exact value`} type="number" inputMode="decimal" min={0} step={.01}
            autoFocus value={reading.value === null ? "" : reading.value / (field === "hours" ? 1 : 100)}
            onBlur={() => setEditing(null)} onKeyDown={event => { if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setEditing(null); queueMicrotask(() => document.getElementById(`${prefix}-${field}-value`)?.focus()); } }}
            onChange={event => { const value = event.currentTarget.valueAsNumber; if (event.currentTarget.value === "") onChange(field, null); else if (Number.isFinite(value) && value >= 0) onChange(field, field === "hours" ? value : Math.round(value * 100)); }} />
            : <button id={`${prefix}-${field}-value`} type="button" disabled={reading.locked || dragging !== null} className="count-value" aria-label={`${reading.label}: ${reading.value === null ? "not entered" : field === "hours" ? `${reading.value} hours` : formatCad(reading.value)}. Type it instead.`} onClick={() => setEditing(field)}>{reading.value === null ? "Not entered" : field === "hours" ? reading.value.toLocaleString("en-CA", { maximumFractionDigits: 2 }) : formatCad(reading.value)}</button>}
        </div>
        <div className="count-rail-track">
          {field === "card" && history.length ? <svg className="count-history" viewBox="0 0 300 26" preserveAspectRatio="none" aria-hidden="true">{buckets.map((count, index) => <rect key={index} x={index * 20} y={26 - count / largestBucket * 24} width="18" height={count / largestBucket * 24} />)}</svg> : null}
          <input id={`${prefix}-${field}`} type="range" min={0} max={reading.max} step={reading.step} value={reading.value ?? 0} disabled={reading.locked || (dragging !== null && dragging !== field)}
            aria-valuetext={`${reading.value === null ? "Not entered" : field === "hours" ? `${reading.value} hours` : formatCad(reading.value)}. ${wholeReading}`}
            data-dialog-escape-boundary={dragging === field || undefined}
            onPointerDown={event => { if (start.current || !event.isPrimary || event.button !== 0) return; const box = event.currentTarget.getBoundingClientRect(); const thumb = box.left + 8 + (box.width - 16) * (reading.value ?? 0) / reading.max; start.current = { field, value: reading.value, id: event.pointerId, target: event.currentTarget, changed: Math.abs(event.clientX - thumb) > 9, max: reading.max, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); setEditing(null); setDragging(field); onActive(true); }}
            onPointerMove={event => { if (start.current?.id === event.pointerId && Math.abs(event.clientX - start.current.x) > 2) start.current.changed = true; }}
            onPointerUp={event => complete(field, event.pointerId, Number(event.currentTarget.value))}
            onPointerCancel={event => { if (start.current?.id === event.pointerId) cancel(); }} onLostPointerCapture={event => { if (start.current?.id === event.pointerId) cancel(); }}
            onKeyDown={event => { if (event.key === "Escape" && start.current) { event.preventDefault(); event.stopPropagation(); cancel(); } else if (event.key === "Home") { event.preventDefault(); onChange(field, 0); } }}
            onChange={event => { if (start.current && start.current.field !== field) return; if (start.current && !start.current.changed) return; onChange(field, Number(event.currentTarget.value)); }} />
        </div>
        {field === "hours" ? <p className="count-note">{hoursLocked ? "Captured hours stay with the approved clock." : "Quarter-hours when you move the rail. Type an exact duration above."}</p> : null}
        {field === "card" ? <p className="count-note">{history.length ? `Your last ${history.length} ${history.length === 1 ? "shift" : "shifts"} at this job, drawn behind.` : "Your posted shifts will appear behind this rail."} Card is recorded before withholding.<span className="sr-only"> {history.map(row => `${row.date}: ${formatCad(row.cardTipsCents)}.`).join(" ")}</span></p> : null}
      </div>;
    })}
    {calculation && completeReading && tipsOut! > 0 ? <p className="count-tipout">Tip-out: {formatCad(calculation.immediateTipOutCents)} from cash · {formatCad(calculation.withheldTipOutCents)} withheld · {formatCad(calculation.deferredTipOutCents)} deferred.</p> : null}
    <p className="count-draft">Draft · nothing posted</p>
  </section>;
}
