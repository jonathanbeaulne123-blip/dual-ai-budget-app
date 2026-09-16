import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import type { CellarDay, CellarJar, CellarReading } from "../core/queenCellar.ts";
import { QueenBankFlat } from "./QueenBankFlat.tsx";
import type { BankForm } from "./world/queenBankSculpture.ts";
import { BANK_DRESS_WORDS } from "./world/queenBankDress.ts";
import { CELLAR_CELL_ZOOM_MAX, CELLAR_ZOOM, cellarCellPx, cellarScale, clampCellarZoom, stepCellarZoom } from "./cellarZoom.ts";
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
    <span data-room-seat="" className={`queen-billjar queen-billjar--${jar.type} queen-billjar--size-${jar.size}${jar.paid ? " is-shard" : ""}${held ? " is-held" : ""}`} data-hue={jar.hue} data-finish={jar.finish} aria-hidden="true">
      <QueenBankFlat form={cellarBankForm(jar.type)} className="queen-bank-flat queen-billjar__cat" fill={jar.paid ? 1 : jar.fill} frosted={jar.type === "potential" && !jar.paid} tint={jar.umbrellaHue ?? (jar.hue === "clay" ? undefined : `var(--queen-hue-${jar.hue})`)} finish={jar.finish} />
      {(jar.paid || jar.strike === "crack") && (
        <svg viewBox="0 0 100 100" className={`queen-billjar__crack${jar.paid ? " queen-billjar__crack--shard" : " queen-billjar__crack--due"}`}>
          <path d={jar.paid ? "M52 34 L44 52 L56 62 L46 86" : "M54 40 L47 56 L57 66"} />
        </svg>
      )}
    </span>
  );
}

/**
 * The cellar's other jars (2026-09-16, D-279/D-280), on the same dollar scale:
 * - `income` — a partner's pay, if all of it came in: clear glass, dashed, an
 *   "if" on its belly. Hypothetical; never money that exists.
 * - `contribution` — on and after the pay day, the kitty bank of what that
 *   partner actually contributed to the Fund.
 * - `missing` / `smaller` — a subscription that was not charged, or came in
 *   lower: its jar stays one more cycle with a mark.
 */
export type CellarRailExtra = {
  id: string;
  /** The rail day it stands on. */
  date: string;
  kind: "income" | "contribution" | "missing" | "smaller";
  /** Dollars for its height, on the rail's one scale. */
  cents: number;
  label: string;
  /** For a contribution bank: how full (0 when nothing came in). */
  fill?: number;
  /** For a missing mark: where the roll stands. */
  stage?: string;
};

