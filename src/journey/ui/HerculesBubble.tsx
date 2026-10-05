/**
 * Hercules's bubble (L4) and the checklist sheet it opens.
 *
 * Bubble — today's chapter (Month): "N things this week" + the next leaving stop in the model's words + the
 * "N to check" chip; Week: collapses to a pill ("N this week" + chip); another chapter: what that month holds and a
 * "Back to now" chip. Year hides it (the twelve minis speak). Pressing it opens the checklist (or goes back to now).
 *
 * Checklist — sections To check (THE `board.toCheck`, ruling 1), This week (`digest.weekStopIds`), Waiting on you
 * (`digest.waitingOnYou`), Chapter (`digest.chapter`) and Repeating reminders (the App's `dueReview`). Rows carry
 * state DOTS, never checkboxes: looking through the list doesn't post anything (said at the foot). A stop row opens
 * that stop's sheet; an item without a stop has one labelled button that runs its call.
 */
import type { ReactNode } from "react";
import type { AttentionItem, JourneyBoardActions, JourneyBoardV2, ListRow, Stop } from "../contracts.ts";
import { runJourneyAction } from "../contracts.ts";
import { MAP_WORDS, pinnedLabel, shortDate } from "../model/index.ts";
import { callWords, COPY, monthName } from "./copy.ts";
import { PanelFrame, signedAmount, StateDot } from "./StopPanel.tsx";

export type BubbleProps = {
  board: JourneyBoardV2;
  rows: Map<string, ListRow>;
  mode: "today" | "week" | "other";
  chapterId: string;
  onOpen(): void;
  onBackToNow(): void;
};

export function HerculesBubble({ board, rows, mode, chapterId, onOpen, onBackToNow }: BubbleProps) {
  const toCheck = board.toCheck.length;
  const weekCount = board.digest.weekStopIds.length;
  let b1: string, b2: string | null = null, lead: string | null = null, chip: string, now = false;
  if (mode === "week") {
    b1 = COPY.thisWeekShort(weekCount);
    chip = MAP_WORDS.toCheckCount(toCheck);
  } else if (mode === "today") {
    b1 = COPY.thingsThisWeek(weekCount);
    const next = board.digest.nextLeavingStopId ? board.stops.find((s) => s.id === board.digest.nextLeavingStopId) : undefined;
    const row = next ? rows.get(next.id) : undefined;
    lead = next ? `${next.label}${row?.amountText ? ` ${row.amountText.split(" · ")[0]}` : ""}` : null;
    b2 = next ? [shortDate(next.date), row?.statusText].filter(Boolean).join(" · ") : null;
    chip = MAP_WORDS.toCheckCount(toCheck);
  } else {
    const stops = board.stops.filter((s) => s.chapterId === chapterId);
    const checks = stops.filter((s) => board.toCheck.includes(s.id)).length;
    b1 = stops.length ? `${monthName(chapterId)} · ${COPY.onTheMap(stops.length)}` : MAP_WORDS.nothingOnTheMap;
    b2 = checks ? MAP_WORDS.toCheckCount(checks) : null;
    chip = COPY.backToNow;
    now = true;
  }
  const aria = [b1, lead ? `${COPY.leavingNext} · ${lead}` : null, b2, chip].filter(Boolean).join(". ");
  return (
    <button type="button" className={["journey-bubble", mode === "week" ? "journey-bubble--mini" : ""].filter(Boolean).join(" ")} aria-haspopup={now ? undefined : "dialog"} aria-label={aria} data-journey-bubble={mode}
      onClick={now ? onBackToNow : onOpen}>
      <span className="journey-bubble__text">
        <span className="journey-bubble__b1">{b1}</span>
        {(b2 || lead) && mode !== "week" ? <span className="journey-bubble__b2">{lead ? <><b>{lead}</b> · </> : null}{b2}</span> : null}
      </span>
      <span className={["journey-bubble__chip", now ? "journey-bubble__chip--now" : ""].filter(Boolean).join(" ")} aria-hidden="true">{chip}</span>
    </button>
  );
}

export type ChecklistProps = {
  board: JourneyBoardV2;
  rows: Map<string, ListRow>;
  actions: JourneyBoardActions;
  /** The Week's overdue pile: the "To check" section only, headed by the pinned words. */
  pinned?: boolean;
  dueReview?: { count: number } | null;
  onOpenStop(id: string): void;
  onClose(): void;
  headingRef?: (el: HTMLHeadingElement | null) => void;
};

function StopRow({ stop, row, onOpen, withDate }: { stop: Stop; row: ListRow | undefined; onOpen(id: string): void; withDate?: boolean }) {
  const amount = signedAmount(stop, row?.amountText ?? "");
  return (
    <li>
      <button type="button" className="journey-row__main" data-open-stop={stop.id} onClick={() => onOpen(stop.id)}>
        <StateDot stop={stop} />
        <span className="journey-row__text">
          <b className="journey-row__label">{stop.label}</b>
          <span className="journey-row__meta">{withDate ? <span className="journey-row__date">{shortDate(stop.date)}</span> : null}<span className="journey-row__status">{row?.statusText}</span></span>
        </span>
        {amount ? <span className={["journey-row__amount", amount.startsWith("+") ? "journey-row__amount--in" : ""].filter(Boolean).join(" ")}>{amount}</span> : null}
      </button>
    </li>
  );
}

