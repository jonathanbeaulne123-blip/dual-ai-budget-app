import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { DateKey } from "../../core/calendar.ts";
import { DeskLevel } from "../desk/DeskLevel.tsx";
import { engravedCents } from "../desk/engraved.ts";
import type { CampCardModel, CardDoor, MineFull, OursFull } from "./campCardModel.ts";
import { PlateCard, Pot, SealRow, type Open } from "./CardParts.tsx";
import { WORDS } from "./copy.ts";
import type { LedgerSpace } from "./dayLedger.ts";

export type RecordVerb = "shift";

export type CampCardProps = {
  /** `campCardModel(...)` — every word and figure the card shows. */
  model: CampCardModel;
  /** The Ours | Mine pill. `space` is the App's view; the pill only asks for a change. */
  space: LedgerSpace;
  /** Omit to hide the pill (a host that owns the space switch elsewhere, like the Desk's header). */
  onSpaceChange?: (space: LedgerSpace) => void;
  /** The full card is open. The page variant is always open. */
  expanded: boolean;
  /** The grab handle. Omit (page variant) for no handle. */
  onExpandedChange?: (expanded: boolean) => void;
  /** `dock`: the island's glass card (one `h1`, one Tab stop, rows rove with ↑/↓). `page`: the Desk's Today (natural Tab order, `h2`s under the Desk's own `h1`). */
  variant?: "dock" | "page";
  /** Line 1: Everyday · now → the Fund bank panel. */
  onOpenBank: () => void;
  /** Line 2 (Ours): Leaving next → the Cellar panel. */
  onOpenCellar: () => void;
  /** Line 2 (Mine): Leaving next → the Calendar at that day. */
  onOpenCalendar: (date: DateKey) => void;
  /** Every other door: `openHouseObject(target, object)`. */
  onOpen: Open;
  /** Hercules's "Shift tonight? Record it here." → the Record dial's Shift flow (D1: Shift defaults to Mine). */
  onRecord: (verb: RecordVerb) => void;
  onTalk: () => void;
  onOpenBooks: () => void;
  onStepIn: () => void;
  onWhatChanged: () => void;
};

/** "Since you were here" changes announce at most this often (§4.3). */
export const SINCE_ANNOUNCE_MS = 30_000;

/**
 * The camp card (Tool Atlas §3.5, §4.1 "The card is three lines"). Three
 * lines, each ≥ 44 px and each one target, and a grab handle:
 *
 *   1 · the Ours | Mine pill · Everyday · now $1,284.50 (→ the Fund bank)
 *   2 · Leaving next · Hydro $142 · Sat 27 · +2 this week (→ the Cellar)
 *   3 · Needs you · … → Since you were here · … → the first-visit line
 *
 * Open, it adds Prepare · Protect · Build, the three seals, The Level,
 * Hercules's line (a button), Books, Step in and "What changed here"; in Mine,
 * the personal plates, seals and the shift streak. The card is a named
 * region holding home's one `h1`. Nothing is `aria-live` with content at
 * load: the one status node starts empty and speaks only after the pill
 * changes ("Showing Mine") or "Since you were here" changes (≤ once / 30 s).
 * Every write goes through the props — nothing here reaches a command.
 */
