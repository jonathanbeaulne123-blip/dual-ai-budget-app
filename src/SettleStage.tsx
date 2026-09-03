import { useEffect, useId, useState, type Ref } from "react";
import {
  confirmHouseholdFundSettlement,
  formatCad,
  formatDateLabel,
  parseWholeCents,
  settleView,
  type CommitResult,
  type DateKey,
  type Household,
  type SettleOut,
} from "./core/index.ts";

function SettleOutRow({
  row, memberId, today, busy, canSettle, onKitchen,
}: {
  row: SettleOut;
  memberId: string;
  today: DateKey;
  busy: boolean;
  canSettle: boolean;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
}) {
  const inputId = useId();
  // A due amount is not evidence that an external transfer happened. Keep the
  // confirmation blank until the custodian types the amount actually moved.
  const [amount, setAmount] = useState("");
  let amountCents: number | null = null;
  try {
    amountCents = parseWholeCents(amount, "Transferred amount");
  } catch {
    amountCents = null;
  }
  const validAmount = amountCents !== null && amountCents <= row.dueCents;

  useEffect(() => {
    setAmount("");
  }, [row.dueCents]);

  return (
    <li className="settle-row">
      <div className="settle-row-summary">
        <strong>
          {row.dueCents > 0
            ? `The Fund owes ${row.name} ${formatCad(row.dueCents)}.`
            : `The Fund has ${formatCad(row.creditCents)} credit at ${row.name}.`}
        </strong>
        <span className="muted">
          {row.transactionIds.length > 0
            ? `${row.transactionIds.length} payable ${row.transactionIds.length === 1 ? "purchase" : "purchases"} · oldest ${formatDateLabel(row.oldestDate)}`
            : "Credit already reflected in the Fund books"}
        </span>
      </div>
      {canSettle && row.dueCents > 0 ? (
        <div className="settle-confirm">
          <label htmlFor={inputId}>Transferred amount (CAD)</label>
          <input
            id={inputId}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={busy || !validAmount}
            onClick={() => onKitchen((current) => confirmHouseholdFundSettlement(current, {
              memberId,
              amount,
              destinationAccountId: row.destinationAccountId,
              date: today,
            }))}
          >
            Confirm transferred {validAmount ? formatCad(amountCents ?? 0) : "amount"} to {row.name}
          </button>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The Shared settlement stage. Both members see the same directional facts;
 * only the existing custodian receives a visible path to the existing
 * settlement command.
 */
export function SettleStage({
  household, memberId, today, busy, onKitchen, headingRef,
}: {
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const headingId = useId();
  const view = settleView(household, memberId, today);

  return (
    <section className="settle-stage" aria-labelledby={headingId}>
      <p className="desk-plate-kicker">To settle</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">
        {view.outTotalCents > 0 ? `${formatCad(view.outTotalCents)} to accounts` : "Nothing to transfer"}
      </h2>
      <p className="desk-plate-detail">
        The card fronted it; the Fund settles it. These are account obligations, never a person's debt.
      </p>

      <section className="settle-direction" aria-labelledby={`${headingId}-out`}>
        <div className="settle-direction-head">
          <h3 id={`${headingId}-out`}>The Fund owes back</h3>
          <strong>{formatCad(view.outTotalCents)}</strong>
        </div>
        {view.out.length > 0 ? (
          <ul className="settle-rows">
            {view.out.map((row) => (
              <SettleOutRow
                key={row.destinationAccountId}
                row={row}
                memberId={memberId}
                today={today}
                busy={busy}
                canSettle={view.custodianCanSettle}
                onKitchen={onKitchen}
              />
            ))}
          </ul>
        ) : (
          <p className="desk-plate-empty">The Fund owes no shared account right now.</p>
        )}
      </section>

      <section className="settle-direction" aria-labelledby={`${headingId}-in`}>
        <div className="settle-direction-head">
          <h3 id={`${headingId}-in`}>Owed to the household</h3>
          <strong>{formatCad(view.inTotalCents)}</strong>
        </div>
        {view.in.length > 0 ? (
          <ul className="settle-rows">
            {view.in.map((row) => (
              <li key={row.claimId} className="settle-row">
                <div className="settle-row-summary">
                  <strong>{row.label}</strong>
                  <span className="muted">Since {formatDateLabel(row.sinceDate)}</span>
                </div>
                <strong>{formatCad(row.remainingCents)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="desk-plate-empty">No Shared claim is waiting to come back.</p>
        )}
      </section>
    </section>
  );
}
