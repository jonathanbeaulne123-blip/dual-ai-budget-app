import { useCallback, useState, type ReactNode } from "react";

/**
 * One fold of the Status Centre (Vision v2 §4.7; feedback row 5). The centre
 * used to be twenty-odd cards in one flat scroll. Each group is now a
 * <details> whose open state is remembered per device, so the page opens to
 * what needs you and the rest waits behind its heading. Nothing here changes
 * what the cards do; a closed fold still holds the same controls.
 */
export function statusFoldKey(id: string): string {
  return `hearth:status-fold:v1:${id}`;
}

function readOpen(id: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(statusFoldKey(id));
    return value === null ? fallback : value === "open";
  } catch { return fallback; }
}

export function StatusFold({ id, title, defaultOpen = false, forceOpen = false, count, children }: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  /** Something inside needs attention right now: the fold opens regardless of the remembered state. */
  forceOpen?: boolean;
  /** A small number beside the heading — how many things wait inside. */
  count?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  const onToggle = useCallback((event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const next = event.currentTarget.open;
    setOpen(next);
    try { localStorage.setItem(statusFoldKey(id), next ? "open" : "closed"); } catch { /* Forgetting is fine. */ }
  }, [id]);
  return (
    <details className="status-fold" id={`status-${id}`} open={open || forceOpen} onToggle={onToggle} data-status-fold={id}>
      <summary className="status-fold__summary">
        <h2 className="status-group">{title}</h2>
        {typeof count === "number" && count > 0 ? <span className="status-fold__count" aria-label={`${count} inside`}>{count}</span> : null}
      </summary>
      <div className="status-fold__body">{children}</div>
    </details>
  );
}
