import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  completePersonalModule,
  declinePersonalModuleOffer,
  emptyMemberOnboardingProgress,
  householdGatesOutstanding,
  memberProgress,
  mergeMemberProgress,
  personalModuleOfferFor,
  personalModuleTrigger,
  recordPersonalModuleOffer,
  setOnboardingOffersMuted,
  skipPersonalStep,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const COMPLETE_AT = "2026-08-01T14:00:00.000Z";

function unlockedHousehold(): Household {
  const household = catalogHousehold("development");
  household.householdOnboarding = {
    id: `ONBOARDING-${household.environment}-${household.householdId}`,
    environment: household.environment,
    householdId: household.householdId,
    registryVersion: 1,
    state: "complete",
    proposedByMemberId: BIANCA,
    proposedAt: "2026-08-01T13:00:00.000Z",
    handshakeExpiresAt: "2026-08-01T13:15:00.000Z",
    confirmedByMemberIds: [BIANCA, JONATHAN],
    startedAt: "2026-08-01T13:15:00.000Z",
    stoppedAt: null,
    stoppedByMemberIds: [],
    stoppedSolo: false,
    forcedUnlock: false,
    completedAt: COMPLETE_AT,
    completionDigest: `ready-v1-${"a".repeat(64)}`,
    createdAt: "2026-08-01T13:00:00.000Z",
    updatedAt: COMPLETE_AT,
  };
  household.transactions = [];
  household.shifts = [];
  household.workJobs = [];
  household.members = household.members.map((member) => ({
    ...member,
    earningCadence: undefined,
    earningCadenceUpdatedAt: undefined,
    onboardingProgress: emptyMemberOnboardingProgress({
      environment: household.environment,
      householdId: household.householdId,
      memberId: member.id,
    }),
  }));
  return household;
}

function withPersonalTransaction(household: Household, memberId = BIANCA, date = "2026-09-01"): Household {
  return {
    ...household,
    transactions: [...household.transactions, {
      id: `TXN-PERSONAL-${memberId}-${date}-${household.transactions.length}`,
      date,
      type: "expense",
      amountCents: 500,
      currency: "CAD",
      accountId: household.accounts[0]!.id,
      categoryId: null,
      subcategoryId: null,
      note: "Personal trigger fixture",
      place: "Personal",
      splits: [{ party: memberId, amountCents: 500 }],
      source: "manual",
      duplicateKey: `personal-${memberId}-${date}-${household.transactions.length}`,
      potentialDuplicate: false,
      createdBy: memberId,
      visibility: "personal",
      isDuplicate: false,
      reviewed: true,
      createdAt: `${date}T14:00:00.000Z`,
      updatedAt: `${date}T14:00:00.000Z`,
    }],
  };
}

function offer(household: Household, sessionId: string, at: string): Household {
  const selected = personalModuleOfferFor(household, BIANCA, { now: at, sessionId, isDesktop: false });
  expect(selected?.module.id).toBe("pm-01-own-books");
  return recordPersonalModuleOffer(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    moduleId: "pm-01-own-books",
    sessionId,
    isDesktop: false,
    at,
  }).household;
}

