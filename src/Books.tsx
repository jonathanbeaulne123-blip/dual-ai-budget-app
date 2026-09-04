import { lazy, useEffect, useMemo, useState } from "react";
import { KitchenNotice } from "./KitchenNotice.tsx";
import {
  ASK_SUGGESTIONS,
  accountOptionLabel,
  accountRegister,
  agedPayables,
  askHercules,
  auditOpinion,
  balanceSheet,
  budgetVariance,
  cashFlowStatement,
  closeBooksMonth,
  closePackageText,
  closedMonthKeys,
  comparativeIncome,
  compileHousehold,
  contributionRegister,
  formatCad,
  householdWallet,
  householdTableStory,
  herculesLedgerSourcePane,
  LEDGER_CUSTODY_DISCLOSURE,
  projectHouseholdFund,
  incomeStatement,
  liquidityWatch,
  likelyMiscoded,
  categoryName,
  monthKeyFromDateKey,
  notesToFinancialStatements,
  booksPresentationFloor,
  recordReconciliation,
  reopenBooksMonth,
  setBudget,
  shiftMonthKey,
  sitDownExportText,
  statementOfChangesInEquity,
  todayKey,
  trialBalance,
  walletForListedAccounts,
  type Household,
  type LedgerView,
  type UndoToken,
  type Account,
  type CommitResult,
  type HerculesNumberSource,
  type RegisterMemberView,
} from "./core/index.ts";
import { LedgerPage } from "./Ledger.tsx";
import { PaneSeals, PaperTile, StoryStrip, CollapsibleCard } from "./theme/PaperTheme.tsx";
import { WalletPane } from "./Accounts.tsx";
import { booksFilename, booksJournalCsv, booksSqlDump, downloadText } from "./ledger/export.ts";
import type { BooksStatus } from "./ledger/engine.ts";
import { HouseholdFundPanel } from "./HouseholdFundPanel.tsx";
import { KittyBanks } from "./KittyBanks.tsx";
import { DeferredSurface } from "./deferredSurfaces.tsx";
import { Register } from "./Register.tsx";

const DeferredBatchImportCard = lazy(() => import("./BatchImport.tsx").then((module) => ({ default: module.BatchImportCard })));

const PANES = [
  { id: "wallet", label: "Wallet", blurb: "Household cash, Goals savings, cards, and investments. Touch a tile to open the room." },
  { id: "fund", label: "Household Fund", blurb: "A shared operating subledger backed by Bianca’s savings. It is not a bank account and Hearth cannot move money." },
  { id: "fund-register", label: "Register", blurb: "What this month owes, and which confirmed Fund dollars cover each obligation." },
  { id: "register", label: "All activity", blurb: "Every posted row you can see in this view. Duplicate contrast lives here." },
  { id: "import", label: "Import", blurb: "QFX/OFX and selected document photos enter an inbox. Duplicate review and one final Confirm protect the books." },
  { id: "journal", label: "Journal", blurb: "Debit and credit lines compiled from the snapshot. The books engine." },
  { id: "trial", label: "Trial balance", blurb: "Account totals that must balance. Health refuses a lie." },
  { id: "statements", label: "Statements", blurb: "Balance sheet, P&L, cash flow, equity, working capital, notes." },
  { id: "rec", label: "Reconcile", blurb: "Tie a statement figure to the books. Never posts money by itself." },
  { id: "close", label: "Close pack", blurb: "Hard month lock. Reopen is explicit. Groceries in the open month still posts." },
  { id: "accounts", label: "Chart", blurb: "Every account on the chart of accounts." },
  { id: "query", label: "Ask", blurb: "Ask the books. Hercules answers from the journal visible on this floor." },
] as const;

const TABLE_PANE_IDS = ["fund", "fund-register", "wallet", "register", "import"] as const;
const AUDIT_PANE_IDS = ["journal", "trial", "statements", "rec", "close", "accounts", "query"] as const;

type Pane = (typeof PANES)[number]["id"];

