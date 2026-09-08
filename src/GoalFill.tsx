import { useEffect, useId, useRef, useState } from "react";
import { formatCad, kittyBankFill, parseWholeCents, type Goal } from "./core/index.ts";

/** CAD draft precision is independent of kittyBankStep's ten visual buckets. */
export function fillDraftCents(value: string): number | null {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  // The existing command parser must preserve the same exact cents as this draft.
  try { return parseWholeCents(value, "Contribution", { allowZero: true }) === Number(cents) ? Number(cents) : null; }
  catch { return null; }
}
const STEP = 2500;
export function GoalFill({ goal, amount, onChange, busy, children }: {
  goal: Goal; amount: string; onChange: (amount: string) => void; busy: boolean; children?: React.ReactNode;
}) {
  const id = useId();
  const [typing, setTyping] = useState(false);
  const drag = useRef<{ pointerId: number; y: number; amount: string; cents: number; max: number; target: SVGSVGElement } | null>(null);
  const [dragging, setDragging] = useState(false);
  const cents = fillDraftCents(amount);
  const total = cents === null ? null : goal.savedCents + cents;
  const valid = total !== null && Number.isSafeInteger(total) && Number.isSafeInteger(goal.savedCents) && goal.savedCents >= 0;
  const maximum = Math.max(50000, cents ?? 0);
  const have = kittyBankFill(goal);
  const added = valid && goal.targetCents > 0 ? Math.max(0, Math.min(1 - have, cents! / goal.targetCents)) : 0;
  const haveY = 96 - have * 78;
  const setCents = (value: number) => {
    const exact = BigInt(Math.max(0, Math.round(value)));
    onChange(`${exact / 100n}.${String(exact % 100n).padStart(2, "0")}`);
  };
  const finish = (cancel: boolean) => {
    const current = drag.current; if (!current) return;
    drag.current = null; setDragging(false);
    if (cancel) onChange(current.amount);
    if (current.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
  };
  useEffect(() => { if (busy) finish(true); }, [busy]);
  return <div className="goal-fill">
    <div className="fill-wrap">
      <svg className="fill-jar" viewBox="0 0 84 104" role="slider" tabIndex={busy ? -1 : 0}
        aria-label={`Amount to put in ${goal.name}`} aria-orientation="vertical" aria-valuemin={0}
        aria-valuemax={maximum / 100} aria-valuenow={(cents ?? 0) / 100} aria-disabled={busy}
        aria-valuetext={valid ? `${formatCad(cents!)} proposed, ${formatCad(total!)} recorded total after Confirm` : "Type a valid amount"}
        aria-describedby={`${id}-note`}
        onPointerDown={event => {
          if (busy || drag.current || !event.isPrimary || event.button !== 0 || cents === null) return;
          drag.current = { pointerId: event.pointerId, y: event.clientY, amount, cents, max: maximum, target: event.currentTarget };
          setDragging(true); event.currentTarget.setPointerCapture?.(event.pointerId); event.currentTarget.focus();
        }}
        onPointerMove={event => {
          const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
          const distance = current.y - event.clientY;
          if (Math.abs(distance) < 3) { onChange(current.amount); return; }
          setCents(Math.min(current.max, Math.max(0, Math.round((current.cents + distance / 104 * current.max) / STEP) * STEP)));
        }}
        onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) finish(false); }}
        onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) finish(true); }}
        onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId) finish(true); }}
        onKeyDown={event => {
          if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); finish(true); return; }
          if (busy || drag.current || cents === null) return;
          const next = event.key === "ArrowUp" || event.key === "ArrowRight" ? Math.min(maximum, cents + STEP)
            : event.key === "ArrowDown" || event.key === "ArrowLeft" ? Math.max(0, cents - STEP)
            : event.key === "Home" ? 0 : event.key === "End" ? maximum : null;
          if (next !== null) { event.preventDefault(); event.stopPropagation(); setCents(next); }
        }}>
        <rect className="fill-liquid" x="12" y={haveY} width="60" height={96 - haveY} rx="3" />
        {added > 0 && <rect className="fill-added" x="12" y={haveY - added * 78} width="60" height={added * 78} rx="3" />}
        <rect className="fill-glass" x="12" y="18" width="60" height="78" rx="5" />
        <path className="fill-lip" d="M8 18H76" /><path className="fill-goalline" d="M10 19H74" />
      </svg>
      <div className="fill-reading">
        <p className="fill-total">{valid ? formatCad(total!) : "—"}</p>
        <p>of {formatCad(goal.targetCents)}</p>
        <p className="fill-addition">{cents === 0 ? "Drag the jar up · $25 steps" : cents === null ? "Check the amount" : `+${formatCad(cents)} proposed`}</p>
      </div>
    </div>
    <div className="fill-actions">
      {[2500, 5000, 10000].map(value => <button className="chip" type="button" key={value} disabled={busy || dragging} onClick={() => setCents(value)}>{formatCad(value)}</button>)}
      <button className="chip quiet" type="button" disabled={busy || dragging} onClick={() => setTyping(!typing)} aria-expanded={typing}>Type it instead</button>
    </div>
    {typing && <label className="fill-exact">Put in now · CAD<input autoFocus inputMode="decimal" aria-label={`Contribution for ${goal.name}`} value={amount} disabled={busy || dragging} onChange={event => onChange(event.target.value)} /></label>}
    <div className="fill-paperbox" id={`${id}-note`} aria-live={dragging ? "off" : "polite"}>
      <p className="fill-caption">{formatCad(goal.savedCents)} recorded · addition is a draft</p>
      <p>{!valid ? "Enter an exact amount with up to two decimal places." : total! >= goal.targetCents ? (cents! > 0 ? "Would reach the target." : "Target reached in recorded progress.") : `${formatCad(goal.targetCents - total!)} would remain.`}</p>
      <p className="fill-caption">No arrival estimate yet.</p>
    </div>
    <fieldset className="fill-confirm-controls" disabled={busy || dragging || !valid || !cents}>{children}</fieldset>
  </div>;
}
