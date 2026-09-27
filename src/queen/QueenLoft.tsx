import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { formatDayLabel } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import type { QueenShelfItem } from "../core/queenPresentation.ts";
import { RACK_LIMITS, pourWords, rackHangShelf, rackMoveKey, rackPour, rackSetCutoff, rackSetShare, rackSetSplit, rackSlideDivider, rackTakeDown, shelfShareWords, type QueenRackV1, type RackBank } from "../core/queenRack.ts";
import { useOutsideClose } from "../useOutsideClose.ts";
import { LOFT_ZOOM, clampLoftZoom, readLoftZoom, stepLoftZoom, storeLoftZoom } from "./loftZoom.ts";
import { ConfirmSheet } from "../Confirm.tsx";
import { KittyFlat } from "../kitty/studio/flat.tsx";
import { queenBankFired, queenBankPiece } from "./world/queenAuthoring.ts";
import { QueenRoomWorld } from "./QueenRoomWorld.tsx";
import type { RoomVessel } from "./world/queenRoomWorld.ts";

/**
 * Build — the loft, running a rack of shelves under the roof (2026-09-15).
 *
 * Two rules made physical, and they are opposites: **open-mouthed things
 * accept** — a goal has a decision inside it, so it opens — and **lidded things
 * refuse** — a bill leans away, because there was never a decision inside it.
 * The lean is a pose, so the rule reads with motion off.
 *
 * **Arrangement is the data, and so is the wall.** Jonathan: "the different
 * shelves should act as weights … a cutoff point for funding on each shelf …
 * how much is being split up, horizontally or vertically … through physical
 * touch." So: shelves hang on the wall, top first. The **brass weight** at a
 * shelf's right end slides along it — further right, a bigger share of any
 * pour. The **pin** on the post at its left slides up and down — the fill
 * mark: once every bank on the shelf stands at that mark, the shelf is full
 * and its share flows down. The **dividers** between banks on one shelf slide
 * to change how that shelf's take is split. Banks drag along a shelf, or up
 * and down onto another; a peg below the lowest shelf hangs a new one, and an
 * empty shelf can be taken down. Every one of these is a slider or a button
 * for the keyboard too. Changes are held on this device while the hand is on
 * the rack and sent as one save on Done or on leaving (useHeldSave); the last
 * save wins, as every shared change in Hearth does. The rack carries no money.
 *
 * **The pour** is the one money act, and it is the Fund's existing month-end
 * rollover: the custodian tilts the jug — a band of the safe surplus — reads
 * the split in words, and confirms; nothing posts before Confirm. Anyone else
 * sees who holds the jug.
 *
 * The stair down is the way back and it never moves.
 */
export type LoftPour = {
  /** The Fund's safe surplus today, in cents. Zero when there is none. */
  safeCents: number;
  /** Whether the person holds the jug: only the Fund's custodian may pour. */
  custodian: boolean;
  custodianName: string;
  /** Posts the pour through the Fund's rollover command. Resolves when the books have it. */
  onPour: (allocations: Array<{ goalId: string; amountCents: number }>, pouredCents: number, note?: string) => Promise<unknown>;
};

const MARK_WORDS = (cutoff: number) => cutoff >= RACK_LIMITS.marks ? "to the crown" : cutoff === 0 ? "at the foot — takes nothing" : cutoff === RACK_LIMITS.marks / 2 ? "halfway" : `${cutoff} of ${RACK_LIMITS.marks}`;
const ordinal = (n: number, of: number) => (of === 1 ? "the shelf" : n === 0 ? "the top shelf" : n === of - 1 ? "the bottom shelf" : `shelf ${n + 1}`);

