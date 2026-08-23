import { ACCOUNTS_EMPTY, accountsDeskFacts, formatCad, formatDateLabel } from "../core/index.ts";
import type { Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";
import type { Account } from "../core/index.ts";

export function AccountsGlance({ household, today }: { household: Household; today: DateKey }) {
  const facts = accountsDeskFacts(household, today);
  if (facts.empty) return <span>accounts</span>;
  return <span>{facts.glance}</span>;
}

export function AccountsBody({
  household,
  today,
  onPayCard,
  onOpenAccount,
}: {
  household: Household;
  today: DateKey;
  onPayCard: (account: Account) => void;
  onOpenAccount: (accountId: string) => void;
}) {
  const facts = accountsDeskFacts(household, today);
  const { wallet } = facts;
  if (facts.empty) {
    return <p className="muted">{ACCOUNTS_EMPTY}</p>;
  }
  return (
    <>
      <div className="row">
        <span>Net on the books</span>
        <span>{formatCad(wallet.netWorthCents)}</span>
      </div>
      <div className="row">
        <span>Cash</span>
        <span>{formatCad(wallet.cashCents)}</span>
      </div>
      {wallet.owedCents > 0 && (
        <div className="row">
          <span>Cards owed</span>
          <span>{formatCad(wallet.owedCents)}</span>
        </div>
      )}
      {wallet.tiles.map((tile) => {
        const last = facts.lastByAccount.find((row) => row.tile.account.id === tile.account.id)?.last;
        const credit = tile.credit;
        return (
          <button
            key={tile.account.id}
            type="button"
            className="account-tile"
            onClick={() => onOpenAccount(tile.account.id)}
          >
            <div className="row">
              <span>{tile.account.name}</span>
              <span>{formatCad(tile.displayCents)}</span>
            </div>
            <p className="muted">
              {tile.sub}
              {credit ? ` · due in ${credit.daysUntilDue}d` : ""}
              {last ? ` · ${last.note || last.type} ${formatDateLabel(last.date)}` : " · no posts yet"}
            </p>
            {credit?.utilization != null && (
              <div className="jar-fill" aria-hidden="true"><i style={{ width: `${Math.min(100, credit.utilization * 100)}%` }} /></div>
            )}
          </button>
        );
      })}
      <p className="muted">Recent posts</p>
      {facts.recent.length === 0 ? (
        <p className="muted">Nothing posted yet. Confirm still writes from Add.</p>
      ) : facts.recent.map((tx) => (
        <div className="row" key={tx.id}>
          <span>{formatDateLabel(tx.date)} · {tx.note || tx.type}</span>
          <span>{formatCad(tx.amountCents)}</span>
        </div>
      ))}
      {wallet.hottestCard && (
        <button type="button" className="primary" onClick={() => onPayCard(wallet.hottestCard!.account)}>
          Pay {wallet.hottestCard.account.name}
        </button>
      )}
      <p className="muted">Mint tiles, YNAB remaining. No bank feed. Confirm still posts.</p>
    </>
  );
}