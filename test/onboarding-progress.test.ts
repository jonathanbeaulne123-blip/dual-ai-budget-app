import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_REGISTRY,
  ONBOARDING_REGISTRY_VERSION,
  acceptHouseholdWrite,
  catalogHousehold,
  confirmHouseholdOnboarding,
  forceUnlockOnboarding,
  householdGatesOutstanding,
  memberProgress,
  mergeHouseholdOnboarding,
  mergeMemberProgress,
  mergePersonal,
  nextChapterFor,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  setOnboardingOffersMuted,
  shapeHouseholdOnboarding,
  skipPersonalStep,
  splitForSync,
  assembleHousehold,
  type Household,
  type MemberOnboardingProgress,
  type OnboardingChapter,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const AT_1 = "2026-09-03T14:00:00.000Z";
const AT_2 = "2026-09-03T14:01:00.000Z";

function withProgress(
  household: Household,
  memberId: string,
  update: (progress: MemberOnboardingProgress) => MemberOnboardingProgress,
): Household {
  const next = structuredClone(household);
  const progress = update(memberProgress(next, memberId));
  next.members = next.members.map((member) => member.id === memberId
    ? { ...member, onboardingProgress: progress }
    : member);
  return next;
}

function acknowledgeEveryHouseholdChapter(household: Household, memberId: string): Household {
  return withProgress(household, memberId, (progress) => ({
    ...progress,
    rows: progress.rows.map((row) => row.chapterId.startsWith("ch-")
      ? { ...row, acknowledgedAt: AT_1 }
      : row),
    updatedAt: AT_1,
  }));
}

function activeOnboarding(): Household {
  const proposed = proposeHouseholdOnboarding(catalogHousehold("development"), {
    memberId: BIANCA,
    at: AT_1,
  }).household;
  return confirmHouseholdOnboarding(proposed, {
    memberId: JONATHAN,
    at: AT_2,
  }).household;
}

