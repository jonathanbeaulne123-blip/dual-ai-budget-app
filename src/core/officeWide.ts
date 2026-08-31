import type { CategoryActual, MonthSummary } from "./budget.ts";
import { monthEndKey, monthKeyFromDateKey, monthStartKey, type DateKey } from "./calendar.ts";
import type { TipWeather } from "./insights.ts";
import { partitionLedger, type LedgerSection } from "./ledgerView.ts";
import type { InstrumentId, DeskFace } from "./officeLayout.ts";
import type { Household, Transaction } from "./types.ts";

/** Hero instrument — always visible on the wide paper office. */
export const WIDE_HERO_ID: InstrumentId = "blotter";

/** Preferred 2×3 mosaic. Pad and chalk stay off the mosaic (phone C rhyme). */
export const WIDE_MOSAIC_PREF: readonly InstrumentId[] = [
  "wallet",
  "mail",
  "timesheet",
  "jars",
  "lamp",
  "claims",
];

/** Fill mosaic gaps without putting the pad, chalk, or hero on the strip. */
export const WIDE_MOSAIC_FILL: readonly InstrumentId[] = [
  "accounts",
  "calendar",
  "postcard",
  "appointments",
  "cookoff",
];

export const WIDE_MOSAIC_LIMIT = 6;

/** Shared/Personal story tiles live on the paper mosaic, not as a second stacked room. */
export const SHARED_STORY_TILES = ["now", "attention", "change"] as const;
export const PERSONAL_STORY_TILES = ["mine", "position", "movement"] as const;
export type LedgerStoryTileId =
  | (typeof SHARED_STORY_TILES)[number]
  | (typeof PERSONAL_STORY_TILES)[number];
export type PaperHomeMosaicItem =
  | { slot: "story"; id: LedgerStoryTileId }
  | { slot: "instrument"; id: InstrumentId };

export function isLedgerStoryTileId(value: string): value is LedgerStoryTileId {
  return (SHARED_STORY_TILES as readonly string[]).includes(value)
    || (PERSONAL_STORY_TILES as readonly string[]).includes(value);
}

/** Shared Home: household jobs. Personal Home: worker and folio jobs. */
export const SHARED_DESK_PREF: readonly InstrumentId[] = ["wallet", "mail", "claims", "jars", "postcard", "lamp"];
export const PERSONAL_DESK_PREF: readonly InstrumentId[] = ["timesheet", "wallet", "jars", "mail", "accounts", "lamp"];

/** Six Home tiles: three ledger-purpose scraps, then three desk instruments. */
export function paperHomeMosaic(input: {
  view: "household" | "personal";
  hidden: Iterable<InstrumentId>;
  lampLit: boolean;
  expanded?: InstrumentId | "window" | null;
}): PaperHomeMosaicItem[] {
  const storyIds = input.view === "personal" ? PERSONAL_STORY_TILES : SHARED_STORY_TILES;
  const items: PaperHomeMosaicItem[] = storyIds.map((id) => ({ slot: "story" as const, id }));
  const remaining = Math.max(0, WIDE_MOSAIC_LIMIT - items.length);
  const hidden = input.hidden instanceof Set ? input.hidden : new Set(input.hidden);
  const pref = input.view === "personal" ? PERSONAL_DESK_PREF : SHARED_DESK_PREF;
  const fill: InstrumentId[] = [];
  const take = (id: InstrumentId) => {
    if (fill.length >= remaining) return;
    if (fill.includes(id)) return;
    if (id === WIDE_HERO_ID || id === "calculator" || id === "chalkboard") return;
    if (hidden.has(id) && !(id === "lamp" && input.lampLit)) return;
    fill.push(id);
  };
  if (input.lampLit) take("lamp");
  for (const id of pref) take(id);
  const guest = input.expanded;
  if (guest && guest !== "window") take(guest);
  for (const id of WIDE_MOSAIC_FILL) take(id);
  for (const id of fill.slice(0, remaining)) items.push({ slot: "instrument", id });
  return items.slice(0, WIDE_MOSAIC_LIMIT);
}

export type PaperBarTone = "pine" | "copper" | "ink";

export type PaperBarRow = {
  label: string;
  cents: number;
  tone: PaperBarTone;
};

export type PaperSparkPoint = {
  label: string;
  cents: number;
};

