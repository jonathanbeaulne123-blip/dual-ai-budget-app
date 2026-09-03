import {
  addDays,
  monthEndKey,
  monthKeyFromDateKey,
  monthStartKey,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import {
  HOUSEHOLD_FUND_ID,
  activeHouseholdFundEvents,
  householdFundContributionMotions,
  householdFundOperatingDelta,
  projectHouseholdFund,
  projectHouseholdFundOperatingBalanceBefore,
  shapeHouseholdFundConfig,
  shapeHouseholdFundMonthPlans,
} from "./householdFund.ts";
import { monthObligations, type MonthObligation } from "./monthObligations.ts";
import { contributionRegister } from "./contributionRegister.ts";
import { projectCadence } from "./recurrence.ts";
import type { Household, HouseholdFundEvent } from "./types.ts";

/** A member needs this many confirmed contributions before we will estimate another. */
export const WALK_MIN_CONTRIBUTIONS = 3;
/** How far back we look for those contributions. */
export const WALK_OBSERVATION_DAYS = 90;

export type WalkPointKind = "opening" | "contribution" | "settlement" | "kitty" | "obligation";

export type WalkPoint = {
  date: DateKey;
  kind: WalkPointKind;
  label: string;
  deltaCents: number;
  balanceCents: number;
  actual: boolean;
  /** True only for an observed contribution estimate. Never for a found amount. */
  estimated: boolean;
  memberId: string | null;
  sourceId: string | null;
};

export type BelowBufferRun = { fromDate: DateKey; toDate: DateKey; days: number; lowCents: number };

export type InflowConfidence = "none" | "found" | "observed";

export type FundWalk = {
  monthKey: MonthKey;
  today: DateKey;
  openingCents: number;
  points: WalkPoint[];
  todayBalanceCents: number;
  bufferCents: number;
  belowBufferRuns: BelowBufferRun[];
  bufferCrossDate: DateKey | null;
  dryDate: DateKey | null;
  endBalanceCents: number;
  shortfallCents: number;
  inflowConfidence: InflowConfidence;
  hasConfirmedContribution: boolean;
  tiesToProjection: boolean;
};

export type WalkHypothetical = { confirmEventIds?: string[]; deferObligationIds?: string[] };

function emptyWalk(monthKey: MonthKey, today: DateKey): FundWalk {
  return {
    monthKey,
    today,
    openingCents: 0,
    points: [],
    todayBalanceCents: 0,
    bufferCents: 0,
    belowBufferRuns: [],
    bufferCrossDate: null,
    dryDate: null,
    endBalanceCents: 0,
    shortfallCents: 0,
    inflowConfidence: "none",
    hasConfirmedContribution: false,
    tiesToProjection: false,
  };
}

function pointKindFor(event: HouseholdFundEvent): WalkPointKind {
  if (event.kind === "contribution-confirmed") return "contribution";
  if (event.kind === "settlement-confirmed") return "settlement";
  return "kitty";
}

function eventLabel(event: HouseholdFundEvent): string {
  if (event.kind === "contribution-confirmed") return "Contribution";
  if (event.kind === "settlement-confirmed") return "Settled";
  if (event.kind === "kitty-allocated") return "Moved to a goal";
  return "Released from a goal";
}

/** Lower of the two middles on an even count: deterministic, and never flattering. */
function lowerMedian(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length / 2) - 1]!;
}

function memberPayDates(household: Household, memberId: string, from: DateKey, to: DateKey): DateKey[] {
  const schedules = (household.workJobs ?? [])
    .filter((row) => row.memberId === memberId && row.active !== false && row.paySchedule?.anchorDate)
    .map((row) => row.paySchedule)
    .sort((left, right) => `${left.anchorDate}:${left.cadence}`.localeCompare(`${right.anchorDate}:${right.cadence}`));
  const unique = new Map(schedules.map((schedule) => [`${schedule.anchorDate}:${schedule.cadence}`, schedule]));
  // Multiple employers can publish different pay clocks. Withhold the estimate
  // instead of letting workJobs array order choose one.
  if (unique.size !== 1) return [];
  const schedule = [...unique.values()][0]!;
  const cadence = schedule.cadence === "weekly" ? "weekly" : "biweekly";
  return projectCadence(schedule.anchorDate, cadence, from, to);
}

type ProjectedInflow = { date: DateKey; amountCents: number; memberId: string | null; estimated: boolean; sourceId: string | null; label: string };
type ProjectedOutflow = { date: DateKey; amountCents: number; label: string; sourceId: string };

