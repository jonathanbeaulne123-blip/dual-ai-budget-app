/**
 * Plan Studio v3 — the one door the new studio reads the books through.
 *
 * Every figure here is read from a selector that already exists
 * (`projectKittyNest`, `fundWalk`, `projectHouseholdFund`, `projectPlan`,
 * `planAcknowledgementState`, `openChapterFor`, the Shared Sitdown session).
 * Nothing here computes a new money meaning: when a reading is not available
 * yet it is `null`, and the screens show nothing rather than invent it.
 *
 * The output of `planStudioFundSnapshot` is shaped like the money track's
 * coming `fundSnapshot(household, { memberId, view, today })` from
 * `src/core/fundModel.ts` ({ now, undividedContributions, prepare, protect,
 * build, flow }) so that one function can be swapped for the other.
 */
import { addDays, monthEndKey, monthKeyFromDateKey, monthStartKey, shiftMonthKey, type DateKey, type MonthKey } from "../core/calendar.ts";
import { sharedBridgeDecisions } from "../core/cellarBridge.ts";
import { chapterMonth, chapterReminder, openChapterFor } from "../core/chapters.ts";
import { divisionFor, fundSnapshot, proposedDivision } from "../core/fundModel.ts";
import { fundModelMode, type FundDivisionRow, type FundRefillRow } from "../core/fundRules.ts";
import { clientFundModelVersion } from "../ledgerSync/fundModelStamp.ts";
import { fundWalk } from "../core/fundWalk.ts";
import { householdFundContributionMotions, projectHouseholdFund, shapeHouseholdFundConfig } from "../core/householdFund.ts";
import { projectKittyNest, type NestBank } from "../core/kittyNest.ts";
import { planSelectionForDraft, planSelectionForVersion, projectPlan, type PlanSelection } from "../core/planProjection.ts";
import { currentPlanVersion, evaluatePlanDrift, planAcknowledgementState, requiredPlanMemberIds, type PlanLens, type PlanLine, type PlanVersion } from "../core/planSystem.ts";
import type { Household, LedgerView } from "../core/types.ts";

export type FundKey = "prepare" | "protect" | "build";
export type FundRow = { id: string; label: string; detail: string | null; amountCents: number | null; date: DateKey | null };
export type FundReading = {
  key: FundKey;
  /** What the fund holds for the month, or null when the books cannot say yet. */
  amountCents: number | null;
  /** One honest line, or null. */
  line: string | null;
  tone: "calm" | "attention";
  /** The Protect cushion's target (the Fund month plan's buffer), when one is set. */
  targetCents: number | null;
  rows: FundRow[];
};
export type NowReading = { amountCents: number | null; line: string | null };
export type SplitSuggestion = Record<FundKey | "everyday", number>;
export type UndividedContribution = {
  id: string; memberId: string | null; memberName: string; amountCents: number; date: DateKey;
  /** Hercules's offered split, when the money model supplies one (the open proposal's split once someone proposed). */
  suggestion: SplitSuggestion | null;
  /** Who still needs to confirm the split (both partners confirm). */
  waitingOn: string[];
  /** The open division record (money model only): who proposed it, who agreed, and its revision for the confirm. */
  proposal?: { id: string; revision: number; proposedBy: string; agreedBy: string[] } | null;
};
/** An open Protect refill (money model only): custodian proposes, partner confirms; a record, never a bank move. */
export type RefillReading = {
  id: string; revision: number; toFund: "build" | "everyday"; amountCents: number; note: string;
  state: "proposed" | "confirmed"; proposedBy: string; proposedByName: string; agreedBy: string[];
};
export type FlowContribution = { id: string; memberName: string; amountCents: number; estimated: boolean; actual: boolean; split: SplitSuggestion | null };
export type FlowOutflow = { id: string; label: string; amountCents: number; fund: FundKey | null; actual: boolean };
export type FlowDay = { date: DateKey; day: number; balanceCents: number | null; contributions: FlowContribution[]; outflows: FlowOutflow[] };
export type FlowReading = {
  monthKey: MonthKey;
  today: DateKey;
  totalInCents: number;
  anyEstimated: boolean;
  days: FlowDay[];
  /** The first day the walk goes below zero, and what took it there. */
  shortFrom: { date: DateKey; label: string; shortCents: number } | null;
  lowPoint: { date: DateKey; balanceCents: number } | null;
  source: "fund-walk" | "plan-projection";
};
export type FundSnapshotV3 = {
  /** Which money model produced these readings. Absent = the transitional adapter (v1 meaning). */
  mode?: 1 | 2;
  /** Open Protect refills for the month (money model only). */
  refills?: RefillReading[];
  now: NowReading;
  undividedContributions: UndividedContribution[];
  prepare: FundReading;
  protect: FundReading;
  build: FundReading;
  flow: FlowReading | null;
};
export type FundSnapshotSource = (household: Household, options: { memberId: string; view: LedgerView; today: DateKey }) => FundSnapshotV3;

