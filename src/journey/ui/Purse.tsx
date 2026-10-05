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
 */
import type { Purse as PurseModel } from "../contracts.ts";
import { MAP_WORDS, signedMoney } from "../model/index.ts";

export function Purse({ purse, showToday, statusNote }: { purse: PurseModel; showToday: boolean; statusNote?: string | null }) {
  const everyday = purse.everyday && purse.everyday.cents !== null ? purse.everyday.figure : null;
  const expected = showToday ? purse.expectedToday : [];
  const lines = expected.map((e) => ({ id: e.stopId, amount: e.amountCents === null ? null : signedMoney(e.amountCents), words: MAP_WORDS.purse.expectedToday(e.label), note: e.note ?? null }));
  const aria = [
    everyday ? `${MAP_WORDS.purse.everyday} ${everyday} · ${MAP_WORDS.purseGloss}` : MAP_WORDS.purse.everydayUnknown,
    ...lines.map((l) => `${l.amount ?? MAP_WORDS.stack.unknown} ${l.words}${l.note ? `. ${l.note}` : ""}`),
    lines.length ? MAP_WORDS.purse.notCounted : "",
    statusNote ?? "",
  ].filter(Boolean).join(". ");
  return (
    <div className="journey-purse" role="group" aria-label={aria} data-journey-purse="">
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
    </div>
  );
}
