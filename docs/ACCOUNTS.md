# Accounts Floor

**The object is the account:** tap chequing, a card, savings, or the TFSA, then see that account’s activity the way a bank app works.

**D-165 (this branch / PR #244):** Personal Books is that floor — household-visible rooms plus this member’s rooms, never partner-personal. Shared is one pool; Kitty Banks are sub-accounts of the pool, not a second room list. On current `main`, D-165 is Evidence queue batching; Codex integration re-homes this floor law as **D-173**. Do not change the floor meaning.

Mint taught envelopes glued to a feed. YNAB taught a Visa that pretends to be a budget. Hearth already knew a card payment is a transfer (D-016). This floor makes **the financial account** — not the category — how Jonathan and Bianca touch the books.

Laws: [DECISIONS.md](DECISIONS.md) D-016 / D-022 / D-047. Strategy: [STRATEGY.md](STRATEGY.md). Museum essay: [nostalgia/ACCOUNTS.md](nostalgia/ACCOUNTS.md).

## Kernel (do not change the meanings)

| Kind | Chart | Money meaning |
|---|---|---|
| Chequing | asset 11xx | Everyday cash |
| Savings | asset 12xx | Cash-like. APY is a look. `purpose: "goals"` is the Goals vault (D-088); general HIS stays everyday parking. |
| Other | asset 13xx | Jar / tips (old `cash` on load) |
| Receivable | asset 132x | Money owed to us. Settlement is a transfer, never income (D-053) |
| Investment | asset 14xx | Cost basis from posts. Mark is not a post |
| Credit | liability 21xx | What you owe. Paydown = transfer |

Commands: `addAccount`, `updateAccount`, `archiveAccount`, `markInvestmentValue` (`postedIds` empty), `postCardInterest`, `postCardRewards`, `postSavingsInterest`. Interest and rewards still go through `postEntry`. High utilization is a pulse / Hercules line, **not** a Health finding. No bank feed. CAD. `America/Toronto`.

**D-022 why-note:** the selector law is unchanged — show an account picker whenever more than one account exists. Seed copy still mentions chequing, Visa, and cash because that is the defect it prevents (hidden first-active-account). The catalog kinds are D-047; `cash` migrates to `other` via `shapeAccounts`. We did not rewrite D-022’s examples so the original bug stays named.

## Dual Course

A new account kind or look must stay a projection until an explicit command posts (Course A) and must have a tile, room, or Hercules question (Course B). Live quotes, Flinks, Interac, issued cards: Auth + RLS first.

## How to try it

1. **App/website:** Hearth (kitchen site or `pnpm dev`)
2. **Tab/page:** Home → wallet tiles under the net. Or Books → **Wallet**.
3. **Instructions:**
   1. Open the demo kitchen table (Development).
   2. Tap **Visa** (or Mastercard). That account’s room opens on Books.
   3. Read owed, utilization, due date, estimated interest, cashback this cycle. Nothing has posted.
   4. **Pay this card** opens Add as a transfer from chequing. Confirm. That is D-016.
   5. **Post estimated interest** / **Post cashback to card** only when the statement actually charged or credited you.
   6. Open **TFSA**. Cost basis is transfers in. **Mark value** types a market number. It does not post.
   7. **Open an account** adds another card, a HISA, or another vehicle. Archive needs at least one CAD account left.
   8. Demo wallet group **Owed to us** is Benefits owing — a receivable, not the jar. Settlement is a transfer.
