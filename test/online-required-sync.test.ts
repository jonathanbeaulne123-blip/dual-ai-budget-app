import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import {
  canRepairProjectionFromAcknowledgedCache,
  canRepairProjectionWithBoundOutbox,
  onlineRequiredReplicaKey,
  cloudLedgerOnlineRequiredEnabled,
  cloudLedgerWriteGate,
  pairedCloudRevisionGate,
  replicaAdoptionScopeMatches,
  revisionDedupeMaySkipPairedAdoption,
} from "../src/onlineRequiredSync.ts";

describe("online-required cloud ledger policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is an explicit Development-only launch policy", () => {
    expect(cloudLedgerOnlineRequiredEnabled("development", "1")).toBe(true);
    expect(cloudLedgerOnlineRequiredEnabled("development", "0")).toBe(false);
    expect(cloudLedgerOnlineRequiredEnabled("production", "1")).toBe(false);
  });

  it("prefers the cloud-ledger flag and uses the old shared name only as a local compatibility fallback", () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "0");
    vi.stubEnv("VITE_SHARED_ONLINE_REQUIRED", "1");
    expect(cloudLedgerOnlineRequiredEnabled("development")).toBe(false);

    vi.unstubAllEnvs();
    vi.stubEnv("VITE_SHARED_ONLINE_REQUIRED", "1");
    expect(cloudLedgerOnlineRequiredEnabled("development")).toBe(true);
  });

  it("keeps all cloud-backed Personal and Shared books read-only offline or without matching Auth", () => {
    const base = {
      environment: "development" as const,
      cloudBackedHousehold: true,
      online: true,
      authEnabled: true,
      authSessionPresent: true,
      membershipMatches: true,
      configured: "1",
    };
    expect(cloudLedgerWriteGate(base)).toEqual({ required: true, allowed: true, reason: null });
    expect(cloudLedgerWriteGate({ ...base, online: false })).toMatchObject({ required: true, allowed: false });
    expect(cloudLedgerWriteGate({ ...base, authSessionPresent: false })).toMatchObject({ required: true, allowed: false });
    expect(cloudLedgerWriteGate({ ...base, membershipMatches: false })).toMatchObject({ required: true, allowed: false });
    expect(cloudLedgerWriteGate({ ...base, completeReplicaReady: false })).toMatchObject({ required: true, allowed: false });
    expect(cloudLedgerWriteGate({ ...base, pendingOutboxCount: 1 })).toMatchObject({ required: true, allowed: false });
    expect(cloudLedgerWriteGate({ ...base, hasUnacknowledgedSnapshot: true })).toMatchObject({ required: true, allowed: false });
    expect(cloudLedgerWriteGate({ ...base, cloudBackedHousehold: false })).toEqual({ required: false, allowed: true, reason: null });
  });

  it("binds complete cloud-read readiness to the exact household, member, and revision", () => {
    const ready = onlineRequiredReplicaKey({
      environment: "development",
      householdId: "HH-ONE",
      memberId: "MEM-001",
      revision: 12,
    });
    expect(ready).not.toBe(onlineRequiredReplicaKey({ environment: "development", householdId: "HH-TWO", memberId: "MEM-001", revision: 12 }));
    expect(ready).not.toBe(onlineRequiredReplicaKey({ environment: "development", householdId: "HH-ONE", memberId: "MEM-002", revision: 12 }));
    expect(ready).not.toBe(onlineRequiredReplicaKey({ environment: "development", householdId: "HH-ONE", memberId: "MEM-001", revision: 13 }));
  });

  it("invalidates a deferred canonical adoption across household, member, or environment switches", () => {
    const expected = {
      generation: 4,
      environment: "development" as const,
      householdId: "HH-A",
      memberId: "MEM-001",
    };
    expect(replicaAdoptionScopeMatches(expected, expected)).toBe(true);
    expect(replicaAdoptionScopeMatches(expected, { ...expected, generation: 5, householdId: "HH-B" })).toBe(false);
    expect(replicaAdoptionScopeMatches(expected, { ...expected, generation: 5, environment: "production" })).toBe(false);
    expect(replicaAdoptionScopeMatches(expected, { ...expected, generation: 5, memberId: "MEM-002" })).toBe(false);
  });

  it("never lets revision-only Realtime dedupe skip a differing paired replica", () => {
    expect(revisionDedupeMaySkipPairedAdoption(true, true)).toBe(false);
    expect(revisionDedupeMaySkipPairedAdoption(true, false)).toBe(false);
    expect(revisionDedupeMaySkipPairedAdoption(false, true)).toBe(true);
  });

  it("refuses a lower paired generation and restores readiness only when cloud catches up", () => {
    expect(pairedCloudRevisionGate({
      remoteRevision: 12,
      localRevision: 13,
      localBaseRevision: 13,
    })).toEqual({ mayAdopt: false, readinessRevision: null });
    expect(pairedCloudRevisionGate({
      remoteRevision: 13,
      localRevision: 13,
      localBaseRevision: 13,
    })).toEqual({ mayAdopt: true, readinessRevision: 13 });
  });

  it("repairs only from the same revision-anchored cloud books with no local work", () => {
    const snapshot = {
      ...catalogHousehold(),
      linked: true,
      revision: 4,
      baseRevision: 4,
      booksAcceptedHash: "accepted-hash",
      sharing: {
        linked: true,
        mode: "synchronized" as const,
        pending: false,
        lastError: null,
        lastTransportAt: "2026-09-03T12:00:00.000Z",
      },
    };
    expect(canRepairProjectionFromAcknowledgedCache({ snapshot, pendingOutboxCount: 0, hasOpenConflict: false }))
      .toEqual({ allowed: true, reason: null });
    expect(canRepairProjectionFromAcknowledgedCache({ snapshot, pendingOutboxCount: 1, hasOpenConflict: false }).allowed).toBe(false);
    expect(canRepairProjectionFromAcknowledgedCache({ snapshot: { ...snapshot, sharing: { ...snapshot.sharing, mode: "pending-transport" } }, pendingOutboxCount: 0, hasOpenConflict: false }).allowed).toBe(false);
    expect(canRepairProjectionFromAcknowledgedCache({ snapshot: { ...snapshot, baseRevision: 3 }, pendingOutboxCount: 0, hasOpenConflict: false }).allowed).toBe(false);
  });

  it("repairs only an exact legacy crash-window or accepted-tip binding", () => {
    const previous = {
      ...catalogHousehold(),
      linked: true,
      revision: 7,
      baseRevision: 7,
      booksAcceptedHash: "accepted-previous",
    };
    const item = {
      householdId: previous.householdId,
      memberId: previous.members[0]!.id,
      environment: previous.environment,
      expectedRevision: 7,
      tipRevision: 8,
      confirmationIds: ["confirm-8"],
      blockedByConflict: false,
    };
    expect(canRepairProjectionWithBoundOutbox({ snapshot: previous, items: [item], hasOpenConflict: false }).allowed).toBe(true);
    expect(canRepairProjectionWithBoundOutbox({ snapshot: previous, items: [{ ...item, tipRevision: 9, blockedByConflict: true }], hasOpenConflict: false }).allowed).toBe(false);

    const pending = {
      ...previous,
      revision: 8,
      baseRevision: 7,
      commandReceipts: [{
        confirmationId: "confirm-8",
        identityHash: "identity",
        auditHash: "audit",
        commandKind: "commit",
        postedIds: [],
        revision: 8,
        acceptedAt: "2026-09-03T12:00:00.000Z",
      }],
    };
    expect(canRepairProjectionWithBoundOutbox({ snapshot: pending, items: [item], hasOpenConflict: false }).allowed).toBe(true);
    expect(canRepairProjectionWithBoundOutbox({ snapshot: pending, items: [{ ...item, confirmationIds: ["different"] }], hasOpenConflict: false }).allowed).toBe(false);
  });
});
