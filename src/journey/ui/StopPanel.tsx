/**
 * The stop sheet's bodies (L4, kept from T4): a stop, a same-day cluster, a chapter — and `StopCard`, one stop's card
 * (the day sheet stacks one per stop on the date).
 *
 * A card shows the exact amount, the date and the explicit status (the SAME words as the list row, from model/words.ts:
 * "Overdue · not recorded", "Set aside in Prepare · not paid", "Expected · not recorded", "Fully backed · not bought"),
 * where its coin stack stands on the ruler, and the stop's own `actions[]` — each button runs exactly its call through
 * `runJourneyAction`, once. Opening a sheet runs nothing. "Enter Horizon here" appears only for a stop tied to a real
 * place, and only where the live map can hand off (never on the flat map).
 */
import { useId, type ReactNode } from "react";
import type { Chapter, Crossroads, HorizonLocation, JourneyBoardActions, JourneyLevel, ListRow, Stop, StopAction, StopCluster } from "../contracts.ts";
import { isToCheck, ringsFor, runJourneyAction, STACK_RULER } from "../contracts.ts";
import { directionOf, isRecorded, knownCents, MAP_WORDS, shortDate } from "../model/index.ts";
import { COPY, longDate, money } from "./copy.ts";

export type PanelFrameProps = {
  kindWords: string;
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
  headingRef?: (el: HTMLHeadingElement | null) => void;
  /** The paper sheet the map opens (a non-modal dialog over the map), or a plain region. */
  dialog?: boolean;
};

/** One frame for every sheet: a labelled region with a focusable heading and a Close button. */
export function PanelFrame({ kindWords, title, onClose, children, className, headingRef, dialog }: PanelFrameProps) {
  const id = useId();
  return (
    <section className={["journey-panel", className].filter(Boolean).join(" ")} aria-labelledby={id} data-journey-panel="" role={dialog ? "dialog" : undefined} aria-modal={dialog ? false : undefined}>
      <header className="journey-panel__head">
        <p className="journey-panel__kind">{kindWords}</p>
        <h2 id={id} className="journey-panel__title" tabIndex={-1} ref={headingRef}>{title}</h2>
        <button type="button" className="journey-panel__close" onClick={onClose} aria-label={`${COPY.close} · ${title}`}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="journey-panel__body">{children}</div>
    </section>
  );
}

/**
 * The DOM id of a stop panel's action button. The App's tool doors remember `document.activeElement.id` and focus it
 * again on "Put it back", so a stable id brings focus back to the same control when the board remounts on its
 * restored selection (review M3: return from a tool).
 */
export function journeyPanelActionDomId(actionId: string): string {
  return `journey-panel-action-${actionId}`;
}

