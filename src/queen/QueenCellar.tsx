import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { QueenRibbon } from "../core/queenPresentation.ts";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthName(monthKey: string): string {
  return MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1] ?? monthKey;
}

/**
 * Protect — the cellar, running a ribbon. Recurring costs as a row of
 * near-identical vessels on a rail, one per month. The outlier swelled,
 * tilted, stepped up out of the rail and left a dotted ghost where the beat
 * should have been: an outlier read with no number attached. The ribbon
 * scrubs sideways inside its own rail; the page never scrolls. The stair up
 * is the way back and it never moves.
 */
export function QueenCellar({ ribbons, open, stairRef, onExit, onOpenBanks }: {
  ribbons: QueenRibbon[];
  open: boolean;
  stairRef: RefObject<HTMLButtonElement | null>;
  onExit: () => void;
  onOpenBanks: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const ribbon = ribbons.find((row) => row.recurrenceId === picked) ?? ribbons[0] ?? null;
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);

  useEffect(() => {
    // The stair is also now: open on the newest month.
    if (open && rail.current) rail.current.scrollLeft = rail.current.scrollWidth;
  }, [open, ribbon?.recurrenceId]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = rail.current;
    if (!element) return;
    drag.current = { x: event.clientX, left: element.scrollLeft };
    element.classList.add("is-dragging");
    element.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !rail.current) return;
    rail.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
  };
  const onPointerUp = () => { drag.current = null; rail.current?.classList.remove("is-dragging"); };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const element = rail.current;
    if (!element) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); element.scrollBy({ left: event.key === "ArrowLeft" ? -96 : 96 }); }
    if (event.key === "Home") { event.preventDefault(); element.scrollLeft = 0; }
    if (event.key === "End") { event.preventDefault(); element.scrollLeft = element.scrollWidth; }
  };

  const outlierName = ribbon?.outlierMonth ? monthName(ribbon.outlierMonth) : null;
  return (
    <section className="queen-room queen-room--cellar" aria-label="The cellar — Protect" inert={!open}>
      <button ref={stairRef} type="button" className="queen-stair queen-stair--up" onClick={onExit} aria-label="Up to now — back to her">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12l5-5 5 5" /><path d="M10 7v10" /></svg>
        <span>Up to now</span>
      </button>
      <div className="queen-room__head">
        <p className="queen-room__title">The cellar</p>
        <p className="queen-room__sub">
          {ribbon
            ? `${ribbon.label} · ${ribbon.posted === 0 ? "no months yet" : ribbon.posted === 1 ? "one month" : `${ribbon.posted} months`} on the ribbon${outlierName ? ` · ${outlierName} broke the beat` : ""}`
            : "Nothing recurring is on the ribbon yet."}
        </p>
      </div>
      {ribbons.length > 1 && (
        <div className="queen-room__picks" role="group" aria-label="Which recurring cost">
          {ribbons.map((row) => (
            <button key={row.recurrenceId} type="button" className="queen-pick" aria-pressed={row.recurrenceId === (ribbon?.recurrenceId ?? null)} onClick={() => setPicked(row.recurrenceId)}>
              {row.label}{row.outlierMonth ? <span className="queen-pick__mark" aria-label=" — broke its beat">·</span> : null}
            </button>
          ))}
        </div>
      )}
      {ribbon && (
        <div ref={rail} className="queen-rail" tabIndex={0} role="group" aria-label={`${ribbon.label}, month by month. Scroll sideways to read the ribbon.`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
          <div className="queen-ribbon">
            {ribbon.jars.map((jar) => (
              <div key={jar.monthKey} className="queen-jar-seat">
                <div className={`queen-jar queen-jar--${jar.beat}${jar.outlier ? " is-outlier" : ""}${jar.now ? " is-now" : ""}`} role="img"
                  aria-label={`${monthName(jar.monthKey)}${jar.outlier ? " — swelled and stepped out of the rail; the outlier" : jar.beat === "posted" ? " — the usual beat" : jar.beat === "expected" ? " — the next beat, still ahead" : " — quiet"}${jar.now ? ", now" : ""}`}>
                  <svg viewBox="0 0 36 52" aria-hidden="true">
                    <path className="queen-vessel" d="M4 50 C0 26 4 8 18 8 C32 8 36 26 32 50 Z" />
                    <ellipse className="queen-jar__mouth" cx="18" cy="8" rx="9" ry="2.8" />
                  </svg>
                  <span className="queen-jar__month">{monthName(jar.monthKey)}{jar.now ? " · now" : ""}</span>
                </div>
                {jar.outlier && (
                  <div className="queen-jar queen-jar--ghost" role="img" aria-label={`where the usual ${monthName(jar.monthKey)} would have sat`}>
                    <svg viewBox="0 0 36 52" aria-hidden="true"><path className="queen-vessel" d="M4 50 C0 26 4 8 18 8 C32 8 36 26 32 50 Z" /></svg>
                    <span className="queen-jar__month">usual</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="queen-room__line"><em>Every jar is the same jar.</em> The one out of the rail is the month that broke the beat; the number waits in the banks.</p>
      <button type="button" className="queen-go" onClick={onOpenBanks}>Open Protect in the banks</button>
    </section>
  );
}
