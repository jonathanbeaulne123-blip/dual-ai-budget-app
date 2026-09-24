/**
 * The Desk's Books page, read (SIMPLE_VIEW_DESK S4 §5). The Standing Book's
 * divisions as live rows, each figure the selector's own figure and the same
 * one the books surface shows when the row's door opens it. Nothing here
 * posts, writes or computes a balance of its own:
 *
 * - Today, the waterline: `projectHouseholdFund(h, today)` (the
 *   `fundLensToday` lens) — operating balance, reserved for upcoming, free to
 *   spend, last reconciliation. Without a Fund, the book's own "accepted
 *   shared operating cash" (`householdWallet` over `booksPresentationFloor`);
 *   in Personal, the book's own Personal lead (`projectKittyNest`'s source
 *   and total) — exactly the three cases `HouseBooks` prints.
 * - Spending: `categoryShape` (each category against its own trailing band).
 *   The shape is a shared read by design — it never draws a personal row — so
 *   Personal reads its own books' month (`monthSummary` over the Personal
 *   books floor) against its own plan instead.
 * - Goals: `projectKittyNest` — the open goal banks against their targets.
 * - Contributions: `contributionRegister(...).byMember` for this month's
 *   confirmed sources, each member's own rhythm from `twoStreams`. Never
 *   summed into a comparison. Personal reads only the member's own.
 * - Record: this month's entries on the books floor, and the newest one.
 *
 * Unknown stays `null` and reads "—" downstream, never $0.
 */
