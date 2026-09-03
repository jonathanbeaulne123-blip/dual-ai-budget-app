/**
 * The Fund's plates — the shared floor's widgets, over selectors that already exist.
 *
 * Presentation only. Every figure is one of the six primitives in plates.ts and
 * every number is read from fundWalk or an existing projection. Nothing here
 * posts, settles, or moves a cent, and nothing computes a second balance.
 */

import { addDays, calendarDaysBetween, formatDateLabel, monthKeyFromDateKey, type DateKey, type MonthKey } from "./calendar.ts";
import { formatCad } from "./money.ts";
import { isCreditKind } from "./accounts.ts";
import { accountRows, chosenAccount } from "./accountsWidget.ts";
import { claimRemainingCents, outstandingClaims } from "./appointments.ts";
import { categoryShape } from "./categoryShape.ts";
import { fundWalk, fundWeekMovements, type FundWalk, type WalkPoint } from "./fundWalk.ts";
import {
  householdFundContributionMotions,
  projectHouseholdFund,
  shapeHouseholdFundConfig,
} from "./householdFund.ts";
import { openGoals } from "./goalVault.ts";
import { twoStreams } from "./twoStreams.ts";
import type { Finding } from "./health.ts";
import type { DeskPlateModel, FillWell, PlateEdge, TrackMark } from "./deskPlates.ts";
import type { Goal } from "./types.ts";
import type { Household } from "./types.ts";

export const FUND_PLATE_IDS = [
  "fund-level", "waiting", "next-out", "spoken-for", "settle", "accounts", "week", "saving", "shape", "streams",
] as const;
export type FundPlateId = (typeof FUND_PLATE_IDS)[number];

/** The six original shared plates, and what now answers each question. */
export const RETIRED_SHARED_PLATE_IDS = {
  due: "next-out",
  cards: "accounts",
  owed: "settle",
  coming: "week",
  trust: "fund-level",
  saving: "saving",
} as const;

const TRACK_ROOM = 28;
const WEEK_DAYS = 7;

