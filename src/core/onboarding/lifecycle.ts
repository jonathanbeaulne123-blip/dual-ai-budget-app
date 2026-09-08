import { todayKey } from "../calendar.ts";
import type { Household } from "../types.ts";
import { adoptionSha256 } from "./adoption.ts";
import { approvalsFor, bothApproved } from "./approvals.ts";
import { evidenceFor, probeEvidenceKey } from "./evidence.ts";
import {
  acceptedHouseholdOnboarding,
  onboardingRecordId,
  readOnboardingRegistryVersion,
  type OnboardingModeState,
} from "./mode.ts";
import {
  emptyMemberOnboardingProgress,
  chapterProgressSatisfied,
  memberProgress,
  NEW_MEMBER_CATCH_UP_CHAPTER_IDS,
  shapeMemberOnboardingProgress,
  type MemberOnboardingProgress,
} from "./progress.ts";
import { ONBOARDING_REGISTRY, ONBOARDING_REGISTRY_VERSION, householdChapters } from "./registry.ts";
import { READY_CHAPTER_ID } from "./ready.ts";
import type { ChapterId } from "./types.ts";

export { NEW_MEMBER_CATCH_UP_CHAPTER_IDS };

export const DEMO_SUITE_COMMAND_KIND = "create-demo-suite";

/**
 * A stopped run rechecks canonical state. Live Auth/seat scope is deliberately
 * invalidated every time: cached browser identity is never resume evidence.
 */
export function reprobeMemberOnboardingProgress(
  household: Household,
  memberId: string,
  at: string,
): MemberOnboardingProgress {
  const today = todayKey(new Date(at), household.timezone);
  const progress = memberProgress(household, memberId);
  const householdIds = new Set(householdChapters().map((chapter) => chapter.id));
  return {
    ...progress,
    rows: progress.rows.map((row) => {
      if (!householdIds.has(row.chapterId)) return row;
      const hadProof = Boolean(row.observedCompleteAt || row.acknowledgedAt || row.skippedAt);
      if (!hadProof || row.chapterId === "ch-01-meet") return row;
      const projected = row.chapterId === "ch-02-household"
        ? { kind: "empty" as const }
        : evidenceFor(household, row.chapterId, memberId, { today });
      return projected.kind === "accepted" ? row : { ...row, invalidatedAt: at };
    }),
    updatedAt: at,
  };
}

const LIVE_ONBOARDING_CHAPTER_IDS = new Set<ChapterId>([
  ...NEW_MEMBER_CATCH_UP_CHAPTER_IDS,
  READY_CHAPTER_ID,
]);

function acceptedEvidenceAvailableAtActivation(
  household: Household,
  memberId: string,
): Map<ChapterId, { observedCompleteAt: string; probeEvidenceKey: string }> {
  const onboarding = acceptedHouseholdOnboarding(household);
  if (onboarding?.state !== "active" || !onboarding.startedAt) return new Map();
  const today = todayKey(new Date(onboarding.startedAt), household.timezone);
  const accepted = new Map<ChapterId, { observedCompleteAt: string; probeEvidenceKey: string }>();
  for (const chapter of householdChapters()) {
    if (LIVE_ONBOARDING_CHAPTER_IDS.has(chapter.id)) continue;
    const projected = evidenceFor(household, chapter.id, memberId, { today });
    if (
      projected.kind !== "accepted"
      || Date.parse(projected.card.observedAt) > Date.parse(onboarding.startedAt)
    ) continue;
    accepted.set(chapter.id, {
      observedCompleteAt: projected.card.observedAt,
      probeEvidenceKey: probeEvidenceKey(projected.card),
    });
  }
  return accepted;
}

/**
 * Adopt only canonical evidence that was already accepted when this setup run
 * became active. The four live chapters stay untouched, and acknowledgement
 * remains exclusively the person's own action.
 */
export function adoptAcceptedOnboardingEvidence(
  household: Household,
  memberId: string,
): MemberOnboardingProgress {
  const progress = memberProgress(household, memberId);
  const accepted = acceptedEvidenceAvailableAtActivation(household, memberId);
  if (accepted.size === 0) return progress;
  const startedAt = acceptedHouseholdOnboarding(household)?.startedAt ?? progress.updatedAt;
  return {
    ...progress,
    rows: progress.rows.map((row) => {
      const evidence = accepted.get(row.chapterId);
      return evidence ? { ...row, ...evidence } : row;
    }),
    updatedAt: progress.updatedAt > startedAt ? progress.updatedAt : startedAt,
  };
}

export function memberNeedsAcceptedOnboardingEvidenceAdoption(
  household: Household,
  memberId: string,
): boolean {
  const progress = memberProgress(household, memberId);
  const rows = new Map(progress.rows.map((row) => [row.chapterId, row]));
  return [...acceptedEvidenceAvailableAtActivation(household, memberId)].some(([chapterId, evidence]) => {
    const row = rows.get(chapterId);
    return row?.observedCompleteAt !== evidence.observedCompleteAt
      || row.probeEvidenceKey !== evidence.probeEvidenceKey;
  });
}

export type OnboardingRegistryMigrationPlan =
  | { kind: "current" }
  | { kind: "repair"; fromVersion: number; toVersion: number }
  | { kind: "blocked"; reason: "unknown-chapter-id"; chapterId: string };