describe("Slice 26 Personal onboarding", () => {
  it("uses exact owner-scoped typed triggers and can offer modules out of order", () => {
    const base = unlockedHousehold();
    const partnerOnly = withPersonalTransaction(base, JONATHAN);
    expect(personalModuleTrigger(partnerOnly, BIANCA, "pm-01-own-books", {
      now: "2026-09-01T14:00:00.000Z", sessionId: "privacy", isDesktop: false,
    }).eligible).toBe(false);

    const own = withPersonalTransaction(base);
    expect(personalModuleTrigger(own, BIANCA, "pm-01-own-books", {
      now: "2026-09-01T14:00:00.000Z", sessionId: "own", isDesktop: false,
    }).eligible).toBe(true);

    const desktop = personalModuleOfferFor(base, BIANCA, {
      now: "2026-09-01T14:00:00.000Z", sessionId: "desktop", isDesktop: true,
    });
    expect(desktop?.module.id).toBe("pm-05-office");
  });

  it("allows at most one offer per session and two in a civil week", () => {
    let household = withPersonalTransaction(unlockedHousehold());
    household = offer(household, "session-a", "2026-09-01T14:00:00.000Z");
    expect(personalModuleOfferFor(household, BIANCA, {
      now: "2026-09-01T15:00:00.000Z", sessionId: "session-a", isDesktop: false,
    })).toBeNull();
    household = offer(household, "session-b", "2026-09-02T14:00:00.000Z");
    expect(personalModuleOfferFor(household, BIANCA, {
      now: "2026-09-03T14:00:00.000Z", sessionId: "session-c", isDesktop: false,
    })).toBeNull();
    expect(memberProgress(household, BIANCA).personalOfferHistory).toHaveLength(2);
  });

  it("suppresses a module after two real declines for the month and resets next month", () => {
    let household = withPersonalTransaction(unlockedHousehold());
    household = offer(household, "decline-a", "2026-09-01T14:00:00.000Z");
    household = declinePersonalModuleOffer(household, {
      memberId: BIANCA, createdBy: BIANCA, moduleId: "pm-01-own-books", sessionId: "decline-a", at: "2026-09-01T14:01:00.000Z",
    }).household;
    household = offer(household, "decline-b", "2026-09-08T14:00:00.000Z");
    household = declinePersonalModuleOffer(household, {
      memberId: BIANCA, createdBy: BIANCA, moduleId: "pm-01-own-books", sessionId: "decline-b", at: "2026-09-08T14:01:00.000Z",
    }).household;

    expect(memberProgress(household, BIANCA).declineCountByModule["pm-01-own-books"]).toBe(2);
    expect(personalModuleOfferFor(household, BIANCA, {
      now: "2026-09-15T14:00:00.000Z", sessionId: "decline-c", isDesktop: false,
    })?.module.id).not.toBe("pm-01-own-books");
    expect(personalModuleOfferFor(household, BIANCA, {
      now: "2026-10-01T14:00:00.000Z", sessionId: "next-month", isDesktop: false,
    })?.module.id).toBe("pm-01-own-books");
  });

  it("unions independent device offers and declines before applying the caps", () => {
    const base = withPersonalTransaction(unlockedHousehold());
    const deviceAOffered = offer(base, "device-a", "2026-09-01T14:00:00.000Z");
    const deviceA = declinePersonalModuleOffer(deviceAOffered, {
      memberId: BIANCA, createdBy: BIANCA, moduleId: "pm-01-own-books", sessionId: "device-a", at: "2026-09-01T14:01:00.000Z",
    }).household;
    const deviceBOffered = offer(base, "device-b", "2026-09-08T14:00:00.000Z");
    const deviceB = declinePersonalModuleOffer(deviceBOffered, {
      memberId: BIANCA, createdBy: BIANCA, moduleId: "pm-01-own-books", sessionId: "device-b", at: "2026-09-08T14:01:00.000Z",
    }).household;
    const merged = mergeMemberProgress(memberProgress(deviceA, BIANCA), memberProgress(deviceB, BIANCA));
    const converged = {
      ...base,
      members: base.members.map((member) => member.id === BIANCA ? { ...member, onboardingProgress: merged } : member),
    };

    expect(merged.personalOfferHistory.map((row) => row.sessionId)).toEqual(["device-a", "device-b"]);
    expect(merged.declineCountByModule["pm-01-own-books"]).toBe(2);
    expect(personalModuleOfferFor(converged, BIANCA, {
      now: "2026-09-15T14:00:00.000Z", sessionId: "device-c", isDesktop: false,
    })?.module.id).not.toBe("pm-01-own-books");

    const olderMonth = {
      ...memberProgress(base, BIANCA),
      declineCountByModule: { "pm-01-own-books": 2 },
      declineMonthByModule: { "pm-01-own-books": "2026-09" },
    };
    const newerMonth = {
      ...memberProgress(base, BIANCA),
      declineCountByModule: { "pm-01-own-books": 1 },
      declineMonthByModule: { "pm-01-own-books": "2026-10" },
    };
    expect(mergeMemberProgress(olderMonth, newerMonth)).toMatchObject({
      declineCountByModule: { "pm-01-own-books": 1 },
      declineMonthByModule: { "pm-01-own-books": "2026-10" },
    });
  });

  it("keeps mute, skip, and completion self-owned and outside every household gate", () => {
    let household = withPersonalTransaction(unlockedHousehold());
    expect(() => setOnboardingOffersMuted(household, {
      memberId: BIANCA, createdBy: JONATHAN, muted: true,
    })).toThrow(/own progress/i);

    const muted = setOnboardingOffersMuted(household, {
      memberId: BIANCA, createdBy: BIANCA, muted: true, at: "2026-09-01T13:00:00.000Z",
    });
    expect(muted.persistenceScope).toBe("member-personal");
    expect(memberProgress(muted.household, BIANCA).offersMuted).toBe(true);
    expect(memberProgress(muted.household, JONATHAN).offersMuted).toBe(false);

    household = offer(household, "complete-a", "2026-09-01T14:00:00.000Z");
    household = completePersonalModule(household, {
      memberId: BIANCA, createdBy: BIANCA, moduleId: "pm-01-own-books", sessionId: "complete-a", at: "2026-09-01T14:02:00.000Z",
    }).household;
    household = skipPersonalStep(household, {
      memberId: BIANCA, createdBy: BIANCA, chapterId: "pm-02-shifts", at: "2026-09-01T14:03:00.000Z",
    }).household;

    const gates = householdGatesOutstanding(household);
    expect(gates.every((chapterId) => chapterId.startsWith("ch-"))).toBe(true);
    expect(gates).not.toContain("pm-01-own-books");
    expect(gates).not.toContain("pm-02-shifts");
  });
});
