export function ConfirmSheet({
  title,
  body,
  extra,
  confirmLabel,
  danger,
  busy,
  option,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  extra?: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  option?: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const describedBy = [
    "guard-body",
    extra ? "guard-extra" : null,
    option ? "guard-option" : null,
  ].filter(Boolean).join(" ");

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
        {option && (
          <label id="guard-option" className="confirm-option">
            <input
              type="checkbox"
              checked={option.checked}
              disabled={busy}
              onChange={(event) => option.onChange(event.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        )}
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
