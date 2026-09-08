import { ShiftPunch } from "../ShiftPunch.tsx";
import { useVisibleClock } from "../useVisibleClock.ts";
import { openShiftReview } from "../openShiftReview.ts";
import { Component, createRef, useEffect, useState, type ReactNode } from "react";
import {
  formatTorontoTime,
  TIMESHEET_EMPTY,
  timesheetEmpty,
  activeOpenShift,
  formatPreviewHours,
  openShiftElapsedHours,
  openShiftConflicts,
  previewClockSpan,
  todayShiftSpan,
  workedHoursFromOpenShift,
} from "../core/index.ts";
import type { ShiftStreak } from "../core/shiftStreak.ts";
import type { Household, LedgerView } from "../core/types.ts";
import { AnalogClockFace } from "./AnalogClock.tsx";

/** Snapshot focus before a keyed timeline disappears; never carry focus across rooms. */
class TimesheetFocusBoundary extends Component<{scope:string;children:ReactNode},object,boolean> {
  root=createRef<HTMLDivElement>();
  getSnapshotBeforeUpdate() { return !!this.root.current?.contains(document.activeElement); }
  componentDidUpdate(previous:Readonly<{scope:string;children:ReactNode}>,_state:object,hadFocus:boolean) {
    const root=this.root.current;
    if(hadFocus && root && previous.scope===this.props.scope && (document.activeElement===document.body || document.activeElement===root)) {
      const destination=root.querySelector<HTMLElement>(".shift-punch-handle:not(:disabled), .timesheet-status");
      (destination??root).focus();
    }
  }
  render(){return <div ref={this.root} tabIndex={-1} className="timesheet-focus-boundary">{this.props.children}</div>;}
}

export function TimesheetGlance({ household, streak, memberId }: { household: Household; streak: ShiftStreak; memberId: string }) {
  const punch = activeOpenShift(household.kitchen, memberId);
  const now = useVisibleClock(punch?.status === "open" && !punch.endedAt ? 15_000 : null);
  if (punch?.status === "confirming") return <span>{formatPreviewHours(openShiftElapsedHours(punch, now.getTime()))} h · review</span>;
  if (punch) return <span>{formatPreviewHours(openShiftElapsedHours(punch, now.getTime()))} h · live</span>;
  if (timesheetEmpty(streak, household.kitchen, memberId)) return <span>clock</span>;
  return <span>{streak.count} · {streak.spoken}</span>;
}

