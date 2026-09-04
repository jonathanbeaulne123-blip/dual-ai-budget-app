import {
  memberIdForGoogleIdentity,
  type GoogleIdentitySelector,
} from "./core/google.ts";
import { ensureHouseholdShape } from "./core/sync.ts";
import { assertOutboxItemBinding } from "./core/environmentIsolation.ts";
import type { Environment, Household, PersonalEnvelope } from "./core/types.ts";
import { hostedContinuityAllowed } from "./ledger/continuityPolicy.ts";
import {
  buildCommandRef,
  compactedCommandPayload,
  continuityCommandLogEnabled,
  primaryCommandRef,
  type ContinuityCommandRef,
} from "./ledger/continuityCommandLog.ts";
import {
  appendContinuityCommand,
  discoverSupabaseHouseholdsByGoogleIdentity,
  pullConsistentMemberReplicaById,
  pullHouseholdSnapshotById,
  pushSupabaseHousehold,
  type DiscoveredHousehold,
  type SupabaseConfig,
} from "./ledger/supabase.ts";
import { loadHousehold } from "./storage.ts";
import { clearStagedHouseholdBooks, loadStagedHouseholdBooks } from "./ledger/engine.ts";

export {
  hostedContinuityAllowed,
  legacyLinkedPublishAllowed,
  productionContinuityEnabled,
  unprojectedHostedTransportAllowed,
} from "./ledger/continuityPolicy.ts";
export {
  continuityCommandLogEnabled,
  type ContinuityCommandRef,
} from "./ledger/continuityCommandLog.ts";

const OUTBOX_PREFIX = "hearth:continuity-outbox:v1:";
const MAX_BACKOFF_MS = 60_000;
const OUTBOX_DB_NAME = "hearth-continuity";
const OUTBOX_STORE = "outbox";
const STORAGE_QUOTA_MESSAGE =
  "This phone's browser storage is full, so Hearth could not keep a share queue copy there. Your books are still saved here. Tap Retry now to send them to the cloud.";

export type ContinuityIdentity = GoogleIdentitySelector;

/**
 * In-memory continuity queue tip (D-145).
 * `snapshot` is session-only; durable LS/IDB stores {@link ContinuityOutboxDurable} only.
 */
export type ContinuityOutboxItem = {
  id: string;
  environment: Environment;
  householdId: string;
  memberId: string;
  identity: ContinuityIdentity;
  expectedRevision: number;
  /** Tip revision of the books this queue entry intends to publish. */
  tipRevision: number;
  /** Immutable enqueue generation used for compare-and-remove acknowledgements. */
  generation?: string;
  confirmationIds: string[];
  /** Memory-only tip snapshot. Omitted from durable LS/IDB. */
  snapshot?: Household;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError: string | null;
  blockedByConflict: boolean;
  /** ISO time when automatic flush may try again. Null when due immediately or blocked. */
  nextAttemptAt: string | null;
  /** T2-S2: ref-only durable transport when command-log flag is on. */
  transportKind?: "snapshot-tip" | "command-ref";
  commandRefs?: ContinuityCommandRef[];
};

/** Slim durable outbox row — never carries journal/transactions (D-145). */
export type ContinuityOutboxDurable = Omit<ContinuityOutboxItem, "snapshot">;

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
const durableWriteTails = new Map<Environment, Promise<void>>();
const hydrationFlights = new Map<Environment, Promise<number>>();

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

