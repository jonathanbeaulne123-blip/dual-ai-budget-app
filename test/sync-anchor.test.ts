// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import { markSynchronized } from "../src/core/sharing.ts";
import {
  clearSyncAnchor,
  createMemorySyncAnchorStore,
  loadSyncAnchor,
  resetSyncAnchorStore,
  saveSyncAnchor,
  setSyncAnchorStore,
  syncAnchorStorageKey,
} from "../src/syncAnchor.ts";

describe("sync anchor", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSyncAnchorStore();
  });

  it("uses the v1 environment-scoped storage key", () => {
    expect(syncAnchorStorageKey("development", "HH-DEMO")).toBe("hearth:sync-anchor:v1:development:HH-DEMO");
  });

  it("saves and loads synchronized snapshots through ensureHouseholdShape", () => {
    const store = createMemorySyncAnchorStore();
    setSyncAnchorStore(store);
    const household = markSynchronized({ ...catalogHousehold(), householdId: "HH-ANCHOR", revision: 7 });

    saveSyncAnchor("development", household);
    const loaded = loadSyncAnchor("development", "HH-ANCHOR");

    expect(loaded?.revision).toBe(7);
    expect(loaded?.sharing.mode).toBe("synchronized");
    expect(loaded?.householdId).toBe("HH-ANCHOR");
  });

  it("clears anchors for undo/reverse restore paths", () => {
    const store = createMemorySyncAnchorStore();
    setSyncAnchorStore(store);
    const household = catalogHousehold();
    saveSyncAnchor("development", household);
    expect(loadSyncAnchor("development", household.householdId)).not.toBeNull();

    clearSyncAnchor("development", household.householdId);
    expect(loadSyncAnchor("development", household.householdId)).toBeNull();
  });

  it("isolates anchors per environment and household", () => {
    const store = createMemorySyncAnchorStore();
    setSyncAnchorStore(store);
    const dev = { ...catalogHousehold("development"), householdId: "HH-DEV", revision: 1 };
    const prod = { ...catalogHousehold("production"), householdId: "HH-PROD", revision: 2 };

    saveSyncAnchor("development", dev);
    saveSyncAnchor("production", prod);

    expect(loadSyncAnchor("development", "HH-DEV")?.revision).toBe(1);
    expect(loadSyncAnchor("production", "HH-PROD")?.revision).toBe(2);
    expect(loadSyncAnchor("development", "HH-PROD")).toBeNull();
  });
});
