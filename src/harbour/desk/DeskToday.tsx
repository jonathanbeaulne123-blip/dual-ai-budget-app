import { useMemo } from "react";
import { CampCard } from "../glass/CampCard.tsx";
import { campCardModel } from "../glass/campCardModel.ts";
import { spaceForView, stripLedger } from "../glass/dayLedger.ts";
import "../glass/glass.css";
import type { DeskPageProps } from "./types.ts";

/**
 * Today — the Desk's front page, and the camp card in full (Tool Atlas §3.5:
 * "Today *is* the camp card in full"). The Desk renders the very `CampCard`
 * the island's dock renders, open, over the very same read models
 * (`stripLedger` → `campCardModel`, which read `todayModel` and
 * `personalModel`), so the flat twin and the glass cannot drift: parity by
 * construction.
 *
 * The Desk's own header owns the Ours | Mine switch, so the card's pill is
 * not drawn here; every door goes through the Desk's `onOpen`. Nothing on
 * this page moves money.
 */
export function DeskToday({ household, memberId, scope, today, reading, onOpen, onTalk }: DeskPageProps) {
  const space = spaceForView(scope);
  const ledger = useMemo(() => stripLedger({ household, memberId, space, today }), [household, memberId, space, today]);
  const model = useMemo(() => campCardModel({ household, memberId, space, today, ledger, reading }), [household, memberId, space, today, ledger, reading]);
  const sitdown = model.line3.kind === "needs" ? model.line3.sitdown : null;
  return <div className="desk-today desk-today--card" data-desk-scope={scope === "personal" ? "personal" : undefined} data-desk-sitdown={sitdown?.why}>
    <CampCard model={model} space={space} expanded variant="page"
      onOpenBank={() => onOpen("queen")}
      onOpenCellar={() => onOpen("cellar-bills")}
      onOpenCalendar={date => onOpen("calendar", date)}
      onOpen={onOpen}
      onRecord={() => onOpen("shift")}
      onTalk={onTalk}
      onOpenBooks={() => onOpen("books")}
      onStepIn={() => onOpen("journey")}
      onWhatChanged={() => onOpen("books")} />
  </div>;
}
