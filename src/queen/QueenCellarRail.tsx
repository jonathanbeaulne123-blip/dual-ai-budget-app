import { useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import type { CellarDay, CellarJar, CellarReading } from "../core/queenCellar.ts";
import { QueenBankFlat } from "./QueenBankFlat.tsx";
import type { BankForm } from "./world/queenBankSculpture.ts";
import { BANK_DRESS_WORDS } from "./world/queenBankDress.ts";
import { CELLAR_ZOOM, cellarCellPx, clampCellarZoom, stepCellarZoom } from "./cellarZoom.ts";
import "./queen-cellar.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const cellarMonthLong = (monthKey: string) => `${MONTHS[Number(monthKey.slice(5, 7)) - 1] ?? monthKey} ${monthKey.slice(0, 4)}`;
export const cellarDayLabel = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]?.slice(0, 3) ?? ""} ${Number(date.slice(8, 10))}`;

/**
 * A bill on the rail is the studio's own kitty bank — the same lidded bean cat
 * the nest gives every bill (`QueenBankFlat`, form "bill") — with its water
 * inside as the saved amount. What the rail adds is the strike: a crack across
 * the cat when it is due and not full, the broken cat (a hollow with the crack)
 * once it is paid, a dotted ghost for a planned expense that has not posted.
 * The type is carried on the button (`data-type`) for a tint and in words.
 */
/** One body per purpose: the bill's bean, the recurring loaf, the subscription's wrapped-tail round, the appointment's tall cat, the planned expense's hollow bean. */
export const cellarBankForm = (type: CellarJar["type"]): BankForm =>
  type === "house" ? "bill" : type === "subscription" ? "subscription" : type === "appointment" ? "appointment" : type === "potential" ? "planned" : "recurring";

/** The purpose in words, with its dressing — the jar's title (a hover on the desk), and the key when nothing is in the gate. */
export const cellarPurposeWords = (type: CellarJar["type"]): string => {
  const purpose = type === "house" ? "house bill" : type === "subscription" ? "subscription" : type === "potential" ? "planned, not posted" : type === "appointment" ? "appointment" : "recurring payment";
  const dress = BANK_DRESS_WORDS[cellarBankForm(type)];
  return dress ? `${purpose}, wearing ${dress}` : purpose;
};

export function CellarJarGlyph({ jar, held = false }: { jar: CellarJar; held?: boolean }) {
  return (
    <span className={`queen-billjar queen-billjar--${jar.type} queen-billjar--size-${jar.size}${jar.paid ? " is-shard" : ""}${held ? " is-held" : ""}`} data-hue={jar.hue} data-finish={jar.finish} aria-hidden="true">
      <QueenBankFlat form={cellarBankForm(jar.type)} className="queen-bank-flat queen-billjar__cat" fill={jar.paid ? 1 : jar.fill} frosted={jar.type === "potential" && !jar.paid} tint={jar.hue === "clay" ? undefined : `var(--queen-hue-${jar.hue})`} finish={jar.finish} />
      {(jar.paid || jar.strike === "crack") && (
        <svg viewBox="0 0 100 100" className={`queen-billjar__crack${jar.paid ? " queen-billjar__crack--shard" : " queen-billjar__crack--due"}`}>
          <path d={jar.paid ? "M52 34 L44 52 L56 62 L46 86" : "M54 40 L47 56 L57 66"} />
        </svg>
      )}
    </span>
  );
}

/**
 * The rail is time. One cell per day of the month; jars stand on their due
 * day; the water behind the rail is the Fund's balance on the day in the gate.
 * Drag, the slider or the arrow keys scrub the gate; the jar in the gate is the
 * one the line beneath is about. The page never scrolls.
 */
export function QueenCellarRail({ reading, cursor, onCursor, heldId, zoom = CELLAR_ZOOM.default, onZoom, openId = null, onPick }: {
  reading: CellarReading;
  cursor: number;
  onCursor: (next: number | ((current: number) => number)) => void;
  heldId: string | null;
  /** The jar whose card is open, and the press that opens (or closes) one. */
  openId?: string | null;
  onPick?: (jar: CellarJar) => void;
  /** The size of the banks (cellarZoom): the day cell, the size bands and the seats all follow it. */
  zoom?: number;
  onZoom?: (next: number) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  // A press is not a drag until the finger has moved: the pointer is captured only then, so a tap on a jar still reaches the jar.
  const drag = useRef<{ x: number; from: number; pointerId: number; live: boolean } | null>(null);
  // A pinch: two fingers on the rail set the scale, never the gate.
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ span: number; zoom: number } | null>(null);
  const cell = cellarCellPx(zoom);
  const { days, jars } = reading;
  const at = Math.max(0, Math.min(days.length - 1, Math.round(cursor)));
  const day: CellarDay | null = days[at] ?? null;
  const crest = Math.max(1, reading.crestCents);
  const water = day ? Math.max(0, Math.min(1, day.balanceCents / crest)) : 0;
  const mark = Math.max(0, Math.min(1, reading.bufferCents / crest));
  const byDay = new Map<string, CellarJar[]>();
  for (const jar of jars) byDay.set(jar.date, [...(byDay.get(jar.date) ?? []), jar]);

  const span = () => { const [a, b] = [...fingers.current.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.pointerType === "touch") {
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.current.size === 2 && onZoom) { drag.current = null; pinch.current = { span: span(), zoom }; viewport.current?.setPointerCapture(event.pointerId); return; }
    }
    drag.current = { x: event.clientX, from: cursor, pointerId: event.pointerId, live: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (fingers.current.has(event.pointerId)) fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && fingers.current.size === 2 && onZoom) {
      const now = span();
      if (pinch.current.span > 0 && now > 0) onZoom(clampCellarZoom(pinch.current.zoom * (now / pinch.current.span)));
      return;
    }
    const held = drag.current;
    if (!held || !viewport.current) return;
    const moved = event.clientX - held.x;
    if (!held.live) {
      if (Math.abs(moved) < 6) return;
      held.live = true;
      viewport.current.setPointerCapture(held.pointerId);
    }
    const step = cell; // one cell, one day: the rail follows the finger exactly
    onCursor(Math.max(0, Math.min(days.length - 1, held.from - moved / step)));
  };
  const onPointerUp = (event?: PointerEvent<HTMLDivElement>) => {
    if (event) fingers.current.delete(event.pointerId);
    if (fingers.current.size < 2) pinch.current = null;
    const held = drag.current; drag.current = null; if (held?.live) onCursor((c) => Math.round(c));
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    // Ctrl-scroll (and a trackpad pinch, which arrives the same way) sets the scale; a plain scroll is the page's.
    if (!event.ctrlKey || !onZoom) return;
    event.preventDefault();
    onZoom(clampCellarZoom(zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); onCursor((c) => Math.max(0, Math.min(days.length - 1, Math.round(c) + (event.key === "ArrowLeft" ? -1 : 1)))); }
    if (event.key === "Home") { event.preventDefault(); onCursor(0); }
    if (event.key === "End") { event.preventDefault(); onCursor(days.length - 1); }
    if ((event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") && onZoom) { event.preventDefault(); onZoom(stepCellarZoom(zoom, event.key === "-" || event.key === "_" ? -1 : 1)); }
  };

  return (
    <div ref={viewport} className={`queen-gate-view queen-cellar-rail${day?.dry ? " is-dry" : day?.belowBuffer ? " is-under" : ""}`} tabIndex={0} role="group"
      style={{ ["--cellar-zoom" as string]: zoom }} data-zoom={zoom}
      aria-label={`${cellarMonthLong(reading.monthKey)}, day by day. Drag the rail or use the arrow keys; the day in the gate is the one described below.${onZoom ? " Pinch, ctrl-scroll or press plus and minus to size the kitty jars." : ""}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onKeyDown={onKeyDown}>
      <div className="queen-water" aria-hidden="true" style={{ height: `${Math.round(water * 90)}%` }} data-level={Math.round(water * 100)}>
        {/* The water reads as water (2026-09-15, Jonathan: "the water in the cellar also needs to be more apparent"): a body, a moving surface, and its name. */}
        <span className="queen-water__body" />
        <span className="queen-water__wave queen-water__wave--back" />
        <span className="queen-water__wave" />
        <span className="queen-water__name">{day?.dry ? "The Fund's water — dry" : day?.belowBuffer ? "The Fund's water — under the buffer" : "The Fund's water"}</span>
      </div>
      <div className="queen-tidemark" aria-hidden="true" style={{ bottom: `${Math.round(mark * 90)}%` }} />
      <div className="queen-gate" aria-hidden="true"><span className="queen-gate__tab" /></div>
      <div className="queen-ribbon-track queen-cellar-track" style={{ transform: `translateX(${-(cursor + 0.5) * cell}px)` }}>
        <div className="queen-cellar-days">
          {days.map((row, index) => {
            const here = byDay.get(row.date) ?? [];
            return (
              <div key={row.date} className={`queen-cellar-day${row.today ? " is-today" : ""}${index === at ? " is-in-gate" : ""}${row.belowBuffer ? " is-under" : ""}${row.dry ? " is-dry" : ""}`}>
                <div className="queen-cellar-day__seats">
                  {here.map((jar) => (
                    <button key={jar.id} type="button" className={`queen-jar queen-jar--bill queen-jar--${jar.strike}${heldId === jar.id ? " is-held" : ""}${index === at ? " is-in-gate" : ""}${openId === jar.id ? " is-open" : ""}`}
                      data-room-vessel={jar.id} data-type={jar.type} aria-current={index === at ? "true" : undefined} aria-expanded={onPick ? openId === jar.id : undefined}
                      title={cellarPurposeWords(jar.type)}
                      aria-label={`${jar.label} — ${jar.type === "house" ? "house bill" : jar.type === "subscription" ? "subscription" : jar.type === "potential" ? "planned, not posted" : jar.type === "appointment" ? "appointment" : "recurring payment"}${jar.groupName ? ` (${jar.groupName}${jar.lineName && jar.lineName !== jar.groupName ? ` › ${jar.lineName}` : ""})` : ""}, ${jar.size >= 5 ? "the month's largest" : jar.size === 4 ? "large" : jar.size === 3 ? "middling" : jar.size === 2 ? "small" : "the smallest"}, ${cellarDayLabel(jar.date)}${jar.paid ? ", paid" : jar.full ? ", full" : ", filling"}${jar.strike === "hammer" ? ". The hammer is out" : jar.strike === "crack" ? ". Cracked: due and not full" : ""}`}
                      onClick={() => { onCursor(index); onPick?.(jar); }}>
                      <CellarJarGlyph jar={jar} held={heldId === jar.id} />
                    </button>
                  ))}
                </div>
                <span className="queen-cellar-day__tick" aria-hidden="true">{row.day === 1 || row.day % 5 === 0 || row.today ? row.day : ""}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The size pane: smaller, larger. Lives in the scrub row beside the rail, so it covers no bank. */
export function CellarZoomPane({ zoom, onZoom }: { zoom: number; onZoom: (next: number) => void }) {
  return (
    <span className="queen-cellar-zoom" role="group" aria-label="Size of the kitty jars">
      <button type="button" className="queen-cellar-zoom__step" aria-label="Smaller jars" disabled={zoom <= CELLAR_ZOOM.min} onClick={() => onZoom(stepCellarZoom(zoom, -1))}>−</button>
      <span className="queen-cellar-zoom__read" aria-live="polite">{Math.round(zoom * 100)}%</span>
      <button type="button" className="queen-cellar-zoom__step" aria-label="Larger jars" disabled={zoom >= CELLAR_ZOOM.max} onClick={() => onZoom(stepCellarZoom(zoom, 1))}>+</button>
    </span>
  );
}
