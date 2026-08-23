import { useEffect, useState } from "react";
import {
  formatDateLabel,
  TIMESHEET_EMPTY,
  timesheetEmpty,
  activeOpenShift,
  previewHoursLabel,
} from "../core/index.ts";
import type { ShiftStreak } from "../core/shiftStreak.ts";
import type { Household } from "../core/types.ts";

export function TimesheetGlance({ household, streak }: { household: Household; streak: ShiftStreak }) {
  const punch = activeOpenShift(household.kitchen);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!punch) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [punch?.startedAt]);
  if (punch) return <span>{previewHoursLabel(punch.startedAt).split(" · ")[0]}</span>;
  if (timesheetEmpty(streak, household.kitchen)) return <span>clock</span>;
  return <span>{streak.count} · {streak.spoken}</span>;
}

export function TimesheetBody({
  household,
  streak,
  memberName,
  busy,
  onClockIn,
  onAbandon,
  onSignOut,
  onFinished,
}: {
  household: Household;
  streak: ShiftStreak;
  memberName: string;
  busy: boolean;
  onClockIn: () => void;
  onAbandon: () => void;
  onSignOut: () => void;
  onFinished: () => void;
}) {
  const punch = activeOpenShift(household.kitchen);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!punch) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [punch?.startedAt]);

  if (punch) {
    const who = household.members.find((member) => member.id === punch.memberId)?.name ?? "Someone";
    return (
      <>
        <p>{who} is on the clock.</p>
        <p className="muted">{previewHoursLabel(punch.startedAt)}. Hours post when you sign out and Confirm.</p>
        <button type="button" className="primary" disabled={busy} onClick={onSignOut}>Sign out</button>
        <button type="button" className="chip" disabled={busy} onClick={onAbandon}>Never mind</button>
      </>
    );
  }

  if (timesheetEmpty(streak, household.kitchen)) {
    return (
      <>
        <p className="muted">{TIMESHEET_EMPTY} Clock in starts a preview. Confirm still posts.</p>
        <button type="button" className="primary" disabled={busy} onClick={onClockIn}>Clock in · {memberName}</button>
        <button type="button" className="chip" onClick={onFinished}>Already off?</button>
      </>
    );
  }

  return (
    <>
      <p>{streak.spoken}</p>
      <p className="muted">{streak.lesson}</p>
      {streak.lastDate && <p className="muted">Last posted shift {formatDateLabel(streak.lastDate)}</p>}
      <button type="button" className="primary" disabled={busy} onClick={onClockIn}>Clock in · {memberName}</button>
      <button type="button" className={streak.waiting ? "primary" : "chip"} onClick={onFinished}>Already off?</button>
    </>
  );
}
