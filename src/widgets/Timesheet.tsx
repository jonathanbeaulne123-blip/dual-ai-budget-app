import { useEffect, useState } from "react";
import {
  formatTorontoTime,
  TIMESHEET_EMPTY,
  timesheetEmpty,
  activeOpenShift,
  previewHoursLabel,
  todayShiftSpan,
} from "../core/index.ts";
import type { ShiftStreak } from "../core/shiftStreak.ts";
import type { Household } from "../core/types.ts";
import { AnalogClockFace } from "./AnalogClock.tsx";

export function TimesheetGlance({ household, streak }: { household: Household; streak: ShiftStreak }) {
  const punch = activeOpenShift(household.kitchen);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1_000);
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
  today,
  busy,
  onClockIn,
  onAbandon,
  onSignOut,
  onFinished,
}: {
  household: Household;
  streak: ShiftStreak;
  memberName: string;
  today: string;
  busy: boolean;
  onClockIn: () => void;
  onAbandon: () => void;
  onSignOut: () => void;
  onFinished: () => void;
}) {
  const punch = activeOpenShift(household.kitchen);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  const span = todayShiftSpan(household, today, now.getTime());
  const who = punch
    ? household.members.find((member) => member.id === punch.memberId)?.name ?? "Someone"
    : memberName;
  const label = punch
    ? `${who} on the clock since ${formatTorontoTime(punch.startedAt)}. Now ${formatTorontoTime(now)}.`
    : span
      ? `Today's shift ${formatTorontoTime(span.startedAt)}–${formatTorontoTime(span.endedAt)}.`
      : `Toronto clock ${formatTorontoTime(now)}.`;

  return (
    <>
      <AnalogClockFace now={now} span={span} label={label} />
      {punch ? (
        <>
          <p>{who} started at {formatTorontoTime(punch.startedAt)}.</p>
          <p className="muted">Now {formatTorontoTime(now)}. {previewHoursLabel(punch.startedAt)}. Hours post when you sign out and Confirm.</p>
          <button type="button" className="primary" disabled={busy} onClick={onSignOut}>Sign out</button>
          <button type="button" className="chip" disabled={busy} onClick={onAbandon}>Never mind</button>
        </>
      ) : (
        <>
          {span && !span.live ? (
            <p className="muted">Today's posted shift sits on the gold arc. A new day is just a clock.</p>
          ) : timesheetEmpty(streak, household.kitchen) ? (
            <p className="muted">{TIMESHEET_EMPTY} Start shift begins a preview. Confirm still posts.</p>
          ) : (
            <p className="muted">{streak.spoken} New days show a plain clock until you start a shift.</p>
          )}
          <button type="button" className="primary" disabled={busy} onClick={onClockIn}>Start shift · {memberName}</button>
          <button type="button" className={streak.waiting ? "primary" : "chip"} onClick={onFinished}>Already off?</button>
        </>
      )}
    </>
  );
}