import type { ReactNode } from "react";
import { formatCad } from "../core/money.ts";
import { paperBarPercents, type PaperBarRow, type PaperSparkPoint } from "../core/officeWide.ts";

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
export function StoryStrip({
  children,
  heading = "Today's stories",
  className,
}: {
  children: ReactNode;
  heading?: string;
  className?: string;
}) {
  return (
    <section className={`hearth-story-strip ${className ?? ""}`.trim()} aria-label={heading}>
      <h2 className="hearth-story-heading">{heading}</h2>
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
  bare = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelId: string;
  bare?: boolean;
}) {
  if (!open) return null;
  return (
    <section className={`hearth-notebook ${bare ? "is-bare" : ""}`} aria-label={title}>
      {bare ? (
        <button type="button" className="hearth-notebook-whisper" onClick={onClose} aria-label="Close" aria-controls={panelId}>
          ×
        </button>
      ) : (
        <header className="hearth-notebook-head">
          <h3>{title}</h3>
          <button type="button" className="hearth-notebook-close" onClick={onClose} aria-controls={panelId}>
            Close
          </button>
        </header>
      )}
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

/** Horizontal paper bars from journal-true cents. Never invents CAD. */
export function PaperBars({
  rows,
  empty = "Nothing posted this month yet.",
  caption,
}: {
  rows: PaperBarRow[];
  empty?: string;
  caption?: string;
}) {
  if (rows.length === 0) return <p className="muted hearth-paper-empty">{empty}</p>;
  const filled = paperBarPercents(rows);
  return (
    <div className="hearth-paper-bars" role="img" aria-label={caption ?? rows.map((row) => `${row.label} ${formatCad(row.cents)}`).join(". ")}>
      {caption ? <p className="hearth-paper-caption">{caption}</p> : null}
      {filled.map(({ row, pct }) => (
        <div key={row.label} className="hearth-paper-bar-row">
          <span className="hearth-paper-bar-label">{row.label}</span>
          <span className="hearth-paper-bar-track">
            <i className={`tone-${row.tone}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="hearth-paper-bar-value">{formatCad(row.cents)}</span>
        </div>
      ))}
    </div>
  );
}

/** Weekday spark from posted tip cents. Copper-badge as a projection. */
export function PaperSpark({
  points,
  empty = "No posted tips in the last four weeks.",
  projection = true,
}: {
  points: PaperSparkPoint[];
  empty?: string;
  projection?: boolean;
}) {
  if (points.length === 0) return <p className="muted hearth-paper-empty">{empty}</p>;
  const max = Math.max(1, ...points.map((point) => point.cents));
  return (
    <div className="hearth-paper-spark" role="img" aria-label={points.map((point) => `${point.label} ${formatCad(point.cents)}`).join(". ")}>
      {projection ? <span className="pill proj">Projection</span> : null}
      <div className="hearth-paper-spark-row">
        {points.map((point) => (
          <div key={point.label} className="hearth-paper-spark-col">
            <span
              className="hearth-paper-spark-stem"
              style={{ height: `${Math.max(8, Math.round((point.cents / max) * 48))}px` }}
            />
            <span className="hearth-paper-spark-label">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
