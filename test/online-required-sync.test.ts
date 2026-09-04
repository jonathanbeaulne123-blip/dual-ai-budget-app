import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import {
  canRepairProjectionFromAcknowledgedCache,
  canRepairProjectionWithBoundOutbox,
  onlineRequiredSharedSyncEnabled,
  onlineRequiredWriteGate,
} from "../src/onlineRequiredSync.ts";

describe("online-required shared sync policy", () => {
  it("is an explicit Development-only launch policy", () => {
    expect(onlineRequiredSharedSyncEnabled("development", "1")).toBe(true);
    expect(onlineRequiredSharedSyncEnabled("development", "0")).toBe(false);
    expect(onlineRequiredSharedSyncEnabled("production", "1")).toBe(false);
  });

  it("keeps linked shared books read-only offline or without matching Auth", () => {
    const base = {
      environment: "development" as const,
      sharedScope: true,
      online: true,
      authEnabled: true,
      authSessionPresent: true,
      membershipMatches: true,
      configured: "1",
    };
    expect(onlineRequiredWriteGate(base)).toEqual({ required: true, allowed: true, reason: null });
    expect(onlineRequiredWriteGate({ ...base, online: false })).toMatchObject({ required: true, allowed: false });
    expect(onlineRequiredWriteGate({ ...base, authSessionPresent: false })).toMatchObject({ required: true, allowed: false });
    expect(onlineRequiredWriteGate({ ...base, membershipMatches: false })).toMatchObject({ required: true, allowed: false });
    expect(onlineRequiredWriteGate({ ...base, pendingOutboxCount: 1 })).toMatchObject({ required: true, allowed: false });
    expect(onlineRequiredWriteGate({ ...base, hasUnacknowledgedSnapshot: true })).toMatchObject({ required: true, allowed: false });
    expect(onlineRequiredWriteGate({ ...base, sharedScope: false })).toEqual({ required: false, allowed: true, reason: null });
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
