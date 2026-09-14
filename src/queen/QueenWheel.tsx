import { useId, useRef, useState, type PointerEvent } from "react";
import { QUEEN_FORM_REST, queenWheelPull, queenWheelRim, queenWheelTurnOf, type QueenFormHandles, type QueenWheelV1 } from "../core/queenForm.ts";
import { formatDateLabel } from "../core/calendar.ts";
import { queenFlatVessel, queenFlatRings, QUEEN_VIEW } from "./QueenFigure.tsx";
import type { QueenForm } from "./world/queenCharmSurface.ts";

/**
 * Throwing her on the wheel, together. The first act, before any money.
 *
 * Two turns, clearly handed over: one partner pulls the form (the belly
 * draws out, the waist gathers), the other opens the rim (the shoulders and
 * the neck). Each turn moves the same lathe profile her sculpture and her
 * charm surface read, within her own bounds, so nothing she throws can hide
 * a reserved channel or stop reading as one seated shape at 40px. It ends
 * by keeping her. A ceremony, not a wizard: no progress bar, no step
 * counter, no skip. Dragging on her or the arrow keys on the wheel do the
 * same thing.
 *
 * Attribution is the signed-in member on this device for each turn — the
 * only identity the record has. The handoff is an interaction: the words say
 * whose turn it is, the record says who was signed in. Shared authorship is
 * an open item; nothing here invents a consent rule.
 */
export type QueenWheelProps = {
  memberId: string;
  members: readonly { id: string; name: string; active: boolean }[];
  /** The handles as they stand on her draft. */
  handles: QueenFormHandles;
  rings: number;
  wheel: QueenWheelV1 | null;
  busy: boolean;
  /** The live draft, so she changes on Home as the wheel turns. */
  onDraft: (handles: QueenFormHandles | null) => void;
  onKeep: (handles: QueenFormHandles, wheel: QueenWheelV1) => void;
};

type Turn = "pull" | "rim";
const TURN_WORDS: Record<Turn, { title: string; verb: string; hint: string }> = {
  pull: { title: "pulls the form", verb: "Pull the form", hint: "Drag right to let the belly out and gather the waist; left to draw it in." },
  rim: { title: "opens the rim", verb: "Open the rim", hint: "Drag right to open the shoulders and the neck; left to close them." },
};

