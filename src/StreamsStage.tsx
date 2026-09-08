import { useId, type Ref } from "react";
import { formatDateLabel, formatMonthLabel, shiftMonthKey, streamWindowStart, type DateKey, type MemberStream, type StreamMark } from "./core/index.ts";

/**
 * Confirmed contribution timing, drawn on one timeline. Each member gets a
 * stable lane alternating around the common baseline. The line is a line,
 * not a ledger: nothing here sums or measures what one stream comes to
 * against another.
 */

const STAGE_WIDTH = 520;
const MIN_STAGE_HEIGHT = 200;
const MARK_RADIUS = 5;
const LANE_GAP = 24;
const EDGE_VERTICAL = 24;
const PLOT_LEFT = 96;
const PLOT_RIGHT = 24;

function xFor(date: DateKey, start: DateKey, end: DateKey): number {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  const time = Date.parse(`${date}T00:00:00Z`);
  if (endTime <= startTime) return STAGE_WIDTH / 2;
  const pct = (time - startTime) / (endTime - startTime);
  return PLOT_LEFT + pct * (STAGE_WIDTH - PLOT_LEFT - PLOT_RIGHT);
}

function dateClusters(marks: readonly StreamMark[]): Array<{ date: DateKey; count: number }> {
  const counts = new Map<DateKey, number>();
  for (const mark of marks) counts.set(mark.date, (counts.get(mark.date) ?? 0) + 1);
  return [...counts].map(([date, count]) => ({ date, count }));
}

function laneY(index: number, baselineY: number): number {
  const side = index % 2 === 0 ? -1 : 1;
  const tier = Math.floor(index / 2) + 1;
  return baselineY + side * tier * LANE_GAP;
}

export function StreamsStage({
  streams,
  today,
  nameOf,
  headingRef, compact = false,
}: {
  streams: MemberStream[];
  compact?: boolean;
  today: DateKey;
  nameOf: (memberId: string) => string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const headingId = useId();
  const first = streams[0];
  const start = streamWindowStart(today);
  const end = today;
  const stageHeight = Math.max(MIN_STAGE_HEIGHT, 2 * (EDGE_VERTICAL + Math.ceil(streams.length / 2) * LANE_GAP));
  const baselineY = stageHeight / 2;

  if (compact) {
    const months = Array.from({length:6},(_,index)=>shiftMonthKey(today.slice(0,7), index-5));
    return <section className="streams-stage streams-phone" aria-labelledby={headingId}>
      <p className="desk-plate-kicker">The two streams</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">Confirmed contributions</h2>
      {streams.length ? <div className="streams-months" role="table" aria-label="Six months of confirmed contribution dates">
        <div className="streams-month-row" role="row" style={{gridTemplateColumns:`minmax(0,.8fr) repeat(${streams.length},minmax(0,1fr))`}}><span role="columnheader">Month</span>{streams.map(stream=><span role="columnheader" key={stream.memberId}>{nameOf(stream.memberId)}</span>)}</div>
        {months.map(month=><div role="row" className="streams-month-row" key={month} style={{gridTemplateColumns:`minmax(0,.8fr) repeat(${streams.length},minmax(0,1fr))`}}><span role="rowheader">{formatMonthLabel(month)}</span>{streams.map(stream=>{
          const marks=dateClusters(stream.marks.filter(mark=>mark.date.startsWith(month)));
          return <span role="cell" key={stream.memberId} className="streams-month-marks">{marks.length ? marks.map(mark=><span className="streams-date-mark" key={mark.date}><i aria-hidden="true"/><time dateTime={mark.date} aria-label={`${formatDateLabel(mark.date)}, ${mark.count} confirmed ${mark.count===1?'contribution':'contributions'}`}>{Number(mark.date.slice(8))}{mark.count > 1 ? ` ×${mark.count}` : ''}</time></span>) : <span aria-label="No confirmed contributions">—</span>}</span>;
        })}</div>)}
      </div> : <p className="desk-plate-empty">Not enough confirmed contributions yet to draw either stream.</p>}
      {streams.map(stream=><p key={stream.memberId} className="desk-plate-detail">{nameOf(stream.memberId)} · {stream.cadenceLabel}</p>)}
      <p className="desk-plate-foot">Six months of confirmed contributions. Each mark is a date; amounts are never compared.</p>
    </section>;
  }
  return (
    <section className="streams-stage" aria-labelledby={headingId}>
      <p className="desk-plate-kicker">The two streams</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">
        {streams.length > 1 ? `${streams.length} contribution streams` : first ? `${nameOf(first.memberId)} · ${first.cadenceLabel}` : "Not enough yet"}
      </h2>
      {streams.length === 0 || !first ? (
        <p className="desk-plate-empty">Not enough confirmed contributions yet to draw either stream.</p>
      ) : (
        <>
          <p className="desk-plate-detail">
            {streams.length > 1
              ? `${streams.map((stream) => `${nameOf(stream.memberId)} gives ${stream.cadenceLabel}`).join("; ")}.`
              : `${nameOf(first.memberId)} gives ${first.cadenceLabel}. No confirmed contribution from anyone else yet.`}
          </p>
          <svg
            className="streams-svg desk-plate-svg"
            viewBox={`0 0 ${STAGE_WIDTH} ${stageHeight}`}
            aria-hidden="true"
          >
            <line className="streams-baseline" x1={PLOT_LEFT} y1={baselineY} x2={STAGE_WIDTH - PLOT_RIGHT} y2={baselineY} />
            {streams.map((stream, streamIndex) => {
              const y = laneY(streamIndex, baselineY);
              const countY = y + (streamIndex % 2 === 0 ? -12 : 16);
              return (
                <g key={stream.memberId}>
                  <text className="streams-lane-label" x={8} y={y + 3}>{nameOf(stream.memberId)}</text>
                  {dateClusters(stream.marks).map((cluster) => (
                    <g key={cluster.date}>
                      <circle className="streams-mark" cx={xFor(cluster.date, start, end)} cy={y} r={MARK_RADIUS} />
                      {cluster.count > 1 ? <text className="streams-mark-count" x={xFor(cluster.date, start, end)} y={countY}>×{cluster.count}</text> : null}
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
          <ul className="sr-only">
            {streams.map((stream) => (
              <li key={stream.memberId}>
                {nameOf(stream.memberId)}: {dateClusters(stream.marks).map((cluster) => (
                  `${formatDateLabel(cluster.date)}${cluster.count > 1 ? ` (${cluster.count} confirmed contributions)` : ""}`
                )).join(", ")}. {stream.cadenceLabel}.
              </li>
            ))}
          </ul>
          <div className="streams-legend">
            {streams.map((stream) => (
              <p key={stream.memberId} className="desk-plate-detail streams-legend-row">
                <span className="streams-swatch" aria-hidden="true" />
                {nameOf(stream.memberId)} · {stream.cadenceLabel}
              </p>
            ))}
          </div>
        </>
      )}
      <p className="desk-plate-foot">Six months of confirmed contributions. Never combined, never compared.</p>
    </section>
  );
}
