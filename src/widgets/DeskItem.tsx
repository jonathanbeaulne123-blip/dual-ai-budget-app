import type { ReactNode } from "react";
import { useFurniture } from "./useFurniture.ts";
import { Instrument } from "./Instrument.tsx";
import type { ExpandShell, FurnitureKind, InstrumentId, InstrumentSize, OfficeBreakpoint } from "../core/officeLayout.ts";
import { EXPAND_SIZE, expandShellFor, SIZE_WIDTH, sizeOf } from "../core/officeLayout.ts";
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
  size,
  chips,
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
  size?: InstrumentSize;
  chips?: ReactNode;
}) {
  const ref = useFurniture(id, kind, perchable, warn, { live: Boolean(dragging) });
  const resolved = sizeOf({ id, size });
  const shell: ExpandShell = expandShellFor(id);
  const placed = breakpoint === "computer";
  const width = expanded && placed
    ? EXPAND_SIZE[shell].w
    : (placed
      ? ({ s: 140, m: 196, l: 268 } as const)[resolved]
      : SIZE_WIDTH[resolved]);
  return (
    <div
      ref={ref}
      className={`desk-item ${pair ? "pair-cell" : ""} ${placed ? "desk-object" : ""} ${extraClass ?? ""}`.trim()}
      style={placed ? { position: "absolute", left: x ?? 8, top: y ?? 8, width } : undefined}
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
        size={resolved}
        chips={chips}
        shell={shell}
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
