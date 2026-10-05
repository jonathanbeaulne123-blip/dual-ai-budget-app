/**
 * "Which one?" (L4): a canvas pick under the pointer that hit more than one mark (crowded slots, a tile and the pile)
 * fans out one labelled button per candidate, in date order. Choosing one opens it; Escape closes the fan and returns
 * focus to the stage. Picking never acts.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  // The fan opens above the tap; near the board's edge that ran it off the screen. Nudge it back inside (8 px).
  const box = useRef<HTMLDivElement | null>(null);
  const [nudge, setNudge] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const el = box.current, host = el?.offsetParent;
    if (!el || !host) return;
    const r = el.getBoundingClientRect(), h = host.getBoundingClientRect(), pad = 8;
    const dx = Math.max(0, h.left + pad - r.left) - Math.max(0, r.right - (h.right - pad));
    const dy = Math.max(0, h.top + pad - r.top) - Math.max(0, r.bottom - (h.bottom - pad));
    if (dx || dy) setNudge((n) => ({ x: n.x + dx, y: n.y + dy }));
  }, [at?.x, at?.y, options.length]);
  const style = at ? { left: `${Math.round(at.x)}px`, top: `${Math.round(at.y)}px`, marginLeft: `${Math.round(nudge.x)}px`, marginTop: `${Math.round(nudge.y)}px` } : undefined;
  return (
    <div ref={box} className="journey-fan" role="dialog" aria-modal={false} aria-label={COPY.whichOne} data-journey-fan="" style={style}>
      <p className="journey-fan__k">{COPY.whichOne}</p>
      {options.map((o, i) => (
        <button key={o.id} ref={i === 0 ? first : undefined} type="button" className="journey-toy journey-fan__option" data-fan-option={o.id} onClick={() => onChoose(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