function ItemRow({ item, actions, onOpen }: { item: AttentionItem; actions: JourneyBoardActions; onOpen(id: string): void }) {
  return (
    <li className="journey-row journey-row--item">
      <span className="journey-dot journey-dot--exp" aria-hidden="true" />
      <span className="journey-row__text"><b className="journey-row__label">{item.words}</b></span>
      {item.stopId ? (
        <button type="button" className="journey-action" data-open-stop={item.stopId} onClick={() => onOpen(item.stopId!)}>{callWords(item.call)}</button>
      ) : (
        <button type="button" className="journey-action" data-action-id={item.id} onClick={() => runJourneyAction(actions, item.call)}>{callWords(item.call)}</button>
      )}
    </li>
  );
}

function Section({ title, count, children, note, id }: { title: string; count: number; children: ReactNode; note?: string; id: string }) {
  return (
    <section className="journey-sect" data-checklist-section={id} aria-label={`${title} · ${count}`}>
      <h3 className="journey-sect__title">{title} <span className="journey-sect__n">{count}</span></h3>
      {note ? <p className="journey-sect__note">{note}</p> : null}
      <ul className="journey-rows">{children}</ul>
    </section>
  );
}

export function ChecklistSheet({ board, rows, actions, pinned, dueReview, onOpenStop, onClose, headingRef }: ChecklistProps) {
  const byId = new Map(board.stops.map((s) => [s.id, s] as const));
  const toCheck = (pinned ? board.week.pileStopIds : board.toCheck).map((id) => byId.get(id)).filter((s): s is Stop => Boolean(s));
  const week = board.digest.weekStopIds.map((id) => byId.get(id)).filter((s): s is Stop => Boolean(s));
  const due = dueReview && dueReview.count > 0 ? dueReview.count : 0;
  const kick = `${COPY.herculesList} · ${pinned ? `pinned to ${shortDate(board.week.from)}` : shortDate(board.today)}`;
  const title = pinned ? pinnedLabel(toCheck.length, board.week.from) : COPY.checklistTitle(board.toCheck.length);
  const everyday = board.purse.everyday && board.purse.everyday.cents !== null ? `${MAP_WORDS.purse.everyday} ${board.purse.everyday.figure}` : MAP_WORDS.purse.everydayUnknown;
  return (
    <PanelFrame kindWords={kick} title={title} onClose={onClose} className="journey-panel--checklist" headingRef={headingRef} dialog>
      <p className="journey-panel__sub">{pinned ? MAP_WORDS.checklist.pinnedNote : `${everyday} · ${MAP_WORDS.purse.notCounted}`}</p>
      {toCheck.length ? (
        <Section id="to-check" title={MAP_WORDS.checklist.toCheck} count={toCheck.length} note={MAP_WORDS.checklist.toCheckNote}>
          {toCheck.map((s) => <StopRow key={s.id} stop={s} row={rows.get(s.id)} onOpen={onOpenStop} withDate />)}
        </Section>
      ) : null}
      {!pinned && week.length ? (
        <Section id="this-week" title={MAP_WORDS.checklist.thisWeek} count={week.length}>
          {week.map((s) => <StopRow key={s.id} stop={s} row={rows.get(s.id)} onOpen={onOpenStop} withDate />)}
        </Section>
      ) : null}
      {!pinned && board.digest.waitingOnYou.length ? (
        <Section id="waiting-on-you" title={MAP_WORDS.checklist.waitingOnYou} count={board.digest.waitingOnYou.length}>
          {board.digest.waitingOnYou.map((item) => <ItemRow key={item.id} item={item} actions={actions} onOpen={onOpenStop} />)}
        </Section>
      ) : null}
      {!pinned && board.digest.chapter.length ? (
        <Section id="chapter" title={MAP_WORDS.checklist.chapter} count={board.digest.chapter.length}>
          {board.digest.chapter.map((item) => <ItemRow key={item.id} item={item} actions={actions} onOpen={onOpenStop} />)}
        </Section>
      ) : null}
      {!pinned && due ? (
        <Section id="reminders" title={MAP_WORDS.checklist.reminders} count={due}>
          <li className="journey-row journey-row--item">
            <span className="journey-dot journey-dot--exp" aria-hidden="true" />
            <span className="journey-row__text"><b className="journey-row__label">{COPY.dueReview(due)}</b><span className="journey-row__item-status">{COPY.dueReviewSub}</span></span>
            <button type="button" className="journey-action" data-action-id="due-review" onClick={() => runJourneyAction(actions, { name: "openDueReview" })}>{callWords({ name: "openDueReview" })}</button>
          </li>
        </Section>
      ) : null}
      <p className="journey-panel__note" data-checklist-note="">{MAP_WORDS.checklist.looking}</p>
    </PanelFrame>
  );
}
