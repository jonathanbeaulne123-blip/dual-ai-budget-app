import { useMemo, useState } from "react";
import {
  formatCad,
  formatDateLabel,
  markDuplicate,
  partitionLedger,
  accountName,
  categoryName,
  splitSummary,
  transactionTypeLabel,
  type Household,
  type LedgerSection,
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
  onChange,
}: {
  household: Household;
  onChange: (household: Household, undo?: UndoToken) => void;
}) {
  const [section, setSection] = useState<LedgerSection>("expenses");
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => partitionLedger(household.transactions), [household.transactions]);
  const flagged = household.transactions.filter((tx) => tx.potentialDuplicate && !tx.isDuplicate).length;

  const rows = grouped[section].filter((tx) => {
    if (!query.trim()) return true;
    const hay = `${tx.note} ${tx.place} ${categoryName(household, tx.subcategoryId)} ${accountName(household, tx.accountId)}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <section className="hero">
        <div className="label">Ledger</div>
        <div className="money" style={{ fontSize: 36 }}>{rows.length}</div>
        <div className="sub">
          {grouped.expenses.length} expenses · {grouped.income.length} income · {grouped.other.length} transfers/refunds
        </div>
      </section>
      {flagged > 0 && (
        <article className="pulse" style={{ marginTop: 0 }}>
          <article className="warn">{flagged} {flagged === 1 ? "row looks" : "rows look"} like a repeat. Open a row and exclude it from totals if it is a duplicate.</article>
        </article>
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
              const result = markDuplicate(household, tx.id, !tx.isDuplicate);
              onChange(result.household, result.undo);
            }}
          />
        ))}
      </section>
    </>
  );
}

function LedgerRow({
  household,
  transaction,
  onToggleDuplicate,
}: {
  household: Household;
  transaction: Transaction;
  onToggleDuplicate: () => void;
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
      </div>
    </div>
  );
}
