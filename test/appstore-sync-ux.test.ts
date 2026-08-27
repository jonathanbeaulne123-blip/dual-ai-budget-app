import { describe, expect, it } from "vitest";
import {
  appendRestorePoint,
  autoResolveSharedConflict,
  catalogHousehold,
  describeSharedConflictImpact,
  markSynchronized,
  pairingStatusLabel,
  postEntry,
  restoreConfirmBody,
  restorePointImpact,
  sharedEnvelopeForRestorePoint,
  splitForSync,
  unresolvedConflicts,
} from "../src/core/index.ts";

describe("shared conflict impact", () => {
  it("summarizes shared-only differences and CAD only-on-side", () => {
    const base = catalogHousehold();
    const phone = postEntry(base, {
      date: "2026-08-25",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Phone only",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const cloud = postEntry(base, {
      date: "2026-08-25",
      type: "expense",
      amount: "7.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Cloud only",
      createdBy: "MEM-002",
      confirmDuplicate: true,
    }).household;
    const impact = describeSharedConflictImpact(phone, cloud);
    expect(impact.transactionCount).toBeGreaterThan(0);
    expect(impact.onlyOnPhoneCents).toBe(400);
    expect(impact.onlyOnCloudCents).toBe(700);
    expect(impact.summary).toMatch(/shared transaction/i);
  });
});

describe("restore point privacy and blast radius", () => {
  it("strips personal rows and nested restore history from tip payloads", async () => {
    const sharedPost = postEntry(catalogHousehold(), {
      date: "2026-08-25",
      type: "expense",
      amount: "5.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const personal = postEntry(sharedPost.household, {
      date: "2026-08-25",
      type: "expense",
      amount: "2.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Personal snack",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    });
    const tip = markSynchronized({
      ...personal.household,
      revision: 4,
      baseRevision: 4,
      linked: true,
    });
    const withPoint = await appendRestorePoint(tip, "MEM-001");
    const point = withPoint.restorePoints?.[0];
    expect(point).toBeTruthy();
    expect(point!.shared.transactions.some((tx) => tx.note === "Personal snack")).toBe(false);
    expect(point!.shared.transactions.some((tx) => tx.note === "Shared")).toBe(true);
    expect(point!.shared.restorePoints).toBeUndefined();

    const { shared } = splitForSync(withPoint, "MEM-001");
    const personalTx = personal.household.transactions.find((tx) => tx.note === "Personal snack")!;
    const cleaned = sharedEnvelopeForRestorePoint({
      ...shared,
      restorePoints: withPoint.restorePoints,
      transactions: [...shared.transactions, personalTx],
    });
    expect(cleaned.restorePoints).toBeUndefined();
    expect(cleaned.transactions.some((tx) => tx.note === "Personal snack")).toBe(false);
  });

  it("names later shared rows in Restore confirm copy", async () => {
    const atTip = markSynchronized({
      ...catalogHousehold(),
      revision: 2,
      baseRevision: 2,
      linked: true,
    });
    const withPoint = await appendRestorePoint(atTip, "MEM-001");
    const point = withPoint.restorePoints![0]!;
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
    const impact = restorePointImpact(later.household, point);
    expect(impact.sharedTxAfterCount).toBe(1);
    expect(restoreConfirmBody(point, later.household)).toMatch(/1 shared transaction/);
    expect(restoreConfirmBody(point, later.household)).toMatch(/Personal rows stay/);
  });
});

describe("autoResolveSharedConflict", () => {
  it("merges when shared money matches but catalogs differ without leaving open conflicts", async () => {
    const base = catalogHousehold();
    const phone = {
      ...base,
      linked: true,
      revision: 9,
      baseRevision: 8,
      workJobs: [{ id: "JOB-PHONE", name: "Phone job", memberId: "MEM-001", active: true }],
    };
    const cloud = {
      ...base,
      linked: true,
      revision: 8,
      baseRevision: 8,
      workJobs: [{ id: "JOB-CLOUD", name: "Cloud job", memberId: "MEM-002", active: true }],
    };
    const impact = describeSharedConflictImpact(phone, cloud);
    expect(impact.summary).toMatch(/Shared money rows match/);

    const resolved = await autoResolveSharedConflict(phone, cloud, "MEM-001", "local");
    expect(unresolvedConflicts(resolved)).toHaveLength(0);
    expect(resolved.sharing?.mode).toBe("pending-transport");
    expect(resolved.revision).toBeGreaterThan(cloud.revision);
  });
});

describe("pairing status label", () => {
  it("follows sharing mode instead of linked boolean alone", () => {
    const local = catalogHousehold();
    expect(pairingStatusLabel(local).label).toBe("Pass / phrase");
    const synced = markSynchronized({ ...local, linked: true, revision: 1, baseRevision: 1 });
    expect(pairingStatusLabel(synced, { authEnabled: true }).label).toBe("Sharing");
    expect(pairingStatusLabel(synced, { authEnabled: false }).label).toBe("Up to date");
  });
});
