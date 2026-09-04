import { useEffect, useMemo, useState } from "react";
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
  walletForListedAccounts,
  markInvestmentValue,
  postCardInterest,
  postCardRewards,
  postSavingsInterest,
  isEligibleSwipeCard,
  resolveSwipeCardAccount,
  setFundCardAccount,
  updateAccount,
  type Account,
  type AccountKind,
  type CommitResult,
  type Household,
  type InvestmentVehicle,
  type SavingsPurpose,
  type UndoToken,
  type WalletTile,
} from "./core/index.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";
import { ConfirmSheet } from "./Confirm.tsx";
import { CollapsibleCard } from "./theme/PaperTheme.tsx";

export function WalletStrip({
  household,
  writeHousehold = household,
  today,
  focusedId,
  memberId,
  onOpen,
  onChange,
  onPay,
  onAdd,
}: {
  household: Household;
  writeHousehold?: Household;
  today: string;
  focusedId?: string | null;
  memberId?: string;
  onOpen: (accountId: string | null) => void;
  onChange?: (household: Household, undo?: UndoToken) => void;
  onPay?: (account: Account) => void;
  onAdd?: (account: Account) => void;
}) {
  const wallet = useMemo(
    () => walletForListedAccounts(writeHousehold, household.accounts.map((account) => account.id), today),
    [household, writeHousehold, today],
  );
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
            {group.tiles.map((tile) => {
              const expanded = focusedId === tile.account.id;
              return (
                <div
                  key={tile.account.id}
                  className={`wallet-tile-slot ${expanded ? "is-expanded" : ""}`}
                >
                  <WalletTileButton
                    tile={tile}
                    selected={expanded}
                    onOpen={() => onOpen(expanded ? null : tile.account.id)}
                  />
                  {expanded && memberId && onChange && onPay && onAdd && (
                    <AccountRoom
                      household={household}
                      writeHousehold={writeHousehold}
                      accountId={tile.account.id}
                      today={today}
                      memberId={memberId}
                      onChange={onChange}
                      onPay={onPay}
                      onAdd={onAdd}
                      embedded
                    />
                  )}
                </div>
              );
            })}
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
  writeHousehold = household,
  accountId,
  today,
  memberId,
  onChange,
  onPay,
  onAdd,
  embedded = false,
}: {
  household: Household;
  writeHousehold?: Household;
  accountId: string;
  today: string;
  memberId: string;
  onChange: (household: Household, undo?: UndoToken) => void;
  onPay: (account: Account) => void;
  onAdd: (account: Account) => void;
  embedded?: boolean;
}) {
  const account = household.accounts.find((row) => row.id === accountId)
    ?? writeHousehold.accounts.find((row) => row.id === accountId);
  const wallet = useMemo(
    () => walletForListedAccounts(writeHousehold, [accountId], today),
    [writeHousehold, accountId, today],
  );
  const tile = wallet.tiles.find((row) => row.account.id === accountId);
  const activity = useMemo(() => accountActivity(household, accountId).slice(0, 24), [household, accountId]);
  const [error, setError] = useState("");
  const [pendingPost, setPendingPost] = useState<
    | { kind: "card-interest" }
    | { kind: "card-rewards"; as: "statement-credit" | "deposit" }
    | { kind: "savings-interest" }
    | null
  >(null);
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
      const result = fn(writeHousehold);
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
    <section className={`account-room ${embedded ? "is-embedded" : "card"}`}>
      <header>
        <h2>{embedded ? "Details" : account.name}</h2>
        <span className="muted">{accountOptionLabel(account)}</span>
      </header>
      {!embedded && (
        <div className={`money ${tile.displayCents < 0 ? "negative" : ""}`}>
          {formatCad(account.kind === "credit" ? tile.balanceCents : tile.displayCents)}
        </div>
      )}
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
            <button className="chip" type="button" onClick={() => setPendingPost({ kind: "card-interest" })}>
              Post estimated interest
            </button>
            <button className="chip" type="button" onClick={() => setPendingPost({ kind: "card-rewards", as: "statement-credit" })}>
              Post {credit.rewardsName} to card
            </button>
            <button className="chip" type="button" onClick={() => setPendingPost({ kind: "card-rewards", as: "deposit" })}>
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
            <button
              className={`chip ${account.savings?.purpose === "general" ? "selected" : ""}`}
              type="button"
              onClick={() => run((current) => updateAccount(current, { accountId: account.id, purpose: "general" }))}
            >
              Everyday HIS
            </button>
            <button
              className={`chip ${account.savings?.purpose === "goals" ? "selected" : ""}`}
              type="button"
              onClick={() => run((current) => updateAccount(current, { accountId: account.id, purpose: "goals" }))}
            >
              Goals savings
            </button>
          </div>
          <p className="muted">
            {account.savings?.purpose === "goals"
              ? "Leftover goal cash parks here. Each goal tracks its share of this account — not extra bank logins."
              : "Everyday high-interest parking. Sit-down leftover for goals goes to Goals savings instead."}
          </p>
          <div className="chips">
            <button className="chip" type="button" onClick={() => onAdd(account)}>Move in</button>
            <button className="chip" type="button" onClick={() => setPendingPost({ kind: "savings-interest" })}>
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

      <KitchenNotice message={error} />

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
      {pendingPost ? (
        <ConfirmSheet
          title="Confirm this post"
          body={
            pendingPost.kind === "card-interest"
              ? `Post estimated interest of ${formatCad(credit?.estimatedInterestCents ?? 0)} on ${account.name}.`
              : pendingPost.kind === "savings-interest"
                ? `Post estimated interest of ${formatCad(savings?.estimatedMonthlyInterestCents ?? 0)} on ${account.name}.`
                : pendingPost.as === "deposit"
                  ? `Deposit ${credit?.rewardsName ?? "rewards"} from ${account.name} into cash.`
                  : `Post ${credit?.rewardsName ?? "rewards"} to ${account.name} as a statement credit.`
          }
          extra="Confirm writes this into the journal. Interest and cashback never post themselves."
          confirmLabel="Confirm"
          onCancel={() => setPendingPost(null)}
          onConfirm={() => {
            const next = pendingPost;
            setPendingPost(null);
            if (next.kind === "card-interest") {
              run((current) => postCardInterest(current, { accountId: account.id, createdBy: memberId }));
            } else if (next.kind === "savings-interest") {
              run((current) => postSavingsInterest(current, { accountId: account.id, createdBy: memberId }));
            } else {
              run((current) => postCardRewards(current, { accountId: account.id, as: next.as, createdBy: memberId }));
            }
          }}
        />
      ) : null}
    </section>
  );
}

