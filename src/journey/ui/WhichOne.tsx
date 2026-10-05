/**
 * "Which one?" (L4): a canvas pick under the pointer that hit more than one mark (crowded slots, a tile and the pile)
 * fans out one labelled button per candidate, in date order. Choosing one opens it; Escape closes the fan and returns
 * focus to the stage. Picking never acts.
 */
import { useEffect, useRef } from "react";
import { COPY } from "./copy.ts";

export type WhichOneOption = { id: string; label: string };

export function WhichOne({ options, at, onChoose, onClose }: { options: WhichOneOption[]; at: { x: number; y: number } | null; onChoose(id: string): void; onClose(): void }) {
  const first = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const style = at ? { left: `${Math.round(at.x)}px`, top: `${Math.round(at.y)}px` } : undefined;
  return (
    <div className="journey-fan" role="dialog" aria-modal={false} aria-label={COPY.whichOne} data-journey-fan="" style={style}>
      <p className="journey-fan__k">{COPY.whichOne}</p>
      {options.map((o, i) => (
        <button key={o.id} ref={i === 0 ? first : undefined} type="button" className="journey-toy journey-fan__option" data-fan-option={o.id} onClick={() => onChoose(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
