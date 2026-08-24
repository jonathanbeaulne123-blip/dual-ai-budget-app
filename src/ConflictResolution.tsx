import { useMemo } from "react";
import { countDifferingSharedTransactionIds, unresolvedConflicts } from "./core/conflict.ts";
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

  const sharedDiffCount = useMemo(() => {
    if (!conflict) return 0;
    return countDifferingSharedTransactionIds(conflict.localSnapshot, conflict.remoteSnapshot);
  }, [conflict]);

  if (!conflict) return null;

  const diffLabel =
    sharedDiffCount === 0
      ? "No shared transactions differ."
      : `${sharedDiffCount} shared transaction${sharedDiffCount === 1 ? "" : "s"} differ.`;

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
          <h1 id="conflict-title">Two snapshots</h1>
          <button className="ghost" type="button" onClick={onDismiss} disabled={busy}>
            Dismiss
          </button>
        </div>
        <p id="conflict-summary">
          {diffLabel} Personal rows stay member-scoped; export includes the full bundle.
        </p>
        <div className="conflict-cards">
          <section aria-label="This phone">
            <h2>This phone</h2>
            <p className="muted">Revision {conflict.localRevision}</p>
          </section>
          <section aria-label="Cloud copy">
            <h2>Cloud copy</h2>
            <p className="muted">Revision {conflict.remoteRevision}</p>
          </section>
        </div>
        <div className="conflict-actions">
          <button
            className="primary"
            type="button"
            data-autofocus
            disabled={busy}
            onClick={() => onChoose("local")}
          >
            Keep this phone
          </button>
          <button className="secondary" type="button" disabled={busy} onClick={() => onChoose("remote")}>
            Keep cloud copy
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
