import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { QueenRibbon } from "../core/queenPresentation.ts";
import { QueenBankFlat } from "./QueenBankFlat.tsx";
import { QueenRoomWorld } from "./QueenRoomWorld.tsx";
import type { RoomVessel } from "./world/queenRoomWorld.ts";
import type { CommitResult, Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { postDueRecurrences } from "../core/commands.ts";
import { projectKittyNest } from "../core/kittyNest.ts";
import { cellarGateWords, cellarReading, type CellarJar } from "../core/queenCellar.ts";
import { ConfirmSheet } from "../Confirm.tsx";
import { QueenCellarRail, cellarDayLabel } from "./QueenCellarRail.tsx";

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
export function QueenCellar({ ribbons, open, stairRef, onExit, onOpenBanks, world = "auto", household, memberId, today, busy = false, onCommand }: {
  ribbons: QueenRibbon[];
  open: boolean;
  stairRef: RefObject<HTMLButtonElement | null>;
  onExit: () => void;
  onOpenBanks: () => void;
  world?: "auto" | "flat" | "3d";
  /** The bill rail: every bill this month as a jar on the rail, the Fund's water behind it, and the hammer. Absent = the month ribbon only. */
  household?: Household;
  memberId?: string;
  today?: DateKey;
  busy?: boolean;
  onCommand?: (fn: (current: Household) => CommitResult) => Promise<unknown>;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  // Bills is the room; a bill's own months are one step in, for the jar in the gate.
  const [view, setView] = useState<"bills" | "months">(household && today ? "bills" : "months");
  const [heldId, setHeldId] = useState<string | null>(null);
  const [striking, setStriking] = useState<CellarJar | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const nest = useMemo(() => household && memberId && today ? projectKittyNest(household, memberId, "household", today) : null, [household, memberId, today]);
  const reading = useMemo(() => {
    if (!household || !nest || !today) return null;
    const held = heldId ? nest.categories.flatMap((c) => c.children).find((bank) => `cellar:${bank.id}` === heldId) : null;
    const heldObligation = held?.designKey.startsWith("recurrence:") && held.date ? `recurrence:${held.designKey.slice("recurrence:".length)}:${held.date}` : null;
    return cellarReading(household, nest, today, heldObligation ? { deferObligationIds: [heldObligation] } : {});
  }, [household, nest, today, heldId]);
  const todayIndex = reading ? Math.max(0, reading.days.findIndex((day) => day.today)) : 0;
  const [billCursor, setBillCursor] = useState(todayIndex);
  useEffect(() => { setBillCursor(todayIndex); }, [todayIndex, reading?.monthKey]);
  const billAt = reading ? Math.max(0, Math.min(reading.days.length - 1, Math.round(billCursor))) : 0;
  const gateDay = reading?.days[billAt] ?? null;
  const gateJars = reading && gateDay ? reading.jars.filter((jar) => jar.date === gateDay.date) : [];
  const gateJar: CellarJar | null = gateJars[0] ?? null;
  const gateRibbon = gateJar?.recurrenceId ? ribbons.find((row) => row.recurrenceId === gateJar.recurrenceId) ?? null : null;
  const ribbon = (view === "months" && gateRibbon) ? gateRibbon : ribbons.find((row) => row.recurrenceId === picked) ?? ribbons[0] ?? null;
  const jars = ribbon?.jars ?? [];
  const nowIndex = Math.max(0, jars.findIndex((jar) => jar.now));
  const [cursor, setCursor] = useState(nowIndex);
  const room = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; from: number; pointerId: number; live: boolean } | null>(null);
  const [live, setLive] = useState(false);

  // The stair is also now: the gate opens on the newest month.
  useEffect(() => { setCursor(Math.max(0, jars.findIndex((jar) => jar.now))); }, [ribbon?.recurrenceId, jars.length]);

  const at = Math.max(0, Math.min(jars.length - 1, Math.round(cursor)));
  const inGate = jars[at] ?? null;

  const vessels = useMemo<RoomVessel[]>(() => {
    const rows: RoomVessel[] = [];
    if (view === "bills" && reading) {
      for (const jar of reading.jars) rows.push({ id: jar.id, kind: "bill", swell: 1, fill: jar.paid ? 0 : jar.fill, hollow: jar.type === "potential" || jar.paid, outlier: false, lifted: heldId === jar.id });
      return rows;
    }
    for (const jar of jars) {
      rows.push({ id: jar.monthKey, kind: "jar", swell: jar.swell, fill: jar.fill, outlier: jar.outlier, hollow: jar.beat !== "posted" });
      if (jar.outlier) rows.push({ id: `${jar.monthKey}:ghost`, kind: "jar", swell: 1, fill: 0, hollow: true });
    }
    return rows;
  }, [jars, view, reading, heldId]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, from: cursor, pointerId: event.pointerId, live: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held || !viewport.current) return;
    const moved = event.clientX - held.x;
    // Across is the ribbon's; up and down are the house's. A drag that leans
    // vertical is a stair, so the ribbon lets go of it rather than scrubbing.
    if (Math.abs(event.clientY - held.y) > Math.abs(moved) * 1.5) { onPointerUp(); return; }
    // A press is a drag only once the finger has moved; the pointer is captured then, so a tap on a jar still reaches the jar.
    if (!held.live) {
      if (Math.abs(moved) < 6) return;
      held.live = true;
      viewport.current.setPointerCapture(held.pointerId);
    }
    const step = viewport.current.clientWidth / 6;
    setCursor(Math.max(0, Math.min(jars.length - 1, held.from - moved / step)));
  };
  const onPointerUp = () => { const held = drag.current; drag.current = null; if (held?.live) setCursor((c) => Math.round(c)); };
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
          {reading && view === "bills"
            ? `${reading.jars.length === 0 ? "No bills on the rail" : reading.jars.length === 1 ? "One bill on the rail" : `${reading.jars.length} bills on the rail`}${reading.walk.dryDate ? " · the cellar runs dry" : reading.walk.belowBufferRuns.length ? " · the water dips under the mark" : ""}`
            : ribbon
            ? `${ribbon.label} · ${ribbon.posted === 0 ? "no months yet" : ribbon.posted === 1 ? "one month" : `${ribbon.posted} months`} on the ribbon${outlierName ? ` · ${outlierName} broke the beat` : ""}`
            : "Nothing recurring is on the ribbon yet."}
        </p>
      </div>
      {reading && (
        <div className="queen-room__picks queen-cellar-views" role="group" aria-label="What the rail shows">
          <button type="button" className="queen-pick" aria-pressed={view === "bills"} onClick={() => setView("bills")}>This month</button>
          <button type="button" className="queen-pick" aria-pressed={view === "months"} disabled={ribbons.length === 0} onClick={() => setView("months")}>{gateRibbon ? `${gateRibbon.label} · months` : "Its months"}</button>
        </div>
      )}
      {reading && view === "bills" && (
        <>
          <QueenCellarRail reading={reading} cursor={billCursor} onCursor={(next) => setBillCursor((current) => typeof next === "function" ? next(current) : next)} heldId={heldId} />
          <div className="queen-scrub">
            <span className="queen-scrub__end">1</span>
            <input type="range" min={0} max={reading.days.length - 1} step={1} value={billAt}
              aria-label="Scrub the month" aria-valuetext={gateDay ? `${cellarDayLabel(gateDay.date)}${gateJar ? `, ${gateJar.label}` : ""}` : ""}
              onChange={(event) => setBillCursor(Number(event.currentTarget.value))} />
            <span className="queen-scrub__end">{reading.days.length}</span>
          </div>
          <p className="queen-room__line" aria-live="polite">
            <em>{gateJar ? (gateJar.strike === "hammer" ? "The hammer is out." : gateJar.strike === "crack" ? "Cracked." : gateJar.paid ? "A shard, kept." : "Filling.") : gateDay?.today ? "Today." : "The rail."}</em> {cellarGateWords(gateJar, gateDay, formatCad)}
            {heldId && gateJar?.id === heldId ? " Lifted out — a rehearsal; nothing is written." : ""}
          </p>
          <div className="queen-room__acts">
            {gateJar?.strike === "hammer" && gateJar.recurrenceId && (
              <button type="button" className="queen-go queen-go--primary queen-hammer" disabled={busy} onClick={() => setStriking(gateJar)}>Break the bank</button>
            )}
            {gateJar?.strike === "crack" && gateJar.recurrenceId && (
              <button type="button" className="queen-go queen-go--primary queen-hammer queen-hammer--crack" disabled={busy} onClick={() => setStriking(gateJar)}>Pay it anyway · from the water</button>
            )}
            {gateJar && !gateJar.paid && gateJar.obligationId && (
              <button type="button" className="queen-go" aria-pressed={heldId === gateJar.id} onClick={() => setHeldId((current) => (current === gateJar.id ? null : gateJar.id))}>
                {heldId === gateJar.id ? "Set it back" : "Lift it out · what if not"}
              </button>
            )}
            {gateJar && !gateJar.recurrenceId && !gateJar.paid && <button type="button" className="queen-go" onClick={onOpenBanks}>Open it in the banks</button>}
          </div>
          {notice && <p className="queen-room__line queen-cellar-notice" role="status">{notice}</p>}
          {striking && onCommand && today && (
            <ConfirmSheet
              title={striking.strike === "crack" ? `Pay ${striking.label} from the cellar's water` : `Break the bank: ${striking.label}`}
              body={`Post ${formatCad(striking.targetCents)} for ${striking.label} in the books, dated ${cellarDayLabel(striking.date)}, its day.${striking.strike === "crack" ? ` Its jar holds ${formatCad(striking.savedCents)}; the rest comes from the Fund's water and the walk shows the buffer take it.` : " Its jar is full; the bank breaks and stays on the rail as a shard."}`}
              extra="Hearth records the payment in your books. It does not move money at your bank."
              confirmLabel={striking.strike === "crack" ? "Pay it anyway" : "Break it"}
              busy={busy}
              onCancel={() => setStriking(null)}
              onConfirm={() => {
                const jar = striking;
                setStriking(null);
                void onCommand((current) => postDueRecurrences(current, today, [jar.recurrenceId!], { createdBy: memberId })).then(
                  () => { setNotice(`${jar.label} paid. The shard stays on the rail.`); setHeldId(null); },
                  (error: unknown) => setNotice(error instanceof Error ? error.message : "That bank could not be broken."),
                );
              }}
            />
          )}
        </>
      )}
      {view === "months" && ribbons.length > 1 && !gateRibbon && (
        <div className="queen-room__picks" role="group" aria-label="Which recurring cost">
          {ribbons.map((row) => (
            <button key={row.recurrenceId} type="button" className="queen-pick" aria-pressed={row.recurrenceId === (ribbon?.recurrenceId ?? null)} onClick={() => setPicked(row.recurrenceId)}>
              {row.label}{row.outlierMonth ? <span className="queen-pick__mark" aria-label=" — broke its beat">·</span> : null}
            </button>
          ))}
        </div>
      )}
      {view === "months" && ribbon && (
        <div ref={viewport} className="queen-gate-view" tabIndex={0} role="group"
          aria-label={`${ribbon.label}, month by month. Drag the ribbon or use the arrow keys; the month in the gate is the one described below.`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onLostPointerCapture={onPointerUp} onKeyDown={onKeyDown}>
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
                    <QueenBankFlat form="jar" className="queen-bank-flat queen-jar__flat" fill={jar.fill} hollow={jar.beat !== "posted"} />
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
      {view === "months" && ribbon && jars.length > 1 && (
        <div className="queen-scrub">
          <span className="queen-scrub__end">{monthName(jars[0]!.monthKey)}</span>
          <input type="range" min={0} max={jars.length - 1} step={1} value={at}
            aria-label="Scrub the ribbon" aria-valuetext={inGate ? `${monthLong(inGate.monthKey)}${inGate.outlier ? ", broke the beat" : ""}` : ""}
            onChange={(event) => setCursor(Number(event.currentTarget.value))} />
          <span className="queen-scrub__end">{monthName(jars[jars.length - 1]!.monthKey)}</span>
        </div>
      )}
      {view === "months" && <p className="queen-room__line" aria-live="polite"><em>Every jar is the same jar.</em> {gateWords}</p>}
      {view === "months" && <button type="button" className="queen-go" onClick={onOpenBanks}>Open Protect in the banks</button>}
    </section>
  );
}