describe("onboarding member progress", () => {
  it("keeps every progress command self-owned with exact refusal copy", () => {
    const household = catalogHousehold("development");
    const attempts = [
      () => recordChapterAcknowledgement(household, {
        memberId: BIANCA, chapterId: "ch-01-meet", createdBy: JONATHAN, at: AT_1,
      }),
      () => setOnboardingOffersMuted(household, {
        memberId: BIANCA, muted: true, createdBy: JONATHAN, at: AT_1,
      }),
      () => forceUnlockOnboarding(household, {
        memberId: BIANCA, createdBy: JONATHAN, at: AT_1,
      }),
    ];
    for (const attempt of attempts) expect(attempt).toThrow("Only you can record your own progress.");
    const missingActorAttempts = [
      () => Reflect.apply(recordChapterAcknowledgement, null, [household, {
        memberId: BIANCA, chapterId: "ch-01-meet", at: AT_1,
      }]),
      () => Reflect.apply(setOnboardingOffersMuted, null, [household, {
        memberId: BIANCA, muted: true, at: AT_1,
      }]),
      () => Reflect.apply(forceUnlockOnboarding, null, [household, {
        memberId: BIANCA, at: AT_1,
      }]),
    ];
    for (const attempt of missingActorAttempts) expect(attempt).toThrow("Only you can record your own progress.");
    expect(household.members.every((member) => member.onboardingProgress === undefined)).toBe(true);
  });

  it("never lets acknowledgement or the progress core claim an accepted probe", () => {
    const result = recordChapterAcknowledgement(catalogHousehold("development"), {
      memberId: BIANCA,
      chapterId: "ch-01-meet",
      createdBy: BIANCA,
      at: AT_1,
    });
    const row = memberProgress(result.household, BIANCA).rows.find((candidate) => candidate.chapterId === "ch-01-meet");
    expect(row).toMatchObject({
      acknowledgedAt: AT_1,
      lastSafeResumePoint: "ch-01-meet",
      observedCompleteAt: null,
      probeEvidenceKey: null,
    });
    expect(result).toMatchObject({ persistenceScope: "member-personal", personalMemberId: BIANCA, postedIds: [] });

    const source = readFileSync(new URL("../src/core/onboarding/progress.ts", import.meta.url), "utf8");
    expect(source).not.toContain(".tsx");
    expect(source).not.toMatch(/from\s+["'][^"']*(?:App|component|provider)[^"']*["']/i);
    expect(source).not.toMatch(/\bdocument\b/);
  });

  it("merges both device orderings identically without losing monotonic progress", () => {
    const base = memberProgress(catalogHousehold("development"), BIANCA);
    const server: MemberOnboardingProgress = {
      ...base,
      rows: base.rows.map((row) => row.chapterId === "ch-01-meet"
        ? {
            ...row,
            observedCompleteAt: "2026-09-03T15:00:00.000Z",
            probeEvidenceKey: "probe-later",
            lastSafeResumePoint: "scene-2",
          }
        : row),
      offersMuted: false,
      offersMutedUpdatedAt: null,
      declineCountByModule: { "pm-01": 1 },
      updatedAt: "2026-09-03T16:00:00.000Z",
    };
    const client: MemberOnboardingProgress = {
      ...base,
      rows: base.rows.map((row) => row.chapterId === "ch-01-meet"
        ? {
            ...row,
            observedCompleteAt: "2026-09-03T14:00:00.000Z",
            probeEvidenceKey: "probe-earliest",
            skippedAt: "2026-09-03T14:30:00.000Z",
            lastSafeResumePoint: "scene-9",
            acknowledgedAt: "2026-09-03T14:45:00.000Z",
          }
        : row),
      offersMuted: true,
      offersMutedUpdatedAt: "2026-09-03T16:30:00.000Z",
      declineCountByModule: { "pm-01": 2, "pm-02": 1 },
      updatedAt: "2026-09-03T17:00:00.000Z",
    };
    const left = mergeMemberProgress(server, client);
    const right = mergeMemberProgress(client, server);
    expect(left).toEqual(right);
    expect(left.rows.find((row) => row.chapterId === "ch-01-meet")).toMatchObject({
      observedCompleteAt: "2026-09-03T14:00:00.000Z",
      probeEvidenceKey: "probe-earliest",
      skippedAt: null,
      lastSafeResumePoint: "scene-9",
      acknowledgedAt: "2026-09-03T14:45:00.000Z",
    });
    expect(left).toMatchObject({
      offersMuted: true,
      offersMutedUpdatedAt: "2026-09-03T16:30:00.000Z",
      declineCountByModule: { "pm-01": 2, "pm-02": 1 },
      updatedAt: "2026-09-03T17:00:00.000Z",
    });

    const laterAcknowledgement = {
      ...server,
      updatedAt: "2026-09-03T18:00:00.000Z",
    };
    expect(mergeMemberProgress(client, laterAcknowledgement)).toMatchObject({
      offersMuted: true,
      offersMutedUpdatedAt: "2026-09-03T16:30:00.000Z",
      updatedAt: "2026-09-03T18:00:00.000Z",
    });
    expect(mergeMemberProgress(laterAcknowledgement, client)).toEqual(
      mergeMemberProgress(client, laterAcknowledgement),
    );

    const personalChapter: OnboardingChapter = {
      id: "pm-merge-test",
      registryVersion: ONBOARDING_REGISTRY_VERSION,
      track: "personal",
      order: 1,
      sitting: null,
      copyKey: "onboarding.personal.pm-merge-test",
      flavorKeys: ["one", "two", "three"],
      target: null,
      conductor: "self",
      approval: "member",
      skip: "member-skippable",
      timeBudgetSeconds: 60,
      pausePoints: [],
      actions: ["continue", "skip-personal"],
      dependsOn: [],
      contributesToFinalGate: false,
    };
    (ONBOARDING_REGISTRY as OnboardingChapter[]).push(personalChapter);
    try {
      const personalBase = memberProgress(catalogHousehold("development"), BIANCA);
      const skipped: MemberOnboardingProgress = {
        ...personalBase,
        rows: personalBase.rows.map((row) => row.chapterId === personalChapter.id
          ? { ...row, skippedAt: AT_1 }
          : row),
        updatedAt: AT_1,
      };
      const mergedSkip = mergeMemberProgress(personalBase, skipped);
      expect(mergedSkip.rows.find((row) => row.chapterId === personalChapter.id)?.skippedAt).toBe(AT_1);
      expect(mergeMemberProgress(skipped, personalBase)).toEqual(mergedSkip);
    } finally {
      (ONBOARDING_REGISTRY as OnboardingChapter[]).pop();
    }
  });

  it("returns only dependency-safe chapters and withholds personal modules while household mode is active", () => {
    let household = catalogHousehold("development");
    expect(nextChapterFor(household, BIANCA, "2026-09-03")?.id).toBe("ch-01-meet");
    household = withProgress(household, BIANCA, (progress) => ({
      ...progress,
      rows: progress.rows.map((row) => row.chapterId === "ch-01-meet"
        ? { ...row, acknowledgedAt: AT_1 }
        : row.chapterId === "ch-03-charter"
          ? { ...row, acknowledgedAt: AT_1 }
          : row),
      updatedAt: AT_1,
    }));
    expect(nextChapterFor(household, BIANCA, "2026-09-03")?.id).toBe("ch-02-household");

    const personalChapter: OnboardingChapter = {
      id: "pm-test",
      registryVersion: ONBOARDING_REGISTRY_VERSION,
      track: "personal",
      order: 1,
      sitting: null,
      copyKey: "onboarding.personal.pm-test",
      flavorKeys: ["one", "two", "three"],
      target: null,
      conductor: "self",
      approval: "member",
      skip: "member-skippable",
      timeBudgetSeconds: 60,
      pausePoints: [],
      actions: ["continue", "skip-personal"],
      dependsOn: [],
      contributesToFinalGate: false,
    };
    (ONBOARDING_REGISTRY as OnboardingChapter[]).push(personalChapter);
    try {
      expect(() => Reflect.apply(skipPersonalStep, null, [activeOnboarding(), {
        memberId: BIANCA, chapterId: "pm-test", at: "2026-09-03T17:58:00.000Z",
      }])).toThrow("Only you can record your own progress.");
      const forcedBeforeHouseholdProgress = forceUnlockOnboarding(activeOnboarding(), {
        memberId: BIANCA, createdBy: BIANCA, at: "2026-09-03T17:59:00.000Z",
      }).household;
      expect(nextChapterFor(forcedBeforeHouseholdProgress, BIANCA, "2026-09-03")?.id).toBe("pm-test");

      let running = activeOnboarding();
      running = acknowledgeEveryHouseholdChapter(running, BIANCA);
      expect(nextChapterFor(running, BIANCA, "2026-09-03")).toBeNull();
      const stopped = forceUnlockOnboarding(running, {
        memberId: BIANCA, createdBy: BIANCA, at: "2026-09-03T18:00:00.000Z",
      }).household;
      expect(nextChapterFor(stopped, BIANCA, "2026-09-03")?.id).toBe("pm-test");
      expect(skipPersonalStep(stopped, {
        memberId: BIANCA, chapterId: "pm-test", createdBy: BIANCA, at: "2026-09-03T18:01:00.000Z",
      }).postedIds).toEqual([]);
      expect(() => skipPersonalStep(stopped, {
        memberId: BIANCA, chapterId: "pm-test", createdBy: JONATHAN, at: "2026-09-03T18:01:00.000Z",
      })).toThrow("Only you can record your own progress.");
    } finally {
      (ONBOARDING_REGISTRY as OnboardingChapter[]).pop();
    }
  });

  it("uses one fail-closed selector for finale gates and never includes personal modules", () => {
    let household = catalogHousehold("development");
    household = acknowledgeEveryHouseholdChapter(household, BIANCA);
    household = acknowledgeEveryHouseholdChapter(household, JONATHAN);
    household = withProgress(household, JONATHAN, (progress) => ({
      ...progress,
      rows: progress.rows.map((row) => row.chapterId === "ch-06-fund"
        ? { ...row, acknowledgedAt: null }
        : row),
    }));
    expect(householdGatesOutstanding(household)).toEqual(["ch-06-fund"]);
    expect(householdGatesOutstanding(catalogHousehold("development"))).toEqual(
      ONBOARDING_REGISTRY.filter((chapter) => chapter.track === "household").map((chapter) => chapter.id),
    );

    const onlySignedInMember = acknowledgeEveryHouseholdChapter(catalogHousehold("development"), BIANCA);
    const biancaReplica = splitForSync(onlySignedInMember, BIANCA);
    expect(biancaReplica.shared.members.every((member) => member.onboardingProgress === undefined)).toBe(true);
    expect(householdGatesOutstanding(assembleHousehold(biancaReplica.shared, biancaReplica.personal))).toEqual([]);
  });

  it("keeps the Development force unlock stopped-incomplete forever and refuses Production", async () => {
    const production = catalogHousehold("production");
    expect(() => forceUnlockOnboarding(production, {
      memberId: BIANCA, createdBy: BIANCA, at: AT_1,
    })).toThrow("Not available in this environment.");

    const previous = activeOnboarding();
    const result = forceUnlockOnboarding(previous, {
      memberId: BIANCA, createdBy: BIANCA, at: "2026-09-03T18:00:00.000Z",
    });
    expect(result.household.householdOnboarding).toMatchObject({
      state: "stopped-incomplete",
      forcedUnlock: true,
      completedAt: null,
      completionDigest: null,
    });
    const forged = await acceptHouseholdWrite({
      previous,
      candidate: result.household,
      confirmationId: "force-unlock-forged",
      commandKind: result.undo.commandKind,
      postedIds: result.postedIds,
      actingMemberId: JONATHAN,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(forged).toMatchObject({ ok: false, postedNothing: true });
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate: result.household,
      confirmationId: "force-unlock-test",
      commandKind: result.undo.commandKind,
      postedIds: result.postedIds,
      actingMemberId: BIANCA,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(accepted.ok).toBe(true);

    const forgedComplete = {
      ...result.household.householdOnboarding!,
      state: "complete" as const,
      completedAt: "2099-01-01T00:00:00.000Z",
      completionDigest: "forged",
    };
    expect(shapeHouseholdOnboarding(forgedComplete)).toMatchObject({
      state: "stopped-incomplete",
      forcedUnlock: true,
      completedAt: null,
      completionDigest: null,
    });
    expect(shapeHouseholdOnboarding({
      ...forgedComplete,
      environment: "production",
    })).toMatchObject({
      state: "blocked",
      forcedUnlock: false,
      completedAt: null,
      completionDigest: null,
    });
    const completeReplica = {
      ...previous.householdOnboarding!,
      state: "complete" as const,
      proposedAt: "2099-01-01T00:00:00.000Z",
      completedAt: "2026-09-03T17:00:00.000Z",
      completionDigest: "accepted-before-development-unlock",
      updatedAt: "2026-09-03T17:00:00.000Z",
    };
    expect(mergeHouseholdOnboarding(completeReplica, result.household.householdOnboarding, {
      environment: previous.environment,
      householdId: previous.householdId,
      members: previous.members,
    })).toMatchObject({
      state: "stopped-incomplete",
      forcedUnlock: true,
      completedAt: null,
      completionDigest: null,
    });
  });

  it("keeps progress in one member's Personal envelope and converges it there", () => {
    const first = recordChapterAcknowledgement(catalogHousehold("development"), {
      memberId: BIANCA, chapterId: "ch-01-meet", createdBy: BIANCA, at: AT_1,
    }).household;
    const muted = setOnboardingOffersMuted(first, {
      memberId: BIANCA, muted: true, createdBy: BIANCA, at: AT_2,
    }).household;
    const bianca = splitForSync(muted, BIANCA);
    const jonathan = splitForSync(muted, JONATHAN);
    expect(bianca.personal.onboardingProgress?.offersMuted).toBe(true);
    expect(jonathan.personal.onboardingProgress).toBeUndefined();
    expect(bianca.shared.members.every((member) => member.onboardingProgress === undefined)).toBe(true);
    expect(memberProgress(assembleHousehold(bianca.shared, bianca.personal), BIANCA).offersMuted).toBe(true);

    const later = recordChapterAcknowledgement(muted, {
      memberId: BIANCA, chapterId: "ch-02-household", createdBy: BIANCA, at: "2026-09-03T15:00:00.000Z",
    }).household;
    const merged = mergePersonal(bianca.personal, splitForSync(later, BIANCA).personal);
    expect(merged.onboardingProgress?.rows.filter((row) => row.acknowledgedAt).map((row) => row.chapterId)).toEqual([
      "ch-01-meet",
      "ch-02-household",
    ]);
  });
});
