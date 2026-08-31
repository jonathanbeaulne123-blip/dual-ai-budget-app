import type { PGlite } from "@electric-sql/pglite";
import { financialAuditHash } from "../core/commandIdentity.ts";
import {
  booksEquation,
  compileHousehold,
  trialBalance,
  type CompiledBooks,
} from "../core/journal.ts";
import type { Household, Environment } from "../core/types.ts";
import { assertReadOnlySelect } from "./queryGuard.ts";
import { BOOKS_SCHEMA, BOOKS_SCHEMA_VERSION } from "./schema.ts";
import { hostedTransportAllowed } from "../core/sharing.ts";
import { pushSupabaseHousehold, probeSupabase } from "./supabase.ts";
import { measureHearth } from "../performanceMetrics.ts";
import {
  shapeHouseholdFundConfig,
  shapeHouseholdFundEvents,
  shapeHouseholdFundKittyAllocations,
  shapeHouseholdFundMonthPlans,
  shapeHouseholdFundPrivate,
  shapeHouseholdFundSettlementAllocations,
} from "../core/householdFund.ts";

export type HostedBooksMode = "local" | "opted-in" | "published" | "failed";

export type BooksStatus = {
  ok: boolean;
  engine: "pglite" | "pglite+supabase";
  postgresVersion?: string;
  entryCount: number;
  inBalance: boolean;
  equationHolds: boolean;
  writeMode?: "full" | "incremental";
  changedRowCount?: number;
  compactionReason?: "first-ingest" | "household-switch" | "untrusted-previous" | "large-delta" | "periodic-compaction" | "incremental-disabled" | "production-full-path";
  error?: string;
  hosted?: {
    provider: "supabase";
    mode: HostedBooksMode;
    reachable: boolean;
    schema: boolean;
    project?: string;
    error?: string;
  };
};

type Queryable = {
  query: PGlite["query"];
  exec: PGlite["exec"];
};

type BooksDatabase = Pick<PGlite, "query" | "exec" | "transaction" | "close">;

type InsertValue = string | number | boolean | null;

type ProjectionTable = {
  table: string;
  keyColumn: string;
  columns: string[];
  rows: InsertValue[][];
};

type ProjectionDelta = {
  changedRowCount: number;
  priorRowCount: number;
  deletes: Map<string, InsertValue[]>;
  upserts: Map<string, InsertValue[][]>;
};

export type BooksIngestOptions = {
  previous?: Household | null;
  previousCompiled?: CompiledBooks;
  incremental?: boolean;
  /** Canonical hash already computed by the accepted-write boundary. */
  auditHash?: string;
};

const INCREMENTAL_COMPACTION_RECEIPTS = 64;
const INCREMENTAL_MAX_CHANGED_ROWS = 1_000;
const INCREMENTAL_MIN_CHANGED_ROWS = 32;
const INCREMENTAL_CHANGED_RATIO = 0.25;

const PROJECTION_DIGEST_TABLES = [
  ["households", "id", "id"],
  ["members", "id", "household_id"],
  ["categories", "id", "household_id"],
  ["chart_accounts", "id", "household_id"],
  ["journal_entries", "id", "household_id"],
  ["journal_lines", "id", "household_id"],
  ["source_transactions", "id", "household_id"],
  ["shifts", "id", "household_id"],
  ["goals", "id", "household_id"],
  ["budget_plans", "id", "household_id"],
  ["recurrences", "id", "household_id"],
  ["activity", "id", "household_id"],
  ["household_funds", "id", "household_id"],
  ["fund_month_plans", "id", "household_id"],
  ["fund_events", "id", "household_id"],
  ["fund_settlement_allocations", "id", "household_id"],
  ["fund_kitty_allocations", "id", "household_id"],
  ["fund_bank_bindings", "id", "household_id"],
  ["fund_private_reconciliations", "id", "household_id"],
  ["household_snapshots", "household_id", "household_id"],
] as const;

/**
 * Digest the actual materialized SQL projection, not the source JSON. A v4
 * receipt anchors this value after a full rebuild; every later delta verifies
 * the live tables against that anchor before changing a row.
 */
function projectionDigestExpression(householdParameter = "$1"): string {
  const parts = PROJECTION_DIGEST_TABLES.flatMap(([table, keyColumn, householdColumn]) => [
    `'${table}'`,
    `COALESCE((
      SELECT string_agg(md5(to_jsonb(p)::text), ',' ORDER BY p.${keyColumn})
      FROM ${table} p
      WHERE p.${householdColumn} = ${householdParameter}
    ), '')`,
  ]);
  return `md5(concat_ws('|', ${parts.join(", ")}))`;
}

async function actualProjectionHash(db: Queryable, householdId: string): Promise<string> {
  const result = await db.query<{ projection_hash: string }>(
    `SELECT ${projectionDigestExpression("$1")} AS projection_hash`,
    [householdId],
  );
  const digest = result.rows[0]?.projection_hash;
  if (!digest) throw new Error("PGlite could not prove the materialized books projection.");
  return digest;
}

/**
 * PGlite pays a meaningful WASM/IndexedDB boundary cost per query. Keep the
 * accepted snapshot rebuild transactional, but cross that boundary in bounded
 * batches instead of once per ledger row.
 */
async function insertRows(
  db: Queryable,
  table: string,
  columns: string[],
  rows: InsertValue[][],
  batchSize = 250,
): Promise<void> {
  if (!rows.length) return;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values: InsertValue[] = [];
    const tuples = batch.map((row, rowIndex) => {
      if (row.length !== columns.length) throw new Error(`Invalid ${table} projection row.`);
      values.push(...row);
      const base = rowIndex * columns.length;
      return `(${columns.map((_, columnIndex) => `$${base + columnIndex + 1}`).join(",")})`;
    });
    await db.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")}`,
      values,
    );
  }
}

