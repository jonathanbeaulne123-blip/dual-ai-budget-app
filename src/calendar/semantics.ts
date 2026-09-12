import type { BoardItem, BoardKind } from "../core/board.ts";

/**
 * One registry of what a calendar thing *is*. The glyph, the user's word, the
 * hue family, the visibility layer and the certainty stroke all come from
 * here so the month grid, day lists, Home widget, legend and filters agree.
 *
 * Meaning travels on three carriers — glyph, edge and hue — and never on
 * colour alone (2026-09-11 decision: theme colour is optional for meaning).
 * Hue families are kinds, not categories or amounts: nine is the ceiling
 * before a legend stops helping. Posted/scheduled keeps ink/copper for
 * itself; no kind hue may borrow copper.
 */
export type KindLayer =
  | "bill" | "paycheck" | "subscription" | "potential-expense" | "event"
  | "work" | "visit" | "detected" | "other" | "google";
export type KindHue = "pay" | "bill" | "subscription" | "planned" | "work" | "visit" | "owed" | "event" | "quiet";
export type KindStroke = "solid" | "dashed" | "dotted";
export type KindEntry = { glyph: string; word: string; hue: KindHue; layer: KindLayer; stroke: KindStroke };

export const KIND_REGISTRY: Record<BoardKind, KindEntry> = {
  bill: { glyph: "▣", word: "Bill", hue: "bill", layer: "bill", stroke: "solid" },
  subscription: { glyph: "↻", word: "Subscription", hue: "subscription", layer: "subscription", stroke: "solid" },
  paycheck: { glyph: "↓", word: "Pay", hue: "pay", layer: "paycheck", stroke: "solid" },
  "work-pay": { glyph: "↓", word: "Pay", hue: "pay", layer: "work", stroke: "solid" },
  "work-tip": { glyph: "✦", word: "Tips", hue: "pay", layer: "work", stroke: "solid" },
  "work-tipout": { glyph: "↑", word: "Tip-out", hue: "work", layer: "work", stroke: "solid" },
  shift: { glyph: "◷", word: "Shift", hue: "work", layer: "work", stroke: "solid" },
  "shift-envelope": { glyph: "✉", word: "Shift plan", hue: "work", layer: "work", stroke: "dashed" },
  "potential-expense": { glyph: "◇", word: "Planned cost", hue: "planned", layer: "potential-expense", stroke: "dashed" },
  visit: { glyph: "⌂", word: "Visit", hue: "visit", layer: "visit", stroke: "solid" },
  claim: { glyph: "↩", word: "Owed", hue: "owed", layer: "visit", stroke: "solid" },
  event: { glyph: "◆", word: "Event", hue: "event", layer: "event", stroke: "solid" },
  google: { glyph: "↗", word: "Google event", hue: "quiet", layer: "google", stroke: "dashed" },
  detected: { glyph: "?", word: "Suggested", hue: "quiet", layer: "detected", stroke: "dotted" },
  other: { glyph: "○", word: "Other", hue: "quiet", layer: "other", stroke: "solid" },
};

export const KIND_LAYERS: readonly (readonly [KindLayer, string])[] = [
  ["bill", "Bills"], ["paycheck", "Paycheques"], ["subscription", "Subscriptions"],
  ["potential-expense", "Planned costs"], ["event", "Hearth events"],
  ["work", "Shifts and work pay"], ["visit", "Appointments and owed"],
  ["detected", "Suggested patterns"], ["other", "Other reminders"], ["google", "Google events"],
] as const;

const FALLBACK: KindEntry = KIND_REGISTRY.event;
export const kindEntry = (kind: string): KindEntry => KIND_REGISTRY[kind as BoardKind] ?? FALLBACK;

/** Stable meaning first; theme and ownership colour can never replace this label. */
export const CALENDAR_KINDS: Record<BoardKind, string> = Object.fromEntries(
  Object.entries(KIND_REGISTRY).map(([kind, entry]) => [kind, `${entry.glyph} ${entry.word}`]),
) as Record<BoardKind, string>;
export const calendarKindLabel = (kind: string) => { const entry = kindEntry(kind); return `${entry.glyph} ${entry.word}`; };
export const calendarKindGlyph = (kind: string) => kindEntry(kind).glyph;
export const calendarKindWord = (kind: string) => kindEntry(kind).word;

/** The visibility layer a board item belongs to. Layers group kinds the way people filter, not the way the code produces them. */
export const kindLayerFor = (item: Pick<BoardItem, "kind">): KindLayer => kindEntry(item.kind).layer;

/** Class names that carry the three meaning channels to CSS: `kind-<kind> hue-<hue> stroke-<stroke>`. */
export const kindClassNames = (kind: string): string => {
  const entry = kindEntry(kind);
  return `kind-${kind} hue-${entry.hue} stroke-${entry.stroke}`;
};

/** Kinds present in a set of items, in registry order, so a legend lists only what is on screen. */
export function kindsPresent(items: readonly Pick<BoardItem, "kind">[]): BoardKind[] {
  const seen = new Set(items.map(item => item.kind));
  return (Object.keys(KIND_REGISTRY) as BoardKind[]).filter(kind => seen.has(kind));
}
