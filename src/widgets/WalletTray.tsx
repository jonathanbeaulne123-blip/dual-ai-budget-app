import { formatCad, formatDateLabel } from "../core/index.ts";
import { walletWarn } from "../core/officeFacts.ts";
import type { Account, CreditCardView, HouseholdWallet } from "../core/index.ts";

export function WalletGlance({ wallet }: { wallet: HouseholdWallet }) {
  const hot = wallet.hottestCard;
  return (
    <span>
      {hot ? hot.account.name : "Wallet"}
      {" · "}
      {formatCad(wallet.cashCents)}
      {wallet.owedCents ? ` · ${formatCad(wallet.owedCents)}` : ""}
    </span>
  );
}

export function WalletBody({
  wallet,
  onPayCard,
  onOpenAccount,
}: {
  wallet: HouseholdWallet;
  onPayCard: (account: Account) => void;
  onOpenAccount: (accountId: string) => void;
}) {
  const hot = wallet.hottestCard;
  const warn = walletWarn(wallet);
  if (wallet.tiles.length <= 1) {
    const tile = wallet.tiles[0];
    return (
      <p>
        {tile ? `${tile.account.name} · ${formatCad(tile.displayCents)}` : "No accounts on the tray."}
      </p>
    );
  }
  return (
    <>
      {warn && hot?.daysUntilDue != null && hot.daysUntilDue < 0 && <span className="wallet-tab" aria-hidden="true" />}
      {wallet.groups.map((group) => (
        <div key={group.kind}>
          <p className="muted">{group.label}</p>
          {group.tiles.map((tile) => (
            <button
              key={tile.account.id}
              type="button"
              className="row"
              style={{ width: "100%", border: 0, background: "transparent", padding: "8px 0" }}
              onClick={() => onOpenAccount(tile.account.id)}
            >
              <span>{tile.account.name}</span>
              <span>{formatCad(tile.displayCents)}</span>
            </button>
          ))}
        </div>
      ))}
      {hot && <CardRoom card={hot} onPay={() => onPayCard(hot.account)} />}
    </>
  );
}

function CardRoom({ card, onPay }: { card: CreditCardView; onPay: () => void }) {
  const pct = card.utilization == null ? "" : `${Math.round(card.utilization * 100)}% used`;
  return (
    <div className="preview">
      <p className="wallet-hot">{card.account.name}</p>
      <div className="row"><span>Statement</span><span>{formatCad(card.statementBalanceCents)}</span></div>
      <div className="row"><span>Minimum</span><span>{formatCad(card.minPaymentCents)}</span></div>
      <div className="row"><span>Due</span><span>{formatDateLabel(card.dueDate)}</span></div>
      {pct && <p className="muted">{pct}</p>}
      <button type="button" className="primary" onClick={onPay}>Pay card</button>
      <p className="muted">Opens a transfer. Confirm still posts.</p>
    </div>
  );
}
