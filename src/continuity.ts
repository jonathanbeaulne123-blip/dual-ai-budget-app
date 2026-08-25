import {
  memberIdForGoogleIdentity,
  type GoogleIdentitySelector,
} from "./core/google.ts";
import { ensureHouseholdShape } from "./core/sync.ts";
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
  productionContinuityEnabled,
  unprojectedHostedTransportAllowed,
} from "./ledger/continuityPolicy.ts";

const OUTBOX_PREFIX = "hearth:continuity-outbox:v1:";
const MAX_BACKOFF_MS = 60_000;

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

function read(environment: Environment): ContinuityOutboxItem[] {
  const store = browserStore();
  if (!store) return [];
  try {
    const raw = store.getItem(key(environment));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOutboxItem).map((item) => ({
      ...item,
      snapshot: ensureHouseholdShape(item.snapshot),
      confirmationIds: Array.isArray(item.confirmationIds) ? item.confirmationIds.filter(Boolean) : [],
      attempts: Number.isInteger(item.attempts) ? item.attempts : 0,
      lastError: item.lastError || null,
      blockedByConflict: item.blockedByConflict === true,
      nextAttemptAt: typeof item.nextAttemptAt === "string" ? item.nextAttemptAt : null,
    }));
  } catch {
    return [];
  }
}

function write(environment: Environment, items: ContinuityOutboxItem[]): void {
  const store = browserStore();
  if (!store) throw new Error("This device could not open its continuity outbox.");
  if (items.length) store.setItem(key(environment), JSON.stringify(items));
  else store.removeItem(key(environment));
}

function sameIdentity(left: ContinuityIdentity, right: ContinuityIdentity): boolean {
  const leftSubject = left.subject.trim();
  const rightSubject = right.subject.trim();
  if (leftSubject && rightSubject) return leftSubject === rightSubject;
  return left.email.trim().toLowerCase() === right.email.trim().toLowerCase();
}

export function setContinuityStore(store: ContinuityStore | null): void {
  storeOverride = store;
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
    blockedByConflict: existing?.blockedByConflict ?? false,
    nextAttemptAt: null,
  };
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

function pendingItem(item: ContinuityOutboxItem, message: string, blockedByConflict = false): ContinuityOutboxItem {
  const attempts = item.attempts + 1;
  const nextAttemptAt = blockedByConflict
    ? null
    : new Date(nowMs() + continuityBackoffMs(attempts)).toISOString();
  const next = {
    ...item,
    attempts,
    updatedAt: new Date(nowMs()).toISOString(),
    lastError: message,
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
    const message = caught instanceof Error ? caught.message : String(caught);
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
      message: caught instanceof Error ? caught.message : String(caught),
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
}): Promise<ContinuityFlushResult> {
  const result: ContinuityFlushResult = { synchronized: 0, pending: 0, deferred: 0, conflicts: [] };
  const items = read(input.environment).filter((item) => sameIdentity(item.identity, input.identity));
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
