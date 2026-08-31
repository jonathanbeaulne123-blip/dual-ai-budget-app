import { useMemo } from "react";
import {
  ACCOUNT_KIND_LABEL,
  formatCad,
  walletForListedAccounts,
  type Account,
  type Household,
} from "./core/index.ts";

/** Books-floor account picker. Quotes accepted books. Never posts. */
export function AddAccountTiles({
  booksHousehold,
  accounts,
  today,
  selectedId,
  onSelect,
  excludeId,
}: {
  booksHousehold: Household;
  accounts: Account[];
  today: string;
  selectedId: string;
  onSelect: (accountId: string) => void;
  excludeId?: string;
}) {
  const wallet = useMemo(
    () => walletForListedAccounts(booksHousehold, accounts.map((account) => account.id), today),
    [booksHousehold, accounts, today],
  );
  if (wallet.groups.length === 0) {
    return <p className="muted">No rooms on this folio yet.</p>;
  }
  return (
    <div className="add-account-floor books-floor" data-add-account-tiles>
      {wallet.groups.map((group) => (
        <div key={group.kind} className="wallet-group">
          <p className="wallet-group-label">{group.label}</p>
          <div className="wallet-tiles">
            {group.tiles.map((tile) => {
              const disabled = Boolean(excludeId && tile.account.id === excludeId);
              const selected = selectedId === tile.account.id;
              const util = tile.credit?.utilization;
              return (
                <button
                  key={tile.account.id}
                  type="button"
                  className={`wallet-tile ${tile.tone} ${selected ? "selected" : ""}`}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={`${ACCOUNT_KIND_LABEL[tile.kind]} ${tile.account.name}`}
                  onClick={() => onSelect(tile.account.id)}
                >
                  <span className="wallet-tile-kind">{ACCOUNT_KIND_LABEL[tile.kind]}</span>
                  <strong>{tile.account.name}</strong>
                  <span className={`wallet-tile-money ${tile.displayCents < 0 ? "negative" : ""}`}>
                    {formatCad(tile.kind === "credit" ? tile.balanceCents : tile.displayCents)}
                  </span>
                  <span className="muted">{disabled ? "Already chosen as the other room" : tile.sub}</span>
                  {util != null && (
                    <span className="util-bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, Math.round(util * 100))}%` }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
