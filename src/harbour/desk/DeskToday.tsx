import { useId, useMemo } from "react";
import { DeskLevel } from "./DeskLevel.tsx";
import { DeskPersonalToday } from "./DeskPersonalToday.tsx";
import { engravedCents, sundialAngle } from "./engraved.ts";
import { deskPots, readHercules, readNext, readSeals, readSitdown, readSnapshot, readWalk, type DeskNext, type DeskPot, type DeskSitdown } from "./todayModel.ts";
import { shortDate } from "../nav/doorSigns.ts";
import type { DeskPageProps } from "./types.ts";

/**
 * Today — the Desk's front page (SIMPLE_VIEW_DESK S2 §1). Everyday "Now"
 * leads big; Prepare, Protect and Build stand beneath; the month's three wax
 * seals; the Level, small; the sundial; and Hercules's corner. Every figure
 * is a selector's figure, every card is a door onto the surface that owns it,
 * and nothing on this page moves money.
 */
export function DeskToday(props: DeskPageProps) {
  // Personal scope has no Fund to lead with: its front page is my folio's own instruments (S5).
  return props.scope === "personal" ? <DeskPersonalToday {...props} /> : <DeskHouseholdToday {...props} />;
}

function DeskHouseholdToday({ household, memberId, scope, today, reading, onOpen, onTalk }: DeskPageProps) {
  const snapshot = useMemo(() => readSnapshot(household, memberId, scope, today), [household, memberId, scope, today]);
  const pots = useMemo(() => deskPots(snapshot ?? EMPTY_SNAPSHOT, engravedCents), [snapshot]);
  const { seals, monthLabel } = useMemo(() => readSeals(household, memberId, scope, today), [household, memberId, scope, today]);
  const walk = useMemo(() => readWalk(household, scope, today), [household, scope, today]);
  const next = useMemo(() => readNext(walk, today), [walk, today]);
  const hercules = useMemo(() => readHercules(household, memberId, scope, today), [household, memberId, scope, today]);
  const sitdown = useMemo(() => readSitdown(reading, household, memberId, scope, today), [reading, household, memberId, scope, today]);
  const leftover = seals?.leftoverCents ?? null;
  const ids = useId();
  return <div className="desk-today" data-desk-sitdown={sitdown?.why}>
    {sitdown && <DogEar sitdown={sitdown} onOpen={onOpen} />}
    <button type="button" className="desk-card desk-now" data-desk-pot="everyday" onClick={() => onOpen(pots.everyday.target)}
      aria-label={`Everyday, now: ${engravedCents(pots.everyday.cents)}. ${pots.everyday.line}. Meet the Queen.`}>
      <span className="desk-card__kicker">Everyday · now</span>
      <strong className="desk-figure desk-figure--now">{engravedCents(pots.everyday.cents)}</strong>
      <span className="desk-card__line">{pots.everyday.line}</span>
    </button>

    <ul className="desk-pots" aria-label="Prepare, Protect and Build">
      {[pots.prepare, pots.protect, pots.build].map(pot => <li key={pot.id}><Pot pot={pot} onOpen={onOpen} /></li>)}
    </ul>

    <section className="desk-card desk-seals" aria-labelledby={`${ids}-seals`}>
      <h2 className="desk-card__kicker" id={`${ids}-seals`}>{monthLabel} so far · posted</h2>
      <ul className="desk-seals__row">
        <Seal id="in" label="Money in" cents={seals?.inCents ?? null} />
        <Seal id="out" label="Money out" cents={seals?.outCents ?? null} />
        <Seal id="leftover" label="Leftover" cents={leftover} cracked={leftover !== null && leftover < 0} />
      </ul>
    </section>

    <section className="desk-card desk-card--level" aria-label="The Level">
      <DeskLevel walk={walk} />
    </section>

    <Sundial next={next} onOpen={onOpen} />

    <section className="desk-card desk-hercules" aria-labelledby={`${ids}-hercules`}>
      <h2 className="desk-card__kicker" id={`${ids}-hercules`}>Hercules’s corner</h2>
      {hercules
        ? <div className="desk-hercules__card" data-desk-discovery={hercules.candidate.capabilityId}>
          <strong className="desk-hercules__title">{hercules.candidate.title}</strong>
          <p className="desk-hercules__why">{hercules.candidate.why}</p>
        </div>
        : <p className="desk-hercules__why">Nothing needs a nudge. He is curled up on the ledger.</p>}
      <div className="desk-hercules__doors">
        {hercules && hercules.target !== "hercules" && <button type="button" className="desk-door" onClick={() => onOpen(hercules.target)}>{hercules.words}</button>}
        <button type="button" className="desk-door desk-door--talk" onClick={onTalk}>Talk with Hercules</button>
      </div>
    </section>
  </div>;
}

