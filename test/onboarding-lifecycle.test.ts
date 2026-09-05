import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  acceptedHouseholdOnboarding,
  approvalsFor,
  catalogHousehold,
  completeSyntheticDemoOnboarding,
  copy,
  confirmHouseholdOnboarding,
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

function resolvedFor(household: Household, memberId: string, partnerId: string): HouseholdScopeObservation {
  return {
    kind: "resolved",
    scope: { environment: household.environment, householdId: household.householdId, memberId },
    currentMemberId: memberId,
    seatMemberIds: [memberId, partnerId].sort(),
    observedAt: "2026-09-30T12:05:00.000Z",
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
