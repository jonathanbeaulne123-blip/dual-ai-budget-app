import { formatDateLabel, TIMESHEET_EMPTY, timesheetEmpty } from "../core/index.ts";
import type { ShiftStreak } from "../core/shiftStreak.ts";

export function TimesheetGlance({ streak }: { streak: ShiftStreak }) {
  if (timesheetEmpty(streak)) return <span>clock</span>;
  return <span>{streak.count} · {streak.spoken}</span>;
}

export function TimesheetBody({
  streak,
  onLogShift,
}: {
  streak: ShiftStreak;
  onLogShift: () => void;
}) {
  if (timesheetEmpty(streak)) {
    return (
      <>
        <p className="muted">{TIMESHEET_EMPTY}</p>
        <button type="button" className="primary" onClick={onLogShift}>Log shift</button>
      </>
    );
  }
  return (
    <>
      <p>{streak.spoken}</p>
      <p className="muted">{streak.lesson}</p>
      {streak.lastDate && <p className="muted">Last shift {formatDateLabel(streak.lastDate)}</p>}
      {streak.waiting && (
        <button type="button" className="primary" onClick={onLogShift}>Log shift</button>
      )}
      {!streak.waiting && (
        <button type="button" className="chip" onClick={onLogShift}>Log shift</button>
      )}
    </>
  );
}
