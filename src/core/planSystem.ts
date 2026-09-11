import { monthEndKey, monthStartKey, type DateKey, type MonthKey } from "./calendar.ts";
import { sha256String } from "./synchronousHash.ts";
import { householdWallet } from "./accounts.ts";
import type { BudgetPlan, Household, Transaction } from "./types.ts";

export type PlanScope = "personal" | "household";
export type PlanLens = "protect" | "prepare" | "build" | "everyday";
export type PlanVersionState = "proposed" | "scheduled" | "active" | "superseded";
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
  assumptionIds: string[];
  createdBy: string;
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
  updatedAt: string;
};

export type PlanOutcome = {
  planLineId: string;
  status: "paid" | "moved" | "missed" | "deferred" | "not-relevant";
  actualCents: number;
  transactionIds: string[];
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
  id: string;
  memberId: string;
  intensity: PlanCoachingIntensity;
  dismissedIssueIds: string[];
  snoozedIssueIds: Record<string, string>;
  updatedAt: string;
};

export type PlanBridgeState = "proposed" | "held" | "declined" | "withdrawn" | "accepted" | "superseded";
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
  createdAt: string;
  updatedAt: string;
};

export type PlanHerculesTurn = {
  id: string;
  role: "member" | "hercules";
  memberId?: string;
  text: string;
  sourceReferences: PlanSourceReference[];
  createdAt: string;
};

