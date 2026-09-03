import type { DateKey } from "../calendar.ts";
import type { Environment, Household } from "../types.ts";
import { ValidationError } from "../types.ts";
import {
  ONBOARDING_REGISTRY,
  ONBOARDING_REGISTRY_VERSION,
  householdChapters,
  personalModules,
} from "./registry.ts";
import { onboardingIsActive } from "./mode.ts";
import type { ChapterId, OnboardingChapter } from "./types.ts";

const MISSING_ISO = "1970-01-01T00:00:00.000Z";

export type MemberChapterProgress = {
  chapterId: ChapterId;
  /** Accepted typed probe evidence only. Ordinary acknowledgement commands never write this field. */
  observedCompleteAt: string | null;
  probeEvidenceKey: string | null;
  /** Only personal, member-skippable modules may carry this field. */
  skippedAt: string | null;
  lastSafeResumePoint: string | null;
  acknowledgedAt: string | null;
};

export type MemberOnboardingProgress = {
  id: string;
  householdId: string;
  memberId: string;
  registryVersion: number;
  rows: MemberChapterProgress[];
  offersMuted: boolean;
  declineCountByModule: Record<ChapterId, number>;
  updatedAt: string;
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
  const environment = environments.find((candidate) => row.id === memberProgressId({
    environment: candidate,
    householdId,
    memberId,
  }));
  return environment ? { environment, householdId, memberId } : null;
}

function emptyChapter(chapterId: ChapterId): MemberChapterProgress {
  return {
    chapterId,
    observedCompleteAt: null,
    probeEvidenceKey: null,
    skippedAt: null,
    lastSafeResumePoint: null,
    acknowledgedAt: null,
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
    declineCountByModule: {},
    updatedAt: MISSING_ISO,
  };
}

/** Defensive member-scoped shape. Invalid identity or registry versions are refused. */
export function shapeMemberOnboardingProgress(
  value: unknown,
  expected?: Partial<ProgressContext>,
): MemberOnboardingProgress | null {
  const context = contextForValue(value, expected);
  if (!context || !value || typeof value !== "object") return null;
  const row = value as Partial<MemberOnboardingProgress>;
  if (row.registryVersion !== ONBOARDING_REGISTRY_VERSION) return null;
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
    const probeEvidenceKey = textOrNull(candidate?.probeEvidenceKey);
    const hasAcceptedProbe = Boolean(observedCompleteAt && probeEvidenceKey);
    return {
      chapterId: chapter.id,
      observedCompleteAt: hasAcceptedProbe ? observedCompleteAt : null,
      probeEvidenceKey: hasAcceptedProbe ? probeEvidenceKey : null,
      skippedAt: chapter.track === "personal" && chapter.skip === "member-skippable"
        ? isoOrNull(candidate?.skippedAt)
        : null,
      lastSafeResumePoint: textOrNull(candidate?.lastSafeResumePoint),
      acknowledgedAt: isoOrNull(candidate?.acknowledgedAt),
    };
  });
  const declineCountByModule = Object.fromEntries(Object.entries(row.declineCountByModule ?? {})
    .filter(([chapterId, count]) => typeof chapterId === "string" && chapterId.trim()
      && Number.isInteger(count) && Number(count) >= 0)
    .map(([chapterId, count]) => [chapterId, Number(count)]));
  return {
    id: memberProgressId(context),
    householdId: context.householdId,
    memberId: context.memberId,
    registryVersion: ONBOARDING_REGISTRY_VERSION,
    rows,
    offersMuted: row.offersMuted === true,
    declineCountByModule,
    updatedAt: isoOrNull(row.updatedAt) ?? MISSING_ISO,
  };
}

export function memberProgress(household: Household, memberId: string): MemberOnboardingProgress {
  const member = household.members.find((candidate) => candidate.id === memberId && candidate.active);
  if (!member) throw new ValidationError("Choose an active household member.");
  const context = { environment: household.environment, householdId: household.householdId, memberId };
  return shapeMemberOnboardingProgress(member.onboardingProgress, context)
    ?? emptyMemberOnboardingProgress(context);
}

function chapterSatisfied(row: MemberChapterProgress | undefined): boolean {
  return Boolean(row?.observedCompleteAt || row?.acknowledgedAt || row?.skippedAt);
}

