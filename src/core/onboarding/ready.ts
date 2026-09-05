import type { DateKey } from "../calendar.ts";
import type { Household } from "../types.ts";
import { ValidationError } from "../types.ts";
import { booksEquation, compileHousehold, trialBalance } from "../journal.ts";
import { runHealthCheck } from "../health.ts";
import type { CorrectionPracticeProof } from "../monthRehearsalPractice.ts";
import { adoptionSha256 } from "./adoption.ts";
import { approvalsFor, bothApproved } from "./approvals.ts";
import { evidenceFor, type EvidenceResult } from "./evidence.ts";
import { acceptedHouseholdOnboarding } from "./mode.ts";
import { householdGatesOutstanding } from "./progress.ts";
import { householdChapters, ONBOARDING_REGISTRY_VERSION } from "./registry.ts";

export const READY_CHAPTER_ID = "ch-12-ready";

export function readyPracticeProofAccepted(
  value: unknown,
  memberId: string,
  date: DateKey,
): value is CorrectionPracticeProof {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CorrectionPracticeProof>;
  return row.version === 1
    && row.memberId === memberId
    && row.date === date
    && row.fictional === true
    && row.discarded === true
    && row.mistakeCents === 4500
    && row.mistakeEntryCount === 1
    && row.reversalEntryCount === 2
    && row.trialInBalance === true
    && row.equationHolds === true
    && row.netIncomeCents === 0
    && Array.isArray(row.persistedIds)
    && row.persistedIds.length === 0
    && typeof row.receiptId === "string"
    && /^PRACTICE-[A-F0-9]{20}$/.test(row.receiptId);
}

function canonicalReadyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalReadyValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalReadyValue(child)]));
  }
  return value;
}

function byId<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Exact shared meaning, without Personal evidence. The two devices can
 * independently arrive at this digest even when one member used a Personal
 * transaction and the other used discarded Practice.
 */
export function onboardingCompletionDigest(household: Household): string {
  const record = acceptedHouseholdOnboarding(household);
  if (!record?.startedAt || record.forcedUnlock) {
    throw new ValidationError("Household setup is not ready to finish.");
  }
  const activeMemberIds = household.members
    .filter((member) => member.active)
    .map((member) => member.id)
    .sort((left, right) => left.localeCompare(right));
  if (activeMemberIds.length !== 2) {
    throw new ValidationError("Household setup needs exactly two active members to finish.");
  }
  const openingIds = new Set(household.transactions
    .filter((row) => row.type === "opening" || row.source === "opening")
    .map((row) => row.id));
  const setupTransactions = household.transactions.filter((row) => openingIds.has(row.id)
    || (typeof row.reversalOfId === "string" && openingIds.has(row.reversalOfId)));
  const facts = {
    kind: "hearth-onboarding-completion",
    version: 1,
    environment: household.environment,
    householdId: household.householdId,
    onboardingId: record.id,
    proposedAt: record.proposedAt,
    registryVersion: ONBOARDING_REGISTRY_VERSION,
    memberIds: activeMemberIds,
    confirmedByMemberIds: [...record.confirmedByMemberIds].sort(),
    startedAt: record.startedAt,
    gateChapterIds: householdChapters()
      .filter((chapter) => chapter.contributesToFinalGate)
      .map((chapter) => chapter.id),
    // Bind the shared setup facts established by Chapters 3–11. Ordinary
    // ledger activity and member-Personal evidence are intentionally absent,
    // so a new purchase while the other member is approving cannot strand the
    // pair on different digests.
    setup: {
      charter: household.charter ?? null,
      accounts: byId(household.accounts.filter((row) => row.active && row.scope !== "personal")),
      openingTransactions: byId(setupTransactions),
      householdFund: household.householdFund ?? null,
      recurrences: byId(household.recurrences.filter((row) => row.active)),
      earningCadences: household.members
        .filter((member) => member.active)
        .map((member) => ({
          memberId: member.id,
          earningCadence: member.earningCadence ?? null,
          earningDetailSkippedAt: member.earningDetailSkippedAt ?? null,
        }))
        .sort((left, right) => left.memberId.localeCompare(right.memberId)),
      categories: byId(household.categories.filter((row) => row.active)),
      submissions: byId(household.onboardingSubmissions ?? []),
      categoryProposals: byId(household.onboardingCategoryProposals ?? []),
      categoryMerges: byId(household.onboardingCategoryMerges ?? []),
      budgetPlans: byId(household.budgetPlans.filter((row) => row.active)),
    },
  };
  return `ready-v1-${adoptionSha256(JSON.stringify(canonicalReadyValue(facts)))}`;
}