import { householdWallet } from "../../core/accounts.ts";
import { monthSummary } from "../../core/budget.ts";
import { formatMonthLabel, monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import { categoryShape, type ShapeVerdict } from "../../core/categoryShape.ts";
import { contributionRegister } from "../../core/contributionRegister.ts";
import { projectHouseholdFund } from "../../core/householdFund.ts";
import { projectKittyNest, type NestBank } from "../../core/kittyNest.ts";
import { booksPresentationFloor } from "../../core/ledgerExperience.ts";
import { transactionTypeLabel } from "../../core/ledgerView.ts";
import { twoStreams } from "../../core/twoStreams.ts";
import type { Household, LedgerView } from "../../core/types.ts";

/**
 * The Standing Book's own division addresses (`house/bindery.ts`
 * `binderyDivisionFor`): the books surface turns to the named division on
 * arrival, the way a Bindery machine's door does. Presentation only.
 */
export const BOOK_DOORS = Object.freeze({
  today: { object: "chapter/today", division: "Today" },
  spending: { object: "bindery/lantern-row", division: "Spending" },
  goals: { object: "bindery/glasshouse-pane", division: "Goals" },
  contributions: { object: "bindery/handoff-bench", division: "Contributions" },
  record: { object: "chapter/record", division: "Record" },
} as const);
export type DeskBookId = keyof typeof BOOK_DOORS;

function memberActive(household: Household, memberId: string): boolean {
  return household.members.some(member => member.id === memberId && member.active);
}

// ── Today: the waterline ─────────────────────────────────────────────────

export type DeskWaterline = {
  /** Which of the book's three Today readings this is. */
  kind: "fund" | "shared-cash" | "personal";
  /** The lead figure's words, as the book words it. */
  leadLabel: string;
  leadCents: number | null;
  /** Fund only; null (—) everywhere else. */
  reservedCents: number | null;
  freeCents: number | null;
  /** The last reconciliation's date, "not yet" when the Fund was never reconciled, null when there is no Fund to reconcile. */
  lastReconciledAt: string | null;
  reconciled: "stamped" | "not-yet" | "none";
};

export function readWaterline(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskWaterline {
  const unknown = (kind: DeskWaterline["kind"], leadLabel: string): DeskWaterline => ({ kind, leadLabel, leadCents: null, reservedCents: null, freeCents: null, lastReconciledAt: null, reconciled: "none" });
  if (!memberActive(household, memberId)) return unknown(scope === "household" ? "fund" : "personal", scope === "household" ? "Operating balance" : "My books");
  if (scope === "personal") {
    try {
      const nest = projectKittyNest(household, memberId, "personal", today);
      return { ...unknown("personal", nest.sourceLabel), leadCents: Number.isFinite(nest.totalCents) ? nest.totalCents : null };
    } catch { return unknown("personal", "My books"); }
  }
  try {
    const fund = projectHouseholdFund(household, today);
    if (fund.configured) {
      return {
        kind: "fund", leadLabel: "Operating balance",
        leadCents: fund.operatingBalanceCents, reservedCents: fund.upcomingReserveCents, freeCents: fund.freeToSpendCents,
        lastReconciledAt: fund.lastReconciledAt, reconciled: fund.lastReconciledAt ? "stamped" : "not-yet",
      };
    }
    const tiles = householdWallet(booksPresentationFloor(household, memberId, "household"), today).tiles;
    const cash = tiles.filter(tile => tile.kind === "chequing" || tile.kind === "other").reduce((sum, tile) => sum + tile.balanceCents, 0);
    return { ...unknown("shared-cash", "Accepted shared operating cash · Fund not set up"), leadCents: cash };
  } catch { return unknown("fund", "Operating balance"); }
}

// ── Spending: the shape ──────────────────────────────────────────────────

export type DeskShapeRow = {
  id: string;
  label: string;
  monthToDateCents: number;
  /** The band this row reads against: its own trailing range (Shared) or its own plan (Personal). Null when there is none to read. */
  bandLowCents: number | null;
  bandHighCents: number | null;
  verdict: ShapeVerdict | "over-plan" | "within-plan" | "no-plan";
  /** The verdict in words: "above", "in shape", "quiet", … */
  word: string;
};

export type DeskSpending = {
  source: "shape" | "plan";
  rows: DeskShapeRow[];
  /** How many categories read above their band (Shared) or over their plan (Personal). */
  overCount: number;
  /** How many rows had a band to read against at all. */
  comparable: number;
  total: number;
};

const SHAPE_WORDS: Record<ShapeVerdict, string> = { above: "above", "in-shape": "in shape", quiet: "quiet", "one-off": "one-off", unknown: "not enough history" };

/** A handful: what is above first (the shape's own order), then the rest that have a band. */
export const SPENDING_ROWS = 4;

export function readSpending(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskSpending | null {
  if (!memberActive(household, memberId)) return null;
  const monthKey = monthKeyFromDateKey(today);
  try {
    if (scope === "household") {
      const shape = categoryShape(household, monthKey, today);
      const banded = (verdict: ShapeVerdict) => verdict === "above" || verdict === "in-shape" || verdict === "quiet";
      const ordered = [...shape.filter(row => banded(row.verdict)), ...shape.filter(row => !banded(row.verdict))];
      return {
        source: "shape", total: shape.length,
        overCount: shape.filter(row => row.verdict === "above").length,
        comparable: shape.filter(row => banded(row.verdict)).length,
        rows: ordered.slice(0, SPENDING_ROWS).map(row => ({
          id: row.subcategoryId, label: row.label, monthToDateCents: row.monthToDateCents,
          bandLowCents: banded(row.verdict) ? row.bandLowCents : null, bandHighCents: banded(row.verdict) ? row.bandHighCents : null,
          verdict: row.verdict, word: SHAPE_WORDS[row.verdict],
        })),
      };
    }
    const summary = monthSummary(booksPresentationFloor(household, memberId, "personal"), monthKey);
    const spent = summary.categories.filter(row => row.type === "expense" && row.actualCents > 0)
      .sort((a, b) => b.actualCents - a.actualCents || a.name.localeCompare(b.name));
    return {
      source: "plan", total: spent.length,
      overCount: spent.filter(row => row.budgetedCents > 0 && row.actualCents > row.budgetedCents).length,
      comparable: spent.filter(row => row.budgetedCents > 0).length,
      rows: spent.slice(0, SPENDING_ROWS).map(row => {
        const planned = row.budgetedCents > 0;
        const verdict = !planned ? "no-plan" : row.actualCents > row.budgetedCents ? "over-plan" : "within-plan";
        return {
          id: row.subcategoryId, label: row.name, monthToDateCents: row.actualCents,
          bandLowCents: planned ? 0 : null, bandHighCents: planned ? row.budgetedCents : null,
          verdict, word: verdict === "over-plan" ? "over plan" : verdict === "within-plan" ? "within plan" : "no plan",
        };
      }),
    };
  } catch { return null; }
}

// ── Goals: the banks against their targets ───────────────────────────────

export type DeskGoal = { id: string; name: string; amountCents: number | null; targetCents: number; date: DateKey | null };

export type DeskGoals = {
  count: number;
  /** The goal banks' total; null (—) when any bank's backing cannot be read. */
  totalCents: number | null;
  targetCents: number;
  top: DeskGoal[];
};

export const GOAL_ROWS = 3;

export function readGoals(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskGoals | null {
  if (!memberActive(household, memberId)) return null;
  try {
    const nest = projectKittyNest(household, memberId, scope, today);
    const goals: NestBank[] = nest.categories.flatMap(category => category.children).filter(bank => bank.state === "open" && bank.tier === "goal");
    const unread = goals.some(goal => goal.amountCents === null || !Number.isFinite(goal.amountCents));
    const top = [...goals].sort((a, b) => (b.amountCents ?? -1) - (a.amountCents ?? -1) || b.targetCents - a.targetCents || a.name.localeCompare(b.name)).slice(0, GOAL_ROWS);
    return {
      count: goals.length,
      totalCents: unread ? null : goals.reduce((sum, goal) => sum + (goal.amountCents ?? 0), 0),
      targetCents: goals.reduce((sum, goal) => sum + goal.targetCents, 0),
      top: top.map(goal => ({ id: goal.id, name: goal.name, amountCents: goal.amountCents, targetCents: goal.targetCents, date: goal.date })),
    };
  } catch { return null; }
}

// ── Contributions: this month's confirmed, per member ────────────────────

export type DeskContribution = { memberId: string; name: string; amountCents: number; rhythm: string | null };

export type DeskContributions = {
  /** No shared Fund, no register: the row says so plainly. */
  configured: boolean;
  monthLabel: string;
  members: DeskContribution[];
};

export function readContributions(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskContributions | null {
  if (!memberActive(household, memberId)) return null;
  const monthKey = monthKeyFromDateKey(today);
  const monthLabel = formatMonthLabel(monthKey).replace(/\s\d{4}$/, "");
  try {
    if (!household.householdFund) return { configured: false, monthLabel, members: [] };
    const register = contributionRegister(household, monthKey, today);
    const rhythms = new Map(twoStreams(household, today).map(stream => [stream.memberId, stream.cadenceLabel]));
    // Personal reads only the member's own; Shared reads every member who confirmed one, in member order.
    const members = household.members.filter(member => scope === "household" ? true : member.id === memberId);
    return {
      configured: true, monthLabel,
      members: members.flatMap(member => {
        const row = register.byMember.find(entry => entry.memberId === member.id);
        if (!row && scope === "household") return [];
        return [{ memberId: member.id, name: member.name, amountCents: row?.amountCents ?? 0, rhythm: rhythms.get(member.id) ?? null }];
      }),
    };
  } catch { return null; }
}

// ── Record: this month's entries ─────────────────────────────────────────

export type DeskRecord = {
  monthLabel: string;
  count: number;
  last: { label: string; date: DateKey; amountCents: number } | null;
};

export function readRecord(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskRecord | null {
  if (!memberActive(household, memberId)) return null;
  const monthKey = monthKeyFromDateKey(today);
  const monthLabel = formatMonthLabel(monthKey).replace(/\s\d{4}$/, "");
  try {
    const floor = booksPresentationFloor(household, memberId, scope);
    const rows = floor.transactions.filter(tx => tx.date.startsWith(`${monthKey}-`) && tx.date <= today);
    const newest = [...rows].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
    return {
      monthLabel, count: rows.length,
      last: newest ? { label: newest.note?.trim() || transactionTypeLabel(newest.type), date: newest.date, amountCents: newest.amountCents } : null,
    };
  } catch { return null; }
}
