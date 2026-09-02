// A purpose is a label on money, not a partition of it (D-161, D-173).
// It never changes which obligation a dollar funds, never creates a balance,
// and never appears in any arithmetic. It is provenance the register can read back.

import { monthEndKey, monthStartKey, parseDateKey, type DateKey } from "./calendar.ts";
import {
  activeHouseholdFundEvents,
  projectHouseholdFundOperatingBalanceBefore,
  shapeHouseholdFundConfig,
} from "./householdFund.ts";
import { monthObligations, type MonthObligations } from "./monthObligations.ts";
import type { Household } from "./types.ts";

export type RegisterSource = {
  kind: "carried" | "contribution";
  eventId: string | null;
  memberId: string | null;
  date: DateKey;
  amountCents: number;
  purpose: string;
};

export type RegisterSegment = {
  sourceIndex: number;
  amountCents: number;
};

export type RegisterRow = {
  obligationId: string;
  recurrenceId: string | null;
  goalId: string | null;
  label: string;
  date: DateKey;
  amountCents: number;
  segments: RegisterSegment[];
  unfundedCents: number;
};

export type ContributionRegister = {
  monthKey: string;
  sources: RegisterSource[];
  rows: RegisterRow[];
  carriedCents: number;
  byMember: Array<{ memberId: string; amountCents: number }>;
  owedCents: number;
  unfundedCents: number;
  tiesToProjection: boolean;
};

function unfundedRows(obligations: MonthObligations): Pick<ContributionRegister, "rows" | "owedCents" | "unfundedCents"> {
  const rows = obligations.rows.map((row) => ({
    obligationId: row.id,
    recurrenceId: row.recurrenceId,
    goalId: row.goalId,
    label: row.label,
    date: row.date,
    amountCents: row.amountCents,
    segments: [],
    unfundedCents: row.amountCents,
  }));
  return { rows, owedCents: obligations.owedCents, unfundedCents: obligations.owedCents };
}

/** Allocate carried and confirmed Household Fund cents to month obligations oldest-first. */
export function contributionRegister(household: Household, monthKey: string, today: DateKey): ContributionRegister {
  return contributionRegisterThrough(household, monthKey, today, monthEndKey(monthKey));
}

/** The same FIFO register, bounded to obligations and confirmed sources through one civil date. */
export function contributionRegisterThrough(
  household: Household,
  monthKey: string,
  today: DateKey,
  throughDate: DateKey,
): ContributionRegister {
  const start = monthStartKey(monthKey);
  parseDateKey(throughDate);
  if (throughDate < start) throw new Error("Register through date cannot precede month start.");
  const monthEnd = monthEndKey(monthKey);
  const end = throughDate < monthEnd ? throughDate : monthEnd;
  const month = monthObligations(household, monthKey, today);
  const rowsThroughDate = month.rows.filter((row) => row.date <= end);
  const obligations: MonthObligations = {
    ...month,
    rows: rowsThroughDate,
    owedCents: rowsThroughDate.reduce((sum, row) => sum + row.amountCents, 0),
  };
  const fund = shapeHouseholdFundConfig(household.householdFund);
  if (!fund) {
    const empty = unfundedRows(obligations);
    return { monthKey, sources: [], carriedCents: 0, byMember: [], tiesToProjection: false, ...empty };
  }

  const rawCarriedCents = projectHouseholdFundOperatingBalanceBefore(household, start, fund.id);
  const carriedCents = Math.max(0, rawCarriedCents);
  const contributionEvents = activeHouseholdFundEvents(household, fund.id)
    .filter((event) => event.kind === "contribution-confirmed" && event.date >= start && event.date <= end)
    .sort((left, right) => left.date.localeCompare(right.date)
      || left.createdAt.localeCompare(right.createdAt)
      || left.id.localeCompare(right.id));
  const memberIds = new Set(household.members.map((member) => member.id));
  const contributions = contributionEvents.filter((event) => event.contributorMemberId && memberIds.has(event.contributorMemberId));
  const contributorMismatch = contributions.length !== contributionEvents.length;
  const sources: RegisterSource[] = [{
    kind: "carried",
    eventId: null,
    memberId: null,
    date: start,
    amountCents: carriedCents,
    purpose: "",
  }, ...contributions.map((event) => ({
    kind: "contribution" as const,
    eventId: event.id,
    memberId: event.contributorMemberId,
    date: event.date,
    amountCents: event.amountCents,
    purpose: event.purpose,
  }))];
  const memberTotals = contributions.reduce<Map<string, number>>((memberAmounts, event) => {
    if (event.contributorMemberId) {
      memberAmounts.set(event.contributorMemberId, (memberAmounts.get(event.contributorMemberId) ?? 0) + event.amountCents);
    }
    return memberAmounts;
  }, new Map());
  const byMember = [...memberTotals].map(([memberId, amountCents]) => ({ memberId, amountCents }));

  if (!obligations.tiesToProjection || rawCarriedCents < 0 || contributorMismatch) {
    const failed = unfundedRows(obligations);
    return { monthKey, sources, carriedCents, byMember, tiesToProjection: false, ...failed };
  }

  const remaining = sources.map((source) => source.amountCents);
  let sourceIndex = 0;
  const rows: RegisterRow[] = obligations.rows.map((obligation) => {
    let unfundedCents = obligation.amountCents;
    const segments: RegisterSegment[] = [];
    while (unfundedCents > 0 && sourceIndex < sources.length) {
      if (remaining[sourceIndex]! <= 0) {
        sourceIndex += 1;
        continue;
      }
      const amountCents = Math.min(unfundedCents, remaining[sourceIndex]!);
      segments.push({ sourceIndex, amountCents });
      remaining[sourceIndex] = remaining[sourceIndex]! - amountCents;
      unfundedCents -= amountCents;
    }
    return {
      obligationId: obligation.id,
      recurrenceId: obligation.recurrenceId,
      goalId: obligation.goalId,
      label: obligation.label,
      date: obligation.date,
      amountCents: obligation.amountCents,
      segments,
      unfundedCents,
    };
  });
  const owedCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const unfundedCents = rows.reduce((sum, row) => sum + row.unfundedCents, 0);
  const usedBySource = sources.map(() => 0);
  for (const row of rows) {
    for (const segment of row.segments) usedBySource[segment.sourceIndex]! += segment.amountCents;
  }
  const allocatedCents = usedBySource.reduce((sum, amount) => sum + amount, 0);
  const undrawnCents = remaining.reduce((sum, amount) => sum + amount, 0);
  const sourceCents = sources.reduce((sum, source) => sum + source.amountCents, 0);
  const rowsConserve = rows.every((row) => (
    row.segments.every((segment) => segment.amountCents > 0)
    && row.segments.reduce((sum, segment) => sum + segment.amountCents, 0) + row.unfundedCents === row.amountCents
  ));
  const sourcesConserve = usedBySource.every((used, index) => used <= sources[index]!.amountCents)
    && sourceCents === allocatedCents + undrawnCents;

  return {
    monthKey,
    sources,
    rows,
    carriedCents,
    byMember,
    owedCents,
    unfundedCents,
    tiesToProjection: rowsConserve
      && sourcesConserve
      && owedCents === obligations.owedCents
      && allocatedCents + unfundedCents === owedCents,
  };
}
