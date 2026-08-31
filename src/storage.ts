import type { Environment, Household, PersonalEnvelope } from "./core/types.ts";
import {
  assertEnvironmentMatch,
  assertGoogleMembershipMatch,
} from "./core/environmentIsolation.ts";
import type { GoogleIdentitySelector } from "./core/google.ts";
import { ensureHouseholdShape, personalReplicaForMember } from "./core/sync.ts";

const LEGACY_PREFIX = "hearth:v1:";
const REPLICA_PREFIX = "hearth:household:v2:";
const PERSONAL_PREFIX = "hearth:personal:v2:";
const CATALOG_PREFIX = "hearth:households:v2:";
const ACTIVE_PREFIX = "hearth:active-household:v2:";
const DB_NAME = "hearth-ledger";
const STORE = "households";

export type HouseholdReplicaSummary = {
  householdId: string;
  name: string;
  environment: Environment;
  revision: number;
  memberIds: string[];
  updatedAt: string | null;
};

export type SaveHouseholdOptions = {
  memberId?: string;
  activate?: boolean;
  operatingEnvironment?: Environment;
  /** When signed in, persist refuses snapshots that are not linked to this Google identity. */
  continuityIdentity?: GoogleIdentitySelector | null;
};

function householdKey(environment: Environment, householdId: string): string {
  return `${REPLICA_PREFIX}${environment}:${encodeURIComponent(householdId)}`;
}

function personalKey(environment: Environment, householdId: string, memberId: string): string {
  return `${PERSONAL_PREFIX}${environment}:${encodeURIComponent(householdId)}:${encodeURIComponent(memberId)}`;
}

function activeKey(environment: Environment): string { return ACTIVE_PREFIX + environment; }
function catalogKey(environment: Environment): string { return CATALOG_PREFIX + environment; }

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function localGet<T>(key: string): T | null {
  try { return parseJson<T>(localStorage.getItem(key)); } catch { return null; }
}

function restoreLocal(key: string, previous: string | null): void {
  if (previous == null) localStorage.removeItem(key);
  else localStorage.setItem(key, previous);
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

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the ledger."));
  });
}

async function idbSetMany(entries: Array<[string, unknown]>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the ledger."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not save the ledger."));
    const store = transaction.objectStore(STORE);
    for (const [key, value] of entries) store.put(value, key);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not clear the ledger."));
  });
}

function migrate(household: Household): Household { return ensureHouseholdShape(household); }

function newerHousehold(left: Household | null, right: Household | null): Household | null {
  if (!left) return right;
  if (!right) return left;
  return (left.revision ?? 0) >= (right.revision ?? 0) ? left : right;
}

function summary(household: Household): HouseholdReplicaSummary {
  return {
    householdId: household.householdId,
    name: household.name,
    environment: household.environment,
    revision: household.revision ?? 0,
    memberIds: household.members.map((member) => member.id),
    updatedAt: household.lastCommittedAt,
  };
}

function readCatalog(environment: Environment): HouseholdReplicaSummary[] {
  const parsed = localGet<HouseholdReplicaSummary[]>(catalogKey(environment));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => item?.environment === environment && Boolean(item.householdId));
}

function writeCatalog(environment: Environment, items: HouseholdReplicaSummary[]): void {
  localStorage.setItem(catalogKey(environment), JSON.stringify(items));
}

function upsertCatalog(household: Household): void {
  const next = readCatalog(household.environment).filter((item) => item.householdId !== household.householdId);
  next.push(summary(household));
  next.sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "") || left.name.localeCompare(right.name));
  writeCatalog(household.environment, next);
}

export function activeHouseholdId(environment: Environment): string | null {
  try { return localStorage.getItem(activeKey(environment)); } catch { return null; }
}

/**
 * Return this device to household selection without deleting any named replica.
 * The environment mirror is only an active-selection cache; keyed replicas and
 * their catalog remain available after the next authorized Google entry.
 */
export async function deactivateHouseholdSelection(environment: Environment): Promise<void> {
  try {
    localStorage.removeItem(activeKey(environment));
    localStorage.removeItem(LEGACY_PREFIX + environment);
  } catch {
    // IndexedDB cleanup still prevents the environment mirror from reopening.
  }
  try { await idbDelete(environment); } catch { /* keyed replicas remain authoritative */ }
}

/**
 * Fast, read-only startup candidate. This deliberately avoids IndexedDB and
 * never rewrites storage; loadHousehold remains the durable newest-replica
 * selector. Callers must keep the result read-only until PGlite validation.
 */
