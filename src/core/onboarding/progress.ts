import type { Environment, Household } from "../types.ts";
import { ValidationError } from "../types.ts";
import {
  NEW_MEMBER_CATCH_UP_CHAPTER_IDS,
  ONBOARDING_REGISTRY,
  ONBOARDING_REGISTRY_VERSION,
  chapterById,
  householdChapters,
  requiredHouseholdChapters,
  personalModules,
} from "./registry.ts";
import { acceptedHouseholdOnboarding, onboardingIsActive } from "./mode.ts";
import { memberRequirementSatisfied } from "./attestations.ts";
import type { CorrectionPracticeProof } from "../monthRehearsalPractice.ts";
import type { ChapterId, OnboardingChapter } from "./types.ts";

const MISSING_ISO = "1970-01-01T00:00:00.000Z";
export { NEW_MEMBER_CATCH_UP_CHAPTER_IDS } from "./registry.ts";

export type MemberChapterProgress = {
  chapterId: ChapterId;
  /** Accepted typed probe evidence only. Ordinary acknowledgement commands never write this field. */
  observedCompleteAt: string | null;
  probeEvidenceKey: string | null;
  /** Only personal, member-skippable modules may carry this field. */
  skippedAt: string | null;
  /** Chapter 4's optional owner-only Personal account setup; never satisfies the household chapter. */
  personalAccountSetupSkippedAt: string | null;
  lastSafeResumePoint: string | null;
  acknowledgedAt: string | null;
  /** A later lifecycle repair invalidates older proof without letting a stale replica resurrect it. */
  invalidatedAt: string | null;
};

export type MemberOnboardingProgress = {
  id: string;
  householdId: string;
  memberId: string;
  registryVersion: number;
  rows: MemberChapterProgress[];
  offersMuted: boolean;
  /** Field-specific clock so an unrelated later acknowledgement cannot undo this preference. */
  offersMutedUpdatedAt: string | null;
  declineCountByModule: Record<ChapterId, number>;
  /** Month paired with each decline counter so two declines suppress only that month. */
  declineMonthByModule: Record<ChapterId, string>;
  /** Member-Personal, append-only offer facts. They enforce cross-session caps without exposing a trigger fact. */
  personalOfferHistory: PersonalModuleOfferRecord[];
  practiceProof?: CorrectionPracticeProof;
  updatedAt: string;
};

export type PersonalModuleOfferRecord = {
  id: string;
  moduleId: ChapterId;
  sessionId: string;
  offeredAt: string;
  declinedAt: string | null;
  declineMonth: string | null;
};

type ProgressContext = {
  environment: Environment;
  householdId: string;
  memberId: string;
};

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, 200);
}

function probeEvidenceKeyOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  // The key is the exact typed-evidence identity, not display copy. Truncating
  // a multi-source key makes a later canonical probe look different forever.
  return value.trim();
}

function earlier(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left <= right ? left : right;
}

function later(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function earliestProofAfterInvalidation(
  left: string | null,
  right: string | null,
  invalidatedAt: string | null,
): string | null {
  const candidates = [left, right].filter((value): value is string => Boolean(value)).sort();
  if (!invalidatedAt) return candidates[0] ?? null;
  return candidates.find((value) => value > invalidatedAt) ?? candidates[0] ?? null;
}

export function memberProgressId(context: ProgressContext): string {
  return `ONBOARDING-PROGRESS-${context.environment}-${context.householdId}-${context.memberId}-v${ONBOARDING_REGISTRY_VERSION}`;
}

function contextForValue(value: unknown, expected?: Partial<ProgressContext>): ProgressContext | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<MemberOnboardingProgress>;
  if (typeof row.householdId !== "string" || !row.householdId.trim()) return null;
  if (typeof row.memberId !== "string" || !row.memberId.trim()) return null;
  const householdId = row.householdId.trim();
  const memberId = row.memberId.trim();
  if (expected?.householdId && expected.householdId !== householdId) return null;
  if (expected?.memberId && expected.memberId !== memberId) return null;
  const environments: Environment[] = expected?.environment
    ? [expected.environment]
    : ["development", "production"];
  const environment = environments.find((candidate) => [memberProgressId({
    environment: candidate,
    householdId,
    memberId,
  }), `ONBOARDING-PROGRESS-${candidate}-${householdId}-${memberId}-v1`].includes(row.id ?? ""));
  return environment ? { environment, householdId, memberId } : null;
}

