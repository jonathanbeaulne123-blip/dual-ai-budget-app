import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  evidenceFor,
  memberProgress,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  shapeGoogle,
  type Household,
  type HouseholdScopeObservation,
} from "../src/core/index.ts";
import {
  probeHouseholdScope,
  type HouseholdScopeProbeAdapters,
} from "../src/onboardingHouseholdScope.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const OBSERVED_AT = "2026-09-04T13:00:00.000Z";
const TOKEN = "PRIVATE-SUPABASE-TOKEN";
const EMAIL = "bianca@example.test";

function householdWithIdentity(): Household {
  const household = catalogHousehold("development");
  household.google = shapeGoogle({
    ...household.google,
    links: [{
      memberId: BIANCA,
      email: EMAIL,
      subject: "google-bianca",
      displayName: "Bianca",
      linkedAt: OBSERVED_AT,
      lastConfirmedAt: OBSERVED_AT,
      grantedScopes: ["identity"],
      updatedAt: OBSERVED_AT,
      active: true,
    }],
  });
  return household;
}

function adapters(
  household: Household,
  overrides: Partial<HouseholdScopeProbeAdapters> = {},
): HouseholdScopeProbeAdapters {
  const session = {
    accessToken: TOKEN,
    refreshToken: "PRIVATE-REFRESH-TOKEN",
    userId: "auth-bianca",
    sessionId: "session-bianca",
    email: EMAIL,
    googleSubject: "google-bianca",
    displayName: "Bianca",
    expiresAt: Date.parse("2026-09-04T14:00:00.000Z"),
  };
  return {
    loadSession: () => session,
    ensureSession: async () => session,
    readConfig: () => ({ url: "https://example.test", key: "publishable" }),
    listMemberships: async () => [{ householdId: household.householdId, memberId: BIANCA, role: "owner" }],
    listAccess: async () => ({
      ok: true,
      access: {
        currentMemberId: BIANCA,
        currentRole: "owner",
        members: [
          { memberId: BIANCA, displayName: "Bianca", role: "owner" },
          { memberId: JONATHAN, displayName: "Jonathan", role: "member" },
        ],
        devices: [],
        audit: [],
      },
    }),
    isOnline: () => true,
    now: () => OBSERVED_AT,
    ...overrides,
  };
}

function resolved(household: Household, memberId = BIANCA): HouseholdScopeObservation {
  return {
    kind: "resolved",
    scope: { environment: household.environment, householdId: household.householdId, memberId },
    currentMemberId: memberId,
    seatMemberIds: [BIANCA, JONATHAN],
    observedAt: OBSERVED_AT,
  };
}