export function QueenLoft({ shelf, rack, open, busy, stairRef, onExit, onOpenGoal, onOpenBanks, onRack, dirty = false, onDone, pour, world = "auto" }: {
  shelf: QueenShelfItem[];
  /** The rack, settled to the banks the loft has (rackSettled). */
  rack: QueenRackV1;
  open: boolean;
  busy?: boolean;
  stairRef: RefObject<HTMLButtonElement | null>;
  onExit: () => void;
  onOpenGoal: (goalId: string) => void;
  onOpenBanks: () => void;
  /** Writes the whole rack once. Absent leaves the wall read-only. */
  onRack?: (next: QueenRackV1) => void;
  /** The rack has changes held on this device, not yet sent. */
  dirty?: boolean;
  /** Sends the held rack now. Leaving the loft does the same. */
  onDone?: () => void;
  /** The jug. Absent, the loft has no pour (no Fund, or no books). */
  pour?: LoftPour;
  world?: "auto" | "flat" | "3d";
}) {
  const [heldId, setHeldId] = useState<string | null>(null);
  const [refusedId, setRefusedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ shelf: number; index: number } | null>(null);
  const [live, setLive] = useState(false);
  const [tilt, setTilt] = useState(0); // tenths of the safe surplus
  const [pouring, setPouring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // K15 (Tool Atlas §7): the money gun merged into the jug — one control, "Move $X to Kitty Banks", custodian only,
  // capped at the Fund's safe surplus, one Confirm (allocateHouseholdFundSurplus through pour.onPour).
  // ---- the size of the banks: pinch, ctrl-scroll, the pane, the +/− keys; remembered on this device ----
  const [zoom, setZoom] = useState(() => readLoftZoom(typeof localStorage === "undefined" ? null : localStorage));
  const onZoom = (next: number) => { const z = clampLoftZoom(next); setZoom(z); storeLoftZoom(z, typeof localStorage === "undefined" ? null : localStorage); };
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ span: number; zoom: number } | null>(null);
  const fingerSpan = () => { const [a, b] = [...fingers.current.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const onRackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.current.size === 2) {
      // Two fingers are a pinch, never a drag: let go of whatever the first finger picked up.
      drag.current = null; slide.current = null; dropAt.current = null; setDragId(null); setDrop(null);
      pinch.current = { span: fingerSpan(), zoom };
    }
  };
  const onRackPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!fingers.current.has(event.pointerId)) return;
    fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const p = pinch.current;
    if (p && fingers.current.size === 2) { const now = fingerSpan(); if (p.span > 0 && now > 0) onZoom(p.zoom * (now / p.span)); event.stopPropagation(); }
  };
  const onRackPointerEnd = (event: PointerEvent<HTMLDivElement>) => { fingers.current.delete(event.pointerId); if (fingers.current.size < 2) pinch.current = null; };
  useEffect(() => {
    // Ctrl-scroll (and a trackpad pinch) sizes the banks; a plain scroll still scrolls the rack. Not passive, so the page does not zoom instead.
    const el = wall.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => { if (!event.ctrlKey) return; event.preventDefault(); setZoom((z) => { const next = clampLoftZoom(z * (event.deltaY < 0 ? 1.08 : 1 / 1.08)); storeLoftZoom(next, typeof localStorage === "undefined" ? null : localStorage); return next; }); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const room = useRef<HTMLDivElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const slide = useRef<{ kind: "weight" | "pin" | "divider"; shelf: string; index: number; x: number; y: number; from: number; pointerId: number } | null>(null);
  const justDragged = useRef(false);
  /** The shelf tool whose card is open: the weight, the pin or a divider (2026-09-15). */
  const [tool, setTool] = useState<{ kind: "weight" | "pin" | "divider"; shelf: string; index: number } | null>(null);
  const toolCard = useRef<HTMLElement>(null);
  const handCard = useRef<HTMLDivElement>(null);
  const slidMoved = useRef(false);
  const suppressToolClick = useRef(false);
  /** Where the hand is right now. The pointer-up can land before React has drawn the last move, so the drop is read from here, never from state. */
  const dropAt = useRef<{ shelf: number; index: number } | null>(null);

  const byKey = useMemo(() => new Map(shelf.map((item) => [item.designKey, item])), [shelf]);
  const rows = useMemo(() => rack.shelves.map((row) => ({ ...row, items: row.keys.map((key) => byKey.get(key)).filter((item): item is QueenShelfItem => Boolean(item)) })), [rack, byKey]);
  const shown = useMemo(() => rows.flatMap((row) => row.items), [rows]);
  const held = shown.find((item) => item.id === heldId) ?? null;
  const canMove = Boolean(onRack) && !busy;
  useEffect(() => { if (!open) { setTilt(0); setNotice(null); setTool(null); } }, [open]);
  // Clicking off a card puts it away; the tools and banks that open cards toggle them themselves.
  useOutsideClose([toolCard], tool !== null, () => setTool(null), { keep: ".queen-shelf__pin, .queen-shelf__weight, .queen-divider, [role=dialog]" });
  useOutsideClose([handCard], heldId !== null, () => setHeldId(null), { keep: ".queen-goal, .queen-room__acts, [role=dialog]" });

  const stepOf = (item: QueenShelfItem) => item.step;
  // The studio's own piece for every bank on the rack: what was thrown, painted and fired is what stands here.
  const pieces = useMemo(() => new Map(shown.map((item) => { const piece = queenBankPiece(item.bank); return [item.id, { piece, fired: queenBankFired(piece) }]; })), [shown]);
  const vessels = useMemo<RoomVessel[]>(() => shown.map((item) => ({
    id: item.id,
    studio: { ...pieces.get(item.id)!, step: stepOf(item) },
    kind: item.mouth === "open" ? "goal" : "bill",
    fill: item.fullness,
    parts: item.parts,
    size: item.size,
    lifted: item.id === heldId || item.id === dragId,
    refusing: item.id === refusedId,
  })), [shown, pieces, heldId, dragId, refusedId]);

  const banks = useMemo<RackBank[]>(() => shown.filter(item => item.bank.amountCents !== null).map((item) => ({ key: item.designKey, goalId: item.goalId, name: item.name, amountCents: item.bank.amountCents!, targetCents: item.bank.targetCents })), [shown]);
  const pourCents = pour ? Math.round((pour.safeCents * tilt) / 10) : 0;
  const preview = useMemo(() => rackPour(rack, banks.filter((bank) => bank.goalId), pourCents), [rack, banks, pourCents]);

  const refuse = (id: string) => {
    setRefusedId(id);
    setTimeout(() => setRefusedId((current) => (current === id ? null : current)), 700);
  };
  const write = (next: QueenRackV1) => { if (onRack && next !== rack) onRack(next); };

  // ---- banks: pick up by click; drag along a shelf or onto another ----------
  const shelfRects = () => [...(wall.current?.querySelectorAll<HTMLElement>("[data-room-shelf]") ?? [])].map((el) => el.getBoundingClientRect());
  const whereIs = (x: number, y: number): { shelf: number; index: number } | null => {
    const rects = shelfRects();
    if (!rects.length) return null;
    let shelfIndex = rects.findIndex((r) => y >= r.top && y <= r.bottom);
    if (shelfIndex < 0) shelfIndex = y < rects[0]!.top ? 0 : rects.length - 1;
    const seats = [...(wall.current?.querySelectorAll<HTMLElement>(`[data-room-shelf="${rack.shelves[shelfIndex]!.id}"] [data-ledge-bank]`) ?? [])];
    let index = seats.length;
    for (const [i, seat] of seats.entries()) {
      const r = seat.getBoundingClientRect();
      if (x < r.left + r.width / 2) { index = i; break; }
    }
    return { shelf: shelfIndex, index };
  };
  const onPointerDown = (item: QueenShelfItem) => (event: PointerEvent<HTMLButtonElement>) => {
    if (!canMove || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag.current = { id: item.id, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const held = drag.current;
    if (!held) return;
    const dx = event.clientX - held.x, dy = event.clientY - held.y;
    // A press is a drag only once the hand has moved; a bank goes along its shelf or onto another one.
    if (!held.moved && Math.hypot(dx, dy) < 8) return;
    if (!held.moved) { held.moved = true; setDragId(held.id); }
    const at = whereIs(event.clientX, event.clientY);
    dropAt.current = at;
    setDrop(at);
  };
  // Pointer events carry the drag only. Picking up is a click, so Enter, Space and any assistive click pick a bank up exactly as a tap does.
  const onPointerUp = (item: QueenShelfItem) => () => {
    const held = drag.current;
    drag.current = null;
    setDragId(null);
    const at = dropAt.current;
    dropAt.current = null;
    setDrop(null);
    if (!held?.moved) return;
    justDragged.current = true;
    if (at) write(rackMoveKey(rack, item.designKey, at.shelf, at.index));
  };
  const onPick = (item: QueenShelfItem) => () => {
    if (justDragged.current) { justDragged.current = false; return; }
    setHeldId((current) => (current === item.id ? null : item.id));
    if (item.mouth === "lidded") refuse(item.id);
  };
  const onKeyDown = (item: QueenShelfItem, shelfIndex: number, index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const seats = wall.current?.querySelectorAll<HTMLElement>(`[data-room-shelf="${rack.shelves[shelfIndex]!.id}"] [data-ledge-bank]`);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      if (event.shiftKey) { if (canMove) write(rackMoveKey(rack, item.designKey, shelfIndex, step < 0 ? index - 1 : index + 2)); return; }
      seats?.[index + step]?.focus();
      return;
    }
    if (event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      // Up and down with Shift move the bank to the shelf above or below; without Shift they belong to the house.
      event.preventDefault(); event.stopPropagation();
      if (canMove) write(rackMoveKey(rack, item.designKey, shelfIndex + (event.key === "ArrowUp" ? -1 : 1), index));
      return;
    }
    if (event.key === "Escape") { event.preventDefault(); setHeldId(null); }
  };
  useEffect(() => {
    // After a move, keep the hand on the bank it moved.
    if (!dragId && heldId) wall.current?.querySelector<HTMLElement>(`[data-ledge-bank="${CSS_escape(heldId)}"]`)?.focus();
  }, [rack, dragId, heldId]);

  // ---- the wall's sliders: the weight, the pin, the dividers ----------------
  const onSlideDown = (kind: "weight" | "pin" | "divider", shelfId: string, index: number, from: number) => (event: PointerEvent<HTMLElement>) => {
    if (!canMove || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.stopPropagation();
    slide.current = { kind, shelf: shelfId, index, x: event.clientX, y: event.clientY, from, pointerId: event.pointerId };
    slidMoved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const [sliding, setSliding] = useState<{ shelf: string; kind: string; value: number } | null>(null);
  const slidingAt = useRef<{ shelf: string; kind: string; value: number } | null>(null);
  const slideTo = (next: { shelf: string; kind: string; value: number }) => {
    const s = slide.current;
    // Until the value first changes this is still a tap, which opens the tool's card rather than sliding it.
    if (s && !slidMoved.current && next.value === (s.kind === "divider" ? 0 : s.from)) return;
    slidMoved.current = true;
    slidingAt.current = next; setSliding(next);
  };
  const onSlideMove = (event: PointerEvent<HTMLElement>) => {
    const s = slide.current;
    if (!s) return;
    event.stopPropagation();
    if (s.kind === "weight") {
      // Along the shelf: 18px a notch, right is more.
      const next = Math.max(1, Math.min(RACK_LIMITS.share, s.from + Math.round((event.clientX - s.x) / 18)));
      slideTo({ shelf: s.shelf, kind: "weight", value: next });
    } else if (s.kind === "pin") {
      // Up the post: 5px a twentieth, up is more.
      const next = Math.max(0, Math.min(RACK_LIMITS.marks, s.from + Math.round((s.y - event.clientY) / 5)));
      slideTo({ shelf: s.shelf, kind: "pin", value: next });
    } else {
      slideTo({ shelf: s.shelf, kind: `divider:${s.index}`, value: Math.round((event.clientX - s.x) / 24) });
    }
  };
  const onSlideUp = () => {
    const s = slide.current;
    slide.current = null;
    const v = slidingAt.current;
    slidingAt.current = null;
    setSliding(null);
    // A drag is a drag; the click that follows it must not also open the tool's card.
    if (slidMoved.current) suppressToolClick.current = true;
    slidMoved.current = false;
    if (!s || !v) return;
    if (s.kind === "weight") write(rackSetShare(rack, s.shelf, v.value));
    else if (s.kind === "pin") write(rackSetCutoff(rack, s.shelf, v.value));
    else if (v.value !== 0) {
      let next = rack;
      for (let i = 0; i < Math.abs(v.value); i += 1) next = rackSlideDivider(next, s.shelf, s.index, v.value > 0 ? "right" : "left");
      write(next);
    }
  };
  /** A tap (or Enter/Space) on a tool opens its card; a second tap closes it. */
  const onToolClick = (kind: "weight" | "pin" | "divider", shelfId: string, index: number) => () => {
    if (suppressToolClick.current) { suppressToolClick.current = false; return; }
    setHeldId(null);
    setTool((current) => (current && current.kind === kind && current.shelf === shelfId && current.index === index ? null : { kind, shelf: shelfId, index }));
  };
  const sliderKeys = (onStep: (step: number) => void) => (event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : event.key === "Home" ? -99 : event.key === "End" ? 99 : 0;
    if (!step) return;
    event.preventDefault(); event.stopPropagation();
    if (canMove) onStep(step);
  };

  const shelfCount = rack.shelves.length;
  const toolRow = tool ? rows.find((row) => row.id === tool.shelf) ?? null : null;
  const toolIndex = toolRow ? rows.indexOf(toolRow) : -1;
  const rackTotal = rack.shelves.reduce((sum, row) => sum + row.share, 0);
  const toolView = tool && toolRow ? (() => {
    const where = ordinal(toolIndex, shelfCount);
    if (tool.kind === "weight") {
      const share = sliding?.shelf === toolRow.id && sliding.kind === "weight" ? sliding.value : toolRow.share;
      const total = rackTotal - toolRow.share + share;
      return { kind: tool.kind, title: `The weight · ${where}`,
        how: "The brass block sets how big a part of every pour this shelf takes from the jug. Slide it along the shelf, or use the slider. Heavier (further right) takes more.",
        sliders: [{ label: "Share", min: 1, max: RACK_LIMITS.share, value: share, words: `${share} of ${total}`, onChange: (value: number) => write(rackSetShare(rack, toolRow.id, value)) }],
        now: `${where[0]!.toUpperCase()}${where.slice(1)} takes ${share} of ${total} parts — about ${Math.round((share / Math.max(1, total)) * 100)}% of a pour, before any shelf fills.` };
    }
    if (tool.kind === "pin") {
      const cutoff = sliding?.shelf === toolRow.id && sliding.kind === "pin" ? sliding.value : toolRow.cutoff;
      return { kind: tool.kind, title: `The pin · ${where}`,
        how: "The pin on the post is the fill mark: once every bank on this shelf is filled to it, the shelf stops taking and its part flows down to the next shelf. Slide the pin up or down its post, or use the slider.",
        sliders: [{ label: "Fill mark", min: 0, max: RACK_LIMITS.marks, value: cutoff, words: MARK_WORDS(cutoff), onChange: (value: number) => write(rackSetCutoff(rack, toolRow.id, value)) }],
        now: cutoff >= RACK_LIMITS.marks ? "Banks here take until they are full." : cutoff === 0 ? "Banks here take nothing; their part flows straight down." : `Banks here stop taking at ${Math.round((cutoff / RACK_LIMITS.marks) * 100)}% full — the dashed tide on each cat.` };
    }
    const left = toolRow.items[tool.index], right = toolRow.items[tool.index + 1];
    if (!left || !right) return null;
    const splitOf = (i: number) => toolRow.splits?.[i] ?? 1;
    const a = splitOf(tool.index), b = splitOf(tool.index + 1);
    return { kind: tool.kind, title: `The divider · ${left.name} | ${right.name}`,
      how: "A divider splits this shelf's part between the banks on either side. Slide it toward a bank to give that bank less, or set each bank's parts here.",
      sliders: [
        { label: left.name, min: 1, max: RACK_LIMITS.split, value: a, words: `${a} ${a === 1 ? "part" : "parts"}`, onChange: (value: number) => write(rackSetSplit(rack, toolRow.id, tool.index, value)) },
        { label: right.name, min: 1, max: RACK_LIMITS.split, value: b, words: `${b} ${b === 1 ? "part" : "parts"}`, onChange: (value: number) => write(rackSetSplit(rack, toolRow.id, tool.index + 1, value)) },
      ],
      now: `${left.name} takes ${a} and ${right.name} takes ${b} of every ${a + b} parts that reach them.` };
  })() : null;
  const line = held
    ? held.mouth === "open"
      ? <><em>Open-mouthed.</em> {held.name}{held.date ? `, hoped for ${formatDayLabel(held.date)}` : ""}. {held.marks === 0 ? "Nothing set inside yet; it would accept a part if you gave it one." : `${held.marks} ${held.marks === 1 ? "contribution" : "contributions"} inside.`}</>
      : <><em>Lidded.</em> {held.name} leans away. Nothing to open, because there was never a decision inside it.</>
    : pour && tilt > 0
      ? <><em>The jug tilts.</em> {pourWords(preview, formatCad)}</>
      : <><em>Open-mouthed things accept.</em> Lidded things refuse. {shelfCount > 1 ? "A higher, heavier shelf takes more of a pour; its pin is where it stops." : "Slide the weight along the shelf, the pin up its post, or hang a shelf below."}</>;

  return (
    <section ref={room} className="queen-room queen-room--loft" aria-label="The loft — Build" inert={!open} data-world={live ? "3d" : "flat"} data-shelves={shelfCount} data-voice={held ? "held" : pour && tilt > 0 ? "pour" : "hint"} style={{ ["--loft-zoom" as string]: zoom }}>
      <QueenRoomWorld room="loft" root={room} vessels={vessels} ambient={open} mode={world} onLive={(isLive) => setLive(isLive)} />
      <div className="queen-room__head">
        <p className="queen-room__title">The loft</p>
        <p className="queen-room__sub">{shown.length === 0 ? "Nothing on the shelves yet." : <>{shown.length === 1 ? "One thing" : `${shown.length} things`} on {shelfCount === 1 ? "the shelf" : `${shelfCount} shelves`}<span className="queen-room__sub-hint"> · the top shelf is fed first</span></>}</p>
        <span className="queen-loft-zoom" role="group" aria-label="Size of the kitty banks">
          <button type="button" className="queen-loft-zoom__step" aria-label="Smaller banks" disabled={zoom <= LOFT_ZOOM.min} onClick={() => onZoom(stepLoftZoom(zoom, -1))}>−</button>
          <span className="queen-loft-zoom__read" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" className="queen-loft-zoom__step" aria-label="Larger banks" disabled={zoom >= LOFT_ZOOM.max} onClick={() => onZoom(stepLoftZoom(zoom, 1))}>+</button>
        </span>
        {dirty && onDone && (
          <span className="queen-held queen-held--head">
            <span className="queen-held__mark" role="status">Rack not saved yet</span>
            <button type="button" className="queen-held__done" disabled={busy} onClick={onDone}>Done</button>
          </span>
        )}
      </div>
      <div className="queen-ledge-wrap">
        {/* A bank, a pin, a weight and a divider own the hand in both directions (a bank goes down onto a lower shelf; the pin rides up its post); a grab on a bare board, the peg or the jug is still the house's haul. */}
        <div ref={wall} className="queen-rack" role="group" aria-label="The rack — shelves on the wall; higher takes more. Pinch, ctrl-scroll or press plus and minus to size the banks"
          onPointerDownCapture={onRackPointerDown} onPointerMoveCapture={onRackPointerMove} onPointerUpCapture={onRackPointerEnd} onPointerCancelCapture={onRackPointerEnd}
          onKeyDown={(event) => { if (["+", "=", "-", "_"].includes(event.key) && !(event.target as HTMLElement).matches("input")) { event.preventDefault(); onZoom(stepLoftZoom(zoom, event.key === "-" || event.key === "_" ? -1 : 1)); } }}>
          {rows.map((row, shelfIndex) => {
            const share = sliding?.shelf === row.id && sliding.kind === "weight" ? sliding.value : row.share;
            const cutoff = sliding?.shelf === row.id && sliding.kind === "pin" ? sliding.value : row.cutoff;
            const total = rack.shelves.reduce((sum, s) => sum + s.share, 0) - row.share + share;
            return (
              <div key={row.id} className={`queen-shelf${row.items.length === 0 ? " is-bare" : ""}${drop?.shelf === shelfIndex ? " is-drop-shelf" : ""}`} data-room-shelf={row.id} data-mark-full={cutoff >= RACK_LIMITS.marks ? "" : undefined} style={{ ["--shelf-share" as string]: share, ["--shelf-mark" as string]: cutoff / RACK_LIMITS.marks }}>
                <div className="queen-shelf__post" aria-hidden={!onRack}>
                  <button type="button" className="queen-shelf__pin" role="slider" data-house-hold="" aria-label={`Fill mark of ${ordinal(shelfIndex, shelfCount)}. Enter shows how it works`} aria-valuemin={0} aria-valuemax={RACK_LIMITS.marks} aria-valuenow={cutoff} aria-valuetext={MARK_WORDS(cutoff)} disabled={!canMove}
                    data-tool-open={tool?.kind === "pin" && tool.shelf === row.id ? "" : undefined} onClick={onToolClick("pin", row.id, 0)}
                    onPointerDown={onSlideDown("pin", row.id, 0, row.cutoff)} onPointerMove={onSlideMove} onPointerUp={onSlideUp} onPointerCancel={onSlideUp}
                    onKeyDown={sliderKeys((step) => write(rackSetCutoff(rack, row.id, step === 99 ? RACK_LIMITS.marks : step === -99 ? 0 : row.cutoff + step)))}>
                    <span className="queen-shelf__pin-head" /></button>
                </div>
                <div className="queen-ledge" role="group" aria-label={`${ordinal(shelfIndex, shelfCount)} — ${row.items.length === 0 ? "bare" : `${row.items.length} on it`}, share ${share} of ${total}, fill mark ${MARK_WORDS(cutoff)}`}>
                  {row.items.map((item, index) => (
                    <span key={item.id} className="queen-shelf__seat">
                      {index > 0 && onRack && (
                        <button type="button" className="queen-divider" role="slider" data-house-hold="" aria-label={`Divider between ${row.items[index - 1]!.name} and ${item.name}. Enter shows how it works`} aria-valuemin={1} aria-valuemax={RACK_LIMITS.split} aria-valuenow={row.splits?.[index - 1] ?? 1} aria-valuetext={`${row.items[index - 1]!.name} ${row.splits?.[index - 1] ?? 1}, ${item.name} ${row.splits?.[index] ?? 1}`} disabled={!canMove}
                          data-tool-open={tool?.kind === "divider" && tool.shelf === row.id && tool.index === index - 1 ? "" : undefined} onClick={onToolClick("divider", row.id, index - 1)}
                          onPointerDown={onSlideDown("divider", row.id, index - 1, 0)} onPointerMove={onSlideMove} onPointerUp={onSlideUp} onPointerCancel={onSlideUp}
                          onKeyDown={sliderKeys((step) => write(rackSlideDivider(rack, row.id, index - 1, step > 0 ? "right" : "left")))} />
                      )}
                      <button
                        type="button"
                        data-ledge-bank={item.id}
                        className={`queen-goal queen-goal--${item.mouth} queen-goal--${item.size}${refusedId === item.id ? " is-refusing" : ""}${dragId === item.id ? " is-dragging" : ""}${drop?.shelf === shelfIndex && drop.index === index ? " is-drop" : ""}`}
                        aria-pressed={heldId === item.id} data-house-hold=""
                        aria-label={`${item.name} — ${item.mouth === "open" ? "open-mouthed, accepts" : "lidded, nothing to open"}, ${index + 1} of ${row.items.length} on ${ordinal(shelfIndex, shelfCount)}${canMove ? ". Shift with an arrow key to move it along, up or down" : ""}`}
                        onPointerDown={onPointerDown(item)} onPointerMove={onPointerMove} onPointerUp={onPointerUp(item)} onPointerCancel={onPointerUp(item)}
                        onKeyDown={onKeyDown(item, shelfIndex, index)}
                        onClick={onPick(item)}
                      >
                        <span className="queen-goal__vessel" data-room-vessel={item.id} style={{ ["--bank-scale" as string]: item.scale }}>
                          <KittyFlat className="queen-bank-flat queen-goal__flat queen-goal__kitty" piece={pieces.get(item.id)!.piece} fired={pieces.get(item.id)!.fired} step={stepOf(item)} />
                        </span>
                        <span className="queen-goal__name">{item.name}</span>
                      </button>
                    </span>
                  ))}
                  {row.items.length === 0 && <span className="queen-shelf__bare">{drop?.shelf === shelfIndex ? "Set it down here" : "A bare shelf"}</span>}
                  {row.items.length === 0 && onRack && shelfCount > 1 && (
                    <button type="button" className="queen-shelf__down" disabled={!canMove} onClick={() => write(rackTakeDown(rack, row.id))} aria-label={`Take ${ordinal(shelfIndex, shelfCount)} down`}>Take it down</button>
                  )}
                </div>
                <div className="queen-shelf__end">
                  {onRack && (
                    <button type="button" className="queen-shelf__weight" role="slider" data-house-hold="" aria-label={`Share of ${ordinal(shelfIndex, shelfCount)}. Enter shows how it works`} aria-valuemin={1} aria-valuemax={RACK_LIMITS.share} aria-valuenow={share} aria-valuetext={`${share} of ${total}`} disabled={!canMove}
                      data-tool-open={tool?.kind === "weight" && tool.shelf === row.id ? "" : undefined} onClick={onToolClick("weight", row.id, 0)}
                      onPointerDown={onSlideDown("weight", row.id, 0, row.share)} onPointerMove={onSlideMove} onPointerUp={onSlideUp} onPointerCancel={onSlideUp}
                      onKeyDown={sliderKeys((step) => write(rackSetShare(rack, row.id, step === 99 ? RACK_LIMITS.share : step === -99 ? 1 : row.share + step)))}>
                      <span className="queen-shelf__weight-read" aria-hidden="true">{shelfShareWords({ ...rack, shelves: rack.shelves.map((s) => (s.id === row.id ? { ...s, share } : s)) }, row.id)}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {shown.length === 0 && shelfCount === 1 && <p className="queen-room__empty">The shelf is bare. A goal chosen in the banks would sit here.</p>}
          {onRack && shelfCount < RACK_LIMITS.shelves && (
            <button type="button" className="queen-rack__hang" disabled={!canMove} onClick={() => write(rackHangShelf(rack))}>Hang a shelf below</button>
          )}
        </div>
        {held && (
          <div ref={handCard} className="queen-hand" aria-live="polite">
            <p className="queen-eyebrow">In hand</p>
            <p className="queen-hand__name">{held.name}</p>
            <ul className="queen-hand__facts">
              <li>{(held.bank.amountCents === null ? "Backing unavailable" : formatCad(held.bank.amountCents))} of {formatCad(held.bank.targetCents)}</li>
              {held.date && <li>{formatDayLabel(held.date)}</li>}
              <li>{held.parts ? `${held.parts} ${held.parts === 1 ? "part" : "parts"} inside` : "no parts inside"}</li>
              <li>{ordinal(rows.findIndex((row) => row.items.some((item) => item.id === held.id)), shelfCount)}</li>
            </ul>
          </div>
        )}
        {pour && !held && (
          <div className="queen-loft-hands">
        {pour && !held && (
          <div className="queen-jug" role="group" aria-label="The jug — the Fund's safe surplus, poured over the rack">
            <span className="queen-jug__safe">{pour.safeCents > 0 ? `${formatCad(pour.safeCents)} safe to pour` : "Nothing safe to pour this month"}</span>
            {pour.custodian ? (
              <input type="range" className="queen-jug__tilt" min={0} max={10} step={1} value={tilt} disabled={busy || pour.safeCents <= 0 || !shown.some((item) => item.goalId)}
                aria-label="Tilt the jug" aria-valuetext={tilt === 0 ? "upright — nothing poured" : `${tilt * 10}% of the safe surplus, ${formatCad(pourCents)}`}
                onChange={(event) => setTilt(Number(event.currentTarget.value))} />
            ) : <span className="queen-jug__holder">{pour.custodianName} holds the jug.</span>}
          </div>
        )}
          </div>
        )}
        <p className="queen-room__line" aria-live={toolView ? undefined : "polite"} aria-hidden={toolView ? true : undefined} style={toolView ? { visibility: "hidden" } : undefined}>{line}</p>
        {toolView && (
          <section ref={toolCard} className="queen-tool-card" aria-label={toolView.title} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setTool(null); } }}>
            <header className="queen-tool-card__head">
              <span className="queen-tool-card__glyph" data-tool={toolView.kind} aria-hidden="true" />
              <p className="queen-tool-card__title">{toolView.title}</p>
              <button type="button" className="queen-tool-card__close" aria-label="Close" onClick={() => setTool(null)}>×</button>
            </header>
            <p className="queen-tool-card__how">{toolView.how}</p>
            {toolView.sliders.map((slider) => (
              <label key={slider.label} className="queen-tool-card__slider">
                <span className="queen-tool-card__label">{slider.label}<b>{slider.words}</b></span>
                <input type="range" min={slider.min} max={slider.max} step={1} value={slider.value} disabled={!canMove}
                  aria-valuetext={slider.words} onChange={(event) => slider.onChange(Number(event.currentTarget.value))} />
              </label>
            ))}
            <p className="queen-tool-card__now" aria-live="polite">{toolView.now}</p>
          </section>
        )}
        {notice && <p className="queen-room__line queen-cellar-notice" role="status">{notice}</p>}
        <div className="queen-room__acts">

          {held?.mouth === "open" && held.goalId && <button type="button" className="queen-go queen-go--primary" onClick={() => onOpenGoal(held.goalId!)}>Open {held.name} in the banks</button>}
          {pour?.custodian && !held && tilt > 0 && preview.placedCents > 0 && (
            <button type="button" className="queen-go queen-go--primary queen-pour" disabled={busy} onClick={() => setPouring(true)}>Move {formatCad(preview.placedCents)} to Kitty Banks</button>
          )}
          <button type="button" className="queen-go" onClick={onOpenBanks}>Open Build in the banks</button>
        </div>
      </div>
      {pouring && pour && (
        <ConfirmSheet
          title={`Move ${formatCad(preview.placedCents)} to Kitty Banks`}
          body={`${pourWords(preview, formatCad)} This is the Fund's month-end Kitty rollover, split by the shelves as they stand.`}
          extra="Hearth records the rollover in your books. Operating plus Kitty stays conserved; no bank transfer occurs."
          confirmLabel={`Move ${formatCad(preview.placedCents)} to Kitty Banks`}
          busy={busy}
          onCancel={() => setPouring(false)}
          onConfirm={() => {
            setPouring(false);
            const allocations = preview.shelves.flatMap((row) => row.lines.filter((l) => l.cents > 0 && l.goalId).map((l) => ({ goalId: l.goalId!, amountCents: l.cents })));
            void pour.onPour(allocations, preview.placedCents).then(
              (result) => {
                if (!postedOk(result)) { setNotice(rejectedWords(result, "The jug was not poured. Nothing moved.")); return; }
                setNotice(`${formatCad(preview.placedCents)} poured. The banks fire as they fill.`); setTilt(0);
              },
              (error: unknown) => setNotice(error instanceof Error ? error.message : "The jug could not be poured."),
            );
          }}
        />
      )}
      <button ref={stairRef} type="button" className="queen-stair queen-stair--down" onClick={onExit} aria-label="Down to now — back to her">
        <span>Down to now</span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5" /><path d="M10 3v10" /></svg>
      </button>
    </section>
  );
}

/** The command's outcome says the books took it. A bare resolve (older callers, tests) counts; an outcome with `ok: false` or nothing at all does not. */
function postedOk(result: unknown): boolean {
  if (result === undefined) return true;
  if (!result || typeof result !== "object") return false;
  const outcome = result as { ok?: unknown; postedNothing?: unknown };
  return outcome.ok === true && outcome.postedNothing !== true;
}
function rejectedWords(result: unknown, fallback: string): string {
  const message = result && typeof result === "object" ? (result as { userMessage?: unknown }).userMessage : null;
  return typeof message === "string" && message.trim() ? `${message} Nothing moved.` : fallback;
}

/** `CSS.escape` where the DOM has it; the ids here are the nest's own, so a plain fallback suffices under jsdom. */
function CSS_escape(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}
