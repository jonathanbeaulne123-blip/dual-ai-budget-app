import { describe, expect, it } from 'vitest';
import {
  acceptReviewedAccountHistory, acceptedAccountOpeningCoverage, acceptedHouseholdOnboarding,
  addAccount, adoptFirstBudget, approveOnboardingProposal, approveOnboardingReady,
  assembleHousehold, booksEquation, buildProposal, catalogHousehold, compileHousehold,
  completeHouseholdOnboarding, confirmHouseholdOnboarding, foundHouseholdCharter,
  householdGatesOutstanding, memberRequirementSatisfied, onboardingCompletionDigest,
  prepareAccountHistoryReview, proposeHouseholdOnboarding, recordChapterAcknowledgement,
  recordObservedChapterCompletion, requiredHouseholdChapters, runMonthRehearsalCorrectionPractice,
  signHouseholdCharter, splitForSync, submitOnboardingCategories, submitOnboardingEstimates,
  todayKey, updateAccount, type CommitResult, type CorrectionPracticeProof, type Household,
} from '../src/core/index.ts';
import { capturedIntent, clearCapturedIntent } from '../src/ledgerSync/capture.ts';
import { commandFromCapture, type LedgerCommand, type Scope } from '../src/ledgerSync/protocol.ts';
import { prepareCommand, type AuthorityState } from '../src/ledgerSync/authority.ts';

const A = 'MEM-001', B = 'MEM-002', MEMBERS = [A, B] as const;

/** Only the already authenticated membership and starter category catalog are fixtures.
 * No onboarding/Charter/accepted financial/progress fact is seeded. Google OAuth and
 * actual device paint are outside this domain+transport regression's claims. */
