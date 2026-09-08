import { duePreviewSummary, type DueRecurrencePreviewRow } from "./core/recurrencePreview.ts";
import { useDialog } from "./useDialog.ts";

function reviewLabel(row: DueRecurrencePreviewRow): string {
  if (row.type === "income") return "Review income";
  if (row.type === "transfer") return "Review transfer";
  return "Review payment";
}

export function DuePreviewSheet({
  rows,
  onDismiss,
  onReview,
  onReviewAll,
}: {
  rows: DueRecurrencePreviewRow[];
  onDismiss: () => void;
  onReview: (row: DueRecurrencePreviewRow) => void;
  onReviewAll: (rows: DueRecurrencePreviewRow[]) => void;
}) {
  const dialogRef = useDialog(true, onDismiss);
  const title = rows.length === 1 ? "One repeating item is due" : `${rows.length} repeating items are due`;

  return (
    <div
      ref={dialogRef}
      className="sheet guard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="due-preview-title"
      aria-describedby="due-preview-summary due-preview-safety"
    >
      <div className="sheet-inner">
        <div className="topbar">
          <h1 id="due-preview-title">{title}</h1>
          <button className="ghost" type="button" data-autofocus onClick={onDismiss}>
            Not now
          </button>
        </div>
        <p id="due-preview-summary">{duePreviewSummary(rows)}</p>
        <p id="due-preview-safety" className="muted">Nothing posts until you review it and press Confirm.</p>
        <div className="due-preview-list" aria-label="Due repeating items">
          {rows.map((row) => (
            <div className="due-preview-row" key={row.recurrenceId}>
              <div>
                <strong>{row.title}</strong>
                <div className="muted">{row.summary}</div>
              </div>
              <button className="ghost" type="button" onClick={() => onReview(row)}>
                {reviewLabel(row)}
              </button>
            </div>
          ))}
        </div>
        {rows.length > 1 && (
          <button className="primary" type="button" onClick={() => onReviewAll(rows)}>
            Review all due items
          </button>
        )}
      </div>
    </div>
  );
}
