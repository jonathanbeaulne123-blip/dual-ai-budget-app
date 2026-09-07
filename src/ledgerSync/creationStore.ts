import type { Household } from "../core/types.ts";
async function database(
  environment: string,
  memberId: string,
  subject: string,
) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(
      `hearth-ledger-sync-v2:${JSON.stringify([environment, "__create__", memberId, subject])}`,
      1,
    );
    request.onupgradeneeded = () =>
      request.result.createObjectStore("creation");
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}
function key(household: Household) {
  return household.syntheticFixture?.kind ?? "ordinary";
}
/** A failed response/local install must reuse the original household identity. */
export async function stageLedgerCreation(
  candidate: Household,
  memberId: string,
  subject: string,
) {
  const db = await database(candidate.environment, memberId, subject);
  try {
    return await new Promise<Household>((resolve, reject) => {
      const tx = db.transaction("creation", "readwrite", {
          durability: "strict",
        }),
        store = tx.objectStore("creation"),
        request = store.get(key(candidate));
      let chosen = candidate;
      request.onsuccess = () => {
        chosen = request.result ?? candidate;
        if (!request.result) store.put(candidate, key(candidate));
      };
      tx.oncomplete = () => resolve(chosen);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function completeLedgerCreation(
  household: Household,
  memberId: string,
  subject: string,
) {
  const db = await database(household.environment, memberId, subject);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("creation", "readwrite", {
          durability: "strict",
        }),
        store = tx.objectStore("creation"),
        request = store.get(key(household));
      request.onsuccess = () => {
        if (request.result?.householdId === household.householdId)
          store.delete(key(household));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
