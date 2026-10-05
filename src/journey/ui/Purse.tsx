/**
 * The purse chip (L4): "Everyday $X" and, on its own line, today's expected pay — printed apart, never summed
 * (contracts `Purse`). Shown for today's chapter and the Week; elsewhere only Everyday. Words from model/words.ts.
 */
import type { Purse as PurseModel } from "../contracts.ts";
import { MAP_WORDS } from "../model/index.ts";
import { money } from "./copy.ts";

export function Purse({ purse, showToday }: { purse: PurseModel; showToday: boolean }) {
  const everyday = purse.everyday && purse.everyday.cents !== null ? purse.everyday.figure : null;
  const expected = showToday ? purse.expectedToday : [];
  const lines = expected.map((e) => ({ id: e.stopId, amount: e.amountCents === null ? null : `+${money(e.amountCents)}`, words: MAP_WORDS.purse.expectedToday(e.label) }));
  const aria = [
    everyday ? `${MAP_WORDS.purse.everyday} ${everyday}` : MAP_WORDS.purse.everydayUnknown,
    ...lines.map((l) => `${l.amount ?? MAP_WORDS.stack.unknown} ${l.words}`),
    lines.length ? MAP_WORDS.purse.notCounted : "",
  ].filter(Boolean).join(". ");
  return (
    <div className="journey-purse" role="status" aria-label={aria} data-journey-purse="">
      <span className="journey-purse__p1" data-purse-everyday="">{everyday ? <>Everyday <b>{everyday}</b></> : MAP_WORDS.purse.everydayUnknown}</span>
      {lines.map((l) => (
        <span key={l.id} className="journey-purse__p2" data-purse-expected={l.id}>{l.amount ? <b>{l.amount}</b> : null} {l.words}</span>
      ))}
    </div>
  );
}
