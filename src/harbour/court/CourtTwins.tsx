import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ProjectedRect } from "../scene/runtime.ts";
import { QUEEN_REGION_ORDER } from "./queenTouch.ts";

/**
 * DOM twins (BUILD_PLAN #28, §7 a11y): one `<button>` per touchable thing in
 * the Court, laid over the canvas at the rect the runtime projected (≥ 44 px,
 * clamped inside the stage), each labelled in words with its number. The
 * Queen's regions are one group with a roving tabindex (crown → vines → hands
 * → face → roots → pot rim, arrows move); then the Everyday flagstone, the
 * Rook, the Bishop, the Knight, the sundial, the mailbox, the slip, Hercules
 * and the gate. The canvas itself is `aria-hidden`.
 */
export const TWIN_ORDER: readonly string[] = [...QUEEN_REGION_ORDER, "queen", "flagstone", "rook", "bishop", "knight", "sundial", "mailbox", "slip", "hercules", "gate"];

export type CourtTwinsProps = {
  rects: readonly ProjectedRect[];
  /** While a tool is open the twins step aside; the door strip is the one control. */
  hidden?: boolean;
  onActivate: (rect: ProjectedRect) => void;
  /** Arrow keys on a Queen twin: the same grammar as a stroke (ArrowUp on the vines = forward a week). */
  onQueenKey?: (region: string, key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => void;
};

const orderOf = (id: string) => { const index = TWIN_ORDER.indexOf(id); return index < 0 ? TWIN_ORDER.length : index; };

/** Pure: the tab order the twins take. Queen regions first, then the court, then anything a place adds. */
export function orderTwins<T extends { id: string; visible: boolean }>(rects: readonly T[]): T[] {
  return [...rects].filter(r => r.visible).sort((a, b) => orderOf(a.id) - orderOf(b.id) || a.id.localeCompare(b.id));
}

export function CourtTwins({ rects, hidden = false, onActivate, onQueenKey }: CourtTwinsProps) {
  const ordered = orderTwins(rects);
  const queen = ordered.filter(r => r.group === "queen" && r.id !== "queen");
  const [roving, setRoving] = useState<string>(queen[0]?.id ?? "");
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => { if (queen.length && !queen.some(r => r.id === roving)) setRoving(queen[0]!.id); }, [queen, roving]);

  function onKeyDown(rect: ProjectedRect, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (rect.group !== "queen" || rect.id === "queen") return;
    const key = event.key;
    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      if (event.shiftKey || !onQueenKey) {
        // Shift+arrow (or no grammar) roves between her regions.
        const index = queen.findIndex(r => r.id === rect.id);
        const next = queen[(index + (key === "ArrowDown" || key === "ArrowRight" ? 1 : queen.length - 1)) % queen.length];
        if (next) { setRoving(next.id); buttons.current.get(next.id)?.focus(); }
        return;
      }
      onQueenKey(rect.id, key);
    }
    if (key === "Home" || key === "End") {
      event.preventDefault();
      const next = key === "Home" ? queen[0] : queen[queen.length - 1];
      if (next) { setRoving(next.id); buttons.current.get(next.id)?.focus(); }
    }
  }

  return <div className="court-twins" data-court-twins={ordered.length} hidden={hidden || undefined} role="group" aria-label="The Court">
    {ordered.map(rect => {
      const isQueenRegion = rect.group === "queen" && rect.id !== "queen";
      return <button
        key={rect.id}
        type="button"
        ref={element => { if (element) buttons.current.set(rect.id, element); else buttons.current.delete(rect.id); }}
        className={`court-twins__twin court-twins__twin--${rect.kind}`}
        data-twin={rect.id}
        data-twin-group={rect.group}
        tabIndex={isQueenRegion ? (rect.id === roving ? 0 : -1) : 0}
        aria-label={rect.label}
        style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }}
        onFocus={() => { if (isQueenRegion) setRoving(rect.id); }}
        onKeyDown={event => onKeyDown(rect, event)}
        onClick={() => onActivate(rect)}
      />;
    })}
  </div>;
}