export function peekHousehold(environment: Environment, householdId?: string | null): Household | null {
  const selectedId = householdId ?? activeHouseholdId(environment);
  const selected = selectedId ? localGet<Household>(householdKey(environment, selectedId)) : null;
  const legacy = selected ?? localGet<Household>(LEGACY_PREFIX + environment);
  if (!legacy) return null;
  const migrated = migrate(legacy);
  if (migrated.environment !== environment) return null;
  if (selectedId && migrated.householdId !== selectedId) return null;
  return migrated;
}

export async function listHouseholdReplicas(environment: Environment): Promise<HouseholdReplicaSummary[]> {
  const catalog = readCatalog(environment);
  if (catalog.length) return catalog;
  const legacy = localGet<Household>(LEGACY_PREFIX + environment);
  if (!legacy) return [];
  const migrated = migrate(legacy);
  if (migrated.environment !== environment) return [];
  await saveHousehold(migrated, { activate: true });
  return [summary(migrated)];
}

export async function loadPersonalReplica(environment: Environment, householdId: string, memberId: string): Promise<PersonalEnvelope | null> {
  const key = personalKey(environment, householdId, memberId);
  const local = localGet<PersonalEnvelope>(key);
  try {
    const db = await idbGet<PersonalEnvelope>(key);
    if (!local) return db?.kind === "personal" && db.memberId === memberId ? db : null;
    if (!db) return local.kind === "personal" && local.memberId === memberId ? local : null;
    return (local.lastCommittedAt ?? "") >= (db.lastCommittedAt ?? "") ? local : db;
  } catch {
    return local?.kind === "personal" && local.memberId === memberId ? local : null;
  }
}

export async function loadHousehold(environment: Environment, householdId?: string | null, memberId?: string): Promise<Household | null> {
  const selectedId = householdId ?? activeHouseholdId(environment);
  let chosen: Household | null = null;
  if (selectedId) {
    const key = householdKey(environment, selectedId);
    const local = localGet<Household>(key);
    try { chosen = newerHousehold(local, await idbGet<Household>(key)); } catch { chosen = local; }
  }
  if (!chosen) {
    const legacyKey = LEGACY_PREFIX + environment;
    const local = localGet<Household>(legacyKey);
    try { chosen = newerHousehold(local, await idbGet<Household>(environment)); } catch { chosen = local; }
  }
  if (!chosen) return null;
  const migrated = migrate(chosen);
  if (migrated.environment !== environment) return null;
  if (selectedId && migrated.householdId !== selectedId) return null;
  await saveHousehold(migrated, { memberId, activate: true });
  return migrated;
}

export async function saveHousehold(household: Household, options: SaveHouseholdOptions = {}): Promise<void> {
  const shaped = migrate(household);
  if (options.operatingEnvironment) {
    assertEnvironmentMatch(shaped.environment, { environment: options.operatingEnvironment }, "persist", {
      requirePresent: true,
    });
  }
  if (options.continuityIdentity && (options.continuityIdentity.subject.trim() || options.continuityIdentity.email.trim())) {
    assertGoogleMembershipMatch(
      shaped,
      {
        environment: shaped.environment,
        householdId: shaped.householdId,
        memberId: options.memberId,
        googleSubject: options.continuityIdentity.subject,
        googleEmail: options.continuityIdentity.email,
      },
      "persist",
    );
  }
  const activate = options.activate !== false;
  const replicaKey = householdKey(shaped.environment, shaped.householdId);
  const legacyKey = LEGACY_PREFIX + shaped.environment;
  const personal = options.memberId ? personalReplicaForMember(shaped, options.memberId) : null;
  const memberPersonalKey = personal ? personalKey(shaped.environment, shaped.householdId, personal.memberId) : null;
  const touchedKeys = [replicaKey, catalogKey(shaped.environment)];
  if (activate) touchedKeys.push(legacyKey, activeKey(shaped.environment));
  if (memberPersonalKey) touchedKeys.push(memberPersonalKey);
  const previous = new Map<string, string | null>();
  let localAccessible = true;
  for (const key of touchedKeys) {
    try { previous.set(key, localStorage.getItem(key)); }
    catch { localAccessible = false; break; }
  }
  let localSaved = false;
  if (localAccessible) {
    try {
      localStorage.setItem(replicaKey, JSON.stringify(shaped));
      if (personal && memberPersonalKey) localStorage.setItem(memberPersonalKey, JSON.stringify(personal));
      upsertCatalog(shaped);
      if (activate) {
        localStorage.setItem(legacyKey, JSON.stringify(shaped));
        localStorage.setItem(activeKey(shaped.environment), shaped.householdId);
      }
      localSaved = true;
    } catch {
      for (const [key, value] of previous) {
        try { restoreLocal(key, value); } catch { /* keep trying IndexedDB */ }
      }
    }
  }
  let indexedDbSaved = false;
  try {
    const entries: Array<[string, unknown]> = [[replicaKey, shaped]];
    if (personal && memberPersonalKey) entries.push([memberPersonalKey, personal]);
    if (activate) entries.push([shaped.environment, shaped]);
    await idbSetMany(entries);
    indexedDbSaved = true;
  } catch {
    // localStorage remains the durable fallback when IndexedDB is unavailable or blocked.
  }
  if (!localSaved && !indexedDbSaved) {
    throw new Error("The last valid household is still here. This phone could not save the new snapshot.");
  }
  if (!localSaved) {
    // Large ledgers can exceed localStorage's small quota. IndexedDB already has
    // the full snapshot; retain only the tiny discovery pointers when possible.
    try {
      upsertCatalog(shaped);
      if (activate) localStorage.setItem(activeKey(shaped.environment), shaped.householdId);
    } catch {
      /* loadHousehold can still recover the active IndexedDB environment replica */
    }
  }
}

