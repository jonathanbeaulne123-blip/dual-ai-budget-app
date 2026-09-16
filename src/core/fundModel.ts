/**
 * fundModel.ts — the money model's read side (D-268…D-272, Plan Studio v3).
 *
 * Pure selectors the Plan Studio v3 UI (and the Queen, the cellar and
 * Hercules's on-device talk) read. Nothing here posts, writes or moves money;
 * "set aside" is a way of thinking, never a bank move.
 *
 * ## The model
 * - **Everyday / Now** is the Queen: what is left of the King (Fund operating
 *   money + kitty) after the Fund's owed-back purchases and the three support
 *   funds. It can be negative ("the month is short").
 * - **Prepare** holds every has-to-leave line: bills, subscriptions, loan
 *   payments, card interest, appointments.
 * - **Protect** is the agreed monthly buffer (`fundMonthPlans.bufferCents`)
 *   and nothing else. Nothing defaults to it. A confirmed refill (custodian
 *   proposes, partner confirms) lends it to Build or Everyday for the month.
 * - **Build** holds goals, investments, RRSP and tip-outs. Kitty reservations
 *   stay pinned in their goal's fund; they are never counted toward bills.
 * - Fill order when money is short: Prepare → Protect → Build.
 * - Before a household is migrated (no marker), every selector answers with
 *   the v1 rules and says so (`mode: 1`).
 *
 * ## API
 * ```ts
 * fundSnapshot(household, { memberId, view, today }): FundSnapshot
 *   // { mode, kingCents, now, owedBackCents,
 *   //   undividedContributions: UndividedContribution[],
 *   //   prepare: { amountCents, targetCents, coveredThrough, shortOn?, bills },
 *   //   protect: { amountCents, targetCents, refills },
 *   //   build:   { amountCents, targetCents, goals },
 *   //   everyday:{ amountCents },
 *   //   flow: FlowItem[]  (this month, per day, each with its fund),
 *   //   needsHome, checks }
 * undividedContributions(household, { view, today }): UndividedContribution[]
 * divisionFor(household, contributionEventId): FundDivisionRow | null
 * proposedDivision(household, contributionEventId, { today }): FundSplit   // Hercules's draft, same fill order
 * openRefills(household, monthKey): FundRefillRow[]
 * cardPaymentChecks(household, { memberId, view }): CardPaymentCheck[]   // private "check these" list (Q-G)
 * needsHomeCategories(household): Category[]
 * umbrellaChoices(household): UmbrellaChoice[]                            // the add-category grid
 * umbrellaHueForCategory(household, categoryId): string | null             // cellar/world hue by umbrella id, never by name
 * fundModelNotice(household, { memberId }): FundModelNotice | null        // "Hearth sorted our money the new way" + Needs a home
 * categoryFilterOptions(household, { memberId, view }): CategoryFilterOption[]
 * ```
 * Re-exports: `fundFor`, `fundResolver`, `UMBRELLAS`, `FUND_IDS`, `FUND_LABELS`,
 * `FUND_MEANINGS_V2`, `fundModelMode`, `allocateFunds` and the row types.
 */
import { monthKeyFromDateKey, type DateKey, type MonthKey } from "./calendar.ts";
import { activeHouseholdFundEvents, projectHouseholdFund } from "./householdFund.ts";
import { projectKittyNest, type NestBank } from "./kittyNest.ts";
import {
  allocateFunds,
  CARD_PAYMENT_NAME,
  FUND_FILL_ORDER,
  LEGACY_CARD_PAYMENT_ID,
  SPENDING_UMBRELLAS,
  fundModelMode,
  householdFundMarker,
  personalFundMarker,
  pickableExpenseGroups,
  umbrellaOfCategory,
  UMBRELLAS,
  umbrellaForRowId,
  type FundDivisionRow,
  type FundId,
  type FundModelMode,
  type FundRefillRow,
  type FundSplit,
  type UmbrellaId,
} from "./fundRules.ts";
import type { Category, Household, LedgerView } from "./types.ts";

export {
  allocateFunds, fundFor, fundResolver, fundModelMode, FUND_FILL_ORDER, FUND_IDS, FUND_LABELS, FUND_MEANINGS_V2, UMBRELLAS, SPENDING_UMBRELLAS,
  CATEGORY_DEFAULT_FUNDS, umbrellaOfCategory, pickableExpenseGroups, proposedDefaultFund,
} from "./fundRules.ts";
export type { FundId, FundModelMode, FundSplit, FundDivisionRow, FundRefillRow, FundOverrideRow, FundMarkerRow, UmbrellaId, Umbrella } from "./fundRules.ts";