export type ReadyChecklistItem = {
  chapterId: string;
  copyKey: string;
  complete: boolean;
};

export type OnboardingReadyPresentation = {
  digest: string;
  evidence: EvidenceResult;
  practiceAccepted: boolean;
  proofAccepted: boolean;
  checklist: ReadyChecklistItem[];
  outstanding: string[];
  viewerApproved: boolean;
  bothApproved: boolean;
  waitingMemberName: string | null;
  completed: boolean;
  booksInBalance: boolean;
  equationHolds: boolean;
  healthFindingCount: number;
};

export function onboardingReadyPresentation(
  household: Household,
  memberId: string,
  today: DateKey,
  practiceProof?: CorrectionPracticeProof | null,
): OnboardingReadyPresentation {
  const digest = onboardingCompletionDigest(household);
  const evidence = evidenceFor(household, READY_CHAPTER_ID, memberId, { today });
  const practiceAccepted = readyPracticeProofAccepted(practiceProof, memberId, today);
  const outstanding = householdGatesOutstanding(household);
  const approvals = approvalsFor(household, "ready", digest);
  const approvedMemberIds = new Set(approvals.map((approval) => approval.memberId));
  const waitingMember = household.members
    .filter((member) => member.active)
    .find((member) => !approvedMemberIds.has(member.id) && member.id !== memberId)
    ?? household.members.filter((member) => member.active).find((member) => !approvedMemberIds.has(member.id))
    ?? null;
  const record = acceptedHouseholdOnboarding(household);
  const books = compileHousehold(household);
  return {
    digest,
    evidence,
    practiceAccepted,
    proofAccepted: evidence.kind === "accepted" || practiceAccepted,
    checklist: householdChapters().map((chapter) => ({
      chapterId: chapter.id,
      copyKey: `ready.chapter.${String(chapter.order).padStart(2, "0")}`,
      complete: !outstanding.includes(chapter.id),
    })),
    outstanding,
    viewerApproved: approvedMemberIds.has(memberId),
    bothApproved: bothApproved(household, "ready", digest),
    waitingMemberName: waitingMember?.name ?? null,
    completed: record?.state === "complete" && record.completionDigest === digest,
    booksInBalance: trialBalance(books, { recognizedOnly: true }).inBalance,
    equationHolds: booksEquation(books).holds,
    healthFindingCount: runHealthCheck(household).length,
  };
}

/** Extra runtime fence; the generic append-only approval validator remains replay-safe. */
export function assertReadyApprovalPrerequisites(previous: Household, next: Household, actorMemberId: string): void {
  const digest = onboardingCompletionDigest(previous);
  const beforeIds = new Set(approvalsFor(previous, "ready", digest).map((row) => row.id));
  const added = approvalsFor(next, "ready", digest).filter((row) => !beforeIds.has(row.id));
  const progress = previous.members.find((member) => member.active && member.id === actorMemberId)?.onboardingProgress;
  const readyRow = progress?.rows.find((row) => row.chapterId === READY_CHAPTER_ID);
  if (householdGatesOutstanding(previous).length > 0
    || !readyRow
    || !(readyRow.observedCompleteAt || readyRow.acknowledgedAt)
    || added.length !== 1
    || added[0]!.memberId !== actorMemberId) {
    throw new ValidationError("Finish every setup check on your own device before saying you're ready.");
  }
}

export function assertOnboardingCompletionTransition(previous: Household, next: Household): void {
  const digest = onboardingCompletionDigest(previous);
  const incoming = acceptedHouseholdOnboarding(next);
  if (householdGatesOutstanding(previous).length > 0
    || !bothApproved(previous, "ready", digest)
    || !incoming
    || incoming.state !== "complete"
    || incoming.completionDigest !== digest
    || incoming.completedAt !== incoming.updatedAt) {
    throw new ValidationError("Both members must finish every setup check and approve the same Ready version.");
  }
}