export function QueenWheel({ memberId, members, handles, rings, wheel, busy, onDraft, onKeep }: QueenWheelProps) {
  const ids = useId();
  const [turn, setTurn] = useState<Turn | "kept">(wheel ? "kept" : "pull");
  const [pull, setPull] = useState(() => queenWheelTurnOf(handles, "pull"));
  const [rim, setRim] = useState(() => queenWheelTurnOf(handles, "rim"));
  const [pullTurn, setPullTurn] = useState<QueenWheelV1["pull"] | null>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const me = members.find((row) => row.id === memberId);
  const partner = members.find((row) => row.active && row.id !== memberId) ?? members.find((row) => row.id !== memberId) ?? null;
  const nameOf = (id: string) => members.find((row) => row.id === id)?.name ?? "someone";
  const current: QueenFormHandles = queenWheelRim(queenWheelPull(QUEEN_FORM_REST, pull), rim);
  const form: QueenForm = { handles: current, rings };
  const whose = turn === "pull" ? me?.name ?? "You" : partner?.name ?? me?.name ?? "You";

  const set = (value: number) => {
    const next = Math.max(-1, Math.min(1, value));
    if (turn === "pull") setPull(next); else if (turn === "rim") setRim(next); else return;
    onDraft(turn === "pull" ? queenWheelRim(queenWheelPull(QUEEN_FORM_REST, next), rim) : queenWheelRim(queenWheelPull(QUEEN_FORM_REST, pull), next));
  };
  const value = turn === "pull" ? pull : rim;
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (turn === "kept") return;
    drag.current = { x: event.clientX, start: value };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* not a pointer */ }
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !event.buttons) return;
    set(drag.current.start + (event.clientX - drag.current.x) / 120);
  };
  const onPointerUp = () => { drag.current = null; };

  const handOver = () => {
    setPullTurn({ by: memberId, at: new Date().toISOString() });
    setTurn("rim");
  };
  const keep = () => {
    const kept: QueenWheelV1 = { pull: pullTurn ?? { by: memberId, at: new Date().toISOString() }, rim: { by: memberId, at: new Date().toISOString() } };
    onKeep(current, kept);
    onDraft(null);
    setTurn("kept");
  };
  const again = () => { setPullTurn(null); setTurn("pull"); };

  return (
    <section className="queen-wheel" aria-labelledby={`${ids}-title`} data-turn={turn}>
      <p className="queen-eyebrow">The wheel</p>
      {turn === "kept" ? (
        <>
          <h3 id={`${ids}-title`} className="queen-wheel__title">Thrown together</h3>
          <p className="queen-panel__muted">
            {wheel ? <>Form pulled by {nameOf(wheel.pull.by)} on {formatDateLabel(wheel.pull.at.slice(0, 10))}; rim opened by {nameOf(wheel.rim.by)} on {formatDateLabel(wheel.rim.at.slice(0, 10))}.</> : "Kept."}
            {" "}Each turn names who was signed in on the device that took it.
          </p>
          <div className="queen-acts"><button type="button" className="queen-act" disabled={busy} onClick={again}>Back to the wheel</button></div>
        </>
      ) : (
        <>
          <h3 id={`${ids}-title`} className="queen-wheel__title">{whose} {TURN_WORDS[turn].title}</h3>
          <p className="queen-panel__muted">
            {turn === "pull" ? "Your turn first. " : `${partner ? `Hand the wheel to ${partner.name}. ` : ""}`}
            {TURN_WORDS[turn].hint}
          </p>
          <div className="queen-wheel__stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-hidden="true">
            <svg className="queen-wheel__preview" viewBox={`0 0 ${QUEEN_VIEW.w} ${QUEEN_VIEW.h}`} focusable="false">
              <ellipse className="queen-foot" cx="120" cy="306" rx="92" ry="11" />
              <g className={`queen-wheel__part${turn === "rim" ? " is-turning" : ""}`}><path className="queen-vessel" d="M80 182 C80 146 96 126 120 126 C144 126 160 146 160 182 Z" style={{ transform: `scaleX(${current.neck})`, transformOrigin: "120px 182px" }} /></g>
              <g className={`queen-wheel__part${turn === "pull" ? " is-turning" : ""}`}>
                <path className="queen-vessel" d={queenFlatVessel(form)} />
                {queenFlatRings(form).map((ring) => <path key={ring.key} className="queen-ring" d={ring.d} />)}
              </g>
              <ellipse className="queen-vessel" cx="120" cy="112" rx="40" ry="39" />
            </svg>
          </div>
          <label className="queen-wheel__label" htmlFor={`${ids}-turn`}>{TURN_WORDS[turn].verb}</label>
          <input id={`${ids}-turn`} className="queen-wheel__turn" type="range" min={-100} max={100} step={5} value={Math.round(value * 100)} disabled={busy}
            aria-valuetext={`${value < -0.05 ? "drawn in" : value > 0.05 ? "let out" : "as she came"} ${Math.abs(Math.round(value * 100))}`}
            onChange={(event) => set(Number(event.currentTarget.value) / 100)} />
          <div className="queen-acts">
            {turn === "pull"
              ? <button type="button" className="queen-act queen-act--primary" disabled={busy} onClick={handOver}>{partner ? `Hand the wheel to ${partner.name}` : "Now open the rim"}</button>
              : <button type="button" className="queen-act queen-act--primary" disabled={busy} onClick={keep}>Keep her</button>}
          </div>
        </>
      )}
    </section>
  );
}
