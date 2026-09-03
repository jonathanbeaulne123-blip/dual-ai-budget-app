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
export function Level({ walk, household, presentation, headingRef }: LevelProps) {
  const headingId = useId();
  const drawing = levelDrawing(walk);
  const shown = presentation ?? drawing.presentation;
  const todayY = drawing.zeroY - walk.todayBalanceCents * drawing.pxPerCent;
  const rawTicks = shown === "ready" || shown === "day-one" ? paydayTicks(household, walk.monthKey) : [];
  const ticks = rawTicks.map((tick) => ({ x: levelX(tick.date, walk.monthKey) }));
  const lastDay = daysInMonthKey(walk.monthKey);
  const ariaLabel = shown === "untied" ? LEVEL_UNTIED_LINE
    : shown === "loading" ? "The Household Fund, loading"
      : shown === "error" ? "The Household Fund, unavailable"
        : [levelAria(walk), paydayTickAria(rawTicks)].filter(Boolean).join(" ");

  if (shown === "loading") {
    return (
      <section className="level" aria-busy="true" aria-label="The Household Fund, loading">
        <p className="desk-plate-kicker">The Household Fund</p>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading level-figure">···</h2>
        <svg className="level-svg" viewBox={`0 0 ${LEVEL_VIEW.width} ${LEVEL_VIEW.height}`} aria-hidden="true" focusable="false">
          <line className="level-skeleton" x1={LEVEL_VIEW.left} y1={LEVEL_VIEW.axisY} x2={LEVEL_VIEW.right} y2={LEVEL_VIEW.axisY} />
        </svg>
      </section>
    );
  }

  if (shown === "error") {
    return (
      <section className="level" aria-label="The Household Fund">
        <p className="desk-plate-kicker">The Household Fund</p>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">The Level</h2>
        <p className="level-status" role="status">I couldn't draw the Level from these books.</p>
      </section>
    );
  }

  return (
    <section className="level" aria-labelledby={headingId}>
      <p className="desk-plate-kicker">The Household Fund</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading level-figure">
        {formatCad(walk.todayBalanceCents)}
      </h2>
      <div className="level-scroll">
        <svg
          className="level-svg"
          viewBox={`0 0 ${LEVEL_VIEW.width} ${LEVEL_VIEW.height}`}
          width={LEVEL_VIEW.width}
          height={LEVEL_VIEW.height}
          role="img"
          aria-label={ariaLabel}
        >
          {drawing.bands.map((band, index) => (
            <rect
              key={`band-${index}`}
              className="level-band"
              x={band.x}
              y={LEVEL_VIEW.top}
              width={band.width}
              height={LEVEL_VIEW.axisY - LEVEL_VIEW.top}
            />
          ))}
          <line className="level-zero" x1={LEVEL_VIEW.left} y1={drawing.zeroY} x2={LEVEL_VIEW.right} y2={drawing.zeroY} />
          {walk.bufferCents > 0 ? (
            <>
              <line className="level-buffer" x1={LEVEL_VIEW.left} y1={drawing.bufferY} x2={LEVEL_VIEW.right} y2={drawing.bufferY} />
              <text className="level-label level-buffer-label" x={LEVEL_VIEW.left + 4} y={drawing.bufferY - 6}>buffer</text>
            </>
          ) : null}
          {drawing.actualPath ? <path className="level-actual" d={drawing.actualPath} /> : null}
          {drawing.projectedPath ? <path className="level-projected" d={drawing.projectedPath} /> : null}
          {shown !== "untied" ? (
            <>
              <line className="level-today-line" x1={drawing.todayX} y1={LEVEL_VIEW.top - 4} x2={drawing.todayX} y2={LEVEL_VIEW.axisY} />
              <circle className="level-today-dot" cx={drawing.todayX} cy={todayY} r={LEVEL_VIEW.markRadius} />
              <text className="level-label" x={drawing.todayX} y={LEVEL_VIEW.top - 8} textAnchor="middle">today</text>
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
              y1={LEVEL_VIEW.axisY + 1}
              x2={tick.x}
              y2={LEVEL_VIEW.axisY + 9}
            />
          ))}
          <line className="level-axis" x1={LEVEL_VIEW.left} y1={LEVEL_VIEW.axisY} x2={LEVEL_VIEW.right} y2={LEVEL_VIEW.axisY} />
          <text className="level-label" x={LEVEL_VIEW.left} y={LEVEL_VIEW.labelY}>1</text>
          <text className="level-label" x={LEVEL_VIEW.right} y={LEVEL_VIEW.labelY} textAnchor="end">{lastDay}</text>
        </svg>
      </div>
      <p className="level-headline">{levelStageHeadline(walk)}</p>
      {levelSecondary(walk) ? <p className="level-secondary">{levelSecondary(walk)}</p> : null}
    </section>
  );
}