function emptyChapter(chapterId: ChapterId): MemberChapterProgress {
  return {
    chapterId,
    observedCompleteAt: null,
    probeEvidenceKey: null,
    skippedAt: null,
    personalAccountSetupSkippedAt: null,
    lastSafeResumePoint: null,
    acknowledgedAt: null,
    invalidatedAt: null,
  };
}

export function emptyMemberOnboardingProgress(context: ProgressContext): MemberOnboardingProgress {
  return {
    id: memberProgressId(context),
    householdId: context.householdId,
    memberId: context.memberId,
    registryVersion: ONBOARDING_REGISTRY_VERSION,
    rows: ONBOARDING_REGISTRY.map((chapter) => emptyChapter(chapter.id)),
    offersMuted: false,
    offersMutedUpdatedAt: null,
    declineCountByModule: {},
    declineMonthByModule: {},
    personalOfferHistory: [],
    updatedAt: MISSING_ISO,
  };
}

function shapedPersonalOfferHistory(value: unknown): PersonalModuleOfferRecord[] {
  if (!Array.isArray(value)) return [];
  const personalIds = new Set(personalModules().map((module) => module.id));
  const candidates = value.flatMap((item): PersonalModuleOfferRecord[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<PersonalModuleOfferRecord>;
    const moduleId = typeof row.moduleId === "string" ? row.moduleId.trim() : "";
    const sessionId = typeof row.sessionId === "string" ? row.sessionId.trim().slice(0, 120) : "";
    const offeredAt = isoOrNull(row.offeredAt);
    const declinedAt = isoOrNull(row.declinedAt);
    const declineMonth = typeof row.declineMonth === "string" && /^\d{4}-\d{2}$/.test(row.declineMonth)
      ? row.declineMonth
      : null;
    const id = typeof row.id === "string" ? row.id.trim().slice(0, 260) : "";
    if (!personalIds.has(moduleId) || !sessionId || !offeredAt || id !== `PERSONAL-OFFER-${moduleId}-${sessionId}`) return [];
    const acceptedDeclinedAt = declinedAt && declinedAt >= offeredAt ? declinedAt : null;
    return [{ id, moduleId, sessionId, offeredAt, declinedAt: acceptedDeclinedAt, declineMonth: acceptedDeclinedAt ? declineMonth : null }];
  }).sort((left, right) => left.offeredAt.localeCompare(right.offeredAt) || left.id.localeCompare(right.id));
  const bySession = new Map<string, PersonalModuleOfferRecord>();
  for (const candidate of candidates) {
    const prior = bySession.get(candidate.sessionId);
    if (!prior) {
      bySession.set(candidate.sessionId, candidate);
      continue;
    }
    if (prior.id === candidate.id && candidate.declinedAt && (!prior.declinedAt || candidate.declinedAt > prior.declinedAt)) {
      bySession.set(candidate.sessionId, { ...prior, declinedAt: candidate.declinedAt, declineMonth: candidate.declineMonth });
    }
  }
  return [...bySession.values()].sort((left, right) => left.offeredAt.localeCompare(right.offeredAt) || left.id.localeCompare(right.id));
}

