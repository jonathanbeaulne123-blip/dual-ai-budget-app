import { useId, useMemo } from "react";
import { PlateFigureView } from "../../DeskPlates.tsx";
import type { DeskPlateModel } from "../../core/deskPlates.ts";
import { engravedCents } from "./engraved.ts";
import { PERSONAL_LEVEL_PLATE, PERSONAL_SEAL_WORDS, personalPlateDoor, readPersonalToday } from "./personalModel.ts";
import { readHercules } from "./todayModel.ts";
import type { DeskPageProps } from "./types.ts";

/**
 * Today, in personal scope (SIMPLE_VIEW_DESK S5): the Desk's front page for
 * one person's folio. The six personal plates the Office reads (Am I on the
 * clock · What a shift is worth · When money lands next · My cash against my
 * cards · the personal bank · How my month is running), drawn by the Office's
 * own `PlateFigureView`, each a paper card that opens the surface it reads;
 * the month's three seals over the personal-scope month ("Personal income
 * this month"); the month plate's running-net spark in the Level's slot —
 * there is no personal Fund walk — and Hercules's corner.
 *
 * Every figure is a selector's figure. Nothing on this page moves money: the
 * + in the bar below is still how money is added.
 */
export function DeskPersonalToday({ household, memberId, today, onOpen, onTalk }: DeskPageProps) {
  const read = useMemo(() => readPersonalToday(household, memberId, today), [household, memberId, today]);
  const hercules = useMemo(() => readHercules(household, memberId, "personal", today), [household, memberId, today]);
  const ids = useId();
  const level = read.plates.find(plate => plate.id === PERSONAL_LEVEL_PLATE) ?? null;
  const cards = read.plates.filter(plate => plate.id !== PERSONAL_LEVEL_PLATE);
  const seals = read.seals;
  const leftover = seals?.leftoverCents ?? null;
  return <div className="desk-today desk-today--personal" data-desk-scope="personal">
    <section className="desk-card desk-seals desk-seals--personal" aria-labelledby={`${ids}-seals`} data-desk-personal-seals="">
      <h2 className="desk-card__kicker" id={`${ids}-seals`}>{read.monthLabel} so far · posted · my folio</h2>
      <ul className="desk-seals__row">
        <Seal id="in" words={PERSONAL_SEAL_WORDS.in} cents={seals?.inCents ?? null} />
        <Seal id="out" words={PERSONAL_SEAL_WORDS.out} cents={seals?.outCents ?? null} />
        <Seal id="leftover" words={PERSONAL_SEAL_WORDS.leftover} cents={leftover} cracked={leftover !== null && leftover < 0} />
      </ul>
    </section>

    {cards.length > 0
      ? <ul className="desk-plates" aria-label="My instruments">
        {cards.map(plate => <li key={plate.id}><PlateCard plate={plate} onOpen={onOpen} /></li>)}
      </ul>
      : <div className="desk-card desk-plates desk-plates--unknown" data-desk-plates="unknown">
        <span className="desk-card__kicker">My instruments</span>
        <strong className="desk-figure">{engravedCents(null)}</strong>
        <span className="desk-card__line">This folio could not be read on this device.</span>
      </div>}

    <section className="desk-card desk-card--level desk-level--personal" aria-label="The month, running" data-desk-level="personal">
      {level
        ? <PlateCard plate={level} onOpen={onOpen} inset />
        : <>
          <p className="desk-card__kicker">How my month is running</p>
          <p className="desk-level__line">{engravedCents(null)}</p>
        </>}
    </section>

    <section className="desk-card desk-hercules" aria-labelledby={`${ids}-hercules`}>
      <h2 className="desk-card__kicker" id={`${ids}-hercules`}>Hercules’s corner</h2>
      {hercules
        ? <div className="desk-hercules__card" data-desk-discovery={hercules.candidate.capabilityId}>
          <strong className="desk-hercules__title">{hercules.candidate.title}</strong>
          <p className="desk-hercules__why">{hercules.candidate.why}</p>
        </div>
        : <p className="desk-hercules__why">Nothing needs a nudge. He is curled up on your folio.</p>}
      <div className="desk-hercules__doors">
        {hercules && hercules.target !== "hercules" && <button type="button" className="desk-door" onClick={() => onOpen(hercules.target)}>{hercules.words}</button>}
        <button type="button" className="desk-door desk-door--talk" onClick={onTalk}>Talk with Hercules</button>
      </div>
    </section>
  </div>;
}

/**
 * One personal plate as a paper card: the Office's kicker question, its short
 * glance, the drawing (or the plate's own empty sentence), the footing, and
 * the door it opens. The whole card is the button; the drawing is decoration.
 */
function PlateCard({ plate, onOpen, inset = false }: { plate: DeskPlateModel; onOpen: (target: string, object?: string) => void; inset?: boolean }) {
  const door = personalPlateDoor(plate.id);
  return <button type="button" className={`${inset ? "desk-plate-card desk-plate-card--inset" : "desk-card desk-plate-card"}`}
    data-desk-plate={plate.id} data-plate-edge={plate.edge} data-plate-primitive={plate.figure.primitive}
    onClick={() => onOpen(door.target)} aria-label={`${plate.kicker}. ${plate.verdict} ${door.words}.`}>
    <span className="desk-card__kicker">{plate.kicker}</span>
    <strong className={`desk-plate-card__glance${plate.copperVerdict ? " is-copper" : ""}`}>{plate.glance}</strong>
    {plate.empty
      ? <span className="desk-card__line desk-plate-card__empty">{plate.empty}</span>
      : <span className="desk-plate-card__figure" aria-hidden="true"><PlateFigureView figure={plate.figure} /></span>}
    <span className="desk-plate-card__foot">{plate.footing}</span>
    <span className="desk-plate-card__door" aria-hidden="true">{door.words} →</span>
  </button>;
}

/** The household Today's embossed wax seal, with the Office phone's line beneath the words. */
function Seal({ id, words, cents, cracked = false }: { id: "in" | "out" | "leftover"; words: { label: string; sub: string }; cents: number | null; cracked?: boolean }) {
  return <li className="desk-seal" data-desk-seal={id} data-seal-cracked={cracked || undefined}>
    <span className="desk-seal__wax">
      {cracked && <svg className="desk-seal__crack" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M13 3 L17 8 L14 11 L18 14" /><path d="M29 37 L26 32 L29 29" /></svg>}
      <strong className="desk-seal__figure">{engravedCents(cents)}</strong>
    </span>
    <span className="desk-seal__label">{words.label}</span>
    <span className="desk-seal__sub">{words.sub}</span>
  </li>;
}