const EMPTY_SNAPSHOT = {
  now: null,
  prepare: { amountCents: null, targetCents: 0, coveredThrough: null, bills: [], fundBills: [] },
  protect: { amountCents: null, targetCents: 0, refills: [] },
  build: { amountCents: null, targetCents: 0, goals: [] },
};

function Pot({ pot, onOpen }: { pot: DeskPot; onOpen: (target: string, object?: string) => void }) {
  return <button type="button" className="desk-card desk-pot" data-desk-pot={pot.id} onClick={() => onOpen(pot.target, pot.object)}
    aria-label={`${pot.name}: ${engravedCents(pot.cents)}. ${pot.line}.`}>
    <span className="desk-card__kicker">{pot.name}</span>
    <strong className="desk-figure">{engravedCents(pot.cents)}</strong>
    <span className="desk-card__line">{pot.line}</span>
  </button>;
}

/**
 * The dog-ear (S7): the page's corner folded down while the month's Sitdown
 * waits. A real button — the fold, with "Sitdown" pencilled on its back — that opens
 * the Plan Studio, where the Campfire's door goes.
 */
function DogEar({ sitdown, onOpen }: { sitdown: DeskSitdown; onOpen: (target: string, object?: string) => void }) {
  return <button type="button" className="desk-dogear" data-desk-dogear={sitdown.why} onClick={() => onOpen("plan-studio")}
    aria-label={`The month’s Sitdown is waiting. ${sitdown.words}. Pull out the Plan Studio.`}>
    <span className="desk-dogear__word" aria-hidden="true">Sitdown</span>
    <span className="desk-dogear__fold" aria-hidden="true" />
  </button>;
}

/** An embossed wax seal: the figure pressed into the wax, the words beneath it. */
function Seal({ id, label, cents, cracked = false }: { id: "in" | "out" | "leftover"; label: string; cents: number | null; cracked?: boolean }) {
  return <li className="desk-seal" data-desk-seal={id} data-seal-cracked={cracked || undefined}>
    <span className="desk-seal__wax">
      {cracked && <svg className="desk-seal__crack" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M13 3 L17 8 L14 11 L18 14" /><path d="M29 37 L26 32 L29 29" /></svg>}
      <strong className="desk-seal__figure">{engravedCents(cents)}</strong>
    </span>
    <span className="desk-seal__label">{label}</span>
  </li>;
}

/** The sundial (harvested from the Court's reading edition): what the Fund still has to pay next, and when. */
function Sundial({ next, onOpen }: { next: DeskNext | null; onOpen: (target: string, object?: string) => void }) {
  const angle = next ? sundialAngle(next.daysAhead) : Math.PI / 2;
  const shadow = { x: Math.sin(angle) * 15, y: -Math.cos(angle) * 15 };
  const when = next ? next.daysAhead === 0 ? "today" : next.daysAhead === 1 ? "tomorrow" : `in ${next.daysAhead} days` : "";
  const warning = next?.breaks ? "The Fund runs short here." : next?.underBuffer ? "It leaves the Fund under its buffer." : null;
  return <button type="button" className="desk-card desk-sundial" data-desk-sundial={next ? "dated" : "clear"} onClick={() => onOpen("cellar-bills")}
    aria-label={next ? `Sundial. Next to leave the Fund: ${next.label}, ${engravedCents(next.amountCents)}, ${shortDate(next.date)}, ${when}.${warning ? ` ${warning}` : ""} Read the bill jars.` : "Sundial. Nothing dated still has to leave the Fund this month. Read the bill jars."}>
    <svg className="desk-sundial__dial" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false">
      <circle className="desk-sundial__face" r="18" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => { const a = (i / 6) * Math.PI - Math.PI / 2; return <line key={i} className="desk-sundial__hour" x1={Math.sin(a) * 14} y1={-Math.cos(a) * 14} x2={Math.sin(a) * 17} y2={-Math.cos(a) * 17} />; })}
      <line className="desk-sundial__shadow" x1="0" y1="0" x2={shadow.x} y2={shadow.y} />
      <path className="desk-sundial__gnomon" d="M0 0 L0 -13 L5 -4 Z" />
    </svg>
    <span className="desk-sundial__words">
      <span className="desk-card__kicker">Sundial · next to leave</span>
      <strong className="desk-sundial__label">{next ? next.label : "Nothing dated"}</strong>
      <span className="desk-card__line">{next ? <><span className="desk-figure desk-figure--inline">{engravedCents(next.amountCents)}</span> · {shortDate(next.date)} · {when}</> : "Nothing else leaves the Fund this month"}</span>
      {warning && <span className="desk-sundial__warning">{warning}</span>}
    </span>
  </button>;
}
