import { addDays, monthEndKey, monthKeyFromDateKey, monthStartKey, type DateKey } from "./calendar.ts";
import { activeHouseholdFundEvents, shapeHouseholdFundConfig } from "./householdFund.ts";
import { advanceCadence } from "./recurrence.ts";
import { retreatCadence } from "./missingSubscriptions.ts";
import { memberEarningSchedule } from "./work.ts";
import { nextWorkScheduleDate } from "./workSettlement.ts";
import { JOINT, type Household, type Recurrence } from "./types.ts";

/**
 * The cellar's income jars (2026-09-16, D-278).
 *
 * Jonathan: for each partner, a hypothetical jar at their expected pay date
 * showing how much the Fund could be at if they contributed all their income.
 * On the pay date it disappears and a contribution kitty bank shows what was
 * actually contributed. Income is not linked to the Fund — contributions are
 * what move money — so the jar is glass, and says "if all of it came in".
 *
 * Privacy (review H8 / R2-M5):
 * - A partner's jar is built only from **household-visible** rows: income
 *   recurrences on an account that is not Personal, and shifts marked
 *   household or both. A partner's Personal rows are never read here, even
 *   when this device happens to hold them.
 * - A member's **own** Personal income rows are read only for their own jar,
 *   only on their own view, and only when they opt in (`ownPrivateOptIn`, a
 *   per-device choice, default off). Nothing is published.
 * - Each member can hide their own pay from the jars (default shown, Q-E). The
 *   choice is shared through the calendar's union-merged notice keys as
 *   time-stamped `hide`/`show` marks; the newest mark wins.
 * - The contribution bank reads confirmed Fund contributions only, which are
 *   already shared Fund facts.
 * Nothing here is sent to Hercules; the D-105 excerpt does not read it.
 */

export type IncomeJarState = "hypothetical" | "contributed";
export type IncomeJarSource = "recurrence" | "shift" | "own-private";

export type CellarIncomeJar = {
  id: string;
  memberId: string;
  memberName: string;
  mine: boolean;
  date: DateKey;
  state: IncomeJarState;
  /** Hypothetical only: the pay this jar imagines coming in whole. 0 once the pay date has come. */
  expectedCents: number;
  /** Hypothetical only: the Fund's water that day plus the whole pay. Never money that exists. */
  ifAllCents: number | null;
  /** Contributed only: the member's confirmed Fund contributions from this pay date until their next one. */
  contributedCents: number;
  sources: IncomeJarSource[];
};

export type IncomeJarReading = {
  jars: CellarIncomeJar[];
  /** Members whose pay is hidden this month (their own choice). */
  hidden: Array<{ memberId: string; name: string; mine: boolean }>;
  /** Members with a shared pay date but no shared amount: no jar, and the words say why. */
  unshared: Array<{ memberId: string; name: string; mine: boolean }>;
};

const PAY_MARK = /^cellar-pay:([^:]+):(hide|show):(.+)$/;
export const cellarPayMark = (memberId: string, choice: "hide" | "show", at: string) => `cellar-pay:${memberId}:${choice}:${at}`;

/** Whether each member has hidden their pay: the newest mark wins; no mark is shown. */
export function hiddenPayMembers(household: Pick<Household, "calendar">): Set<string> {
  const latest = new Map<string, { choice: string; at: string }>();
  for (const key of household.calendar?.dismissedNoticeKeys ?? []) {
    const match = PAY_MARK.exec(key);
    if (!match) continue;
    const [, memberId, choice, at] = match;
    const seen = latest.get(memberId!);
    if (!seen || at! > seen.at || (at === seen.at && choice === "show")) latest.set(memberId!, { choice: choice!, at: at! });
  }
  return new Set([...latest].filter(([, mark]) => mark.choice === "hide").map(([id]) => id));
}

/** A recurrence's dates inside [from, to], walking back from its open day as well as forward. */
function recurrenceDates(recurrence: Recurrence, from: DateKey, to: DateKey): DateKey[] {
  const dates = new Set<DateKey>();
  let back = recurrence.nextDate;
  for (let i = 0; i < 40 && back >= from; i += 1) { if (back <= to) dates.add(back); back = retreatCadence(back, recurrence.cadence); }
  let forward = recurrence.nextDate;
  for (let i = 0; i < 40 && forward <= to; i += 1) { if (forward >= from) dates.add(forward); forward = advanceCadence(forward, recurrence.cadence); }
  return [...dates].sort();
}

/** Who an income recurrence belongs to, and how much of it: the member splits, or the account's owner. */
function recurrenceShares(household: Household, recurrence: Recurrence): Map<string, number> {
  const members = new Set(household.members.filter((row) => row.active).map((row) => row.id));
  const shares = new Map<string, number>();
  for (const split of recurrence.splits ?? []) if (members.has(split.party)) shares.set(split.party, (shares.get(split.party) ?? 0) + split.amountCents);
  if (shares.size) return shares;
  const owner = household.accounts.find((row) => row.id === recurrence.accountId)?.ownerMemberId;
  if (owner && owner !== JOINT && members.has(owner)) shares.set(owner, recurrence.amountCents);
  return shares;
}

function schedulePayDates(household: Household, memberId: string, from: DateKey, to: DateKey): DateKey[] {
  const schedule = memberEarningSchedule(household, memberId);
  if (!schedule) return [];
  const dates: DateKey[] = [];
  let cursor = nextWorkScheduleDate(schedule, from);
  while (cursor && cursor <= to && dates.length < 40) { dates.push(cursor); cursor = nextWorkScheduleDate(schedule, addDays(cursor, 1)); }
  return dates;
}

