import {
  memberIdForGoogleIdentity,
  type GoogleIdentitySelector,
} from "./core/google.ts";
import { ensureHouseholdShape } from "./core/sync.ts";
import { assertOutboxItemBinding } from "./core/environmentIsolation.ts";
import type { Environment, Household } from "./core/types.ts";
import { hostedContinuityAllowed } from "./ledger/continuityPolicy.ts";
import {
  discoverSupabaseHouseholdsByGoogleIdentity,
  pushSupabaseHousehold,
  type DiscoveredHousehold,
  type SupabaseConfig,
} from "./ledger/supabase.ts";

export {
  hostedContinuityAllowed,
  legacyLinkedPublishAllowed,
  productionContinuityEnabled,
  unprojectedHostedTransportAllowed,
} from "./ledger/continuityPolicy.ts";

const OUTBOX_PREFIX = "hearth:continuity-outbox:v1:";
const MAX_BACKOFF_MS = 60_000;
const OUTBOX_DB_NAME = "hearth-continuity";
const OUTBOX_STORE = "outbox";
const STORAGE_QUOTA_MESSAGE =
  "This phone's browser storage is full, so Hearth could not keep a share queue copy there. Your books are still saved here. Tap Retry now to send them to the cloud.";

export type ContinuityIdentity = GoogleIdentitySelector;

export type ContinuityOutboxItem = {
  id: string;
  environment: Environment;
  householdId: string;
  memberId: string;
  identity: ContinuityIdentity;
  expectedRevision: number;
  confirmationIds: string[];
  snapshot: Household;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError: string | null;
  blockedByConflict: boolean;
  /** ISO time when automatic flush may try again. Null when due immediately or blocked. */
  nextAttemptAt: string | null;
};

export type ContinuityFlushConflict = {
  item: ContinuityOutboxItem;
  remote: Household;
  message: string;
};

export type ContinuityFlushResult = {
  synchronized: number;
  pending: number;
  deferred: number;
  conflicts: ContinuityFlushConflict[];
};

type ContinuityStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

let storeOverride: ContinuityStore | null = null;
let nowOverride: (() => number) | null = null;
/** Survives localStorage quota failures so Retry can still flush this session. */
const memoryOutbox = new Map<Environment, ContinuityOutboxItem[]>();

function browserStore(): ContinuityStore | null {
  if (storeOverride) return storeOverride;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function nowMs(): number {
  return nowOverride ? nowOverride() : Date.now();
}

function key(environment: Environment): string {
  return OUTBOX_PREFIX + environment;
}

export function continuityBackoffMs(attempts: number): number {
  const capped = Math.max(0, Math.min(attempts, 6));
  return Math.min(MAX_BACKOFF_MS, 1_000 * (2 ** capped));
}

export function isStorageQuotaError(error: unknown): boolean {
  if (!error) return false;
  const name = typeof error === "object" && error && "name" in error ? String((error as { name?: string }).name) : "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /quota|exceeded the quota|setItem.*Storage/i.test(message);
}

/** Turn browser/storage exceptions into a household-facing share message. */
export function humanizeContinuityError(error: unknown): string {
  if (isStorageQuotaError(error)) return STORAGE_QUOTA_MESSAGE;
  if (error instanceof Error && error.message.trim()) {
    if (/Failed to execute 'setItem' on 'Storage'/i.test(error.message)) return STORAGE_QUOTA_MESSAGE;
    return error.message;
  }
  const text = String(error ?? "").trim();
  if (/Failed to execute 'setItem' on 'Storage'|quota/i.test(text)) return STORAGE_QUOTA_MESSAGE;
  return text || "Saved on this phone. Sharing can retry from More.";
}

function openOutboxDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }
    const request = indexedDB.open(OUTBOX_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the continuity outbox database."));
  });
}

async function idbReadOutbox(environment: Environment): Promise<ContinuityOutboxItem[] | null> {
  try {
    const db = await openOutboxDb();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(OUTBOX_STORE, "readonly").objectStore(OUTBOX_STORE).get(key(environment));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error("Could not read the continuity outbox."));
    });
    if (!Array.isArray(raw)) return null;
    return raw.filter(isOutboxItem).map(normalizeOutboxItem);
  } catch {
    return null;
  }
}

async function idbWriteOutbox(environment: Environment, items: ContinuityOutboxItem[]): Promise<void> {
  const db = await openOutboxDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(OUTBOX_STORE, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the continuity outbox."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not save the continuity outbox."));
    const store = transaction.objectStore(OUTBOX_STORE);
    if (items.length) store.put(items, key(environment));
    else store.delete(key(environment));
  });
}

