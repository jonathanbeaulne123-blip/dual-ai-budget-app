import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { useOutsideClose } from "../useOutsideClose.ts";
import type { QueenRibbon } from "../core/queenPresentation.ts";
import { QueenBankFlat } from "./QueenBankFlat.tsx";
import { QueenRoomWorld } from "./QueenRoomWorld.tsx";
import type { RoomVessel } from "./world/queenRoomWorld.ts";
import { umbrellaBankKey } from "./world/bankModels.ts";
import type { CommitResult, Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { postDueRecurrences } from "../core/commands.ts";
import { projectKittyNest } from "../core/kittyNest.ts";
import { cellarGateWords, cellarJarFacts, cellarReading, type CellarJar } from "../core/queenCellar.ts";
import { ConfirmSheet } from "../Confirm.tsx";
import { CellarZoomPane, QueenCellarRail, cellarBankForm, cellarDayLabel, cellarPurposeWords } from "./QueenCellarRail.tsx";
import { readCellarZoom, storeCellarZoom } from "./cellarZoom.ts";
import type { CellarHue } from "../core/queenCellar.ts";
// Cellar v3 (D-279/D-280): income glass, contribution banks and missing subscriptions.
import { CellarIncomeCard, CellarMissingCard, cellarPostedOk, incomeNoteWords, showMyPay, useCellarExtras } from "./QueenCellarExtras.tsx";

/** The category groups' clays for the sculptures; the flat twin reads the same six from `--queen-hue-*` in queen-cellar.css. */
export const CELLAR_HUE_HEX: Record<Exclude<CellarHue, "clay">, string> = { housing: "#c4794f", food: "#8f9a5a", transport: "#6f8fa6", life: "#b76b8a", health: "#6fa391", debt: "#7a7470" };

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
  // The jar that was picked: its card opens over the rail with everything it has to say for itself.
  const [openJarId, setOpenJarId] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The size of the banks on the rail: remembered on this device, never synced.
  const [zoom, setZoom] = useState(() => readCellarZoom(typeof localStorage === "undefined" ? null : localStorage));
  const onZoom = (next: number) => { setZoom(next); storeCellarZoom(next, typeof localStorage === "undefined" ? null : localStorage); };
  const nest = useMemo(() => household && memberId && today ? projectKittyNest(household, memberId, "household", today) : null, [household, memberId, today]);
  const reading = useMemo(() => {
    if (!household || !nest || !today) return null;
    const held = heldId ? nest.categories.flatMap((c) => c.children).find((bank) => `cellar:${bank.id}` === heldId) : null;
    const heldObligation = held?.designKey.startsWith("recurrence:") && held.date ? `recurrence:${held.designKey.slice("recurrence:".length)}:${held.date}` : null;
    return cellarReading(household, nest, today, heldObligation ? { deferObligationIds: [heldObligation] } : {});
  }, [household, nest, today, heldId]);
  const cellar3 = useCellarExtras({ household, memberId, today, days: reading?.days, open, onCommand });
  // A subscription marked missing stands as its own jar; its ordinary overdue jar steps aside for it.
  const railReading = useMemo(() => {
    if (!reading || !cellar3.missing?.open.length) return reading;
    const marked = new Set(cellar3.missing.open.map((entry) => entry.id));
    return { ...reading, jars: reading.jars.filter((jar) => !(jar.recurrenceId && marked.has(`missing:${jar.recurrenceId}:${jar.date}`))) };
  }, [reading, cellar3.missing]);
  const openExtra = openJarId ? cellar3.extras.find((row) => row.id === openJarId) ?? null : null;
  const openMissing = openExtra && cellar3.missing ? cellar3.missing.open.find((row) => row.id === openExtra.id) ?? null : null;
  const openIncome = openExtra && cellar3.income ? cellar3.income.jars.find((row) => row.id === openExtra.id) ?? null : null;
  const payNote = incomeNoteWords(cellar3.income);
  const todayIndex = reading ? Math.max(0, reading.days.findIndex((day) => day.today)) : 0;
  const [billCursor, setBillCursor] = useState(todayIndex);
  useEffect(() => { setBillCursor(todayIndex); }, [todayIndex, reading?.monthKey]);
  const billAt = reading ? Math.max(0, Math.min(reading.days.length - 1, Math.round(billCursor))) : 0;
  const gateDay = reading?.days[billAt] ?? null;
  const gateJars = railReading && gateDay ? railReading.jars.filter((jar) => jar.date === gateDay.date) : [];
  const gateJar: CellarJar | null = gateJars[0] ?? null;
  const gateExtras = gateDay ? cellar3.extras.filter((row) => row.date === gateDay.date) : [];
  const openJar: CellarJar | null = openJarId && railReading ? railReading.jars.find((jar) => jar.id === openJarId) ?? null : null;
  const gateRibbon = gateJar?.recurrenceId ? ribbons.find((row) => row.recurrenceId === gateJar.recurrenceId) ?? null : null;
  const ribbon = (view === "months" && gateRibbon) ? gateRibbon : ribbons.find((row) => row.recurrenceId === picked) ?? ribbons[0] ?? null;
  const jars = ribbon?.jars ?? [];
  const nowIndex = Math.max(0, jars.findIndex((jar) => jar.now));
  const [cursor, setCursor] = useState(nowIndex);
  const room = useRef<HTMLDivElement>(null);
  const closeCard = () => {
    const id = openJarId;
    setOpenJarId(null);
    if (id) requestAnimationFrame(() => {
      const jar = [...(room.current?.querySelectorAll<HTMLButtonElement>(".queen-jar--bill[data-room-vessel], .queen-jar--extra[data-cellar-extra]") ?? [])].find((el) => (el.dataset.roomVessel ?? el.dataset.cellarExtra) === id);
      jar?.focus();
    });
  };
  useEffect(() => { if (openJarId) card.current?.focus(); }, [openJarId]);
  // A tap off the card puts it away; pressing a jar still toggles it, and the acts beneath still act on it.
  useOutsideClose([card], Boolean(openJarId) && !striking, () => setOpenJarId(null), { keep: ".queen-jar, .queen-room__acts, .queen-scrub, [role=dialog]" });
  useEffect(() => { if (view !== "bills") setOpenJarId(null); }, [view]);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; from: number; pointerId: number; live: boolean } | null>(null);
  const [live, setLive] = useState(false);

  // The stair is also now: the gate opens on the newest month.
  useEffect(() => { setCursor(Math.max(0, jars.findIndex((jar) => jar.now))); }, [ribbon?.recurrenceId, jars.length]);

  const at = Math.max(0, Math.min(jars.length - 1, Math.round(cursor)));
  const inGate = jars[at] ?? null;

  const vessels = useMemo<RoomVessel[]>(() => {
    const rows: RoomVessel[] = [];
    if (view === "bills" && railReading) {
      for (const jar of railReading.jars) {
        const frosted = jar.type === "potential" && !jar.paid;
        // A sorted bill stands as its umbrella's bank (2026-09-16); a planned one is that bank in frosted glass.
        const modelKey = umbrellaBankKey(jar.umbrellaId);
        rows.push({ id: jar.id, kind: "bill", form: cellarBankForm(jar.type), tint: jar.umbrellaHue ?? (jar.hue === "clay" ? undefined : CELLAR_HUE_HEX[jar.hue]), finish: jar.finish, swell: 1, fill: jar.paid ? 1 : jar.fill, hollow: false, frosted, outlier: false, lifted: heldId === jar.id, ...(modelKey ? { model: { key: modelKey, glass: frosted } } : {}) });
      }
      // The pay jars stand as the partner's Work bank: Clink or Poise, frosted until pay day.
      for (const extra of cellar3.extras) {
        if (!extra.model) continue;
        rows.push({ id: extra.id, kind: "goal", swell: 1, fill: extra.fill ?? 0, model: { key: `pay:${extra.model}`, glass: extra.kind === "income" } });
      }
      return rows;
    }
    for (const jar of jars) {
      rows.push({ id: jar.monthKey, kind: "jar", swell: jar.swell, fill: jar.fill, outlier: jar.outlier, hollow: jar.beat !== "posted" });
      if (jar.outlier) rows.push({ id: `${jar.monthKey}:ghost`, kind: "jar", swell: 1, fill: 0, hollow: true });
    }
    return rows;
  }, [jars, view, railReading, heldId, cellar3.extras]);

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
            ? `${railReading!.jars.length === 0 ? "No kitty jars on the rail" : railReading!.jars.length === 1 ? "One kitty jar on the rail" : `${railReading!.jars.length} kitty jars on the rail`}${cellar3.extras.some((row) => row.kind === "income") ? ` · ${cellar3.extras.filter((row) => row.kind === "income").length} of pay, in glass` : ""}${cellar3.missing?.open.length ? ` · ${cellar3.missing.open.length} missing` : ""}${reading.walk.dryDate ? " · the cellar runs dry" : reading.walk.belowBufferRuns.length ? " · the water dips under the mark" : ""}`
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
          <QueenCellarRail reading={railReading!} extras={cellar3.extras} onPickExtra={(extra) => setOpenJarId((current) => (current === extra.id ? null : extra.id))} cursor={billCursor} onCursor={(next) => setBillCursor((current) => typeof next === "function" ? next(current) : next)} heldId={heldId} zoom={zoom} onZoom={onZoom}
            openId={openJarId} onPick={(jar) => setOpenJarId((current) => (current === jar.id ? null : jar.id))} />
          <div className="queen-scrub">
            <span className="queen-scrub__end">1</span>
            <input type="range" min={0} max={reading.days.length - 1} step={1} value={billAt}
              aria-label="Scrub the month" aria-valuetext={gateDay ? `${cellarDayLabel(gateDay.date)}${gateJar ? `, ${gateJar.label}` : ""}` : ""}
              onChange={(event) => setBillCursor(Number(event.currentTarget.value))} />
            <span className="queen-scrub__end">{reading.days.length}</span>
            <CellarZoomPane zoom={zoom} onZoom={onZoom} />
          </div>
          {openJar && household && (
            <section ref={card} className="queen-jar-card" aria-label={`${openJar.label} — the kitty jar's card`} tabIndex={-1}
              onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); closeCard(); } }}>
              <header className="queen-jar-card__head">
                <p className="queen-jar-card__kicker">{cellarPurposeWords(openJar.type)}</p>
                <h3 className="queen-jar-card__title">{openJar.label}</h3>
                <button type="button" className="queen-jar-card__close" aria-label="Close the card" onClick={closeCard}>×</button>
              </header>
              <p className="queen-room__line queen-jar-card__line" aria-live="polite">
                <em>{openJar.strike === "hammer" ? "The hammer is out." : openJar.strike === "crack" ? "Cracked." : openJar.paid ? "A shard, kept." : "Filling."}</em> {cellarGateWords(openJar, reading.days.find((row) => row.date === openJar.date) ?? null, formatCad)}
                {heldId === openJar.id ? " Lifted out — a rehearsal; nothing is written." : ""}
              </p>
              <dl className="queen-jar-card__facts">
                {cellarJarFacts(openJar, reading.days.find((row) => row.date === openJar.date) ?? null, household, formatCad).map((fact) => (
                  <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
                ))}
              </dl>
              <div className="queen-jar-card__more">
                {openJar.recurrenceId && ribbons.some((row) => row.recurrenceId === openJar.recurrenceId) && (
                  <button type="button" className="queen-go" onClick={() => { setPicked(openJar.recurrenceId); setView("months"); }}>Its months</button>
                )}
                {(!openJar.recurrenceId || openJar.type === "potential") && <button type="button" className="queen-go" onClick={onOpenBanks}>Open it in the banks</button>}
              </div>
            </section>
          )}
          {openMissing && household && memberId && today && (
            <CellarMissingCard key={openMissing.id} entry={openMissing} household={household} memberId={memberId} today={today} busy={busy} onCommand={onCommand}
              custodianId={cellar3.missing?.custodianMemberId ?? null} cardRef={card} onClose={closeCard} />
          )}
          {openIncome && memberId && (
            <CellarIncomeCard key={openIncome.id} jar={openIncome} ownPay={cellar3.ownPay} onToggleOwnPay={cellar3.toggleOwnPay} busy={busy} onCommand={onCommand} memberId={memberId} cardRef={card} onClose={closeCard} />
          )}
          {!openJar && !openExtra && <p className="queen-room__line" aria-live="polite">
            <em>{gateJar ? (gateJar.strike === "hammer" ? "The hammer is out." : gateJar.strike === "crack" ? "Cracked." : gateJar.paid ? "A shard, kept." : "Filling.") : gateExtras.length ? (gateExtras[0]!.kind === "income" ? "If." : gateExtras[0]!.kind === "contribution" ? "Contributed." : "A little windfall.") : gateDay?.today ? "Today." : "The rail."}</em> {!gateJar && gateExtras.length ? `${gateExtras.map((row) => row.label).join(" · ")}. Pick it to read it.` : cellarGateWords(gateJar, gateDay, formatCad)}
            {heldId && gateJar?.id === heldId ? " Lifted out — a rehearsal; nothing is written." : ""}
            {!gateJar && payNote ? ` ${payNote}` : ""}
            {!gateJar && !gateExtras.length && reading.jars.length > 0 ? " A kitty jar's shape and what it wears are what it is for, its colour where it is filed, its size how large the due is, its glaze how much is in it; pick one to read it." : ""}
          </p>}
          <div className="queen-room__acts">
            {gateJar?.strike === "hammer" && gateJar.recurrenceId && (
              <button type="button" className="queen-go queen-go--primary queen-hammer" disabled={busy} onClick={() => setStriking(gateJar)}>Break the kitty jar</button>
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
            {!gateJar && !openExtra && cellar3.myPayHidden && onCommand && memberId && (
              <button type="button" className="queen-go" disabled={busy} onClick={() => { void showMyPay(onCommand, memberId).then((result) => setNotice(cellarPostedOk(result) ? "Your pay is back in the jars, in glass." : "That could not be saved."), () => setNotice("That could not be saved.")); }}>Show my pay in the jars</button>
            )}
          </div>
          {notice && <p className="queen-room__line queen-cellar-notice" role="status">{notice}</p>}
          {striking && onCommand && today && (
            <ConfirmSheet
              title={striking.strike === "crack" ? `Pay ${striking.label} from the cellar's water` : `Break the kitty jar: ${striking.label}`}
              body={`Post ${formatCad(striking.targetCents)} for ${striking.label} in the books, dated ${cellarDayLabel(striking.date)}, its day.${striking.strike === "crack" ? ` Its jar holds ${(striking.savedCents === null ? "unavailable backing" : formatCad(striking.savedCents))}; the rest comes from the Fund's water and the walk shows the buffer take it.` : " Its jar is full; the bank breaks and stays on the rail as a shard."}`}
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
