import { describe, expect, it } from "vitest";
import type { PlanLine } from "../src/core/index.ts";
import { clearPlanDecisionDraft, planDecisionDraftHasConflict, readPlanDecisionDraft, readPlanDecisionNavigation, savePlanDecisionDraft, type PlanDecisionDraft, type PlanDecisionDraftContext, type PlanDecisionDraftFields, type PlanDecisionDraftStorage } from "../src/planDecisionDraft.ts";

class MemoryStorage implements PlanDecisionDraftStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const context = (overrides: Partial<PlanDecisionDraftContext> = {}): PlanDecisionDraftContext => ({ environment: "development", householdId: "HH-1", memberId: "MEM-1", view: "personal", month: "2026-09", selectionKind: "draft", selectionId: "DRAFT-1", selectionRevision: "2026-09-19T10:00:00.000Z", ...overrides });
const line: PlanLine = { id: "LINE-1", lens: "prepare", kind: "true-expense", labelSnapshot: "Winter tires", amountCents: 12500, cadence: "monthly", dueDate: "2026-09-30", responsibility: { kind: "member", memberId: "MEM-1" }, assumptionIds: [], createdBy: "MEM-1" };
const fields: PlanDecisionDraftFields = { label: "Winter tires and rims", amount: "125", source: "", envelopeGoalId: "", due: "2026-09-30", cadence: "monthly", funding: "", target: "900", low: "", high: "", deadline: "2026-11-01", paydays: "", nextStep: "Request another quote", timeConstraint: "", reopenWhen: "The quote changes", responsible: "MEM-1" };
const record = (scope = context(), lineValue = line): PlanDecisionDraft => ({ version: 1, context: scope, target: { kind: "line", lineId: lineValue.id, lens: lineValue.lens }, base: { sourceRevision: 8, selectionRevision: scope.selectionRevision, lineFingerprint: JSON.stringify(lineValue) }, fields });

describe("Plan decision editor recovery", () => {
  it("keeps exact input in its environment, household, member, view, month, selection and line scope", () => {
    const storage = new MemoryStorage(), saved = record();
    savePlanDecisionDraft(storage, saved);
    expect(readPlanDecisionDraft(storage, context(), saved.target)?.fields).toEqual(fields);
    expect(readPlanDecisionDraft(storage, context({ memberId: "MEM-2" }), saved.target)).toBeNull();
    expect(readPlanDecisionDraft(storage, context({ view: "household" }), saved.target)).toBeNull();
    expect(readPlanDecisionDraft(storage, context({ month: "2026-10" }), saved.target)).toBeNull();
    expect(readPlanDecisionDraft(storage, context({ selectionKind: "scenario", selectionId: "SCENARIO-1" }), saved.target)).toBeNull();
  });

  it("returns preserved input but identifies a newer source, selection revision, or exact line", () => {
    const storage = new MemoryStorage(), saved = record();
    savePlanDecisionDraft(storage, saved);
    const changedContext = context({ selectionRevision: "2026-09-19T11:00:00.000Z" });
    const recovered = readPlanDecisionDraft(storage, changedContext, saved.target)!;
    expect(recovered.fields.label).toBe("Winter tires and rims");
    expect(planDecisionDraftHasConflict(recovered, { sourceRevision: 8, selectionRevision: changedContext.selectionRevision, line })).toBe(true);
    expect(planDecisionDraftHasConflict(recovered, { sourceRevision: 9, selectionRevision: recovered.base.selectionRevision, line })).toBe(true);
    expect(planDecisionDraftHasConflict(recovered, { sourceRevision: 8, selectionRevision: recovered.base.selectionRevision, line: { ...line, amountCents: 15000 } })).toBe(true);
    expect(planDecisionDraftHasConflict(recovered, { sourceRevision: 8, selectionRevision: recovered.base.selectionRevision, line })).toBe(false);
  });

  it("clears only the completed or cancelled editor and does not erase another active line", () => {
    const storage = new MemoryStorage(), first = record(), second = { ...record(), target: { kind: "new" as const, lineId: "LINE-2", lens: "prepare" as const }, fields: { ...fields, label: "Insurance renewal" } };
    savePlanDecisionDraft(storage, first);
    savePlanDecisionDraft(storage, second);
    clearPlanDecisionDraft(storage, first.context, first.target);
    expect(readPlanDecisionDraft(storage, first.context, first.target)).toBeNull();
    expect(readPlanDecisionDraft(storage, second.context, second.target)?.fields.label).toBe("Insurance renewal");
    expect(readPlanDecisionNavigation(storage, second.context)?.target).toEqual(second.target);
    clearPlanDecisionDraft(storage, second.context, second.target);
    expect(readPlanDecisionNavigation(storage, second.context)).toBeNull();
  });
});
