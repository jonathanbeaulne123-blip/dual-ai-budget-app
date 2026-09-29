/**
 * Income stops. Expected and confirmed are separate statuses and never merge silently:
 * - expected: the day ledger's pennants (scheduled money in on the Calendar), the Fund's own lower-median estimates
 *   (`prepareFundInflows`, only for dates from today on) and the Fund custodian's pay dates (`paydayTicks`);
 * - confirmed: a recognised posted income root, or a confirmed Fund contribution on or before today.
 * A recurring-sourced posting keeps the expected stop's id (`income:<recurrenceId>@<date>`), so recording it flips
 * the same stop from expected to confirmed. Anything else recorded is `income:tx:<rootId>`, except shift earnings,
 * which are counted on their day rather than drawn as a stop per posting.
 *
 * Recording expected recurring pay goes through the App's reviewed recurrence path (`openDueReview`: the due review
 * posts `postOneRecurrence` after its named Confirm), so the posting carries the recurrence and the SAME stop turns
 * confirmed. That path records only the recurrence's next due occurrence; a pay day still ahead offers the Calendar,
 * never a plain income entry (which would leave the stop expected and add an `income:tx:` twin — review M1).
 * Two postings for one occurrence stay ONE stop that says so ("2 postings · review in the Books"); the figure is never
 * silently summed (review M3).
 */
