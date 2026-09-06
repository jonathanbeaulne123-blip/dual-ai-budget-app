import {
  addRecurrence,
  adoptExistingOnboardingEvidence,
  adoptFirstBudget,
  approveHouseholdFundConfiguration,
  approveOnboardingProposal,
  approveOnboardingReady,
  buildProposal,
  catalogHousehold,
  completeHouseholdOnboarding,
  configureHouseholdFund,
  confirmHouseholdOnboarding,
  foundHouseholdCharter,
  onboardingAdoptionIdentity,
  onboardingCompletionDigest,
  offerHouseholdOnboarding,
  postEntry,
  postOpeningBalances,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordEarningCadence,
  recordObservedChapterCompletion,
  setFundCardAccount,
  signHouseholdCharter,
  submitOnboardingCategories,
  submitOnboardingEstimates,
  todayKey,
  type CommandReceipt,
  type Household,
  type WorkPaySchedule,
} from "../../src/core/index.ts";

export const BIANCA = "MEM-001";
export const JONATHAN = "MEM-002";

function receipt(commandKind: string, confirmationId: string, postedIds: string[], acceptedAt: string): CommandReceipt {
  return {
    confirmationId,
    identityHash: `identity-${confirmationId}`,
    auditHash: `audit-${confirmationId}`,
    commandKind,
    postedIds,
    revision: 1,
    acceptedAt,
  };
}

function withReceipt(household: Household, row: CommandReceipt): Household {
  return { ...household, commandReceipts: [...household.commandReceipts, row] };
}

function schedule(anchorDate: string): WorkPaySchedule {
  return {
    cadence: "irregular",
    anchorDate,
    weekday: 1,
    monthDays: [],
    customDates: [],
    reminderTime: "09:00",
  };
}

function isoAfter(base: string, minutes: number): string {
  return new Date(Date.parse(base) + minutes * 60_000).toISOString();
}

export function existingBooksActivationAt(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
}

/** Canonical legacy books with every adoptable chapter fact, but no onboarding record. */
export function existingBooksHousehold(activationAt = existingBooksActivationAt()): Household {
  const today = todayKey(new Date(activationAt), "America/Toronto");
  const monthKey = today.slice(0, 7);
  let household = catalogHousehold("development");
  household.name = "Jonathan & Bianca";

  household = foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady.",
    splitRule: "remainder",
    splitNote: "We cover the home together.",
    ceilingKind: "none",
    cadence: "weekly",
    cadenceWeekday: 0,
    date: today,
  }).household;
  household = signHouseholdCharter(household, { memberId: BIANCA }).household;
  household = signHouseholdCharter(household, { memberId: JONATHAN }).household;
  household = setFundCardAccount(household, {
    memberId: BIANCA,
    accountId: "ACC-VISA",
    createdBy: BIANCA,
  }).household;
  household = configureHouseholdFund(household, {
    custodianMemberId: BIANCA,
    openedOn: today,
    createdBy: BIANCA,
    at: isoAfter(activationAt, -60),
  }).household;
  household = approveHouseholdFundConfiguration(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    revision: isoAfter(activationAt, -60),
    at: isoAfter(activationAt, -59),
  }).household;

  const openingId = "LEGACY-OPENING";
  const opening = postOpeningBalances(household, {
    asOfDate: today,
    createdBy: BIANCA,
    confirmationId: openingId,
    lines: household.accounts
      .filter((account) => account.active && account.scope !== "personal")
      .map((account, index) => ({ accountId: account.id, amountCents: (index + 1) * 10_000 })),
  });
  household = withReceipt(opening.household, receipt(
    "postOpeningBalances",
    openingId,
    opening.postedIds,
    isoAfter(activationAt, -58),
  ));

  household = addRecurrence(household, {
    cadence: "monthly",
    nextDate: today,
    type: "expense",
    amount: "1850",
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-HOUSING-RENT",
    note: "Rent",
  }).household;
  household = addRecurrence(household, {
    cadence: "monthly",
    nextDate: today,
    type: "expense",
    amount: "95",
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-LIFE-PHONE",
    note: "Phones",
  }).household;

  const categoryIds = ["SUB-HOUSING-RENT", "SUB-FOOD-GROCERIES"];
  household = submitOnboardingCategories(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    categoryIds,
    at: isoAfter(activationAt, -55),
  }).household;
  household = submitOnboardingCategories(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    categoryIds,
    at: isoAfter(activationAt, -54),
  }).household;
  household = submitOnboardingEstimates(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    estimates: categoryIds.map((subcategoryId, index) => ({ subcategoryId, amountCents: 180_000 - index * 120_000 })),
    at: isoAfter(activationAt, -53),
  }).household;
  household = submitOnboardingEstimates(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    estimates: categoryIds.map((subcategoryId, index) => ({ subcategoryId, amountCents: 190_000 - index * 120_000 })),
    at: isoAfter(activationAt, -52),
  }).household;
  const proposal = buildProposal(household, monthKey, today);
  // Build the same current-plan receipt an already-started household would
  // carry. The fixture removes only the mode record below; it never invents
  // completion.
  household = proposeHouseholdOnboarding(household, {
    memberId: BIANCA,
    at: isoAfter(activationAt, -51),
  }).household;
  household = confirmHouseholdOnboarding(household, {
    memberId: JONATHAN,
    at: isoAfter(activationAt, -50),
  }).household;
  household = approveOnboardingProposal(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    digest: proposal.sourceDigest,
  }).household;
  household = approveOnboardingProposal(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    digest: proposal.sourceDigest,
  }).household;
  const adoption = adoptFirstBudget(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    monthKey,
    proposalDigest: proposal.sourceDigest,
  });
  const adoptionId = onboardingAdoptionIdentity(monthKey, proposal.sourceDigest);
  household = withReceipt(adoption.household, receipt(
    "adoptFirstBudget",
    adoptionId,
    adoption.postedIds,
    isoAfter(activationAt, -49),
  ));

  const ordinary = postEntry(household, {
    date: today,
    type: "expense",
    amount: "12.00",
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "Milk",
    createdBy: BIANCA,
    visibility: "household",
    confirmDuplicate: true,
  });
  household = withReceipt(ordinary.household, receipt(
    "postEntry",
    "LEGACY-ORDINARY-ENTRY",
    ordinary.postedIds,
    isoAfter(activationAt, -48),
  ));
  household.householdOnboarding = undefined;
  household.members = household.members.map((member) => ({ ...member, onboardingProgress: undefined }));
  return household;
}