/** Defensive member-scoped shape. Invalid identity or registry versions are refused. */
export function shapeMemberOnboardingProgress(
  value: unknown,
  expected?: Partial<ProgressContext>,
): MemberOnboardingProgress | null {
  const context = contextForValue(value, expected);
  if (!context || !value || typeof value !== "object") return null;
  const row = value as Partial<MemberOnboardingProgress>;
  if (row.registryVersion !== ONBOARDING_REGISTRY_VERSION && row.registryVersion !== 1) return null;
  const rawRows = Array.isArray(row.rows) ? row.rows : [];
  const byChapter = new Map<ChapterId, Partial<MemberChapterProgress>>();
  for (const candidate of rawRows) {
    if (!candidate || typeof candidate !== "object") continue;
    const chapterId = typeof candidate.chapterId === "string" ? candidate.chapterId : "";
    if (!ONBOARDING_REGISTRY.some((chapter) => chapter.id === chapterId) || byChapter.has(chapterId)) continue;
    byChapter.set(chapterId, candidate);
  }
  const rows = ONBOARDING_REGISTRY.map((chapter): MemberChapterProgress => {
    const candidate = byChapter.get(chapter.id);
    const observedCompleteAt = isoOrNull(candidate?.observedCompleteAt);
    const probeEvidenceKey = probeEvidenceKeyOrNull(candidate?.probeEvidenceKey);
    const hasAcceptedProbe = Boolean(observedCompleteAt && probeEvidenceKey);
    return {
      chapterId: chapter.id,
      observedCompleteAt: hasAcceptedProbe ? observedCompleteAt : null,
      probeEvidenceKey: hasAcceptedProbe ? probeEvidenceKey : null,
      skippedAt: chapter.track === "personal" && chapter.skip === "member-skippable"
        ? isoOrNull(candidate?.skippedAt)
        : null,
      personalAccountSetupSkippedAt: chapter.id === "ch-04-accounts"
        ? isoOrNull(candidate?.personalAccountSetupSkippedAt)
        : null,
      lastSafeResumePoint: textOrNull(candidate?.lastSafeResumePoint),
      acknowledgedAt: isoOrNull(candidate?.acknowledgedAt),
      invalidatedAt: isoOrNull(candidate?.invalidatedAt),
    };
  });
  const declineCountByModule = Object.fromEntries(Object.entries(row.declineCountByModule ?? {})
    .filter(([chapterId, count]) => typeof chapterId === "string" && chapterId.trim()
      && Number.isInteger(count) && Number(count) >= 0)
    .map(([chapterId, count]) => [chapterId, Number(count)]));
  const declineMonthByModule = Object.fromEntries(Object.entries(row.declineMonthByModule ?? {})
    .filter(([chapterId, month]) => typeof chapterId === "string" && chapterId.trim()
      && typeof month === "string" && /^\d{4}-\d{2}$/.test(month))
    .map(([chapterId, month]) => [chapterId, month as string]));
  return {
    id: memberProgressId(context),
    householdId: context.householdId,
    memberId: context.memberId,
    registryVersion: ONBOARDING_REGISTRY_VERSION,
    rows,
    offersMuted: row.offersMuted === true,
    offersMutedUpdatedAt: isoOrNull(row.offersMutedUpdatedAt),
    declineCountByModule,
    declineMonthByModule,
    personalOfferHistory: shapedPersonalOfferHistory(row.personalOfferHistory),
    ...(row.practiceProof && typeof row.practiceProof === "object" ? { practiceProof: row.practiceProof } : {}),
    updatedAt: isoOrNull(row.updatedAt) ?? MISSING_ISO,
  };
}

export function memberProgress(household: Household, memberId: string): MemberOnboardingProgress {
  const member = household.members.find((candidate) => candidate.id === memberId && candidate.active);
  if (!member) throw new ValidationError("Choose an active household member.");
  const context = { environment: household.environment, householdId: household.householdId, memberId };
  const shaped = shapeMemberOnboardingProgress(member.onboardingProgress, context);
  if (shaped) return shaped;
  const empty = emptyMemberOnboardingProgress(context);
  if (member.onboardingProgress != null) return empty;
  const completed = acceptedHouseholdOnboarding(household);
  if (completed?.state !== "complete" || completed.confirmedByMemberIds.includes(memberId)) return empty;
  const inheritedAt = completed.completedAt ?? completed.updatedAt;
  const catchUp = new Set<ChapterId>(NEW_MEMBER_CATCH_UP_CHAPTER_IDS);
  return {
    ...empty,
    rows: empty.rows.map((row) => householdChapters().some((chapter) => chapter.id === row.chapterId)
      && !catchUp.has(row.chapterId)
      ? { ...row, acknowledgedAt: inheritedAt, lastSafeResumePoint: row.chapterId }
      : row),
    updatedAt: inheritedAt,
  };
}