/** Visible mosaic ids. Hidden instruments drop out; lamp joins when Health is lit. */
export function wideMosaicIds(input: {
  hidden: Iterable<InstrumentId>;
  lampLit: boolean;
  expanded?: InstrumentId | "window" | null;
}): InstrumentId[] {
  const hidden = input.hidden instanceof Set ? input.hidden : new Set(input.hidden);
  const picked: InstrumentId[] = [];
  const take = (id: InstrumentId) => {
    if (picked.length >= WIDE_MOSAIC_LIMIT) return;
    if (picked.includes(id)) return;
    if (id === WIDE_HERO_ID || id === "calculator" || id === "chalkboard") return;
    if (hidden.has(id) && !(id === "lamp" && input.lampLit)) return;
    picked.push(id);
  };
  for (const id of WIDE_MOSAIC_PREF) take(id);
  if (input.lampLit) take("lamp");
  const guest = input.expanded;
  if (guest && guest !== "window") take(guest);
  for (const id of WIDE_MOSAIC_FILL) take(id);
  return picked.slice(0, WIDE_MOSAIC_LIMIT);
}

export function wideDrawerIds(mosaic: InstrumentId[], options?: { includeHero?: boolean }): InstrumentId[] {
  const shown = new Set<InstrumentId>(["calculator", ...mosaic]);
  if (options?.includeHero !== false) shown.add(WIDE_HERO_ID);
  const extras: InstrumentId[] = [
    WIDE_HERO_ID,
    "chalkboard",
    "wardrobe",
    "tictactoe",
    "hangman",
    ...WIDE_MOSAIC_FILL,
  ];
  return extras.filter((id, index) => extras.indexOf(id) === index && !shown.has(id));
}

/** Posted Money in / Money out / leftover spend. Unpaid bills never enter. */
export type DeskMonthSeals = {
  inCents: number;
  outCents: number;
  leftoverCents: number;
};

export function deskMonthSeals(
  month: Pick<MonthSummary, "incomeActualCents" | "expenseActualCents">,
): DeskMonthSeals {
  return {
    inCents: month.incomeActualCents,
    outCents: month.expenseActualCents,
    leftoverCents: month.incomeActualCents - month.expenseActualCents,
  };
}

export function monthInOutBars(
  month: Pick<MonthSummary, "incomeActualCents" | "expenseActualCents">,
): PaperBarRow[] {
  const income = month.incomeActualCents;
  const expense = month.expenseActualCents;
  if (income === 0 && expense === 0) return [];
  return [
    { label: "In", cents: income, tone: "pine" },
    { label: "Out", cents: expense, tone: "copper" },
  ];
}

export function categorySpendBars(categories: CategoryActual[], limit = 4): PaperBarRow[] {
  return categories
    .filter((row) => row.type === "expense" && row.actualCents > 0)
    .sort((left, right) => right.actualCents - left.actualCents)
    .slice(0, limit)
    .map((row) => ({ label: row.name, cents: row.actualCents, tone: "ink" as const }));
}

export function tipWeekdaySpark(weather: TipWeather): PaperSparkPoint[] {
  const points = weather.byWeekday.map((row) => ({
    label: row.weekday.slice(0, 2),
    cents: row.tipsCents,
  }));
  if (points.every((row) => row.cents === 0)) return [];
  return points;
}

export function paperBarPercents(rows: PaperBarRow[]): { row: PaperBarRow; pct: number }[] {
  const max = Math.max(0, ...rows.map((row) => row.cents));
  return rows.map((row) => ({
    row,
    pct: max <= 0 ? 0 : Math.round((row.cents / max) * 100),
  }));
}

export function isClassicDesk(face: DeskFace | undefined): boolean {
  return face === "classic";
}

/** Posted income or expense rows in the civil month of `today`. Refunds are not expenses. */
export function monthPostedRows(
  household: Household,
  today: DateKey,
  section: Extract<LedgerSection, "income" | "expenses">,
): Transaction[] {
  const monthKey = monthKeyFromDateKey(today);
  const start = monthStartKey(monthKey);
  const end = monthEndKey(monthKey);
  const rows = household.transactions.filter((tx) => (
    !tx.isDuplicate && tx.date >= start && tx.date <= end
  ));
  return partitionLedger(rows)[section];
}