export type FundWeekMovement = {
  date: DateKey;
  kind: "contribution" | "obligation";
  label: string;
  deltaCents: number;
  estimated: boolean;
};

/**
 * Inflows are found, never assumed. A pay cadence supplies a date; it never
 * supplies an amount. Below the observation threshold nothing is projected.
 */
function projectedInflows(
  household: Household,
  events: readonly HouseholdFundEvent[],
  from: DateKey,
  to: DateKey,
): ProjectedInflow[] {
  const inflows: ProjectedInflow[] = [];

  for (const event of events) {
    if (event.kind !== "contribution-confirmed") continue;
    if (event.date > from && event.date <= to) {
      inflows.push({
        date: event.date, amountCents: event.amountCents, memberId: event.contributorMemberId,
        estimated: false, sourceId: event.id, label: "Contribution",
      });
    }
  }

  const window = addDays(from, -WALK_OBSERVATION_DAYS);
  const byMember = new Map<string, number[]>();
  for (const event of events) {
    if (event.kind !== "contribution-confirmed") continue;
    if (!event.contributorMemberId) continue;
    if (event.date < window || event.date > from) continue;
    const list = byMember.get(event.contributorMemberId) ?? [];
    list.push(event.amountCents);
    byMember.set(event.contributorMemberId, list);
  }
  for (const [memberId, amounts] of [...byMember.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (amounts.length < WALK_MIN_CONTRIBUTIONS) continue;
    const amountCents = lowerMedian(amounts);
    if (amountCents <= 0) continue;
    for (const date of memberPayDates(household, memberId, addDays(from, 1), to)) {
      const alreadyKnown = inflows.some((row) => row.memberId === memberId && row.date === date);
      if (alreadyKnown) continue;
      inflows.push({
        date, amountCents, memberId, estimated: true,
        sourceId: `estimate:${memberId}:${date}`, label: "Expected contribution",
      });
    }
  }

  return inflows;
}

function projectedObligations(
  household: Household,
  monthKey: MonthKey,
  anchor: DateKey,
): { obligations: ReturnType<typeof monthObligations>; rows: ProjectedOutflow[] } {
  const obligations = monthObligations(household, monthKey, anchor);
  const projection = projectHouseholdFund(household, anchor);
  const outstandingByTransaction = new Map(
    projection.transactionPositions.map((position) => [position.transactionId, position.outstandingCents]),
  );
  const rows = obligations.rows.flatMap((row: MonthObligation) => {
    // A posted purchase leaves the pool when it is settled, not when it is swiped.
    // Whatever has already been settled must never be charged to the future again.
    const amountCents = row.source === "posted" && row.transactionId
      ? outstandingByTransaction.get(row.transactionId) ?? 0
      : row.amountCents;
    if (amountCents <= 0) return [];
    return [{
      // A claim already made is owed now; a future bill lands on its own day.
      date: row.date < anchor ? anchor : row.date,
      amountCents,
      label: row.label,
      sourceId: row.id,
    }];
  });
  return { obligations, rows };
}

function foldWalk(
  household: Household,
  monthKey: MonthKey,
  today: DateKey,
  hypothetical: WalkHypothetical,
): FundWalk {
  const config = shapeHouseholdFundConfig(household.householdFund);
  if (!config) return emptyWalk(monthKey, today);

  const fundId = config.id || HOUSEHOLD_FUND_ID;
  const start = monthStartKey(monthKey);
  const end = monthEndKey(monthKey);
  const anchor = today < start ? start : today > end ? end : today;
  const confirmEventIds = new Set(hypothetical.confirmEventIds ?? []);
  const deferred = new Set(hypothetical.deferObligationIds ?? []);

  const events = activeHouseholdFundEvents(household, fundId);
  const openingCents = projectHouseholdFundOperatingBalanceBefore(household, start, fundId);

  const points: WalkPoint[] = [];
  let balance = openingCents;
  points.push({
    date: start, kind: "opening", label: "Carried in", deltaCents: openingCents,
    balanceCents: balance, actual: true, estimated: false, memberId: null, sourceId: null,
  });

  const actualEvents = events
    .filter((event) => event.date >= start && event.date <= anchor)
    .filter((event) => householdFundOperatingDelta(event) !== 0)
    .sort((left, right) => left.date.localeCompare(right.date)
      || left.createdAt.localeCompare(right.createdAt)
      || left.id.localeCompare(right.id));

  for (const event of actualEvents) {
    const deltaCents = householdFundOperatingDelta(event);
    balance += deltaCents;
    points.push({
      date: event.date, kind: pointKindFor(event), label: eventLabel(event), deltaCents,
      balanceCents: balance, actual: true, estimated: false,
      memberId: event.contributorMemberId, sourceId: event.id,
    });
  }
  const canonicalTodayBalanceCents = balance;
  const { obligations, rows: allOutflows } = projectedObligations(household, monthKey, anchor);
  const outflows = allOutflows.filter((row) => !deferred.has(row.sourceId));

  const canonicalInflows = projectedInflows(household, events, anchor, end);
  let inflows = [...canonicalInflows];
  const actionableMotions = new Map(householdFundContributionMotions(household, fundId)
    .filter((motion) => motion.status === "open" || motion.status === "held")
    .map((motion) => [motion.proposal.id, motion.proposal]));
  let hypotheticalContributionCents = 0;
  for (const id of confirmEventIds) {
    const proposal = actionableMotions.get(id);
    if (!proposal) continue;
    const contributionDate = proposal.date <= anchor ? anchor : proposal.date;
    if (contributionDate > end) continue;
    hypotheticalContributionCents += proposal.amountCents;
    if (proposal.date <= anchor) {
      // This explicit what-if shows the balance that a later Confirm would create.
      balance += proposal.amountCents;
      points.push({
        date: anchor, kind: "contribution", label: "Hypothetical contribution",
        deltaCents: proposal.amountCents, balanceCents: balance, actual: false, estimated: false,
        memberId: proposal.contributorMemberId, sourceId: proposal.id,
      });
      continue;
    }
    // A real confirmation suppresses the observed estimate for this member's
    // pay date. The what-if must do the same or it counts one contribution
    // twice and can falsely claim that the month clears.
    inflows = inflows.filter((row) => !(
      row.estimated
      && row.memberId === proposal.contributorMemberId
      && row.date === contributionDate
    ));
    inflows.push({
      date: contributionDate, amountCents: proposal.amountCents,
      memberId: proposal.contributorMemberId, estimated: false,
      sourceId: proposal.id, label: "Hypothetical contribution",
    });
  }

  const todayBalanceCents = balance;

  const projected = [
    ...inflows.map((row) => ({
      date: row.date, deltaCents: row.amountCents, label: row.label,
      kind: "contribution" as WalkPointKind, estimated: row.estimated,
      memberId: row.memberId, sourceId: row.sourceId,
    })),
    ...outflows.map((row) => ({
      date: row.date, deltaCents: -row.amountCents, label: row.label,
      kind: "obligation" as WalkPointKind, estimated: false,
      memberId: null as string | null, sourceId: row.sourceId,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date)
    // On one day, money in lands before money out. Deterministic, and the charitable reading.
    || Math.sign(right.deltaCents) - Math.sign(left.deltaCents)
    || (left.sourceId ?? "").localeCompare(right.sourceId ?? ""));

  for (const row of projected) {
    balance += row.deltaCents;
    points.push({
      date: row.date, kind: row.kind, label: row.label, deltaCents: row.deltaCents,
      balanceCents: balance, actual: false, estimated: row.estimated,
      memberId: row.memberId, sourceId: row.sourceId,
    });
  }

  const plan = shapeHouseholdFundMonthPlans(household.fundMonthPlans)
    .find((row) => row.fundId === fundId && row.monthKey === monthKey);
  const bufferCents = plan?.bufferCents ?? 0;

  const hasConfirmedContribution = events.some((event) => event.kind === "contribution-confirmed");
  const projectedPoints = points.filter((point) => !point.actual);
  const dryPoint = hasConfirmedContribution
    ? projectedPoints.find((point) => point.balanceCents < 0) ?? null
    : null;
  const crossPoint = bufferCents > 0
    ? points.find((point) => point.date >= anchor && point.balanceCents < bufferCents) ?? null
    : null;

  const belowBufferRuns: BelowBufferRun[] = [];
  if (bufferCents > 0) {
    let run: BelowBufferRun | null = null;
    const byDate = new Map<DateKey, WalkPoint[]>();
    for (const point of points) {
      const rows = byDate.get(point.date) ?? [];
      rows.push(point);
      byDate.set(point.date, rows);
    }
    for (const [date, rows] of [...byDate.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
      const closing = rows.at(-1)!;
      if (closing.balanceCents < bufferCents) {
        const lowCents = Math.min(...rows.map((point) => point.balanceCents));
        if (!run) run = { fromDate: date, toDate: date, days: 1, lowCents };
        else run.lowCents = Math.min(run.lowCents, lowCents);
      } else if (run) {
        run.toDate = addDays(date, -1);
        belowBufferRuns.push(run);
        run = null;
      }
    }
    if (run) {
      run.toDate = end;
      belowBufferRuns.push(run);
    }
    for (const item of belowBufferRuns) {
      item.days = Math.max(1, Math.round(
        (Date.parse(`${item.toDate}T00:00:00Z`) - Date.parse(`${item.fromDate}T00:00:00Z`)) / 86400000,
      ) + 1);
    }
  }

  const inflowConfidence: InflowConfidence = inflows.length === 0
    ? "none"
    : inflows.some((row) => row.estimated) ? "observed" : "found";

  const register = contributionRegister(household, monthKey, anchor);
  const canonicalEndBalanceCents = canonicalTodayBalanceCents
    + canonicalInflows.filter((row) => !row.estimated).reduce((sum, row) => sum + row.amountCents, 0)
    - allOutflows.reduce((sum, row) => sum + row.amountCents, 0);
  const sameDateOperatingCents = projectHouseholdFundOperatingBalanceBefore(
    household,
    addDays(anchor, 1),
    fundId,
  );
  const deferredCents = allOutflows
    .filter((row) => deferred.has(row.sourceId))
    .reduce((sum, row) => sum + row.amountCents, 0);
  const shortfallCents = Math.max(
    0,
    register.unfundedCents - hypotheticalContributionCents - deferredCents,
  );
  const tiesToProjection = obligations.tiesToProjection
    && register.tiesToProjection
    && canonicalTodayBalanceCents === sameDateOperatingCents
    && Math.max(0, -canonicalEndBalanceCents) === register.unfundedCents;

  const endBalanceCents = balance;
  return {
    monthKey,
    today,
    openingCents,
    points,
    todayBalanceCents,
    bufferCents,
    belowBufferRuns,
    bufferCrossDate: crossPoint?.date ?? null,
    dryDate: dryPoint?.date ?? null,
    endBalanceCents,
    shortfallCents,
    inflowConfidence,
    hasConfirmedContribution,
    tiesToProjection,
  };
}

/** The month's operating balance, folded once. Solid behind, dashed ahead. */
export function fundWalk(household: Household, monthKey: MonthKey, today: DateKey): FundWalk {
  return foldWalk(household, monthKey, today, {});
}

/** The same fold with a motion treated as confirmed, or an obligation deferred. Mutates nothing. */
export function fundWalkWith(
  household: Household,
  monthKey: MonthKey,
  today: DateKey,
  hypothetical: WalkHypothetical,
): FundWalk {
  return foldWalk(household, monthKey, today, hypothetical);
}

/** Seven-day Shared preview. It may cross a month boundary, but never posts money. */
export function fundWeekMovements(
  household: Household,
  today: DateKey,
  through: DateKey = addDays(today, 6),
): FundWeekMovement[] {
  const config = shapeHouseholdFundConfig(household.householdFund);
  if (!config || through < today) return [];
  const events = activeHouseholdFundEvents(household, config.id || HOUSEHOLD_FUND_ID);
  const monthKeys = [...new Set([monthKeyFromDateKey(today), monthKeyFromDateKey(through)])];
  const outflows = monthKeys.flatMap((monthKey) => projectedObligations(household, monthKey, today).rows)
    .filter((row) => row.date >= today && row.date <= through)
    .map((row) => ({
      date: row.date,
      kind: "obligation" as const,
      label: row.label,
      deltaCents: -row.amountCents,
      estimated: false,
    }));
  const inflows = projectedInflows(household, events, today, through).map((row) => ({
    date: row.date,
    kind: "contribution" as const,
    label: row.label,
    deltaCents: row.amountCents,
    estimated: row.estimated,
  }));
  return [...inflows, ...outflows].sort((left, right) => left.date.localeCompare(right.date)
    || Math.sign(right.deltaCents) - Math.sign(left.deltaCents)
    || left.label.localeCompare(right.label));
}

/** The month a walk should default to for a civil date. */
export function walkMonthFor(today: DateKey): MonthKey {
  return monthKeyFromDateKey(today);
}
