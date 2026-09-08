import { DateTurn, TurnFocusBoundary, useTurnDate } from "./DateTurn.tsx";
import { levelTurnReading } from "./core/turnReading.ts";
import { LEVEL_PHONE_VIEW } from "./core/levelView.ts";
import { useId, type Ref } from "react";
import {
  LEVEL_UNTIED_LINE,
  LEVEL_VIEW,
  daysInMonthKey,
  formatCad,
  levelAria,
  levelDrawing,
  levelStageHeadline,
  levelSecondary,
  levelX,
  paydayTickAria,
  paydayTicks,
  parseDateKey,
  type FundWalk,
  type Household,
  type LevelPresentation,
} from "./core/index.ts";
import "./level.css";

type LevelProps = {
  walk: FundWalk;
  household: Household;
  presentation?: LevelPresentation;
  headingRef?: Ref<HTMLHeadingElement>;
  compact?: boolean;
  scopeKey?:string;
};

function ordinalDay(dateKey: string): string {
  const day = parseDateKey(dateKey).day;
  const rest = day % 100;
  const suffix = rest >= 11 && rest <= 13 ? "th"
    : day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

/**
 * The Fund's face. One rule carries the whole drawing: actual is solid,
 * projected is dashed — fact and forecast never share a stroke. Everything
 * here reads `FundWalk`; nothing here recomputes a balance.
 */
export function Level({ walk, household, presentation, headingRef, compact = false, scopeKey = `${household.environment}:${household.householdId}` }: LevelProps) {
  const turn=useTurnDate(scopeKey,JSON.stringify([walk,presentation]),walk.monthKey,walk.today);
  const reading=levelTurnReading(walk,turn.date);
  const headingId = useId();
  const view = compact ? LEVEL_PHONE_VIEW : LEVEL_VIEW;
  const drawing = levelDrawing(walk, view);
  const shown = presentation ?? drawing.presentation;
  const todayY = drawing.zeroY - walk.todayBalanceCents * drawing.pxPerCent;
  const rawTicks = shown === "ready" || shown === "day-one" ? paydayTicks(household, walk.monthKey) : [];
  const ticks = rawTicks.map((tick) => ({ x: levelX(tick.date, walk.monthKey, view) }));
  const lastDay = daysInMonthKey(walk.monthKey);
  const ariaLabel = shown === "untied" ? LEVEL_UNTIED_LINE
    : shown === "loading" ? "The Household Fund, loading"
      : shown === "error" ? "The Household Fund, unavailable"
        : [levelAria(walk), paydayTickAria(rawTicks)].filter(Boolean).join(" ");

  if (shown === "loading") {
    return (
      <section className={`level${compact ? " is-phone" : ""}`} aria-busy="true" aria-label="The Household Fund, loading">
        <p className="desk-plate-kicker">The Household Fund</p>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading level-figure">···</h2>
        <svg className="level-svg" viewBox={`0 0 ${view.width} ${view.height}`} aria-hidden="true" focusable="false">
          <line className="level-skeleton" x1={view.left} y1={view.axisY} x2={view.right} y2={view.axisY} />
        </svg>
      </section>
    );
  }

  if (shown === "error") {
    return (
      <section className={`level${compact ? " is-phone" : ""}`} aria-label="The Household Fund">
        <p className="desk-plate-kicker">The Household Fund</p>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">The Level</h2>
        <p className="level-status" role="status">I couldn't draw the Level from these books.</p>
      </section>
    );
  }

  return (
    <section className={`level${compact ? " is-phone" : ""}`} aria-labelledby={headingId}>
      <p className="desk-plate-kicker">The Household Fund</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading level-figure">
        {formatCad(walk.todayBalanceCents)}
      </h2>
      <TurnFocusBoundary scope={scopeKey}>
      <div className="level-scroll">
        <svg
          className="level-svg"
          viewBox={`0 0 ${view.width} ${view.height}`}
          width={view.width}
          height={view.height}
          role="img"
          aria-label={ariaLabel}
        >
          {reading.kind==="ready"&&<line className="turn-readhead" x1={levelX(turn.date,walk.monthKey,view)} x2={levelX(turn.date,walk.monthKey,view)} y1={view.top} y2={view.axisY}/>}
          {drawing.bands.map((band, index) => (
            <rect
              key={`band-${index}`}
              className="level-band"
              x={band.x}
              y={view.top}
              width={band.width}
              height={view.axisY - view.top}
            />
          ))}
          <line className="level-zero" x1={view.left} y1={drawing.zeroY} x2={view.right} y2={drawing.zeroY} />
          {walk.bufferCents > 0 ? (
            <>
              <line className="level-buffer" x1={view.left} y1={drawing.bufferY} x2={view.right} y2={drawing.bufferY} />
              <text className="level-label level-buffer-label" x={view.left + 4} y={drawing.bufferY - 6}>buffer</text>
            </>
          ) : null}
          {drawing.actualPath ? <path className="level-actual" d={drawing.actualPath} /> : null}
          {drawing.projectedPath ? <path className="level-projected" d={drawing.projectedPath} /> : null}
          {shown !== "untied" ? (
            <>
              <line className="level-today-line" x1={drawing.todayX} y1={view.top - 4} x2={drawing.todayX} y2={view.axisY} />
              <circle className="level-today-dot" cx={drawing.todayX} cy={todayY} r={view.markRadius} />
              <text className="level-label" x={drawing.todayX} y={view.top - 8} textAnchor="middle">today</text>
            </>
          ) : null}
          {drawing.marks.map((mark, index) => (
            <circle
              key={`mark-${index}`}
              className={`level-mark${mark.estimated ? " is-estimated" : ""}`}
              cx={mark.x}
              cy={mark.y}
              r={3}
            />
          ))}
          {drawing.dryMark ? (
            <>
              <circle className="level-dry-mark" cx={drawing.dryMark.x} cy={drawing.dryMark.y} r={4.5} />
              <text className="level-label level-dry-label" x={drawing.dryMark.x + 8} y={drawing.dryMark.y - 6}>
                {walk.dryDate ? `dry · ${ordinalDay(walk.dryDate)}` : "dry"}
              </text>
            </>
          ) : null}
          {ticks.map((tick, index) => (
            <line
              key={`tick-${index}`}
              className="level-payday-tick"
              x1={tick.x}
              y1={view.axisY + 1}
              x2={tick.x}
              y2={view.axisY + 9}
            />
          ))}
          <line className="level-axis" x1={view.left} y1={view.axisY} x2={view.right} y2={view.axisY} />
          <text className="level-label" x={view.left} y={view.labelY}>1</text>
          <text className="level-label" x={view.right} y={view.labelY} textAnchor="end">{lastDay}</text>
        </svg>
      </div>
      {shown!=="untied"&&reading.kind!=="unavailable"&&<DateTurn key={turn.key} day={turn.day} days={turn.days} date={turn.date} onChange={turn.setDay}/>}
      {shown!=="untied"&&reading.kind==="ready"&&<div className={`turn-reading ${reading.phase==="projected"?"is-projected":""}`} aria-live="polite">
        {reading.phase==="projected"&&<span className="reach-pill">Projection</span>}
        <p className="turn-reading-kicker">{turn.date} · {reading.phase==="projected"?"Projection":"Recorded through this day"}</p>
        <p>Fund <strong>{formatCad(reading.cents)}</strong></p>
        {reading.todayProjection!==null&&<p>After today’s scheduled items · projection <strong>{formatCad(reading.todayProjection)}</strong></p>}
        {reading.rows.length>0?<ol>{reading.rows.map((row,index)=><li key={index}>{row.label} · {row.actual?"recorded":row.estimated?"observed estimate":"scheduled"} · {formatCad(row.deltaCents)} → {formatCad(row.balanceCents)}</li>)}</ol>:<p>No dated movement. The last prepared reading carries forward.</p>}
      </div>}
      </TurnFocusBoundary>
      <p className="level-headline">{levelStageHeadline(walk)}</p>
      {levelSecondary(walk) ? <p className="level-secondary">{levelSecondary(walk)}</p> : null}
    </section>
  );
}