export function CellarExtraGlyph({ extra }: { extra: CellarRailExtra }) {
  if (extra.kind === "income") {
    return (
      <span data-extra-seat="" className="queen-extrajar queen-extrajar--income" aria-hidden="true">
        <svg viewBox="0 0 60 100" preserveAspectRatio="none" className="queen-extrajar__svg">
          <path className="queen-extrajar__glass" d="M16 6 H44 V14 C52 20 56 30 56 44 V88 C56 94 52 98 46 98 H14 C8 98 4 94 4 88 V44 C4 30 8 20 16 14 Z" />
          <path className="queen-extrajar__shine" d="M12 40 V82" />
        </svg>
        <span className="queen-extrajar__if">if</span>
      </span>
    );
  }
  if (extra.kind === "contribution") {
    const level = Math.max(0, Math.min(1, extra.fill ?? 0));
    return (
      <span data-extra-seat="" className={`queen-extrajar queen-extrajar--contribution${level > 0 ? "" : " is-empty"}`} aria-hidden="true">
        <svg viewBox="0 0 60 100" preserveAspectRatio="none" className="queen-extrajar__svg">
          <path className="queen-extrajar__bank" d="M6 30 C6 16 16 8 30 8 C44 8 54 16 54 30 V88 C54 94 50 98 44 98 H16 C10 98 6 94 6 88 Z" />
          {level > 0 && <rect className="queen-extrajar__coins" x="8" y={98 - 88 * level} width="44" height={88 * level} rx="6" />}
          <path className="queen-extrajar__slot" d="M22 20 H38" />
        </svg>
      </span>
    );
  }
  return (
    <span data-extra-seat="" className={`queen-extrajar queen-extrajar--missing queen-extrajar--${extra.kind}${extra.stage === "rolled" ? " is-rolled" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 60 100" preserveAspectRatio="none" className="queen-extrajar__svg">
        <path className="queen-extrajar__ghost" d="M10 22 C10 12 18 6 30 6 C42 6 50 12 50 22 V88 C50 94 46 98 40 98 H20 C14 98 10 94 10 88 Z" />
        {extra.kind === "smaller" && <path className="queen-extrajar__drop" d="M30 40 V66 M22 58 L30 66 L38 58" />}
      </svg>
      <span className="queen-extrajar__mark">{extra.stage === "rolled" ? "✓" : "✦"}</span>
    </span>
  );
}

/**
 * The rail is time. One cell per day of the month; jars stand on their due
 * day; the water behind the rail is the Fund's balance on the day in the gate.
 * Drag, the slider or the arrow keys scrub the gate; the jar in the gate is the
 * one the line beneath is about. The page never scrolls.
 */
export function QueenCellarRail({ reading, cursor, onCursor, heldId, zoom = CELLAR_ZOOM.default, onZoom, openId = null, onPick, extras = [], onPickExtra }: {
  reading: CellarReading;
  /** Income glass, contribution banks and missing marks (D-279/D-280). */
  extras?: CellarRailExtra[];
  onPickExtra?: (extra: CellarRailExtra) => void;
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
  // The water column: the rail's height above the day ticks. Measured, so the dollar scale follows the room.
  const [frame, setFrame] = useState({ column: 90, floor: 36 });
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // The floor is where the jars stand (above the day ticks); the column is the height from there to the rail's top.
    const measure = () => {
      const r = el.getBoundingClientRect(), seat = el.querySelector(".queen-cellar-day__seats")?.getBoundingClientRect();
      if (!seat || r.height < 20) return;
      const floor = Math.round(r.bottom - seat.bottom), column = Math.round(seat.bottom - r.top - 8);
      if (column > 20) setFrame((f) => (f.floor === floor && f.column === column ? f : { floor, column }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const sizes = new ResizeObserver(measure);
    sizes.observe(el);
    return () => sizes.disconnect();
  }, []);
  const scale = cellarScale({ columnPx: frame.column, crestCents: reading.crestCents, balanceCents: day && !day.dry ? day.balanceCents : 0, bufferCents: reading.bufferCents, zoom });
  const byDay = new Map<string, CellarJar[]>();
  for (const jar of jars) byDay.set(jar.date, [...(byDay.get(jar.date) ?? []), jar]);
  const extrasByDay = new Map<string, CellarRailExtra[]>();
  for (const extra of extras) extrasByDay.set(extra.date, [...(extrasByDay.get(extra.date) ?? []), extra]);

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
      style={{ ["--cellar-zoom" as string]: Math.min(zoom, CELLAR_CELL_ZOOM_MAX) }} data-zoom={zoom} data-room-stage="" data-room-floor={frame.floor}
      aria-label={`${cellarMonthLong(reading.monthKey)}, day by day. Drag the rail or use the arrow keys; the day in the gate is the one described below.${onZoom ? " Pinch, ctrl-scroll or press plus and minus to size the kitty jars." : ""}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onKeyDown={onKeyDown}>
      <div className={`queen-water${scale.deep ? " is-deep" : ""}`} aria-hidden="true" style={{ height: `${scale.waterPx}px`, bottom: `${frame.floor}px` }} data-level={Math.round((scale.waterPx / scale.column) * 100)}>
        {/* The water reads as water (2026-09-15, Jonathan: "the water in the cellar also needs to be more apparent"): a body, a moving surface, and its name. */}
        <span className="queen-water__body" />
        <span className="queen-water__wave queen-water__wave--back" />
        <span className="queen-water__wave" />
        <span className="queen-water__name">{day?.dry ? "The Fund's water — dry" : day?.belowBuffer ? "The Fund's water — under the buffer" : scale.deep ? "The Fund's water — deeper than the view" : "The Fund's water"}</span>
      </div>
      <div className="queen-tidemark" aria-hidden="true" style={{ bottom: `${frame.floor + scale.markPx}px`, marginBottom: 0 }} />
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
                      data-room-vessel={jar.id} data-type={jar.type} style={{ ["--jar-px" as string]: `${scale.jarPx(jar.targetCents)}px` }} aria-current={index === at ? "true" : undefined} aria-expanded={onPick ? openId === jar.id : undefined}
                      title={cellarPurposeWords(jar.type)}
                      aria-label={`${jar.label} — ${jar.type === "house" ? "house bill" : jar.type === "subscription" ? "subscription" : jar.type === "potential" ? "planned, not posted" : jar.type === "appointment" ? "appointment" : "recurring payment"}${jar.groupName ? ` (${jar.groupName}${jar.lineName && jar.lineName !== jar.groupName ? ` › ${jar.lineName}` : ""})` : ""}, ${jar.size >= 5 ? "the month's largest" : jar.size === 4 ? "large" : jar.size === 3 ? "middling" : jar.size === 2 ? "small" : "the smallest"}, ${cellarDayLabel(jar.date)}${jar.paid ? ", paid" : jar.full ? ", full" : ", filling"}${jar.strike === "hammer" ? ". The hammer is out" : jar.strike === "crack" ? ". Cracked: due and not full" : ""}`}
                      onClick={() => { onCursor(index); onPick?.(jar); }}>
                      <CellarJarGlyph jar={jar} held={heldId === jar.id} />
                    </button>
                  ))}
                  {(extrasByDay.get(row.date) ?? []).map((extra) => (
                    <button key={extra.id} type="button" className={`queen-jar queen-jar--extra queen-jar--${extra.kind}${index === at ? " is-in-gate" : ""}${openId === extra.id ? " is-open" : ""}`}
                      data-cellar-extra={extra.id} data-kind={extra.kind} style={{ ["--jar-px" as string]: `${scale.jarPx(extra.cents)}px` }}
                      aria-current={index === at ? "true" : undefined} aria-expanded={onPickExtra ? openId === extra.id : undefined}
                      aria-label={extra.label}
                      onClick={() => { onCursor(index); onPickExtra?.(extra); }}>
                      <CellarExtraGlyph extra={extra} />
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
      <span className="queen-cellar-zoom__read" aria-live="polite">{Math.round((zoom / CELLAR_ZOOM.default) * 100)}%</span>
      <button type="button" className="queen-cellar-zoom__step" aria-label="Larger jars" disabled={zoom >= CELLAR_ZOOM.max} onClick={() => onZoom(stepCellarZoom(zoom, 1))}>+</button>
    </span>
  );
}
