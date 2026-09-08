import type { Household } from "../types.ts";
import { ValidationError } from "../types.ts";
import type { CorrectionPracticeProof } from "../monthRehearsalPractice.ts";
import { todayKey, type DateKey } from "../calendar.ts";
import { adoptionSha256 } from "./adoption.ts";
import { evidenceFor } from "./evidence.ts";
import { acceptedHouseholdOnboarding } from "./mode.ts";
import { chapterById, ONBOARDING_REGISTRY_VERSION } from "./registry.ts";
import { currentAcceptedStarterPlan } from "./planAcceptance.ts";

/** Shared completion facts contain no Personal module history, proof IDs or private hashes. */
export type OnboardingAttestation = {
  id: string;
  householdId: string;
  memberId: string;
  requirementId: string;
  curriculumVersion: 2;
  prerequisiteFingerprint: string;
  acceptedAt: string;
};
export function canonicalOnboardingValue(value: unknown): string {
  return JSON.stringify(value, function (_key, child) {
    return child && typeof child === "object" && !Array.isArray(child)
      ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a.localeCompare(b))) : child;
  });
}
export function onboardingFactFingerprint(value: unknown): string {
  return adoptionSha256(canonicalOnboardingValue(value));
}
export function shapeOnboardingAttestations(value: unknown, householdId?: string): OnboardingAttestation[] {
  if (!Array.isArray(value)) return [];
  const found = new Map<string, OnboardingAttestation>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as OnboardingAttestation;
    if (Object.keys(row).sort().join() !== "acceptedAt,curriculumVersion,householdId,id,memberId,prerequisiteFingerprint,requirementId"
      || row.curriculumVersion !== 2 || !chapterById(row.requirementId)?.contributesToFinalGate
      || typeof row.id !== "string" || !row.id.startsWith("ONB-FACT-")
      || typeof row.householdId !== "string" || !row.householdId
      || (householdId && row.householdId !== householdId)
      || typeof row.memberId !== "string" || !row.memberId
      || !/^[a-f0-9]{64}$/.test(row.prerequisiteFingerprint)
      || typeof row.acceptedAt !== "string" || !Number.isFinite(Date.parse(row.acceptedAt))) continue;
    const previous = found.get(row.id);
    if (previous && canonicalOnboardingValue(previous) !== canonicalOnboardingValue(row)) {
      throw new ValidationError("Conflicting setup acceptance history.");
    }
    found.set(row.id, row);
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function mergeOnboardingAttestations(left: unknown, right: unknown): OnboardingAttestation[] {
  return shapeOnboardingAttestations([...shapeOnboardingAttestations(left), ...shapeOnboardingAttestations(right)]);
}
/** Monotonic Shared revocations never carry private evidence. Only acceptance derives new rows. */
export type OnboardingAttestationInvalidation = { attestationId: string; invalidatedAt: string };
export function shapeOnboardingAttestationInvalidations(value: unknown): OnboardingAttestationInvalidation[] {
  if (!Array.isArray(value)) return [];
  const found = new Map<string, OnboardingAttestationInvalidation>();
  for (const row of value as OnboardingAttestationInvalidation[]) {
    if (!row || Object.keys(row).sort().join() !== "attestationId,invalidatedAt"
      || typeof row.attestationId !== "string" || !row.attestationId.startsWith("ONB-FACT-")
      || typeof row.invalidatedAt !== "string" || !Number.isFinite(Date.parse(row.invalidatedAt))) continue;
    const prior = found.get(row.attestationId);
    if (!prior || row.invalidatedAt < prior.invalidatedAt) found.set(row.attestationId, row);
  }
  return [...found.values()].sort((a,b) => a.attestationId.localeCompare(b.attestationId));
}
export function mergeOnboardingAttestationInvalidations(left: unknown, right: unknown): OnboardingAttestationInvalidation[] {
  return shapeOnboardingAttestationInvalidations([...shapeOnboardingAttestationInvalidations(left), ...shapeOnboardingAttestationInvalidations(right)]);
}
export function deriveOnboardingAttestationInvalidations(previous: Household | null, next: Household, at: string): OnboardingAttestationInvalidation[] {
  const retained = shapeOnboardingAttestationInvalidations(previous?.onboardingAttestationInvalidations);
  if (!previous || acceptedHouseholdOnboarding(previous)?.state === "complete") return retained;
  const roster = (h: Household) => h.members.filter(m=>m.active).map(m=>m.id).sort().join();
  // Pausing or the resume handshake keeps saved checkpoints. Once active, the new
  // household-check epoch revokes the old live-identity observation for both people.
  const mode = acceptedHouseholdOnboarding(next);
  if (mode && mode.state !== "active" && roster(previous) === roster(next)) return retained;
  const revoked = shapeOnboardingAttestations(previous.onboardingAttestations).filter(fact =>
    fact.prerequisiteFingerprint !== requirementFingerprint(next, fact.requirementId))
    .map(fact => ({ attestationId: fact.id, invalidatedAt: at }));
  return mergeOnboardingAttestationInvalidations(retained, revoked);
}
export function currentMemberAttestation(household: Household, memberId: string, requirementId: string): OnboardingAttestation | null {
  const fingerprint = requirementFingerprint(household, requirementId);
  if (!fingerprint) return null;
  const revoked = new Set(shapeOnboardingAttestationInvalidations(household.onboardingAttestationInvalidations).map(r=>r.attestationId));
  return shapeOnboardingAttestations(household.onboardingAttestations, household.householdId)
    .filter(a => a.memberId === memberId && a.requirementId === requirementId
      && a.prerequisiteFingerprint === fingerprint && !revoked.has(a.id))
    .sort((a,b) => b.acceptedAt.localeCompare(a.acceptedAt) || b.id.localeCompare(a.id))[0] ?? null;
}
export function acceptedPracticeProof(value: unknown, memberId: string, date?: DateKey): value is CorrectionPracticeProof {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CorrectionPracticeProof>;
  return row.version === 1 && row.memberId === memberId && (!date || row.date === date)
    && typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
    && row.fictional === true && row.discarded === true && row.mistakeCents === 4500
    && row.mistakeEntryCount === 1 && row.reversalEntryCount === 2
    && row.trialInBalance === true && row.equationHolds === true && row.netIncomeCents === 0
    && Array.isArray(row.persistedIds) && row.persistedIds.length === 0
    && typeof row.receiptId === "string" && /^PRACTICE-[A-F0-9]{20}$/.test(row.receiptId);
}
/** Stable shared prerequisites, deliberately excluding ordinary activity and deferred learning. */
export function requirementFingerprint(household: Household, requirementId: string): string | null {
  const record = acceptedHouseholdOnboarding(household);
  const memberIds = household.members.filter(m => m.active).map(m => m.id).sort();
  if (!record?.startedAt || record.forcedUnlock || memberIds.length !== 2
    || memberIds.some(id => !record.confirmedByMemberIds.includes(id))) return null;
  const context = { environment: household.environment, householdId: household.householdId,
    curriculumVersion: ONBOARDING_REGISTRY_VERSION, startedAt: record.startedAt, memberIds, requirementId };
  if (["ch-01-meet", "ch-02-household", "ch-12-ready"].includes(requirementId)) {
    return onboardingFactFingerprint({ ...context, ...(requirementId === "ch-02-household" ? { householdCheckEpoch: record.proposedAt } : {}) });
  }
  if (requirementId === "ch-11-plan") {
    const accepted = currentAcceptedStarterPlan(household);
    return accepted ? onboardingFactFingerprint({ ...context, plan: accepted }) : null;
  }
  const evidence = evidenceFor(household, requirementId, memberIds[0]!, {
    today: todayKey(new Date(record.startedAt), household.timezone),
  });
  if (evidence.kind !== "accepted" || evidence.card.scope !== "household") return null;
  const sharedAccounts = household.accounts.filter(a => a.active && a.scope !== "personal")
    .map(a => ({ id: a.id, kind: a.kind, scope: a.scope, ownerMemberId: a.ownerMemberId }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return onboardingFactFingerprint({ ...context, sourceIds: [...evidence.card.sourceIds].sort(),
    // These are Shared-only cards. Never bind a Personal proof or private source identifier.
    lines: evidence.card.lines, ...(requirementId === "ch-04-accounts" || requirementId === "ch-05-opening" ? { sharedAccounts } : {}),
    ...(requirementId === "ch-03-charter" ? { charter: household.charter } : {}) });
}
export function memberRequirementSatisfied(household: Household, memberId: string, requirementId: string): boolean {
  return currentMemberAttestation(household, memberId, requirementId) !== null;
}
/** The command already checked the member's observation/practice input; the authority rechecks all shared facts. */
export function appendChapterAttestation(household: Household, memberId: string, requirementId: string, at: string): Household {
  const fingerprint = requirementFingerprint(household, requirementId);
  if (!fingerprint) throw new ValidationError("This setup check changed. Review its current facts before continuing.");
  if (memberRequirementSatisfied(household, memberId, requirementId)) return household;
  const row: OnboardingAttestation = {
    id: `ONB-FACT-${onboardingFactFingerprint({ memberId, requirementId, fingerprint, at })}`,
    householdId: household.householdId, memberId, requirementId, curriculumVersion: 2,
    prerequisiteFingerprint: fingerprint, acceptedAt: at,
  };
  return { ...household, onboardingAttestations: mergeOnboardingAttestations(household.onboardingAttestations, [row]) };
}
export function assertOnboardingAttestationTransition(previous: Household | null, next: Household,
  input: { actorMemberId?: string; commandKind?: string; postedIds: readonly string[] }): void {
  const before = shapeOnboardingAttestations(previous?.onboardingAttestations, previous?.householdId);
  const after = shapeOnboardingAttestations(next.onboardingAttestations, next.householdId);
  if (canonicalOnboardingValue(before) === canonicalOnboardingValue(after)) return;
  const actor = input.actorMemberId;
  const allowed = ["recordChapterAcknowledgement", "recordObservedChapterCompletion"];
  const added = after.filter(a => !before.some(b => b.id === a.id));
  if (!previous || !actor || !previous.members.some(m => m.active && m.id === actor)
    || !allowed.includes(input.commandKind ?? "") || added.length !== 1
    || before.some(a => !after.some(b => canonicalOnboardingValue(a) === canonicalOnboardingValue(b)))
    || next.onboardingAttestations?.length !== after.length) throw new ValidationError("Only your current setup check can be accepted.");
  const fact = added[0]!;
  const progress = next.members.find(m => m.id === actor)?.onboardingProgress;
  const proof = progress?.rows.find(r => r.chapterId === fact.requirementId);
  if (fact.memberId !== actor || fact.householdId !== previous.householdId
    || fact.prerequisiteFingerprint !== requirementFingerprint(previous, fact.requirementId)
    || !input.postedIds.includes(fact.id) || proof?.acknowledgedAt !== fact.acceptedAt
    || (fact.requirementId === "ch-02-household" && input.commandKind !== "recordObservedChapterCompletion")
    || (fact.requirementId === "ch-12-ready" && !acceptedPracticeProof(progress?.practiceProof, actor))) {
    throw new ValidationError("This setup acceptance is not tied to your current evidence.");
  }
  const normalize = (h: Household) => {
    const { onboardingAttestations: _facts, activity: _activity, lastCommittedAt: _at, ...rest } = h;
    return { ...rest, members: rest.members.map(m => m.id === actor ? { ...m, onboardingProgress: null } : m) };
  };
  if (canonicalOnboardingValue(normalize(previous)) !== canonicalOnboardingValue(normalize(next))) {
    throw new ValidationError("A setup check cannot change unrelated household facts.");
  }
}
