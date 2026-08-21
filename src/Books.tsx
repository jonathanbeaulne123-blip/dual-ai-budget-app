import { useMemo, useState } from "react";
import {
  accountRegister,
  booksEquation,
  compileHousehold,
  formatCad,
  trialBalance,
  type Household,
  type LedgerView,
  type UndoToken,
} from "./core/index.ts";
import { LedgerPage } from "./Ledger.tsx";
import { booksFilename, booksJournalCsv, booksSqlDump, downloadText } from "./ledger/export.ts";
import { queryBooks, type BooksStatus } from "./ledger/engine.ts";

const PANES = [
  { id: "register", label: "Register" },
  { id: "journal", label: "Journal" },
  { id: "trial", label: "Trial balance" },
  { id: "accounts", label: "Accounts" },
  { id: "query", label: "SQL" },
] as const;

type Pane = (typeof PANES)[number]["id"];

export function BooksPage({
  household,
  memberId,
  view,
  booksStatus,
  onChange,
  onRemove,
}: {
  household: Household;
  memberId: string;
  view: LedgerView;
  booksStatus: BooksStatus | null;
  onChange: (household: Household, undo?: UndoToken) => void;
  onRemove: (transaction: Household["transactions"][number]) => void;
}) {
  const [pane, setPane] = useState<Pane>("register");
  const books = useMemo(() => compileHousehold(household), [household]);
  const trial = useMemo(() => trialBalance(books, { recognizedOnly: true }), [books]);
  const equation = useMemo(() => booksEquation(books), [books]);
  const [accountId, setAccountId] = useState(household.accounts[0]?.id ?? books.chart[0]?.id ?? "");
  const register = useMemo(() => accountRegister(books, accountId), [books, accountId]);

  return (
    <>
      <section className="hero">
        <div className="label">Books · double-entry · CAD</div>
        <div className={`money ${equation.netWorthCents < 0 ? "negative" : ""}`}>{formatCad(equation.netWorthCents)}</div>
        <div className="sub">
          Net worth {equation.holds ? "equals" : "does not equal"} retained income {formatCad(equation.netIncomeCents)}
          {trial.inBalance ? " · trial balance in balance" : " · trial balance is off"}
        </div>
      </section>
      <div className="grid">
        <div className="stat"><span>Assets</span><strong>{formatCad(equation.assetCents)}</strong></div>
        <div className="stat"><span>Liabilities</span><strong>{formatCad(equation.liabilityCents)}</strong></div>
        <div className="stat"><span>Income</span><strong>{formatCad(equation.incomeCents)}</strong></div>
        <div className="stat"><span>Expenses</span><strong>{formatCad(equation.expenseCents)}</strong></div>
      </div>
      {booksStatus && (
        <p className={`muted ${booksStatus.ok ? "" : "danger"}`}>
          {booksStatus.ok
            ? `Postgres ${booksStatus.postgresVersion ?? "PGlite"} is holding ${booksStatus.entryCount} journal entries.`
            : booksStatus.error || "The SQL books did not verify. The snapshot on this phone is still saved."}
        </p>
      )}
      {booksStatus?.hosted && (
        <p className="muted">
          {booksStatus.hosted.schema
            ? `Shared books are on Supabase (${booksStatus.hosted.project}).`
            : booksStatus.hosted.error || "Supabase is configured but the books tables are not created yet."}
        </p>
      )}
      <div className="tabs">
        {PANES.map((item) => (
          <button key={item.id} className={pane === item.id ? "active" : ""} onClick={() => setPane(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {pane === "register" && (
        <LedgerPage household={household} memberId={memberId} view={view} onChange={onChange} onRemove={onRemove} />
      )}
      {pane === "journal" && (
        <section className="card">
          <header>
            <h2>General journal</h2>
            <span className="muted">{books.entries.length} entries</span>
          </header>
          <div className="books-scroll">
            <table className="books-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                </tr>
              </thead>
              <tbody>
                {books.entries.map((entry) => {
                  const chart = new Map(books.chart.map((account) => [account.id, account]));
                  return (
                    <JournalBlock
                      key={entry.id}
                      date={entry.date}
                      memo={entry.memo}
                      recognized={entry.recognized}
                      lines={entry.lines.map((line) => ({
                        id: line.id,
                        name: `${chart.get(line.accountId)?.code ?? ""} ${chart.get(line.accountId)?.name ?? line.accountId}`,
                        debitCents: line.debitCents,
                        creditCents: line.creditCents,
                      }))}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {pane === "trial" && (
        <section className="card">
          <header>
            <h2>Trial balance</h2>
            <span className={`pill ${trial.inBalance ? "good" : "warn"}`}>{trial.inBalance ? "In balance" : "Off"}</span>
          </header>
          <div className="books-scroll">
            <table className="books-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                </tr>
              </thead>
              <tbody>
                {trial.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td className="muted">{row.accountType}</td>
                    <td className="num">{row.displayDebitCents ? formatCad(row.displayDebitCents) : ""}</td>
                    <td className="num">{row.displayCreditCents ? formatCad(row.displayCreditCents) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td>Total</td>
                  <td />
                  <td className="num">{formatCad(trial.totalDebitCents)}</td>
                  <td className="num">{formatCad(trial.totalCreditCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
      {pane === "accounts" && (
        <section className="card">
          <header><h2>Account register</h2></header>
          <label>Account</label>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {books.chart.filter((account) => account.source === "bank" || account.source === "category").map((account) => (
              <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
            ))}
          </select>
          <div className="books-scroll">
            <table className="books-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Memo</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {register.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No postings yet.</td></tr>
                ) : register.map((row) => (
                  <tr key={`${row.entryId}-${row.date}-${row.runningCents}-${row.debitCents}-${row.creditCents}`}>
                    <td>{row.date}</td>
                    <td>{row.memo}</td>
                    <td className="num">{row.debitCents ? formatCad(row.debitCents) : ""}</td>
                    <td className="num">{row.creditCents ? formatCad(row.creditCents) : ""}</td>
                    <td className="num">{formatCad(row.runningCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {pane === "query" && <SqlConsole />}
      <div className="chips" style={{ marginTop: 8 }}>
        <button className="chip" onClick={() => downloadText(booksFilename(books, "sql"), booksSqlDump(books), "application/sql")}>
          Download SQL
        </button>
        <button className="chip" onClick={() => downloadText(booksFilename(books, "csv"), booksJournalCsv(books, trial), "text/csv")}>
          Download journal CSV
        </button>
      </div>
    </>
  );
}

function JournalBlock({
  date,
  memo,
  recognized,
  lines,
}: {
  date: string;
  memo: string;
  recognized: boolean;
  lines: { id: string; name: string; debitCents: number; creditCents: number }[];
}) {
  return (
    <>
      <tr className="journal-head">
        <td>{date}</td>
        <td colSpan={3}>
          {memo}
          {recognized ? "" : " · excluded"}
        </td>
      </tr>
      {lines.map((line) => (
        <tr key={line.id}>
          <td />
          <td>{line.name}</td>
          <td className="num">{line.debitCents ? formatCad(line.debitCents) : ""}</td>
          <td className="num">{line.creditCents ? formatCad(line.creditCents) : ""}</td>
        </tr>
      ))}
    </>
  );
}

function SqlConsole() {
  const [sql, setSql] = useState("SELECT code, name, account_type, debit_cents, credit_cents FROM v_trial_balance ORDER BY code;");
  const [error, setError] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const result = await queryBooks(sql);
      setColumns(result.columns);
      setRows(result.rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setColumns([]);
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <header>
        <h2>Read-only SQL</h2>
        <span className="muted">SELECT against this phone’s Postgres</span>
      </header>
      <p className="muted">
        Try <code>SELECT * FROM v_journal LIMIT 20</code>, <code>v_income_statement</code>, <code>v_net_worth</code>, or <code>v_unbalanced_entries</code>.
      </p>
      <textarea className="sql-input" value={sql} onChange={(event) => setSql(event.target.value)} rows={5} spellCheck={false} />
      {error && <p className="danger">{error}</p>}
      <button className="primary" disabled={busy} onClick={() => void run()}>Run query</button>
      {columns.length > 0 && (
        <div className="books-scroll">
          <table className="books-table">
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