function normalizeOutboxItem(item: ContinuityOutboxItem): ContinuityOutboxItem {
  return {
    ...item,
    snapshot: ensureHouseholdShape(item.snapshot),
    confirmationIds: Array.isArray(item.confirmationIds) ? item.confirmationIds.filter(Boolean) : [],
    attempts: Number.isInteger(item.attempts) ? item.attempts : 0,
    lastError: item.lastError ? humanizeContinuityError(item.lastError) : null,
    blockedByConflict: item.blockedByConflict === true,
    nextAttemptAt: typeof item.nextAttemptAt === "string" ? item.nextAttemptAt : null,
  };
}

function isOutboxItem(value: unknown): value is ContinuityOutboxItem {
  if (!value || typeof value !== "object") return false;
  const item = value as ContinuityOutboxItem;
  return Boolean(
    item.id &&
    item.householdId &&
    item.memberId &&
    item.snapshot &&
    item.identity &&
    (item.identity.subject || item.identity.email),
  );
}

function readFromLocal(environment: Environment): ContinuityOutboxItem[] {
  const store = browserStore();
  if (!store) return [];
  try {
    const raw = store.getItem(key(environment));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOutboxItem).map(normalizeOutboxItem);
  } catch {
    return [];
  }
}

function read(environment: Environment): ContinuityOutboxItem[] {
  const local = readFromLocal(environment);
  const mem = memoryOutbox.get(environment);
  if (!mem?.length) return local;
  if (!local.length) return mem;
  // Tests may mutate the injected store after enqueue; prefer that view when overridden.
  // Production quota path keeps memory ahead of a stale/partial localStorage copy.
  if (storeOverride) return local;
  return mem;
}

function write(environment: Environment, items: ContinuityOutboxItem[]): void {
  memoryOutbox.set(environment, items);
  const store = browserStore();
  if (!store) {
    void idbWriteOutbox(environment, items).catch(() => undefined);
    return;
  }
  try {
    if (items.length) store.setItem(key(environment), JSON.stringify(items));
    else store.removeItem(key(environment));
  } catch (caught) {
    if (isStorageQuotaError(caught)) {
      // Memory keeps the queue for this session; IndexedDB is the durable backup.
      void idbWriteOutbox(environment, items).catch(() => undefined);
      return;
    }
    throw new Error(humanizeContinuityError(caught));
  }
  void idbWriteOutbox(environment, items).catch(() => undefined);
}

/** Load a durable IndexedDB outbox when localStorage was emptied by quota. */
export async function hydrateContinuityOutbox(environment: Environment): Promise<number> {
  if (memoryOutbox.has(environment) && (memoryOutbox.get(environment)?.length ?? 0) > 0) {
    return memoryOutbox.get(environment)?.length ?? 0;
  }
  const local = readFromLocal(environment);
  if (local.length) {
    memoryOutbox.set(environment, local);
    return local.length;
  }
  const fromIdb = await idbReadOutbox(environment);
  if (fromIdb?.length) {
    memoryOutbox.set(environment, fromIdb);
    return fromIdb.length;
  }
  return 0;
}

function sameIdentity(left: ContinuityIdentity, right: ContinuityIdentity): boolean {
  const leftSubject = left.subject.trim();
  const rightSubject = right.subject.trim();
  if (leftSubject && rightSubject) return leftSubject === rightSubject;
  return left.email.trim().toLowerCase() === right.email.trim().toLowerCase();
}

export function setContinuityStore(store: ContinuityStore | null): void {
  storeOverride = store;
  memoryOutbox.clear();
}

export function setContinuityNow(now: (() => number) | null): void {
  nowOverride = now;
}

export function createMemoryContinuityStore(): ContinuityStore & { snapshot(): Record<string, string> } {
  const values = new Map<string, string>();
  return {
    getItem(itemKey) {
      return values.get(itemKey) ?? null;
    },
    setItem(itemKey, value) {
      values.set(itemKey, value);
    },
    removeItem(itemKey) {
      values.delete(itemKey);
    },
    snapshot() {
      return Object.fromEntries(values.entries());
    },
  };
}

export function listContinuityOutbox(environment: Environment): ContinuityOutboxItem[] {
  return read(environment);
}

export function continuityMemberId(
  household: Household,
  identity: ContinuityIdentity,
): string | null {
  if (!hostedContinuityAllowed(household.environment)) return null;
  return memberIdForGoogleIdentity(household, identity);
}