export function cellarIncomeJars(household: Household, input: {
  today: DateKey;
  memberId: string;
  /** The Fund's water day by day (the cellar's `days`), for the "if all of it came in" figure. */
  days?: ReadonlyArray<{ date: DateKey; balanceCents: number }>;
  /** This member's own Personal income rows may shape their own jar, on this device only. Default off. */
  ownPrivateOptIn?: boolean;
}): IncomeJarReading {
  const { today, memberId } = input;
  const monthKey = monthKeyFromDateKey(today);
  const from = monthStartKey(monthKey), to = monthEndKey(monthKey);
  // A shift worked in the days before the month's first pay date still belongs to that pay.
  const lookback = addDays(from, -31);
  const hiddenIds = hiddenPayMembers(household);
  const balances = new Map((input.days ?? []).map((day) => [day.date, day.balanceCents]));
  const fund = shapeHouseholdFundConfig(household.householdFund);
  const contributions = fund ? activeHouseholdFundEvents(household, fund.id).filter((event) => event.kind === "contribution-confirmed") : [];
  const jars: CellarIncomeJar[] = [];
  const hidden: IncomeJarReading["hidden"] = [];
  const unshared: IncomeJarReading["unshared"] = [];

  for (const member of household.members.filter((row) => row.active)) {
    const mine = member.id === memberId;
    const privateToo = mine && input.ownPrivateOptIn === true;
    // Expected pay by date, and where it came from.
    const pay = new Map<DateKey, { cents: number; sources: Set<IncomeJarSource> }>();
    const add = (date: DateKey, cents: number, source: IncomeJarSource) => {
      if (cents <= 0) return;
      const row = pay.get(date) ?? { cents: 0, sources: new Set<IncomeJarSource>() };
      row.cents += cents; row.sources.add(source); pay.set(date, row);
    };
    for (const recurrence of household.recurrences) {
      if (!recurrence.active || recurrence.type !== "income") continue;
      const account = household.accounts.find((row) => row.id === recurrence.accountId);
      if (!account) continue;
      const personal = account.scope === "personal";
      if (personal && !(privateToo && account.ownerMemberId === member.id)) continue;
      const share = personal ? recurrence.amountCents : recurrenceShares(household, recurrence).get(member.id) ?? 0;
      if (share <= 0) continue;
      for (const date of recurrenceDates(recurrence, from, to)) add(date, share, personal ? "own-private" : "recurrence");
    }
    // Shifts pay out on the member's pay dates: each shift belongs to the first pay date on or after it.
    const scheduled = schedulePayDates(household, member.id, lookback, addDays(to, 1));
    const payDates = scheduled.filter((date) => date >= from && date <= to);
    for (const shift of household.shifts ?? []) {
      if (shift.memberId !== member.id) continue;
      const shared = shift.visibility === "household" || shift.visibility === "both";
      if (!shared && !(privateToo && shift.createdBy === member.id)) continue;
      const payDate = scheduled.find((date) => date >= shift.date);
      if (!payDate || payDate < from || payDate > to) continue;
      add(payDate, Math.max(0, shift.wagesCents) + Math.max(0, shift.netTipsCents), shared ? "shift" : "own-private");
    }
    if (hiddenIds.has(member.id)) { hidden.push({ memberId: member.id, name: member.name, mine }); }
    const dates = [...new Set([...pay.keys(), ...payDates])].sort();
    if (payDates.some((date) => !pay.has(date)) && !pay.size && !hiddenIds.has(member.id)) unshared.push({ memberId: member.id, name: member.name, mine });
    for (const [index, date] of dates.entries()) {
      const next = dates[index + 1] ?? addDays(to, 1);
      const expected = pay.get(date);
      if (date <= today) {
        // The pay date has come: the glass jar is gone, and the bank shows what was actually contributed.
        const contributedCents = contributions
          .filter((event) => event.contributorMemberId === member.id && event.date >= date && event.date < next)
          .reduce((sum, event) => sum + event.amountCents, 0);
        jars.push({ id: `income:${member.id}:${date}`, memberId: member.id, memberName: member.name, mine, date, state: "contributed", expectedCents: 0, ifAllCents: null, contributedCents, sources: [] });
        continue;
      }
      if (!expected || hiddenIds.has(member.id)) continue;
      const water = balances.get(date);
      jars.push({
        id: `income:${member.id}:${date}`, memberId: member.id, memberName: member.name, mine, date, state: "hypothetical",
        expectedCents: expected.cents, ifAllCents: water === undefined ? null : Math.max(0, water) + expected.cents,
        contributedCents: 0, sources: [...expected.sources].sort(),
      });
    }
  }
  return { jars: jars.sort((a, b) => a.date.localeCompare(b.date) || a.memberName.localeCompare(b.memberName)), hidden, unshared };
}

/** The jar's words: glass, conditional, never a claim that the money exists. */
export function incomeJarWords(jar: CellarIncomeJar, format: (cents: number) => string): string {
  const who = jar.mine ? "your" : `${jar.memberName}'s`;
  if (jar.state === "contributed") {
    return jar.contributedCents > 0
      ? `${jar.mine ? "You" : jar.memberName} contributed ${format(jar.contributedCents)} to the Fund since ${who} pay day.`
      : `Nothing contributed to the Fund yet since ${who} pay day.`;
  }
  return `If all of ${who} pay came in — about ${format(jar.expectedCents)} — the Fund could stand at ${jar.ifAllCents === null ? "that much more" : format(jar.ifAllCents)}. Only a contribution moves money.`;
}