export function activeExistingBooksHousehold(activationAt = existingBooksActivationAt()): Household {
  let household = existingBooksHousehold(activationAt);
  household = offerHouseholdOnboarding(household, { memberId: BIANCA, at: isoAfter(activationAt, -2) }).household;
  household = proposeHouseholdOnboarding(household, { memberId: BIANCA, at: isoAfter(activationAt, -1) }).household;
  household = confirmHouseholdOnboarding(household, { memberId: JONATHAN, at: activationAt }).household;
  household = adoptExistingOnboardingEvidence(household, { memberId: BIANCA, createdBy: BIANCA }).household;
  household = adoptExistingOnboardingEvidence(household, { memberId: JONATHAN, createdBy: JONATHAN }).household;
  return household;
}

export function completedExistingBooksHousehold(activationAt = existingBooksActivationAt()): Household {
  const today = todayKey(new Date(activationAt), "America/Toronto");
  let household = activeExistingBooksHousehold(activationAt);
  for (const memberId of [BIANCA, JONATHAN]) {
    household = recordChapterAcknowledgement(household, {
      memberId,
      createdBy: memberId,
      chapterId: "ch-01-meet",
      at: isoAfter(activationAt, 1),
    }).household;
    household = recordObservedChapterCompletion(household, {
      memberId,
      createdBy: memberId,
      chapterId: "ch-02-household",
      observation: {
        kind: "resolved",
        scope: { environment: household.environment, householdId: household.householdId, memberId },
        currentMemberId: memberId,
        seatMemberIds: [BIANCA, JONATHAN],
        observedAt: isoAfter(activationAt, 2),
      },
      at: isoAfter(activationAt, 2),
    }).household;
    household = recordEarningCadence(household, {
      memberId,
      createdBy: memberId,
      paySchedule: schedule(today),
      detailAction: "skip",
      at: isoAfter(activationAt, 3),
    }).household;
    household = recordChapterAcknowledgement(household, {
      memberId,
      createdBy: memberId,
      chapterId: "ch-08-cadence",
      at: isoAfter(activationAt, 4),
    }).household;
  }
  for (const memberId of [BIANCA, JONATHAN]) {
    household = recordChapterAcknowledgement(household, {
      memberId,
      createdBy: memberId,
      chapterId: "ch-12-ready",
      today,
      at: isoAfter(activationAt, 5),
    }).household;
  }
  const digest = onboardingCompletionDigest(household);
  household = approveOnboardingReady(household, { memberId: BIANCA, createdBy: BIANCA, digest }).household;
  household = approveOnboardingReady(household, { memberId: JONATHAN, createdBy: JONATHAN, digest }).household;
  return completeHouseholdOnboarding(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    at: isoAfter(activationAt, 6),
  }).household;
}