export function CampCard(props: CampCardProps) {
  const { model, space, onSpaceChange, expanded, onExpandedChange, variant = "dock" } = props;
  const ids = useId().replace(/:/g, "");
  const page = variant === "page";
  const open = page || expanded;
  const root = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState("");

  // "Since you were here", announced politely — never at load, at most once every 30 s.
  const sinceWords = model.line3.kind === "since" ? model.line3.words : null;
  const lastSince = useRef<{ words: string | null; at: number }>({ words: sinceWords, at: 0 });
  useEffect(() => {
    const last = lastSince.current;
    if (sinceWords === last.words) return;
    const now = Date.now();
    last.words = sinceWords;
    if (sinceWords && now - last.at >= SINCE_ANNOUNCE_MS) { last.at = now; setStatus(WORDS.sinceAnnounce(sinceWords.replace(`${WORDS.sinceYouWereHere} · `, ""))); }
  }, [sinceWords]);

  const choose = (next: LedgerSpace) => {
    if (next === space) return;
    onSpaceChange?.(next);
    setStatus(WORDS.showing(next));
  };

  // One Tab stop in the dock: rows rove with ↑ / ↓ (Home / End), the pill's two options with ← / →.
  const [stop, setStop] = useState(0);
  const stops = () => root.current ? [...root.current.querySelectorAll<HTMLElement>('button:not([role="radio"]), [role="radio"][aria-checked="true"]')] : [];
  useLayoutEffect(() => {
    if (page) return;
    const all = stops();
    const current = Math.min(stop, all.length - 1);
    all.forEach((el, i) => { el.tabIndex = i === current ? 0 : -1; });
    // The pill's unchosen option is reached with ← / →, never with Tab.
    root.current?.querySelectorAll<HTMLElement>('[role="radio"][aria-checked="false"]').forEach(el => { el.tabIndex = -1; });
  });
  const onFocusIn = () => {
    if (page) return;
    const i = stops().indexOf(document.activeElement as HTMLElement);
    if (i >= 0 && i !== stop) setStop(i);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !page && expanded && onExpandedChange) { onExpandedChange(false); handle.current?.focus(); return; }
    if (page) return;
    const all = stops();
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const to = event.key === "ArrowDown" ? Math.min(all.length - 1, i + 1) : event.key === "ArrowUp" ? Math.max(0, i - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? all.length - 1 : null;
    if (to === null || to === i) return;
    setStop(to);
    all[to]!.focus();
  };

  const go = (door: CardDoor) => {
    if (door.target === "queen") props.onOpenBank();
    else if (door.target === "cellar-bills") props.onOpenCellar();
    else if (door.target === "hercules") props.onTalk();
    else props.onOpen(door.target, door.object);
  };

  const Heading = page ? "h2" : "h1";
  const Kicker = page ? "h3" : "h2";
  const line3 = model.line3;
  const next = model.leaving.next;
  return <section ref={root} className={`glass-card glass-card--${variant}`} aria-labelledby={`${ids}-h`} data-camp-card="" data-space={model.space}
    data-expanded={open || undefined} onKeyDown={onKeyDown} onFocus={onFocusIn}>
    <Heading className={page ? "glass-card__heading" : "glass-card__heading glass-sr"} id={`${ids}-h`}>{model.heading}</Heading>
    <span className="glass-sr" role="status">{status}</span>

    <div className="glass-card__line glass-card__line--one" data-card-line="1">
      {onSpaceChange && <Pill space={space} onChoose={choose} />}
      {model.everyday
        ? <button type="button" className={`glass-card__door${page ? " desk-card desk-now" : ""}`} data-desk-pot="everyday" onClick={props.onOpenBank}>
          <span className="glass-card__kicker">{WORDS.everydayNow}</span>{" "}
          <strong className={`glass-card__figure${page ? " desk-figure desk-figure--now" : ""}`}>{model.everyday.figure}</strong>
        </button>
        : <button type="button" className="glass-card__door" data-card-clock="" onClick={() => props.onOpen("shift")}>
          <span className="glass-card__kicker">{WORDS.onTheClock}</span><span aria-hidden="true"> · </span>
          <strong className="glass-card__figure glass-card__figure--small">{model.clock?.glance ?? engravedCents(null)}</strong>
        </button>}
    </div>

    <button type="button" className="glass-card__line glass-card__door" data-card-line="2" data-card-leaving={next ? next.date : "none"}
      onClick={() => model.space === "ours" ? props.onOpenCellar() : props.onOpenCalendar(next?.date ?? model.monthKey + "-01")}>
      <span className="glass-card__text">{model.leaving.words}</span>
    </button>

    {line3.kind === "needs" || line3.kind === "since"
      ? <button type="button" className="glass-card__line glass-card__door" data-card-line="3" data-card-line3={line3.kind}
        data-desk-dogear={line3.kind === "needs" ? line3.sitdown?.why : undefined}
        onClick={() => go(line3.door)}>
        <span className="glass-card__text">{line3.words}</span>
        {line3.kind === "needs" && <span className="glass-sr">, {line3.items.length} {line3.items.length === 1 ? "item" : "items"}</span>}
      </button>
      : <p className="glass-card__line glass-card__quiet" data-card-line="3" data-card-line3={line3.kind}>{line3.words}</p>}

    {!page && onExpandedChange && <button ref={handle} type="button" className="glass-card__handle" aria-expanded={expanded} aria-controls={`${ids}-full`}
      onClick={() => onExpandedChange(!expanded)} data-card-handle="">
      <span className="glass-card__grip" aria-hidden="true" /><span className="glass-sr">{expanded ? WORDS.foldCard : WORDS.openCard}</span>
    </button>}

    {open && <div className="glass-card__full" id={`${ids}-full`} data-card-full="">
      {model.full.space === "ours"
        ? <OursBody full={model.full} Kicker={Kicker} onOpen={props.onOpen} onOpenBank={props.onOpenBank} ids={ids} />
        : <MineBody full={model.full} Kicker={Kicker} onOpen={props.onOpen} ids={ids} />}
      <section className="desk-card desk-hercules glass-card__hercules" aria-labelledby={`${ids}-hercules`}>
        <Kicker className="desk-card__kicker" id={`${ids}-hercules`}>{WORDS.herculesKicker}</Kicker>
        {model.hercules.kind === "record-shift"
          ? <button type="button" className="desk-door glass-card__hercules-line" data-card-hercules="record-shift" onClick={() => props.onRecord("shift")}>{model.hercules.words}</button>
          : model.hercules.kind === "door"
            ? <button type="button" className="desk-hercules__card glass-card__hercules-line" data-card-hercules="door" data-desk-discovery={model.hercules.hercules.candidate.capabilityId}
              onClick={() => go({ target: model.hercules.kind === "door" ? model.hercules.hercules.target : "hercules" })}>
              <strong className="desk-hercules__title">{model.hercules.title}</strong>
              <span className="desk-hercules__why">{model.hercules.why}</span>
            </button>
            : <p className="desk-hercules__why" data-card-hercules="quiet">{model.hercules.words}</p>}
        <div className="desk-hercules__doors">
          <button type="button" className="desk-door desk-door--talk" onClick={props.onTalk}>{WORDS.talk}</button>
        </div>
      </section>
      <nav className="glass-card__doors" aria-label="More from the card">
        <button type="button" className="desk-door" data-card-door="books" onClick={props.onOpenBooks}>{WORDS.books}</button>
        <button type="button" className="desk-door" data-card-door="step-in" onClick={props.onStepIn}>{WORDS.stepIn}</button>
        <button type="button" className="desk-door" data-card-door="what-changed" onClick={props.onWhatChanged}>{WORDS.whatChanged}</button>
      </nav>
    </div>}
  </section>;
}

