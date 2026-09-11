import { isValidDateKey, monthEndKey, monthStartKey, type DateKey, type MonthKey } from "./calendar.ts";
import { sha256String } from "./synchronousHash.ts";
import { projectedExpenseEffect, transactionProjection } from "./budget.ts";
import { projectPlan, planSelectionForVersion } from "./planProjection.ts";
import type { BudgetPlan, Household, Transaction } from "./types.ts";

export type PlanScope = "personal" | "household";
export type PlanLens = "protect" | "prepare" | "build" | "everyday";
export type PlanVersionState = "proposed" | "scheduled" | "active" | "superseded";

/** The durable authority schedules Plan activation at the start of a Toronto civil day. */
export function planActivationInstant(dateKey: DateKey): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("INVALID_PLAN_ACTIVATION_DATE");
  const [year, month, day] = dateKey.split("-").map(Number);
  const probe = new Date(Date.UTC(year!, month! - 1, day!, 12));
  const zone = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    timeZoneName: "longOffset",
  }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "GMT-05:00";
  const match = zone.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetMinutes = match
    ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]))
    : -300;
  return Date.UTC(year!, month! - 1, day!) - offsetMinutes * 60_000;
}
export type PlanLineKind =
  | "obligation"
  | "true-expense"
  | "reserve"
  | "goal-contribution"
  | "everyday-pool"
  | "household-fund"
  | "bridge-commitment";

export type PlanSourceReference = {
  type: "category" | "recurrence" | "potential-expense" | "goal" | "fund" | "bridge";
  id: string;
};

export type PlanAssumption = {
  id: string;
  kind: "income" | "amount" | "timing" | "balance" | "rate";
  valueCents?: number;
  lowCents?: number;
  highCents?: number;
  expectedDate?: string;
  sourceReferences: PlanSourceReference[];
  observedAt: string;
  confidence: "confirmed" | "estimated" | "uncertain";
};

export type PlanLine = {
  id: string;
  lens: PlanLens;
  kind: PlanLineKind;
  labelSnapshot: string;
  amountCents: number;
  cadence: "monthly" | "weekly" | "one-time";
  dueDate?: string;
  responsibility?: { kind: "joint" | "member"; memberId?: string };
  sourceReference?: PlanSourceReference;
  /** Funding envelope; does not replace the obligation or create another cash claim. */
  envelopeGoalId?: string;
  assumptionIds: string[];
  createdBy: string;
  /** Optional so existing accepted version digests remain byte-for-byte stable. */
  decision?: {
    targetCents?: number;
    lowCents?: number;
    highCents?: number;
    deadline?: DateKey;
    paydays?: DateKey[];
    contributionSchedule?: Array<{ date: DateKey; amountCents: number }>;
    scheduleActualCents?: number;
    nextStep?: string;
    timeConstraint?: string;
    reopenWhen?: string;
    funding?: "available" | "expected";
  };
};

export type PlanDraft = {
  id: string;
  scope: PlanScope;
  ownerMemberId: string;
  targetMonth: MonthKey;
  baseVersionId?: string;
  lines: PlanLine[];
  assumptions: PlanAssumption[];
  note: string;
  updatedAt: string;
};

export type PlanVersion = {
  id: string;
  scope: PlanScope;
  ownerMemberId?: string;
  monthKey: MonthKey;
  sequence: number;
  baseVersionId?: string;
  lines: PlanLine[];
  assumptions: PlanAssumption[];
  reason: string;
  digest: string;
  state: PlanVersionState;
  createdBy: string;
  createdAt: string;
  activatedAt?: string;
};

export type PlanAcknowledgement = {
  id: string;
  planVersionId: string;
  planDigest: string;
  memberId: string;
  acknowledgedAt: string;
};

export type PlanScenario = {
  id: string;
  scope: PlanScope;
  ownerMemberId: string;
  draftId: string;
  name: string;
  changedLines: PlanLine[];
  changedAssumptions?: PlanAssumption[];
  updatedAt: string;
};

export type PlanOutcome = {
  planLineId: string;
  status: "paid" | "moved" | "missed" | "deferred" | "not-relevant";
  actualCents: number;
  transactionIds: string[];
  evidenceIds?: string[];
  note?: string;
};

