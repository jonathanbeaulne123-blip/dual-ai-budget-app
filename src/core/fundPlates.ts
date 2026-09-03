/**
 * The Fund's plates — the shared floor's widgets, over selectors that already exist.
 *
 * Presentation only. Every figure is one of the six primitives in plates.ts and
 * every number is read from fundWalk or an existing projection. Nothing here
 * posts, settles, or moves a cent, and nothing computes a second balance.
 */

import { formatDateLabel, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { formatCad } from "./money.ts";
import { creditCardView, isCreditKind } from "./accounts.ts";
import { claimRemainingCents, outstandingClaims } from "./appointments.ts";
import { fundWalk, type FundWalk, type WalkPoint } from "./fundWalk.ts";
import {
  householdFundContributionMotions,
  projectHouseholdFund,
  shapeHouseholdFundConfig,
} from "./householdFund.ts";
import { openGoals } from "./goalVault.ts";
import type { Finding } from "./health.ts";
import type { DeskPlateModel, FillWell, PlateEdge, TrackMark } from "./deskPlates.ts";
import type { Goal } from "./types.ts";
import type { Household } from "./types.ts";

export const FUND_PLATE_IDS = [
  "fund-level", "waiting", "next-out", "spoken-for", "settle", "accounts", "week", "saving",
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
  const rows = walk.points.filter((point) => point.kind !== "opening").slice(0, 24);
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
  const claimsIn = outstandingClaims(household);
  const inCents = claimsIn.reduce((sum, claim) => sum + claimRemainingCents(claim), 0);
  const countable = owing.length >= 1 && owing.length <= 31;
  return {
    id: "settle",
    kicker: "To settle",
    glance: projection.transferDueCents > 0 ? formatCad(projection.transferDueCents) : "Settled",
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

/** Shared accounts only. Personal accounts stay on the Personal Books floor. */
function accountsPlate(household: Household, today: DateKey): DeskPlateModel {
  const visible = household.accounts.filter((account) => (
    account.active && account.scope !== "personal"
  ));
  const cards = visible.filter((account) => isCreditKind(account.kind));
  const chosen = cards[0] ?? visible[0] ?? null;
  const view = chosen && isCreditKind(chosen.kind) ? creditCardView(household, chosen, today) : null;
  const wells: FillWell[] = chosen
    ? [{ savedCents: Math.max(0, view?.owedCents ?? 0), targetCents: Math.max(1, view?.limitCents ?? 1), name: chosen.name }]
    : [];
  return {
    id: "accounts",
    kicker: "The accounts",
    glance: chosen
      ? view ? formatCad(view.owedCents) : `${visible.length} accounts`
      : "None yet",
    verdict: chosen
      ? view
        ? `${chosen.name} is carrying ${formatCad(view.owedCents)}.`
        : `There are ${visible.length} accounts on this floor.`
      : "No shared accounts yet.",
    footing: "Shared accounts only. Personal accounts stay on the Personal Books floor.",
    edge: "clear",
    copperVerdict: false,
    figure: view && view.utilization !== null
      ? { primitive: "gauge", pct: view.utilization, threshold: 0.3, label: chosen?.name ?? "" }
      : { primitive: "fill", wells },
    empty: visible.length ? null : "No accounts on this floor yet.",
    cabinet: "accounts",
    cabinetName: "The accounts",
  };
}

/** What leaves and lands this week. Nothing here is tickable. */
function weekPlate(walk: FundWalk, today: DateKey): DeskPlateModel {
  const start = today;
  const days: DateKey[] = [];
  for (let i = 0; i < WEEK_DAYS; i += 1) {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    days.push(date.toISOString().slice(0, 10));
  }
  const last = days[days.length - 1]!;
  const out = futureOutflows(walk).filter((point) => point.date >= start && point.date <= last);
  const inflow = futureInflows(walk).filter((point) => point.date >= start && point.date <= last);
  const outCents = out.reduce((sum, point) => sum + Math.abs(point.deltaCents), 0);
  const confirmedInCents = inflow.filter((point) => !point.estimated)
    .reduce((sum, point) => sum + point.deltaCents, 0);
  const observedInCents = inflow.filter((point) => point.estimated)
    .reduce((sum, point) => sum + point.deltaCents, 0);
  const marks: TrackMark[] = out.slice(0, WEEK_DAYS).map((point) => ({
    day: dayOf(point.date), cents: Math.abs(point.deltaCents), label: point.label,
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
    figure: { primitive: "track", days: 31, marks, room: TRACK_ROOM },
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

/** The eight Fund plates, in default custodian order. */
export function fundPlates(input: {
  household: Household;
  today: DateKey;
  findings?: readonly Finding[];
}): DeskPlateModel[] {
  const { household, today } = input;
  const findings = input.findings ?? [];
  if (!shapeHouseholdFundConfig(household.householdFund)) return [];
  const walk = fundWalk(household, monthKeyFromDateKey(today), today);
  return [
    levelPlate(walk, findings),
    waitingPlate(household),
    nextOutPlate(walk),
    spokenForPlate(walk),
    settlePlate(household, today),
    accountsPlate(household, today),
    weekPlate(walk, today),
    shelfPlate(household),
  ];
}
