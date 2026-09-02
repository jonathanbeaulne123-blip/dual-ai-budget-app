import { useEffect, useMemo, useRef, useState } from "react";
import {
  ROUTE_VIEW,
  askPanelView,
  type AskAlternative,
  type AskPanelView,
  type AskRoutesDrawing,
} from "./core/askView.ts";
import type { DateKey } from "./core/calendar.ts";
import type { Household } from "./core/types.ts";
import "./ask.css";

type AskProps = {
  household: Household;
  today: DateKey;
  memberId: string;
  busy: boolean;
  onMove: (alternative: AskAlternative) => void;
};

export function Ask({ household, today, memberId, busy, onMove }: AskProps) {
  const view = useMemo(
    () => askPanelView(household, today, memberId),
    [household, today, memberId],
  );
  const [pendingRecurrenceId, setPendingRecurrenceId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const raiseRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<"raise" | "section" | null>(null);

  function closeConfirmation(returnFocus: "raise" | "section") {
    returnFocusRef.current = returnFocus;
    setPendingRecurrenceId(null);
  }

  useEffect(() => {
    if (pendingRecurrenceId
      && !view.alternatives.some((row) => row.recurrenceId === pendingRecurrenceId)) {
      returnFocusRef.current = "section";
      setPendingRecurrenceId(null);
    }
  }, [pendingRecurrenceId, view.alternatives]);

  useEffect(() => {
    if (pendingRecurrenceId) {
      confirmRef.current?.focus();
      return;
    }
    const returnFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    if (returnFocus === "raise") raiseRef.current?.focus();
    if (returnFocus === "section") sectionRef.current?.focus();
  }, [pendingRecurrenceId]);

  return (
    <section ref={sectionRef} className="ask" aria-label="The ask" tabIndex={-1}>
      <p
        className={`ask-figure${view.covered ? " is-covered" : ""}`}
        data-ask-figure=""
      >
        {view.figure}
      </p>
      <p className="ask-sentence" data-ask-sentence="">{view.sentence}</p>
      {view.paydayLine ? (
        <p className="ask-payday" data-ask-payday="">{view.paydayLine}</p>
      ) : null}
      {view.showRoutes ? <RoutesSlot view={view} /> : null}
      {view.showDoor ? (
        <ul className="ask-doors">
          {view.alternatives.map((alternative) => {
            const pending = pendingRecurrenceId === alternative.recurrenceId;
            const confirmId = `ask-confirm-${alternative.recurrenceId}`;
            return (
            <li className="ask-door" data-ask-door="" key={alternative.recurrenceId}>
              <p>{alternative.copy}</p>
              <button
                type="button"
                className="ask-raise"
                data-ask-raise=""
                aria-expanded={pending}
                aria-controls={confirmId}
                disabled={busy}
                onClick={(event) => {
                  raiseRef.current = event.currentTarget;
                  if (pending) closeConfirmation("raise");
                  else setPendingRecurrenceId(alternative.recurrenceId);
                }}
              >
                Raise it
              </button>
              {pending ? (
                <div
                  className="ask-confirm"
                  id={confirmId}
                  data-ask-confirm=""
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeConfirmation("raise");
                  }}
                >
                  <p>Move the date only. No money moves.</p>
                  <div className="ask-confirm-actions">
                    <button
                      ref={confirmRef}
                      type="button"
                      className="ask-confirm-move"
                      data-ask-confirm-move=""
                      disabled={busy}
                      onClick={() => {
                        closeConfirmation("section");
                        onMove(alternative);
                      }}
                    >
                      Move {alternative.label} to next month
                    </button>
                    <button
                      type="button"
                      className="ask-confirm-cancel"
                      data-ask-confirm-cancel=""
                      disabled={busy}
                      onClick={() => closeConfirmation("raise")}
                    >
                      Keep this month
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
            );
          })}
        </ul>
      ) : null}
      {view.caveat ? (
        <p className="ask-caveat" data-ask-caveat="">{view.caveat}</p>
      ) : null}
    </section>
  );
}

function RoutesSlot({ view }: { view: AskPanelView }) {
  if (view.routes?.kind === "not-enough-data") {
    return (
      <p className="ask-refusal" data-ask-refusal="">
        {view.routes.copy}
      </p>
    );
  }
  if (!view.drawing) return null;
  return <RoutesDrawing drawing={view.drawing} />;
}

function RoutesDrawing({ drawing }: { drawing: AskRoutesDrawing }) {
  const whiskerY = ROUTE_VIEW.barY + ROUTE_VIEW.barHeight / 2;
  const capHalf = ROUTE_VIEW.whiskerCap / 2;
  const markTop = ROUTE_VIEW.header - 2;
  const markBottom = drawing.height - ROUTE_VIEW.footer + 4;

  return (
    <div
      className="ask-routes-scroll"
      tabIndex={0}
      role="img"
      aria-label={drawing.ariaLabel}
      data-ask-routes=""
    >
      <svg
        className="ask-routes-svg"
        viewBox={`0 0 ${drawing.width} ${drawing.height}`}
        width={drawing.width}
        height={drawing.height}
        aria-hidden="true"
        focusable="false"
      >
        <text className="ask-routes-header" x={ROUTE_VIEW.labelLeft} y="12">
          {drawing.header}
        </text>
        <line className="ask-rule" x1="0" y1="24" x2={drawing.width} y2="24" />
        <line
          className="ask-mark"
          x1={drawing.askX}
          y1={markTop}
          x2={drawing.askX}
          y2={markBottom}
        />
        {drawing.rows.map((row, index) => {
          const y = ROUTE_VIEW.header + index * ROUTE_VIEW.rowHeight;
          const tone = row.clears ? "clear" : "short";
          return (
            <g key={`${row.name}-${index}`} transform={`translate(0, ${y})`} data-ask-route={row.name}>
              <text className="ask-route-name" x={ROUTE_VIEW.labelLeft} y="14">{row.name}</text>
              <text className="ask-route-hours" x={ROUTE_VIEW.labelLeft} y="30">{row.hoursCopy}</text>
              {row.segments.map((segment, segmentIndex) => (
                <rect
                  key={`${segment.x}-${segmentIndex}`}
                  className={`ask-bar ask-bar-${tone}`}
                  x={segment.x}
                  y={ROUTE_VIEW.barY}
                  width={segment.width}
                  height={ROUTE_VIEW.barHeight}
                  opacity={segment.opacity}
                  data-ask-segment=""
                />
              ))}
              {row.whisker ? (
                <line
                  className={`ask-whisker ask-whisker-${tone}`}
                  x1={row.whisker.x1}
                  y1={whiskerY}
                  x2={row.whisker.x2}
                  y2={whiskerY}
                />
              ) : null}
              {row.capX != null ? (
                <line
                  className={`ask-whisker ask-whisker-${tone}`}
                  x1={row.capX}
                  y1={whiskerY - capHalf}
                  x2={row.capX}
                  y2={whiskerY + capHalf}
                />
              ) : null}
              <text
                className={`ask-route-status ask-route-status-${tone}`}
                x={ROUTE_VIEW.valueRight}
                y="16"
                textAnchor="end"
              >
                {row.status}
              </text>
            </g>
          );
        })}
        <text
          className="ask-mark-label"
          x={drawing.askX}
          y={drawing.height - 8}
          textAnchor="middle"
        >
          {drawing.askLabel}
        </text>
      </svg>
    </div>
  );
}
