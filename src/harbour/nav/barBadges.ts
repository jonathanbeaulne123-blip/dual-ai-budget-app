import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import type { DateKey } from "../../core/calendar.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import { readHercules, readSnapshot } from "../desk/todayModel.ts";

/**
 * The bar's little things (SIMPLE_VIEW_DESK S7): what the one bar wears at rest.
 *
 * - The Simple-view flip wears the household's Everyday "Now" figure — the
 *   same `fundSnapshot(h, { memberId, view, today }).now` the Desk's Today
 *   leads with — so the button previews the page it opens. Unknown reads the
 *   engraved "—"; personal scope wears nothing (it has no Fund to lead with).
 * - All tools wears a pawprint when Hercules has a fresh suggestion: the top of
 *   the same `discoverySelection` the Desk's Hercules corner reads, when that
 *   card is about something in the books right now (a Health finding, an open
 *   shift, a bill due within the week, a claim still out — tier 0–1). The
 *   standing offers every household always has ("Make sense of this page",
 *   "Find Hercules something to wear") never raise it, and a snoozed or
 *   switched-off card never does either, because the selection already
 *   honours "Not now" and "Don't suggest this".
 *
 * The App owns the household, so it publishes; the bars (the island's, which
 * HarbourWorld mounts, and the App's door edition) subscribe. A tiny external
 * store rather than a prop, so nothing between the App and the island bar has
 * to carry it. Reads only: nothing here writes, posts or moves money.
 */
export type BarBadges = {
  /** Whose bar this is. Null until the App publishes (a bar mounted on its own wears nothing). */
  scope: LedgerView | null;
  /** The household's Everyday "Now", in CAD cents. Null is unknown ("—"), never zero. */
  everydayCents: number | null;
  /** Hercules has a fresh suggestion: the pawprint on All tools. */
  suggestion: boolean;
};

export const NO_BAR_BADGES: BarBadges = Object.freeze({ scope: null, everydayCents: null, suggestion: false });

/** The capability tiers that mean "something in the books is asking" (herculesDiscovery's own ranking). */
export const FRESH_SUGGESTION_TIER = 1;

/** Pure: what the bar wears for this household, member, scope and day. */
export function readBarBadges(household: Household, memberId: string, scope: LedgerView, today: DateKey): BarBadges {
  if (scope !== "household") return { scope, everydayCents: null, suggestion: false };
  const everydayCents = readSnapshot(household, memberId, scope, today)?.now ?? null;
  const top = readHercules(household, memberId, scope, today);
  return { scope, everydayCents, suggestion: Boolean(top && top.candidate.tier <= FRESH_SUGGESTION_TIER) };
}

let current: BarBadges = NO_BAR_BADGES;
const listeners = new Set<() => void>();
const same = (a: BarBadges, b: BarBadges) => a.scope === b.scope && a.everydayCents === b.everydayCents && a.suggestion === b.suggestion;

/** Replace what the bar wears. Quiet when nothing changed. */
export function publishBarBadges(next: BarBadges): void {
  if (same(current, next)) return;
  current = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
const snapshot = () => current;
const serverSnapshot = () => NO_BAR_BADGES;

/** What the bar wears now. */
export function useBarBadges(): BarBadges {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/**
 * The App's side: read once per change of household, member, scope or day, and
 * publish. `null` (no books yet, or the harbour is off) takes everything off.
 */
export function usePublishBarBadges(input: { household: Household; memberId: string; scope: LedgerView; today: DateKey } | null): void {
  const household = input?.household ?? null, memberId = input?.memberId ?? "", scope = input?.scope ?? null, today = input?.today ?? null;
  const badges = useMemo(
    () => household && scope && today ? readBarBadges(household, memberId, scope, today) : NO_BAR_BADGES,
    [household, memberId, scope, today],
  );
  useLayoutEffect(() => { publishBarBadges(badges); }, [badges]);
  useLayoutEffect(() => () => { publishBarBadges(NO_BAR_BADGES); }, []);
}

/**
 * The flip's figure, compact: whole dollars under a thousand, then "$1.2k",
 * "$12k", "$1.2M". Truncated toward zero, so the bar never shows more than
 * the books hold. The full figure is the flip's description.
 */
export function compactCents(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return "—";
  const sign = cents < 0 ? "−" : "";
  const dollars = Math.trunc(Math.abs(cents) / 100);
  const cut = (value: number, digits: number) => (Math.trunc(value * 10 ** digits) / 10 ** digits).toFixed(digits).replace(/\.0$/, "");
  if (dollars < 1000) return `${sign}$${dollars}`;
  if (dollars < 10_000) return `${sign}$${cut(dollars / 1000, 1)}k`;
  if (dollars < 1_000_000) return `${sign}$${Math.trunc(dollars / 1000)}k`;
  return `${sign}$${cut(dollars / 1_000_000, 1)}M`;
}
