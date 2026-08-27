import { describe, expect, it } from "vitest";
import {
  appendRestorePoint,
  applyRestorePoint,
  assertLatestMemberLedgerUndo,
  canRestorePoint,
  catalogHousehold,
  latestMemberLedgerToken,
  listRestorePoints,
  markConflicted,
  markSynchronized,
  postEntry,
  reversePostedMoney,
  undoLedgerConfirm,
} from "../src/core/index.ts";
import type { UndoToken } from "../src/core/types.ts";

describe("confirmation-scoped Undo", () => {
  it("removes only the Confirm posted ids and keeps a later partner post", () => {
    const base = catalogHousehold();
    const mine = postEntry(base, {
      date: "2026-08-25",
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "My coffee",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const partner = postEntry(mine.household, {
      date: "2026-08-25",
      type: "expense",
      amount: "8.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Partner bread",
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    const token: UndoToken = {
      ...mine.undo,
      actorMemberId: "MEM-001",
    };
    const undone = undoLedgerConfirm(partner.household, token);
    expect(undone.household.transactions.some((tx) => tx.note === "My coffee")).toBe(false);
    expect(undone.household.transactions.some((tx) => tx.note === "Partner bread")).toBe(true);
  });

  it("refuses undo after a partner reversal (journal integrity)", () => {
    const base = catalogHousehold();
    const mine = postEntry(base, {
      date: "2026-08-25",
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "My coffee",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const partner = postEntry(mine.household, {
      date: "2026-08-25",
      type: "expense",
      amount: "8.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Partner bread",
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    const reversed = reversePostedMoney(partner.household, mine.postedIds[0]!, { createdBy: "MEM-002" });
    const token: UndoToken = {
      ...mine.undo,
      actorMemberId: "MEM-001",
    };
    expect(() => undoLedgerConfirm(reversed.household, token)).toThrow(/already reversed/i);
  });

  it("refuses to undo a partner-created row even if listed in postedIds", () => {
    const partner = postEntry(catalogHousehold(), {
      date: "2026-08-25",
      type: "expense",
      amount: "8.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Partner bread",
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    const forged: UndoToken = {
      id: "ACT-forged",
      label: "Forged",
      snapshot: catalogHousehold(),
      postedIds: partner.postedIds,
      actorMemberId: "MEM-001",
    };
    expect(() => undoLedgerConfirm(partner.household, forged)).toThrow(/another person's money/i);
  });

  it("enforces LIFO of this member's ledger tokens", () => {
    const older: UndoToken = {
      id: "ACT-older",
      label: "Older",
      snapshot: catalogHousehold(),
      postedIds: ["TXN-1"],
      actorMemberId: "MEM-001",
    };
    const newer: UndoToken = {
      id: "ACT-newer",
      label: "Newer",
      snapshot: catalogHousehold(),
      postedIds: ["TXN-2"],
      actorMemberId: "MEM-001",
    };
    const partner: UndoToken = {
      id: "ACT-partner",
      label: "Partner",
      snapshot: catalogHousehold(),
      postedIds: ["TXN-3"],
      actorMemberId: "MEM-002",
    };
    const history = [older, newer, partner];
    expect(latestMemberLedgerToken(history, "MEM-001")?.id).toBe("ACT-newer");
    expect(() => assertLatestMemberLedgerUndo(history, "MEM-001", older)).toThrow(/latest money change/i);
    expect(() => assertLatestMemberLedgerUndo(history, "MEM-001", newer)).not.toThrow();
  });
});

describe("owner Restore points", () => {
  it("records a tip and refuses Restore while conflicted", async () => {
    const household = markSynchronized({
      ...catalogHousehold(),
      revision: 3,
      baseRevision: 3,
      linked: true,
    });
    const withPoint = await appendRestorePoint(household, "MEM-001");
    const points = listRestorePoints(withPoint);
    expect(points).toHaveLength(1);

    const conflicted = markConflicted(withPoint);
    const gate = canRestorePoint(conflicted, points[0], { isOwner: true });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("open-conflict");
  });

  it("restores shared tip while keeping personal rows", async () => {
    const base = markSynchronized({
      ...catalogHousehold(),
      revision: 2,
      baseRevision: 2,
      linked: true,
    });
    const sharedPost = postEntry(base, {
      date: "2026-08-25",
      type: "expense",
      amount: "5.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared tip snack",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const atTip = markSynchronized({
      ...sharedPost.household,
      revision: 3,
      baseRevision: 3,
      linked: true,
    });
    const withPoint = await appendRestorePoint(atTip, "MEM-001");
    const point = listRestorePoints(withPoint)[0];
    expect(point).toBeTruthy();

    const later = postEntry(withPoint, {
      date: "2026-08-25",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "After tip",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const personal = postEntry(later.household, {
      date: "2026-08-25",
      type: "expense",
      amount: "3.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Personal later",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    });
    const ready = markSynchronized({
      ...personal.household,
      revision: 5,
      baseRevision: 5,
      linked: true,
    });
    const restored = applyRestorePoint(ready, point!, "MEM-001", { isOwner: true });
    expect(restored.transactions.some((tx) => tx.note === "After tip")).toBe(false);
    expect(restored.transactions.some((tx) => tx.note === "Shared tip snack")).toBe(true);
    expect(restored.transactions.some((tx) => tx.note === "Personal later")).toBe(true);
  });

  it("blocks non-owners", async () => {
    const household = await appendRestorePoint(
      markSynchronized({ ...catalogHousehold(), revision: 1, baseRevision: 1, linked: true }),
      "MEM-001",
    );
    const point = listRestorePoints(household)[0];
    const gate = canRestorePoint(household, point, { isOwner: false });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("not-owner");
  });
});
