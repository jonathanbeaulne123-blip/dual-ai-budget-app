/**
 * The purse chip (L4): "Everyday $X" and, on its own line, today's expected pay — printed apart, never summed
 * (contracts `Purse`). Shown for today's chapter and the Week; elsewhere only Everyday. Words from model/words.ts.
 *
 * - A short gloss says what Everyday is ("money here now", UX #20); it hides where the chip is narrow.
 * - Narrow chips (the phone Week, phones under 360 px) print the expected pay's short line (UX #24); the full words
 *   stay in the chip's accessible name.
 * - An expected pay's `note` (trust M3: a pay is already recorded today) prints under it, model words; nothing is merged.
 * - `statusNote` (offline, or the App's "supported as of …" words) is a third line: the figure is this device's copy
 *   (UX #25). Not a live region — the view has the one announcer (UX #18).
 * - Phones (< 720 px): two lines at most — "Everyday $X" and one short expected line (the note and the status line
 *   hide); the chip is a button whose press opens `PurseSheet` with every line in full (the same model words).
 *   Opening it runs nothing.
 */
import type { ReactNode } from "react";
import type { Purse as PurseModel } from "../contracts.ts";
import { MAP_WORDS, mapMoney, signedMoney } from "../model/index.ts";
import { COPY } from "./copy.ts";
import { PanelFrame } from "./StopPanel.tsx";

type PurseLines = { everyday: string | null; lines: { id: string; amount: string | null; words: string; note: string | null }[] };
function purseLines(purse: PurseModel, showToday: boolean): PurseLines {
  // Printed from the cents with the map's grouped figure ("$4,716.80"); the desk's `figure` string is ungrouped.
  const everyday = purse.everyday && purse.everyday.cents !== null ? mapMoney(purse.everyday.cents) : null;
  const expected = showToday ? purse.expectedToday : [];
  return { everyday, lines: expected.map((e) => ({ id: e.stopId, amount: e.amountCents === null ? null : signedMoney(e.amountCents), words: MAP_WORDS.purse.expectedToday(e.label), note: e.note ?? null })) };
}

export function Purse({ purse, showToday, statusNote, onOpen }: { purse: PurseModel; showToday: boolean; statusNote?: string | null; onOpen?: (from: HTMLElement) => void }) {
  const { everyday, lines } = purseLines(purse, showToday);
  const aria = [
    everyday ? `${MAP_WORDS.purse.everyday} ${everyday} · ${MAP_WORDS.purseGloss}` : MAP_WORDS.purse.everydayUnknown,
    ...lines.map((l) => `${l.amount ?? MAP_WORDS.stack.unknown} ${l.words}${l.note ? `. ${l.note}` : ""}`),
    lines.length ? MAP_WORDS.purse.notCounted : "",
    statusNote ?? "",
  ].filter(Boolean).join(". ");
  const more = lines.some((l) => l.note) || lines.length > 1 || Boolean(statusNote);
  const body: ReactNode = (<>
      <span className="journey-purse__row">
        <span className="journey-purse__p1" data-purse-everyday="">{everyday ? <>Everyday <b>{everyday}</b></> : MAP_WORDS.purse.everydayUnknown}</span>
        {everyday ? <span className="journey-purse__gloss" aria-hidden="true"> · {MAP_WORDS.purseGloss}</span> : null}
      </span>
      {lines.map((l) => (
        <span key={l.id} className="journey-purse__p2" data-purse-expected={l.id}>
          {l.amount ? <b>{l.amount}</b> : null}
          <span className="journey-purse__long"> {l.words}</span>
          <span className="journey-purse__short" aria-hidden="true"> {l.words.split(" · ")[0]}</span>
          {l.note ? <span className="journey-purse__note" data-purse-note="">{l.note}</span> : null}
        </span>
      ))}
      {statusNote ? <span className="journey-purse__p3" data-purse-status="">{statusNote}</span> : null}
      {onOpen && more ? <span className="journey-purse__more" aria-hidden="true">›</span> : null}
  </>);
  // A button only where there is more to read than the chip shows on a phone; otherwise a labelled group.
  return onOpen && more ? (
    <button type="button" className="journey-purse journey-purse--button" aria-label={`${aria}. ${COPY.purseMore}`} aria-haspopup="dialog" data-journey-purse="" data-purse-more="" onClick={(e) => onOpen(e.currentTarget)}>{body}</button>
  ) : (
    <div className="journey-purse" role="group" aria-label={aria} data-journey-purse="">{body}</div>
  );
}

/** The purse in full (a phone's tap on the chip): every line in the model's words, printed apart, never summed. */
export function PurseSheet({ purse, showToday, statusNote, onClose, headingRef }: { purse: PurseModel; showToday: boolean; statusNote?: string | null; onClose(): void; headingRef?: (el: HTMLHeadingElement | null) => void }) {
  const { everyday, lines } = purseLines(purse, showToday);
  return (
    <PanelFrame kindWords={COPY.purseKind} title={everyday ? `${MAP_WORDS.purse.everyday} ${everyday}` : MAP_WORDS.purse.everydayUnknown} onClose={onClose} className="journey-panel--purse" headingRef={headingRef} dialog>
      {everyday ? <p className="journey-panel__sub">{MAP_WORDS.purseGloss}</p> : null}
      {lines.length ? (
        <ul className="journey-rows" data-purse-sheet-lines="">
          {lines.map((l) => (
            <li key={l.id} className="journey-row journey-row--item" data-purse-sheet-line={l.id}>
              <span className="journey-row__text">
                <b className="journey-row__label">{l.amount ?? MAP_WORDS.stack.unknown}</b>
                <span className="journey-row__item-status">{l.words}</span>
                {l.note ? <span className="journey-row__note" data-purse-sheet-note="">{l.note}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {lines.length ? <p className="journey-panel__note">{MAP_WORDS.purse.notCounted}</p> : null}
      {statusNote ? <p className="journey-panel__note" data-purse-sheet-status="">{statusNote}</p> : null}
    </PanelFrame>
  );
}
