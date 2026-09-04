import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  cloudReplicaVerdict,
  DEVICE_REVOCATION_BOUNDARY,
  lifecycleVerdict,
  type HouseholdDeviceAuthority,
  type LifecycleAction,
  type LifecycleAuthorityInput,
  type LifecycleInvitationAuthority,
  type LifecycleRecoveryAuthority,
  type MembershipAuthority,
} from "../src/core/lifecycleAuthority.ts";

const householdId = "HH-LIFECYCLE";
const ownerA: MembershipAuthority = {
  environment: "development", householdId, memberId: "MEM-A", authUserId: "AUTH-A",
  googleSubject: "GOOGLE-A", googleEmail: "a@example.test",
  role: "owner", active: true, revokedAt: null,
};
const ownerB: MembershipAuthority = {
  environment: "development", householdId, memberId: "MEM-B", authUserId: "AUTH-B",
  googleSubject: "GOOGLE-B", googleEmail: "b@example.test",
  role: "owner", active: true, revokedAt: null,
};
const memberC: MembershipAuthority = {
  environment: "development", householdId, memberId: "MEM-C", authUserId: "AUTH-C",
  googleSubject: "GOOGLE-C", googleEmail: "c@example.test",
  role: "member", active: true, revokedAt: null,
};
const openSeat: MembershipAuthority = {
  environment: "development", householdId, memberId: "MEM-D", authUserId: null,
  googleSubject: "", googleEmail: "d@example.test",
  role: "member", active: false, revokedAt: null,
};
const formerMember: MembershipAuthority = {
  environment: "development", householdId, memberId: "MEM-E", authUserId: null,
  googleSubject: "GOOGLE-E", googleEmail: "e@example.test",
  role: "member", active: false, revokedAt: "2026-09-01T00:00:00.000Z",
};

const memberships = [ownerA, ownerB, memberC, openSeat, formerMember];
const devices: HouseholdDeviceAuthority[] = [
  { id: "DEV-A", environment: "development", householdId, memberId: "MEM-A", authUserId: "AUTH-A", active: true, revokedAt: null },
  { id: "DEV-C", environment: "development", householdId, memberId: "MEM-C", authUserId: "AUTH-C", active: true, revokedAt: null },
  { id: "DEV-C-REVOKED", environment: "development", householdId, memberId: "MEM-C", authUserId: "AUTH-C", active: false, revokedAt: "2026-09-02T00:00:00.000Z" },
];

const pendingInvite: LifecycleInvitationAuthority = {
  id: "INV-D", environment: "development", householdId, targetMemberId: "MEM-D",
  targetRole: "member", kind: "email", invitedEmail: "d@example.test", status: "pending",
  expiresAt: "2026-09-05T00:00:00.000Z", acceptedByAuthUserId: null,
};
const requestedRecovery: LifecycleRecoveryAuthority = {
  id: "REC-E-REQUEST", environment: "development", householdId, memberId: "MEM-E",
  authUserId: "AUTH-E", googleSubject: "GOOGLE-E", status: "requested",
};
const approvedRecovery: LifecycleRecoveryAuthority = {
  id: "REC-E-APPROVED", environment: "development", householdId, memberId: "MEM-E",
  authUserId: "AUTH-E", googleSubject: "GOOGLE-E", status: "approved",
};

function input(overrides: Partial<LifecycleAuthorityInput> & Pick<LifecycleAuthorityInput, "action">): LifecycleAuthorityInput {
  return {
    environment: "development",
    authUserId: "AUTH-A",
    authGoogleSubject: "GOOGLE-A",
    authEmail: "a@example.test",
    householdId,
    actorMemberId: "MEM-A",
    actorDeviceId: "DEV-A",
    now: "2026-09-04T12:00:00.000Z",
    memberships,
    devices,
    invitations: [pendingInvite],
    recoveries: [requestedRecovery, approvedRecovery],
    ...overrides,
  };
}