export async function selectHouseholdReplica(environment: Environment, householdId: string, memberId?: string): Promise<Household> {
  const household = await loadHousehold(environment, householdId, memberId);
  if (!household || household.householdId !== householdId) throw new Error("That ledger is not saved on this device.");
  await saveHousehold(household, { memberId, activate: true });
  return household;
}

export async function clearHousehold(environment: Environment, householdId?: string): Promise<void> {
  const targetId = householdId ?? activeHouseholdId(environment);
  const catalog = readCatalog(environment);
  const target = targetId ? catalog.find((item) => item.householdId === targetId) : null;
  if (targetId) {
    const key = householdKey(environment, targetId);
    localStorage.removeItem(key);
    for (const memberId of target?.memberIds ?? []) localStorage.removeItem(personalKey(environment, targetId, memberId));
    try { await idbDelete(key); } catch { /* ignore */ }
    for (const memberId of target?.memberIds ?? []) {
      try { await idbDelete(personalKey(environment, targetId, memberId)); } catch { /* ignore */ }
    }
  }
  const remaining = catalog.filter((item) => item.householdId !== targetId);
  writeCatalog(environment, remaining);
  localStorage.removeItem(LEGACY_PREFIX + environment);
  localStorage.removeItem(activeKey(environment));
  try { await idbDelete(environment); } catch { /* ignore */ }
  const next = remaining[0];
  if (next) {
    const household = await loadHousehold(environment, next.householdId);
    if (household) await saveHousehold(household, { activate: true });
  }
}

/** Remove every local replica for one environment without activating another ledger. */
export async function clearAllHouseholdReplicas(environment: Environment): Promise<void> {
  const catalog = readCatalog(environment);
  for (const item of catalog) {
    const key = householdKey(environment, item.householdId);
    localStorage.removeItem(key);
    for (const memberId of item.memberIds) localStorage.removeItem(personalKey(environment, item.householdId, memberId));
    try { await idbDelete(key); } catch { /* ignore */ }
    for (const memberId of item.memberIds) {
      try { await idbDelete(personalKey(environment, item.householdId, memberId)); } catch { /* ignore */ }
    }
  }
  writeCatalog(environment, []);
  localStorage.removeItem(LEGACY_PREFIX + environment);
  localStorage.removeItem(activeKey(environment));
  try { await idbDelete(environment); } catch { /* ignore */ }
}

export function exportHousehold(household: Household): string { return JSON.stringify(household, null, 2); }

export function downloadJson(household: Household): string {
  const blob = new Blob([exportHousehold(household)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hearth-${household.environment}-${household.lastCommittedAt?.slice(0, 10) ?? "export"}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return `${DB_NAME}/${STORE}/${household.environment}/${household.householdId}`;
}

export const STORAGE_EXPLAINER = {
  database: DB_NAME,
  store: STORE,
  books: "idb://hearth-books-development (or -production)",
  backup: `localStorage ${REPLICA_PREFIX}<environment>:<householdId>`,
  personal: `localStorage ${PERSONAL_PREFIX}<environment>:<householdId>:<memberId>`,
};
