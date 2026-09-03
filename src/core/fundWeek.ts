// The week — what it contains, not a record of what got done. Due, posted,
// whose turn. A forward view: nothing here is tickable, and nothing here
// invents a ritual that doesn't exist yet — it only shows one, quietly,
// if the charter already set one.
//
// Every figure here is read off existing, already-audited money surfaces —
// monthObligations for due/posted, fundWeekMovements for the weekly net
// (the same engine fundPlates.ts's own weekPlate already uses, so this stage
// never invents a second way to add up "this week"). The two do read
// different windows on purpose — the plate's a rolling seven days from
// today, this stage a fixed Monday-through-Sunday calendar week — so their
// totals agree only when today happens to be a Monday. What they share is
// the engine, not the answer.
// Nothing here computes a second balance.

import {
  addDays,
  weekdaySunday0,
  monthKeyFromDateKey,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import { fundWeekMovements } from "./fundWalk.ts";
import { activeHouseholdFundEvents, HOUSEHOLD_FUND_ID, shapeHouseholdFundConfig } from "./householdFund.ts";
import { monthObligations } from "./monthObligations.ts";
import { paydayTicks } from "./monthSpread.ts";
import { workShiftIsReversed } from "./work.ts";
import type { Household } from "./types.ts";

const WEEK_DAYS = 7;

export type WeekEntryKind = "due" | "posted" | "payday" | "shift" | "sitdown";

export type WeekEntry = {
  kind: WeekEntryKind;
  label: string;
  amountCents: number | null;
  memberId: string | null;
};

export type WeekDay = {
  date: DateKey;
  weekday: number;
  isToday: boolean;
  entries: WeekEntry[];
};

export type FundWeek = {
  days: WeekDay[];
  outCents: number;
  inCents: number;
  shiftCount: number;
};

/** Monday of the calendar week containing `date`. `weekdaySunday0` is Sun=0..Sat=6. */
function mondayOf(date: DateKey): DateKey {
  const sinceMonday = (weekdaySunday0(date) + 6) % 7;
  return addDays(date, -sinceMonday);
}

/** What the week contains, Monday through Sunday. Nothing here is tickable. */
export function fundWeek(household: Household, today: DateKey): FundWeek {
  const start = mondayOf(today);
  const dates: DateKey[] = [];
  for (let offset = 0; offset < WEEK_DAYS; offset += 1) dates.push(addDays(start, offset));
  const end = dates[dates.length - 1]!;

  const config = shapeHouseholdFundConfig(household.householdFund);
  const fundId = config?.id || HOUSEHOLD_FUND_ID;
  const dateSet = new Set(dates);
  const monthKeys = [...new Set(dates.map((date) => monthKeyFromDateKey(date)))] as MonthKey[];

  // Due and posted come straight off monthObligations — the same
  // canonical, already-privacy-filtered list of what the Fund owes and has
  // paid. A row already carries which of the two it is; nothing here
  // re-derives that distinction.
  const obligationsByDate = new Map<DateKey, Array<{ label: string; amountCents: number; posted: boolean }>>();
  for (const monthKey of monthKeys) {
    for (const row of monthObligations(household, monthKey, today).rows) {
      if (!dateSet.has(row.date)) continue;
      const list = obligationsByDate.get(row.date) ?? [];
      list.push({ label: row.label, amountCents: row.amountCents, posted: row.source === "posted" });
      obligationsByDate.set(row.date, list);
    }
  }

  // Payday is a timing mark — the custodian's own known pay dates, the same
  // ticks the Level draws. A confirmed contribution earns a mark too, even
  // on a day off the regular cadence, because money that actually landed is
  // never invisible here — and it is always attributed to whoever actually
  // contributed, never folded into the custodian's own tick.
  const custodianTickDates = new Set(config ? monthKeys.flatMap((monthKey) => paydayTicks(household, monthKey).map((tick) => tick.date)) : []);
  // Keyed by the real contributor, `null` included — money that landed
  // without a recorded contributor is still money that landed, and it
  // still earns a mark (rendered as "A member") rather than vanishing from
  // the grid while still counting toward inCents below.
  const confirmedByDateAndMember = new Map<DateKey, Map<string | null, number>>();
  if (config) {
    for (const event of activeHouseholdFundEvents(household, fundId)) {
      if (event.kind !== "contribution-confirmed" || !dateSet.has(event.date)) continue;
      const contributorMemberId = event.contributorMemberId ?? null;
      const byMember = confirmedByDateAndMember.get(event.date) ?? new Map<string | null, number>();
      byMember.set(contributorMemberId, (byMember.get(contributorMemberId) ?? 0) + event.amountCents);
      confirmedByDateAndMember.set(event.date, byMember);
    }
  }

  // Sit down appears only for a weekly cadence, on its named weekday.
  // Biweekly and monthly have no anchor date recorded anywhere in the
  // charter, so there is no honest way to say which week is theirs. The
  // weekly-document offer meets this same gap with its own reason code
  // ("unsupported-cadence"); a WeekEntry has no room for a third state
  // between "offered" and "no cadence at all," so here it collapses to the
  // same no-sitdown outcome as `cadence: "none"` — a deliberate
  // simplification, not a claim that the two files agree in every detail.
  const charter = household.charter ?? null;
  const sitdownWeekday = charter && charter.cadence === "weekly" ? charter.cadenceWeekday : null;

  let shiftCount = 0;
  const days: WeekDay[] = dates.map((date) => {
    const entries: WeekEntry[] = [];

    for (const row of obligationsByDate.get(date) ?? []) {
      entries.push({
        kind: row.posted ? "posted" : "due",
        label: row.label,
        amountCents: row.amountCents,
        memberId: null,
      });
    }

    const confirmedThatDay = confirmedByDateAndMember.get(date);
    if (confirmedThatDay) {
      for (const [contributorMemberId, amountCents] of confirmedThatDay) {
        entries.push({ kind: "payday", label: "Payday", amountCents, memberId: contributorMemberId ?? null });
      }
    }
    // A plain timing tick only when the custodian didn't already earn a
    // real entry above — an expected payday is never shown twice.
    if (custodianTickDates.has(date) && !confirmedThatDay?.has(config?.custodianMemberId ?? "")) {
      entries.push({ kind: "payday", label: "Payday", amountCents: null, memberId: config?.custodianMemberId ?? null });
    }

    for (const shift of household.shifts) {
      if (shift.date !== date || shift.visibility === "personal") continue;
      if (workShiftIsReversed(household, shift)) continue;
      shiftCount += 1;
      // Whose shift, never what it earned — amountCents is null, always.
      entries.push({ kind: "shift", label: "Shift", amountCents: null, memberId: shift.memberId });
    }

    if (sitdownWeekday !== null && weekdaySunday0(date) === sitdownWeekday) {
      entries.push({ kind: "sitdown", label: "Sit down", amountCents: null, memberId: null });
    }

    return { date, weekday: weekdaySunday0(date), isToday: date === today, entries };
  });

  // fundWeekMovements takes its lower bound exclusive (it's built for a
  // "from tomorrow" rolling glance, not a calendar week) — called with
  // `start` itself that silently drops a contribution confirmed exactly on
  // the week's Monday from inCents, even though the grid above already
  // shows it. Asking for one extra day back makes Monday inclusive; the
  // result is then filtered back down to the real week so nothing from
  // Sunday leaks in. Outflows keep the unshifted anchor — projectedObligations
  // clamps an overdue row's date up to its anchor, so shifting it back would
  // wrongly pull a still-outstanding bill's clamp point earlier.
  const inflowMovements = fundWeekMovements(household, addDays(start, -1), end);
  const inCents = inflowMovements
    .filter((movement) => movement.kind === "contribution" && movement.date >= start && movement.date <= end)
    .reduce((sum, movement) => sum + movement.deltaCents, 0);

  const outflowMovements = fundWeekMovements(household, start, end);
  const outCents = outflowMovements
    .filter((movement) => movement.kind === "obligation")
    .reduce((sum, movement) => sum + Math.abs(movement.deltaCents), 0);

  return { days, outCents, inCents, shiftCount };
}