const memberActor = {
  authUserId: "AUTH-C",
  authGoogleSubject: "GOOGLE-C",
  authEmail: "c@example.test",
  actorMemberId: "MEM-C",
  actorDeviceId: "DEV-C",
};
const outsiderActor = {
  authUserId: "AUTH-X",
  authGoogleSubject: "GOOGLE-X",
  authEmail: "x@example.test",
  actorMemberId: "MEM-X",
  actorDeviceId: null,
};

describe("lifecycle authority actor/action matrix", () => {
  const membershipActions: Array<{
    action: LifecycleAction;
    extras: Partial<LifecycleAuthorityInput>;
    ownerAllowed: boolean;
    memberAllowed: boolean;
  }> = [
    { action: "delete-household", extras: { deletionApproved: true }, ownerAllowed: true, memberAllowed: false },
    {
      action: "issue-invite",
      extras: { targetId: "MEM-D", invitationRequest: { kind: "email", invitedEmail: "d@example.test", targetRole: "member" } },
      ownerAllowed: true,
      memberAllowed: false,
    },
    { action: "revoke-invite", extras: { targetId: "INV-D" }, ownerAllowed: true, memberAllowed: false },
    { action: "leave-household", extras: {}, ownerAllowed: true, memberAllowed: true },
    { action: "remove-member", extras: { targetId: "MEM-C" }, ownerAllowed: true, memberAllowed: false },
    { action: "transfer-owner", extras: { targetId: "MEM-C" }, ownerAllowed: true, memberAllowed: false },
    { action: "revoke-device", extras: { targetId: "DEV-C" }, ownerAllowed: true, memberAllowed: true },
  ];

  for (const row of membershipActions) {
    for (const actor of ["owner", "member", "outsider"] as const) {
      it(`${actor} -> ${row.action}`, () => {
        const actorFields = actor === "owner" ? {} : actor === "member" ? memberActor : outsiderActor;
        const verdict = lifecycleVerdict(input({ action: row.action, ...row.extras, ...actorFields }));
        const expected = actor === "owner" ? row.ownerAllowed : actor === "member" ? row.memberAllowed : false;
        expect(verdict.allowed).toBe(expected);
        if (actor === "outsider") expect(verdict).toMatchObject({ code: "membership-required" });
      });
    }
  }

  it("covers every lifecycle action, including scoped identity-entry actions", () => {
    const represented: LifecycleAction[] = [
      ...membershipActions.map((row) => row.action),
      "create-household", "redeem-invite", "request-recovery", "complete-recovery",
    ];
    const expected: LifecycleAction[] = [
      "create-household", "delete-household", "issue-invite", "revoke-invite", "redeem-invite",
      "leave-household", "remove-member", "transfer-owner", "revoke-device",
      "request-recovery", "complete-recovery",
    ];
    expect(new Set(represented)).toEqual(new Set(expected));
  });
});

describe("create, ownership, removal, and deletion boundaries", () => {
  it("creates only outside an existing household scope", () => {
    expect(lifecycleVerdict(input({ action: "create-household", householdId: null, actorMemberId: "MEM-NEW", actorDeviceId: null, memberships: [], devices: [] })).allowed).toBe(true);
    expect(lifecycleVerdict(input({ action: "create-household" }))).toMatchObject({ allowed: false, code: "create-scope-invalid" });
  });

  it("refuses a last-owner leave and co-owner removal", () => {
    expect(lifecycleVerdict(input({ action: "leave-household", memberships: [ownerA, memberC] }))).toMatchObject({ allowed: false, code: "last-owner" });
    expect(lifecycleVerdict(input({ action: "remove-member", targetId: "MEM-B" }))).toMatchObject({ allowed: false, code: "co-owner-protected" });
  });

  it("transfers only to a different active ordinary member", () => {
    for (const targetId of ["MEM-A", "MEM-B", "MEM-D", "MEM-E", "UNKNOWN"]) {
      expect(lifecycleVerdict(input({ action: "transfer-owner", targetId }))).toMatchObject({ allowed: false, code: "target-unavailable" });
    }
    expect(lifecycleVerdict(input({ action: "transfer-owner", targetId: "MEM-C" })).allowed).toBe(true);
  });

  it("requires explicit Development approval and always refuses Production deletion", () => {
    expect(lifecycleVerdict(input({ action: "delete-household", deletionApproved: false }))).toMatchObject({ allowed: false, code: "approval-required" });
    const productionMemberships = memberships.map((row) => ({ ...row, environment: "production" as const }));
    const productionDevices = devices.map((row) => ({ ...row, environment: "production" as const }));
    expect(lifecycleVerdict(input({
      action: "delete-household", environment: "production", memberships: productionMemberships,
      devices: productionDevices, deletionApproved: true,
    }))).toMatchObject({ allowed: false, code: "deletion-refused" });
  });
});

