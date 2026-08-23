# Audit Office

**The books, visible:** Hercules got the meeting. The general ledger keeps the money.

Hearth was already a household general ledger. The Audit Office is how we show that to a room that met the cat first. Rec and close never call `postEntry`. If a statement disagrees with the journal, the journal wins.

The accounting equation is **Assets = Liabilities + Equity**. The on-phone check that net worth equals retained income is a **closing identity** for a household that opened at zero with no draws — not a rewrite of the equation. Do not tell a CPA “Assets − Liabilities = Net Income.”

Remove still **deletes the posted row** (tombstone + undo on this phone). That is not a reversing entry. Do not say “audit ready” or “SOC” while that is true and while hosted RLS is `USING (true)`. CPA sequencing: [CPA.md](CPA.md).

Laws: [DECISIONS.md](DECISIONS.md) D-033 / D-046 / D-081. Strategy: [STRATEGY.md](STRATEGY.md). Museum essay: [nostalgia/AUDIT_OFFICE.md](nostalgia/AUDIT_OFFICE.md).

## What you can open

Opinion (unmodified / qualified / adverse), balance sheet, income statement, cash flow (card spend vs paydown vs investing), equity roll, working capital watch, trial balance, manual bank rec, aged bills, notes, downloadable close pack, period close with a second look, reopen that tombstones.

Tied rec unlocks Hercules’s **audit spectacles**. A closed month unlocks the **green-ink stamp**.

**Kill criterion:** if rec posts money, roll it back. An opinion on an open hosted door (`USING (true)`) is still a qualified opinion about **access**, even when the math is unmodified.

## Dual Course

A new statement or control must give Hercules one grounded sentence (Course B) and must stay a projection over the journal (Course A). Vision for hash-chained logs, opening balances, matching rules, auditor passes: [STRATEGY.md](STRATEGY.md). Bank feeds still wait on Auth + RLS.

## How to try it

1. **App/website:** Hearth (kitchen site or `pnpm dev`)
2. **Tab/page:** Home for the opinion chip. Books → **Statements** / **Reconcile** / **Close pack**.
3. **Instructions:**
   1. Open the demo kitchen table (Development).
   2. Home shows `unmodified` or `qualified` next to the net.
   3. Books → **Statements**. Assets should equal liabilities + equity. The net-worth = retained-income line is the zero-opening closing check. Equity should roll. If a personal account covered a split, **Between you** names the transfer — not Interac. Hercules: **Who owes whom?**
   4. Books → **Reconcile**. Type a statement balance. Tied unlocks spectacles under Hercules’s things.
   5. Books → **Close pack**. Close last month. Download the pack. Green-ink stamp unlocks. Tap Hercules: **Opinion?** or **Working capital?**
   6. Try posting into that closed month from Add. Confirm is the restatement. Reopen tombstones the close so the other phone cannot bring it back.
