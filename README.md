# Hearth

A household budget for Jonathan and Bianca.

This branch is a ground-up rebuild of the Sheets/Apps Script app on `main`. It keeps the financial rules that were already right — Toronto time, CAD, untrusted input, cent rounding, duplicate fingerprints versus reviewed exclusions, shift preview = post — and replaces the spreadsheet runtime with a portable TypeScript ledger plus a phone-first interface.

Open it:

```text
pnpm install
pnpm test
pnpm dev
```

Then visit `http://localhost:5173`. Choose **Open the demo kitchen table** to load a fictional six-month household. Nothing here is live production data.

A Netlify site can still host the static app. It is not the database. The books are PostgreSQL: PGlite inside the app (Postgres 18), with a SQL dump that loads onto Neon or Supabase. Open **Books** for the journal, trial balance, account registers, and a read-only SQL console.

Until that hosted Postgres project exists, each phone still has a complete, balanced ledger on-device.

## Why this exists

The Sheets app became a trustworthy write kernel trapped in a 3,300-line `Code.gs`, a 15-item operator menu, and a dashboard that was a rebuilt spreadsheet. Bianca cannot live there. This rebuild is the comparison: same household, same money rules, a product she can open on a phone.

## What you can do today

- Add spend, income, a shift, or a transfer from one `+` button
- Open **Ledger** to see every row under Income, Expenses, or Other (refunds and transfers)
- Split a purchase by any percentage — Bianca’s share is typed, Jonathan’s fills to 100%, cents still add up
- Get stopped on a likely duplicate: same amount within five days, plus matching notes, place, category, or source
- Undo the last save for a few seconds
- Read Home as one net number, a pulse sentence, this week versus last week, and shared goals
- Run a monthly sit-down that copies last month and trims overspent categories
- Keep development and production as two named local ledgers, not two lookalike workbooks
- Choose **Shared**, **Personal**, or **Both** on every add; switch Household vs Personal at the top
- Open **Books** for a general journal, trial balance, account register, and read-only SQL
- Invite the other person with a three-word phrase, a join link, or a Hearth Pass
- Export JSON or a PostgreSQL dump; run Health and get a clean bill or a specific finding

Transfers never count as income or expense. Refunds reverse category spend. Shift tip math is the verified cent-rounded household rules, including negative net tips.

## Architecture in one page

```text
UI (React, untrusted)
   |
   v
Pure commands (validate → clone → commit → refresh flags)
   |
   v
Household snapshot (JSON)
   |
   +-- Home / Plan / Health are projections of that snapshot
```

There is no Google login, no Sheet, no formula range that can freeze at row 33. A failed command throws before the snapshot is replaced, so there is nothing to roll back except Undo, which restores the previous snapshot.

## Household vs personal

Jonathan and Bianca each pick who they are on the phone. **Household** shows shared rows and rows marked **Both**. **Personal** shows that person's personal rows and **Both**. The other person's personal rows stay in their personal database.

Invite the other person with a **three-word phrase**, a **join link**, or a **Hearth Pass** (the shared ledger, no personal rows). The money itself lives in a **double-entry PostgreSQL journal** on the phone. A six-character code is no longer the product. Netlify is a static host, not the books.

Personal is a filter, not a lock. Use two phones if you want that split to hold.

## Tests

`pnpm test` covers Toronto week bounds, shift math against the original vectors, duplicate flags, exact splits, atomic posts, transfer exclusion, shift undo, category commits, a health-clean demo household, a 12 × 200 transaction fixture, double-entry balance, and PGlite ingest against Postgres 18.

## Compare with `main`

```text
git diff main --stat
```

`docs/COMPARISON.md` maps every issue from the review onto this rebuild.

## Out of scope here

- Real privacy for personal rows (a hidden screen is still visible on a shared phone; personal is a filter)
- Bank import adapters
- Live Google Sheets writes
