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
    if (fromDb) return migrate(fromDb);
  } catch {
    // Private browsing or blocked IndexedDB still has localStorage.
  }
  const fromLocal = localGet(environment);
  if (fromLocal) {
    const migrated = migrate(fromLocal);
    try { await idbSet(migrated); } catch { /* keep the localStorage copy */ }
    return migrated;
  }
  return null;
}

export async function saveHousehold(household: Household): Promise<void> {
  localSet(household);
  try {
    await idbSet(household);
  } catch {
    // localStorage remains the fallback snapshot.
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
  backup: "localStorage " + PREFIX,
};
