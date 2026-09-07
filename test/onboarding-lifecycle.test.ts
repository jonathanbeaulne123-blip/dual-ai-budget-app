import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  acceptedHouseholdOnboarding,
  acceptHouseholdWrite,
  adoptAcceptedOnboardingEvidence,
  adoptExistingOnboardingEvidence,
  approvalsFor,
  assertDemoReplacementAllowed,
  catalogHousehold,
  chapterProgressSatisfied,
  completeSyntheticDemoOnboarding,
  copy,
  confirmHouseholdOnboarding,
  DEMO_SUITE_COMMAND_KIND,
  evidenceFor,
  financialAuditHash,
  householdGatesOutstanding,
  householdChapters,
  ONBOARDING_REGISTRY_VERSION,
  memberProgress,
  memberNeedsAcceptedOnboardingEvidenceAdoption,
  mergeHouseholdOnboarding,
  mergeMemberProgress,
  newHouseholdTemplate,
  nextChapterFor,
  onboardingLifecycleState,
  onboardingRegistryMigrationPlan,
  ordinaryHerculesAvailable,
  personalTrackAvailable,
  offerHouseholdOnboarding,
  probeEvidenceKey,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  resumeHouseholdOnboarding,
  seedDemoHousehold,
  seededOnboardingApprovalsValid,
  shapeHouseholdOnboarding,
  shouldShowOnboardingShell,
  syntheticDemoOnboardingIsValid,
  todayKey,
  type Household,
  type HouseholdScopeObservation,
} from "../src/core/index.ts";
import { assertHouseholdFundTransition } from "../src/core/householdFund.ts";
import {
  BIANCA as FIXTURE_BIANCA,
  existingBooksActivationAt,
  existingBooksHousehold,
  JONATHAN as FIXTURE_JONATHAN,
} from "./fixtures/existing-books-onboarding.ts";

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
  it("adopts only accepted pre-existing evidence and keeps the four live chapters for both people", async () => {
    const activationAt = existingBooksActivationAt();
    const before = existingBooksHousehold(activationAt);
    let household = offerHouseholdOnboarding(before, {
      memberId: FIXTURE_BIANCA,
      at: new Date(Date.parse(activationAt) - 120_000).toISOString(),
    }).household;
    household = proposeHouseholdOnboarding(household, {
      memberId: FIXTURE_BIANCA,
      at: new Date(Date.parse(activationAt) - 60_000).toISOString(),
    }).household;
    household = confirmHouseholdOnboarding(household, {
      memberId: FIXTURE_JONATHAN,
      at: activationAt,
    }).household;
    const financialBeforeAdoption = await financialAuditHash(household);
    household = adoptExistingOnboardingEvidence(household, {
      memberId: FIXTURE_BIANCA,
      createdBy: FIXTURE_BIANCA,
    }).household;
    household = adoptExistingOnboardingEvidence(household, {
      memberId: FIXTURE_JONATHAN,
      createdBy: FIXTURE_JONATHAN,
    }).household;
    expect(await financialAuditHash(household)).toBe(financialBeforeAdoption);
    expect(acceptedHouseholdOnboarding(household)).toMatchObject({
      state: "active",
      completedAt: null,
      completionDigest: null,
    });
    const adoptedChapterIds = [
      "ch-03-charter",
      "ch-04-accounts",
      "ch-05-opening",
      "ch-06-fund",
      "ch-07-recurrences",
      "ch-09-categories",
      "ch-10-estimates",
      "ch-11-plan",
    ];
    const liveChapterIds = ["ch-01-meet", "ch-02-household", "ch-08-cadence", "ch-12-ready"];

    for (const memberId of [FIXTURE_BIANCA, FIXTURE_JONATHAN]) {
      expect(memberNeedsAcceptedOnboardingEvidenceAdoption(household, memberId)).toBe(false);
      const rows = new Map(memberProgress(household, memberId).rows.map((row) => [row.chapterId, row]));
      for (const chapterId of adoptedChapterIds) {
        const projected = evidenceFor(before, chapterId, memberId, {
          today: todayKey(new Date(activationAt), before.timezone),
        });
        expect(projected.kind).toBe("accepted");
        if (projected.kind !== "accepted") throw new Error(`Expected ${chapterId} evidence.`);
        expect(rows.get(chapterId)).toMatchObject({
          observedCompleteAt: projected.card.observedAt,
          probeEvidenceKey: probeEvidenceKey(projected.card),
          acknowledgedAt: null,
        });
      }
      for (const chapterId of liveChapterIds) {
        expect(rows.get(chapterId)).toMatchObject({
          observedCompleteAt: null,
          probeEvidenceKey: null,
          acknowledgedAt: null,
        });
      }

      expect(nextChapterFor(household, memberId)?.id).toBe("ch-01-meet");
      let walking = recordChapterAcknowledgement(household, {
        memberId, createdBy: memberId, chapterId: "ch-01-meet", at: new Date(Date.parse(activationAt) + 60_000).toISOString(),
      }).household;
      expect(nextChapterFor(walking, memberId)?.id).toBe("ch-02-household");
      walking = recordObservedChapterCompletion(walking, {
        memberId,
        createdBy: memberId,
        chapterId: "ch-02-household",
        observation: resolvedFor(walking, memberId, memberId === FIXTURE_BIANCA ? FIXTURE_JONATHAN : FIXTURE_BIANCA),
        at: new Date(Date.parse(activationAt) + 120_000).toISOString(),
      }).household;
      expect(nextChapterFor(walking, memberId)?.id).toBe("ch-08-cadence");
    }
  });

  it("leaves a genuinely empty new household on the complete twelve-chapter path", () => {
    const activationAt = existingBooksActivationAt();
    let household = newHouseholdTemplate("development");
    household = proposeHouseholdOnboarding(household, {
      memberId: BIANCA,
      at: new Date(Date.parse(activationAt) - 60_000).toISOString(),
    }).household;
    household = confirmHouseholdOnboarding(household, { memberId: JONATHAN, at: activationAt }).household;
    const progress = adoptAcceptedOnboardingEvidence(household, BIANCA);
    expect(progress.rows.filter(chapterProgressSatisfied)).toEqual([]);

    for (const [index, chapter] of householdChapters().entries()) {
      const walked = {
        ...household,
        members: household.members.map((member) => member.id === BIANCA
          ? {
              ...member,
              onboardingProgress: {
                ...progress,
                rows: progress.rows.map((row) => ({
                  ...row,
                  acknowledgedAt: householdChapters().slice(0, index).some((prior) => prior.id === row.chapterId)
                    ? activationAt
                    : null,
                })),
              },
            }
          : member),
      };
      expect(nextChapterFor(walked, BIANCA)?.id).toBe(chapter.id);
    }
  });

  it("adopts a signed Charter but leaves missing recurrences to the live Chapter 7", () => {
    const activationAt = existingBooksActivationAt();
    let household = existingBooksHousehold(activationAt);
    household.recurrences = [];
    household = proposeHouseholdOnboarding(household, {
      memberId: BIANCA,
      at: new Date(Date.parse(activationAt) - 60_000).toISOString(),
    }).household;
    household = confirmHouseholdOnboarding(household, { memberId: JONATHAN, at: activationAt }).household;
    const progress = adoptAcceptedOnboardingEvidence(household, BIANCA);
    const rows = new Map(progress.rows.map((row) => [row.chapterId, row]));
    expect(rows.get("ch-03-charter")?.observedCompleteAt).toBeTruthy();
    expect(rows.get("ch-07-recurrences")).toMatchObject({ observedCompleteAt: null, probeEvidenceKey: null });
  });

  it("does not adopt evidence created after this setup run became active", () => {
    const activationAt = existingBooksActivationAt();
    const legacy = existingBooksHousehold(activationAt);
    const futureAt = new Date(Date.parse(activationAt) + 60_000).toISOString();
    let household: Household = { ...legacy, recurrences: [] };
    household = proposeHouseholdOnboarding(household, {
      memberId: BIANCA,
      at: new Date(Date.parse(activationAt) - 60_000).toISOString(),
    }).household;
    household = confirmHouseholdOnboarding(household, { memberId: JONATHAN, at: activationAt }).household;
    household = {
      ...household,
      recurrences: legacy.recurrences.map((row) => ({ ...row, createdAt: futureAt, updatedAt: futureAt })),
    };

    const progress = adoptAcceptedOnboardingEvidence(household, BIANCA);
    expect(progress.rows.find((row) => row.chapterId === "ch-07-recurrences")).toMatchObject({
      observedCompleteAt: null,
      probeEvidenceKey: null,
      acknowledgedAt: null,
    });
  });

  it("keeps a completed household complete when its Charter changes", () => {
    const household = completed();
    household.charter = undefined;

    expect(onboardingLifecycleState(household)).toBe("complete");
    expect(householdGatesOutstanding(household)).toEqual([]);
    expect(ordinaryHerculesAvailable(household)).toBe(true);
    expect(shouldShowOnboardingShell(household, BIANCA)).toBe(false);
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

  it("keeps completion sticky when an older forced-unlock replica arrives in either argument order", () => {
    const household = completed();
    const complete = {
      ...household.householdOnboarding!,
      completedAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
    };
    const staleForcedUnlock = {
      ...complete,
      state: "stopped-incomplete" as const,
      stoppedAt: "2026-09-02T00:00:00.000Z",
      stoppedByMemberIds: [BIANCA],
      stoppedSolo: true,
      forcedUnlock: true,
      completedAt: null,
      completionDigest: null,
      updatedAt: "2026-09-02T00:00:00.000Z",
    };
    const context = {
      environment: household.environment,
      householdId: household.householdId,
      members: household.members,
    };

    for (const [server, client] of [[complete, staleForcedUnlock], [staleForcedUnlock, complete]]) {
      const merged = mergeHouseholdOnboarding(server, client, context)!;
      expect(merged).toMatchObject({
        state: "complete",
        forcedUnlock: false,
        completedAt: complete.completedAt,
        completionDigest: complete.completionDigest,
      });
      expect(ordinaryHerculesAvailable({ ...household, householdOnboarding: merged })).toBe(true);
      expect(personalTrackAvailable({ ...household, householdOnboarding: merged })).toBe(true);
    }
  });

  it("honours a genuinely newer forced unlock over an older completion", () => {
    const household = completed();
    const complete = {
      ...household.householdOnboarding!,
      completedAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
    };
    const newerForcedUnlock = {
      ...complete,
      state: "stopped-incomplete" as const,
      stoppedAt: "2026-09-06T00:00:00.000Z",
      stoppedByMemberIds: [BIANCA],
      stoppedSolo: true,
      forcedUnlock: true,
      completedAt: null,
      completionDigest: null,
      updatedAt: "2026-09-06T00:00:00.000Z",
    };
    const context = {
      environment: household.environment,
      householdId: household.householdId,
      members: household.members,
    };

    for (const [server, client] of [[complete, newerForcedUnlock], [newerForcedUnlock, complete]]) {
      expect(mergeHouseholdOnboarding(server, client, context)).toMatchObject({
        state: "stopped-incomplete",
        forcedUnlock: true,
        completedAt: null,
        completionDigest: null,
      });
    }
  });

  it("gives a replacement member only Chapters 1, 2, and 8 without relocking the existing member", () => {
    let household = completed();
    household.members = [
      household.members.find((member) => member.id === BIANCA)!,
      { ...household.members.find((member) => member.id === JONATHAN)!, active: false },
      { id: ALEX, name: "Alex", color: "#785a9a", active: true, updatedAt: COMPLETED_AT },
    ];

    expect(nextChapterFor(household, ALEX)?.id).toBe("ch-01-meet");
    expect(copy("lifecycle.new-member.intro")).toContain("short, private catch-up");
    expect(copy("onboarding.household.ch-01-meet")).toContain("never post money or confirm for you");
    expect(shouldShowOnboardingShell(household, ALEX)).toBe(true);
    expect(shouldShowOnboardingShell(household, BIANCA)).toBe(false);
    expect(householdGatesOutstanding(household)).toEqual([]);
    const inherited = memberProgress(household, ALEX);
    expect(inherited.rows.find((row) => row.chapterId === "ch-03-charter")?.acknowledgedAt).toBe(COMPLETED_AT);
    expect(inherited.rows.find((row) => row.chapterId === "ch-12-ready")?.acknowledgedAt).toBe(COMPLETED_AT);

    household = recordChapterAcknowledgement(household, {
      memberId: ALEX,
      createdBy: ALEX,
      chapterId: "ch-01-meet",
      at: "2026-09-30T12:04:00.000Z",
    }).household;
    expect(nextChapterFor(household, ALEX)?.id).toBe("ch-02-household");

    household = recordObservedChapterCompletion(household, {
      memberId: ALEX,
      createdBy: ALEX,
      chapterId: "ch-02-household",
      observation: resolvedFor(household, ALEX, BIANCA),
      at: "2026-09-30T12:06:00.000Z",
    }).household;
    expect(nextChapterFor(household, ALEX)?.id).toBe("ch-08-cadence");
    expect(householdGatesOutstanding(household)).toEqual([]);
  });

  it("refuses inherited proof for a present but unshapeable member progress record", () => {
    const household = completed();
    household.members = [
      household.members.find((member) => member.id === BIANCA)!,
      { ...household.members.find((member) => member.id === JONATHAN)!, active: false },
      {
        id: ALEX,
        name: "Alex",
        color: "#785a9a",
        active: true,
        updatedAt: COMPLETED_AT,
        onboardingProgress: { garbage: true } as never,
      },
    ];

    const progress = memberProgress(household, ALEX);
    expect(progress.rows.every((row) => !chapterProgressSatisfied(row))).toBe(true);
    expect(onboardingRegistryMigrationPlan(household)).toEqual({ kind: "repair", fromVersion: 0, toVersion: 1 });
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
    expect(shouldShowOnboardingShell(household, BIANCA)).toBe(false);
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

  it("refuses a same-household Suite replacement of ordinary Development books", async () => {
    const adapters = {
      ingest: async () => ({ ok: true }),
      persist: async () => undefined,
    };
    // One base household, so previous and candidate differ only where each case says.
    const base = seedDemoHousehold({ today: "2026-09-06", environment: "development" });
    const fixture = {
      kind: "hearth-demo-suite",
      seed: 7,
      version: "2.0.0",
      generatedForDate: "2026-09-06",
      generatedAt: "2026-09-06T12:00:00.000Z",
      buildSha: "regression",
      fixtureHashSha256: "",
    } as never;
    const candidate = { ...base, syntheticFixture: fixture };
    // A Fund whose custodian differs is an append-only violation the whole-fixture
    // replacement path deliberately skips, so it proves the skip is load-bearing.
    const otherCustodian = {
      ...base,
      householdFund: base.householdFund
        ? { ...base.householdFund, custodianMemberId: "MEM-002" }
        : null,
    };
    const ordinaryBooks = { ...otherCustodian, syntheticFixture: null };
    const priorFixture = {
      ...otherCustodian,
      syntheticFixture: { ...(fixture as object), seed: 6 } as never,
    };
    const actingMemberId = base.members.find((member) => member.active)!.id;

    // The App-side helper already refuses this; the runtime must agree.
    expect(() => assertDemoReplacementAllowed(ordinaryBooks))
      .toThrow("Demo Suite will not replace ordinary Development books.");
    expect(() => assertHouseholdFundTransition(ordinaryBooks, candidate))
      .toThrow("The Household Fund identity, opening date, and custodian are immutable.");

    const refused = await acceptHouseholdWrite({
      previous: ordinaryBooks,
      candidate,
      confirmationId: "REJECT-SUITE-OVER-ORDINARY-BOOKS",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId,
      adapters,
    });
    expect(refused).toMatchObject({ ok: false, postedNothing: true });

    // The legitimate whole-fixture replacement keeps its documented D-227 skip.
    expect(() => assertDemoReplacementAllowed(priorFixture)).not.toThrow();
    const replaced = await acceptHouseholdWrite({
      previous: priorFixture,
      candidate,
      confirmationId: "ACCEPT-SUITE-OVER-SUITE",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId,
      adapters,
    });
    expect(replaced.ok).toBe(true);

    // Creating the Suite as a separate household alongside ordinary books still works.
    const alongside = await acceptHouseholdWrite({
      previous: { ...ordinaryBooks, householdId: `${ordinaryBooks.householdId}-OTHER` },
      candidate,
      confirmationId: "ACCEPT-SUITE-BESIDE-ORDINARY-BOOKS",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId,
      adapters,
    });
    expect(alongside.ok).toBe(true);
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
    expect(nextChapterFor(household, BIANCA)?.id).toBe("ch-02-household");

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

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["string", String(ONBOARDING_REGISTRY_VERSION)],
    ["float", ONBOARDING_REGISTRY_VERSION + 0.5],
    ["negative", -1],
    ["older integer", ONBOARDING_REGISTRY_VERSION - 1],
    ["current integer", ONBOARDING_REGISTRY_VERSION],
  ])("keeps the registry planner aligned with the shaper for %s versions", (_label, registryVersion) => {
    const household = completed();
    const raw = { ...household.householdOnboarding!, registryVersion } as never;
    household.householdOnboarding = raw;
    const shaped = shapeHouseholdOnboarding(raw)!;
    const plan = onboardingRegistryMigrationPlan(household);

    expect(plan).toEqual(shaped.state === "repair"
      ? { kind: "repair", fromVersion: shaped.registryVersion, toVersion: ONBOARDING_REGISTRY_VERSION }
      : { kind: "current" });
  });

  it("keeps lifecycle policy pure and outside money authority", () => {
    const source = readFileSync(new URL("../src/core/onboarding/lifecycle.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\b(document|window|localStorage|sessionStorage|fetch|supabase)\b/);
    expect(source).not.toMatch(/acceptHouseholdWrite|postEntry|postTransfer|\.tsx["']/);
  });
});
