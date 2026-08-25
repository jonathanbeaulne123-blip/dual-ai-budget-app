// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personalReplicaForMember, seedDemoHousehold } from "../src/core/index.ts";
import {
  activeHouseholdId,
  clearHousehold,
  listHouseholdReplicas,
  loadHousehold,
  loadPersonalReplica,
  saveHousehold,
  selectHouseholdReplica,
} from "../src/storage.ts";
import { loadSession, saveSession } from "../src/session.ts";

const originalIndexedDb = globalThis.indexedDB;

function installMemoryIndexedDb(): void {
  const values = new Map<IDBValidKey, unknown>();
  let created = false;
  const makeRequest = <T>(work: () => T): IDBRequest<T> => {
    const request = { result: undefined, error: null, onsuccess: null, onerror: null } as unknown as IDBRequest<T>;
    queueMicrotask(() => {
      try {
        Object.defineProperty(request, "result", { configurable: true, value: work() });
        request.onsuccess?.(new Event("success") as unknown as Event & { target: IDBRequest<T> });
      } catch (error) {
        Object.defineProperty(request, "error", { configurable: true, value: error });
        request.onerror?.(new Event("error") as unknown as Event & { target: IDBRequest<T> });
      }
    });
    return request;
  };
  const objectStore = {
    get: (key: IDBValidKey) => makeRequest(() => values.get(key)),
    put: (value: unknown, key: IDBValidKey) => {
      values.set(key, structuredClone(value));
      return makeRequest(() => key);
    },
    delete: (key: IDBValidKey) => makeRequest(() => { values.delete(key); return undefined; }),
  } as unknown as IDBObjectStore;
  const db = {
    objectStoreNames: { contains: () => created },
    createObjectStore: () => { created = true; return objectStore; },
    transaction: () => {
      const transaction = { objectStore: () => objectStore, oncomplete: null, onerror: null, onabort: null, error: null } as unknown as IDBTransaction;
      queueMicrotask(() => transaction.oncomplete?.(new Event("complete") as unknown as Event & { target: IDBTransaction }));
      return transaction;
    },
  } as unknown as IDBDatabase;
  const factory = {
    open: () => {
      const request = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (!created) request.onupgradeneeded?.(new Event("upgradeneeded") as IDBVersionChangeEvent);
        request.onsuccess?.(new Event("success") as unknown as Event & { target: IDBOpenDBRequest });
      });
      return request;
    },
  } as unknown as IDBFactory;
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: factory });
}

function household(id: string, name: string) {
  return {
    ...seedDemoHousehold({ today: "2026-08-24", environment: "development" }),
    householdId: id,
    inviteCode: `INVITE-${id}`,
    name,
  };
}

