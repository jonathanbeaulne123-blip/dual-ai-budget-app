/**
 * The list (L4): the Map/List toggle's readable twin, for the level and chapter the map is on (`listView` from the
 * model, ruling 3). Same stops, same `actions[]`, same words.
 *
 * - Strip: In / Out "in the Books" (Books actuals, recorded only), To the Fund (its own figure, never in In), Still to
 *   come (scheduled, from today on) with expected-in, the Fund estimate printed apart and unknown amounts COUNTED
 *   (never $0), Needs you. No figure is summed with another.
 * - Before the groups (trust M2): "Waiting on you" (`digest.waitingOnYou`) and "Repeating reminders" (the App's
 *   `dueReview`), each item with its one labelled button — what Hercules's bubble shows on the map is here too.
 * - Groups in the model's order: "Needs you" rows first (each with its date), then days (Week lists all seven; an empty
 *   day says so) or chapters (Year). Each group's wrapper is `display: contents` and not a landmark, so Today's divider
 *   stays pinned while the whole list scrolls (UX #7). Signs come from the value.
 * - Each row: a state dot (never a checkbox), the label, date / status words, the amount, and the stop's own action
 *   buttons (each runs its call once, exactly as the map's sheet). The label opens the same stop on the map.
 */
import type { AttentionItem, JourneyBoardActions, ListRow, ListView as ListViewModel, Stop } from "../contracts.ts";
import { isToCheck, runJourneyAction } from "../contracts.ts";
import { MAP_WORDS, shortDate, signedMoney } from "../model/index.ts";
import { callWords, COPY, money } from "./copy.ts";
import { cssSafe } from "./Marks.tsx";
import { ActionButtons, signedAmount, StateDot } from "./StopPanel.tsx";

/** A row's DOM id (`journey-row-…`), stable across renders (the App's tool doors return focus to it). */
export function journeyRowDomId(id: string): string {
  return `journey-row-${cssSafe(id)}`;
}

function Strip({ strip }: { strip: NonNullable<ListViewModel["strip"]> }) {
  const w = MAP_WORDS.strip;
  return (
    <dl className="journey-strip" data-list-strip="">
      <div data-strip="in"><dt>{w.inBooks}</dt><dd className={strip.inBooksCents >= 0 ? "journey-strip__in" : undefined}>{signedMoney(strip.inBooksCents)}</dd></div>
      <div data-strip="out"><dt>{w.outBooks}</dt><dd>{money(strip.outBooksCents)}</dd></div>
      <div data-strip="fund"><dt>{w.toFund}</dt><dd>{money(strip.toFundCents)}</dd></div>
      <div data-strip="to-come">
        <dt>{w.stillToCome}</dt>
        <dd>{money(strip.stillToComeOutCents)}</dd>
        <dd className="journey-strip__sub journey-strip__in">{signedMoney(strip.stillToComeInCents)} {w.stillToComeIn}</dd>
        {strip.stillToComeEstimateCents ? <dd className="journey-strip__sub" data-strip="estimate">{money(strip.stillToComeEstimateCents)} {w.stillToComeEstimate}</dd> : null}
        {strip.stillToComeUnknown ? <dd className="journey-strip__sub" data-strip="unknown">{w.stillToComeUnknown(strip.stillToComeUnknown)}</dd> : null}
      </div>
      <div data-strip="needs-you" className="journey-strip__need"><dt>{w.needsYou}</dt><dd>{strip.needsYou}</dd></div>
    </dl>
  );
}

function Legend() {
  return (
    <p className="journey-legend" aria-hidden="true">
      <span><span className="journey-dot journey-dot--rec" />{MAP_WORDS.legend.recorded}</span>
      <span><span className="journey-dot journey-dot--need">!</span>{MAP_WORDS.legend.needsYou}</span>
      <span><span className="journey-dot journey-dot--exp" />{MAP_WORDS.legend.expected}</span>
      <span><span className="journey-dot journey-dot--rec journey-dot--in">↑</span>{MAP_WORDS.legend.in} · {MAP_WORDS.stack.solid}</span>
      <span><span className="journey-dot journey-dot--exp journey-dot--in">↑</span>{MAP_WORDS.legend.inExpected}</span>
    </p>
  );
}

