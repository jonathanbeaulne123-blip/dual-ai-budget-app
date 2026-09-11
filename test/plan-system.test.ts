import { describe, expect, it } from "vitest";
import {
  acknowledgeHouseholdPlan,
  appendPlanSitdownTurn,
  appendTrustedPlanHerculesTurn,
  activateScheduledPlans,
  currentPlanVersion,
  executeHerculesReadToolPlan,
  financialAuditHash,
  lockPersonalPlan,
  planAcknowledgementState,
  planDigest,
  proposeHouseholdPlan,
  savePlanDraft,
  setBudget,
  setHouseholdFundMonthPlan,
  savePlanReflection,
  splitForSync,
  updatePlanNudgeState,
  proposePlanBridge,
  savePlanBridgeDraft,
  sharePlanBridgeDraft,
  holdPlanBridge,
  declinePlanBridge,
  markPlanReflectionReviewed,
  planActivationInstant,
  withdrawPlanBridge,
  catalogHousehold,
  type Household,
  type PlanLine,
} from "../src/core/index.ts";
import { executeIntent } from "../src/ledgerSync/registry.ts";
import { ingestBooks, openMemoryBooks } from "../src/ledger/engine.ts";
import { extractMaterializationFacts } from "../src/ledger/materializeSnapshotFromEvents.ts";

const month = "2026-09";
const jonathan = "MEM-001";
const bianca = "MEM-002";

function line(createdBy = jonathan, label = "Rent", amountCents = 180_000): PlanLine {
  return { id: `LINE-${createdBy}-${label}`, lens: "protect", kind: "obligation", labelSnapshot: label, amountCents,
    cadence: "monthly", dueDate: "2026-09-01", responsibility: { kind: "joint" }, assumptionIds: [], createdBy };
}

function saveDraft(household: Household, scope: "personal" | "household", memberId = jonathan, lines = [line(memberId)]) {
  return savePlanDraft(household, { id: `DRAFT-${scope}-${memberId}`, scope, memberId, targetMonth: month, lines, assumptions: [], note: "private", createdBy: memberId }).household;
}

function proposedHousehold(household = catalogHousehold()) {
  const drafted = saveDraft(household, "household");
  return proposeHouseholdPlan(drafted, { memberId: jonathan, draftId: `DRAFT-household-${jonathan}`, reason: "First shared month", createdBy: jonathan }).household;
}

