import type { ReactNode } from "react";
import { useFurniture } from "./useFurniture.ts";
import { Instrument } from "./Instrument.tsx";
import type { FurnitureKind, InstrumentId, OfficeBreakpoint } from "../core/officeLayout.ts";
import type { KeyboardEvent, PointerEvent } from "react";

export function DeskItem({
  id,
  kind,
  perchable,
  warn,
  name,
  glance,
  aria,
  expanded,
  minimized,
  rotation,
  bump,
  inert,
  dragging,
  breakpoint,
  x,
  y,
  onToggle,
  children,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
  onHeaderPointerCancel,
  onHeaderKeyDown,
  pair,
  extraClass,
}: {
  id: InstrumentId;
  kind: FurnitureKind;
  perchable: boolean;
  warn: boolean;
  name: string;
  glance: ReactNode;
  aria: string;
  expanded: boolean;
  minimized: boolean;
  rotation: number;
  bump?: boolean;
  inert?: boolean;
  dragging?: boolean;
  breakpoint: OfficeBreakpoint;
  x?: number;
  y?: number;
  onToggle: () => void;
  children?: ReactNode;
  pair?: boolean;
  onHeaderPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  onHeaderPointerMove?: (event: PointerEvent<HTMLButtonElement>) => void;
  onHeaderPointerUp?: (event: PointerEvent<HTMLButtonElement>) => void;
  onHeaderPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void;
  onHeaderKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  extraClass?: string;
}) {
  const ref = useFurniture(id, kind, perchable, warn);
  const wide = breakpoint === "wide";
  return (
    <div
      ref={ref}
      className={`desk-item ${pair ? "pair-cell" : ""} ${extraClass ?? ""}`.trim()}
      style={wide ? { position: "absolute", left: x ?? 8, top: y ?? 8, width: "min(280px, 46%)" } : undefined}
    >
      <Instrument
        id={id}
        name={name}
        glance={glance}
        aria={aria}
        expanded={expanded}
        minimized={minimized}
        onHeader={onToggle}
        rotation={rotation}
        bump={bump}
        inert={inert}
        dragging={dragging}
        extraClass={extraClass}
        onHeaderPointerDown={onHeaderPointerDown}
        onHeaderPointerMove={onHeaderPointerMove}
        onHeaderPointerUp={onHeaderPointerUp}
        onHeaderPointerCancel={onHeaderPointerCancel}
        onHeaderKeyDown={onHeaderKeyDown}
      >
        {children}
      </Instrument>
    </div>
  );
}
