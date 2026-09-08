import { useId, useRef, useState, type PointerEvent } from "react";
import { formatPreviewHours, formatTorontoTime, workedHoursFromOpenShift } from "./core/index.ts";
import type { OpenShift } from "./core/types.ts";
import "./shift-punch.css";

type Drag = { id: number; startY: number; wasOpen: boolean; moved: boolean };
/** The edge reveals actions; only a later named activation changes the timeline. */
export function ShiftPunch({ punch, who, now, busy, onStartBreak, onEndBreak, onClockOut, onAbandon }: {
  punch: OpenShift; who: string; now: Date; busy: boolean;
  onStartBreak: (kind: "paid" | "unpaid") => void; onEndBreak: () => void; onClockOut: () => void; onAbandon: () => void;
}) {
  const [open, setOpen] = useState(false), [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null), suppressClick = useRef(false), handle = useRef<HTMLButtonElement>(null), id = useId();
  const hours = workedHoursFromOpenShift(punch, now.getTime()), currentBreak = punch.breaks.find(row => !row.endedAt);
  const finish = (event?: PointerEvent, cancel = false) => {
    const active = drag.current;
    if (!active || (event && active.id !== event.pointerId)) return;
    drag.current = null; setDragging(false);
    if (cancel) setOpen(active.wasOpen);
    suppressClick.current = active.moved || cancel;
    if (handle.current?.hasPointerCapture(active.id)) handle.current.releasePointerCapture(active.id);
  };
  const close = () => { setOpen(false); handle.current?.focus(); };
  return <section className="shift-punch-instrument" aria-label="Elapsed and breaks" onKeyDown={event => {
    if (event.key === "Escape" && (drag.current || open)) { event.preventDefault(); event.stopPropagation(); if (drag.current) finish(undefined,true); else close(); }
  }}>
    <button ref={handle} className="shift-punch-handle" type="button" aria-label="Elapsed and breaks. Show shift actions" aria-expanded={open} aria-controls={id} disabled={busy}
      onPointerDown={event => {
        if (drag.current) { finish(undefined,true); return; }
        if (!event.isPrimary || event.button !== 0 || busy) return;
        suppressClick.current = false; drag.current = {id:event.pointerId,startY:event.clientY,wasOpen:open,moved:false};
        setDragging(true); event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => { const active=drag.current; if (!active || active.id !== event.pointerId) return;
        const distance=event.clientY-active.startY; if (Math.abs(distance)>8) { active.moved=true; setOpen(distance>=24 ? true : distance<=-24 ? false : active.wasOpen); }
      }}
      onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}
      onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}setOpen(value=>!value);}}
      onKeyDown={event=>{if (event.key === "Enter" || event.key === " ") suppressClick.current=false; if (["ArrowDown","ArrowUp","Home","End"].includes(event.key)) {event.preventDefault();setOpen(event.key==="ArrowDown"||event.key==="End");}}}>
      <span className="shift-punch-grip" aria-hidden="true">⋮</span><span>Punch</span><span aria-hidden="true">↓</span>
    </button>
    <div className="shift-punch-reading"><p className="shift-punch-kicker">Elapsed · break</p>
      <p className="shift-punch-figure">{formatPreviewHours(hours.elapsedHours)} h</p>
      <p className="shift-punch-line">{who} · since {formatTorontoTime(punch.startedAt)}</p>
      <p className="shift-punch-line">{formatPreviewHours(hours.workedHours)} h working{hours.paidBreakHours>0 ? ` · ${formatPreviewHours(hours.paidBreakHours)} h paid break` : ""}{hours.unpaidBreakHours>0 ? ` · ${formatPreviewHours(hours.unpaidBreakHours)} h unpaid break` : ""}</p>
      <p className="shift-punch-line">{currentBreak ? `${currentBreak.label} since ${formatTorontoTime(currentBreak.startedAt)}` : "On the clock"}</p>
      {busy && <p className="shift-punch-line" role="status">An action is in progress. Shift controls return when it finishes.</p>}
    </div>
    <div id={id} className="shift-punch-actions" hidden={!open}>
      <p className="shift-punch-line">Choose an action for this shift. Confirm still posts pay.</p>
      <div className="shift-punch-buttons">
        {currentBreak ? <button type="button" disabled={busy||dragging} onClick={onEndBreak}>End break</button> : <>
          <button type="button" disabled={busy||dragging} onClick={()=>onStartBreak("paid")}>Paid break</button>
          <button type="button" disabled={busy||dragging} onClick={()=>onStartBreak("unpaid")}>Unpaid break</button></>}
        <button type="button" disabled={busy||dragging} onClick={onClockOut}>Clock out</button>
      </div>
      {punch.breaks.length>0 && <ol className="timesheet-breaks" aria-label="Breaks this shift">{punch.breaks.map(row=><li key={row.id}><span>{row.label}</span><span>{formatTorontoTime(row.startedAt)}{row.endedAt?`–${formatTorontoTime(row.endedAt)}`:"–now"}</span></li>)}</ol>}
      <button type="button" className="shift-punch-discard" disabled={busy||dragging} onClick={onAbandon}>Discard this open shift</button>
      <button type="button" className="shift-punch-close" disabled={dragging} onClick={close}>Close actions</button>
    </div>
  </section>;
}