function ordinal(day: number): string {
  const rest = day % 100;
  if (rest >= 11 && rest <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

function dayOf(date: DateKey): number {
  return Number(date.slice(8, 10));
}

function futureOutflows(walk: FundWalk): WalkPoint[] {
  return walk.points.filter((point) => !point.actual && point.kind === "obligation");
}

function futureInflows(walk: FundWalk): WalkPoint[] {
  return walk.points.filter((point) => !point.actual && point.deltaCents > 0);
}

function levelSpark(walk: FundWalk): { points: number[]; actualCount: number } {
  const allRows = walk.points.filter((point) => point.kind !== "opening");
  const actualRows = allRows.filter((point) => point.actual);
  const projectedRows = allRows.filter((point) => !point.actual);
  const rows = allRows.length <= 24 || projectedRows.length === 0
    ? allRows.slice(0, 24)
    : [
        ...actualRows.slice(-Math.min(12, actualRows.length)),
        ...projectedRows.slice(0, 24 - Math.min(12, actualRows.length)),
      ];
  const projectedAt = rows.findIndex((point) => !point.actual);
  return {
    points: rows.map((point) => point.balanceCents),
    actualCount: projectedAt < 0 ? rows.length : projectedAt,
  };
}

/** Highest true statement wins. The covered case never manufactures a worry. */
export function levelHeadline(walk: FundWalk, findings: readonly Finding[]): string {
  if (!walk.tiesToProjection) return "These rows don't tie to the ledger yet.";
  if (walk.dryDate) return `At this pace the Fund runs dry on the ${ordinal(dayOf(walk.dryDate))}.`;
  const run = walk.belowBufferRuns.find((item) => item.days >= 3);
  if (run) {
    return `Under the buffer from the ${ordinal(dayOf(run.fromDate))} to the ${ordinal(dayOf(run.toDate))}`
      + ` — ${run.days} days on ${formatCad(run.lowCents)}.`;
  }
  if (!walk.hasConfirmedContribution) {
    return "This is only the bills you've told me about. Nothing has actually happened yet.";
  }
  if (walk.inflowConfidence === "observed" && walk.shortfallCents > 0) {
    return `The register is still short ${formatCad(walk.shortfallCents)}. The dashed contribution is observed, not confirmed.`;
  }
  if (findings.length) return "The books are current. There are findings to read.";
  return "This month is covered.";
}

function levelPlate(walk: FundWalk, findings: readonly Finding[]): DeskPlateModel {
  const edge: PlateEdge = !walk.tiesToProjection || walk.dryDate || walk.shortfallCents > 0 ? "attention"
    : findings.length ? "quiet" : "clear";
  return {
    id: "fund-level",
    kicker: "The Household Fund",
    glance: formatCad(walk.todayBalanceCents),
    verdict: levelHeadline(walk, findings),
    footing: walk.bufferCents > 0
      ? `Solid to today, dashed after. Buffer ${formatCad(walk.bufferCents)}.`
      : "Solid to today, dashed after. No buffer agreed yet.",
    edge,
    copperVerdict: Boolean(walk.dryDate) || walk.shortfallCents > 0 || !walk.tiesToProjection,
    figure: { primitive: "spark", ...levelSpark(walk), room: TRACK_ROOM },
    empty: walk.points.length <= 1 ? "Nothing has moved through the Fund yet." : null,
    cabinet: "blotter",
    cabinetName: "The month",
  };
}

function waitingPlate(household: Household): DeskPlateModel {
  const motions = householdFundContributionMotions(household);
  const open = motions.filter((motion) => motion.status === "open");
  const held = motions.filter((motion) => motion.status === "held");
  const top = open[0] ?? held[0] ?? null;
  const countable = open.length >= 1 && open.length <= 31;
  return {
    id: "waiting",
    kicker: "Waiting on you",
    glance: open.length === 0
      ? (held.length ? `${held.length} held` : "Nothing")
      : `${open.length} to confirm`,
    verdict: open.length === 0
      ? (held.length ? "Held — let's talk about this." : "Nothing has moved.")
      : `${formatCad(top?.proposal.amountCents ?? 0)} raised, waiting on a confirm.`,
    footing: "Raised contributions only. A proposal never creates money.",
    edge: open.length ? "attention" : "clear",
    copperVerdict: open.length > 0,
    figure: { primitive: "tally", count: countable ? open.length : 0 },
    empty: open.length === 0 && held.length === 0 ? "Nothing has moved." : null,
    cabinet: "mail",
    cabinetName: "The motions",
  };
}

function nextOutPlate(walk: FundWalk): DeskPlateModel {
  const outflows = futureOutflows(walk);
  const next = outflows[0] ?? null;
  const marks: TrackMark[] = outflows.slice(0, 6).map((point) => ({
    day: dayOf(point.date),
    cents: Math.abs(point.deltaCents),
    label: point.label,
  }));
  const breaking = outflows.find((point) => point.balanceCents < 0) ?? null;
  return {
    id: "next-out",
    kicker: "Next out",
    glance: next ? formatCad(Math.abs(next.deltaCents)) : "Nothing",
    verdict: next
      ? `${next.label} leaves on ${formatDateLabel(next.date)}.`
      : "Nothing else leaves the Fund this month.",
    footing: breaking
      ? `${breaking.label} is the one that breaks the month.`
      : "What leaves the Fund, and what it leaves behind.",
    edge: breaking ? "attention" : next ? "live" : "clear",
    copperVerdict: Boolean(breaking),
    figure: { primitive: "track", days: 31, marks, room: TRACK_ROOM },
    empty: outflows.length ? null : "Nothing owed for the rest of the month.",
    cabinet: "calendar",
    cabinetName: "What leaves next",
  };
}

function spokenForPlate(walk: FundWalk): DeskPlateModel {
  const nextInflow = futureInflows(walk)[0] ?? null;
  const through = nextInflow?.date ?? null;
  const claimed = futureOutflows(walk)
    .filter((point) => !through || point.date <= through)
    .reduce((sum, point) => sum + Math.abs(point.deltaCents), 0);
  const pool = Math.max(0, walk.todayBalanceCents);
  const pct = pool > 0 ? claimed / pool : claimed > 0 ? 1.5 : 0;
  return {
    id: "spoken-for",
    kicker: "Spoken for",
    glance: formatCad(claimed),
    verdict: claimed > pool
      ? `Claims of ${formatCad(claimed)} sit against ${formatCad(pool)} in the pool.`
      : `That leaves ${formatCad(Math.max(0, pool - claimed))} free of ${formatCad(pool)}.`,
    footing: through
      ? nextInflow?.estimated
        ? `Claimed before the observed contribution on the ${ordinal(dayOf(through))}; it is not confirmed.`
        : `Claimed before the next confirmed money in on the ${ordinal(dayOf(through))}.`
      : "Claimed before the end of the month.",
    edge: claimed > pool ? "attention" : "clear",
    copperVerdict: claimed > pool,
    figure: { primitive: "gauge", pct: Math.min(1.5, pct), threshold: 1, label: "of the pool" },
    empty: claimed === 0 ? "Nothing is claimed against the pool." : null,
    cabinet: "blotter",
    cabinetName: "The claims",
  };
}

/**
 * The Fund owes the account that fronted a purchase. A person never owes —
 * the obligation is always the Fund's, to an account.
 */
function settlePlate(household: Household, today: DateKey): DeskPlateModel {
  const projection = projectHouseholdFund(household, today);
  const owing = projection.destinationPositions.filter((row) => row.dueCents > 0);
  const top = [...owing].sort((left, right) => right.dueCents - left.dueCents)[0] ?? null;
  const topName = top
    ? household.accounts.find((account) => account.id === top.destinationAccountId)?.name ?? "an account"
    : "";
  const sharedExpenseIds = new Set(
    household.transactions
      .filter((transaction) => transaction.visibility !== "personal")
      .map((transaction) => transaction.id),
  );
  const claimsIn = outstandingClaims(household)
    .filter((claim) => sharedExpenseIds.has(claim.expenseTransactionId));
  const inCents = claimsIn.reduce((sum, claim) => sum + claimRemainingCents(claim), 0);
  const countable = owing.length >= 1 && owing.length <= 31;
  return {
    id: "settle",
    kicker: "To settle",
    glance: projection.transferDueCents > 0
      ? formatCad(projection.transferDueCents)
      : inCents > 0 ? `House owed ${formatCad(inCents)}` : "Settled",
    verdict: top
      ? `The Fund owes ${topName} ${formatCad(top.dueCents)}.`
      : inCents > 0
        ? `The house is owed ${formatCad(inCents)} back.`
        : "The Fund owes nothing right now.",
    footing: "The card fronted it; the Fund settles it. Confirming a transfer is a custody act.",
    edge: owing.length ? "live" : "clear",
    copperVerdict: false,
    figure: { primitive: "tally", count: countable ? owing.length : 0 },
    empty: owing.length === 0 && inCents === 0 ? "Nothing outstanding either way." : null,
    cabinet: "claims",
    cabinetName: "To settle",
  };
}

/**
 * One Shared account the member chose, or a starting point. Personal
 * account rooms stay on Personal Books and nothing aggregates scopes.
 */
function accountsPlate(household: Household, memberId: string, today: DateKey): DeskPlateModel {
  const chosen = chosenAccount(household, memberId, today);
  const visibleCount = accountRows(household, memberId, today).length;
  return {
    id: "accounts",
    kicker: "The accounts",
    glance: chosen
      ? `${chosen.name} · ${formatCad(chosen.balanceCents)}${isCreditKind(chosen.kind) ? "" : ` ${chosen.balanceLabel}`}`
      : "None yet",
    verdict: chosen
      ? isCreditKind(chosen.kind)
        ? `${chosen.name} owes ${formatCad(chosen.balanceCents)}.`
        : chosen.kind === "investment"
          ? `${chosen.name} has ${formatCad(chosen.balanceCents)} of cost basis.`
          : `${chosen.name} has a ${formatCad(chosen.balanceCents)} book balance.`
      : "No accounts on this floor yet.",
    footing: visibleCount > 1
      ? `${visibleCount} accounts you can see. Pick which one shows here.`
      : "Shared accounts only. Personal rooms stay on Personal Books.",
    edge: chosen && ((chosen.utilization ?? 0) > 0.3 || (!isCreditKind(chosen.kind) && chosen.balanceCents < 0))
      ? "attention"
      : "clear",
    copperVerdict: Boolean(chosen && ((chosen.utilization ?? 0) > 0.3 || (!isCreditKind(chosen.kind) && chosen.balanceCents < 0))),
    figure: chosen && chosen.utilization !== null
      ? { primitive: "gauge", pct: chosen.utilization, threshold: 0.3, label: chosen.name }
      : { primitive: "tally", count: chosen ? 1 : 0 },
    empty: chosen ? null : "No accounts on this floor yet.",
    cabinet: "accounts",
    cabinetName: "The accounts",
  };
}

/** What leaves and lands this week. Nothing here is tickable. */
function weekPlate(household: Household, today: DateKey): DeskPlateModel {
  const start = today;
  const last = addDays(start, WEEK_DAYS - 1);
  const movements = fundWeekMovements(household, start, last);
  const out = movements.filter((point) => point.kind === "obligation");
  const inflow = movements.filter((point) => point.kind === "contribution");
  const outCents = out.reduce((sum, point) => sum + Math.abs(point.deltaCents), 0);
  const confirmedInCents = inflow.filter((point) => !point.estimated)
    .reduce((sum, point) => sum + point.deltaCents, 0);
  const observedInCents = inflow.filter((point) => point.estimated)
    .reduce((sum, point) => sum + point.deltaCents, 0);
  const marks: TrackMark[] = out.slice(0, WEEK_DAYS).map((point) => ({
    day: calendarDaysBetween(start, point.date) + 1,
    cents: Math.abs(point.deltaCents),
    label: point.label,
  }));
  return {
    id: "week",
    kicker: "This week",
    glance: outCents > 0 ? `−${formatCad(outCents)}` : "Quiet",
    verdict: confirmedInCents > 0 && observedInCents > 0
      ? `This week ${formatCad(outCents)} leaves, ${formatCad(confirmedInCents)} is confirmed to land, and ${formatCad(observedInCents)} is observed.`
      : confirmedInCents > 0
        ? `This week ${formatCad(outCents)} leaves and ${formatCad(confirmedInCents)} is confirmed to land.`
        : observedInCents > 0
          ? `This week ${formatCad(outCents)} leaves; ${formatCad(observedInCents)} is observed, not confirmed.`
          : outCents > 0 ? `This week ${formatCad(outCents)} leaves the Fund.` : "Nothing due this week.",
    footing: "What the shared week contains. Nothing here is a task.",
    edge: outCents > 0 ? "live" : "clear",
    copperVerdict: false,
    figure: { primitive: "track", days: WEEK_DAYS, marks, room: TRACK_ROOM },
    empty: outCents === 0 && confirmedInCents === 0 && observedInCents === 0 ? "A quiet week." : null,
    cabinet: "calendar",
    cabinetName: "This week",
  };
}

function shelfPlate(household: Household): DeskPlateModel {
  const banks: Goal[] = openGoals(household).filter((goal) => goal.shared).slice(0, 3);
  const wells: FillWell[] = banks.map((goal: Goal) => ({
    savedCents: Math.max(0, goal.savedCents),
    targetCents: Math.max(1, goal.targetCents),
    name: goal.name,
  }));
  return {
    id: "saving",
    kicker: "The shelf",
    glance: banks.length ? banks[0]!.name : "Nothing yet",
    verdict: banks.length
      ? `There ${banks.length === 1 ? "is" : "are"} ${banks.length} shared goal${banks.length === 1 ? "" : "s"} on the shelf.`
      : "No shared goals yet.",
    footing: "Shared goals. A claim on the pool, never a second envelope.",
    edge: "clear",
    copperVerdict: false,
    figure: { primitive: "fill", wells },
    empty: banks.length ? null : "Nothing on the shelf yet.",
    cabinet: "jars",
    cabinetName: "The shelf",
  };
}

/** Six sparklines is a desktop idea — the plate only ever names the worst one. */
function shapePlate(household: Household, monthKey: MonthKey, today: DateKey): DeskPlateModel {
  const rows = categoryShape(household, monthKey, today);
  const over = rows.filter((row) => row.verdict === "above");
  const comparable = rows.filter((row) => (
    row.verdict === "above" || row.verdict === "in-shape" || row.verdict === "quiet"
  ));
  const worst = over[0] ?? null;
  return {
    id: "shape",
    kicker: "The shape",
    glance: worst ? `${worst.label} ${formatCad(worst.deltaCents)} above` : comparable.length ? "Nothing over shape" : "Not enough yet",
    verdict: worst
      ? `${worst.label} has run ${formatCad(worst.deltaCents)} over its own trailing shape.`
      : comparable.length
        ? "No category with enough history is above its own trailing shape."
        : "Not enough history yet to draw a shape for anything.",
    footing: over.length > 1
      ? `${over.length} categories are running over their own shape this month.`
      : "Each category against its own trailing three months. Never a household total.",
    edge: worst ? "attention" : "clear",
    copperVerdict: Boolean(worst),
    figure: worst
      ? { primitive: "spark", points: [worst.bandLowCents, worst.bandHighCents, worst.monthToDateCents], room: TRACK_ROOM }
      : { primitive: "spark", points: [], room: TRACK_ROOM },
    empty: rows.length ? null : "Not enough history yet to draw a shape for anything.",
    // No office instrument is a real match for "a category against its own
    // history" — the blotter is the household's own income/expense read,
    // the nearest existing thing to it, and spokenForPlate already opens
    // the same drawer, so this isn't a new pairing to learn.
    cabinet: "blotter",
    cabinetName: "The shape",
  };
}

/** Two separate timing facts; never a combined amount or member comparison. */
function streamsPlate(household: Household, today: DateKey): DeskPlateModel {
  const streams = twoStreams(household, today);
  const nameOf = (memberId: string) => household.members.find((member) => member.id === memberId)?.name ?? "A member";
  const first = streams[0];
  return {
    id: "streams",
    kicker: "The two streams",
    glance: streams.length > 1 ? `${streams.length} contribution streams` : first ? `${nameOf(first.memberId)} · ${first.cadenceLabel}` : "Not enough yet",
    verdict: streams.length
      ? `${streams.map((stream) => `${nameOf(stream.memberId)} gives ${stream.cadenceLabel}`).join("; ")}.`
      : "Not enough confirmed contributions yet to draw either stream.",
    footing: "Six months of confirmed contributions. Never combined, never compared.",
    edge: "clear",
    copperVerdict: false,
    figure: { primitive: "tally", count: streams.length },
    empty: streams.length ? null : "Not enough confirmed contributions yet to draw either stream.",
    cabinet: "blotter",
    cabinetName: "The two streams",
  };
}

/**
 * The ten Fund plates, in default custodian order. memberId is the viewer —
 * only the accounts plate reads it, for their own chosen glance account.
 */
export function fundPlates(input: {
  household: Household;
  memberId: string;
  today: DateKey;
  findings?: readonly Finding[];
}): DeskPlateModel[] {
  const { household, memberId, today } = input;
  const findings = input.findings ?? [];
  if (!shapeHouseholdFundConfig(household.householdFund)) return [];
  const monthKey = monthKeyFromDateKey(today);
  const walk = fundWalk(household, monthKey, today);
  return [
    levelPlate(walk, findings),
    waitingPlate(household),
    nextOutPlate(walk),
    spokenForPlate(walk),
    settlePlate(household, today),
    accountsPlate(household, memberId, today),
    weekPlate(household, today),
    shelfPlate(household),
    shapePlate(household, monthKey, today),
    streamsPlate(household, today),
  ];
}
