import { useMemo, useState } from "react";
import {
  buildOpeningTruthDraft,
  formatCad,
  openingEligibleAccounts,
  newConfirmationId,
  postOpeningBalances,
  type DateKey,
  type Household,
  type UndoToken,
} from "./core/index.ts";

export function OpeningTruthCard({ household, memberId, date, onApply, onDone }: {
  household: Household;
  memberId: string;
  date: DateKey;
  onApply: (household: Household, undo?: UndoToken) => unknown | Promise<unknown>;
  onDone?: () => void;
}) {
  const accounts = useMemo(() => openingEligibleAccounts(household, memberId), [household, memberId]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lines = accounts.map((account) => ({
    accountId: account.id,
    amountCents: Math.max(0, Math.round(Number(amounts[account.id] || 0) * 100)),
  }));
  let draft = null;
  try {
    draft = buildOpeningTruthDraft(household, { asOfDate: date, createdBy: memberId, lines });
  } catch {
    draft = null;
  }

  const confirm = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      const confirmationId = newConfirmationId();
      const result = postOpeningBalances(household, { asOfDate: date, createdBy: memberId, confirmationId, lines });
      await onApply(result.household, result.undo);
      onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return <section className="month-opening-card" aria-label="Opening balances">
    <div className="month-hercules-line"><span aria-hidden="true">🐈</span><p>These are balances you already have. They will not appear as income or spending.</p></div>
    <p className="month-disclosure">Use the balance shown by each account on {date}. Enter card debt as a positive amount owed.</p>
    <div className="month-opening-grid">
      {accounts.map((account) => <label key={account.id}>
        <span>{account.name}</span>
        <span className="month-money-input"><span>$</span><input
          inputMode="decimal"
          aria-label={`${account.name} opening balance`}
          value={amounts[account.id] ?? ""}
          onChange={(event) => setAmounts((current) => ({ ...current, [account.id]: event.target.value.replace(/[^0-9.]/g, "") }))}
          placeholder="0.00"
        /></span>
      </label>)}
    </div>
    {reviewing && draft ? <div className="month-opening-review" role="status">
      <strong>Balance-sheet review</strong>
      <p>Assets {formatCad(draft.assetCents)} · Card debt {formatCad(draft.liabilityCents)} · Opening equity {formatCad(draft.openingEquityCents)}</p>
      <p>One Confirm will post {draft.lines.length} balances together. A correction reverses the whole batch.</p>
    </div> : null}
    {error ? <p className="month-error" role="alert">{error}</p> : null}
    <div className="month-actions">
      {!reviewing ? <button type="button" className="secondary" disabled={!draft} onClick={() => setReviewing(true)}>Review balances</button> : null}
      {reviewing ? <button type="button" className="primary" disabled={!draft || busy} onClick={() => void confirm()}>{busy ? "Confirming…" : "Confirm opening balances"}</button> : null}
      {reviewing ? <button type="button" className="text-button" disabled={busy} onClick={() => setReviewing(false)}>Change</button> : null}
    </div>
  </section>;
}
