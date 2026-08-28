import type { CategoryActual, MonthSummary } from "./budget.ts";
import type { HearthTab } from "./hercules.ts";
import type { TipWeather } from "./insights.ts";
import type { InstrumentId, DeskFace } from "./officeLayout.ts";

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

export function wideDrawerIds(mosaic: InstrumentId[]): InstrumentId[] {
  const shown = new Set<InstrumentId>([WIDE_HERO_ID, "calculator", ...mosaic]);
  const extras: InstrumentId[] = [
    "chalkboard",
    "wardrobe",
    "tictactoe",
    "hangman",
    ...WIDE_MOSAIC_FILL,
  ];
  return extras.filter((id, index) => extras.indexOf(id) === index && !shown.has(id));
}

export type WideMiniKind = "route" | "post" | "instrument";

export type WideMiniTab = {
  id: string;
  label: string;
  kind: WideMiniKind;
  route?: Exclude<HearthTab, "add">;
  instrument?: InstrumentId;
};

export const WIDE_NAV_TABS: readonly WideMiniTab[] = [
  { id: "home", label: "Home", kind: "route", route: "home" },
  { id: "calendar", label: "Cal", kind: "route", route: "calendar" },
  { id: "shift", label: "Shift", kind: "route", route: "shift" },
  { id: "post", label: "Post", kind: "post" },
  { id: "plan", label: "Plan", kind: "route", route: "plan" },
  { id: "ledger", label: "Books", kind: "route", route: "ledger" },
  { id: "more", label: "More", kind: "route", route: "more" },
];

export const WIDE_INSTRUMENT_TAB_LABEL: Partial<Record<InstrumentId, string>> = {
  chalkboard: "Notes",
  wardrobe: "Outfits",
  tictactoe: "Tac",
  hangman: "Hangman",
  accounts: "Accounts",
  calendar: "Board",
  postcard: "Sit-down",
  appointments: "Visits",
  cookoff: "Kitchen",
};

/** Compact strip: phone nav items first, then leftover desk instruments. */
export function wideMiniBrowserTabs(drawer: InstrumentId[]): WideMiniTab[] {
  const extras: WideMiniTab[] = drawer.map((id) => ({
    id,
    label: WIDE_INSTRUMENT_TAB_LABEL[id] ?? id,
    kind: "instrument" as const,
    instrument: id,
  }));
  return [...WIDE_NAV_TABS, ...extras];
}

/** Double-click destination. Null means stay in the Home notebook. */
export function wideInstrumentFullPage(id: InstrumentId): Exclude<HearthTab, "add"> | null {
  if (id === "calendar" || id === "appointments") return "calendar";
  if (id === "accounts") return "ledger";
  if (id === "postcard") return "plan";
  if (id === "timesheet") return "shift";
  if (id === "lamp") return "more";
  return null;
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
