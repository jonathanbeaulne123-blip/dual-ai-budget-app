import { useEffect, useMemo, useState } from "react";
import {
  ASK_SUGGESTIONS,
  accountOptionLabel,
  accountRegister,
  agedPayables,
  askHercules,
  auditOpinion,
  balanceSheet,
  booksEquation,
  budgetVariance,
  cashFlowStatement,
  closeBooksMonth,
  closePackageText,
  closedMonthKeys,
  comparativeIncome,
  compileHousehold,
  formatCad,
  householdWallet,
  herculesLedgerSourcePane,
  incomeStatement,
  liquidityWatch,
  likelyMiscoded,
  categoryName,
  monthKeyFromDateKey,
  notesToFinancialStatements,
  recordReconciliation,
  reopenBooksMonth,
  setBudget,
  shiftMonthKey,
  sitDownExportText,
  statementOfChangesInEquity,
  todayKey,
  trialBalance,
  type Household,
  type LedgerView,
  type UndoToken,
  type Account,
  type HerculesNumberSource,
} from "./core/index.ts";
import { LedgerPage } from "./Ledger.tsx";
import { PaneSeals, PaperTile, StoryStrip } from "./theme/PaperTheme.tsx";
import { BatchImportCard } from "./BatchImport.tsx";
import { WalletPane } from "./Accounts.tsx";
import { booksFilename, booksJournalCsv, booksSqlDump, downloadText } from "./ledger/export.ts";
import { queryBooks, type BooksStatus } from "./ledger/engine.ts";
import { assertReadOnlySelect } from "./ledger/queryGuard.ts";

const PANES = [
  { id: "wallet", label: "Wallet", blurb: "Net worth story: chequing → Goals savings → cards → investments. Touch a tile to open the room." },
  { id: "register", label: "All activity", blurb: "Every posted row you can see in this view. Duplicate contrast lives here." },
  { id: "import", label: "Import", blurb: "QFX/OFX and selected document photos enter an inbox. Duplicate review and one final Confirm protect the books." },
  { id: "journal", label: "Journal", blurb: "Debit and credit lines compiled from the snapshot. The books engine." },
  { id: "trial", label: "Trial balance", blurb: "Account totals that must balance. Health refuses a lie." },
  { id: "statements", label: "Statements", blurb: "Balance sheet, P&L, cash flow, equity, working capital, notes." },
  { id: "rec", label: "Reconcile", blurb: "Tie a statement figure to the books. Never posts money by itself." },
  { id: "close", label: "Close pack", blurb: "Hard month lock. Reopen is explicit. Groceries in the open month still posts." },
  { id: "accounts", label: "Chart", blurb: "Every account on the chart of accounts." },
  { id: "query", label: "Ask", blurb: "Read-only SQL and Ask the books. Hercules answers from the journal." },
] as const;

type Pane = (typeof PANES)[number]["id"];

