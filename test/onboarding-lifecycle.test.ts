import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  acceptedHouseholdOnboarding,
  acceptHouseholdWrite,
  approvalsFor,
  catalogHousehold,
  chapterProgressSatisfied,
  completeSyntheticDemoOnboarding,
  copy,
  confirmHouseholdOnboarding,
  DEMO_SUITE_COMMAND_KIND,
  householdGatesOutstanding,
  memberProgress,
  mergeHouseholdOnboarding,
  mergeMemberProgress,
  nextChapterFor,
  onboardingLifecycleState,
  onboardingRegistryMigrationPlan,
  ordinaryHerculesAvailable,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  resumeHouseholdOnboarding,
  seedDemoHousehold,
  seededOnboardingApprovalsValid,
  shouldShowOnboardingShell,
  syntheticDemoOnboardingIsValid,
  type Household,
  type HouseholdScopeObservation,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const ALEX = "MEM-003";
const TODAY = "2026-09-30";
const COMPLETED_AT = "2026-09-30T12:00:00.000Z";

function completed(): Household {
  return completeSyntheticDemoOnboarding(catalogHousehold("development"), {
    at: COMPLETED_AT,
    sourceKey: "lifecycle-test",
  });
}

function resolvedFor(
  household: Household,
  memberId: string,
  partnerId: string,
  observedAt = "2026-09-30T12:05:00.000Z",
): Extract<HouseholdScopeObservation, { kind: "resolved" }> {
  return {
    kind: "resolved",
    scope: { environment: household.environment, householdId: household.householdId, memberId },
    currentMemberId: memberId,
    seatMemberIds: [memberId, partnerId].sort(),
    observedAt,
  };
}

