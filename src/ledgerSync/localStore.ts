import type { LedgerCommand, Replica } from "./protocol.ts";
export class LedgerStore {
  private constructor(private db: IDBDatabase) {}
  static open(scope: {
    environment: string;
    householdId: string;
    memberId: string;
    subject: string;
  }): Promise<LedgerStore> {
    return new Promise((resolve, reject) => {
      const q = indexedDB.open(
        `hearth-ledger-sync-v2:${JSON.stringify([scope.environment, scope.householdId, scope.memberId, scope.subject])}`,
        1,
      );
      q.onupgradeneeded = () => {
        for (const name of ["replica", "pending", "recovery"])
          q.result.createObjectStore(name);
      };
      q.onsuccess = () => {
        q.result.onversionchange = () => q.result.close();
        resolve(new LedgerStore(q.result));
      };
      q.onerror = () => reject(q.error);
      q.onblocked = () => reject(new Error("LOCAL_STORAGE_BLOCKED"));
    });
  }
  private write(
    stores: string[],
    work: (tx: IDBTransaction) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, "readwrite", {
        durability: "strict",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(tx.error ?? new Error("LOCAL_SAVE_FAILED"));
      try {
        work(tx);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  }
  async load(): Promise<{ replica?: Replica; pending: LedgerCommand[] }> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["replica", "pending"]),
        replica = tx.objectStore("replica").get("current"),
        pending = tx.objectStore("pending").getAll();
      tx.oncomplete = () =>
        resolve({
          replica: replica.result,
          pending: pending.result
            .sort(
              (a: { ordinal: number }, b: { ordinal: number }) =>
                a.ordinal - b.ordinal,
            )
            .map(
              (r: { command?: LedgerCommand }) =>
                (r.command ?? r) as LedgerCommand,
            ),
        });
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
  enqueue(command: LedgerCommand) {
    return this.write(["pending", "replica"], (tx) => {
      const pending = tx.objectStore("pending"),
        metadata = tx.objectStore("replica"),
        existing = pending.get(command.id);
      existing.onsuccess = () => {
        if (existing.result) return;
        const counter = metadata.get("pendingOrdinal");
        counter.onsuccess = () => {
          const ordinal = Number(counter.result ?? 0) + 1;
          metadata.put(ordinal, "pendingOrdinal");
          pending.put({ command, ordinal }, command.id);
        };
      };
    });
  }
  save(replica: Replica) {
    return this.write(["replica"], (tx) =>
      tx.objectStore("replica").put(replica, "current"),
    );
  }
  acknowledge(id: string) {
    return this.write(["pending"], (tx) =>
      tx.objectStore("pending").delete(id),
    );
  }
  recover(replica: Replica) {
    return this.write(["recovery"], (tx) => {
      const store = tx.objectStore("recovery");
      store.put(replica, Date.now());
      const all = store.getAllKeys();
      all.onsuccess = () => {
        for (const key of all.result.slice(0, -3)) store.delete(key);
      };
    });
  }
  close() {
    this.db.close();
  }
}

/** Only called by an explicitly confirmed device/household cleanup. */
export async function clearLedgerStores(
  environment: string,
  householdId?: string,
) {
  if (typeof indexedDB === "undefined") return;
  const prefix = "hearth-ledger-sync-v2:";
  for (const database of await indexedDB.databases()) {
    if (!database.name?.startsWith(prefix)) continue;
    const scope = JSON.parse(database.name.slice(prefix.length)) as string[];
    if (scope[0] !== environment || (householdId && scope[1] !== householdId))
      continue;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(database.name!);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error(
            "Close the other Hearth tabs to finish clearing this device.",
          ),
        );
    });
  }
}
