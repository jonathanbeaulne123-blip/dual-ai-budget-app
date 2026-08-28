import { useMemo, useState } from "react";
import {
  activeHouseholdFundEvents,
  allocateHouseholdFundSurplus,
  bindHouseholdFundBackingAccount,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  formatCad,
  monthKeyFromDateKey,
  projectHouseholdFund,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
  setHouseholdFundMonthPlan,
  shapeHouseholdFundConfig,
  shapeHouseholdFundEvents,
  shapeHouseholdFundPrivate,
  todayKey,
  type CommitResult,
  type Household,
  type LedgerView,
} from "./core/index.ts";

type FundCommand = (current: Household) => CommitResult;

export function HouseholdFundPanel({
  household,
  memberId,
  view,
  onCommand,
}: {
  household: Household;
  memberId: string;
  view: LedgerView;
  onCommand: (command: FundCommand) => void;
}) {
  const today = todayKey();
  const monthKey = monthKeyFromDateKey(today);
  const fund = shapeHouseholdFundConfig(household.householdFund);
  const projection = useMemo(() => projectHouseholdFund(household, today), [household, today]);
  const events = shapeHouseholdFundEvents(household.fundEvents).slice().reverse();
  const isCustodian = fund?.custodianMemberId === memberId;
  const member = household.members.find((row) => row.id === memberId);
  const [contributionAmount, setContributionAmount] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");
  const [allocationEdits, setAllocationEdits] = useState<Record<string, string>>({});
  const [target, setTarget] = useState("");
  const [buffer, setBuffer] = useState("100");
  const [destination, setDestination] = useState(household.accounts.find((row) => row.scope !== "personal" && row.kind === "credit")?.id ?? "");
  const [bankTotal, setBankTotal] = useState("");
  const [personalRemainder, setPersonalRemainder] = useState("");
  const [kittyAmount, setKittyAmount] = useState("");
  const [kittyGoal, setKittyGoal] = useState(household.goals.find((row) => row.shared && row.status !== "retired")?.id ?? "");
  const [backingAccount, setBackingAccount] = useState("");

  const pending = events.filter((event) => event.kind === "contribution-proposed"
    && !events.some((confirmed) => confirmed.kind === "contribution-confirmed" && confirmed.relatedEventId === event.id));
  const sharedDestinations = household.accounts.filter((row) => row.active && row.scope !== "personal");
  const transactionForPosition = (positionId: string) => household.transactions.find((tx) => (
    tx.id === positionId || tx.funding?.positionId === positionId
  ));
  const eligibleSettlements = projection.transactionPositions
    .filter((row) => row.destinationAccountId === destination && row.outstandingCents > 0)
    .sort((left, right) => {
      const leftTx = transactionForPosition(left.transactionId);
      const rightTx = transactionForPosition(right.transactionId);
      return (leftTx?.date ?? "").localeCompare(rightTx?.date ?? "") || left.transactionId.localeCompare(right.transactionId);
    });
  const defaultAllocations = useMemo(() => {
    let remaining = Math.max(0, Math.round(Number(settlementAmount || 0) * 100));
    return Object.fromEntries(eligibleSettlements.map((position) => {
      const cents = Math.min(remaining, position.outstandingCents);
      remaining -= cents;
      return [position.transactionId, cents ? (cents / 100).toFixed(2) : ""];
    }));
  }, [eligibleSettlements, settlementAmount]);
  const privateSavings = household.accounts.filter((row) => row.active && row.scope === "personal" && row.ownerMemberId === memberId && row.kind === "savings");
  const privateState = isCustodian ? shapeHouseholdFundPrivate(household.fundPrivate, memberId) : null;
  const latestPrivate = privateState?.reconciliations.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const activeEvents = activeHouseholdFundEvents(household, fund?.id);
  const suggestedTargetCents = projection.upcomingReserveCents
    + activeEvents.filter((event) => event.kind === "purchase-funded" && event.date.startsWith(monthKey))
      .reduce((sum, event) => sum + event.amountCents, 0)
    + Math.max(0, Math.round(Number(buffer || 0) * 100));
  const monthStart = `${monthKey}-01`;
  const openingOperatingCents = activeEvents.filter((event) => event.date < monthStart).reduce((sum, event) => {
    if (event.kind === "contribution-confirmed" || event.kind === "kitty-released") return sum + event.amountCents;
    if (event.kind === "settlement-confirmed" || event.kind === "kitty-allocated") return sum - event.amountCents;
    return sum;
  }, 0);
  const monthPurchasesCents = activeEvents.filter((event) => event.kind === "purchase-funded" && event.date.startsWith(monthKey)).reduce((sum, event) => sum + event.amountCents, 0);
  const monthRefundsCents = activeEvents.filter((event) => event.kind === "refund-funded" && event.date.startsWith(monthKey)).reduce((sum, event) => sum + event.amountCents, 0);
  const monthContributionsCents = activeEvents.filter((event) => event.kind === "contribution-confirmed" && event.date.startsWith(monthKey)).reduce((sum, event) => sum + event.amountCents, 0);
  const monthTransfersCents = activeEvents.filter((event) => event.kind === "settlement-confirmed" && event.date.startsWith(monthKey)).reduce((sum, event) => sum + event.amountCents, 0);
  const monthKittyNetCents = activeEvents.filter((event) => event.date.startsWith(monthKey)).reduce((sum, event) => {
    if (event.kind === "kitty-allocated") return sum + event.amountCents;
    if (event.kind === "kitty-released") return sum - event.amountCents;
    return sum;
  }, 0);

  if (!fund) {
    return (
      <section className="card household-fund-panel">
        <header><h2>Household Fund</h2><span className="muted">September practice · opens at $0.00</span></header>
        <p>Set aside part of Bianca’s existing savings as the shared operating pool. It is a Hearth subledger, not a bank account.</p>
        <p className="muted">The money remains in Bianca’s savings. Hearth cannot hold, move, withdraw, or delete it.</p>
        {member?.name.toLowerCase().includes("bianca") ? (
          <button className="primary" type="button" onClick={() => onCommand((current) => configureHouseholdFund(current, { custodianMemberId: memberId, createdBy: memberId, openedOn: today }))}>
            Confirm $0.00 practice fund
          </button>
        ) : <p className="muted">Bianca confirms the opening because she is the savings custodian.</p>}
      </section>
    );
  }

  return (
    <div className="household-fund-panel">
      <section className="card">
        <header><h2>{fund.name}</h2><span className="muted">{fund.mode === "practice" ? "Practice · manual evidence" : "Connected · read-only evidence"}</span></header>
        <p className="fund-disclosure">The money remains in Bianca’s savings. Hearth cannot move it.</p>
        <div className="grid">
          <div className="stat"><span>Operating balance</span><strong>{formatCad(projection.operatingBalanceCents)}</strong></div>
          <div className="stat"><span>Transfer due</span><strong>{formatCad(projection.transferDueCents)}</strong></div>
          <div className="stat"><span>Upcoming reserve</span><strong>{formatCad(projection.upcomingReserveCents)}</strong></div>
          <div className="stat"><span>{projection.topUpNeededCents ? "Top-up needed" : "Free to spend"}</span><strong className={projection.topUpNeededCents ? "negative" : ""}>{formatCad(projection.topUpNeededCents || projection.freeToSpendCents)}</strong></div>
        </div>
        <div className="row"><span>Monthly target</span><strong>{formatCad(projection.targetProgressCents)} / {formatCad(projection.monthlyTargetCents)}</strong></div>
        <div className="row"><span>Reconciliation</span><strong>{projection.lastReconciledAt ? (projection.reconciliationTied ? "Tied" : "Needs review") : "Not yet reconciled"}</strong></div>
      </section>

      <section className="card">
        <details open={Boolean(pending.length)}>
          <summary>Propose or confirm a contribution</summary>
        <header><h2>Contributions</h2><span className="muted">A proposal never creates money</span></header>
        <label htmlFor="fund-contribution-amount">Amount (CAD)</label>
        <input id="fund-contribution-amount" inputMode="decimal" value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} placeholder="250.00" />
        <button className="primary" type="button" onClick={() => onCommand((current) => proposeHouseholdFundContribution(current, { memberId, contributorMemberId: memberId, amount: contributionAmount, date: today }))}>
          Propose contribution
        </button>
        {pending.map((event) => (
          <div className="row" key={event.id}>
            <span>{household.members.find((row) => row.id === event.contributorMemberId)?.name ?? "Member"} · {formatCad(event.amountCents)}</span>
            {isCustodian ? <button className="primary" type="button" onClick={() => onCommand((current) => confirmHouseholdFundContribution(current, { memberId, proposalEventId: event.id }))}>Confirm received</button> : <span className="muted">Waiting for Bianca</span>}
          </div>
        ))}
        </details>
      </section>

      {isCustodian && (
        <section className="card">
          <details>
            <summary>Plan target and confirm a transfer</summary>
          <header><h2>Plan and transfer</h2><span className="muted">Bianca confirms clearing</span></header>
          <p className="muted">Suggested target from fund-backed spending, upcoming recurring bills, and the current buffer: {formatCad(suggestedTargetCents)}. A suggestion does not create money.</p>
          <label htmlFor="fund-monthly-target">Monthly target (CAD)</label>
          <input id="fund-monthly-target" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder={(suggestedTargetCents / 100).toFixed(2)} />
          <label htmlFor="fund-buffer">Keep-back buffer (CAD)</label>
          <input id="fund-buffer" inputMode="decimal" value={buffer} onChange={(event) => setBuffer(event.target.value)} />
          <button className="ghost" type="button" onClick={() => onCommand((current) => setHouseholdFundMonthPlan(current, { memberId, monthKey, target: target || suggestedTargetCents / 100, buffer }))}>Confirm monthly plan</button>
          <label htmlFor="fund-transfer-destination">Transfer destination</label>
          <select id="fund-transfer-destination" value={destination} onChange={(event) => { setDestination(event.target.value); setAllocationEdits({}); }}>
            <option value="">Choose an account</option>
            {sharedDestinations.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <label htmlFor="fund-transfer-amount">Transferred amount (CAD)</label>
          <input id="fund-transfer-amount" inputMode="decimal" value={settlementAmount} onChange={(event) => { setSettlementAmount(event.target.value); setAllocationEdits({}); }} />
          {eligibleSettlements.length > 0 && (
            <div className="fund-allocation-editor" aria-label="Settlement allocation">
              <strong>Allocation preview</strong>
              {eligibleSettlements.map((position) => {
                const tx = transactionForPosition(position.transactionId);
                return (
                  <label className="row" key={position.transactionId}>
                    <span>{tx?.date} · {tx?.note || position.transactionId} · due {formatCad(position.outstandingCents)}</span>
                    <input
                      aria-label={`Allocate to ${position.transactionId}`}
                      inputMode="decimal"
                      value={allocationEdits[position.transactionId] ?? defaultAllocations[position.transactionId] ?? ""}
                      onChange={(event) => setAllocationEdits((current) => ({ ...current, [position.transactionId]: event.target.value }))}
                    />
                  </label>
                );
              })}
            </div>
          )}
          <button className="primary" type="button" onClick={() => onCommand((current) => confirmHouseholdFundSettlement(current, {
            memberId,
            amount: settlementAmount,
            destinationAccountId: destination,
            date: today,
            allocations: eligibleSettlements.map((position) => ({
              transactionId: position.transactionId,
              amount: allocationEdits[position.transactionId] ?? defaultAllocations[position.transactionId] ?? "0",
            })).filter((row) => Number(row.amount) > 0),
          }))}>
            Confirm Transferred
          </button>
          <p className="muted">The default allocation clears the oldest unsettled items for this destination. Edit the amount to make a partial transfer.</p>
          </details>
        </section>
      )}

      {isCustodian && view === "personal" && (
        <section className="card">
          <details>
            <summary>Private reconciliation (Personal envelope)</summary>
          <header><h2>Bianca’s private reconciliation</h2><span className="muted">Jonathan sees only whether it ties</span></header>
          <label htmlFor="fund-bank-total">Bianca’s savings total (CAD)</label>
          <input id="fund-bank-total" inputMode="decimal" value={bankTotal} onChange={(event) => setBankTotal(event.target.value)} />
          <label htmlFor="fund-personal-remainder">Personal remainder (CAD)</label>
          <input id="fund-personal-remainder" inputMode="decimal" value={personalRemainder} onChange={(event) => setPersonalRemainder(event.target.value)} />
          <div className="row"><span>Fund amount</span><strong>{formatCad(projection.operatingBalanceCents)}</strong></div>
          <div className="row"><span>Kitty amount</span><strong>{formatCad(projection.kittyCents)}</strong></div>
          {latestPrivate && <div className="row"><span>Last unexplained difference</span><strong className={latestPrivate.differenceCents ? "negative" : ""}>{formatCad(latestPrivate.differenceCents)}</strong></div>}
          <button className="primary" type="button" onClick={() => onCommand((current) => recordHouseholdFundReconciliation(current, { memberId, date: today, bankTotal, personalRemainder: personalRemainder || undefined }))}>Confirm reconciliation</button>
          <hr />
          <label htmlFor="fund-backing-account">Private savings account used for checking</label>
          <select id="fund-backing-account" value={backingAccount} onChange={(event) => setBackingAccount(event.target.value)}>
            <option value="">Choose Personal savings</option>
            {privateSavings.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <button className="ghost" type="button" onClick={() => onCommand((current) => bindHouseholdFundBackingAccount(current, { memberId, accountId: backingAccount }))}>Save private backing account</button>
          </details>
        </section>
      )}

      {isCustodian && (
        <section className="card">
          <details>
            <summary>Confirm a safe Kitty rollover</summary>
          <header><h2>Month-end Kitty rollover</h2><span className="muted">Safe surplus {formatCad(projection.safeRolloverCents)}</span></header>
          <p className="muted">No bank transfer occurs. Operating plus Kitty remains conserved.</p>
          <label htmlFor="fund-kitty-goal">Existing Kitty Bank</label>
          <select id="fund-kitty-goal" value={kittyGoal} onChange={(event) => setKittyGoal(event.target.value)}>
            <option value="">Choose a shared goal</option>
            {household.goals.filter((goal) => goal.shared && goal.status !== "retired").map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
          </select>
          <label htmlFor="fund-kitty-amount">Rollover amount (CAD)</label>
          <input id="fund-kitty-amount" inputMode="decimal" value={kittyAmount} onChange={(event) => setKittyAmount(event.target.value)} />
          <button className="primary" type="button" onClick={() => onCommand((current) => allocateHouseholdFundSurplus(current, { memberId, date: today, allocations: [{ goalId: kittyGoal, amount: kittyAmount }] }))}>Confirm rollover once</button>
          </details>
        </section>
      )}

      <section className="card">
        <header><h2>Fund books</h2><span className="muted">Append-only audit links</span></header>
        <div className="grid fund-books-summary">
          <div className="stat"><span>Opening operating</span><strong>{formatCad(openingOperatingCents)}</strong></div>
          <div className="stat"><span>Contributions</span><strong>{formatCad(monthContributionsCents)}</strong></div>
          <div className="stat"><span>Fund-backed purchases</span><strong>{formatCad(monthPurchasesCents)}</strong></div>
          <div className="stat"><span>Refunds</span><strong>{formatCad(monthRefundsCents)}</strong></div>
          <div className="stat"><span>Transfers and partial settlements</span><strong>{formatCad(monthTransfersCents)}</strong></div>
          <div className="stat"><span>Kitty movement</span><strong>{formatCad(monthKittyNetCents)}</strong></div>
          <div className="stat"><span>Closing operating</span><strong>{formatCad(projection.operatingBalanceCents)}</strong></div>
          <div className="stat"><span>{projection.topUpNeededCents ? "Deficit / top-up" : "Transfer credit"}</span><strong>{formatCad(projection.topUpNeededCents || projection.transferCreditCents)}</strong></div>
        </div>
        {events.length ? events.map((event) => (
          <div className="row" key={event.id}>
            <span>{event.date} · {event.kind.replaceAll("-", " ")} · audit {event.id}{event.relatedEventId ? ` → ${event.relatedEventId}` : ""}</span>
            <strong>{formatCad(event.amountCents)}</strong>
          </div>
        )) : <p className="muted">No Fund events yet.</p>}
      </section>
    </div>
  );
}
