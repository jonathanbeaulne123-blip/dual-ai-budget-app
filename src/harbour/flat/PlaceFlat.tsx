import { useEffect, useState } from "react";
import type { HarbourPlaceId } from "../flag.ts";
import type { BoathouseReading, CellarReadingView, GlasshouseReading, HarbourReading, KilnReading, KitchenReading, TowerReading } from "../data/reading.ts";
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
  if (place === "glasshouse") return <GlasshouseFlat {...props} />;
  if (place === "kitchen") return <KitchenFlat {...props} />;
  if (place === "boathouse") return <BoathouseFlat {...props} />;
  if (place === "library") return <LibraryFlat {...props} />;
  if (place === "kiln") return <KilnFlat {...props} />;
  const { reading, status, theme, partnerName, onOpen, onEnter, overlay } = props;
  return <CourtFlat reading={reading} status={status} theme={theme} partnerName={partnerName} onOpen={onOpen} onEnter={onEnter} overlay={overlay} />;
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
          <strong>{engravedCents(day?.balanceCents ?? cellar?.prepareCents ?? null)}</strong>
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

const BENCH_NAMES = ["This week", "Next week", "The month"] as const;
const potStateWords = (state: "seed" | "sprout" | "bloom") => (state === "seed" ? "a seed" : state === "sprout" ? "a sprout" : "in bloom");
const threadWords = (thread: "mine" | "partner" | "both" | "plain") =>
  thread === "both" ? "both of you" : thread === "mine" ? "yours" : thread === "partner" ? "the partner’s" : "nobody’s yet";

/**
 * The Glasshouse, read as paper: the three benches as three lists, each pot a
 * real button onto the Master Planner, the harvest and the perennials in
 * words, and the Calendar's own door. No figure appears here at all — the
 * planner's paper carries those.
 */