export type PlanReflection = {
  id: string;
  scope: PlanScope;
  ownerMemberId?: string;
  planVersionId: string;
  monthKey: MonthKey;
  outcomes: PlanOutcome[];
  privateNote?: string;
  sharedNote?: string;
  memberNotes: Array<{ memberId: string; text: string; updatedAt: string }>;
  reviewedByMemberIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PlanLearningProgress = {
  id: string;
  memberId: string;
  monthKey: MonthKey;
  lessonId: string;
  state: "offered" | "completed" | "skipped";
  updatedAt: string;
};

export type PlanCoachingIntensity = "off" | "calm" | "active";
export type PlanCoachingPreference = {
  lifePreferences?: string[];
  id: string;
  memberId: string;
  intensity: PlanCoachingIntensity;
  dismissedIssueIds: string[];
  snoozedIssueIds: Record<string, string>;
  updatedAt: string;
};

export type PlanBridgeState = "proposed" | "held" | "declined" | "withdrawn" | "accepted" | "superseded";
export type PlanBridgeDraft = {
  id: string;
  ownerMemberId: string;
  monthKey: MonthKey;
  kind: "contribution" | "responsibility" | "fund-target" | "shared-goal" | "constraint";
  label: string;
  amountCents?: number;
  lowCents?: number;
  highCents?: number;
  expectedDate?: DateKey;
  supersedesId?: string;
  updatedAt: string;
};
export type PlanBridgeDecision = {
  id: string;
  monthKey: MonthKey;
  kind: "contribution" | "responsibility" | "fund-target" | "shared-goal" | "constraint";
  label: string;
  amountCents?: number;
  lowCents?: number;
  highCents?: number;
  expectedDate?: DateKey;
  offeredByMemberId: string;
  state: PlanBridgeState;
  supersedesId?: string;
  acceptedInPlanVersionId?: string;
  heldByMemberId?: string;
  heldReason?: string;
  declinedByMemberId?: string;
  declineReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanHerculesTurn = {
  id: string;
  role: "member" | "hercules";
  memberId?: string;
  text: string;
  sourceReferences: PlanSourceReference[];
  inReplyToTurnId?: string;
  sourceRevision?: number;
  receiptId?: string;
  responseHash?: string;
  provider?: string;
  createdAt: string;
};

export type PlanActivationJob = {
  id: string;
  planVersionId: string;
  planDigest: string;
  monthKey: MonthKey;
  activateOn: DateKey;
  state: "pending" | "completed" | "cancelled";
  completedEventId?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanHerculesSession = {
  stage?: number;
  decisions?: Array<{ id: string; memberId: string; text: string; createdAt: string }>;
  rhythm?: string;
  id: string;
  sitDownSessionId: string;
  monthKey: MonthKey;
  planDraftId: string;
  resultingPlanVersionId?: string;
  state: "active" | "closed";
  startedBy: string;
  participantMemberIds: string[];
  turns: PlanHerculesTurn[];
  createdAt: string;
  updatedAt: string;
};

export type PlanDriftFinding = {
  id: string;
  scope: PlanScope;
  ownerMemberId?: string;
  planVersionId: string;
  severity: "critical" | "attention" | "gentle";
  rule:
    | "protected-shortfall"
    | "negative-runway"
    | "minimum-uncovered"
    | "everyday-pace"
    | "true-expense-pace"
    | "goal-contribution-late"
    | "assumption-changed"
    | "acknowledgement-needed"
    | "stale-assumption"
    | "sitdown-upcoming"
    | "verified-milestone";
  targetId: string;
  explanation: string;
  consequence: string;
  sourceReferences: PlanSourceReference[];
  asOf: string;
  sourceRevision: number;
};

export type HerculesPlanContext = {
  purchase?: { amountCents: number; date: DateKey };
  contextIdentity?: string;
  disruption?: import("./planProjection.ts").PlanDisruption;
  through?: DateKey;
  monthKey: MonthKey;
  scope: PlanScope;
  lens?: PlanLens;
  activePlanVersionId?: string;
  draftId?: string;
  scenarioId?: string;
  planLineId?: string;
  sitDownSessionId?: string;
};

export const PLAN_LENSES: readonly PlanLens[] = ["protect", "prepare", "build", "everyday"];
export const PLAN_LENS_COPY: Record<PlanLens, { title: string; prompt: string }> = {
  protect: { title: "Protect", prompt: "Keep the promises that make the month safe." },
  prepare: { title: "Prepare", prompt: "Turn irregular costs into expected ones." },
  build: { title: "Build", prompt: "Choose the future this month helps create." },
  everyday: { title: "Everyday", prompt: "Give ordinary life a humane, honest boundary." },
};

export const PLAN_CURRICULUM = [
  ["values-roles-privacy", "Values, roles, privacy, and money history"],
  ["cashflow-balance", "Cash flow versus account balance"],
  ["bills-cadence", "Bills, due dates, pay cadence, and mental load"],
  ["true-expenses", "True expenses and sinking funds"],
  ["buffers", "Emergency buffers and resilience"],
  ["debt", "Debt, interest, minimums, and utilization"],
  ["credit-health", "Credit reports, fees, fraud, and credit health"],
  ["tradeoffs", "Goals, trade-offs, and opportunity cost"],
  ["insurance", "Insurance, benefits, and beneficiaries"],
  ["taxes", "Taxes, payroll deductions, and irregular income"],
  ["investing", "Investing, pensions, retirement, and risk"],
  ["annual-review", "Annual review, net worth, emergency access, and next-year priorities"],
] as const;

export const PLAN_DRIFT_THRESHOLDS = {
  protectedDueDays: 14,
  minimumDueDays: 14,
  everydayMinimumElapsedDays: 7,
  everydayMinimumPurchases: 3,
  everydayPercent: 0.1,
  materialCents: 2_500,
  prepareDueDays: 45,
  prepareFundingPace: 0.75,
  buildLateDays: 7,
  assumptionPercent: 0.05,
  acknowledgementDays: 3,
  staleAssumptionDays: 30,
  sitdownDays: 7,
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function cents(value: unknown): number { return Number.isInteger(value) ? Number(value) : 0; }
function iso(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}
function month(value: unknown): MonthKey | null {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value as MonthKey : null;
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}
function sourceReference(value: unknown): PlanSourceReference | null {
  const row = record(value);
  const type = oneOf(row?.type, ["category", "recurrence", "potential-expense", "goal", "fund", "bridge"] as const, "category");
  const id = text(row?.id);
  return id ? { type, id } : null;
}

function shapePlanDecision(value: unknown): PlanLine["decision"] {
  const row = record(value);
  if (!row) return undefined;
  return {
    ...Object.fromEntries(["targetCents", "lowCents", "highCents"].flatMap(key => Number.isSafeInteger(row[key]) && Number(row[key]) >= 0 ? [[key, Number(row[key])]] : [])),
    ...(typeof row.deadline === "string" && isValidDateKey(row.deadline) ? { deadline: row.deadline } : {}),
    ...(Array.isArray(row.contributionSchedule) ? { contributionSchedule: row.contributionSchedule.flatMap(item => { const entry = record(item); return entry && typeof entry.date === "string" && isValidDateKey(entry.date) && Number.isSafeInteger(entry.amountCents) && Number(entry.amountCents) >= 0 ? [{ date: entry.date, amountCents: Number(entry.amountCents) }] : []; }).slice(0, 366) } : {}),
    ...(Number.isSafeInteger(row.scheduleActualCents) && Number(row.scheduleActualCents) >= 0 ? { scheduleActualCents: Number(row.scheduleActualCents) } : {}),
    ...(Array.isArray(row.paydays) ? { paydays: [...new Set(row.paydays.filter((day): day is string => typeof day === "string" && isValidDateKey(day)))].sort().slice(0, 366) } : {}),
    ...Object.fromEntries(["nextStep", "timeConstraint", "reopenWhen"].flatMap(key => text(row[key]) ? [[key, text(row[key]).slice(0, 1000)]] : [])),
    ...(row.funding === "available" || row.funding === "expected" ? { funding: row.funding } : {}),
  };
}

export function shapePlanAssumptions(value: unknown): PlanAssumption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate);
    const id = text(row?.id);
    if (!row || !id) return [];
    return [{
      id,
      kind: oneOf(row.kind, ["income", "amount", "timing", "balance", "rate"] as const, "amount"),
      ...(Number.isInteger(row.valueCents) ? { valueCents: cents(row.valueCents) } : {}),
      ...(Number.isInteger(row.lowCents) ? { lowCents: cents(row.lowCents) } : {}),
      ...(Number.isInteger(row.highCents) ? { highCents: cents(row.highCents) } : {}),
      ...(text(row.expectedDate) ? { expectedDate: text(row.expectedDate) } : {}),
      sourceReferences: Array.isArray(row.sourceReferences) ? row.sourceReferences.flatMap((item) => sourceReference(item) ?? []) : [],
      observedAt: iso(row.observedAt, new Date(0).toISOString()),
      confidence: oneOf(row.confidence, ["confirmed", "estimated", "uncertain"] as const, "uncertain"),
    }];
  });
}

