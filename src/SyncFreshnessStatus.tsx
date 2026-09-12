import { useEffect, useState } from "react";
import { freshnessUpdatedLine, type SyncFreshnessDisplay } from "./syncFreshness.ts";

type Props = {
  display: SyncFreshnessDisplay;
  busy?: boolean;
  onAction?: () => void;
  attentionLabel?: string | null;
  onOpenDetails: () => void;
  /** The space the person is in (My Money / Our Home). The bar always says who, where, how fresh, and whether anything needs attention. */
  space?: string | null;
};

const TICK_MS = 30_000;

function RefreshIcon() {
  return (
    <svg aria-hidden="true" className="sync-freshness__icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12a9 9 0 1 1-2.64-6.36"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SyncFreshnessStatus({ display, busy = false, onAction, attentionLabel, onOpenDetails, space = null }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!display.visible || !display.updatedAtIso) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => window.clearInterval(timer);
  }, [display.visible, display.updatedAtIso]);

  const updatedLine = display.updatedAtIso
    ? freshnessUpdatedLine(display.updatedAtIso, new Date())
    : null;

  if (!display.visible && !space) return null;

  const showAction = Boolean(display.actionLabel && display.actionKind && onAction);

  // Visible children alone speak for the live region — no parallel sr-only
  // summary, which would double-announce under aria-atomic.
  return (
    <div
      className={`sync-freshness sync-freshness--${display.tone} sync-freshness--${display.transportMode}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <button
        type="button"
        className="sync-freshness__details"
        aria-label={`${space ? `${space}. ` : ""}${display.visible ? display.statusSummary : "Status"}${attentionLabel ? `. ${attentionLabel}` : ""}. Open the Status Centre.`}
        onClick={onOpenDetails}
      >
        <span className="sync-freshness__content">
          {space && <span className="sync-freshness__space">{space}</span>}
          {display.visible ? (
          <span className="sync-freshness__transport">
            {display.transportPrimary}
          </span>
          ) : <span className="sync-freshness__transport">Status Centre</span>}
          {display.revisionLine && (
            <span className="sync-freshness__revision">{display.revisionLine}</span>
          )}
          {updatedLine && (
            <span className="sync-freshness__updated">{updatedLine}</span>
          )}
          {display.actorLine && (
            <span className="sync-freshness__actor" title={display.actorLine}>
              {display.actorLine}
            </span>
          )}
          {display.sourceLine && (
            <span className="sync-freshness__source muted">{display.sourceLine}</span>
          )}
        </span>
        {attentionLabel && <span className="sync-freshness__attention">{attentionLabel}</span>}
      </button>
      {showAction && (
        <button
          type="button"
          className={`sync-freshness__action${display.actionKind === "reconnect-auth" ? " sync-freshness__action--label" : ""}`}
          disabled={busy}
          aria-label={display.actionLabel ?? "Retry now"}
          onClick={() => onAction?.()}
        >
          {display.actionKind === "reconnect-auth" ? display.actionLabel : <RefreshIcon />}
        </button>
      )}
    </div>
  );
}
