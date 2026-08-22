# Roadmap

This is the living near-term plan. The investor / family-office vision — including how Open Banking, Interac, tax lockboxes, issued cards, and BaaS actually attach to this kernel — is [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md). Sheets-era calendars are [reference/sheets-era/ROADMAP.md](reference/sheets-era/ROADMAP.md). History, not a bible.

## Now

- Phone-first Home, Calendar, Add, Plan, Books, More
- Trustworthy commands for spend, income, shift, transfer, category, budget, goals, recurrences
- Calendar board that reads repeating ledger rows, due recurrences, and shifts; optional Google overlay for both people
- `.ics` export with America/Toronto alarms; Google reminder writes never post money
- Google household bridge: on-demand identity confirmation and suite sync; tokens on this phone; shared snapshot stores who is linked
- Double-entry PostgreSQL books (PGlite) with trial balance, journal, registers, and read-only SQL
- Demo household and 12-month fixtures
- Development vs production local snapshots
- Shared / personal / both visibility, household vs personal views
- Phrase / join link / Hearth Pass pairing
- Home chalkboard, Hercules the Maine Coon (follows every page, Ask is the journal), and a visit spark (cosmetics, not money)
- Audit Office: opinion, balance sheet, P&L, cash flow, equity roll, working capital, notes, bank rec, aged bills, close pack (projections; rec/close never post)
- **Accounts Floor:** chequing, savings, expandable cards (interest/cashback looks), investments, other; Home wallet tiles; Books → Wallet; Add follows the focused account
- Books → Ask: plain-language conversation with the journal; Power SQL stays read-only
- Remove a ledger row (with confirm) and undo the latest change from the toast or More → Recent changes
- Shared books on the household Supabase Postgres (same schema as PGlite)
- Website on Cloudflare Workers + Assets (`hearth-books`)

## Next — Chapter 0 (kitchen-table trust)

Gates, not a pitch-deck month. Details in [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md). Daily habit map: [DAILY_HEARTH.md](DAILY_HEARTH.md).

- GitHub 2FA (D-020)
- Auth + RLS (stop `USING (true)`). Phrase-join already filters environment; PGlite is already per pill
- Recurring preview on open, then the existing `postEntry` path
- Calendar Google client ID in the GitHub Actions **variable** `VITE_GOOGLE_CLIENT_ID` (and Cloudflare **Build** variables if Workers Builds stays on) so both people can connect from the kitchen site ([GOOGLE.md](GOOGLE.md))
- JSON import of a sanitized Sheets export through the same commands
- Ring 1–2 kitchen rituals (cook-off, sit-down postcard, Sunday envelope, seasonal Hercules, trailing-average shift pulse) — largely shipping; keep adding Ring 3 gravity
- Audit Office follow-ons: hash-chained command log, opening balances, rec matching rules (still no bank feed)
- Google kitchen Link remains parked ([GOOGLE.md](GOOGLE.md)) until the public client ID is baked

## Then — Chapter 1 (frictionless truth)

- IOU object + Interac Request Money deep link (API only with a sponsor)
- CSV inbox → confirm → `postEntry` (import-shaped path from D-011)
- Flinks sandbox after Auth; on-device categorization never auto-posts
- Shift forecast *model* after Auth (Chapter 1.3). Trailing-average pulse already shows after ≥8 posted-shift weeks — still not money

## Later — Chapters 2–4

- Tax lockbox after each shift; safe-to-spend / runway; sweep as `postTransfer`
- Issued cards only with a BIN sponsor; FX as explicit journal lines
- Hearth Protocol / BaaS after other households run Chapter 0–1 without a Health incident
