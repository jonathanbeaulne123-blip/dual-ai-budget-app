import { useEffect, useMemo, useState } from "react";
import { freshnessUpdatedLine, type SyncFreshnessDisplay } from "./syncFreshness.ts";

type Props = {
  display: SyncFreshnessDisplay;
};

const TICK_MS = 30_000;

export function SyncFreshnessStatus({ display }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!display.visible || !display.updatedAtIso) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => window.clearInterval(timer);
  }, [display.visible, display.updatedAtIso]);

  const updatedLine = display.updatedAtIso
    ? freshnessUpdatedLine(display.updatedAtIso, new Date())
    : null;

  const statusSummary = useMemo(() => [
    display.transportPrimary,
    display.revisionLine,
    updatedLine,
    display.actorLine,
    display.sourceLine,
  ].filter(Boolean).join(". "), [
    display.transportPrimary,
    display.revisionLine,
    display.actorLine,
    display.sourceLine,
    updatedLine,
  ]);

  if (!display.visible) return null;

  return (
    <div
      className={`sync-freshness sync-freshness--${display.tone} sync-freshness--${display.transportMode}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sync-freshness__transport">
        {display.transportPrimary}
      </span>
      {display.revisionLine && (
        <span className="sync-freshness__revision">{display.revisionLine}</span>
      )}
      {updatedLine && (
        <span className="sync-freshness__updated">{updatedLine}</span>
      )}
      {display.actorLine && (
        <span className="sync-freshness__actor">{display.actorLine}</span>
      )}
      {display.sourceLine && (
        <span className="sync-freshness__source muted">{display.sourceLine}</span>
      )}
      <span className="sr-only">{statusSummary}</span>
    </div>
  );
}
