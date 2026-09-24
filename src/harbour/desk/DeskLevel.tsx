import { useId, useMemo, useState } from "react";
import type { FundWalk } from "../../core/fundWalk.ts";
import { LEVEL_PHONE_VIEW, LEVEL_UNTIED_LINE, levelAria, levelDrawing, levelStageHeadline, type LevelGeometry } from "../../core/levelView.ts";
import { daysInMonthKey } from "../../core/calendar.ts";
import { engravedCents } from "./engraved.ts";

/**
 * The Level, small (SIMPLE_VIEW_DESK S2): the month's Fund walk as an inked
 * line on graph paper — actual solid, projected dashed, the buffer as a
 * copper rule, the dry date marked. It is drawn from `levelDrawing` over the
 * walk, the same geometry `src/Level.tsx` uses, in two compact sizes; a tap
 * unfolds it to the taller one in place. Nothing here recomputes a balance.
 *
 * The drawing stretches to its card (`preserveAspectRatio="none"`) with
 * non-scaling strokes, so every mark is a stroke — a tick, a rule — never a
 * circle that would stretch into an egg; words sit in HTML beneath it.
 */
const SMALL: LevelGeometry = { ...LEVEL_PHONE_VIEW, height: 96, top: 12, axisY: 88, labelY: 96 };
const TALL: LevelGeometry = { ...LEVEL_PHONE_VIEW, height: 214, top: 22, axisY: 204, labelY: 214 };

export function DeskLevel({ walk }: { walk: FundWalk | null }) {
  const [tall, setTall] = useState(false);
  const figureId = useId();
  const view = tall ? TALL : SMALL;
  const drawing = useMemo(() => (walk ? levelDrawing(walk, view) : null), [walk, view]);
  if (!walk || !drawing) {
    return <div className="desk-level desk-level--empty" data-desk-level="none">
      <p className="desk-card__kicker">The Level</p>
      <p className="desk-level__line">The shared Fund has no walk of the month yet.</p>
    </div>;
  }
  const untied = drawing.presentation === "untied";
  const headline = untied ? LEVEL_UNTIED_LINE : levelStageHeadline(walk);
  const lastDay = daysInMonthKey(walk.monthKey);
  const tick = tall ? 9 : 6;
  return <div className="desk-level" data-desk-level={tall ? "tall" : "small"} data-level-presentation={drawing.presentation}>
    <p className="desk-card__kicker">The Level · the Fund this month</p>
    <button type="button" className="desk-level__press" aria-expanded={tall} aria-controls={figureId}
      aria-label={`${untied ? LEVEL_UNTIED_LINE : levelAria(walk)} ${tall ? "Fold the Level back down." : "Unfold the Level."}`}
      onClick={() => setTall(open => !open)}>
      <span className="desk-level__paper" id={figureId}>
        <svg className="desk-level__drawing" viewBox={`0 0 ${view.width} ${view.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {drawing.bands.map((band, i) => <rect key={i} className="desk-level__band" x={band.x} width={Math.max(1, band.width)} y={view.top} height={Math.max(0, view.axisY - view.top)} />)}
          <line className="desk-level__axis" x1={view.left} x2={view.right} y1={drawing.zeroY} y2={drawing.zeroY} />
          {walk.bufferCents > 0 && <line className="desk-level__buffer" x1={view.left} x2={view.right} y1={drawing.bufferY} y2={drawing.bufferY} />}
          <line className="desk-level__today" x1={drawing.todayX} x2={drawing.todayX} y1={view.top - 8} y2={view.axisY} />
          {drawing.projectedPath && <path className="desk-level__projected" d={drawing.projectedPath} />}
          {drawing.actualPath && <path className="desk-level__actual" d={drawing.actualPath} />}
          {drawing.marks.map((mark, i) => <line key={i} className={`desk-level__mark${mark.estimated ? " is-estimated" : ""}`} x1={mark.x} x2={mark.x} y1={mark.y - tick} y2={mark.y} />)}
          {drawing.dryMark && <line className="desk-level__dry" x1={drawing.dryMark.x} x2={drawing.dryMark.x} y1={view.top} y2={view.axisY} />}
        </svg>
        <span className="desk-level__days" aria-hidden="true"><span>1</span><span>{lastDay}</span></span>
      </span>
      <span className="desk-level__line">{headline}</span>
      {tall && !untied && <span className="desk-level__legend">
        <span><i className="desk-level__key desk-level__key--actual" aria-hidden="true" />Posted</span>
        <span><i className="desk-level__key desk-level__key--projected" aria-hidden="true" />Ahead</span>
        {walk.bufferCents > 0 && <span><i className="desk-level__key desk-level__key--buffer" aria-hidden="true" />Buffer {engravedCents(walk.bufferCents)}</span>}
        {walk.dryDate && <span><i className="desk-level__key desk-level__key--dry" aria-hidden="true" />Runs dry</span>}
      </span>}
    </button>
  </div>;
}
