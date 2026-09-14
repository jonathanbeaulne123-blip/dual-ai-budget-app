import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { formatDayLabel } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { queenShelfReorder, type QueenShelfItem } from "../core/queenPresentation.ts";
import { QueenRoomWorld } from "./QueenRoomWorld.tsx";
import type { RoomVessel } from "./world/queenRoomWorld.ts";

/**
 * Build — the loft, running a shelf. Banks on a ledge under the roof.
 *
 * Two rules made physical, and they are opposites: **open-mouthed things
 * accept** — a goal has a decision inside it, so it opens — and **lidded things
 * refuse** — a bill leans away, because there was never a decision inside it.
 * The lean is a pose, so the rule reads with motion off.
 *
 * **Arrangement is the data.** Left is first: first fed when money comes in.
 * Dragging a bank, or Shift with an arrow key, writes one rank on that bank's
 * own design row — one save, and the last save wins, which is how every shared
 * change in Hearth already works. The shelf itself carries no figures; they
 * appear only once a bank is in hand.
 *
 * The stair down is the way back and it never moves.
 */
export function QueenLoft({ shelf, open, busy, stairRef, onExit, onOpenGoal, onOpenBanks, onReorder, world = "auto" }: {
  shelf: QueenShelfItem[];
  open: boolean;
  busy?: boolean;
  stairRef: RefObject<HTMLButtonElement | null>;
  onExit: () => void;
  onOpenGoal: (goalId: string) => void;
  onOpenBanks: () => void;
  /** Writes the shelf's whole order, as design keys. Absent leaves the ledge read-only. */
  onReorder?: (order: string[]) => void;
  world?: "auto" | "flat" | "3d";
}) {
  const [heldId, setHeldId] = useState<string | null>(null);
  const [refusedId, setRefusedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const room = useRef<HTMLDivElement>(null);
  const ledge = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const held = shelf.find((item) => item.id === heldId) ?? null;
  const shown = shelf.slice(0, 12);
  const canMove = Boolean(onReorder) && !busy;

  const vessels = useMemo<RoomVessel[]>(() => shown.map((item) => ({
    id: item.id,
    kind: item.mouth === "open" ? "goal" : "bill",
    fill: item.fullness,
    parts: item.parts,
    size: item.size,
    lifted: item.id === heldId || item.id === dragId,
    refusing: item.id === refusedId,
  })), [shown, heldId, dragId, refusedId]);

  const refuse = (id: string) => {
    setRefusedId(id);
    setTimeout(() => setRefusedId((current) => (current === id ? null : current)), 700);
  };
  const moveTo = (item: QueenShelfItem, index: number) => {
    if (!onReorder || index < 0) return;
    const now = shown.findIndex((row) => row.id === item.id);
    if (index === now || index === now + 1) return;
    onReorder(queenShelfReorder(shelf, item.id, index));
  };

  const onPointerDown = (item: QueenShelfItem) => (event: PointerEvent<HTMLButtonElement>) => {
    if (!canMove || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag.current = { id: item.id, x: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const held = drag.current;
    if (!held || !ledge.current) return;
    if (!held.moved && Math.abs(event.clientX - held.x) < 8) return;
    if (!held.moved) { held.moved = true; setDragId(held.id); }
    const seats = [...ledge.current.querySelectorAll<HTMLElement>("[data-room-vessel]")];
    let index = seats.length;
    for (const [i, seat] of seats.entries()) {
      const rect = seat.getBoundingClientRect();
      if (event.clientX < rect.left + rect.width / 2) { index = i; break; }
    }
    setDropAt(index);
  };
  // Pointer events carry the drag only. Picking up is a click, so Enter, Space and
  // any assistive click pick a bank up exactly as a tap does.
  const onPointerUp = (item: QueenShelfItem) => () => {
    const held = drag.current;
    drag.current = null;
    setDragId(null);
    const index = dropAt;
    setDropAt(null);
    if (!held?.moved) return;
    justDragged.current = true;
    if (index !== null) moveTo(item, index);
  };
  const onPick = (item: QueenShelfItem) => () => {
    if (justDragged.current) { justDragged.current = false; return; }
    setHeldId((current) => (current === item.id ? null : item.id));
    if (item.mouth === "lidded") refuse(item.id);
  };
  const onKeyDown = (item: QueenShelfItem, index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const seats = ledge.current?.querySelectorAll<HTMLElement>("[data-room-vessel]");
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      if (event.shiftKey) { if (canMove) moveTo(item, step < 0 ? index - 1 : index + 2); return; }
      seats?.[index + step]?.focus();
      return;
    }
    if (event.key === "Escape") { event.preventDefault(); setHeldId(null); }
  };

  const line = !held
    ? <><em>Open-mouthed things accept.</em> Lidded things refuse. Left is first to be fed.</>
    : held.mouth === "open"
      ? <><em>Open-mouthed.</em> {held.name}{held.date ? `, hoped for ${formatDayLabel(held.date)}` : ""}. {held.marks === 0 ? "Nothing set inside yet; it would accept a part if you gave it one." : `${held.marks} ${held.marks === 1 ? "contribution" : "contributions"} inside, because you chose them.`}</>
      : <><em>Lidded.</em> {held.name} leans away. Nothing to open, because there was never a decision inside it.</>;

  return (
    <section ref={room} className="queen-room queen-room--loft" aria-label="The loft — Build" inert={!open} data-world={live ? "3d" : "flat"}>
      <QueenRoomWorld room="loft" root={room} vessels={vessels} ambient={open} mode={world} onLive={(isLive) => setLive(isLive)} />
      <div className="queen-room__head">
        <p className="queen-room__title">The loft</p>
        <p className="queen-room__sub">{shown.length === 0 ? "Nothing on the ledge yet." : `${shown.length === 1 ? "One thing" : `${shown.length} things`} on the ledge · left is fed first`}</p>
      </div>
      <div className="queen-ledge-wrap">
        <div ref={ledge} className="queen-ledge" role="group" aria-label="The ledge — left is fed first">
          {shown.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-room-vessel={item.id}
              className={`queen-goal queen-goal--${item.mouth} queen-goal--${item.size}${refusedId === item.id ? " is-refusing" : ""}${dragId === item.id ? " is-dragging" : ""}${dropAt === index ? " is-drop" : ""}`}
              aria-pressed={heldId === item.id}
              aria-label={`${item.name} — ${item.mouth === "open" ? "open-mouthed, accepts" : "lidded, nothing to open"}, ${index + 1} of ${shown.length} on the ledge${canMove ? ". Shift with an arrow key to move it" : ""}`}
              onPointerDown={onPointerDown(item)} onPointerMove={onPointerMove} onPointerUp={onPointerUp(item)} onPointerCancel={onPointerUp(item)}
              onKeyDown={onKeyDown(item, index)}
              onClick={onPick(item)}
            >
              <svg viewBox="0 0 60 92" aria-hidden="true">
                <path className="queen-vessel" d="M5 88 C0 50 5 12 30 12 C55 12 60 50 55 88 Z" />
                {item.fullness > 0.02 && <path className="queen-goal__glaze" d={`M5 88 C2 ${88 - 38 * item.fullness} 4 ${88 - 76 * item.fullness} 30 ${88 - 76 * item.fullness} C56 ${88 - 76 * item.fullness} 58 ${88 - 38 * item.fullness} 55 88 Z`} />}
                {item.mouth === "open"
                  ? <ellipse className="queen-goal__mouth" cx="30" cy="12" rx="20" ry="5.5" />
                  : <rect className="queen-lid" x="10" y="6" width="40" height="8" rx="4" />}
                {Array.from({ length: Math.min(3, item.parts) }).map((_, i) => <rect key={i} className="queen-goal__neck" x={26 + (i - Math.min(3, item.parts) / 2) * 9} y="2" width="6" height="12" rx="3" />)}
              </svg>
              <span className="queen-goal__name">{item.name}</span>
            </button>
          ))}
          {shown.length === 0 && <p className="queen-room__empty">The ledge is bare. A goal chosen in the banks would sit here.</p>}
        </div>
        {held && (
          <div className="queen-hand" aria-live="polite">
            <p className="queen-eyebrow">In hand</p>
            <p className="queen-hand__name">{held.name}</p>
            <ul className="queen-hand__facts">
              <li>{formatCad(held.bank.amountCents)} of {formatCad(held.bank.targetCents)}</li>
              {held.date && <li>{formatDayLabel(held.date)}</li>}
              <li>{held.parts ? `${held.parts} ${held.parts === 1 ? "part" : "parts"} inside` : "no parts inside"}</li>
              <li>{shown.findIndex((row) => row.id === held.id) + 1} of {shown.length} on the ledge</li>
            </ul>
          </div>
        )}
        <p className="queen-room__line" aria-live="polite">{line}</p>
        <div className="queen-room__acts">
          {held?.mouth === "open" && held.goalId && <button type="button" className="queen-go queen-go--primary" onClick={() => onOpenGoal(held.goalId!)}>Open {held.name} in the banks</button>}
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