export function BooksPage({
  household,
  booksHousehold,
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
  onCommand,
  onGoMore,
  requestedPane,
  onConsumeRequestedPane,
}: {
  household: Household;
  booksHousehold: Household;
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
  onCommand: (command: (current: Household) => CommitResult) => void;
  onGoMore?: () => void;
  requestedPane?: "fund-register" | "wallet" | null;
  onConsumeRequestedPane?: () => void;
}) {
  const [pane, setPane] = useState<Pane>(view === "personal" ? "wallet" : "fund");
  const [accountFormOpenRequest, setAccountFormOpenRequest] = useState(0);
  const sharedTable = view === "household";
  const auditHousehold = useMemo(() => (
    booksPresentationFloor(booksHousehold, memberId, view)
  ), [booksHousehold, memberId, view]);
  const books = useMemo(() => compileHousehold(auditHousehold), [auditHousehold]);
  const trial = useMemo(() => trialBalance(books, { recognizedOnly: true }), [books]);
  const opinion = useMemo(() => auditOpinion(auditHousehold), [auditHousehold]);
  const today = todayKey();
  const walletHousehold = auditHousehold;
  const wallet = useMemo(() => (
    sharedTable
      ? householdWallet(walletHousehold, today)
      : walletForListedAccounts(
        booksHousehold,
        walletHousehold.accounts.map((account) => account.id),
        today,
      )
  ), [sharedTable, walletHousehold, booksHousehold, today]);
  const fundProjection = useMemo(() => projectHouseholdFund(booksHousehold, today), [booksHousehold, today]);
  const showFundPane = sharedTable || booksHousehold.householdFund?.custodianMemberId === memberId;
  const tableStory = sharedTable ? householdTableStory(wallet) : wallet.story;
  const isAuditPane = (AUDIT_PANE_IDS as readonly string[]).includes(pane);
  const [auditOpen, setAuditOpen] = useState(!trial.inBalance);
  const tablePanes = PANES.filter((item) => (
    (TABLE_PANE_IDS as readonly string[]).includes(item.id)
    && (item.id !== "fund" || showFundPane)
    && (item.id !== "fund-register" || sharedTable)
  ));
  const auditPanes = PANES.filter((item) => (AUDIT_PANE_IDS as readonly string[]).includes(item.id));
  const fundConfigured = Boolean(booksHousehold.householdFund);
  const sharedLeadCents = fundConfigured ? fundProjection.operatingBalanceCents : wallet.cashCents;
  const monthKey = monthKeyFromDateKey(today);
  const fundRegister = useMemo(
    () => contributionRegister(booksHousehold, monthKey, today),
    [booksHousehold, monthKey, today],
  );
  const registerMembers = useMemo<RegisterMemberView[]>(() => {
    const custodianMemberId = booksHousehold.householdFund?.custodianMemberId ?? null;
    return booksHousehold.members
      .filter((member) => member.active)
      .map((member) => ({
        memberId: member.id,
        displayName: member.name,
        tone: member.id === custodianMemberId ? "hers" : "his",
      }));
  }, [booksHousehold.householdFund?.custodianMemberId, booksHousehold.members]);
  const packMonth = closedMonthKeys(auditHousehold).at(-1) ?? monthKey;
  const [accountId, setAccountId] = useState(
    focusedAccountId && auditHousehold.accounts.some((account) => account.id === focusedAccountId)
      ? focusedAccountId
      : auditHousehold.accounts.find((account) => account.active)?.id ?? "",
  );
  const register = useMemo(() => accountRegister(books, accountId), [books, accountId]);
  const [recDate, setRecDate] = useState(today);
  const [recAmount, setRecAmount] = useState("");
  const [recError, setRecError] = useState("");
  const [closeError, setCloseError] = useState("");

  useEffect(() => {
    if (!focusedAccountId) return;
    if (!auditHousehold.accounts.some((account) => account.id === focusedAccountId)) return;
    setAccountId(focusedAccountId);
    setPane(view === "household" ? "accounts" : "wallet");
    if (view === "household") setAuditOpen(true);
  }, [auditHousehold, focusedAccountId, view]);

  useEffect(() => {
    if (auditHousehold.accounts.some((account) => account.id === accountId)) return;
    setAccountId(auditHousehold.accounts.find((account) => account.active)?.id ?? "");
  }, [accountId, auditHousehold]);

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

  useEffect(() => {
    if (focusedAccountId || sourceFocus) return;
    setPane(view === "personal" ? "wallet" : "fund");
    setAuditOpen(view !== "household");
  }, [view, focusedAccountId, sourceFocus]);

  useEffect(() => {
    if (requestedPane !== "fund-register" || !sharedTable) return;
    setPane("fund-register");
    onConsumeRequestedPane?.();
  }, [onConsumeRequestedPane, requestedPane, sharedTable]);

  useEffect(() => {
    if (requestedPane !== "wallet" || sharedTable) return;
    setPane("wallet");
    setAccountFormOpenRequest((current) => current + 1);
    onConsumeRequestedPane?.();
  }, [onConsumeRequestedPane, requestedPane, sharedTable]);

  useEffect(() => {
    if (!trial.inBalance || isAuditPane) setAuditOpen(true);
  }, [trial.inBalance, isAuditPane]);

  return (
    <div className={`books-theme-c${sharedTable ? "" : " books-floor"}`} data-books-face={sharedTable ? "household-table" : "personal-folio"}>
      {sharedTable ? (
        <section className="hero">
          <div className="label">Household table · CAD · {household.timezone}</div>
          <div className={`money ${sharedLeadCents < 0 ? "negative" : ""}`}>{formatCad(sharedLeadCents)}</div>
          <div className="sub">
            {fundConfigured
              ? `Fund operating. Kitty ${formatCad(fundProjection.kittyCents)}. ${LEDGER_CUSTODY_DISCLOSURE}`
              : "Fund is not set up. This is household cash on the table — not net worth, not a P&L."}
          </div>
          <p className="muted books-table-job">Shared Fund, cash, and cards. Net worth, trial, and statements stay in Audit.</p>
          {!trial.inBalance ? (
            <p className="opinion-banner adverse">
              Trial is off. Open Audit before treating the journal as closed.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="hero">
          <div className="label">My books · CAD · {household.timezone}</div>
          <div className={`money ${wallet.netWorthCents < 0 ? "negative" : ""}`}>{formatCad(wallet.netWorthCents)}</div>
          <div className="sub">Rooms I can manage. Partner-personal rooms stay off this floor. The figure is accepted-books position, not a partner-hidden envelope.</div>
          {!trial.inBalance ? (
            <p className="opinion-banner adverse">
              Trial is off. Open Audit before treating the journal as closed.
            </p>
          ) : null}
        </section>
      )}
      <StoryStrip heading={sharedTable ? "On the table" : "My accounts"}>
        {showFundPane && (
        <PaperTile
          kind="Fund"
          name={view === "personal" ? "Private Fund check" : "Household Fund"}
          value={household.householdFund ? formatCad(fundProjection.operatingBalanceCents) : "Set up at $0.00"}
          onClick={() => setPane("fund")}
          ariaLabel="Open the Hearth Household Fund"
        />
        )}
        {tableStory.map((group) => (
          <PaperTile
            key={group.kind}
            kind={sharedTable ? "Table" : "Books"}
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
      {!sharedTable ? (
        <CollapsibleCard title="On this phone" hint="Storage and sharing" defaultOpen={false}>
          <BooksStorageNotes household={household} booksStatus={booksStatus} onGoMore={onGoMore} />
        </CollapsibleCard>
      ) : null}
      <PaneSeals
        ariaLabel={sharedTable ? "Household table rooms" : "My books rooms"}
        items={sharedTable
          ? [
              ...(showFundPane ? [{ id: "fund" as const, label: "Fund" }] : []),
              { id: "fund-register", label: "Register" },
              { id: "wallet", label: "Wallet" },
              { id: "register", label: "Activity" },
            ]
          : [
              { id: "wallet", label: "Wallet" },
              { id: "register", label: "Activity" },
              { id: "close", label: "Close month" },
            ]}
        active={pane}
        onPick={(id) => setPane(id as Pane)}
      />
      <div className="tabs" role="tablist" aria-label={sharedTable ? "Household table" : "My books"} data-books-tabs="table">
        {tablePanes.map((item) => (
          <button key={item.id} className={pane === item.id ? "active" : ""} onClick={() => setPane(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {!isAuditPane ? (
        <p className="muted books-pane-blurb">{PANES.find((item) => item.id === pane)?.blurb}</p>
      ) : null}
      {pane === "wallet" && sharedTable && (
        <>
          <section className="card">
            <header><h2>Shared pool</h2></header>
            <p>Shared is one account. Kitty Banks are the sub-accounts. Room-by-room management lives on My books.</p>
          </section>
          <KittyBanks
            household={household}
            booksHousehold={booksHousehold}
            view="household"
            createdBy={memberId}
            surface="home"
            onCommand={onCommand}
          />
        </>
      )}
      {pane === "wallet" && !sharedTable && (
        <WalletPane
          household={walletHousehold}
          writeHousehold={booksHousehold}
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
          accountFormOpenRequest={accountFormOpenRequest}
        />
      )}
      {pane === "fund" && (
        <HouseholdFundPanel household={booksHousehold} memberId={memberId} view={view} onCommand={onCommand} />
      )}
      {pane === "fund-register" && sharedTable && (
        <Register register={fundRegister} members={registerMembers} />
      )}
      {pane === "register" && (
        <LedgerPage
          household={sharedTable ? household : walletHousehold}
          writeHousehold={booksHousehold}
          presentedTransactions={!sharedTable}
          memberId={memberId}
          view={view}
          sourceFocus={sourceFocus?.route === "ledger" ? sourceFocus : null}
          onClearSource={onClearSource}
          onChange={onChange}
          onRemove={onRemove}
        />
      )}
      {pane === "import" && (
        <DeferredSurface label="Import">
        <DeferredBatchImportCard
          household={auditHousehold}
          writeHousehold={booksHousehold}
          memberId={memberId}
          view={view}
          onCommit={(next, undo) => onChange(next, undo)}
          onGoMore={onGoMore}
        />
        </DeferredSurface>
      )}
      <details
        className="books-audit-office"
        open={auditOpen}
        onToggle={(event) => {
          const next = event.currentTarget.open;
          setAuditOpen(next);
          if (!next && isAuditPane) setPane(sharedTable ? "fund" : "wallet");
        }}
      >
        <summary>Audit office — journal, trial, statements</summary>
        {sharedTable ? (
          <>
            <p className="muted">The journal still exists. This is how Hearth proves the books — not the shared table opening.</p>
            <BooksStorageNotes household={household} booksStatus={booksStatus} onGoMore={onGoMore} />
          </>
        ) : null}
        <div className="tabs" role="tablist" aria-label="Audit office" data-books-tabs="audit">
          {auditPanes.map((item) => (
            <button key={item.id} className={pane === item.id ? "active" : ""} onClick={() => setPane(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {isAuditPane ? (
          <p className="muted books-pane-blurb">{PANES.find((item) => item.id === pane)?.blurb}</p>
        ) : null}
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
        <StatementsPane household={auditHousehold} writeHousehold={booksHousehold} monthKey={monthKey} today={today} onChange={onChange} />
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
            {auditHousehold.accounts.filter((account) => account.active).map((account) => (
              <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
            ))}
          </select>
          <label>Statement date</label>
          <input type="date" value={recDate} onChange={(event) => setRecDate(event.target.value)} />
          <label>Statement balance (CAD)</label>
          <input inputMode="decimal" value={recAmount} placeholder="0.00" onChange={(event) => setRecAmount(event.target.value)} />
          <KitchenNotice message={recError} />
          <button
            className="primary"
            type="button"
            disabled={!accountId}
            onClick={() => {
              try {
                const result = recordReconciliation(booksHousehold, {
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
                {auditHousehold.kitchen.books.reconciliations.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No recs yet.</td></tr>
                ) : [...auditHousehold.kitchen.books.reconciliations].reverse().map((row) => (
                  <tr key={row.id}>
                    <td>{row.statementDate}</td>
                    <td>{auditHousehold.accounts.find((account) => account.id === row.accountId)?.name ?? row.accountId}</td>
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
          <KitchenNotice message={closeError} />
          <div className="chips">
            <button
              className="chip"
              type="button"
              onClick={() => {
                try {
                  const result = closeBooksMonth(booksHousehold, { monthKey: shiftMonthKey(monthKey, -1), createdBy: memberId });
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
              onClick={() => downloadText(booksFilename(books, "txt"), closePackageText(auditHousehold, packMonth, today))}
            >
              Download close pack
            </button>
          </div>
          {likelyMiscoded(auditHousehold, monthKey).length > 0 && (
            <div>
              <p className="muted">Likely miscoded — guessed from merchant tokens. Confirm still recodes. Nothing auto-posts.</p>
              {likelyMiscoded(auditHousehold, monthKey).map((row) => {
                const tx = auditHousehold.transactions.find((item) => item.id === row.transactionId);
                if (!tx) return null;
                return (
                  <div className="row" key={row.transactionId}>
                    <span>{tx.note || tx.place} · {categoryName(auditHousehold, tx.subcategoryId)}</span>
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
              onClick={() => downloadText(`hearth-sitdown-${packMonth}.txt`, sitDownExportText(auditHousehold, packMonth, today))}
            >
              Download sit-down workbook
            </button>
          </div>
          {auditHousehold.kitchen.books.closedMonths.length > 0 && (
            <ul className="close-list">
              {auditHousehold.kitchen.books.closedMonths.map((row) => (
                <li key={row.monthKey}>
                  <span>{row.monthKey} closed</span>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      try {
                        const result = reopenBooksMonth(booksHousehold, row.monthKey);
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
      {pane === "query" && <AskBooks household={auditHousehold} memberId={memberId} view={view} />}
      {(!sharedTable || isAuditPane) ? (
      <div className="chips" style={{ marginTop: 8 }}>
        <button className="chip" onClick={() => downloadText(booksFilename(books, "sql"), booksSqlDump(books), "application/sql")}>
          Download SQL
        </button>
        <button className="chip" onClick={() => downloadText(booksFilename(books, "csv"), booksJournalCsv(books, trial), "text/csv")}>
          Download journal CSV
        </button>
        <button className="chip" onClick={() => downloadText(booksFilename(books, "txt"), closePackageText(auditHousehold, packMonth, today))}>
          Download close pack
        </button>
      </div>
      ) : null}
      </details>
    </div>
  );
}

function BooksStorageNotes({
  household,
  booksStatus,
  onGoMore,
}: {
  household: Household;
  booksStatus: BooksStatus | null;
  onGoMore?: () => void;
}) {
  return (
    <>
      {booksStatus?.ok ? (
        <p className="muted">
          {`Postgres ${booksStatus.postgresVersion ?? "PGlite"} is holding ${booksStatus.entryCount} journal entries on this phone.`}
        </p>
      ) : booksStatus ? (
        <KitchenNotice
          message={booksStatus.error || "The SQL books did not verify. The last valid snapshot on this phone is still saved."}
          onGoMore={onGoMore}
        />
      ) : null}
      {household.linked ? (
        booksStatus?.hosted?.schema ? (
          <p className="muted">
            {`The shared snapshot is on Supabase (${booksStatus.hosted.project}). Phrase join is not encryption.`}
          </p>
        ) : booksStatus?.hosted ? (
          <KitchenNotice
            message={booksStatus.hosted.error || "This household is linked, but the hosted tables are not in the API yet."}
            onGoMore={onGoMore}
          />
        ) : (
          <p className="muted">This household is linked. Sharing uses the reviewed transport path after a local accept.</p>
        )
      ) : (
        <p className="muted">This household stays on this phone until a signed-in Google member shares it. A Hearth Pass does not upload.</p>
      )}
    </>
  );
}

function StatementsPane({
  household,
  writeHousehold = household,
  monthKey,
  today,
  onChange,
}: {
  household: Household;
  writeHousehold?: Household;
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
      const result = setBudget(writeHousehold, { monthKey, subcategoryId, amount: draft });
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
        <KitchenNotice message={budgetError} />
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
      <CollapsibleCard title="Notes to the financial statements" hint="Accounting notes" defaultOpen={false}>
        {notes.map((note) => (
          <div className="statement-note" key={note.id}>
            <strong>{note.title}</strong>
            <p className="muted">{note.body}</p>
          </div>
        ))}
      </CollapsibleCard>
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

function AskBooks({
  household,
  memberId,
  view,
}: {
  household: Household;
  memberId: string;
  view: LedgerView;
}) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ you: string; sentence: string; rows: { label: string; value: string }[]; sql?: string }[]>([]);

  function ask(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    setQuestion("");
    try {
      const answer = askHercules(household, text, todayKey(), { memberId, view });
      setLog((current) => [...current, { you: text, sentence: answer.sentence, rows: answer.rows, sql: answer.sql }].slice(-8));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
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
        {(view === "personal"
          ? ASK_SUGGESTIONS.filter((item) => !/leftover|sit-down/i.test(item))
          : ASK_SUGGESTIONS
        ).slice(0, 6).map((item) => (
          <button key={item} className="chip" type="button" disabled={busy} onClick={() => ask(item)}>{item}</button>
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
            ask(question);
          }
        }}
      />
      <button className="primary" disabled={busy || !question.trim()} onClick={() => ask(question)}>Ask</button>
      <KitchenNotice message={error} />
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
      <p className="muted">Power SQL stays off scoped floors because the device database also contains rooms that are not visible here.</p>
    </section>
  );
}
