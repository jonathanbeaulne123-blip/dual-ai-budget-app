# Roadmap

This is the living near-term plan. The investor / family-office vision — including how Open Banking, Interac, tax lockboxes, issued cards, and BaaS actually attach to this kernel — is [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md). Sheets-era calendars are [reference/sheets-era/ROADMAP.md](reference/sheets-era/ROADMAP.md). History, not a bible.

## Now

- Phone-first Home, Calendar, Add, Plan, Books, More
- Trustworthy commands for spend, income, shift, transfer, category, budget, goals, recurrences
- Calendar board that reads repeating ledger rows, due recurrences, and shifts; optional Google overlay for both people
- `.ics` export with America/Toronto alarms; Google reminder writes never post money
- Double-entry PostgreSQL books (PGlite) with trial balance, journal, registers, and read-only SQL
- Demo household and 12-month fixtures
- Development vs production local snapshots
- Shared / personal / both visibility, household vs personal views
- Phrase / join link / Hearth Pass pairing
- Remove a ledger row (with confirm) and undo the latest change from the toast or More → Recent changes
- Shared books on the household Supabase Postgres (same schema as PGlite)
- Website on Cloudflare Workers + Assets (`hearth-books`)

## Next — Chapter 0 (kitchen-table trust)

Gates, not a pitch-deck month. Details in [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md).

- GitHub 2FA (D-020)
- Auth + RLS (stop `USING (true)`); phrase-join also filters environment
- PGlite database per Development / Production pill
- Sit-down shows dollars; goals are real contributions, not +$50
- Recurring preview on open, then the existing `postEntry` path
- Calendar Google client ID in the Cloudflare build (`VITE_GOOGLE_CLIENT_ID`) so both people can connect from the kitchen site
- JSON import of a sanitized Sheets export through the same commands

## Then — Chapter 1 (frictionless truth)

- IOU object + Interac Request Money deep link (API only with a sponsor)
- CSV inbox → confirm → `postEntry` (import-shaped path from D-011)
- Flinks sandbox after Auth; on-device categorization never auto-posts
- Shift forecast on Home after ≥8 weeks of posted shifts — forecast is not money

## Later — Chapters 2–4

- Tax lockbox after each shift; safe-to-spend / runway; sweep as `postTransfer`
- Issued cards only with a BIN sponsor; FX as explicit journal lines
- Hearth Protocol / BaaS after other households run Chapter 0–1 without a Health incident
