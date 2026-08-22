import type { KeyboardEvent, PointerEvent, ReactNode, Ref } from "react";

export function Instrument({
  id,
  name,
  glance,
  aria,
  expanded,
  minimized,
  onHeader,
  children,
  rotation,
  bump,
  inert,
  dragging,
  headerRef,
  body,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
  onHeaderPointerCancel,
  onHeaderKeyDown,
  extraClass,
}: {
  id: string;
  name: string;
  glance: ReactNode;
  aria: string;
  expanded: boolean;
  minimized: boolean;
  onHeader: () => void;
  children?: ReactNode;
  rotation: number;
  bump?: boolean;
  inert?: boolean;
  dragging?: boolean;
  headerRef?: Ref<HTMLButtonElement>;
  body?: ReactNode;
  onHeaderPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  onHeaderPointerMove?: (event: PointerEvent<HTMLButtonElement>) => void;
  onHeaderPointerUp?: (event: PointerEvent<HTMLButtonElement>) => void;
  onHeaderPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void;
  onHeaderKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  extraClass?: string;
}) {
  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    onHeaderKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onHeader();
    }
  }
  return (
    <section
      className={`instrument instrument-${id} ${expanded ? "is-expanded" : ""} ${minimized ? "is-minimized" : ""} ${bump ? "is-bumped" : ""} ${inert ? "is-inert" : ""} ${dragging ? "is-dragging" : ""} ${extraClass ?? ""}`}
      style={{ ["--rot" as string]: `${rotation}deg` }}
      aria-label={aria}
    >
      <button
        type="button"
        className="instrument-header"
        ref={headerRef}
        aria-expanded={expanded}
        aria-grabbed={dragging || undefined}
        onClick={() => { if (!dragging) onHeader(); }}
        onKeyDown={onKey}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerCancel}
      >
        <span className="instrument-name">{name}</span>
        <span className="instrument-glance">{glance}</span>
      </button>
      {!minimized && expanded && (body || children) ? (
        <div className="instrument-body">{body || children}</div>
      ) : null}
    </section>
  );
}