export function AddAccountForm({
  household,
  writeHousehold = household,
  memberId,
  onSave,
  openRequest = 0,
}: {
  household: Household;
  writeHousehold?: Household;
  memberId: string;
  onSave: (household: Household, undo?: UndoToken) => void;
  openRequest?: number;
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
  const [purpose, setPurpose] = useState<SavingsPurpose>("general");
  const [vehicle, setVehicle] = useState<InvestmentVehicle>("tfsa");
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"shared" | "personal">("shared");
  const [open, setOpen] = useState(false);
  const sharedFundCards = useMemo(() => household.accounts
    .filter(isEligibleSwipeCard)
    .sort((left, right) => left.name.localeCompare(right.name)), [household.accounts]);
  const fundCard = resolveSwipeCardAccount(household, memberId);

  useEffect(() => {
    if (openRequest > 0) setOpen(true);
  }, [openRequest]);

  return (
    <CollapsibleCard
      title="Add an account"
      hint="Chequing, cards, investments"
      open={open}
      onToggle={setOpen}
    >
      <div className="add-account-form-fields">
      <p className="muted">Record chequing, savings, cards, investments, money owed to you, or Goals savings. Hearth does not open accounts or move money, and interest and cashback never auto-post.</p>
      {sharedFundCards.length > 0 ? (
        <fieldset className="account-fund-card-choice">
          <legend>Shared card for the Fund</legend>
          <p className="muted">Choose the Shared card that household purchases use. This records a default; it does not charge the card.</p>
          <div className="chips">
            {sharedFundCards.map((account) => {
              const selected = fundCard.kind === "ready" && fundCard.accountId === account.id;
              return (
                <button
                  key={account.id}
                  className={`chip ${selected ? "selected" : ""}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    const result = setFundCardAccount(writeHousehold, {
                      memberId,
                      accountId: account.id,
                      createdBy: memberId,
                    });
                    onSave(result.household, result.undo);
                  }}
                >
                  {selected ? `${account.name} selected` : `Use ${account.name}`}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <label>Who can see this account?</label>
      <div className="chips">
        <button className={`chip ${scope === "shared" ? "selected" : ""}`} type="button" onClick={() => setScope("shared")}>Household</button>
        <button className={`chip ${scope === "personal" ? "selected" : ""}`} type="button" onClick={() => setScope("personal")}>Only me</button>
      </div>
      <p className="muted">Personal account metadata, institution, last four digits, totals, and reconciliation stay in your Personal envelope.</p>
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
          <label>Purpose</label>
          <div className="chips">
            <button className={`chip ${purpose === "general" ? "selected" : ""}`} type="button" onClick={() => setPurpose("general")}>
              Everyday HIS
            </button>
            <button className={`chip ${purpose === "goals" ? "selected" : ""}`} type="button" onClick={() => setPurpose("goals")}>
              Goals savings
            </button>
          </div>
          <p className="muted">
            {purpose === "goals"
              ? "One sinking-fund account. Goals track their share here. Sit-down leftover parks here."
              : "Everyday savings. Goal leftover still prefers Goals savings if one exists."}
          </p>
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
      <KitchenNotice message={error} />
      <button
        className="primary"
        type="button"
        onClick={() => {
          try {
            const result = addAccount(writeHousehold, {
              name,
              kind,
              institution,
              last4,
              creditLimit: kind === "credit" ? limit : undefined,
              aprPercent: kind === "credit" ? apr : undefined,
              cashbackPercent: kind === "credit" ? cashback : undefined,
              groceryCashbackPercent: kind === "credit" ? grocery : undefined,
              apyPercent: kind === "savings" ? apy : undefined,
              purpose: kind === "savings" ? purpose : undefined,
              vehicle: kind === "investment" ? vehicle : undefined,
              scope,
              ownerMemberId: scope === "personal" ? memberId : undefined,
            });
            setError("");
            setName("");
            setOpen(false);
            onSave(result.household, result.undo);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : String(caught));
          }
        }}
      >
        Add {kind === "credit" ? "credit card" : ACCOUNT_KIND_LABEL[kind].toLowerCase()}
      </button>
      </div>
    </CollapsibleCard>
  );
}

export function WalletPane({
  household,
  writeHousehold = household,
  today,
  memberId,
  focusedId,
  onFocus,
  onChange,
  onPay,
  onAdd,
  accountFormOpenRequest = 0,
}: {
  household: Household;
  writeHousehold?: Household;
  today: string;
  memberId: string;
  focusedId: string | null;
  onFocus: (accountId: string | null) => void;
  onChange: (household: Household, undo?: UndoToken) => void;
  onPay: (account: Account) => void;
  onAdd: (account: Account) => void;
  accountFormOpenRequest?: number;
}) {
  return (
    <>
      <WalletStrip
        household={household}
        writeHousehold={writeHousehold}
        today={today}
        focusedId={focusedId}
        memberId={memberId}
        onOpen={onFocus}
        onChange={onChange}
        onPay={onPay}
        onAdd={onAdd}
      />
      <AddAccountForm
        household={household}
        writeHousehold={writeHousehold}
        memberId={memberId}
        onSave={onChange}
        openRequest={accountFormOpenRequest}
      />
    </>
  );
}