export function enqueueContinuitySnapshot(input: {
  household: Household;
  identity: ContinuityIdentity;
  expectedRevision: number;
  confirmationId: string;
}): ContinuityOutboxItem {
  const snapshot = ensureHouseholdShape(input.household);
  const memberId = continuityMemberId(snapshot, input.identity);
  if (!memberId) {
    throw new Error(
      snapshot.environment === "production"
        ? "This Google account is not a member of that Production household."
        : "This Google account is not a member of that Development household.",
    );
  }
  const items = read(snapshot.environment);
  const id = `${snapshot.environment}:${snapshot.householdId}`;
  const existing = items.find((item) => item.id === id);
  const now = new Date(nowMs()).toISOString();
  const item: ContinuityOutboxItem = {
    id,
    environment: snapshot.environment,
    householdId: snapshot.householdId,
    memberId,
    identity: {
      subject: input.identity.subject.trim(),
      email: input.identity.email.trim().toLowerCase(),
    },
    expectedRevision: existing?.expectedRevision ?? input.expectedRevision,
    confirmationIds: [...new Set([...(existing?.confirmationIds ?? []), input.confirmationId].filter(Boolean))],
    snapshot,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    attempts: existing?.attempts ?? 0,
    lastError: null,
    // Compacting a newer snapshot after conflict choose must not inherit the block.
    blockedByConflict: false,
    nextAttemptAt: null,
  };
  assertOutboxItemBinding(item);
  write(snapshot.environment, [...items.filter((row) => row.id !== id), item]);
  return item;
}

function replaceItem(item: ContinuityOutboxItem): void {
  const items = read(item.environment);
  write(item.environment, [...items.filter((row) => row.id !== item.id), item]);
}

/** Idempotent acknowledgement: drop the queued snapshot after a successful hosted CAS. */
export function acknowledgeContinuityOutboxItem(item: ContinuityOutboxItem): void {
  write(
    item.environment,
    read(item.environment).filter((row) => row.id !== item.id),
  );
}

/** Drop queued snapshots for one household (Sign out / clear this phone). */
export function clearContinuityOutboxForHousehold(
  environment: Environment,
  householdId: string,
): number {
  const items = read(environment);
  const next = items.filter((item) => item.householdId !== householdId);
  const removed = items.length - next.length;
  if (removed > 0) write(environment, next);
  return removed;
}

/**
 * After an explicit conflict choose, unblock the outbox so background flush can
 * push the resolved snapshot without a manual Sync tap.
 */
export function clearContinuityOutboxConflictBlocks(input: {
  environment: Environment;
  identity: ContinuityIdentity;
  householdId?: string;
  /** When set, replace the queued CAS base so resume targets the post-choose revision. */
  expectedRevision?: number;
}): number {
  const items = read(input.environment);
  let cleared = 0;
  const next = items.map((item) => {
    if (!sameIdentity(item.identity, input.identity)) return item;
    if (input.householdId && item.householdId !== input.householdId) return item;
    if (!item.blockedByConflict) return item;
    cleared += 1;
    return {
      ...item,
      blockedByConflict: false,
      nextAttemptAt: null,
      lastError: null,
      expectedRevision: input.expectedRevision ?? item.expectedRevision,
      updatedAt: new Date(nowMs()).toISOString(),
    };
  });
  if (cleared > 0) write(input.environment, next);
  return cleared;
}

function pendingItem(item: ContinuityOutboxItem, message: string, blockedByConflict = false): ContinuityOutboxItem {
  const attempts = item.attempts + 1;
  const nextAttemptAt = blockedByConflict
    ? null
    : new Date(nowMs() + continuityBackoffMs(attempts)).toISOString();
  const next = {
    ...item,
    attempts,
    updatedAt: new Date(nowMs()).toISOString(),
    lastError: humanizeContinuityError(message),
    blockedByConflict,
    nextAttemptAt,
  };
  replaceItem(next);
  return next;
}

function isDue(item: ContinuityOutboxItem, force: boolean): boolean {
  if (force || item.blockedByConflict) return true;
  if (!item.nextAttemptAt) return true;
  return Date.parse(item.nextAttemptAt) <= nowMs();
}

async function flushItem(
  item: ContinuityOutboxItem,
  identity: ContinuityIdentity,
  config?: SupabaseConfig | null,
): Promise<
  | { kind: "synchronized"; revision: number }
  | { kind: "pending"; message: string }
  | { kind: "conflict"; remote: Household; message: string }
