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
  size,
  chips,
  shell,
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
  size?: string;
  chips?: ReactNode;
  shell?: "square" | "circle" | "list" | "card";
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
      data-size={size}
      data-shell={expanded ? (shell ?? "card") : undefined}
      style={{ ["--tilt" as string]: `${rotation}deg` }}
    >
      {chips}
      <button
        type="button"
        className="instrument-header"
        ref={headerRef}
        aria-expanded={expanded}
        aria-label={aria}
        onClick={onHeader}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerCancel}
        onKeyDown={onKey}
      >
        <span className="instrument-name">{name}</span>
        <span className="instrument-glance">{glance}</span>
      </button>
      {expanded && <div className="instrument-body">{body ?? children}</div>}
    </section>
  );
}
