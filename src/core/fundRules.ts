import { monthKeyFromDateKey, type DateKey, type MonthKey } from "./calendar.ts";
import type { NestCategory } from "./kittyNestDesigns.ts";
import type { PlanLine } from "./planSystem.ts";
import type { Category, Household, LedgerView } from "./types.ts";

/**
 * The money model's rules (D-268…D-272, Plan Studio v3, 2026-09-16).
 *
 * Pure. No commands, no projections of the Fund: this file is what every
 * reader and writer asks "which fund does this line belong to?" and "which
 * umbrella does this category live under?". `fundModel.ts` builds the
 * selectors the UI reads on top of it; `kittyNest.ts` asks it for each leaf.
 *
 * Two modes, decided by data, never by a build flag:
 *   - **v1** (no household marker): the answers Hearth has always given —
 *     `v1FundForName` is byte-for-byte the old `nestCategoryFor` regex and the
 *     old fill order (build → prepare → protect). Every golden stays put.
 *   - **v2** (the shared `fundModelRows` marker exists): Prepare holds every
 *     has-to-leave line (bills, subscriptions, loan payments, card interest),
 *     Build holds what we want to leave (goals, investments, RRSP, tip-outs),
 *     Protect is the buffer only and nothing defaults to it, and Everyday is
 *     the Queen's remainder ("Now").
 */

export type FundId = NestCategory;
export const FUND_IDS: readonly FundId[] = ["prepare", "protect", "build", "everyday"];
/** Fill order when money is short (Jonathan, 2026-09-16). Everyday is always the remainder. */
export const FUND_FILL_ORDER = ["prepare", "protect", "build"] as const;
/** The client stamp for a build that understands the v2 money model. */
export const FUND_MODEL_VERSION = 2;
export type FundModelMode = 1 | 2;

export const FUND_LABELS: Readonly<Record<FundId, string>> = { prepare: "Prepare", protect: "Protect", build: "Build", everyday: "Everyday" };
/** What each fund means, in v2 words. "Set aside" is a way of thinking, never a bank move. */
export const FUND_MEANINGS_V2: Readonly<Record<FundId, string>> = {
  prepare: "Money that has to leave: bills, subscriptions, loans",
  protect: "Our buffer for the month we didn't plan",
  build: "Money we want to leave: goals and investing",
  everyday: "Now: what is left for day-to-day",
};

// ---------------------------------------------------------------------------
// Umbrellas: 12 fixed spending parents + 2 that are not spending.

export type UmbrellaId =
  | "home" | "utilities" | "food" | "transport" | "health" | "personal" | "fun" | "travel"
  | "pets-family" | "gifts-giving" | "work-learning" | "money" | "coming-in" | "moving-money";

export type Umbrella = {
  id: UmbrellaId;
  /** The locked `categories` row that carries this umbrella. Existing ids are kept where the meaning matches. */
  rowId: string;
  name: string;
  /** One line that tells a person what goes here. */
  rule: string;
  /** Spending umbrellas take new children and count toward spending. */
  spending: boolean;
  transactionType: "expense" | "income";
  /** A presentation hue for the cellar and the world, keyed by id (never by name). */
  hue: string;
  /** A small glyph for the add-category grid. Decorative. */
  glyph: string;
  sortOrder: number;
};