describe("onboarding lifecycle", () => {
  it("keeps a completed household complete when its Charter changes", () => {
    const household = completed();
    household.charter = undefined;

    expect(onboardingLifecycleState(household)).toBe("complete");
    expect(householdGatesOutstanding(household)).toEqual([]);
    expect(ordinaryHerculesAvailable(household)).toBe(true);
    expect(shouldShowOnboardingShell(household, BIANCA, TODAY)).toBe(false);
    expect(syntheticDemoOnboardingIsValid(household)).toBe(false);
  });

  it("keeps completion sticky when an older stopped replica arrives", () => {
    const household = completed();
    const complete = household.householdOnboarding!;
    const staleStopped = {
      ...complete,
      state: "stopped-incomplete" as const,
      stoppedAt: "2026-09-30T11:59:00.000Z",
      stoppedByMemberIds: [BIANCA],
      stoppedSolo: true,
      completedAt: null,
      completionDigest: null,
      updatedAt: "2026-09-30T11:59:00.000Z",
    };
    expect(mergeHouseholdOnboarding(complete, staleStopped, {
      environment: household.environment,
      householdId: household.householdId,
      members: household.members,
    })?.state).toBe("complete");
  });

  it("gives a replacement member only Chapters 1, 2, and 8 without relocking the existing member", () => {
    let household = completed();
    household.members = [
      household.members.find((member) => member.id === BIANCA)!,
      { ...household.members.find((member) => member.id === JONATHAN)!, active: false },
      { id: ALEX, name: "Alex", color: "#785a9a", active: true, updatedAt: COMPLETED_AT },
    ];

    expect(nextChapterFor(household, ALEX, TODAY)?.id).toBe("ch-01-meet");
    expect(copy("lifecycle.new-member.intro")).toContain("short, private catch-up");
    expect(copy("onboarding.household.ch-01-meet")).toContain("never post money or confirm for you");
    expect(shouldShowOnboardingShell(household, ALEX, TODAY)).toBe(true);
    expect(shouldShowOnboardingShell(household, BIANCA, TODAY)).toBe(false);
    expect(householdGatesOutstanding(household)).toEqual([]);

    household = recordChapterAcknowledgement(household, {
      memberId: ALEX,
      createdBy: ALEX,
      chapterId: "ch-01-meet",
      at: "2026-09-30T12:04:00.000Z",
    }).household;
    expect(nextChapterFor(household, ALEX, TODAY)?.id).toBe("ch-02-household");

    household = recordObservedChapterCompletion(household, {
      memberId: ALEX,
      createdBy: ALEX,
      chapterId: "ch-02-household",
      observation: resolvedFor(household, ALEX, BIANCA),
      at: "2026-09-30T12:06:00.000Z",
    }).household;
    expect(nextChapterFor(household, ALEX, TODAY)?.id).toBe("ch-08-cadence");
    expect(householdGatesOutstanding(household)).toEqual([]);
  });

  it("does not inherit Development completion into Production", () => {
    const production = { ...completed(), environment: "production" as const };
    expect(acceptedHouseholdOnboarding(production)).toBeNull();
    expect(onboardingLifecycleState(production)).toBe("inactive");
    expect(ordinaryHerculesAvailable(production)).toBe(true);
  });

  it("seeds a deterministic completed demo with both Ready approvals and no invitation", () => {
    const household = seedDemoHousehold({ today: TODAY, environment: "development" });
    const record = acceptedHouseholdOnboarding(household)!;

    expect(record.state).toBe("complete");
    expect(record.completionDigest).toMatch(/^ready-demo-v1-[a-f0-9]{64}$/);
    expect(approvalsFor(household, "ready", record.completionDigest!)).toHaveLength(2);
    expect(householdGatesOutstanding(household)).toEqual([]);
    expect(ordinaryHerculesAvailable(household)).toBe(true);
    expect(shouldShowOnboardingShell(household, BIANCA, TODAY)).toBe(false);
    expect(seededOnboardingApprovalsValid(household)).toBe(true);
    expect(syntheticDemoOnboardingIsValid(household)).toBe(false);
  });

  it("accepts the seeded Demo Table first write without widening ordinary approval commands", async () => {
    const household = seedDemoHousehold({ today: TODAY, environment: "development" });
    const missingApproval = { ...household, onboardingApprovals: household.onboardingApprovals?.slice(0, 1) };
    const duplicateMemberApproval = structuredClone(household);
    duplicateMemberApproval.onboardingApprovals = [
      duplicateMemberApproval.onboardingApprovals![0]!,
      { ...duplicateMemberApproval.onboardingApprovals![0]!, id: "ONB-APP-DEMO-DUPLICATE" },
    ];
    const extraApproval = structuredClone(household);
    extraApproval.onboardingApprovals = [
      ...extraApproval.onboardingApprovals!,
      { ...extraApproval.onboardingApprovals![0]!, id: "ONB-APP-DEMO-EXTRA", scope: "proposal" },
    ];
    const wrongDigest = structuredClone(household);
    wrongDigest.onboardingApprovals![0]!.digest = `${wrongDigest.onboardingApprovals![0]!.digest}-changed`;
    const forgedDigest = structuredClone(household);
    forgedDigest.householdOnboarding!.completionDigest = `ready-demo-v1-${"0".repeat(64)}`;
    const absentDigest = structuredClone(household);
    absentDigest.householdOnboarding!.completionDigest = null;
    const thirdActiveMember = structuredClone(household);
    thirdActiveMember.members.push({
      ...thirdActiveMember.members[0]!,
      id: "MEM-003",
      name: "Third member",
    });
    const incompleteProgress = structuredClone(household);
    incompleteProgress.members[0]!.onboardingProgress!.rows[0]!.acknowledgedAt = null;
    for (const invalid of [
      { ...household, environment: "production" as const },
      missingApproval,
      duplicateMemberApproval,
      extraApproval,
      wrongDigest,
      forgedDigest,
      absentDigest,
      thirdActiveMember,
      incompleteProgress,
    ]) expect(seededOnboardingApprovalsValid(invalid)).toBe(false);
    const adapters = {
      ingest: async () => ({ ok: true }),
      persist: async () => undefined,
    };
    const accepted = await acceptHouseholdWrite({
      previous: null,
      candidate: household,
      confirmationId: "CONFIRM-DEMO-TABLE",
      postedIds: [],
      actingMemberId: household.members.find((member) => member.active)!.id,
      adapters,
    });
    expect(accepted.ok).toBe(true);

    const acceptedSuite = await acceptHouseholdWrite({
      previous: catalogHousehold("development"),
      candidate: {
        ...household,
        syntheticFixture: { kind: "hearth-demo-suite" } as never,
      },
      confirmationId: "CONFIRM-DEMO-SUITE-WITH-OPEN-HOUSEHOLD",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId: household.members.find((member) => member.active)!.id,
      adapters,
    });
    expect(acceptedSuite.ok).toBe(true);

    for (const [candidate, postedIds] of [
      [household, ["forged-posted-id"]],
      [{ ...household, environment: "production" as const }, []],
      [missingApproval, []],
      [duplicateMemberApproval, []],
      [extraApproval, []],
      [wrongDigest, []],
      [forgedDigest, []],
      [absentDigest, []],
      [thirdActiveMember, []],
      [incompleteProgress, []],
    ] as const) {
      const outcome = await acceptHouseholdWrite({
        previous: null,
        candidate,
        confirmationId: `REJECT-DEMO-TABLE-${postedIds.length}-${candidate.onboardingApprovals?.length ?? 0}-${candidate.members.length}`,
        postedIds: [...postedIds],
        actingMemberId: household.members.find((member) => member.active)!.id,
        adapters,
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.postedNothing).toBe(true);
    }

    for (const commandKind of ["approveOnboardingProposal", "approveOnboardingReady"] as const) {
      const ordinaryApproval = await acceptHouseholdWrite({
        previous: null,
        candidate: household,
        confirmationId: `REJECT-ORDINARY-${commandKind}`,
        commandKind,
        postedIds: [],
        actingMemberId: household.members.find((member) => member.active)!.id,
        adapters,
      });
      expect(ordinaryApproval).toMatchObject({
        ok: false,
        postedNothing: true,
        userMessage: "Only you can approve for yourself.",
      });
    }
  });

  it("re-probes a stopped run, demotes stale facts, and converges against an old replica", () => {
    const stopped = completed();
    stopped.householdOnboarding = {
      ...stopped.householdOnboarding!,
      state: "stopped-incomplete",
      completedAt: null,
      completionDigest: null,
      stoppedAt: "2026-09-30T12:10:00.000Z",
      stoppedByMemberIds: [BIANCA, JONATHAN],
    };
    stopped.charter = undefined;
    const oldReplica = structuredClone(memberProgress(stopped, BIANCA));

    let household = resumeHouseholdOnboarding(stopped, {
      memberId: BIANCA,
      at: "2026-09-30T12:20:00.000Z",
    }).household;
    household = confirmHouseholdOnboarding(household, {
      memberId: JONATHAN,
      at: "2026-09-30T12:21:00.000Z",
    }).household;

    const refreshed = memberProgress(household, BIANCA);
    expect(refreshed.rows.find((row) => row.chapterId === "ch-01-meet")?.invalidatedAt).toBeNull();
    expect(refreshed.rows.find((row) => row.chapterId === "ch-02-household")?.invalidatedAt).toBe("2026-09-30T12:20:00.000Z");
    expect(refreshed.rows.find((row) => row.chapterId === "ch-03-charter")?.invalidatedAt).toBe("2026-09-30T12:20:00.000Z");
    expect(nextChapterFor(household, BIANCA, TODAY)?.id).toBe("ch-02-household");

    const converged = mergeMemberProgress(oldReplica, refreshed);
    const ch3 = converged.rows.find((row) => row.chapterId === "ch-03-charter")!;
    expect(ch3.invalidatedAt).toBe("2026-09-30T12:20:00.000Z");

    household = recordObservedChapterCompletion(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      chapterId: "ch-02-household",
      observation: resolvedFor(household, BIANCA, JONATHAN, "2026-09-30T12:22:00.000Z"),
      at: "2026-09-30T12:22:00.000Z",
    }).household;
    const reprobed = mergeMemberProgress(oldReplica, memberProgress(household, BIANCA));
    const ch2 = reprobed.rows.find((row) => row.chapterId === "ch-02-household")!;
    expect(ch2.observedCompleteAt).toBe("2026-09-30T12:22:00.000Z");
    expect(chapterProgressSatisfied(ch2)).toBe(true);
  });

  it("routes version changes to repair and fails closed on an unknown chapter id", () => {
    const oldVersion = completed();
    oldVersion.householdOnboarding = { ...oldVersion.householdOnboarding!, registryVersion: 0 };
    expect(onboardingRegistryMigrationPlan(oldVersion)).toEqual({ kind: "repair", fromVersion: 0, toVersion: 1 });
    expect(onboardingLifecycleState(oldVersion)).toBe("repair");

    const unknown = completed();
    const progress = unknown.members[0]!.onboardingProgress!;
    unknown.members[0]!.onboardingProgress = {
      ...progress,
      rows: [...progress.rows, { ...progress.rows[0]!, chapterId: "ch-unknown" }],
    };
    expect(onboardingRegistryMigrationPlan(unknown)).toEqual({
      kind: "blocked",
      reason: "unknown-chapter-id",
      chapterId: "ch-unknown",
    });
  });

  it("keeps lifecycle policy pure and outside money authority", () => {
    const source = readFileSync(new URL("../src/core/onboarding/lifecycle.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\b(document|window|localStorage|sessionStorage|fetch|supabase)\b/);
    expect(source).not.toMatch(/acceptHouseholdWrite|postEntry|postTransfer|\.tsx["']/);
  });
});
