/**
 * The calm header (T4): where we are · what I can do now · what needs attention · what is next (three).
 * From the model's summary only (existing selectors). Attention and next items tied to a stop SELECT it (its panel
 * shows the real actions); only the quick actions and an attention item with no stop run a call — each on an
 * explicit press.
 *
 * - Phone (< 720 px): a two-line glance that expands — the period with the attention count as a badge (◆ n, its
 *   words for screen readers), then the Everyday figure on its own line (never clipped at 320 px).
 * - Wide: a card no taller than 70 % of the stage. Where we are and the quick actions stay pinned at the top (they
 *   are "what can I do now"); attention (three, then "Show all") and coming next (three compact rows) scroll inside
 *   the card's body, so nothing is silently cut off.
 */
import { useId, useState } from "react";
import type { JourneyBoard, JourneyBoardActions, ListRow } from "../contracts.ts";
import { runJourneyAction } from "../contracts.ts";
import { attentionCount, callWords, COPY, longDate, shortDate } from "./copy.ts";

export type BoardSummaryProps = {
  board: JourneyBoard;
  rows: Map<string, ListRow>;
  actions: JourneyBoardActions;
  onSelect(id: string): void;
  freshnessNote?: string | null;
  expanded: boolean;
  onToggle(): void;
};

const ATTENTION_SHOWN = 3;
const NEXT_SHOWN = 3;

export function BoardSummary({ board, rows, actions, onSelect, freshnessNote, expanded, onToggle }: BoardSummaryProps) {
  const id = useId();
  const { summary } = board;
  const [allAttention, setAllAttention] = useState(false);
  const attention = allAttention ? summary.attention : summary.attention.slice(0, ATTENTION_SHOWN);
  const stopById = new Map(board.stops.map((s) => [s.id, s] as const));
  const everyday = summary.everyday ? `${COPY.everydayNow} ${summary.everyday.figure}` : COPY.everydayUnknown;
  const needs = summary.attention.length;
  const quick = (
    <div className="journey-summary__actions">
      <h3 className="journey-visually-hidden">{COPY.summaryActions}</h3>
      {summary.quickActions.map((a) => (
        <button key={a.id} type="button" className={a.primary ? "journey-action journey-action--primary" : "journey-action"} data-action-id={a.id} onClick={() => runJourneyAction(actions, a.call)}>
          {a.label}
        </button>
      ))}
    </div>
  );
  return (
    <section className={["journey-summary", expanded ? "is-expanded" : "is-collapsed"].join(" ")} aria-labelledby={`${id}-title`} data-journey-summary="">
      <div className="journey-summary__line">
        <div className="journey-summary__heading">
          <h2 id={`${id}-title`} className="journey-summary__period">{summary.periodLabel}</h2>
          {!board.empty && needs > 0 ? (
            <span className="journey-summary__badge" data-glance-attention={needs}>
              <span className="journey-summary__badge-mark" aria-hidden="true" />
              <span className="journey-summary__badge-count">{needs}</span>
              <span className="journey-visually-hidden"> need{needs === 1 ? "s" : ""} attention</span>
            </span>
          ) : null}
        </div>
        <p className="journey-summary__glance">
          {board.empty ? COPY.emptyTitle : summary.everyday ? (
            <><span className="journey-summary__glance-label">{COPY.everydayNow}</span> <span className="journey-summary__glance-figure">{summary.everyday.figure}</span></>
          ) : COPY.everydayUnknown}
          {!board.empty && needs === 0 ? <span className="journey-visually-hidden"> · {attentionCount(0)}</span> : null}
        </p>
        <button type="button" className="journey-summary__toggle" aria-expanded={expanded} aria-controls={`${id}-details`} aria-label={expanded ? COPY.hideSummary : COPY.showSummary} onClick={onToggle}>
          <span aria-hidden="true">{expanded ? "Less" : "More"}</span>
        </button>
      </div>
      <div id={`${id}-details`} className="journey-summary__details">
        <div className="journey-summary__where">
          <h3 className="journey-visually-hidden">{COPY.summaryWhere}</h3>
          <p className="journey-summary__today">{longDate(board.today)}</p>
          <p className="journey-summary__everyday" data-everyday="">{everyday}</p>
          {!board.empty ? <p className="journey-summary__leaving">{summary.leavingWords}</p> : null}
          {freshnessNote ? <p className="journey-summary__freshness">{freshnessNote}</p> : null}
        </div>
        {quick}
        <div className="journey-summary__body">
        {board.empty ? (
          <div className="journey-empty">
            <h3>{COPY.emptyTitle}</h3>
            <p>{COPY.emptyBody}</p>
          </div>
        ) : (
          <>
            <div className="journey-summary__attention">
              <h3>{COPY.summaryAttention} <span className="journey-summary__count" data-attention-count={summary.attention.length}>{summary.attention.length}</span></h3>
              {summary.attention.length ? (
                <ul>
                  {attention.map((item) => (
                    <li key={item.id}>
                      {item.stopId && stopById.has(item.stopId) ? (
                        <button type="button" className="journey-summary__item" data-select={item.stopId} onClick={() => onSelect(item.stopId!)}>{item.words}</button>
                      ) : (
                        <span className="journey-summary__need">
                          <span>{item.words}</span>
                          <button type="button" className="journey-action" data-attention-call={item.id} onClick={() => runJourneyAction(actions, item.call)}>{callWords(item.call)}</button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="journey-panel__quiet">{COPY.summaryNoAttention}</p>}
              {summary.attention.length > ATTENTION_SHOWN ? (
                <button type="button" className="journey-summary__more" aria-expanded={allAttention} onClick={() => setAllAttention((v) => !v)}>
                  {allAttention ? "Show fewer" : `Show all ${summary.attention.length}`}
                </button>
              ) : null}
            </div>
            <div className="journey-summary__next">
              <h3>{COPY.summaryNext}</h3>
              {summary.next.length ? (
                <ul>
                  {summary.next.slice(0, NEXT_SHOWN).map((sid) => {
                    const stop = stopById.get(sid);
                    if (!stop) return null;
                    const row = rows.get(sid);
                    return (
                      <li key={sid}>
                        <button type="button" className="journey-summary__item" data-select={sid} onClick={() => onSelect(sid)}>
                          <span className="journey-summary__item-date">{shortDate(stop.date)}</span>
                          <span className="journey-summary__item-label">{stop.label}</span>
                          {row?.amountText ? <span className="journey-summary__item-amount">{row.amountText}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="journey-panel__quiet">{COPY.summaryNothingNext}</p>}
            </div>
          </>
        )}
        </div>
      </div>
    </section>
  );
}