export const UMBRELLAS: readonly Umbrella[] = [
  { id: "home", rowId: "CAT-HOUSING", name: "Home", rule: "The place itself: rent, owning, fixing, furnishing", spending: true, transactionType: "expense", hue: "#b86b4b", glyph: "🏠", sortOrder: 20 },
  { id: "utilities", rowId: "UMB-UTILITIES", name: "Utilities", rule: "Metered or monthly services that keep the home on", spending: true, transactionType: "expense", hue: "#c9a227", glyph: "💡", sortOrder: 22 },
  { id: "food", rowId: "CAT-FOOD", name: "Food", rule: "Anything we eat or drink, in or out", spending: true, transactionType: "expense", hue: "#6f9a4b", glyph: "🥖", sortOrder: 30 },
  { id: "transport", rowId: "CAT-TRANSPORT", name: "Transport", rule: "Moving us: car, transit, rides", spending: true, transactionType: "expense", hue: "#4b7fa8", glyph: "🚗", sortOrder: 40 },
  { id: "health", rowId: "CAT-HEALTH", name: "Health", rule: "Care for our bodies and minds", spending: true, transactionType: "expense", hue: "#5aa39a", glyph: "🩺", sortOrder: 45 },
  { id: "personal", rowId: "UMB-PERSONAL", name: "Personal", rule: "What we wear and how we look after ourselves", spending: true, transactionType: "expense", hue: "#a0679b", glyph: "🧣", sortOrder: 50 },
  { id: "fun", rowId: "UMB-FUN", name: "Fun", rule: "Entertainment and hobbies at home and nearby", spending: true, transactionType: "expense", hue: "#d9774a", glyph: "🎲", sortOrder: 52 },
  { id: "travel", rowId: "UMB-TRAVEL", name: "Travel", rule: "Trips away from home", spending: true, transactionType: "expense", hue: "#3f8fbf", glyph: "🧳", sortOrder: 54 },
  { id: "pets-family", rowId: "UMB-PETS-FAMILY", name: "Pets & family", rule: "Those we care for: pets, kids, family support", spending: true, transactionType: "expense", hue: "#b08a4f", glyph: "🐾", sortOrder: 56 },
  { id: "gifts-giving", rowId: "UMB-GIFTS-GIVING", name: "Gifts & giving", rule: "Money that goes to other people", spending: true, transactionType: "expense", hue: "#c2566b", glyph: "🎁", sortOrder: 58 },
  { id: "work-learning", rowId: "CAT-WORK", name: "Work & learning", rule: "Costs of earning and studying", spending: true, transactionType: "expense", hue: "#6b6fa8", glyph: "🧰", sortOrder: 60 },
  { id: "money", rowId: "UMB-MONEY", name: "Money", rule: "The cost of money and where the future goes", spending: true, transactionType: "expense", hue: "#4f7f5f", glyph: "🏦", sortOrder: 62 },
  { id: "coming-in", rowId: "INCOME", name: "Coming in", rule: "Pay, tips, interest and refunds (not spending)", spending: false, transactionType: "income", hue: "#7a9a3a", glyph: "⬇️", sortOrder: 10 },
  { id: "moving-money", rowId: "UMB-MOVING-MONEY", name: "Moving money", rule: "Card payments and moves between our own accounts (not spending)", spending: false, transactionType: "expense", hue: "#8a8f98", glyph: "↔️", sortOrder: 90 },
];
export const SPENDING_UMBRELLAS: readonly Umbrella[] = UMBRELLAS.filter((row) => row.spending);
export const UMBRELLA_IDS: readonly UmbrellaId[] = UMBRELLAS.map((row) => row.id);
const UMBRELLA_BY_ID = new Map(UMBRELLAS.map((row) => [row.id, row]));
const UMBRELLA_BY_ROW = new Map(UMBRELLAS.map((row) => [row.rowId, row]));
export const umbrellaById = (id: UmbrellaId): Umbrella => UMBRELLA_BY_ID.get(id)!;
export const umbrellaForRowId = (rowId: string): Umbrella | null => UMBRELLA_BY_ROW.get(rowId) ?? null;
export const isUmbrellaId = (value: unknown): value is UmbrellaId => typeof value === "string" && UMBRELLA_BY_ID.has(value as UmbrellaId);
/** Funds a child category may default to. Nothing defaults to Protect (Jonathan, 2026-09-16). */
export const CATEGORY_DEFAULT_FUNDS: readonly FundId[] = ["everyday", "prepare", "build"];
export const isCategoryDefaultFund = (value: unknown): value is FundId => typeof value === "string" && (CATEGORY_DEFAULT_FUNDS as readonly string[]).includes(value);

/** Groups the v2 migration retires (`active: false`, never deleted) once their children have moved. */
export const RETIRED_GROUP_IDS = ["CAT-LIFE", "CAT-DEBT"] as const;
/** The legacy card-payment child: stays active (so existing posting paths keep working) but hidden from pickers. */
export const LEGACY_CARD_PAYMENT_ID = "SUB-DEBT-VISA";

/** §2a: seed children, by id. `null` fund = not spending. */
export const SEED_CHILD_HOMES: Readonly<Record<string, { umbrella: UmbrellaId; fund: FundId | null }>> = {
  "SUB-HOUSING-RENT": { umbrella: "home", fund: "prepare" },
  "SUB-HOUSING-ELECTRIC": { umbrella: "utilities", fund: "prepare" },
  "SUB-HOUSING-GAS": { umbrella: "utilities", fund: "prepare" },
  "SUB-LIFE-PHONE": { umbrella: "utilities", fund: "prepare" },
  "SUB-FOOD-GROCERIES": { umbrella: "food", fund: "everyday" },
  "SUB-FOOD-COFFEE": { umbrella: "food", fund: "everyday" },
  "SUB-TRANSPORT-FUEL": { umbrella: "transport", fund: "everyday" },
  "SUB-TRANSPORT-TRANSIT": { umbrella: "transport", fund: "everyday" },
  "SUB-LIFE-FUN": { umbrella: "fun", fund: "everyday" },
  "SUB-HEALTH-DENTAL": { umbrella: "health", fund: "prepare" },
  "SUB-HEALTH-THERAPY": { umbrella: "health", fund: "prepare" },
  "SUB-HEALTH-CARE": { umbrella: "health", fund: "everyday" },
  "SUB-HEALTH-VET": { umbrella: "pets-family", fund: "prepare" },
  "SUB-DEBT-INTEREST": { umbrella: "money", fund: "prepare" },
  "SUB-DEBT-VISA": { umbrella: "moving-money", fund: null },
  "SUB-WORK-TIP-OUTS": { umbrella: "work-learning", fund: "build" },
};