async function upsertRows(
  db: Queryable,
  table: string,
  columns: string[],
  rows: InsertValue[][],
  batchSize = 250,
): Promise<void> {
  if (!rows.length) return;
  const assignments = columns.slice(1).map((column) => `${column}=EXCLUDED.${column}`).join(",");
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values: InsertValue[] = [];
    const tuples = batch.map((row, rowIndex) => {
      if (row.length !== columns.length) throw new Error(`Invalid ${table} projection row.`);
      values.push(...row);
      const base = rowIndex * columns.length;
      return `(${columns.map((_, columnIndex) => `$${base + columnIndex + 1}`).join(",")})`;
    });
    await db.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")} ON CONFLICT (${columns[0]}) DO UPDATE SET ${assignments}`,
      values,
    );
  }
}

async function deleteRows(
  db: Queryable,
  table: string,
  keyColumn: string,
  keys: InsertValue[],
  batchSize = 250,
): Promise<void> {
  for (let offset = 0; offset < keys.length; offset += batchSize) {
    const batch = keys.slice(offset, offset + batchSize);
    if (!batch.length) continue;
    await db.query(
      `DELETE FROM ${table} WHERE ${keyColumn} IN (${batch.map((_, index) => `$${index + 1}`).join(",")})`,
      batch,
    );
  }
}

let browserDbs = new Map<string, BooksDatabase>();
let browserDbOpenings = new Map<string, Promise<BooksDatabase>>();
const compiledBooksCache = new Map<string, CompiledBooks>();

function compiledCacheKey(household: Household): string | null {
  return household.booksAcceptedHash
    ? `${household.environment}:${household.householdId}:${household.revision}:${household.booksAcceptedHash}`
    : null;
}

function rememberCompiledBooks(household: Household, compiled: CompiledBooks): void {
  const key = compiledCacheKey(household);
  if (!key) return;
  compiledBooksCache.set(key, compiled);
  while (compiledBooksCache.size > 4) {
    const oldest = compiledBooksCache.keys().next().value as string | undefined;
    if (!oldest) break;
    compiledBooksCache.delete(oldest);
  }
}

function recalledCompiledBooks(household: Household): CompiledBooks | undefined {
  const key = compiledCacheKey(household);
  return key ? compiledBooksCache.get(key) : undefined;
}

export function booksIdbName(environment: Environment): string {
  return `idb://hearth-books-${environment}`;
}

export function incrementalBooksEnabled(environment: Environment): boolean {
  return environment === "development" && String(import.meta.env.VITE_PGLITE_INCREMENTAL_DEV ?? "0") === "1";
}

export async function migrateBooks(db: Queryable): Promise<void> {
  await db.exec(BOOKS_SCHEMA);
  const applied = await db.query<{ id: number }>("SELECT id FROM schema_migrations ORDER BY id");
  const have = new Set(applied.rows.map((row) => row.id));
  if (!have.has(1)) {
    await db.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [1, new Date().toISOString()]);
    have.add(1);
  }
  if (!have.has(2)) {
    // D-126: allow any non-empty IANA timezone on local books.
    await db.exec(`
      ALTER TABLE households DROP CONSTRAINT IF EXISTS households_timezone_check;
      ALTER TABLE households ADD CONSTRAINT households_timezone_nonempty CHECK (char_length(timezone) > 0);
    `);
    await db.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [2, new Date().toISOString()]);
    have.add(2);
  }
  if (!have.has(3)) {
    // D-161: BOOKS_SCHEMA creates the Fund projection tables and adds account scope idempotently.
    await db.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [3, new Date().toISOString()]);
    have.add(3);
  }
  if (!have.has(4)) {
    // D-176: v4 receipts prove the exact materialized SQL projection before deltas.
    // Existing receipts intentionally remain unproved so Startup P1 performs one
    // full rebuild from the cached household before incremental mode can engage.
    await db.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [4, new Date().toISOString()]);
    have.add(4);
  }
  if (!have.has(5)) {
    // D-182: truthful opening rows are a balance-sheet source transaction, not P&L.
    await db.exec(`
      ALTER TABLE source_transactions DROP CONSTRAINT IF EXISTS source_transactions_type_check;
      ALTER TABLE source_transactions ADD CONSTRAINT source_transactions_type_check
        CHECK (type IN ('expense', 'income', 'transfer', 'refund', 'opening'));
    `);
    await db.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [5, new Date().toISOString()]);
  }
}

export async function openMemoryBooks(): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create();
  await migrateBooks(db);
  return db;
}

export async function getBrowserBooks(environment: Environment = "development"): Promise<BooksDatabase> {
  const existing = browserDbs.get(environment);
  if (existing) return existing;
  const opening = browserDbOpenings.get(environment);
  if (opening) return opening;
  let nextOpening!: Promise<BooksDatabase>;
  nextOpening = measureHearth("hearth:books:open-migrate", async () => {
    const persist = typeof indexedDB !== "undefined";
    const canUseWorker = persist
      && typeof window !== "undefined"
      && typeof Worker !== "undefined"
      && typeof BroadcastChannel !== "undefined"
      && typeof navigator !== "undefined"
      && "locks" in navigator;
    const db: BooksDatabase = canUseWorker
      ? await (async () => {
          const [{ PGliteWorker }] = await Promise.all([
            import("@electric-sql/pglite/worker"),
          ]);
          return PGliteWorker.create(
            new Worker(new URL("./pglite.worker.ts", import.meta.url), { type: "module", name: `hearth-books-${environment}` }),
            { dataDir: booksIdbName(environment), id: `hearth-books-${environment}` },
          );
        })()
      : await (async () => {
          const { PGlite } = await import("@electric-sql/pglite");
          return persist ? PGlite.create(booksIdbName(environment)) : PGlite.create();
        })();
    await migrateBooks(db);
    if (browserDbOpenings.get(environment) !== nextOpening) {
      await db.close().catch(() => undefined);
      throw new Error("The books engine opening was retired before it became active.");
    }
    browserDbs.set(environment, db);
    return db;
  });
  browserDbOpenings.set(environment, nextOpening);
  try {
    return await nextOpening;
  } finally {
    if (browserDbOpenings.get(environment) === nextOpening) browserDbOpenings.delete(environment);
  }
}

