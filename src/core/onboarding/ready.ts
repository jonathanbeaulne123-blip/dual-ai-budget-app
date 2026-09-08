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
import { acceptedPracticeProof, currentMemberAttestation, memberRequirementSatisfied, requirementFingerprint } from "./attestations.ts";
import { READY_CHAPTER_ID, requiredHouseholdChapters, ONBOARDING_REGISTRY_VERSION } from "./registry.ts";

export { READY_CHAPTER_ID } from "./registry.ts";

export function readyPracticeProofAccepted(
  value: unknown,
  memberId: string,
  date: DateKey,
): value is CorrectionPracticeProof {
  return acceptedPracticeProof(value, memberId, date);
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


/**
 * Exact shared meaning, without Personal evidence. The two devices can
 * independently arrive at this digest even when one member used a Personal
 * transaction and the other used discarded Practice.
 */
export function onboardingCompletionDigest(household: Household): string {
  const record = acceptedHouseholdOnboarding(household);
  if (record?.state === "complete" && record.completionDigest && !record.forcedUnlock) return record.completionDigest;
  if (!record?.startedAt || record.forcedUnlock) throw new ValidationError("Household setup is not ready to finish.");
  const memberIds = household.members.filter(member => member.active).map(member => member.id).sort();
  if (memberIds.length !== 2) throw new ValidationError("Household setup needs exactly two active members to finish.");
  const facts = {
    kind: "hearth-onboarding-completion", version: ONBOARDING_REGISTRY_VERSION,
    environment: household.environment, householdId: household.householdId, startedAt: record.startedAt,
    memberIds, required: requiredHouseholdChapters().map(chapter => ({
      id: chapter.id, fingerprint: requirementFingerprint(household, chapter.id),
      acceptances: memberIds.map(memberId => currentMemberAttestation(household, memberId, chapter.id)),
    })),
  };
  return `ready-v2-${adoptionSha256(JSON.stringify(canonicalReadyValue(facts)))}`;
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
  const practiceAccepted = readyPracticeProofAccepted(practiceProof, memberId, today)
    || memberRequirementSatisfied(household, memberId, READY_CHAPTER_ID);
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
    proofAccepted: practiceAccepted,
    checklist: requiredHouseholdChapters().map((chapter) => ({
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
  if (householdGatesOutstanding(previous).length > 0
    || !memberRequirementSatisfied(previous, actorMemberId, READY_CHAPTER_ID)
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
