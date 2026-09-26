import { PlateFigureView } from "../../DeskPlates.tsx";
import type { DeskPlateModel } from "../../core/deskPlates.ts";
import type { DeskMonthSeals } from "../../core/officeWide.ts";
import { engravedCents } from "../desk/engraved.ts";
import { PERSONAL_SEAL_WORDS, personalPlateDoor } from "../desk/personalModel.ts";
import type { DeskPot } from "../desk/todayModel.ts";

/**
 * The full card's paper pieces — the same markup the Desk's Today page has
 * always drawn (`desk-*` classes and `data-desk-*` hooks), so the Desk's
 * dressings style them on the Desk and `glass.css` styles them on the dock.
 */
export type Open = (target: string, object?: string) => void;

export function Pot({ pot, onOpen }: { pot: DeskPot; onOpen: Open }) {
  return <button type="button" className="desk-card desk-pot" data-desk-pot={pot.id} onClick={() => onOpen(pot.target, pot.object)}>
    <span className="desk-card__kicker">{pot.name}</span>
    <strong className="desk-figure">{engravedCents(pot.cents)}</strong>
    <span className="desk-card__line">{pot.line}</span>
  </button>;
}

/** An embossed wax seal: the figure pressed into the wax, the words beneath it. */
export function Seal({ id, label, sub, cents, cracked = false }: { id: "in" | "out" | "leftover"; label: string; sub?: string; cents: number | null; cracked?: boolean }) {
  return <li className="desk-seal" data-desk-seal={id} data-seal-cracked={cracked || undefined}>
    <span className="desk-seal__wax">
      {cracked && <svg className="desk-seal__crack" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M13 3 L17 8 L14 11 L18 14" /><path d="M29 37 L26 32 L29 29" /></svg>}
      <strong className="desk-seal__figure">{engravedCents(cents)}</strong>
    </span>
    <span className="desk-seal__label">{label}</span>
    {sub && <span className="desk-seal__sub">{sub}</span>}
  </li>;
}

export function SealRow({ seals, personal = false }: { seals: DeskMonthSeals | null; personal?: boolean }) {
  const leftover = seals?.leftoverCents ?? null;
  return <ul className="desk-seals__row">
    <Seal id="in" label="Money in" sub={personal ? PERSONAL_SEAL_WORDS.in.sub : undefined} cents={seals?.inCents ?? null} />
    <Seal id="out" label="Money out" sub={personal ? PERSONAL_SEAL_WORDS.out.sub : undefined} cents={seals?.outCents ?? null} />
    <Seal id="leftover" label="Leftover" sub={personal ? PERSONAL_SEAL_WORDS.leftover.sub : undefined} cents={leftover} cracked={leftover !== null && leftover < 0} />
  </ul>;
}

/**
 * One personal plate as a paper card: the Office's kicker question, its short
 * glance, the drawing (or the plate's own empty sentence), the footing, and
 * the door it opens. The whole card is the button; its name starts with the
 * kicker it shows.
 */
export function PlateCard({ plate, onOpen, inset = false }: { plate: DeskPlateModel; onOpen: Open; inset?: boolean }) {
  const door = personalPlateDoor(plate.id);
  return <button type="button" className={inset ? "desk-plate-card desk-plate-card--inset" : "desk-card desk-plate-card"}
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
