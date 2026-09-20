import type { LedgerView, PlanLens, PlanLine } from "./core/index.ts";

export type PlanDecisionDraftIdentity = {
  environment: string;
  householdId: string;
  memberId: string;
  view: LedgerView;
};

export type PlanDecisionDraftContext = PlanDecisionDraftIdentity & {
  month: string;
  selectionKind: "draft" | "scenario" | "version";
  selectionId: string;
  selectionRevision: string;
};

export type PlanDecisionDraftTarget = {
  kind: "line" | "new";
  lineId: string;
  lens: PlanLens;
};

export type PlanDecisionDraftFields = {
  label: string;
  amount: string;
  source: string;
  envelopeGoalId: string;
  due: string;
  cadence: PlanLine["cadence"];
  funding: string;
  target: string;
  low: string;
  high: string;
  deadline: string;
  paydays: string;
  nextStep: string;
  timeConstraint: string;
  reopenWhen: string;
  responsible: string;
};

export type PlanDecisionDraft = {
  version: 1;
  context: PlanDecisionDraftContext;
  target: PlanDecisionDraftTarget;
  base: {
    sourceRevision: number;
    selectionRevision: string;
    lineFingerprint: string | null;
  };
  fields: PlanDecisionDraftFields;
};

export type PlanDecisionNavigation = {
  version: 1;
  identity: PlanDecisionDraftIdentity;
  month: string;
  selectionKind: PlanDecisionDraftContext["selectionKind"];
  selectionId: string;
  target: PlanDecisionDraftTarget;
};

export type PlanDecisionDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "hearth:plan-decision-editor:v1";
const MAX_RECORD = 64 * 1024;
const text = (value: unknown, max = 4096) => typeof value === "string" && value.length <= max ? value : null;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const part = (value: string) => encodeURIComponent(value);

export function planDecisionIdentity(household: { environment: string; householdId: string }, memberId: string, view: LedgerView): PlanDecisionDraftIdentity {
  return { environment: household.environment, householdId: household.householdId, memberId, view };
}

export function planDecisionLineFingerprint(line?: PlanLine): string | null {
  return line ? JSON.stringify(line) : null;
}

export function planDecisionDraftHasConflict(draft: Pick<PlanDecisionDraft, "base">, current: { sourceRevision: number; selectionRevision: string; line?: PlanLine }): boolean {
  return draft.base.sourceRevision !== current.sourceRevision || draft.base.selectionRevision !== current.selectionRevision || draft.base.lineFingerprint !== planDecisionLineFingerprint(current.line);
}

export function planDecisionDraftKey(context: PlanDecisionDraftContext, target: PlanDecisionDraftTarget): string {
  return [PREFIX, context.environment, context.householdId, context.memberId, context.view, context.month, context.selectionKind, context.selectionId, target.kind, target.lineId].map(part).join(":");
}

export function planDecisionNavigationKey(identity: PlanDecisionDraftIdentity): string {
  return [PREFIX, "active", identity.environment, identity.householdId, identity.memberId, identity.view].map(part).join(":");
}

function decodeIdentity(value: unknown): PlanDecisionDraftIdentity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const environment = text(row.environment, 80), householdId = text(row.householdId, 160), memberId = text(row.memberId, 160);
  if (!environment || !householdId || !memberId || (row.view !== "personal" && row.view !== "household")) return null;
  return { environment, householdId, memberId, view: row.view };
}

function decodeTarget(value: unknown): PlanDecisionDraftTarget | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>, lineId = text(row.lineId, 160);
  if (!lineId || (row.kind !== "line" && row.kind !== "new") || !["protect", "prepare", "build", "everyday"].includes(String(row.lens))) return null;
  return { kind: row.kind, lineId, lens: row.lens as PlanLens };
}

function decodeContext(value: unknown): PlanDecisionDraftContext | null {
  const identity = decodeIdentity(value);
  if (!identity) return null;
  const row = value as Record<string, unknown>, month = text(row.month, 7), selectionId = text(row.selectionId, 160), selectionRevision = text(row.selectionRevision, 512);
  if (!month || !/^\d{4}-\d{2}$/.test(month) || !selectionId || selectionRevision === null || !["draft", "scenario", "version"].includes(String(row.selectionKind))) return null;
  return { ...identity, month, selectionKind: row.selectionKind as PlanDecisionDraftContext["selectionKind"], selectionId, selectionRevision };
}

