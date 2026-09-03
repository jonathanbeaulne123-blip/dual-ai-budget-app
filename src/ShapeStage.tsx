import { useId, type Ref } from "react";
import { formatCad, type CategoryShape } from "./core/index.ts";

/**
 * Small multiples: one card per category, each against its own trailing
 * three months. Never against a sibling category, never against a
 * household total — that reading lives in categoryShape.ts, this only
 * draws it.
 */

const CARD_WIDTH = 120;
const CARD_HEIGHT = 40;
const CARD_INSET = 4;
const DOT_RADIUS = 3.5;

function verdictLabel(row: CategoryShape): string {
  if (row.verdict === "above") return `${formatCad(row.deltaCents)} above`;
  if (row.verdict === "quiet") return "quiet";
  if (row.verdict === "in-shape") return "in shape";
  if (row.verdict === "one-off") return "one-off";
  return row.monthsSeen > 0 ? `${row.monthsSeen} of 3 months seen` : "no history yet";
}

/** cents → y, high value near the top. A flat domain still gets room to draw a dot. */
function scaleY(cents: number, min: number, max: number): number {
  const span = max - min || 1;
  const pct = Math.min(1, Math.max(0, (cents - min) / span));
  return CARD_HEIGHT - CARD_INSET - pct * (CARD_HEIGHT - CARD_INSET * 2);
}

function ShapeCard({ row }: { row: CategoryShape }) {
  const hasBand = row.verdict === "above" || row.verdict === "in-shape" || row.verdict === "quiet";
  const min = hasBand ? Math.min(row.bandLowCents, row.monthToDateCents) : 0;
  const max = hasBand ? Math.max(row.bandHighCents, row.monthToDateCents) : Math.max(row.monthToDateCents, 1);
  const dotY = scaleY(row.monthToDateCents, min, max);
  const bandTopY = hasBand ? scaleY(row.bandHighCents, min, max) : 0;
  const bandBottomY = hasBand ? scaleY(row.bandLowCents, min, max) : 0;
  const dotTone = row.verdict === "above" ? "is-over" : hasBand ? "is-in" : "is-unread";

  return (
    <li className="shape-card">
      <p className="shape-card-name">{row.label}</p>
      <p className={`shape-card-verdict is-${row.verdict}`}>{verdictLabel(row)}</p>
      <svg
        className="shape-card-svg"
        viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
        role="img"
        aria-label={`${row.label}: ${verdictLabel(row)}, this month ${formatCad(row.monthToDateCents)}${
          hasBand ? `, three-month range ${formatCad(row.bandLowCents)} to ${formatCad(row.bandHighCents)}` : ""
        }`}
      >
        {hasBand ? (
          <rect
            className="shape-band"
            x={0}
            y={bandTopY}
            width={CARD_WIDTH}
            height={Math.max(1, bandBottomY - bandTopY)}
          />
        ) : null}
        <circle className={`shape-dot ${dotTone}`} cx={CARD_WIDTH - 6} cy={dotY} r={DOT_RADIUS} />
      </svg>
    </li>
  );
}

export function ShapeStage({
  rows, headingRef,
}: {
  rows: CategoryShape[];
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const headingId = useId();
  const overCount = rows.filter((row) => row.verdict === "above").length;
  const comparableCount = rows.filter((row) => (
    row.verdict === "above" || row.verdict === "in-shape" || row.verdict === "quiet"
  )).length;

  return (
    <section className="shape-stage" aria-labelledby={headingId}>
      <p className="desk-plate-kicker">The shape</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">
        {overCount > 0 ? `${overCount} over shape` : comparableCount > 0 ? "Nothing over shape" : "Not enough yet"}
      </h2>
      <p className="desk-plate-detail">
        Each category against its own trailing three months — never against another category, and never
        against the other person.
      </p>
      {rows.length === 0 ? (
        <p className="desk-plate-empty">Not enough history yet to draw a shape for anything.</p>
      ) : (
        <ul className="shape-grid">
          {rows.map((row) => <ShapeCard key={row.subcategoryId} row={row} />)}
        </ul>
      )}
    </section>
  );
}