export type PlanHerculesSession = {
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
      assumptionIds: Array.isArray(row.assumptionIds) ? row.assumptionIds.map(text).filter(Boolean) : [],
      createdBy,
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
      changedLines: shapePlanLines(row.changedLines), updatedAt: iso(row.updatedAt, new Date(0).toISOString()) }];
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
        actualCents: Math.max(0, cents(outcome.actualCents)), transactionIds: Array.isArray(outcome.transactionIds) ? outcome.transactionIds.map(text).filter(Boolean) : [],
        ...(text(outcome.note) ? { note: text(outcome.note) } : {}) }];
    }) : [];
    return [{ id, scope, ...(owner ? { ownerMemberId: owner } : {}), planVersionId, monthKey, outcomes,
      ...(text(row.privateNote) ? { privateNote: text(row.privateNote) } : {}), ...(text(row.sharedNote) ? { sharedNote: text(row.sharedNote) } : {}),
      createdAt: iso(row.createdAt, new Date(0).toISOString()), updatedAt: iso(row.updatedAt, iso(row.createdAt, new Date(0).toISOString())) }];
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
    return [{ id, memberId: owner, intensity: oneOf(row.intensity, ["off", "calm", "active"] as const, "calm"),
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
        createdAt: iso(turn.createdAt, new Date(0).toISOString()) }];
    }) : [];
    return [{ id, sitDownSessionId, monthKey, planDraftId, ...(text(row.resultingPlanVersionId) ? { resultingPlanVersionId: text(row.resultingPlanVersionId) } : {}),
      state: oneOf(row.state, ["active", "closed"] as const, "active"), startedBy, participantMemberIds: participants, turns,
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
  return transactions.filter((tx) => tx.date.startsWith(monthKey) && tx.subcategoryId === line.sourceReference?.id && tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amountCents, 0);
}

function daysBetween(left: string, right: string): number { return Math.ceil((Date.parse(right) - Date.parse(left)) / 86_400_000); }

export function evaluatePlanDrift(household: Household, version: PlanVersion, asOf: DateKey): PlanDriftFinding[] {
  const findings: PlanDriftFinding[] = [];
  const sourceRevision = household.revision;
  const scopeTransactions = household.transactions.filter((tx) => tx.date.startsWith(version.monthKey)
    && (version.scope === "household" ? tx.visibility !== "personal" : tx.createdBy === version.ownerMemberId && tx.visibility === "personal"));
  const add = (finding: Omit<PlanDriftFinding, "id" | "scope" | "ownerMemberId" | "planVersionId" | "asOf" | "sourceRevision">) => {
    const horizon = finding.targetId;
    findings.push({ ...finding, id: sha256String(`${finding.rule}|${version.scope}|${version.id}|${finding.targetId}|${horizon}`).slice(0, 24),
      scope: version.scope, ...(version.ownerMemberId ? { ownerMemberId: version.ownerMemberId } : {}), planVersionId: version.id, asOf, sourceRevision });
  };
  let availableProtectedCash = Math.max(0, householdWallet(household, asOf).cashCents);
  const protectedLines = version.lines.filter((line) => line.lens === "protect")
    .sort((left, right) => (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31"));
  for (const line of protectedLines) {
    const actual = planActualCents(scopeTransactions, line, version.monthKey);
    const remaining = Math.max(0, line.amountCents - actual);
    const dueIn = line.dueDate ? daysBetween(asOf, line.dueDate) : Number.POSITIVE_INFINITY;
    const coverageGap = Math.max(0, remaining - availableProtectedCash);
    availableProtectedCash = Math.max(0, availableProtectedCash - remaining);
    if (coverageGap > 0 && dueIn >= 0 && dueIn <= PLAN_DRIFT_THRESHOLDS.protectedDueDays) add({
      severity: "critical", rule: line.kind === "obligation" ? "protected-shortfall" : "minimum-uncovered", targetId: line.id,
      explanation: `${line.labelSnapshot} is due soon with a ${coverageGap} cent gap after visible protected cash is allocated in due-date order.`,
      consequence: "The plan's protected layer may not be fully covered in time.", sourceReferences: line.sourceReference ? [line.sourceReference] : [],
    });
  }
  for (const line of version.lines) {
    const actual = planActualCents(scopeTransactions, line, version.monthKey);
    const remaining = Math.max(0, line.amountCents - actual);
    if (line.lens === "build" && line.dueDate && remaining > 0 && daysBetween(line.dueDate, asOf) >= PLAN_DRIFT_THRESHOLDS.buildLateDays) add({
      severity: "attention", rule: "goal-contribution-late", targetId: line.id, explanation: `${line.labelSnapshot} is still unmatched after its planned date.`,
      consequence: "The goal may need a new date or a smaller contribution.", sourceReferences: line.sourceReference ? [line.sourceReference] : [],
    });
    if (line.lens === "prepare" && line.dueDate && remaining > 0) {
      const dueIn = daysBetween(asOf, line.dueDate);
      const totalDays = Math.max(1, daysBetween(monthStartKey(version.monthKey), line.dueDate));
      const elapsedDays = Math.max(0, daysBetween(monthStartKey(version.monthKey), asOf));
      const requiredByNow = Math.round(line.amountCents * Math.min(1, elapsedDays / totalDays));
      if (dueIn >= 0 && dueIn <= PLAN_DRIFT_THRESHOLDS.prepareDueDays && actual < requiredByNow * PLAN_DRIFT_THRESHOLDS.prepareFundingPace) add({
        severity: "attention", rule: "true-expense-pace", targetId: line.id, explanation: `${line.labelSnapshot} is below three quarters of its required funding pace.`,
        consequence: "The amount or timing may need attention before it becomes urgent.", sourceReferences: line.sourceReference ? [line.sourceReference] : [],
      });
    }
    if (line.lens === "build" && line.amountCents > 0 && actual >= line.amountCents) add({
      severity: "gentle", rule: "verified-milestone", targetId: line.id, explanation: `${line.labelSnapshot} reached its visible Plan amount.`,
      consequence: "This verified progress deserves a proportionate celebration.", sourceReferences: line.sourceReference ? [line.sourceReference] : [],
    });
  }
  const futureEvents = [
    ...version.assumptions.filter((row) => row.kind === "income" && row.valueCents && (row.expectedDate ?? `${version.monthKey}-01`) >= asOf)
      .map((row) => ({ date: row.expectedDate ?? `${version.monthKey}-01`, cents: row.valueCents! })),
    ...version.lines.map((line) => ({ line, actual: planActualCents(scopeTransactions, line, version.monthKey) }))
      .filter(({ line }) => (line.dueDate ?? monthEndKey(version.monthKey)) >= asOf)
      .map(({ line, actual }) => ({ date: line.dueDate ?? monthEndKey(version.monthKey), cents: -Math.max(0, line.amountCents - actual) })),
  ].sort((left, right) => left.date.localeCompare(right.date) || right.cents - left.cents);
  let runway = householdWallet(household, asOf).cashCents;
  for (const event of futureEvents) {
    runway += event.cents;
    if (runway < 0) {
      add({ severity: "critical", rule: "negative-runway", targetId: event.date, explanation: `The dated Plan falls below zero around ${event.date}.`, consequence: "A protected decision needs attention before that point.", sourceReferences: [] });
      break;
    }
  }
  const everydayLines = version.lines.filter((line) => line.lens === "everyday");
  const everydayPlanned = everydayLines.reduce((sum, line) => sum + line.amountCents, 0);
  const everydayIds = new Set(everydayLines.flatMap((line) => line.sourceReference?.type === "category" ? [line.sourceReference.id] : []));
  const purchases = scopeTransactions.filter((tx) => tx.type === "expense" && everydayIds.has(tx.subcategoryId ?? ""));
  const elapsed = Math.max(1, Number(asOf.slice(-2)));
  const projected = purchases.reduce((sum, tx) => sum + tx.amountCents, 0) / elapsed * Number(monthEndKey(version.monthKey).slice(-2));
  if (elapsed >= PLAN_DRIFT_THRESHOLDS.everydayMinimumElapsedDays && purchases.length >= PLAN_DRIFT_THRESHOLDS.everydayMinimumPurchases
      && projected > everydayPlanned * (1 + PLAN_DRIFT_THRESHOLDS.everydayPercent) && projected - everydayPlanned >= PLAN_DRIFT_THRESHOLDS.materialCents) add({
    severity: "attention", rule: "everyday-pace", targetId: "everyday", explanation: "Everyday spending is running meaningfully above the accepted monthly pace.",
    consequence: "Keeping this pace would use more than the Everyday amount without changing Protect.", sourceReferences: everydayLines.flatMap((line) => line.sourceReference ? [line.sourceReference] : []),
  });
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