function decodeFields(value: unknown): PlanDecisionDraftFields | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const names = ["label", "amount", "source", "envelopeGoalId", "due", "funding", "target", "low", "high", "deadline", "paydays", "nextStep", "timeConstraint", "reopenWhen", "responsible"] as const;
  if (names.some(name => text(row[name]) === null)) return null;
  if (!["monthly", "weekly", "one-time"].includes(String(row.cadence))) return null;
  return {
    label: row.label as string, amount: row.amount as string, source: row.source as string, envelopeGoalId: row.envelopeGoalId as string,
    due: row.due as string, cadence: row.cadence as PlanLine["cadence"], funding: row.funding as string, target: row.target as string,
    low: row.low as string, high: row.high as string, deadline: row.deadline as string, paydays: row.paydays as string,
    nextStep: row.nextStep as string, timeConstraint: row.timeConstraint as string, reopenWhen: row.reopenWhen as string, responsible: row.responsible as string,
  };
}

function decodeDraft(value: unknown): PlanDecisionDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>, context = decodeContext(row.context), target = decodeTarget(row.target), fields = decodeFields(row.fields);
  const base = row.base as Record<string, unknown> | null;
  if (row.version !== 1 || !context || !target || !fields || !base || !Number.isSafeInteger(base.sourceRevision) || text(base.selectionRevision, 512) === null || !(base.lineFingerprint === null || text(base.lineFingerprint, 32 * 1024) !== null)) return null;
  return { version: 1, context, target, base: { sourceRevision: base.sourceRevision as number, selectionRevision: base.selectionRevision as string, lineFingerprint: base.lineFingerprint as string | null }, fields };
}

function readJson(storage: PlanDecisionDraftStorage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  if (raw.length > MAX_RECORD) throw new Error("PLAN_DECISION_DRAFT_TOO_LARGE");
  return JSON.parse(raw);
}

export function readPlanDecisionNavigation(storage: PlanDecisionDraftStorage, identity: PlanDecisionDraftIdentity): PlanDecisionNavigation | null {
  const value = readJson(storage, planDecisionNavigationKey(identity));
  if (value === null || !value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>, savedIdentity = decodeIdentity(row.identity), target = decodeTarget(row.target), month = text(row.month, 7), selectionId = text(row.selectionId, 160);
  const requestedIdentity = { environment: identity.environment, householdId: identity.householdId, memberId: identity.memberId, view: identity.view };
  if (row.version !== 1 || !savedIdentity || !same(savedIdentity, requestedIdentity) || !target || !month || !/^\d{4}-\d{2}$/.test(month) || !selectionId || !["draft", "scenario", "version"].includes(String(row.selectionKind))) throw new Error("PLAN_DECISION_NAVIGATION_INVALID");
  return { version: 1, identity: savedIdentity, month, selectionKind: row.selectionKind as PlanDecisionNavigation["selectionKind"], selectionId, target };
}

export function readPlanDecisionDraft(storage: PlanDecisionDraftStorage, context: PlanDecisionDraftContext, target: PlanDecisionDraftTarget): PlanDecisionDraft | null {
  const value = readJson(storage, planDecisionDraftKey(context, target));
  if (value === null) return null;
  const draft = decodeDraft(value);
  if (!draft) throw new Error("PLAN_DECISION_DRAFT_INVALID");
  const sameScope = draft.context.environment === context.environment && draft.context.householdId === context.householdId && draft.context.memberId === context.memberId && draft.context.view === context.view && draft.context.month === context.month && draft.context.selectionKind === context.selectionKind && draft.context.selectionId === context.selectionId;
  if (!sameScope || !same(draft.target, target)) throw new Error("PLAN_DECISION_DRAFT_INVALID");
  return draft;
}

export function savePlanDecisionDraft(storage: PlanDecisionDraftStorage, draft: PlanDecisionDraft): void {
  const decoded = decodeDraft(draft);
  if (!decoded) throw new Error("PLAN_DECISION_DRAFT_INVALID");
  storage.setItem(planDecisionDraftKey(draft.context, draft.target), JSON.stringify(draft));
  const navigation: PlanDecisionNavigation = { version: 1, identity: { environment: draft.context.environment, householdId: draft.context.householdId, memberId: draft.context.memberId, view: draft.context.view }, month: draft.context.month, selectionKind: draft.context.selectionKind, selectionId: draft.context.selectionId, target: draft.target };
  storage.setItem(planDecisionNavigationKey(navigation.identity), JSON.stringify(navigation));
}

export function clearPlanDecisionDraft(storage: PlanDecisionDraftStorage, context: PlanDecisionDraftContext, target: PlanDecisionDraftTarget): void {
  storage.removeItem(planDecisionDraftKey(context, target));
  const identity = { environment: context.environment, householdId: context.householdId, memberId: context.memberId, view: context.view };
  const navigation = readPlanDecisionNavigation(storage, identity);
  if (navigation && navigation.month === context.month && navigation.selectionKind === context.selectionKind && navigation.selectionId === context.selectionId && same(navigation.target, target)) storage.removeItem(planDecisionNavigationKey(identity));
}
