import { useEffect, useRef, useState } from "react";
import {
  acceptReviewedAccountHistory, acceptedAccountOpeningCoverage, approveAccountHistoryReview,
  economicAccountBalanceAsOf, formatCad, pendingAccountHistoryReviews, prepareAccountHistoryReview,
  submitAccountHistoryReview, type AccountHistoryInput, type AccountHistoryReview, type Household, type LedgerView,
} from "./core/index.ts";
import type { KitchenCommand } from "./kitchenCommand.ts";
import { StatementSetup } from "./StatementSetup.tsx";
import "./account-history-setup.css";

type Props = { household: Household; memberId: string; authUserId: string; view: LedgerView; today: string; busy: boolean; onCommand: KitchenCommand };
type SavedReview = { review: AccountHistoryReview; confirmationId: string };

export function AccountHistorySetup(props: Props) {
  const key = JSON.stringify([props.household.environment, props.household.householdId, props.authUserId, props.memberId, props.view]);
  return <AccountHistorySetupSession key={key} {...props} storageKey={`hearth:account-history-review:v1:${key}`} />;
}
function AccountHistorySetupSession({ household, memberId, authUserId, view, today, busy, onCommand, storageKey }: Props & { storageKey: string }) {
  const [mode, setMode] = useState<"manual" | "statement">("manual");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(today);
  const [balance, setBalance] = useState("");
  const [confirmedBalance, setConfirmedBalance] = useState(false);
  const [saved, setSaved] = useState<SavedReview | null>(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey) ?? "null") as SavedReview | null;
      return value?.review?.householdId === household.householdId && value.review.createdBy === memberId && value.review.visibility === view && typeof value.confirmationId === "string" ? value : null;
    } catch { return null; }
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { try { if (saved) localStorage.setItem(storageKey, JSON.stringify(saved)); else localStorage.removeItem(storageKey); } catch { setError("This browser could not save the review draft. Keep this page open until you finish."); } }, [storageKey, saved]);
  const scope = { visibility: view, memberId } as const;
  const coverage = acceptedAccountOpeningCoverage(household, scope);
  const accounts = household.accounts.filter(a => a.active && (view === "personal" ? a.scope === "personal" && a.ownerMemberId === memberId : a.scope !== "personal"));
  const pending = pendingAccountHistoryReviews(household, scope);
  const review = saved?.review;
  let changed = false;
  if (review) { try { changed = prepareAccountHistoryReview(household, review).digest !== review.digest; } catch { changed = true; } }
  const approved = (id: string) => household.accountHistoryApprovals?.some(a => a.digest === review?.digest && a.memberId === id);
  const needsPartner = review?.mode === "rebase" && review.visibility === "household";
  const approvalsReady = !needsPartner || household.members.filter(m => m.active).every(m => approved(m.id));
  const accepted = saved && household.accountHistoryApprovals?.some(a => a.id === `HISTORY-ACCEPTED:${saved.confirmationId}` && a.digest === review?.digest);

  function reviewInput(input: AccountHistoryInput) {
    const next = prepareAccountHistoryReview(household, input);
    setSaved(current => current?.review.digest === next.digest ? current : { review: next, confirmationId: crypto.randomUUID() });
    setError(""); setMessage("");
  }
  async function command(fn: Parameters<KitchenCommand>[0], success: string, confirmationId?: string) {
    setError(""); setWorking(true);
    try {
      const outcome = await onCommand(fn, { confirmationId });
      if (!live.current) return;
      if (outcome?.ok) setMessage(success);
      else setError(outcome && !outcome.ok ? outcome.userMessage : "Acceptance is not confirmed yet. Keep this draft and retry the same action after reconnecting.");
    } catch (caught) { if (live.current) setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { if (live.current) setWorking(false); }
  }

  return <section className="account-history-setup" aria-labelledby="history-setup-title">
    <header><p className="kicker">{view === "personal" ? "Your Personal books" : "Shared books"}</p><h2 id="history-setup-title">Starting balances and statements</h2>
      <p>Opening balances describe what an account held at the end of a chosen day. Import only activity after that cutoff.</p></header>
    <p role="status">{coverage.complete ? "Every active account in this scope has accepted opening evidence." : `${coverage.missingAccountIds.length} active account${coverage.missingAccountIds.length === 1 ? " needs" : "s need"} an opening balance, including confirmed zero balances.`}</p>
    <div className="history-mode" role="group" aria-label="How to set up accounts">
      <button type="button" aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>Enter a balance</button>
      <button type="button" aria-pressed={mode === "statement"} onClick={() => setMode("statement")}>Use statements</button>
    </div>
    {mode === "manual" ? <form className="history-manual" onSubmit={event => {
      event.preventDefault();
      try {
        if (!confirmedBalance || !/^-?\d+(?:\.\d{1,2})?$/.test(balance.trim())) throw new Error("Enter and independently confirm the signed account balance, including zero.");
        const cents = Math.round(Number(balance) * 100);
        reviewInput({ createdBy: memberId, visibility: view, accounts: [{ accountId, openingDate: date, openingBalanceCents: cents, closingDate: date, closingBalanceCents: cents }], rows: [] });
      } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    }}>
      <label>Account<select required value={accountId} onChange={event => { setAccountId(event.target.value); setConfirmedBalance(false); }}><option value="">Choose an account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label>End-of-day opening cutoff<input type="date" required value={date} onChange={event => { setDate(event.target.value); setConfirmedBalance(false); }} /></label>
      <label>Signed balance (CAD)<input required inputMode="decimal" value={balance} placeholder="0.00" onChange={event => { setBalance(event.target.value); setConfirmedBalance(false); }} /></label>
      <p className="history-full">Money you have is positive. Debt and overdrafts are negative. An overpaid credit card is positive. Enter 0 for an empty account.</p>
      <label className="history-check history-full"><input type="checkbox" checked={confirmedBalance} onChange={event => setConfirmedBalance(event.target.checked)} />I checked this account's balance at this cutoff, including any explicit zero.</label>
      <button type="submit" disabled={busy || working || !accounts.length || !confirmedBalance}>Review opening balance</button>
      {!accounts.length && <p>Create an account in Accounts first, then return here.</p>}
    </form> : <StatementSetup household={household} memberId={memberId} authUserId={authUserId} view={view} acceptedCoverage={coverage.checkpoints.flatMap(checkpoint => (checkpoint.statementCoverage ?? []).map(span => ({ accountId: checkpoint.accountId, from: span.start, through: span.end, sourceIds: [checkpoint.confirmationId] })))} onReviewHistory={async input => { reviewInput(input); }} onDone={() => setMode("manual")} />}

    {pending.length > 0 && <section aria-label="Shared history proposals"><h3>History waiting for review</h3>{pending.map(proposal => <button type="button" key={proposal.id} onClick={() => { setSaved({ review: proposal.review, confirmationId: crypto.randomUUID() }); setError(""); }}>{household.members.find(m => m.id === proposal.review.createdBy)?.name ?? "Your partner"}'s history correction · {proposal.review.accounts.length} accounts</button>)}</section>}
    {review && <section className="history-review" aria-labelledby="history-review-title">
      <h3 id="history-review-title">{review.mode === "rebase" ? "Review history correction" : "Review starting books"}</h3>
      <p>{review.visibility === "household" ? "These accepted balances and activity will be Shared." : "These accepted balances and activity stay in your Personal books."} Nothing posts until Final Confirm.</p>
      <div className="history-checkpoints">{review.accounts.map(checkpoint => {
        const prior = coverage.checkpoints.find(p => p.accountId === checkpoint.accountId);
        return <article key={checkpoint.accountId}><h4>{accounts.find(a => a.id === checkpoint.accountId)?.name ?? "Account"}</h4><dl>
          <dt>Current opening</dt><dd>{prior ? `${formatCad(prior.signedBalanceCents)} · ${prior.date}` : "No accepted opening"}</dd>
          <dt>{prior ? "Replacement opening" : "Proposed opening"}</dt><dd>{formatCad(checkpoint.openingBalanceCents)} · {checkpoint.openingDate}</dd>
          {prior && <><dt>Former checkpoint, before and after</dt><dd>{formatCad(economicAccountBalanceAsOf(household, checkpoint.accountId, prior.date))} · must remain unchanged</dd></>}
          {(checkpoint.checkpoints ?? []).map((point, index) => <div key={`${point.date}:${index}`}><dt>Intermediate statement checkpoint</dt><dd>{formatCad(point.balanceCents)} · {point.date}</dd></div>)}
          <dt>Statement closing checkpoint</dt><dd>{formatCad(checkpoint.closingBalanceCents)} · {checkpoint.closingDate}</dd>
        </dl></article>;
      })}</div>
      {review.mode === "rebase" && <p>Selected live openings are reversed at their original dates, then replaced together with unmatched history. Ordinary accepted transactions and unrelated accounts stay in place. Closed months must be explicitly reopened in Books.</p>}
      <p>{review.rows.filter(r => r.decision === "post").length} historical additions · {review.rows.filter(r => r.decision === "retain").length} retained matches</p>
      {review.rows.length > 0 && <details><summary>Review every movement and source decision</summary><div className="history-rows">{review.rows.map(row => <article key={`${row.accountId}:${row.sourceIdentity}`}><strong>{row.date} · {formatCad(row.amountCents)} · {row.type}</strong><p>{accounts.find(a => a.id === row.accountId)?.name} · {row.note}</p><p>{row.type !== "transfer" ? `Category: ${household.categories.find(category => category.id === row.subcategoryId)?.name ?? "Unknown — review required"}` : "Canonical transfer between the reviewed accounts"}</p><p>{row.decision === "retain" ? `Keep existing ${row.retainedTransactionId}` : "Add reviewed movement"}{row.toAccountId ? ` → ${accounts.find(a => a.id === row.toAccountId)?.name}` : ""}</p><small>Source {row.sourceIdentity}</small>{row.transferSources?.map(source => <p key={`${source.accountId}:${source.sourceIdentity}`}>Paired source: {accounts.find(a => a.id === source.accountId)?.name} · {source.sourceIdentity}</p>)}</article>)}</div></details>}
      {accepted ? <p role="status">Accepted. These openings and reviewed movements are now in the books.</p> : <>
        {changed && <p role="alert">Review changed. Your draft is preserved. Review current balances and decisions before asking for new approvals.</p>}
        {needsPartner && <><p>Both members approve this exact correction independently.</p><ul>{household.members.filter(m => m.active).map(m => <li key={m.id}>{m.name}: {approved(m.id) ? "approved this review" : "waiting for review"}</li>)}</ul>
          {review.createdBy === memberId && <button type="button" disabled={busy || working || changed} onClick={() => void command(current => submitAccountHistoryReview(current, { createdBy: memberId, review }), "The exact correction is Shared for your partner's review.")}>Share this correction for review</button>}
          <button type="button" disabled={busy || working || changed || approved(memberId)} onClick={() => void command(current => approveAccountHistoryReview(current, { createdBy: memberId, review }), "Your approval is accepted for this exact review.")}>I approve this correction</button>
        </>}
        {review.createdBy === memberId && <button className="primary" type="button" disabled={busy || working || changed || !approvalsReady} onClick={() => void command(current => acceptReviewedAccountHistory(current, { createdBy: memberId, review, confirmationId: saved!.confirmationId }), "Opening balances and reviewed history accepted together.", saved!.confirmationId)}>{working ? "Confirming…" : "Final Confirm — accept these books"}</button>}
        {changed && review.createdBy === memberId && <button type="button" onClick={() => { try { reviewInput(review); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } }}>Recheck this draft against current books</button>}
      </>}
      <button type="button" disabled={working} onClick={() => { setSaved(null); setError(""); setMessage(""); }}>Close this review</button>
    </section>}
    {error && <p role="alert">{error}</p>}{message && <p role="status" aria-live="polite">{message}</p>}
  </section>;
}
