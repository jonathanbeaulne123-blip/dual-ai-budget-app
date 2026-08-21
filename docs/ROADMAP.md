# Roadmap

## Now — Hearth on this branch

- Phone-first Home, Add, Plan, Books, More
- Trustworthy commands for spend, income, shift, transfer, category, budget, goals, recurrences
- Double-entry PostgreSQL books (PGlite) with trial balance, journal, registers, and read-only SQL
- Demo household and 12-month fixtures
- Development vs production local snapshots
- Shared / personal / both visibility, household vs personal views
- Phrase / join link / Hearth Pass pairing
- Shared books on the household Supabase Postgres (same schema as PGlite)
- Website on Cloudflare Workers + Assets (`hearth-books`); Netlify is rollback only

## Next, only after Jonathan uses it for real weeks

- JSON import of a sanitized development export from the Sheets app, mapped through the same commands
- Recurring auto-post on open, with a preview of the next three dates
- CSV bank import into the same `postEntry` path
- A real auth layer if personal rows must be private

## Later

- Canadian bank adapters
- Multi-currency
- A real auth layer if personal rows must be private
- Event-sourced server if household scale stops being household scale

There are no September 2 goal-engine calendar dates. Features follow use, not a six-week product fantasy.