/** Defines registry changes as repair work and fails closed on unknown rows. */
export function onboardingRegistryMigrationPlan(household: Household): OnboardingRegistryMigrationPlan {
  const known = new Set(ONBOARDING_REGISTRY.map((chapter) => chapter.id));
  for (const member of household.members) {
    const raw = member.onboardingProgress;
    if (!raw || !Array.isArray(raw.rows)) continue;
    for (const candidate of raw.rows) {
      const chapterId = candidate && typeof candidate === "object" && typeof (candidate as { chapterId?: unknown }).chapterId === "string"
        ? (candidate as { chapterId: string }).chapterId
        : "";
      if (chapterId && !known.has(chapterId)) return { kind: "blocked", reason: "unknown-chapter-id", chapterId };
    }
  }
  for (const member of household.members) {
    const raw = member.onboardingProgress;
    if (raw == null) continue;
    const shaped = shapeMemberOnboardingProgress(raw, {
      environment: household.environment,
      householdId: household.householdId,
      memberId: member.id,
    });
    if (shaped) continue;
    const rawVersion = typeof raw === "object" && Number.isInteger((raw as { registryVersion?: unknown }).registryVersion)
      ? Number((raw as { registryVersion: number }).registryVersion)
      : 0;
    return { kind: "repair", fromVersion: rawVersion, toVersion: ONBOARDING_REGISTRY_VERSION };
  }
  const rawVersion = household.householdOnboarding && typeof household.householdOnboarding === "object"
    ? readOnboardingRegistryVersion(household.householdOnboarding.registryVersion)
    : ONBOARDING_REGISTRY_VERSION;
  return rawVersion === 1 || rawVersion === ONBOARDING_REGISTRY_VERSION
    ? { kind: "current" }
    : { kind: "repair", fromVersion: rawVersion, toVersion: ONBOARDING_REGISTRY_VERSION };
}

function demoCompletionDigest(household: Household, at: string, sourceKey: string): string {
  const memberIds = household.members.filter((member) => member.active).map((member) => member.id).sort();
  return `ready-demo-v1-${adoptionSha256(JSON.stringify({
    environment: household.environment,
    householdId: household.householdId,
    memberIds,
    registryVersion: ONBOARDING_REGISTRY_VERSION,
    sourceKey,
    at,
  }))}`;
}

/** Seeded Development demos are a finished story, never a setup invitation. */
export function completeSyntheticDemoOnboarding(household: Household, input: { at: string; sourceKey: string }): Household {
  if (household.environment !== "development") return household;
  const members = household.members.filter((member) => member.active);
  if (members.length !== 2) return household;
  const memberIds = members.map((member) => member.id).sort();
  const digest = demoCompletionDigest(household, input.at, input.sourceKey);
  const completedProgress = (memberId: string): MemberOnboardingProgress => {
    const empty = emptyMemberOnboardingProgress({ environment: household.environment, householdId: household.householdId, memberId });
    return {
      ...empty,
      rows: empty.rows.map((row) => householdChapters().some((chapter) => chapter.id === row.chapterId)
        ? { ...row, acknowledgedAt: input.at, lastSafeResumePoint: row.chapterId }
        : row),
      updatedAt: input.at,
    };
  };
  return {
    ...household,
    householdOnboarding: {
      id: onboardingRecordId(household),
      environment: household.environment,
      householdId: household.householdId,
      registryVersion: ONBOARDING_REGISTRY_VERSION,
      state: "complete",
      proposedByMemberId: memberIds[0] ?? null,
      proposedAt: input.at,
      handshakeExpiresAt: null,
      confirmedByMemberIds: memberIds,
      startedAt: input.at,
      stoppedAt: null,
      stoppedByMemberIds: [],
      stoppedSolo: false,
      forcedUnlock: false,
      completedAt: input.at,
      completionDigest: digest,
      createdAt: input.at,
      updatedAt: input.at,
    },
    onboardingApprovals: memberIds.map((memberId) => ({
      id: `ONB-APP-DEMO-${memberId}-${digest.slice(-16)}`,
      householdId: household.householdId,
      memberId,
      scope: "ready" as const,
      digest,
      approvedAt: input.at,
    })),
    members: household.members.map((member) => member.active
      ? { ...member, onboardingProgress: completedProgress(member.id) }
      : member),
  };
}

/** Complete, deterministic onboarding proof shared by Development-only seeded demos. */
export function seededOnboardingApprovalsValid(household: Household): boolean {
  if (household.environment !== "development") return false;
  const record = acceptedHouseholdOnboarding(household);
  const memberIds = household.members.filter((member) => member.active).map((member) => member.id).sort();
  const approvals = record?.completionDigest
    ? approvalsFor(household, "ready", record.completionDigest)
    : [];
  if (record?.state !== "complete"
    || !record.completionDigest?.match(/^ready-demo-v1-[a-f0-9]{64}$/)
    || memberIds.length !== 2
    || record.confirmedByMemberIds.join("|") !== memberIds.join("|")
    || !Array.isArray(household.onboardingApprovals)
    || household.onboardingApprovals.length !== 2
    || approvals.length !== 2
    || !bothApproved(household, "ready", record.completionDigest)) return false;
  const householdChapterIds = householdChapters().map((chapter) => chapter.id);
  return memberIds.every((memberId) => {
    const progressByChapter = new Map(memberProgress(household, memberId).rows
      .map((row) => [row.chapterId, row]));
    return householdChapterIds.every((chapterId) => {
      const row = progressByChapter.get(chapterId);
      return Boolean(row && chapterProgressSatisfied(row));
    });
  });
}

export function syntheticDemoOnboardingIsValid(household: Household): boolean {
  return household.syntheticFixture?.kind === "hearth-demo-suite"
    && seededOnboardingApprovalsValid(household);
}

export function onboardingLifecycleState(household: Household): OnboardingModeState {
  return acceptedHouseholdOnboarding(household)?.state ?? "inactive";
}