const cad = (cents: number) => `${cents < 0 ? "−" : ""}$${Math.round(Math.abs(cents) / 100).toLocaleString("en-CA")}`;
export const moneyWords = cad;

export function monthName(monthKey: MonthKey, style: "long" | "short" = "long"): string {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-CA", { month: style, timeZone: "UTC" });
}
export function dayWords(date: DateKey, withWeekday = false): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", { ...(withWeekday ? { weekday: "short" } : {}), month: "short", day: "numeric", timeZone: "UTC" });
}

function memberName(h: Household, id: string | null | undefined): string {
  return h.members.find(row => row.id === id)?.name ?? "Someone";
}

function rowsOf(bank: NestBank | undefined): FundRow[] {
  return (bank?.children ?? []).map(child => ({
    id: child.id,
    label: child.name,
    detail: child.tier === "goal" ? (child.targetCents > 0 ? `${cad(child.amountCents)} of ${cad(child.targetCents)}` : "a goal") : child.date ? dayWords(child.date) : null,
    amountCents: child.tier === "goal" ? child.amountCents : child.targetCents,
    date: child.date,
  }));
}

function walkFlow(h: Household, monthKey: MonthKey, today: DateKey): FlowReading | null {
  if (!shapeHouseholdFundConfig(h.householdFund)) return null;
  const walk = fundWalk(h, monthKey, today);
  const start = monthStartKey(monthKey), end = monthEndKey(monthKey);
  const days: FlowDay[] = [];
  let balance: number | null = walk.openingCents;
  const byDate = new Map<DateKey, typeof walk.points>();
  for (const point of walk.points) byDate.set(point.date, [...(byDate.get(point.date) ?? []), point]);
  let shortFrom: FlowReading["shortFrom"] = null;
  for (let date = start, day = 1; date <= end; date = addDays(date, 1), day++) {
    const points = byDate.get(date) ?? [];
    const contributions: FlowContribution[] = [], outflows: FlowOutflow[] = [];
    points.forEach((point, index) => {
      balance = point.balanceCents;
      const id = point.sourceId ?? `${date}:${index}`;
      if (point.kind === "contribution") contributions.push({ id, memberName: point.memberId ? memberName(h, point.memberId) : point.label, amountCents: point.deltaCents, estimated: point.estimated, actual: point.actual, split: null });
      else if (point.kind === "obligation") outflows.push({ id, label: point.label, amountCents: -point.deltaCents, fund: "prepare", actual: point.actual });
      else if (point.kind === "kitty") outflows.push({ id, label: point.label, amountCents: -point.deltaCents, fund: "build", actual: point.actual });
      else if (point.kind === "settlement") outflows.push({ id, label: point.label, amountCents: -point.deltaCents, fund: null, actual: point.actual });
      if (!shortFrom && point.balanceCents < 0 && point.deltaCents < 0) shortFrom = { date, label: point.label, shortCents: -point.balanceCents };
    });
    days.push({ date, day, balanceCents: balance, contributions, outflows });
  }
  // The tightest day still ahead: from today on, never the month's opening entry.
  const low = walk.points.filter(point => point.kind !== "opening" && point.date >= start && point.date >= today).reduce<{ date: DateKey; balanceCents: number } | null>((min, point) => !min || point.balanceCents < min.balanceCents ? { date: point.date, balanceCents: point.balanceCents } : min, null);
  return {
    monthKey, today, source: "fund-walk", days, lowPoint: low, shortFrom,
    totalInCents: walk.points.filter(point => point.kind === "contribution").reduce((sum, point) => sum + point.deltaCents, 0),
    anyEstimated: walk.points.some(point => point.estimated),
  };
}

