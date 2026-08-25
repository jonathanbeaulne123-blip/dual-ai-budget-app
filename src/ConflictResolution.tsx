import { useMemo } from "react";
import { describeSharedConflictImpact, unresolvedConflicts } from "./core/conflict.ts";
import { formatCad } from "./core/money.ts";
import type { Household } from "./core/types.ts";
import { useDialog } from "./useDialog.ts";

export function ConflictResolution({
  household,
  onChoose,
  onExport,
  onDismiss,
  busy,
}: {
  household: Household;
  onChoose: (side: "local" | "remote") => void;
  onExport: () => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  const dialogRef = useDialog(true, onDismiss);
  const conflict = unresolvedConflicts(household)[0] ?? null;

  const impact = useMemo(() => {
    if (!conflict) return null;
    return describeSharedConflictImpact(conflict.localSnapshot, conflict.remoteSnapshot);
  }, [conflict]);

  if (!conflict || !impact) return null;

  return (
    <div
      ref={dialogRef}
      className="sheet guard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
      aria-describedby="conflict-summary"
    >
      <div className="sheet-inner">
        <div className="topbar">
          <h1 id="conflict-title" tabIndex={-1} data-autofocus>
            Two versions need review
          </h1>
          <button className="ghost" type="button" onClick={onDismiss} disabled={busy}>
            Dismiss
          </button>
        </div>
        <p id="conflict-summary">
          {impact.summary} Your Personal rows stay on this phone either way. Export keeps both full copies.
        </p>
        <div className="conflict-cards">
          <section aria-label="This phone">
            <h2>This phone</h2>
            <p className="muted">Revision {conflict.localRevision}</p>
            {impact.onlyOnPhoneCents > 0 && (
              <p>{formatCad(impact.onlyOnPhoneCents)} only on this phone</p>
            )}
          </section>
          <section aria-label="Cloud copy">
            <h2>Cloud copy</h2>
            <p className="muted">Revision {conflict.remoteRevision}</p>
            {impact.onlyOnCloudCents > 0 && (
              <p>{formatCad(impact.onlyOnCloudCents)} only in the cloud</p>
            )}
          </section>
        </div>
        <div className="conflict-actions">
          <button className="secondary" type="button" disabled={busy} onClick={() => onChoose("remote")}>
            Keep cloud copy
          </button>
          <button className="ghost" type="button" disabled={busy} onClick={() => onChoose("local")}>
            Keep this phone
          </button>
          <button className="ghost" type="button" disabled={busy} onClick={onExport}>
            Export both
          </button>
          <button className="ghost" type="button" disabled={busy} onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
