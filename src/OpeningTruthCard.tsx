import { useEffect, useMemo, useRef, useState } from "react";
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
import "./opening-truth.css";

export function OpeningTruthCard({
  household,
  memberId,
  date,
  accountScope = "all-visible",
  autoFocusHeading = false,
  onApply,
  onDone,
  onCancel,
}: {
  household: Household;
  memberId: string;
  date: DateKey;
  accountScope?: "all-visible" | "shared";
  autoFocusHeading?: boolean;
  onApply: (household: Household, undo?: UndoToken, confirmationId?: string) => unknown | Promise<unknown>;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const wasReviewingRef = useRef(false);
  const accounts = useMemo(() => openingEligibleAccounts(household, memberId)
    .filter((account) => accountScope !== "shared" || account.scope !== "personal"), [accountScope, household, memberId]);
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
  const coveredAccountIds = new Set(draft?.lines.map((line) => line.accountId) ?? []);
  const completeSharedSet = accountScope !== "shared"
    || (accounts.length > 0 && accounts.every((account) => coveredAccountIds.has(account.id)));

  useEffect(() => {
    if (autoFocusHeading) headingRef.current?.focus();
  }, [autoFocusHeading]);

  useEffect(() => {
    if (reviewing) reviewRef.current?.focus();
    else if (wasReviewingRef.current) firstInputRef.current?.focus();
    wasReviewingRef.current = reviewing;
  }, [reviewing]);

  const confirm = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      const confirmationId = newConfirmationId();
      const result = postOpeningBalances(household, { asOfDate: date, createdBy: memberId, confirmationId, lines });
      const outcome = await onApply(result.household, result.undo, confirmationId);
      if (outcome === null || (typeof outcome === "object" && outcome && "ok" in outcome && outcome.ok === false)) {
        setError("That didn't go through. Nothing changed — try again when the Shared books are ready.");
        return;
      }
      onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return <section className="month-opening-card opening-truth-card" aria-labelledby="opening-truth-heading" aria-busy={busy}>
    <h2 id="opening-truth-heading" ref={headingRef} tabIndex={-1}>Bring the books to today</h2>
    <div className="month-hercules-line"><span aria-hidden="true">🐈</span><p>These are balances you already have. They will not appear as income or spending.</p></div>
    <p className="month-disclosure" id="opening-truth-help">Use the balance shown by each account on {date}. Enter card debt as a positive amount owed.</p>
    {accountScope === "shared" ? (
      <p className="month-opening-progress" role="status">
        {coveredAccountIds.size} of {accounts.length} Shared accounts ready. You can pause between accounts.
      </p>
    ) : null}
    <div className="month-opening-grid">
      {accounts.map((account) => <label key={account.id}>
        <span>{account.name}</span>
        <span className="month-money-input"><span>$</span><input
          ref={account === accounts[0] ? firstInputRef : undefined}
          inputMode="decimal"
          aria-label={`${account.name} opening balance`}
          aria-describedby="opening-truth-help"
          value={amounts[account.id] ?? ""}
          onChange={(event) => setAmounts((current) => ({ ...current, [account.id]: event.target.value.replace(/[^0-9.]/g, "") }))}
          placeholder="0.00"
        /></span>
      </label>)}
    </div>
    {reviewing && draft ? <div className="month-opening-review" role="status" ref={reviewRef} tabIndex={-1}>
      <strong>Balance-sheet review</strong>
      <p>Assets {formatCad(draft.assetCents)} · Card debt {formatCad(draft.liabilityCents)} · Opening equity {formatCad(draft.openingEquityCents)}</p>
      <p>One Confirm will post {draft.lines.length} balances together. A correction reverses the whole batch.</p>
    </div> : null}
    {error ? <p className="month-error" role="alert">{error}</p> : null}
    <div className="month-actions">
      {!reviewing ? <button type="button" className="secondary" disabled={!draft || !completeSharedSet} onClick={() => setReviewing(true)}>Review balances</button> : null}
      {reviewing ? <button type="button" className="primary" disabled={!draft || !completeSharedSet || busy} onClick={() => void confirm()}>{busy ? "Confirming…" : "Confirm opening balances"}</button> : null}
      {reviewing ? <button type="button" className="text-button" disabled={busy} onClick={() => setReviewing(false)}>Change</button> : null}
      {onCancel ? <button type="button" className="text-button" disabled={busy} onClick={onCancel}>Pause here</button> : null}
    </div>
  </section>;
}