export type FundViewInput = { memberId: string; view: LedgerView; today: DateKey };

export type UndividedContribution = {
  eventId: string;
  date: DateKey;
  contributorMemberId: string | null;
  amountCents: number;
  /** The open proposal, when one exists. Confirmed divisions are not "undivided". */
  proposal: FundDivisionRow | null;
};
export type FlowItem = {
  date: DateKey;
  kind: "contribution" | "bill" | "goal";
  /** `null` for money coming in (it has not been divided yet, or is divided by its record). */
  fund: FundId | null;
  label: string;
  amountCents: number;
  state: "expected" | "arrived" | "paid" | "open";
  sourceId: string;
};
export type CardPaymentCheck = { recurrenceId: string; label: string; amountCents: number; reason: "legacy-card-category" | "card-payment-name" };
export type UmbrellaChoice = { id: UmbrellaId; rowId: string; name: string; rule: string; hue: string; glyph: string; childCount: number };
export type CategoryFilterOption = { id: string; name: string; umbrellaId: UmbrellaId | null; own: boolean };

export type FundSnapshot = {
  mode: FundModelMode;
  kingCents: number;
  /** The Queen's big number: the Everyday remainder. */
  now: number;
  owedBackCents: number;
  undividedContributions: UndividedContribution[];
  prepare: { amountCents: number; targetCents: number; coveredThrough: DateKey | null; shortOn?: { date: DateKey; label: string; shortCents: number }; bills: NestBank[] };
  protect: { amountCents: number; targetCents: number; refills: FundRefillRow[] };
  build: { amountCents: number; targetCents: number; goals: Array<{ goalId: string; name: string; amountCents: number; targetCents: number; date: DateKey | null }> };
  everyday: { amountCents: number };
  flow: FlowItem[];
  needsHome: Category[];
  checks: CardPaymentCheck[];
};

export function divisionFor(h: Pick<Household, "fundModelRows">, contributionEventId: string): FundDivisionRow | null {
  return (h.fundModelRows ?? []).find((row): row is FundDivisionRow => row.kind === "division" && row.contributionEventId === contributionEventId && row.state !== "withdrawn" && row.state !== "declined") ?? null;
}

/** Confirmed contributions this month without a confirmed division ("not divided yet"). Household only. */
export function undividedContributions(h: Household, input: { view: LedgerView; today: DateKey }): UndividedContribution[] {
  if (input.view !== "household" || fundModelMode(h) !== 2 || !h.householdFund) return [];
  const month = monthKeyFromDateKey(input.today);
  return activeHouseholdFundEvents(h, h.householdFund.id)
    .filter((event) => event.kind === "contribution-confirmed" && monthKeyFromDateKey(event.date) === month)
    .flatMap((event) => {
      const division = divisionFor(h, event.id);
      if (division?.state === "confirmed") return [];
      return [{ eventId: event.id, date: event.date, contributorMemberId: event.contributorMemberId, amountCents: event.amountCents, proposal: division }];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId));
}

/**
 * Hercules's draft split for one contribution, in the fill order: what
 * Prepare still needs, then Protect, then Build, and the rest to Everyday.
 * A suggestion only — both partners confirm (`proposeFundDivision`).
 */
export function proposedDivision(h: Household, contributionEventId: string, input: { memberId: string; today: DateKey }): FundSplit {
  const event = (h.fundEvents ?? []).find((row) => row.id === contributionEventId);
  const total = event?.amountCents ?? 0;
  const nest = projectKittyNest(h, input.memberId, "household", input.today);
  const allocation = nest.allocation;
  const split: Record<FundId, number> = { prepare: 0, protect: 0, build: 0, everyday: 0 };
  // What the funds held before this contribution arrived; the draft fills their gaps in order.
  const before = allocation ? allocateFunds({ kingCents: nest.king.amountCents - total, pinned: allocation.pinned, owedBackCents: allocation.owedBackCents, desired: allocation.desired }) : null;
  let left = total;
  for (const fund of FUND_FILL_ORDER) {
    const gap = before ? Math.max(0, before.desired[fund] - before.filled[fund]) : 0;
    split[fund] = Math.min(left, gap);
    left -= split[fund];
  }
  split.everyday = left;
  return split;
}

