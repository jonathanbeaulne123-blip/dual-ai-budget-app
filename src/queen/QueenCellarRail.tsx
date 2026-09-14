import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { CellarDay, CellarJar, CellarReading } from "../core/queenCellar.ts";
import { QueenBankFlat } from "./QueenBankFlat.tsx";
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
export function CellarJarGlyph({ jar, held = false }: { jar: CellarJar; held?: boolean }) {
  return (
    <span className={`queen-billjar queen-billjar--${jar.type}${jar.paid ? " is-shard" : ""}${held ? " is-held" : ""}`} aria-hidden="true">
      <QueenBankFlat form="bill" className="queen-bank-flat queen-billjar__cat" fill={jar.paid ? 0 : jar.fill} hollow={jar.type === "potential" || jar.paid} />
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
export function QueenCellarRail({ reading, cursor, onCursor, heldId }: {
  reading: CellarReading;
  cursor: number;
  onCursor: (next: number | ((current: number) => number)) => void;
  heldId: string | null;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  // A press is not a drag until the finger has moved: the pointer is captured only then, so a tap on a jar still reaches the jar.
  const drag = useRef<{ x: number; from: number; pointerId: number; live: boolean } | null>(null);
  const { days, jars } = reading;
  const at = Math.max(0, Math.min(days.length - 1, Math.round(cursor)));
  const day: CellarDay | null = days[at] ?? null;
  const crest = Math.max(1, reading.crestCents);
  const water = day ? Math.max(0, Math.min(1, day.balanceCents / crest)) : 0;
  const mark = Math.max(0, Math.min(1, reading.bufferCents / crest));
  const byDay = new Map<string, CellarJar[]>();
  for (const jar of jars) byDay.set(jar.date, [...(byDay.get(jar.date) ?? []), jar]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { x: event.clientX, from: cursor, pointerId: event.pointerId, live: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held || !viewport.current) return;
    const moved = event.clientX - held.x;
    if (!held.live) {
      if (Math.abs(moved) < 6) return;
      held.live = true;
      viewport.current.setPointerCapture(held.pointerId);
    }
    const step = 44; // one cell, one day: the rail follows the finger exactly
    onCursor(Math.max(0, Math.min(days.length - 1, held.from - moved / step)));
  };
  const onPointerUp = () => { const held = drag.current; drag.current = null; if (held?.live) onCursor((c) => Math.round(c)); };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); onCursor((c) => Math.max(0, Math.min(days.length - 1, Math.round(c) + (event.key === "ArrowLeft" ? -1 : 1)))); }
    if (event.key === "Home") { event.preventDefault(); onCursor(0); }
    if (event.key === "End") { event.preventDefault(); onCursor(days.length - 1); }
  };

  return (
    <div ref={viewport} className={`queen-gate-view queen-cellar-rail${day?.dry ? " is-dry" : day?.belowBuffer ? " is-under" : ""}`} tabIndex={0} role="group"
      aria-label={`${cellarMonthLong(reading.monthKey)}, day by day. Drag the rail or use the arrow keys; the day in the gate is the one described below.`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
      <div className="queen-water" aria-hidden="true" style={{ height: `${Math.round(water * 100)}%` }} />
      <div className="queen-tidemark" aria-hidden="true" style={{ bottom: `${Math.round(mark * 100)}%` }} />
      <div className="queen-gate" aria-hidden="true"><span className="queen-gate__tab" /></div>
      <div className="queen-ribbon-track queen-cellar-track" style={{ transform: `translateX(${-(cursor + 0.5) * 44}px)` }}>
        <div className="queen-cellar-days">
          {days.map((row, index) => {
            const here = byDay.get(row.date) ?? [];
            return (
              <div key={row.date} className={`queen-cellar-day${row.today ? " is-today" : ""}${index === at ? " is-in-gate" : ""}${row.belowBuffer ? " is-under" : ""}${row.dry ? " is-dry" : ""}`}>
                <div className="queen-cellar-day__seats">
                  {here.map((jar) => (
                    <button key={jar.id} type="button" className={`queen-jar queen-jar--bill queen-jar--${jar.strike}${heldId === jar.id ? " is-held" : ""}${index === at ? " is-in-gate" : ""}`}
                      data-room-vessel={jar.id} data-type={jar.type} aria-current={index === at ? "true" : undefined}
                      aria-label={`${jar.label} — ${jar.type === "house" ? "house bill" : jar.type === "subscription" ? "subscription" : jar.type === "potential" ? "planned, not posted" : jar.type === "appointment" ? "appointment" : "recurring payment"}, ${cellarDayLabel(jar.date)}${jar.paid ? ", paid" : jar.full ? ", full" : ", filling"}${jar.strike === "hammer" ? ". The hammer is out" : jar.strike === "crack" ? ". Cracked: due and not full" : ""}`}
                      onClick={() => onCursor(index)}>
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
