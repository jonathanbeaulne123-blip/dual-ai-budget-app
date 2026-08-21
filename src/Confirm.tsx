export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sheet guard" role="dialog" aria-modal="true" aria-labelledby="guard-title">
      <div className="sheet-inner">
        <div className="topbar">
          <h1 id="guard-title">{title}</h1>
          <button className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
        <p>{body}</p>
        <button
          className={danger ? "danger" : "primary"}
          style={{ width: "100%", marginTop: 12 }}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