export function GlasshouseFlat({ reading, status = "loading", theme = "classic", onOpen, overlay = false, onStair }: Omit<PlaceFlatProps, "place">) {
  const glasshouse: GlasshouseReading | null = reading?.glasshouse ?? null;
  const benches: [typeof BENCH_NAMES[number], NonNullable<GlasshouseReading["pots"]>][] =
    BENCH_NAMES.map((name, index) => [name, (glasshouse?.pots ?? []).filter((pot) => pot.bench === index)]);
  return <section className={`court-flat place-flat place-flat--glasshouse court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="glasshouse" aria-label="The Glasshouse, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{STATUS_WORDS(status, "The Glasshouse")}</p>
      {onStair && <button type="button" className="place-flat__stair" onClick={onStair}>← Through the garden door to the Court</button>}
      {benches.map(([name, pots]) => <div className="place-flat__bench" key={name}>
        <h3>{name}{pots.length === 0 ? " — a clear bench" : ""}</h3>
        {pots.length > 0 && <ul className="place-flat__pots">
          {pots.map((pot) => <li key={pot.key}>
            <button type="button" onClick={() => onOpen?.("planner", pot.key)}>
              <strong>{pot.title}</strong>
              <span>{potStateWords(pot.state)} · {threadWords(pot.thread)}{pot.dry ? " · dry — the can is out" : ""}{pot.date ? ` · ${pot.date}` : ""}</span>
            </button>
          </li>)}
        </ul>}
      </div>)}
      <p className="place-flat__line">{(glasshouse?.harvested ?? 0) === 0 ? "The harvest shelf — nothing yet this week." : `Harvested — ${glasshouse?.harvested} this week. Nothing is deleted; it is harvested.`}</p>
      {(glasshouse?.perennials.length ?? 0) > 0 && <p className="place-flat__line">The long bed — {glasshouse!.perennials.map((p) => p.title).join(", ")}.</p>}
      {(glasshouse?.overflow ?? 0) > 0 && <p className="place-flat__line">And {glasshouse?.overflow} more on the paper.</p>}
      <div className="place-flat__doors">
        <button type="button" onClick={() => onOpen?.("planner")}>Open the Master Planner</button>
        <button type="button" onClick={() => onOpen?.("calendar")}>Unfold the Calendar</button>
      </div>
    </div>
  </section>;
}

const POT_NAMES = { everyday: "Everyday", prepare: "Prepare", protect: "Protect", build: "Build" } as const;
const whoNames = (who: "both" | "mine" | "partner" | null): string =>
  who === "both" ? "both of you" : who === "mine" ? "yours" : who === "partner" ? "the partner’s" : "unassigned";

/**
 * The Kitchen, read as paper: the cookbook wall as a list of five-line cards,
 * each a real button onto the Plan Studio, and the empty card first.
 */
export function KitchenFlat({ reading, status = "loading", theme = "classic", onOpen, overlay = false, onStair }: Omit<PlaceFlatProps, "place">) {
  const kitchen: KitchenReading | null = reading?.kitchen ?? null;
  return <section className={`court-flat place-flat place-flat--kitchen court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="kitchen" aria-label="The Kitchen, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{STATUS_WORDS(status, "The Kitchen")}</p>
      {onStair && <button type="button" className="place-flat__stair" onClick={onStair}>← Through the kitchen door to the Court</button>}
      <div className="place-flat__doors">
        <button type="button" onClick={() => onOpen?.("plan-studio")}>Sit down — five questions, one card</button>
        <button type="button" onClick={() => onOpen?.("conversation")}>Open the conversation folio</button>
      </div>
      {kitchen && kitchen.waiting && <p className="place-flat__line">A card is on the table until the other of you sits. Not now is a valid answer.</p>}
      <div className="place-flat__bench">
        <h3>The cookbook wall{(kitchen?.cards.length ?? 0) === 0 ? " — bare, an empty card waiting" : ` — ${kitchen?.monthKey}`}</h3>
        {(kitchen?.cards.length ?? 0) > 0 && <ul className="place-flat__pots">
          {kitchen!.cards.map((card) => <li key={card.key}>
            <button type="button" onClick={() => onOpen?.("plan-studio", card.key)}>
              <strong>{card.what}</strong>
              <span>{engravedCents(card.amountCents)}{card.when ? ` · by ${card.when}` : ""} · {POT_NAMES[card.pot] ?? card.pot} · {whoNames(card.who)}</span>
            </button>
          </li>)}
        </ul>}
      </div>
      {(kitchen?.overflow ?? 0) > 0 && <p className="place-flat__line">And {kitchen?.overflow} more in the drawer.</p>}
    </div>
  </section>;
}

/**
 * The Boathouse, read as paper: what the shore rooms hold, in counts and
 * never in contents, every station a real button.
 */
export function BoathouseFlat({ reading, status = "loading", theme = "classic", onOpen, overlay = false, onStair }: Omit<PlaceFlatProps, "place">) {
  const boathouse: BoathouseReading | null = reading?.boathouse ?? null;
  const rows: [string, string, number | null][] = [
    ["wishes", "Tend a wish — ideas in the light", boathouse?.wishes ?? null],
    ["memories", "Open a memory — kept on the shelf", boathouse?.memories ?? null],
    ["projector", "Choose three memories — the sail is up", null],
    ["letters", "Open the writing desk — notes placed", boathouse?.letters ?? null],
    ["pottery", "Enter the Pottery Studio — clay on the bench", null],
    ["encounters", "Spend a moment together — the rowboat seats two", boathouse?.encounters ?? null],
  ];
  return <section className={`court-flat place-flat place-flat--boathouse court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="boathouse" aria-label="The Boathouse, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{STATUS_WORDS(status, "The Boathouse")}</p>
      {onStair && <button type="button" className="place-flat__stair" onClick={onStair}>← Through the shore door to the Court</button>}
      <ul className="place-flat__pots">
        {rows.map(([target, words, count]) => <li key={target}>
          <button type="button" onClick={() => onOpen?.(target)}>
            <strong>{words.split(" — ")[0]}</strong>
            <span>{words.split(" — ")[1]}{count !== null ? ` · ${count === 0 ? "nothing yet" : count}` : ""}</span>
          </button>
        </li>)}
      </ul>
    </div>
  </section>;
}

const glazeWords = (glaze: string) => (glaze === "sea-glass" ? "sea glass" : glaze);
const pieceStepWords = (step: number) => (step <= 0 ? "resting clay" : step >= 10 ? "grown full" : `${step * 10}% of the way`);

/**
 * The Kiln, read as paper: the wheel, the bench and the kiln as real buttons
 * onto the Studio, then the shelf of fired pieces — each piece its bank's
 * name, its glaze and its growth step, and never a figure. Private pieces are
 * one closing line with a count and nothing else.
 */
export function KilnFlat({ reading, status = "loading", theme = "classic", onOpen, overlay = false, onStair }: Omit<PlaceFlatProps, "place">) {
  const kiln: KilnReading | null = reading?.kiln ?? null;
  const heat = kiln === null || kiln.sinceFiring === null ? "cold, nothing fired yet"
    : kiln.sinceFiring === 0 ? "still hot, fired today"
      : kiln.sinceFiring === 1 ? "warm, fired yesterday"
        : `${kiln.warmth > 0 ? "warm" : "cold"}, last fired ${kiln.sinceFiring} days ago`;
  return <section className={`court-flat place-flat place-flat--kiln court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="kiln" aria-label="The Kiln, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{STATUS_WORDS(status, "The Kiln")}</p>
      {onStair && <button type="button" className="place-flat__stair" onClick={onStair}>← Through the kiln door to the Court</button>}
      <div className="place-flat__doors">
        <button type="button" onClick={() => onOpen?.("pottery", "wheel")}>Sit down at the wheel</button>
        <button type="button" onClick={() => onOpen?.("pottery", "paint")}>Take a brush to the workbench</button>
        <button type="button" onClick={() => onOpen?.("pottery", "kiln")}>Open the kiln — {heat}</button>
      </div>
      {(kiln?.onTheWheel ?? 0) > 0 && <p className="place-flat__line">{kiln!.onTheWheel} {kiln!.onTheWheel === 1 ? "piece is" : "pieces are"} still clay, waiting for the kiln.</p>}
      <div className="place-flat__bench">
        <h3>The shelf{(kiln?.pieces.length ?? 0) === 0 ? " — swept and waiting" : ` — ${kiln!.fired} ${kiln!.fired === 1 ? "piece" : "pieces"} fired`}</h3>
        {(kiln?.pieces.length ?? 0) > 0 && <ul className="place-flat__pots">
          {kiln!.pieces.map((piece) => <li key={piece.key}>
            <button type="button" onClick={() => onOpen?.("pottery", piece.key)}>
              <strong>{piece.name}</strong>
              <span>{glazeWords(piece.glaze)} glaze · {pieceStepWords(piece.step)}{piece.firings > 1 ? ` · fired ${piece.firings} times` : ""}{piece.firedOn ? ` · ${piece.firedOn}` : ""}</span>
            </button>
          </li>)}
        </ul>}
      </div>
      {(kiln?.overflow ?? 0) > 0 && <p className="place-flat__line">And {kiln?.overflow} more on the Studio's own shelf.</p>}
      {(kiln?.keptPrivate ?? 0) > 0 && <p className="place-flat__line">{kiln!.keptPrivate} {kiln!.keptPrivate === 1 ? "piece is" : "pieces are"} kept privately — counted here, never shown.</p>}
    </div>
  </section>;
}

/** The Library, read as paper: the Book, the Bindery and the Time Machine, each a real button. */
export function LibraryFlat({ status = "loading", theme = "classic", onOpen, overlay = false, onStair }: Omit<PlaceFlatProps, "place">) {
  return <section className={`court-flat place-flat place-flat--library court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="library" aria-label="The Library, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{STATUS_WORDS(status, "The Library")}</p>
      {onStair && <button type="button" className="place-flat__stair" onClick={onStair}>← Through the hall door to the Court</button>}
      <ul className="place-flat__pots">
        <li><button type="button" onClick={() => onOpen?.("books")}><strong>The Standing Book</strong><span>open on its lectern — every figure has a source</span></button></li>
        <li><button type="button" onClick={() => onOpen?.("books")}><strong>The Bindery</strong><span>five machines, one per divider</span></button></li>
        <li><button type="button" onClick={() => onOpen?.("books")}><strong>The Time Machine</strong><span>thumbing back through the leaves</span></button></li>
      </ul>
    </div>
  </section>;
}
