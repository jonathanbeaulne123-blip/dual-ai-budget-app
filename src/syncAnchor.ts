import { ensureHouseholdShape } from "./core/sync.ts";
import type { Environment, Household } from "./core/types.ts";

const PREFIX = "hearth:sync-anchor:v1:";

export type SyncAnchorStore = {
  save: (environment: Environment, household: Household) => void;
  load: (environment: Environment, householdId: string) => Household | null;
  clear: (environment: Environment, householdId: string) => void;
};

function anchorKey(environment: Environment, householdId: string): string {
  return `${PREFIX}${environment}:${encodeURIComponent(householdId)}`;
}

function parseHousehold(raw: string | null): Household | null {
  if (!raw) return null;
  try {
    return ensureHouseholdShape(JSON.parse(raw) as Household);
  } catch {
    return null;
  }
}

function localStorageStore(): SyncAnchorStore {
  return {
    save(environment, household) {
      if (typeof localStorage === "undefined") return;
      const shaped = ensureHouseholdShape(household);
      localStorage.setItem(anchorKey(environment, shaped.householdId), JSON.stringify(shaped));
    },
    load(environment, householdId) {
      if (typeof localStorage === "undefined") return null;
      return parseHousehold(localStorage.getItem(anchorKey(environment, householdId)));
    },
    clear(environment, householdId) {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem(anchorKey(environment, householdId));
    },
  };
}

let activeStore: SyncAnchorStore = localStorageStore();

export function setSyncAnchorStore(store: SyncAnchorStore): void {
  activeStore = store;
}

export function resetSyncAnchorStore(): void {
  activeStore = localStorageStore();
}

export function createMemorySyncAnchorStore(): SyncAnchorStore {
  const memory = new Map<string, string>();
  return {
    save(environment, household) {
      const shaped = ensureHouseholdShape(household);
      memory.set(anchorKey(environment, shaped.householdId), JSON.stringify(shaped));
    },
    load(environment, householdId) {
      return parseHousehold(memory.get(anchorKey(environment, householdId)) ?? null);
    },
    clear(environment, householdId) {
      memory.delete(anchorKey(environment, householdId));
    },
  };
}

export function saveSyncAnchor(environment: Environment, household: Household): void {
  activeStore.save(environment, household);
}

export function loadSyncAnchor(environment: Environment, householdId: string): Household | null {
  return activeStore.load(environment, householdId);
}

export function clearSyncAnchor(environment: Environment, householdId: string): void {
  activeStore.clear(environment, householdId);
}

export function syncAnchorStorageKey(environment: Environment, householdId: string): string {
  return anchorKey(environment, householdId);
}
