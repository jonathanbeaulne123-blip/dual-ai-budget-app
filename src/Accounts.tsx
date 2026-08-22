import { useMemo, useState } from "react";
import {
  ACCOUNT_KIND_HINT,
  ACCOUNT_KIND_LABEL,
  ACCOUNT_KINDS,
  INVESTMENT_VEHICLES,
  accountActivity,
  accountOptionLabel,
  addAccount,
  archiveAccount,
  categoryName,
  formatApr,
  formatCad,
  formatDateLabel,
  householdWallet,
  markInvestmentValue,
  postCardInterest,
  postCardRewards,
  postSavingsInterest,
  updateAccount,
  type Account,
  type AccountKind,
  type CommitResult,
  type Household,
  type InvestmentVehicle,
  type UndoToken,
  type WalletTile,
} from "./core/index.ts";

export function WalletStrip({
  household,
  today,
  focusedId,
  onOpen,
}: {
  household: Household;
  today: string;
  focusedId?: string | null;
  onOpen: (accountId: string) => void;
}) {
  const wallet = useMemo(() => householdWallet(household, today), [household, today]);
  return (
    <section className="wallet-strip">
      <header>
        <h2>Wallet</h2>
        <span className="muted">
          Cash {formatCad(wallet.cashCents)}
          {wallet.receivableCents ? ` · owed ${formatCad(wallet.receivableCents)}` : ""}
          {wallet.owedCents ? ` · cards ${formatCad(wallet.owedCents)}` : ""}
          {wallet.investedCostCents ? ` · invested ${formatCad(wallet.investedMarkedCents ?? wallet.investedCostCents)}` : ""}
        </span>
      </header>
      {wallet.groups.map((group) => (
        <div key={group.kind} className="wallet-group">
          <p className="wallet-group-label">{group.label}</p>
          <div className="wallet-tiles">
            {group.tiles.map((tile) => (
              <WalletTileButton
                key={tile.account.id}
                tile={tile}
                selected={focusedId === tile.account.id}
                onOpen={() => onOpen(tile.account.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function WalletTileButton({
  tile,
  selected,
  onOpen,
}: {
  tile: WalletTile;
  selected: boolean;
  onOpen: () => void;
}) {
  const util = tile.credit?.utilization;
  return (
    <button
      type="button"
      className={`wallet-tile ${tile.tone} ${selected ? "selected" : ""}`}
      onClick={onOpen}
    >
      <span className="wallet-tile-kind">{ACCOUNT_KIND_LABEL[tile.kind]}</span>
      <strong>{tile.account.name}</strong>
      <span className={`wallet-tile-money ${tile.displayCents < 0 ? "negative" : ""}`}>
        {formatCad(tile.kind === "credit" ? tile.balanceCents : tile.displayCents)}
      </span>
      <span className="muted">{tile.sub}</span>
      {util != null && (
        <span className="util-bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, Math.round(util * 100))}%` }} />
        </span>
      )}
    </button>
  );
}

export function AccountRoom({
  household,
  accountId,
  today,
  memberId,
  onChange,
  onPay,
  onAdd,
}: {
  household: Household;
  accountId: string;
  today: string;
  memberId: string;
  onChange: (household: Household, undo?: UndoToken) => void;
  onPay: (account: Account) => void;
  onAdd: (account: Account) => void;
}) {
  const account = household.accounts.find((row) => row.id === accountId);
  const wallet = useMemo(() => householdWallet(household, today), [household, today]);
  const tile = wallet.tiles.find((row) => row.account.id === accountId);
  const activity = useMemo(() => accountActivity(household, accountId).slice(0, 24), [household, accountId]);
  const [error, setError] = useState("");
  const [mark, setMark] = useState("");
  const [terms, setTerms] = useState({
    limit: "",
    apr: "",
    cashback: "",
    apy: "",
  });

  if (!account || !tile) {
    return <p className="muted">That account is gone.</p>;
  }

  function run(fn: (current: Household) => CommitResult) {
    try {
      const result = fn(household);
      setError("");
      onChange(result.household, result.undo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  const credit = tile.credit;
  const savings = tile.savings;
  const investment = tile.investment;

  return (
    <section className="card account-room">
      <header>
        <h2>{account.name}</h2>
        <span className="muted">{accountOptionLabel(account)}</span>
      </header>
      <div className={`money ${tile.displayCents < 0 ? "negative" : ""}`}>
        {formatCad(account.kind === "credit" ? tile.balanceCents : tile.displayCents)}
      </div>
      <p className="muted">{tile.sub}. {ACCOUNT_KIND_HINT[account.kind]}</p>

      {credit && (
        <div className="card-desk">
          {credit.utilization != null && (
            <div className="util-bar tall" aria-hidden="true">
              <i style={{ width: `${Math.min(100, Math.round(credit.utilization * 100))}%` }} />
            </div>
          )}
          <div className="row"><span>Owed</span><strong>{formatCad(credit.owedCents)}</strong></div>
          <div className="row"><span>Available</span><span>{credit.limitCents ? formatCad(credit.availableCents) : "no limit yet"}</span></div>
          <div className="row"><span>APR</span><span>{formatApr(credit.aprBps)}</span></div>
          <div className="row"><span>Statement</span><span>{formatDateLabel(credit.statementDate)}</span></div>
          <div className="row"><span>Due</span><span>{formatDateLabel(credit.dueDate)}</span></div>
          <div className="row"><span>Minimum</span><span>{formatCad(credit.minPaymentCents)}</span></div>
          <div className="row"><span>Est. interest</span><span>{formatCad(credit.estimatedInterestCents)}</span></div>
          <div className="row"><span>{credit.rewardsName} this cycle</span><span>{formatCad(credit.cashbackCycleCents)}</span></div>
          <p className="muted">{credit.hercules}</p>
          <div className="chips">
            <button className="chip" type="button" onClick={() => onPay(account)}>Pay this card</button>
            <button className="chip" type="button" onClick={() => onAdd(account)}>Add on this card</button>
            <button className="chip" type="button" onClick={() => run((current) => postCardInterest(current, { accountId: account.id, createdBy: memberId }))}>
              Post estimated interest
            </button>
            <button className="chip" type="button" onClick={() => run((current) => postCardRewards(current, { accountId: account.id, as: "statement-credit", createdBy: memberId }))}>
              Post {credit.rewardsName} to card
            </button>
            <button className="chip" type="button" onClick={() => run((current) => postCardRewards(current, { accountId: account.id, as: "deposit", createdBy: memberId }))}>
              Deposit {credit.rewardsName}
            </button>
          </div>
          <details>
            <summary>Card terms</summary>
            <label>Limit (CAD)</label>
            <input inputMode="decimal" value={terms.limit} placeholder={String(credit.limitCents / 100)} onChange={(event) => setTerms({ ...terms, limit: event.target.value })} />
            <label>APR %</label>
            <input inputMode="decimal" value={terms.apr} placeholder={formatApr(credit.aprBps).replace("%", "")} onChange={(event) => setTerms({ ...terms, apr: event.target.value })} />
            <label>Default cashback %</label>
            <input inputMode="decimal" value={terms.cashback} placeholder={String((account.credit?.defaultCashbackBps ?? 100) / 100)} onChange={(event) => setTerms({ ...terms, cashback: event.target.value })} />
            <button
              className="ghost"
              type="button"
              onClick={() => run((current) => updateAccount(current, {
                accountId: account.id,
                creditLimit: terms.limit || undefined,
                aprPercent: terms.apr || undefined,
                cashbackPercent: terms.cashback || undefined,
              }))}
            >
              Save terms
            </button>
          </details>
        </div>
      )}

      {savings && (
        <div className="card-desk">
          <div className="row"><span>APY</span><span>{formatApr(savings.apyBps)}</span></div>
          <div className="row"><span>Est. monthly interest</span><span>{formatCad(savings.estimatedMonthlyInterestCents)}</span></div>
          <p className="muted">{savings.hercules}</p>
          <div className="chips">
            <button className="chip" type="button" onClick={() => onAdd(account)}>Move in</button>
            <button className="chip" type="button" onClick={() => run((current) => postSavingsInterest(current, { accountId: account.id, createdBy: memberId }))}>
              Post estimated interest
            </button>
          </div>
          <label>APY %</label>
          <input inputMode="decimal" value={terms.apy} placeholder={formatApr(savings.apyBps).replace("%", "")} onChange={(event) => setTerms({ ...terms, apy: event.target.value })} />
          <button className="ghost" type="button" onClick={() => run((current) => updateAccount(current, { accountId: account.id, apyPercent: terms.apy }))}>
            Save APY
          </button>
        </div>
      )}

      {investment && (
        <div className="card-desk">
          <div className="row"><span>Vehicle</span><span>{investment.vehicle.toUpperCase()}</span></div>
          <div className="row"><span>Cost basis</span><span>{formatCad(investment.costBasisCents)}</span></div>
          <div className="row"><span>Marked</span><span>{investment.markedValueCents == null ? "not marked" : formatCad(investment.markedValueCents)}</span></div>
          {investment.unrealizedCents != null && (
            <div className="row"><span>Unrealized</span><span>{formatCad(investment.unrealizedCents)}</span></div>
          )}
          <p className="muted">{investment.hercules}</p>
          <label>Mark market value (CAD)</label>
          <input inputMode="decimal" value={mark} onChange={(event) => setMark(event.target.value)} placeholder="0.00" />
          <div className="chips">
            <button className="chip" type="button" onClick={() => onAdd(account)}>Contribute</button>
            <button className="chip" type="button" onClick={() => run((current) => markInvestmentValue(current, { accountId: account.id, markedValue: mark, markedAt: today }))}>
              Mark value
            </button>
          </div>
        </div>
      )}

      {!credit && !savings && !investment && (
        <div className="chips">
          <button className="chip" type="button" onClick={() => onAdd(account)}>Add to this account</button>
        </div>
      )}

      {error && <p className="danger">{error}</p>}

      <header style={{ marginTop: 16 }}>
        <h3>Activity</h3>
        <span className="muted">{activity.length ? "This account" : "Nothing posted yet"}</span>
      </header>
      {activity.map((tx) => (
        <div className="row" key={tx.id}>
          <span>
            {formatDateLabel(tx.date)} · {tx.note || tx.place || categoryName(household, tx.subcategoryId) || tx.type}
          </span>
          <span>{formatCad(tx.amountCents)}</span>
        </div>
      ))}

      {household.accounts.filter((row) => row.active).length > 1 && (
        <button className="ghost" type="button" style={{ marginTop: 12 }} onClick={() => run((current) => archiveAccount(current, account.id))}>
          Archive this account
        </button>
      )}
    </section>
  );
}

export function AddAccountForm({
  household,
  onSave,
}: {
  household: Household;
  onSave: (household: Household, undo?: UndoToken) => void;
}) {
  const [kind, setKind] = useState<AccountKind>("credit");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [last4, setLast4] = useState("");
  const [limit, setLimit] = useState("5000");
  const [apr, setApr] = useState("19.99");
  const [cashback, setCashback] = useState("1");
  const [grocery, setGrocery] = useState("3");
  const [apy, setApy] = useState("4.25");
  const [vehicle, setVehicle] = useState<InvestmentVehicle>("tfsa");
  const [error, setError] = useState("");

  return (
    <section className="card">
      <header>
        <h2>Open an account</h2>
        <span className="muted">Expandable. Not a feed.</span>
      </header>
      <p className="muted">Chequing, savings, as many cards as you hold, investments, money owed to us, or the jar. Interest and cashback never auto-post.</p>
      <label>Kind</label>
      <div className="chips">
        {ACCOUNT_KINDS.map((item) => (
          <button key={item} className={`chip ${kind === item ? "selected" : ""}`} type="button" onClick={() => setKind(item)}>
            {ACCOUNT_KIND_LABEL[item]}
          </button>
        ))}
      </div>
      <p className="muted">{ACCOUNT_KIND_HINT[kind]}</p>
      <label>Name</label>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "credit" ? "Amex Cobalt" : "Name"} />
      <label>Institution</label>
      <input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="TD, EQ, Wealthsimple…" />
      <label>Last 4</label>
      <input value={last4} onChange={(event) => setLast4(event.target.value)} inputMode="numeric" maxLength={4} />
      {kind === "credit" && (
        <>
          <label>Limit (CAD)</label>
          <input inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} />
          <label>APR %</label>
          <input inputMode="decimal" value={apr} onChange={(event) => setApr(event.target.value)} />
          <label>Default cashback %</label>
          <input inputMode="decimal" value={cashback} onChange={(event) => setCashback(event.target.value)} />
          <label>Grocery cashback %</label>
          <input inputMode="decimal" value={grocery} onChange={(event) => setGrocery(event.target.value)} />
        </>
      )}
      {kind === "savings" && (
        <>
          <label>APY %</label>
          <input inputMode="decimal" value={apy} onChange={(event) => setApy(event.target.value)} />
        </>
      )}
      {kind === "investment" && (
        <>
          <label>Vehicle</label>
          <select value={vehicle} onChange={(event) => setVehicle(event.target.value as InvestmentVehicle)}>
            {INVESTMENT_VEHICLES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </>
      )}
      {error && <p className="danger">{error}</p>}
      <button
        className="primary"
        type="button"
        onClick={() => {
          try {
            const result = addAccount(household, {
              name,
              kind,
              institution,
              last4,
              creditLimit: kind === "credit" ? limit : undefined,
              aprPercent: kind === "credit" ? apr : undefined,
              cashbackPercent: kind === "credit" ? cashback : undefined,
              groceryCashbackPercent: kind === "credit" ? grocery : undefined,
              apyPercent: kind === "savings" ? apy : undefined,
              vehicle: kind === "investment" ? vehicle : undefined,
            });
            setError("");
            setName("");
            onSave(result.household, result.undo);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : String(caught));
          }
        }}
      >
        Open {ACCOUNT_KIND_LABEL[kind].toLowerCase()}
      </button>
    </section>
  );
}

export function WalletPane({
  household,
  today,
  memberId,
  focusedId,
  onFocus,
  onChange,
  onPay,
  onAdd,
}: {
  household: Household;
  today: string;
  memberId: string;
  focusedId: string | null;
  onFocus: (accountId: string) => void;
  onChange: (household: Household, undo?: UndoToken) => void;
  onPay: (account: Account) => void;
  onAdd: (account: Account) => void;
}) {
  const selected = focusedId || household.accounts.find((account) => account.active)?.id || "";
  return (
    <>
      <WalletStrip household={household} today={today} focusedId={selected} onOpen={onFocus} />
      {selected && (
        <AccountRoom
          household={household}
          accountId={selected}
          today={today}
          memberId={memberId}
          onChange={onChange}
          onPay={onPay}
          onAdd={onAdd}
        />
      )}
      <AddAccountForm household={household} onSave={onChange} />
    </>
  );
}