async function reopenBrowserBooks(environment: Environment): Promise<BooksDatabase> {
  const opening = browserDbOpenings.get(environment);
  browserDbOpenings.delete(environment);
  const existing = browserDbs.get(environment);
  browserDbs.delete(environment);
  if (opening) {
    try { await opening; } catch { /* retired opening */ }
  }
  if (existing) {
    try {
      await existing.close();
    } catch {
      /* A lost worker leader may already have closed this handle. */
    }
  }
  return getBrowserBooks(environment);
}

function isLeaderChangedError(caught: unknown): boolean {
  return caught instanceof Error
    && (caught.name === "LeaderChangedError" || /leader changed/i.test(caught.message));
}

function byId<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.id.localeCompare(right.id));
}

export function booksIntegrityFacts(household: Household) {
  return {
    householdId: household.householdId,
    revision: household.revision,
    lastCommittedAt: household.lastCommittedAt,
    transactions: byId(household.transactions).map((tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      amountCents: tx.amountCents,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      subcategoryId: tx.subcategoryId,
      splits: [...tx.splits].sort((left, right) => left.party.localeCompare(right.party) || left.amountCents - right.amountCents),
      visibility: tx.visibility,
      createdBy: tx.createdBy,
      isDuplicate: tx.isDuplicate,
      reversalOfId: tx.reversalOfId ?? null,
    })),
    shifts: byId(household.shifts).map((shift) => ({
      id: shift.id,
      date: shift.date,
      memberId: shift.memberId,
      salesCents: shift.salesCents,
      cashTipsCents: shift.cashTipsCents,
      ccTipsCents: shift.ccTipsCents,
      hours: shift.hours,
      netTipsCents: shift.netTipsCents,
      wagesCents: shift.wagesCents,
      jobId: shift.jobId ?? null,
      roleId: shift.roleId ?? null,
      grossWagesCents: shift.grossWagesCents ?? null,
      paidBreakHours: shift.paidBreakHours ?? null,
      deferredTipOutCents: shift.deferredTipOutCents ?? null,
      deferredTipOutPaidCents: shift.deferredTipOutPaidCents ?? null,
      correctedByShiftId: shift.correctedByShiftId ?? null,
      correctionOfShiftId: shift.correctionOfShiftId ?? null,
      transactionIds: [...(shift.transactionIds ?? [])].sort(),
      sevenShiftsPunchDigest: shift.sevenShiftsPunchDigest ?? null,
      sevenShiftsEvidenceBundle: shift.sevenShiftsEvidenceBundle ?? null,
      shiftBible: shift.shiftBible ?? null,
    })),
    goals: byId(household.goals).map((goal) => ({
      id: goal.id,
      targetCents: goal.targetCents,
      savedCents: goal.savedCents,
      status: goal.status ?? "open",
      purchaseId: goal.purchaseId ?? null,
    })),
    goalContributions: byId(household.goalContributions ?? []).map((row) => ({
      id: row.id,
      goalId: row.goalId,
      memberId: row.memberId,
      amountCents: row.amountCents,
      date: row.date,
    })),
    goalPurchases: byId(household.goalPurchases ?? []).map((row) => ({
      id: row.id,
      goalId: row.goalId,
      spentCents: row.spentCents,
      vaultAccountId: row.vaultAccountId,
      transactionIds: [...row.transactionIds].sort(),
    })),
    claims: byId(household.claims ?? []).map((row) => ({
      id: row.id,
      expectedCents: row.expectedCents,
      receivedCents: row.receivedCents,
      writtenOffCents: row.writtenOffCents,
      expenseTransactionId: row.expenseTransactionId,
      status: row.status,
    })),
    presets: byId(household.presets ?? []).map((row) => ({
      id: row.id,
      amountCents: row.amountCents,
      accountId: row.accountId,
      subcategoryId: row.subcategoryId,
      active: row.active,
    })),
    accounts: byId(household.accounts).map((account) => ({
      id: account.id,
      name: account.name,
      kind: account.kind,
      active: account.active,
      savingsPurpose: account.savings?.purpose ?? null,
    })),
    sitDownSessions: byId(household.sitDownSessions ?? []).map((row) => ({
      id: row.id,
      monthKey: row.monthKey,
      leftoverCents: row.leftoverCents,
      status: row.status,
      transferIds: [...row.transferIds].sort(),
      contributionIds: [...row.contributionIds].sort(),
    })),
    tombstones: byId(household.tombstones ?? []).map((row) => ({
      id: row.id,
      deletedAt: row.deletedAt,
    })),
  };
}

/** Canonical money integrity hash (same facts as hosted CAS and booksAcceptedHash). */
export async function hashBooksSnapshot(household: Household): Promise<string> {
  return financialAuditHash(household);
}

export function hostedFailureStatus(
  error: unknown,
  probe: { reachable: boolean; project?: string },
): NonNullable<BooksStatus["hosted"]> {
  return {
    provider: "supabase",
    mode: "failed",
    reachable: probe.reachable,
    schema: false,
    project: probe.project,
    error: error instanceof Error ? error.message : String(error),
  };
}

export type BooksRecoveryIssue =
  | "missing-schema"
  | "incomplete-migration"
  | "invalid-stored-data"
  | "interrupted-transaction"
  | "projection-mismatch";