function projectionFlow(h: Household, memberId: string, monthKey: MonthKey, today: DateKey, selection: PlanSelection | null): FlowReading | null {
  if (!selection) return null;
  const projection = projectPlan(h, { memberId, scope: "personal", acceptedRevision: h.revision, asOf: today, through: monthEndKey(monthKey), selection });
  if (projection.kind !== "ready") return null;
  const start = monthStartKey(monthKey), end = monthEndKey(monthKey);
  const capacity = new Map(projection.datedCapacity.map(row => [row.date, row.balanceCents]));
  const days: FlowDay[] = [];
  let balance: number | null = projection.cashNowCents;
  for (let date = start, day = 1; date <= end; date = addDays(date, 1), day++) {
    if (capacity.has(date)) balance = capacity.get(date)!;
    const moves = projection.movements.filter(row => row.date === date);
    days.push({
      date, day, balanceCents: date < today ? null : balance,
      contributions: moves.filter(row => row.deltaCents > 0).map((row, i) => ({ id: row.sourceId ?? `${date}:in:${i}`, memberName: row.label, amountCents: row.deltaCents, estimated: row.estimated, actual: false, split: null })),
      outflows: moves.filter(row => row.deltaCents < 0).map((row, i) => ({ id: row.sourceId ?? `${date}:out:${i}`, label: row.label, amountCents: -row.deltaCents, fund: null, actual: false })),
    });
  }
  return {
    monthKey, today, source: "plan-projection", days,
    lowPoint: projection.lowPoint, anyEstimated: projection.movements.some(row => row.estimated),
    shortFrom: projection.firstExposed ? { date: projection.firstExposed.date, label: projection.firstExposed.label, shortCents: projection.firstExposed.gapCents } : null,
    totalInCents: projection.movements.filter(row => row.deltaCents > 0 && row.date >= start && row.date <= end).reduce((sum, row) => sum + row.deltaCents, 0),
  };
}

function selectionFor(h: Household, memberId: string, view: LedgerView, monthKey: MonthKey): PlanSelection | null {
  const version = currentPlanVersion(h, view, monthKey, memberId);
  if (version) return planSelectionForVersion(version);
  const draft = (h.planDrafts ?? []).filter(row => row.ownerMemberId === memberId && row.scope === view && row.targetMonth === monthKey).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return draft ? planSelectionForDraft(draft) : null;
}

/**
 * The transitional adapter (D-274), kept as the fallback while `VITE_FUND_MODEL_V2`
 * is off and for households the money model has not sorted yet. With the flag
 * on, `fundModelSnapshot` (below) reads `fundSnapshot` instead (D-281). Here:
 * - the four amounts are the Kitty Nest's four categories exactly as today (so Protect
 *   still carries the bills the money-model migration moves to Prepare);
 * - Prepare's line reads the Fund walk's dated obligations (the bills);
 * - `undividedContributions` is empty: splitting a contribution has no command yet;
 * - a contribution's `split` is null for the same reason.
 */