export function openRefills(h: Pick<Household, "fundModelRows">, monthKey: MonthKey): FundRefillRow[] {
  return (h.fundModelRows ?? []).filter((row): row is FundRefillRow => row.kind === "refill" && row.monthKey === monthKey && (row.state === "proposed" || row.state === "confirmed"));
}

/**
 * Q-G (defaulted): repeating card-payment bills are never converted
 * automatically. Each viewer sees only the ones they can already see, in a
 * private "check these" list; nothing is written or shared.
 */
export function cardPaymentChecks(h: Household, input: { memberId: string; view: LedgerView }): CardPaymentCheck[] {
  if (fundModelMode(h) !== 2) return [];
  return h.recurrences.flatMap((row) => {
    if (!row.active || row.type !== "expense") return [];
    const account = h.accounts.find((item) => item.id === row.accountId);
    const visible = input.view === "household" ? account?.scope !== "personal" : account?.scope === "personal" && account.ownerMemberId === input.memberId;
    if (!visible) return [];
    const reason = row.subcategoryId === LEGACY_CARD_PAYMENT_ID ? "legacy-card-category" as const : CARD_PAYMENT_NAME.test(row.note) ? "card-payment-name" as const : null;
    return reason ? [{ recurrenceId: row.id, label: row.note || "Card payment", amountCents: row.amountCents, reason }] : [];
  });
}

export function needsHomeCategories(h: Household): Category[] {
  const ids = new Set(householdFundMarker(h)?.needsHome ?? []);
  return h.categories.filter((row) => ids.has(row.id) && row.active);
}

/** The 12 tiles of the add-category grid, in their fixed order. v1 households get no tiles. */
export function umbrellaChoices(h: Household): UmbrellaChoice[] {
  if (fundModelMode(h) !== 2) return [];
  const present = new Set(pickableExpenseGroups(h).map((row) => row.id));
  return SPENDING_UMBRELLAS.filter((umbrella) => present.has(umbrella.rowId)).map((umbrella) => ({
    id: umbrella.id, rowId: umbrella.rowId, name: umbrella.name, rule: umbrella.rule, hue: umbrella.hue, glyph: umbrella.glyph,
    childCount: h.categories.filter((row) => row.parentId === umbrella.rowId && row.active && row.recordType === "category").length,
  }));
}

/**
 * "Filter by our own": every active child the viewer's books actually used
 * or created, marked `own` when it is not a Hearth seed row, with its umbrella.
 */
