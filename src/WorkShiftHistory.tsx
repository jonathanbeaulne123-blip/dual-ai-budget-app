import { useState } from "react";
import { formatCad, formatDateLabel, workShiftIsReversed, workShiftTransactionIds, type Household, type Shift } from "./core/index.ts";

export function WorkShiftHistoryCard({ household, memberId, busy, onCorrect, initialVisible = 5, title = "Shifts worked", intro }: {
  household: Household;
  memberId: string;
  busy: boolean;
  onCorrect: (shift: Shift, transactionId: string) => void;
  initialVisible?: number;
  title?: string;
  intro?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [openBibleId, setOpenBibleId] = useState<string | null>(null);
  const peek = Math.max(1, initialVisible);
  const shifts = [...household.shifts]
    .filter((shift) => shift.memberId === memberId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, 40);
  const visible = expanded ? shifts : shifts.slice(0, peek);
  return (
    <section className="card work-history">
      <header><h2>{title}</h2><span className="pill">{shifts.length || "none"}</span></header>
      <p className="muted">{intro ?? "Confirmed shifts are locked. Correct replaces a shift while keeping the balanced reversal underneath."}</p>
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
            {shift.shiftBible ? <button type="button" className="chip" aria-expanded={openBibleId === shift.shiftBible.id} onClick={() => setOpenBibleId((current) => current === shift.shiftBible!.id ? null : shift.shiftBible!.id)}>Open Bible</button> : null}
            {reversed ? <span className="pill">replaced</span> : !shift.shiftBible && ids[0] ? <button type="button" className="chip" disabled={busy} onClick={() => onCorrect(shift, ids[0]!)}>Correct</button> : null}
            {shift.shiftBible && openBibleId === shift.shiftBible.id ? (
              <div className="work-bible-detail" role="region" aria-label={`${shift.date} confirmed Shift Bible`}>
                <p><strong>Actual:</strong> {shift.shiftBible.actualStart ? new Date(shift.shiftBible.actualStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "missing"}–{shift.shiftBible.actualEnd ? new Date(shift.shiftBible.actualEnd).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "missing"} · {shift.shiftBible.workedMinutes == null ? "missing hours" : `${(shift.shiftBible.workedMinutes / 60).toFixed(2)} h`}</p>
                <p><strong>Breaks:</strong> {shift.shiftBible.paidBreakMinutes == null ? "paid missing" : `${shift.shiftBible.paidBreakMinutes} paid min`} · {shift.shiftBible.unpaidBreakMinutes == null ? "unpaid missing" : `${shift.shiftBible.unpaidBreakMinutes} unpaid min`}</p>
                <p><strong>Tips / sales:</strong> {shift.shiftBible.cashTipsCents == null ? "cash missing" : `${formatCad(shift.shiftBible.cashTipsCents)} cash`} · {shift.shiftBible.cardTipsCents == null ? "card missing" : `${formatCad(shift.shiftBible.cardTipsCents)} card`} · {shift.shiftBible.salesCents == null ? "sales missing" : `${formatCad(shift.shiftBible.salesCents)} sales`}</p>
                <p><strong>Context:</strong> {shift.shiftBible.customersServed == null ? "covers missing" : `${shift.shiftBible.customersServed} covers`} · {shift.shiftBible.staffingCount == null ? "staffing missing" : `${shift.shiftBible.staffingCount} staff`} · weather {shift.shiftBible.weather?.state ?? "missing"}</p>
                <p className="muted">Bible revision {shift.shiftBible.revision}. Context backfills append a revision. Financial edits use an exact reversal and replacement.</p>
                {!reversed && ids[0] ? <button type="button" className="primary" disabled={busy} onClick={() => onCorrect(shift, ids[0]!)}>Correct this Bible</button> : null}
              </div>
            ) : null}
          </article>
        );
      })}
      {shifts.length > peek && <button type="button" className="chip work-history-expand" onClick={() => setExpanded((open) => !open)}>{expanded ? `Show recent ${peek}` : `Show all ${shifts.length}`}</button>}
    </section>
  );
}
