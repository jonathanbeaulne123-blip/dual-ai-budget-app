import type { ReactNode } from "react";

export function ConfirmSheet({
  title,
  body,
  extra,
  confirmLabel,
  danger,
  busy,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  extra?: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  children?: ReactNode;
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
        {extra && <p className="muted">{extra}</p>}
        {children}
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
