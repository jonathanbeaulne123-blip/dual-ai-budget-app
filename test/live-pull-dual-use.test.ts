import { describe, expect, it, afterEach, vi } from "vitest";
import {
  absorbDisjointSharedMoney,
  canAbsorbDisjointSharedMoney,
  canAutoMergeConflict,
  catalogHousehold,
  mergeSharedLastEntryWins,
  postEntry,
  recordConflict,
  reversePostedMoney,
  resolveStoredConflictsLastEntryWins,
} from "../src/core/index.ts";
import {
  activeMemberCountHint,
  livePullIntervalMs,
  scaleEnvelopeClaim,
  scalePullBandForMembers,
  shouldRunLivePull,
} from "../src/continuityLivePull.ts";
import {
  clearContinuityOutboxConflictBlocks,
  continuityBackoffMs,
  createMemoryContinuityStore,
  flushContinuityOutbox,
  listContinuityOutbox,
  setContinuityStore,
  transportHouseholdWithOutbox,
} from "../src/continuity.ts";
import { reconnectPollDelayMs } from "../src/continuityResume.ts";
import { linkGoogleIdentity } from "../src/core/index.ts";
import type { Household } from "../src/core/types.ts";

const config = { url: "https://live-pull.example.supabase.co", key: "sb_publishable_test" };
const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };

function googleHousehold(): Household {
  return linkGoogleIdentity(catalogHousehold(), {
    memberId: "MEM-001",
    email: identity.email,
    subject: identity.subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
}

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  setContinuityStore(null);
  vi.unstubAllGlobals();
});

describe("live pull interval (2 / 10 / 100 scale)", () => {
  it("polls every 4s for a two-person kitchen", () => {
    expect(livePullIntervalMs(2)).toBe(4_000);
    expect(livePullIntervalMs(9)).toBe(4_000);
  });

  it("slows slightly for ~10 active members", () => {
    expect(livePullIntervalMs(10)).toBe(5_000);
    expect(livePullIntervalMs(49)).toBe(5_000);
  });

  it("slows further at 50+ (100-person hint) until Realtime is primary", () => {
    expect(livePullIntervalMs(50)).toBe(8_000);
    expect(livePullIntervalMs(100)).toBe(8_000);
  });

  it("maps named T3-S4 bands and active member hints", () => {
    expect(scalePullBandForMembers(2).label).toBe("2–9");
    expect(scalePullBandForMembers(10).label).toBe("10–49");
    expect(scalePullBandForMembers(50).label).toBe("50–100");
    expect(activeMemberCountHint([{ active: true }, { active: true }, { active: false }])).toBe(2);
    expect(activeMemberCountHint([])).toBe(2);
  });

  it("refuses a 100-person production claim on poll alone", () => {
    expect(scaleEnvelopeClaim({
      memberCountHint: 100,
      realtimeEnabled: false,
      realtimeSubscribed: false,
    }).productionReadyClaim).toBe(false);
    expect(scaleEnvelopeClaim({
      memberCountHint: 2,
      realtimeEnabled: true,
      realtimeSubscribed: true,
    }).productionReadyClaim).toBe(true);
  });

  it("composes T3-S3 reconnect backoff on the scaled poll base", () => {
    expect(reconnectPollDelayMs({
      baseIntervalMs: livePullIntervalMs(10),
      realtimeStatus: "CHANNEL_ERROR",
      consecutiveUnhealthyPolls: 3,
      realtimeEnabled: true,
    })).toBe(Math.max(5_000, continuityBackoffMs(3)));
    expect(reconnectPollDelayMs({
      baseIntervalMs: livePullIntervalMs(100),
      realtimeStatus: "CLOSED",
      consecutiveUnhealthyPolls: 6,
      realtimeEnabled: true,
    })).toBe(Math.max(8_000, continuityBackoffMs(6)));
  });

  it("runs only when visible, online, and signed into a household", () => {
    expect(shouldRunLivePull({
      documentVisible: true,
      online: true,
      hasSession: true,
      hasHousehold: true,
    })).toBe(true);
    expect(shouldRunLivePull({
      documentVisible: false,
      online: true,
      hasSession: true,
      hasHousehold: true,
    })).toBe(false);
  });
});

