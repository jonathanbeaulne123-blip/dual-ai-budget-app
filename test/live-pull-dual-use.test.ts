import { describe, expect, it, afterEach, vi } from "vitest";
import {
  absorbDisjointSharedMoney,
  canAbsorbDisjointSharedMoney,
  canAutoMergeConflict,
  catalogHousehold,
  postEntry,
  resolveConflictChoice,
  recordConflict,
} from "../src/core/index.ts";
import { livePullIntervalMs, shouldRunLivePull } from "../src/continuityLivePull.ts";
import {
  clearContinuityOutboxConflictBlocks,
  createMemoryContinuityStore,
  listContinuityOutbox,
  setContinuityStore,
  transportHouseholdWithOutbox,
} from "../src/continuity.ts";
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
  });

  it("slows slightly for ~10 active members", () => {
    expect(livePullIntervalMs(10)).toBe(5_000);
  });

  it("slows further at 50+ (100-person hint) until Realtime ships", () => {
    expect(livePullIntervalMs(50)).toBe(8_000);
    expect(livePullIntervalMs(100)).toBe(8_000);
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
});

describe("post-conflict outbox resume", () => {
  it("clears conflict blocks so force flush can run again", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 4, baseRevision: 3, linked: true };
    const remote = { ...googleHousehold(), revision: 5, baseRevision: 5, linked: true };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot")) {
        return response({
          code: "PGRST202",
          message: "Could not find the function public.publish_household_snapshot",
        }, 404);
      }
      if (url.includes("household_snapshots?household_id")) {
        return response([{ payload: JSON.stringify(remote) }]);
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

  it("resolveConflictChoice keeps both sides available for explicit choose", async () => {
    const local = { ...catalogHousehold(), revision: 4, baseRevision: 3, linked: true };
    const remote = { ...catalogHousehold(), revision: 5, baseRevision: 5, linked: true };
    const conflicted = await recordConflict(local, remote, false);
    const open = (conflicted.conflicts ?? []).find((row) => !row.resolved);
    expect(open).toBeTruthy();
    const chosen = resolveConflictChoice(conflicted, open!.id, "remote");
    expect(chosen.conflicts?.every((row) => row.resolved)).toBe(true);
    expect(chosen.revision).toBe(5);
  });
});