import { addDays, monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import { prepareFundInflows } from "../../core/fundWalk.ts";
import { activeHouseholdFundEvents, HOUSEHOLD_FUND_ID } from "../../core/householdFund.ts";
import { paydayTicks } from "../../core/monthSpread.ts";
import { journeyIds, type IncomeStop, type SourceRef, type StopAction } from "../contracts.ts";
import { action, relationOf } from "./stopKit.ts";
import { baseItemId, weightKey, type DeriveContext } from "./window.ts";

const MAJOR_INCOME_CENTS = 100_000;

/** The due review can record this occurrence now: the recurrence is active and this date is its next, due, occurrence. */
function reviewable(ctx: DeriveContext, recurrenceId: string | null, date: DateKey): boolean {
  if (!recurrenceId || date > ctx.today) return false;
  const recurrence = (ctx.presented ?? ctx.household).recurrences.find(row => row.id === recurrenceId);
  return Boolean(recurrence && recurrence.active && recurrence.nextDate === date);
}

function incomeActions(ctx: DeriveContext, id: string, status: IncomeStop["status"], origin: IncomeStop["origin"], recurrenceId: string | null, date: DateKey): StopAction[] {
  const books = (primary: boolean) => action(id, "books", "See it in the Books", { name: "openBooks", ref: { kind: "month", monthKey: monthKeyFromDateKey(date) } }, primary);
  if (status === "confirmed") return origin === "fund-confirmed"
    ? [action(id, "fund", "Open the Fund", { name: "openBooks", ref: { kind: "fund" } }, true)]
    : [books(true)];
  if (origin === "fund-estimate" || origin === "payday") return [
    action(id, "record", "Record income…", { name: "openRecord", mode: "income" }, true),
    action(id, "fund", "Open the Fund", { name: "openBooks", ref: { kind: "fund" } }),
  ];
  const calendar = (primary: boolean) => action(id, "calendar", "Open the Calendar", { name: "openCalendar", date }, primary);
  if (recurrenceId) {
    // The reviewed recurrence path, never a plain income entry the recurrence would not know about.
    if (reviewable(ctx, recurrenceId, date)) return [action(id, "review", "Review and record…", { name: "openDueReview", recurrenceId }, true), calendar(false)];
    // Not due yet (or no longer this schedule's next occurrence): read it where the schedule lives.
    return date > ctx.today ? [calendar(true)] : [calendar(true), books(false)];
  }
  return [
    action(id, "record", "Record income…", { name: "openRecord", mode: "income" }, true),
    calendar(false),
  ];
}

function build(ctx: DeriveContext, input: {
  id: string; date: DateKey; label: string; amountCents: number | null; status: IncomeStop["status"];
  origin: IncomeStop["origin"]; memberId: string | null; recurrenceId: string | null; sourceRefs: SourceRef[];
}): IncomeStop {
  const { id, date, status, origin } = input;
  return {
    kind: "income", id, date, chapterId: monthKeyFromDateKey(date), label: input.label,
    amountCents: input.amountCents,
    amountBasis: input.amountCents === null ? "unknown" : status === "confirmed" ? "recorded" : origin === "fund-estimate" ? "estimate" : "scheduled",
    sourceRefs: input.sourceRefs,
    major: input.amountCents !== null && input.amountCents >= MAJOR_INCOME_CENTS,
    relation: relationOf(date, ctx.today),
    actions: incomeActions(ctx, id, status, origin, input.recurrenceId, date),
    status, origin, memberId: input.memberId,
  };
}

export function incomeStops(ctx: DeriveContext): IncomeStop[] {
  const byId = new Map<string, IncomeStop>();
  const put = (stop: IncomeStop) => {
    if (!ctx.monthSet.has(stop.chapterId)) return;
    const prior = byId.get(stop.id);
    // Confirmed beats expected for the same occurrence. A second posting for the same occurrence joins the first as a
    // named source (the status says "2 postings · review in the Books"); its figure is NOT added to the first.
    if (!prior || (prior.status === "expected" && stop.status === "confirmed")) { byId.set(stop.id, stop); return; }
    if (prior.status === "confirmed" && stop.status === "confirmed") {
      prior.sourceRefs = [...prior.sourceRefs, ...stop.sourceRefs.filter(ref => !prior.sourceRefs.some(seen => JSON.stringify(seen) === JSON.stringify(ref)))];
    }
  };
  // Expected: pennants.
  for (const day of ctx.days.values()) {
    for (const pennant of day.pennants) {
      // The custodian's pay ticks are read below, straight from `paydayTicks`: the day ledger draws a tick only on a
      // day with no other pennant, so reading them from here would add or drop a stop when another record changes.
      if (pennant.id.startsWith("payday:")) continue;
      const item = ctx.weight.get(weightKey(pennant.id, day.date))?.item;
      const recurrenceId = item?.recurrenceId ?? null;
      put(build(ctx, {
        id: journeyIds.income(recurrenceId ?? baseItemId(pennant.id, day.date), day.date), date: day.date, label: pennant.name,
        amountCents: pennant.amountCents, status: "expected", origin: "schedule", memberId: pennant.memberId, recurrenceId,
        sourceRefs: recurrenceId ? [{ kind: "recurrence", id: recurrenceId }] : [{ kind: "boardItem", id: pennant.id }],
      }));
    }
  }
  // Confirmed: recognised posted income roots.
  for (const { tx, date } of ctx.recognised) {
    if (tx.type !== "income") continue;
    // Shift earnings (wages / tips posted per shift) enrich their day (`DayCell.postedCount`); a stop per posting
    // would turn shift volume into route tiles. They stay in Shifts and the Books.
    if (tx.source === "shift") continue;
    const scheduled = tx.source === "recurring" && tx.sourceId ? tx.sourceId : null;
    put(build(ctx, {
      id: scheduled ? journeyIds.income(scheduled, date) : journeyIds.incomeRecorded(tx.id), date,
      label: tx.note || "Income", amountCents: tx.amountCents, status: "confirmed", origin: scheduled ? "schedule" : "recorded",
      memberId: null, recurrenceId: scheduled,
      sourceRefs: [...(scheduled ? [{ kind: "recurrence" as const, id: scheduled }] : []), { kind: "transaction", id: tx.id }],
    }));
  }
  // The Fund: confirmed contributions (≤ today) and estimates (≥ today).
  if (ctx.viewerActive && ctx.household.householdFund) {
    let confirmed: ReturnType<typeof prepareFundInflows> = [], estimates: ReturnType<typeof prepareFundInflows> = [];
    try {
      const events = activeHouseholdFundEvents(ctx.household, ctx.household.householdFund.id || HOUSEHOLD_FUND_ID);
      const through = ctx.today < ctx.to ? ctx.today : ctx.to;
      confirmed = prepareFundInflows(ctx.household, events, addDays(ctx.from, -1), through).filter(row => !row.estimated);
      if (ctx.today <= ctx.to) estimates = prepareFundInflows(ctx.household, events, addDays(ctx.today, -1), ctx.to).filter(row => row.estimated && row.date >= ctx.today);
      // A confirmed contribution keys on its own Fund event (`income:fund:<memberId>:<sourceId>@<date>`) whenever it has
      // one, so removing a neighbour never re-keys it (review MINOR 8); it still stands in for the expected Fund stop
      // on its member and date.
      const confirmedAt = new Set<string>();
      for (const row of [...confirmed].sort((a, b) => a.date.localeCompare(b.date) || String(a.sourceId).localeCompare(String(b.sourceId)))) {
        const key = `fund:${row.memberId ?? "unknown"}`;
        const plain = journeyIds.income(key, row.date);
        const id = row.sourceId ? journeyIds.income(`${key}:${row.sourceId}`, row.date) : plain;
        confirmedAt.add(plain);
        put(build(ctx, {
          id, date: row.date, label: "Fund contribution", amountCents: row.amountCents, status: "confirmed", origin: "fund-confirmed",
          memberId: row.memberId, recurrenceId: null, sourceRefs: row.sourceId ? [{ kind: "fundEvent", id: row.sourceId }] : [],
        }));
      }
      // One expected Fund stop per member and date (`income:fund:<memberId>@<date>`): the Fund's estimate when it has
      // one (it carries a figure), else the custodian's pay tick (no figure: "unknown", never zero). A confirmed
      // contribution for that member on that date wins: the expected stop is not drawn beside it.
      for (const row of estimates) {
        if (confirmedAt.has(journeyIds.income(`fund:${row.memberId ?? "unknown"}`, row.date))) continue;
        put(build(ctx, {
          id: journeyIds.income(`fund:${row.memberId ?? "unknown"}`, row.date), date: row.date, label: "Expected Fund contribution",
          amountCents: row.amountCents, status: "expected", origin: "fund-estimate", memberId: row.memberId, recurrenceId: null, sourceRefs: [],
        }));
      }
      const custodian = ctx.household.householdFund.custodianMemberId ?? null;
      const custodianName = ctx.household.members.find(member => member.id === custodian)?.name ?? null;
      for (const month of ctx.months) {
        for (const tick of paydayTicks(ctx.household, month)) {
          if (confirmedAt.has(journeyIds.income(`fund:${custodian ?? "unknown"}`, tick.date))) continue;
          put(build(ctx, {
            id: journeyIds.income(`fund:${custodian ?? "unknown"}`, tick.date), date: tick.date, label: custodianName ? `${custodianName}’s payday` : "Payday",
            amountCents: null, status: "expected", origin: "payday", memberId: custodian, recurrenceId: null, sourceRefs: [],
          }));
        }
      }
    } catch { /* the Fund cannot say; no Fund stops */ }
  }
  return [...byId.values()];
}