describe("invitation authority mirrors retained identity and replay rules", () => {
  const invitedActor = {
    authUserId: "AUTH-D", authGoogleSubject: "GOOGLE-D", authEmail: "d@example.test",
    actorMemberId: "MEM-D", actorDeviceId: null,
  };

  it("redeems a live exact email invitation", () => {
    expect(lifecycleVerdict(input({ action: "redeem-invite", targetId: "INV-D", ...invitedActor })).allowed).toBe(true);
  });

  it("uses one public error for revoked, expired, stale-time, wrong-environment, and unknown invitations", () => {
    const verdicts = [
      lifecycleVerdict(input({ action: "redeem-invite", targetId: "INV-D", ...invitedActor, invitations: [{ ...pendingInvite, status: "revoked" }] })),
      lifecycleVerdict(input({ action: "redeem-invite", targetId: "INV-D", ...invitedActor, invitations: [{ ...pendingInvite, status: "expired" }] })),
      lifecycleVerdict(input({ action: "redeem-invite", targetId: "INV-D", ...invitedActor, now: pendingInvite.expiresAt })),
      lifecycleVerdict(input({ action: "redeem-invite", targetId: "INV-D", ...invitedActor, invitations: [{ ...pendingInvite, environment: "production" }] })),
      lifecycleVerdict(input({ action: "redeem-invite", targetId: "UNKNOWN", ...invitedActor, invitations: [] })),
    ];
    expect(new Set(verdicts.map((row) => JSON.stringify(row)))).toHaveLength(1);
    expect(verdicts[0]).toEqual({ allowed: false, code: "invitation-unavailable", message: "That invitation is unavailable." });
  });

  it("allows accepted replay only for the same caller", () => {
    const accepted = { ...pendingInvite, status: "accepted" as const, acceptedByAuthUserId: "AUTH-D" };
    expect(lifecycleVerdict(input({ action: "redeem-invite", targetId: "INV-D", ...invitedActor, invitations: [accepted] })).allowed).toBe(true);
    expect(lifecycleVerdict(input({
      action: "redeem-invite", targetId: "INV-D", ...invitedActor,
      authUserId: "AUTH-X", authGoogleSubject: "GOOGLE-X", authEmail: "x@example.test", invitations: [accepted],
    }))).toMatchObject({ allowed: false, code: "invitation-unavailable" });
  });

  it("refuses email mismatch, already-bound callers, and former-seat takeover", () => {
    expect(lifecycleVerdict(input({ action: "redeem-invite", targetId: "INV-D", ...invitedActor, authEmail: "wrong@example.test" }))).toMatchObject({ allowed: false, code: "invitation-unavailable" });
    expect(lifecycleVerdict(input({ action: "redeem-invite", targetId: "INV-D", ...memberActor, actorMemberId: "MEM-D" }))).toMatchObject({ allowed: false, code: "invitation-unavailable" });
    const formerInvite = {
      ...pendingInvite, id: "INV-E", targetMemberId: "MEM-E", kind: "qr" as const,
      invitedEmail: null,
    };
    expect(lifecycleVerdict(input({
      action: "redeem-invite", targetId: "INV-E", ...invitedActor,
      actorMemberId: "MEM-E", invitations: [formerInvite],
    }))).toMatchObject({ allowed: false, code: "invitation-unavailable" });
  });

  it("requires retained email when issuing a former-member rejoin invite", () => {
    expect(lifecycleVerdict(input({
      action: "issue-invite", targetId: "MEM-E",
      invitationRequest: { kind: "qr", invitedEmail: null, targetRole: "member" },
    }))).toMatchObject({ allowed: false, code: "target-unavailable" });
    expect(lifecycleVerdict(input({
      action: "issue-invite", targetId: "MEM-E",
      invitationRequest: { kind: "email", invitedEmail: "E@example.test", targetRole: "member" },
    })).allowed).toBe(true);
  });

  it("allows an inactive unbound seat to become a co-owner invitation", () => {
    expect(openSeat.role).toBe("member");
    expect(lifecycleVerdict(input({
      action: "issue-invite", targetId: "MEM-D",
      invitationRequest: { kind: "email", invitedEmail: "d@example.test", targetRole: "owner" },
    })).allowed).toBe(true);
  });

  it("refuses an email invitation without a nonblank email", () => {
    for (const invitedEmail of [null, "", "   "]) {
      expect(lifecycleVerdict(input({
        action: "issue-invite", targetId: "MEM-D",
        invitationRequest: { kind: "email", invitedEmail, targetRole: "owner" },
      }))).toMatchObject({ allowed: false, code: "target-unavailable" });
    }
  });
});