describe("disjoint shared money absorb", () => {
  it("absorbs two non-overlapping shared expenses without opening conflict", () => {
    const base = { ...catalogHousehold(), revision: 3, baseRevision: 3, linked: true };
    const local = {
      ...postEntry(base, {
        date: "2026-08-25",
        type: "expense",
        amount: "12.00",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "Jonathan milk",
        createdBy: "MEM-001",
        confirmDuplicate: true,
      }).household,
      revision: 4,
      baseRevision: 3,
      linked: true,
    };
    const remote = {
      ...postEntry(base, {
        date: "2026-08-25",
        type: "expense",
        amount: "8.00",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "Bianca bread",
        createdBy: "MEM-002",
        confirmDuplicate: true,
      }).household,
      revision: 4,
      baseRevision: 4,
      linked: true,
    };
    expect(canAutoMergeConflict(local, remote)).toBe(false);
    expect(canAbsorbDisjointSharedMoney(local, remote)).toBe(true);
    const merged = absorbDisjointSharedMoney(local, remote, "MEM-001");
    expect(merged.sharing?.mode).toBe("pending-transport");
    expect(merged.revision).toBe(5);
    expect(merged.baseRevision).toBe(4);
    expect(merged.transactions.some((tx) => tx.note === "Jonathan milk")).toBe(true);
    expect(merged.transactions.some((tx) => tx.note === "Bianca bread")).toBe(true);
  });

  it("refuses absorb when tombstones disagree (no silent resurrect)", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-25",
      type: "expense",
      amount: "10.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared coffee",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const txId = posted.transactions.find((tx) => tx.note === "Shared coffee")!.id;
    const local = {
      ...posted,
      revision: 2,
      baseRevision: 1,
      linked: true,
      transactions: posted.transactions.filter((tx) => tx.id !== txId),
      tombstones: [{ id: txId, deletedAt: "2026-08-25T12:00:00.000Z" }],
    };
    const remote = { ...posted, revision: 2, baseRevision: 2, linked: true };
    expect(canAbsorbDisjointSharedMoney(local, remote)).toBe(false);
  });

  it("refuses absorb when the same shared txn id diverges", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-25",
      type: "expense",
      amount: "10.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared coffee",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const local = { ...posted, revision: 2, baseRevision: 1, linked: true };
    const remote = {
      ...posted,
      revision: 2,
      baseRevision: 2,
      linked: true,
      transactions: posted.transactions.map((tx) => (
        tx.note === "Shared coffee" ? { ...tx, amountCents: 1500 } : tx
      )),
    };
    expect(canAbsorbDisjointSharedMoney(local, remote)).toBe(false);
  });

  it("keeps distinct rows and lets the canonical later side win one same-id row", () => {
    const base = { ...catalogHousehold(), revision: 3, baseRevision: 3, linked: true };
    const first = postEntry(base, {
      date: "2026-08-25",
      type: "expense",
      amount: "10.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Original coffee",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const txId = first.transactions.at(-1)!.id;
    const localOnly = postEntry(first, {
      date: "2026-08-25",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Local milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const remoteOnly = postEntry(first, {
      date: "2026-08-25",
      type: "expense",
      amount: "6.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Remote bread",
      createdBy: "MEM-002",
      confirmDuplicate: true,
    }).household;
    const sameTimestamp = first.transactions.find((row) => row.id === txId)!.updatedAt;
    const local = {
      ...localOnly,
      revision: 4,
      baseRevision: 3,
      transactions: localOnly.transactions.map((row) => row.id === txId
        ? { ...row, amountCents: 1100, note: "Local correction", updatedAt: sameTimestamp }
        : row),
    };
    const remote = {
      ...remoteOnly,
      revision: 5,
      baseRevision: 5,
      transactions: remoteOnly.transactions.map((row) => row.id === txId
        ? { ...row, amountCents: 1200, note: "Remote correction", updatedAt: sameTimestamp }
        : row),
    };

    const merged = mergeSharedLastEntryWins(local, remote, "MEM-001", "remote");
    expect(merged.transactions.some((row) => row.note === "Local milk")).toBe(true);
    expect(merged.transactions.some((row) => row.note === "Remote bread")).toBe(true);
    expect(merged.transactions.find((row) => row.id === txId)?.note).toBe("Remote correction");
    expect(merged.conflicts?.some((row) => !row.resolved)).toBe(false);
    expect(merged.sharing?.mode).toBe("pending-transport");
    expect(merged.baseRevision).toBe(5);
  });

  it("uses an accepted receipt delta instead of a skewed device clock for a rebased same-id entry", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-25",
      type: "expense",
      amount: "10.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Original",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const txId = posted.transactions.at(-1)!.id;
    const local = {
      ...posted,
      revision: 5,
      baseRevision: 4,
      transactions: posted.transactions.map((row) => row.id === txId
        ? { ...row, note: "Last accepted locally", amountCents: 1100, updatedAt: "2026-08-25T09:00:00.000Z" }
        : row),
      commandReceipts: [{
        confirmationId: "local-last",
        identityHash: "local-last",
        auditHash: "local-last",
        commandKind: "postEntry",
        postedIds: [txId],
        revision: 5,
        acceptedAt: "2026-08-25T12:00:00.000Z",
      }],
    };
    const remote = {
      ...posted,
      revision: 6,
      baseRevision: 6,
      transactions: posted.transactions.map((row) => row.id === txId
        ? { ...row, note: "Earlier cloud value with a fast clock", amountCents: 1200, updatedAt: "2026-08-25T15:00:00.000Z" }
        : row),
    };

    const merged = mergeSharedLastEntryWins(local, remote, "MEM-001", "local");
    expect(merged.transactions.find((row) => row.id === txId)?.note).toBe("Last accepted locally");
  });

  it("uses receipt revision order when both replicas changed the same id", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-25",
      type: "expense",
      amount: "10.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Original",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const txId = posted.transactions.at(-1)!.id;
    const receipt = (confirmationId: string, revision: number, acceptedAt: string) => ({
      confirmationId,
      identityHash: confirmationId,
      auditHash: confirmationId,
      commandKind: "postEntry",
      postedIds: [txId],
      revision,
      acceptedAt,
    });
    const local = {
      ...posted,
      revision: 6,
      transactions: posted.transactions.map((row) => row.id === txId ? { ...row, note: "Local earlier receipt" } : row),
      commandReceipts: [receipt("local-edit", 6, "2026-08-25T12:00:00.000Z")],
    };
    const remote = {
      ...posted,
      revision: 7,
      baseRevision: 7,
      transactions: posted.transactions.map((row) => row.id === txId ? { ...row, note: "Remote later receipt" } : row),
      commandReceipts: [receipt("remote-edit", 7, "2026-08-25T12:01:00.000Z")],
    };

    const merged = mergeSharedLastEntryWins(local, remote, "MEM-001", "local");
    expect(merged.transactions.find((row) => row.id === txId)?.note).toBe("Remote later receipt");
  });

  it("never resurrects a tombstoned original while protecting reversal history", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-25",
      type: "expense",
      amount: "10.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Reversed original",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const txId = posted.transactions.at(-1)!.id;
    const reversed = reversePostedMoney(posted, txId, { createdBy: "MEM-001" }).household;
    const tombstone = { id: txId, deletedAt: "2026-08-25T16:00:00.000Z" };
    const local = {
      ...reversed,
      revision: 7,
      baseRevision: 6,
      transactions: reversed.transactions.filter((row) => row.id !== txId),
      tombstones: [...(reversed.tombstones ?? []), tombstone],
    };
    const remote = { ...reversed, revision: 6, baseRevision: 6 };

    const merged = mergeSharedLastEntryWins(local, remote, "MEM-001", "local");
    expect(merged.transactions.some((row) => row.id === txId)).toBe(false);
    expect(merged.transactions.some((row) => row.reversalOfId === txId)).toBe(true);
  });
});

