import type { PGlite } from "@electric-sql/pglite";
import {
  booksEquation,
  compileHousehold,
  trialBalance,
  type CompiledBooks,
} from "../core/journal.ts";
import type { Household, Environment } from "../core/types.ts";
import { assertReadOnlySelect } from "./queryGuard.ts";
import { BOOKS_SCHEMA, BOOKS_SCHEMA_VERSION } from "./schema.ts";
import { pushSupabaseHousehold, probeSupabase } from "./supabase.ts";

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
  const applied = await db.query<{ id: number }>("SELECT id FROM schema_migrations WHERE id = $1", [BOOKS_SCHEMA_VERSION]);
  if (applied.rows.length === 0) {
    await db.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [BOOKS_SCHEMA_VERSION, new Date().toISOString()]);
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
    })),
    goals: byId(household.goals).map((goal) => ({
      id: goal.id,
      targetCents: goal.targetCents,
      savedCents: goal.savedCents,
    })),
    goalContributions: byId(household.goalContributions ?? []).map((row) => ({
      id: row.id,
      goalId: row.goalId,
      memberId: row.memberId,
      amountCents: row.amountCents,
      date: row.date,
    })),
    accounts: byId(household.accounts).map((account) => ({
      id: account.id,
      name: account.name,
      kind: account.kind,
      active: account.active,
    })),
  };
}

export async function hashBooksSnapshot(household: Household): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(booksIntegrityFacts(household)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hostedFailureStatus(
  error: unknown,
  probe: { reachable: boolean; project?: string },
): NonNullable<BooksStatus["hosted"]> {
  return {
    provider: "supabase",
    reachable: probe.reachable,
    schema: false,
    project: probe.project,
    error: error instanceof Error ? error.message : String(error),
  };
}

export async function ingestBooks(db: PGlite, household: Household, compiled = compileHousehold(household)): Promise<BooksStatus> {
  return db.transaction((tx) => writeBooks(tx, household, compiled));
}

async function writeBooks(db: Queryable, household: Household, compiled: CompiledBooks): Promise<BooksStatus> {
  const equation = booksEquation(compiled);
  const tb = trialBalance(compiled, { recognizedOnly: true });
  await db.query("DELETE FROM households WHERE id = $1", [household.householdId]);
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
  const version = await db.query<{ v: string }>("SELECT current_setting('server_version') AS v");
  const sqlEquation = await db.query<{
    net_worth_cents: number;
    net_income_cents: number;
  }>("SELECT net_worth_cents, net_income_cents FROM v_net_worth WHERE household_id = $1", [compiled.householdId]);
  const row = sqlEquation.rows[0];
  const sqlHolds = row
    ? Number(row.net_worth_cents) === Number(row.net_income_cents)
    : equation.holds;

  await db.query(
    `INSERT INTO audit_revisions (id, household_id, revision, at, snapshot_hash, entry_count, debit_cents, credit_cents, in_balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      `REV-${compiled.householdId}-${compiled.revision}-${Date.now()}`,
      compiled.householdId,
      compiled.revision,
      new Date().toISOString(),
      await hashBooksSnapshot(household),
      compiled.entries.length,
      tb.totalDebitCents,
      tb.totalCreditCents,
      unbalanced.rows.length === 0 && tb.inBalance,
    ],
  );

  return {
    ok: unbalanced.rows.length === 0 && tb.inBalance && equation.holds && sqlHolds,
    engine: "pglite",
    postgresVersion: version.rows[0]?.v,
    entryCount: compiled.entries.length,
    inBalance: unbalanced.rows.length === 0 && tb.inBalance,
    equationHolds: equation.holds && sqlHolds,
  };
}

export async function syncHouseholdBooks(household: Household): Promise<{ compiled: CompiledBooks; status: BooksStatus }> {
  const compiled = compileHousehold(household);
  const db = await getBrowserBooks(household.environment);
  const status = await ingestBooks(db, household, compiled);
  try {
    const hosted = await pushSupabaseHousehold({ ...household, linked: true });
    return {
      compiled,
      status: {
        ...status,
        engine: hosted.schema ? "pglite+supabase" : status.engine,
        hosted: {
          provider: "supabase",
          reachable: hosted.reachable,
          schema: hosted.schema,
          project: hosted.project,
          error: hosted.error,
        },
      },
    };
  } catch (caught) {
    const hosted = await probeSupabase();
    return {
      compiled,
      status: {
        ...status,
        hosted: hostedFailureStatus(caught, hosted),
      },
    };
  }
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
