> **Nostalgia — do not build from this file.** Living how-to: [../ACCOUNTS.md](../ACCOUNTS.md). Living law: [../STRATEGY.md](../STRATEGY.md).

# The Accounts Floor

**Selling point:** Hearth is a household **bank book**, not a pile of categories. You tap chequing, a card, savings, or the TFSA — then you see that account’s activity, the way a bank app works. Mint died as a feed glued to envelopes. YNAB is envelopes that pretend the Visa is a budget. Hearth already knew a card payment is a transfer. This floor makes **the account** the way Jonathan and Bianca touch the books.

Related: [../DECISIONS.md](../DECISIONS.md) D-016 / D-022 / D-047, [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md), [AUDIT_OFFICE.md](AUDIT_OFFICE.md).

---

## What we studied (and what we refuse)

| Rival / pattern | What they got right | What we refuse | What Hearth does |
|---|---|---|---|
| **Bank apps** (TD, RBC, EQ) | Tiles → tap account → that account’s register. Add defaults to the focused account. Last-4 and institution on the tile. | A feed that writes. A “product” screen that hides the journal. | Wallet tiles on Home. Books → Wallet is the account room. `+` follows the focused account. |
| **Mint / Copilot** | Net worth rollup. Card utilization as a glance. | Auto-import as truth. Categories as the primary object. Dead product, live habit of distrust. | Net worth is cash + investment cost − cards. Utilization is a pulse and a Hercules line, **not** a Health finding. |
| **YNAB** | Give every dollar a job. | Treating the Visa as an envelope. Card payment as spend. | Card spend is an expense on the liability. Paying the card is `postTransfer`. D-016 still wins. |
| **Simplii / Tangerine / KOHO** | HISA APY on the savings tile. Cashback as a number. | APY or cashback that posts itself. Points as a second currency. | APY and cashback are **looks**. Post interest / rewards is an explicit command. CAD only. |
| **Wealthsimple / Questrade** | TFSA / RRSP / FHSA as vehicles. Cost vs market. | A live quote feed in Chapter 0. Unrealized gain as spendable cash. | Investment account + vehicle. Cost basis from transfers in. `markInvestmentValue` is typed, `postedIds` empty. Unrealized is not money. |
| **Monzo / Revolut pots** | Named jars next to the main account. | A second ledger, or pots that skip the journal. | `other` is the jar / tips envelope (old `cash`). Same command kernel. |
| **Amex / card issuer apps** | Statement day, due date, min pay, utilization bar, rewards. | A fee Hercules “levies.” Auto-posting interest. | Card desk: limit, APR, statement cycle, grace if paid in full, est. interest, min-pay path, grocery bonus bps. Post is still `postEntry`. |

Cutting-edge extras that **fit this kernel** (shipped here) and ones that **wait**:

Shipped as projections or commands, not feeds:

- Expandable cards (`addAccount` kind `credit`) — not a hardcoded Visa
- Grocery (or any subcategory) bonus cashback rules
- Statement-credit vs deposit-to-chequing when rewards actually land
- Estimated interest if you only pay the minimum
- Savings APY monthly estimate
- TFSA/RRSP/FHSA/crypto vehicles
- Cash-flow **investing in/out** vs debt paydown
- Hercules: *What’s on the Visa?*, *Utilization?*, wallet briefing (chequing CAD, cards owed, hottest utilization). He does not invent APR. He does not name who spent.
- Card clip cosmetic when a second card exists

Still blocked until Auth + RLS (D-039, Chapter 0.1):

- Flinks / Open Banking / Plaid
- Interac
- Issued cards / BaaS
- Live market quotes

---

## How to try it

1. **App/website:** Hearth (kitchen site or `pnpm dev`)
2. **Tab/page:** Home → Wallet tiles under the net. Or Books → **Wallet**.
3. **Instructions:**
   1. Open the demo kitchen table.
   2. Tap **Visa** (or Mastercard). That account’s room opens on Books.
   3. Read owed, utilization, due date, estimated interest, cashback this cycle. Nothing has posted.
   4. **Pay this card** opens Add as a transfer from chequing. Confirm. That is D-016.
   5. **Post estimated interest** / **Post cashback to card** only when the statement actually charged or credited you.
   6. Open **TFSA**. Cost basis is transfers in. **Mark value** types a market number. It does not post.
   7. **Open an account** adds another card, a HISA, or another vehicle. Archive needs at least one CAD account left.

---

## Kernel

| Kind | Chart | Money meaning |
|---|---|---|
| Chequing | asset 11xx | Everyday cash |
| Savings | asset 12xx | Cash-like. APY is a look |
| Other | asset 13xx | Jar / tips (migrated from `cash`) |
| Investment | asset 14xx | Cost basis from posts. Mark is not a post |
| Credit | liability 21xx | What you owe. Paydown = transfer |

Commands: `addAccount`, `updateAccount`, `archiveAccount`, `markInvestmentValue` (`postedIds` empty), `postCardInterest`, `postCardRewards`, `postSavingsInterest`. All interest/rewards still go through `postEntry`. Closed-month confirm still applies.

Old snapshots: `kind: "cash"` → `other` on load (`shapeAccounts` in `ensureHouseholdShape`).
