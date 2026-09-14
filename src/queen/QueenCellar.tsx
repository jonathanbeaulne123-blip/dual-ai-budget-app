import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { QueenRibbon } from "../core/queenPresentation.ts";
import { QueenRoomWorld } from "./QueenRoomWorld.tsx";
import type { RoomVessel } from "./world/queenRoomWorld.ts";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (monthKey: string) => MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1] ?? monthKey;
const monthLong = (monthKey: string) => `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(monthKey.slice(5, 7)) - 1] ?? monthKey} ${monthKey.slice(0, 4)}`;

/**
 * Protect — the cellar, running a ribbon past a lit gate.
 *
 * One axis, and it is time. Nothing is plotted against height: a jar's swell
 * says how much the month took against its usual, its glaze says how far it
 * got, and the month that broke the beat swelled, tilted and **stepped up out
 * of the rail**, leaving a dotted ghost where the beat should have been. The
 * month labels are sprocket holes, not ticks, and no figure is on the ribbon
 * at all — the numbers wait in the banks.
 *
 * The gate is the fixed thing: the ribbon scrubs past it by drag, by the
 * slider or by the arrow keys, and whatever stands in the gate is what the
 * line beneath is about. The page never scrolls. The stair up is the way back
 * and it never moves.
 */
export function QueenCellar({ ribbons, open, stairRef, onExit, onOpenBanks, world = "auto" }: {
  ribbons: QueenRibbon[];
  open: boolean;
  stairRef: RefObject<HTMLButtonElement | null>;
  onExit: () => void;
  onOpenBanks: () => void;
  world?: "auto" | "flat" | "3d";
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const ribbon = ribbons.find((row) => row.recurrenceId === picked) ?? ribbons[0] ?? null;
  const jars = ribbon?.jars ?? [];
  const nowIndex = Math.max(0, jars.findIndex((jar) => jar.now));
  const [cursor, setCursor] = useState(nowIndex);
  const room = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const [live, setLive] = useState(false);

  // The stair is also now: the gate opens on the newest month.
  useEffect(() => { setCursor(Math.max(0, jars.findIndex((jar) => jar.now))); }, [ribbon?.recurrenceId, jars.length]);

  const at = Math.max(0, Math.min(jars.length - 1, Math.round(cursor)));
  const inGate = jars[at] ?? null;

  const vessels = useMemo<RoomVessel[]>(() => {
    const rows: RoomVessel[] = [];
    for (const jar of jars) {
      rows.push({ id: jar.monthKey, kind: "jar", swell: jar.swell, fill: jar.fill, outlier: jar.outlier, hollow: jar.beat !== "posted" });
      if (jar.outlier) rows.push({ id: `${jar.monthKey}:ghost`, kind: "jar", swell: 1, fill: 0, hollow: true });
    }
    return rows;
  }, [jars]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { x: event.clientX, from: cursor };
    viewport.current?.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held || !viewport.current) return;
    const step = viewport.current.clientWidth / 6;
    setCursor(Math.max(0, Math.min(jars.length - 1, held.from - (event.clientX - held.x) / step)));
  };
  const onPointerUp = () => { if (drag.current) { drag.current = null; setCursor((c) => Math.round(c)); } };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setCursor((c) => Math.max(0, Math.min(jars.length - 1, Math.round(c) + (event.key === "ArrowLeft" ? -1 : 1)))); }
    if (event.key === "Home") { event.preventDefault(); setCursor(0); }
    if (event.key === "End") { event.preventDefault(); setCursor(jars.length - 1); }
  };

  const outlierName = ribbon?.outlierMonth ? monthName(ribbon.outlierMonth) : null;
  const gateWords = !inGate ? "Nothing on the ribbon yet."
    : inGate.outlier ? `${monthLong(inGate.monthKey)} broke the beat. It swelled and stepped out of the rail; the number waits in the banks.`
      : inGate.beat === "posted" ? `${monthLong(inGate.monthKey)} kept the beat.`
        : inGate.beat === "expected" ? `${monthLong(inGate.monthKey)} has not landed yet. The hollow jar is last year's shape, not a promise.`
          : `${monthLong(inGate.monthKey)} was quiet. No beat here.`;

  return (
    <section ref={room} className="queen-room queen-room--cellar" aria-label="The cellar — Protect" inert={!open} data-world={live ? "3d" : "flat"}>
      <QueenRoomWorld room="cellar" root={room} vessels={vessels} ambient={open} mode={world} onLive={(isLive) => setLive(isLive)} />
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
        <div ref={viewport} className="queen-gate-view" tabIndex={0} role="group"
          aria-label={`${ribbon.label}, month by month. Drag the ribbon or use the arrow keys; the month in the gate is the one described below.`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
          <div className="queen-gate" aria-hidden="true"><span className="queen-gate__tab" /></div>
          <div className="queen-ribbon-track" style={{ transform: `translateX(calc(50% - ${(cursor + 0.5) * 100}px))` }}>
            <div className="queen-sprockets" aria-hidden="true">
              {jars.map((jar) => <i key={jar.monthKey} className={jar.now ? "is-now" : undefined} />)}
            </div>
            <div className="queen-ribbon">
              {jars.map((jar, index) => (
                <div key={jar.monthKey} className="queen-jar-seat">
                  {jar.outlier && <span className="queen-jar-ghost" data-room-vessel={`${jar.monthKey}:ghost`} aria-hidden="true" />}
                  <button type="button" data-room-vessel={jar.monthKey}
                    className={`queen-jar queen-jar--${jar.beat}${jar.outlier ? " is-outlier" : ""}${jar.now ? " is-now" : ""}${index === at ? " is-in-gate" : ""}`}
                    aria-current={index === at ? "true" : undefined}
                    onClick={() => setCursor(index)}
                    aria-label={`${monthLong(jar.monthKey)}${jar.outlier ? " — swelled and stepped out of the rail; the month that broke the beat" : jar.beat === "posted" ? " — the usual beat" : jar.beat === "expected" ? " — the next beat, still ahead" : " — quiet"}${jar.now ? ", now" : ""}`}>
                    <svg viewBox="0 0 36 52" aria-hidden="true">
                      <path className="queen-vessel" d="M4 50 C0 26 4 8 18 8 C32 8 36 26 32 50 Z" />
                      <ellipse className="queen-jar__mouth" cx="18" cy="8" rx="9" ry="2.8" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="queen-months" aria-hidden="true">
              {jars.map((jar) => <span key={jar.monthKey} className={jar.now ? "is-now" : undefined}>{monthName(jar.monthKey)}</span>)}
            </div>
          </div>
        </div>
      )}
      {ribbon && jars.length > 1 && (
        <div className="queen-scrub">
          <span className="queen-scrub__end">{monthName(jars[0]!.monthKey)}</span>
          <input type="range" min={0} max={jars.length - 1} step={1} value={at}
            aria-label="Scrub the ribbon" aria-valuetext={inGate ? `${monthLong(inGate.monthKey)}${inGate.outlier ? ", broke the beat" : ""}` : ""}
            onChange={(event) => setCursor(Number(event.currentTarget.value))} />
          <span className="queen-scrub__end">{monthName(jars[jars.length - 1]!.monthKey)}</span>
        </div>
      )}
      <p className="queen-room__line" aria-live="polite"><em>Every jar is the same jar.</em> {gateWords}</p>
      <button type="button" className="queen-go" onClick={onOpenBanks}>Open Protect in the banks</button>
    </section>
  );
}
