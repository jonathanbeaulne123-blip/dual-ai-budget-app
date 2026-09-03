import { useId, type Ref } from "react";
import { formatCad, formatDateLabel, nextOut, spokenFor, type DateKey, type FundWalk } from "./core/index.ts";

/**
 * The full read on what leaves next, and what's already spoken for. Both
 * numbers come from the same walk shown everywhere else on the Fund board —
 * this stage draws a bigger picture of it, never a second one.
 */

function ordinal(date: DateKey): string {
  const day = Number(date.slice(8, 10));
  const rest = day % 100;
  const suffix = rest >= 11 && rest <= 13 ? "th"
    : day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

export function NextOutStage({
  walk, today, headingRef,
}: {
  walk: FundWalk;
  today: DateKey;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const headingId = useId();
  const claim = spokenFor(walk, today);
  const table = nextOut(walk);
  const barPct = claim.poolCents > 0
    ? Math.min(1, claim.claimedCents / claim.poolCents)
    : claim.claimedCents > 0 ? 1 : 0;

  return (
    <section className="next-out-stage" aria-labelledby={headingId}>
      <p className="desk-plate-kicker">Spoken for</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">
        {claim.overCents > 0 ? `${formatCad(claim.overCents)} over` : `${formatCad(claim.freeCents)} free`}
      </h2>
      <p className={`desk-plate-detail${claim.overCents > 0 ? " is-copper" : ""}`}>
        {claim.overCents > 0
          ? `Claims of ${formatCad(claim.claimedCents)} sit against ${formatCad(claim.poolCents)} in the pool.`
          : `${formatCad(claim.claimedCents)} of ${formatCad(claim.poolCents)} is already claimed.`}
        {" "}Through the {ordinal(claim.throughDate)}.
      </p>
      <div className="next-out-bar" role="img" aria-label={`${formatCad(claim.claimedCents)} claimed of ${formatCad(claim.poolCents)} in the pool`}>
        <div
          className={`next-out-bar-fill${claim.overCents > 0 ? " is-over" : ""}`}
          style={{ width: `${Math.round(barPct * 100)}%` }}
        />
      </div>

      <p className="desk-plate-kicker next-out-table-kicker">Next out</p>
      {table.rows.length === 0 ? (
        <p className="desk-plate-empty">Nothing owed for the rest of the month.</p>
      ) : (
        <div className="next-out-table-wrap">
          <table className="next-out-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Bill</th>
                <th scope="col">Amount</th>
                <th scope="col">Leaves</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.id} className={row.underBuffer ? "is-copper" : ""}>
                  <td>{formatDateLabel(row.date)}</td>
                  <td>{row.label}</td>
                  <td>{formatCad(row.amountCents)}</td>
                  <td>{formatCad(row.leavesCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {table.breakRow ? (
            <p className="next-out-break desk-plate-detail is-copper">
              {table.breakRow.label} is the one that breaks it.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