describe("Plan System V2 authority", () => {
  it("keeps Personal and pre-proposal Household drafts out of Shared and out of the partner replica", () => {
    let household = saveDraft(catalogHousehold(), "personal", jonathan, [line(jonathan, "Jonathan private amount", 12_345)]);
    household = saveDraft(household, "household", jonathan, [line(jonathan, "Unsubmitted household idea", 45_600)]);
    const mine = splitForSync(household, jonathan);
    const partner = splitForSync(household, bianca);
    expect(mine.personal.planDrafts).toHaveLength(2);
    expect(mine.shared).not.toHaveProperty("planDrafts");
    expect(partner.personal.planDrafts).toEqual([]);
    expect(JSON.stringify(partner)).not.toContain("Jonathan private amount");
    expect(JSON.stringify(partner)).not.toContain("Unsubmitted household idea");
  });

  it("activates only after Jonathan and Bianca acknowledge the exact immutable digest", () => {
    const proposed = proposedHousehold();
    const version = currentPlanVersion(proposed, "household", month)!;
    expect(planDigest(version)).toBe(version.digest);
    const first = acknowledgeHouseholdPlan(proposed, { planVersionId: version.id, expectedDigest: version.digest, memberId: jonathan, createdBy: jonathan }).household;
    expect(currentPlanVersion(first, "household", month)?.state).toBe("proposed");
    expect(planAcknowledgementState(first, version).complete).toBe(false);
    expect(() => acknowledgeHouseholdPlan(first, { planVersionId: version.id, expectedDigest: `${version.digest}-stale`, memberId: bianca, createdBy: bianca })).toThrow(/changed/i);
    const accepted = acknowledgeHouseholdPlan(first, { planVersionId: version.id, expectedDigest: version.digest, memberId: bianca, createdBy: bianca }).household;
    expect(currentPlanVersion(accepted, "household", month)?.state).toBe("active");
    expect(planAcknowledgementState(accepted, currentPlanVersion(accepted, "household", month)!).complete).toBe(true);
  });

  it("locks Personal versions privately and Plan-only work leaves the financial audit hash unchanged", async () => {
    const start = catalogHousehold();
    const before = await financialAuditHash(start);
    const drafted = saveDraft(start, "personal", jonathan, [line(jonathan, "Private future", 99_900)]);
    const locked = lockPersonalPlan(drafted, { memberId: jonathan, draftId: `DRAFT-personal-${jonathan}`, reason: "My month", createdBy: jonathan }).household;
    expect(currentPlanVersion(locked, "personal", month, jonathan)?.state).toBe("active");
    expect(splitForSync(locked, bianca).personal.planVersions).toEqual([]);
    expect(await financialAuditHash(locked)).toBe(before);
  });

  it("prevents legacy budget writes from bypassing a versioned month", () => {
    const governed = proposedHousehold();
    expect(() => setBudget(governed, { monthKey: month, subcategoryId: governed.categories.find((row) => row.recordType === "category")!.id, amount: 20 })).toThrow(/versioned Household Plan/);
  });

  it("does not trust client-supplied Fund agreement member IDs", () => {
    const household = catalogHousehold();
    if (!household.householdFund) return;
    const custodian = household.householdFund.custodianMemberId;
    const next = setHouseholdFundMonthPlan(household, { memberId: custodian, monthKey: month, target: 100, agreedByMemberIds: [jonathan, bianca] }).household;
    expect((next.fundMonthPlans ?? []).find((row) => row.monthKey === month)?.agreedByMemberIds).toEqual([custodian]);
  });

  it("keeps Household Hercules blind to private Plan labels", () => {
    const privateDraft = saveDraft(catalogHousehold(), "personal", jonathan, [line(jonathan, "SECRET PERSONAL CAPACITY", 76_543)]);
    const locked = lockPersonalPlan(privateDraft, { memberId: jonathan, draftId: `DRAFT-personal-${jonathan}`, reason: "private", createdBy: jonathan }).household;
    const run = executeHerculesReadToolPlan(locked, { calls: [{ name: "plan_overview", args: { monthKey: month } }] }, "2026-09-11", { memberId: bianca, view: "household", plan: { monthKey: month, scope: "household" } });
    expect(JSON.stringify(run)).not.toContain("SECRET PERSONAL CAPACITY");
    expect(run.results[0]?.status).toBe("empty");
  });

  it("projects Plan records into the forward-only PGlite schema", async () => {
    const household = proposedHousehold();
    const db = await openMemoryBooks();
    try {
      expect((await ingestBooks(db, household)).ok).toBe(true);
      expect((await db.query("SELECT id, scope, state FROM plan_versions")).rows).toEqual([
        { id: currentPlanVersion(household, "household", month)!.id, scope: "household", state: "proposed" },
      ]);
      expect((await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'plan_hercules_sessions'")).rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("includes Shared Plan authority records in compact command-event facts", () => {
    const household = proposedHousehold();
    const version = currentPlanVersion(household, "household", month)!;
    const facts = extractMaterializationFacts(household, [version.id], { ledgerScope: "shared", memberId: jonathan, commandKind: "proposeHouseholdPlan" });
    expect(facts.planVersions).toEqual([version]);
    expect(JSON.stringify(facts)).not.toContain("private");
  });

  it("does not copy a private draft identifier into the Shared Sitdown", () => {
    const household = saveDraft(catalogHousehold(), "household");
    const next = appendPlanSitdownTurn(household, {
      sitDownSessionId: `SITDOWN-${month}`,
      monthKey: month,
      planDraftId: `DRAFT-household-${jonathan}`,
      memberId: jonathan,
      text: "A shared talking point",
    }).household;
    expect(next.planHerculesSessions?.[0]?.planDraftId).toBe(`PLAN-SITDOWN-WORKING-${month}`);
    expect(JSON.stringify(splitForSync(next, jonathan).shared)).not.toContain(`DRAFT-household-${jonathan}`);
  });

  it("keeps reflection and nudge choices scoped while Bridge withdrawal remains self-owned", () => {
    const drafted = saveDraft(catalogHousehold(), "personal", jonathan);
    let household = lockPersonalPlan(drafted, { memberId: jonathan, draftId: `DRAFT-personal-${jonathan}`, reason: "My month", createdBy: jonathan }).household;
    const personal = currentPlanVersion(household, "personal", month, jonathan)!;
    household = savePlanReflection(household, { memberId: jonathan, planVersionId: personal.id, outcomes: [], note: "Private reflection", createdBy: jonathan }).household;
    household = updatePlanNudgeState(household, { memberId: jonathan, issueId: "finding-1", action: "dismiss", createdBy: jonathan }).household;
    expect(JSON.stringify(splitForSync(household, bianca))).not.toContain("Private reflection");
    expect(splitForSync(household, jonathan).personal.planCoachingPreferences?.[0]?.dismissedIssueIds).toEqual(["finding-1"]);
    household = proposePlanBridge(household, { monthKey: month, kind: "contribution", label: "I can cover one bill", amountCents: 5000, memberId: jonathan, createdBy: jonathan }).household;
    const decision = household.planBridgeDecisions?.at(-1)!;
    expect(() => withdrawPlanBridge(household, { decisionId: decision.id, memberId: bianca, createdBy: bianca })).toThrow(/Only you/);
    household = withdrawPlanBridge(household, { decisionId: decision.id, memberId: jonathan, createdBy: jonathan }).household;
    expect(household.planBridgeDecisions?.find((row) => row.id === decision.id)?.state).toBe("withdrawn");
  });

  it("keeps Bridge drafts private and lets the partner close a disclosed proposal with a reason", () => {
    let household = savePlanBridgeDraft(catalogHousehold(), { monthKey: month, kind: "contribution", label: "I can cover hydro",
      amountCents: 8000, memberId: jonathan, createdBy: jonathan }).household;
    const draft = household.planBridgeDrafts?.[0]!;
    expect(splitForSync(household, jonathan).personal.planBridgeDrafts).toHaveLength(1);
    expect(JSON.stringify(splitForSync(household, jonathan).shared)).not.toContain("I can cover hydro");
    household = sharePlanBridgeDraft(household, { draftId: draft.id, memberId: jonathan, createdBy: jonathan }).household;
    const decision = household.planBridgeDecisions?.[0]!;
    expect(household.planBridgeDrafts).toEqual([]);
    household = holdPlanBridge(household, { decisionId: decision.id, reason: "Talk on Sunday", expectedUpdatedAt: decision.updatedAt, memberId: bianca, createdBy: bianca }).household;
    const held = household.planBridgeDecisions?.[0]!;
    expect(held.state).toBe("held");
    household = declinePlanBridge(household, { decisionId: held.id, reason: "The target changed", expectedUpdatedAt: held.updatedAt, memberId: bianca, createdBy: bianca }).household;
    expect(household.planBridgeDecisions?.[0]).toMatchObject({ state: "declined", declinedByMemberId: bianca, declineReason: "The target changed" });
  });

  it("derives reflection actuals from accepted evidence and tracks independent review without a gate", () => {
    let household = proposedHousehold();
    const proposed = currentPlanVersion(household, "household", month)!;
    household = acknowledgeHouseholdPlan(household, { planVersionId: proposed.id, expectedDigest: proposed.digest, memberId: jonathan, createdBy: jonathan }).household;
    household = acknowledgeHouseholdPlan(household, { planVersionId: proposed.id, expectedDigest: proposed.digest, memberId: bianca, createdBy: bianca }).household;
    const version = currentPlanVersion(household, "household", month)!;
    household = savePlanReflection(household, { memberId: jonathan, planVersionId: version.id,
      outcomes: [{ planLineId: version.lines[0]!.id, status: "missed", actualCents: 999_999, transactionIds: [] }], note: "My view", createdBy: jonathan }).household;
    const reflection = household.planReflections?.find((row) => row.planVersionId === version.id)!;
    expect(reflection.outcomes[0]?.actualCents).toBe(0);
    expect(reflection.reviewedByMemberIds).toEqual([jonathan]);
    household = markPlanReflectionReviewed(household, { reflectionId: reflection.id, expectedUpdatedAt: reflection.updatedAt, memberId: bianca, createdBy: bianca }).household;
    expect(household.planReflections?.find((row) => row.id === reflection.id)?.reviewedByMemberIds.sort()).toEqual([bianca, jonathan].sort());
    expect(() => savePlanReflection(household, { memberId: jonathan, planVersionId: version.id, outcomes: [], note: "stale overwrite", createdBy: jonathan })).toThrow(/changed on another device/i);
    expect(currentPlanVersion(household, "household", month)?.state).toBe("active");
  });

  it("creates a durable future activation job and promotes it idempotently at the Toronto civil boundary", async () => {
    expect(new Date(planActivationInstant("2099-01-01")).toISOString()).toBe("2099-01-01T05:00:00.000Z");
    expect(new Date(planActivationInstant("2099-07-01")).toISOString()).toBe("2099-07-01T04:00:00.000Z");
    const future = "2099-01" as const;
    let household = savePlanDraft(catalogHousehold(), { id: "DRAFT-FUTURE", scope: "household", memberId: jonathan, targetMonth: future,
      lines: [{ ...line(), id: "LINE-FUTURE", dueDate: "2099-01-01" }], assumptions: [], note: "future", createdBy: jonathan }).household;
    household = proposeHouseholdPlan(household, { memberId: jonathan, draftId: "DRAFT-FUTURE", reason: "Future month", createdBy: jonathan }).household;
    const proposal = currentPlanVersion(household, "household", future)!;
    household = acknowledgeHouseholdPlan(household, { planVersionId: proposal.id, expectedDigest: proposal.digest, memberId: jonathan, createdBy: jonathan }).household;
    household = acknowledgeHouseholdPlan(household, { planVersionId: proposal.id, expectedDigest: proposal.digest, memberId: bianca, createdBy: bianca }).household;
    expect(currentPlanVersion(household, "household", future)?.state).toBe("scheduled");
    expect(household.planActivationJobs?.[0]?.state).toBe("pending");
    const before = await financialAuditHash(household);
    household = activateScheduledPlans(household, { asOf: "2099-01-01", eventId: "PLAN-CLOCK-1", createdAt: "2099-01-01T05:00:00.000Z" }).household;
    expect(currentPlanVersion(household, "household", future)).toMatchObject({ state: "active", activatedAt: "2099-01-01T05:00:00.000Z" });
    expect(household.planActivationJobs?.[0]).toMatchObject({ state: "completed", completedEventId: "PLAN-CLOCK-1" });
    expect(activateScheduledPlans(household, { asOf: "2099-01-01", eventId: "PLAN-CLOCK-2", createdAt: "2099-01-01T05:00:01.000Z" }).postedIds).toEqual([]);
    expect(await financialAuditHash(household)).toBe(before);
  });

  it("durably activates a scheduled Personal Plan only in its owner's replica", () => {
    const future = "2099-07" as const;
    let household = savePlanDraft(catalogHousehold(), { id: "DRAFT-PERSONAL-FUTURE", scope: "personal", memberId: jonathan, targetMonth: future,
      lines: [{ ...line(), id: "LINE-PERSONAL-FUTURE", dueDate: "2099-07-01" }], assumptions: [], note: "private future", createdBy: jonathan }).household;
    household = lockPersonalPlan(household, { memberId: jonathan, draftId: "DRAFT-PERSONAL-FUTURE", reason: "Private future month", createdBy: jonathan }).household;
    expect(currentPlanVersion(household, "personal", future, jonathan)?.state).toBe("scheduled");
    const result = activateScheduledPlans(household, { asOf: "2099-07-01", eventId: "PLAN-CLOCK-PERSONAL", createdAt: "2099-07-01T04:00:00.000Z",
      scope: "personal", memberId: jonathan });
    expect(result).toMatchObject({ persistenceScope: "member-personal", personalMemberId: jonathan });
    expect(currentPlanVersion(result.household, "personal", future, jonathan)?.state).toBe("active");
    expect(splitForSync(result.household, bianca).personal.planVersions).toEqual([]);
  });

  it("invalidates acknowledgement when an included Bridge proposal closes", () => {
    let household = savePlanBridgeDraft(catalogHousehold(), { monthKey: month, kind: "contribution", label: "I can cover hydro",
      amountCents: 8000, memberId: jonathan, createdBy: jonathan }).household;
    household = sharePlanBridgeDraft(household, { draftId: household.planBridgeDrafts![0]!.id, memberId: jonathan, createdBy: jonathan }).household;
    const bridge = household.planBridgeDecisions![0]!;
    household = savePlanDraft(household, { id: "DRAFT-BRIDGED", scope: "household", memberId: jonathan, targetMonth: month,
      lines: [{ ...line(), id: "LINE-BRIDGED", labelSnapshot: bridge.label, amountCents: bridge.amountCents!, responsibility: { kind: "member", memberId: jonathan },
        sourceReference: { type: "bridge", id: bridge.id } }], assumptions: [], note: "with bridge", createdBy: jonathan }).household;
    household = proposeHouseholdPlan(household, { memberId: jonathan, draftId: "DRAFT-BRIDGED", reason: "Use the disclosed offer", createdBy: jonathan }).household;
    const version = currentPlanVersion(household, "household", month)!;
    household = declinePlanBridge(household, { decisionId: bridge.id, reason: "We chose another route", expectedUpdatedAt: bridge.updatedAt, memberId: bianca, createdBy: bianca }).household;
    expect(() => acknowledgeHouseholdPlan(household, { planVersionId: version.id, expectedDigest: version.digest, memberId: jonathan, createdBy: jonathan })).toThrow(/Bridge commitment closed/i);
  });

  it("accepts only receipt-bound Hercules turns against the current Shared revision", () => {
    let household = appendPlanSitdownTurn(catalogHousehold(), { sitDownSessionId: "SITDOWN-T", monthKey: month,
      planDraftId: `PLAN-SITDOWN-WORKING-${month}`, memberId: jonathan, text: "What is protected?" }).household;
    const session = household.planHerculesSessions?.[0]!, memberTurn = session.turns[0]!;
    expect(() => appendTrustedPlanHerculesTurn(household, { sessionId: session.id, inReplyToTurnId: memberTurn.id, text: "Shared answer",
      sourceReferences: [], sourceRevision: household.revision - 1, receiptId: "receipt", responseHash: "a".repeat(64), provider: "test", createdAt: "2026-09-11T12:00:00.000Z" })).toThrow(/evidence changed/i);
    const accepted = appendTrustedPlanHerculesTurn(household, { sessionId: session.id, inReplyToTurnId: memberTurn.id, text: "Shared answer",
      sourceReferences: [], sourceRevision: household.revision, receiptId: "receipt", responseHash: "a".repeat(64), provider: "test", createdAt: "2026-09-11T12:00:00.000Z" });
    expect(accepted.household.planHerculesSessions?.[0]?.turns[1]).toMatchObject({ role: "hercules", inReplyToTurnId: memberTurn.id, receiptId: "receipt" });
    expect(appendTrustedPlanHerculesTurn(accepted.household, { sessionId: session.id, inReplyToTurnId: memberTurn.id, text: "Shared answer",
      sourceReferences: [], sourceRevision: accepted.household.revision, receiptId: "receipt", responseHash: "a".repeat(64), provider: "test", createdAt: "2026-09-11T12:00:01.000Z" }).postedIds).toEqual([]);
  });

  it("keeps clock activation and trusted Hercules authorship outside the client command registry", () => {
    const household = catalogHousehold();
    for (const command of ["activateScheduledPlans", "appendTrustedPlanHerculesTurn"])
      expect(() => executeIntent(household, command, [], jonathan, "forged-client-command")).toThrow(/dedicated authority/i);
  });
});