export class UnbalancedBooksError extends Error {
  readonly code = "UNBALANCED_JOURNAL";
  constructor(message = "The journal is not balanced. Nothing was posted.") {
    super(message);
    this.name = "UnbalancedBooksError";
  }
}

function assertBalanced(compiled: CompiledBooks, household: Household): {
  equation: ReturnType<typeof booksEquation>;
  tb: ReturnType<typeof trialBalance>;
} {
  if (household.environment !== compiled.environment) {
    throw new UnbalancedBooksError("Development and Production stay on separate books. Nothing was posted.");
  }
  for (const entry of compiled.entries) {
    const debit = entry.lines.reduce((sum, line) => sum + line.debitCents, 0);
    const credit = entry.lines.reduce((sum, line) => sum + line.creditCents, 0);
    if (debit !== credit) {
      throw new UnbalancedBooksError(`Journal ${entry.id} is unbalanced. Nothing was posted.`);
    }
    if (!Number.isInteger(debit) || !Number.isInteger(credit)) {
      throw new UnbalancedBooksError("Books only accept integer CAD cents. Nothing was posted.");
    }
  }
  const equation = booksEquation(compiled);
  const tb = trialBalance(compiled, { recognizedOnly: true });
  if (!tb.inBalance || !equation.holds) {
    throw new UnbalancedBooksError("The trial balance does not hold. Nothing was posted.");
  }
  return { equation, tb };
}

export async function ingestBooks(
  db: BooksDatabase,
  household: Household,
  compiled = compileHousehold(household),
  options: BooksIngestOptions = {},
): Promise<BooksStatus> {
  return db.transaction((tx) => writeBooks(tx, household, compiled, options));
}

export async function resetBrowserBooksForTests(): Promise<void> {
  const openings = [...browserDbOpenings.values()];
  browserDbOpenings = new Map();
  await Promise.allSettled(openings);
  for (const db of browserDbs.values()) {
    try {
      await db.close();
    } catch {
      /* test isolation */
    }
  }
  browserDbs = new Map();
  compiledBooksCache.clear();
}