export function ActionButtons({ actions, run, className, domIds = false }: { actions: readonly StopAction[]; run(action: StopAction): void; className?: string; domIds?: boolean }) {
  if (!actions.length) return null;
  return (
    <div className={["journey-actions", className].filter(Boolean).join(" ")}>
      {actions.map((a) => (
        <button key={a.id} type="button" id={domIds ? journeyPanelActionDomId(a.id) : undefined} className={a.primary ? "journey-action journey-action--primary" : "journey-action"} data-action-id={a.id} onClick={() => run(a)}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

export type StopPanelProps = {
  stop: Stop;
  row: ListRow | undefined;
  actions: JourneyBoardActions;
  onClose(): void;
  /** Where "Enter Horizon here" lands for this stop (null = not a place, or the flat board). */
  horizonLocation: HorizonLocation | null;
  onEnterHorizon(location: HorizonLocation): void;
  /** Opened from a same-day cluster: a way back to it. */
  back?: { label: string; onBack(): void } | null;
  nameOf?: (memberId: string) => string;
  headingRef?: (el: HTMLHeadingElement | null) => void;
};

function stopFacts(stop: Stop, row: ListRow | undefined, nameOf?: (id: string) => string): { term: string; value: string }[] {
  const facts: { term: string; value: string }[] = [];
  // A goal's figure is what is saved toward it; a planning step's figure is what it is expected to cost.
  if (row?.amountText) facts.push({ term: stop.kind === "plan" ? (stop.planKind === "goal" ? "Saved" : "Expected cost") : "Amount", value: row.amountText });
  facts.push({ term: "Date", value: longDate(stop.date) });
  if (row?.statusText) facts.push({ term: "Status", value: row.statusText });
  if (stop.kind === "income" && stop.memberId && nameOf) facts.push({ term: "For", value: nameOf(stop.memberId) });
  if (stop.kind === "milestone") facts.push({ term: "Unlocks", value: stop.unlocks });
  if (stop.kind === "plan" && stop.planKind === "goal" && stop.status === "backing") facts.push({ term: "Backing", value: `${stop.step} of 10 steps` });
  return facts;
}

/** The "dot" that says what state a stop is in (never a checkbox: looking is not doing). Words travel beside it. */
export function StateDot({ stop }: { stop: Stop }) {
  const check = isToCheck(stop), rec = isRecorded(stop), inc = directionOf(stop) === "in";
  return <span className={["journey-dot", check ? "journey-dot--need" : rec ? "journey-dot--rec" : "journey-dot--exp", inc ? "journey-dot--in" : ""].filter(Boolean).join(" ")} aria-hidden="true">{check ? "!" : inc ? "↑" : ""}</span>;
}

/** An amount as printed on the map: the model's own words, with "+" in front of money coming in. */
export function signedAmount(stop: Stop, amountText: string): string {
  return amountText && directionOf(stop) === "in" && knownCents(stop) !== null ? `+${amountText}` : amountText;
}

/** Where the stop's coin stack stands on the level's ruler (null amount → no stack, said in words). */
export function rulerWords(stop: Stop, level: JourneyLevel): string | null {
  const direction = directionOf(stop);
  if (direction === "none") return null;
  const rings = ringsFor(knownCents(stop), level);
  const side = direction === "in" ? "mint, coming in" : "gold, going out";
  if (!rings) return `On the ruler: ${side} · ${MAP_WORDS.stack.unknown} · no stack.`;
  const tall = rings.rings < 0.2 ? "a single thin coin" : `${rings.drawnRings.toFixed(1)} rings tall${rings.capped ? " (capped, the figure is printed)" : ""}`;
  return `On the ruler: ${side} · ${tall} (${money(STACK_RULER[level].centsPerRing)} a ring) · ${isRecorded(stop) ? `solid — ${MAP_WORDS.stack.solid}` : `see-through — ${MAP_WORDS.stack.seeThrough}`}.`;
}

export type StopCardProps = {
  stop: Stop;
  row: ListRow | undefined;
  actions: JourneyBoardActions;
  horizonLocation: HorizonLocation | null;
  onEnterHorizon(location: HorizonLocation): void;
  level?: JourneyLevel;
  /** Show the stop's own name as the card's kick (a day sheet with several stops). */
  named?: boolean;
  nameOf?: (memberId: string) => string;
};

/** One stop as a paper card: kind, amount, status (dot + words), facts, its labelled actions, the ruler. */
export function StopCard({ stop, row, actions, horizonLocation, onEnterHorizon, level = "month", named, nameOf }: StopCardProps) {
  const amount = signedAmount(stop, row?.amountText ?? "");
  const facts = stopFacts(stop, row, nameOf).filter((f) => f.term !== "Amount" && f.term !== "Status");
  const ruler = rulerWords(stop, level);
  return (
    <article className={["journey-card", `journey-card--${stop.kind}`, isToCheck(stop) ? "journey-card--check" : ""].filter(Boolean).join(" ")} data-stop-card={stop.id}>
      <p className="journey-card__kick">{row?.kindLabel ?? stop.kind}{named ? ` · ${stop.label}` : ""}</p>
      {amount ? <p className={["journey-card__amount", directionOf(stop) === "in" ? "journey-card__amount--in" : ""].filter(Boolean).join(" ")}>{amount}</p> : null}
      {row?.statusText ? <p className="journey-card__status"><StateDot stop={stop} /> <span className="journey-card__words">{row.statusText}</span></p> : null}
      {facts.length ? (
        <dl className="journey-facts">
          {facts.map((f) => (
            <div key={f.term} className={`journey-facts__row journey-facts__row--${f.term.toLowerCase().replace(/\s+/g, "-")}`}>
              <dt>{f.term}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <ActionButtons actions={stop.actions} run={(a) => runJourneyAction(actions, a.call)} domIds />
      {horizonLocation ? (
        <div className="journey-actions"><button type="button" className="journey-action journey-action--horizon" data-enter-horizon="" onClick={() => onEnterHorizon(horizonLocation)}>{COPY.enterHorizon}</button></div>
      ) : null}
      {ruler ? <p className="journey-card__ruler">{ruler}</p> : null}
    </article>
  );
}

export function StopPanel({ stop, row, actions, onClose, horizonLocation, onEnterHorizon, back, nameOf, headingRef, level }: StopPanelProps & { level?: JourneyLevel }) {
  return (
    <PanelFrame kindWords={`${row?.kindLabel ?? stop.kind} · ${longDate(stop.date)}`} title={stop.label} onClose={onClose} className={`journey-panel--stop journey-panel--${stop.kind}`} headingRef={headingRef} dialog>
      {back ? <button type="button" className="journey-panel__back" onClick={back.onBack}>{back.label}</button> : null}
      <StopCard stop={stop} row={row} actions={actions} horizonLocation={horizonLocation} onEnterHorizon={onEnterHorizon} level={level} nameOf={nameOf} />
      <p className="journey-panel__note">{COPY.sheetNote}</p>
    </PanelFrame>
  );
}

export type ClusterPanelProps = {
  cluster: StopCluster;
  stops: Stop[];
  rows: Map<string, ListRow>;
  onClose(): void;
  onSelectStop(id: string): void;
  headingRef?: (el: HTMLHeadingElement | null) => void;
  /** More on the same day (crossroads), after the stops. */
  children?: ReactNode;
};

/** A same-day cluster expanded: each stop is one button that opens its own panel (nothing runs here). */
export function ClusterPanel({ cluster, stops, rows, onClose, onSelectStop, headingRef, children }: ClusterPanelProps) {
  return (
    <PanelFrame kindWords={COPY.clusterStops} title={longDate(cluster.date)} onClose={onClose} className="journey-panel--cluster" headingRef={headingRef} dialog>
      <ul className="journey-panel__stops">
        {stops.map((s) => {
          const row = rows.get(s.id);
          return (
            <li key={s.id}>
              <button type="button" className="journey-panel__stop" data-open-stop={s.id} onClick={() => onSelectStop(s.id)}>
                <span className="journey-panel__stop-kind">{row?.kindLabel}</span>
                <span className="journey-panel__stop-label">{s.label}</span>
                {row?.amountText ? <span className="journey-panel__stop-amount">{row.amountText}</span> : null}
                {row?.statusText ? <span className="journey-panel__stop-status">{row.statusText}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {children}
      <p className="journey-panel__note">{COPY.sheetNote}</p>
    </PanelFrame>
  );
}

export type ChapterPanelProps = {
  chapter: Chapter;
  row: ListRow | undefined;
  stops: Stop[];
  crossroads: Crossroads[];
  rows: Map<string, ListRow>;
  onClose(): void;
  onSelect(id: string): void;
  headingRef?: (el: HTMLHeadingElement | null) => void;
};

/** A month space: where the chapter stands, what it kept, and its stops (each opens its own panel). */
export function ChapterPanel({ chapter, row, stops, crossroads, rows, onClose, onSelect, headingRef }: ChapterPanelProps) {
  const title = chapter.record.title ? `${chapter.label} · ${chapter.record.title}` : chapter.label;
  const kept = chapter.traces.length;
  return (
    <PanelFrame kindWords="Chapter" title={title} onClose={onClose} className={`journey-panel--chapter journey-panel--${chapter.state}`} headingRef={headingRef} dialog>
      <dl className="journey-facts">
        {row?.statusText ? <div className="journey-facts__row"><dt>Status</dt><dd>{row.statusText}</dd></div> : null}
        {kept ? <div className="journey-facts__row"><dt>{COPY.keptTraces}</dt><dd>{kept} {kept === 1 ? "thing" : "things"}</dd></div> : null}
      </dl>
      <h3 className="journey-panel__sub">{COPY.chapterStops}</h3>
      {stops.length || crossroads.length ? (
        <ul className="journey-panel__stops">
          {[...stops.map((s) => ({ id: s.id, date: s.date, label: s.label, row: rows.get(s.id) })), ...crossroads.map((x) => ({ id: x.id, date: x.date, label: x.label, row: rows.get(x.id) }))]
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
            .map((item) => (
              <li key={item.id}>
                <button type="button" className="journey-panel__stop" data-open-stop={item.id} onClick={() => onSelect(item.id)}>
                  <span className="journey-panel__stop-kind">{item.row?.kindLabel} · {shortDate(item.date)}</span>
                  <span className="journey-panel__stop-label">{item.label}</span>
                  {item.row?.amountText ? <span className="journey-panel__stop-amount">{item.row.amountText}</span> : null}
                  {item.row?.statusText ? <span className="journey-panel__stop-status">{item.row.statusText}</span> : null}
                </button>
              </li>
            ))}
        </ul>
      ) : <p className="journey-panel__quiet">{COPY.chapterNothing}</p>}
    </PanelFrame>
  );
}