// ---------------------------------------------------------------------------
// Name rules.

/** v1, unchanged: exactly what `nestCategoryFor` has always returned for a name. */
export function v1FundForName(name: string): FundId {
  if (/vacation|holiday|trip|travel|wedding|renovat|home deposit|date night|concert/i.test(name)) return "build";
  if (/annual|yearly|christmas|birthday|tax|insurance|repair|school/i.test(name)) return "prepare";
  if (/rent|mortgage|hydro|phone|internet|electric|utility|emergency|buffer/i.test(name)) return "protect";
  return "everyday";
}

const V2_GIFTS = /gift|christmas|birthday/i;
const V2_BUILD = /vacation|holiday|trip|travel|wedding|renovat|home deposit|concert|rrsp|tfsa|resp\b|invest|tip[- ]?outs?\b/i;
const V2_PREPARE = /annual|yearly|tax|insurance|repair|school|tuition|rent|mortgage|hydro|phone|internet|electric|utilit|loan|car payment|interest|subscription|membership/i;

/**
 * v2 (§2b). Gifts are checked before holidays; "interest" counts only for
 * expense lines (there is also an income child named Interest). Protect is
 * never a default: "Emergency fund" falls to Everyday and the UI suggests a
 * Protect goal instead.
 */
export function v2FundForName(name: string, type: "expense" | "income" = "expense"): FundId {
  if (V2_GIFTS.test(name)) return "prepare";
  if (V2_BUILD.test(name)) return "build";
  const prepare = type === "income" ? V2_PREPARE.source.replace("|interest", "") : null;
  if (prepare ? new RegExp(prepare, "i").test(name) : V2_PREPARE.test(name)) return "prepare";
  return "everyday";
}

/** A card payment is moving money, not spending (the review's Q-G: flagged, never auto-converted). */
export const CARD_PAYMENT_NAME = /card payment|visa payment|mastercard payment|pay(ing)? (off )?(the |my |our )?(credit )?card|credit card payment|amex payment/i;
const LOAN_PAYMENT_NAME = /\bloan\b|car payment|mortgage principal/i;

/** §2a/§2b: where a child with this name lives, by name alone. `null` = needs a home. */
export function umbrellaForName(name: string, type: "expense" | "income" = "expense"): UmbrellaId | null {
  if (type === "income") return "coming-in";
  if (CARD_PAYMENT_NAME.test(name) || /transfer to|between accounts/i.test(name)) return "moving-money";
  if (/gift|christmas|birthday|charit|donat|spca/i.test(name)) return "gifts-giving";
  if (/\bvet\b|veterin|\bpets?\b|dog|\bcat\b|kitten|pupp|kid|child|daycare|family/i.test(name)) return "pets-family";
  if (/tip[- ]?out|uniform|course|tuition|school|work|learn|book(s)? for/i.test(name)) return "work-learning";
  if (/interest|bank fee|\bfees?\b|tax owing|\bcra\b|rrsp|tfsa|resp\b|invest|saving|emergency|\bloan\b|money/i.test(name)) return "money";
  if (/hydro|electric|household gas|gas heat|heating|water|internet|phone|mobile|cell|utilit|icloud/i.test(name)) return "utilities";
  if (/dental|dentist|therap|pharm|health|medical|doctor|glasses|gym|prescription|\bcare\b/i.test(name)) return "health";
  if (/rent|mortgage|\bhome\b|house|housing|furnit|repair|tenant|condo|property tax|ikea|cleaning/i.test(name)) return "home";
  if (/grocer|food|restaurant|coffee|lunch|dinner|takeout|take-out|delivery|alcohol|dining|costco|café|cafe|pub\b/i.test(name)) return "food";
  if (/fuel|gasoline|\bgas\b|transit|\bcar\b|auto|parking|uber|taxi|presto|\bbus\b|transport|ride/i.test(name)) return "transport";
  if (/vacation|holiday|trip|travel|flight|hotel/i.test(name)) return "travel";
  if (/cloth|hair|toiletr|electronic|personal|shopping|boots|shoes/i.test(name)) return "personal";
  if (/fun|entertain|stream|netflix|spotify|game|hobb|concert|movie|music/i.test(name)) return "fun";
  return null;
}