function deleteIndexedDatabase(name: string): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** Close and drop the PGlite IDB for one environment so a new household starts empty. */
export async function wipeBrowserBooks(environment: Environment): Promise<void> {
  const opening = browserDbOpenings.get(environment);
  browserDbOpenings.delete(environment);
  if (opening) {
    try { await opening; } catch { /* retired opening */ }
  }
  const existing = browserDbs.get(environment);
  if (existing) {
    try {
      await existing.close();
    } catch {
      /* drop proceeds even if close is already done */
    }
    browserDbs.delete(environment);
  }
  const name = booksIdbName(environment).replace(/^idb:\/\//, "");
  await deleteIndexedDatabase(name);
}

type BooksInspection = {
  ok: boolean;
  issue?: BooksRecoveryIssue;
  message: string;
  entryCount: number;
};

async function inspectBrowserBooksAttempt(
  household: Household,
  retryLeaderChange: boolean,
  options: { compiled?: CompiledBooks; expectedAuditHash?: string } = {},
): Promise<BooksInspection> {
  try {
    const db = await getBrowserBooks(household.environment);
    return await measureHearth("hearth:books:inspect", () => db.transaction(async (tx) => {
    const status = await tx.query<{
      schema_initialized: boolean;
      schema_current: boolean;
      household_present: boolean;
      entry_count: number;
      snapshot_hash: string | null;
      projection_hash: string | null;
      actual_projection_hash: string;
      unbalanced: boolean;
    }>(
      `SELECT
         EXISTS (SELECT 1 FROM schema_migrations) AS schema_initialized,
         EXISTS (SELECT 1 FROM schema_migrations WHERE id = $2) AS schema_current,
         EXISTS (SELECT 1 FROM households WHERE id = $1) AS household_present,
         (SELECT count(*)::int FROM journal_entries WHERE household_id = $1) AS entry_count,
         (SELECT snapshot_hash FROM audit_revisions WHERE household_id = $1 ORDER BY revision DESC, at DESC LIMIT 1) AS snapshot_hash,
         (SELECT projection_hash FROM audit_revisions WHERE household_id = $1 ORDER BY revision DESC, at DESC LIMIT 1) AS projection_hash,
         ${projectionDigestExpression("$1")} AS actual_projection_hash,
         EXISTS (SELECT 1 FROM v_unbalanced_entries WHERE household_id = $1) AS unbalanced`,
      [household.householdId, BOOKS_SCHEMA_VERSION],
    );
    const projection = status.rows[0];
    if (!projection?.schema_initialized) {
      return {
        ok: false,
        issue: "missing-schema",
        message: "PGlite opened without a books schema. The JSON household was left alone.",
        entryCount: 0,
      };
    }
    if (!projection.schema_current) {
      return {
        ok: false,
        issue: "incomplete-migration",
        message: "PGlite is missing a books migration. The household was not reset.",
        entryCount: 0,
      };
    }
    const compiled = options.compiled ?? compileHousehold(household);
    const entryCount = Number(projection.entry_count ?? 0);
    if (!projection.household_present && compiled.entries.length > 0) {
      return {
        ok: false,
        issue: "interrupted-transaction",
        message: "The snapshot has journal facts that PGlite does not. Nothing was discarded.",
        entryCount,
      };
    }
    if (projection.household_present && !projection.snapshot_hash) {
      return {
        ok: false,
        issue: "interrupted-transaction",
        message: "PGlite has no acceptance receipt for this financial snapshot. Nothing was discarded.",
        entryCount,
      };
    }
    if (projection.household_present && !projection.projection_hash) {
      return {
        ok: false,
        issue: "incomplete-migration",
        message: "PGlite needs one verified full rebuild before fast local updates can resume.",
        entryCount,
      };
    }
    if (projection.unbalanced) {
      return {
        ok: false,
        issue: "invalid-stored-data",
        message: "PGlite holds an unbalanced journal. The previous valid snapshot is still the UI household.",
        entryCount,
      };
    }
    if (entryCount !== compiled.entries.length) {
      return {
        ok: false,
        issue: "projection-mismatch",
        message: "The snapshot and the accepted PGlite journal do not agree. Recovery is available.",
        entryCount,
      };
    }
    const acceptedHash = projection.snapshot_hash;
    const expectedAuditHash = options.expectedAuditHash ?? await hashBooksSnapshot(household);
    if (acceptedHash && acceptedHash !== expectedAuditHash) {
      return {
        ok: false,
        issue: "projection-mismatch",
        message: "The snapshot and the accepted PGlite journal contain different financial facts. Recovery is available.",
        entryCount,
      };
    }
    if (projection.projection_hash && projection.projection_hash !== projection.actual_projection_hash) {
      return {
        ok: false,
        issue: "projection-mismatch",
        message: "The accepted PGlite projection changed after its receipt. Recovery is available.",
        entryCount,
      };
    }
    return { ok: true, message: "PGlite agrees with the household snapshot.", entryCount };
    }));
  } catch (caught) {
    if (retryLeaderChange && isLeaderChangedError(caught)) {
      try {
        await reopenBrowserBooks(household.environment);
        return inspectBrowserBooksAttempt(household, false, options);
      } catch (retryCaught) {
        caught = retryCaught;
      }
    }
    const message = caught instanceof Error ? caught.message : "The books engine could not be inspected.";
    const issue: BooksRecoveryIssue = /migration/i.test(message)
      ? "incomplete-migration"
      : /unbalanced|invalid/i.test(message)
        ? "invalid-stored-data"
        : /transaction|interrupted/i.test(message)
          ? "interrupted-transaction"
          : "missing-schema";
    return { ok: false, issue, message, entryCount: 0 };
  }
}

function projectBooksTables(household: Household, compiled: CompiledBooks, snapshotUpdatedAt: string): ProjectionTable[] {
  const sourceAccounts = new Map(household.accounts.map((account) => [account.id, account]));
  const fund = shapeHouseholdFundConfig(household.householdFund);
  const privateState = fund ? shapeHouseholdFundPrivate(household.fundPrivate, fund.custodianMemberId) : null;
  return [
    { table: "households", keyColumn: "id", columns: ["id", "name", "timezone", "currency", "environment", "invite_phrase", "linked", "revision", "last_committed_at"], rows: [[compiled.householdId, compiled.name, compiled.timezone, compiled.currency, compiled.environment, compiled.invitePhrase, compiled.linked, compiled.revision, compiled.lastCommittedAt]] },
    { table: "members", keyColumn: "id", columns: ["id", "household_id", "name", "color", "active"], rows: compiled.members.map((member) => [member.id, compiled.householdId, member.name, member.color, member.active]) },
    { table: "categories", keyColumn: "id", columns: ["id", "household_id", "parent_id", "record_type", "name", "transaction_type", "essential", "income_stability", "active", "sort_order"], rows: compiled.categories.map((category) => [category.id, compiled.householdId, category.parentId, category.recordType, category.name, category.transactionType, category.essential, category.incomeStability, category.active, category.sortOrder]) },
    { table: "chart_accounts", keyColumn: "id", columns: ["id", "household_id", "code", "name", "account_type", "normal_balance", "source", "bank_account_id", "category_id", "owner_member_id", "scope", "active"], rows: compiled.chart.map((account) => [account.id, compiled.householdId, account.code, account.name, account.accountType, account.normalBalance, account.source, account.bankAccountId ?? null, account.categoryId ?? null, account.ownerMemberId ?? null, sourceAccounts.get(account.bankAccountId ?? "")?.scope === "personal" ? "personal" : "shared", account.active]) },
    { table: "journal_entries", keyColumn: "id", columns: ["id", "household_id", "date_key", "memo", "place", "source", "source_id", "visibility", "created_by", "recognized", "duplicate_key", "origin_ids"], rows: compiled.entries.map((entry) => [entry.id, compiled.householdId, entry.date, entry.memo, entry.place, entry.source, entry.sourceId ?? null, entry.visibility, entry.createdBy, entry.recognized, entry.duplicateKey, JSON.stringify(entry.originTransactionIds)]) },
    { table: "journal_lines", keyColumn: "id", columns: ["id", "household_id", "entry_id", "line_no", "account_id", "debit_cents", "credit_cents", "party_id", "note"], rows: compiled.entries.flatMap((entry) => entry.lines.map((line) => [line.id, compiled.householdId, entry.id, line.lineNo, line.accountId, line.debitCents, line.creditCents, line.partyId, line.note])) },
    { table: "source_transactions", keyColumn: "id", columns: ["id", "household_id", "date_key", "type", "amount_cents", "account_id", "subcategory_id", "note", "place", "visibility", "created_by", "is_duplicate", "payload"], rows: household.transactions.map((tx) => [tx.id, compiled.householdId, tx.date, tx.type, tx.amountCents, tx.accountId, tx.subcategoryId, tx.note, tx.place, tx.visibility, tx.createdBy, tx.isDuplicate, JSON.stringify(tx)]) },
    { table: "shifts", keyColumn: "id", columns: ["id", "household_id", "date_key", "member_id", "account_id", "sales_cents", "cash_tips_cents", "cc_tips_cents", "hours", "net_tips_cents", "wages_cents", "visibility", "created_by", "payload"], rows: compiled.shifts.map((shift) => [shift.id, compiled.householdId, shift.date, shift.memberId, shift.accountId, shift.salesCents, shift.cashTipsCents, shift.ccTipsCents, shift.hours, shift.netTipsCents, shift.wagesCents, shift.visibility, shift.createdBy, JSON.stringify(shift)]) },
    { table: "goals", keyColumn: "id", columns: ["id", "household_id", "name", "target_cents", "saved_cents", "deadline", "shared", "owner_member_id", "subcategory_id"], rows: compiled.goals.map((goal) => [goal.id, compiled.householdId, goal.name, goal.targetCents, goal.savedCents, goal.deadline, goal.shared, goal.ownerMemberId, goal.subcategoryId]) },
    { table: "budget_plans", keyColumn: "id", columns: ["id", "household_id", "month_key", "subcategory_id", "amount_cents", "essential", "income_stability", "active"], rows: compiled.budgetPlans.map((plan) => [plan.id, compiled.householdId, plan.monthKey, plan.subcategoryId, plan.amountCents, plan.essential, plan.incomeStability, plan.active]) },
    { table: "recurrences", keyColumn: "id", columns: ["id", "household_id", "cadence", "next_date", "type", "amount_cents", "account_id", "subcategory_id", "note", "active", "auto_post"], rows: compiled.recurrences.map((recurrence) => [recurrence.id, compiled.householdId, recurrence.cadence, recurrence.nextDate, recurrence.type, recurrence.amountCents, recurrence.accountId, recurrence.subcategoryId, recurrence.note, recurrence.active, recurrence.autoPost]) },
    { table: "activity", keyColumn: "id", columns: ["id", "household_id", "at", "action", "summary"], rows: compiled.activity.map((item) => [item.id, compiled.householdId, item.at, item.action, item.summary]) },
    { table: "household_funds", keyColumn: "id", columns: ["id", "household_id", "name", "custodian_member_id", "mode", "opened_on", "created_at", "updated_at"], rows: fund ? [[fund.id, compiled.householdId, fund.name, fund.custodianMemberId, fund.mode, fund.openedOn, fund.createdAt, fund.updatedAt]] : [] },
    { table: "fund_month_plans", keyColumn: "id", columns: ["id", "household_id", "fund_id", "month_key", "target_cents", "buffer_cents", "agreed_by_member_ids", "created_at", "updated_at"], rows: fund ? shapeHouseholdFundMonthPlans(household.fundMonthPlans).map((plan) => [plan.id, compiled.householdId, plan.fundId, plan.monthKey, plan.targetCents, plan.bufferCents, JSON.stringify(plan.agreedByMemberIds), plan.createdAt, plan.updatedAt]) : [] },
    { table: "fund_events", keyColumn: "id", columns: ["id", "household_id", "fund_id", "kind", "amount_cents", "date_key", "created_by", "confirmed_by_member_id", "contributor_member_id", "destination_account_id", "related_event_id", "related_transaction_ids", "evidence_digests", "reconciliation_tied", "note", "created_at", "updated_at"], rows: fund ? shapeHouseholdFundEvents(household.fundEvents).map((event) => [event.id, compiled.householdId, event.fundId, event.kind, event.amountCents, event.date, event.createdBy, event.confirmedByMemberId, event.contributorMemberId, event.destinationAccountId, event.relatedEventId, JSON.stringify(event.relatedTransactionIds), JSON.stringify(event.evidenceDigests), event.reconciliationTied, event.note, event.createdAt, event.updatedAt]) : [] },
    { table: "fund_settlement_allocations", keyColumn: "id", columns: ["id", "household_id", "fund_id", "event_id", "transaction_id", "amount_cents", "created_at", "updated_at"], rows: fund ? shapeHouseholdFundSettlementAllocations(household.fundSettlementAllocations).map((allocation) => [allocation.id, compiled.householdId, allocation.fundId, allocation.eventId, allocation.transactionId, allocation.amountCents, allocation.createdAt, allocation.updatedAt]) : [] },
    { table: "fund_kitty_allocations", keyColumn: "id", columns: ["id", "household_id", "fund_id", "event_id", "goal_id", "amount_cents", "created_at", "updated_at"], rows: fund ? shapeHouseholdFundKittyAllocations(household.fundKittyAllocations).map((allocation) => [allocation.id, compiled.householdId, allocation.fundId, allocation.eventId, allocation.goalId, allocation.amountCents, allocation.createdAt, allocation.updatedAt]) : [] },
    { table: "fund_bank_bindings", keyColumn: "id", columns: ["id", "household_id", "fund_id", "member_id", "account_id", "provider", "status", "account_digest", "created_at", "updated_at"], rows: fund && privateState ? privateState.bankBindings.map((binding) => [binding.id, compiled.householdId, binding.fundId, binding.memberId, binding.accountId, binding.provider, binding.status, binding.accountDigest, binding.createdAt, binding.updatedAt]) : [] },
    { table: "fund_private_reconciliations", keyColumn: "id", columns: ["id", "household_id", "fund_id", "member_id", "date_key", "bank_total_cents", "operating_fund_cents", "kitty_cents", "personal_remainder_cents", "difference_cents", "tied", "shared_event_id", "created_at", "updated_at"], rows: fund && privateState ? privateState.reconciliations.map((reconciliation) => [reconciliation.id, compiled.householdId, reconciliation.fundId, reconciliation.memberId, reconciliation.date, reconciliation.bankTotalCents, reconciliation.operatingFundCents, reconciliation.kittyCents, reconciliation.personalRemainderCents, reconciliation.differenceCents, reconciliation.differenceCents === 0, reconciliation.sharedEventId, reconciliation.createdAt, reconciliation.updatedAt]) : [] },
    { table: "household_snapshots", keyColumn: "household_id", columns: ["household_id", "invite_phrase", "environment", "payload", "updated_at"], rows: [[compiled.householdId, compiled.invitePhrase, compiled.environment, JSON.stringify(household), snapshotUpdatedAt]] },
  ];
}

function rowsEqual(left: InsertValue[], right: InsertValue[]): boolean {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

function projectionDelta(previous: ProjectionTable[], next: ProjectionTable[]): ProjectionDelta {
  const deletes = new Map<string, InsertValue[]>();
  const upserts = new Map<string, InsertValue[][]>();
  let changedRowCount = 0;
  let priorRowCount = 0;
  for (const nextTable of next) {
    const previousTable = previous.find((table) => table.table === nextTable.table);
    if (!previousTable) throw new Error(`Missing previous ${nextTable.table} projection.`);
    priorRowCount += previousTable.rows.length;
    const previousRows = new Map(previousTable.rows.map((row) => [String(row[0]), row]));
    const nextRows = new Map(nextTable.rows.map((row) => [String(row[0]), row]));
    const removed = previousTable.rows.filter((row) => !nextRows.has(String(row[0]))).map((row) => row[0]!);
    const changed = nextTable.rows.filter((row) => {
      const before = previousRows.get(String(row[0]));
      return !before || !rowsEqual(before, row);
    });
    if (removed.length) deletes.set(nextTable.table, removed);
    if (changed.length) upserts.set(nextTable.table, changed);
    changedRowCount += removed.length + changed.length;
  }
  return { changedRowCount, priorRowCount, deletes, upserts };
}

async function writeFullProjection(db: Queryable, tables: ProjectionTable[]): Promise<void> {
  await db.query("TRUNCATE TABLE audit_revisions, households CASCADE");
  for (const table of tables) await insertRows(db, table.table, table.columns, table.rows);
}

async function writeIncrementalProjection(db: Queryable, tables: ProjectionTable[], delta: ProjectionDelta): Promise<void> {
  for (const table of [...tables].reverse()) {
    await deleteRows(db, table.table, table.keyColumn, delta.deletes.get(table.table) ?? []);
  }
  for (const table of tables) {
    await upsertRows(db, table.table, table.columns, delta.upserts.get(table.table) ?? []);
  }
}

async function writeBooks(db: Queryable, household: Household, compiled: CompiledBooks, options: BooksIngestOptions = {}): Promise<BooksStatus> {
  const { equation, tb } = assertBalanced(compiled, household);
  const snapshotUpdatedAt = new Date().toISOString();
  const tables = projectBooksTables(household, compiled, snapshotUpdatedAt);
  let writeMode: "full" | "incremental" = "full";
  let changedRowCount = tables.reduce((sum, table) => sum + table.rows.length, 0);
  const incrementalAllowed = options.incremental === true && household.environment === "development";
  let compactionReason: BooksStatus["compactionReason"] = household.environment === "production" && options.incremental
    ? "production-full-path"
    : options.incremental === false
      ? "incremental-disabled"
      : "untrusted-previous";

  if (
    incrementalAllowed
    && options.previous
    && options.previous.householdId === household.householdId
    && options.previous.booksAcceptedHash
  ) {
    const current = await db.query<{
      id: string;
      revision: number;
      snapshot_hash: string;
      projection_hash: string | null;
      actual_projection_hash: string;
      receipts: number;
    }>(
      `SELECT h.id, h.revision,
              COALESCE((SELECT ar.snapshot_hash FROM audit_revisions ar WHERE ar.household_id = h.id ORDER BY ar.revision DESC, ar.at DESC LIMIT 1), '') AS snapshot_hash,
              (SELECT ar.projection_hash FROM audit_revisions ar WHERE ar.household_id = h.id ORDER BY ar.revision DESC, ar.at DESC LIMIT 1) AS projection_hash,
              ${projectionDigestExpression("h.id")} AS actual_projection_hash,
              (SELECT count(*)::int FROM audit_revisions ar WHERE ar.household_id = h.id) AS receipts
       FROM households h
       WHERE h.id = $1`,
      [household.householdId],
    );
    const tip = current.rows[0];
    if (tip) {
      if (Number(tip.revision) !== options.previous.revision || tip.snapshot_hash !== options.previous.booksAcceptedHash) {
        throw new Error("The accepted PGlite receipt does not match the previous household revision and hash.");
      }
      if (tip.projection_hash) {
        if (tip.projection_hash !== tip.actual_projection_hash) {
          throw new Error("The accepted PGlite projection changed after its receipt. Nothing was posted.");
        }
        const previousCompiled = options.previousCompiled
          ?? recalledCompiledBooks(options.previous)
          ?? compileHousehold(options.previous);
        const previousTables = projectBooksTables(options.previous, previousCompiled, options.previous.lastCommittedAt ?? snapshotUpdatedAt);
        const delta = projectionDelta(previousTables, tables);
        changedRowCount = delta.changedRowCount;
        const changeLimit = Math.min(
          INCREMENTAL_MAX_CHANGED_ROWS,
          Math.max(INCREMENTAL_MIN_CHANGED_ROWS, Math.ceil(delta.priorRowCount * INCREMENTAL_CHANGED_RATIO)),
        );
        if (Number(tip.receipts) >= INCREMENTAL_COMPACTION_RECEIPTS) {
          compactionReason = "periodic-compaction";
        } else if (delta.changedRowCount > changeLimit) {
          compactionReason = "large-delta";
        } else {
          await writeIncrementalProjection(db, tables, delta);
          writeMode = "incremental";
          compactionReason = undefined;
        }
      }
    } else {
      compactionReason = "first-ingest";
    }
  } else if (options.previous && options.previous.householdId !== household.householdId) {
    compactionReason = "household-switch";
  } else if (!options.previous) {
    compactionReason = "first-ingest";
  }

  if (writeMode === "full") await writeFullProjection(db, tables);

  const unbalanced = await db.query<{ entry_id: string }>("SELECT entry_id FROM v_unbalanced_entries WHERE household_id = $1", [compiled.householdId]);
  if (unbalanced.rows.length) {
    throw new UnbalancedBooksError("PGlite rejected an unbalanced journal. Nothing was posted.");
  }
  const version = await db.query<{ v: string }>("SELECT current_setting('server_version') AS v");
  const sqlEquation = await db.query<{
    net_worth_cents: number;
    net_income_cents: number;
    equity_cents: number;
  }>("SELECT net_worth_cents, net_income_cents, equity_cents FROM v_net_worth WHERE household_id = $1", [compiled.householdId]);
  const row = sqlEquation.rows[0];
  const sqlHolds = row
    ? Number(row.net_worth_cents) === Number(row.equity_cents) + Number(row.net_income_cents)
    : equation.holds;
  if (!tb.inBalance || !equation.holds || !sqlHolds) {
    throw new UnbalancedBooksError("The accounting equation does not hold after ingest. Nothing was posted.");
  }

  const projectionHash = await actualProjectionHash(db, compiled.householdId);
  await db.query(
    `INSERT INTO audit_revisions (id, household_id, revision, at, snapshot_hash, projection_hash, entry_count, debit_cents, credit_cents, in_balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      `REV-${compiled.householdId}-${compiled.revision}-${compiled.lastCommittedAt ?? "open"}`,
      compiled.householdId,
      compiled.revision,
      compiled.lastCommittedAt ?? new Date().toISOString(),
      options.auditHash ?? await hashBooksSnapshot(household),
      projectionHash,
      compiled.entries.length,
      tb.totalDebitCents,
      tb.totalCreditCents,
      true,
    ],
  );
  rememberCompiledBooks(household, compiled);

  return {
    ok: true,
    engine: "pglite",
    postgresVersion: version.rows[0]?.v,
    entryCount: compiled.entries.length,
    inBalance: true,
    equationHolds: true,
    writeMode,
    changedRowCount,
    compactionReason,
  };
}

/** Local books only. Never calls hosted REST. */
export async function ingestHouseholdBooks(
  household: Household,
  options: BooksIngestOptions & { compiled?: CompiledBooks } = {},
): Promise<{ compiled: CompiledBooks; status: BooksStatus }> {
  const compiled = options.compiled ?? compileHousehold(household);
  const ingestOptions = {
    ...options,
    incremental: options.incremental ?? incrementalBooksEnabled(household.environment),
  };
  try {
    const db = await getBrowserBooks(household.environment);
    const status = await measureHearth(
      "hearth:books:ingest",
      () => ingestBooks(db, household, compiled, ingestOptions),
    );
    return { compiled, status };
  } catch (caught) {
    if (!isLeaderChangedError(caught)) throw caught;
    await reopenBrowserBooks(household.environment);
    const inspection = await inspectBrowserBooks(household);
    if (!inspection.ok) throw caught;
    return {
      compiled,
      status: {
        ok: true,
        engine: "pglite",
        entryCount: inspection.entryCount,
        inBalance: true,
        equationHolds: true,
      },
    };
  }
}

export async function inspectBrowserBooks(
  household: Household,
  options: { compiled?: CompiledBooks; expectedAuditHash?: string } = {},
): Promise<BooksInspection> {
  return inspectBrowserBooksAttempt(household, true, options);
}

export async function restoreHouseholdBooks(household: Household): Promise<void> {
  await ingestHouseholdBooks(household);
}

/** Linked snapshot transport only. Unlinked households skip with zero fetch.
 * D-143: this path is explicit legacy recovery (Auth-off Pairing), not automatic continuity.
 */
export async function publishLinkedHousehold(household: Household): Promise<BooksStatus["hosted"]> {
  if (!hostedTransportAllowed(household)) {
    return { provider: "supabase", mode: "local", reachable: false, schema: false, error: undefined };
  }
  try {
    const hosted = await pushSupabaseHousehold(household, undefined, { legacyLinkedPublish: true });
    return {
      provider: "supabase",
      mode: hosted.schema ? "published" : "failed",
      reachable: hosted.reachable,
      schema: hosted.schema,
      project: hosted.project,
      error: hosted.error,
    };
  } catch (caught) {
    const hosted = await probeSupabase();
    return hostedFailureStatus(caught, hosted);
  }
}

/** @deprecated Prefer ingestHouseholdBooks, then publishLinkedHousehold only when linked. */
export async function syncHouseholdBooks(household: Household): Promise<{ compiled: CompiledBooks; status: BooksStatus }> {
  const { compiled, status } = await ingestHouseholdBooks(household);
  if (!hostedTransportAllowed(household)) {
    return { compiled, status };
  }
  const hosted = await publishLinkedHousehold(household);
  return {
    compiled,
    status: {
      ...status,
      engine: hosted?.schema ? "pglite+supabase" : status.engine,
      hosted,
    },
  };
}

export async function queryBooks(sql: string, environment: Environment = "development"): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const safe = assertReadOnlySelect(sql);
  const db = await getBrowserBooks(environment);
  const result = await db.query<Record<string, unknown>>(safe);
  const rows = result.rows.slice(0, 500);
  const columns = result.fields?.map((field) => field.name) ?? (rows[0] ? Object.keys(rows[0]) : []);
  return { columns, rows };
}

export async function sqlTrialBalance(householdId: string, environment: Environment = "development") {
  const db = await getBrowserBooks(environment);
  return db.query(
    `SELECT code, name, account_type, debit_cents, credit_cents, net_cents
     FROM v_trial_balance
     WHERE household_id = $1 AND (debit_cents <> 0 OR credit_cents <> 0 OR account_type IN ('asset', 'liability'))
     ORDER BY code`,
    [householdId],
  );
}