describe("Chapter 2 live household scope", () => {
  it("accepts only a live exact scope and emits household-only evidence", async () => {
    const household = householdWithIdentity();
    const observation = await probeHouseholdScope({ household, memberId: BIANCA }, adapters(household));
    expect(observation).toEqual(resolved(household));

    const evidence = evidenceFor(household, "ch-02-household", BIANCA, { householdScope: observation });
    expect(evidence).toMatchObject({
      kind: "accepted",
      card: {
        scope: "household",
        kind: "household",
        sourceIds: [household.householdId, BIANCA, JONATHAN],
        lines: [
          { label: "Household", value: household.name },
          { label: "Members", value: "Bianca and Jonathan" },
          { label: "Environment", value: "development" },
        ],
        observedAt: OBSERVED_AT,
      },
    });
    const serialized = JSON.stringify({ observation, evidence });
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(EMAIL);
    expect(serialized).not.toContain("session-bianca");
  });

  it("uses the exact hosted membership as identity authority when the local Google bridge is empty", async () => {
    const household = catalogHousehold("development");
    expect(household.google.links).toEqual([]);

    const observation = await probeHouseholdScope({ household, memberId: BIANCA }, adapters(household));

    expect(observation).toEqual(resolved(household));
  });

  it("keeps checking neutral and exposes transient cloud failures as retryable evidence", async () => {
    const household = householdWithIdentity();
    const checking: HouseholdScopeObservation = {
      kind: "checking",
      scope: { environment: household.environment, householdId: household.householdId, memberId: BIANCA },
    };
    expect(evidenceFor(household, "ch-02-household", BIANCA, { householdScope: checking }))
      .toEqual({ kind: "empty" });

    const rpcFailure = await probeHouseholdScope({ household, memberId: BIANCA }, adapters(household, {
      listAccess: async () => ({ ok: false, reason: "access-rpc-missing" }),
    }));
    expect(rpcFailure).toMatchObject({ kind: "blocked", reason: "probe-failed" });
    expect(evidenceFor(household, "ch-02-household", BIANCA, { householdScope: rpcFailure }))
      .toEqual({ kind: "ineligible", reason: "retry" });

    const networkFailure = await probeHouseholdScope({ household, memberId: BIANCA }, adapters(household, {
      listMemberships: async () => { throw new Error("temporary network failure"); },
    }));
    expect(networkFailure).toMatchObject({ kind: "blocked", reason: "probe-failed" });
  });

  it("distinguishes revoked current access from a missing partner seat", async () => {
    const household = householdWithIdentity();
    const revoked = await probeHouseholdScope({ household, memberId: BIANCA }, adapters(household, {
      listAccess: async () => ({ ok: false, reason: "device-revoked" }),
    }));
    expect(revoked).toMatchObject({ kind: "blocked", reason: "revoked-membership" });
  });

  it("makes every specified failure state reachable without completing from cache", async () => {
    const household = householdWithIdentity();
    const cases: Array<{
      name: string;
      selectedHouseholdId?: string | null;
      override: Partial<HouseholdScopeProbeAdapters>;
      reason: string;
    }> = [
      { name: "missing Auth", override: { loadSession: () => null }, reason: "missing-auth" },
      { name: "missing partner membership", override: {
        listAccess: async () => ({
          ok: true,
          access: {
            currentMemberId: BIANCA,
            currentRole: "owner",
            members: [{ memberId: BIANCA, displayName: "Bianca", role: "owner" }],
            devices: [],
            audit: [],
          },
        }),
      }, reason: "missing-partner-membership" },
      { name: "multiple households without a selection", selectedHouseholdId: null, override: {
        listMemberships: async () => [
          { householdId: household.householdId, memberId: BIANCA, role: "owner" },
          { householdId: "HOUSEHOLD-OTHER", memberId: BIANCA, role: "member" },
        ],
      }, reason: "ambiguous-household-scope" },
      { name: "revoked membership", override: {
        listMemberships: async () => [],
      }, reason: "revoked-membership" },
      { name: "offline cached identity", override: {
        isOnline: () => false,
      }, reason: "offline-cached-identity" },
    ];

    for (const row of cases) {
      const observation = await probeHouseholdScope({
        household,
        memberId: BIANCA,
        selectedHouseholdId: row.selectedHouseholdId,
      }, adapters(household, row.override));
      expect(observation, row.name).toMatchObject({ kind: "blocked", reason: row.reason });
      expect(evidenceFor(household, "ch-02-household", BIANCA, { householdScope: observation }).kind).toBe("ineligible");
    }
  });

  it("accepts an exact selected household even when the identity has other memberships", async () => {
    const household = householdWithIdentity();
    const observation = await probeHouseholdScope({ household, memberId: BIANCA }, adapters(household, {
      listMemberships: async () => [
        { householdId: "HOUSEHOLD-OTHER", memberId: BIANCA, role: "member" },
        { householdId: household.householdId, memberId: BIANCA, role: "owner" },
      ],
    }));
    expect(observation).toEqual(resolved(household));
  });

  it("discards a live result when member or household scope changes mid-flow", async () => {
    const household = householdWithIdentity();
    let release!: (rows: Array<{ householdId: string; memberId: string; role: "owner" }>) => void;
    const pending = new Promise<Array<{ householdId: string; memberId: string; role: "owner" }>>((resolve) => {
      release = resolve;
    });
    let current = true;
    const result = probeHouseholdScope({ household, memberId: BIANCA }, adapters(household, {
      listMemberships: async () => pending,
    }), () => current);
    current = false;
    release([{ householdId: household.householdId, memberId: BIANCA, role: "owner" }]);
    await expect(result).resolves.toMatchObject({ kind: "blocked", reason: "scope-changed" });
  });

  it("persists accepted probe completion only for the acting member and closes acknowledgement bypass", () => {
    const household = householdWithIdentity();
    expect(() => recordChapterAcknowledgement(household, {
      memberId: BIANCA,
      chapterId: "ch-02-household",
      createdBy: BIANCA,
    })).toThrow("This setup chapter needs accepted evidence.");

    const first = recordObservedChapterCompletion(household, {
      memberId: BIANCA,
      chapterId: "ch-02-household",
      createdBy: BIANCA,
      observation: resolved(household),
      at: "2026-09-04T13:01:00.000Z",
    });
    const row = memberProgress(first.household, BIANCA).rows.find((candidate) => candidate.chapterId === "ch-02-household");
    expect(row).toMatchObject({
      observedCompleteAt: OBSERVED_AT,
      acknowledgedAt: "2026-09-04T13:01:00.000Z",
      lastSafeResumePoint: "ch-02-household",
    });
    expect(row?.probeEvidenceKey).toContain(household.householdId);
    expect(first).toMatchObject({ persistenceScope: "member-personal", personalMemberId: BIANCA, postedIds: [] });
    expect(first.household.members.find((member) => member.id === JONATHAN)?.onboardingProgress).toBeUndefined();

    const switched = structuredClone(household);
    switched.householdId = "HOUSEHOLD-SWITCHED";
    expect(() => recordObservedChapterCompletion(switched, {
      memberId: BIANCA,
      chapterId: "ch-02-household",
      createdBy: BIANCA,
      observation: resolved(household),
    })).toThrow("That household check is no longer current.");
  });
});