/** The default fund a new child under an umbrella proposes. The person can change it before saving. */
export function proposedDefaultFund(name: string, umbrella: UmbrellaId): FundId | null {
  if (umbrella === "coming-in" || umbrella === "moving-money") return null;
  if (LOAN_PAYMENT_NAME.test(name)) return "prepare";
  const byName = v2FundForName(name);
  if (byName !== "everyday") return byName;
  if (umbrella === "utilities") return "prepare";
  if (umbrella === "travel") return "build";
  if (umbrella === "home" && /rent|mortgage|insurance/i.test(name)) return "prepare";
  return "everyday";
}

// ---------------------------------------------------------------------------
// The synced side collection: overrides, markers, proposals.

export type FundOverrideSourceKind = "transaction" | "recurrence" | "potential" | "task";
/** A line's fund, set without touching the line itself (never on Transaction, Task or PotentialExpense). */
export type FundOverrideRow = {
  version: 2;
  kind: "override";
  id: string;
  sourceKind: FundOverrideSourceKind;
  sourceId: string;
  fund: FundId;
  visibility: LedgerView;
  setBy: string;
  updatedAt: string;
};
export type FundMigrationChange =
  | { type: "category"; id: string; before: Pick<Category, "name" | "parentId" | "active"> & { umbrellaId?: UmbrellaId; defaultFund?: FundId }; after: Pick<Category, "name" | "parentId" | "active"> & { umbrellaId?: UmbrellaId; defaultFund?: FundId } }
  | { type: "design"; id: string; before: FundId | null; after: FundId | null }
  | { type: "goal"; id: string; before: FundId | null; after: FundId }
  | { type: "plan-line"; id: string; draftId: string; before: FundId; after: FundId };
/**
 * The household marker (shared) or a member's own marker (personal). Its
 * existence switches every reader in that scope to v2. The receipt lists
 * every change; a shared receipt never names a personal row.
 */
export type FundMarkerRow = {
  version: 2;
  kind: "marker";
  id: string;
  visibility: LedgerView;
  setBy: string;
  migratedAt: string;
  changes: FundMigrationChange[];
  /** Child category ids the migration could not place; shown as "Needs a home". Shared marker only. */
  needsHome: string[];
  updatedAt: string;
};
export type FundSplit = Readonly<Record<FundId, number>>;
export type FundProposalState = "proposed" | "confirmed" | "declined" | "withdrawn";
/**
 * How one confirmed contribution is divided across the funds. A record, never
 * a transfer: confirming posts nothing. Both partners confirm (Jonathan).
 */
export type FundDivisionRow = {
  version: 2;
  kind: "division";
  id: string;
  visibility: "household";
  contributionEventId: string;
  amountCents: number;
  split: FundSplit;
  proposedBy: string;
  revision: number;
  agreedBy: string[];
  state: FundProposalState;
  updatedAt: string;
};
/**
 * Protect refills another fund for one month: the custodian proposes and the
 * partner confirms. A record for the projection only (Q4 defaulted: it posts
 * no Fund event).
 */
export type FundRefillRow = {
  version: 2;
  kind: "refill";
  id: string;
  visibility: "household";
  monthKey: MonthKey;
  toFund: Exclude<FundId, "protect" | "prepare">;
  amountCents: number;
  note: string;
  proposedBy: string;
  revision: number;
  agreedBy: string[];
  state: FundProposalState;
  updatedAt: string;
};
export type FundModelRow = FundOverrideRow | FundMarkerRow | FundDivisionRow | FundRefillRow;

export const HOUSEHOLD_FUND_MARKER_ID = "FUND-MODEL:household";
export const personalFundMarkerId = (memberId: string) => `FUND-MODEL:personal:${encodeURIComponent(memberId)}`;
export const fundOverrideId = (view: LedgerView, memberId: string, sourceKind: FundOverrideSourceKind, sourceId: string) =>
  `FUND-OVR:${view}:${view === "personal" ? encodeURIComponent(memberId) : "shared"}:${sourceKind}:${sourceId}`;
export const fundDivisionId = (contributionEventId: string) => `FUND-DIV:${contributionEventId}`;