describe("device and replica authority", () => {
  it("fails closed when a registered caller omits or invents its device authority", () => {
    expect(lifecycleVerdict(input({ action: "leave-household", actorDeviceId: null }))).toMatchObject({ allowed: false, code: "device-not-authorized" });
    expect(lifecycleVerdict(input({ action: "leave-household", actorDeviceId: "DEV-UNKNOWN" }))).toMatchObject({ allowed: false, code: "device-not-authorized" });
  });

  it("denies lifecycle actions from an explicitly revoked current device", () => {
    const verdict = lifecycleVerdict(input({ action: "leave-household", ...memberActor, actorDeviceId: "DEV-C-REVOKED" }));
    expect(verdict).toMatchObject({ allowed: false, code: "device-revoked" });
  });

  it("denies both push and pull immediately after device revocation", () => {
    for (const operation of ["push", "pull"] as const) {
      expect(cloudReplicaVerdict({
        operation, environment: "development", householdId, memberships, devices,
        ...memberActor, actorDeviceId: "DEV-C-REVOKED",
      })).toMatchObject({ allowed: false, code: "device-revoked" });
      expect(cloudReplicaVerdict({
        operation, environment: "development", householdId, memberships, devices,
        ...memberActor, actorDeviceId: null,
      })).toMatchObject({ allowed: false, code: "device-not-authorized" });
    }
  });

  it("allows active push/pull and the migration-017 first-device bootstrap only", () => {
    for (const operation of ["push", "pull"] as const) {
      expect(cloudReplicaVerdict({ operation, environment: "development", householdId, memberships, devices, ...memberActor }).allowed).toBe(true);
      expect(cloudReplicaVerdict({ operation, environment: "development", householdId, memberships, devices: [], ...memberActor, actorDeviceId: null }).allowed).toBe(true);
    }
  });

  it("does not reopen bootstrap when a rebound seat has an old-auth session row", () => {
    const historicalDevice: HouseholdDeviceAuthority = {
      id: "DEV-C-OLD", environment: "development", householdId, memberId: "MEM-C",
      authUserId: "AUTH-C-OLD", active: false, revokedAt: "2026-09-01T00:00:00.000Z",
    };
    for (const actorDeviceId of [null, "DEV-C-OLD"]) {
      expect(cloudReplicaVerdict({
        operation: "pull", environment: "development", householdId, memberships,
        devices: [historicalDevice], ...memberActor, actorDeviceId,
      })).toMatchObject({ allowed: false, code: "device-not-authorized" });
    }
  });

  it("states the honest cached-data limit", () => {
    expect(DEVICE_REVOCATION_BOUNDARY).toMatch(/ends hosted push and pull immediately/i);
    expect(DEVICE_REVOCATION_BOUNDARY).toMatch(/cannot remotely erase.+cached/i);
  });
});