describe("multi-ledger replicas", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalIndexedDb) Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: originalIndexedDb });
    else Reflect.deleteProperty(globalThis, "indexedDB");
  });

  it("migrates the legacy environment snapshot without losing it", async () => {
    const legacy = household("HH-LEGACY", "Legacy kitchen");
    localStorage.setItem("hearth:v1:development", JSON.stringify(legacy));

    const loaded = await loadHousehold("development", null, "MEM-001");

    expect(loaded?.householdId).toBe("HH-LEGACY");
    expect(activeHouseholdId("development")).toBe("HH-LEGACY");
    expect(await listHouseholdReplicas("development")).toMatchObject([
      { householdId: "HH-LEGACY", name: "Legacy kitchen" },
    ]);
    expect((await loadPersonalReplica("development", "HH-LEGACY", "MEM-001"))?.memberId).toBe("MEM-001");
  });

  it("keeps multiple households and switches the active pointer", async () => {
    const first = household("HH-FIRST", "First home");
    const second = household("HH-SECOND", "Second home");
    await saveHousehold(first, { memberId: "MEM-001" });
    await saveHousehold(second, { memberId: "MEM-001", activate: false });

    expect((await listHouseholdReplicas("development")).map((item) => item.householdId).sort()).toEqual([
      "HH-FIRST",
      "HH-SECOND",
    ]);
    expect(activeHouseholdId("development")).toBe("HH-FIRST");

    const selected = await selectHouseholdReplica("development", "HH-SECOND", "MEM-001");
    expect(selected.name).toBe("Second home");
    expect(activeHouseholdId("development")).toBe("HH-SECOND");
    expect((await loadHousehold("development"))?.householdId).toBe("HH-SECOND");
  });

  it("writes only the signed-in member's personal rows to their replica", async () => {
    const base = household("HH-PRIVATE", "Private rows");
    const sample = base.transactions[0]!;
    const withPrivateRows = {
      ...base,
      transactions: [
        ...base.transactions,
        { ...sample, id: "TX-MEM-001", createdBy: "MEM-001", visibility: "personal" as const },
        { ...sample, id: "TX-MEM-002", createdBy: "MEM-002", visibility: "personal" as const },
      ],
    };

    const first = personalReplicaForMember(withPrivateRows, "MEM-001");
    const second = personalReplicaForMember(withPrivateRows, "MEM-002");
    expect(first.transactions.map((tx) => tx.id)).toContain("TX-MEM-001");
    expect(first.transactions.map((tx) => tx.id)).not.toContain("TX-MEM-002");
    expect(second.transactions.map((tx) => tx.id)).toContain("TX-MEM-002");

    await saveHousehold(withPrivateRows, { memberId: "MEM-001" });
    expect((await loadPersonalReplica("development", "HH-PRIVATE", "MEM-001"))?.transactions.map((tx) => tx.id)).toContain("TX-MEM-001");
    expect(await loadPersonalReplica("development", "HH-PRIVATE", "MEM-002")).toBeNull();
  });

  it("accepts an IndexedDB snapshot when large-ledger localStorage backups exceed quota", async () => {
    installMemoryIndexedDb();
    const large = household("HH-LARGE", "Large history");
    const nativeSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItem(this: Storage, key: string, value: string) {
      if (/^hearth:(?:household:v2|personal:v2|v1:)/.test(key)) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    });

    await expect(saveHousehold(large, { memberId: "MEM-001" })).resolves.toBeUndefined();
    expect(activeHouseholdId("development")).toBe("HH-LARGE");
    expect((await loadHousehold("development", "HH-LARGE", "MEM-001"))?.name).toBe("Large history");
    expect((await loadPersonalReplica("development", "HH-LARGE", "MEM-001"))?.memberId).toBe("MEM-001");
  });

  it("accepts the IndexedDB snapshot when localStorage reads are blocked", async () => {
    installMemoryIndexedDb();
    const blocked = household("HH-READ-BLOCKED", "IndexedDB home");
    const nativeGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function getItem(this: Storage, key: string) {
      if (/^hearth:(?:household:v2|personal:v2|v1:)/.test(key)) {
        throw new DOMException("Storage access blocked", "SecurityError");
      }
      return nativeGetItem.call(this, key);
    });

    await expect(saveHousehold(blocked, { memberId: "MEM-001" })).resolves.toBeUndefined();
    expect(activeHouseholdId("development")).toBe("HH-READ-BLOCKED");
    expect((await loadHousehold("development", "HH-READ-BLOCKED", "MEM-001"))?.name).toBe("IndexedDB home");
    expect((await loadPersonalReplica("development", "HH-READ-BLOCKED", "MEM-001"))?.memberId).toBe("MEM-001");
  });

  it("rejects the new snapshot and retains the last valid local copy when neither store can save", async () => {
    Reflect.deleteProperty(globalThis, "indexedDB");
    const valid = household("HH-FAIL-CLOSED", "Last valid home");
    await saveHousehold(valid, { memberId: "MEM-001" });
    const replicaKey = "hearth:household:v2:development:HH-FAIL-CLOSED";
    const priorReplica = localStorage.getItem(replicaKey);
    const nativeSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItem(this: Storage, key: string, value: string) {
      if (/^hearth:(?:household:v2|personal:v2|v1:)/.test(key)) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    });

    await expect(saveHousehold({ ...valid, name: "Rejected replacement", revision: valid.revision + 1 }, { memberId: "MEM-001" }))
      .rejects.toThrow("The last valid household is still here");
    expect(localStorage.getItem(replicaKey)).toBe(priorReplica);
  });

  it("clears only the selected ledger and keeps the other replica readable", async () => {
    await saveHousehold(household("HH-KEEP", "Keep me"), { memberId: "MEM-001", activate: false });
    await saveHousehold(household("HH-CLEAR", "Clear me"), { memberId: "MEM-001" });

    await clearHousehold("development", "HH-CLEAR");

    expect((await listHouseholdReplicas("development")).map((item) => item.householdId)).toEqual(["HH-KEEP"]);
    expect((await loadHousehold("development"))?.householdId).toBe("HH-KEEP");
  });

  it("remembers the active household in the environment session", () => {
    saveSession("development", { memberId: "MEM-001", view: "personal", householdId: "HH-SECOND" });
    expect(loadSession("development")).toEqual({
      memberId: "MEM-001",
      view: "personal",
      householdId: "HH-SECOND",
    });
  });
});