const fail = (): never => { throw new Error("FUND_MODEL_ROW_INVALID"); };
const iso = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const str = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const cents = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isFund = (value: unknown): value is FundId => typeof value === "string" && (FUND_IDS as readonly string[]).includes(value);
const members = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 8 && value.every((id) => str(id, 120)) && new Set(value).size === value.length;
const onlyKeys = (row: object, keys: string[]) => Object.keys(row).every((key) => keys.includes(key));
const STATES: readonly FundProposalState[] = ["proposed", "confirmed", "declined", "withdrawn"];
const splitValid = (split: unknown, total: number): split is FundSplit => {
  if (!split || typeof split !== "object" || !onlyKeys(split, [...FUND_IDS]) || !FUND_IDS.every((fund) => cents((split as FundSplit)[fund]))) return false;
  return FUND_IDS.reduce((sum, fund) => sum + (split as FundSplit)[fund], 0) === total;
};
const miniCategory = (value: unknown) => {
  const row = value as Record<string, unknown>;
  return Boolean(row) && typeof row === "object" && onlyKeys(row, ["name", "parentId", "active", "umbrellaId", "defaultFund"])
    && typeof row.name === "string" && (row.parentId === null || typeof row.parentId === "string") && typeof row.active === "boolean"
    && (row.umbrellaId === undefined || isUmbrellaId(row.umbrellaId)) && (row.defaultFund === undefined || isFund(row.defaultFund));
};
function shapeChange(value: unknown): FundMigrationChange {
  const row = value as FundMigrationChange;
  if (!row || typeof row !== "object" || !str(row.id, 300)) return fail();
  if (row.type === "category" && onlyKeys(row, ["type", "id", "before", "after"]) && miniCategory(row.before) && miniCategory(row.after)) return row;
  if (row.type === "design" && onlyKeys(row, ["type", "id", "before", "after"]) && (row.before === null || isFund(row.before)) && (row.after === null || isFund(row.after))) return row;
  if (row.type === "goal" && onlyKeys(row, ["type", "id", "before", "after"]) && (row.before === null || isFund(row.before)) && isFund(row.after)) return row;
  if (row.type === "plan-line" && onlyKeys(row, ["type", "id", "draftId", "before", "after"]) && str(row.draftId, 300) && isFund(row.before) && isFund(row.after)) return row;
  return fail();
}