function isolatedPrincipals() {
  const seed = catalogHousehold('development');
  seed.accounts = [];
  seed.transactions = [];
  seed.shifts = [];
  seed.workJobs = [];
  seed.recurrences = [];
  seed.budgetPlans = [];
  seed.householdFund = null;
  seed.charter = null;
  seed.commandReceipts = [];
  const one = splitForSync(seed, A), two = splitForSync(seed, B);
  let state: AuthorityState = {
    sequence: seed.revision,
    shared: one.shared,
    personal: new Map([[A, one.personal], [B, two.personal]]),
  };
  const acceptedKinds: string[] = [];
  const scope = (memberId: string): Scope => ({
    environment: seed.environment, householdId: seed.householdId, memberId,
    subject: `authenticated-subject-${memberId}`, role: 'owner',
    expires: Date.now() + 120_000, aclEpoch: 1,
  });
  // Every read is a fresh serialized replica containing only this actor's envelope.
  const reload = (memberId: string) => {
    const household = assembleHousehold(
      structuredClone(state.shared), structuredClone(state.personal.get(memberId)), { linked: true },
    );
    expect(household.members.find(m => m.id !== memberId)?.onboardingProgress).toBeUndefined();
    clearCapturedIntent(household);
    return household;
  };
  const compile = async (memberId: string, action: (h: Household) => CommitResult) => {
    const preview = action(reload(memberId));
    const capture = capturedIntent(preview.household);
    expect(capture?.steps.length).toBe(1);
    return commandFromCapture(capture!, scope(memberId), crypto.randomUUID());
  };
  const accept = async (memberId: string, command: LedgerCommand) => {
    const label = `${memberId}: ${command.steps.map(step => step.kind).join(', ')}`;
    let result;
    try { result = await prepareCommand(state, command, scope(memberId), () => {}); }
    catch (error) { throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
    state = {
      sequence: result.receipt.sequence, shared: result.shared,
      personal: new Map([...state.personal, [memberId, result.personal]]),
    };
    acceptedKinds.push(...command.steps.map(step => step.kind));
    for (const actor of MEMBERS) {
      const device = reload(actor);
      expect(booksEquation(compileHousehold(device)).holds, label).toBe(true);
      expect(device.householdFund, label).toBeFalsy();
      expect(device.recurrences, label).toHaveLength(0);
      expect(device.workJobs, label).toHaveLength(0);
      expect(device.accounts.some(account => account.kind === 'credit'), label).toBe(false);
    }
    expect(JSON.stringify(state.shared), label).not.toContain('PRACTICE-');
    return reload(memberId);
  };
  return {
    reload, compile, accept, acceptedKinds,
    step: async (memberId: string, action: (h: Household) => CommitResult) => accept(memberId, await compile(memberId, action)),
  };
}

describe('complete onboarding through two isolated v2 principals', () => {
  it('accepts every required step, explicit zero, independent plan/Practice/Ready, and rejects stale consent', async () => {
    const journey = isolatedPrincipals(), today = todayKey(), monthKey = today.slice(0, 7);
    const proofs = new Map<string, CorrectionPracticeProof>();
    const acknowledge = (memberId: string, chapterId: string) => journey.step(memberId, h => (
      chapterId === 'ch-02-household'
        ? recordObservedChapterCompletion(h, {
          memberId, createdBy: memberId, chapterId,
          observation: { kind: 'resolved', scope: { environment: h.environment, householdId: h.householdId, memberId },
            currentMemberId: memberId, seatMemberIds: [...MEMBERS], observedAt: new Date().toISOString() },
        })
        : recordChapterAcknowledgement(h, { memberId, createdBy: memberId, chapterId,
          ...(chapterId === 'ch-12-ready' ? { today, practiceProof: proofs.get(memberId)! } : {}) })
    ));
    const acknowledgeBoth = async (chapterId: string) => {
      for (const memberId of MEMBERS) await acknowledge(memberId, chapterId);
      for (const actor of MEMBERS) for (const memberId of MEMBERS) {
        expect(memberRequirementSatisfied(journey.reload(actor), memberId, chapterId), `${actor} sees ${memberId}/${chapterId}`).toBe(true);
      }
    };

    await journey.step(A, h => proposeHouseholdOnboarding(h, { memberId: A }));
    await journey.step(B, h => confirmHouseholdOnboarding(h, { memberId: B }));
    await acknowledgeBoth('ch-01-meet');
    await acknowledgeBoth('ch-02-household');
    await journey.step(B, h => foundHouseholdCharter(h, {
      memberId: B, custodianMemberId: A, purpose: 'Our roof and groceries.', splitRule: 'remainder',
      splitNote: 'Together', ceilingKind: 'none', cadence: 'weekly', cadenceWeekday: 0, date: today,
    }));
    await journey.step(A, h => signHouseholdCharter(h, { memberId: A }));
    await journey.step(B, h => signHouseholdCharter(h, { memberId: B }));
    await acknowledgeBoth('ch-03-charter');
    await journey.step(A, h => addAccount(h, { name: 'Shared Chequing', kind: 'chequing', ownerMemberId: 'joint', scope: 'shared' }));
    await acknowledgeBoth('ch-04-accounts');
    const accountId = journey.reload(A).accounts[0]!.id;
    await journey.step(A, h => acceptReviewedAccountHistory(h, {
      createdBy: A, confirmationId: crypto.randomUUID(), review: prepareAccountHistoryReview(h, {
        createdBy: A, visibility: 'household', accounts: [{ accountId, openingDate: today, openingBalanceCents: 0,
          closingDate: today, closingBalanceCents: 0 }], rows: [],
      }),
    }));
    expect(journey.reload(A).transactions).toHaveLength(0);
    for (const actor of MEMBERS) expect(acceptedAccountOpeningCoverage(journey.reload(actor), { visibility: 'household' }).complete).toBe(true);
    await acknowledgeBoth('ch-05-opening');

    for (const memberId of MEMBERS) await journey.step(memberId, h => submitOnboardingCategories(h, {
      memberId, createdBy: memberId, categoryIds: ['SUB-FOOD-GROCERIES'],
    }));
    await acknowledgeBoth('ch-09-categories');
    for (const memberId of MEMBERS) await journey.step(memberId, h => submitOnboardingEstimates(h, {
      memberId, createdBy: memberId, estimates: [{ subcategoryId: 'SUB-FOOD-GROCERIES', amountCents: memberId === A ? 40000 : 50000 }],
    }));
    await acknowledgeBoth('ch-10-estimates');
    const proposal = buildProposal(journey.reload(A), monthKey, today);
    for (const actor of MEMBERS) expect(buildProposal(journey.reload(actor), monthKey, today).sourceDigest).toBe(proposal.sourceDigest);
    await journey.step(A, h => approveOnboardingProposal(h, { memberId: A, createdBy: A, digest: proposal.sourceDigest }));
    expect(() => adoptFirstBudget(journey.reload(A), { memberId: A, createdBy: A, monthKey, proposalDigest: proposal.sourceDigest })).toThrow();
    await journey.step(B, h => approveOnboardingProposal(h, { memberId: B, createdBy: B, digest: proposal.sourceDigest }));
    await journey.step(A, h => adoptFirstBudget(h, { memberId: A, createdBy: A, monthKey, proposalDigest: proposal.sourceDigest }));
    await acknowledgeBoth('ch-11-plan');

    proofs.set(A, await runMonthRehearsalCorrectionPractice({ memberId: A, date: today }));
    await acknowledge(A, 'ch-12-ready');
    const firstProofDigest = onboardingCompletionDigest(journey.reload(A));
    expect(() => approveOnboardingReady(journey.reload(A), { memberId: A, createdBy: A, digest: firstProofDigest })).toThrow(/every setup check/);
    proofs.set(B, await runMonthRehearsalCorrectionPractice({ memberId: B, date: today }));
    await acknowledge(B, 'ch-12-ready');
    const reviewedDigest = onboardingCompletionDigest(journey.reload(A));
    expect(reviewedDigest).not.toBe(firstProofDigest);
    expect(onboardingCompletionDigest(journey.reload(B))).toBe(reviewedDigest);
    for (const actor of MEMBERS) {
      expect(householdGatesOutstanding(journey.reload(actor))).toEqual([]);
      expect(journey.reload(actor).transactions).toHaveLength(0);
    }
    // Capture the visible version, then let the other principal change its meaning.
    const queuedApproval = await journey.compile(A, h => approveOnboardingReady(h, { memberId: A, createdBy: A, digest: reviewedDigest }));
    const originalName = journey.reload(A).accounts[0]!.name;
    await journey.step(B, h => updateAccount(h, { accountId, name: 'Account changed while approval queued' }));
    await expect(journey.accept(A, queuedApproval)).rejects.toThrow(/BUSINESS_PRECONDITION_CHANGED/);
    await journey.step(B, h => updateAccount(h, { accountId, name: originalName }));
    for (const actor of MEMBERS) {
      expect(onboardingCompletionDigest(journey.reload(actor))).not.toBe(reviewedDigest);
      expect(memberRequirementSatisfied(journey.reload(actor), A, 'ch-04-accounts')).toBe(false);
    }
    // Restoring old values cannot revive revoked proof or the old Ready approval.
    for (const chapter of requiredHouseholdChapters()) {
      for (const actor of MEMBERS) if (!memberRequirementSatisfied(journey.reload(actor), actor, chapter.id)) await acknowledge(actor, chapter.id);
    }
    const finalDigest = onboardingCompletionDigest(journey.reload(A));
    expect(finalDigest).not.toBe(reviewedDigest);
    for (const memberId of MEMBERS) await journey.step(memberId, h => approveOnboardingReady(h, { memberId, createdBy: memberId, digest: finalDigest }));
    await journey.step(B, h => completeHouseholdOnboarding(h, { memberId: B, createdBy: B }));
    for (const actor of MEMBERS) {
      const reopened = journey.reload(actor);
      expect(acceptedHouseholdOnboarding(reopened)).toMatchObject({ state: 'complete', completionDigest: finalDigest });
      expect(householdGatesOutstanding(reopened)).toEqual([]);
      expect(reopened.transactions).toHaveLength(0);
      expect(reopened.members.find(m => m.id === actor)?.onboardingProgress?.practiceProof?.receiptId).toBe(proofs.get(actor)!.receiptId);
      expect(reopened.members.find(m => m.id !== actor)?.onboardingProgress).toBeUndefined();
    }
    expect(journey.acceptedKinds).toEqual(expect.arrayContaining([
      'proposeHouseholdOnboarding', 'confirmHouseholdOnboarding', 'foundHouseholdCharter', 'signHouseholdCharter',
      'addAccount', 'acceptReviewedAccountHistory', 'submitOnboardingCategories', 'submitOnboardingEstimates',
      'approveOnboardingProposal', 'adoptFirstBudget', 'recordChapterAcknowledgement', 'recordObservedChapterCompletion',
      'approveOnboardingReady', 'completeHouseholdOnboarding',
    ]));
  }, 30_000);
});