export const planStudioFundSnapshot: FundSnapshotSource = (h, { memberId, view, today }) => {
  const monthKey = monthKeyFromDateKey(today);
  const nest = projectKittyNest(h, memberId, view, today);
  const bank = (key: string) => nest.categories.find(row => row.category === key);
  const fund = view === "household" ? projectHouseholdFund(h, today) : null;
  const flow = view === "household" ? walkFlow(h, monthKey, today) : projectionFlow(h, memberId, monthKey, today, selectionFor(h, memberId, view, monthKey));
  const month = monthName(monthKey);
  const hasBills = Boolean(flow?.days.some(day => day.outflows.some(row => row.fund === "prepare" || (view === "personal" && row.amountCents > 0))));
  const prepareLine = !flow || !hasBills ? null
    : flow.shortFrom ? `Short from ${dayWords(flow.shortFrom.date)}`
    : flow.anyEstimated ? `Bills covered all ${month} if expected pay arrives` : `Bills covered all ${month}`;
  const buildBank = bank("build");
  const goals = (buildBank?.children ?? []).filter(row => row.tier === "goal").length;
  const buffer = fund?.configured && fund.bufferCents > 0 ? fund.bufferCents : null;
  const nowBank = bank("everyday");
  return {
    now: { amountCents: nowBank ? nowBank.amountCents : null, line: nowBank ? `for ${month}, here now` : null },
    undividedContributions: [],
    prepare: { key: "prepare", amountCents: bank("prepare")?.amountCents ?? null, line: prepareLine, tone: flow?.shortFrom ? "attention" : "calm", targetCents: null, rows: rowsOf(bank("prepare")) },
    protect: { key: "protect", amountCents: bank("protect")?.amountCents ?? null, line: buffer ? `of ${cad(buffer)} cushion` : null, tone: "calm", targetCents: buffer, rows: rowsOf(bank("protect")) },
    build: { key: "build", amountCents: buildBank?.amountCents ?? null, line: goals ? `this month, toward ${goals} ${goals === 1 ? "goal" : "goals"}` : null, tone: "calm", targetCents: null, rows: rowsOf(buildBank) },
    flow,
  };
};

function refillReading(h: Household, row: FundRefillRow): RefillReading {
  return {
    id: row.id, revision: row.revision, toFund: row.toFund, amountCents: row.amountCents, note: row.note,
    state: row.state === "confirmed" ? "confirmed" : "proposed", proposedBy: row.proposedBy, proposedByName: memberName(h, row.proposedBy), agreedBy: [...row.agreedBy],
  };
}

function waitingOnFor(h: Household, proposal: FundDivisionRow | null): string[] {
  return h.members.filter(row => row.active && !(proposal?.agreedBy ?? []).includes(row.id)).map(row => row.name);
}

/**
 * The money model's read (D-281, integration): `fundSnapshot` from
 * `src/core/fundModel.ts`, mapped onto the studio's shape. Figures are the
 * snapshot's own (Now, Prepare, Protect, Build); the month's day-by-day walk
 * still comes from `fundWalk` so the flow keeps its balances. A contribution's
 * `split` is its confirmed division, and "not divided yet" lists the
 * snapshot's undivided contributions with Hercules's draft split
 * (`proposedDivision`) or the open proposal's split.
 * A household the money model has not sorted yet (mode 1) reads the
 * transitional adapter, so nothing changes until the household step runs.
 */
