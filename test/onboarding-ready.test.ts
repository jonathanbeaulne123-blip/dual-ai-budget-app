import { describe, expect, it } from "vitest";
import {
  acceptHouseholdWrite,
  approveOnboardingReady,
  assembleHousehold,
  buildDashboard,
  catalogHousehold,
  completeHouseholdOnboarding,
  compileHousehold,
  emptyMemberOnboardingProgress,
  financialAuditHash,
  householdGatesOutstanding,
  mergeHouseholdOnboarding,
  onboardingCompletionDigest,
  onboardingReadyPresentation,
  ordinaryHerculesAvailable,
  practiceProofToRealDraft,
  recordChapterAcknowledgement,
  runHealthCheck,
  runMonthRehearsalCorrectionPractice,
  shiftPostingStreak,
  splitForSync,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-05" as const;
const AT = "2026-09-05T14:00:00.000Z";

function activeRecord(household: Household) {
  return {
    id: `ONBOARDING-${household.environment}-${household.householdId}`,
    environment: household.environment,
    householdId: household.householdId,
    registryVersion: 1,
    state: "active" as const,
    proposedByMemberId: BIANCA,
    proposedAt: "2026-09-05T13:45:00.000Z",
    handshakeExpiresAt: "2026-09-05T14:00:00.000Z",
    confirmedByMemberIds: [BIANCA, JONATHAN],
    startedAt: AT,
    stoppedAt: null,
    stoppedByMemberIds: [],
    stoppedSolo: false,
    forcedUnlock: false,
    completedAt: null,
    completionDigest: null,
    createdAt: "2026-09-05T13:45:00.000Z",
    updatedAt: AT,
  };
}

function memberReadyView(memberId: string, readyComplete = true, source?: Household): Household {
  const household = source ? structuredClone(source) : catalogHousehold("development");
  household.householdOnboarding = activeRecord(household);
  const progress = emptyMemberOnboardingProgress({
    environment: household.environment,
    householdId: household.householdId,
    memberId,
  });
  progress.rows = progress.rows.map((row) => ({
    ...row,
    acknowledgedAt: row.chapterId === "ch-12-ready" && !readyComplete ? null : AT,
    lastSafeResumePoint: row.chapterId === "ch-12-ready" && !readyComplete ? "ch-11-plan" : row.chapterId,
  }));
  progress.updatedAt = AT;
  household.members = household.members.map((member) => member.id === memberId
    ? { ...member, onboardingProgress: progress }
    : { ...member, onboardingProgress: undefined });
  return household;
}

describe("onboarding Chapter 12 Ready", () => {
  it("keeps correction Practice outside every accepted projection and makes any copy a review-only draft", async () => {
    const household = memberReadyView(BIANCA, false);
    const transactions = structuredClone(household.transactions);
    const journal = compileHousehold(household);
    const dashboard = buildDashboard(household, TODAY);
    const health = runHealthCheck(household);
    const streak = shiftPostingStreak(household, TODAY);
    const audit = await financialAuditHash(household);

    const proof = await runMonthRehearsalCorrectionPractice({ date: TODAY, memberId: BIANCA });
    const draft = practiceProofToRealDraft(proof);

    expect(household.transactions).toEqual(transactions);
    expect(compileHousehold(household)).toEqual(journal);
    expect(buildDashboard(household, TODAY)).toEqual(dashboard);
    expect(runHealthCheck(household)).toEqual(health);
    expect(shiftPostingStreak(household, TODAY)).toEqual(streak);
    expect(await financialAuditHash(household)).toBe(audit);
    expect(splitForSync(household, BIANCA).shared.transactions).toEqual(
      splitForSync(memberReadyView(BIANCA, false), BIANCA).shared.transactions,
    );
    expect(proof.persistedIds).toEqual([]);
    expect(draft).toMatchObject({ requiresReviewAndConfirm: true, amountCents: 4500, practiceReceiptId: proof.receiptId });
    expect(draft).not.toHaveProperty("id");
  });

  it("accepts either privacy-safe real evidence or a valid discarded Practice proof", async () => {
    const household = memberReadyView(BIANCA, false);
    const proof = await runMonthRehearsalCorrectionPractice({ date: TODAY, memberId: BIANCA });
    const accepted = recordChapterAcknowledgement(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      chapterId: "ch-12-ready",
      today: TODAY,
      practiceProof: proof,
      at: AT,
    });
    expect(accepted.persistenceScope).toBe("member-personal");
    expect(householdGatesOutstanding(accepted.household)).toEqual([]);

    const forged = { ...proof, persistedIds: ["TXN-FORGED"] } as never;
    expect(() => recordChapterAcknowledgement(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      chapterId: "ch-12-ready",
      today: TODAY,
      practiceProof: forged,
    })).toThrow(/Post one real entry, or finish the discarded Practice correction/);
  });

  it("shows one Ready approval as waiting-member and never includes Personal evidence in the digest", () => {
    const biancaView = memberReadyView(BIANCA);
    const digest = onboardingCompletionDigest(biancaView);
    const approved = approveOnboardingReady(biancaView, {
      memberId: BIANCA,
      createdBy: BIANCA,
      digest,
    }).household;
    const presentation = onboardingReadyPresentation(approved, BIANCA, TODAY);
    expect(presentation).toMatchObject({ viewerApproved: true, bothApproved: false, waitingMemberName: "Jonathan" });

    const withPrivateChange = structuredClone(biancaView);
    withPrivateChange.transactions.push({ ...withPrivateChange.transactions[0]!, id: "TXN-PRIVATE-ONLY", visibility: "personal", createdBy: BIANCA });
    expect(onboardingCompletionDigest(withPrivateChange)).toBe(digest);

    const withRoutineSharedChange = structuredClone(biancaView);
    withRoutineSharedChange.transactions.push({ ...withRoutineSharedChange.transactions[0]!, id: "TXN-ROUTINE-SHARED", type: "expense", source: "manual" });
    expect(onboardingCompletionDigest(withRoutineSharedChange)).toBe(digest);

    const withSetupChange = structuredClone(biancaView);
    withSetupChange.accounts[0] = { ...withSetupChange.accounts[0]!, name: "Changed after Ready" };
    expect(onboardingCompletionDigest(withSetupChange)).not.toBe(digest);
  });

  it("blocks Ready and unlock while any household gate is outstanding", () => {
    const household = memberReadyView(BIANCA);
    household.members[0]!.onboardingProgress!.rows = household.members[0]!.onboardingProgress!.rows.map((row) => (
      row.chapterId === "ch-06-fund" ? { ...row, acknowledgedAt: null } : row
    ));
    const digest = onboardingCompletionDigest(household);
    expect(householdGatesOutstanding(household)).toEqual(["ch-06-fund"]);
    expect(() => approveOnboardingReady(household, {
      memberId: BIANCA, createdBy: BIANCA, digest,
    })).toThrow(/Finish every setup check/);
    expect(() => completeHouseholdOnboarding(household, {
      memberId: BIANCA, createdBy: BIANCA,
    })).toThrow(/Both members must finish/);
  });

  it("requires both independently accepted approvals, then records one atomic unlock", () => {
    const biancaView = memberReadyView(BIANCA);
    const jonathanView = memberReadyView(JONATHAN, true, biancaView);
    const digest = onboardingCompletionDigest(biancaView);
    const biancaApproved = approveOnboardingReady(biancaView, {
      memberId: BIANCA, createdBy: BIANCA, digest,
    }).household;
    const sharedAfterBianca = splitForSync(biancaApproved, BIANCA).shared;
    const jonathanPersonal = splitForSync(jonathanView, JONATHAN).personal;
    expect(jonathanPersonal.onboardingProgress?.rows.every((row) => Boolean(row.acknowledgedAt))).toBe(true);
    const jonathanLocal = assembleHousehold(sharedAfterBianca, jonathanPersonal);
    expect(jonathanLocal.members.find((member) => member.id === JONATHAN)?.onboardingProgress).toBeTruthy();
    expect(householdGatesOutstanding(jonathanLocal)).toEqual([]);
    const bothApproved = approveOnboardingReady(jonathanLocal, {
      memberId: JONATHAN, createdBy: JONATHAN, digest,
    }).household;
    const complete = completeHouseholdOnboarding(bothApproved, {
      memberId: JONATHAN, createdBy: JONATHAN, at: "2026-09-05T14:05:00.000Z",
    }).household;

    expect(complete.householdOnboarding).toMatchObject({
      state: "complete",
      completionDigest: digest,
      completedAt: "2026-09-05T14:05:00.000Z",
    });
    expect(ordinaryHerculesAvailable(complete)).toBe(true);
  });

  it("converges an accepted completion record over an interrupted active replica", () => {
    const active = memberReadyView(BIANCA);
    const digest = onboardingCompletionDigest(active);
    const completeRecord = {
      ...active.householdOnboarding!,
      state: "complete" as const,
      completedAt: "2026-09-05T14:05:00.000Z",
      completionDigest: digest,
      updatedAt: "2026-09-05T14:05:00.000Z",
    };
    const merged = mergeHouseholdOnboarding(active.householdOnboarding, completeRecord, active);
    expect(merged).toMatchObject({ state: "complete", completionDigest: digest });
    expect(ordinaryHerculesAvailable({ ...active, householdOnboarding: merged })).toBe(true);
  });

  it("rejects a forged completion at the accepted-write boundary", async () => {
    const previous = memberReadyView(BIANCA);
    const candidate = structuredClone(previous);
    candidate.householdOnboarding = {
      ...candidate.householdOnboarding!,
      state: "complete",
      completedAt: "2026-09-05T14:05:00.000Z",
      completionDigest: onboardingCompletionDigest(previous),
      updatedAt: "2026-09-05T14:05:00.000Z",
    };
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate,
      postedIds: [candidate.householdOnboarding.id],
      commandKind: "completeHouseholdOnboarding",
      actingMemberId: BIANCA,
      adapters: {
        ingest: async () => ({ ok: true }),
        persist: async () => undefined,
      },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.errorClass).toBe("validation-rejected");
  });

  it("accepts both legitimate Ready approvals and the exact completion transition at the write boundary", async () => {
    let household = memberReadyView(BIANCA);
    const jonathanProgress = emptyMemberOnboardingProgress({
      environment: household.environment,
      householdId: household.householdId,
      memberId: JONATHAN,
    });
    jonathanProgress.rows = jonathanProgress.rows.map((row) => ({ ...row, acknowledgedAt: AT }));
    household.members = household.members.map((member) => member.id === JONATHAN
      ? { ...member, onboardingProgress: jonathanProgress }
      : member);
    const adapters = {
      ingest: async () => ({ ok: true as const }),
      persist: async () => undefined,
    };

    for (const memberId of [BIANCA, JONATHAN]) {
      const candidate = approveOnboardingReady(household, {
        memberId,
        createdBy: memberId,
        digest: onboardingCompletionDigest(household),
      });
      const accepted = await acceptHouseholdWrite({
        previous: household,
        candidate: candidate.household,
        postedIds: candidate.postedIds,
        commandKind: "approveOnboardingReady",
        actingMemberId: memberId,
        adapters,
      });
      expect(accepted.ok).toBe(true);
      household = accepted.household;
    }

    const candidate = completeHouseholdOnboarding(household, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      at: "2026-09-05T14:05:00.000Z",
    });
    const accepted = await acceptHouseholdWrite({
      previous: household,
      candidate: candidate.household,
      postedIds: candidate.postedIds,
      commandKind: "completeHouseholdOnboarding",
      actingMemberId: JONATHAN,
      adapters,
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.household.householdOnboarding?.state).toBe("complete");
  });
});
