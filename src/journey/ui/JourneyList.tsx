/**
 * The readable list equivalent (T4): every stop, cluster and crossroads from `boardToList(board)` — the same ids and
 * the SAME actions as the map panel (each row's buttons run the row's `actions` through `runJourneyAction`) — grouped
 * by chapter in chronological order, with past / this month / upcoming told apart in words, not colour alone.
 */
import { useEffect, useRef } from "react";
import type { JourneyBoard, JourneyBoardActions, ListRow } from "../contracts.ts";
import { runJourneyAction } from "../contracts.ts";
import { COPY, shortDate } from "./copy.ts";
import { cssSafe } from "./Marks.tsx";
import { ActionButtons } from "./StopPanel.tsx";

export const journeyRowDomId = (id: string) => `journey-row-${cssSafe(id)}`;
export const journeyListChapterDomId = (id: string) => `journey-list-${cssSafe(id)}`;

type Group = { chapter: ListRow; items: ListRow[]; state: "past" | "open" | "upcoming" };

function groupRows(board: JourneyBoard, rows: readonly ListRow[]): { groups: Group[]; undated: ListRow[] } {
  const stateOf = new Map(board.chapters.map((c) => [c.id, c.state] as const));
  const groups: Group[] = [];
  const undated: ListRow[] = [];
  for (const row of rows) {
    if (row.level === "chapter") { groups.push({ chapter: row, items: [], state: stateOf.get(row.chapterId) ?? "past" }); continue; }
    if (row.date === null) { undated.push(row); continue; }
    groups.at(-1)?.items.push(row);
  }
  return { groups, undated };
}

function Row({ row, actions }: { row: ListRow; actions: JourneyBoardActions }) {
  return (
    <li id={journeyRowDomId(row.id)} className={`journey-row journey-row--${row.level} journey-row--depth-${row.depth}`} data-row-id={row.id} tabIndex={-1}>
      <div className="journey-row__main">
        <span className="journey-row__kind">{row.kindLabel}</span>
        <span className="journey-row__label">{row.label}</span>
        {row.date ? <span className="journey-row__date">{shortDate(row.date)}</span> : null}
      </div>
      {row.amountText || row.statusText ? (
        <div className="journey-row__words">
          {row.amountText ? <span className="journey-row__amount">{row.amountText}</span> : null}
          {row.statusText ? <span className="journey-row__status">{row.statusText}</span> : null}
        </div>
      ) : null}
      <ActionButtons actions={row.actions} run={(a) => runJourneyAction(actions, a.call)} className="journey-row__actions" />
    </li>
  );
}

export type JourneyListProps = { board: JourneyBoard; rows: readonly ListRow[]; actions: JourneyBoardActions };

export function JourneyList({ board, rows, actions }: JourneyListProps) {
  const { groups, undated } = groupRows(board, rows);
  // Open on this month (the list scrolls inside the board; the page does not move).
  const list = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = list.current, open = el?.querySelector<HTMLElement>(".journey-list__chapter--open");
    if (el && open && el.scrollHeight > el.clientHeight) el.scrollTop = Math.max(0, open.offsetTop - el.offsetTop);
  }, []);
  return (
    <section className="journey-list" aria-label={COPY.listLabel} ref={list}>
      {board.empty ? (
        <div className="journey-empty">
          <h3>{COPY.emptyTitle}</h3>
          <p>{COPY.emptyBody}</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.chapter.id} className={`journey-list__chapter journey-list__chapter--${g.state}`} aria-labelledby={journeyListChapterDomId(g.chapter.id)} data-chapter-id={g.chapter.id}>
            <h3 id={journeyListChapterDomId(g.chapter.id)} className="journey-list__heading" tabIndex={-1}>
              <span className="journey-list__month">{g.chapter.label}</span>
              <span className="journey-list__state">{g.chapter.statusText}</span>
            </h3>
            {g.items.length ? (
              <ol className="journey-list__rows">
                {g.items.map((row) => <Row key={row.id} row={row} actions={actions} />)}
              </ol>
            ) : null}
          </section>
        ))
      )}
      {undated.length ? (
        <section className="journey-list__chapter journey-list__chapter--undated" aria-label={COPY.undatedMemories}>
          <h3 className="journey-list__heading">{COPY.undatedMemories}</h3>
          <ol className="journey-list__rows">{undated.map((row) => <Row key={row.id} row={row} actions={actions} />)}</ol>
        </section>
      ) : null}
      {board.limitations.length ? (
        <footer className="journey-list__limits">
          <h3>{COPY.limitationsTitle}</h3>
          <ul>{board.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </footer>
      ) : null}
    </section>
  );
}