export function TimesheetBody({
  view = "household",
  household,
  streak,
  memberId,
  memberName,
  today,
  busy,
  onClockIn,
  onAbandon,
  onStartBreak,
  onEndBreak,
  onChooseTimeline,
  onSignOut,
  onFinished,
  previewHours,
  previewCaption,
  inlineConfirm,
  hideIdleActions,
}: {
  view?: LedgerView;
  household: Household;
  streak: ShiftStreak;
  memberId: string;
  memberName: string;
  today: string;
  busy: boolean;
  onClockIn: () => void;
  onAbandon: () => void;
  onStartBreak: (kind: "paid" | "unpaid" | "custom") => void;
  onEndBreak: () => void;
  onChooseTimeline: (openShiftId: string) => void;
  onSignOut: () => void;
  onFinished: () => void;
  previewHours?: number | null;
  previewCaption?: string | null;
  /** Parent hosts Confirm (Shift tab). Hide the Add-sheet review button. */
  inlineConfirm?: boolean;
  /** Parent is posting an already-off shift; hide Start shift / Already off. */
  hideIdleActions?: boolean;
}) {
  const punch = activeOpenShift(household.kitchen, memberId);
  const conflicts = openShiftConflicts(household.kitchen, memberId);
  const now = useVisibleClock(punch?.status === "open" && !punch.endedAt ? 15_000 : 60_000);
  const [phone, setPhone] = useState(() => window.innerWidth < 720);
  useEffect(() => { const resize=()=>setPhone(window.innerWidth<720);window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize); }, []);
  const span = todayShiftSpan(household, today, now.getTime(), memberId);
  const previewSpan = punch && previewHours ? previewClockSpan(punch.startedAt, previewHours) : null;
  const hours = punch ? workedHoursFromOpenShift(punch, now.getTime()) : null;
  const openBreak = punch?.breaks.find((item) => !item.endedAt);
  const who = punch
    ? household.members.find((member) => member.id === punch.memberId)?.name ?? "Someone"
    : memberName;
  const label = punch
    ? `${who} on the clock since ${formatTorontoTime(punch.startedAt)}. Now ${formatTorontoTime(now)}.`
    : span
      ? `Today's shift ${formatTorontoTime(span.startedAt)}–${formatTorontoTime(span.endedAt)}.`
      : `Toronto clock ${formatTorontoTime(now)}.`;

  return (
    <TimesheetFocusBoundary scope={JSON.stringify([household.environment,household.householdId,memberId,view])}>
      <AnalogClockFace now={now} span={span} previewSpan={previewSpan} label={label} />
      {previewCaption ? <p className="shift-preview-caption">{previewCaption}</p> : null}
      {conflicts.length > 1 ? (
        <div className="timesheet-conflict">
          <strong>Two devices recorded this shift</strong>
          <p className="muted">Choose the timeline you recognize. The other one is discarded without posting money.</p>
          {conflicts.map((row) => (
            <button type="button" className="chip" disabled={busy} key={row.id} onClick={() => onChooseTimeline(row.id)}>
              Use {formatTorontoTime(row.startedAt)}{row.endedAt ? `–${formatTorontoTime(row.endedAt)}` : "–now"}{row.sourceDeviceId ? ` · ${row.sourceDeviceId}` : ""}
            </button>
          ))}
        </div>
      ) : phone && punch?.status === "open" ? (
        <ShiftPunch key={JSON.stringify([view,openShiftReview(household,memberId),busy])} punch={punch} who={who} now={now} busy={busy}
          onStartBreak={onStartBreak} onEndBreak={onEndBreak} onClockOut={onSignOut} onAbandon={onAbandon} />
      ) : punch ? (
        <>
          <div className="timesheet-status" data-state={punch.status} tabIndex={-1}>
            <strong>{punch.status === "confirming" ? "Ready to review" : openBreak ? `${openBreak.label} in progress` : `${who} is on the clock`}</strong>
            <span>{formatPreviewHours(hours?.workedHours ?? 0)} h working</span>
          </div>
          <p className="muted">
            {formatTorontoTime(punch.startedAt)}{punch.endedAt ? `–${formatTorontoTime(punch.endedAt)}` : ` · now ${formatTorontoTime(now)}`}
            {hours && hours.paidBreakHours > 0 ? ` · ${formatPreviewHours(hours.paidBreakHours)} paid break` : ""}
            {hours && hours.unpaidBreakHours > 0 ? ` · ${formatPreviewHours(hours.unpaidBreakHours)} unpaid break` : ""}
          </p>
          {punch.breaks.length > 0 && (
            <ol className="timesheet-breaks" aria-label="Breaks this shift">
              {punch.breaks.map((item) => (
                <li key={item.id}>
                  <span>{item.label}</span>
                  <span>{formatTorontoTime(item.startedAt)}{item.endedAt ? `–${formatTorontoTime(item.endedAt)}` : "–now"}</span>
                </li>
              ))}
            </ol>
          )}
          {punch.status === "confirming" ? (
            inlineConfirm ? (
              <p className="muted">Nothing has reached the ledger yet. Review hours, scan a tip sheet, then Confirm below.</p>
            ) : (
              <>
                <button type="button" className="primary" disabled={busy} onClick={onSignOut}>Review &amp; confirm pay</button>
                <p className="muted">Nothing has reached the ledger yet. You can fix the clock and breaks on the review screen.</p>
              </>
            )
          ) : (
            <>
              <div className="timesheet-actions">
                {openBreak ? (
                  <button type="button" className="primary" disabled={busy} onClick={onEndBreak}>End break</button>
                ) : (
                  <>
                    <button type="button" className="chip" disabled={busy} onClick={() => onStartBreak("paid")}>Paid break</button>
                    <button type="button" className="chip" disabled={busy} onClick={() => onStartBreak("unpaid")}>Unpaid break</button>
                  </>
                )}
                <button type="button" className="primary" disabled={busy} onClick={onSignOut}>Clock out</button>
              </div>
              <button type="button" className="chip timesheet-never-mind" disabled={busy} onClick={onAbandon}>Discard this open shift</button>
            </>
          )}
        </>
      ) : (
        <>
          {span && !span.live ? (
            <p className="muted">Today's posted shift sits on the gold arc. A new day is just a clock.</p>
          ) : timesheetEmpty(streak, household.kitchen, memberId) ? (
            <p className="muted">{TIMESHEET_EMPTY} Start shift begins a preview. Confirm still posts.</p>
          ) : (
            <p className="muted">{streak.spoken} New days show a plain clock until you start a shift.</p>
          )}
          {hideIdleActions ? (
            <p className="muted">Post the finished shift below. Confirm still posts. Camera drafts only.</p>
          ) : (
            <>
              <button type="button" className="primary" disabled={busy} onClick={onClockIn}>Start shift · {memberName}</button>
              <button type="button" className={streak.waiting ? "primary" : "chip"} onClick={() => onFinished()}>Already off?</button>
            </>
          )}
        </>
      )}
    </TimesheetFocusBoundary>
  );
}
