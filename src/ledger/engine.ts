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

export type HostedBooksMode = "local" | "opted-in" | "published" | "failed";

export type BooksStatus = {
  ok: boolean;
  engine: "pglite" | "pglite+supabase";
  postgresVersion?: string;
  entryCount: number;
  inBalance: boolean;
  equationHolds: boolean;
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

let browserDbs = new Map<string, PGlite>();

export function booksIdbName(environment: Environment): string {
  return `idb://hearth-books-${environment}`;
}

async function migrate(db: Queryable): Promise<void> {
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
  }
}

export async function openMemoryBooks(): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create();
  await migrate(db);
  return db;
}

export async function getBrowserBooks(environment: Environment = "development"): Promise<PGlite> {
  const existing = browserDbs.get(environment);
  if (existing) return existing;
  const { PGlite } = await import("@electric-sql/pglite");
  const persist = typeof indexedDB !== "undefined";
  const db = persist ? await PGlite.create(booksIdbName(environment)) : await PGlite.create();
  await migrate(db);
  browserDbs.set(environment, db);
  return db;
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
      transactionIds: [...(shift.transactionIds ?? [])].sort(),
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

export async function ingestBooks(db: PGlite, household: Household, compiled = compileHousehold(household)): Promise<BooksStatus> {
  return db.transaction((tx) => writeBooks(tx, household, compiled));
}

export async function resetBrowserBooksForTests(): Promise<void> {
  for (const db of browserDbs.values()) {
    try {
      await db.close();
    } catch {
      /* test isolation */
    }
  }
  browserDbs = new Map();
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

export async function inspectBrowserBooks(household: Household): Promise<{
  ok: boolean;
  issue?: BooksRecoveryIssue;
  message: string;
  entryCount: number;
}> {
  try {
    const db = await getBrowserBooks(household.environment);
    const version = await db.query<{ id: number }>("SELECT id FROM schema_migrations ORDER BY id");
    if (version.rows.length === 0) {
      return {
        ok: false,
        issue: "missing-schema",
        message: "PGlite opened without a books schema. The JSON household was left alone.",
        entryCount: 0,
      };
    }
    if (!version.rows.some((row) => row.id === BOOKS_SCHEMA_VERSION)) {
      return {
        ok: false,
        issue: "incomplete-migration",
        message: "PGlite is missing a books migration. The household was not reset.",
        entryCount: 0,
      };
    }
    const compiled = compileHousehold(household);
    const existing = await db.query<{ id: string }>("SELECT id FROM households WHERE id = $1", [household.householdId]);
    const entries = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM journal_entries WHERE household_id = $1",
      [household.householdId],
    );
    const entryCount = Number(entries.rows[0]?.n ?? 0);
    if (existing.rows.length === 0 && compiled.entries.length > 0) {
      return {
        ok: false,
        issue: "interrupted-transaction",
        message: "The snapshot has journal facts that PGlite does not. Nothing was discarded.",
        entryCount,
      };
    }
    const acceptedRevision = await db.query<{ snapshot_hash: string }>(
      `SELECT snapshot_hash
       FROM audit_revisions
       WHERE household_id = $1 AND revision = $2
       ORDER BY at DESC
       LIMIT 1`,
      [household.householdId, household.revision],
    );
    if (existing.rows.length > 0 && acceptedRevision.rows.length === 0) {
      return {
        ok: false,
        issue: "interrupted-transaction",
        message: "PGlite has no acceptance receipt for this snapshot revision. Nothing was discarded.",
        entryCount,
      };
    }
    const unbalanced = await db.query<{ entry_id: string }>(
      "SELECT entry_id FROM v_unbalanced_entries WHERE household_id = $1",
      [household.householdId],
    );
    if (unbalanced.rows.length) {
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
    const acceptedHash = acceptedRevision.rows[0]?.snapshot_hash;
    if (acceptedHash && acceptedHash !== (await hashBooksSnapshot(household))) {
      return {
        ok: false,
        issue: "projection-mismatch",
        message: "The snapshot and the accepted PGlite journal contain different financial facts. Recovery is available.",
        entryCount,
      };
    }
    return { ok: true, message: "PGlite agrees with the household snapshot.", entryCount };
  } catch (caught) {
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

async function writeBooks(db: Queryable, household: Household, compiled: CompiledBooks): Promise<BooksStatus> {
  const { equation, tb } = assertBalanced(compiled, household);
  // One PGlite database represents the active ledger for an environment. Hearth
  // catalog/member/account ids are household-local (for example MEM-001), while
  // the SQL schema uses simple primary keys. Clear the previously active books
  // before compiling another replica so switching households cannot collide.
  // The durable inactive replicas remain in src/storage.ts and are re-ingested
  // through this same transaction when selected.
  // PGlite's IndexedDB filesystem persists a PostgreSQL relation as one
  // serialized browser value. DELETE leaves the previous full-snapshot pages
  // in that relation, so switching away from a large ledger can make the next
  // flush exceed Chromium's 127 MiB value ceiling even when the new household
  // is empty. This projection is rebuilt in full and TRUNCATE is transactional
  // in PostgreSQL, so CASCADE releases the old relation files without weakening
  // rollback or touching the durable JSON/cloud household replicas.
  // audit_revisions intentionally has no household FK, so include it explicitly;
  // otherwise an A -> B -> A switch collides with A's prior revision id.
  await db.query("TRUNCATE TABLE audit_revisions, households CASCADE");
  await db.query(
    `INSERT INTO households (id, name, timezone, currency, environment, invite_phrase, linked, revision, last_committed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      compiled.householdId,
      compiled.name,
      compiled.timezone,
      compiled.currency,
      compiled.environment,
      compiled.invitePhrase,
      compiled.linked,
      compiled.revision,
      compiled.lastCommittedAt,
    ],
  );
  for (const member of compiled.members) {
    await db.query(
      "INSERT INTO members (id, household_id, name, color, active) VALUES ($1,$2,$3,$4,$5)",
      [member.id, compiled.householdId, member.name, member.color, member.active],
    );
  }
  for (const category of compiled.categories) {
    await db.query(
      `INSERT INTO categories (id, household_id, parent_id, record_type, name, transaction_type, essential, income_stability, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [category.id, compiled.householdId, category.parentId, category.recordType, category.name, category.transactionType, category.essential, category.incomeStability, category.active, category.sortOrder],
    );
  }
  for (const account of compiled.chart) {
    await db.query(
      `INSERT INTO chart_accounts (id, household_id, code, name, account_type, normal_balance, source, bank_account_id, category_id, owner_member_id, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [account.id, compiled.householdId, account.code, account.name, account.accountType, account.normalBalance, account.source, account.bankAccountId ?? null, account.categoryId ?? null, account.ownerMemberId ?? null, account.active],
    );
  }
  for (const entry of compiled.entries) {
    await db.query(
      `INSERT INTO journal_entries (id, household_id, date_key, memo, place, source, source_id, visibility, created_by, recognized, duplicate_key, origin_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [entry.id, compiled.householdId, entry.date, entry.memo, entry.place, entry.source, entry.sourceId ?? null, entry.visibility, entry.createdBy, entry.recognized, entry.duplicateKey, JSON.stringify(entry.originTransactionIds)],
    );
    for (const line of entry.lines) {
      await db.query(
        `INSERT INTO journal_lines (id, household_id, entry_id, line_no, account_id, debit_cents, credit_cents, party_id, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [line.id, compiled.householdId, entry.id, line.lineNo, line.accountId, line.debitCents, line.creditCents, line.partyId, line.note],
      );
    }
  }
  for (const tx of household.transactions) {
    await db.query(
      `INSERT INTO source_transactions (id, household_id, date_key, type, amount_cents, account_id, subcategory_id, note, place, visibility, created_by, is_duplicate, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [tx.id, compiled.householdId, tx.date, tx.type, tx.amountCents, tx.accountId, tx.subcategoryId, tx.note, tx.place, tx.visibility, tx.createdBy, tx.isDuplicate, JSON.stringify(tx)],
    );
  }
  for (const shift of compiled.shifts) {
    await db.query(
      `INSERT INTO shifts (id, household_id, date_key, member_id, account_id, sales_cents, cash_tips_cents, cc_tips_cents, hours, net_tips_cents, wages_cents, visibility, created_by, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [shift.id, compiled.householdId, shift.date, shift.memberId, shift.accountId, shift.salesCents, shift.cashTipsCents, shift.ccTipsCents, shift.hours, shift.netTipsCents, shift.wagesCents, shift.visibility, shift.createdBy, JSON.stringify(shift)],
    );
  }
  for (const goal of compiled.goals) {
    await db.query(
      `INSERT INTO goals (id, household_id, name, target_cents, saved_cents, deadline, shared, owner_member_id, subcategory_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [goal.id, compiled.householdId, goal.name, goal.targetCents, goal.savedCents, goal.deadline, goal.shared, goal.ownerMemberId, goal.subcategoryId],
    );
  }
  for (const plan of compiled.budgetPlans) {
    await db.query(
      `INSERT INTO budget_plans (id, household_id, month_key, subcategory_id, amount_cents, essential, income_stability, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [plan.id, compiled.householdId, plan.monthKey, plan.subcategoryId, plan.amountCents, plan.essential, plan.incomeStability, plan.active],
    );
  }
  for (const recurrence of compiled.recurrences) {
    await db.query(
      `INSERT INTO recurrences (id, household_id, cadence, next_date, type, amount_cents, account_id, subcategory_id, note, active, auto_post)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [recurrence.id, compiled.householdId, recurrence.cadence, recurrence.nextDate, recurrence.type, recurrence.amountCents, recurrence.accountId, recurrence.subcategoryId, recurrence.note, recurrence.active, recurrence.autoPost],
    );
  }
  for (const item of compiled.activity) {
    await db.query(
      "INSERT INTO activity (id, household_id, at, action, summary) VALUES ($1,$2,$3,$4,$5)",
      [item.id, compiled.householdId, item.at, item.action, item.summary],
    );
  }

  await db.query(
    `INSERT INTO household_snapshots (household_id, invite_phrase, environment, payload, updated_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [compiled.householdId, compiled.invitePhrase, compiled.environment, JSON.stringify(household), new Date().toISOString()],
  );

  const unbalanced = await db.query<{ entry_id: string }>("SELECT entry_id FROM v_unbalanced_entries WHERE household_id = $1", [compiled.householdId]);
  if (unbalanced.rows.length) {
    throw new UnbalancedBooksError("PGlite rejected an unbalanced journal. Nothing was posted.");
  }
  const version = await db.query<{ v: string }>("SELECT current_setting('server_version') AS v");
  const sqlEquation = await db.query<{
    net_worth_cents: number;
    net_income_cents: number;
  }>("SELECT net_worth_cents, net_income_cents FROM v_net_worth WHERE household_id = $1", [compiled.householdId]);
  const row = sqlEquation.rows[0];
  const sqlHolds = row
    ? Number(row.net_worth_cents) === Number(row.net_income_cents)
    : equation.holds;
  if (!tb.inBalance || !equation.holds || !sqlHolds) {
    throw new UnbalancedBooksError("The accounting equation does not hold after ingest. Nothing was posted.");
  }

  await db.query(
    `INSERT INTO audit_revisions (id, household_id, revision, at, snapshot_hash, entry_count, debit_cents, credit_cents, in_balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      `REV-${compiled.householdId}-${compiled.revision}-${compiled.lastCommittedAt ?? "open"}`,
      compiled.householdId,
      compiled.revision,
      compiled.lastCommittedAt ?? new Date().toISOString(),
      await hashBooksSnapshot(household),
      compiled.entries.length,
      tb.totalDebitCents,
      tb.totalCreditCents,
      true,
    ],
  );

  return {
    ok: true,
    engine: "pglite",
    postgresVersion: version.rows[0]?.v,
    entryCount: compiled.entries.length,
    inBalance: true,
    equationHolds: true,
  };
}

/** Local books only. Never calls hosted REST. */
export async function ingestHouseholdBooks(household: Household): Promise<{ compiled: CompiledBooks; status: BooksStatus }> {
  const compiled = compileHousehold(household);
  const db = await getBrowserBooks(household.environment);
  const status = await ingestBooks(db, household, compiled);
  return { compiled, status };
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