/** The Ours | Mine pill: a two-option radio group named "Whose money". It closes nothing. */
function Pill({ space, onChoose }: { space: LedgerSpace; onChoose: (space: LedgerSpace) => void }) {
  const group = useRef<HTMLDivElement>(null);
  const pick = (next: LedgerSpace) => {
    onChoose(next);
    requestAnimationFrame?.(() => group.current?.querySelector<HTMLElement>(`[data-space-option="${next}"]`)?.focus());
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") pick(space === "ours" ? "mine" : "ours");
  };
  return <div ref={group} className="glass-pill" role="radiogroup" aria-label={WORDS.whoseMoney} onKeyDown={onKeyDown}>
    {(["ours", "mine"] as const).map(option => <button key={option} type="button" role="radio" aria-checked={space === option}
      className="glass-pill__option" data-space-option={option} onClick={() => pick(option)}>
      {option === "ours" ? WORDS.ours : WORDS.mine}
    </button>)}
  </div>;
}

type Heading = "h2" | "h3";

function OursBody({ full, Kicker, onOpen, onOpenBank, ids }: { full: OursFull; Kicker: Heading; onOpen: Open; onOpenBank: () => void; ids: string }) {
  const open: Open = (target, object) => target === "queen" ? onOpenBank() : onOpen(target, object);
  return <>
    <section className="glass-card__section" aria-labelledby={`${ids}-pots`}>
      <Kicker className="desk-card__kicker glass-card__section-kicker" id={`${ids}-pots`}>{WORDS.pots}</Kicker>
      <ul className="desk-pots">
        {[full.pots.prepare, full.pots.protect, full.pots.build].map(pot => <li key={pot.id}><Pot pot={pot} onOpen={open} /></li>)}
      </ul>
    </section>
    <section className="desk-card desk-seals" aria-labelledby={`${ids}-seals`}>
      <Kicker className="desk-card__kicker" id={`${ids}-seals`}>{WORDS.seals(full.seals.monthLabel)}</Kicker>
      <SealRow seals={full.seals.seals} />
    </section>
    <section className="desk-card desk-card--level" aria-label="The Level">
      <DeskLevel walk={full.walk} />
    </section>
  </>;
}

function MineBody({ full, Kicker, onOpen, ids }: { full: MineFull; Kicker: Heading; onOpen: Open; ids: string }) {
  return <>
    <section className="desk-card desk-seals desk-seals--personal" aria-labelledby={`${ids}-seals`} data-desk-personal-seals="">
      <Kicker className="desk-card__kicker" id={`${ids}-seals`}>{WORDS.sealsMine(full.seals.monthLabel)}</Kicker>
      <SealRow seals={full.seals.seals} personal />
    </section>
    {full.plates.length > 0
      ? <ul className="desk-plates" aria-label={WORDS.instruments}>
        {full.plates.map(plate => <li key={plate.id}><PlateCard plate={plate} onOpen={onOpen} /></li>)}
      </ul>
      : <div className="desk-card desk-plates desk-plates--unknown" data-desk-plates="unknown">
        <span className="desk-card__kicker">{WORDS.instruments}</span>
        <strong className="desk-figure">{engravedCents(null)}</strong>
        <span className="desk-card__line">{WORDS.unknownFolio}</span>
      </div>}
    <section className="desk-card desk-card--level desk-level--personal" aria-label={WORDS.monthRunning} data-desk-level="personal">
      {full.level
        ? <PlateCard plate={full.level} onOpen={onOpen} inset />
        : <><p className="desk-card__kicker">{WORDS.monthRunning}</p><p className="desk-level__line">{engravedCents(null)}</p></>}
    </section>
    {full.streak && <p className="desk-card glass-card__streak" data-card-streak={full.streak.count}>
      <span className="desk-card__kicker">{WORDS.streak(full.streak.count)}</span>
      <span className="desk-card__line">{full.streak.spoken}</span>
    </p>}
  </>;
}
