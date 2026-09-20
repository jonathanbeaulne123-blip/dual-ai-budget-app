import { useEffect, useState } from "react";
import type { HarbourPlaceId } from "../flag.ts";
import type { CellarReadingView, HarbourReading, TowerReading } from "../data/reading.ts";
import { CourtFlat, engravedCents, type CourtFlatProps, type CourtFlatStatus } from "./CourtFlat.tsx";
import "../harbour.css";

/**
 * The reading edition of the two new places (BUILD_PLAN_SLICE2 §5, §6). The
 * Court keeps `CourtFlat` exactly as slice 1 left it; the tower and the cellar
 * get their own, in the same language: one SVG of the place, the numbers as
 * HTML, and **every door a real button**. Nothing here posts money — a door
 * opens the surface that already owns it (`QueenLoft`, `QueenCellar`).
 *
 * `motion: flat` must never gate a money task, so the jug, the gun, each bank
 * and each jar are reachable here with a keyboard and a screen reader, and the
 * day scrub is an ordinary range input.
 */

export type PlaceFlatProps = Omit<CourtFlatProps, "reading"> & {
  place: HarbourPlaceId;
  reading: HarbourReading | null;
  /** The day the rail is scrubbed to; the cellar reads it back through `onScrub`. */
  scrub?: number;
  onScrub?: (index: number) => void;
  /** The stair: back to the Court. */
  onStair?: () => void;
};

/** The place's flat edition. The Court's is slice 1's, unchanged. */
export function HarbourFlat({ place, ...props }: PlaceFlatProps) {
  if (place === "tower") return <TowerFlat {...props} />;
  if (place === "cellar") return <CellarFlat {...props} />;
  const { reading, status, theme, partnerName, onOpen, overlay } = props;
  return <CourtFlat reading={reading} status={status} theme={theme} partnerName={partnerName} onOpen={onOpen} overlay={overlay} />;
}

const STATUS_WORDS = (status: CourtFlatStatus, place: string) =>
  status === "loading" ? `${place} is being built` : status === "fallback" ? `Reading edition · ${place} could not be drawn` : "Reading edition";

const bankCount = (n: number) => `${n} ${n === 1 ? "bank" : "banks"}`;
const stepWords = (step: number) => (step <= 0 ? "empty" : step >= 10 ? "full" : `${step * 10}% of the way`);

/**
 * The Tower, read: the rack's shelves top to bottom, the banks standing on
 * each with their fill step, and the landing's jug and money gun — both only
 * when the person holds the Fund; otherwise the stand is empty and the line
 * says who holds it.
 */
