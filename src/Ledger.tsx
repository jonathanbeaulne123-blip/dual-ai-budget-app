import { useEffect, useMemo, useState } from "react";
import {
  formatCad,
  formatDateLabel,
  markDuplicate,
  partitionLedger,
  accountName,
  categoryName,
  splitSummary,
  transactionsForHerculesSource,
  transactionTypeLabel,
  visibilityLabel,
  isVisibleInView,
  ledgerNameForView,
  duplicateContrastPairs,
  type Household,
  type HerculesNumberSource,
  type LedgerSection,
  type LedgerView,
  type Transaction,
  type UndoToken,
} from "./core/index.ts";

const SECTIONS: { id: LedgerSection; label: string }[] = [
  { id: "expenses", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "other", label: "Other" },
];

export function LedgerPage({
  household,
  writeHousehold = household,
  memberId,
  view,
  sourceFocus,
  onClearSource,
  onChange,
  onRemove,
}: {
  household: Household;
  writeHousehold?: Household;
  memberId: string;
  view: LedgerView;
  sourceFocus: HerculesNumberSource | null;
  onClearSource: () => void;
  onChange: (household: Household, undo?: UndoToken) => void;
  onRemove: (transaction: Transaction) => void;
}) {
  const [section, setSection] = useState<LedgerSection>("expenses");
  const [query, setQuery] = useState("");
  const [showContrast, setShowContrast] = useState(true);
  const visible = useMemo(
    () => household.transactions.filter((tx) => isVisibleInView(tx, memberId, view)),
    [household.transactions, memberId, view],
  );
  const sourceRows = useMemo(() => {
    return transactionsForHerculesSource(visible, sourceFocus);
  }, [sourceFocus, visible]);
  const grouped = useMemo(() => partitionLedger(sourceRows), [sourceRows]);
  const flagged = visible.filter((tx) => tx.potentialDuplicate && !tx.isDuplicate).length;
  const contrasts = useMemo(() => duplicateContrastPairs(visible), [visible]);

  useEffect(() => {
    if (!sourceFocus?.transactionId) return;
    const transaction = visible.find((tx) => tx.id === sourceFocus.transactionId);
    if (transaction?.type === "expense") setSection("expenses");
    else if (transaction?.type === "income") setSection("income");
    else if (transaction) setSection("other");
  }, [sourceFocus, visible]);

  const rows = grouped[section].filter((tx) => {
    if (!query.trim()) return true;
    const hay = `${tx.note} ${tx.place} ${categoryName(household, tx.subcategoryId)} ${accountName(household, tx.accountId)}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <section className="hero">
        <div className="label">{ledgerNameForView(household, memberId, view)}</div>
        <div className="money" style={{ fontSize: 36 }}>{rows.length}</div>
        <div className="sub">
          {grouped.expenses.length} expenses · {grouped.income.length} income · {grouped.other.length} transfers/refunds
        </div>
      </section>
      {flagged > 0 && (
        <article className="pulse" style={{ marginTop: 0 }}>
          <article className="warn">
            {flagged} {flagged === 1 ? "row looks" : "rows look"} like a repeat. Contrast pairs weigh confidence 0–100 without loosening the scorer.
            {" "}
            <button type="button" className="chip" onClick={() => setShowContrast((value) => !value)}>
              {showContrast ? "Hide contrast" : "Show contrast"}
            </button>
          </article>
        </article>
      )}
      {showContrast && contrasts.length > 0 && (
        <section className="card duplicate-contrast">
          <header>
            <h2>Duplicate contrast</h2>
            <span className="muted">{contrasts.length} pair{contrasts.length === 1 ? "" : "s"} · confidence first</span>
          </header>
          {contrasts.slice(0, 12).map((pair) => (
            <article key={`${pair.left.id}-${pair.right.id}`} className="contrast-pair">
              <div className={`confidence useful-${pair.confidence >= 70 ? "green" : pair.confidence >= 40 ? "yellow" : "red"}`}>
                {pair.confidence}%
              </div>
              <div className="contrast-cols">
                <ContrastSide household={household} tx={pair.left} />
                <ContrastSide household={household} tx={pair.right} />
              </div>
              <p className="muted">{pair.reasons.join(" · ")}</p>
              <div className="row-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    const result = markDuplicate(writeHousehold, pair.left.id, true);
                    onChange(result.household, result.undo);
                  }}
                >
                  Exclude left
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    const result = markDuplicate(writeHousehold, pair.right.id, true);
                    onChange(result.household, result.undo);
                  }}
                >
                  Exclude right
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {sourceFocus && (
        <p className="muted">
          Hercules opened: <strong>{sourceFocus.label}</strong>{" "}
          <button type="button" className="chip" onClick={onClearSource}>Show all activity</button>
        </p>
      )}
      <div className="tabs">
        {SECTIONS.map((item) => (
          <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
            {item.label}
            <span className="muted"> {grouped[item.id].length}</span>
          </button>
        ))}
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, place, category…" />
      {section === "other" && (
        <p className="muted">Transfers move money between accounts. Refunds undo spend. Neither is ordinary income.</p>
      )}
      <section className="card">
        {rows.length === 0 ? <p className="muted">Nothing in this list yet.</p> : rows.map((tx) => (
          <LedgerRow
            key={tx.id}
            household={household}
            transaction={tx}
            onToggleDuplicate={() => {
              const result = markDuplicate(writeHousehold, tx.id, !tx.isDuplicate);
              onChange(result.household, result.undo);
            }}
            onRemove={() => onRemove(tx)}
          />
        ))}
      </section>
    </>
  );
}

function ContrastSide({ household, tx }: { household: Household; tx: Transaction }) {
  return (
    <div className="contrast-side">
      <strong>{formatCad(tx.amountCents)}</strong>
      <span>{formatDateLabel(tx.date)}</span>
      <span>{tx.note || transactionTypeLabel(tx.type)}</span>
      <span className="muted">{tx.place || "—"} · {categoryName(household, tx.subcategoryId)}</span>
      <span className="muted">{accountName(household, tx.accountId)}</span>
    </div>
  );
}

function LedgerRow({
  household,
  transaction,
  onToggleDuplicate,
  onRemove,
}: {
  household: Household;
  transaction: Transaction;
  onToggleDuplicate: () => void;
  onRemove: () => void;
}) {
  const pair = transaction.transferPairId
    ? household.transactions.find((item) => item.id === transaction.transferPairId)
    : undefined;
  return (
    <div className="ledger-row">
      <div>
        <strong>{transaction.note || transactionTypeLabel(transaction.type)}</strong>
        <div className="muted">
          {formatDateLabel(transaction.date)}
          {transaction.place ? ` · ${transaction.place}` : ""}
          {" · "}
          {transaction.type === "transfer"
            ? `${accountName(household, transaction.accountId)}${pair ? ` ↔ ${accountName(household, pair.accountId)}` : ""}`
            : categoryName(household, transaction.subcategoryId)}
          {" · "}
          {visibilityLabel(transaction.visibility)}
          {" · "}
          {splitSummary(household, transaction)}
        </div>
        {transaction.potentialDuplicate && (
          <div className="muted">{transaction.isDuplicate ? "Excluded from totals" : "Looks like a repeat"}</div>
        )}
      </div>
      <div className="right">
        <div>{formatCad(transaction.amountCents)}</div>
        {transaction.potentialDuplicate && (
          <button className="chip" onClick={onToggleDuplicate}>{transaction.isDuplicate ? "Include" : "Exclude"}</button>
        )}
        <button className="chip" onClick={onRemove}>Reverse</button>
      </div>
    </div>
  );
}
