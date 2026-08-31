import { useEffect, useRef, useState } from "react";
import { previewHoursLabel, previewHoursQuarter } from "./core/index.ts";

const QUARTER_HOUR_MS = 15 * 60_000;
const QUARTER_ROUNDING_MIDPOINT_MS = QUARTER_HOUR_MS / 2;

/** Delay until Math.round(elapsedHours * 4) can produce a new pad value. */
export function nextQuarterPreviewDelay(startedAt: string, nowMs = Date.now()): number {
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return QUARTER_HOUR_MS;
  const firstBoundary = startMs + QUARTER_ROUNDING_MIDPOINT_MS;
  if (nowMs < firstBoundary) return Math.max(1, firstBoundary - nowMs + 1);
  const completed = Math.floor((nowMs - firstBoundary) / QUARTER_HOUR_MS) + 1;
  return Math.max(1, firstBoundary + completed * QUARTER_HOUR_MS - nowMs + 1);
}

/**
 * Own the one-second display tick below App. The optional pad callback runs
 * only at quarter-hour rounding boundaries, so the full kitchen does not
 * render for seconds that cannot change the shift form.
 */
export function ShiftElapsedHint({
  startedAt,
  prefix = "",
  onQuarterHours,
}: {
  startedAt: string;
  prefix?: string;
  onQuarterHours?: (hours: number) => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const quarterCallback = useRef(onQuarterHours);
  quarterCallback.current = onQuarterHours;

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (!quarterCallback.current) return;
    let timer: number | null = null;
    const notifyAndSchedule = () => {
      const now = Date.now();
      quarterCallback.current?.(previewHoursQuarter(startedAt, now));
      timer = window.setTimeout(notifyAndSchedule, nextQuarterPreviewDelay(startedAt, now));
    };
    notifyAndSchedule();
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [startedAt]);

  return <p className="muted">{prefix}{previewHoursLabel(startedAt, nowMs)}</p>;
}