export function shapePlanLines(value: unknown): PlanLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate);
    const id = text(row?.id);
    const labelSnapshot = text(row?.labelSnapshot);
    const amountCents = cents(row?.amountCents);
    const createdBy = text(row?.createdBy);
    if (!row || !id || !labelSnapshot || !createdBy || amountCents < 0) return [];
    const responsibility = record(row.responsibility);
    const responsibilityKind = oneOf(responsibility?.kind, ["joint", "member"] as const, "joint");
    const memberId = text(responsibility?.memberId);
    const source = sourceReference(row.sourceReference);
    return [{
      id,
      lens: oneOf(row.lens, PLAN_LENSES, "everyday"),
      kind: oneOf(row.kind, ["obligation", "true-expense", "reserve", "goal-contribution", "everyday-pool", "household-fund", "bridge-commitment"] as const, "everyday-pool"),
      labelSnapshot,
      amountCents,
      cadence: oneOf(row.cadence, ["monthly", "weekly", "one-time"] as const, "monthly"),
      ...(text(row.dueDate) ? { dueDate: text(row.dueDate) } : {}),
      ...(responsibility ? { responsibility: responsibilityKind === "member" && memberId ? { kind: "member", memberId } : { kind: "joint" } } : {}),
      ...(source ? { sourceReference: source } : {}),
      ...(text(row.envelopeGoalId) ? { envelopeGoalId: text(row.envelopeGoalId) } : {}),
      assumptionIds: Array.isArray(row.assumptionIds) ? row.assumptionIds.map(text).filter(Boolean) : [],
      createdBy,
      ...(row.decision ? { decision: shapePlanDecision(row.decision) } : {}),
    }];
  });
}