function nextEligible(
  chapters: readonly OnboardingChapter[],
  progress: MemberOnboardingProgress,
): OnboardingChapter | null {
  const satisfied = new Set(progress.rows.filter(chapterSatisfied).map((row) => row.chapterId));
  for (const chapter of chapters) {
    if (satisfied.has(chapter.id)) continue;
    if (chapter.dependsOn.every((dependencyId) => satisfied.has(dependencyId))) return chapter;
  }
  return null;
}

export function nextChapterFor(household: Household, memberId: string, today: DateKey): OnboardingChapter | null {
  void today;
  const progress = memberProgress(household, memberId);
  const householdChapter = nextEligible(householdChapters(), progress);
  if (householdChapter) return householdChapter;
  if (onboardingIsActive(household)) return null;
  return nextEligible(personalModules(), progress);
}

/** The finale's fail-closed source of truth for household-track requirements. */
export function householdGatesOutstanding(household: Household): ChapterId[] {
  const members = household.members.filter((member) => member.active);
  return householdChapters()
    .filter((chapter) => chapter.contributesToFinalGate)
    .filter((chapter) => members.length === 0 || members.some((member) => {
      const row = memberProgress(household, member.id).rows.find((candidate) => candidate.chapterId === chapter.id);
      return !chapterSatisfied(row);
    }))
    .map((chapter) => chapter.id);
}

export function mergeMemberProgress(
  serverValue: MemberOnboardingProgress,
  clientValue: MemberOnboardingProgress,
): MemberOnboardingProgress {
  if (serverValue.id !== clientValue.id
    || serverValue.householdId !== clientValue.householdId
    || serverValue.memberId !== clientValue.memberId
    || serverValue.registryVersion !== clientValue.registryVersion) {
    throw new ValidationError("Onboarding progress belongs to one member and household.");
  }
  const context = contextForValue(serverValue);
  if (!context) throw new ValidationError("Onboarding progress belongs to one member and household.");
  const server = shapeMemberOnboardingProgress(serverValue, context);
  const client = shapeMemberOnboardingProgress(clientValue, context);
  if (!server || !client) throw new ValidationError("Onboarding progress belongs to one member and household.");
  const serverRows = new Map(server.rows.map((row) => [row.chapterId, row]));
  const clientRows = new Map(client.rows.map((row) => [row.chapterId, row]));
  const rows = ONBOARDING_REGISTRY.map((chapter): MemberChapterProgress => {
    const left = serverRows.get(chapter.id) ?? emptyChapter(chapter.id);
    const right = clientRows.get(chapter.id) ?? emptyChapter(chapter.id);
    const observedCompleteAt = earlier(left.observedCompleteAt, right.observedCompleteAt);
    const evidenceCandidates = [left, right]
      .filter((row) => row.observedCompleteAt === observedCompleteAt && row.probeEvidenceKey)
      .map((row) => row.probeEvidenceKey as string)
      .sort();
    return {
      chapterId: chapter.id,
      observedCompleteAt,
      probeEvidenceKey: observedCompleteAt ? evidenceCandidates[0] ?? null : null,
      skippedAt: earlier(left.skippedAt, right.skippedAt),
      lastSafeResumePoint: !left.lastSafeResumePoint
        ? right.lastSafeResumePoint
        : !right.lastSafeResumePoint
          ? left.lastSafeResumePoint
          : client.updatedAt > server.updatedAt
            ? right.lastSafeResumePoint
            : server.updatedAt > client.updatedAt
              ? left.lastSafeResumePoint
              : later(left.lastSafeResumePoint, right.lastSafeResumePoint),
      acknowledgedAt: earlier(left.acknowledgedAt, right.acknowledgedAt),
    };
  });
  const declineKeys = new Set([
    ...Object.keys(server.declineCountByModule),
    ...Object.keys(client.declineCountByModule),
  ]);
  const declineCountByModule = Object.fromEntries([...declineKeys].sort().map((chapterId) => [
    chapterId,
    Math.max(server.declineCountByModule[chapterId] ?? 0, client.declineCountByModule[chapterId] ?? 0),
  ]));
  const updatedAt = later(server.updatedAt, client.updatedAt) ?? MISSING_ISO;
  const offersMuted = client.updatedAt > server.updatedAt
    ? client.offersMuted
    : server.updatedAt > client.updatedAt
      ? server.offersMuted
      : server.offersMuted || client.offersMuted;
  return {
    ...server,
    rows,
    offersMuted,
    declineCountByModule,
    updatedAt,
  };
}
