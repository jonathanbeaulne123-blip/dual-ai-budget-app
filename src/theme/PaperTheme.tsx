import type { ReactNode } from "react";

/** Shared paper tile — Books story / mobile Home story strip grammar. */
export function PaperTile({
  kind,
  name,
  value,
  warn,
  active,
  onClick,
  ariaLabel,
}: {
  kind?: string;
  name: string;
  value: ReactNode;
  warn?: boolean;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`hearth-paper-tile ${warn ? "is-warn" : ""} ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-label={ariaLabel ?? `${name}. ${typeof value === "string" ? value : ""}`}
      aria-pressed={onClick ? active : undefined}
    >
      {kind && <span className="hearth-tile-kind">{kind}</span>}
      <span className="hearth-tile-name">{name}</span>
      <span className="hearth-tile-value">{value}</span>
    </Tag>
  );
}

/** Wax paper seal — mobile Post / Due / Close controllers. */
export function WaxSeal({
  label,
  value,
  sub,
  pending,
  tone = "tan",
  onClick,
  ariaLabel,
}: {
  label: string;
  value: string;
  sub: string;
  pending?: boolean;
  tone?: "post" | "due" | "close" | "tan";
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className={`hearth-wax-seal tone-${tone} ${pending ? "is-pending" : "is-clear"}`}
      onClick={onClick}
      aria-label={ariaLabel ?? `${label}. ${value}. ${sub}.`}
    >
      <span className="hearth-seal-label">{label}</span>
      <span className="hearth-seal-value">{value}</span>
      <span className="hearth-seal-sub">{sub}</span>
    </button>
  );
}

/** 2×2 story strip grid. */
export function StoryStrip({ children }: { children: ReactNode }) {
  return (
    <section className="hearth-story-strip" aria-label="Today's stories">
      <h2 className="hearth-story-heading">Today&apos;s stories</h2>
      <div className="hearth-story-grid">{children}</div>
    </section>
  );
}

/** One-at-a-time expandable notebook body. */
export function NotebookBody({
  title,
  open,
  onClose,
  children,
  panelId,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelId: string;
}) {
  if (!open) return null;
  return (
    <section className="hearth-notebook" aria-label={title}>
      <header className="hearth-notebook-head">
        <h3>{title}</h3>
        <button type="button" className="hearth-notebook-close" onClick={onClose} aria-controls={panelId}>
          Close
        </button>
      </header>
      <div className="hearth-notebook-body" id={panelId}>
        {children}
      </div>
    </section>
  );
}

/** Mobile Books pane family seals. */
export function PaneSeals({
  items,
  active,
  onPick,
}: {
  items: { id: string; label: string }[];
  active: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="hearth-pane-seals" role="tablist" aria-label="Books panes">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={`hearth-pane-seal ${active === item.id ? "is-active" : ""}`}
          onClick={() => onPick(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
