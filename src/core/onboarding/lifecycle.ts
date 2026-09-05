import { todayKey } from "../calendar.ts";
import type { Household } from "../types.ts";
import { adoptionSha256 } from "./adoption.ts";
import { approvalsFor } from "./approvals.ts";
import { evidenceFor } from "./evidence.ts";
import { acceptedHouseholdOnboarding, onboardingRecordId, type OnboardingModeState } from "./mode.ts";
import {
  emptyMemberOnboardingProgress,
  chapterProgressSatisfied,
  memberProgress,
  NEW_MEMBER_CATCH_UP_CHAPTER_IDS,
  type MemberOnboardingProgress,
} from "./progress.ts";
import { ONBOARDING_REGISTRY, ONBOARDING_REGISTRY_VERSION, householdChapters } from "./registry.ts";

export { NEW_MEMBER_CATCH_UP_CHAPTER_IDS };

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
  const rawVersion = household.householdOnboarding && typeof household.householdOnboarding === "object"
    && Number.isInteger(household.householdOnboarding.registryVersion)
    ? household.householdOnboarding.registryVersion
    : ONBOARDING_REGISTRY_VERSION;
  return rawVersion === ONBOARDING_REGISTRY_VERSION
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

/** Narrow acceptance proof for the create-demo-suite boundary. */
export function syntheticDemoOnboardingIsValid(household: Household): boolean {
  if (household.environment !== "development" || household.syntheticFixture?.kind !== "hearth-demo-suite") return false;
  const record = acceptedHouseholdOnboarding(household);
  const memberIds = household.members.filter((member) => member.active).map((member) => member.id).sort();
  if (record?.state !== "complete"
    || !record.completionDigest?.match(/^ready-demo-v1-[a-f0-9]{64}$/)
    || memberIds.length !== 2
    || record.confirmedByMemberIds.join("|") !== memberIds.join("|")
    || approvalsFor(household, "ready", record.completionDigest).length !== 2) return false;
  const householdIds = new Set(householdChapters().map((chapter) => chapter.id));
  return memberIds.every((memberId) => memberProgress(household, memberId).rows
    .filter((row) => householdIds.has(row.chapterId))
    .every(chapterProgressSatisfied));
}

export function onboardingLifecycleState(household: Household): OnboardingModeState {
  return acceptedHouseholdOnboarding(household)?.state ?? "inactive";
}
