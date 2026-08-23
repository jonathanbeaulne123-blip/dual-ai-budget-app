import { formatCad, formatDateLabel } from "./core/index.ts";
import type { DueRecurrencePreviewRow } from "./core/recurrencePreview.ts";

export function DuePreviewSheet({
  rows,
  today,
  busy,
  onDismiss,
  onMarkPaid,
  onPostAll,
}: {
  rows: DueRecurrencePreviewRow[];
  today: string;
  busy?: boolean;
  onDismiss: () => void;
  onMarkPaid: (recurrenceId: string, summary: string) => void;
  onPostAll: (summary: string) => void;
}) {
  const count = rows.length;
  return (
    <div className="sheet guard" role="dialog" aria-modal="true" aria-labelledby="due-preview-title">
      <div className="sheet-inner">
        <div className="topbar">
          <h1 id="due-preview-title">{count === 1 ? "One bill is due" : `${count} bills are due`}</h1>
          <button className="ghost" type="button" onClick={onDismiss} disabled={busy}>Not now</button>
        </div>
        <p className="muted">Kettle whistle. These match real repeating rows. Nothing posts until you confirm.</p>
        {rows.map((row) => (
          <div className="row" key={row.recurrenceId}>
            <span>
              {formatDateLabel(row.nextDate)}
              {row.nextDate < today ? " · lifted" : ""}
              {" · "}
              {row.title}
            </span>
            <span>{formatCad(row.amountCents)}</span>
          </div>
        ))}
        <div className="chips" style={{ marginTop: 12 }}>
          {rows.map((row) => (
            <button
              key={`pay-${row.recurrenceId}`}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => onMarkPaid(row.recurrenceId, row.summary)}
            >
              Mark paid · {row.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="primary"
          style={{ width: "100%", marginTop: 12 }}
          disabled={busy}
          onClick={() => onPostAll(`This posts ${count} due repeating ${count === 1 ? "item" : "items"} into the books.`)}
        >
          Post {count === 1 ? "this bill" : "all due items"}
        </button>
      </div>
    </div>
  );
}