/** Strict shaper: a row this build cannot read makes the whole read fail closed (reload). */
export function shapeFundModelRows(value: unknown): FundModelRow[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 5000) return fail();
  const rows = value.map((raw): FundModelRow => {
    const row = raw as FundModelRow;
    if (!row || typeof row !== "object" || row.version !== 2 || !str(row.id, 400) || !iso(row.updatedAt)
      || !["household", "personal"].includes(row.visibility)) return fail();
    if (row.kind === "override") {
      if (!onlyKeys(row, ["version", "kind", "id", "sourceKind", "sourceId", "fund", "visibility", "setBy", "updatedAt"])
        || !["transaction", "recurrence", "potential", "task"].includes(row.sourceKind) || !str(row.sourceId, 200) || !isFund(row.fund)
        || !str(row.setBy, 120) || row.id !== fundOverrideId(row.visibility, row.setBy, row.sourceKind, row.sourceId)) return fail();
      return { ...row };
    }
    if (row.kind === "marker") {
      if (!onlyKeys(row, ["version", "kind", "id", "visibility", "setBy", "migratedAt", "changes", "needsHome", "updatedAt"])
        || !str(row.setBy, 120) || !iso(row.migratedAt) || !Array.isArray(row.changes) || row.changes.length > 4000
        || !Array.isArray(row.needsHome) || row.needsHome.length > 500 || !row.needsHome.every((id) => str(id, 200))
        || row.id !== (row.visibility === "household" ? HOUSEHOLD_FUND_MARKER_ID : personalFundMarkerId(row.setBy))
        || (row.visibility === "personal" && row.needsHome.length > 0)) return fail();
      return { ...row, changes: row.changes.map(shapeChange), needsHome: [...row.needsHome] };
    }
    if (row.kind === "division") {
      if (!onlyKeys(row, ["version", "kind", "id", "visibility", "contributionEventId", "amountCents", "split", "proposedBy", "revision", "agreedBy", "state", "updatedAt"])
        || row.visibility !== "household" || !str(row.contributionEventId, 200) || row.id !== fundDivisionId(row.contributionEventId)
        || !cents(row.amountCents) || !splitValid(row.split, row.amountCents) || !str(row.proposedBy, 120)
        || !Number.isSafeInteger(row.revision) || row.revision < 1 || !members(row.agreedBy) || !STATES.includes(row.state)) return fail();
      return { ...row, split: { ...row.split }, agreedBy: [...row.agreedBy].sort() };
    }
    if (row.kind === "refill") {
      if (!onlyKeys(row, ["version", "kind", "id", "visibility", "monthKey", "toFund", "amountCents", "note", "proposedBy", "revision", "agreedBy", "state", "updatedAt"])
        || row.visibility !== "household" || !/^\d{4}-\d{2}$/.test(row.monthKey) || !["build", "everyday"].includes(row.toFund)
        || !cents(row.amountCents) || row.amountCents < 1 || typeof row.note !== "string" || row.note.length > 200 || !str(row.proposedBy, 120)
        || !Number.isSafeInteger(row.revision) || row.revision < 1 || !members(row.agreedBy) || !STATES.includes(row.state)) return fail();
      return { ...row, agreedBy: [...row.agreedBy].sort() };
    }
    return fail();
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) return fail();
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

const rowStamp = (row: FundModelRow) => ("revision" in row ? String(row.revision).padStart(8, "0") : "") + row.updatedAt;
/** Last writer wins per row id; proposals compare their revision first so an older copy never undoes agreement. */
export function mergeFundModelRows(server: unknown, client: unknown): FundModelRow[] {
  const byId = new Map<string, FundModelRow>();
  for (const row of [...shapeFundModelRows(server), ...shapeFundModelRows(client)]) {
    const prior = byId.get(row.id);
    if (!prior || rowStamp(row) >= rowStamp(prior)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** The rows a member's Personal envelope may carry: only their own personal rows. */
export function personalFundRows(rows: unknown, memberId: string): FundModelRow[] {
  return shapeFundModelRows(rows).filter((row) => row.visibility === "personal" && "setBy" in row && row.setBy === memberId);
}

export const fundRowInView = (row: FundModelRow, memberId: string, view: LedgerView) =>
  row.visibility === view && (view === "household" || ("setBy" in row && row.setBy === memberId));

export function householdFundMarker(h: Pick<Household, "fundModelRows">): FundMarkerRow | null {
  return (h.fundModelRows ?? []).find((row): row is FundMarkerRow => row.kind === "marker" && row.id === HOUSEHOLD_FUND_MARKER_ID) ?? null;
}
export function personalFundMarker(h: Pick<Household, "fundModelRows">, memberId: string): FundMarkerRow | null {
  const id = personalFundMarkerId(memberId);
  return (h.fundModelRows ?? []).find((row): row is FundMarkerRow => row.kind === "marker" && row.id === id) ?? null;
}
/** Which rules the household reads with. The household marker decides for every view. */
export function fundModelMode(h: Pick<Household, "fundModelRows">): FundModelMode {
  return householdFundMarker(h) ? 2 : 1;
}
/** True once the household holds any fund-model row; older clients must not write over it. */
export function hasFundModelData(h: Pick<Household, "fundModelRows">): boolean {
  return Boolean(h.fundModelRows?.length);
}

// ---------------------------------------------------------------------------
// Categories under umbrellas.

/** The umbrella a category (group or child) sits under, by stored id first, then by the locked row id. */
export function umbrellaOfCategory(h: Pick<Household, "categories">, categoryId: string | null | undefined): UmbrellaId | null {
  if (!categoryId) return null;
  const row = h.categories.find((item) => item.id === categoryId);
  if (!row) return null;
  if (row.recordType === "group") return row.umbrellaId ?? umbrellaForRowId(row.id)?.id ?? null;
  const parent = row.parentId ? h.categories.find((item) => item.id === row.parentId) : undefined;
  return parent ? parent.umbrellaId ?? umbrellaForRowId(parent.id)?.id ?? null : null;
}

/** True when the category (or its group) is a non-spending umbrella: never offered for new spending, skipped by pickers. */
export function isNonSpendingCategory(h: Pick<Household, "categories">, categoryId: string): boolean {
  const umbrella = umbrellaOfCategory(h, categoryId);
  return umbrella === "moving-money" || categoryId === LEGACY_CARD_PAYMENT_ID && fundModelMode(h as Household) === 2;
}

/** The expense groups a person may file a new child under. v2: exactly the 12 spending umbrellas, in their fixed order. */
export function pickableExpenseGroups(h: Pick<Household, "categories" | "fundModelRows">): Category[] {
  const groups = h.categories.filter((row) => row.recordType === "group" && row.active && row.transactionType === "expense");
  if (fundModelMode(h) === 1) return groups;
  const byId = new Map(groups.map((row) => [row.id, row]));
  return SPENDING_UMBRELLAS.flatMap((umbrella) => byId.get(umbrella.rowId) ?? []);
}

/** A category row's default fund: the stored value, then the seed table. */
export function categoryDefaultFund(h: Pick<Household, "categories">, categoryId: string | null | undefined): FundId | null {
  if (!categoryId) return null;
  const row = h.categories.find((item) => item.id === categoryId);
  if (!row || row.recordType !== "category" || row.transactionType !== "expense") return null;
  if (row.defaultFund) return row.defaultFund;
  return SEED_CHILD_HOMES[row.id]?.fund ?? null;
}

// ---------------------------------------------------------------------------
// fundFor.

export type FundSource =
  | { kind: "transaction"; id: string }
  | { kind: "recurrence"; id: string }
  | { kind: "potential"; id: string }
  | { kind: "task"; id: string }
  | { kind: "goal"; id: string }
  | { kind: "appointment"; id: string }
  | { kind: "plan-line"; line: Pick<PlanLine, "id" | "lens" | "labelSnapshot"> };
export type FundViewer = { memberId: string; view: LedgerView };

type Resolver = (source: FundSource, design?: FundId | null) => FundId;

/**
 * Build one resolver for a viewer (cheap to call per leaf).
 *
 * v2 precedence (plan §2, with the review's fixes):
 *   1. The fund override visible to the viewer (their own personal row first).
 *   2. A posted row that belongs to a goal purchase → that goal's fund.
 *   3. The leaf's bank design category, when not archived (passed in by the nest).
 *   4. A goal's saved type (`envelope.kind`); an untyped goal created before the
 *      migration keeps its v1 answer (Q-F: frozen). A plan line's `lens`.
 *   5. A recurring subscription → Prepare.
 *   6. The child category's default fund.
 *   7. A recurring bill → Prepare.
 *   8. The v2 name rule (never Protect).
 * v1: the design, then the goal's type, then the old name regex — exactly as before.
 */
export function fundResolver(h: Household, viewer: FundViewer): Resolver {
  const mode = fundModelMode(h);
  if (mode === 1) {
    return (source, design) => {
      if (design) return design;
      switch (source.kind) {
        case "goal": {
          const goal = h.goals.find((row) => row.id === source.id);
          return goal?.envelope?.kind ?? v1FundForName(goal?.name ?? "");
        }
        case "plan-line": return source.line.lens;
        case "appointment": return "prepare";
        case "recurrence": return v1FundForName(h.recurrences.find((row) => row.id === source.id)?.note ?? "");
        case "potential": return v1FundForName((h.potentialExpenses ?? []).find((row) => row.id === source.id)?.title ?? "");
        case "task": return v1FundForName((h.tasks ?? []).find((row) => row.id === source.id)?.title ?? "");
        case "transaction": return v1FundForName(h.transactions.find((row) => row.id === source.id)?.note ?? "");
      }
    };
  }
  const marker = householdFundMarker(h)!;
  const overrides = new Map<string, FundOverrideRow>();
  for (const row of h.fundModelRows ?? []) {
    if (row.kind !== "override") continue;
    const key = `${row.sourceKind}:${row.sourceId}`;
    if (row.visibility === "personal" && row.setBy === viewer.memberId) overrides.set(key, row);
    else if (row.visibility === "household" && !overrides.has(key)) overrides.set(key, row);
  }
  const purchasedGoal = new Map<string, string>();
  for (const purchase of h.goalPurchases ?? []) for (const id of purchase.transactionIds) purchasedGoal.set(id, purchase.goalId);
  const goalFund = (goalId: string): FundId => {
    const goal = h.goals.find((row) => row.id === goalId);
    if (!goal) return "build";
    if (goal.envelope?.kind) return goal.envelope.kind;
    return goal.createdAt < marker.migratedAt ? v1FundForName(goal.name) : v2FundForName(goal.name);
  };
  const byName = (name: string, categoryId?: string | null) => {
    const fromName = v2FundForName(name);
    if (fromName !== "everyday" || !categoryId) return fromName;
    const category = h.categories.find((row) => row.id === categoryId);
    return category ? v2FundForName(category.name) : fromName;
  };
  return (source, design) => {
    if (source.kind !== "goal" && source.kind !== "plan-line" && source.kind !== "appointment") {
      const override = overrides.get(`${source.kind}:${source.id}`);
      if (override) return override.fund;
    }
    if (source.kind === "transaction") {
      const goalId = purchasedGoal.get(source.id);
      if (goalId) return goalFund(goalId);
    }
    if (design) return design;
    switch (source.kind) {
      case "goal": return goalFund(source.id);
      case "plan-line": return source.line.lens;
      case "appointment": return "prepare";
      case "recurrence": {
        const row = h.recurrences.find((item) => item.id === source.id);
        if (!row) return "everyday";
        if (row.kind === "subscription") return "prepare";
        const fallback = categoryDefaultFund(h, row.subcategoryId);
        if (fallback) return fallback;
        if (row.kind === "bill") return "prepare";
        return byName(row.note, row.subcategoryId);
      }
      case "potential": {
        const row = (h.potentialExpenses ?? []).find((item) => item.id === source.id);
        if (!row) return "everyday";
        return categoryDefaultFund(h, row.subcategoryId) ?? byName(row.title, row.subcategoryId);
      }
      case "task": {
        const row = (h.tasks ?? []).find((item) => item.id === source.id);
        return byName(row?.title ?? "");
      }
      case "transaction": {
        const row = h.transactions.find((item) => item.id === source.id);
        if (!row) return "everyday";
        const fallback = categoryDefaultFund(h, row.subcategoryId);
        if (fallback) return fallback;
        if (row.source === "recurring" && row.sourceId) {
          const recurrence = h.recurrences.find((item) => item.id === row.sourceId);
          if (recurrence?.kind === "subscription" || recurrence?.kind === "bill") return "prepare";
        }
        return byName(row.note, row.subcategoryId);
      }
    }
  };
}

/** One answer for one line. Prefer `fundResolver` in loops. */
export function fundFor(h: Household, source: FundSource, viewer: FundViewer, design?: FundId | null): FundId {
  return fundResolver(h, viewer)(source, design);
}

// ---------------------------------------------------------------------------
// Allocation.

export type FundAllocationInput = {
  /** The King: Fund operating balance + kitty (household), or the personal total. */
  kingCents: number;
  /** Cents already pinned in a fund: kitty reservations (goal banks and unattributed earmarks). Never re-used for bills (Q-A). */
  pinned: Partial<Record<FundId, number>>;
  /** Signed: purchases the Fund paid that are still owed back to the paying account, less credits (R2-M1). */
  owedBackCents: number;
  /** What each fund wants from the operating money, before the fill order. */
  desired: Partial<Record<FundId, number>>;
};
export type FundAllocation = {
  /** Each fund's bank amount: its fill plus what is pinned in it. Everyday = now + pinned everyday. */
  amounts: Record<FundId, number>;
  /** What each fund got from operating money. */
  filled: Record<FundId, number>;
  /** What each fund asked for from operating money. */
  desired: Record<FundId, number>;
  pinned: Record<FundId, number>;
  owedBackCents: number;
  /** The Queen's "Now": operating money left after owed-back and the fill. May be negative ("the month is short"). */
  nowCents: number;
};

/**
 * v2 fill (R2-H2, R2-M1). Kitty reservations stay pinned in their fund and are
 * never handed to bills. The fill order Prepare → Protect → Build applies to
 * operating money only, after what the Fund still owes back. Everyday is the
 * exact remainder, so `owedBack + amounts.prepare + amounts.protect + amounts.build + amounts.everyday === king`
 * to the cent, and `amounts.everyday === now + pinned.everyday`.
 */
export function allocateFunds(input: FundAllocationInput): FundAllocation {
  if (!Number.isSafeInteger(input.kingCents) || !Number.isSafeInteger(input.owedBackCents)) throw new Error("Invalid King amount.");
  const zero = (): Record<FundId, number> => ({ prepare: 0, protect: 0, build: 0, everyday: 0 });
  const pinned = zero();
  const desired = zero();
  for (const fund of FUND_IDS) {
    const pin = input.pinned[fund] ?? 0;
    const want = input.desired[fund] ?? 0;
    if (!Number.isSafeInteger(pin) || pin < 0 || !Number.isSafeInteger(want) || want < 0) throw new Error("Invalid category amount.");
    pinned[fund] = pin;
    desired[fund] = want;
  }
  const pinnedTotal = FUND_IDS.reduce((sum, fund) => sum + pinned[fund], 0);
  const operating = input.kingCents - pinnedTotal - input.owedBackCents;
  const filled = zero();
  let remaining = Math.max(0, operating);
  for (const fund of FUND_FILL_ORDER) {
    filled[fund] = Math.min(remaining, desired[fund]);
    remaining -= filled[fund];
  }
  const nowCents = operating - filled.prepare - filled.protect - filled.build;
  const amounts = zero();
  for (const fund of FUND_FILL_ORDER) amounts[fund] = filled[fund] + pinned[fund];
  amounts.everyday = nowCents + pinned.everyday;
  return { amounts, filled, desired, pinned, owedBackCents: input.owedBackCents, nowCents };
}

/** Month key helper for rows that carry a civil date. */
export const monthOf = (date: DateKey): MonthKey => monthKeyFromDateKey(date);