/** "Waiting on you" and "Repeating reminders" (trust M2): the bubble's other sections, in the list, each with its button. */
function Waiting({ items, dueReview, actions, onOpen }: { items: readonly AttentionItem[]; dueReview?: { count: number } | null; actions: JourneyBoardActions; onOpen(id: string): void }) {
  const due = dueReview && dueReview.count > 0 ? dueReview.count : 0;
  if (!items.length && !due) return null;
  return (
    <>
      {items.length ? (
        <>
          <h3 className="journey-day journey-day--need" id="journey-list-waiting" data-waiting-group="waiting-on-you" data-day-divider="waiting-on-you">{MAP_WORDS.checklist.waitingOnYou} · {items.length}</h3>
          <ul className="journey-rows" aria-labelledby="journey-list-waiting">
            {items.map((item) => (
              <li key={item.id} className="journey-row journey-row--item" data-row-id={item.id}>
                <span className="journey-dot journey-dot--exp" aria-hidden="true" />
                <span className="journey-row__text"><b className="journey-row__label">{item.words}</b></span>
                {item.stopId ? (
                  <button type="button" className="journey-action" data-open-stop={item.stopId} onClick={() => onOpen(item.stopId!)}>{callWords(item.call)}</button>
                ) : (
                  <button type="button" className="journey-action" data-action-id={item.id} onClick={() => runJourneyAction(actions, item.call)}>{callWords(item.call)}</button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {due ? (
        <>
          <h3 className="journey-day journey-day--need" id="journey-list-reminders" data-waiting-group="reminders" data-day-divider="reminders">{MAP_WORDS.checklist.reminders} · {due}</h3>
          <ul className="journey-rows" aria-labelledby="journey-list-reminders">
            <li className="journey-row journey-row--item" data-row-id="due-review">
              <span className="journey-dot journey-dot--exp" aria-hidden="true" />
              <span className="journey-row__text"><b className="journey-row__label">{MAP_WORDS.reminders.count(due)}</b><span className="journey-row__item-status">{MAP_WORDS.reminders.sub}</span></span>
              <button type="button" className="journey-action" data-action-id="due-review" onClick={() => runJourneyAction(actions, { name: "openDueReview" })}>{callWords({ name: "openDueReview" })}</button>
            </li>
          </ul>
        </>
      ) : null}
    </>
  );
}

export type ListViewProps = {
  view: ListViewModel;
  stops: Map<string, Stop>;
  actions: JourneyBoardActions;
  /** Show this stop (or crossroads) on the map, its sheet open. */
  onOpen(id: string): void;
  /** What waits on this viewer (`board.digest.waitingOnYou`) and the App's repeating reminders (trust M2). */
  waitingOnYou?: readonly AttentionItem[];
  dueReview?: { count: number } | null;
  /** Offline / stale books, said at the top (UX #25). */
  statusNote?: string | null;
};

function Row({ row, stop, actions, onOpen, withDate }: { row: ListRow; stop: Stop | undefined; actions: JourneyBoardActions; onOpen(id: string): void; withDate: boolean }) {
  const amount = stop ? signedAmount(stop, row.amountText) : row.amountText;
  const check = stop ? isToCheck(stop) : false;
  return (
    <li id={journeyRowDomId(row.id)} className={["journey-row", `journey-row--${row.level}`, check ? "journey-row--check" : ""].filter(Boolean).join(" ")} data-row-id={row.id}>
      <button type="button" className="journey-row__main" data-open-stop={row.id} onClick={() => onOpen(row.id)}>
        {stop ? <StateDot stop={stop} /> : <span className="journey-dot journey-dot--exp" aria-hidden="true" />}
        <span className="journey-row__text">
          <b className="journey-row__label">{row.label}</b>
          <span className="journey-row__kind">{row.kindLabel}</span>
          <span className="journey-row__meta">{withDate && row.date ? <span className="journey-row__date">{shortDate(row.date)}</span> : null}<span className="journey-row__status">{row.statusText}</span></span>
          {row.note ? <span className="journey-row__note" data-row-note="">{row.note}</span> : null}
        </span>
        {amount ? <span className={["journey-row__amount", amount.startsWith("+") ? "journey-row__amount--in" : ""].filter(Boolean).join(" ")}>{amount}</span> : null}
      </button>
      <ActionButtons actions={row.actions} run={(a) => runJourneyAction(actions, a.call)} className="journey-row__actions" />
    </li>
  );
}

export function ListView({ view, stops, actions, onOpen, waitingOnYou = [], dueReview, statusNote }: ListViewProps) {
  return (
    <section className="journey-list" aria-label={COPY.listLabel} data-journey-list={view.scope.level}>
      <p className="journey-list__kick">{COPY.listKick}</p>
      <h2 className="journey-list__title" tabIndex={-1}>{view.title}</h2>
      {statusNote ? <p className="journey-list__status" data-list-status="">{statusNote}</p> : null}
      {view.strip ? <Strip strip={view.strip} /> : null}
      <Legend />
      {view.emptyText ? <p className="journey-list__empty" data-list-empty="">{view.emptyText}</p> : null}
      <Waiting items={waitingOnYou} dueReview={dueReview} actions={actions} onOpen={onOpen} />
      {view.groups.map((g) => {
        const headId = `journey-list-${cssSafe(g.id)}`;
        // The wrapper is `display: contents` and not a landmark: heading and rows lay out as siblings of the list, so the
        // sticky Today divider stays pinned across the whole list (UX #7); the rows are labelled by their heading.
        return (
          <div key={g.id} className={["journey-group", `journey-group--${g.kind}`, g.today ? "journey-group--today" : ""].filter(Boolean).join(" ")} data-group-id={g.id}>
            <h3 id={headId} className={["journey-day", g.today ? "journey-day--today" : "", g.kind === "needs-you" ? "journey-day--need" : ""].filter(Boolean).join(" ")} data-day-divider={g.today ? "today" : g.kind}>{g.label}</h3>
            {g.rows.length ? (
              <ul className="journey-rows" aria-labelledby={headId}>
                {g.rows.map((row) => <Row key={row.id} row={row} stop={stops.get(row.id)} actions={actions} onOpen={onOpen} withDate={g.kind !== "day"} />)}
              </ul>
            ) : g.emptyText ? <p className="journey-list__quiet">{g.emptyText}</p> : null}
          </div>
        );
      })}
      {view.limitations.length ? (
        <footer className="journey-list__limits">
          <h3>{COPY.aboutLimits}</h3>
          <ul>{view.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </footer>
      ) : null}
    </section>
  );
}
