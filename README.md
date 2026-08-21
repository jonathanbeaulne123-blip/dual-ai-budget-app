# Hearth

A household budget for Jonathan and Bianca. Toronto time. CAD. Phone-first.

The live kitchen site is [hearth-books.jonathan-beaulne123.workers.dev](https://hearth-books.jonathan-beaulne123.workers.dev/). Shared books are the household Supabase Postgres. This repository is the product.

```text
pnpm install
pnpm test
pnpm dev
```

Open `http://localhost:5173`. **Open the demo kitchen table** loads a fictional six-month household. That is not live production data.

## What you can do today

- Add spend, income, a shift, or a transfer from one `+` button
- Open **Ledger** for Income, Expenses, or Other (refunds and transfers)
- Split a purchase by any percentage — Bianca’s share is typed, Jonathan’s fills to 100%, cents still add up
- Get stopped on a likely duplicate: same amount within five days, plus matching notes, place, category, or source
- Remove a row (with confirm) and undo from the toast or **More → Recent changes**
- Read Home as one net number, a pulse sentence, this week versus last week, and shared goals
- Run a monthly sit-down that copies last month and trims overspent categories
- Keep **Development** and **Production** as two named local ledgers on the same phone
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
   +-- PGlite books (balanced journal on the phone)
   +-- optional publish to Supabase
   +-- Home / Plan / Health are projections
```

There is no Google login, no Sheet, and no formula range that can freeze. A failed command throws before the snapshot is replaced. Undo restores the previous snapshot and tombstones posted ids.

## Household vs personal

Jonathan and Bianca each pick who they are on the phone. **Household** shows shared rows and rows marked **Both**. **Personal** shows that person's personal rows and **Both**.

Invite the other person with a **three-word phrase**, a **join link**, or a **Hearth Pass** (the shared ledger, no personal rows). Personal is a filter, not a lock. Use two phones if you want that split to hold.

## Docs

- Current: [docs/README.md](docs/README.md)
- Vision: [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md)
- History (not a bible): [docs/reference/](docs/reference/)

The Google Sheets / Apps Script prototype is archived as reference under `docs/reference/sheets-era/` and as git tag `sheets-v0.0.31`. It is not the working tree.

## Out of scope until the core is boring

- Real privacy for personal rows (a hidden screen is still visible on a shared phone)
- Bank import adapters
- Live Google Sheets writes