export function planDigest(input: Pick<PlanVersion, "scope" | "monthKey" | "baseVersionId" | "lines" | "assumptions" | "reason">): string {
  const lines = shapePlanLines(input.lines).map((line) => ({
    ...line,
    assumptionIds: [...line.assumptionIds].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  const assumptions = shapePlanAssumptions(input.assumptions).map((assumption) => ({
    ...assumption,
    sourceReferences: [...assumption.sourceReferences].sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`)),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return sha256String(JSON.stringify({
    scope: input.scope,
    monthKey: input.monthKey,
    baseVersionId: input.baseVersionId ?? null,
    lines,
    assumptions,
    reason: input.reason.trim(),
  }));
}

export function shapePlanDrafts(value: unknown, ownerMemberId?: string): PlanDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate);
    const id = text(row?.id);
    const targetMonth = month(row?.targetMonth);
    const owner = text(row?.ownerMemberId);
    if (!row || !id || !targetMonth || !owner || (ownerMemberId && owner !== ownerMemberId)) return [];
    return [{ id, scope: oneOf(row.scope, ["personal", "household"] as const, "personal"), ownerMemberId: owner, targetMonth,
      ...(text(row.baseVersionId) ? { baseVersionId: text(row.baseVersionId) } : {}), lines: shapePlanLines(row.lines), assumptions: shapePlanAssumptions(row.assumptions), note: text(row.note), updatedAt: iso(row.updatedAt, new Date(0).toISOString()) }];
  });
}

export function shapePlanVersions(value: unknown, options: { scope?: PlanScope; ownerMemberId?: string } = {}): PlanVersion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate);
    const id = text(row?.id);
    const monthKey = month(row?.monthKey);
    const scope = oneOf(row?.scope, ["personal", "household"] as const, "personal");
    const owner = text(row?.ownerMemberId);
    if (!row || !id || !monthKey || (options.scope && scope !== options.scope) || (options.ownerMemberId && owner !== options.ownerMemberId)) return [];
    const version: PlanVersion = {
      id, scope, ...(scope === "personal" && owner ? { ownerMemberId: owner } : {}), monthKey,
      sequence: Math.max(1, cents(row.sequence)), ...(text(row.baseVersionId) ? { baseVersionId: text(row.baseVersionId) } : {}),
      lines: shapePlanLines(row.lines), assumptions: shapePlanAssumptions(row.assumptions), reason: text(row.reason),
      digest: text(row.digest), state: oneOf(row.state, ["proposed", "scheduled", "active", "superseded"] as const, "proposed"),
      createdBy: text(row.createdBy), createdAt: iso(row.createdAt, new Date(0).toISOString()),
      ...(text(row.activatedAt) ? { activatedAt: iso(row.activatedAt, new Date(0).toISOString()) } : {}),
    };
    if (!version.createdBy) return [];
    const expected = planDigest(version);
    if (version.digest && version.digest !== expected) return [];
    version.digest = expected;
    return [version];
  });
}

export function shapePlanAcknowledgements(value: unknown, versions: PlanVersion[], activeMemberIds: readonly string[]): PlanAcknowledgement[] {
  const byId = new Map(versions.map((version) => [version.id, version]));
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((candidate) => {
    const row = record(candidate);
    const version = byId.get(text(row?.planVersionId));
    const memberId = text(row?.memberId);
    const id = text(row?.id);
    if (!row || !id || !version || version.scope !== "household" || !activeMemberIds.includes(memberId) || text(row.planDigest) !== version.digest) return [];
    const unique = `${version.id}:${memberId}`;
    if (seen.has(unique)) return [];
    seen.add(unique);
    return [{ id, planVersionId: version.id, planDigest: version.digest, memberId, acknowledgedAt: iso(row.acknowledgedAt, new Date(0).toISOString()) }];
  });
}

export function shapePlanScenarios(value: unknown, ownerMemberId?: string): PlanScenario[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate);
    const id = text(row?.id), owner = text(row?.ownerMemberId), draftId = text(row?.draftId), name = text(row?.name);
    if (!row || !id || !owner || !draftId || !name || (ownerMemberId && owner !== ownerMemberId)) return [];
    return [{ id, scope: oneOf(row.scope, ["personal", "household"] as const, "personal"), ownerMemberId: owner, draftId, name,
      changedLines: shapePlanLines(row.changedLines), ...(Array.isArray(row.changedAssumptions) ? { changedAssumptions: shapePlanAssumptions(row.changedAssumptions) } : {}), updatedAt: iso(row.updatedAt, new Date(0).toISOString()) }];
  });
}

export function shapePlanReflections(value: unknown, options: { scope?: PlanScope; ownerMemberId?: string } = {}): PlanReflection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate);
    const id = text(row?.id), planVersionId = text(row?.planVersionId), monthKey = month(row?.monthKey);
    const scope = oneOf(row?.scope, ["personal", "household"] as const, "personal"), owner = text(row?.ownerMemberId);
    if (!row || !id || !planVersionId || !monthKey || (options.scope && options.scope !== scope) || (options.ownerMemberId && owner !== options.ownerMemberId)) return [];
    const outcomes: PlanOutcome[] = Array.isArray(row.outcomes) ? row.outcomes.flatMap((candidateOutcome) => {
      const outcome = record(candidateOutcome), planLineId = text(outcome?.planLineId);
      if (!outcome || !planLineId) return [];
      return [{ planLineId, status: oneOf(outcome.status, ["paid", "moved", "missed", "deferred", "not-relevant"] as const, "not-relevant"),
        actualCents: cents(outcome.actualCents), ...(Array.isArray(outcome.evidenceIds) ? { evidenceIds: [...new Set(outcome.evidenceIds.map(text).filter(Boolean))] } : {}), transactionIds: Array.isArray(outcome.transactionIds) ? outcome.transactionIds.map(text).filter(Boolean) : [],
        ...(text(outcome.note) ? { note: text(outcome.note) } : {}) }];
    }) : [];
    const memberNotes = Array.isArray(row.memberNotes) ? row.memberNotes.flatMap((candidateNote) => {
      const note = record(candidateNote), memberId = text(note?.memberId), noteText = text(note?.text);
      return note && memberId && noteText ? [{ memberId, text: noteText, updatedAt: iso(note.updatedAt, new Date(0).toISOString()) }] : [];
    }) : [];
    return [{ id, scope, ...(owner ? { ownerMemberId: owner } : {}), planVersionId, monthKey, outcomes,
      ...(text(row.privateNote) ? { privateNote: text(row.privateNote) } : {}), ...(text(row.sharedNote) ? { sharedNote: text(row.sharedNote) } : {}),
      memberNotes, reviewedByMemberIds: Array.isArray(row.reviewedByMemberIds) ? [...new Set(row.reviewedByMemberIds.map(text).filter(Boolean))] : [],
      createdAt: iso(row.createdAt, new Date(0).toISOString()), updatedAt: iso(row.updatedAt, iso(row.createdAt, new Date(0).toISOString())) }];
  });
}

export function shapePlanBridgeDrafts(value: unknown, ownerMemberId?: string): PlanBridgeDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate), id = text(row?.id), owner = text(row?.ownerMemberId), monthKey = month(row?.monthKey), label = text(row?.label);
    if (!row || !id || !owner || !monthKey || (ownerMemberId && owner !== ownerMemberId)) return [];
    return [{ id, ownerMemberId: owner, monthKey,
      kind: oneOf(row.kind, ["contribution", "responsibility", "fund-target", "shared-goal", "constraint"] as const, "contribution"), label,
      ...(Number.isInteger(row.amountCents) ? { amountCents: Math.max(0, cents(row.amountCents)) } : {}),
      ...(Number.isInteger(row.lowCents) ? { lowCents: Math.max(0, cents(row.lowCents)) } : {}),
      ...(Number.isInteger(row.highCents) ? { highCents: Math.max(0, cents(row.highCents)) } : {}),
      ...(text(row.expectedDate) ? { expectedDate: text(row.expectedDate) as DateKey } : {}),
      ...(text(row.supersedesId) ? { supersedesId: text(row.supersedesId) } : {}), updatedAt: iso(row.updatedAt, new Date(0).toISOString()) }];
  });
}

export function shapePlanLearningProgress(value: unknown, memberId?: string): PlanLearningProgress[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate), id = text(row?.id), owner = text(row?.memberId), monthKey = month(row?.monthKey), lessonId = text(row?.lessonId);
    if (!row || !id || !owner || !monthKey || !lessonId || (memberId && owner !== memberId)) return [];
    return [{ id, memberId: owner, monthKey, lessonId, state: oneOf(row.state, ["offered", "completed", "skipped"] as const, "offered"), updatedAt: iso(row.updatedAt, new Date(0).toISOString()) }];
  });
}

export function shapePlanCoachingPreferences(value: unknown, memberId?: string): PlanCoachingPreference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate), id = text(row?.id), owner = text(row?.memberId);
    if (!row || !id || !owner || (memberId && owner !== memberId)) return [];
    const snoozed = record(row.snoozedIssueIds) ?? {};
    return [{ ...(Array.isArray(row.lifePreferences) ? { lifePreferences: [...new Set(row.lifePreferences.map(text).filter(Boolean))].slice(0, 10).map(value => value.slice(0, 240)) } : {}), id, memberId: owner, intensity: oneOf(row.intensity, ["off", "calm", "active"] as const, "calm"),
      dismissedIssueIds: Array.isArray(row.dismissedIssueIds) ? row.dismissedIssueIds.map(text).filter(Boolean) : [],
      snoozedIssueIds: Object.fromEntries(Object.entries(snoozed).flatMap(([key, candidateValue]) => text(candidateValue) ? [[key, text(candidateValue)]] : [])),
      updatedAt: iso(row.updatedAt, new Date(0).toISOString()) }];
  });
}

export function shapePlanBridgeDecisions(value: unknown, activeMemberIds: readonly string[]): PlanBridgeDecision[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate), id = text(row?.id), monthKey = month(row?.monthKey), label = text(row?.label), offeredByMemberId = text(row?.offeredByMemberId);
    if (!row || !id || !monthKey || !label || !activeMemberIds.includes(offeredByMemberId)) return [];
    return [{ id, monthKey, kind: oneOf(row.kind, ["contribution", "responsibility", "fund-target", "shared-goal", "constraint"] as const, "contribution"), label,
      ...(Number.isInteger(row.amountCents) ? { amountCents: Math.max(0, cents(row.amountCents)) } : {}),
      ...(Number.isInteger(row.lowCents) ? { lowCents: Math.max(0, cents(row.lowCents)) } : {}),
      ...(Number.isInteger(row.highCents) ? { highCents: Math.max(0, cents(row.highCents)) } : {}),
      ...(text(row.expectedDate) ? { expectedDate: text(row.expectedDate) as DateKey } : {}), offeredByMemberId,
      state: oneOf(row.state, ["proposed", "held", "declined", "withdrawn", "accepted", "superseded"] as const, "proposed"),
      ...(text(row.supersedesId) ? { supersedesId: text(row.supersedesId) } : {}),
      ...(text(row.acceptedInPlanVersionId) ? { acceptedInPlanVersionId: text(row.acceptedInPlanVersionId) } : {}),
      ...(activeMemberIds.includes(text(row.heldByMemberId)) ? { heldByMemberId: text(row.heldByMemberId) } : {}),
      ...(text(row.heldReason) ? { heldReason: text(row.heldReason) } : {}),
      ...(activeMemberIds.includes(text(row.declinedByMemberId)) ? { declinedByMemberId: text(row.declinedByMemberId) } : {}),
      ...(text(row.declineReason) ? { declineReason: text(row.declineReason) } : {}),
      createdAt: iso(row.createdAt, new Date(0).toISOString()), updatedAt: iso(row.updatedAt, iso(row.createdAt, new Date(0).toISOString())) }];
  });
}

export function shapePlanActivationJobs(value: unknown, versions: readonly PlanVersion[]): PlanActivationJob[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map(versions.filter((version) => version.scope === "household").map((version) => [version.id, version]));
  return value.flatMap((candidate) => {
    const row = record(candidate), id = text(row?.id), planVersionId = text(row?.planVersionId), planDigest = text(row?.planDigest), monthKey = month(row?.monthKey);
    const version = byId.get(planVersionId), activateOn = text(row?.activateOn);
    if (!row || !id || !version || version.digest !== planDigest || version.monthKey !== monthKey || !/^\d{4}-\d{2}-\d{2}$/.test(activateOn)) return [];
    return [{ id, planVersionId, planDigest, monthKey, activateOn: activateOn as DateKey,
      state: oneOf(row.state, ["pending", "completed", "cancelled"] as const, "pending"),
      ...(text(row.completedEventId) ? { completedEventId: text(row.completedEventId) } : {}),
      createdAt: iso(row.createdAt, new Date(0).toISOString()), updatedAt: iso(row.updatedAt, iso(row.createdAt, new Date(0).toISOString())) }];
  });
}

export function shapePlanHerculesSessions(value: unknown, activeMemberIds: readonly string[]): PlanHerculesSession[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const row = record(candidate), id = text(row?.id), sitDownSessionId = text(row?.sitDownSessionId), monthKey = month(row?.monthKey), planDraftId = text(row?.planDraftId), startedBy = text(row?.startedBy);
    if (!row || !id || !sitDownSessionId || !monthKey || !planDraftId || !activeMemberIds.includes(startedBy)) return [];
    const participants = Array.isArray(row.participantMemberIds) ? [...new Set(row.participantMemberIds.map(text).filter((item) => activeMemberIds.includes(item)))] : [];
    const turns: PlanHerculesTurn[] = Array.isArray(row.turns) ? row.turns.flatMap((candidateTurn) => {
      const turn = record(candidateTurn), turnId = text(turn?.id), turnText = text(turn?.text), role = oneOf(turn?.role, ["member", "hercules"] as const, "member"), turnMember = text(turn?.memberId);
      if (!turn || !turnId || !turnText || (role === "member" && !activeMemberIds.includes(turnMember))) return [];
      return [{ id: turnId, role, ...(role === "member" ? { memberId: turnMember } : {}), text: turnText,
        sourceReferences: Array.isArray(turn.sourceReferences) ? turn.sourceReferences.flatMap((item) => sourceReference(item) ?? []) : [],
        ...(text(turn.inReplyToTurnId) ? { inReplyToTurnId: text(turn.inReplyToTurnId) } : {}),
        ...(Number.isSafeInteger(turn.sourceRevision) && Number(turn.sourceRevision) >= 0 ? { sourceRevision: Number(turn.sourceRevision) } : {}),
        ...(text(turn.receiptId) ? { receiptId: text(turn.receiptId) } : {}), ...(text(turn.responseHash) ? { responseHash: text(turn.responseHash) } : {}),
        ...(text(turn.provider) ? { provider: text(turn.provider) } : {}),
        createdAt: iso(turn.createdAt, new Date(0).toISOString()) }];
    }) : [];
    return [{ id, sitDownSessionId, monthKey, planDraftId, ...(text(row.resultingPlanVersionId) ? { resultingPlanVersionId: text(row.resultingPlanVersionId) } : {}),
      state: oneOf(row.state, ["active", "closed"] as const, "active"), startedBy, participantMemberIds: participants, turns,
      ...(Number.isInteger(row.stage) && Number(row.stage) >= 0 && Number(row.stage) <= 7 ? { stage: Number(row.stage) } : {}),
      ...(typeof row.rhythm === "string" ? { rhythm: row.rhythm.slice(0, 2000) } : {}),
      ...(Array.isArray(row.decisions) ? { decisions: row.decisions.flatMap(candidate => { const decision = record(candidate); return decision && text(decision.id) && activeMemberIds.includes(text(decision.memberId)) && text(decision.text) ? [{ id: text(decision.id), memberId: text(decision.memberId), text: text(decision.text).slice(0, 6000), createdAt: iso(decision.createdAt, new Date(0).toISOString()) }] : []; }) } : {}),
      createdAt: iso(row.createdAt, new Date(0).toISOString()), updatedAt: iso(row.updatedAt, iso(row.createdAt, new Date(0).toISOString())) }];
  });
}

export function mergePlanRecords<T extends { id: string }>(left: readonly T[] = [], right: readonly T[] = [], at: (row: T) => string): T[] {
  const merged = new Map<string, T>();
  for (const row of [...left, ...right]) {
    const prior = merged.get(row.id);
    if (!prior || at(row) >= at(prior)) merged.set(row.id, row);
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function requiredPlanMemberIds(household: Pick<Household, "members">): string[] {
  const active = household.members.filter((member) => member.active);
  const named = ["jonathan", "bianca"].flatMap((name) => active.find((member) => member.name.trim().toLowerCase() === name)?.id ?? []);
  return named.length === 2 ? named : active.slice(0, 2).map((member) => member.id);
}

export function planAcknowledgementState(household: Pick<Household, "members" | "planAcknowledgements">, version: PlanVersion) {
  const requiredMemberIds = requiredPlanMemberIds(household);
  const acknowledgedMemberIds = [...new Set((household.planAcknowledgements ?? [])
    .filter((row) => row.planVersionId === version.id && row.planDigest === version.digest && requiredMemberIds.includes(row.memberId))
    .map((row) => row.memberId))];
  return { requiredMemberIds, acknowledgedMemberIds, complete: requiredMemberIds.length === 2 && requiredMemberIds.every((id) => acknowledgedMemberIds.includes(id)) };
}

export function currentPlanVersion(household: Pick<Household, "planVersions">, scope: PlanScope, monthKey: MonthKey, ownerMemberId?: string): PlanVersion | null {
  return (household.planVersions ?? []).filter((version) => version.scope === scope && version.monthKey === monthKey
    && (scope === "household" || version.ownerMemberId === ownerMemberId) && version.state !== "superseded")
    .sort((a, b) => b.sequence - a.sequence || b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function planLensTotals(lines: readonly PlanLine[]): Record<PlanLens, number> {
  return Object.fromEntries(PLAN_LENSES.map((lens) => [lens, lines.filter((line) => line.lens === lens).reduce((sum, line) => sum + line.amountCents, 0)])) as Record<PlanLens, number>;
}

export function planCompatibilityRows(version: PlanVersion, household: Pick<Household, "categories" | "budgetPlans">, at = version.activatedAt ?? version.createdAt): BudgetPlan[] {
  if (version.scope !== "household" || !["scheduled", "active"].includes(version.state)) return [];
  const categories = new Map(household.categories.map((category) => [category.id, category]));
  const grouped = new Map<string, number>();
  for (const line of version.lines) if (line.sourceReference?.type === "category") {
    grouped.set(line.sourceReference.id, (grouped.get(line.sourceReference.id) ?? 0) + line.amountCents);
  }
  return [...grouped].flatMap(([subcategoryId, amountCents]) => {
    const category = categories.get(subcategoryId);
    if (!category || category.recordType !== "category") return [];
    const prior = household.budgetPlans.find((row) => row.monthKey === version.monthKey && row.subcategoryId === subcategoryId && row.active);
    return [{ id: prior?.id ?? `BUD-PLAN-${version.id}-${subcategoryId}`, monthKey: version.monthKey, subcategoryId, amountCents,
      essential: category.essential, incomeStability: category.incomeStability, active: true, createdAt: prior?.createdAt ?? at, updatedAt: at }];
  });
}

export function legacyHouseholdPlanDraft(household: Household, monthKey: MonthKey, memberId: string, at: string): PlanDraft {
  const existing = household.budgetPlans.filter((row) => row.active && row.monthKey === monthKey && row.amountCents > 0);
  const categories = new Map(household.categories.map((category) => [category.id, category]));
  return {
    id: `PLAN-DRAFT-household-${monthKey}-${memberId}`,
    scope: "household", ownerMemberId: memberId, targetMonth: monthKey,
    lines: existing.flatMap((budget) => {
      const category = categories.get(budget.subcategoryId);
      if (!category) return [];
      return [{ id: `PLAN-LINE-${budget.id}`, lens: budget.essential ? "protect" : "everyday", kind: budget.essential ? "obligation" : "everyday-pool",
        labelSnapshot: category.name, amountCents: budget.amountCents, cadence: "monthly", responsibility: { kind: "joint" },
        sourceReference: { type: "category", id: category.id }, assumptionIds: [], createdBy: memberId } satisfies PlanLine];
    }),
    assumptions: [], note: existing.length ? "Adopted from the current household budget." : "", updatedAt: at,
  };
}

export function planActualCents(transactions: readonly Transaction[], line: PlanLine, monthKey: MonthKey): number {
  if (line.sourceReference?.type !== "category") return 0;
  const byId = new Map(transactions.map(tx => [tx.id, tx]));
  return [...byId.values()].filter(tx => tx.date.startsWith(monthKey) && transactionProjection(tx, byId).root.subcategoryId === line.sourceReference?.id)
    .reduce((sum, tx) => sum + projectedExpenseEffect(tx, byId), 0);
}

function daysBetween(left: string, right: string): number { return Math.ceil((Date.parse(right) - Date.parse(left)) / 86_400_000); }

export function evaluatePlanDrift(household: Household, version: PlanVersion, asOf: DateKey): PlanDriftFinding[] {
  const findings: PlanDriftFinding[] = [];
  const sourceRevision = household.revision;
  const add = (finding: Omit<PlanDriftFinding, "id" | "scope" | "ownerMemberId" | "planVersionId" | "asOf" | "sourceRevision">) => {
    const horizon = `${finding.explanation}|${finding.consequence}`;
    findings.push({ ...finding, id: sha256String(`${finding.rule}|${version.scope}|${version.id}|${finding.targetId}|${horizon}`).slice(0, 24),
      scope: version.scope, ...(version.ownerMemberId ? { ownerMemberId: version.ownerMemberId } : {}), planVersionId: version.id, asOf, sourceRevision });
  };
  const projection = projectPlan(household, { memberId: version.ownerMemberId ?? version.createdBy, scope: version.scope,
    acceptedRevision: household.revision, asOf, through: monthEndKey(version.monthKey) < asOf ? asOf : monthEndKey(version.monthKey), selection: planSelectionForVersion(version) });
  if (projection.firstExposed) add({ severity: "critical", rule: "negative-runway", targetId: projection.firstExposed.date,
    explanation: `${projection.firstExposed.label} has a ${projection.firstExposed.gapCents} cent gap on ${projection.firstExposed.date}.`,
    consequence: "Review a contribution date or a commitment in the same projection.", sourceReferences: [] });
  for (const row of projection.lines) {
    if (row.line.lens === "protect" && row.gapCents > 0 && row.dueDate && daysBetween(asOf, row.dueDate) <= PLAN_DRIFT_THRESHOLDS.protectedDueDays) add({
      severity: "critical", rule: "protected-shortfall", targetId: row.line.id,
      explanation: `${row.line.labelSnapshot} has ${row.gapCents} cents without identified coverage by ${row.dueDate}.`,
      consequence: row.issues[0] ?? "Try a different contribution date or a reviewed adjustment.", sourceReferences: row.line.sourceReference ? [row.line.sourceReference] : [] });
    if (["build", "prepare"].includes(row.line.lens) && row.remainingCents > 0 && row.dueDate && row.dueDate < asOf) add({
      severity: "attention", rule: row.line.lens === "build" ? "goal-contribution-late" : "true-expense-pace", targetId: row.line.id,
      explanation: `${row.line.labelSnapshot} still needs ${row.remainingCents} cents after ${row.dueDate}.`,
      consequence: "Review the funding evidence, next contribution and timing together.", sourceReferences: row.line.sourceReference ? [row.line.sourceReference] : [] });
    if (row.status === "completed" && row.line.lens === "build") add({ severity: "gentle", rule: "verified-milestone", targetId: row.line.id,
      explanation: `${row.line.labelSnapshot} reached this month's contribution promise.`, consequence: "Review the verified progress and choose what comes next.", sourceReferences: row.line.sourceReference ? [row.line.sourceReference] : [] });
    if (row.line.lens === "everyday" && row.actualCents > row.intendedCents + PLAN_DRIFT_THRESHOLDS.materialCents) add({ severity: "attention", rule: "everyday-pace", targetId: row.line.id,
      explanation: `${row.line.labelSnapshot} is ${row.actualCents - row.intendedCents} cents above its monthly intention.`, consequence: "Review upcoming plans before deciding whether this uneven month needs a change.", sourceReferences: row.line.sourceReference ? [row.line.sourceReference] : [] });
  }
  for (const assumption of version.assumptions) if (daysBetween(assumption.observedAt.slice(0, 10), asOf) >= PLAN_DRIFT_THRESHOLDS.staleAssumptionDays) add({
    severity: "gentle", rule: "stale-assumption", targetId: assumption.id, explanation: "A material plan assumption has not been refreshed recently.",
    consequence: "The current projection may be relying on old information.", sourceReferences: assumption.sourceReferences,
  });
  const baseVersion = (household.planVersions ?? []).find((row) => row.id === version.baseVersionId);
  for (const assumption of version.assumptions) {
    const prior = baseVersion?.assumptions.find((row) => row.id === assumption.id);
    if (prior?.valueCents === undefined || assumption.valueCents === undefined) continue;
    const delta = Math.abs(assumption.valueCents - prior.valueCents);
    if (delta >= PLAN_DRIFT_THRESHOLDS.materialCents && delta >= Math.abs(prior.valueCents) * PLAN_DRIFT_THRESHOLDS.assumptionPercent) add({
      severity: "attention", rule: "assumption-changed", targetId: assumption.id, explanation: "A Plan amount assumption changed materially from the prior version.",
      consequence: "Review the consequence before treating the new projection as settled.", sourceReferences: assumption.sourceReferences,
    });
  }
  if (version.scope === "household" && version.state === "proposed") {
    const state = planAcknowledgementState(household, version);
    if (!state.complete && daysBetween(asOf, monthStartKey(version.monthKey)) <= PLAN_DRIFT_THRESHOLDS.acknowledgementDays) add({
      severity: "attention", rule: "acknowledgement-needed", targetId: version.id, explanation: "The next household plan is still waiting for an exact-version acknowledgement.",
      consequence: "It will not become the accepted plan until both partners acknowledge it.", sourceReferences: [],
    });
  }
  if (daysBetween(asOf, monthEndKey(version.monthKey)) >= 0 && daysBetween(asOf, monthEndKey(version.monthKey)) <= PLAN_DRIFT_THRESHOLDS.sitdownDays) add({
    severity: "gentle", rule: "sitdown-upcoming", targetId: version.monthKey, explanation: "The monthly Sitdown is coming up.",
    consequence: "Open questions can become a calm shared agenda instead of a last-minute surprise.", sourceReferences: [],
  });
  return findings;
}

export function planVersionDiff(before: PlanVersion | null, after: PlanVersion) {
  const prior = new Map((before?.lines ?? []).map((line) => [line.id, line]));
  const current = new Map(after.lines.map((line) => [line.id, line]));
  const added = after.lines.filter((line) => !prior.has(line.id));
  const removed = (before?.lines ?? []).filter((line) => !current.has(line.id));
  const changed = after.lines.flatMap((line) => {
    const old = prior.get(line.id);
    return old && JSON.stringify(old) !== JSON.stringify(line) ? [{ before: old, after: line }] : [];
  });
  return { added, removed, changed, totalDeltaCents: after.lines.reduce((sum, line) => sum + line.amountCents, 0) - (before?.lines ?? []).reduce((sum, line) => sum + line.amountCents, 0) };
}

/** Detect additive records that pre-decision clients would otherwise drop. */
export function hasPlanDecisionData(h: Household): boolean {
  return Boolean(h.planCoachingPreferences?.some(row => row.lifePreferences !== undefined)) || [...(h.planDrafts ?? []), ...(h.planVersions ?? [])].some(row => row.lines.some(line => line.decision))
    || Boolean(h.planScenarios?.some(row => row.changedAssumptions !== undefined || row.changedLines.some(line => line.decision)))
    || Boolean(h.planHerculesSessions?.some(row => row.stage !== undefined))
    || Boolean(h.planReflections?.some(row => row.outcomes.some(outcome => outcome.evidenceIds !== undefined)))
    || Boolean(h.kitchen.boards?.tasks.some(row => row.planReference));
}
