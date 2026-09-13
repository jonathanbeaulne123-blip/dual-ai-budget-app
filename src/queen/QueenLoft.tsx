import { useState, type RefObject } from "react";
import { formatDayLabel } from "../core/calendar.ts";
import type { QueenShelfItem } from "../core/queenPresentation.ts";

/**
 * Build — the loft, running a shelf. Goals on a ledge by a window. Two rules
 * made physical: open-mouthed things accept (a goal has a decision inside it
 * and opens), lidded things refuse (a bill leans away — nothing to open,
 * because there was never a decision inside it). The lean is a pose, so the
 * rule reads with motion off. The stair down is the way back and never moves.
 */
export function QueenLoft({ shelf, open, stairRef, onExit, onOpenGoal, onOpenBanks }: {
  shelf: QueenShelfItem[];
  open: boolean;
  stairRef: RefObject<HTMLButtonElement | null>;
  onExit: () => void;
  onOpenGoal: (goalId: string) => void;
  onOpenBanks: () => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [refusedId, setRefusedId] = useState<string | null>(null);
  const picked = shelf.find((item) => item.id === pickedId) ?? null;
  const shown = shelf.slice(0, 6);

  const line = !picked
    ? <><em>Open-mouthed things accept.</em> Lidded things refuse.</>
    : picked.mouth === "open"
      ? <><em>Open-mouthed.</em> {picked.name}{picked.date ? `, hoped for ${formatDayLabel(picked.date)}` : ""}. {picked.marks === 0 ? "Nothing set inside yet; it would accept a part if you gave it one." : `${picked.marks} ${picked.marks === 1 ? "contribution" : "contributions"} inside, because you chose them.`}</>
      : <><em>Lidded.</em> {picked.name} leans away. Nothing to open, because there was never a decision inside it.</>;

  return (
    <section className="queen-room queen-room--loft" aria-label="The loft — Build" inert={!open}>
      <div className="queen-room__head">
        <p className="queen-room__title">The loft</p>
        <p className="queen-room__sub">{shown.length === 0 ? "Nothing on the ledge yet." : `${shown.length === 1 ? "One thing" : `${shown.length} things`} on the ledge`}</p>
      </div>
      <div className="queen-window" aria-hidden="true" />
      <div className="queen-ledge-wrap">
        <div className="queen-ledge" role="group" aria-label="The ledge">
          {shown.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`queen-goal queen-goal--${item.mouth}${refusedId === item.id ? " is-refusing" : ""}`}
              aria-pressed={pickedId === item.id}
              aria-label={`${item.name} — ${item.mouth === "open" ? "open-mouthed, accepts" : "lidded, nothing to open"}`}
              onClick={() => {
                setPickedId(item.id);
                if (item.mouth === "lidded") { setRefusedId(item.id); setTimeout(() => setRefusedId((current) => (current === item.id ? null : current)), 700); }
              }}
            >
              <svg viewBox="0 0 60 92" aria-hidden="true">
                <path className="queen-vessel" d="M5 88 C0 50 5 12 30 12 C55 12 60 50 55 88 Z" />
                {item.mouth === "open"
                  ? <ellipse className="queen-goal__mouth" cx="30" cy="12" rx="20" ry="5.5" />
                  : <rect className="queen-lid" x="10" y="6" width="40" height="8" rx="4" />}
                {Array.from({ length: Math.min(4, item.marks) }).map((_, index) => <circle key={index} className="queen-goal__mark" cx={18 + index * 8} cy="72" r="2.2" />)}
              </svg>
              <span className="queen-goal__name">{item.name}</span>
            </button>
          ))}
          {shown.length === 0 && <p className="queen-room__empty">The ledge is bare. A goal chosen in the banks would sit here.</p>}
        </div>
        <p className="queen-room__line" aria-live="polite">{line}</p>
        <div className="queen-room__acts">
          {picked?.mouth === "open" && picked.goalId && <button type="button" className="queen-go queen-go--primary" onClick={() => onOpenGoal(picked.goalId!)}>Open {picked.name} in the banks</button>}
          <button type="button" className="queen-go" onClick={onOpenBanks}>Open Build in the banks</button>
        </div>
      </div>
      <button ref={stairRef} type="button" className="queen-stair queen-stair--down" onClick={onExit} aria-label="Down to now — back to her">
        <span>Down to now</span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5" /><path d="M10 3v10" /></svg>
      </button>
    </section>
  );
}
