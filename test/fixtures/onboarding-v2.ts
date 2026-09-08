import { catalogHousehold, proposeHouseholdOnboarding, confirmHouseholdOnboarding,
  foundHouseholdCharter, signHouseholdCharter, postOpeningBalances,
  submitOnboardingCategories, submitOnboardingEstimates, buildProposal,
  approveOnboardingProposal, adoptFirstBudget, recordChapterAcknowledgement,
  recordObservedChapterCompletion, requiredHouseholdChapters, todayKey,
  type Household, type CorrectionPracticeProof,
} from "../../src/core/index.ts";
export const A = "MEM-001", B = "MEM-002";
export function practiceProof(memberId: string): CorrectionPracticeProof {
  return { version: 1, memberId, date: todayKey(), fictional: true, discarded: true,
    mistakeCents: 4500, mistakeEntryCount: 1, reversalEntryCount: 2,
    trialInBalance: true, equationHolds: true, netIncomeCents: 0,
    persistedIds: [], receiptId: "PRACTICE-0123456789ABCDEF0123" };
}
export function activeSetup(): Household {
  let h = catalogHousehold("development");
  h.accounts = h.accounts.filter(account => account.id === "ACC-CHEQUING");
  h = proposeHouseholdOnboarding(h, { memberId: A }).household;
  h = confirmHouseholdOnboarding(h, { memberId: B }).household;
  return h;
}
export function setupFacts(): Household {
  let h = activeSetup();
  const today = todayKey();
  h = foundHouseholdCharter(h, { memberId: B, custodianMemberId: A, purpose: "Roof and groceries.", splitRule: "remainder", splitNote: "Together", ceilingKind: "none", cadence: "weekly", cadenceWeekday: 0, date: today }).household;
  h = signHouseholdCharter(h, { memberId: A }).household;
  h = signHouseholdCharter(h, { memberId: B }).household;
  const opening = postOpeningBalances(h, { createdBy: A, asOfDate: today, confirmationId: "opening-setup", lines: [{ accountId: "ACC-CHEQUING", amountCents: 100000 }] });
  h = opening.household;
  h.commandReceipts.push({ confirmationId: "opening-setup", commandKind: "postOpeningBalances", postedIds: opening.postedIds,
    identityHash: "opening-identity", auditHash: "opening-audit", revision: 1, acceptedAt: new Date().toISOString() });
  for (const memberId of [A, B]) h = submitOnboardingCategories(h, { memberId, createdBy: memberId, categoryIds: ["SUB-FOOD-GROCERIES"] }).household;
  for (const memberId of [A, B]) h = submitOnboardingEstimates(h, { memberId, createdBy: memberId, estimates: [{ subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 50000 }] }).household;
  const proposal = buildProposal(h, today.slice(0,7), today);
  for (const memberId of [A, B]) h = approveOnboardingProposal(h, { memberId, createdBy: memberId, digest: proposal.sourceDigest }).household;
  h = adoptFirstBudget(h, { memberId: A, createdBy: A, monthKey: proposal.monthKey, proposalDigest: proposal.sourceDigest }).household;
  return h;
}
export function acknowledge(household: Household, memberId: string, chapterId: string): Household {
  if (chapterId === "ch-02-household") return recordObservedChapterCompletion(household, { memberId, createdBy: memberId, chapterId,
    observation: { kind: "resolved", scope: { environment: household.environment, householdId: household.householdId, memberId },
      currentMemberId: memberId, seatMemberIds: [A,B], observedAt: new Date().toISOString() } }).household;
  return recordChapterAcknowledgement(household, { memberId, createdBy: memberId, chapterId,
    ...(chapterId === "ch-12-ready" ? { today: todayKey(), practiceProof: practiceProof(memberId) } : {}) }).household;
}
export function readySetup(includePractice = false): Household {
  let h = setupFacts();
  for (const chapter of requiredHouseholdChapters()) {
    if (chapter.id === "ch-12-ready" && !includePractice) continue;
    for (const memberId of [A,B]) h = acknowledge(h, memberId, chapter.id);
  }
  return h;
}

/** Real accepted books/Charter facts, before either person authors the starter plan. */
export function setupBooks(): Household {
  const h = setupFacts();
  delete h.onboardingSubmissions;delete h.onboardingCategoryMerges;delete h.onboardingCategoryProposals;
  delete h.onboardingApprovals;h.budgetPlans=[];delete h.acceptedStarterPlans;
  return h;
}
export function acknowledgeBefore(h: Household, chapterId: string): Household {
  for (const chapter of requiredHouseholdChapters()) {
    if (chapter.id === chapterId) break;
    for (const memberId of [A,B]) h=acknowledge(h,memberId,chapter.id);
  }
  return h;
}
