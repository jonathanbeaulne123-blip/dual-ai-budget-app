# Hearth

A household budget and companion kitchen for Jonathan and Bianca. Toronto time. CAD. Phone-first. Dual Course: books weigh 5, Hercules weighs 3.

The live kitchen site is [hearth-books.jonathan-beaulne123.workers.dev](https://hearth-books.jonathan-beaulne123.workers.dev/). Merge to `main` publishes it. Shared books are the household Supabase Postgres. This repository is the product.

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
- Open **Calendar** for a Toronto month of bills, pay, and shifts; adopt repeating ledger rows; download an `.ics` with alarms; optionally overlay both Google accounts
- Remove a row (with confirm) and undo from the toast or **More → Recent changes**
- Read Home as chalkboard, wallet tiles (tap an account like a bank app), one net number, a pulse sentence, this week versus last week, upcoming money dates, and shared goals. Hercules wanders the screen; tap him, then type in the bubble to chat. Home shows his audit opinion next to the net
- Open **Books → Wallet** for chequing, savings, cards, the TFSA, and the jar; **All activity** is still the type-first register. Pay a card is a transfer. Interest and cashback never post themselves
- Open **Books** for a general journal, trial balance, balance sheet, P&L, cash flow (including investing vs card paydown), equity roll, working capital, notes, bank rec, close pack, and read-only SQL
- Ask Hercules in plain language from the cat or Books → Ask (**Opinion?**, **Working capital?**, **What’s on the Visa?**); Power SQL stays read-only. The cat never posts
- Run a monthly sit-down that copies last month in CAD and trims overspent categories
- Keep **Development** and **Production** as two named local ledgers on the same phone
- Choose **Shared**, **Personal**, or **Both** on every add; switch Household vs Personal at the top
- Invite the other person with a three-word phrase, a join link, or a Hearth Pass
- Link Google on More → Google household bridge so both phones know who is who; Calendar can overlay both calendars
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
   +-- PGlite books (balanced journal on the phone — the books engine)
   +-- optional JSON snapshot on Supabase (open door until Auth)
   +-- Home / Plan / Health are projections
```

There is no Google Sheet, and no formula range that can freeze. Google sign-in is optional: it identifies Jonathan and Bianca and syncs Calendar (and other Google apps you turn on). It never posts money. A failed command throws before the snapshot is replaced. Undo restores the previous snapshot and tombstones posted ids.

## Household vs personal

Jonathan and Bianca each pick who they are on the phone. **Household** shows shared rows and rows marked **Both**. **Personal** shows that person's personal rows and **Both**.

Invite the other person with a **three-word phrase**, a **join link**, or a **Hearth Pass** (the shared ledger, no personal rows). Personal is a filter, not a lock. Use two phones if you want that split to hold. Google is the household bridge after that: each person links their own account; tokens stay on that phone.

## Dual Course

Family-office books weigh **5**. Hercules and other interactables weigh **3**. Each update should improve the other course. If they conflict, the books win. Living law: [docs/STRATEGY.md](docs/STRATEGY.md).

## Docs

- Index: [docs/README.md](docs/README.md)
- Dual Course strategy: [docs/STRATEGY.md](docs/STRATEGY.md)
- Hercules: [docs/HERCULES.md](docs/HERCULES.md)
- Audit Office: [docs/AUDIT_OFFICE.md](docs/AUDIT_OFFICE.md)
- Accounts Floor: [docs/ACCOUNTS.md](docs/ACCOUNTS.md)
- Google household bridge: [docs/GOOGLE.md](docs/GOOGLE.md)
- Nostalgia (do not build from): [docs/nostalgia/](docs/nostalgia/)
- Sheets-era history: [docs/reference/](docs/reference/)

The Google Sheets / Apps Script prototype is archived as reference under `docs/reference/sheets-era/` and as git tag `sheets-v0.0.31`. It is not the working tree.

## Gated until Auth + RLS (not “unthinkable”)

Vision is unbounded under Dual Course. These remain **blocked as builds** until the hosted door locks (D-039):

- Real privacy for personal rows (a hidden screen is still visible on a shared phone)
- Bank import adapters that write, Open Banking, Interac APIs, issued cards
- Hosted receipt images and amount-bearing push on a shared device

Live Google Sheets writes are gone with the prototype; Google is a household bridge and never posts money.