export function BooksPage({
  household,
  memberId,
  view,
  booksStatus,
  focusedAccountId,
  sourceFocus,
  onFocusAccount,
  onClearSource,
  onChange,
  onRemove,
  onPayAccount,
  onAddToAccount,
}: {
  household: Household;
  memberId: string;
  view: LedgerView;
  booksStatus: BooksStatus | null;
  focusedAccountId: string | null;
  sourceFocus: HerculesNumberSource | null;
  onFocusAccount: (accountId: string | null) => void;
  onClearSource: () => void;
  onChange: (household: Household, undo?: UndoToken) => unknown | Promise<unknown>;
  onRemove: (transaction: Household["transactions"][number]) => void;
  onPayAccount: (account: Account) => void;
  onAddToAccount: (account: Account) => void;
}) {
  const [pane, setPane] = useState<Pane>("wallet");
  const books = useMemo(() => compileHousehold(household), [household]);
  const trial = useMemo(() => trialBalance(books, { recognizedOnly: true }), [books]);
  const equation = useMemo(() => booksEquation(books), [books]);
  const opinion = useMemo(() => auditOpinion(household), [household]);
  const wallet = useMemo(() => householdWallet(household, todayKey()), [household]);
  const today = todayKey();
  const monthKey = monthKeyFromDateKey(today);
  const packMonth = closedMonthKeys(household).at(-1) ?? monthKey;
  const [accountId, setAccountId] = useState(focusedAccountId ?? household.accounts[0]?.id ?? books.chart[0]?.id ?? "");
  const register = useMemo(() => accountRegister(books, accountId), [books, accountId]);
  const [recDate, setRecDate] = useState(today);
  const [recAmount, setRecAmount] = useState("");
  const [recError, setRecError] = useState("");
  const [closeError, setCloseError] = useState("");

  useEffect(() => {
    if (!focusedAccountId) return;
    setAccountId(focusedAccountId);
    setPane("wallet");
  }, [focusedAccountId]);

  useEffect(() => {
    if (sourceFocus?.route !== "ledger") return;
    if (herculesLedgerSourcePane(sourceFocus) === "register") {
      setPane("register");
      return;
    }
    if (sourceFocus.accountId) {
      setAccountId(sourceFocus.accountId);
    }
    setPane("wallet");
  }, [sourceFocus]);

  return (
    <div className="books-theme-c">
      <section className="hero">
        <div className="label">Books · double-entry · CAD · {household.timezone}</div>
        <div className={`money ${equation.netWorthCents < 0 ? "negative" : ""}`}>{formatCad(equation.netWorthCents)}</div>
        <div className="sub">
          Net worth {equation.holds ? "equals" : "does not equal"} opening equity {formatCad(equation.openingEquityCents)} plus retained income {formatCad(equation.netIncomeCents)}
          {trial.inBalance ? " · trial balance in balance" : " · trial balance is off"}
        </div>
        <p className={`opinion-banner ${opinion.kind}`}>
          Hercules’s opinion: <strong>{opinion.kind}</strong> — {opinion.hercules}
        </p>
      </section>
      <StoryStrip heading="Story">
        <PaperTile
          kind="Books"
          name="Net worth"
          value={
            <strong className={equation.netWorthCents < 0 ? "negative" : ""}>
              {formatCad(equation.netWorthCents)}
            </strong>
          }
          onClick={() => setPane("wallet")}
          ariaLabel={`Net worth ${formatCad(equation.netWorthCents)}`}
        />
        {wallet.story.map((group) => (
          <PaperTile
            key={group.kind}
            kind="Books"
            name={group.kind === "savings" ? "Goal savings" : group.label}
            value={formatCad(group.tiles.reduce((sum, tile) => sum + tile.displayCents, 0))}
            onClick={() => {
              setPane("wallet");
              const first = group.tiles[0]?.account.id;
              if (first) {
                setAccountId(first);
                onFocusAccount(first);
              }
            }}
            ariaLabel={`${group.label} ${formatCad(group.tiles.reduce((sum, tile) => sum + tile.displayCents, 0))}`}
          />
        ))}
      </StoryStrip>
      <div className="grid">
        <div className="stat"><span>Assets</span><strong>{formatCad(equation.assetCents)}</strong></div>
        <div className="stat"><span>Liabilities</span><strong>{formatCad(equation.liabilityCents)}</strong></div>
        <div className="stat"><span>Income</span><strong>{formatCad(equation.incomeCents)}</strong></div>
        <div className="stat"><span>Expenses</span><strong>{formatCad(equation.expenseCents)}</strong></div>
      </div>
      {booksStatus && (
        <p className={`muted ${booksStatus.ok ? "" : "danger"}`}>
          {booksStatus.ok
            ? `Postgres ${booksStatus.postgresVersion ?? "PGlite"} is holding ${booksStatus.entryCount} journal entries on this phone.`
            : booksStatus.error || "The SQL books did not verify. The last valid snapshot on this phone is still saved."}
        </p>
      )}
      {household.linked ? (
        booksStatus?.hosted ? (
          <p className="muted">
            {booksStatus.hosted.schema
              ? `The shared snapshot is on Supabase (${booksStatus.hosted.project}). Phrase join is not encryption.`
              : booksStatus.hosted.error || "This household is linked, but the hosted tables are not in the API yet."}
          </p>
        ) : (
          <p className="muted">This household is linked. Sharing uses the reviewed transport path after a local accept.</p>
        )
      ) : (
        <p className="muted">This household stays on this phone until a signed-in Google member shares it. A Hearth Pass does not upload.</p>
      )}
      <PaneSeals
        items={[
          { id: "wallet", label: "Wallet" },
          { id: "register", label: "Activity" },
          { id: "close", label: "Close month" },
        ]}
        active={pane}
        onPick={(id) => setPane(id as Pane)}
      />
      <div className="tabs">
        {PANES.map((item) => (
          <button key={item.id} className={pane === item.id ? "active" : ""} onClick={() => setPane(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <p className="muted books-pane-blurb">{PANES.find((item) => item.id === pane)?.blurb}</p>
      {pane === "wallet" && (
        <WalletPane
          household={household}
          today={today}
          memberId={memberId}
          focusedId={focusedAccountId}
          onFocus={(id) => {
            if (id) setAccountId(id);
            onFocusAccount(id);
          }}
          onChange={onChange}
          onPay={onPayAccount}
          onAdd={onAddToAccount}
        />
      )}
      {pane === "register" && (
        <LedgerPage
          household={household}
          memberId={memberId}
          view={view}
          sourceFocus={sourceFocus?.route === "ledger" ? sourceFocus : null}
          onClearSource={onClearSource}
          onChange={onChange}
          onRemove={onRemove}
        />
      )}
      {pane === "import" && (
        <BatchImportCard
          household={household}
          memberId={memberId}
          view={view}
          onCommit={(next, undo) => onChange(next, undo)}
        />
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
      {pane === "statements" && (
        <StatementsPane household={household} monthKey={monthKey} today={today} onChange={onChange} />
      )}
      {pane === "rec" && (
        <section className="card">
          <header>
            <h2>Bank rec</h2>
            <span className="muted">Statement vs books. Not a feed.</span>
          </header>
          <p className="muted">Ending balance from the statement. Nothing posts.</p>
          <label>Account</label>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {household.accounts.filter((account) => account.active).map((account) => (
              <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
            ))}
          </select>
          <label>Statement date</label>
          <input type="date" value={recDate} onChange={(event) => setRecDate(event.target.value)} />
          <label>Statement balance (CAD)</label>
          <input inputMode="decimal" value={recAmount} placeholder="0.00" onChange={(event) => setRecAmount(event.target.value)} />
          {recError && <p className="danger">{recError}</p>}
          <button
            className="primary"
            type="button"
            onClick={() => {
              try {
                const result = recordReconciliation(household, {
                  accountId,
                  statementDate: recDate,
                  statementAmount: recAmount,
                  createdBy: memberId,
                });
                setRecError("");
                setRecAmount("");
                onChange(result.household, result.undo);
              } catch (caught) {
                setRecError(caught instanceof Error ? caught.message : String(caught));
              }
            }}
          >
            Record rec
          </button>
          <div className="books-scroll" style={{ marginTop: 12 }}>
            <table className="books-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th className="num">Statement</th>
                  <th className="num">Books</th>
                  <th className="num">Δ</th>
                </tr>
              </thead>
              <tbody>
                {household.kitchen.books.reconciliations.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No recs yet.</td></tr>
                ) : [...household.kitchen.books.reconciliations].reverse().map((row) => (
                  <tr key={row.id}>
                    <td>{row.statementDate}</td>
                    <td>{household.accounts.find((account) => account.id === row.accountId)?.name ?? row.accountId}</td>
                    <td className="num">{formatCad(row.statementCents)}</td>
                    <td className="num">{formatCad(row.bookCents)}</td>
                    <td className="num">{row.status === "tied" ? "tied" : formatCad(row.differenceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {pane === "close" && (
        <section className="card">
          <header>
            <h2>Close package</h2>
            <span className={`pill ${opinion.kind === "unmodified" ? "good" : "warn"}`}>{opinion.kind}</span>
          </header>
          <p className="muted">{opinion.cpa}</p>
          <p className="muted">A closed month accepts no posts. Reopen if a receipt was forgotten. Reverse a row instead of deleting it. Mark paid on Calendar still Confirm-writes.</p>
          {closeError && <p className="danger">{closeError}</p>}
          <div className="chips">
            <button
              className="chip"
              type="button"
              onClick={() => {
                try {
                  const result = closeBooksMonth(household, { monthKey: shiftMonthKey(monthKey, -1), createdBy: memberId });
                  setCloseError("");
                  onChange(result.household, result.undo);
                } catch (caught) {
                  setCloseError(caught instanceof Error ? caught.message : String(caught));
                }
              }}
            >
              Close {shiftMonthKey(monthKey, -1)}
            </button>
            <button
              className="chip"
              type="button"
              onClick={() => downloadText(booksFilename(books, "txt"), closePackageText(household, packMonth, today))}
            >
              Download close pack
            </button>
          </div>
          {likelyMiscoded(household, monthKey).length > 0 && (
            <div>
              <p className="muted">Likely miscoded — guessed from merchant tokens. Confirm still recodes. Nothing auto-posts.</p>
              {likelyMiscoded(household, monthKey).map((row) => {
                const tx = household.transactions.find((item) => item.id === row.transactionId);
                if (!tx) return null;
                return (
                  <div className="row" key={row.transactionId}>
                    <span>{tx.note || tx.place} · {categoryName(household, tx.subcategoryId)}</span>
                    <span className="muted">guess {row.guessed.name}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="chips">
            <button
              className="chip"
              type="button"
              onClick={() => downloadText(`hearth-sitdown-${packMonth}.txt`, sitDownExportText(household, packMonth, today))}
            >
              Download sit-down workbook
            </button>
          </div>
          {household.kitchen.books.closedMonths.length > 0 && (
            <ul className="close-list">
              {household.kitchen.books.closedMonths.map((row) => (
                <li key={row.monthKey}>
                  <span>{row.monthKey} closed</span>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      try {
                        const result = reopenBooksMonth(household, row.monthKey);
                        setCloseError("");
                        onChange(result.household, result.undo);
                      } catch (caught) {
                        setCloseError(caught instanceof Error ? caught.message : String(caught));
                      }
                    }}
                  >
                    Reopen
                  </button>
                </li>
              ))}
            </ul>
          )}
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
      {pane === "query" && <AskBooks household={household} />}
      <div className="chips" style={{ marginTop: 8 }}>
        <button className="chip" onClick={() => downloadText(booksFilename(books, "sql"), booksSqlDump(books), "application/sql")}>
          Download SQL
        </button>
        <button className="chip" onClick={() => downloadText(booksFilename(books, "csv"), booksJournalCsv(books, trial), "text/csv")}>
          Download journal CSV
        </button>
        <button className="chip" onClick={() => downloadText(booksFilename(books, "txt"), closePackageText(household, packMonth, today))}>
          Download close pack
        </button>
      </div>
    </div>
  );
}

function StatementsPane({
  household,
  monthKey,
  today,
  onChange,
}: {
  household: Household;
  monthKey: string;
  today: string;
  onChange: (household: Household, undo?: UndoToken) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const sheet = useMemo(() => balanceSheet(household), [household]);
  const income = useMemo(() => incomeStatement(household, monthKey), [household, monthKey]);
  const cash = useMemo(() => cashFlowStatement(household, monthKey), [household, monthKey]);
  const equity = useMemo(() => statementOfChangesInEquity(household, monthKey), [household, monthKey]);
  const comparative = useMemo(() => comparativeIncome(household, monthKey), [household, monthKey]);
  const liq = useMemo(() => liquidityWatch(household, today), [household, today]);
  const notes = useMemo(() => notesToFinancialStatements(household, monthKey, today), [household, monthKey, today]);
  const variance = useMemo(() => budgetVariance(household, monthKey).slice(0, 8), [household, monthKey]);
  const aging = useMemo(() => agedPayables(household, today), [household, today]);
  const ratio = liq.workingCapital.currentRatio;

  function cancelBudgetEdit() {
    setEditId(null);
    setDraft("");
    setBudgetError("");
  }

  function saveBudgetEdit(subcategoryId: string) {
    try {
      const result = setBudget(household, { monthKey, subcategoryId, amount: draft });
      onChange(result.household, result.undo);
      cancelBudgetEdit();
    } catch (caught) {
      setBudgetError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <>
      <section className="card">
        <header>
          <h2>Balance sheet</h2>
          <span className={`pill ${sheet.holds ? "good" : "warn"}`}>{sheet.holds ? "A = L + E" : "Off"}</span>
        </header>
        <p className="muted">{sheet.asOf ? `As of ${sheet.asOf}` : "No journal yet."} Assets {formatCad(sheet.assetCents)} · liabilities {formatCad(sheet.liabilityCents)} · equity {formatCad(sheet.equityCents)}.</p>
        <StatementTable title="Assets" rows={sheet.assets} total={sheet.assetCents} />
        <StatementTable title="Liabilities" rows={sheet.liabilities} total={sheet.liabilityCents} />
        <StatementTable title="Equity" rows={sheet.equity} total={sheet.equityCents} />
      </section>
      <section className="card">
        <header>
          <h2>Changes in equity</h2>
          <span className={`pill ${equity.rolls ? "good" : "warn"}`}>{equity.rolls ? "Rolls" : "Off"}</span>
        </header>
        <p className="muted">Opening retained earnings plus this month's net should equal closing. Household equity as of last posting {formatCad(equity.householdEquityCents)}.</p>
        <div className="row"><span>Opening {monthKey}</span><span>{formatCad(equity.openingCents)}</span></div>
        <div className="row"><span>Net income</span><span>{formatCad(equity.netIncomeCents)}</span></div>
        <div className="row"><strong>Closing</strong><strong>{formatCad(equity.closingCents)}</strong></div>
      </section>
      <section className="card">
        <header>
          <h2>Income statement</h2>
          <span className="muted">{monthKey}</span>
        </header>
        <p className="muted">Net {formatCad(income.netCents)} vs budgeted {formatCad(income.budgetedNetCents)}. vs {comparative.priorKey}: net Δ {formatCad(comparative.netDeltaCents)}.</p>
        <StatementTable title="Income" rows={income.income} total={income.incomeCents} />
        <StatementTable title="Expenses" rows={income.expenses} total={income.expenseCents} />
      </section>
      <section className="card">
        <header><h2>Cash flow</h2></header>
        <p className="muted">Card spend is not cash until the Visa is paid. That payment is a transfer.</p>
        <div className="row"><span>Operating in</span><span>{formatCad(cash.operatingInCents)}</span></div>
        <div className="row"><span>Operating out</span><span>{formatCad(cash.operatingOutCents)}</span></div>
        <div className="row"><span>Card spend (non-cash)</span><span>{formatCad(cash.cardSpendCents)}</span></div>
        <div className="row"><span>Debt paydown</span><span>{formatCad(cash.debtPaydownCents)}</span></div>
        <div className="row"><span>Investing in</span><span>{formatCad(cash.investingInCents)}</span></div>
        <div className="row"><span>Investing out</span><span>{formatCad(cash.investingOutCents)}</span></div>
        <div className="row"><strong>Net cash</strong><strong>{formatCad(cash.netCashCents)}</strong></div>
      </section>
      <section className="card">
        <header>
          <h2>Working capital</h2>
          <span className={`pill ${liq.goingConcern === "comfortable" ? "good" : "warn"}`}>{liq.goingConcern}</span>
        </header>
        <p className="muted">{liq.hercules}</p>
        <div className="row"><span>Working capital</span><span>{formatCad(liq.workingCapital.workingCapitalCents)}</span></div>
        <div className="row"><span>Current ratio</span><span>{ratio == null ? "n/a" : ratio.toFixed(2)}</span></div>
        <div className="row"><span>Cash-like</span><span>{formatCad(liq.cashCents)}</span></div>
        <div className="row"><span>Bills next 30 days</span><span>{formatCad(liq.billsNext30Cents)}</span></div>
        <p className="muted">{liq.workingCapital.classified}</p>
      </section>
      <section className="card">
        <header><h2>Budget variance</h2></header>
        <p className="muted">Tap actual/budget to edit this month&apos;s plan. Actuals still come from posted rows.</p>
        {budgetError && <p className="danger" role="alert">{budgetError}</p>}
        {variance.length === 0 ? (
          <p className="muted">No budget plans or expense actuals this month yet.</p>
        ) : variance.map((row) => (
          <div className="row budget-variance-row" key={row.id}>
            <span>{row.name}{row.essential ? " · essential" : ""}</span>
            {editId === row.id ? (
              <span className="budget-edit">
                <span className="muted">{formatCad(row.actualCents)} /</span>
                <input
                  inputMode="decimal"
                  value={draft}
                  autoFocus
                  aria-label={`Budget for ${row.name} in ${monthKey}`}
                  aria-invalid={Boolean(budgetError)}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") cancelBudgetEdit();
                    if (event.key === "Enter") saveBudgetEdit(row.id);
                  }}
                />
                <button type="button" className="chip" onClick={() => saveBudgetEdit(row.id)}>
                  Save
                </button>
                <button type="button" className="chip quiet" onClick={cancelBudgetEdit}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={`ghost budget-edit-trigger ${row.varianceCents < 0 ? "over" : ""}`}
                aria-label={`Edit ${row.name} budget. Actual ${formatCad(row.actualCents)}, budget ${formatCad(row.budgetedCents)}`}
                onClick={() => {
                  setEditId(row.id);
                  setDraft(row.budgetedCents ? (row.budgetedCents / 100).toFixed(2) : "");
                  setBudgetError("");
                }}
              >
                {formatCad(row.actualCents)} / {formatCad(row.budgetedCents)}
              </button>
            )}
          </div>
        ))}
      </section>
      <section className="card">
        <header><h2>Aged bills</h2></header>
        {aging.length === 0 ? <p className="muted">No repeating bills.</p> : aging.slice(0, 12).map((row) => (
          <div className="row" key={row.id}>
            <span>{row.note} · {row.bucket}</span>
            <span>{formatCad(row.amountCents)}</span>
          </div>
        ))}
      </section>
      <section className="card">
        <header><h2>Notes to the financial statements</h2></header>
        {notes.map((note) => (
          <div className="statement-note" key={note.id}>
            <strong>{note.title}</strong>
            <p className="muted">{note.body}</p>
          </div>
        ))}
      </section>
    </>
  );
}

function StatementTable({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { id: string; code: string; name: string; cents: number }[];
  total: number;
}) {
  return (
    <div className="books-scroll">
      <table className="books-table">
        <thead>
          <tr>
            <th>{title}</th>
            <th className="num">CAD</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={2} className="muted">None</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id}>
              <td>{row.code ? `${row.code} · ${row.name}` : row.name}</td>
              <td className="num">{formatCad(row.cents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{formatCad(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
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

function looksLikeSql(text: string): boolean {
  try {
    assertReadOnlySelect(text);
    return true;
  } catch {
    return false;
  }
}

function AskBooks({ household }: { household: Household }) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [sqlRows, setSqlRows] = useState<Record<string, unknown>[]>([]);
  const [log, setLog] = useState<{ you: string; sentence: string; rows: { label: string; value: string }[]; sql?: string }[]>([]);
  const [showPower, setShowPower] = useState(false);
  const [sql, setSql] = useState("SELECT code, name, account_type, debit_cents, credit_cents FROM v_trial_balance ORDER BY code;");

  async function ask(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    setQuestion("");
    try {
      if (looksLikeSql(text)) {
        const result = await queryBooks(text, household.environment);
        setColumns(result.columns);
        setSqlRows(result.rows);
        setLog((current) => [...current, { you: text, sentence: `Ran a read-only query. ${result.rows.length} row${result.rows.length === 1 ? "" : "s"}.`, rows: [] }].slice(-8));
        return;
      }
      const answer = askHercules(household, text, todayKey());
      setLog((current) => [...current, { you: text, sentence: answer.sentence, rows: answer.rows, sql: answer.sql }].slice(-8));
      setColumns([]);
      setSqlRows([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function runPower() {
    setBusy(true);
    setError("");
    try {
      const result = await queryBooks(sql, household.environment);
      setColumns(result.columns);
      setSqlRows(result.rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setColumns([]);
      setSqlRows([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <header>
        <h2>Ask Hercules</h2>
        <span className="muted">He reads. He doesn’t write.</span>
      </header>
      <p className="muted">Or tap the cat. This pane is for longer questions and read-only SQL.</p>
      <div className="chips">
        {ASK_SUGGESTIONS.slice(0, 6).map((item) => (
          <button key={item} className="chip" type="button" disabled={busy} onClick={() => void ask(item)}>{item}</button>
        ))}
      </div>
      <label>Question</label>
      <input
        value={question}
        placeholder="How much did we spend on groceries this month?"
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void ask(question);
          }
        }}
      />
      <button className="primary" disabled={busy || !question.trim()} onClick={() => void ask(question)}>Ask</button>
      {error && <p className="danger">{error}</p>}
      <div className="ask-log">
        {log.map((item, index) => (
          <div key={`${item.you}-${index}`}>
            <div className="ask-bubble you">{item.you}</div>
            <div className="ask-bubble">
              <p style={{ margin: 0 }}>{item.sentence}</p>
              {item.rows.map((row) => (
                <div className="row" key={row.label}><span>{row.label}</span><span>{row.value}</span></div>
              ))}
              {item.sql && <p className="muted" style={{ marginBottom: 0 }}>Matching SQL: <code>{item.sql}</code></p>}
            </div>
          </div>
        ))}
      </div>
      {columns.length > 0 && (
        <div className="books-scroll">
          <table className="books-table">
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {sqlRows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button className="ghost" type="button" onClick={() => setShowPower((value) => !value)}>
        {showPower ? "Hide power SQL" : "Power SQL"}
      </button>
      {showPower && (
        <div className="power-sql">
          <p className="muted">Read-only SELECT against this phone’s Postgres. Writes are refused.</p>
          <textarea className="sql-input" value={sql} onChange={(event) => setSql(event.target.value)} rows={5} spellCheck={false} />
          <button className="primary" disabled={busy} onClick={() => void runPower()}>Run query</button>
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
