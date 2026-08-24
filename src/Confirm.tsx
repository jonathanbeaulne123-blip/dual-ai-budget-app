export function ConfirmSheet({
  title,
  body,
  extra,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  extra?: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const describedBy = extra ? "guard-body guard-extra" : "guard-body";

  return (
    <div
      className="sheet guard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guard-title"
      aria-describedby={describedBy}
    >
      <div className="sheet-inner">
        <div className="topbar">
          <h1 id="guard-title">{title}</h1>
          <button className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
        <p id="guard-body">{body}</p>
        {extra && <p id="guard-extra" className="muted">{extra}</p>}
        <button
          className={danger ? "danger" : "primary"}
          style={{ width: "100%", marginTop: 12 }}
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