> {
  try {
    if (!sameIdentity(item.identity, identity)) {
      throw new Error("This outbox entry belongs to a different Google account and was not replayed.");
    }
    assertOutboxItemBinding({ ...item, identity: item.identity });
    const pushed = await pushSupabaseHousehold(item.snapshot, config, {
      expectedRevision: item.expectedRevision,
      continuityIdentity: identity,
    });
    if (pushed.conflict && pushed.remote) {
      const message = pushed.error || "Another device has newer books. Nothing was overwritten.";
      pendingItem(item, message, true);
      return { kind: "conflict", remote: pushed.remote, message };
    }
    if (!pushed.schema || pushed.skipped) {
      const message = pushed.error || "Saved on this device. Cloud continuity will retry automatically.";
      pendingItem(item, message);
      return { kind: "pending", message };
    }
    // Successful CAS (including idempotent duplicate delivery) acknowledges the outbox entry.
    // Local books are never cleared here — only the transport queue item.
    acknowledgeContinuityOutboxItem(item);
    return { kind: "synchronized", revision: item.snapshot.revision };
  } catch (caught) {
    const message = humanizeContinuityError(caught);
    pendingItem(item, message);
    return { kind: "pending", message };
  }
}

export async function transportHouseholdWithOutbox(input: {
  household: Household;
  identity: ContinuityIdentity;
  expectedRevision: number;
  confirmationId: string;
  config?: SupabaseConfig | null;
  /**
   * When false, enqueue only and return pending so the UI can stay responsive.
   * Launch/focus/reconnect or a follow-up flush pushes the bytes.
   * Default true: flush immediately after enqueue (ledger writes).
   */
  flush?: boolean;
}): Promise<
  | { ok: true; remoteRevision?: number }
  | { ok: false; errorClass: "pending-transport" | "conflict-detected"; remote?: Household; message: string }
> {
  let item: ContinuityOutboxItem;
  try {
    item = enqueueContinuitySnapshot(input);
  } catch (caught) {
    return {
      ok: false,
      errorClass: "pending-transport",
      message: humanizeContinuityError(caught),
    };
  }
  if (input.flush === false) {
    return {
      ok: false,
      errorClass: "pending-transport",
      message: "Saved on this phone. Sharing in the background.",
    };
  }
  const result = await flushItem(item, input.identity, input.config);
  if (result.kind === "synchronized") return { ok: true, remoteRevision: result.revision };
  if (result.kind === "conflict") {
    return {
      ok: false,
      errorClass: "conflict-detected",
      remote: result.remote,
      message: result.message,
    };
  }
  return { ok: false, errorClass: "pending-transport", message: result.message };
}

export async function flushContinuityOutbox(input: {
  environment: Environment;
  identity: ContinuityIdentity;
  config?: SupabaseConfig | null;
  /** Bypass nextAttemptAt backoff (manual retry / tests). Conflicts still stay blocked. */
  force?: boolean;
  /**
   * When the durable queue is empty (e.g. localStorage quota dropped it), Retry can
   * still push the live in-memory household by seeding one outbox item first.
   */
  liveHousehold?: Household;
  expectedRevision?: number;
  confirmationId?: string;
}): Promise<ContinuityFlushResult> {
  await hydrateContinuityOutbox(input.environment);
  let items = read(input.environment).filter((item) => sameIdentity(item.identity, input.identity));
  if (!items.length && input.liveHousehold && input.force) {
    try {
      enqueueContinuitySnapshot({
        household: input.liveHousehold,
        identity: input.identity,
        expectedRevision: input.expectedRevision ?? input.liveHousehold.baseRevision ?? 0,
        confirmationId: input.confirmationId ?? `retry-${input.liveHousehold.householdId}-${Date.now()}`,
      });
      items = read(input.environment).filter((item) => sameIdentity(item.identity, input.identity));
    } catch {
      /* enqueue already humanizes; leave empty so caller can surface the message */
    }
  }
  const result: ContinuityFlushResult = { synchronized: 0, pending: 0, deferred: 0, conflicts: [] };
  for (const item of items) {
    if (item.blockedByConflict) {
      result.pending += 1;
      continue;
    }
    if (!isDue(item, input.force === true)) {
      result.deferred += 1;
      result.pending += 1;
      continue;
    }
    const flushed = await flushItem(item, input.identity, input.config);
    if (flushed.kind === "synchronized") result.synchronized += 1;
    else if (flushed.kind === "conflict") {
      result.pending += 1;
      result.conflicts.push({ item, remote: flushed.remote, message: flushed.message });
    } else result.pending += 1;
  }
  return result;
}

export async function discoverContinuityMemberships(
  identity: ContinuityIdentity,
  environment: Environment,
  config?: SupabaseConfig | null,
): Promise<DiscoveredHousehold[]> {
  return discoverSupabaseHouseholdsByGoogleIdentity(identity, config, environment);
}
