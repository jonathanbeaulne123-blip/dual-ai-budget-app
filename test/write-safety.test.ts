import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/seed.ts";
import {
  postEntry,
  postShift,
  postTransfer,
  undo,
  reversePostedMoney,
} from "../src/core/commands.ts";
import { undoLedgerConfirm } from "../src/core/confirmationUndo.ts";
import { createWriteQueue } from "../src/core/writeQueue.ts";
import { shiftSettingsFingerprint } from "../src/core/shift.ts";
import { UNPUBLISHED_PHRASE } from "../src/api.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("write queue", () => {
  it("runs household writes in order even when they overlap", async () => {
    const enqueue = createWriteQueue();
    const order: number[] = [];
    const first = enqueue(async () => {
      await delay(30);
      order.push(1);
      return 1;
    });
    const second = enqueue(async () => {
      order.push(2);
      return 2;
    });
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });

  it("keeps a stale paired replay from rolling back a cloud-acknowledged Confirm", async () => {
    const enqueue = createWriteQueue();
    let releaseConfirm!: () => void;
    const confirmPaused = new Promise<void>((resolve) => {
      releaseConfirm = resolve;
    });
    let projection = {
      household: { revision: 12 },
      storageRevision: 12,
      pgliteRevision: 12,
      readinessRevision: 12 as number | null,
    };
    const replayStart = projection.household;

    const confirm = enqueue(async () => {
      projection = { ...projection, readinessRevision: null };
      await confirmPaused;
      projection = {
        household: { revision: 13 },
        storageRevision: 13,
        pgliteRevision: 13,
        readinessRevision: 13,
      };
    });
    const staleReplay = enqueue(async () => {
      if (projection.household !== replayStart) {
        throw new Error("The active books changed before the cloud copy could be installed.");
      }
      projection = {
        household: { revision: 12 },
        storageRevision: 12,
        pgliteRevision: 12,
        readinessRevision: 12,
      };
    });

    releaseConfirm();
    await expect(confirm).resolves.toBeUndefined();
    await expect(staleReplay).rejects.toThrow("active books changed");
    expect(projection).toEqual({
      household: { revision: 13 },
      storageRevision: 13,
      pgliteRevision: 13,
      readinessRevision: 13,
    });
  });

  it("refuses a precomputed money candidate after an earlier paired install changes the live books", async () => {
    const enqueue = createWriteQueue();
    let releasePair!: () => void;
    const pairPaused = new Promise<void>((resolve) => { releasePair = resolve; });
    let live = { revision: 12, facts: ["accepted-before"] };
    const expectedHousehold = live;
    const staleCandidate = { revision: 12, facts: ["accepted-before", "queued-confirm"] };

    const pairedInstall = enqueue(async () => {
      await pairPaused;
      live = { revision: 13, facts: ["accepted-before", "paired-cloud-fact"] };
    });
    const queuedConfirm = enqueue(async () => {
      if (live !== expectedHousehold) return false;
      live = { ...staleCandidate, revision: live.revision + 1 };
      return true;
    });

    releasePair();
    await pairedInstall;
    await expect(queuedConfirm).resolves.toBe(false);
    expect(live).toEqual({ revision: 13, facts: ["accepted-before", "paired-cloud-fact"] });
  });

  it("finishes a deferred replica save before clearing the device copy", async () => {
    const enqueue = createWriteQueue();
    let scopeGeneration = 4;
    let localRevision: number | null = 12;
    let releaseSave!: () => void;
    const savePaused = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const expectedGeneration = scopeGeneration;

    const install = enqueue(async () => {
      await savePaused;
      localRevision = 12;
      if (scopeGeneration !== expectedGeneration) {
        throw new Error("The active ledger changed while saving cloud books.");
      }
    });
    scopeGeneration += 1;
    const clear = enqueue(async () => {
      localRevision = null;
    });

    releaseSave();
    await expect(install).rejects.toThrow("active ledger changed");
    await expect(clear).resolves.toBeUndefined();
    expect(localRevision).toBeNull();
  });
});

describe("reverse and undo", () => {
  it("reverses an expense and can undo the reversing entry", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-21",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "QA milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const reversed = reversePostedMoney(posted.household, posted.postedIds[0]!);
    expect(reversed.household.transactions).toHaveLength(2);
    expect(reversed.household.transactions.some((tx) => tx.note === "QA milk")).toBe(true);
    expect(reversed.household.transactions.some((tx) => tx.reversalOfId === posted.postedIds[0])).toBe(true);
    const restored = undoLedgerConfirm(reversed.household, {
      ...reversed.undo,
      actorMemberId: "MEM-001",
    });
    expect(restored.household.transactions).toHaveLength(1);
    expect(restored.household.transactions[0]?.note).toBe("QA milk");
  });

  it("legacy whole-snapshot undo tombstones partner rows that confirmation undo keeps", () => {
    const base = catalogHousehold();
    const mine = postEntry(base, {
      date: "2026-08-21",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "My row",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const partner = postEntry(mine.household, {
      date: "2026-08-21",
      type: "expense",
      amount: "3.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Partner row",
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    const legacy = undo(partner.household, mine.undo);
    expect(legacy.transactions.some((row) => row.note === "Partner row")).toBe(false);
    const scoped = undoLedgerConfirm(partner.household, { ...mine.undo, actorMemberId: "MEM-001" });
    expect(scoped.household.transactions.some((row) => row.note === "Partner row")).toBe(true);
  });

  it("reverses both sides of a transfer without deleting the original pair", () => {
    const posted = postTransfer(catalogHousehold(), {
      date: "2026-08-21",
      amount: "40.00",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    expect(posted.household.transactions).toHaveLength(2);
    const reversed = reversePostedMoney(posted.household, posted.postedIds[0]!);
    expect(reversed.household.transactions).toHaveLength(4);
    expect(reversed.postedIds).toHaveLength(2);
  });

  it("reverses shift income and keeps the shift row", () => {
    const posted = postShift(catalogHousehold(), {
      date: "2026-08-21",
      memberId: "MEM-002",
      accountId: "ACC-CASH",
      sales: "100.00",
      cashTips: "10.00",
      ccTips: "5.00",
      hours: "4.00",
      settingsFingerprint: shiftSettingsFingerprint(catalogHousehold().shiftSettings),
      createdBy: "MEM-002",
      confirmDuplicate: true,
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    expect(posted.household.shifts).toHaveLength(1);
    expect(posted.household.transactions).toHaveLength(2);
    const wages = posted.household.transactions.find((tx) => tx.note.startsWith("Wages"));
    const reversed = reversePostedMoney(posted.household, wages!.id);
    expect(reversed.household.shifts).toHaveLength(1);
    expect(reversed.household.transactions.length).toBeGreaterThanOrEqual(4);
  });

  it("tombstones posted ids even when undo gets a stale current snapshot", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-21",
      type: "expense",
      amount: "0.01",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "QA TEST UNDO",
      place: "QA TEST UNDO",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    expect(posted.undo.postedIds).toEqual(posted.postedIds);
    const stale = catalogHousehold();
    const restored = undo(stale, posted.undo);
    expect(restored.transactions).toHaveLength(0);
    expect(restored.tombstones.some((item) => item.id === posted.postedIds[0])).toBe(true);
  });
});

describe("join copy", () => {
  it("does not tell Bianca a missing phrase is right", () => {
    expect(UNPUBLISHED_PHRASE).not.toMatch(/phrase is right/i);
    expect(UNPUBLISHED_PHRASE).toMatch(/Continue with Google/);
    expect(UNPUBLISHED_PHRASE).toMatch(/Advanced recovery/);
  });
});
