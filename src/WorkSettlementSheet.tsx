import { useState } from "react";
import { CadPad } from "./CadPad.tsx";
import { dollarsFromCentsDigits, formatCad, type Household, type WorkOwedFact } from "./core/index.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";

export function WorkSettlementSheet({ household, fact, busy, onCancel, onConfirm }: {
  household: Household;
  fact: WorkOwedFact;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (input: { amount: string; accountId: string; date: string }) => void;
}) {
  const job = household.workJobs.find((row) => row.id === fact.jobId);
  const [digits, setDigits] = useState(String(fact.amountCents));
  const [accountId, setAccountId] = useState(fact.destinationAccountId || fact.accountId);
  const [date, setDate] = useState(fact.date);
  const cents = Number(digits || 0);
  const accounts = household.accounts.filter((account) => account.active && (account.kind === "chequing" || account.kind === "savings" || account.kind === "other"));
  const over = cents > fact.amountCents;
  const receiving = fact.kind !== "deferred-tipout";
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="work-settlement-title">
      <div className="sheet-inner work-settlement-sheet">
        <div className="topbar"><h1 id="work-settlement-title">{fact.kind === "wages" ? "Confirm paycheck" : fact.kind === "card-tips" ? "Confirm tips" : "Pay deferred tip-out"}</h1><button className="ghost" type="button" onClick={onCancel}>Close</button></div>
        <p className="kicker">{job?.name ?? "Work"} · recorded {receiving ? "owed to you" : "waiting to be paid"}</p>
        <CadPad digits={digits} onDigits={setDigits} label={receiving ? "Amount received" : "Amount paid"} maxCents={fact.amountCents} />
        <label>{receiving ? "Money landed in" : "Paid from"}<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <div className={`preview ${over ? "warn" : ""}`}>
          <div className="row"><span>Recorded waiting</span><strong>{formatCad(fact.amountCents)}</strong></div>
          <div className="row"><span>{receiving ? "Received now" : "Paid now"}</span><strong>{formatCad(cents)}</strong></div>
          {cents < fact.amountCents && <p className="muted">The remaining {formatCad(fact.amountCents - cents)} stays open and Calendar will keep reminding you.</p>}
          {receiving && <p className="muted">This is a transfer from {fact.kind === "wages" ? "Wages owed" : "Card tips owed"}, not income again.</p>}
        </div>
        {over ? <KitchenNotice message="The amount cannot be more than Hearth currently records as waiting." /> : null}
        <button type="button" className="primary post-big" disabled={busy || cents <= 0 || over || !accountId} onClick={() => onConfirm({ amount: dollarsFromCentsDigits(digits), accountId, date })}>Confirm {receiving ? "received" : "paid"}</button>
      </div>
    </div>
  );
}