describe("post-conflict outbox resume", () => {
  it("replays a conflict-blocked legacy row so it can be rebased automatically", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 4, baseRevision: 3, linked: true };
    const remote = { ...household, revision: 5, baseRevision: 5 };
    let casCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot")) {
        casCalls += 1;
        return response({
          ok: false,
          conflict: true,
          reason: "stale-revision",
          remote_revision: remote.revision,
          remote_payload: JSON.stringify(remote),
        });
      }
      if (url.includes("continuity_memberships?select=household_id")) return response([]);
      return response(null, 201);
    }));

    await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 3,
      confirmationId: "legacy-blocked",
      config,
    });
    expect(listContinuityOutbox("development")[0]?.blockedByConflict).toBe(true);
    await flushContinuityOutbox({ environment: "development", identity, config });
    expect(casCalls).toBe(2);
  });

  it("clears conflict blocks so force flush can run again", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 4, baseRevision: 3, linked: true };
    const remote = {
      ...googleHousehold(),
      revision: 5,
      baseRevision: 5,
      linked: true,
      householdId: household.householdId,
      inviteCode: household.inviteCode,
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot")) {
        return response({
          ok: false,
          conflict: true,
          reason: "stale-revision",
          remote_revision: remote.revision,
          remote_payload: JSON.stringify(remote),
        });
      }
      if (url.includes("continuity_memberships?select=household_id")) return response([]);
      if (
        url.includes("continuity_memberships?on_conflict")
        || url.includes("continuity_personal_snapshots?on_conflict")
      ) {
        return response(null, 201);
      }
      return response(null, 201);
    }));

    const result = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 3,
      confirmationId: "confirm-stale",
      config,
    });
    expect(result.ok).toBe(false);
    expect(listContinuityOutbox("development")[0]?.blockedByConflict).toBe(true);

    const cleared = clearContinuityOutboxConflictBlocks({
      environment: "development",
      identity,
      householdId: household.householdId,
      expectedRevision: 5,
    });
    expect(cleared).toBe(1);
    expect(listContinuityOutbox("development")[0]?.blockedByConflict).toBe(false);
    expect(listContinuityOutbox("development")[0]?.expectedRevision).toBe(5);
  });

  it("upgrades a persisted conflict without reopening a chooser", async () => {
    const base = postEntry(catalogHousehold(), {
      date: "2026-08-25",
      type: "expense",
      amount: "10.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Phone correction",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const txId = base.transactions.at(-1)!.id;
    const local = { ...base, revision: 4, baseRevision: 3, linked: true };
    const remote = {
      ...base,
      revision: 5,
      baseRevision: 5,
      linked: true,
      transactions: base.transactions.map((row) => row.id === txId
        ? { ...row, amountCents: 1200, note: "Cloud correction", updatedAt: row.updatedAt }
        : row),
    };
    const conflicted = await recordConflict(local, remote, false);
    const resolved = resolveStoredConflictsLastEntryWins(conflicted, "MEM-001");
    expect(resolved.conflicts?.every((row) => row.resolved)).toBe(true);
    expect(resolved.transactions.find((row) => row.id === txId)?.note).toBe("Phone correction");
    expect(resolved.sharing?.mode).toBe("pending-transport");
  });
});
