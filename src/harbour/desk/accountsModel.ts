/**
 * The Desk's Accounts page, read (SIMPLE_VIEW_DESK S3 §3): the accounts
 * attached to the Fund. Pure functions over shipped selectors only — nothing
 * here posts, writes or changes a glance pick, and nothing here computes a
 * balance of its own:
 *
 * - Shared scope: `accountRows` and `chosenAccount` (`core/accountsWidget.ts`)
 *   read **unchanged** — the same figures the Fund board's Accounts stage
 *   shows. The accountsWidget-vs-Books-floor divergence is an open ruling for
 *   Jonathan; the Desk neither resolves it nor mixes the two readings.
 * - Personal scope: `accountRows` is the Shared Fund surface and never lists a
 *   personal room, so the Desk shows this member's own personal accounts as
 *   Personal Books' Wallet reads them (`walletForListedAccounts`), and says
 *   that Shared accounts are read in Shared.
 * - A tile's recent rows: `accountActivity` (the Wallet room's own Activity
 *   list) over the Books presentation floor for this scope, so a row the
 *   scope does not show is never shown here. Date, words, amount — the app
 *   has no per-row running balance, so neither does the Desk.
 *
 * Unknown amounts stay `null` and read "—" downstream.
 */
import { ACCOUNT_KIND_LABEL, isCreditKind, isInvestmentKind } from "../../core/accountKinds.ts";
import { accountActivity, walletForListedAccounts } from "../../core/accounts.ts";
import { accountRows, chosenAccount } from "../../core/accountsWidget.ts";
import type { DateKey } from "../../core/calendar.ts";
import { booksPresentationFloor } from "../../core/ledgerExperience.ts";
import { categoryName } from "../../core/ledgerView.ts";
import type { AccountKind, Household, LedgerView, Transaction } from "../../core/types.ts";

export type DeskAccountTile = {
  accountId: string;
  name: string;
  /** Tells two same-named accounts apart ("Owed to us 2"); null when the name is enough. */
  detail: string | null;
  accessibilityName: string;
  kind: AccountKind;
  kindLabel: string;
  /** Null is unknown, never zero. */
  balanceCents: number | null;
  balanceLabel: string;
  /** Credit cards only, 0–1. Null for every other kind. */
  utilization: number | null;
  /** The member's glance pick (`chosenAccount`). */
  glance: boolean;
  /** The Fund's backing card. */
  fundCard: boolean;
};

export type DeskAccounts = {
  available:boolean;
  scope: LedgerView;
  /** "shared": `accountRows`, unchanged. "personal": this member's own rooms, as the Wallet reads them. */
  source: "shared" | "personal";
  tiles: DeskAccountTile[];
  glance: DeskAccountTile | null;
};

const finite = (cents: number | null | undefined): number | null => (typeof cents === "number" && Number.isFinite(cents) ? cents : null);

/** The page's tiles for this scope. Never throws: an unreadable ledger is an empty page, never a crash. */
export function readAccounts(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskAccounts {
  if (scope === "personal") {const tiles=readPersonalTiles(household,memberId,today);return {available:tiles!==null,scope,source:"personal",tiles:tiles??[],glance:null};}
  try {
    const chosen = chosenAccount(household, memberId, today);
    const tiles = accountRows(household, memberId, today).map((row): DeskAccountTile => ({
      accountId: row.accountId,
      name: row.name,
      detail: row.detailLabel,
      accessibilityName: row.accessibilityName,
      kind: row.kind,
      kindLabel: ACCOUNT_KIND_LABEL[row.kind] ?? row.kind,
      balanceCents: finite(row.balanceCents),
      balanceLabel: row.balanceLabel,
      utilization: row.utilization,
      glance: chosen?.accountId === row.accountId,
      fundCard: row.isFundCard,
    }));
    return { available:true, scope, source: "shared", tiles, glance: tiles.find(tile => tile.glance) ?? null };
  } catch {
    return { available:false, scope, source: "shared", tiles: [], glance: null };
  }
}

/**
 * This member's own personal accounts, with the figure Personal Books' Wallet
 * room leads with (`walletForListedAccounts` over the raw books, the same call
 * the Books Wallet pane makes): a card's balance owed, every other kind's
 * display balance.
 */
function readPersonalTiles(household: Household, memberId: string, today: DateKey): DeskAccountTile[] | null {
  try {
    const own = household.accounts
      .filter(account => account.active && account.scope === "personal" && account.ownerMemberId === memberId)
      .sort((left, right) => left.name.localeCompare(right.name));
    if (own.length === 0) return [];
    const wallet = walletForListedAccounts(household, own.map(account => account.id), today);
    const tiles = new Map(wallet.tiles.map(tile => [tile.account.id, tile] as const));
    return own.map((account): DeskAccountTile => {
      const tile = tiles.get(account.id);
      const credit = isCreditKind(account.kind);
      return {
        accountId: account.id,
        name: account.name,
        detail: null,
        accessibilityName: account.name,
        kind: account.kind,
        kindLabel: ACCOUNT_KIND_LABEL[account.kind] ?? account.kind,
        balanceCents: tile ? finite(credit ? tile.balanceCents : tile.displayCents) : null,
        balanceLabel: credit ? "owed" : isInvestmentKind(account.kind) ? "held" : "book balance",
        utilization: tile?.credit?.utilization ?? null,
        glance: false,
        fundCard: false,
      };
    });
  } catch {
    return null;
  }
}

export type DeskActivityRow = {
  id: string;
  date: DateKey;
  label: string;
  /** Null is unknown, never zero. */
  amountCents: number | null;
  /** Which way it went for this account, in words: "Out", "In", "Refund", "Transfer in"… */
  word: string;
};

export type DeskActivity = { available:boolean; rows: DeskActivityRow[]; total: number };

/** The Wallet room's own words for a row: the note, the place, the category, or the type. */
function rowLabel(household: Household, tx: Transaction): string {
  const category = tx.subcategoryId ? categoryName(household, tx.subcategoryId) : "";
  return tx.note?.trim() || tx.place?.trim() || category || tx.type;
}

function rowWord(tx: Transaction, accountId: string): string {
  if (tx.reversalOfId) return "Reversal";
  if (tx.type === "transfer") return tx.transferToAccountId === accountId ? "Transfer in" : "Transfer out";
  if (tx.type === "expense") return "Out";
  if (tx.type === "income") return "In";
  if (tx.type === "refund") return "Refund";
  if (tx.type === "opening") return "Opening";
  return tx.type;
}

/** The latest register rows for one account, newest first. */
export function readActivity(household: Household, memberId: string, scope: LedgerView, accountId: string, limit = 8): DeskActivity {
  try {
    const floor = booksPresentationFloor(household, memberId, scope);
    const all = accountActivity(floor, accountId);
    return {
      available:true, total: all.length,
      rows: all.slice(0, limit).map(tx => ({
        id: tx.id,
        date: tx.date,
        label: rowLabel(floor, tx),
        amountCents: finite(tx.amountCents),
        word: rowWord(tx, accountId),
      })),
    };
  } catch {
    return { available:false, rows: [], total: 0 };
  }
}