export function TowerFlat({ reading, status = "loading", theme = "classic", onOpen, overlay = false, onStair }: Omit<PlaceFlatProps, "place">) {
  const tower: TowerReading | null = reading?.tower ?? null;
  const shelves = tower?.shelves ?? [];
  const banks = shelves.flatMap((shelf) => shelf.banks);
  return <section className={`court-flat place-flat place-flat--tower court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="tower" aria-label="The Rook's Tower, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{STATUS_WORDS(status, "The Tower")}</p>
      {onStair && <button type="button" className="place-flat__stair" onClick={onStair}>← Down the stair to the Court</button>}
      <div className="place-flat__landing">
        <button type="button" className="court-flat__plate" onClick={() => onOpen?.("loft-banks", "pour")} disabled={!tower?.jug.custodian}
          aria-label={tower?.jug.custodian ? `The jug. ${engravedCents(tower.jug.safeCents)} of safe surplus to pour. Open the Loft at the pour.` : `The jug's stand is empty. ${tower?.jug.holder ?? "The custodian"} holds the jug.`}>
          <small>The jug · the landing</small>
          <strong>{tower?.jug.custodian ? engravedCents(tower.jug.safeCents) : "—"}</strong>
          <span>{tower?.jug.custodian ? "Pour it over the rack" : `${tower?.jug.holder ?? "The custodian"} holds the jug`}</span>
        </button>
        <button type="button" className="court-flat__plate" onClick={() => onOpen?.("loft-banks", "gun")} disabled={!tower?.gun.available}
          aria-label={tower?.gun.available ? "The money gun on its peg. Open the Loft at the gun." : "The money gun's peg is empty; only the custodian may take it down."}>
          <small>The money gun · the peg</small>
          <strong>{tower?.gun.available ? "On its peg" : "—"}</strong>
          <span>{tower?.gun.available ? "Take it down in the Loft" : "The custodian's to take down"}</span>
        </button>
      </div>
      {shelves.length === 0
        ? <p className="place-flat__empty">Nothing on the shelf yet. The tower is swept and waiting.</p>
        : <ol className="place-flat__shelves" aria-label="The rack">
          {shelves.map((shelf, index) => <li key={shelf.id}>
            <p className="place-flat__shelf-mark">Shelf {index + 1} · weight {shelf.share} of the rack · {shelf.full ? "at its mark" : `pin at ${Math.round((shelf.cutoff / 20) * 100)}%`} · {bankCount(shelf.banks.length)}</p>
            <ul className="place-flat__banks">
              {shelf.banks.map((bank) => <li key={bank.key}>
                <button type="button" className="court-flat__plate" onClick={() => onOpen?.("loft-banks", `bank/plan:${bank.key}`)}
                  aria-label={`${bank.name}, ${engravedCents(bank.cents)} of ${engravedCents(bank.targetCents)}, ${stepWords(bank.step)}. Open the Loft at this bank.`}>
                  <small>{bank.name}</small>
                  <strong>{engravedCents(bank.cents)}</strong>
                  <span>{bank.targetCents > 0 ? `of ${engravedCents(bank.targetCents)} · ${stepWords(bank.step)}` : stepWords(bank.step)}</span>
                </button>
              </li>)}
              {shelf.banks.length === 0 && <li><p className="place-flat__empty">A bare shelf.</p></li>}
            </ul>
          </li>)}
        </ol>}
      {banks.length > 0 && <p className="court-flat__condition">{bankCount(banks.length)} on the rack. Nothing on this page moves money.</p>}
    </div>
  </section>;
}

const JAR_WORDS: Record<CellarReadingView["jars"][number]["state"], string> = {
  planned: "planned", "set-aside": "set aside", paid: "paid", short: "short",
};

/**
 * The Cellar, read: the jars on the rail with their state in words, the
 * Prepare water behind them on the same dollar scale, and the rail's day as a
 * range input — scrubbing is a reading, so nothing here is written.
 */
export function CellarFlat({ reading, status = "loading", theme = "classic", onOpen, overlay = false, onStair, scrub, onScrub }: Omit<PlaceFlatProps, "place">) {
  const cellar: CellarReadingView | null = reading?.cellar ?? null;
  const days = cellar?.days ?? [];
  const [local, setLocal] = useState(cellar?.todayIndex ?? 0);
  const index = scrub ?? local;
  useEffect(() => { if (scrub === undefined && cellar) setLocal(cellar.todayIndex); }, [cellar, scrub]);
  const day = days[Math.max(0, Math.min(days.length - 1, index))] ?? null;
  const move = (next: number) => { setLocal(next); onScrub?.(next); };
  return <section className={`court-flat place-flat place-flat--cellar court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="cellar" aria-label="The Cellar, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{STATUS_WORDS(status, "The Cellar")}</p>
      {onStair && <button type="button" className="place-flat__stair" onClick={onStair}>← Up the stair to the Court</button>}
      <div className="place-flat__water">
        <p className="place-flat__waterline">
          <small>The water · Prepare behind the rail</small>
          <strong>{engravedCents(cellar?.prepareCents ?? null)}</strong>
          <span>{day ? `On ${day.date} the water stands at ${engravedCents(day.balanceCents)}${day.belowBuffer ? " — under the mark" : ""}${day.today ? " · today" : ""}` : "No days walked yet"}</span>
        </p>
        {days.length > 0 && <>
          <label className="place-flat__scrub-label" htmlFor="harbour-cellar-scrub">Walk the rail through the month</label>
          <input id="harbour-cellar-scrub" className="place-flat__scrub" type="range" min={0} max={days.length - 1} step={1} value={Math.max(0, Math.min(days.length - 1, index))}
            onChange={event => move(Number(event.currentTarget.value))}
            aria-valuetext={day ? `${day.date}, water ${engravedCents(day.balanceCents)}` : undefined} />
          <button type="button" className="place-flat__today" onClick={() => move(cellar?.todayIndex ?? 0)} disabled={index === (cellar?.todayIndex ?? 0)}>Back to today</button>
        </>}
      </div>
      {(cellar?.jars.length ?? 0) === 0
        ? <p className="place-flat__empty">No bills on the rail yet. The rail is dry and the water sits at the floor.</p>
        : <ul className="place-flat__jars" aria-label="The rail">
          {cellar!.jars.map((jar) => <li key={jar.key}>
            <button type="button" className="court-flat__plate" data-jar-state={jar.state} onClick={() => onOpen?.("cellar-bills", `jar/${jar.key}`)}
              aria-label={`${jar.label}, ${engravedCents(jar.amountCents)}, ${JAR_WORDS[jar.state]}${jar.due ? `, due ${jar.due}` : ""}${jar.missingMark ? ", and its last payment is missing" : ""}. Open the Cellar at this jar.`}>
              <small>{jar.label}{jar.missingMark ? " · missing a payment" : ""}</small>
              <strong>{engravedCents(jar.amountCents)}</strong>
              <span>{JAR_WORDS[jar.state]}{jar.due ? ` · ${jar.due}` : ""}</span>
            </button>
          </li>)}
        </ul>}
      {cellar && cellar.scaleCents > 0 && <p className="court-flat__condition">The jars and the water are drawn on one scale, up to {engravedCents(cellar.scaleCents)}.</p>}
    </div>
  </section>;
}
