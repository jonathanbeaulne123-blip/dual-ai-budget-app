import { useId, useMemo, useState } from "react";
import { binderyDoorObject } from "../../house/bindery.ts";
import { engravedCents } from "./engraved.ts";
import { readAccounts, readActivity, type DeskAccountTile } from "./accountsModel.ts";
import { shortDate } from "../nav/doorSigns.ts";
import type { DeskPageProps } from "./types.ts";
import "./desk-accounts.css";

/**
 * Accounts — the accounts attached to the Fund (SIMPLE_VIEW_DESK S3 §3). One
 * paper tile per account with the Fund board's own figures (`accountRows`,
 * unchanged), the card's utilization where it applies, and the glance pick
 * marked. A tap unfolds the account's latest register rows in place. The
 * door goes to the Standing Book's Accounts division — the Wallet pane.
 * Nothing here moves money or changes the glance pick.
 */
export function DeskAccounts({ household, memberId, scope, today, onOpen }: DeskPageProps) {
  const accounts = useMemo(() => readAccounts(household, memberId, scope, today), [household, memberId, scope, today]);
  const [open, setOpen] = useState<string | null>(null);
  const ids = useId();
  const personal = accounts.source === "personal";
  return <div className="desk-accounts" data-desk-accounts={accounts.source}>
    <section className="desk-card desk-accounts__glance" aria-labelledby={`${ids}-glance`} data-desk-glance={accounts.glance?.accountId ?? "none"}>
      <h2 className="desk-card__kicker" id={`${ids}-glance`}>{personal ? "Your own accounts" : "At a glance"}</h2>
      {accounts.glance
        ? <>
          <strong className="desk-accounts__glance-name">{accounts.glance.name}</strong>
          <strong className="desk-figure">{engravedCents(accounts.glance.balanceCents)} <small className="desk-accounts__label">{accounts.glance.balanceLabel}</small></strong>
          <span className="desk-card__line">Shown at a glance. {accounts.tiles.length === 1 ? "One shared account" : `${accounts.tiles.length} shared accounts`} below — balances are never added together.</span>
        </>
        : <span className="desk-card__line">{personal
          ? accounts.tiles.length
            ? `${accounts.tiles.length === 1 ? "One personal account" : `${accounts.tiles.length} personal accounts`}, as Personal Books’ Wallet reads them. Shared accounts are read in Shared. Balances are never added together.`
            : "No personal accounts yet. Shared accounts are read in Shared; your own rooms appear here once they are opened in Personal Books."
          : "No shared accounts on this floor yet."}</span>}
    </section>

    {accounts.tiles.length > 0 && <ul className="desk-accounts__tiles" aria-label={personal ? "Your personal accounts" : "Shared accounts"}>
      {accounts.tiles.map(tile => <li key={tile.accountId} className={open === tile.accountId ? "is-open" : undefined}>
        <AccountTile tile={tile} open={open === tile.accountId} onToggle={() => setOpen(current => current === tile.accountId ? null : tile.accountId)}
          household={household} memberId={memberId} scope={scope} today={today} />
      </li>)}
    </ul>}

    <nav className="desk-accounts__doors" aria-label="Accounts doors">
      <button type="button" className="desk-door" data-desk-door="books" onClick={() => onOpen("books", binderyDoorObject("cut-bank"))}>Open the Wallet</button>
    </nav>
  </div>;
}

function AccountTile({ tile, open, onToggle, household, memberId, scope, today }: {
  tile: DeskAccountTile; open: boolean; onToggle: () => void;
} & Pick<DeskPageProps, "household" | "memberId" | "scope" | "today">) {
  const register = useId();
  const pct = tile.utilization === null ? null : Math.round(tile.utilization * 100);
  const hot = pct !== null && pct >= 90;
  return <div className="desk-card desk-account" data-desk-account={tile.accountId} data-account-kind={tile.kind} data-expanded={open || undefined}>
    <button type="button" className="desk-account__press" aria-expanded={open} aria-controls={register} onClick={onToggle}
      aria-label={`${tile.accessibilityName}: ${engravedCents(tile.balanceCents)} ${tile.balanceLabel}${pct !== null ? `, ${pct}% of limit used` : ""}${tile.glance ? ", shown at a glance" : ""}${tile.fundCard ? ", the Fund card" : ""}. ${open ? "Fold the recent rows away." : "Show the recent rows."}`}>
      <span className="desk-account__head">
        <span className="desk-account__name">{tile.name}{tile.detail && <small>{tile.detail}</small>}</span>
        <span className="desk-account__kind">{tile.kindLabel}</span>
      </span>
      {(tile.glance || tile.fundCard) && <span className="desk-account__badges">
        {tile.glance && <span className="desk-account__badge desk-account__badge--glance">At a glance</span>}
        {tile.fundCard && <span className="desk-account__badge">Fund card</span>}
      </span>}
      <span className="desk-account__balance">
        <strong className="desk-figure">{engravedCents(tile.balanceCents)}</strong>
        <span className="desk-accounts__label">{tile.balanceLabel}</span>
      </span>
      {pct !== null && <span className="desk-account__gauge-row">
        <span className={`desk-account__gauge${hot ? " is-hot" : ""}`} aria-hidden="true"><span style={{ width: `${Math.min(100, pct)}%` }} /></span>
        <span className="desk-account__util">{pct}% of limit used</span>
      </span>}
      <span className="desk-account__fold" aria-hidden="true">{open ? "Fold away" : "Recent rows"}<i /></span>
    </button>
    <div id={register} className="desk-account__register" hidden={!open}>
      {open && <Register household={household} memberId={memberId} scope={scope} today={today} accountId={tile.accountId} />}
    </div>
  </div>;
}

/** "Sep 18" this year; "Dec 3, 2025" otherwise, so an old row never reads as this year's. */
function registerDate(date: string, today: string) {
  return date.slice(0, 4) === today.slice(0, 4) ? shortDate(date) : `${shortDate(date)}, ${date.slice(0, 4)}`;
}

function Register({ household, memberId, scope, today, accountId }: Pick<DeskPageProps, "household" | "memberId" | "scope" | "today"> & { accountId: string }) {
  const activity = useMemo(() => readActivity(household, memberId, scope, accountId), [household, memberId, scope, accountId]);
  if (activity.rows.length === 0) return <p className="desk-card__line desk-account__none">Nothing posted to this account yet.</p>;
  return <>
    <table className="desk-account__rows">
      <caption className="desk-account__caption">Latest {activity.rows.length === activity.total ? activity.total : `${activity.rows.length} of ${activity.total}`} {activity.total === 1 ? "row" : "rows"}</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">What</th><th scope="col" className="is-num">Amount</th></tr></thead>
      <tbody>
        {activity.rows.map(row => <tr key={row.id} data-desk-activity={row.id}>
          <td className="is-date"><time dateTime={row.date}>{registerDate(row.date, today)}</time></td>
          <td className="is-label">{row.label}<small>{row.word}</small></td>
          <td className="is-num">{engravedCents(row.amountCents)}</td>
        </tr>)}
      </tbody>
    </table>
    {activity.total > activity.rows.length && <p className="desk-card__line desk-account__more">The full register is in the Wallet.</p>}
  </>;
}
