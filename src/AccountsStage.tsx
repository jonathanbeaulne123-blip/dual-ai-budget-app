import { useId, type Ref } from "react";
import {
  accountRows,
  chosenAccount,
  formatCad,
  setGlanceAccount,
  type AccountRow,
  type CommitResult,
  type DateKey,
  type Household,
} from "./core/index.ts";

/**
 * Every Shared account, with one member-owned glance choice. Personal rooms
 * remain on Personal Books. Clicking a row opens that Shared account's own
 * books; this widget never draws a ledger or adds balances together.
 */

function ScopeGroup({
  title, rows, chosenId, onOpenAccount, onChoose,
}: {
  title: string;
  rows: AccountRow[];
  chosenId: string | null;
  onOpenAccount: (accountId: string) => void;
  onChoose: (accountId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="accounts-stage-group">
      <p className="desk-plate-kicker">{title}</p>
      {rows.map((row) => (
        <div key={row.accountId} className={`accounts-stage-row${row.accountId === chosenId ? " is-chosen" : ""}`}>
          <button type="button" className="accounts-stage-open" onClick={() => onOpenAccount(row.accountId)}>
            <span className="accounts-stage-name">
              <span className="accounts-stage-name-copy">
                {row.name}
                {row.detailLabel ? <small>{row.detailLabel}</small> : null}
              </span>
              {row.isFundCard ? <span className="accounts-stage-badge">Fund card</span> : null}
            </span>
            <span className="accounts-stage-balance">{formatCad(row.balanceCents)} {row.balanceLabel}</span>
          </button>
          {row.utilization !== null ? (
            <div
              className="accounts-stage-gauge"
              role="img"
              aria-label={`${row.accessibilityName}: ${Math.round(row.utilization * 100)}% of limit used`}
            >
              <div
                className="accounts-stage-gauge-fill"
                style={{ width: `${Math.min(100, Math.round(row.utilization * 100))}%` }}
              />
            </div>
          ) : null}
          <button
            type="button"
            className="accounts-stage-choose"
            aria-pressed={row.accountId === chosenId}
            aria-label={row.accountId === chosenId
              ? `Showing ${row.accessibilityName} at a glance`
              : `Show ${row.accessibilityName} at a glance`}
            onClick={() => onChoose(row.accountId)}
            disabled={row.accountId === chosenId}
          >
            {row.accountId === chosenId ? "Showing at a glance" : "Show at a glance"}
          </button>
        </div>
      ))}
    </div>
  );
}

export function AccountsStage({
  household, memberId, today, onOpenAccount, onKitchen, headingRef,
}: {
  household: Household;
  memberId: string;
  today: DateKey;
  onOpenAccount: (accountId: string) => void;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const headingId = useId();
  const rows = accountRows(household, memberId, today);
  const chosen = chosenAccount(household, memberId, today);

  function choose(accountId: string) {
    onKitchen((current) => setGlanceAccount(current, { memberId, accountId, createdBy: memberId }));
  }

  return (
    <section className="accounts-stage" aria-labelledby={headingId}>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">
        {chosen ? chosen.name : "The accounts"}
      </h2>
      {rows.length === 0 ? (
        <p className="desk-plate-empty">No accounts on this floor yet.</p>
      ) : (
        <>
          <ScopeGroup
            title="Shared"
            rows={rows}
            chosenId={chosen?.accountId ?? null}
            onOpenAccount={onOpenAccount}
            onChoose={choose}
          />
        </>
      )}
      <p className="desk-plate-foot">
        Shared accounts only. Personal account rooms stay on Personal Books, and balances are never added together.
      </p>
    </section>
  );
}