export const fundModelSnapshot: FundSnapshotSource = (h, input) => {
  if (fundModelMode(h) !== 2) return planStudioFundSnapshot(h, input);
  const { memberId, view, today } = input;
  const snap = fundSnapshot(h, input);
  const legacy = planStudioFundSnapshot(h, input);
  const monthKey = monthKeyFromDateKey(today);
  const month = monthName(monthKey);
  const flow = legacy.flow && view === "household" ? {
    ...legacy.flow,
    days: legacy.flow.days.map(day => ({
      ...day,
      contributions: day.contributions.map(row => {
        const division = divisionFor(h, row.id);
        return division?.state === "confirmed" ? { ...row, split: { ...division.split } } : row;
      }),
    })),
  } : legacy.flow;
  const prepareRows: FundRow[] = snap.prepare.bills.map(bill => ({ id: bill.id, label: bill.name, detail: bill.date ? dayWords(bill.date) : null, amountCents: bill.targetCents, date: bill.date }));
  const otherPrepare = legacy.prepare.rows.filter(row => !prepareRows.some(bill => bill.id === row.id));
  const shortOn = snap.prepare.shortOn;
  const prepareLine = shortOn ? `Short ${cad(shortOn.shortCents)} for ${shortOn.label}, ${dayWords(shortOn.date)}`
    : snap.prepare.bills.length ? (flow?.anyEstimated ? `Bills covered all ${month} if expected pay arrives` : `Bills covered all ${month}`)
    : null;
  const buffer = snap.protect.targetCents > 0 ? snap.protect.targetCents : null;
  const goals = snap.build.goals.length;
  return {
    mode: 2,
    refills: view === "household" ? snap.protect.refills.map(row => refillReading(h, row)) : [],
    now: { amountCents: snap.now, line: `for ${month}, here now` },
    undividedContributions: snap.undividedContributions.map(row => ({
      id: row.eventId, memberId: row.contributorMemberId, memberName: memberName(h, row.contributorMemberId), amountCents: row.amountCents, date: row.date,
      suggestion: row.proposal ? { ...row.proposal.split } : proposedDivision(h, row.eventId, { memberId, today }),
      waitingOn: waitingOnFor(h, row.proposal),
      proposal: row.proposal ? { id: row.proposal.id, revision: row.proposal.revision, proposedBy: row.proposal.proposedBy, agreedBy: [...row.proposal.agreedBy] } : null,
    })),
    prepare: { key: "prepare", amountCents: snap.prepare.amountCents, line: prepareLine, tone: shortOn ? "attention" : "calm", targetCents: snap.prepare.targetCents || null, rows: [...prepareRows, ...otherPrepare] },
    protect: { key: "protect", amountCents: snap.protect.amountCents, line: buffer ? `of ${cad(buffer)} cushion` : null, tone: "calm", targetCents: buffer, rows: legacy.protect.rows },
    build: {
      key: "build", amountCents: snap.build.amountCents, line: goals ? `this month, toward ${goals} ${goals === 1 ? "goal" : "goals"}` : null, tone: "calm", targetCents: snap.build.targetCents || null,
      rows: snap.build.goals.map(goal => ({ id: goal.goalId, label: goal.name, detail: goal.targetCents > 0 ? `${cad(goal.amountCents)} of ${cad(goal.targetCents)}` : "a goal", amountCents: goal.amountCents, date: goal.date })),
    },
    flow,
  };
};

/** The studio's default source: the money model when `VITE_FUND_MODEL_V2` is on, the transitional adapter otherwise. */
export function defaultFundSnapshotSource(flag?: string): FundSnapshotSource {
  return clientFundModelVersion(flag) === 2 ? fundModelSnapshot : planStudioFundSnapshot;
}

export type AgreementState = {
  kind: "none" | "draft" | "waiting-me" | "waiting-partner" | "agreed" | "kept";
  label: string;
  version: PlanVersion | null;
  paws: { memberId: string; name: string; agreed: boolean }[];
  /** An agreed plan with a newer private draft beside it (F3: the rest screen shows the agreed plan with a note). */
  draftChanges: boolean;
};

export type CheckInSession = {
  state: "none" | "active" | "closed";
  sessionId: string | null;
  sitDownSessionId: string | null;
  updatedAt: string | null;
  /** The saved Sitdown stage (0–7), which v3 reads as its step index (see STEP_STAGE). */
  stage: number;
};

export type ToolBadge = { tool: "letter" | "past" | "lamp"; text: string } | null;

export type PlanStudioV3Model = {
  monthKey: MonthKey;
  monthLabel: string;
  view: LedgerView;
  snapshot: FundSnapshotV3;
  agreement: AgreementState;
  session: CheckInSession;
  /**
   * The open Chapter (D-272: a Chapter is a calendar month). `monthLabel` is the month it was meant for;
   * `reminder` is set once that month has ended and no Sitdown has closed it — nothing closes it by itself.
   */
  chapter: { id: string; title: string; monthKey: MonthKey; monthLabel: string; reminder: string | null } | null;
  /** This month's Shared Sitdown closed: the island's land for the month is set. */
  monthSet: boolean;
  badge: ToolBadge;
  /** Plan lines per lens, and whether each lens matches last month's agreed plan exactly. */
  lenses: Record<PlanLens, { lines: PlanLine[]; sameAsLast: boolean }>;
  previousMonthLabel: string | null;
  firstVisit: boolean;
  sentence: string;
  sentenceTone: "calm" | "attention";
  nextIn: { memberName: string; date: DateKey } | null;
};

function sameLines(a: readonly PlanLine[], b: readonly PlanLine[]): boolean {
  const key = (rows: readonly PlanLine[]) => rows.map(row => `${row.labelSnapshot} ${row.amountCents} ${row.cadence}`).sort().join("");
  return key(a) === key(b);
}

