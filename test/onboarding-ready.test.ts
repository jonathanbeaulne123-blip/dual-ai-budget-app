import { readySetup, acknowledge } from "./fixtures/onboarding-v2.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptHouseholdWrite,
  acceptedAccountOpeningCoverage,
  assembleHousehold,
  postEntry,
  approveOnboardingReady,
  buildDashboard,
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

function memberReadyView(memberId: string, readyComplete = true): Household {
  let household = readySetup(false);
  for (const actor of [BIANCA, JONATHAN]) {
    if (actor !== memberId || readyComplete) household = acknowledge(household, actor, "ch-12-ready");
  }
  return household;
}

describe("onboarding Chapter 12 Ready", () => {
  beforeEach(() => { vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(new Date("2026-09-08T15:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("keeps correction Practice outside every accepted projection and makes any copy a review-only draft", async () => {
    const household = memberReadyView(BIANCA, false);
    const transactions = structuredClone(household.transactions);
    const sharedTransactions = structuredClone(splitForSync(household, BIANCA).shared.transactions);
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
      sharedTransactions,
    );
    expect(proof.persistedIds).toEqual([]);
    expect(draft).toMatchObject({ requiresReviewAndConfirm: true, amountCents: 4500, practiceReceiptId: proof.receiptId });
    expect(draft).not.toHaveProperty("id");
  });

  it("requires a valid discarded Practice proof and shares only its acceptance", async () => {
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
    expect(accepted.persistenceScope).not.toBe("member-personal");
    expect(JSON.stringify(splitForSync(accepted.household, BIANCA).shared)).not.toContain(proof.receiptId);
    expect(householdGatesOutstanding(accepted.household)).toEqual([]);

    const forged = { ...proof, persistedIds: ["TXN-FORGED"] } as never;
    expect(() => recordChapterAcknowledgement(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      chapterId: "ch-12-ready",
      today: TODAY,
      practiceProof: forged,
    })).toThrow(/Practice entry and correction/);
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
    const privatePurchase = postEntry(biancaView, { createdBy: BIANCA, visibility: "personal", date: TODAY,
      type: "expense", amount: "2.00", accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES" }).household;
    expect(onboardingCompletionDigest(privatePurchase)).toBe(digest);
    for (const memberId of [BIANCA,JONATHAN]) {
      const replica=splitForSync(privatePurchase,memberId);
      expect(onboardingCompletionDigest(assembleHousehold(replica.shared,replica.personal))).toBe(digest);
    }
    const privateReversalReference = structuredClone(biancaView);
    const opening = privateReversalReference.transactions.find(t=>t.type==="opening")!;
    privateReversalReference.transactions.push({...opening,id:"TXN-PRIVATE-REFERENCE",source:"reversal",
      visibility:"personal",createdBy:BIANCA,reversalOfId:opening.id});
    expect(acceptedAccountOpeningCoverage(privateReversalReference,{visibility:"household"})).toEqual(
      acceptedAccountOpeningCoverage(biancaView,{visibility:"household"}));
    expect(onboardingCompletionDigest(privateReversalReference)).toBe(digest);

    const withRoutineSharedChange = structuredClone(biancaView);
    withRoutineSharedChange.transactions.push({ ...withRoutineSharedChange.transactions[0]!, id: "TXN-ROUTINE-SHARED", type: "expense", source: "manual" });
    expect(onboardingCompletionDigest(withRoutineSharedChange)).toBe(digest);

    const withSetupChange = structuredClone(biancaView);
    withSetupChange.accounts[0] = { ...withSetupChange.accounts[0]!, name: "Changed after Ready" };
    expect(onboardingCompletionDigest(withSetupChange)).not.toBe(digest);
  });

  it("blocks Ready and unlock while any household gate is outstanding", () => {
    const household = memberReadyView(BIANCA);
    household.onboardingAttestations = household.onboardingAttestations!.filter(fact =>
      !(fact.memberId === BIANCA && fact.requirementId === "ch-04-accounts"));
    const digest = onboardingCompletionDigest(household);
    expect(householdGatesOutstanding(household)).toEqual(["ch-04-accounts"]);
    expect(() => approveOnboardingReady(household, {
      memberId: BIANCA, createdBy: BIANCA, digest,
    })).toThrow(/Finish every setup check/);
    expect(() => completeHouseholdOnboarding(household, {
      memberId: BIANCA, createdBy: BIANCA,
    })).toThrow(/Both members must finish/);
  });

  it("refuses Ready approval when the actor's Chapter 12 proof was invalidated", async () => {
    const previous = memberReadyView(BIANCA);
    const candidate = approveOnboardingReady(previous, {
      memberId: BIANCA, createdBy: BIANCA, digest: onboardingCompletionDigest(previous),
    });
    const fact = previous.onboardingAttestations!.find(f => f.memberId === BIANCA && f.requirementId === "ch-12-ready")!;
    previous.onboardingAttestationInvalidations = [{ attestationId: fact.id, invalidatedAt: new Date().toISOString() }];
    candidate.household.onboardingAttestationInvalidations = previous.onboardingAttestationInvalidations;
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: candidate.household,
      postedIds: candidate.postedIds,
      commandKind: "approveOnboardingReady",
      actingMemberId: BIANCA,
      adapters: {
        ingest: async () => ({ ok: true }),
        persist: async () => undefined,
      },
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.errorClass).toBe("validation-rejected");
  });

  it("requires both independently accepted approvals, then records one atomic unlock", () => {
    const biancaView = memberReadyView(BIANCA);
    const digest = onboardingCompletionDigest(biancaView);
    const biancaApproved = approveOnboardingReady(biancaView, {
      memberId: BIANCA, createdBy: BIANCA, digest,
    }).household;
    expect(householdGatesOutstanding(biancaApproved)).toEqual([]);
    const bothApproved = approveOnboardingReady(biancaApproved, {
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