export function chapterProgressSatisfied(row: MemberChapterProgress | undefined): boolean {
  const completedAt = [row?.observedCompleteAt, row?.acknowledgedAt, row?.skippedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return Boolean(completedAt && (!row?.invalidatedAt || completedAt > row.invalidatedAt));
}

function nextEligible(
  chapters: readonly OnboardingChapter[],
  progress: MemberOnboardingProgress,
): OnboardingChapter | null {
  const satisfied = new Set(progress.rows.filter(chapterProgressSatisfied).map((row) => row.chapterId));
  for (const chapter of chapters) {
    if (satisfied.has(chapter.id)) continue;
    if (chapter.dependsOn.every((dependencyId) => satisfied.has(dependencyId))) return chapter;
  }
  return null;
}

export function nextChapterFor(household: Household, memberId: string): OnboardingChapter | null {
  const progress = memberProgress(household, memberId);
  if (acceptedHouseholdOnboarding(household)?.forcedUnlock) {
    return nextEligible(personalModules(), progress);
  }
  const isComplete = acceptedHouseholdOnboarding(household)?.state === "complete";
  const householdChapter = isComplete
    ? nextEligible(requiredHouseholdChapters(), progress)
    : requiredHouseholdChapters().find((chapter) => !memberRequirementSatisfied(household, memberId, chapter.id)) ?? null;
  if (householdChapter) return householdChapter;
  // Chapter 12 remains the active finale after its proof is recorded. This
  // keeps the waiting-member and interrupted-unlock repair UI reachable until
  // the shared completion record is accepted.
  if (onboardingIsActive(household)) return chapterById("ch-12-ready");
  return nextEligible(personalModules(), progress);
}

/** The finale's fail-closed source of truth for household-track requirements. */
export function householdGatesOutstanding(household: Household): ChapterId[] {
  if (acceptedHouseholdOnboarding(household)?.state === "complete") return [];
  const activeMembers = household.members.filter((member) => member.active);
  return householdChapters()
    .filter((chapter) => chapter.contributesToFinalGate)
    .filter((chapter) => activeMembers.length === 0 || activeMembers.some((member) => {
      return !memberRequirementSatisfied(household, member.id, chapter.id);
    }))
    .map((chapter) => chapter.id);
}

export function mergeMemberProgress(
  serverValue: MemberOnboardingProgress,
  clientValue: MemberOnboardingProgress,
): MemberOnboardingProgress {
  const serverContext = contextForValue(serverValue);
  const clientContext = contextForValue(clientValue);
  const server = shapeMemberOnboardingProgress(serverValue, serverContext ?? undefined);
  const client = shapeMemberOnboardingProgress(clientValue, clientContext ?? undefined);
  if (!serverContext || !clientContext || !server || !client || server.id !== client.id
    || server.householdId !== client.householdId || server.memberId !== client.memberId) {
    throw new ValidationError("Onboarding progress belongs to one member and household.");
  }
  const serverRows = new Map(server.rows.map((row) => [row.chapterId, row]));
  const clientRows = new Map(client.rows.map((row) => [row.chapterId, row]));
  const rows = ONBOARDING_REGISTRY.map((chapter): MemberChapterProgress => {
    const left = serverRows.get(chapter.id) ?? emptyChapter(chapter.id);
    const right = clientRows.get(chapter.id) ?? emptyChapter(chapter.id);
    const invalidatedAt = later(left.invalidatedAt, right.invalidatedAt);
    const observedCompleteAt = earliestProofAfterInvalidation(
      left.observedCompleteAt,
      right.observedCompleteAt,
      invalidatedAt,
    );
    const evidenceCandidates = [left, right]
      .filter((row) => row.observedCompleteAt === observedCompleteAt && row.probeEvidenceKey)
      .map((row) => row.probeEvidenceKey as string)
      .sort();
    return {
      chapterId: chapter.id,
      observedCompleteAt,
      probeEvidenceKey: observedCompleteAt ? evidenceCandidates[0] ?? null : null,
      skippedAt: earliestProofAfterInvalidation(left.skippedAt, right.skippedAt, invalidatedAt),
      personalAccountSetupSkippedAt: earlier(
        left.personalAccountSetupSkippedAt,
        right.personalAccountSetupSkippedAt,
      ),
      lastSafeResumePoint: !left.lastSafeResumePoint
        ? right.lastSafeResumePoint
        : !right.lastSafeResumePoint
          ? left.lastSafeResumePoint
          : client.updatedAt > server.updatedAt
            ? right.lastSafeResumePoint
            : server.updatedAt > client.updatedAt
              ? left.lastSafeResumePoint
              : later(left.lastSafeResumePoint, right.lastSafeResumePoint),
      acknowledgedAt: earliestProofAfterInvalidation(left.acknowledgedAt, right.acknowledgedAt, invalidatedAt),
      invalidatedAt,
    };
  });
  const declineKeys = new Set([
    ...Object.keys(server.declineCountByModule),
    ...Object.keys(client.declineCountByModule),
    ...Object.keys(server.declineMonthByModule),
    ...Object.keys(client.declineMonthByModule),
  ]);
  const declineCountByModule: Record<ChapterId, number> = {};
  const declineMonthByModule: Record<ChapterId, string> = {};
  for (const chapterId of [...declineKeys].sort()) {
    const serverMonth = server.declineMonthByModule[chapterId];
    const clientMonth = client.declineMonthByModule[chapterId];
    const latestMonth = [serverMonth, clientMonth].filter((value): value is string => Boolean(value)).sort().at(-1);
    if (!latestMonth) {
      declineCountByModule[chapterId] = Math.max(
        server.declineCountByModule[chapterId] ?? 0,
        client.declineCountByModule[chapterId] ?? 0,
      );
      continue;
    }
    declineMonthByModule[chapterId] = latestMonth;
    declineCountByModule[chapterId] = Math.max(
      serverMonth === latestMonth ? server.declineCountByModule[chapterId] ?? 0 : 0,
      clientMonth === latestMonth ? client.declineCountByModule[chapterId] ?? 0 : 0,
    );
  }
  const personalOfferHistory = shapedPersonalOfferHistory([
    ...server.personalOfferHistory,
    ...client.personalOfferHistory,
  ]);
  for (const module of personalModules()) {
    const declined = personalOfferHistory.filter((row) => row.moduleId === module.id && row.declinedAt);
    const latestMonth = declined.flatMap((row) => row.declineMonth ? [row.declineMonth] : []).sort().at(-1);
    if (!latestMonth) continue;
    const historyCount = declined.filter((row) => row.declineMonth === latestMonth).length;
    const existingCount = declineMonthByModule[module.id] === latestMonth ? declineCountByModule[module.id] ?? 0 : 0;
    declineMonthByModule[module.id] = latestMonth;
    declineCountByModule[module.id] = Math.max(existingCount, historyCount);
  }
  const updatedAt = later(server.updatedAt, client.updatedAt) ?? MISSING_ISO;
  const serverOfferAt = server.offersMutedUpdatedAt ?? "";
  const clientOfferAt = client.offersMutedUpdatedAt ?? "";
  const offersMuted = clientOfferAt > serverOfferAt
    ? client.offersMuted
    : serverOfferAt > clientOfferAt
      ? server.offersMuted
      : server.offersMuted || client.offersMuted;
  const offersMutedUpdatedAt = later(server.offersMutedUpdatedAt, client.offersMutedUpdatedAt);
  return {
    ...server,
    ...(client.practiceProof && (!server.practiceProof || client.updatedAt >= server.updatedAt) ? { practiceProof: client.practiceProof } : {}),
    rows,
    offersMuted,
    offersMutedUpdatedAt,
    declineCountByModule,
    declineMonthByModule,
    personalOfferHistory,
    updatedAt,
  };
}