describe("opaque recovery and cross-scope boundaries", () => {
  const recoveringActor = {
    authUserId: "AUTH-E", authGoogleSubject: "GOOGLE-E", authEmail: "e@example.test",
    actorMemberId: "MEM-E", actorDeviceId: null,
  };

  it("uses server-issued recovery authority instead of the cleared membership auth user", () => {
    expect(formerMember.authUserId).toBeNull();
    expect(lifecycleVerdict(input({ action: "request-recovery", targetId: "REC-E-REQUEST", ...recoveringActor })).allowed).toBe(true);
    expect(lifecycleVerdict(input({ action: "complete-recovery", targetId: "REC-E-APPROVED", ...recoveringActor })).allowed).toBe(true);
  });

  it("returns one constant error without household or device-state enumeration", () => {
    const verdicts = [
      lifecycleVerdict(input({ action: "request-recovery", targetId: "UNKNOWN", ...recoveringActor, recoveries: [] })),
      lifecycleVerdict(input({ action: "request-recovery", targetId: "REC-E-REQUEST", ...recoveringActor, householdId: "HH-OTHER" })),
      lifecycleVerdict(input({ action: "request-recovery", targetId: "REC-E-REQUEST", ...recoveringActor, authGoogleSubject: "GOOGLE-X" })),
      lifecycleVerdict(input({ action: "request-recovery", targetId: "UNKNOWN", ...memberActor, actorDeviceId: "DEV-C-REVOKED", recoveries: [] })),
      lifecycleVerdict(input({ action: "complete-recovery", targetId: "REC-E-APPROVED", ...recoveringActor, recoveries: [{ ...approvedRecovery, status: "revoked" }] })),
    ];
    expect(new Set(verdicts.map((row) => JSON.stringify(row)))).toHaveLength(1);
    expect(verdicts[0]).toEqual({
      allowed: false,
      code: "recovery-unavailable",
      message: "Recovery is unavailable. Start again from the signed-in recovery screen.",
    });
  });

  it("requires the exact auth user, Google subject, member, household, and environment tuple", () => {
    for (const candidate of [
      input({ action: "leave-household", authUserId: "AUTH-X" }),
      input({ action: "leave-household", authGoogleSubject: "GOOGLE-X" }),
      input({ action: "leave-household", actorMemberId: "MEM-C" }),
      input({ action: "leave-household", householdId: "HH-OTHER" }),
      input({ action: "leave-household", environment: "production" }),
    ]) {
      expect(lifecycleVerdict(candidate)).toMatchObject({ allowed: false, code: "membership-required" });
    }
  });
});

describe("purity fence", () => {
  it("performs no network work when an action is refused", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(lifecycleVerdict(input({ action: "remove-member", ...memberActor, targetId: "MEM-A" })).allowed).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("contains no money writer, network client, storage, or SQL authority", () => {
    const source = readFileSync("src/core/lifecycleAuthority.ts", "utf8");
    expect(source).not.toMatch(/acceptHouseholdWrite|postEntry|postTransfer|fetch\s*\(|localStorage|sessionStorage|supabase/i);
    expect(source).not.toMatch(/\bINSERT\s+INTO|\bUPDATE\s+\w+\s+SET|\bDELETE\s+FROM/i);
    expect(source).toMatch(/performs no I\/O/);
  });
});