/** Strip the memory-only tip so durable bytes never hold the journal. */
export function toDurableOutboxItems(items: ContinuityOutboxItem[]): ContinuityOutboxDurable[] {
  return items.map((item) => {
    const { snapshot: _snapshot, ...rest } = item;
    return {
      ...rest,
      tipRevision: item.snapshot?.revision ?? item.tipRevision ?? 0,
    };
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

async function idbWriteOutbox(environment: Environment, items: ContinuityOutboxDurable[]): Promise<void> {
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
  const tipRevision = Number.isInteger(item.tipRevision)
    ? item.tipRevision
    : (item.snapshot?.revision ?? 0);
  return {
    ...item,
    tipRevision,
    generation: item.generation
      ?? `${tipRevision}:${item.updatedAt}:${(item.confirmationIds ?? []).join("|")}`,
    transportKind: item.transportKind ?? (item.commandRefs?.length ? "command-ref" : "snapshot-tip"),
    commandRefs: Array.isArray(item.commandRefs) ? item.commandRefs : undefined,
    snapshot: item.snapshot ? ensureHouseholdShape(item.snapshot) : undefined,
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
  if (!(
    item.id
    && item.householdId
    && item.memberId
    && item.identity
    && (item.identity.subject || item.identity.email)
  )) {
    return false;
  }
  // Slim durable rows (D-145), command-ref rows (T2-S2), or legacy full-snapshot rows qualify.
  if (item.snapshot) return true;
  if (Array.isArray(item.commandRefs) && item.commandRefs.length > 0) return true;
  return Number.isFinite(item.tipRevision) || Number.isFinite(item.expectedRevision);
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
  const mem = memoryOutbox.get(environment) ?? [];
  if (!mem.length) return local;
  if (!local.length) return mem;
  // Tests may mutate the injected store after enqueue; prefer that durable view when overridden,
  // but reattach the matching memory tip so same-session flush still has books (D-145).
  // Production quota path keeps memory ahead of a stale/partial localStorage copy.
  if (storeOverride) {
    const memById = new Map(mem.map((item) => [item.id, item]));
    return local.map((item) => {
      const tip = memById.get(item.id);
      if (!tip?.snapshot) return item;
      if (item.householdId !== tip.householdId || item.environment !== tip.environment) {
        return item;
      }
      return {
        ...item,
        snapshot: tip.snapshot,
        tipRevision: tip.tipRevision,
        confirmationIds: item.confirmationIds.length ? item.confirmationIds : tip.confirmationIds,
      };
    });
  }
  return mem;
}

function writeLocalDurable(environment: Environment, durable: ContinuityOutboxDurable[]): boolean {
  const store = browserStore();
  if (!store) return false;
  try {
    if (durable.length) store.setItem(key(environment), JSON.stringify(durable));
    else store.removeItem(key(environment));
    return true;
  } catch (caught) {
    if (isStorageQuotaError(caught)) return false;
    throw new Error(humanizeContinuityError(caught));
  }
}

/** IDB-first durable persist; LS holds the same slim metadata when space allows. */
async function persistDurableOutbox(
  environment: Environment,
  durable: ContinuityOutboxDurable[],
  requireEveryAvailableStore = false,
): Promise<void> {
  let persisted = false;
  const idbAvailable = typeof indexedDB !== "undefined";
  let idbPersisted = !idbAvailable;
  try {
    await idbWriteOutbox(environment, durable);
    persisted = true;
    idbPersisted = true;
  } catch {
    /* IndexedDB may be unavailable in private mode; LS + memory still hold the tip pointer. */
  }
  const localAvailable = Boolean(browserStore());
  let localPersisted = !localAvailable;
  try {
    localPersisted = writeLocalDurable(environment, durable);
    persisted = localPersisted || persisted;
  } catch {
    /* Quota on slim metadata is rare; memory + IDB remain authoritative. */
  }
  if (requireEveryAvailableStore && (!idbPersisted || !localPersisted)) {
    throw new Error("This phone could not durably clear its shared retry metadata.");
  }
  if (durable.length && !persisted) {
    throw new Error(STORAGE_QUOTA_MESSAGE);
  }
}

function write(
  environment: Environment,
  items: ContinuityOutboxItem[],
  options: { requireEveryAvailableStore?: boolean } = {},
): void {
  memoryOutbox.set(environment, items);
  const durable = toDurableOutboxItems(items);
  if (storeOverride) {
    // Tests inject a sync store and read it immediately — write slim LS first.
    writeLocalDurable(environment, durable);
    const idbPersist = typeof indexedDB === "undefined"
      ? Promise.resolve()
      : idbWriteOutbox(environment, durable);
    const settled = options.requireEveryAvailableStore ? idbPersist : idbPersist.catch(() => undefined);
    durableWriteTails.set(environment, settled);
    return;
  }
  const previous = durableWriteTails.get(environment) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => persistDurableOutbox(
    environment,
    durable,
    options.requireEveryAvailableStore,
  ));
  void next.catch(() => undefined);
  durableWriteTails.set(environment, next);
}

/** Confirm waits for its slim outbox pointer, never for the network. */
export async function awaitContinuityOutboxDurable(environment: Environment): Promise<void> {
  await (durableWriteTails.get(environment) ?? Promise.resolve());
}

/** Load a durable IndexedDB outbox when localStorage was emptied by quota. */
async function hydrateContinuityOutboxNow(environment: Environment): Promise<number> {
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

export function hydrateContinuityOutbox(environment: Environment): Promise<number> {
  const existing = hydrationFlights.get(environment);
  if (existing) return existing;
  const flight = hydrateContinuityOutboxNow(environment).finally(() => {
    if (hydrationFlights.get(environment) === flight) hydrationFlights.delete(environment);
  });
  hydrationFlights.set(environment, flight);
  return flight;
}

function sameIdentity(left: ContinuityIdentity, right: ContinuityIdentity): boolean {
  const leftSubject = left.subject.trim();
  const rightSubject = right.subject.trim();
  if (leftSubject && rightSubject) return leftSubject === rightSubject;
  return left.email.trim().toLowerCase() === right.email.trim().toLowerCase();
}

function assertWeeklyStampTransportBindings(
  snapshot: Household,
  memberId: string,
  confirmationIds: readonly string[],
): void {
  const confirmations = new Set(confirmationIds);
  for (const receipt of snapshot.commandReceipts.filter((row) => confirmations.has(row.confirmationId))) {
    if (receipt.commandKind !== "stampWeeklyDocument") continue;
    const stamps = (snapshot.weeklyDocumentStamps ?? []).filter((row) => receipt.postedIds.includes(row.id));
    if (receipt.postedIds.length !== 1 || stamps.length !== 1 || stamps[0]!.memberId !== memberId) {
      throw new Error("This Google member can share only their own weekly stamp.");
    }
  }
}

export function setContinuityStore(store: ContinuityStore | null): void {
  storeOverride = store;
  memoryOutbox.clear();
  durableWriteTails.clear();
  hydrationFlights.clear();
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

/**
 * Resolve the household tip to push. Prefers the newest eligible tip among
 * memory snapshot, Retry live household, and the on-device replica. Never
 * publishes books older than the queued tipRevision (D-145).
 */
export async function resolveOutboxHousehold(
  item: ContinuityOutboxItem,
  liveHousehold?: Household,
): Promise<Household> {
  const tipRevision = Number.isFinite(item.tipRevision) ? item.tipRevision : 0;
  const candidates: Household[] = [];

  if (item.snapshot) {
    candidates.push(ensureHouseholdShape(item.snapshot));
  }
  if (
    liveHousehold
    && liveHousehold.householdId === item.householdId
    && liveHousehold.environment === item.environment
  ) {
    candidates.push(ensureHouseholdShape(liveHousehold));
  }

  let loaded: Household | null = null;
  try {
    loaded = await loadHousehold(item.environment, item.householdId, item.memberId);
  } catch {
    loaded = null;
  }
  if (loaded) candidates.push(ensureHouseholdShape(loaded));
  try {
    const staged = await loadStagedHouseholdBooks(item.environment, item.householdId);
    if (staged) candidates.push(ensureHouseholdShape(staged));
  } catch {
    // A missing isolated stage leaves the durable marker for cloud reconciliation.
  }

  const eligible = candidates.filter((household) => {
    try {
      assertOutboxItemBinding({ ...item, snapshot: household, identity: item.identity });
      return household.revision >= tipRevision;
    } catch {
      return false;
    }
  });

  if (!eligible.length) {
    if (candidates.length) {
      throw new Error(
        "This phone's books are behind the share queue tip. Open the latest books, then tap Retry now.",
      );
    }
    throw new Error(
      "Saved on this phone. Open these household books, then tap Retry now to share them.",
    );
  }

  eligible.sort((left, right) => right.revision - left.revision || right.baseRevision - left.baseRevision);
  const chosen = eligible[0]!;
  assertOutboxItemBinding({ ...item, snapshot: chosen, identity: item.identity });
  return chosen;
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
  const useCommandRefs = continuityCommandLogEnabled();
  const commandRef = useCommandRefs
    ? buildCommandRef({
      household: snapshot,
      confirmationId: input.confirmationId,
      baseRevision: input.expectedRevision,
    })
    : null;
  const mergedCommandRefs = commandRef
    ? [
      ...(existing?.commandRefs ?? []).filter((row) => row.confirmationId !== commandRef.confirmationId),
      commandRef,
    ]
    : existing?.commandRefs;
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
    tipRevision: snapshot.revision,
    generation: `${snapshot.revision}:${now}:${[...new Set([...(existing?.confirmationIds ?? []), input.confirmationId].filter(Boolean))].join("|")}`,
    confirmationIds: [...new Set([...(existing?.confirmationIds ?? []), input.confirmationId].filter(Boolean))],
    transportKind: useCommandRefs && mergedCommandRefs?.length ? "command-ref" : "snapshot-tip",
    commandRefs: mergedCommandRefs,
    snapshot,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    attempts: existing?.attempts ?? 0,
    lastError: null,
    // Compacting a newer snapshot after conflict choose must not inherit the block.
    blockedByConflict: false,
    nextAttemptAt: null,
  };
  assertWeeklyStampTransportBindings(snapshot, memberId, item.confirmationIds);
  assertOutboxItemBinding({ ...item, snapshot, identity: item.identity });
  write(snapshot.environment, [...items.filter((row) => row.id !== id), item]);
  return item;
}

function sameOutboxGeneration(left: ContinuityOutboxItem, right: ContinuityOutboxItem): boolean {
  return left.id === right.id
    && left.tipRevision === right.tipRevision
    && left.generation === right.generation;
}

function replaceItem(item: ContinuityOutboxItem): void {
  const items = read(item.environment);
  const current = items.find((row) => row.id === item.id);
  if (!current || !sameOutboxGeneration(current, item)) return;
  write(item.environment, [...items.filter((row) => row.id !== item.id), item]);
}

/** Idempotent acknowledgement: drop the queued snapshot after a successful hosted CAS. */
export function acknowledgeContinuityOutboxItem(item: ContinuityOutboxItem): void {
  write(
    item.environment,
    read(item.environment).filter((row) => !sameOutboxGeneration(row, item)),
  );
}

/** Compare-and-remove an outbox generation and wait until its durable deletion settles. */
export async function acknowledgeContinuityOutboxItemDurably(item: ContinuityOutboxItem): Promise<void> {
  acknowledgeContinuityOutboxItem(item);
  await awaitContinuityOutboxDurable(item.environment);
}

export function stagedHouseholdMatchesContinuityGeneration(
  staged: Household,
  item: ContinuityOutboxItem,
): boolean {
  try {
    assertOutboxItemBinding({ ...item, snapshot: staged, identity: item.identity });
  } catch {
    return false;
  }
  const receipts = new Set((staged.commandReceipts ?? []).map((row) => row.confirmationId));
  return staged.revision === item.tipRevision
    && item.confirmationIds.every((id) => receipts.has(id));
}

/**
 * Cancel one definitive-conflict generation after a stable cloud pair is known.
 * A newer/replaced queue or stage is never removed by an older in-flight result.
 */
export async function cancelContinuityConflictGeneration(item: ContinuityOutboxItem): Promise<boolean> {
  const current = read(item.environment).find((row) => row.id === item.id);
  if (!current || !sameOutboxGeneration(current, item)) return false;
  let staged: Household | null = null;
  try {
    staged = await loadStagedHouseholdBooks(item.environment, item.householdId);
  } catch {
    return false;
  }
  if (staged) {
    if (!stagedHouseholdMatchesContinuityGeneration(staged, item)) return false;
    await clearStagedHouseholdBooks(item.environment, item.householdId);
  }
  await acknowledgeContinuityOutboxItemDurably(item);
  return true;
}

function remoteAcknowledgesOutbox(remote: Household, item: ContinuityOutboxItem): boolean {
  if (
    remote.environment !== item.environment
    || remote.householdId !== item.householdId
    || remote.revision < item.tipRevision
  ) return false;
  const refs = item.commandRefs ?? [];
  if (!refs.length || refs.length !== item.confirmationIds.length) return false;
  return refs.every((ref) => {
    const receipt = remote.commandReceipts.find((row) => row.confirmationId === ref.confirmationId);
    if (!receipt) return false;
    const receiptAuditHash = receipt.scopedAuditHashes?.[ref.ledgerScope] ?? receipt.auditHash;
    return receipt.identityHash === ref.identityHash
      && receipt.commandKind === ref.commandType
      && receipt.revision === ref.resultRevision
      && receiptAuditHash === ref.commandPayload.auditHash
      && JSON.stringify([...receipt.postedIds].sort()) === JSON.stringify([...ref.commandPayload.postedIds].sort());
  });
}

/** Resolve delivery ambiguity from an authenticated canonical pull. */
export async function acknowledgeContinuityOutboxFromRemote(remote: Household): Promise<number> {
  const accepted = listContinuityOutbox(remote.environment)
    .filter((item) => remoteAcknowledgesOutbox(remote, item));
  for (const item of accepted) {
    await acknowledgeContinuityOutboxItemDurably(item);
  }
  return accepted.length;
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

async function allDurableOutboxItems(environment: Environment): Promise<ContinuityOutboxItem[]> {
  await hydrateContinuityOutbox(environment);
  const sources = [
    ...(await idbReadOutbox(environment) ?? []),
    ...readFromLocal(environment),
    ...(memoryOutbox.get(environment) ?? []),
  ];
  const byId = new Map<string, ContinuityOutboxItem>();
  for (const item of sources) {
    const existing = byId.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      byId.set(item.id, item.snapshot || !existing?.snapshot ? item : { ...item, snapshot: existing.snapshot });
    }
  }
  return [...byId.values()];
}

/** Wait for startup hydration, then erase one household's retry metadata durably. */
export async function clearContinuityOutboxForHouseholdDurably(
  environment: Environment,
  householdId: string,
): Promise<number> {
  const items = await allDurableOutboxItems(environment);
  const next = items.filter((item) => item.householdId !== householdId);
  const removed = items.length - next.length;
  write(environment, next, { requireEveryAvailableStore: true });
  await awaitContinuityOutboxDurable(environment);
  return removed;
}

/** Drop every queued snapshot for one environment. */
export function clearContinuityOutbox(environment: Environment): number {
  const removed = read(environment).length;
  write(environment, []);
  return removed;
}

/** Wait for startup hydration, then erase every retry marker in one environment. */
export async function clearContinuityOutboxDurably(environment: Environment): Promise<number> {
  const removed = (await allDurableOutboxItems(environment)).length;
  write(environment, [], { requireEveryAvailableStore: true });
  await awaitContinuityOutboxDurable(environment);
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

function shouldUseCommandLogFlush(
  item: ContinuityOutboxItem,
  config?: SupabaseConfig | null,
): boolean {
  if (!continuityCommandLogEnabled()) return false;
  if (item.transportKind !== "command-ref") return false;
  if (!item.commandRefs?.length) return false;
  if (!config?.authUserId && !config?.accessToken) return false;
  // D-149 / D-123: the first hosted write must call hearth_create_household so
  // continuity_memberships gets role=owner. append_continuity_command requires
  // an existing membership and never inserts the owner — invite then returns
  // not-owner for the person who started the household.
  if (item.expectedRevision === 0) return false;
  return true;
}

async function flushItem(
  item: ContinuityOutboxItem,
  identity: ContinuityIdentity,
  config?: SupabaseConfig | null,
  liveHousehold?: Household,
): Promise<
  | { kind: "synchronized"; revision: number }
  | { kind: "pending"; message: string }
  | { kind: "conflict"; remote: Household; message: string }
> {
  try {
    if (!sameIdentity(item.identity, identity)) {
      throw new Error("This outbox entry belongs to a different Google account and was not replayed.");
    }
    const household = await resolveOutboxHousehold(item, liveHousehold);
    assertOutboxItemBinding({ ...item, snapshot: household, identity: item.identity });
    assertWeeklyStampTransportBindings(household, item.memberId, item.confirmationIds);

    const pushed = shouldUseCommandLogFlush(item, config)
      ? await (async () => {
        const primary = primaryCommandRef(item.commandRefs!);
        return appendContinuityCommand(household, config!, {
          continuityMemberId: item.memberId,
          expectedRevision: item.expectedRevision,
          commandRef: primary,
          commandPayload: await compactedCommandPayload(
            { confirmationIds: item.confirmationIds, commandRefs: item.commandRefs! },
            primary,
            household,
            item.memberId,
          ),
        });
      })()
      : await pushSupabaseHousehold(household, config, {
        expectedRevision: item.expectedRevision,
        continuityIdentity: identity,
      });

    if (pushed.conflict && pushed.remote) {
      const message = pushed.error || "Another device has newer books. Nothing was overwritten.";
      pendingItem(item, message, true);
      return { kind: "conflict", remote: pushed.remote, message };
    }
    if (!pushed.schema || pushed.skipped || pushed.error) {
      const message = pushed.error || "Saved on this device. Cloud continuity will retry automatically.";
      pendingItem(item, message);
      return { kind: "pending", message };
    }
    // Successful CAS (including idempotent duplicate delivery) acknowledges the outbox entry.
    // Local books are never cleared here — only the transport queue item.
    await acknowledgeContinuityOutboxItemDurably(item);
    return { kind: "synchronized", revision: household.revision };
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
  /** On an ambiguous response, verify the same confirmation receipt by authenticated pull. */
  reconcileAmbiguous?: boolean;
}): Promise<
  | { ok: true; remoteRevision?: number; remote?: Household; remotePersonal?: PersonalEnvelope }
  | {
      ok: false;
      errorClass: "pending-transport" | "conflict-detected" | "disconnected";
      remote?: Household;
      remotePersonal?: PersonalEnvelope;
      finalizeConflict?: () => Promise<boolean>;
      message: string;
    }
> {
  const priorItems = read(input.household.environment);
  let item: ContinuityOutboxItem;
  try {
    item = enqueueContinuitySnapshot(input);
    await awaitContinuityOutboxDurable(item.environment);
  } catch (caught) {
    // No network request has started. Restore the exact prior queue in memory
    // and best-effort durable storage so this failed Confirm cannot masquerade
    // as an ambiguously delivered cloud write.
    try {
      write(input.household.environment, priorItems);
      await awaitContinuityOutboxDurable(input.household.environment);
    } catch {
      // The browser stores already refused this write; memory still reflects
      // the pre-Confirm queue and remains the safest state for this session.
    }
    return {
      ok: false,
      errorClass: "disconnected",
      message: `Hearth could not safely queue this Confirm before contacting the cloud. Nothing was posted. ${humanizeContinuityError(caught)}`,
    };
  }
  if (input.flush === false) {
    return {
      ok: false,
      errorClass: "pending-transport",
      message: "Saved on this phone. Sharing in the background.",
    };
  }
  const result = await flushItem(item, input.identity, input.config, input.household);
  if (result.kind === "synchronized") return { ok: true, remoteRevision: result.revision };
  if (result.kind === "conflict") {
    if (input.reconcileAmbiguous && input.config) {
      try {
        const consistent = await pullConsistentMemberReplicaById({
          householdId: item.householdId,
          memberId: item.memberId,
          environment: item.environment,
          config: input.config,
          identity: input.identity,
          initialShared: result.remote,
        });
        if (!consistent) {
          return {
            ok: false,
            errorClass: "pending-transport",
            message: "Another device saved first. Hearth is waiting for a complete Shared and Personal cloud copy before cancelling this Confirm.",
          };
        }
        return {
          ok: false,
          errorClass: "conflict-detected",
          remote: consistent.shared,
          remotePersonal: consistent.personal,
          finalizeConflict: () => cancelContinuityConflictGeneration(item),
          message: result.message,
        };
      } catch {
        return {
          ok: false,
          errorClass: "pending-transport",
          message: "Another device saved first. Hearth is waiting for a complete Shared and Personal cloud copy before cancelling this Confirm.",
        };
      }
    }
    return {
      ok: false,
      errorClass: "conflict-detected",
      remote: result.remote,
      message: result.message,
    };
  }
  if (input.reconcileAmbiguous && input.config) {
    try {
      const remote = await pullHouseholdSnapshotById(
        input.household.householdId,
        input.household.environment,
        input.config,
        input.identity,
      );
      if (remote && remoteAcknowledgesOutbox(remote, item)) {
        if (remote.revision > input.household.revision) {
          const consistent = await pullConsistentMemberReplicaById({
            householdId: input.household.householdId,
            memberId: item.memberId,
            environment: input.household.environment,
            config: input.config,
            identity: input.identity,
            initialShared: remote,
          });
          if (!consistent || !remoteAcknowledgesOutbox(consistent.shared, item)) {
            throw new Error("The newer shared household could not be paired with the signed-in member's Personal copy.");
          }
          await acknowledgeContinuityOutboxItemDurably(item);
          return {
            ok: true,
            remoteRevision: consistent.revision,
            remote: consistent.shared,
            remotePersonal: consistent.personal,
          };
        }
        await acknowledgeContinuityOutboxItemDurably(item);
        return { ok: true, remoteRevision: remote.revision, remote };
      }
    } catch {
      // The explicit in-flight marker remains until a later authenticated pull.
    }
  }
  return { ok: false, errorClass: "pending-transport", message: result.message };
}

export async function flushContinuityOutbox(input: {
  environment: Environment;
  identity: ContinuityIdentity;
  config?: SupabaseConfig | null;
  /** Auth deployments fail closed before reading or sending any financial tip. */
  requireAuthenticatedSession?: boolean;
  authenticatedIdentity?: ContinuityIdentity | null;
  /** Bypass nextAttemptAt backoff (manual retry / tests). Conflicts still stay blocked. */
  force?: boolean;
  /**
   * When the durable queue is empty (e.g. localStorage quota dropped it), Retry can
   * still push the live in-memory household by seeding one outbox item first.
   * Also used to resolve slim durable tips that omit the memory snapshot (D-145).
   */
  liveHousehold?: Household;
  expectedRevision?: number;
  confirmationId?: string;
}): Promise<ContinuityFlushResult> {
  if (
    input.requireAuthenticatedSession
    && (
      !input.config?.accessToken
      || !input.config.authUserId
      || !input.authenticatedIdentity
      || !sameIdentity(input.identity, input.authenticatedIdentity)
    )
  ) {
    return {
      synchronized: 0,
      pending: read(input.environment).filter((item) => sameIdentity(item.identity, input.identity)).length,
      deferred: 0,
      conflicts: [],
    };
  }
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
    // Older builds persisted stale-revision rows as permanently blocked. The
    // current client must replay them so App can rebase the queued entry onto
    // the hosted tip and settle it without a phone-versus-cloud chooser.
    if (!isDue(item, input.force === true)) {
      result.deferred += 1;
      result.pending += 1;
      continue;
    }
    const flushed = await flushItem(item, input.identity, input.config, input.liveHousehold);
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
