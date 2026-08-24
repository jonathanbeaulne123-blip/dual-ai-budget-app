import type { Environment, Household } from "./core/types.ts";
import { ensureHouseholdShape } from "./core/sync.ts";

const PREFIX = "hearth:v1:";
const DB_NAME = "hearth-ledger";
const STORE = "households";

function localGet(environment: Environment): Household | null {
  try {
    const raw = localStorage.getItem(PREFIX + environment);
    if (!raw) return null;
    return JSON.parse(raw) as Household;
  } catch {
    return null;
  }
}

function localSet(household: Household): void {
  localStorage.setItem(PREFIX + household.environment, JSON.stringify(household));
}

function localRestore(environment: Environment, previous: string | null): void {
  if (previous == null) localStorage.removeItem(PREFIX + environment);
  else localStorage.setItem(PREFIX + environment, previous);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the Hearth ledger database."));
  });
}

async function idbGet(environment: Environment): Promise<Household | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(environment);
    request.onsuccess = () => resolve((request.result as Household | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the ledger."));
  });
}

async function idbSet(household: Household): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(household, household.environment);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not save the ledger."));
  });
}

async function idbDelete(environment: Environment): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(environment);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not clear the ledger."));
  });
}

function migrate(household: Household): Household {
  return ensureHouseholdShape(household);
}

export async function loadHousehold(environment: Environment): Promise<Household | null> {
  try {
    const fromDb = await idbGet(environment);
    const fromLocal = localGet(environment);
    if (fromDb && fromLocal) {
      const db = migrate(fromDb);
      const local = migrate(fromLocal);
      if (local.environment !== environment) return db.environment === environment ? db : null;
      if (db.environment !== environment) return local;
      return (local.revision ?? 0) >= (db.revision ?? 0) ? local : db;
    }
    if (fromDb) {
      const migrated = migrate(fromDb);
      return migrated.environment === environment ? migrated : null;
    }
  } catch {
    // Private browsing or blocked IndexedDB still has localStorage.
  }
  const fromLocal = localGet(environment);
  if (fromLocal) {
    const migrated = migrate(fromLocal);
    if (migrated.environment !== environment) return null;
    try { await idbSet(migrated); } catch { /* keep the localStorage copy */ }
    return migrated;
  }
  return null;
}

export async function saveHousehold(household: Household): Promise<void> {
  const previousLocal = typeof localStorage !== "undefined" ? localStorage.getItem(PREFIX + household.environment) : null;
  try {
    localSet(household);
  } catch (caught) {
    throw new Error("The last valid household is still here. This phone could not save the new snapshot.");
  }
  try {
    await idbSet(household);
  } catch {
    try {
      await idbDelete(household.environment);
    } catch {
      localRestore(household.environment, previousLocal);
      throw new Error("The last valid household is still here. This phone could not save the new snapshot.");
    }
  }
}

export async function clearHousehold(environment: Environment): Promise<void> {
  localStorage.removeItem(PREFIX + environment);
  try { await idbDelete(environment); } catch { /* ignore */ }
}

export function exportHousehold(household: Household): string {
  return JSON.stringify(household, null, 2);
}

export function downloadJson(household: Household): string {
  const blob = new Blob([exportHousehold(household)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hearth-${household.environment}-${household.lastCommittedAt?.slice(0, 10) ?? "export"}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return `${DB_NAME}/${STORE}/${household.environment}`;
}

export const STORAGE_EXPLAINER = {
  database: DB_NAME,
  store: STORE,
  books: "idb://hearth-books-development (or -production)",
  backup: "localStorage " + PREFIX,
};
