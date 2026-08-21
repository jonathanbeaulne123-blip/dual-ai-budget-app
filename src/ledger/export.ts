import type { CompiledBooks, TrialBalance } from "../core/journal.ts";
import { BOOKS_SCHEMA } from "./schema.ts";

function sqlLiteral(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${value.replace(/'/g, "''")}'`;
}

export function booksSqlDump(books: CompiledBooks): string {
  const lines = [
    "-- Hearth books dump. PostgreSQL 14+.",
    "BEGIN;",
    BOOKS_SCHEMA.trim(),
    `INSERT INTO households (id, name, timezone, currency, environment, invite_phrase, linked, revision, last_committed_at) VALUES (${[
      books.householdId,
      books.name,
      books.timezone,
      books.currency,
      books.environment,
      books.invitePhrase,
      books.linked,
      books.revision,
      books.lastCommittedAt,
    ].map(sqlLiteral).join(", ")});`,
  ];
  for (const member of books.members) {
    lines.push(`INSERT INTO members (id, household_id, name, color, active) VALUES (${[member.id, books.householdId, member.name, member.color, member.active].map(sqlLiteral).join(", ")});`);
  }
  for (const category of books.categories) {
    lines.push(`INSERT INTO categories (id, household_id, parent_id, record_type, name, transaction_type, essential, income_stability, active, sort_order) VALUES (${[category.id, books.householdId, category.parentId, category.recordType, category.name, category.transactionType, category.essential, category.incomeStability, category.active, category.sortOrder].map(sqlLiteral).join(", ")});`);
  }
  for (const account of books.chart) {
    lines.push(`INSERT INTO chart_accounts (id, household_id, code, name, account_type, normal_balance, source, bank_account_id, category_id, owner_member_id, active) VALUES (${[account.id, books.householdId, account.code, account.name, account.accountType, account.normalBalance, account.source, account.bankAccountId ?? null, account.categoryId ?? null, account.ownerMemberId ?? null, account.active].map(sqlLiteral).join(", ")});`);
  }
  for (const entry of books.entries) {
    lines.push(`INSERT INTO journal_entries (id, household_id, date_key, memo, place, source, source_id, visibility, created_by, recognized, duplicate_key, origin_ids) VALUES (${[entry.id, books.householdId, entry.date, entry.memo, entry.place, entry.source, entry.sourceId ?? null, entry.visibility, entry.createdBy, entry.recognized, entry.duplicateKey, JSON.stringify(entry.originTransactionIds)].map(sqlLiteral).join(", ")});`);
    for (const line of entry.lines) {
      lines.push(`INSERT INTO journal_lines (id, household_id, entry_id, line_no, account_id, debit_cents, credit_cents, party_id, note) VALUES (${[line.id, books.householdId, entry.id, line.lineNo, line.accountId, line.debitCents, line.creditCents, line.partyId, line.note].map(sqlLiteral).join(", ")});`);
    }
  }
  lines.push("COMMIT;", "");
  return lines.join("\n");
}

export function booksJournalCsv(books: CompiledBooks, trial?: TrialBalance): string {
  const header = "date,entry_id,memo,account_code,account_name,debit,credit,party,recognized,visibility";
  const chart = new Map(books.chart.map((account) => [account.id, account]));
  const rows = [header];
  for (const entry of books.entries) {
    for (const line of entry.lines) {
      const account = chart.get(line.accountId);
      rows.push([
        entry.date,
        entry.id,
        csv(entry.memo),
        account?.code ?? "",
        csv(account?.name ?? line.accountId),
        line.debitCents ? (line.debitCents / 100).toFixed(2) : "",
        line.creditCents ? (line.creditCents / 100).toFixed(2) : "",
        line.partyId,
        entry.recognized ? "yes" : "no",
        entry.visibility,
      ].join(","));
    }
  }
  if (trial) {
    rows.push("");
    rows.push("trial_balance_account,code,debit,credit");
    for (const row of trial.rows) {
      rows.push([csv(row.name), row.code, (row.displayDebitCents / 100).toFixed(2), (row.displayCreditCents / 100).toFixed(2)].join(","));
    }
    rows.push(["TOTAL", "", (trial.totalDebitCents / 100).toFixed(2), (trial.totalCreditCents / 100).toFixed(2)].join(","));
  }
  return rows.join("\n");
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadText(filename: string, text: string, type = "text/plain"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function booksFilename(books: CompiledBooks, ext: string): string {
  const day = books.lastCommittedAt?.slice(0, 10) ?? "books";
  return `hearth-books-${books.environment}-${day}.${ext}`;
}