export function categoryFilterOptions(h: Household, input: { memberId: string; view: LedgerView }): CategoryFilterOption[] {
  const used = new Set(h.transactions
    .filter((tx) => input.view === "household" ? tx.visibility !== "personal" : tx.visibility !== "household" && tx.createdBy === input.memberId)
    .map((tx) => tx.subcategoryId));
  return h.categories
    .filter((row) => row.recordType === "category" && row.transactionType === "expense" && (row.active || used.has(row.id)))
    .filter((row) => !(fundModelMode(h) === 2 && h.categories.find((parent) => parent.id === row.parentId)?.umbrellaId === "moving-money"))
    .map((row) => {
      const parent = h.categories.find((item) => item.id === row.parentId);
      return { id: row.id, name: row.name, umbrellaId: parent?.umbrellaId ?? (parent ? umbrellaForRowId(parent.id)?.id ?? null : null), own: !/^SUB-(HOUSING|FOOD|TRANSPORT|LIFE|HEALTH|DEBT|INCOME)-/.test(row.id) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The presentation hue for a category's umbrella (M6: keyed by umbrella id, never by name). */
export function umbrellaHueForCategory(h: Household, categoryId: string | null | undefined): string | null {
  const umbrella = umbrellaOfCategory(h, categoryId);
  return umbrella ? UMBRELLAS.find((row) => row.id === umbrella)!.hue : null;
}

export type FundModelNotice = { title: string; body: string; sortedBy: string; sortedAt: string; needsHome: Category[]; mine: "sorted" | "waiting" };
/**
 * The shared notice after the household step (R2-L2: "Hearth sorted…", and
 * whose phone ran it, never "we"). `mine` says whether this member's own
 * private rows are sorted yet; the private list itself never appears here.
 */
export function fundModelNotice(h: Household, input: { memberId: string }): FundModelNotice | null {
  const marker = householdFundMarker(h);
  if (!marker) return null;
  const by = h.members.find((member) => member.id === marker.setBy)?.name ?? "a household phone";
  const needsHome = needsHomeCategories(h);
  return {
    title: "Hearth sorted our money the new way",
    body: `Sorted on ${by}'s phone. Bills now live in Prepare, Protect is our buffer, and goals live in Build. Nothing moved at the bank.${needsHome.length ? ` ${needsHome.length === 1 ? "One category needs" : `${needsHome.length} categories need`} a home under an umbrella.` : ""}`,
    sortedBy: marker.setBy,
    sortedAt: marker.migratedAt,
    needsHome,
    mine: personalFundMarker(h, input.memberId) ? "sorted" : "waiting",
  };
}

/** One read for the whole Plan Studio v3 rest screen. */
export function fundSnapshot(h: Household, input: FundViewInput): FundSnapshot {
  const nest = projectKittyNest(h, input.memberId, input.view, input.today);
  const mode = fundModelMode(h);
  const bank = (fund: FundId) => nest.categories.find((row) => row.category === fund)!;
  const month = monthKeyFromDateKey(input.today);
  const allocation = nest.allocation;
  const prepareBank = bank("prepare");
  const bills = prepareBank.children.filter((row) => row.tier === "bill");
  let coveredThrough: DateKey | null = null;
  let shortOn: FundSnapshot["prepare"]["shortOn"];
  for (const row of [...bills].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))) {
    if (row.amountCents >= row.targetCents) { if (row.date) coveredThrough = row.date; continue; }
    shortOn = { date: row.date ?? input.today, label: row.name, shortCents: row.targetCents - row.amountCents };
    break;
  }
  const fund = input.view === "household" ? projectHouseholdFund(h, input.today) : null;
  const flow: FlowItem[] = [];
  if (input.view === "household" && h.householdFund) {
    for (const event of activeHouseholdFundEvents(h, h.householdFund.id)) {
      if (event.kind !== "contribution-confirmed" || monthKeyFromDateKey(event.date) !== month) continue;
      flow.push({ date: event.date, kind: "contribution", fund: null, label: "Contribution", amountCents: event.amountCents, state: "arrived", sourceId: event.id });
    }
  }
  for (const row of [...nest.categories.flatMap((category) => category.children), ...nest.history]) {
    if (!row.date || monthKeyFromDateKey(row.date) !== month) continue;
    flow.push({
      date: row.date, kind: row.goal ? "goal" : "bill", fund: row.category, label: row.name,
      amountCents: row.tier === "bill" ? row.targetCents : row.amountCents,
      state: row.state === "broken" ? "paid" : row.date < input.today ? "open" : "expected", sourceId: row.id,
    });
  }
  flow.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.sourceId.localeCompare(b.sourceId));
  const buildBank = bank("build");
  return {
    mode,
    kingCents: nest.king.amountCents,
    now: allocation ? allocation.nowCents : bank("everyday").amountCents,
    owedBackCents: allocation?.owedBackCents ?? 0,
    undividedContributions: undividedContributions(h, input),
    prepare: { amountCents: prepareBank.amountCents, targetCents: allocation ? allocation.desired.prepare + allocation.pinned.prepare : prepareBank.targetCents, coveredThrough, ...(shortOn ? { shortOn } : {}), bills },
    protect: { amountCents: bank("protect").amountCents, targetCents: mode === 2 ? fund?.bufferCents ?? 0 : bank("protect").targetCents, refills: openRefills(h, month) },
    build: {
      amountCents: buildBank.amountCents,
      targetCents: buildBank.targetCents,
      goals: buildBank.children.filter((row) => row.goal).map((row) => ({ goalId: row.goal!.id, name: row.name, amountCents: row.amountCents, targetCents: row.targetCents, date: row.date })),
    },
    everyday: { amountCents: bank("everyday").amountCents },
    flow,
    needsHome: input.view === "household" ? needsHomeCategories(h) : [],
    checks: cardPaymentChecks(h, input),
  };
}

/** Every fund id, in the order the Plan Studio check-in walks them. */
export const CHECK_IN_ORDER: readonly FundId[] = ["prepare", "protect", "build", "everyday"];
