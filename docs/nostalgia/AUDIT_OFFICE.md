> **Nostalgia — do not build from this file.** Living how-to: [../AUDIT_OFFICE.md](../AUDIT_OFFICE.md). Living law: [../STRATEGY.md](../STRATEGY.md).

# The Audit Office

**Selling point:** Hercules got the meeting. The general ledger keeps the money.

Investors who discovered Hearth through a Maine Coon are right to ask whether this is a toy. This file is the answer: Hearth already was a household **general ledger** (Sheets `v0.0.31` → command kernel → PGlite trial balance). The Audit Office is how we **show** that to a room that met the cat first.

Related: [../DECISIONS.md](../DECISIONS.md) D-033 / D-046, [HERCULES.md](HERCULES.md), [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md).

---

## What we inherited (Sheets → now)

The Sheets era already refused to be Mint:

- Transaction Input as a validator plus a locked commit
- Add Shift: one calculation for preview and post; negative net tips allowed
- CAD only; Toronto civil dates
- Duplicate fingerprint vs reviewed flag
- Development vs production never mixed

The Cursor rebuild kept every one of those laws and put them in PostgreSQL: `compileHousehold` turns each command document into balanced debit/credit lines. Health refuses an unbalanced journal. Transfers are not expenses. Splits must sum.

That is accounting. It was just living behind a Books tab that looked like a developer tool.

## What ships in this wave (investor-visible)

| Surface | What a CPA recognizes | What Hercules says |
|---|---|---|
| **Opinion** | Unmodified / qualified / adverse from trial balance + equation + Health | “Unmodified. Debits match credits. I loaf.” |
| **Balance sheet** | Assets = liabilities + retained earnings | “That’s a balance sheet, not a vibe.” |
| **Changes in equity** | Opening RE + net income = closing RE | “That’s an equity roll, not a vibe.” |
| **Income statement** | Month P&L vs budgeted net and vs prior month | Points at in / out / net. Does not write. |
| **Cash flow** | Cash operating vs card spend vs Visa paydown (transfer) vs investing in/out | “Card spend is not cash until you pay the Visa.” |
| **Working capital** | Current A − L, current ratio, 30-day bills vs cash | “Liquidity is ordinary.” or a watch, never a prophecy |
| **Trial balance** | Debits = credits, already in PGlite | Chip: **Opinion?** / **Trial balance** |
| **Bank rec** | Statement ending vs register as-of; tied / open. Not a feed | Tied rec unlocks **audit spectacles** |
| **Period close** | Close last month; posting in needs a second look; reopen tombstones | “That month is closed. Confirm if you mean it.” |
| **Aged bills** | Current / 1–7 / 8–30 / 31+ on recurrences | Will not fake a late fee |
| **Notes** | Eight notes including related parties and controls | **Accounting policies?** |
| **Close package** | Downloadable text: opinion, BS, equity, P&L, cash, WC, trial, aging, recs, notes | “Download it. I don’t email a CPA.” |
| **Green ink** | Close a month → collar stamp | Earned from the control, not bought |

None of these call `postEntry`. Rec and close are kitchen commands with empty `postedIds`. Mark paid on Calendar still counts as the second look into a closed month.

**Kill criterion:** if a statement disagrees with the journal, the journal wins and the statement is a bug. If a rec posts money, roll it back.

## How to try it

1. Development. Demo kitchen table.
2. Home shows `unmodified` or `qualified` next to the net.
3. Books → **Statements**. Assets should equal liabilities + equity. Equity should roll. Working capital is a watch, not a bank covenant.
4. Books → **Reconcile**. Type a statement balance. Tied unlocks spectacles under Hercules’s things.
5. Books → **Close pack**. Close last month. Download the pack (notes included). Green-ink stamp unlocks. Tap Hercules: **Opinion?** or **Working capital?**
6. Try posting into that closed month from Add. Confirm is the restatement. Reopen tombstones the close so the other phone cannot bring it back.

## Far future (nothing here is impossible)

Treat every line as a seed, not a ceiling. Competitors we watch without copying: QuickBooks/Xero/Wave (statements), YNAB (envelopes as *memo on a GL*, never instead of one), Actual (local-first), Cleo/Finch (companion), Bloomberg/Addepar (family office), CaseWare/MindBridge (audit analytics).

| Horizon | Expand into |
|---|---|
| Controls | Hash-chained command log; maker-checker on Production; period lock that *refuses* (not only confirms) after a CPA mandate; SOX-lite narrative mapped to `postEntry` |
| Statements | Classified BS; comparative years; 13-week cash; IAS 7 full; MD&A chalkboard; opening balances so equity has a true beginning |
| Rec | Rules matching (amount + 2 days); partial rec; three-way match (note, receipt image after Auth, bank inbox after Flinks) |
| Audit | External-auditor Hearth Pass (read-only, no personal rows); continuous audit Worker; anomaly scores that never auto-post |
| Close | XBRL/iXBRL; CRA T2125 pack from shift + lockbox; WSIB pack; PDF signed close; advisor portal |
| Multi-entity | Third member, cottage corp, rental; consolidating worksheet; intercompany eliminations as transfers |
| Measurement | Fund/envelope *tags* on journal lines; IFRS vs ASPE household notes; FX lines (D-021 gate) |
| Liquidity | Runway widget that matches books; covenants only after we have a lender — we should not become a bank |
| Assurance | SOC 2 on the protocol; tenancy after Chapter 4; Hercules as the *face* of the control environment, never the control |
| Companions | Spectacles that fog when the trial is off; green-ink stamp on unmodified close; fieldwork that walks the journal; licensed CPA overlay that still cannot post |
| Distribution | White-label Audit Office for credit unions; BaaS customers skin the cat, keep the opinion |

Bank feeds, Interac, and issued cards still wait on Chapter 0.1 (Auth + RLS). An opinion on an open hosted door is still a qualified opinion about **access**, even when the math is unmodified.
