# Project Charter

## Purpose

Hearth is Jonathan and Bianca’s household company: **family-office quality books** they can post from a phone, and a **companion kitchen** that makes posting, reconciling, and sitting down a Wednesday habit — not a guilt chore.

Dual Course (D-048): the budget side weighs **5**; Hercules and other engagement weigh **3**. Each course must improve the other. When they conflict, the books win.

## Users

Jonathan and Bianca. Toronto. CAD. About 500 transactions per month over time. Bianca is the buyer of the daily habit. Jonathan is product owner, production approver, and tie-breaker (D-005).

## Success

- Bianca can add a grocery trip and a shift without a 15-item menu.
- Health stays clean. Undo exists. Two phones share one household.
- Home is a bank book (wallet tiles) plus a cat who never writes a cent.
- Books can show a CPA an opinion, a balance sheet, and a close pack that match the journal.
- They open Hearth on a Wednesday because Hercules is there **and** because the numbers are true.

## Important features (do not quietly change)

Command kernel; D-016 meanings; CAD; `America/Toronto`; splits that sum; PGlite journal; Health refuses imbalance; Hercules never posts and never names who spent more; no fake fees; no pet-death hunger meter; Auth + RLS before bank / Interac / issued cards; Accounts Floor kinds; card paydown is a transfer; Audit Office is a projection; Development ≠ Production; phrase / join / Hearth Pass.

## Engineering gates (not “out of vision”)

Vision is unbounded under Dual Course ([STRATEGY.md](STRATEGY.md)). These remain **blocked as builds** until the named gate:

- Hosted tenancy: Auth + RLS (stop `USING (true)`).
- Bank feeds, Interac APIs, issued cards, hosted receipt images, amount-bearing push on a shared device: after Auth + RLS, and Jonathan’s approval for production money movement.
- Real privacy for personal rows: Auth, not a hidden screen.
- Multi-currency: only if D-021 is reopened as explicit journal lines.

**Why-note:** older charters said “out of scope until the core is boring.” The core is already a GL. Dual Course does not pretend bank rails are off-limits forever; it refuses to sequence them ahead of the door lock. The Chapter / Ring maps that used to live in this folder are [nostalgia/](nostalgia/).

Sheets-era charter (museum): [reference/sheets-era/PROJECT_CHARTER.md](reference/sheets-era/PROJECT_CHARTER.md).
