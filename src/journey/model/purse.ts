/**
 * The purse chip: "Everyday · now" (the camp card's figure, read in summary.ts) and, apart
 * from it, today's expected pay. Expected pay is never added to Everyday: the two are separate fields and nothing here
 * sums them. Fund contributions land in the Fund, not in Everyday, so they are not "pay expected today".
 */
import { isFundStop, type Purse, type PurseExpected, type Stop } from "../contracts.ts";
import type { BoardSummary } from "./summary.ts";
import { knownCents } from "./money.ts";

export function purseOf(everyday: BoardSummary["everyday"], stops: readonly Stop[], today: string): Purse {
  const expectedToday: PurseExpected[] = stops
    .filter(stop => stop.kind === "income" && stop.status === "expected" && stop.date === today && !isFundStop(stop))
    .map(stop => ({ stopId: stop.id, label: stop.label, amountCents: knownCents(stop) }));
  return { everyday: everyday ? { ...everyday } : null, expectedToday };
}