export function planStudioV3Model(h: Household, input: { memberId: string; view: LedgerView; today: DateKey; source?: FundSnapshotSource }): PlanStudioV3Model {
  const { memberId, view, today } = input;
  const monthKey = monthKeyFromDateKey(today);
  const monthLabel = monthName(monthKey);
  const snapshot = (input.source ?? defaultFundSnapshotSource())(h, { memberId, view, today });
  const version = currentPlanVersion(h, view, monthKey, memberId);
  const draft = (h.planDrafts ?? []).filter(row => row.ownerMemberId === memberId && row.scope === view && row.targetMonth === monthKey).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const required = view === "household" ? requiredPlanMemberIds(h) : [memberId];
  const ack = version && view === "household" ? planAcknowledgementState(h, version) : null;
  const partner = h.members.find(row => row.id !== memberId && required.includes(row.id));
  const paws = required.map(id => ({ memberId: id, name: memberName(h, id), agreed: view === "personal" ? Boolean(version && version.state !== "proposed") : Boolean(ack?.acknowledgedMemberIds.includes(id)) }));
  let agreement: AgreementState;
  if (!version) agreement = { kind: draft ? "draft" : "none", label: draft ? "Private draft" : "No plan yet", version: null, paws, draftChanges: false };
  else if (view === "personal") agreement = { kind: "kept", label: "Kept as my plan", version, paws, draftChanges: Boolean(draft && draft.updatedAt > version.createdAt) };
  else if (ack?.complete || version.state === "active" || version.state === "scheduled") agreement = { kind: "agreed", label: "Agreed", version, paws, draftChanges: Boolean(draft && draft.updatedAt > version.createdAt) };
  else if (ack?.acknowledgedMemberIds.includes(memberId)) agreement = { kind: "waiting-partner", label: `Waiting for ${partner?.name ?? "your partner"}`, version, paws, draftChanges: false };
  else agreement = { kind: "waiting-me", label: "Waiting for you", version, paws, draftChanges: false };

  const sessionRow = view === "household" ? [...(h.planHerculesSessions ?? [])].filter(row => row.monthKey === monthKey).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] : undefined;
  const session: CheckInSession = sessionRow
    ? { state: sessionRow.state, sessionId: sessionRow.id, sitDownSessionId: sessionRow.sitDownSessionId, updatedAt: sessionRow.updatedAt, stage: sessionRow.stage ?? 0 }
    : { state: "none", sessionId: null, sitDownSessionId: null, updatedAt: null, stage: 0 };

  const chapterRow = view === "household" ? openChapterFor(h) : null;
  const monthSet = view === "household" && (h.planHerculesSessions ?? []).some(row => row.monthKey === monthKey && row.state === "closed");

  // One badge at most: an offer waiting on me first, then a finding worth a look.
  const waitingOffers = view === "household" ? sharedBridgeDecisions(h.planBridgeDecisions).filter(row => row.monthKey === monthKey && row.offeredByMemberId !== memberId && (row.state === "proposed" || row.state === "held")).length : 0;
  const coaching = h.planCoachingPreferences?.find(row => row.memberId === memberId);
  const finding = version && coaching?.intensity !== "off" ? evaluatePlanDrift(h, version, today).find(row => !coaching?.dismissedIssueIds.includes(row.id) && (!coaching?.snoozedIssueIds[row.id] || coaching.snoozedIssueIds[row.id]! <= today)) : undefined;
  const badge: ToolBadge = waitingOffers ? { tool: "letter", text: `${waitingOffers} waiting` } : finding ? { tool: "lamp", text: "a note to check" } : null;

  const currentLines = (version ?? null)?.lines ?? draft?.lines ?? [];
  const previousKey = shiftMonthKey(monthKey, -1);
  const previous = [...(h.planVersions ?? [])].filter(row => row.scope === view && row.monthKey === previousKey && ["active", "superseded"].includes(row.state) && (view === "household" || row.ownerMemberId === memberId)).sort((a, b) => b.sequence - a.sequence)[0] ?? null;
  const lensKeys: PlanLens[] = ["protect", "prepare", "build", "everyday"];
  const lenses = Object.fromEntries(lensKeys.map(lens => {
    const lines = currentLines.filter(row => row.lens === lens);
    return [lens, { lines: [...lines], sameAsLast: Boolean(previous) && sameLines(lines, previous!.lines.filter(row => row.lens === lens)) }];
  })) as PlanStudioV3Model["lenses"];

  const firstVisit = !version && !draft && !(h.planVersions ?? []).some(row => row.scope === view && (view === "household" || row.ownerMemberId === memberId));
  const upcoming = snapshot.flow?.days.filter(day => day.date >= today).flatMap(day => day.contributions.map(c => ({ memberName: c.memberName, date: day.date }))) ?? [];
  const nextIn = upcoming.find(row => row.date > today) ?? null;
  const contributions = snapshot.flow?.days.reduce((sum, day) => sum + day.contributions.length, 0) ?? 0;
  const bills = snapshot.flow?.days.reduce((sum, day) => sum + day.outflows.filter(row => row.fund === "prepare").length, 0) ?? 0;
  let sentence: string, sentenceTone: "calm" | "attention" = "calm";
  if (firstVisit) sentence = contributions || bills ? `Hercules sees ${contributions} ${contributions === 1 ? "contribution" : "contributions"} and ${bills} ${bills === 1 ? "bill" : "bills"} this month. About 15 minutes together.` : "No plan yet. Hercules can walk you through one in about 15 minutes.";
  else if (snapshot.flow?.shortFrom) { sentenceTone = "attention"; sentence = `${snapshot.flow.shortFrom.label} on ${dayWords(snapshot.flow.shortFrom.date)} isn't covered yet.`; }
  else if (snapshot.undividedContributions[0]) { const first = snapshot.undividedContributions[0]; sentence = `${first.memberName}'s ${cad(first.amountCents)} landed ${first.date === today ? "today" : dayWords(first.date)}. It's not divided yet.`; }
  else {
    const lead = agreement.kind === "agreed" ? "All agreed." : agreement.kind === "kept" ? "Kept as your plan." : agreement.kind === "waiting-partner" ? `Waiting for ${partner?.name ?? "your partner"} to agree.` : agreement.kind === "waiting-me" ? "Ready for you to read and agree." : "A private draft, only you can see it.";
    sentence = [lead, snapshot.prepare.line && !snapshot.flow?.shortFrom ? `${snapshot.prepare.line}.` : null, nextIn ? `Next in: ${nextIn.memberName}, ${dayWords(nextIn.date)}.` : null].filter(Boolean).join(" ");
  }
  return {
    monthKey, monthLabel, view, snapshot, agreement, session, monthSet, badge, lenses, firstVisit, sentence, sentenceTone, nextIn,
    // Chapters read as calendar months once the money model sorted the household (the same gate the Chapter moment uses).
    chapter: chapterRow ? (fundModelMode(h) === 2 ? {
      id: chapterRow.id, title: chapterRow.title, monthKey: chapterMonth(chapterRow), monthLabel: monthName(chapterMonth(chapterRow)),
      reminder: chapterReminder(h, { today })?.message ?? null,
    } : { id: chapterRow.id, title: chapterRow.title, monthKey, monthLabel, reminder: null }) : null,
    previousMonthLabel: previous ? monthName(previousKey) : null,
  };
}

/** Pending Fund contributions (proposed, not yet confirmed by the custodian): real, and never counted until confirmed. */
export function pendingContributions(h: Household, memberId: string): { id: string; memberName: string; amountCents: number; date: DateKey; waitingOnMe: boolean }[] {
  const config = shapeHouseholdFundConfig(h.householdFund);
  if (!config) return [];
  return householdFundContributionMotions(h, config.id)
    .filter(row => row.status === "open" || row.status === "held")
    .map(row => ({ id: row.proposal.id, memberName: memberName(h, row.proposal.contributorMemberId ?? row.proposal.createdBy), amountCents: row.proposal.amountCents, date: row.proposal.date, waitingOnMe: config.custodianMemberId === memberId }));
}
