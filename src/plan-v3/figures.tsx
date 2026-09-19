import { useMemo } from "react";
import type { DateKey } from "../core/calendar.ts";
import { openChapterFor } from "../core/chapters.ts";
import { projectKittyNest } from "../core/kittyNest.ts";
import { queenBody, queenBuds, queenFeet, queenStill, queenVine } from "../core/queenPresentation.ts";
import type { Household, LedgerView } from "../core/types.ts";
import { NestPortrait } from "../kitty/KittyNest.tsx";
import { QueenFigure } from "../queen/QueenFigure.tsx";
import type { FundKey } from "./model.ts";

/**
 * The figures the rest screen stands its readings beside. These are the app's
 * own flat renderings — the Still Queen and each nest bank's studio portrait —
 * never redrawn here. Prepare has no model of its own yet, so it stands as its
 * nest bank's studio cat (labelled). Readings always sit beside a figure, never on it.
 */
export function QueenNowFigure({ household, memberId, view, today, grave, agreed }: {
  household: Household; memberId: string; view: LedgerView; today: DateKey; grave: boolean; agreed: boolean;
}) {
  const look = useMemo(() => {
    const nest = projectKittyNest(household, memberId, view, today);
    const chapter = view === "household" ? openChapterFor(household) : null;
    return {
      still: queenStill({ state: grave ? "needs-us" : "covered", destination: "fund" }, "current"),
      body: queenBody(nest, "current", 0),
      vine: queenVine(household, chapter, today),
      buds: queenBuds(nest, 3).length,
    };
  }, [household, memberId, view, today, grave]);
  return (
    <span className="pv3-queen" data-brow={look.still.brow} data-crown={agreed ? "both" : "unlit"} aria-hidden="true">
      <QueenFigure still={look.still} body={look.body} crown={agreed ? "both" : "unlit"} vine={look.vine} buds={look.buds} feet={queenFeet([])} />
    </span>
  );
}

export function FundFigure({ household, memberId, view, today, fund }: { household: Household; memberId: string; view: LedgerView; today: DateKey; fund: FundKey }) {
  const bank = useMemo(() => projectKittyNest(household, memberId, view, today).categories.find(row => row.category === fund) ?? null, [household, memberId, view, today, fund]);
  const theme = typeof document === "undefined" ? "classic" : document.documentElement.dataset.theme ?? "classic";
  if (!bank) return null;
  return (
    <span className="pv3-fig" aria-hidden="true">
      <NestPortrait bank={bank} theme={theme} />
      {fund === "prepare" && <span className="pv3-standin">studio cat</span>}
    </span>
  );
}

/** A little Queen for a contribution stone: a tiny planter with her crown of blooms (a mark, not her portrait). */
export function MiniQueen({ x, y }: { x: number; y: number }) {
  return (
    <g className="pv3-miniq" transform={`translate(${x} ${y})`} aria-hidden="true">
      <path d="M4 20h14l-2 7H6z" className="pv3-miniq__pot" />
      <path d="M6 20q1-7 5-7t5 7z" className="pv3-miniq__body" />
      <circle cx="11" cy="10" r="4" className="pv3-miniq__body" />
      <circle cx="7.5" cy="6" r="1.8" className="pv3-miniq__bloom" /><circle cx="11" cy="4.5" r="1.8" className="pv3-miniq__bloom" /><circle cx="14.5" cy="6" r="1.8" className="pv3-miniq__bloom" />
    </g>
  );
}

export function Paw({ on, tone, title }: { on: boolean; tone: "a" | "b"; title?: string }) {
  return (
    <svg className={`pv3-paw pv3-paw--${tone}${on ? " is-on" : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {title ? <title>{title}</title> : null}
      <ellipse cx="12" cy="15.5" rx="5" ry="4.2" /><circle cx="6" cy="9.5" r="2.1" /><circle cx="10" cy="6" r="2.1" /><circle cx="14" cy="6" r="2.1" /><circle cx="18" cy="9.5" r="2.1" />
    </svg>
  );
}
