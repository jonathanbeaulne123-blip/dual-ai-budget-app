import type { PendingPreview, RejectedEntry } from "./optimistic.ts";
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
        2,
      );
      q.onupgradeneeded = () => {
        for (const name of ["replica", "pending", "recovery", "rejected"])
          if (!q.result.objectStoreNames.contains(name)) q.result.createObjectStore(name);
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
  async load(): Promise<{ replica?: Replica; pending: LedgerCommand[]; previews: PendingPreview[] }> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["replica", "pending"]),
        replica = tx.objectStore("replica").get("current"),
        pending = tx.objectStore("pending").getAll();
      tx.oncomplete = () =>
        resolve({
          replica: replica.result,
          previews: pending.result.flatMap((r: { preview?: PendingPreview }) => r.preview ? [r.preview] : []),
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
  enqueue(command: LedgerCommand, preview?: PendingPreview) {
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
          pending.put({ command, ordinal, preview }, command.id);
        };
      };
    });
  }
  save(replica: Replica, acceptedCommands: string[] = []) {
    return this.write(["replica", "pending"], (tx) => {
      tx.objectStore("replica").put(replica, "current");
      for (const id of acceptedCommands) {
        const store = tx.objectStore("pending"), request = store.get(id);
        request.onsuccess = () => {
          const record = request.result;
          if (record?.preview) store.put({ ...record, preview: { ...record.preview, acceptedSequence: replica.sequence } }, id);
        };
      }
    });
  }
  reject(id: string, message: string) {
    return this.write(["pending", "rejected"], tx => {
      const pending = tx.objectStore("pending"), request = pending.get(id);
      request.onsuccess = () => {
        if(request.result) tx.objectStore("rejected").put({ ...request.result, rejection: message }, id);
        pending.delete(id);
      };
    });
  }
  rejected(): Promise<RejectedEntry[]> {
    return new Promise((resolve,reject)=>{const tx=this.db.transaction("rejected"),q=tx.objectStore("rejected").getAll();tx.oncomplete=()=>resolve(q.result);tx.onerror=tx.onabort=()=>reject(tx.error);});
  }
  dismissRejected(id:string) { return this.write(["rejected"],tx=>{tx.objectStore("rejected").delete(id);}); }
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
        for (const key of all.result.filter(key=>typeof key === "number").slice(0, -3)) store.delete(key);
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
