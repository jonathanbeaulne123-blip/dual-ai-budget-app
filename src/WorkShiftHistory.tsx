import { useState } from "react";
import { formatCad, formatDateLabel, workShiftIsReversed, workShiftTransactionIds, type Household, type Shift } from "./core/index.ts";

export function WorkShiftHistoryCard({ household, memberId, busy, onCorrect }: {
  household: Household;
  memberId: string;
  busy: boolean;
  onCorrect: (shift: Shift, transactionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shifts = [...household.shifts]
    .filter((shift) => shift.memberId === memberId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, 40);
  const visible = expanded ? shifts : shifts.slice(0, 5);
  return (
    <section className="card work-history">
      <header><h2>Shifts worked</h2><span className="pill">{shifts.length || "none"}</span></header>
      <p className="muted">Confirmed shifts are locked. Correct replaces a shift while keeping the balanced reversal underneath.</p>
      {shifts.length === 0 ? <p>No confirmed shifts yet. Timesheet is ready when you are.</p> : visible.map((shift) => {
        const job = household.workJobs.find((row) => row.id === shift.jobId);
        const role = job?.roles.find((row) => row.id === shift.roleId);
        const ids = workShiftTransactionIds(shift);
        const reversed = workShiftIsReversed(household, shift);
        return (
          <article className={`work-history-row ${reversed ? "is-reversed" : ""}`} key={shift.id}>
            <div className="work-history-main">
              <span className="work-history-color" style={{ background: job?.color ?? "var(--copper)" }} aria-hidden="true" />
              <div><strong>{job?.name ?? "Legacy shift"}{role ? ` · ${role.name}` : ""}</strong><span>{formatDateLabel(shift.date)} · {shift.hours.toFixed(2)} h{shift.paidBreakHours ? ` + ${shift.paidBreakHours.toFixed(2)} paid break` : ""}</span></div>
            </div>
            <div className="work-history-money"><strong>{formatCad(shift.wagesCents + shift.netTipsCents)}</strong><span>{formatCad(shift.wagesCents)} wages · {formatCad(shift.netTipsCents)} tips</span></div>
            {reversed ? <span className="pill">replaced</span> : ids[0] ? <button type="button" className="chip" disabled={busy} onClick={() => onCorrect(shift, ids[0]!)}>Correct</button> : null}
          </article>
        );
      })}
      {shifts.length > 5 && <button type="button" className="chip work-history-expand" onClick={() => setExpanded((open) => !open)}>{expanded ? "Show recent 5" : `Show all ${shifts.length}`}</button>}
    </section>
  );
}
